(function(){
  'use strict';

  const model=window.rcEvidenceWatchModel,panel=document.getElementById('evidence-watch-panel');
  if(!model||!panel)return;
  const remoteUrl='https://raw.githubusercontent.com/ReCarloV/re-carlo-v-coach/main/evidence-watch.json';
  const workflowUrl='https://github.com/ReCarloV/re-carlo-v-coach/actions/workflows/evidence-watch.yml';
  const status=document.getElementById('evidence-watch-status'),lastScan=document.getElementById('evidence-watch-last-scan'),coverage=document.getElementById('evidence-watch-coverage'),candidateCount=document.getElementById('evidence-watch-candidate-count'),changeCount=document.getElementById('evidence-watch-change-count'),summary=document.getElementById('evidence-watch-summary'),domains=document.getElementById('evidence-watch-domains'),candidates=document.getElementById('evidence-watch-candidates'),candidateSection=document.getElementById('evidence-watch-candidate-section'),reload=document.getElementById('evidence-watch-reload'),manual=document.getElementById('evidence-watch-manual');
  let loaded=false,loading=false;

  function element(tag,className,text){const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;}
  function formatDate(value){if(!value)return'In attesa';const date=new Date(value);return Number.isNaN(date.getTime())?'In attesa':date.toLocaleDateString('it-IT',{day:'numeric',month:'short',year:'numeric'});}
  function athleteContext(){
    let profile=null,goals=[];try{profile=window.rcDataStore?.getDataset('profile');goals=window.rcDataStore?.getDataset('goals')||[];}catch{}
    const birth=profile?.birthDate?new Date(`${profile.birthDate}T12:00:00`):null,today=new Date();let age=null;if(birth&&!Number.isNaN(birth.getTime())){age=today.getFullYear()-birth.getFullYear();if(today.getMonth()<birth.getMonth()||today.getMonth()===birth.getMonth()&&today.getDate()<birth.getDate())age--;}
    const text=[...(Array.isArray(profile?.sports)?profile.sports:[]),...goals.filter(item=>item?.status!=='cancelled').map(item=>`${item.type||''} ${item.title||''}`)].join(' ').toLowerCase(),active=new Set(['recovery','wearables','monitoring']);
    if(/run|corsa|marat|mezza|triath|spartan|obstacle/.test(text))active.add('endurance');
    if(/forza|strength|palestra|gym|hyrox|athx|spartan|obstacle/.test(text))active.add('strength');
    if(active.has('endurance')&&active.has('strength'))active.add('concurrent');
    if(/hyrox|hybrid/.test(text))active.add('hyrox');
    if(/forza|strength|palestra|gym|hyrox|athx|spartan|tennis|padel|arramp/.test(text))active.add('plyometric');
    return{age,activeDomains:[...active]};
  }
  function statusClass(state){return['current','stale','partial','error','waiting'].includes(state)?state:'error';}
  function setLoading(){status.className='evidence-watch-status loading';status.textContent='CONTROLLO…';summary.textContent='Sto leggendo l’ultimo report pubblico senza usare i dati dell’atleta.';reload.disabled=true;}
  function renderDomains(report){domains.replaceChildren();report.feed.domains.forEach(item=>{const chip=element('span',item.status==='ok'?'':'error');chip.append(element('strong','',item.label),element('small','',item.status==='ok'?`${item.resultCount} trovati`:'non completato'));domains.append(chip);});}
  function renderCandidates(report){candidates.replaceChildren();const visible=report.priorityCandidates.slice(0,6);candidateSection.hidden=!visible.length;if(!visible.length)return;
    visible.forEach(item=>{const card=element('article','evidence-candidate'),copy=element('div'),meta=element('div','evidence-candidate-meta');const link=element('a','',item.title);link.href=item.url;link.target='_blank';link.rel='noopener noreferrer';copy.append(link,element('small','',`${formatDate(item.publishedAt)} · ${item.journal}`));meta.append(element('span',`tier tier-${item.evidenceType.tier.toLowerCase()}`,`LIVELLO ${item.evidenceType.tier}`),element('span','',item.evidenceType.label),element('span','',item.athleteApplicability.label));card.append(copy,meta);candidates.append(card);});
  }
  function render(input){const standardVersion=window.rcCoachMethodologyModel?.VERSION||null,report=model.summarize(input,{standardVersion,now:new Date().toISOString(),athleteContext:athleteContext()});
    status.className=`evidence-watch-status ${statusClass(report.state)}`;status.textContent=report.label.toUpperCase();reload.disabled=false;
    if(!report.feed){lastScan.textContent='—';coverage.textContent='—';candidateCount.textContent='—';changeCount.textContent='—';summary.textContent=report.detail;domains.replaceChildren();candidates.replaceChildren();candidateSection.hidden=true;return;}
    lastScan.textContent=formatDate(report.feed.generatedAt);coverage.textContent=`${report.domainsCovered}/${report.domainCount}`;candidateCount.textContent=String(report.candidates.length);changeCount.textContent=String(report.approvedChanges);
    summary.textContent=report.feed.status==='awaiting-first-scan'?'La struttura è pronta. La prima scansione popolerà i candidati; nessuna regola del Coach cambia automaticamente.':report.candidates.length?`${report.candidates.length} pubblicazioni da vagliare. ${report.detail}`:`Nessuna nuova pubblicazione rilevante nella finestra. ${report.detail}`;
    renderDomains(report);renderCandidates(report);
  }
  async function fetchJson(url,timeoutMs=8000){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);try{const response=await fetch(url,{cache:'no-store',signal:controller.signal});if(!response.ok)throw new Error(`HTTP ${response.status}`);return await response.json();}finally{clearTimeout(timer);}}
  async function load(force=false){if(loading||loaded&&!force)return;loading=true;setLoading();try{let feed;try{feed=await fetchJson(`${remoteUrl}?v=${Date.now()}`);}catch{feed=await fetchJson('./evidence-watch.json');}render(feed);loaded=true;}catch{render(null);}finally{loading=false;reload.disabled=false;}}

  reload.addEventListener('click',()=>load(true));manual.href=workflowUrl;manual.target='_blank';manual.rel='noopener noreferrer';
  document.addEventListener('rc:view-changed',event=>{if(event.detail?.view==='data')load();});
  if(document.getElementById('data')?.classList.contains('active'))load();
})();
