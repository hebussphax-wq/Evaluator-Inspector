import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {validateLibrary} from './contract.mjs';

// A corrupt current library must never silently become a new empty library.
export function recoverLibrary(file, initial, warnings, atomic) {
  const read = name => validateLibrary(JSON.parse(fs.readFileSync(name, 'utf8')));
  if (!fs.existsSync(file)) {
    const valid = validateLibrary(structuredClone(initial));
    atomic(file, valid);
    return valid;
  }
  try { return read(file); } catch (originalError) {
    const dir = path.join(path.dirname(file), 'backups');
    const backups = fs.existsSync(dir)
      ? fs.readdirSync(dir).filter(name => /^\d+-[a-f0-9-]+\.json$/.test(name))
          .sort((a,b) => Number(b.split('-')[0]) - Number(a.split('-')[0]))
      : [];
    let restored, source;
    for (const name of backups) {
      try { restored = read(path.join(dir, name)); source = name; break; }
      catch (error) { warnings.push(`Backup ${name} ungültig: ${error.message}`); }
    }
    if (!restored) throw Error('Bibliothek beschädigt; kein gültiges Backup. Original unverändert: ' + originalError.message);
    const preserved = file.replace(/\.json$/, '') + '.corrupt-' + Date.now() + '-' + crypto.randomUUID() + '.json';
    fs.copyFileSync(file, preserved, fs.constants.COPYFILE_EXCL);
    // Restoring old definitions is not authorization to run old commands.
    restored.settings = {allowCommands: false};
    atomic(file, restored);
    warnings.push(`Bibliothek aus Backup ${source} wiederhergestellt. Beschädigtes Original: ${path.basename(preserved)}. Kommandoausführung deaktiviert; Definitionen vor Ausführung prüfen.`);
    return restored;
  }
}
