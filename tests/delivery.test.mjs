import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {once} from 'node:events';
import {spawn,spawnSync} from 'node:child_process';
import {createApp,ROOT} from '../server.mjs';
import {sourceFiles} from '../lib/source-bundle.mjs';
const root=fs.mkdtempSync(path.join(os.tmpdir(),'evaluator-delivery-'));
test.after(()=>fs.rmSync(root,{recursive:true,force:true}));
const pwsh='C:/Program Files/PowerShell/7/pwsh.exe';

test('shutdown deadline closes an unfinished request and releases the writer lock',async()=>{
  const dir=path.join(root,'slow');const app=createApp({dataDir:dir,shutdownGraceMs:100});
  app.server.listen(0,'127.0.0.1');await once(app.server,'listening');const port=app.server.address().port;
  const socket=net.createConnection({host:'127.0.0.1',port});await once(socket,'connect');
  socket.on('error',()=>{});socket.resume();const closed=once(socket,'close');
  socket.write(`POST /api/runs HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\nContent-Length: 1000\r\n\r\n{`);
  await new Promise(resolve=>setTimeout(resolve,20));
  const start=performance.now();await app.close();await closed;
  assert.ok(performance.now()-start<2000);assert.equal(fs.existsSync(path.join(dir,'service.lock')),false);
});

test('Windows stop script proves child process exit and lock removal',{skip:process.platform!=='win32'},async()=>{
  const dir=path.join(root,'stop');
  const child=spawn(process.execPath,[path.join(ROOT,'server.mjs')],{env:{...process.env,COCKPIT_DATA:dir,COCKPIT_PORT:'0'},stdio:['ignore','pipe','pipe'],windowsHide:true});
  let output='',errors='';child.stderr.on('data',b=>errors+=b);const exited=once(child,'exit');
  try {
    const port=await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(Error('start deadline: '+errors)),5000);
      child.once('error',reject);child.stdout.on('data',b=>{output+=b;const match=output.match(/127\.0\.0\.1:(\d+)/);if(match){clearTimeout(timer);resolve(match[1])}});
    });
    const stop=spawnSync(pwsh,['-NoProfile','-File',path.join(ROOT,'Stop-Evaluator.ps1'),'-Port',port],{encoding:'utf8',windowsHide:true,timeout:15000});
    assert.equal(stop.status,0,stop.stderr);assert.match(stop.stdout,/Sperre freigegeben|sperre freigegeben/);
    assert.deepEqual(await exited,[0,null]);assert.equal(fs.existsSync(path.join(dir,'service.lock')),false);
  } finally {if(child.exitCode===null)child.kill()}
});

test('packager output is read independently using .NET ZIP and SHA256',{skip:process.platform!=='win32'},()=>{
  const copy=path.join(root,'package');fs.mkdirSync(copy);
  for(const {name,data} of sourceFiles(ROOT)){const file=path.join(copy,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,data)}
  const built=spawnSync(process.execPath,[path.join(copy,'tools/package.mjs')],{encoding:'utf8',windowsHide:true});assert.equal(built.status,0,built.stderr);
  const verified=spawnSync(pwsh,['-NoProfile','-File',path.join(copy,'tools/verify-package.ps1'),'-Root',copy],{encoding:'utf8',windowsHide:true});
  assert.equal(verified.status,0,verified.stderr);assert.match(verified.stdout,/PACKAGE_VERIFIED entries=\d+ sha256=verified reader=dotnet/);
});
