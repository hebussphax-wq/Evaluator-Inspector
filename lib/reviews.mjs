export function reviewResult(result,test,input){
 const {status,note,evidence,reviewer,steps}=input;
 const requiredText=v=>typeof v==='string'&&v.trim().length>0;
 if(!requiredText(reviewer))throw Error('Prüfer erforderlich');
 const at=new Date().toISOString();
 if(test.type==='checklist'){
  const original=result.evidence.steps??test.config.steps;
  const pending=original.filter(s=>s.required&&s.status==='pending');
  if(!Array.isArray(steps)||steps.length!==pending.length||new Set(steps.map(s=>s.id)).size!==steps.length||steps.some(s=>!pending.some(p=>p.id===s.id)))throw Error('Für jeden offenen Pflichtschritt ein eigenes Urteil erforderlich');
  for(const s of steps)if(!['passed','failed'].includes(s.status)||!requiredText(s.note)||!requiredText(s.evidence))throw Error('Schritturteil, Beobachtung und Nachweisreferenz erforderlich');
  const reviewed=original.map(s=>{const r=steps.find(r=>r.id===s.id);return r?{...s,status:r.status,note:r.note,evidence:r.evidence,reviewer,at,evidenceClass:'human-attestation'}:s});
  const required=reviewed.filter(s=>s.required);
  result.status=required.some(s=>s.status==='failed')?'failed':required.some(s=>s.status==='pending')?'pending_manual':'passed';
  result.evidence={...result.evidence,steps:reviewed,review:{reviewer,at,evidenceClass:'human-attestation'}};
  result.assertions=required.map(s=>({label:s.label,passed:s.status==='passed',actual:s.status,expected:'passed'}));
 }else{
  if(!['passed','failed'].includes(status)||!requiredText(note)||!requiredText(evidence))throw Error('Urteil, Prüfer, Beobachtung und Nachweisreferenz erforderlich');
  result.status=status;
  result.evidence.review={status,note,evidence,reviewer,at,evidenceClass:'human-attestation'};
  result.assertions=[{label:'Manuelles Urteil',passed:status==='passed',actual:note,expected:test.config.expected}];
 }
 return result;
}
