import http from 'node:http';
import {acquireLock} from './lib/service-lock.mjs';
import {sourceText} from './lib/source-bundle.mjs';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {Store,Runner,exportRun,hash} from './lib/runner.mjs';
import {extraNames} from './lib/extended-contract.mjs';
import {instantiatePreset} from './lib/quick-plans.mjs';
import {suiteVerdict} from './lib/gates.mjs';
import {seed} from './lib/seed.mjs';
import {inventory} from './lib/adapters.mjs';
import {VERSION,TYPES,CATEGORIES,templates,validateLibrary} from './lib/contract.mjs';
export const ROOT=path.dirname(fileURLToPath(import.meta.url));
export function createApp({dataDir=process.env.COCKPIT_DATA??path.join(ROOT,'.data'),initial=seed(ROOT)}={}){
 const release=acquireLock(dataDir);let store;try{store=new Store(dataDir,initial)}catch(e){release();throw e}const runner=new Runner(store),token=crypto.randomBytes(32).toString('hex');
 const presets=JSON.parse(fs.readFileSync(path.join(ROOT,'resources','quick-presets.json'),'utf8'));
 const gates=()=>Object.fromEntries(store.library.suites.map(s=>[s.id,suiteVerdict(s,store.library,store.runs.values(),runner.engineHash)]));
 const server=http.createServer(async(req,res)=>{
 const send=(code,data,type='application/json')=>{res.writeHead(code,{'Content-Type':type+'; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'"});res.end(type==='application/json'?JSON.stringify(data):data)};
 try{
 const localPort=server.address().port,origin=`http://127.0.0.1:${localPort}`;
 if(![`127.0.0.1:${localPort}`,`localhost:${localPort}`].includes(req.headers.host))return send(403,{error:'Ungültiger Host'});
 if(req.headers.origin&&![origin,`http://localhost:${localPort}`].includes(req.headers.origin))return send(403,{error:'Fremder Origin'});
 const url=new URL(req.url,origin),p=url.pathname;
 if(req.method==='GET'&&p==='/api/health')return send(200,{ok:true,application:'evaluator-inspector',root:ROOT,version:VERSION,engineHash:runner.engineHash});
 if(req.method==='GET'&&p==='/api/bootstrap')return send(200,{token,version:VERSION,types:TYPES,typeNames:extraNames,categories:CATEGORIES,templates,library:store.library,libraryRevision:hash(store.library),gates:gates(),presets,runs:store.listRuns(),warnings:store.warnings,active:runner.active?.id??null});
 if(p.startsWith('/api/')&&req.headers['x-cockpit-token']!==token)return send(403,{error:'Lokaler Sitzungsschlüssel fehlt'});
 let body={};if(['POST','PUT'].includes(req.method)){let parts=[],size=0;for await(const b of req){size+=b.length;if(size>4*1024*1024)return send(413,{error:'Eingabe überschreitet 4 MiB'});parts.push(b)}body=JSON.parse(Buffer.concat(parts).toString()||'{}')}
 if(req.method==='GET'&&p==='/api/library')return send(200,store.library);
 if(req.method==='PUT'&&p==='/api/library'){if(runner.active)return send(409,{error:'Bibliothek während eines Laufs gesperrt'});validateLibrary(body);if(req.headers['if-match']!==hash(store.library))return send(409,{error:'Bibliothek wurde inzwischen geändert. Neu laden, bevor du speicherst.'});for(const project of body.projects){if(!fs.statSync(project.root).isDirectory())throw Error('Projektordner fehlt: '+project.root)}store.saveLibrary(body);return send(200,{library:store.library,libraryRevision:hash(store.library),gates:gates()})}
 if(req.method==='POST'&&p==='/api/quick-plans'){if(runner.active)throw Error('Bibliothek während eines Laufs gesperrt');if(req.headers['if-match']!==hash(store.library))return send(409,{error:'Bibliothek inzwischen geändert. Neu laden.'});const preset=presets.presets.find(p=>p.id===body.presetId);if(!preset)throw Error('Vorlage fehlt');const library=structuredClone(store.library),project=library.projects.find(p=>p.id===body.projectId);if(!project)throw Error('Testumgebung fehlt');if(body.environment){for(const k of Object.keys(body.environment))if(!['target','candidate'].includes(k))throw Error('Unbekanntes Umgebungsfeld');Object.assign(project,body.environment)}const adapted={...preset};if(body.adaptation){for(const k of Object.keys(body.adaptation)){if(!['oracle','negative','scope'].includes(k)||typeof body.adaptation[k]!=='string'||!body.adaptation[k].trim())throw Error('Vorlagenanpassung ungültig');adapted[k]=body.adaptation[k]}}const plan=instantiatePreset(adapted,project,body);library.tests.push(...plan.tests);library.suites.push(plan.suite);store.saveLibrary(library);return send(201,{library:store.library,libraryRevision:hash(store.library),gates:gates(),suiteId:plan.suite.id})}
 if(req.method==='POST'&&p==='/api/shutdown'){if(runner.active)return send(409,{error:'Aktiven Lauf zuerst abbrechen und Abschluss abwarten'});send(202,{shutdownRequested:true});server.close();return}
 if(req.method==='GET'&&p==='/api/source')return send(200,sourceText(ROOT),'text/plain');
 if(req.method==='POST'&&p==='/api/validate'){validateLibrary(body);return send(200,{valid:true})}
 if(req.method==='GET'&&p==='/api/inventory'){const project=store.library.projects.find(x=>x.id===url.searchParams.get('projectId'));if(!project)throw Error('Projekt fehlt');const data=inventory(project.root);for(const f of data.files)f.testIds=store.library.tests.filter(t=>t.projectId===project.id&&['path','left','right'].some(k=>t.config[k]&&path.resolve(project.root,t.config[k])===path.resolve(project.root,f.path))).map(t=>t.id);return send(200,data)}
 if(req.method==='GET'&&p==='/api/runs')return send(200,{runs:store.listRuns(),gates:gates(),active:runner.active?.id??null});
 if(req.method==='POST'&&p==='/api/runs')return send(202,runner.start(body));
 const match=p.match(/^\/api\/runs\/([a-f0-9-]+)(?:\/(cancel|manual|export))?$/);
 if(match){const run=store.runs.get(match[1]);if(!run)return send(404,{error:'Lauf fehlt'});if(req.method==='GET'&&!match[2])return send(200,run);if(req.method==='POST'&&match[2]==='cancel'){runner.cancel(run.id);return send(202,{cancelRequested:true})}if(req.method==='POST'&&match[2]==='manual')return send(200,runner.manual(run.id,body.index,body));if(req.method==='GET'&&match[2]==='export'){const format=url.searchParams.get('format')??'json';return send(200,exportRun(run,format),format==='junit'?'application/xml':format==='csv'?'text/csv':'text/plain')}}
 if(req.method==='GET'&&['/','/app.js','/quick-menu.js','/style.css'].includes(p)){const file=p==='/'?'index.html':p.slice(1);return send(200,fs.readFileSync(path.join(ROOT,'public',file),'utf8'),file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'text/javascript')}
 send(404,{error:'Nicht gefunden'});
 }catch(e){send(400,{error:e.message})}
 });
 server.on('close',release);server.on('error',release);return {server,store,runner};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const app=createApp(),port=Number(process.env.COCKPIT_PORT??4318);app.server.listen(port,'127.0.0.1',()=>console.log(`Evaluator – Inspector http://127.0.0.1:${app.server.address().port}`));app.server.on('error',e=>{console.error(e.message);process.exitCode=2});
 const stop=async()=>{if(app.runner.active){app.runner.cancel(app.runner.active.id);await app.runner.completion}app.server.close(()=>process.exit(0))};process.on('SIGINT',stop);process.on('SIGTERM',stop);
}
