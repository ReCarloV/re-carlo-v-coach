(function(){
  'use strict';

  const model=window.rcEvidenceWatchModel,store=window.rcDataStore,panel=document.getElementById('evidence-watch-panel');
  if(!model||!panel)return;
  const remoteUrl='https://raw.githubusercontent.com/ReCarloV/re-carlo-v-coach/main/evidence-watch.json';
  const workflowUrl='https://github.com/ReCarloV/re-carlo-v-coach/actions/workflows/evidence-watch.yml';
  const status=document.getElementById('evidence-watch-status'),lastScan=document.getElementById('evidence-watch-last-scan'),coverage=document.getElementById('evidence-watch-coverage'),candidateCount=document.getElementById('evidence-watch-candidate-count'),changeCount=document.getElementById('evidence-watch-change-count'),summary=document.getElementById('evidence-watch-summary'),domains=document.getElementById('evidence-watch-domains'),candidates=document.getElementById('evidence-watch-candidates'),candidateSection=document.getElementById('evidence-watch-candidate-section'),reviewSummary=document.getElementById('evidence-watch-review-summary'),standardStatus=document.getElementById('evidence-watch-standard-status'),listMeta=document.getElementById('evidence-watch-list-meta'),filter=document.getElementById('evidence-watch-filter'),reload=document.getElementById('evidence-watch-reload'),manual=document.getElementById('evidence-watch-manual');
  let loaded=false,loading=false,currentFeed=null,currentReport=null;

  function element(tag,className,text){const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;}
  function formatDate(value){if(!value)return'In attesa';const date=new Date(value);return Number.isNaN(date.getTime())?'In attesa':date.toLocaleDateString('it-IT',{day:'numeric',month:'short',year:'numeric'});}
  function athleteContext(){
    let profile=null,goals=[];try{profile=store?.getDataset('profile');goals=store?.getDataset('goals')||[];}catch{}
    const birth=profile?.birthDate?new Date(`${profile.birthDate}T12:00:00`):null,today=new Date();let age=null;if(birth&&!Number.isNaN(birth.getTime())){age=today.getFullYear()-birth.getFullYear();if(today.getMonth()<birth.getMonth()||today.getMonth()===birth.getMonth()&&today.getDate()<birth.getDate())age--;}
    const text=[...(Array.isArray(profile?.sports)?profile.sports:[]),...goals.filter(item=>item?.status!=='cancelled').map(item=>`${item.type||''} ${item.title||item.name||''}`)].join(' ').toLowerCase(),active=new Set(['recovery','wearables','monitoring']);
    if(/run|corsa|marat|mezza|triath|spartan|obstacle/.test(text))active.add('endurance');
    if(/forza|strength|palestra|gym|hyrox|athx|spartan|obstacle/.test(text))active.add('strength');
    if(active.has('endurance')&&active.has('strength'))active.add('concurrent');
    if(/hyrox|hybrid/.test(text))active.add('hyrox');
    if(/forza|strength|palestra|gym|hyrox|athx|spartan|tennis|padel|arramp/.test(text))active.add('plyometric');
    return{age,activeDomains:[...active]};
  }
  function readReviews(){try{return store?.getDataset('evidenceReviews')||[];}catch{return[];}}
  function release(){const methodology=window.rcCoachMethodologyModel;return methodology?.standardRelease?.()||{version:methodology?.VERSION||null,label:methodology?.LABEL||'Standard Coach Elite',approvedEvidenceUpdateIds:methodology?.APPROVED_EVIDENCE_UPDATE_IDS||[]};}
  function statusClass(state){return['current','stale','partial','error','waiting'].includes(state)?state:'error';}
  function setLoading(){status.className='evidence-watch-status loading';status.textContent='CONTROLLO…';summary.textContent='Sto leggendo l’ultimo report pubblico senza usare i dati dell’atleta.';reload.disabled=true;}
  function renderDomains(report){domains.replaceChildren();report.feed.domains.forEach(item=>{const chip=element('span',item.status==='ok'?'':'error');chip.append(element('strong','',item.label),element('small','',item.status==='ok'?`${item.resultCount} trovati`:'non completato'));domains.append(chip);});}
  function option(value,label,selected){const node=element('option','',label);node.value=value;node.selected=value===selected;return node;}
  function selectField(label,name,values,selected){const wrapper=element('label');wrapper.append(element('span','',label));const select=element('select');select.name=name;values.forEach(([value,text])=>select.append(option(value,text,selected)));wrapper.append(select);return wrapper;}
  function reviewLabel(review){return review?({shortlisted:'Da approfondire',monitor:'Monitora',excluded:'Non pertinente',reviewed:'Revisione completata'}[review.status]||'Valutato'):'Da leggere';}
  function reviewForm(candidate,card){
    const saved=candidate.personalReview,form=element('form','evidence-review-form');form.hidden=true;
    const grid=element('div','evidence-review-grid');
    grid.append(
      selectField('DECISIONE','status',[['unread','Da leggere'],['shortlisted','Da approfondire'],['monitor','Monitora'],['excluded','Non pertinente'],['reviewed','Revisione completata']],saved?.status||'unread'),
      selectField('APPLICABILITÀ','applicability',[['to-review','Da verificare'],['direct','Diretta'],['contextual','Contestuale'],['low','Bassa']],saved?.applicability||candidate.athleteApplicability?.key||'to-review'),
      selectField('CONFRONTO STANDARD','agreement',[['to-review','Da verificare'],['supports','Supporta'],['extends','Estende'],['conflicts','Confligge'],['unclear','Non chiaro']],saved?.agreement||'to-review')
    );
    const note=element('label','evidence-review-note');note.append(element('span','','MOTIVAZIONE / NOTE'));const textarea=element('textarea');textarea.name='rationale';textarea.rows=3;textarea.maxLength=1600;textarea.placeholder='Cosa cambia, per quale popolazione e con quali limiti?';textarea.value=saved?.rationale||'';note.append(textarea);
    const full=element('label','evidence-review-check');const checkbox=element('input');checkbox.type='checkbox';checkbox.name='fullTextRead';checkbox.checked=Boolean(saved?.fullTextRead);full.append(checkbox,element('span','','Ho letto il testo completo, non soltanto titolo o abstract.'));
    const actions=element('div','evidence-review-form-actions'),cancel=element('button','ghost','Chiudi'),save=element('button','primary','Salva valutazione');cancel.type='button';save.type='submit';actions.append(cancel,save);form.append(grid,note,full,actions);
    cancel.addEventListener('click',()=>{form.hidden=true;card.classList.remove('review-open');});
    form.addEventListener('submit',event=>{event.preventDefault();const values=new FormData(form);try{const next=model.upsertPersonalReview(readReviews(),candidate,{status:values.get('status'),applicability:values.get('applicability'),agreement:values.get('agreement'),rationale:values.get('rationale'),fullTextRead:values.get('fullTextRead')==='on',feedGeneratedAt:currentFeed?.generatedAt||null},new Date().toISOString());store.setDataset('evidenceReviews',next);document.dispatchEvent(new CustomEvent('rc:evidence-reviews-updated',{detail:{reason:'evidence-review-saved',pmid:candidate.pmid}}));render(currentFeed);}catch(error){window.alert(error.message||'Non è stato possibile salvare la valutazione.');}});
    return form;
  }
  function filteredCandidates(report){const mode=filter.value||'priority',all=report.candidates;if(mode==='unread')return all.filter(item=>!item.personalReview);if(mode==='shortlisted')return all.filter(item=>['shortlisted','monitor'].includes(item.personalReview?.status));if(mode==='reviewed')return all.filter(item=>item.personalReview);return all.filter(item=>['A','B'].includes(item.evidenceType.tier)&&item.practicalRelevance!=='low'&&item.athleteApplicability.key!=='low'&&item.personalReview?.status!=='excluded');}
  function renderCandidates(report){
    candidates.replaceChildren();candidateSection.hidden=!report.candidates.length;if(!report.candidates.length)return;
    const filtered=filteredCandidates(report),visible=filtered.slice(0,8);listMeta.textContent=filtered.length?`${visible.length} di ${filtered.length} · ogni scelta resta personale e non cambia il Coach`:'Nessun articolo in questa vista';
    if(!visible.length){candidates.append(element('p','evidence-watch-empty','Non ci sono candidati in questa categoria.'));return;}
    visible.forEach(item=>{
      const card=element('article',`evidence-candidate review-${item.personalReview?.status||'unread'}`),head=element('div','evidence-candidate-head'),copy=element('div','evidence-candidate-copy'),meta=element('div','evidence-candidate-meta'),link=element('a','',item.title);link.href=item.url;link.target='_blank';link.rel='noopener noreferrer';copy.append(link,element('small','',`${formatDate(item.publishedAt)} · ${item.journal}`));
      meta.append(element('span',`tier tier-${item.evidenceType.tier.toLowerCase()}`,`LIVELLO ${item.evidenceType.tier}`),element('span','',item.evidenceType.label),element('span','',item.athleteApplicability.label),element('span',`review-state ${item.personalReview?.status||'unread'}`,reviewLabel(item.personalReview)));
      const controls=element('div','evidence-candidate-controls'),open=element('a','ghost','Apri PubMed'),review=element('button','ghost','Valuta');open.href=item.url;open.target='_blank';open.rel='noopener noreferrer';review.type='button';controls.append(open,review);copy.append(controls);head.append(copy,meta);card.append(head);
      const form=reviewForm(item,card);card.append(form);review.addEventListener('click',()=>{form.hidden=!form.hidden;card.classList.toggle('review-open',!form.hidden);if(!form.hidden)form.querySelector('select')?.focus();});candidates.append(card);
    });
  }
  function render(input){
    currentFeed=input;const activeRelease=release(),report=model.summarize(input,{standardVersion:activeRelease.version,approvedChangeIds:activeRelease.approvedEvidenceUpdateIds,personalReviews:readReviews(),now:new Date().toISOString(),athleteContext:athleteContext()});currentReport=report;
    status.className=`evidence-watch-status ${statusClass(report.state)}`;status.textContent=report.label.toUpperCase();reload.disabled=false;
    if(!report.feed){lastScan.textContent='—';coverage.textContent='—';candidateCount.textContent='—';changeCount.textContent='—';summary.textContent=report.detail;reviewSummary.textContent='Dati non disponibili';standardStatus.textContent=`${activeRelease.label} · report non disponibile`;domains.replaceChildren();candidates.replaceChildren();candidateSection.hidden=true;return;}
    lastScan.textContent=formatDate(report.feed.generatedAt);coverage.textContent=`${report.domainsCovered}/${report.domainCount}`;candidateCount.textContent=String(report.personalReviewSummary.unread);changeCount.textContent=String(report.approvedChanges);
    const reviews=report.personalReviewSummary;reviewSummary.textContent=reviews.total?`${reviews.shortlisted} da approfondire · ${reviews.monitor} monitorati · ${reviews.reviewed} completi · ${reviews.excluded} esclusi`:'Nessuna valutazione salvata';
    standardStatus.textContent=report.approvedAwaitingRelease?`${activeRelease.label} · ${report.approvedAwaitingRelease} modifiche inattive in attesa di release`:`${activeRelease.label} · ${report.approvedChanges} aggiornamenti Evidence attivi`;
    summary.textContent=report.feed.status==='awaiting-first-scan'?'La struttura è pronta. La prima scansione popolerà i candidati; nessuna regola del Coach cambia automaticamente.':report.candidates.length?`${report.candidates.length} pubblicazioni intercettate, ${reviews.unread} ancora da leggere. ${report.detail}`:`Nessuna nuova pubblicazione rilevante nella finestra. ${report.detail}`;
    renderDomains(report);renderCandidates(report);
  }
  async function fetchJson(url,timeoutMs=8000){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);try{const response=await fetch(url,{cache:'no-store',signal:controller.signal});if(!response.ok)throw new Error(`HTTP ${response.status}`);return await response.json();}finally{clearTimeout(timer);}}
  async function load(force=false){if(loading||loaded&&!force)return;loading=true;setLoading();try{let feed;try{feed=await fetchJson(`${remoteUrl}?v=${Date.now()}`);}catch{feed=await fetchJson('./evidence-watch.json');}render(feed);loaded=true;}catch{render(null);}finally{loading=false;reload.disabled=false;}}

  reload.addEventListener('click',()=>load(true));filter.addEventListener('change',()=>currentReport&&renderCandidates(currentReport));manual.href=workflowUrl;manual.target='_blank';manual.rel='noopener noreferrer';
  document.addEventListener('rc:view-changed',event=>{if(event.detail?.view==='data')load();});
  ['rc:profile-updated','rc:goals-updated'].forEach(name=>document.addEventListener(name,()=>currentFeed&&render(currentFeed)));window.addEventListener('rc:data-restored',()=>currentFeed&&render(currentFeed));
  if(document.getElementById('data')?.classList.contains('active'))load();
})();
