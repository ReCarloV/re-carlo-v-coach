(function () {
  const STORAGE_KEY = 'rc-training-sessions-v1';
  const VIEW_KEY = 'rc-plan-view-v1';
  const categoryMeta = {
    running:{ label:'CORSA', css:'run' }, swimming:{ label:'NUOTO', css:'swim' }, cycling:{ label:'BICI', css:'bike' },
    strength:{ label:'FORZA', css:'strength' }, hyrox:{ label:'HYROX SPEC', css:'hyrox' },
    metcon:{ label:'METCON', css:'metcon' }, test:{ label:'TEST', css:'test' }, recovery:{ label:'RECUPERO', css:'rest' }
  };
  const priorityMeta = { essential:'Essenziale', important:'Importante', optional:'Opzionale' };
  const outcomeMeta = {
    completed:{ label:'Svolta',symbol:'✓' }, partial:{ label:'Parziale',symbol:'◐' }, skipped:{ label:'Non svolta',symbol:'–' }
  };
  const plannedOutcomeMeta = { label:'Programmata',symbol:'○' };
  const pausedOutcomeMeta = { label:'Sospesa dal coach',symbol:'Ⅱ' };
  const skipReasonModel=window.rcSkipReasonModel;
  const defaults = [];
  const selectionModel=window.rcSessionSelectionModel;
  const strengthModel=window.rcStrengthPerformanceModel;
  const executionModel=window.rcExecutionEvidenceModel;
  const adjustmentModel=window.rcWeeklyPlanAdjustmentModel;
  const planViewModel=window.rcPlanViewModel;
  const goalsModel=window.rcGoalsModel;
  const prescriptionModel=window.rcSessionPrescriptionModel;
  let sessions = load();
  let planView = localStorage.getItem(VIEW_KEY) === 'calendar' ? 'calendar' : 'list';
  let calendarCursor = relevantCalendarMonth();
  let listWeekStart = planViewModel.mondayFor(localDate());
  let selectionMode=false;
  let selectedIds=new Set();
  let calendarDrag=null;
  let suppressCalendarClickUntil=0;
  let calendarToastTimer=null;
  const modal = document.getElementById('session-modal');
  const form = document.getElementById('session-form');
  const outcomeModal = document.getElementById('outcome-modal');
  const outcomeForm = document.getElementById('outcome-form');
  const categoryInput = document.getElementById('session-category');
  const runTargetInput = document.getElementById('run-target');
  const titleInput = document.getElementById('session-title');
  let titleMode = 'auto';
  let currentEvidenceIndex=new Map();
  let activeOutcomeEvidence=null;
  let activeActualEnduranceBlocks=[];
  const builderFields = {
    swimming:[['name','Blocco','Es. Tecnica assetto'],['volume','Volume','10 min / 8 × 50 m'],['target','Target','RPE 5 · tecnica'],['rest','Recupero','20 s']],
    strength:[['name','Esercizio','Es. Bench press'],['sets','Serie','4'],['reps','Ripetizioni','5'],['loadKg','Carico previsto (kg)','80'],['target','Target','RIR 2 / 80% 1RM'],['rest','Recupero','2 min']],
    hyrox:[['name','Blocco / stazione','Es. Sled push'],['volume','Volume','4 × 25 m'],['target','Target','RPE 8'],['rest','Recupero','90 s']],
    metcon:[['name','Blocco / movimento','Es. Row'],['volume','Volume','12 cal'],['target','Target','RPE 8'],['rest','Recupero','30 s']]
  };
  const builderInputNames = {swimming:'swimStructuredBlocks',strength:'strengthBlocks',hyrox:'hyroxStructuredBlocks',metcon:'metconStructuredBlocks'};
  const strengthExerciseLibrary = ['Back Squat','Barbell Row','Bench Press','Bulgarian Split Squat','Deadlift','Front Squat','Hip Thrust','Incline Bench Press','Military Press','Romanian Deadlift','Trap Bar Deadlift','Weighted Chin-up','Weighted Pull-up'];

  function migrateSession(session) {
    const d = { ...(session.details || {}) };
    const runTypes = {Facile:'Easy run',Lungo:'Long run',Recupero:'Recovery run','Tempo / soglia':'Tempo / Threshold',Intervalli:'Intervals',Progressivo:'Progression run',Gara:'Race'};
    const rideTypes = {Endurance:'Endurance ride',Recupero:'Recovery ride',Tempo:'Tempo ride',Soglia:'Threshold ride',VO2max:'VO2max bike'};
    const hyroxTypes = {'Engine / conditioning':'HYROX engine','Stazioni tecniche':'HYROX stations','Simulation parziale':'HYROX partial simulation','Simulation completa':'HYROX full simulation'};
    if (runTypes[d.runType]) d.runType = runTypes[d.runType];
    if (rideTypes[d.rideType]) d.rideType = rideTypes[d.rideType];
    if (d.strengthFocus === 'Forza HYROX') d.strengthFocus = 'HYROX strength';
    if (hyroxTypes[d.hyroxFormat]) d.hyroxFormat = hyroxTypes[d.hyroxFormat];
    const outcome = session.outcome && outcomeMeta[session.outcome.status] ? session.outcome : null;
    const migrated={...session,details:d,outcome,titleMode:session.titleMode || 'custom'};return window.rcPlanImportModel?.migrateImportedRaceDate?window.rcPlanImportModel.migrateImportedRaceDate(migrated):migrated;
  }
  function load() {
    try {
      const stored=JSON.parse(localStorage.getItem(STORAGE_KEY)),migrated=(Array.isArray(stored)?stored:structuredClone(defaults)).map(migrateSession);
      const enriched=prescriptionModel?.enrichSessions?.(migrated,{...prescriptionContext(),today:localDate(),generatedOnly:true});
      if(enriched?.changed)localStorage.setItem(STORAGE_KEY,JSON.stringify(enriched.sessions));
      return enriched?.sessions||migrated;
    }
    catch (_) { return structuredClone(defaults).map(migrateSession); }
  }
  function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions)); }
  function athleteProfile(){try{return JSON.parse(localStorage.getItem('rc-athlete-profile-v1'))||{};}catch(_){return{};}}
  function prescriptionContext(){
    let goals=[],hrZones=null;
    try{goals=JSON.parse(localStorage.getItem('rc-goals-v1'))||[];}catch(_){}
    try{hrZones=JSON.parse(localStorage.getItem('rc-hr-zones'));}catch(_){}
    return{profile:athleteProfile(),goals,hrZones};
  }
  function readEvidenceIndex(){
    if(!executionModel||!window.rcDataStore)return new Map();
    try{return executionModel.buildEvidenceIndex(sessions,{decisions:window.rcDataStore.getDataset('reconciliationDecisions'),stravaActivities:window.rcDataStore.getDataset('importedActivities'),whoopWorkouts:window.rcDataStore.getDataset('whoopWorkouts')});}
    catch(_){return new Map();}
  }
  function localDate() {
    const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  }
  function isPaused(session){return session?.adaptiveAdjustment?.status==='paused'&&!session.outcome;}
  function canRecordOutcome(session) { return Boolean(session?.date) && session.date <= localDate()&&!isPaused(session); }
  function outcomeLockedMessage(session) {
    if(isPaused(session))return'La seduta è sospesa dalla proposta adattiva. Ripristina il piano Excel o modifica la seduta prima di registrarla.';
    const date = new Date(`${session.date}T12:00:00`);
    return `Il check-in post-allenamento sarà disponibile dal ${date.toLocaleDateString('it-IT',{day:'numeric',month:'long',year:'numeric'})}.`;
  }
  function athleteFtp() {
    try { return Number(JSON.parse(localStorage.getItem('rc-athlete-profile-v1')).ftp) || null; } catch (_) { return null; }
  }
  function athleteHrTargets() {
    let profile={maxHr:0,restingHr:0,hrZoneMethod:'hrr'};
    try { profile={...profile,...JSON.parse(localStorage.getItem('rc-athlete-profile-v1'))}; } catch (_) {}
    let upper;
    try { upper=JSON.parse(localStorage.getItem('rc-hr-zones')); } catch (_) {}
    const result=window.rcTrainingZonesModel.hrZones({maxHr:profile.maxHr,restingHr:profile.restingHr,method:profile.hrZoneMethod,customUpper:upper});
    return result.zones.map(zone=>({value:`${zone.id} · ${zone.min}–${zone.max} bpm`,label:`${zone.id}  ${zone.min}–${zone.max} bpm`}));
  }
  function targetText(session) {
    const d = session.details || {};
    if (session.category === 'running') {
      let target = d.hrZone || '';
      if (d.runTarget === 'pace') target = `${d.paceMin}:${String(d.paceSec || 0).padStart(2,'0')}/km`;
      if (d.runTarget === 'rpe') target = `RPE ${d.runRpe}`;
      const phases=Array.isArray(d.runBlocks)?d.runBlocks.reduce((sum,item)=>sum+(item.type==='repeat'?(Number(item.repeats)||1)*(item.steps?.length||0):1),0):0;
      return [`${session.durationMin} min`, d.distanceKm ? `${d.distanceKm} km` : '', d.runType, target,phases?`${phases} fasi programmate`:''].filter(Boolean).join(' · ');
    }
    if (session.category === 'cycling') {
      const ftp = athleteFtp(); const hasFtp=Number(d.ftpMin)>0&&Number(d.ftpMax)>0;const ftpRange=hasFtp?`${d.ftpMin}–${d.ftpMax}% FTP`:'';const watts = hasFtp&&ftp ? `${Math.round(ftp*d.ftpMin/100)}–${Math.round(ftp*d.ftpMax/100)} W` : '';
      const phases=Array.isArray(d.rideBlocks)?d.rideBlocks.reduce((sum,item)=>sum+(item.type==='repeat'?(Number(item.repeats)||1)*(item.steps?.length||0):1),0):0;
      const brick=d.brickRun?`poi corsa ${d.brickRun.durationMin} min · ${d.brickRun.target}`:'';
      return [`${session.durationMin} min`,d.rideType,ftpRange,watts,d.cadence ? `${d.cadence} rpm` : '',phases?`${phases} fasi programmate`:'',brick,d.powerSource].filter(Boolean).join(' · ');
    }
    if (session.category === 'swimming') return [`${session.durationMin} min`,d.swimDistanceM?`${d.swimDistanceM} m`:'',d.swimType,d.swimRpe?`RPE ${d.swimRpe}`:'',Array.isArray(d.swimStructuredBlocks)&&d.swimStructuredBlocks.length?`${d.swimStructuredBlocks.length} blocchi`:'' ].filter(Boolean).join(' · ');
    if (session.category === 'strength') {
      const exercises = Array.isArray(d.strengthBlocks) ? d.strengthBlocks.slice(0,3).map(item => [item.name,item.sets && item.reps ? `${item.sets}×${item.reps}` : '',item.loadKg!==''&&item.loadKg!==null&&item.loadKg!==undefined?`@ ${item.loadKg} kg`:null].filter(Boolean).join(' ')).join(' · ') : String(d.exercises || '').split('\n').map(item => item.trim()).filter(Boolean).slice(0,3).join(' · ');
      return [`${session.durationMin} min`,d.strengthFocus,d.targetRir !== '' ? `RIR ${d.targetRir}` : '',exercises].filter(Boolean).join(' · ');
    }
    if (session.category === 'hyrox') return [`${session.durationMin} min`,d.hyroxFormat,d.hyroxRpe ? `RPE ${d.hyroxRpe}` : '',Array.isArray(d.hyroxStructuredBlocks)&&d.hyroxStructuredBlocks.length ? `${d.hyroxStructuredBlocks.length} blocchi` : ''].filter(Boolean).join(' · ');
    if (session.category === 'metcon') return [`${session.durationMin} min`,d.metconType,d.metconRpe ? `RPE ${d.metconRpe}` : '',Array.isArray(d.metconStructuredBlocks)&&d.metconStructuredBlocks.length ? `${d.metconStructuredBlocks.length} blocchi` : ''].filter(Boolean).join(' · ');
    if (session.category === 'test') return [`${session.durationMin} min`,d.testType,d.testRpe ? `RPE max ${d.testRpe}` : ''].filter(Boolean).join(' · ');
    return [`${session.durationMin} min`,d.recoveryType].filter(Boolean).join(' · ');
  }
  function dateKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  }
  function relevantCalendarMonth() {
    const today = localDate();
    const upcoming = sessions.filter(item => item.date >= today).sort((a,b) => a.date.localeCompare(b.date));
    const fallback = [...sessions].sort((a,b) => b.date.localeCompare(a.date))[0];
    const relevant = upcoming[0] || fallback;
    const date = relevant ? new Date(`${relevant.date}T12:00:00`) : new Date();
    return new Date(date.getFullYear(),date.getMonth(),1);
  }
  function sessionsInCurrentMonth() {
    const prefix=`${calendarCursor.getFullYear()}-${String(calendarCursor.getMonth()+1).padStart(2,'0')}`;
    return sessions.filter(session=>session.date.startsWith(prefix));
  }
  function sessionsInCurrentWeek(){return planViewModel.sessionsForWeek(sessions,listWeekStart);}
  function sessionsInVisiblePeriod(){return planView==='calendar'?sessionsInCurrentMonth():sessionsInCurrentWeek();}
  function setSelectionMode(active){selectionMode=Boolean(active);if(!selectionMode)selectedIds.clear();render();}
  function toggleSelection(id){selectedIds=selectionModel.toggle(selectedIds,id);render();}
  function renderSelectionBar(periodSessions){
    selectedIds=selectionModel.prune(selectedIds,sessions);const count=selectedIds.size;const button=document.getElementById('select-sessions');const bar=document.getElementById('session-selection-bar');
    button.classList.toggle('active',selectionMode);button.textContent=selectionMode?'Fine selezione':'Seleziona';button.disabled=!selectionMode&&!periodSessions.length;bar.hidden=!selectionMode;
    document.getElementById('session-selection-count').textContent=count===1?'1 seduta selezionata':`${count} sedute selezionate`;
    document.getElementById('delete-selected-sessions').disabled=count===0;document.getElementById('clear-session-selection').disabled=count===0;const selectAll=document.getElementById('select-month-sessions');selectAll.disabled=!periodSessions.length;selectAll.textContent=planView==='calendar'?'Seleziona tutto il mese':'Seleziona tutta la settimana';
  }
  function renderPeriodSummary(periodSessions) {
    document.getElementById('calendar-month-label').textContent=planView==='calendar'?calendarCursor.toLocaleDateString('it-IT',{month:'long',year:'numeric'}):planViewModel.weekLabel(listWeekStart);
    document.getElementById('month-total-count').textContent=periodSessions.length;
    document.getElementById('month-completed-count').textContent=periodSessions.filter(session=>['completed','partial'].includes(session.outcome?.status)).length;
    document.getElementById('month-running-count').textContent=periodSessions.filter(session=>session.category==='running').length;
    document.getElementById('month-strength-count').textContent=periodSessions.filter(session=>session.category==='strength').length;
    document.getElementById('month-bonus-count').textContent=periodSessions.filter(session=>session.priority==='optional').length;
    document.getElementById('calendar-prev').setAttribute('aria-label',planView==='calendar'?'Mese precedente':'Settimana precedente');document.getElementById('calendar-next').setAttribute('aria-label',planView==='calendar'?'Mese successivo':'Settimana successiva');
  }
  function outcomeSummary(session) {
    const outcome=session.outcome;if(!outcome)return '';
    if(outcome.status==='skipped')return `Non svolta · ${outcome.skipReason?skipReasonModel.label(outcome.skipReason):'Motivo non specificato'}`;
    const strengthSets=Array.isArray(outcome.strengthPerformance)?outcome.strengthPerformance.length:0;
    const durationKnown=outcome.actualDurationMin!==null&&outcome.actualDurationMin!==undefined;const rpeKnown=outcome.rpe!==null&&outcome.rpe!==undefined;const painKnown=outcome.pain!==null&&outcome.pain!==undefined;
    return [durationKnown?`${outcome.actualDurationMin} min reali`:'',outcome.actualDistanceKm?`${outcome.actualDistanceKm} km`:'',rpeKnown?`RPE ${outcome.rpe}`:'',durationKnown&&rpeKnown?`carico ${outcome.sessionLoad} AU`:'',painKnown?`dolore ${outcome.pain}/10`:'',strengthSets?`${strengthSets} ${strengthSets===1?'set principale':'set principali'}`:''].filter(Boolean).join(' · ');
  }
  function evidenceSourceLabel(evidence){return[evidence?.stravaActivityId?'Strava':null,evidence?.whoopWorkoutId?'WHOOP':null].filter(Boolean).join(' + ');}
  function showCalendarMessage(message){const live=document.getElementById('calendar-move-status');if(live)live.textContent=message;const node=document.getElementById('toast');if(!node)return;clearTimeout(calendarToastTimer);node.textContent=message;node.classList.add('show');calendarToastTimer=setTimeout(()=>{node.classList.remove('show');node.textContent='Salvato sul dispositivo';},2200);}
  function removeCalendarDragListeners(){window.removeEventListener('mousemove',onCalendarMouseMove,true);window.removeEventListener('mouseup',onCalendarMouseUp,true);window.removeEventListener('touchmove',onCalendarTouchMove,true);window.removeEventListener('touchend',onCalendarTouchEnd,true);window.removeEventListener('touchcancel',clearCalendarDrag,true);}
  function clearCalendarDrag(){removeCalendarDragListeners();calendarDrag=null;document.getElementById('plan-calendar')?.classList.remove('calendar-drag-active');document.querySelectorAll('.calendar-day.drop-target,.calendar-event.dragging').forEach(node=>node.classList.remove('drop-target','dragging'));}
  function updateCalendarDropTarget(clientX,clientY){document.querySelectorAll('.calendar-day.drop-target').forEach(node=>node.classList.remove('drop-target'));const cell=document.elementFromPoint(clientX,clientY)?.closest?.('.calendar-day');const targetDate=cell?.dataset.date;if(!calendarDrag||!targetDate||targetDate===calendarDrag.sourceDate){if(calendarDrag)calendarDrag.targetDate=null;return;}cell.classList.add('drop-target');calendarDrag.targetDate=targetDate;}
  function startCalendarDrag(session,button,clientX,clientY){calendarDrag={sessionId:session.id,sourceDate:session.date,startX:clientX,startY:clientY,targetDate:null,active:false,button};}
  function moveCalendarDrag(clientX,clientY,event){const drag=calendarDrag;if(!drag)return;if(!drag.active&&Math.hypot(clientX-drag.startX,clientY-drag.startY)<7)return;if(!drag.active){drag.active=true;drag.button.classList.add('dragging');document.getElementById('plan-calendar')?.classList.add('calendar-drag-active');}event.preventDefault();updateCalendarDropTarget(clientX,clientY);}
  function finishCalendarDrag(event){const drag=calendarDrag;if(!drag)return;const targetDate=drag.targetDate,active=drag.active,sessionId=drag.sessionId;if(active){event.preventDefault();suppressCalendarClickUntil=Date.now()+500;}clearCalendarDrag();if(active&&targetDate)moveCalendarSession(sessionId,targetDate);}
  function startCalendarMouseDrag(event,session,button){if(event.button!==0)return;startCalendarDrag(session,button,event.clientX,event.clientY);window.addEventListener('mousemove',onCalendarMouseMove,true);window.addEventListener('mouseup',onCalendarMouseUp,true);}
  function onCalendarMouseMove(event){moveCalendarDrag(event.clientX,event.clientY,event);}
  function onCalendarMouseUp(event){finishCalendarDrag(event);}
  function startCalendarTouchDrag(event,session,button){const touch=event.touches?.[0];if(!touch)return;startCalendarDrag(session,button,touch.clientX,touch.clientY);window.addEventListener('touchmove',onCalendarTouchMove,{capture:true,passive:false});window.addEventListener('touchend',onCalendarTouchEnd,true);window.addEventListener('touchcancel',clearCalendarDrag,true);}
  function onCalendarTouchMove(event){const touch=event.touches?.[0];if(touch)moveCalendarDrag(touch.clientX,touch.clientY,event);}
  function onCalendarTouchEnd(event){finishCalendarDrag(event);}
  function calendarMoveOptions(session,evidence=currentEvidenceIndex.get(session?.id)){return{hasEvidence:Boolean(evidence),isRace:Boolean(goalsModel?.isRaceSession?.(session))};}
  function moveCalendarSession(sessionId,targetDate,{restoreFocus=false}={}){
    const session=sessions.find(item=>String(item.id)===String(sessionId));const options=calendarMoveOptions(session);const result=planViewModel.moveSessionDate(sessions,sessionId,targetDate,{...options,now:new Date().toISOString()});
    if(!result.changed){if(result.policy?.code!=='same-date')showCalendarMessage(result.policy?.message||'La seduta non può essere spostata.');return false;}
    sessions=result.sessions;const date=new Date(`${targetDate}T12:00:00`);if(date.getMonth()!==calendarCursor.getMonth()||date.getFullYear()!==calendarCursor.getFullYear())calendarCursor=new Date(date.getFullYear(),date.getMonth(),1);save();render();const message=`${result.session.title} spostata a ${date.toLocaleDateString('it-IT',{weekday:'short',day:'numeric',month:'short'})}.`;showCalendarMessage(message);document.dispatchEvent(new CustomEvent('rc:sessions-updated',{detail:{reason:'session-date-moved',sessionId:result.session.id,previousDate:result.previousDate,date:targetDate}}));if(restoreFocus)setTimeout(()=>[...document.querySelectorAll('.calendar-event')].find(node=>node.dataset.sessionId===String(sessionId))?.focus(),0);return true;
  }
  function renderCalendar() {
    const grid = document.getElementById('calendar-grid'); grid.replaceChildren();
    const first = new Date(calendarCursor.getFullYear(),calendarCursor.getMonth(),1);
    const offset = (first.getDay()+6)%7;
    const start = new Date(first); start.setDate(first.getDate()-offset);
    const today = localDate();
    const grouped = sessions.reduce((map,session) => { (map[session.date] ||= []).push(session); return map; },{});
    let goals=[];try{goals=window.rcDataStore?.getDataset('goals')||[];}catch(_){}const goalsByDate=goals.filter(goal=>goal.status!=='cancelled').reduce((map,goal)=>{(map[goal.date]||=[]).push(goal);return map;},{});
    for (let index=0;index<42;index++) {
      const date = new Date(start); date.setDate(start.getDate()+index); const key=dateKey(date);
      const items=(grouped[key]||[]).sort((a,b)=>a.title.localeCompare(b.title,'it'));
      const raceGoals=goalsByDate[key]||[];
      const cell=document.createElement('div'); cell.className='calendar-day';cell.dataset.date=key;
      if(date.getMonth()!==calendarCursor.getMonth())cell.classList.add('other-month');
      if(key===today)cell.classList.add('today');
      if(raceGoals.length)cell.classList.add('race-day');
      const head=document.createElement('div');head.className='calendar-day-head';
      const number=document.createElement('span');number.className='calendar-day-number';number.textContent=date.getDate();
      const activeCount=items.filter(session=>!isPaused(session)).length;const count=document.createElement('span');count.className='calendar-day-count';count.textContent=activeCount>1?`${activeCount} sedute`:'';
      head.append(number,count);cell.append(head);
      if(raceGoals.length){const race=document.createElement('button');race.type='button';race.className='calendar-race-marker';race.setAttribute('aria-label',`Race day: ${raceGoals.map(goal=>goal.name).join(', ')}`);const label=document.createElement('span');label.textContent='⚑ RACE DAY';const name=document.createElement('strong');name.textContent=raceGoals.map(goal=>goal.name).join(' · ');race.append(label,name);race.addEventListener('click',()=>window.rcNavigation?.show('goals'));cell.append(race);}
      const events=document.createElement('div');events.className='calendar-events';
      items.forEach(session=>{
        const meta=categoryMeta[session.category],outcome=session.outcome,paused=isPaused(session),evidence=!paused?currentEvidenceIndex.get(session.id):null,status=outcome?outcomeMeta[outcome.status]:paused?pausedOutcomeMeta:evidence?{label:'Dati collegati',symbol:'◆'}:plannedOutcomeMeta;
        const movePolicy=planViewModel.calendarMovePolicy(session,calendarMoveOptions(session,evidence));const compactCalendar=window.matchMedia?.('(max-width: 620px) and (orientation: portrait)').matches;const movable=movePolicy.allowed&&!selectionMode&&!compactCalendar;const selected=selectedIds.has(String(session.id));const button=document.createElement('button');button.type='button';button.className=`calendar-event ${meta.css} priority-${session.priority} outcome-${outcome?.status||(paused?'paused':evidence?'observed':'planned')}${selectionMode?' selection-mode':''}${selected?' selected':''}${movable?' calendar-event-movable':' calendar-event-locked'}`;button.dataset.sessionId=session.id;button.dataset.sessionDate=session.date;button.draggable=false;
        if(evidence)button.classList.add('has-observed-data');
        button.title=`${session.title} · ${outcome?outcomeSummary(session):targetText(session)} · ${movePolicy.message}`;
        button.setAttribute('aria-label',`${session.title}, ${date.toLocaleDateString('it-IT')}, ${status.label}${evidence?`, dati ${evidenceSourceLabel(evidence)} collegati`:''}${movable?', trascinabile su un altro giorno':''}`);
        if(movable){button.setAttribute('aria-keyshortcuts','Alt+ArrowLeft Alt+ArrowRight Alt+ArrowUp Alt+ArrowDown');button.setAttribute('aria-roledescription','seduta trascinabile');button.addEventListener('mousedown',event=>startCalendarMouseDrag(event,session,button));button.addEventListener('touchstart',event=>startCalendarTouchDrag(event,session,button),{passive:true});button.addEventListener('keydown',event=>{if(!event.altKey)return;const delta={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7}[event.key];if(!delta)return;event.preventDefault();moveCalendarSession(session.id,planViewModel.addDays(session.date,delta),{restoreFocus:true});});}
        if(selectionMode)button.setAttribute('aria-pressed',String(selected));
        const category=document.createElement('span');category.className='calendar-event-category';category.textContent=`${session.demoDataset?'DEMO · ':''}${status.symbol} ${paused?'SOSPESA':meta.label}`;
        const title=document.createElement('span');title.className='calendar-event-title';title.textContent=session.title;
        const duration=document.createElement('span');duration.className='calendar-event-duration';duration.textContent=outcome?.actualDurationMin?`${outcome.actualDurationMin} min reali`:evidence?.prefill.actualDurationMin?`${evidence.prefill.actualDurationMin} min osservati`:`${session.durationMin} min`;
        button.append(category,title,duration);if(evidence){const linked=document.createElement('span');linked.className='calendar-event-linked';linked.textContent='◆';linked.title=`Dati ${evidenceSourceLabel(evidence)} collegati`;button.append(linked);}button.addEventListener('click',()=>{if(Date.now()<suppressCalendarClickUntil)return;selectionMode?toggleSelection(session.id):(session.outcome?openOutcome(session):open(session));});events.append(button);
      });
      cell.append(events);grid.append(cell);
    }
  }
  function applyPlanView() {
    const isCalendar=planView==='calendar';
    document.getElementById('schedule').hidden=isCalendar;
    document.getElementById('plan-calendar').hidden=!isCalendar;
    document.getElementById('calendar-status-legend').hidden=!isCalendar;
    document.getElementById('calendar-navigation').hidden=false;
    const dragHelp=document.querySelector('.calendar-drag-help');if(dragHelp)dragHelp.textContent=window.matchMedia?.('(max-width: 620px) and (orientation: portrait)').matches?'Tocca un indicatore per aprire la seduta':'↔ Trascina le sedute programmate per cambiare giorno';
    document.querySelectorAll('[data-plan-view]').forEach(button=>{const active=button.dataset.planView===planView;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});
    if(isCalendar)renderCalendar();
  }
  function render() {
    currentEvidenceIndex=readEvidenceIndex();
    const schedule = document.getElementById('schedule'); schedule.replaceChildren();
    const periodSessions=sessionsInVisiblePeriod();
    const ordered = [...periodSessions].sort((a,b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title,'it'));
    ordered.forEach(session => {
      const date = new Date(`${session.date}T12:00:00`); const meta = categoryMeta[session.category];
      const paused=isPaused(session),evidence=!paused?currentEvidenceIndex.get(session.id):null;const selected=selectedIds.has(String(session.id));const article = document.createElement('article'); article.className = `day priority-${session.priority}${session.outcome?` outcome-${session.outcome.status}`:paused?' outcome-paused':''}${evidence?' has-observed-data':''}${session.date===localDate()?' plan-today-session':''}${session.adaptiveAdjustment?' coach-adjusted':''}${selectionMode?' selectable':''}${selected?' selected':''} session-card-action`; article.dataset.sessionId = session.id;article.dataset.sessionDate=session.date;article.tabIndex=0;article.setAttribute('role','button');article.setAttribute('aria-label',`${selectionMode?(selected?'Deseleziona':'Seleziona'):'Apri'} ${session.title}`);
      const activateCard=()=>selectionMode?toggleSelection(session.id):(session.outcome?openOutcome(session):open(session));article.addEventListener('click',event=>{if(event.target.closest('button,a,input,select,textarea,label'))return;activateCard();});article.addEventListener('keydown',event=>{if(event.target!==article||!['Enter',' '].includes(event.key))return;event.preventDefault();activateCard();});
      if(selectionMode){const select=document.createElement('button');select.type='button';select.className='session-select-toggle';select.setAttribute('aria-label',`${selected?'Deseleziona':'Seleziona'} ${session.title}`);select.setAttribute('aria-pressed',String(selected));select.textContent='✓';select.addEventListener('click',()=>toggleSelection(session.id));article.append(select);}
      const dateBox = document.createElement('div'); dateBox.className = 'day-date';
      const weekday = document.createElement('small'); weekday.textContent = date.toLocaleDateString('it-IT',{weekday:'short'}).replace('.','').toUpperCase();
      const day = document.createElement('strong'); day.textContent = String(date.getDate()).padStart(2,'0'); dateBox.append(weekday,day);
      const content = document.createElement('div'); content.className = 'day-session';
      const tag = document.createElement('span'); tag.className = `tag ${meta.css}`; tag.textContent = meta.label;
      const text = document.createElement('div'); const title = document.createElement('h3'); title.textContent = session.title;if(session.demoDataset){const demo=document.createElement('span');demo.className='demo-badge';demo.textContent='DEMO';title.append(demo);}else if(session.planImport){const source=document.createElement('span');source.className='demo-badge';source.textContent='EXCEL';title.append(source);}if(session.adaptiveAdjustment){const adjusted=document.createElement('span');adjusted.className=`adaptive-badge ${paused?'paused':'active'}`;adjusted.textContent=paused?'SOSPESA':'ADATTATA';title.append(adjusted);}
      const summary = document.createElement('p'); summary.textContent = targetText(session); text.append(title,summary);
      if(session.adaptiveAdjustment?.instructions?.length){const rationale=document.createElement('p');rationale.className='adaptive-session-note';rationale.textContent=session.adaptiveAdjustment.instructions.join(' ');text.append(rationale);}
      if(session.outcome){const result=document.createElement('p');result.className=`outcome-result ${session.outcome.status}`;result.textContent=outcomeSummary(session);text.append(result);}
      if(evidence){const observed=document.createElement('p');observed.className='outcome-observed-summary';observed.textContent=[`◆ Dati ${evidenceSourceLabel(evidence)} collegati`,evidence.prefill.actualDurationMin?`${evidence.prefill.actualDurationMin} min osservati`:'',evidence.prefill.actualDistanceKm?`${evidence.prefill.actualDistanceKm} km`:''].filter(Boolean).join(' · ');text.append(observed);}
      content.append(tag,text);
      const actions = document.createElement('div'); actions.className = 'day-actions';
      const priority = document.createElement('span'); priority.className = `priority ${session.priority}`; priority.textContent = priorityMeta[session.priority];
      const recordable=canRecordOutcome(session);
      const status=document.createElement('span');status.className=`outcome-status ${session.outcome?.status||(paused?'paused':evidence?'observed':'planned')}`;status.textContent=session.outcome?`${outcomeMeta[session.outcome.status].symbol} ${outcomeMeta[session.outcome.status].label}`:paused?'Ⅱ Sospesa':evidence?'◆ Dati collegati':(recordable?'○ Da registrare':'○ Programmata');actions.append(status);
      const record = document.createElement('button'); record.type='button';record.className='record-outcome';record.disabled=!recordable;record.textContent=recordable?(session.outcome?'Dettagli':evidence?'Completa check-out':'Registra'):paused?'Sospesa':'Non ancora';
      if(recordable) record.addEventListener('click',()=>openOutcome(session));
      else { record.classList.add('future');record.title=outcomeLockedMessage(session);record.setAttribute('aria-label',`${outcomeLockedMessage(session)} ${session.title}`); }
      const edit = document.createElement('button'); edit.type = 'button'; edit.className = 'edit-session'; edit.textContent = 'Modifica'; edit.addEventListener('click', () => open(session));
      actions.append(priority);if(!selectionMode)actions.append(record,edit); article.append(dateBox,content,actions); schedule.append(article);
    });
    if (!ordered.length) { const empty = document.createElement('div'); empty.className = 'schedule-empty'; const period=planView==='calendar'?calendarCursor.toLocaleDateString('it-IT',{month:'long',year:'numeric'}):planViewModel.weekLabel(listWeekStart).replace(/^Settimana /,'la settimana ');const message=document.createElement('span');message.textContent=`Nessuna seduta programmata per ${period}.`;empty.append(message);if(!sessions.length){const actions=document.createElement('div');actions.className='schedule-empty-actions';const coachPlan=document.createElement('button');coachPlan.type='button';coachPlan.className='primary small';coachPlan.textContent='Crea il piano con il Coach';coachPlan.addEventListener('click',()=>document.getElementById('open-weekly-checkin')?.click());const externalPlan=document.createElement('button');externalPlan.type='button';externalPlan.className='ghost';externalPlan.textContent='Importa un piano esterno';externalPlan.addEventListener('click',()=>{window.rcNavigation?.show?.('data');setTimeout(()=>document.querySelector('.plan-source')?.scrollIntoView({behavior:'smooth',block:'center'}),0);});actions.append(coachPlan,externalPlan);empty.append(actions);}schedule.append(empty); }
    renderPeriodSummary(periodSessions);
    renderSelectionBar(periodSessions);
    applyPlanView();
  }
  function toggleFields() {
    document.querySelectorAll('[data-session-category]').forEach(section => section.classList.toggle('active', section.dataset.sessionCategory === categoryInput.value));
    document.querySelectorAll('[data-run-target]').forEach(field => field.classList.toggle('active', field.dataset.runTarget === runTargetInput.value));
  }
  function suggestedTitle() {
    const fields = {running:'runType',swimming:'swimType',cycling:'rideType',strength:'strengthFocus',hyrox:'hyroxFormat',metcon:'metconType',test:'testType',recovery:'recoveryType'};
    const field = form.elements.namedItem(fields[categoryInput.value]);
    return field?.value || categoryMeta[categoryInput.value].label;
  }
  function updateSuggestedTitle(force = false) {
    const suggestion = suggestedTitle();
    titleInput.placeholder = `Es. ${suggestion}`;
    if (force || titleMode === 'auto' || !titleInput.value.trim()) { titleInput.value = suggestion; titleMode = 'auto'; }
    document.getElementById('title-hint').textContent = titleMode === 'auto' ? 'AUTO' : 'PERSONALIZZATO';
  }
  function close() { modal.classList.remove('open'); modal.setAttribute('aria-hidden','true'); }
  function legacyRows(text, type) {
    return String(text || '').split('\n').map(value => value.trim()).filter(Boolean).map(name => type === 'strength' ? {name,sets:'',reps:'',loadKg:'',target:'',rest:''} : {name,volume:'',target:'',rest:''});
  }
  function builderRows(type) {
    const input = form.elements.namedItem(builderInputNames[type]);
    try { const value = JSON.parse(input.value || '[]'); return Array.isArray(value) ? value : []; } catch (_) { return []; }
  }
  function syncBuilder(type) {
    const builder = document.querySelector(`[data-builder="${type}"]`);
    const rows = [...builder.querySelectorAll('.workout-row')].map(row => Object.fromEntries(builderFields[type].map(([key]) => [key,row.querySelector(`[data-field="${key}"]`).value.trim()]))).filter(row => Object.values(row).some(Boolean));
    form.elements.namedItem(builderInputNames[type]).value = JSON.stringify(rows);
    return rows;
  }
  function renderBuilder(type, rows = []) {
    const builder = document.querySelector(`[data-builder="${type}"]`); const list = builder.querySelector('.workout-rows'); list.replaceChildren();
    rows.forEach((values,index) => {
      const row = document.createElement('div'); row.className = `workout-row ${type}`;
      builderFields[type].forEach(([key,label,placeholder]) => { const wrap=document.createElement('label'); wrap.textContent=label; let input;
        if(type==='strength'&&key==='name'){input=document.createElement('select'); const preserved=values[key]&&!strengthExerciseLibrary.includes(values[key])?[values[key]]:[]; [...preserved,...strengthExerciseLibrary].forEach(name=>{const option=document.createElement('option');option.value=name;option.textContent=name;input.append(option);}); input.value=values[key]||strengthExerciseLibrary[0]; input.addEventListener('change',()=>syncBuilder(type));}
        else {input=document.createElement('input');input.type=type==='strength'&&key==='loadKg'?'number':'text';if(input.type==='number'){input.inputMode='decimal';input.min='0';input.max='700';input.step='0.5';}input.placeholder=placeholder;input.value=values[key]??'';input.addEventListener('input',()=>syncBuilder(type));}
        input.dataset.field=key; wrap.append(input); row.append(wrap); });
      const actions=document.createElement('div'); actions.className='row-actions';
      [['↑','Sposta su',-1],['↓','Sposta giù',1]].forEach(([symbol,label,direction]) => { const button=document.createElement('button'); button.type='button'; button.className='row-action'; button.textContent=symbol; button.title=label; button.disabled=(direction<0&&index===0)||(direction>0&&index===rows.length-1); button.addEventListener('click',()=>{const current=syncBuilder(type); const next=index+direction; [current[index],current[next]]=[current[next],current[index]]; renderBuilder(type,current);}); actions.append(button); });
      const remove=document.createElement('button'); remove.type='button'; remove.className='row-action remove'; remove.textContent='×'; remove.title='Rimuovi'; remove.addEventListener('click',()=>{const current=syncBuilder(type); current.splice(index,1); renderBuilder(type,current);}); actions.append(remove); row.append(actions); list.append(row);
    });
    if (!rows.length) { const empty=document.createElement('div'); empty.className='builder-empty'; empty.textContent=type==='strength'?'Nessun esercizio inserito.':'Nessun blocco inserito.'; list.append(empty); }
    form.elements.namedItem(builderInputNames[type]).value=JSON.stringify(rows);
  }
  function hydrateBuilders(session) {
    const d=session?.details || {};
    renderRunBuilder(Array.isArray(d.runBlocks)?d.runBlocks:[]);
    renderRideBuilder(Array.isArray(d.rideBlocks)?d.rideBlocks:[]);
    renderBuilder('swimming',Array.isArray(d.swimStructuredBlocks)?d.swimStructuredBlocks:[]);
    renderBuilder('strength',Array.isArray(d.strengthBlocks)?d.strengthBlocks:legacyRows(d.exercises,'strength'));
    renderBuilder('hyrox',Array.isArray(d.hyroxStructuredBlocks)?d.hyroxStructuredBlocks:legacyRows(d.hyroxBlocks,'hyrox'));
    renderBuilder('metcon',Array.isArray(d.metconStructuredBlocks)?d.metconStructuredBlocks:legacyRows(d.metconBlocks,'metcon'));
  }
  function enduranceBlockVisual(item,compact=false){
    const model=prescriptionModel;const holder=document.createElement('div');holder.className=`endurance-block intensity-${model?.inferIntensity?.(item)||'easy'}${compact?' compact':''}`;
    const label=document.createElement('small');label.textContent=model?.blockLabel?.(item)||'Blocco';const value=document.createElement('strong');value.textContent=model?.blockSummary?.(item)||'Da definire';holder.append(label,value);
    return holder;
  }
  function renderRideBuilder(blocks=[]){
    const list=document.getElementById('ride-workout-rows');if(!list)return;list.replaceChildren();
    blocks.forEach(item=>{
      if(item.type!=='repeat'){list.append(enduranceBlockVisual(item));return;}
      const repeat=enduranceBlockVisual(item);repeat.classList.add('repeat');const steps=document.createElement('div');steps.className='ride-repeat-steps';(item.steps||[]).forEach(step=>steps.append(enduranceBlockVisual(step,true)));repeat.append(steps);list.append(repeat);
    });
    if(!blocks.length){const empty=document.createElement('div');empty.className='run-empty';empty.textContent='La struttura verrà generata dal Coach usando durata, tipologia e FTP del profilo.';list.append(empty);}
    form.elements.namedItem('rideBlocks').value=JSON.stringify(blocks);
  }
  function regenerateRideBuilder(){
    if(categoryInput.value!=='cycling')return;
    const draft={category:'cycling',title:titleInput.value,durationMin:Number(form.elements.durationMin.value)||45,details:{rideType:form.elements.rideType.value,powerSource:form.elements.powerSource.value,ftpMin:Number(form.elements.ftpMin.value),ftpMax:Number(form.elements.ftpMax.value),cadence:Number(form.elements.cadence.value),rideBlocks:[]}};
    const blocks=prescriptionModel?.ridePrescription?.(draft,prescriptionContext())||[];renderRideBuilder(blocks);
    const main=blocks.flatMap(item=>item.type==='repeat'?item.steps||[]:[item]).find(item=>item.phase==='work');
    if(main){form.elements.ftpMin.value=main.ftpMin||form.elements.ftpMin.value;form.elements.ftpMax.value=main.ftpMax||form.elements.ftpMax.value;form.elements.cadence.value=main.cadence||form.elements.cadence.value;}
  }
  function runSelect(label,name,options,value,onChange) {
    const wrap=document.createElement('label'); wrap.textContent=label; const select=document.createElement('select'); select.dataset.runField=name;
    options.forEach(([key,text])=>{const option=document.createElement('option'); option.value=key; option.textContent=text; select.append(option);}); select.value=value; select.addEventListener('change',onChange); wrap.append(select); return wrap;
  }
  function runSegment(segment,onChange,onRemove) {
    const values={phase:'work',unit:'min',amount:5,targetType:'free',target:'',...segment}; const row=document.createElement('div'); row.className=`run-segment intensity-${prescriptionModel?.inferIntensity?.(values)||'easy'}`; row.dataset.runSegment='';row.dataset.intensity=prescriptionModel?.inferIntensity?.(values)||'easy';row.dataset.paceHint=values.paceHint||'';if(values.targetSource)row.dataset.targetSource=JSON.stringify(values.targetSource);
    row.append(runSelect('Fase','phase',[['warmup','Warm-up'],['work','Lavoro'],['recovery','Recupero'],['cooldown','Cool-down'],['free','Corsa libera']],values.phase,onChange));
    row.append(runSelect('Unità','unit',[['min','Minuti'],['km','Chilometri'],['m','Metri']],values.unit,onChange));
    const amountWrap=document.createElement('label'); amountWrap.textContent='Quantità'; const amount=document.createElement('input'); amount.type='number'; amount.min='0.1'; amount.step='0.1'; amount.dataset.runField='amount'; amount.value=values.amount; amount.addEventListener('input',onChange); amountWrap.append(amount); row.append(amountWrap);
    const targetWrap=document.createElement('div'); targetWrap.className='run-target-value';
    const targetSelect=runSelect('Obiettivo','targetType',[['free','Libero'],['pace','Passo'],['hr','Frequenza cardiaca'],['rpe','RPE']],values.targetType,()=>{renderTarget();onChange();}); row.append(targetSelect,targetWrap);
    const actions=document.createElement('div'); actions.className='row-actions'; const remove=document.createElement('button'); remove.type='button'; remove.className='row-action remove'; remove.textContent='×'; remove.title='Rimuovi fase'; remove.addEventListener('click',onRemove); actions.append(remove); row.append(actions);
    if(values.paceHint){const hint=document.createElement('small');hint.className='run-derived-hint';hint.textContent=`Range operativo ${values.paceHint} · derivato dal profilo`;row.append(hint);}
    function paceSeconds(value){const match=String(value||'').match(/(\d+):(\d+)/);return match?Number(match[1])*60+Number(match[2]):300;}
    function paceText(seconds){const safe=Math.max(120,Math.min(900,seconds));return `${Math.floor(safe/60)}:${String(safe%60).padStart(2,'0')}/km`;}
    function renderTarget(){const type=row.querySelector('[data-run-field="targetType"]').value; const previous=row.querySelector('[data-run-field="target"]')?.value||values.target; targetWrap.replaceChildren(document.createTextNode('Target'));
      if(type==='pace'){const stepper=document.createElement('span');stepper.className='pace-stepper';const minus=document.createElement('button');minus.type='button';minus.textContent='−5s';const input=document.createElement('input');input.type='text';input.readOnly=true;input.dataset.runField='target';input.value=paceText(paceSeconds(previous));const plus=document.createElement('button');plus.type='button';plus.textContent='+5s';minus.addEventListener('click',()=>{input.value=paceText(paceSeconds(input.value)-5);onChange();});plus.addEventListener('click',()=>{input.value=paceText(paceSeconds(input.value)+5);onChange();});stepper.append(minus,input,plus);targetWrap.append(stepper);}
      else if(type==='hr'){const select=document.createElement('select');select.dataset.runField='target';athleteHrTargets().forEach(zone=>{const option=document.createElement('option');option.value=zone.value;option.textContent=zone.label;select.append(option);});const matched=[...select.options].find(option=>previous.startsWith(option.value.slice(0,2)));if(matched)select.value=matched.value;select.addEventListener('change',onChange);targetWrap.append(select);}
      else if(type==='rpe'){const select=document.createElement('select');select.dataset.runField='target';for(let value=1;value<=10;value++){const option=document.createElement('option');option.value=`RPE ${value}`;option.textContent=`RPE ${value}`;select.append(option);}if([...select.options].some(option=>option.value===previous))select.value=previous;else select.value='RPE 6';select.addEventListener('change',onChange);targetWrap.append(select);}
      else {const input=document.createElement('input');input.type='text';input.disabled=true;input.placeholder='Nessun target';input.dataset.runField='target';input.value='';targetWrap.append(input);} targetWrap.classList.toggle('is-free',type==='free');}
    renderTarget(); return row;
  }
  function readRunSegment(row) {
    let targetSource;try{targetSource=JSON.parse(row.dataset.targetSource||'null');}catch(_){}
    return{type:'segment',phase:row.querySelector('[data-run-field="phase"]').value,unit:row.querySelector('[data-run-field="unit"]').value,amount:Number(row.querySelector('[data-run-field="amount"]').value)||0,targetType:row.querySelector('[data-run-field="targetType"]').value,target:row.querySelector('[data-run-field="target"]')?.value.trim()||'',intensity:row.dataset.intensity||prescriptionModel?.inferIntensity?.({phase:row.querySelector('[data-run-field="phase"]').value,target:row.querySelector('[data-run-field="target"]')?.value}),...(row.dataset.paceHint?{paceHint:row.dataset.paceHint}:{}),...(targetSource?{targetSource}:{})};
  }
  function syncRunBuilder() {
    const items=[...document.querySelectorAll('#run-workout-rows > [data-run-item]')].map(item=>item.dataset.runItem==='segment'?readRunSegment(item.querySelector('.run-segment')):{type:'repeat',repeats:Number(item.querySelector('[data-repeat-count]').value)||1,intensity:item.dataset.intensity||'tempo',steps:[...item.querySelectorAll('.repeat-steps > .run-segment')].map(readRunSegment)});
    form.elements.namedItem('runBlocks').value=JSON.stringify(items); return items;
  }
  function renderRunBuilder(items=[]) {
    const list=document.getElementById('run-workout-rows'); list.replaceChildren();
    items.forEach((item,index)=>{
      if(item.type!=='repeat') { const holder=document.createElement('div'); holder.dataset.runItem='segment'; holder.append(runSegment(item,()=>syncRunBuilder(),()=>{const current=syncRunBuilder();current.splice(index,1);renderRunBuilder(current);})); list.append(holder); return; }
      const repeat=document.createElement('div'); repeat.className=`run-repeat intensity-${item.intensity||prescriptionModel?.inferIntensity?.(item.steps?.[0])||'tempo'}`; repeat.dataset.runItem='repeat';repeat.dataset.intensity=item.intensity||prescriptionModel?.inferIntensity?.(item.steps?.[0])||'tempo'; const head=document.createElement('div'); head.className='run-repeat-head'; const title=document.createElement('div'); title.className='run-repeat-title'; const strong=document.createElement('strong'); strong.textContent='Sequenza ripetuta'; const countWrap=document.createElement('label'); countWrap.className='repeat-count'; countWrap.textContent='Ripetizioni'; const count=document.createElement('input'); count.type='number'; count.min='2'; count.max='50'; count.value=item.repeats||2; count.dataset.repeatCount=''; count.addEventListener('input',()=>syncRunBuilder()); countWrap.append(count); title.append(strong,countWrap); const remove=document.createElement('button'); remove.type='button'; remove.className='row-action remove'; remove.textContent='×'; remove.title='Rimuovi sequenza'; remove.addEventListener('click',()=>{const current=syncRunBuilder();current.splice(index,1);renderRunBuilder(current);}); head.append(title,remove); repeat.append(head);
      const steps=document.createElement('div'); steps.className='repeat-steps'; (item.steps||[]).forEach((step,stepIndex)=>steps.append(runSegment(step,()=>syncRunBuilder(),()=>{const current=syncRunBuilder();current[index].steps.splice(stepIndex,1);renderRunBuilder(current);}))); repeat.append(steps);
      const add=document.createElement('button'); add.type='button'; add.className='ghost repeat-add'; add.textContent='+ Aggiungi fase alla sequenza'; add.addEventListener('click',()=>{const current=syncRunBuilder();current[index].steps.push({type:'segment',phase:current[index].steps.length?'recovery':'work',unit:'min',amount:current[index].steps.length?2:3,targetType:'free',target:''});renderRunBuilder(current);}); repeat.append(add); list.append(repeat);
    });
    if(!items.length){const empty=document.createElement('div');empty.className='run-empty';empty.textContent='Nessuna fase: aggiungi un segmento o una sequenza ripetuta.';list.append(empty);} form.elements.namedItem('runBlocks').value=JSON.stringify(items);
  }
  function open(session = null) {
    form.reset(); form.elements.id.value = ''; form.elements.date.value = localDate();
    document.getElementById('session-form-title').textContent = session ? 'Modifica seduta' : 'Nuova seduta';
    document.getElementById('delete-session').hidden = !session;
    const outcomeButton=document.getElementById('session-outcome');
    outcomeButton.hidden = !session || !canRecordOutcome(session);
    outcomeButton.textContent = session?.outcome ? 'Dettagli' : currentEvidenceIndex.has(session?.id) ? 'Completa check-out' : 'Registra';
    if (session) {
      const values = { ...session, ...(session.details || {}) };
      Object.entries(values).forEach(([name,value]) => { const field = form.elements.namedItem(name); if (field && value !== undefined && value !== null) field.value = value; });
      titleMode = session.titleMode || 'custom';
    } else {
      titleMode = 'auto';
    }
    hydrateBuilders(session); toggleFields(); updateSuggestedTitle(!session); modal.classList.add('open'); modal.setAttribute('aria-hidden','false');
  }
  function athleteWeightKg(){try{return Number(JSON.parse(localStorage.getItem('rc-athlete-profile-v1')).weightKg)||null;}catch(_){return null;}}
  function athleteStrengthFormula(){try{const value=JSON.parse(localStorage.getItem('rc-athlete-profile-v1')).strengthFormula;return strengthModel.FORMULAS[value]?value:'epley';}catch(_){return 'epley';}}
  function syncStrengthPerformanceChoices(){
    const container=document.getElementById('strength-performance-rows'),select=document.getElementById('strength-performance-exercise'),button=document.getElementById('add-strength-performance'),empty=document.getElementById('strength-performance-empty');
    const used=new Set([...container.querySelectorAll('.strength-performance-row')].map(row=>row.dataset.liftKey));
    const available=Object.entries(strengthModel.LIFTS).filter(([key])=>!used.has(key));select.replaceChildren();
    const placeholder=document.createElement('option');placeholder.value='';placeholder.selected=true;placeholder.textContent=available.length?'Seleziona un fondamentale':'Tutti i fondamentali sono già presenti';select.append(placeholder);
    available.forEach(([key,lift])=>{const option=document.createElement('option');option.value=key;option.textContent=lift.label;select.append(option);});
    select.disabled=!available.length;button.disabled=true;empty.hidden=Boolean(container.children.length);
  }
  function strengthPerformanceRow(lift,saved,formula){
    const row=document.createElement('div');row.className='strength-performance-row';row.dataset.liftKey=lift.key;row.dataset.exercise=lift.exercise;
    const name=document.createElement('div');name.className='strength-performance-name';const copy=document.createElement('div');
    const type=document.createElement('small');const plannedLoad=lift.plannedLoadKg!==undefined?`${lift.externalLoad?'+':''}${lift.plannedLoadKg} kg`:null,plannedReps=lift.plannedReps?` × ${lift.plannedReps}`:'';type.textContent=`${lift.externalLoad?`ZAVORRA ESTERNA · BW ${athleteWeightKg()||'—'} KG`:'CARICO TOTALE'}${plannedLoad?` · PREVISTO ${plannedLoad}${plannedReps}`:lift.planned?' · DA PROGRAMMA':' · AGGIUNTO COME SVOLTO'}`;
    const title=document.createElement('strong');title.textContent=lift.label;copy.append(type,title);name.append(copy);
    if(!lift.planned){const remove=document.createElement('button');remove.type='button';remove.className='row-action remove strength-performance-remove';remove.textContent='×';remove.setAttribute('aria-label',`Rimuovi ${lift.label}`);remove.title=`Rimuovi ${lift.label}`;remove.addEventListener('click',()=>{row.remove();syncStrengthPerformanceChoices();});name.append(remove);}
    const loadLabel=document.createElement('label');loadLabel.textContent=lift.externalLoad?'Zavorra (kg)':'Carico (kg)';const loadInput=document.createElement('input');loadInput.type='number';loadInput.inputMode='decimal';loadInput.min='0.5';loadInput.max=lift.externalLoad?'200':'700';loadInput.step='0.5';loadInput.value=saved.loadKg??'';loadInput.setAttribute('aria-label',`${loadLabel.textContent} ${lift.label}`);loadLabel.append(loadInput);
    const repsLabel=document.createElement('label');repsLabel.textContent='Ripetizioni';const repsInput=document.createElement('input');repsInput.type='number';repsInput.inputMode='numeric';repsInput.min='1';repsInput.max='10';repsInput.step='1';repsInput.value=saved.reps??'';repsInput.setAttribute('aria-label',`Ripetizioni ${lift.label}`);repsLabel.append(repsInput);
    const rpeLabel=document.createElement('label');rpeLabel.textContent='RPE set';const rpeInput=document.createElement('input');rpeInput.type='number';rpeInput.inputMode='decimal';rpeInput.min='6';rpeInput.max='10';rpeInput.step='0.5';rpeInput.placeholder='Es. 8';rpeInput.value=saved.rpe??'';rpeInput.setAttribute('aria-label',`RPE del set ${lift.label}`);rpeLabel.append(rpeInput);
    if(lift.plannedLoadKg!==undefined)loadInput.placeholder=`Previsto ${lift.externalLoad?'+':''}${lift.plannedLoadKg}`;if(lift.plannedReps)repsInput.placeholder=`Previsto ${lift.plannedReps}`;
    const preview=document.createElement('div');preview.className='strength-performance-preview';const previewLabel=document.createElement('small');previewLabel.textContent=`e1RM · ${strengthModel.FORMULAS[formula].shortLabel}`;const previewValue=document.createElement('strong');preview.append(previewLabel,previewValue);
    const update=()=>{const hasAny=loadInput.value!==''||repsInput.value!==''||rpeInput.value!=='';loadInput.required=hasAny;repsInput.required=hasAny;rpeInput.required=hasAny;const value=strengthModel.estimateE1rm(loadInput.value,repsInput.value,{externalLoad:lift.externalLoad,bodyweightKg:athleteWeightKg(),formula,rpe:rpeInput.value});const rir=strengthModel.rirFromRpe(rpeInput.value);previewLabel.textContent=`e1RM · ${strengthModel.FORMULAS[formula].shortLabel}${rir===null?'':' · RIR '+rir.toLocaleString('it-IT')}`;previewValue.textContent=value===null?'—':`${lift.externalLoad?'+':''}${value.toLocaleString('it-IT',{maximumFractionDigits:1})} kg`;};
    loadInput.addEventListener('input',update);repsInput.addEventListener('input',update);rpeInput.addEventListener('input',update);update();row.append(name,loadLabel,repsLabel,rpeLabel,preview);return row;
  }
  function renderStrengthPerformance(session,outcome){
    const section=document.getElementById('strength-performance-fields'),container=document.getElementById('strength-performance-rows'),select=document.getElementById('strength-performance-exercise'),button=document.getElementById('add-strength-performance');container.replaceChildren();
    const formula=athleteStrengthFormula();section.querySelector('.strength-performance-heading small').textContent=`${strengthModel.FORMULAS[formula].shortLabel} · RPE-AWARE`;
    const isStrength=session.category==='strength',lifts=isStrength?strengthModel.editableLifts({...session,outcome}):[];section.dataset.hasRows=String(isStrength);
    const existing=new Map((Array.isArray(outcome?.strengthPerformance)?outcome.strengthPerformance:[]).map(entry=>[strengthModel.liftKey(entry.exercise),entry]));
    lifts.forEach(lift=>container.append(strengthPerformanceRow(lift,existing.get(lift.key)||{},formula)));
    select.onchange=()=>{button.disabled=!select.value;};button.onclick=()=>{const key=select.value,meta=strengthModel.LIFTS[key];if(!meta)return;const row=strengthPerformanceRow({key,label:meta.label,exercise:meta.label,externalLoad:meta.externalLoad,planned:false},{},formula);container.append(row);syncStrengthPerformanceChoices();row.querySelector('input')?.focus();};
    syncStrengthPerformanceChoices();
  }
  function strengthPerformanceFromForm(){
    return [...document.querySelectorAll('#strength-performance-rows .strength-performance-row')].map(row=>{const inputs=row.querySelectorAll('input'),key=row.dataset.liftKey,bodyweightKg=athleteWeightKg();return inputs[0].value&&inputs[1].value&&inputs[2].value?{exercise:row.dataset.exercise,loadKg:Number(inputs[0].value),reps:Number(inputs[1].value),rpe:Number(inputs[2].value),...(key==='pullup'&&bodyweightKg?{bodyweightKg}: {})}:null;}).filter(Boolean);
  }
  function actualEnduranceSegmentRow(item,onUpdate){
    const row=document.createElement('div');row.className=`endurance-actual-segment intensity-${prescriptionModel?.inferIntensity?.(item)||'easy'}`;row.classList.toggle('not-completed',item.completed===false);
    const status=document.createElement('label');status.className='endurance-completed';const check=document.createElement('input');check.type='checkbox';check.checked=item.completed!==false;const statusText=document.createElement('span');statusText.textContent='Fatto';status.append(check,statusText);
    const phase=document.createElement('div');phase.className='endurance-actual-phase';const small=document.createElement('small');small.textContent=prescriptionModel?.PHASE_LABELS?.[item.phase]||'Blocco';const planned=document.createElement('span');planned.textContent=`Previsto ${item.plannedAmount??item.amount} ${item.unit||''}`;phase.append(small,planned);
    const quantity=document.createElement('label');quantity.textContent='Quantità reale';const amount=document.createElement('input');amount.type='number';amount.inputMode='decimal';amount.min='0';amount.max='1000';amount.step=item.unit==='min'?'1':'0.1';amount.value=item.amount??'';quantity.append(amount);
    const target=document.createElement('label');target.textContent='Target / zona reale';const targetInput=document.createElement('input');targetInput.type='text';targetInput.value=item.target||'';targetInput.placeholder='Es. Z2 oppure 5:00/km';target.append(targetInput);
    const hint=document.createElement('small');hint.className='endurance-actual-hint';hint.textContent=item.paceHint?`Riferimento programmato ${item.paceHint}`:'Modifica solo se il blocco è cambiato.';
    const update=()=>{item.completed=check.checked;item.amount=Number(amount.value)||0;item.target=targetInput.value.trim();row.classList.toggle('not-completed',!item.completed);statusText.textContent=item.completed?'Fatto':'Non fatto';onUpdate?.();};
    check.addEventListener('change',update);amount.addEventListener('input',update);targetInput.addEventListener('input',update);update();row.append(status,phase,quantity,target,hint);return row;
  }
  function renderEndurancePerformance(session,outcome){
    const section=document.getElementById('endurance-performance-fields'),container=document.getElementById('endurance-performance-rows');container.replaceChildren();
    activeActualEnduranceBlocks=prescriptionModel?.actualBlocks?.(session,outcome)||[];
    activeActualEnduranceBlocks.forEach(item=>{
      if(item.type!=='repeat'){container.append(actualEnduranceSegmentRow(item));return;}
      const repeat=document.createElement('div');repeat.className=`endurance-actual-repeat intensity-${prescriptionModel?.inferIntensity?.(item)||'tempo'}`;
      const head=document.createElement('div');head.className='endurance-actual-repeat-head';const copy=document.createElement('div');const title=document.createElement('strong');title.textContent='Sequenza ripetuta';const planned=document.createElement('span');planned.textContent=`Prevista ${item.plannedRepeats??item.repeats}×`;copy.append(title,planned);
      const countLabel=document.createElement('label');countLabel.textContent='Ripetizioni reali';const count=document.createElement('input');count.type='number';count.inputMode='numeric';count.min='0';count.max='100';count.step='1';count.value=item.repeats??0;count.addEventListener('input',()=>{item.repeats=Number(count.value)||0;});countLabel.append(count);head.append(copy,countLabel);repeat.append(head);
      const steps=document.createElement('div');steps.className='endurance-actual-repeat-steps';(item.steps||[]).forEach(step=>steps.append(actualEnduranceSegmentRow(step)));repeat.append(steps);container.append(repeat);
    });
    section.dataset.hasRows=String(Boolean(activeActualEnduranceBlocks.length));
  }
  function endurancePerformanceFromForm(){return structuredClone(activeActualEnduranceBlocks);}
  function toggleOutcomeFields() {
    const status=outcomeForm.elements.status.value,skipped=status==='skipped';
    const performance=document.getElementById('outcome-performance-fields'),skippedFields=document.getElementById('outcome-skipped-fields');
    performance.hidden=skipped;skippedFields.hidden=!skipped;
    performance.querySelectorAll('input,select').forEach(field=>field.disabled=skipped);
    skippedFields.querySelectorAll('input,select').forEach(field=>field.disabled=!skipped);
    const distanceField=document.getElementById('outcome-distance-field'),distanceInput=outcomeForm.elements.actualDistanceKm;
    const hasDistance=['running','swimming'].includes(outcomeForm.dataset.category);distanceField.hidden=!hasDistance;distanceInput.disabled=skipped||!hasDistance;
    const strengthFields=document.getElementById('strength-performance-fields');strengthFields.hidden=skipped||outcomeForm.dataset.category!=='strength'||strengthFields.dataset.hasRows!=='true';
    const enduranceFields=document.getElementById('endurance-performance-fields');enduranceFields.hidden=skipped||!['running','cycling'].includes(outcomeForm.dataset.category)||enduranceFields.dataset.hasRows!=='true';
    document.getElementById('skip-reason-impact').textContent=skipReasonModel.impact(outcomeForm.elements.skipReason.value);
    updateOutcomeLoad();
  }
  function updateOutcomeLoad() {
    const duration=Number(outcomeForm.elements.actualDurationMin.value)||0,rpe=Number(outcomeForm.elements.rpe.value)||0;
    document.getElementById('outcome-load-value').textContent=`${Math.round(duration*rpe)} AU`;
  }
  function formatPace(seconds){if(!Number.isFinite(Number(seconds))||Number(seconds)<=0)return null;const rounded=Math.round(Number(seconds));return`${Math.floor(rounded/60)}:${String(rounded%60).padStart(2,'0')}/km`;}
  function renderObservedEvidence(evidence,hasManualOutcome=false){
    const panel=document.getElementById('outcome-observed');activeOutcomeEvidence=evidence||null;if(!evidence){panel.hidden=true;return;}panel.hidden=false;
    const sources=[evidence.stravaActivityId?'Strava':null,evidence.whoopWorkoutId?'WHOOP':null].filter(Boolean);document.getElementById('outcome-observed-title').textContent=sources.join(' + ');const confidence=document.getElementById('outcome-observed-confidence');confidence.className=evidence.quality==='high'?'':evidence.quality;confidence.textContent=`${evidence.quality==='high'?'Alta':evidence.quality==='medium'?'Media':'Da verificare'} · ${Math.round((evidence.matchConfidence||0)*100)}%`;
    const metrics=document.getElementById('outcome-observed-metrics');metrics.replaceChildren();const add=(label,value,note)=>{if(value===null||value===undefined||value==='')return;const item=document.createElement('span');const small=document.createElement('small');small.textContent=label;const strong=document.createElement('strong');strong.textContent=value;const detail=document.createElement('em');detail.textContent=note||'';item.append(small,strong,detail);metrics.append(item);};
    const durationDelta=evidence.comparison.durationDeltaMin;const durationSource=evidence.observed.durationSource==='strava'?'Strava':evidence.observed.durationSource==='whoop'?'WHOOP':'';const durationNote=durationDelta===null?durationSource:durationDelta===0?`in linea col piano · ${durationSource}`:`${durationDelta>0?'+':''}${durationDelta} min vs piano · ${durationSource}`;add('DURATA OSSERVATA',evidence.observed.durationMin===null?null:`${evidence.observed.durationMin} min`,durationNote);
    add('DISTANZA',evidence.observed.distanceKm===null?null:`${evidence.observed.distanceKm} km`,'Strava');add('PASSO MEDIO',formatPace(evidence.observed.averagePaceSecPerKm),'da tempo in movimento');
    add('FC STRAVA',evidence.observed.stravaAverageHr===null?null:`${evidence.observed.stravaAverageHr} bpm`,evidence.observed.stravaMaxHr===null?'media':`max ${evidence.observed.stravaMaxHr}`);add('FC WHOOP',evidence.observed.whoopAverageHr===null?null:`${evidence.observed.whoopAverageHr} bpm`,evidence.observed.whoopMaxHr===null?'media':`max ${evidence.observed.whoopMaxHr}`);
    add('POTENZA',evidence.observed.averageWatts===null?null:`${Math.round(evidence.observed.averageWatts)} W`,evidence.observed.weightedWatts===null?'media':`ponderata ${Math.round(evidence.observed.weightedWatts)} W`);add('WHOOP STRAIN',evidence.observed.whoopStrain,'osservato');
    const note=document.getElementById('outcome-observed-note');if(evidence.warnings.length){note.className='warning';note.textContent=evidence.warnings.join(' ');}else{note.className='';note.textContent=hasManualOutcome?'La registrazione manuale resta invariata. Questi valori dispositivo vengono affiancati come evidenza osservata.':'Durata e distanza sono precompilate dai dispositivi. RPE, confronto col previsto e dolore richiedono sempre la tua valutazione.';}
  }
  function outcomeRecordElement(tag,className,text){
    const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;
  }
  function metricValue(value,suffix=''){return value===null||value===undefined||value===''?'—':`${value}${suffix}`;}
  function renderOutcomeRecord(session){
    const holder=document.getElementById('outcome-record-view'),outcome=session.outcome;holder.replaceChildren();if(!outcome)return;
    const statusRow=outcomeRecordElement('div','outcome-record-status'),status=outcomeRecordElement('span',`outcome-status ${outcome.status}`,`${outcomeMeta[outcome.status]?.symbol||'•'} ${outcomeMeta[outcome.status]?.label||'Registrata'}`),recorded=outcomeRecordElement('small','',outcome.updatedAt?`Aggiornata ${new Date(outcome.updatedAt).toLocaleString('it-IT',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}`:'Registrazione salvata');statusRow.append(status,recorded);holder.append(statusRow);
    const metrics=outcomeRecordElement('div','outcome-record-metrics');const addMetric=(label,value)=>{const item=outcomeRecordElement('div','outcome-record-metric');item.append(outcomeRecordElement('small','',label),outcomeRecordElement('strong','',value));metrics.append(item);};
    if(outcome.status==='skipped')addMetric('MOTIVO',outcome.skipReason?skipReasonModel.label(outcome.skipReason):'Non specificato');
    else{
      addMetric('DURATA REALE',metricValue(outcome.actualDurationMin,' min'));
      if(['running','swimming'].includes(session.category))addMetric('DISTANZA REALE',metricValue(outcome.actualDistanceKm,' km'));
      addMetric('RPE SEDUTA',metricValue(outcome.rpe,' / 10'));
      addMetric('CARICO INTERNO',metricValue(outcome.sessionLoad,' AU'));
      addMetric('RISPETTO AL PIANO',({easier:'Più facile','as-planned':'Come previsto',harder:'Più impegnativa'}[outcome.execution]||'—'));
      addMetric('DOLORE MASSIMO',metricValue(outcome.pain,' / 10'));
    }
    const evidenceLabel=evidenceSourceLabel(outcome.deviceEvidence);if(evidenceLabel)addMetric('DATI COLLEGATI',evidenceLabel);holder.append(metrics);
    if(session.category==='strength'&&outcome.status!=='skipped'){
      const entries=(Array.isArray(outcome.strengthPerformance)?outcome.strengthPerformance:[]).map(item=>strengthModel.normalizedEntry(item)).filter(Boolean);
      const section=outcomeRecordElement('section','outcome-record-strength');section.append(outcomeRecordElement('small','','ESERCIZI PRINCIPALI REALMENTE SVOLTI'));
      const lifts=outcomeRecordElement('div','outcome-record-lifts');
      if(entries.length)entries.forEach(entry=>{
        const meta=strengthModel.LIFTS[entry.key],row=outcomeRecordElement('div','outcome-record-lift'),copy=outcomeRecordElement('div'),load=`${meta.externalLoad?'+':''}${entry.loadKg.toLocaleString('it-IT',{maximumFractionDigits:1})} kg`,setLine=[`${load} × ${entry.reps}`,entry.rpe!==undefined?`RPE ${entry.rpe.toLocaleString('it-IT')}`:null].filter(Boolean).join(' · '),rir=entry.rpe!==undefined?strengthModel.rirFromRpe(entry.rpe):null;
        copy.append(outcomeRecordElement('strong','',meta.label),outcomeRecordElement('span','',setLine),outcomeRecordElement('small','',rir===null?'RPE del set non registrata nello storico':`RIR stimata ${rir.toLocaleString('it-IT')} · ${entry.reps} ripetizioni svolte + ${rir.toLocaleString('it-IT')} in riserva`));
        const estimate=strengthModel.estimateE1rm(entry.loadKg,entry.reps,{externalLoad:meta.externalLoad,bodyweightKg:entry.bodyweightKg||athleteWeightKg(),formula:athleteStrengthFormula(),rpe:entry.rpe}),estimateBox=outcomeRecordElement('div','outcome-record-e1rm');estimateBox.append(outcomeRecordElement('small','','e1RM STIMATA'),outcomeRecordElement('strong','',estimate===null?'—':`${meta.externalLoad?'+':''}${estimate.toLocaleString('it-IT',{maximumFractionDigits:1})} kg`));row.append(copy,estimateBox);lifts.append(row);
      });
      else lifts.append(outcomeRecordElement('div','outcome-record-lift','Nessun set principale registrato.'));
      section.append(lifts);holder.append(section);
    }
    if(['running','cycling'].includes(session.category)&&outcome.status!=='skipped'&&Array.isArray(outcome.actualEnduranceBlocks)&&outcome.actualEnduranceBlocks.length){
      const section=outcomeRecordElement('section','outcome-record-endurance');section.append(outcomeRecordElement('small','','BLOCCHI REALMENTE SVOLTI'));
      const list=outcomeRecordElement('div','outcome-record-endurance-list');
      outcome.actualEnduranceBlocks.forEach(item=>{
        const row=outcomeRecordElement('div',`outcome-record-endurance-block intensity-${prescriptionModel?.inferIntensity?.(item)||'easy'}${item.completed===false?' not-completed':''}`);
        const copy=outcomeRecordElement('div');copy.append(outcomeRecordElement('strong','',prescriptionModel?.blockLabel?.(item)||'Blocco'),outcomeRecordElement('span','',prescriptionModel?.blockSummary?.(item)||'—'));
        const state=outcomeRecordElement('em','',item.type==='repeat'&&item.plannedRepeats!==undefined&&Number(item.repeats)!==Number(item.plannedRepeats)?`${item.repeats}× reali · ${item.plannedRepeats}× previste`:item.completed===false?'Non completato':item.plannedAmount!==undefined&&Number(item.amount)!==Number(item.plannedAmount)?`${item.amount} ${item.unit||''} reali · ${item.plannedAmount} previste`:'Come programmato');
        row.append(copy,state);list.append(row);
      });
      section.append(list);holder.append(section);
    }
    if(outcome.notes){const notes=outcomeRecordElement('div','outcome-record-notes');notes.append(outcomeRecordElement('small','',session.category==='strength'?'NOTE E COMPLEMENTARI':'NOTE POST-ALLENAMENTO'),outcomeRecordElement('p','',outcome.notes));holder.append(notes);}
    const reference=outcomeRecordElement('details','outcome-plan-reference'),referenceSummary=outcomeRecordElement('summary','','Vedi programmazione originale'),referenceBody=outcomeRecordElement('div','outcome-plan-reference-body');referenceBody.append(outcomeRecordElement('strong','',session.title),outcomeRecordElement('span','',targetText(session)));
    if(session.category==='strength'&&Array.isArray(session.details?.strengthBlocks)&&session.details.strengthBlocks.length){const list=outcomeRecordElement('ul');session.details.strengthBlocks.forEach(block=>{const prescription=[block.sets&&block.reps?`${block.sets}×${block.reps}`:block.reps?`${block.reps} rip.`:null,block.loadKg!==''&&block.loadKg!==null&&block.loadKg!==undefined?`@ ${block.loadKg} kg`:null,block.target||null].filter(Boolean).join(' · ');list.append(outcomeRecordElement('li','',`${block.name}${prescription?` — ${prescription}`:''}`));});referenceBody.append(list);}
    if(session.category==='swimming'&&Array.isArray(session.details?.swimStructuredBlocks)&&session.details.swimStructuredBlocks.length){const list=outcomeRecordElement('ul');session.details.swimStructuredBlocks.forEach(block=>list.append(outcomeRecordElement('li','',`${block.name||'Blocco'} — ${[block.volume,block.target,block.rest?`rec. ${block.rest}`:''].filter(Boolean).join(' · ')}`)));referenceBody.append(list);}
    if(['running','cycling'].includes(session.category)){const planned=prescriptionModel?.plannedBlocks?.(session)||[];if(planned.length){const list=outcomeRecordElement('ul');planned.forEach(block=>list.append(outcomeRecordElement('li','',`${prescriptionModel.blockLabel(block)} — ${prescriptionModel.blockSummary(block)}`)));referenceBody.append(list);}}
    reference.append(referenceSummary,referenceBody);holder.append(reference);
    const actions=outcomeRecordElement('div','outcome-record-actions'),editPlan=outcomeRecordElement('button','ghost','Modifica programmazione'),editRecord=outcomeRecordElement('button','primary','Modifica registrazione'),closeRecord=outcomeRecordElement('button','ghost','Chiudi');[editPlan,editRecord,closeRecord].forEach(button=>button.type='button');editPlan.addEventListener('click',()=>{closeOutcome();open(session);});editRecord.addEventListener('click',()=>setOutcomeMode(session,true));closeRecord.addEventListener('click',closeOutcome);actions.append(closeRecord,editPlan,editRecord);holder.append(actions);
  }
  function setOutcomeMode(session,editMode){
    const record=document.getElementById('outcome-record-view'),fields=document.getElementById('outcome-editor-fields'),actions=document.getElementById('outcome-editor-actions'),readOnly=Boolean(session.outcome&&!editMode);record.hidden=!readOnly;fields.hidden=readOnly;actions.hidden=readOnly;const title=document.getElementById('outcome-title'),kicker=title.previousElementSibling;
    if(readOnly){title.textContent=session.outcome.status==='skipped'?'Seduta non svolta':'Allenamento svolto';if(kicker)kicker.textContent='REGISTRAZIONE EFFETTIVA';renderOutcomeRecord(session);}
    else{title.textContent=session.outcome?'Modifica registrazione':'Check-in post-allenamento';if(kicker)kicker.textContent='CHECK-IN POST-ALLENAMENTO';}
  }
  function closeOutcome() {activeOutcomeEvidence=null;outcomeModal.classList.remove('open');outcomeModal.setAttribute('aria-hidden','true');}
  function openOutcome(session,options={}) {
    if(!session.outcome&&!canRecordOutcome(session)){window.alert(outcomeLockedMessage(session));return;}
    const outcome=session.outcome||null,evidence=currentEvidenceIndex.get(session.id)||null;outcomeForm.reset();outcomeForm.dataset.category=session.category;
    outcomeForm.elements.sessionId.value=session.id;outcomeForm.elements.status.value=outcome?.status||'completed';
    outcomeForm.elements.actualDurationMin.value=outcome?(outcome.actualDurationMin??''):(evidence?.prefill.actualDurationMin??'');
    outcomeForm.elements.actualDistanceKm.value=outcome?(outcome.actualDistanceKm??''):(evidence?.prefill.actualDistanceKm??'');
    outcomeForm.elements.rpe.value=outcome?.rpe??'';
    outcomeForm.elements.execution.value=outcome?.execution||'';outcomeForm.elements.pain.value=outcome?.pain??'';
    outcomeForm.elements.skipReason.value=outcome?.skipReason||'time';outcomeForm.elements.outcomeNotes.value=outcome?.notes||'';
    renderEndurancePerformance(session,outcome);
    renderStrengthPerformance(session,outcome);
    const context=document.getElementById('outcome-session-context');const strong=document.createElement('strong');strong.textContent=session.title;const span=document.createElement('span');const date=new Date(`${session.date}T12:00:00`);span.textContent=`${date.toLocaleDateString('it-IT',{weekday:'long',day:'numeric',month:'long'})} · ${categoryMeta[session.category].label} · ${session.durationMin} min previsti`;context.replaceChildren(strong,span);
    renderObservedEvidence(evidence,Boolean(outcome));document.getElementById('outcome-delete').hidden=!outcome;toggleOutcomeFields();setOutcomeMode(session,Boolean(options.edit));outcomeModal.classList.add('open');outcomeModal.setAttribute('aria-hidden','false');outcomeForm.scrollTop=0;
  }
  function detailsFromForm(data, category) {
    if (category === 'running') return {runType:data.get('runType'),distanceKm:Number(data.get('distanceKm')) || null,runTarget:data.get('runTarget'),hrZone:data.get('hrZone'),paceMin:Number(data.get('paceMin')),paceSec:Number(data.get('paceSec')),runRpe:Number(data.get('runRpe')),runBlocks:JSON.parse(data.get('runBlocks')||'[]')};
    if (category === 'swimming') return {swimType:data.get('swimType'),swimDistanceM:Number(data.get('swimDistanceM'))||null,swimRpe:Number(data.get('swimRpe')),swimStructuredBlocks:builderRows('swimming')};
    if (category === 'cycling') return {rideType:data.get('rideType'),powerSource:data.get('powerSource'),ftpMin:Number(data.get('ftpMin')),ftpMax:Number(data.get('ftpMax')),cadence:Number(data.get('cadence')),rideBlocks:JSON.parse(data.get('rideBlocks')||'[]')};
    if (category === 'strength') return {strengthFocus:data.get('strengthFocus'),targetRir:Number(data.get('targetRir')),strengthBlocks:builderRows('strength'),strengthAccessories:data.get('strengthAccessories').trim()};
    if (category === 'hyrox') return {hyroxFormat:data.get('hyroxFormat'),hyroxRpe:Number(data.get('hyroxRpe')),hyroxStructuredBlocks:builderRows('hyrox')};
    if (category === 'metcon') return {metconType:data.get('metconType'),metconRpe:Number(data.get('metconRpe')),metconStructuredBlocks:builderRows('metcon')};
    if (category === 'test') return {testType:data.get('testType'),testRpe:Number(data.get('testRpe')),testProtocol:data.get('testProtocol').trim()};
    return {recoveryType:data.get('recoveryType')};
  }
  categoryInput.addEventListener('change', () => { toggleFields(); updateSuggestedTitle();if(categoryInput.value==='cycling')regenerateRideBuilder(); });
  runTargetInput.addEventListener('change', toggleFields);
  document.querySelectorAll('[data-title-source]').forEach(field => field.addEventListener('change', () => updateSuggestedTitle()));
  form.elements.rideType.addEventListener('change',regenerateRideBuilder);
  form.elements.durationMin.addEventListener('change',()=>{if(categoryInput.value==='cycling')regenerateRideBuilder();});
  document.querySelectorAll('.add-workout-row').forEach(button => button.addEventListener('click', () => { const type=button.closest('[data-builder]').dataset.builder; const rows=syncBuilder(type); rows.push(type==='strength'?{name:strengthExerciseLibrary[0],sets:'',reps:'',loadKg:'',target:'',rest:''}:{name:'',volume:'',target:'',rest:''}); renderBuilder(type,rows); const inputs=document.querySelectorAll(`[data-builder="${type}"] .workout-row input`); inputs[inputs.length-(builderFields[type].length-1)]?.focus(); }));
  document.getElementById('add-run-segment').addEventListener('click',()=>{const items=syncRunBuilder();items.push({type:'segment',phase:items.length?'work':'warmup',unit:'min',amount:items.length?5:10,targetType:'free',target:''});renderRunBuilder(items);});
  document.getElementById('add-run-repeat').addEventListener('click',()=>{const items=syncRunBuilder();items.push({type:'repeat',repeats:6,steps:[{type:'segment',phase:'work',unit:'min',amount:3,targetType:'pace',target:''},{type:'segment',phase:'recovery',unit:'min',amount:2,targetType:'free',target:''}]});renderRunBuilder(items);});
  titleInput.addEventListener('input', () => { titleMode = titleInput.value.trim() ? 'custom' : 'auto'; updateSuggestedTitle(); });
  document.getElementById('add-session').addEventListener('click', () => open());
  document.getElementById('select-sessions').addEventListener('click',()=>setSelectionMode(!selectionMode));
  document.getElementById('select-month-sessions').addEventListener('click',()=>{selectedIds=selectionModel.addVisible(selectedIds,sessionsInVisiblePeriod().map(item=>item.id));render();});
  document.getElementById('clear-session-selection').addEventListener('click',()=>{selectedIds.clear();render();});
  document.getElementById('delete-selected-sessions').addEventListener('click',()=>{
    const selected=sessions.filter(item=>selectedIds.has(String(item.id)));if(!selected.length)return;const recorded=selected.filter(item=>item.outcome).length;
    const recordingNote=recorded?`\n\n${recorded===1?'1 seduta selezionata contiene una registrazione':`${recorded} sedute selezionate contengono registrazioni`} post-allenamento che verranno eliminate insieme al piano. I check-in pre-sessione resteranno nello storico.`:'';
    if(!window.confirm(`Eliminare definitivamente ${selected.length===1?'la seduta selezionata':`${selected.length} sedute selezionate`}?${recordingNote}`))return;
    const result=selectionModel.removeSelected(sessions,selectedIds);sessions=result.sessions;selectionMode=false;selectedIds.clear();save();render();toast();document.dispatchEvent(new CustomEvent('rc:sessions-updated',{detail:{reason:'sessions-bulk-deleted',sessionIds:result.deletedIds}}));
  });
  document.querySelectorAll('[data-plan-view]').forEach(button=>button.addEventListener('click',()=>{planView=button.dataset.planView;localStorage.setItem(VIEW_KEY,planView);render();}));
  document.getElementById('calendar-prev').addEventListener('click',()=>{if(planView==='calendar')calendarCursor=new Date(calendarCursor.getFullYear(),calendarCursor.getMonth()-1,1);else listWeekStart=planViewModel.addDays(listWeekStart,-7);render();});
  document.getElementById('calendar-next').addEventListener('click',()=>{if(planView==='calendar')calendarCursor=new Date(calendarCursor.getFullYear(),calendarCursor.getMonth()+1,1);else listWeekStart=planViewModel.addDays(listWeekStart,7);render();});
  document.getElementById('calendar-today').addEventListener('click',()=>{const today=new Date(),todayKey=localDate();calendarCursor=new Date(today.getFullYear(),today.getMonth(),1);listWeekStart=planViewModel.mondayFor(todayKey);render();if(planView==='list'){const targets=[...document.querySelectorAll(`#schedule [data-session-date="${todayKey}"]`)];if(targets.length){targets.forEach(node=>node.classList.add('today-focus'));targets[0].scrollIntoView({behavior:'smooth',block:'center'});setTimeout(()=>targets.forEach(node=>node.classList.remove('today-focus')),2800);}}});
  document.getElementById('session-close').addEventListener('click', close);
  document.getElementById('session-cancel').addEventListener('click', close);
  document.getElementById('session-outcome').addEventListener('click',()=>{const session=sessions.find(item=>item.id===form.elements.id.value);if(session){close();openOutcome(session);}});
  document.getElementById('outcome-close').addEventListener('click',closeOutcome);
  document.getElementById('outcome-cancel').addEventListener('click',closeOutcome);
  outcomeForm.querySelectorAll('input[name="status"]').forEach(input=>input.addEventListener('change',toggleOutcomeFields));
  outcomeForm.elements.skipReason.addEventListener('change',toggleOutcomeFields);
  outcomeForm.elements.actualDurationMin.addEventListener('input',updateOutcomeLoad);outcomeForm.elements.rpe.addEventListener('input',updateOutcomeLoad);
  outcomeForm.addEventListener('submit',event=>{
    event.preventDefault();const data=new FormData(outcomeForm),id=data.get('sessionId'),existing=sessions.find(item=>item.id===id);if(!existing)return;
    if(!canRecordOutcome(existing)){closeOutcome();window.alert(outcomeLockedMessage(existing));return;}
    const status=data.get('status'),skipped=status==='skipped',duration=skipped?null:Number(data.get('actualDurationMin')),rpe=skipped?null:Number(data.get('rpe'));
    const actualDistanceKm=!skipped&&['running','swimming'].includes(existing.category)&&data.get('actualDistanceKm')?Number(data.get('actualDistanceKm')):null;let deviceEvidence=null;
    if(!skipped&&activeOutcomeEvidence?.sessionId===id&&executionModel)deviceEvidence=executionModel.createDeviceEvidenceSnapshot(activeOutcomeEvidence,{actualDurationMin:duration,actualDistanceKm},new Date());
    else if(!skipped&&existing.outcome?.deviceEvidence)deviceEvidence=existing.outcome.deviceEvidence;
    const outcome={status,actualDurationMin:duration,actualDistanceKm,rpe,sessionLoad:skipped?0:Math.round(duration*rpe),execution:skipped?null:data.get('execution'),pain:skipped?null:Number(data.get('pain')),skipReason:skipped?data.get('skipReason'):null,notes:data.get('outcomeNotes').trim(),...(existing.category==='strength'?{strengthPerformance:skipped?[]:strengthPerformanceFromForm()}:{}),...(['running','cycling'].includes(existing.category)&&!skipped&&activeActualEnduranceBlocks.length?{actualEnduranceBlocks:endurancePerformanceFromForm()}:{}),...(deviceEvidence?{deviceEvidence}:{}),recordedAt:existing.outcome?.recordedAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
    sessions=sessions.map(item=>item.id===id?{...item,outcome,updatedAt:new Date().toISOString()}:item);const savedSession=sessions.find(item=>item.id===id),hasRemaining=sessions.some(item=>item.date>localDate()&&!item.outcome&&!isPaused(item));save();render();closeOutcome();toast(window.rcAdaptiveApplicationModel?.isKeyOutcome?.(savedSession)&&hasRemaining?'Registrato · microciclo da rivedere':undefined);document.dispatchEvent(new CustomEvent('rc:sessions-updated',{detail:{reason:'outcome-saved',sessionId:id}}));
  });
  document.getElementById('outcome-delete').addEventListener('click',()=>{const id=outcomeForm.elements.sessionId.value;if(!id||!window.confirm('Eliminare la registrazione e riportare la seduta a “programmata”?'))return;sessions=sessions.map(item=>item.id===id?{...item,outcome:null,updatedAt:new Date().toISOString()}:item);save();render();closeOutcome();toast();document.dispatchEvent(new CustomEvent('rc:sessions-updated',{detail:{reason:'outcome-deleted',sessionId:id}}));});
  form.addEventListener('submit', event => {
    event.preventDefault(); const data = new FormData(form); const id = data.get('id'); const existing = sessions.find(item => item.id === id);
    if(existing?.outcome && data.get('date') > localDate()){
      window.alert('Una seduta già registrata non può essere spostata nel futuro. Elimina prima la registrazione.');
      return;
    }
    const category = data.get('category'); let session = {
      id:id || (crypto.randomUUID ? crypto.randomUUID() : `session-${Date.now()}`), date:data.get('date'), category,
      title:data.get('title').trim(),durationMin:Number(data.get('durationMin')),priority:data.get('priority'),details:detailsFromForm(data,category),
      notes:data.get('notes').trim(),outcome:existing?.outcome||null,titleMode,createdAt:existing?.createdAt || new Date().toISOString(),updatedAt:new Date().toISOString(),...(existing?.planImport?{planImport:existing.planImport}:{}),...(existing?.goalId?{goalId:existing.goalId}:{}),...(existing?.goalGenerated?{goalGenerated:true}:{}),...(existing?.goalSyncedAt?{goalSyncedAt:existing.goalSyncedAt}:{})
    };
    session=prescriptionModel?.enrichSession?.(session,prescriptionContext())||session;
    if (existing) sessions = sessions.map(item => item.id === id ? session : item); else sessions.push(session);
    {const date=new Date(`${session.date}T12:00:00`);calendarCursor=new Date(date.getFullYear(),date.getMonth(),1);listWeekStart=planViewModel.mondayFor(session.date);}
    save(); render(); close(); toast();document.dispatchEvent(new CustomEvent('rc:sessions-updated',{detail:{reason:'session-saved',sessionId:session.id}}));
  });
  document.getElementById('delete-session').addEventListener('click', () => {
    const id = form.elements.id.value; if (!id) return;
    if (!window.confirm('Eliminare definitivamente questa seduta?')) return;
    sessions = sessions.filter(item => item.id !== id); save(); render(); close(); toast();document.dispatchEvent(new CustomEvent('rc:sessions-updated',{detail:{reason:'session-deleted',sessionId:id}}));
  });
  function replaceWeek(weekStart,newSessions){const start=new Date(`${weekStart}T12:00:00`);const end=new Date(start);end.setDate(end.getDate()+6);const startKey=weekStart;const endKey=`${end.getFullYear()}-${String(end.getMonth()+1).padStart(2,'0')}-${String(end.getDate()).padStart(2,'0')}`;const existingWeek=sessions.filter(item=>item.date>=startKey&&item.date<=endKey),locked=existingWeek.filter(item=>item.outcome||item.date<=localDate()||item.goalSubstitution||(!item.planImport&&item.generated!==true&&!String(item.id||'').startsWith('sample-'))),lockedDates=new Set(locked.map(item=>item.date)),drafts=structuredClone(newSessions).filter(item=>!lockedDates.has(item.date)),incoming=prescriptionModel?.enrichSessions?.(drafts,prescriptionContext())?.sessions||drafts;sessions=sessions.filter(item=>item.date<startKey||item.date>endKey).concat(locked,incoming);selectedIds=selectionModel.prune(selectedIds,sessions);calendarCursor=new Date(start.getFullYear(),start.getMonth(),1);listWeekStart=weekStart;save();render();document.dispatchEvent(new CustomEvent('rc:sessions-updated',{detail:{reason:'plan-replaced',weekStart}}));}
  function restoreWeekAdjustments(weekStart){if(!adjustmentModel)return 0;const end=new Date(`${weekStart}T12:00:00`);end.setDate(end.getDate()+6);const endKey=dateKey(end),today=localDate();const affected=sessions.filter(item=>item.adaptiveAdjustment&&!item.goalSubstitution&&!item.outcome&&item.date>today&&((item.date>=weekStart&&item.date<=endKey)||(item.adaptiveAdjustment.source?.date>=weekStart&&item.adaptiveAdjustment.source?.date<=endKey)));if(!affected.length)return 0;const ids=new Set(affected.map(item=>item.id));sessions=sessions.map(item=>ids.has(item.id)?adjustmentModel.restoreSession(item):item);save();render();document.dispatchEvent(new CustomEvent('rc:sessions-updated',{detail:{reason:'adaptive-plan-restored',weekStart,sessionIds:[...ids]}}));return ids.size;}
  function reload(){sessions=load();selectionMode=false;selectedIds.clear();calendarCursor=relevantCalendarMonth();listWeekStart=planViewModel.mondayFor(localDate());render();}
  function showMonth(value){const date=new Date(`${value}-01T12:00:00`);if(Number.isNaN(date.getTime()))return;calendarCursor=new Date(date.getFullYear(),date.getMonth(),1);render();}
  function syncGoalSession(goal,options={}){
    if(!goal||goal.status!=='planned'||!goalsModel?.sessionFromGoal)return null;const stamp=new Date().toISOString(),generated=session=>goalsModel.isGoalGeneratedSession?.(session)??Boolean(session?.goalGenerated);
    const applySubstitution=sessionId=>{const result=goalsModel.applyGoalSubstitution?.(sessions,goal,{goalSessionId:sessionId,now:stamp});if(result?.changed)sessions=result.sessions;return result;};
    let inferred=goal.inferredFromSessionId&&sessions.find(item=>item.id===goal.inferredFromSessionId);
    if(inferred&&!generated(inferred)){
      let aligned=false;if(options.authoritativeDate&&inferred.date!==goal.date&&!inferred.outcome){inferred={...inferred,date:goal.date,updatedAt:stamp};sessions=sessions.map(item=>item.id===inferred.id?inferred:item);aligned=true;}const cleanup=goalsModel.reconcileGoalGeneratedSessions?.(sessions,goal,inferred.id);if(cleanup?.changed)sessions=cleanup.sessions;const substitution=applySubstitution(inferred.id);
      if(aligned||cleanup?.changed||substitution?.changed){selectedIds=selectionModel.prune(selectedIds,sessions);save();render();document.dispatchEvent(new CustomEvent('rc:sessions-updated',{detail:{reason:substitution?.deletedIds?.length?'goal-long-replaced':aligned?'goal-race-date-updated':'goal-session-reconciled',sessionId:inferred.id,goalId:goal.id,removedIds:[...(cleanup?.removedIds||[]),...(substitution?.deletedIds||[])],detachedIds:cleanup?.detachedIds||[]}}));}return inferred.id;
    }
    const draft=goalsModel.sessionFromGoal(goal);if(!draft)return null;const existing=sessions.find(item=>item.goalId===goal.id||item.id===draft.id||item.id===goal.inferredFromSessionId);let next=existing;
    if(!(generated(existing)&&existing.goalSyncedAt===goal.updatedAt)){
      if(existing){next={...draft,id:existing.id,createdAt:existing.createdAt||draft.createdAt,outcome:existing.outcome||null,updatedAt:existing.updatedAt};const comparableCurrent=JSON.stringify(existing),comparableNext=JSON.stringify(next);if(comparableCurrent!==comparableNext){next.updatedAt=stamp;sessions=sessions.map(item=>item.id===existing.id?next:item);}}else{sessions.push(draft);next=draft;}
    }
    const substitution=applySubstitution(next.id),sessionChanged=!existing||JSON.stringify(existing)!==JSON.stringify(next);
    if(sessionChanged||substitution?.changed){save();render();document.dispatchEvent(new CustomEvent('rc:sessions-updated',{detail:{reason:substitution?.deletedIds?.length?'goal-long-replaced':'goal-session-synced',sessionId:next.id,goalId:goal.id,removedIds:substitution?.deletedIds||[]}}));}return next.id;
  }
  function removeGoalSession(goalId){const generated=session=>goalsModel?.isGoalGeneratedSession?.(session)??Boolean(session?.goalGenerated);const targets=sessions.filter(item=>generated(item)&&(item.goalId===goalId||item.id===`goal-session:${goalId}`)),targetIds=new Set(targets.map(item=>item.id));sessions=sessions.flatMap(item=>{if(!targetIds.has(item.id))return[item];if(!item.outcome)return[];const{goalId:ignoredGoal,goalGenerated:ignoredGenerated,goalSyncedAt:ignoredSync,...detached}=item;return[detached];});const restored=goalsModel?.restoreGoalSubstitution?.(sessions,goalId);if(restored?.changed)sessions=restored.sessions;if(!targets.length&&!restored?.changed)return false;selectedIds=selectionModel.prune(selectedIds,sessions);save();render();document.dispatchEvent(new CustomEvent('rc:sessions-updated',{detail:{reason:'goal-session-removed',goalId,restoredIds:restored?.restoredIds||[]}}));return true;}
  window.rcSessions={
    getAll:()=>structuredClone(sessions),
    replaceWeek,restoreWeekAdjustments,
    reload,showMonth,syncGoalSession,removeGoalSession,
    openEditor:id=>{const session=sessions.find(item=>item.id===id);open(session||null);},
    openOutcome:id=>{const session=sessions.find(item=>item.id===id);if(session)openOutcome(session);},
    describe:id=>{const session=sessions.find(item=>item.id===id);return session?targetText(session):'';}
  };
  window.addEventListener('rc:data-restored',()=>{sessions=load();selectedIds=selectionModel.prune(selectedIds,sessions);render();});
  document.addEventListener('rc:goals-updated',render);
  document.addEventListener('rc:reconciliation-updated',render);
  document.addEventListener('rc:whoop-updated',render);
  if(!(window.rcDataStore?.health?.().warnings||[]).includes('sessions'))save();
  render();
})();
