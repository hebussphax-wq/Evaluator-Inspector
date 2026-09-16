import {reviewResult} from './reviews.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {fork,spawn} from 'node:child_process';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {VERSION,validateLibrary} from './contract.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
export const hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
export function engineIdentity(){const names=fs.readdirSync(here).filter(n=>n.endsWith('.mjs')).sort();return hash(names.map(n=>[n,fs.readFileSync(path.join(here,n),'utf8')]))}
export function atomic(file,value){fs.mkdirSync(path.dirname(file),{recursive:true});const tmp=file+'.'+crypto.randomUUID()+'.tmp';fs.writeFileSync(tmp,JSON.stringify(value,null,2),'utf8');fs.renameSync(tmp,file)}
export function aggregate(results){const states=results.map(r=>r.status);if(states.includes('running')||states.includes('queued'))return 'running';for(const s of ['cancelled','interrupted','error','timeout','failed','pending_manual','skipped'])if(states.includes(s))return s;return states.length&&states.every(s=>s==='passed')?'passed':'error'}
export async function killTree(child){
 if(!child.pid)return;
 if(process.platform==='win32'){const exe=path.join(process.env.SystemRoot??'C:/Windows','System32','taskkill.exe');await new Promise((resolve,reject)=>{const p=spawn(exe,['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:['ignore','pipe','pipe']});let error='';p.stderr.on('data',b=>error+=b);p.on('error',reject);p.on('close',code=>{if(code!==0&&child.exitCode===null)reject(Error('Prozessbaum-Abbruch nicht bestätigt: '+error));else resolve()})})}
 else {try{process.kill(-child.pid,'SIGKILL')}catch(e){if(e.code!=='ESRCH')throw e}}
}
export async function runOne(test,project,settings,signal){
 const startedAt=new Date().toISOString(),start=performance.now();
 if(test.enabled===false)return {testId:test.id,status:'skipped',reason:'Test deaktiviert',startedAt,durationMs:0,assertions:[],evidence:{}};
 if(signal?.aborted)return {testId:test.id,status:'cancelled',startedAt,durationMs:0,assertions:[],evidence:{}};
 if(test.type==='manual')return {testId:test.id,status:'pending_manual',startedAt,durationMs:0,assertions:[],evidence:{steps:test.config.steps,expected:test.config.expected}};
 return new Promise(resolve=>{
 const child=fork(path.join(here,'worker.mjs'),[],{stdio:['ignore','ignore','pipe','ipc'],windowsHide:true,detached:process.platform!=='win32'});let done=false,timer,stderr='';
 const finish=async(result,kill=false)=>{if(done)return;done=true;clearTimeout(timer);signal?.removeEventListener('abort',cancel);if(kill)try{await killTree(child);result.evidence={...result.evidence,termination:'process-tree-terminated'}}catch(e){result={status:'error',error:e.message,evidence:{requestedStatus:result.status,termination:'unverified'},assertions:[]}}resolve({testId:test.id,startedAt,finishedAt:new Date().toISOString(),durationMs:performance.now()-start,assertions:[],evidence:{},...result})};
 const cancel=()=>finish({status:'cancelled',reason:'Vom Nutzer abgebrochen'},true);
 child.stderr.on('data',b=>{stderr=(stderr+b).slice(-4000)});child.once('message',r=>finish(r,true));child.once('error',e=>finish({status:'error',error:e.message}));child.once('exit',(code,signalName)=>{if(!done)finish({status:'error',error:`Adapter ohne Ergebnis beendet (${code}/${signalName})`,evidence:{stderr}})});
 timer=setTimeout(()=>finish({status:'timeout',reason:`Zeitlimit ${test.timeoutMs} ms überschritten`},true),test.timeoutMs);signal?.addEventListener('abort',cancel,{once:true});if(signal?.aborted)cancel();else child.send({test,project,settings});
 });
}
export class Store{
 constructor(dir,initial){this.dir=dir;fs.mkdirSync(path.join(dir,'runs'),{recursive:true});this.libraryFile=path.join(dir,'library.json');this.warnings=[];if(!fs.existsSync(this.libraryFile))atomic(this.libraryFile,initial);this.library=validateLibrary(JSON.parse(fs.readFileSync(this.libraryFile,'utf8')));this.runs=new Map();for(const name of fs.readdirSync(path.join(dir,'runs'))){if(!name.endsWith('.json'))continue;try{const run=JSON.parse(fs.readFileSync(path.join(dir,'runs',name),'utf8'));if(!Array.isArray(run.results)||!run.id)throw Error('Ungültiger Lauf');if(run.status==='running'){for(const r of run.results)if(['running','queued'].includes(r.status)){r.status='interrupted';r.reason='Dienst während Lauf beendet'}run.status=aggregate(run.results);run.finishedAt=new Date().toISOString();this.saveRun(run)}this.runs.set(run.id,run)}catch(e){this.warnings.push(`${name}: ${e.message}`)}}}
 saveLibrary(library){validateLibrary(library);const backup=path.join(this.dir,'backups',Date.now()+'-'+crypto.randomUUID()+'.json');atomic(backup,this.library);atomic(this.libraryFile,library);this.library=structuredClone(library)}
 saveRun(run){atomic(path.join(this.dir,'runs',run.id+'.json'),run);this.runs?.set(run.id,run)}
 listRuns(){return [...this.runs.values()].sort((a,b)=>b.startedAt.localeCompare(a.startedAt)).map(({results,definition,...r})=>({...r,summary:results.reduce((a,r)=>(a[r.status]=(a[r.status]??0)+1,a),{})}))}
}
export class Runner{
 constructor(store){this.store=store;this.active=null;this.engineHash=engineIdentity()}
 start({testIds,suiteId,repeat=1,stopOnFailure=false,requestId}){
 const requestHash=hash({testIds,suiteId,repeat,stopOnFailure});
 if(requestId){const previous=[...this.store.runs.values()].find(r=>r.requestId===requestId);if(previous){if(previous.requestHash!==requestHash)throw Error('requestId wurde bereits für eine andere Anforderung verwendet');return previous}}
 if(this.active)throw Error('Es läuft bereits ein Testplan');
 if(engineIdentity()!==this.engineHash)throw Error('Engine-Dateien wurden geändert. Dienst vor dem nächsten Lauf neu starten.');
 const library=structuredClone(this.store.library);let suite;if(suiteId){suite=library.suites.find(s=>s.id===suiteId);if(!suite)throw Error('Testplan fehlt');testIds=suite.testIds;stopOnFailure=suite.stopOnFailure??false}
 if(!Array.isArray(testIds)||!testIds.length||new Set(testIds).size!==testIds.length||testIds.some(id=>!library.tests.some(t=>t.id===id)))throw Error('Eindeutige vorhandene Test-IDs erforderlich');
 if(!Number.isInteger(repeat)||repeat<1||repeat>100)throw Error('Wiederholungen müssen 1–100 sein');if(testIds.length*repeat>10000)throw Error('Maximal 10000 Ausführungen je Lauf');
 if(typeof stopOnFailure!=='boolean')throw Error('stopOnFailure muss boolean sein');if(requestId!==undefined&&(typeof requestId!=='string'||requestId.length>100))throw Error('requestId ungültig');
 const definition={projects:library.projects,tests:testIds.map(id=>library.tests.find(t=>t.id===id)),suite,settings:library.settings??{allowCommands:false},repeat,stopOnFailure};
 const run={id:crypto.randomUUID(),requestId:requestId??crypto.randomUUID(),requestHash,name:suite?.name??'Gezielte Auswahl',status:'running',startedAt:new Date().toISOString(),engineVersion:VERSION,engineHash:this.engineHash,definitionHash:hash(definition),definition,results:[]};
 for(let i=1;i<=repeat;i++)for(const t of definition.tests)run.results.push({testId:t.id,iteration:i,status:'queued',assertions:[],evidence:{}});
 this.store.saveRun(run);const controller=new AbortController();this.active={id:run.id,controller};this.completion=this.execute(run,controller).finally(()=>{this.active=null});return run;
 }
 async execute(run,controller){let stopped=false;try{for(let i=0;i<run.results.length;i++){const slot=run.results[i];if(controller.signal.aborted||stopped){slot.status=controller.signal.aborted?'cancelled':'skipped';slot.reason=controller.signal.aborted?'Lauf abgebrochen':'Testplan nach Fehler gestoppt';this.store.saveRun(run);continue}slot.status='running';this.store.saveRun(run);const test=run.definition.tests.find(t=>t.id===slot.testId),project=run.definition.projects.find(p=>p.id===test.projectId);const result=await runOne(test,project,run.definition.settings,controller.signal);run.results[i]={...result,iteration:slot.iteration};if(run.definition.stopOnFailure&&['failed','error','timeout'].includes(result.status))stopped=true;this.store.saveRun(run)}run.status=aggregate(run.results)}catch(e){run.status='error';run.error=e.message;for(const r of run.results)if(['running','queued'].includes(r.status)){r.status='error';r.error='Lauf-Infrastrukturfehler'}}run.finishedAt=new Date().toISOString();this.store.saveRun(run);return run}
 cancel(id){if(this.active?.id!==id)throw Error('Lauf ist nicht aktiv');this.active.controller.abort()}
 manual(runId,index,input){const run=this.store.runs.get(runId);if(!run)throw Error('Lauf fehlt');if(run.status==='running')throw Error('Automatische Ausführung zuerst abschließen');const result=run.results[index];if(!result||result.status!=='pending_manual')throw Error('Keine offene manuelle Prüfung');reviewResult(result,run.definition.tests.find(t=>t.id===result.testId),input);run.status=aggregate(run.results);this.store.saveRun(run);return run}
}
const xml=s=>String(s??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]));
const csv=s=>'"'+String(s??'').replace(/^[=+@-]/,"'$&").replace(/"/g,'""')+'"';
export function exportRun(run,format){
 if(format==='json')return JSON.stringify(run,null,2);
 if(format==='csv')return ['testId,iteration,status,durationMs,details',...run.results.map(r=>[r.testId,r.iteration,r.status,r.durationMs,r.error??r.reason??JSON.stringify(r.assertions)].map(csv).join(','))].join('\r\n');
 if(format==='junit'){const errors=run.results.filter(r=>['error','timeout','interrupted'].includes(r.status)).length,failures=run.results.filter(r=>r.status==='failed').length;return `<?xml version="1.0" encoding="UTF-8"?><testsuite name="${xml(run.name)}" tests="${run.results.length}" failures="${failures}" errors="${errors}" skipped="${run.results.filter(r=>!['passed','failed','error','timeout','interrupted'].includes(r.status)).length}">${run.results.map(r=>`<testcase name="${xml(r.testId)} #${r.iteration}" time="${(r.durationMs??0)/1000}">${r.status==='passed'?'':r.status==='failed'?`<failure message="Assertion failed">${xml(JSON.stringify(r.assertions))}</failure>`:['error','timeout','interrupted'].includes(r.status)?`<error message="${xml(r.status)}">${xml(r.error??r.reason)}</error>`:`<skipped message="${xml(r.status)}"/>`}<system-out>${xml(JSON.stringify(r.evidence))}</system-out></testcase>`).join('')}</testsuite>`}
 throw Error('Exportformat unbekannt');
}
