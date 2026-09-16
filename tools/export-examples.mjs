import fs from 'node:fs';
import path from 'node:path';
import {ROOT} from '../server.mjs';
import {seed} from '../lib/seed.mjs';
fs.writeFileSync(path.join(ROOT,'examples','library.json'),JSON.stringify(seed(ROOT),null,2));
console.log('examples/library.json mit aktuellem lokalem Projektpfad erstellt.');
