import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import net from 'node:net';
import {once} from 'node:events';
import {spawnSync} from 'node:child_process';
import {execute,pointer,parseCSV} from '../lib/adapters.mjs';
import {parseHTML,checkHTML} from '../lib/html-rules.mjs';
import {evaluateExpression} from '../lib/expression.mjs';
import {Store,Runner,runOne,killTree,engineIdentity,exportRun} from '../lib/runner.mjs';
import {validateTest,VERSION} from '../lib/contract.mjs';
import {createApp,ROOT} from '../server.mjs';
import {readApiResponse,shouldRefreshView,preserveView} from '../public/ui-state.js';

const root=fs.mkdtempSync(path.join(os.tmpdir(),'evaluator-patch-'));
test.after(()=>fs.rmSync(root,{recursive:true,force:true}));
const project={id:'fixture',name:'Fixture',root};
const make=(type,config,id='fixture')=>({id,name:id,purpose:'Patch regression',projectId:'fixture',type,timeoutMs:4000,config});
const library=(tests=[])=>({schemaVersion:1,projects:[project],tests,suites:[],settings:{allowCommands:true}});
const write=(name,value)=>fs.writeFileSync(path.join(root,name),value);
const exec=(type,config)=>execute(make(type,config),project,{allowCommands:true});

test('JSON pointer only resolves canonical array indices; object keys stay valid',()=>{
  const value={a:[1,2],o:{length:3,'01':'value'}};
  for(const key of ['length','01','-','-1','1e0'])assert.deepEqual(pointer(value,'/a/'+key),{exists:false});
  assert.deepEqual(pointer(value,'/a/0'),{exists:true,value:1});
  assert.deepEqual(pointer(value,'/o/length'),{exists:true,value:3});
  assert.deepEqual(pointer(value,'/o/01'),{exists:true,value:'value'});
});

test('numeric CSV rules reject invalid values even for ne',async t=>{
  for(const raw of ['Infinity','-Infinity','NaN','0x10','','1e999','bad'])await t.test(JSON.stringify(raw),async()=>{
    write('number.csv','x\n"'+raw+'"\n');
    for(const op of ['eq','ne','gte'])assert.equal((await exec('csv',{path:'number.csv',rules:[{column:'x',op,value:0}]})).status,'failed');
  });
  write('number.csv','x\n" 1e3 "\n');
  assert.equal((await exec('csv',{path:'number.csv',rules:[{column:'x',op:'eq',value:1000}]})).status,'passed');
});

test('text lines count physical lines for LF, CRLF and CR',async()=>{
  for(const [text,count] of [['',0],['a',1],['a\n',1],['\n',1],['a\n\n',2],['a\rb',2],['a\r\nb\r\n',2]]){
    write('lines.txt',text);const result=await exec('text',{path:'lines.txt',minLines:count,maxLines:count});
    assert.equal(result.status,'passed',JSON.stringify(text));assert.equal(result.evidence.lines,count);
  }
});

test('text comparison normalizes CR but byte comparison preserves it',async()=>{
  write('left.txt','a\rb\r');write('right.txt','a\nb\n');
  assert.equal((await exec('compare',{left:'left.txt',right:'right.txt',mode:'text'})).status,'passed');
  assert.equal((await exec('compare',{left:'left.txt',right:'right.txt',mode:'bytes'})).status,'failed');
});

test('command output preserves split UTF-8 on both streams',async()=>{
  write('split.mjs',`process.stdout.write(Buffer.from([0xc3]));process.stderr.write(Buffer.from([0xf0,0x9f]));setTimeout(()=>{process.stdout.write(Buffer.from([0xa4]));process.stderr.write(Buffer.from([0x91,0x8d]));},80);`);
  const result=await runOne(make('command',{executable:process.execPath,args:[path.join(root,'split.mjs')],expectedExitCodes:[0],includes:['ä'],excludes:['�']}),project,{allowCommands:true});
  assert.equal(result.status,'passed');assert.equal(result.evidence.process.stdout,'ä');assert.equal(result.evidence.process.stderr,'👍');
});

test('invalid UTF-8 process output is a controlled adapter error',async()=>{
  write('invalid.mjs','process.stdout.write(Buffer.from([0xff]));');
  const result=await runOne(make('command',{executable:process.execPath,args:[path.join(root,'invalid.mjs')],expectedExitCodes:[0]}),project,{allowCommands:true});
  assert.equal(result.status,'error');assert.match(result.error,/UTF-8/);
});

