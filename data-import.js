(function(){
  'use strict';
  const model=window.rcActivityImportModel;const freshnessModel=window.rcDeviceFreshnessModel;const store=window.rcDataStore;
  if(!model||!store)return;
  const input=document.getElementById('strava-import-input');if(!input)return;
  const previewPanel=document.getElementById('strava-import-preview');const confirmButton=document.getElementById('strava-import-confirm');const status=document.getElementById('strava-import-status');const baselineWindow=document.getElementById('baseline-window');
  let pending=null;let historyExpanded=false;
  const escapeHtml=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
  function formatDate(key,options={day:'numeric',month:'short',year:'numeric'}){
    if(!key)return '—';const [year,month,day]=key.split('-').map(Number);return new Date(year,month-1,day).toLocaleDateString('it-IT',options);
  }
  function showToast(message){const toast=document.getElementById('toast');if(!toast)return;toast.textContent=message;toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),2200);}
  function setStatus(message,error=false){status.textContent=message;status.style.color=error?'#ff9a9f':'';}
  function renderSourceStatus(id,source){const node=document.getElementById(id);if(!node||!source)return;node.className=`source-status ${source.tone}`;node.textContent=source.state==='missing'?'Non collegato':source.ageDays===0?'Snapshot · oggi':source.ageDays===1?'Snapshot · ieri':`Snapshot · ${source.ageDays} gg`;node.title=freshnessModel.ageLabel(source);}
  function closePreview(){pending=null;previewPanel.hidden=true;input.value='';confirmButton.disabled=false;}
  function renderPreview(result,preview){
    const fileRange=preview.earliestDate&&preview.latestDate?`${formatDate(preview.earliestDate)} – ${formatDate(preview.latestDate)}`:'periodo non disponibile';
    document.getElementById('strava-preview-title').textContent=result.sourceName;
    document.getElementById('strava-preview-summary').textContent=`${preview.total} attività lette · ${fileRange}`;
    document.getElementById('strava-preview-new').textContent=preview.newActivities.length;
    document.getElementById('strava-preview-duplicates').textContent=preview.duplicates.length;
    document.getElementById('strava-preview-conflicts').textContent=preview.conflicts.length;
    document.getElementById('strava-preview-originals').textContent=result.originalFileEntries===null?'CSV':result.originalFileEntries;
    const notes=[];
    if(result.originalFileEntries!==null)notes.push(`${result.originalFileEntries} file attività trovati nell’archivio${result.missingOriginalFiles?`, ${result.missingOriginalFiles} riferimenti mancanti`:', tutti i riferimenti presenti'}.`);
    else notes.push('Hai caricato il riepilogo CSV: le metriche aggregate sono importabili, ma la presenza dei file FIT/GPX/TCX non può essere verificata.');
    if(preview.conflicts.length)notes.push('Le attività da verificare hanno lo stesso ID di dati già presenti ma contenuti diversi: la versione esistente verrà preservata.');
    if(!preview.newActivities.length)notes.push('Non ci sono nuove attività da aggiungere.');
    document.getElementById('strava-preview-note').textContent=notes.join(' ');
    confirmButton.textContent=preview.newActivities.length?`Importa ${preview.newActivities.length} attività nuove`:'Nessuna attività nuova';confirmButton.disabled=!preview.newActivities.length;
    previewPanel.hidden=false;previewPanel.scrollIntoView({behavior:'smooth',block:'center'});
  }
  async function inspectFile(file){
    setStatus(`Analisi di ${file.name}…`);input.disabled=true;
    try{
      const result=await model.readStravaExport(file);const existing=store.getDataset('importedActivities');const preview=model.buildImportPreview(result.activities,existing);
      pending={result,preview};renderPreview(result,preview);setStatus(`${result.rows} attività controllate. Conferma dall’anteprima.`);
    }catch(error){closePreview();setStatus(error?.message||'Non è stato possibile leggere il file.',true);}
    finally{input.disabled=false;}
  }
  function renderOverview(){
    let activities,batches,whoopBatches,whoopCycles,whoopSleeps;
    try{activities=store.getDataset('importedActivities');batches=store.getDataset('importBatches');whoopBatches=store.getDataset('whoopImportBatches');whoopCycles=store.getDataset('whoopCycles');whoopSleeps=store.getDataset('whoopSleeps');}
    catch(error){setStatus(error.message,true);return;}
    if(freshnessModel){const freshness=freshnessModel.analyzeDeviceFreshness({importedActivities:activities,importBatches:batches,whoopImportBatches:whoopBatches,whoopCycles,whoopSleeps});renderSourceStatus('strava-source-status',freshness.strava);renderSourceStatus('whoop-source-status',freshness.whoop);}
    const count=document.getElementById('data-activity-count');const range=document.getElementById('data-activity-range');count.textContent=activities.length.toLocaleString('it-IT');
    if(activities.length){const dates=activities.map(item=>item.date).sort();range.textContent=`${formatDate(dates[0])} – ${formatDate(dates.at(-1))}`;}
    else range.textContent='Nessun dato importato';
    const last=[...batches,...whoopBatches].sort((a,b)=>b.importedAt.localeCompare(a.importedAt))[0];document.getElementById('data-last-import').textContent=last?new Date(last.importedAt).toLocaleDateString('it-IT',{day:'numeric',month:'short'}):'—';
    const lastCount=last?(Array.isArray(last.addedIds)?last.addedIds.length:Object.values(last.addedIds).reduce((sum,ids)=>sum+ids.length,0)):0;const lastUpdated=Number(last?.updatedCount)||0;document.getElementById('data-last-import-note').textContent=last?(last.sourceMode==='api'?`${lastCount} nuove · ${lastUpdated} aggiornate da WHOOP`:`${lastCount} nuove da ${last.provider==='whoop'?'WHOOP':'Strava'}`):'In attesa del primo file';
    const recent=model.calculateBaseline(activities,{weeks:4});document.getElementById('data-recent-run-km').textContent=activities.length?`${recent.runKmPerWeek} km`:'—';
    document.getElementById('data-recent-run-note').textContent=activities.length?`${recent.runs} corse · ${recent.runSessionsPerWeek}/settimana`:'Baseline non disponibile';
    document.getElementById('data-run-hr-coverage').textContent=activities.length?`${recent.hrCoveragePct}%`:'—';
    document.getElementById('data-run-hr-note').textContent=activities.length?`${recent.runs} corse nella finestra`:'Nessuna attività disponibile';
    renderBaseline(activities);renderHistory(batches,whoopBatches);
  }
  function renderBaseline(activities){
    const empty=document.getElementById('baseline-empty');const content=document.getElementById('baseline-content');const weeks=Number(baselineWindow.value)||4;
    if(!activities.length){empty.hidden=false;content.hidden=true;document.getElementById('baseline-period').textContent='Importa Strava per ricostruire la baseline.';return;}
    const baseline=model.calculateBaseline(activities,{weeks});empty.hidden=true;content.hidden=false;
    document.getElementById('baseline-period').textContent=`Dal ${formatDate(baseline.startDate)} al ${formatDate(baseline.endDate)} · dati registrati, non stimati`;
    document.getElementById('baseline-run-km').textContent=baseline.runKmPerWeek;
    document.getElementById('baseline-run-frequency').textContent=baseline.runSessionsPerWeek;
    document.getElementById('baseline-session-frequency').textContent=baseline.sessionsPerWeek;
    document.getElementById('baseline-longest-run').textContent=`${baseline.longestRunKm} km`;
    const holder=document.getElementById('baseline-weeks');const max=Math.max(1,...baseline.weekly.map(item=>item.runKm));
    holder.innerHTML=baseline.weekly.map(item=>`<div class="baseline-week-row"><span>${escapeHtml(formatDate(item.weekStart,{day:'numeric',month:'short'}))}</span><div class="baseline-week-track"><i style="--week-width:${Math.max(item.runKm?4:0,item.runKm/max*100).toFixed(1)}%"></i></div><strong>${item.runKm} km</strong></div>`).join('')||'<div class="import-history-empty">Nessuna corsa nella finestra selezionata.</div>';
  }
  function renderHistory(batches,whoopBatches=[]){
    const holder=document.getElementById('import-history'),more=document.getElementById('import-history-more');
    const all=[...batches,...whoopBatches].sort((a,b)=>b.importedAt.localeCompare(a.importedAt));if(!all.length){holder.innerHTML='<div class="import-history-empty">Nessuna importazione effettuata.<br>Lo storico comparirà qui.</div>';more.hidden=true;return;}
    const visible=historyExpanded?all.slice(0,30):all.slice(0,2);holder.innerHTML=visible.map(batch=>{const live=batch.sourceMode==='api';const provider=batch.provider==='whoop'?(live?'WHOOP LIVE':'WHOOP'):'STRAVA';const added=Array.isArray(batch.addedIds)?batch.addedIds.length:Object.values(batch.addedIds).reduce((sum,ids)=>sum+ids.length,0);const updated=Number(batch.updatedCount)||0;return`<div class="import-history-item"><div class="import-history-item-head"><div><span class="import-provider ${batch.provider}">${provider}</span><strong>${escapeHtml(batch.sourceName)}</strong><span>${new Date(batch.importedAt).toLocaleString('it-IT',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}</span></div>${live?'':`<button type="button" data-provider="${batch.provider}" data-remove-import="${escapeHtml(batch.id)}">Annulla</button>`}</div><small>${added} aggiunte${live?` · ${updated} aggiornate`:''} · ${batch.duplicateCount} già presenti${batch.conflictCount?` · <span class="import-history-warning">${batch.conflictCount} da verificare</span>`:''}</small></div>`;}).join('');
    more.hidden=all.length<=2;more.textContent=historyExpanded?'Mostra solo le ultime 2':`Mostra altre (${Math.max(0,Math.min(28,all.length-2))})`;
  }

  input.addEventListener('change',()=>{const file=input.files?.[0];if(file)inspectFile(file);});
  document.getElementById('strava-preview-close').addEventListener('click',closePreview);document.getElementById('strava-preview-cancel').addEventListener('click',closePreview);
  confirmButton.addEventListener('click',()=>{
    if(!pending||!pending.preview.newActivities.length)return;confirmButton.disabled=true;
    try{
      const batch=model.createImportBatch(pending.preview,{sourceName:pending.result.sourceName,sourceRows:pending.result.rows,originalFileEntries:pending.result.originalFileEntries,missingOriginalFiles:pending.result.missingOriginalFiles},new Date());
      const activities=model.attachImportSource(pending.preview.newActivities,batch);store.commitImportBatch(batch,activities);const added=activities.length;closePreview();setStatus(`${added} attività Strava importate correttamente.`);renderOverview();showToast('Importazione Strava completata');
    }catch(error){confirmButton.disabled=false;setStatus(error?.message||'Importazione non riuscita.',true);}
  });
  document.getElementById('import-history').addEventListener('click',event=>{
    const button=event.target.closest('[data-remove-import]');if(!button)return;const batchId=button.dataset.removeImport;const whoop=button.dataset.provider==='whoop';const batches=store.getDataset(whoop?'whoopImportBatches':'importBatches');const batch=batches.find(item=>item.id===batchId);if(!batch)return;const count=Array.isArray(batch.addedIds)?batch.addedIds.length:Object.values(batch.addedIds).reduce((sum,ids)=>sum+ids.length,0);
    if(!window.confirm(`Rimuovere le ${count} registrazioni aggiunte da “${batch.sourceName}”? Piano e check-in resteranno invariati; gli abbinamenti collegati a questa importazione verranno rimossi.`))return;
    try{whoop?store.removeWhoopImportBatch(batchId):store.removeImportBatch(batchId);renderOverview();const message='Importazione annullata. Piano e check-in sono rimasti invariati; gli abbinamenti collegati sono stati rimossi.';if(whoop){document.getElementById('whoop-import-status').textContent=message;document.dispatchEvent(new CustomEvent('rc:whoop-updated',{detail:{reason:'whoop-import-removed',batchId}}));}else setStatus(message);showToast('Importazione rimossa');}
    catch(error){if(whoop)document.getElementById('whoop-import-status').textContent=error?.message||'Non è stato possibile annullare l’importazione.';else setStatus(error?.message||'Non è stato possibile annullare l’importazione.',true);}
  });
  document.getElementById('import-history-more').addEventListener('click',()=>{historyExpanded=!historyExpanded;renderOverview();});
  baselineWindow.addEventListener('change',()=>renderBaseline(store.getDataset('importedActivities')));
  window.addEventListener('rc:data-restored',renderOverview);document.addEventListener('rc:whoop-updated',renderOverview);document.addEventListener('rc:view-changed',event=>{if(event.detail?.view==='data')renderOverview();});
  renderOverview();
})();
