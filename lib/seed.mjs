import {templates} from './contract.mjs';
export function seed(root){return {schemaVersion:1,projects:[{id:'cockpit',name:'Evaluator · lokale Beispiele',root,target:'Lokaler Rechner',candidate:'Evaluator 1.0.0 · Beispieldateien',notes:'Demonstrationsumgebung; keine Produktabnahme fremder Software'}],tests:[
 ['readme','Dokumentation vorhanden','file','Smoke',{path:'README.md',exists:true,kind:'file',minBytes:100}],
 ['text','Erwarteten Dateiinhalt prüfen','text','Regression',{path:'examples/actual.txt',includes:['Test-Cockpit'],excludes:['ERROR']}],
 ['json','Paketvertrag prüfen','json','Integration',templates.json],
 ['csv','Messdaten auswerten','csv','Datenqualität',templates.csv],
 ['compare','Referenzvergleich','compare','Regression',templates.compare],
 ['manual','Bedienbarkeit nachvollziehen','manual','Manuell',templates.manual]
 ].map(([id,name,type,category,config])=>({id,name,type,category,config,purpose:'Demonstriert eine explizite Prüfung mit nachvollziehbarem Sollwert; kein Nachweis für fremde Produkte.',projectId:'cockpit',tags:['Beispiel'],enabled:true,timeoutMs:10000})),suites:[{id:'examples',name:'Lokale Beispiele · automatische Prüfungen',testIds:['readme','text','json','csv','compare'],stopOnFailure:false}],settings:{allowCommands:false}}}