test('unverified termination overrides a successful result',async()=>{
  write('exists.txt','x');
  const result=await runOne(make('file',{path:'exists.txt',exists:true}),project,{},undefined,{terminate:async child=>{await killTree(child);throw Error('injected verification failure')}});
  assert.equal(result.status,'error');assert.equal(result.evidence.termination,'unverified');assert.equal(result.evidence.requestedStatus,'passed');
});

test('CSV export neutralizes formulas behind whitespace without breaking quoting',()=>{
  for(const value of ['=1','\t=1','\r=1',' =1','\n@SUM(1)','\ttext','+1','-1']){
    const exported=exportRun({results:[{testId:'id',status:'error',error:value}]},'csv');
    assert.equal(parseCSV(exported).rows[0][4],"'"+value);
  }
  assert.equal(parseCSV(exportRun({results:[{testId:'id',status:'error',error:'safe,"text"'}]},'csv')).rows[0][4],'safe,"text"');
});

test('raw text and RCDATA cannot manufacture HTML elements or event attributes',()=>{
  for(const tag of ['script','style','textarea','title']){
    const input=`<${tag}><button onclick="bad()">fake</button></${tag}><button>real</button>`;
    const nodes=parseHTML(input).nodes;
    assert.deepEqual(nodes.map(n=>n.tag),[tag,'button']);
  }
  assert.deepEqual(parseHTML('<script></scripture><button>fake</button></SCRIPT ><button>real</button>').nodes.map(n=>n.tag),['script','button']);
  assert.equal(checkHTML('<button><script>fake name</script></button>',['button-name'],{})[0].passed,false);
});

test('accessible image names respect alt and aria-hidden',()=>{
  for(const html of ['<button><img alt="Search"></button>','<input type="image" alt="Search">','<button><svg><title>Search</title></svg></button>']){
    assert.ok(checkHTML(html,['button-name','input-name'],{}).every(r=>r.passed),html);
  }
  for(const html of ['<button><img alt=""></button>','<button><img alt="Search" aria-hidden="true"></button>'])assert.equal(checkHTML(html,['button-name'],{})[0].passed,false);
});

test('len uses codepoints for strings and element counts for arrays',()=>{
  assert.equal(evaluateExpression('len("👍")'),1);assert.equal(evaluateExpression('len("a👍")'),2);
  assert.equal(evaluateExpression('len("é")'),2);assert.equal(evaluateExpression('len([1,2])'),2);
});

test('HTTP excludes is validated and enforced against a real local response',async()=>{
  const server=http.createServer((req,res)=>res.end('forbidden'));server.listen(0,'127.0.0.1');await once(server,'listening');
  try{
    const config={url:`http://127.0.0.1:${server.address().port}`,method:'GET',status:[200],excludes:['forbidden']};
    validateTest(make('http',config),[project]);assert.equal((await exec('http',config)).status,'failed');
    assert.throws(()=>validateTest(make('http',{...config,excludes:1}),[project]));
  }finally{await new Promise(resolve=>server.close(resolve))}
});

test('recovery skips corrupt newest backup and preserves original bytes',()=>{
  const dir=path.join(root,'recovery');const store=new Store(dir,library());
  const backups=path.join(dir,'backups');fs.mkdirSync(backups);
  fs.writeFileSync(path.join(backups,'1000-aaaa.json'),JSON.stringify(store.library));
  fs.writeFileSync(path.join(backups,'2000-bbbb.json'),'{bad backup');
  fs.writeFileSync(store.libraryFile,Buffer.from([0xff,0x00,0x7b]));
  const recovered=new Store(dir,library());
  assert.equal(recovered.library.projects[0].id,'fixture');assert.equal(recovered.library.settings.allowCommands,false);
  assert.equal(recovered.warnings.length,2);
  const preserved=fs.readdirSync(dir).find(n=>n.startsWith('library.corrupt-'));
  assert.deepEqual(fs.readFileSync(path.join(dir,preserved)),Buffer.from([0xff,0x00,0x7b]));
  assert.deepEqual(JSON.parse(fs.readFileSync(store.libraryFile,'utf8')),recovered.library);
});

test('corrupt library without valid backup remains intact and never silently seeds',()=>{
  const dir=path.join(root,'no-backup');const store=new Store(dir,library());write('dummy','x');
  fs.writeFileSync(store.libraryFile,'{corrupt');assert.throws(()=>new Store(dir,library()),/kein gültiges Backup/);
  assert.equal(fs.readFileSync(store.libraryFile,'utf8'),'{corrupt');
});

