export async function readApiResponse(response) {
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error ?? 'Anfrage fehlgeschlagen');
    error.status = response.status;
    error.code = data.code;
    throw error;
  }
  return data;
}

export const shouldRefreshView = (view, editorOpen) =>
  !editorOpen && ['overview', 'runs', 'suites'].includes(view);

// Keep user-controlled state when result values are refreshed.
function selectionOf(node) {
  try {
    return typeof node?.selectionStart === 'number' ? [node.selectionStart,node.selectionEnd] : null;
  } catch { return null; }
}

export function preserveView(document, window, render) {
  const content = document.querySelector('#content');
  const details = [...content.querySelectorAll('details')].map(node => node.open);
  const controls = [...content.querySelectorAll('input,select,textarea')]
    .filter(node => node.id).map(node => ({id:node.id,value:node.value,checked:node.checked}));
  const active = document.activeElement;
  const focusId = active?.id;
  const selection = selectionOf(active);
  const comparison = document.querySelector('#comparison')?.innerHTML;
  const [x,y] = [window.scrollX,window.scrollY];
  render();
  [...content.querySelectorAll('details')].forEach((node,index) => {
    if (index < details.length) node.open = details[index];
  });
  for (const control of controls) {
    const node = document.getElementById(control.id);
    if (node) { node.value = control.value; node.checked = control.checked; }
  }
  const target = focusId && document.getElementById(focusId);
  if (target) { target.focus({preventScroll:true}); if(selection)try{target.setSelectionRange(...selection)}catch{}; }
  // A prior comparison contains old result statuses; invalidate it explicitly.
  const compare = document.querySelector('#comparison');
  if (compare && comparison) {
    compare.textContent = 'Laufergebnisse aktualisiert. Vergleichslauf erneut wählen.';
    const select = document.getElementById('compareRun');if(select)select.value='';
  }
  window.scrollTo(x,y);
}
