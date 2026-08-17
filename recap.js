(function(){
  const modelApi=window.rcWeeklyRecapModel;const currentWeek=modelApi.mondayFor(localDate());let cursor=currentWeek;
  const toneClasses=['tone-good','tone-warn','tone-danger','tone-neutral'];

  function localDate(){const now=new Date();return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;}
  function element(tag,className,text){const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;}
  function safeDataset(name,fallback){try{return window.rcDataStore?.getDataset(name)??fallback;}catch(_){return fallback;}}
  function timestampDate(value){const date=new Date(value);return Number.isNaN(date.getTime())?null:localIso(date);}
  function localIso(date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
  function formatPeriod(start,end,short=false){
    const first=new Date(`${start}T12:00:00`),last=new Date(`${end}T12:00:00`);
    if(short)return `${first.toLocaleDateString('it-IT',{day:'numeric',month:'short'})} – ${last.toLocaleDateString('it-IT',{day:'numeric',month:'short'})}`;
    const sameMonth=first.getMonth()===last.getMonth();return sameMonth?`${first.getDate()}–${last.toLocaleDateString('it-IT',{day:'numeric',month:'long',year:'numeric'})}`:`${first.toLocaleDateString('it-IT',{day:'numeric',month:'short'})} – ${last.toLocaleDateString('it-IT',{day:'numeric',month:'short',year:'numeric'})}`;
  }
  function activeCoachPlanFor(weekStart){const end=modelApi.addDays(weekStart,6);return safeDataset('coachPlans',[]).filter(item=>item.status==='active'&&item.validFrom<=end&&item.validTo>=weekStart).sort((a,b)=>Number(b.revision)-Number(a.revision))[0]||null;}
  function reviewAssessment(){const exchange=window.rcCoachPlanExchange;if(exchange?.reviewAssessment)return exchange.reviewAssessment();const api=window.rcCoachPlanExchangeModel;if(!api)return null;return api.assessReviewNeed({goals:safeDataset('goals',[]),coachPlans:safeDataset('coachPlans',[]),sessions:window.rcSessions?.getAll?.()||safeDataset('sessions',[]),bodyIssues:safeDataset('bodyIssues',[]),preSessionCheckins:safeDataset('preSessionCheckins',[])},{today:localDate()});}
  function issuesAt(cutoff){
    return (window.rcBodyIssues?.all?.()||safeDataset('bodyIssues',[])).filter(issue=>{
      const started=timestampDate(issue.startedAt)||'0000-00-00',resolved=timestampDate(issue.resolvedAt);
      return started<=cutoff&&(!resolved||resolved>cutoff);
    }).map(issue=>{
      const readings=(Array.isArray(issue.history)?issue.history:[]).filter(entry=>(timestampDate(entry.date)||'9999-99-99')<=cutoff).sort((a,b)=>new Date(a.date)-new Date(b.date));
      return {...issue,latestPain:readings.length?Number(readings[readings.length-1].pain):Number(issue.initialPain)||0};
    });
  }
  function buildModel(weekStart){
    const sessions=window.rcSessions?.getAll?.()||safeDataset('sessions',[]);const preCheckins=window.rcCheckins?.getHistory?.()||safeDataset('preSessionCheckins',[]);
    const availabilityHistory=window.rcCheckins?.getAvailabilityHistory?.()||safeDataset('weeklyAvailabilityHistory',[]);const weeklyCheckin=safeDataset('weeklyCheckin',null);
    const weekEnd=modelApi.addDays(weekStart,6),isPast=weekEnd<localDate(),analysisDate=isPast?weekEnd:localDate();
    const rawAnalysis=window.rcAdaptiveEngine.analyze({today:analysisDate,closedThrough:isPast,sessions,preCheckins,bodyIssues:issuesAt(analysisDate),whoopCycles:safeDataset('whoopCycles',[]),whoopSleeps:safeDataset('whoopSleeps',[]),whoopWorkouts:safeDataset('whoopWorkouts',[]),activities:safeDataset('importedActivities',[]),reconciliationDecisions:safeDataset('reconciliationDecisions',[]),profile:safeDataset('profile',{}),goals:safeDataset('goals',[])});const targetWeek=modelApi.addDays(weekStart,7);const goal=window.rcGoalsModel?.classifyGoals(safeDataset('goals',[]),targetWeek)?.current||null;const phaseConstraints=window.rcPhaseConstraintsModel?.forWeek({goal,weekStart:targetWeek,sessions,analysis:rawAnalysis})||null;const analysis=window.rcPhaseConstraintsModel?.constrainAnalysis(rawAnalysis,phaseConstraints)||rawAnalysis;
    return modelApi.buildWeeklyRecap({today:localDate(),weekStart,sessions,preCheckins,availabilityHistory,weeklyCheckin,analysis,phaseConstraints});
  }
  function setMetric(valueId,noteId,value,note,tone='neutral'){
    const target=document.getElementById(valueId);target.textContent=value;target.classList.remove(...toneClasses);target.classList.add(`tone-${tone}`);document.getElementById(noteId).textContent=note;
  }
  function renderMetrics(model){
    const adherence=model.adherence===null?'—':`${Math.round(model.adherence*100)}%`;
    setMetric('recap-adherence','recap-adherence-note',adherence,model.keyDue.length?`${model.keyRecorded.length}/${model.keyDue.length} sedute chiave registrate`:'Nessuna seduta chiave ancora dovuta',model.adherence!==null&&model.adherence<.65?'warn':'neutral');
    setMetric('recap-load','recap-load-note',model.performed.length?`${Math.round(model.load)} AU`:'—',model.performed.length?`${model.performed.length} sedut${model.performed.length===1?'a svolta':'e svolte'}`:'Nessun esito utile al carico');
    setMetric('recap-pain','recap-pain-note',model.painKnown?`${model.maxPain}/10`:'—',model.painKnown?'Da esiti e check-in della settimana':'Nessuna valutazione disponibile',model.maxPain>=5?'danger':model.maxPain>=3?'warn':'neutral');
    const outcomeLabel=model.keyRecorded.length===1?'1 esito chiave':`${model.keyRecorded.length} esiti chiave`;
    setMetric('recap-confidence','recap-confidence-note',model.confidence.label,`${outcomeLabel} · ${model.subjective.count} check-in`,model.confidence.tone);
  }
  function renderCoach(model){
    const box=document.getElementById('recap-coach');box.replaceChildren();const head=element('div','panel-head');const copy=element('div');copy.append(element('small','','ANDAMENTO SETTIMANALE'),element('h2','',model.coach.title));const status=model.isCurrent?'IN CORSO':model.sessions.length?model.coach.title.toUpperCase():'NESSUN DATO';head.append(copy,element('span',`recap-status ${model.coach.tone}`,status));
    const summary=element('p','recap-coach-summary',model.coach.summary);const reasons=element('ul','recap-reasons');model.coach.reasons.forEach(reason=>reasons.append(element('li','',reason)));box.append(head,summary,reasons);
    if(model.isCurrent&&model.availability){const action=element('button','ghost','Ricalcola il resto della settimana');action.type='button';action.addEventListener('click',()=>window.rcGenerator?.open?.({weekStart:model.weekStart,mode:'review'}));box.append(action);}
  }
  function statCard(label,value,note=''){const card=element('div','recap-stat');card.append(element('small','',label),element('strong','',value));if(note)card.append(element('span','',note));return card;}
  function renderVolume(model){
    const box=document.getElementById('recap-volume');box.replaceChildren();box.append(element('h2','','Lavoro realmente svolto'));
    const stats=element('div','recap-stat-grid');const timeValue=model.actualMinutes?`${model.actualMinutes} min`:'—';const timeNote=model.plannedMinutes?`su ${model.plannedMinutes} min dovuti`:model.isCurrent?'Nessun minuto dovuto':'Nessun piano registrato';
    stats.append(statCard('Tempo',timeValue,timeNote),statCard('Sedute',`${model.performed.length}`,`${model.skipped.length} non svolte`),statCard('Corsa',model.distanceKnown?`${model.runningDistance.toFixed(model.runningDistance%1?1:0)} km${model.distancePartial?'*':''}`:'—',model.distancePartial?'Totale parziale':'Distanza registrata'),statCard('RPE medio',model.meanRpe===null?'—':model.meanRpe.toFixed(1),'Solo sedute svolte'));
    box.append(stats);const categories=element('div','recap-categories');Object.entries(model.categoryCounts).forEach(([key,count])=>categories.append(element('span','',`${model.categoryLabels[key]||key}: ${count}`)));if(!categories.childElementCount)categories.append(element('span','empty','Nessuna categoria ancora registrata.'));box.append(categories);
  }
  function subjectiveCard(label,value,scale){const shown=value===null?'—':value.toFixed(1);return statCard(label,shown,value===null?'Nessun dato':scale);}
  function renderSubjective(model){
    const box=document.getElementById('recap-subjective');box.replaceChildren();const head=element('div','panel-head');const copy=element('div');copy.append(element('h2','','Risposta soggettiva'),element('p','muted',model.subjective.count?`${model.subjective.count} check-in della settimana`:'Nessun check-in disponibile'));head.append(copy);box.append(head);
    if(!model.subjective.count){box.append(element('div','recap-empty','Le medie appariranno dopo i check-in collegati alle sedute.'));return;}
    const stats=element('div','recap-stat-grid subjective');stats.append(subjectiveCard('Energia',model.subjective.energy,'scala 1–5'),subjectiveCard('Fatica',model.subjective.fatigue,'scala 1–5'),subjectiveCard('Soreness',model.subjective.soreness,'scala 0–10'),subjectiveCard('Motivazione',model.subjective.motivation,'scala 1–5'));box.append(stats);
  }
  function delta(value){if(value===null||value===undefined)return'Baseline non disponibile';const rounded=Math.round(value);return`${rounded>0?'+':''}${rounded}% vs baseline personale`;}
  function renderRecovery(model){
    const box=document.getElementById('recap-recovery');box.replaceChildren();const recovery=model.recovery;box.hidden=!recovery?.usable;if(!recovery?.usable)return;const head=element('div','panel-head');const copy=element('div');copy.append(element('small','','DATI OSSERVATI'),element('h2','','Recupero WHOOP'));head.append(copy,element('span',`recap-status ${recovery.tone||'neutral'}`,recovery.label.toUpperCase()));box.append(head);
    const stats=element('div','recap-stat-grid');stats.append(statCard('Recovery medio',recovery.avgRecovery===null?'—':`${Math.round(recovery.avgRecovery)}%`,`${recovery.recentDays} giorni recenti`),statCard('HRV',recovery.avgHrv===null?'—':`${Math.round(recovery.avgHrv)} ms`,delta(recovery.hrvDeltaPct)),statCard('FC riposo',recovery.avgRestingHr===null?'—':`${Math.round(recovery.avgRestingHr)} bpm`,delta(recovery.restingHrDeltaPct)),statCard('Sonno',recovery.avgSleepHours===null?'—':`${recovery.avgSleepHours.toFixed(1)} h`,recovery.avgSleepPerformance===null?'Performance non disponibile':`performance ${Math.round(recovery.avgSleepPerformance)}%`));box.append(stats);
    const note=element('p','recap-recovery-note',recovery.usable?`Baseline: ${recovery.baselineDays} giorni · affidabilità ${recovery.confidence==='high'?'alta':'media'}. WHOOP viene usato come segnale di recupero, non come diagnosi e non decide da solo una sospensione.`:recovery.reasons[0]||'I dati restano visibili, ma non sono sufficienti per modificare il carico.');box.append(note);
  }
  function tolerancePanel(tolerance){
    if(!tolerance)return null;const panel=element('div','recap-tolerance');const copy=element('div');copy.append(element('small','','CONTROLLO DI TOLLERANZA'),element('strong','','Progressioni separate'),element('p','',tolerance.summary));const targets=element('div','recap-tolerance-targets');[tolerance.volume,tolerance.long].forEach(target=>{const card=element('span',target.allowed?'allowed':'hold');card.append(element('small','',target.label),element('b','',target.allowed?`AUTORIZZATO · +${Math.round((target.factor-1)*100)}%`:target.eligible&&target.phase?'MANTIENI · FASE':'MANTIENI'));targets.append(card);});const checks=element('div','recap-tolerance-checks');tolerance.checks.filter(item=>item.required).forEach(item=>{const chip=element('span',item.passed?'passed':'failed',`${item.passed?'✓':'–'} ${item.label}`);chip.title=item.detail;checks.append(chip);});panel.append(copy,targets,checks);return panel;
  }
  function renderNextPlan(model){
    const next=model.nextWeek,box=document.getElementById('recap-next-plan'),plan=activeCoachPlanFor(next.weekStart),weekEnd=modelApi.addDays(next.weekStart,6),allSessions=window.rcSessions?.getAll?.()||safeDataset('sessions',[]),planned=plan?allSessions.filter(item=>item.coachPlan?.planId===plan.id&&item.date>=next.weekStart&&item.date<=weekEnd):[];box.replaceChildren();
    const head=element('div','panel-head'),copy=element('div');copy.append(element('small','',plan?'ADATTAMENTO SETTIMANALE':'PIANO NON IMPORTATO'),element('h2','',`Settimana dal ${new Date(`${next.weekStart}T12:00:00`).toLocaleDateString('it-IT',{day:'numeric',month:'long'})}`));head.append(copy,element('span',`recap-status ${plan?next.tone:'warn'}`,plan?`REVISIONE ${plan.revision}`:'DA PREPARARE'));box.append(head);
    if(!plan){box.append(element('div','recap-empty','Per questa settimana non esiste una revisione importata. L’app non inventerà una struttura generica al posto del piano Elite Coach.'));const action=element('button','primary','Vai a Piano importato');action.type='button';action.addEventListener('click',()=>window.rcNavigation?.show('goals'));box.append(action);return;}
    const active=planned.filter(item=>item.adaptiveAdjustment?.status!=='paused'),minutes=active.reduce((sum,item)=>sum+(Number(item.durationMin)||0),0),key=active.filter(item=>item.priority==='essential').length,parameters=element('div','recap-plan-parameters');parameters.append(statCard('Sedute',String(active.length),`${planned.length-active.length} sospese`),statCard('Tempo previsto',`${minutes} min`,'Revisione importata'),statCard('Sedute chiave',String(key),'Priorità essenziale'),statCard('Revisione',String(plan.revision),plan.goalName));box.append(parameters);
    const changes=element('ul','recap-changes');if(['protect','reduce'].includes(next.level))next.changes.slice(0,4).forEach(change=>changes.append(element('li','',change)));else changes.append(element('li','','La struttura della revisione importata resta invariata; nessuna progressione viene aggiunta automaticamente.'));box.append(changes);
    if(!next.closure.ready){const count=next.closure.pending.length,lock=element('div','recap-plan-lock');lock.append(element('strong','',`Prima chiudi ${count===1?'la seduta restante':`le ${count} sedute restanti`}`),element('span','','Registra ogni esito come svolto, parziale o non svolto. L’adattamento userà la settimana completa senza cambiare la struttura del macroprogramma.'));box.append(lock);}
    const action=element('button','primary',next.closure.ready?'Conferma disponibilità e valuta adattamento':'Settimana ancora da completare');action.type='button';action.disabled=!next.closure.ready;action.addEventListener('click',()=>{if(!next.closure.ready)return;const source=next.source||safeDataset('goals',[]).find(item=>item.id===plan.goalId)?.trainingAvailability,values=source?{sessions:source.sessions,sessionMinutes:source.sessionMinutes,longRunMinutes:source.longRunMinutes,days:source.days,weekendLong:source.weekendLong,constraints:source.constraints}:{sessions:active.length||5,sessionMinutes:60,longRunMinutes:120};window.rcCheckins?.openWeekly?.({weekStart:next.weekStart,values});});box.append(action);
  }
  function renderReviewPrompt(){
    const box=document.getElementById('recap-coach-review'),review=reviewAssessment();box.replaceChildren();box.hidden=!review||!['due','recommended'].includes(review.level);if(box.hidden)return;box.className=`panel recap-coach-review ${review.level}`;const head=element('div','panel-head'),copy=element('div');copy.append(element('small','','REVISIONE DEL MACROPROGRAMMA'),element('h2','',review.label));head.append(copy,element('span',`recap-status ${review.level==='due'?'warn':'neutral'}`,review.level==='due'?'DA FARE':'CONSIGLIATA'));box.append(head,element('p','recap-review-summary',review.summary));const reasons=element('ul','recap-changes');review.reasons.slice(0,2).forEach(reason=>reasons.append(element('li','',reason)));box.append(reasons);const action=element('button','primary','Esporta dossier di revisione');action.type='button';action.addEventListener('click',()=>window.rcCoachPlanExchange?.exportBrief?.());box.append(action);
  }
  function historyStarts(){
    const sessions=window.rcSessions?.getAll?.()||safeDataset('sessions',[]);const availability=window.rcCheckins?.getAvailabilityHistory?.()||safeDataset('weeklyAvailabilityHistory',[]);
    const starts=[currentWeek,cursor,...sessions.map(item=>modelApi.mondayFor(item.date)),...availability.map(item=>item.weekStart)].filter(Boolean);
    return [...new Set(starts)].sort((a,b)=>b.localeCompare(a));
  }
  function renderHistory(){
    const container=document.getElementById('recap-history');container.replaceChildren();historyStarts().map(start=>buildModel(start)).filter(model=>model.weekStart===currentWeek||model.sessions.length||model.availability).forEach(model=>{
      const button=element('button',`recap-history-card${model.weekStart===cursor?' active':''}`);button.type='button';const copy=element('span');const period=model.isCurrent?'SETTIMANA ATTUALE':formatPeriod(model.weekStart,model.weekEnd,true);copy.append(element('small','',`${period}${model.demoCount?' · DEMO':''}`),element('strong','',model.coach.title));const metrics=element('span','recap-history-metrics');metrics.append(element('b','',model.adherence===null?'—':`${Math.round(model.adherence*100)}%`),element('em','',model.performed.length?`${Math.round(model.load)} AU`:'nessun esito'));button.append(copy,metrics);button.addEventListener('click',()=>{cursor=model.weekStart;render();});container.append(button);
    });
    if(!container.childElementCount)container.append(element('div','recap-empty','Lo storico comparirà quando verrà programmata o registrata una settimana.'));
  }
  function render(){
    const model=buildModel(cursor);document.getElementById('recap-period').textContent=`${formatPeriod(model.weekStart,model.weekEnd)}${model.isCurrent?' · settimana in corso':''}${model.demoCount?' · dati dimostrativi':''}`;document.getElementById('recap-period').classList.toggle('recap-demo-note',Boolean(model.demoCount));document.getElementById('recap-next').disabled=cursor>=currentWeek;
    renderMetrics(model);renderCoach(model);renderVolume(model);renderSubjective(model);renderRecovery(model);renderNextPlan(model);renderReviewPrompt();renderHistory();
  }

  document.getElementById('recap-prev').addEventListener('click',()=>{cursor=modelApi.addDays(cursor,-7);render();});
  document.getElementById('recap-next').addEventListener('click',()=>{if(cursor<currentWeek){cursor=modelApi.addDays(cursor,7);render();}});
  document.getElementById('recap-current').addEventListener('click',()=>{cursor=currentWeek;render();});
  ['rc:sessions-updated','rc:pre-checkin-updated','rc:weekly-checkin-updated','rc:weekly-availability-history-updated','rc:body-issues-updated','rc:whoop-updated','rc:data-restored','rc:coach-plan-updated','rc:goals-updated'].forEach(name=>document.addEventListener(name,render));
  document.addEventListener('rc:view-changed',event=>{if(event.detail?.view==='recap')render();});
  window.rcRecap={render,openWeek:weekStart=>{cursor=modelApi.mondayFor(weekStart);window.rcNavigation?.show('recap');render();}};
  render();
})();
