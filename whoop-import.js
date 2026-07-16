(function(){
  'use strict';
  const model=window.rcWhoopImportModel;const store=window.rcDataStore;if(!model||!store)return;
  const input=document.getElementById('whoop-import-input');if(!input)return;
  const status=document.getElementById('whoop-import-status');const previewPanel=document.getElementById('whoop-import-preview');const confirmButton=document.getElementById('whoop-import-confirm');const summaryWindow=document.getElementById('whoop-summary-window');const summaryMore=document.getElementById('whoop-summary-more');let pending=null;let summaryExpanded=false;
  const escapeHtml=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
  const formatDate=(key,options={day:'numeric',month:'short',year:'numeric'})=>{if(!key)return'—';const [year,month,day]=key.split('-').map(Number);return new Date(year,month-1,day).toLocaleDateString('it-IT',options);};
  const showToast=message=>{const toast=document.getElementById('toast');if(!toast)return;toast.textContent=message;toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),2200);};
  const setStatus=(message,error=false)=>{status.textContent=message;status.style.color=error?'#ff9a9f':'';};
  function readRecords(){return{cycles:store.getDataset('whoopCycles'),sleeps:store.getDataset('whoopSleeps'),workouts:store.getDataset('whoopWorkouts'),journal:store.getDataset('whoopJournal')};}
  function closePreview(){pending=null;previewPanel.hidden=true;input.value='';confirmButton.disabled=false;}
  function renderPreview(result,preview){
    const range=preview.earliestDate&&preview.latestDate?`${formatDate(preview.earliestDate)} – ${formatDate(preview.latestDate)}`:'periodo non disponibile';
    document.getElementById('whoop-preview-title').textContent=result.sourceName;document.getElementById('whoop-preview-summary').textContent=`${preview.total} registrazioni controllate · ${range}`;
    ['cycles','sleeps','workouts','journal'].forEach(kind=>{document.getElementById(`whoop-preview-${kind}`).textContent=preview.groups[kind].total;});
    const notes=[`${preview.newCount} nuove · ${preview.duplicateCount} già presenti · ${preview.conflictCount} da verificare.`];
    if(preview.groups.sleeps.total)notes.push(`${result.records.sleeps.filter(item=>item.nap).length} riposi brevi riconosciuti e separati dal sonno principale.`);
    if(preview.conflictCount)notes.push('Le registrazioni con lo stesso identificativo ma valori diversi non verranno sovrascritte.');
    if(!preview.newCount)notes.push('Non ci sono nuovi dati da aggiungere.');
    document.getElementById('whoop-preview-note').textContent=notes.join(' ');confirmButton.textContent=preview.newCount?`Importa ${preview.newCount} registrazioni nuove`:'Nessun dato nuovo';confirmButton.disabled=!preview.newCount;previewPanel.hidden=false;previewPanel.scrollIntoView({behavior:'smooth',block:'center'});
  }
  async function inspectFile(file){
    setStatus(`Analisi di ${file.name}…`);input.disabled=true;
    try{const result=await model.readWhoopExport(file);const preview=model.buildWhoopPreview(result.records,readRecords());pending={result,preview};renderPreview(result,preview);setStatus(`${result.totalRecords} registrazioni controllate. Conferma dall’anteprima.`);}
    catch(error){closePreview();setStatus(error?.message||'Non è stato possibile leggere l’archivio WHOOP.',true);}
    finally{input.disabled=false;}
  }
  const value=(number,suffix='')=>number===null||number===undefined?'n/d':`${number}${suffix}`;
  function recoveryClass(score){if(score===null||score===undefined)return'missing';if(score>=67)return'high';if(score>=34)return'medium';return'low';}
  function hours(decimal){if(decimal===null||decimal===undefined)return'n/d';const total=Math.round(decimal*60);return`${Math.floor(total/60)} h ${String(total%60).padStart(2,'0')}`;}
  function renderSummary(){
    let records;try{records=readRecords();}catch(error){setStatus(error.message,true);return;}
    const empty=document.getElementById('whoop-summary-empty');const content=document.getElementById('whoop-summary-content');
    if(!records.cycles.length&&!records.sleeps.length&&!records.workouts.length){empty.hidden=false;content.hidden=true;summaryMore.hidden=true;document.getElementById('whoop-summary-period').textContent='Importa WHOOP per mostrare i dati fisiologici disponibili.';return;}
    const summary=model.calculateWhoopSummary(records,{days:Number(summaryWindow.value)||7});empty.hidden=true;content.hidden=false;document.getElementById('whoop-summary-period').textContent=`Dal ${formatDate(summary.startDate)} al ${formatDate(summary.endDate)} · ${summary.recoveryDays} giorni con recovery disponibile`;
    document.getElementById('whoop-summary-recovery').textContent=value(summary.avgRecovery,'%');document.getElementById('whoop-summary-hrv').textContent=value(summary.avgHrv,' ms');document.getElementById('whoop-summary-rhr').textContent=value(summary.avgRestingHr,' bpm');document.getElementById('whoop-summary-sleep').textContent=hours(summary.avgSleepHours);document.getElementById('whoop-summary-performance').textContent=value(summary.avgSleepPerformance,'%');document.getElementById('whoop-summary-workouts').textContent=summary.workouts;
    const allDays=[...summary.daily].reverse(),days=summaryExpanded?allDays:allDays.slice(0,4);document.getElementById('whoop-summary-daily').innerHTML=days.map(item=>`<div class="whoop-day-row"><span>${escapeHtml(formatDate(item.date,{weekday:'short',day:'numeric',month:'short'}))}</span><span class="whoop-recovery ${recoveryClass(item.recoveryScore)}">${escapeHtml(value(item.recoveryScore,'%'))}</span><span>${escapeHtml(value(item.hrvMs,' ms HRV'))}</span><span>${escapeHtml(value(item.restingHr,' bpm'))}</span><span>${escapeHtml(item.sleepHours===null?'sonno n/d':`${item.sleepHours} h sonno`)}</span></div>`).join('')||'<div class="import-history-empty">Nessun ciclo WHOOP nella finestra selezionata.</div>';summaryMore.hidden=allDays.length<=4;summaryMore.textContent=summaryExpanded?'Mostra solo gli ultimi 4':`Mostra altri (${allDays.length-4})`;
  }
  input.addEventListener('change',()=>{const file=input.files?.[0];if(file)inspectFile(file);});document.getElementById('whoop-preview-close').addEventListener('click',closePreview);document.getElementById('whoop-preview-cancel').addEventListener('click',closePreview);
  confirmButton.addEventListener('click',()=>{
    if(!pending||!pending.preview.newCount)return;confirmButton.disabled=true;
    try{const batch=model.createWhoopImportBatch(pending.preview,{sourceName:pending.result.sourceName},new Date());const records=model.attachWhoopSource(pending.preview,batch);store.commitWhoopImportBatch(batch,records);const added=pending.preview.newCount;closePreview();setStatus(`${added} registrazioni WHOOP importate correttamente.`);renderSummary();document.dispatchEvent(new CustomEvent('rc:whoop-updated',{detail:{reason:'whoop-imported',batchId:batch.id}}));showToast('Importazione WHOOP completata');}
    catch(error){confirmButton.disabled=false;setStatus(error?.message||'Importazione WHOOP non riuscita.',true);}
  });
  summaryWindow.addEventListener('change',()=>{summaryExpanded=false;renderSummary();});summaryMore.addEventListener('click',()=>{summaryExpanded=!summaryExpanded;renderSummary();});window.addEventListener('rc:data-restored',renderSummary);document.addEventListener('rc:whoop-updated',renderSummary);document.addEventListener('rc:view-changed',event=>{if(event.detail?.view==='data')renderSummary();});renderSummary();
})();