test('one adapter rejection does not suppress remaining tests unless requested',async()=>{
  for(const stopOnFailure of [false,true]){
    const tests=[make('file',{path:'exists.txt',exists:true},'first'),make('file',{path:'exists.txt',exists:true},'second')];
    let calls=0;const runner=new Runner(new Store(path.join(root,'isolation-'+stopOnFailure),library(tests)),{executeOne:async t=>{if(++calls===1)throw Error('isolated failure');return {testId:t.id,status:'passed',assertions:[],evidence:{}}}});
    const run=runner.start({testIds:['first','second'],stopOnFailure});await runner.completion;
    assert.deepEqual(run.results.map(r=>r.status),['error',stopOnFailure?'skipped':'passed']);
  }
});

test('execution identity includes server, CLI, presets and UI but excludes prose',()=>{
  const copy=path.join(root,'identity');fs.mkdirSync(copy);
  for(const dir of ['lib','public','resources'])fs.mkdirSync(path.join(copy,dir));
  for(const file of ['package.json','server.mjs','cli.mjs','lib/a.mjs','public/a.js','resources/p.json'])fs.writeFileSync(path.join(copy,file),'original');
  const initial=engineIdentity(copy);
  for(const file of ['server.mjs','cli.mjs','public/a.js','resources/p.json']){
    fs.writeFileSync(path.join(copy,file),'changed');assert.notEqual(engineIdentity(copy),initial,file);fs.writeFileSync(path.join(copy,file),'original');
  }
  fs.writeFileSync(path.join(copy,'README.md'),'new prose');assert.equal(engineIdentity(copy),initial);
});

test('API conflicts preserve first writer and distinguish active-run locks',async()=>{
  const app=createApp({dataDir:path.join(root,'conflicts'),initial:library([make('manual',{steps:['Check'],expected:'Observed'})])});
  app.server.listen(0,'127.0.0.1');await once(app.server,'listening');const base=`http://127.0.0.1:${app.server.address().port}`;
  try{
    const state=await(await fetch(base+'/api/bootstrap')).json(),headers={'Content-Type':'application/json','X-Cockpit-Token':state.token,'If-Match':state.libraryRevision};
    const first=structuredClone(state.library);first.projects[0].name='First writer';
    assert.equal((await fetch(base+'/api/library',{method:'PUT',headers,body:JSON.stringify(first)})).status,200);
    const second=await fetch(base+'/api/library',{method:'PUT',headers,body:JSON.stringify(state.library)});
    assert.equal(second.status,409);assert.equal((await second.json()).code,'LIBRARY_CONFLICT');assert.equal(app.store.library.projects[0].name,'First writer');
    app.runner.active={id:'fixture'};
    const active=await fetch(base+'/api/library',{method:'PUT',headers,body:JSON.stringify(first)});
    assert.equal((await active.json()).code,'RUN_ACTIVE');app.runner.active=null;
    assert.equal((await fetch(base+'/ui-state.js')).status,200);
  }finally{await app.close()}
});

test('shutdown closes slow clients and blocks accepted delayed writes',async()=>{
  const dir=path.join(root,'shutdown');const app=createApp({dataDir:dir,initial:library([make('manual',{steps:['Check'],expected:'Observed'})]),shutdownGraceMs:200});
  app.server.listen(0,'127.0.0.1');await once(app.server,'listening');const port=app.server.address().port,base=`http://127.0.0.1:${port}`;
  const {token}=await(await fetch(base+'/api/bootstrap')).json();
  const body=JSON.stringify({testIds:['fixture']});
  const socket=net.createConnection({host:'127.0.0.1',port});socket.on('error',()=>{});await once(socket,'connect');
  let output='';socket.on('data',chunk=>output+=chunk);const ended=once(socket,'close');
  socket.write(`POST /api/runs HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\nX-Cockpit-Token: ${token}\r\nContent-Length: ${Buffer.byteLength(body)}\r\n\r\n`+body.slice(0,1));
  const shutdown=await fetch(base+'/api/shutdown',{method:'POST',headers:{'X-Cockpit-Token':token}});assert.equal(shutdown.status,202);
  socket.write(body.slice(1));await ended;await app.close();
  assert.match(output,/503/);assert.equal(app.store.runs.size,0);assert.equal(app.runner.active,null);assert.equal(fs.existsSync(path.join(dir,'service.lock')),false);
});

test('frontend conflict errors retain status and code without implicit overwrites',async()=>{
  await assert.rejects(readApiResponse({ok:false,status:409,json:async()=>({code:'LIBRARY_CONFLICT',error:'changed'})}),error=>error.status===409&&error.code==='LIBRARY_CONFLICT');
  assert.deepEqual(await readApiResponse({ok:true,status:200,json:async()=>({library:{tests:[]}})}),{library:{tests:[]}});
  await assert.rejects(readApiResponse({ok:false,status:500,json:async()=>({})}),error=>error.message==='Anfrage fehlgeschlagen'&&error.status===500&&error.code===undefined);
  for(const view of ['tests','settings','files','quick','unbekannt'])assert.equal(shouldRefreshView(view,false),false);
  for(const view of ['overview','runs','suites'])assert.equal(shouldRefreshView(view,false),true);
  for(const view of ['overview','runs','suites'])assert.equal(shouldRefreshView(view,true),false);
});

