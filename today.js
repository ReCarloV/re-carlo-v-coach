(function(){
  const sessionPanel=document.getElementById('today-session-panel');
  const weekPanel=document.getElementById('today-week-panel');
  const adaptivePanel=document.getElementById('today-adaptive-panel');
  const whoopOverview=document.getElementById('today-whoop-overview');
  const toneClass={good:'proceed',warn:'reduce',danger:'replace',proceed:'proceed',reduce:'reduce',replace:'replace',neutral:''};
  let adaptiveCollapsed=false;

  function element(tag,className,text){const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;}
  function safeDataset(name,fallback){try{return window.rcDataStore?.getDataset(name)??fallback;}catch(_){return fallback;}}
  function currentModel(){
    const input={sessions:window.rcSessions?.getAll?.()||safeDataset('sessions',[]),preCheckins:window.rcCheckins?.getHistory?.()||safeDataset('preSessionCheckins',[]),bodyIssues:window.rcBodyIssues?.all?.()||safeDataset('bodyIssues',[]),whoopCycles:safeDataset('whoopCycles',[]),whoopSleeps:safeDataset('whoopSleeps',[]),whoopImportBatches:safeDataset('whoopImportBatches',[])};
    const rawAnalysis=window.rcAdaptiveEngine?.analyze?.(input);const now=new Date(),today=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`,weekStart=window.rcGoalsModel?.mondayFor(today)||today,goal=window.rcGoalsModel?.classifyGoals(safeDataset('goals',[]),weekStart)?.current||null,phaseConstraints=window.rcPhaseConstraintsModel?.forWeek({goal,weekStart,sessions:input.sessions,analysis:rawAnalysis})||null,adaptiveAnalysis=window.rcPhaseConstraintsModel?.constrainAnalysis(rawAnalysis,phaseConstraints)||rawAnalysis;return window.rcTodayModel.buildTodayModel({...input,adaptiveAnalysis});
  }
  function setMetric(valueId,summaryId,metric,highlightCard=false){
    const value=document.getElementById(valueId);value.textContent=String(metric.value);value.classList.remove('metric-good','metric-warn','metric-danger','metric-rest');
    if(metric.tone&&metric.tone!=='neutral')value.classList.add(`metric-${metric.tone}`);
    const card=value.closest('article');card?.classList.remove('metric-card-good','metric-card-warn','metric-card-danger','metric-card-rest');
    if(highlightCard&&metric.tone&&metric.tone!=='neutral')card?.classList.add(`metric-card-${metric.tone}`);
    document.getElementById(summaryId).textContent=metric.summary;
  }
  function renderMetrics(model){
    setMetric('today-subjective-value','today-subjective-summary',model.subjective,true);
    const sleepCard=document.getElementById('today-sleep-card'),metrics=document.getElementById('today-metrics');sleepCard.hidden=!model.sleep.visible;metrics.classList.toggle('without-sleep',!model.sleep.visible);if(model.sleep.visible)setMetric('today-sleep-value','today-sleep-summary',model.sleep,true);
    setMetric('today-load-value','today-load-summary',model.load7);
    setMetric('today-issues-count','today-issues-summary',model.issuesMetric);
  }
  function renderWhoopOverview(model){
    if(!whoopOverview)return;const overview=model.whoopOverview;whoopOverview.hidden=!overview.visible;whoopOverview.replaceChildren();if(!overview.visible)return;
    const head=element('div','panel-head');const copy=element('div');copy.append(element('small','','WHOOP · OGGI'),element('h2','','Recovery, sonno e strain'));const freshness=element('span','today-whoop-freshness',overview.freshness?.ageDays===0?'AGGIORNATO OGGI':'ULTIMO DATO DISPONIBILE');const controls=element('div','today-whoop-head-actions');const live=window.rcWhoopLiveSync,state=live?.state?.()||{connected:false,canRefresh:false,syncing:false};const canRefresh=state.canRefresh===undefined?state.connected:state.canRefresh;const refresh=element('button','today-whoop-refresh',state.syncing?'↻ Aggiorno…':'↻ Aggiorna');refresh.type='button';refresh.disabled=!canRefresh||state.syncing;refresh.title=canRefresh?'Scarica ora i dati più recenti da WHOOP':'Collega WHOOP dalle Impostazioni per aggiornare da qui';refresh.setAttribute('aria-label',state.syncing?'Aggiornamento WHOOP in corso':'Aggiorna adesso i dati WHOOP');refresh.addEventListener('click',async()=>{if(!refresh.disabled)await live.syncNow();});controls.append(freshness,refresh);head.append(copy,controls);
    const rings=element('div','today-whoop-rings');overview.rings.forEach(metric=>{const card=element('section',`today-whoop-ring ring-${metric.tone}`);const dial=element('div','today-whoop-dial');dial.style.setProperty('--ring-progress',metric.progress);dial.setAttribute('role','img');dial.setAttribute('aria-label',`${metric.label}: ${metric.display}`);dial.append(element('strong','',metric.display));card.append(dial,element('span','',metric.label));rings.append(card);});whoopOverview.append(head,rings);
  }
  function renderAdaptive(model){
    if(!adaptivePanel)return;const coach=model.adaptiveCoach;adaptivePanel.className=`panel today-adaptive-panel ${coach.level}${adaptiveCollapsed?' is-collapsed':''}`;adaptivePanel.replaceChildren();
    const head=element('div','panel-head');const copy=element('div');copy.append(element('small','',coach.kicker),element('h2','',coach.title));const status=element('span',`today-adaptive-status ${coach.tone}`,coach.statusLabel);const headActions=element('div','panel-head-actions');const toggle=element('button','panel-collapse-toggle');toggle.type='button';toggle.setAttribute('aria-controls','today-adaptive-body');const toggleLabel=element('span','',adaptiveCollapsed?'Apri':'Nascondi');const chevron=element('span','panel-collapse-chevron');chevron.setAttribute('aria-hidden','true');toggle.append(toggleLabel,chevron);const syncToggle=()=>{adaptivePanel.classList.toggle('is-collapsed',adaptiveCollapsed);toggle.setAttribute('aria-expanded',String(!adaptiveCollapsed));toggle.setAttribute('aria-label',adaptiveCollapsed?'Apri decisione live':'Nascondi decisione live');toggleLabel.textContent=adaptiveCollapsed?'Apri':'Nascondi';};toggle.addEventListener('click',()=>{adaptiveCollapsed=!adaptiveCollapsed;syncToggle();});syncToggle();headActions.append(status,toggle);head.append(copy,headActions);
    const summary=element('p','today-adaptive-summary',coach.summary);const grid=element('div','today-adaptive-grid');
    const whoop=element('section',`today-adaptive-signal ${coach.whoop.tone}`);whoop.append(element('small','','WHOOP NELLA DECISIONE'),element('strong','',coach.whoop.label),element('p','',coach.whoop.detail));
    const impact=element('section','today-adaptive-signal impact');impact.append(element('small','','EFFETTO SULLA PROPOSTA'),element('strong','',coach.impact.label),element('p','',coach.impact.detail));grid.append(whoop,impact);
    const reasons=element('ul','today-adaptive-reasons');(coach.reasons.length?coach.reasons:['Nessun segnale sufficiente per cambiare automaticamente il piano.']).forEach(reason=>reasons.append(element('li','',reason)));
    const actions=element('div','today-adaptive-actions');if(coach.applied){const done=element('button','primary today-adaptive-done','✓ Adattamento applicato');done.type='button';done.disabled=true;const plan=element('button','ghost','Apri il piano');plan.type='button';plan.addEventListener('click',()=>window.rcNavigation?.show('plan'));actions.append(done,plan);}else{const preview=element('button','primary',coach.reviewRequired?'Rivedi il microciclo':coach.stale?'Rivedi l’anteprima':'Prova l’anteprima del piano');preview.type='button';preview.addEventListener('click',()=>{window.rcNavigation?.show('plan');setTimeout(()=>window.rcGenerator?.open?.(),0);});actions.append(preview);}const recap=element('button','ghost','Apri il recap completo');recap.type='button';recap.addEventListener('click',()=>window.rcNavigation?.show('recap'));actions.append(recap);
    const safety=coach.applied?`Applicato${coach.appliedAt?` il ${new Date(coach.appliedAt).toLocaleString('it-IT',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}`:''}. Una nuova variazione dei dati richiederà una nuova anteprima.`:'Nessuna modifica viene salvata finché non confermi la proposta.';const body=element('div','collapsible-panel-body');body.id='today-adaptive-body';const bodyInner=element('div','collapsible-panel-body-inner');bodyInner.append(summary,grid,reasons,actions,element('small','today-adaptive-safety',safety));body.append(bodyInner);adaptivePanel.append(head,body);
  }
  function formatDate(value){return new Date(`${value}T12:00:00`).toLocaleDateString('it-IT',{weekday:'long',day:'numeric',month:'long'});}
  function greeting(name){const hour=new Date().getHours(),lead=hour<12?'Buongiorno':hour<18?'Buon pomeriggio':'Buonasera';return name?`${lead}, ${name}.`:`${lead}.`;}

  function renderNoSession(model){
    const head=element('div','panel-head');const copy=element('div');copy.append(element('span','tag rest','OGGI'),element('h2','',model.nextSession?'Rest day':'Piano libero'));head.append(copy);
    const empty=element('div','today-empty-state');empty.append(element('strong','',model.nextSession?`Prossima · ${model.nextSession.title}`:'Nessuna seduta programmata'),element('span','',model.nextSession?`${formatDate(model.nextSession.date)} · ${window.rcSessions?.describe?.(model.nextSession.id)||`${model.nextSession.durationMin} min`}`:'Imposta la disponibilità per creare la settimana.'));
    const action=element('button','primary',model.nextSession?'Apri il piano':'Imposta la settimana');action.type='button';action.addEventListener('click',()=>{window.rcNavigation?.show('plan');if(!model.nextSession)setTimeout(()=>document.getElementById('open-weekly-checkin')?.click(),0);});
    sessionPanel.append(head,empty,action);
  }
  function secondaryRow(item){
    const row=element('div','today-secondary-row');const status=item.outcome?({completed:'Svolta',partial:'Parziale',skipped:'Non svolta'}[item.outcome.status]||'Registrata'):'Programmata';
    const copy=element('div');copy.append(element('strong','',item.title),element('span','',`${status} · ${item.durationMin} min`));
    const action=element('button','ghost',item.outcome?'Dettagli':'Check-in');action.type='button';action.addEventListener('click',()=>item.outcome?window.rcSessions.openOutcome(item.id):window.rcCheckins.openPre(item.id));row.append(copy,action);return row;
  }
  function renderPrimary(model){
    const session=model.primary;const execution=model.execution;const head=element('div','panel-head');const copy=element('div');const tags=element('div','today-session-tags');tags.append(element('span',`tag ${model.primaryTag.css}`,model.primaryTag.label));if(execution?.adapted)tags.append(element('span',`tag adjustment ${execution.mode}`,execution.mode==='replace'?'SOSTITUZIONE ODIERNA':'VERSIONE ADATTATA'));copy.append(tags,element('h2','',execution?.title||session.title));
    const edit=element('button','ghost','Modifica');edit.type='button';edit.addEventListener('click',()=>window.rcSessions.openEditor(session.id));head.append(copy,edit);
    const summary=element('p','muted',execution?.adapted?`${execution.mode==='replace'?`In sostituzione di “${session.title}”`:`Adattata da ${session.durationMin} a ${execution.effectiveDurationMin} min`} · il piano originale resta nello storico`:model.primarySummary);
    const prescription=element('div','prescription today-prescription');model.prescription.forEach(block=>{const card=element('div',block.intensity?`intensity-${block.intensity}`:'');card.append(element('small','',block.label.toUpperCase()),element('strong','',block.value||'Da definire'));prescription.append(card);});
    const note=element('div',`coach-note ${toneClass[model.coachNote.tone]||''}`.trim());note.id='today-coach-note';note.append(element('strong','',model.coachNote.title));if(model.coachNote.text)note.append(element('p','',model.coachNote.text));
    const actions=element('div','today-session-actions');const primaryAction=element('button','primary');primaryAction.type='button';
    if(session.outcome){primaryAction.textContent='Apri registrazione';primaryAction.addEventListener('click',()=>window.rcSessions.openOutcome(session.id));}
    else {primaryAction.id='open-pre-checkin';primaryAction.textContent=model.checkin?'Aggiorna check-in pre sessione':'Avvia check-in pre sessione';primaryAction.addEventListener('click',()=>window.rcCheckins.openPre(session.id));}
    const planAction=element('button','ghost','Vedi nel piano');planAction.type='button';planAction.addEventListener('click',()=>window.rcNavigation?.show('plan'));actions.append(primaryAction,planAction);
    sessionPanel.append(head,summary,prescription,note,actions);
    if(model.secondary.length){const secondary=element('div','today-secondary');secondary.append(element('small','today-secondary-title','ALTRE SEDUTE DI OGGI'));model.secondary.forEach(item=>secondary.append(secondaryRow(item)));sessionPanel.append(secondary);}
  }
  function renderSession(model){sessionPanel.replaceChildren();if(model.primary)renderPrimary(model);else renderNoSession(model);}

  function formatMinutes(total){const hours=Math.floor(total/60),minutes=total%60;return hours?`${hours}h ${String(minutes).padStart(2,'0')}`:`${minutes} min`;}
  function renderWeek(model){
    weekPanel.replaceChildren();const head=element('div','panel-head');head.append(element('h2','','Settimana'),element('span','muted',model.week.sessions?`${model.week.completedCount} di ${model.week.sessions} eseguite`:'Nessuna seduta'));weekPanel.append(head);
    const bars=element('div','week-bars');model.week.days.forEach(day=>{const column=element('div',day.isToday?'current':'');const label=element('span','week-bar-label',day.label);label.setAttribute('aria-hidden','true');const states=[];if(day.performed)states.push('performed');if(day.planned)states.push('planned');if(day.skipped)states.push('skipped');if(!states.length)states.push('empty');const bar=element('i',`${states.join(' ')}${states.length>1?' mixed':''}`);bar.style.setProperty('--h',`${day.height}%`);const parts=[];if(day.performed)parts.push(`${day.performed} svolta${day.performed===1?'':'e'} · carico interno ${day.load?`${day.load} AU`:'non disponibile'}`);if(day.planned)parts.push(`${day.planned} programmata${day.planned===1?'':'e'}`);if(day.skipped)parts.push(`${day.skipped} non svolta${day.skipped===1?'':'e'}`);const detail=parts.join(' · ')||'Nessuna seduta';const accessibleDetail=`${day.dayName}${day.isToday?', oggi':''}: ${detail}`;const track=element('span','week-bar-track');track.setAttribute('aria-hidden','true');track.append(bar);const tooltip=element('span','week-bar-tooltip',accessibleDetail);tooltip.setAttribute('aria-hidden','true');column.title=detail;column.tabIndex=0;column.setAttribute('aria-label',accessibleDetail);bar.setAttribute('aria-hidden','true');column.append(track,label,tooltip);bars.append(column);});weekPanel.append(bars);
    const legend=element('div','week-legend');[['performed','Svolta'],['planned','Programmata'],['skipped','Non svolta']].forEach(([state,label])=>{const item=element('span');item.append(element('i',state),document.createTextNode(label));legend.append(item);});weekPanel.append(legend,element('p','today-week-scale','Altezza: carico interno giornaliero (durata × RPE).'));
    const summary=element('div','summary-row');const distance=model.week.distanceKnown?`${model.week.runningDistance.toFixed(model.week.runningDistance%1?1:0)} km${model.week.distancePartial?' · parziale':''}`:'—';const values=[['Corsa',distance],['Forza',`${model.week.strengthCount} sedut${model.week.strengthCount===1?'a':'e'}`],['Tempo',model.week.actualMinutes?formatMinutes(model.week.actualMinutes):'—']];values.forEach(([label,value])=>{const item=element('span','',label);item.append(element('strong','',value));summary.append(item);});weekPanel.append(summary);
    let noteText='';
    if(model.week.pastUnrecorded)noteText=`${model.week.pastUnrecorded} sedut${model.week.pastUnrecorded===1?'a passata è':'e passate sono'} ancora da registrare.`;
    else if(!model.week.completedCount)noteText=model.week.sessions?'Le sedute programmate appariranno qui dopo la registrazione.':'Genera il piano per iniziare a costruire lo storico.';
    else if(model.load7.partial)noteText=`Carico parziale: ${model.load7.knownSessions}/${model.load7.sessions} sedute con durata e RPE completi.`;
    if(noteText)weekPanel.append(element('p','today-week-note',noteText));
  }
  function render(){const model=currentModel();renderMetrics(model);renderWhoopOverview(model);renderAdaptive(model);renderSession(model);renderWeek(model);const profile=safeDataset('profile',null),name=profile?.firstName&&profile.profileSetupComplete!==false?profile.firstName:'';window.rcNavigation?.setTitle('today',greeting(name));}

  ['rc:sessions-updated','rc:body-issues-updated','rc:pre-checkin-updated','rc:weekly-checkin-updated','rc:profile-updated','rc:whoop-updated','rc:whoop-sync-state','rc:data-restored'].forEach(name=>document.addEventListener(name,render));
  document.addEventListener('rc:view-changed',event=>{if(event.detail?.view==='today')render();});
  render();
})();
