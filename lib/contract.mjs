import {isAbsolute} from 'node:path';
import {EXTRA_TYPES,extraTemplates,validateExtra} from './extended-contract.mjs';
export const VERSION = '1.0.0';
export const TYPES = ['file','text','json','csv','compare','http','command','manual',...EXTRA_TYPES];
export const CATEGORIES = ['Smoke','Unit','Integration','Regression','End-to-End','UI / Desktop','API','Datenqualität','Performance','Sicherheit','Barrierefreiheit','Installation','Backup / Restore','Manuell','Analyse'];
export const templates = {
 ...extraTemplates,
 file:{path:'README.md',exists:true,kind:'file',minBytes:1},
 text:{path:'README.md',includes:['Test'],excludes:['TODO']},
 json:{path:'package.json',checks:[{path:'/name',op:'eq',value:'evaluator-inspector'}]},
 csv:{path:'examples/metrics.csv',delimiter:',',columns:['name','value'],minRows:2,rules:[{column:'value',op:'gte',value:0}]},
 compare:{left:'examples/expected.txt',right:'examples/actual.txt',mode:'text'},
 http:{url:'http://127.0.0.1:4318/api/health',method:'GET',status:[200],includes:['ok'],maxDurationMs:2000},
 command:{executable:'C:/Program Files/nodejs/node.exe',args:['--version'],expectedExitCodes:[0],includes:['v'],cwd:'.'},
 manual:{steps:['Vorbedingung herstellen','Aktion ausführen','Istzustand mit Sollzustand vergleichen'],expected:'Beobachtung entspricht dem beschriebenen Sollzustand.'}
};
const fail = m => {throw new Error(m)};
const obj = x => x && typeof x === 'object' && !Array.isArray(x);
const str = x => typeof x === 'string' && x.trim().length > 0;
const id = x => typeof x === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(x);
const number = x => typeof x === 'number' && Number.isFinite(x);
const ops = ['eq','ne','contains','gt','gte','lt','lte','exists','type'];
function keys(x,allowed,label){for(const k of Object.keys(x))if(!allowed.includes(k))fail(`${label}: unbekanntes Feld ${k}`)}
function list(x,label){if(!Array.isArray(x)||!x.length||x.some(v=>typeof v!=='string'))fail(`${label}: nichtleere Zeichenfolgenliste erforderlich`)}
function checks(xs, csv=false){if(!Array.isArray(xs)||!xs.length)fail('Mindestens eine Prüfregel erforderlich');for(const c of xs){if(!obj(c))fail('Prüfregel muss Objekt sein');keys(c,[csv?'column':'path','op','value'],'Prüfregel');if(typeof c[csv?'column':'path']!=='string'||(!csv&&c.path!==''&&!c.path.startsWith('/')))fail('Pfad muss JSON Pointer sein (/feld/0)');if(!ops.includes(c.op))fail('Unbekannter Operator');if(c.op!=='exists'&&!Object.hasOwn(c,'value'))fail('Sollwert fehlt');if(['gt','gte','lt','lte'].includes(c.op)&&!number(c.value))fail('Numerischer Sollwert erforderlich');if(c.op==='exists'&&Object.hasOwn(c,'value')&&typeof c.value!=='boolean')fail('exists benötigt boolean');if(c.op==='type'&&!['string','number','boolean','object','array','null'].includes(c.value))fail('Ungültiger Typ-Sollwert');}}
export function validateTest(t,projects){
 if(!obj(t))fail('Test muss Objekt sein');keys(t,['id','name','purpose','oracle','counterexamples','scope','source','type','category','projectId','tags','enabled','timeoutMs','config'],'Test');
 for(const k of ['oracle','counterexamples','scope','source'])if(t[k]!==undefined&&typeof t[k]!=='string')fail(k+' muss Text sein');
 if(!id(t.id)||!str(t.name)||!str(t.purpose))fail('Test benötigt gültige ID, Name und Testzweck');
 if(!TYPES.includes(t.type))fail('Unbekannte Testart');if(!projects.some(p=>p.id===t.projectId))fail('Projekt fehlt');
 if(t.tags!==undefined&&(!Array.isArray(t.tags)||t.tags.some(v=>typeof v!=='string')))fail('Tags müssen Zeichenfolgenliste sein');
 if(t.enabled!==undefined&&typeof t.enabled!=='boolean')fail('enabled muss boolean sein');
 if(t.category!==undefined&&!str(t.category))fail('Kategorie muss Text sein');
 if(!Number.isInteger(t.timeoutMs)||t.timeoutMs<100||t.timeoutMs>3600000)fail('Timeout muss 100–3600000 ms sein');
 const c=t.config;if(!obj(c))fail('Konfiguration fehlt');
 if(EXTRA_TYPES.includes(t.type)){validateExtra(t);return t}
 const allowed={file:['path','exists','kind','minBytes','maxBytes','sha256'],text:['path','includes','excludes','minLines','maxLines'],json:['path','checks'],csv:['path','delimiter','columns','minRows','maxRows','unique','rules'],compare:['left','right','mode'],http:['url','method','headers','body','status','includes','excludes','checks','maxDurationMs'],command:['executable','args','cwd','expectedExitCodes','includes','excludes','maxDurationMs'],manual:['steps','expected']};keys(c,allowed[t.type],'Konfiguration');
 if(['file','text','json','csv'].includes(t.type)&&!str(c.path))fail('Dateipfad fehlt');
 for(const k of ['minBytes','maxBytes','minLines','maxLines','minRows','maxRows','maxDurationMs'])if(c[k]!==undefined&&(!number(c[k])||c[k]<0))fail(`${k}: nichtnegative Zahl erforderlich`);
 for(const [a,b] of [['minBytes','maxBytes'],['minLines','maxLines'],['minRows','maxRows']])if(c[a]!==undefined&&c[b]!==undefined&&c[a]>c[b])fail(`${a} darf ${b} nicht überschreiten`);
 for(const k of ['includes','excludes','columns','unique'])if(c[k]!==undefined)list(c[k],k);
 if(t.type==='file'){if(typeof c.exists!=='boolean')fail('Existenz-Sollwert fehlt');if(c.kind!==undefined&&!['file','directory'].includes(c.kind))fail('kind ungültig');if(c.sha256!==undefined&&!/^[a-f0-9]{64}$/i.test(c.sha256))fail('SHA256 ungültig');if(!c.exists&&Object.keys(c).some(k=>!['path','exists'].includes(k)))fail('Bei exists=false keine Inhaltsregeln zulässig')}
 if(t.type==='text'&&!['includes','excludes','minLines','maxLines'].some(k=>c[k]!==undefined))fail('Text-Sollwert fehlt');
 if(t.type==='json')checks(c.checks);
 if(t.type==='csv'){if(c.delimiter!==undefined&&(typeof c.delimiter!=='string'||c.delimiter.length!==1||/[\r\n"]/.test(c.delimiter)))fail('CSV-Trennzeichen ungültig');if(!['columns','minRows','maxRows','unique','rules'].some(k=>c[k]!==undefined))fail('CSV-Sollwert fehlt');if(c.rules!==undefined)checks(c.rules,true)}
 if(t.type==='compare'&&(!str(c.left)||!str(c.right)||!['bytes','text','json'].includes(c.mode)))fail('Vergleich benötigt left/right und mode bytes/text/json');
 if(t.type==='http'){let u;try{u=new URL(c.url)}catch{fail('URL ungültig')}if(!['http:','https:'].includes(u.protocol)||u.username||u.password)fail('HTTP(S)-URL ohne Zugangsdaten erforderlich');if(!['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS'].includes(c.method))fail('HTTP-Methode fehlt');if(!Array.isArray(c.status)||!c.status.length||c.status.some(v=>!Number.isInteger(v)||v<100||v>599))fail('Erwartete HTTP-Statuscodes fehlen');if(c.headers!==undefined&&(!obj(c.headers)||Object.values(c.headers).some(v=>typeof v!=='string')))fail('Header ungültig');if(c.body!==undefined&&typeof c.body!=='string')fail('HTTP-Body muss Text sein');if(c.checks!==undefined)checks(c.checks)}
 if(t.type==='command'){if(!str(c.executable)||!isAbsolute(c.executable))fail('Absoluter Programmpfad erforderlich');if(!Array.isArray(c.args)||c.args.some(v=>typeof v!=='string'))fail('Argumentliste erforderlich');if(c.cwd!==undefined&&!str(c.cwd))fail('cwd ungültig');if(!Array.isArray(c.expectedExitCodes)||!c.expectedExitCodes.length||c.expectedExitCodes.some(v=>!Number.isInteger(v)))fail('Erwartete Exitcodes fehlen')}
 if(t.type==='manual'){list(c.steps,'Schritte');if(!str(c.expected))fail('Manueller Sollzustand fehlt')}
 return t;
}
export function validateLibrary(x){
 if(!obj(x))fail('Bibliothek muss Objekt sein');keys(x,['schemaVersion','projects','tests','suites','settings'],'Bibliothek');
 if(x.schemaVersion!==1||!Array.isArray(x.projects)||!Array.isArray(x.tests)||!Array.isArray(x.suites))fail('schemaVersion 1, projects/tests/suites erforderlich');
 if(x.tests.length>10000)fail('Maximal 10000 Tests');
 for(const p of x.projects){if(!obj(p))fail('Projekt ungültig');keys(p,['id','name','root','target','candidate','notes'],'Projekt');if(!id(p.id)||!str(p.name)||!str(p.root)||!isAbsolute(p.root))fail('Projekt benötigt ID, Namen und absoluten Root-Pfad');for(const k of ['target','candidate','notes'])if(p[k]!==undefined&&typeof p[k]!=='string')fail('Umgebungsfeld '+k+' muss Text sein')}
 for(const group of [x.projects,x.tests,x.suites])if(new Set(group.map(v=>v.id)).size!==group.length)fail('Doppelte ID');
 x.tests.forEach(t=>validateTest(t,x.projects));
 for(const s of x.suites){if(!obj(s))fail('Testplan ungültig');keys(s,['id','name','testIds','stopOnFailure'],'Testplan');if(!id(s.id)||!str(s.name)||!Array.isArray(s.testIds)||!s.testIds.length||new Set(s.testIds).size!==s.testIds.length||s.testIds.some(i=>!x.tests.some(t=>t.id===i)))fail('Testplan benötigt eindeutige existierende Tests');if(s.stopOnFailure!==undefined&&typeof s.stopOnFailure!=='boolean')fail('stopOnFailure muss boolean sein')}
 if(x.settings!==undefined){if(!obj(x.settings))fail('settings ungültig');keys(x.settings,['allowCommands'],'settings');if(typeof x.settings.allowCommands!=='boolean')fail('allowCommands muss boolean sein')}
 return x;
}
