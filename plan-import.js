(function(){
  'use strict';
  const model=window.rcPlanImportModel;const store=window.rcDataStore;if(!model||!store)return;
  const input=document.getElementById('plan-import-input');if(!input)return;const status=document.getElementById('plan-import-status');const previewPanel=document.getElementById('plan-import-preview');const confirmButton=document.getElementById('plan-import-confirm');let pending=null;
  function formatDate(key){if(!key)return'—';const [year,month,day]=key.split('-').map(Number);return new Date(year,month-1,day).toLocaleDateString('it-IT',{day:'numeric',month:'short',year:'numeric'});}
  function setStatus(message,error=false){status.textContent=message;status.style.color=error?'#ff9a9f':'';}
  function showToast(message){const toast=document.getElementById('toast');if(!toast)return;toast.textContent=message;toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),2200);}
  function closePreview(){pending=null;previewPanel.hidden=true;input.value='';input.disabled=false;confirmButton.disabled=false;}
  function renderPreview(result,preview){
    document.getElementById('plan-preview-title').textContent=result.sourceName;document.getElementById('plan-preview-summary').textContent=`${result.rows} sedute · ${formatDate(result.earliestDate)} – ${formatDate(result.latestDate)}`;
    document.getElementById('plan-preview-new').textContent=preview.newSessions.length;document.getElementById('plan-preview-existing').textContent=preview.duplicates.length;document.getElementById('plan-preview-conflicts').textContent=preview.conflicts.length;document.getElementById('plan-preview-completed').textContent=result.completed+result.partial;
    const notes=['Le date future sono distribuite dentro la settimana indicata nel foglio e restano modificabili dal Piano.'];if(result.completed)notes.push(`${result.completed} sedute marcate “Fatta” mantengono soltanto i valori reali effettivamente compilati nel file.`);if(preview.conflicts.length)notes.push(`${preview.conflicts.length} sedute con lo stesso identificativo risultano già modificate nell’app: la versione locale verrà preservata.`);if(!preview.newSessions.length)notes.push('Non ci sono nuove sedute da aggiungere.');document.getElementById('plan-preview-note').textContent=notes.join(' ');
    confirmButton.textContent=preview.newSessions.length?`Aggiungi ${preview.newSessions.length} sedute al Piano`:'Piano già importato';confirmButton.disabled=!preview.newSessions.length;previewPanel.hidden=false;previewPanel.scrollIntoView({behavior:'smooth',block:'center'});
  }
  async function inspectFile(file){
    setStatus(`Analisi di ${file.name}…`);input.disabled=true;
    try{const result=await model.readPlanWorkbook(file);const preview=model.buildPlanImportPreview(result.sessions,store.getDataset('sessions'));pending={result,preview};renderPreview(result,preview);setStatus(`${result.rows} sedute controllate. Conferma dall’anteprima.`);}
    catch(error){closePreview();setStatus(error?.message||'Non è stato possibile leggere il piano Excel.',true);}
    finally{input.disabled=false;}
  }
  input.addEventListener('change',()=>{const file=input.files?.[0];if(file)inspectFile(file);});document.getElementById('plan-preview-close').addEventListener('click',closePreview);document.getElementById('plan-preview-cancel').addEventListener('click',closePreview);
  confirmButton.addEventListener('click',()=>{
    if(!pending||!pending.preview.newSessions.length)return;confirmButton.disabled=true;
    try{const {result,preview}=pending;store.setDataset('sessions',preview.merged);const added=preview.newSessions.length;const firstPending=result.sessions.find(item=>!item.outcome)?.date||result.earliestDate;window.rcSessions?.reload?.();window.rcSessions?.showMonth?.(firstPending.slice(0,7));document.dispatchEvent(new CustomEvent('rc:sessions-updated',{detail:{reason:'excel-plan-imported',sessionIds:preview.newSessions.map(item=>item.id)}}));closePreview();setStatus(`${added} sedute aggiunte al Piano. Le sessioni già presenti sono rimaste invariate.`);window.rcNavigation?.show?.('plan');showToast('Piano Excel importato');}
    catch(error){confirmButton.disabled=false;setStatus(error?.message||'Non è stato possibile importare il Piano.',true);}
  });
})();
