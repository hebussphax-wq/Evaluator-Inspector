import {isDeepStrictEqual} from 'node:util';
export function suiteVerdict(suite,library,runs,currentEngineHash){
 const candidates=[...runs].filter(r=>r.definition?.suite?.id===suite.id).sort((a,b)=>b.startedAt.localeCompare(a.startedAt));
 if(!candidates.length)return {status:'untested',reason:'Dieser Testplan wurde noch nicht ausgeführt'};
 const run=candidates[0],current=suite.testIds.map(id=>library.tests.find(t=>t.id===id));
 if(currentEngineHash&&run.engineHash!==currentEngineHash)return {status:'stale',reason:'Engine seit dem Lauf geändert',runId:run.id};
 if(!isDeepStrictEqual(run.definition.settings,library.settings??{allowCommands:false}))return {status:'stale',reason:'Ausführungseinstellungen seit dem Lauf geändert',runId:run.id};
 if(!isDeepStrictEqual(run.definition.suite,suite)||!isDeepStrictEqual(run.definition.tests,current))return {status:'stale',reason:'Testplan oder Definition seit dem Lauf geändert',runId:run.id};
 for(const t of current){const before=run.definition.projects.find(p=>p.id===t.projectId),now=library.projects.find(p=>p.id===t.projectId);if(!isDeepStrictEqual(before,now))return {status:'stale',reason:'Testumgebung oder deklarierter Kandidat geändert',runId:run.id}}
 if(run.results.length!==suite.testIds.length*run.definition.repeat)return {status:'incomplete',reason:'Nicht alle geplanten Ergebnisse vorhanden',runId:run.id};
 for(let i=1;i<=run.definition.repeat;i++)for(const id of suite.testIds){if(run.results.filter(r=>r.testId===id&&r.iteration===i).length!==1)return {status:'incomplete',reason:'Fehlende oder doppelte Ergebniszuordnung',runId:run.id}}
 return {status:run.status,reason:'Bewertung nur für diesen Testplan, Definitionsstand und deklarierten Kandidaten',runId:run.id};
}
