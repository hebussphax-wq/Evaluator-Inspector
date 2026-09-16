import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import {isDeepStrictEqual} from 'node:util';
import {EXTRA_TYPES} from './extended-contract.mjs';
import {executeExtra} from './extended-adapters.mjs';
export const MAX_BYTES=8*1024*1024;
export function scoped(root,input,missing=false){
 const base=fs.realpathSync(root), target=path.resolve(base,input), rel=path.relative(base,target);
 if(rel==='..'||rel.startsWith('..'+path.sep)||path.isAbsolute(rel))throw Error('Pfad außerhalb des Projektordners');
 let probe=target;while(!fs.existsSync(probe)){if(!missing)throw Error('Datei fehlt: '+input);const next=path.dirname(probe);if(next===probe)throw Error('Pfad nicht auflösbar');probe=next;}
 const real=fs.realpathSync(probe), realRel=path.relative(base,real);
 if(realRel==='..'||realRel.startsWith('..'+path.sep)||path.isAbsolute(realRel))throw Error('Verknüpfung führt außerhalb des Projektordners');return target;
}
function read(root,p){const f=scoped(root,p);const s=fs.statSync(f);if(!s.isFile())throw Error('Keine reguläre Datei');if(s.size>MAX_BYTES)throw Error('Datei überschreitet 8 MiB Leselimit');return fs.readFileSync(f)}
function utf8(buf){return new TextDecoder('utf-8',{fatal:true}).decode(buf)}
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
export function pointer(data,p){let v=data;if(p==='')return {exists:true,value:v};for(const k of p.slice(1).split('/').map(x=>x.replace(/~1/g,'/').replace(/~0/g,'~'))){if(v===null||typeof v!=='object'||!Object.hasOwn(v,k))return {exists:false};v=v[k]}return {exists:true,value:v}}
export function evaluate(actual,c){
 const v=actual.value,w=c.value;
 if(c.op==='exists')return actual.exists===(w??true);
 if(!actual.exists)return false;
 switch(c.op){case'eq':return isDeepStrictEqual(v,w);case'ne':return !isDeepStrictEqual(v,w);case'contains':return typeof v==='string'?typeof w==='string'&&v.includes(w):Array.isArray(v)&&v.some(i=>isDeepStrictEqual(i,w));case'gt':return typeof v==='number'&&v>w;case'gte':return typeof v==='number'&&v>=w;case'lt':return typeof v==='number'&&v<w;case'lte':return typeof v==='number'&&v<=w;case'type':return (v===null?'null':Array.isArray(v)?'array':typeof v)===w;default:throw Error('Unbekannter Operator')}
}
export function parseCSV(text,delimiter=','){
 text=text.replace(/^\uFEFF/,'');if(!text)return {columns:[],rows:[]};
 let rows=[],row=[],field='',quoted=false,closed=false;
 for(let i=0;i<text.length;i++){const ch=text[i];if(quoted){if(ch==='"'){if(text[i+1]==='"'){field+='"';i++}else{quoted=false;closed=true}}else field+=ch;continue}
 if(closed&&ch!==delimiter&&ch!=='\r'&&ch!=='\n')throw Error('Ungültige CSV-Zeichen nach Anführungszeichen');
 if(ch==='"'){if(field||closed)throw Error('Ungültige CSV-Zitierung');quoted=true}
 else if(ch===delimiter){row.push(field);field='';closed=false}
 else if(ch==='\n'||ch==='\r'){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(field);rows.push(row);row=[];field='';closed=false}
 else field+=ch;
 }
 if(quoted)throw Error('Nicht geschlossenes CSV-Feld');if(field||row.length||closed){row.push(field);rows.push(row)}
 const columns=rows.shift()??[];if(new Set(columns).size!==columns.length||columns.some(c=>!c))throw Error('Leere oder doppelte CSV-Spalten');
 if(rows.some(r=>r.length!==columns.length))throw Error('CSV-Zeilenbreite entspricht nicht dem Header');return {columns,rows};
}
export async function execute(test,project,settings){
 const c=test.config,root=project.root,assertions=[],evidence={};
 const check=(label,pass,actual,expected)=>assertions.push({label,passed:!!pass,actual,expected});
 const contentRules=text=>{for(const x of c.includes??[])check('Enthält '+x,text.includes(x),text.slice(0,2000),x);for(const x of c.excludes??[])check('Enthält nicht '+x,!text.includes(x),text.slice(0,2000),'abwesend')};
 const bytes=p=>{const b=read(root,p);evidence.files??=[];evidence.files.push({path:p,bytes:b.length,sha256:digest(b)});return b};
 switch(test.type){
 case'file':{const f=scoped(root,c.path,true),exists=fs.existsSync(f);check('Existenz',exists===c.exists,exists,c.exists);evidence.path=f;if(exists&&c.exists){const s=fs.statSync(f);evidence.bytes=s.size;if(c.kind)check('Dateityp',c.kind==='file'?s.isFile():s.isDirectory(),s.isFile()?'file':s.isDirectory()?'directory':'other',c.kind);if(c.minBytes!==undefined)check('Mindestgröße',s.size>=c.minBytes,s.size,c.minBytes);if(c.maxBytes!==undefined)check('Maximalgröße',s.size<=c.maxBytes,s.size,c.maxBytes);if(c.sha256){const hash=digest(bytes(c.path));check('SHA256',hash===c.sha256.toLowerCase(),hash,c.sha256)}}break}
 case'text':{const text=utf8(bytes(c.path));contentRules(text);const lines=text===''?0:text.split(/\r?\n/).length;evidence.lines=lines;if(c.minLines!==undefined)check('Mindestzeilen',lines>=c.minLines,lines,c.minLines);if(c.maxLines!==undefined)check('Maximalzeilen',lines<=c.maxLines,lines,c.maxLines);break}
 case'json':{const data=JSON.parse(utf8(bytes(c.path)));for(const rule of c.checks){const a=pointer(data,rule.path);check(rule.path+' '+rule.op,evaluate(a,rule),a,Object.hasOwn(rule,'value')?rule.value:true)}break}
 case'csv':{const {columns,rows}=parseCSV(utf8(bytes(c.path)),c.delimiter);evidence.columns=columns;evidence.rowCount=rows.length;if(c.columns)check('Spalten',isDeepStrictEqual(columns,c.columns),columns,c.columns);if(c.minRows!==undefined)check('Mindestzeilen',rows.length>=c.minRows,rows.length,c.minRows);if(c.maxRows!==undefined)check('Maximalzeilen',rows.length<=c.maxRows,rows.length,c.maxRows);for(const col of c.unique??[]){const i=columns.indexOf(col);check('Eindeutig '+col,i>=0&&new Set(rows.map(r=>r[i])).size===rows.length,i<0?'Spalte fehlt':rows.length-new Set(rows.map(r=>r[i])).size,0)}for(const rule of c.rules??[]){const i=columns.indexOf(rule.column);let bad=[];if(i>=0)rows.forEach((r,n)=>{const raw=r[i],numeric=['gt','gte','lt','lte'].includes(rule.op)||typeof rule.value==='number';const value=numeric?(raw.trim()===''?NaN:Number(raw)):raw;if(!evaluate({exists:true,value},rule))bad.push(n+2)});check('Spalte '+rule.column+' '+rule.op,i>=0&&bad.length===0&&rows.length>0,{failedRows:bad.slice(0,100),count:bad.length,missing:i<0,rows:rows.length},Object.hasOwn(rule,'value')?rule.value:true)}break}
 case'compare':{const a=bytes(c.left),b=bytes(c.right);let same;if(c.mode==='bytes')same=a.equals(b);else if(c.mode==='text')same=utf8(a).replace(/\r\n/g,'\n')===utf8(b).replace(/\r\n/g,'\n');else same=isDeepStrictEqual(JSON.parse(utf8(a)),JSON.parse(utf8(b)));check('Vergleich '+c.mode,same,evidence.files,'identisch');break}
 case'http':{const start=performance.now();const response=await fetch(c.url,{method:c.method,headers:c.headers,body:c.body,redirect:'manual'});let chunks=[],size=0;if(response.body){for await(const chunk of response.body){size+=chunk.length;if(size>MAX_BYTES){throw Error('HTTP-Antwort überschreitet 8 MiB')}chunks.push(chunk)}}const body=utf8(Buffer.concat(chunks));evidence.http={url:c.url,status:response.status,durationMs:performance.now()-start,bytes:size,body:body.slice(0,16000)};check('HTTP-Status',c.status.includes(response.status),response.status,c.status);contentRules(body);if(c.maxDurationMs!==undefined)check('HTTP-Dauer',evidence.http.durationMs<=c.maxDurationMs,evidence.http.durationMs,c.maxDurationMs);if(c.checks){const data=JSON.parse(body);for(const rule of c.checks){const a=pointer(data,rule.path);check(rule.path+' '+rule.op,evaluate(a,rule),a,Object.hasOwn(rule,'value')?rule.value:true)}}break}
 case'command':{if(!settings.allowCommands)throw Error('Kommandoausführung in Einstellungen deaktiviert');const cwd=scoped(root,c.cwd??'.');const start=performance.now();const result=await new Promise((resolve,reject)=>{const child=spawn(c.executable,c.args,{cwd,shell:false,windowsHide:true,stdio:['ignore','pipe','pipe']});let stdout='',stderr='',count=0;const consume=which=>chunk=>{count+=chunk.length;if(count>MAX_BYTES){reject(Error('Prozessausgabe überschreitet 8 MiB'));return}if(which==='out')stdout+=chunk.toString('utf8');else stderr+=chunk.toString('utf8')};child.stdout.on('data',consume('out'));child.stderr.on('data',consume('err'));child.on('error',reject);child.on('close',(code,signal)=>resolve({exitCode:code,signal,stdout,stderr}))});evidence.process={executable:c.executable,args:c.args,cwd,...result,durationMs:performance.now()-start};check('Exitcode',c.expectedExitCodes.includes(result.exitCode),result.exitCode,c.expectedExitCodes);contentRules(result.stdout);if(c.maxDurationMs!==undefined)check('Prozessdauer',evidence.process.durationMs<=c.maxDurationMs,evidence.process.durationMs,c.maxDurationMs);break}
 default:if(EXTRA_TYPES.includes(test.type)){const status=await executeExtra(test,{readText:p=>utf8(bytes(p)),check,evidence});if(status)return {status,assertions,evidence};break}else throw Error('Adapter nicht ausführbar: '+test.type);
 }
 if(!assertions.length)throw Error('Keine Prüfungen ausgeführt');return {status:assertions.every(a=>a.passed)?'passed':'failed',assertions,evidence};
}
export function inventory(root,{limit=5000}={}){
 const files=[],errors=[];let truncated=false;const walk=dir=>{let entries;try{entries=fs.readdirSync(dir,{withFileTypes:true})}catch(e){errors.push({path:path.relative(root,dir),error:e.message});return}for(const e of entries){if(files.length>=limit){truncated=true;return}const f=path.join(dir,e.name),relative=path.relative(root,f);if(e.isSymbolicLink()){files.push({path:relative,kind:'link',skipped:true});continue}try{const s=fs.statSync(f);files.push({path:relative,kind:e.isDirectory()?'directory':'file',bytes:s.size,modifiedAt:s.mtime.toISOString()});if(e.isDirectory()&&!['node_modules','.git','.data'].includes(e.name))walk(f)}catch(err){errors.push({path:relative,error:err.message})}}};walk(fs.realpathSync(root));return {files,errors,truncated,limit,excludedDirectories:['node_modules','.git','.data']};
}
