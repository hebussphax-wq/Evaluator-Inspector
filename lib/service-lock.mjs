import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
export function acquireLock(dir){
 fs.mkdirSync(dir,{recursive:true});const file=path.join(dir,'service.lock'),identity={pid:process.pid,id:crypto.randomUUID(),at:new Date().toISOString()};
 if(fs.existsSync(file)){
  const prior=JSON.parse(fs.readFileSync(file,'utf8'));if(!Number.isInteger(prior.pid)||prior.pid<1)throw Error('Ungültige Dienstsperre: '+file);
  let alive=true;try{process.kill(prior.pid,0)}catch(e){if(e.code==='ESRCH')alive=false;else throw e}
  if(alive)throw Error('Datenordner wird bereits von einem Dienst verwendet (PID '+prior.pid+')');
  fs.unlinkSync(file);
 }
 const fd=fs.openSync(file,'wx');try{fs.writeFileSync(fd,JSON.stringify(identity))}finally{fs.closeSync(fd)}
 return ()=>{if(fs.existsSync(file)&&JSON.parse(fs.readFileSync(file,'utf8')).id===identity.id)fs.unlinkSync(file)};
}