test('result refresh preserves expanded evidence, control value, focus and scroll',()=>{
  let rendered=false,focused=false,scrolled;
  const detail={open:true},input={id:'choice',value:'chosen',checked:true,focus:()=>focused=true};
  const content={querySelectorAll:selector=>selector==='details'?[detail]:[input]};
  const document={activeElement:input,querySelector:selector=>selector==='#content'?content:null,getElementById:id=>id==='choice'?input:null};
  const window={scrollX:4,scrollY:123,scrollTo:(x,y)=>scrolled=[x,y]};
  preserveView(document,window,()=>{rendered=true;detail.open=false;input.value='';input.checked=false});
  assert.ok(rendered&&focused);assert.equal(detail.open,true);assert.equal(input.value,'chosen');assert.equal(input.checked,true);assert.deepEqual(scrolled,[4,123]);
});

test('result refresh invalidates a stale comparison and survives selectionless fields',()=>{
  let selected=null;
  const number={id:'repeat',value:'2',checked:false,focus:()=>{},get selectionStart(){throw new TypeError('kein Selektionsbereich')},setSelectionRange:()=>{selected='gesetzt'}};
  const compareRun={id:'compareRun',value:'run-7',checked:false},comparison={innerHTML:'<table></table>',textContent:''};
  const content={querySelectorAll:selector=>selector==='details'?[]:[number,compareRun]};
  const nodes={repeat:number,compareRun};
  const document={activeElement:number,querySelector:selector=>selector==='#content'?content:selector==='#comparison'?comparison:null,getElementById:id=>nodes[id]??null};
  const window={scrollX:0,scrollY:40,scrollTo:()=>{}};
  preserveView(document,window,()=>{number.value='';compareRun.value=''});
  assert.equal(number.value,'2');
  assert.equal(selected,null);
  assert.match(comparison.textContent,/Vergleichslauf erneut/);
  assert.equal(compareRun.value,'');
});

test('result refresh keeps an empty comparison untouched',()=>{
  const comparison={innerHTML:'',textContent:''};
  const content={querySelectorAll:()=>[]};
  const document={activeElement:null,querySelector:selector=>selector==='#content'?content:selector==='#comparison'?comparison:null,getElementById:()=>null};
  preserveView(document,{scrollX:0,scrollY:0,scrollTo:()=>{}},()=>{});
  assert.equal(comparison.textContent,'');
});

test('CLI exit contract and output artifacts are verified in independent processes',()=>{
  const fixtures=[['pass',make('file',{path:'exists.txt',exists:true}),0],['fail',make('file',{path:'missing',exists:true}),1],['manual',make('manual',{steps:['Check'],expected:'Observed'}),1],['error',make('text',{path:'missing',includes:['x']}),2],['timeout',{...make('command',{executable:process.execPath,args:['-e','setInterval(()=>{},1000)'],expectedExitCodes:[0]}),timeoutMs:200},2]];
  for(const [name,definition,expected] of fixtures){
    const file=path.join(root,name+'.json'),out=path.join(root,'cli-'+name);fs.writeFileSync(file,JSON.stringify(library([definition])));
    const result=spawnSync(process.execPath,[path.join(ROOT,'cli.mjs'),'run',file,'--output',out,'--allow-commands'],{encoding:'utf8',windowsHide:true,timeout:10000});
    assert.equal(result.status,expected,result.stderr);assert.ok(fs.existsSync(path.join(out,'results.xml')));assert.ok(fs.existsSync(path.join(out,'results.csv')));assert.equal(fs.existsSync(path.join(out,'service.lock')),false);
    const repeated=spawnSync(process.execPath,[path.join(ROOT,'cli.mjs'),'run',file,'--output',out],{encoding:'utf8',windowsHide:true});assert.equal(repeated.status,2);
  }
  const invalid=path.join(root,'invalid.json');fs.writeFileSync(invalid,'{}');
  assert.equal(spawnSync(process.execPath,[path.join(ROOT,'cli.mjs'),'validate',invalid],{windowsHide:true}).status,2);
  assert.equal(JSON.parse(fs.readFileSync(path.join(ROOT,'package.json'),'utf8')).version,VERSION);
});
