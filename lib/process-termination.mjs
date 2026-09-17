import fs from 'node:fs';
import {setTimeout as pause} from 'node:timers/promises';

export function processIsRunning(pid) {
  if (process.platform === 'linux') {
    try {
      const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8');
      const state = stat.slice(stat.lastIndexOf(')') + 2).split(' ')[0];
      return !['Z', 'X'].includes(state);
    } catch (error) { if (error.code === 'ENOENT') return false; throw error; }
  }
  try { process.kill(pid, 0); return true; }
  catch (error) { if (error.code === 'ESRCH') return false; throw error; }
}

function groupIsRunning(group) {
  if (process.platform === 'linux') {
    for (const name of fs.readdirSync('/proc')) {
      if (!/^\d+$/.test(name)) continue;
      try {
        const stat = fs.readFileSync(`/proc/${name}/stat`, 'utf8');
        const fields = stat.slice(stat.lastIndexOf(')') + 2).split(' ');
        if (Number(fields[2]) === group && !['Z', 'X'].includes(fields[0])) return true;
      } catch (error) { if (!['ENOENT','ESRCH'].includes(error.code)) throw error; }
    }
    return false;
  }
  try { process.kill(-group, 0); return true; }
  catch (error) { if (error.code === 'ESRCH') return false; throw error; }
}

export async function verifyPosixTermination(child, {timeoutMs = 2000} = {}) {
  const deadline = performance.now() + timeoutMs;
  do {
    const parentExited = child.exitCode !== null || child.signalCode !== null;
    if (parentExited && !groupIsRunning(child.pid)) return;
    await pause(20);
  } while (performance.now() < deadline);
  throw Error('Beendigung der Worker-Prozessgruppe nicht bestätigt');
}
