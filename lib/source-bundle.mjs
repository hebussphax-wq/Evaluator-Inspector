import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
export function sourceFiles(root){
 const names=['package.json','server.mjs','cli.mjs','README.md','CONTRACT.md','VERIFICATION.md','.gitignore','.gitattributes','.github/workflows/test.yml','Start-Evaluator.cmd','Stop-Evaluator.cmd','Start-Evaluator.ps1','Stop-Evaluator.ps1'];
 const walk=dir=>{for(const e of fs.readdirSync(path.join(root,dir),{withFileTypes:true})){const n=dir+'/'+e.name;if(e.isDirectory())walk(n);else if(/\.(mjs|js|html|css|json|md|txt|csv)$/.test(e.name))names.push(n)}};
 for(const dir of ['lib','public','resources','tests','examples'])walk(dir);
 for(const n of ['verify.mjs','export-examples.mjs','package.mjs','verify-package.ps1'])names.push('tools/'+n);
 return names.filter(n=>fs.existsSync(path.join(root,n))).sort().map(name=>{const data=fs.readFileSync(path.join(root,name));return {name,data,sha256:crypto.createHash('sha256').update(data).digest('hex')}});
}
export function sourceText(root){const files=sourceFiles(root);return 'Evaluator – Inspector · vollständiger Produktquelltext\nDateien: '+files.length+'\nUTF-8 · Quelldateien mit relativen Pfaden; keine Nutzerdaten oder gespeicherten Läufe.\n\n'+files.map(f=>'='.repeat(78)+'\nFILE: '+f.name+'\nSHA256: '+f.sha256+'\n'+'='.repeat(78)+'\n'+f.data.toString('utf8')).join('\n\n')}
