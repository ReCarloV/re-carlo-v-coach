(function(){
  'use strict';

  const WEEKLY_KEY='rc-weekly-checkin-v1';
  const WEEKLY_HISTORY_KEY='rc-weekly-availability-history-v1';
  const PRE_KEY='rc-pre-session-checkins-v1';
  const modal=document.getElementById('generator-modal');
  const preview=document.getElementById('generator-preview');
  const categoryLabels={running:'CORSA',swimming:'NUOTO',cycling:'BICI',strength:'FORZA',hyrox:'HYROX SPEC',metcon:'METCON',test:'TEST',recovery:'RECUPERO'};
  const categoryClasses={running:'run',swimming:'swim',cycling:'bike',strength:'strength',hyrox:'hyrox',metcon:'metcon',test:'test',recovery:'rest'};
  const applicationModel=window.rcAdaptiveApplicationModel;
  const phaseModel=window.rcPhaseConstraintsModel;
  const athleteStateModel=window.rcAthleteStateModel;
  const strengthReliabilityModel=window.rcStrengthReliabilityModel;
  const weeklyRecapModel=window.rcWeeklyRecapModel;
  const adjustmentModel=window.rcWeeklyPlanAdjustmentModel;
  let proposal=null;

  function parse(key,fallback){try{const value=JSON.parse(localStorage.getItem(key));return value??fallback;}catch(_){return fallback;}}
  function dataset(name,fallback=[]){try{return window.rcDataStore?.getDataset(name)??fallback;}catch(_){return fallback;}}
  function iso(date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
  function localDate(){return iso(new Date());}
  function dateFor(start,index){const date=new Date(`${start}T12:00:00`);date.setDate(date.getDate()+index);return iso(date);}
  function addDays(value,days){const date=new Date(`${value}T12:00:00`);date.setDate(date.getDate()+days);return iso(date);}
  function mondayFor(value){const date=new Date(`${value}T12:00:00`);const day=date.getDay()||7;date.setDate(date.getDate()-day+1);return iso(date);}
  function isRace(item){return item?.details?.runType==='Race'||Boolean(item?.goalGenerated);}
  function isUserManual(item){return !item?.planImport&&!item?.coachPlan&&item?.generated!==true&&!String(item?.id||'').startsWith('sample-');}
  function lockedSessions(all,start,end,today){
    return all.filter(item=>item?.date>=start&&item.date<=end&&(item.outcome||item.date<=today||isUserManual(item)||isRace(item)||item.goalSubstitution));
  }
  function closestSlot(date,slots){
    return [...slots].sort((a,b)=>Math.abs(new Date(`${a.date}T12:00:00`)-new Date(`${date}T12:00:00`))-Math.abs(new Date(`${b.date}T12:00:00`)-new Date(`${date}T12:00:00`))||a.date.localeCompare(b.date))[0]||null;
  }
  function showToast(message='Piano adattato e salvato'){
    const node=document.getElementById('toast');if(!node)return;node.textContent=message;node.classList.add('show');setTimeout(()=>node.classList.remove('show'),1900);
  }

  function athleteStateFor(allSessions,today=localDate()){
    return athleteStateModel?.build?.({today,sessions:allSessions,activities:dataset('importedActivities'),whoopWorkouts:dataset('whoopWorkouts'),reconciliationDecisions:dataset('reconciliationDecisions'),bodyIssues:dataset('bodyIssues'),profile:dataset('profile',{}),goals:dataset('goals')})||null;
  }
  function adaptationFor(weekly,allSessions){
    const athleteState=athleteStateFor(allSessions);
    return window.rcAdaptiveEngine.analyze({sessions:allSessions,preCheckins:parse(PRE_KEY,[]),bodyIssues:dataset('bodyIssues'),whoopCycles:dataset('whoopCycles'),whoopSleeps:dataset('whoopSleeps'),whoopWorkouts:dataset('whoopWorkouts'),activities:dataset('importedActivities'),reconciliationDecisions:dataset('reconciliationDecisions'),profile:dataset('profile',{}),goals:dataset('goals'),athleteState,targetWeekStart:weekly.weekStart});
  }
  function phaseFor(weekly,allSessions,analysis){
    const goals=dataset('goals');
    if(!phaseModel||!window.rcGoalsModel)return{analysis,context:null};
    const goal=window.rcGoalsModel.classifyGoals(goals,weekly.weekStart).current;
    const context=phaseModel.forWeek({goal,weekStart:weekly.weekStart,sessions:allSessions,analysis});
    return{analysis:phaseModel.constrainAnalysis(analysis,context),context};
  }

  function buildCoachPlanWeek(input){
    const {weekly,sourceSessions,locked,activeLocked,available,analysis,phaseConstraints,requested,adaptedCount,adaptationPolicy}=input;
    const targetCount=Math.max(0,Math.min(sourceSessions.length,available.length,adaptedCount-activeLocked.length));
    const adjusted=adjustmentModel?.buildAdjustment?.({sessions:sourceSessions,analysis,targetCount,phaseConstraints,adaptationPolicy})||{sessions:sourceSessions,active:sourceSessions,paused:[],changed:0};
    const remaining=[...available],scheduled=[];
    adjusted.active.sort((a,b)=>a.date.localeCompare(b.date)).forEach(item=>{
      const slot=remaining.find(candidate=>candidate.date===item.date)||closestSlot(item.date,remaining);if(!slot)return;
      remaining.splice(remaining.indexOf(slot),1);
      scheduled.push(adjustmentModel?.withScheduledDate?.(item,slot.date,analysis)||{...item,date:slot.date});
    });
    const sessions=[...scheduled,...adjusted.paused].sort((a,b)=>a.date.localeCompare(b.date));
    const end=addDays(weekly.weekStart,6),alerts=[];
    const revision=sourceSessions[0]?.coachPlan?.revision||'attiva';
    const changes=[`La settimana mantiene la struttura della revisione ${revision} del piano Elite Coach.`];
    sessions.flatMap(item=>item.adaptiveAdjustment?.instructions||[]).forEach(item=>{if(!changes.includes(item))changes.push(item);});
    if(sourceSessions.length>available.length)alerts.push(`I giorni disponibili coprono ${available.length} delle ${sourceSessions.length} sedute previste: le voci meno prioritarie restano sospese nell’anteprima.`);
    if(locked.length)alerts.push(`${locked.length} voc${locked.length===1?'e protetta resta':'i protette restano'} intatt${locked.length===1?'a':'e'}: esiti, passato, sedute manuali e gare non vengono riscritti.`);
    const phaseAudit=phaseModel?.auditSessions([...activeLocked,...scheduled],phaseConstraints)||{warnings:[]};
    const concurrentAudit=strengthReliabilityModel?.auditConcurrentProximity([...activeLocked,...scheduled],{startDate:weekly.weekStart,endDate:end})||{conflicts:[]};
    alerts.push(...(phaseAudit.warnings||[]));
    concurrentAudit.conflicts.forEach(conflict=>alerts.push(`${conflict.message} ${conflict.guidance}`));
    return{weekly,sessions,lockedSessions:locked.sort((a,b)=>a.date.localeCompare(b.date)),alerts,analysis,phaseConstraints,phaseAudit,concurrentAudit,changes,requested,adaptedCount:scheduled.length+activeLocked.length,coachPlan:{planId:sourceSessions[0]?.coachPlan?.planId||null,revision:sourceSessions[0]?.coachPlan?.revision||null}};
  }

  function build(options={}){
    const latest=parse(WEEKLY_KEY,null),targetWeekStart=options.weekStart?mondayFor(options.weekStart):null;
    const stored=options.availability||(targetWeekStart?weeklyRecapModel?.availabilityForTarget?.(parse(WEEKLY_HISTORY_KEY,[]),latest,targetWeekStart):latest);
    if(!stored)return{missing:true,targetWeekStart};
    const weekly={...stored,weekStart:targetWeekStart||mondayFor(stored.weekStart)};
    const dayIndex={Lun:0,Mar:1,Mer:2,Gio:3,Ven:4,Sab:5,Dom:6};
    const allSessions=Array.isArray(options.sessions)?structuredClone(options.sessions):window.rcSessions.getAll();
    const phaseDecision=phaseFor(weekly,allSessions,adaptationFor(weekly,allSessions)),analysis=phaseDecision.analysis,phaseConstraints=phaseDecision.context;
    const selected=(weekly.days||[]).map(day=>({day,index:dayIndex[day],date:dateFor(weekly.weekStart,dayIndex[day])})).filter(item=>Number.isInteger(item.index)).sort((a,b)=>a.index-b.index);
    if(!selected.length)return{missingDays:true,weekly};
    const requested=Number(weekly.sessions)||5;
    const readinessCount=Math.max(1,Math.min(6,requested+analysis.settings.sessionDelta));
    const phaseCap=Number(phaseConstraints?.limits?.maxActiveSessions)||6;
    const adaptedCount=Math.min(readinessCount,phaseCap),end=addDays(weekly.weekStart,6),today=localDate();
    const locked=lockedSessions(allSessions,weekly.weekStart,end,today),activeLocked=locked.filter(item=>item.adaptiveAdjustment?.status!=='paused');
    const lockedDates=new Set(locked.map(item=>item.date)),available=selected.filter(slot=>slot.date>=today&&!lockedDates.has(slot.date)),lockedIds=new Set(locked.map(item=>item.id));
    const coachSources=allSessions.filter(item=>item.date>=weekly.weekStart&&item.date<=end&&item.coachPlan&&!lockedIds.has(item.id));
    if(coachSources.length){
      const planId=coachSources[0]?.coachPlan?.planId;
      const manifest=dataset('coachPlans',[]).find(item=>item.id===planId&&item.status==='active');
      return buildCoachPlanWeek({weekly,sourceSessions:coachSources,locked,activeLocked,available,analysis,phaseConstraints,requested,adaptedCount,adaptationPolicy:manifest?.adaptationPolicy||null});
    }
    const manifest=dataset('coachPlans',[]).filter(item=>item.status==='active'&&item.validFrom<=end&&item.validTo>=weekly.weekStart).sort((a,b)=>Number(b.revision)-Number(a.revision))[0]||null;
    return manifest?{noAdaptiveSessions:true,weekly,lockedSessions:locked,analysis,coachPlan:{planId:manifest.id,revision:manifest.revision}}:{missingCoachPlan:true,weekly,lockedSessions:locked,analysis};
  }

  function renderAdaptation(analysis){
    const box=document.getElementById('generator-adaptation');box.className=`generator-adaptation ${analysis.level}`;box.replaceChildren();
    const copy=document.createElement('div'),overline=document.createElement('small'),title=document.createElement('strong'),summary=document.createElement('p');
    overline.textContent='ADATTAMENTO LOCALE';title.textContent=analysis.label;summary.textContent=analysis.summary;copy.append(overline,title,summary);
    const metrics=document.createElement('div');metrics.className='generator-metrics';
    analysis.metrics.forEach(item=>{const chip=document.createElement('span');chip.className=item.tone;const label=document.createElement('small');label.textContent=item.label;const value=document.createElement('b');value.textContent=item.value;chip.append(label,value);metrics.append(chip);});
    box.append(copy,metrics);
  }
  function renderRow(item,preserved=false){
    const date=new Date(`${item.date}T12:00:00`),paused=item.adaptiveAdjustment?.status==='paused',adjusted=Boolean(item.adaptiveAdjustment),row=document.createElement('article');
    row.className=`generator-session${preserved?' preserved':''}${paused?' paused':''}${adjusted&&!paused?' adjusted':''}`;
    const dateBox=document.createElement('div');dateBox.className='generator-date';const day=document.createElement('small');day.textContent=date.toLocaleDateString('it-IT',{weekday:'short'}).replace('.','').toUpperCase();const number=document.createElement('strong');number.textContent=String(date.getDate()).padStart(2,'0');dateBox.append(day,number);
    const content=document.createElement('div'),title=document.createElement('h3'),reason=document.createElement('p'),today=localDate();title.textContent=item.title;
    reason.textContent=item.goalSubstitution?(item.adaptiveAdjustment?.instructions||[]).join(' '):preserved?(item.outcome?'Già registrata: l’adattamento non la modifica.':item.date<today?'Seduta passata mantenuta per permettere la registrazione.':item.date===today?'Seduta di oggi mantenuta senza modifiche.':'Seduta manuale mantenuta senza modifiche.'):adjusted?(item.adaptiveAdjustment.instructions||[]).join(' '):(item.rationale||'Prescrizione strutturata dal Coach.');content.append(title,reason);
    const tag=document.createElement('span');tag.className=`tag ${paused?'rest':preserved?'preserved':categoryClasses[item.category]||'rest'}`;tag.textContent=item.goalSubstitution?'SOSPESA · CONSERVATA':preserved?'MANTENUTA':paused?'SOSPESA':adjusted?'ADATTATA':categoryLabels[item.category]||String(item.category||'').toUpperCase();
    row.append(dateBox,content,tag);return row;
  }
  function renderRationale(current){
    const box=document.getElementById('generator-rationale');box.replaceChildren();const title=document.createElement('strong');title.textContent='Perché questo adattamento';const summary=document.createElement('p');summary.textContent=current.analysis.summary;const reasons=document.createElement('ul');current.analysis.reasons.forEach(reason=>{const item=document.createElement('li');item.textContent=reason;reasons.append(item);});const changes=document.createElement('div');changes.className='generator-changes';current.changes.forEach(change=>{const item=document.createElement('span');item.textContent=change;changes.append(item);});box.append(title,summary,reasons,changes);
  }
  function openProposal(options={}){
    proposal=build(options);
    if(proposal.missing){window.alert(proposal.targetWeekStart?'Non trovo la disponibilità salvata per questa settimana. Confermala per valutarne l’adattamento.':'Completa prima il check-in della settimana.');window.rcCheckins?.openWeekly?.(proposal.targetWeekStart?{weekStart:proposal.targetWeekStart}:{});return;}
    if(proposal.missingDays){window.alert('Seleziona almeno un giorno disponibile nel check-in settimanale.');return;}
    if(proposal.missingCoachPlan){window.alert('Non esiste un piano Elite Coach importato per questa settimana. Vai in Obiettivi per esportare il dossier iniziale o importare una revisione.');window.rcNavigation?.show('goals');return;}
    if(proposal.noAdaptiveSessions){window.alert('Non ci sono sedute future aperte della revisione importata da adattare in questa settimana.');return;}
    if(proposal.analysis?.settings?.suspendAllTraining){window.alert('L’app non adatta allenamenti ordinari mentre è presente un segnale cardiopolmonare recente. Il segnale non viene interpretato: richiedi una valutazione sanitaria prima di riprendere. Se è presente ora, intenso, improvviso o in peggioramento, chiama il 112.');return;}
    preview.replaceChildren();[...proposal.lockedSessions,...proposal.sessions].sort((a,b)=>a.date.localeCompare(b.date)).forEach(item=>preview.append(renderRow(item,proposal.lockedSessions.some(locked=>locked.id===item.id))));
    const active=proposal.sessions.filter(item=>item.adaptiveAdjustment?.status!=='paused').length,activeLocked=proposal.lockedSessions.filter(item=>item.adaptiveAdjustment?.status!=='paused').length,total=proposal.lockedSessions.length+proposal.sessions.length,paused=total-active-activeLocked;
    document.getElementById('generator-summary').textContent=`${total} voci · ${activeLocked+active} sedute attive${paused?` · ${paused} sospes${paused===1?'a':'e'}`:''} · settimana dal ${new Date(`${proposal.weekly.weekStart}T12:00:00`).toLocaleDateString('it-IT')} · adattamento della revisione ${proposal.coachPlan?.revision||'attiva'}`;
    renderAdaptation(proposal.analysis);
    ['generator-phase','generator-microcycle','generator-tolerance'].forEach(id=>{const node=document.getElementById(id);node.replaceChildren();node.hidden=true;});
    const alert=document.getElementById('generator-alert');alert.hidden=!proposal.alerts.length;alert.textContent=proposal.alerts.join(' ');renderRationale(proposal);modal.classList.add('open');modal.setAttribute('aria-hidden','false');
  }
  function close(){modal.classList.remove('open');modal.setAttribute('aria-hidden','true');}

  document.getElementById('generate-week').addEventListener('click',()=>openProposal());
  document.getElementById('generator-close').addEventListener('click',close);
  document.getElementById('generator-cancel').addEventListener('click',close);
  document.getElementById('generator-confirm').addEventListener('click',()=>{
    if(!proposal)return;
    const now=new Date(),receipt=applicationModel?.applicationFor?.(proposal.analysis,proposal.weekly.weekStart,now)||null;
    const sessions=applicationModel?.markSessions?applicationModel.markSessions(proposal.sessions,proposal.analysis,proposal.weekly.weekStart,now):proposal.sessions;
    window.rcSessions.replaceWeek(proposal.weekly.weekStart,sessions,{coachApplication:receipt});close();showToast();
  });
  document.addEventListener('rc:weekly-checkin-updated',()=>setTimeout(openProposal,0));
  window.rcGenerator={build,open:openProposal};
  setTimeout(()=>document.dispatchEvent(new CustomEvent('rc:generator-ready')),0);
})();
