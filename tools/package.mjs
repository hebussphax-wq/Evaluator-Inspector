import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {sourceFiles,sourceText} from '../lib/source-bundle.mjs';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url))),out=path.join(root,'exports');
fs.mkdirSync(out,{recursive:true});const files=sourceFiles(root),prefix='Evaluator-Inspector/';
const table=Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0});
const crc=b=>{let n=0xffffffff;for(const x of b)n=table[(n^x)&255]^(n>>>8);return (n^0xffffffff)>>>0};
// Uncompressed ZIP with UTF-8 names. All files are also hashed independently.
let offset=0;const locals=[],central=[];
for(const file of files){const name=Buffer.from(prefix+file.name),data=file.data,checksum=crc(data),head=Buffer.alloc(30);head.writeUInt32LE(0x04034b50);head.writeUInt16LE(20,4);head.writeUInt16LE(0x800,6);head.writeUInt16LE(33,12);head.writeUInt32LE(checksum,14);head.writeUInt32LE(data.length,18);head.writeUInt32LE(data.length,22);head.writeUInt16LE(name.length,26);locals.push(head,name,data);const entry=Buffer.alloc(46);entry.writeUInt32LE(0x02014b50);entry.writeUInt16LE(20,4);entry.writeUInt16LE(20,6);entry.writeUInt16LE(0x800,8);entry.writeUInt16LE(33,14);entry.writeUInt32LE(checksum,16);entry.writeUInt32LE(data.length,20);entry.writeUInt32LE(data.length,24);entry.writeUInt16LE(name.length,28);entry.writeUInt32LE(offset,42);central.push(entry,name);offset+=head.length+name.length+data.length}
const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(files.length,8);end.writeUInt16LE(files.length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
const zip=Buffer.concat([...locals,directory,end]),text=sourceText(root);fs.writeFileSync(path.join(out,'Evaluator-Inspector.zip'),zip);fs.writeFileSync(path.join(out,'Evaluator-Inspector-komplettes-programm.txt'),text);
const manifest={createdAt:new Date().toISOString(),files:files.map(({name,sha256,data})=>({name,sha256,bytes:data.length})),zipSha256:crypto.createHash('sha256').update(zip).digest('hex'),textSha256:crypto.createHash('sha256').update(text).digest('hex')};fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2));console.log(JSON.stringify({files:files.length,zipBytes:zip.length,output:out}));
