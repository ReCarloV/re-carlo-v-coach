(function(){
  const WEEKLY_KEY='rc-weekly-checkin-v1';
  const PRE_KEY='rc-pre-session-checkins-v1';
  const modal=document.getElementById('generator-modal');
  const preview=document.getElementById('generator-preview');
  const categoryLabels={running:'CORSA',cycling:'RULLI',strength:'FORZA',hyrox:'HYROX SPEC',metcon:'METCON',test:'TEST',recovery:'RECUPERO'};
  const categoryClasses={running:'run',cycling:'bike',strength:'strength',hyrox:'hyrox',metcon:'metcon',test:'test',recovery:'rest'};
  const adjustmentModel=window.rcWeeklyPlanAdjustmentModel;
  const applicationModel=window.rcAdaptiveApplicationModel;
  let proposal=null;

  function parse(key,fallback){try{return JSON.parse(localStorage.getItem(key))||fallback;}catch(_){return fallback;}}
  function iso(date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
  function localDate(){return iso(new Date());}
  function dateFor(start,index){const date=new Date(`${start}T12:00:00`);date.setDate(date.getDate()+index);return iso(date);}
  function addDays(value,days){const date=new Date(`${value}T12:00:00`);date.setDate(date.getDate()+days);return iso(date);}
  function roundFive(value){return Math.max(5,Math.round(Number(value)/5)*5);}
  function mondayFor(value){const date=new Date(`${value}T12:00:00`);const day=date.getDay()||7;date.setDate(date.getDate()-day+1);return iso(date);}
  function hrTarget(zone){const profile=parse('rc-athlete-profile-v1',{maxHr:0,restingHr:0,hrZoneMethod:'hrr'});return window.rcTrainingZonesModel.hrTarget(zone,{maxHr:profile.maxHr,restingHr:profile.restingHr,method:profile.hrZoneMethod,customUpper:parse('rc-hr-zones',null)})||zone;}
  function thresholdPace(){const profile=parse('rc-athlete-profile-v1',{});const pb=(profile.personalBests||[]).find(item=>item.id==='run-10k');if(!pb)return 'Passo da definire';const total=(pb.hours||0)*3600+(pb.minutes||0)*60+(pb.seconds||0);const pace=Math.round(total/10)+15;return `${Math.floor(pace/60)}:${String(pace%60).padStart(2,'0')}/km`;}
  function session(category,title,durationMin,priority,details,rationale){return {id:crypto.randomUUID?crypto.randomUUID():`generated-${Date.now()}-${Math.random()}`,category,title,durationMin,priority,details,notes:rationale,titleMode:'custom',generated:true,generatorVersion:2,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),rationale};}

  function easyRun(minutes){const duration=Math.max(30,Math.min(roundFive(minutes),60));return session('running','Easy run',duration,'important',{runType:'Easy run',distanceKm:null,runTarget:'hr',hrZone:'Z2',paceMin:5,paceSec:0,runRpe:4,runBlocks:[{type:'segment',phase:'warmup',unit:'min',amount:10,targetType:'free',target:''},{type:'segment',phase:'work',unit:'min',amount:Math.max(15,duration-15),targetType:'hr',target:hrTarget('Z2')},{type:'segment',phase:'cooldown',unit:'min',amount:5,targetType:'free',target:''}]},'Volume aerobico facile per aumentare la frequenza di corsa senza aggiungere intensità.');}
  function qualityRun(minutes,controlled=false){
    const duration=Math.max(controlled?40:50,Math.min(roundFive(minutes),controlled?60:65));
    if(controlled){const z3=duration>=50?8:5;const z2=Math.max(17,duration-10-8-z3);return session('running','Progressione controllata',duration,'essential',{runType:'Progression run',distanceKm:null,runTarget:'hr',hrZone:'Z2',paceMin:5,paceSec:0,runRpe:6,runBlocks:[{type:'segment',phase:'warmup',unit:'min',amount:10,targetType:'free',target:''},{type:'segment',phase:'work',unit:'min',amount:z2,targetType:'hr',target:hrTarget('Z2')},{type:'segment',phase:'work',unit:'min',amount:z3,targetType:'hr',target:hrTarget('Z3')},{type:'segment',phase:'cooldown',unit:'min',amount:8,targetType:'free',target:''}]},'La qualità diventa una progressione controllata per assorbire i segnali recenti senza perdere continuità.');}
    return session('running','Intervalli soglia controllati',duration,'essential',{runType:'Intervals',distanceKm:null,runTarget:'pace',hrZone:'Z3',paceMin:4,paceSec:15,runRpe:7,runBlocks:[{type:'segment',phase:'warmup',unit:'min',amount:12,targetType:'free',target:''},{type:'repeat',repeats:6,steps:[{type:'segment',phase:'work',unit:'min',amount:3,targetType:'pace',target:thresholdPace()},{type:'segment',phase:'recovery',unit:'min',amount:2,targetType:'free',target:''}]},{type:'segment',phase:'cooldown',unit:'min',amount:10,targetType:'free',target:''}]},'Stimolo di soglia utile alla maratona, costruito sul PB attuale dei 10 km.');
  }
  function longRun(minutes,level){const duration=Math.max(45,roundFive(minutes));const reasons={protect:'Lungo mantenuto in forma ridotta per proteggere il recupero.',reduce:'Lungo ridotto senza eliminare lo stimolo aerobico chiave.',steady:'Seduta chiave per costruire la resistenza specifica verso l’obiettivo principale.',progress:'Piccola progressione del lungo, limitata al tempo massimo dichiarato.'};return session('running','Lungo aerobico',duration,'essential',{runType:'Long run',distanceKm:null,runTarget:'hr',hrZone:'Z2',paceMin:5,paceSec:0,runRpe:5,runBlocks:[{type:'segment',phase:'warmup',unit:'min',amount:10,targetType:'free',target:''},{type:'segment',phase:'work',unit:'min',amount:Math.max(25,duration-20),targetType:'hr',target:hrTarget('Z2')},{type:'segment',phase:'cooldown',unit:'min',amount:10,targetType:'free',target:''}]},reasons[level]||reasons.steady);}
  function upperStrength(minutes){return session('strength','Upper strength',Math.min(roundFive(minutes),70),'important',{strengthFocus:'Upper body',targetRir:2,strengthBlocks:[{name:'Bench Press',sets:'4',reps:'5',target:'RIR 2',rest:'2–3 min'},{name:'Weighted Pull-up',sets:'4',reps:'5',target:'RIR 2',rest:'2–3 min'},{name:'Military Press',sets:'3',reps:'6',target:'RIR 2',rest:'2 min'}],strengthAccessories:'Complementari upper back, cuffia e core facoltativi.'},'Mantiene forza di spinta e tirata senza interferire eccessivamente con il carico di corsa.');}
  function lowerStrength(minutes){return session('strength','Lower strength',Math.min(roundFive(minutes),70),'important',{strengthFocus:'Lower body',targetRir:2,strengthBlocks:[{name:'Back Squat',sets:'4',reps:'5',target:'RIR 2',rest:'3 min'},{name:'Romanian Deadlift',sets:'3',reps:'6',target:'RIR 2',rest:'2–3 min'}],strengthAccessories:'Unilaterali e core facoltativi, senza accumulare cedimento.'},'Conserva la forza degli arti inferiori con volume compatibile con la preparazione maratona.');}
  function fullStrength(minutes){return session('strength','Full body strength',Math.min(roundFive(minutes),70),'important',{strengthFocus:'Full body',targetRir:2,strengthBlocks:[{name:'Back Squat',sets:'3',reps:'5',target:'RIR 2',rest:'3 min'},{name:'Bench Press',sets:'3',reps:'5',target:'RIR 2',rest:'2–3 min'},{name:'Weighted Pull-up',sets:'3',reps:'5',target:'RIR 2',rest:'2–3 min'}],strengthAccessories:'Solo complementari essenziali se rimane tempo.'},'Un’unica seduta mantiene i principali pattern di forza nelle settimane più dense.');}
  function recoveryRide(minutes,rationale='Cardio a basso impatto per aggiungere lavoro aerobico favorendo il recupero.',priority='optional'){return session('cycling','Low impact recovery',Math.max(25,Math.min(roundFive(minutes),45)),priority,{rideType:'Recovery ride',powerSource:'Technogym Ride',ftpMin:50,ftpMax:60,cadence:90},rationale);}
  function lowImpactReplacement(minutes){return recoveryRide(minutes,'La qualità running viene sostituita da lavoro aerobico facile e a basso impatto; interrompi se il fastidio aumenta.','essential');}
  function recoverySession(minutes){return session('recovery','Recupero e rivalutazione',Math.max(20,Math.min(roundFive(minutes),40)),'essential',{recoveryType:'Cardio rigenerante'},'Dolore elevato: nessuna progressione running automatica. Recupero, mobilità o cardio tollerato e nuova valutazione prima di correre.');}
  function isLong(item){return item.category==='running'&&(item.details?.runType==='Long run'||/lungo/i.test(item.title||''));}
  function isQuality(item){return !isLong(item)&&item.priority==='essential'&&['running','cycling'].includes(item.category);}
  function isLowerStrength(item){return item.category==='strength'&&['Lower body','Full body'].includes(item.details?.strengthFocus);}
  function sessionRole(item){
    if(isLong(item))return 'long';
    if(item.category==='running'){const type=String(item.details?.runType||'').toLowerCase();return /(interval|tempo|threshold|progress|race)/.test(type)?'quality':'easy';}
    if(item.category==='strength')return `strength-${String(item.details?.strengthFocus||'').toLowerCase().replaceAll(' ','-')}`;
    if(item.category==='cycling')return item.priority==='essential'?'quality-low-impact':'cycling';
    return item.category;
  }

  function adaptStrength(item,analysis){
    if(item.category!=='strength')return item;const settings=analysis.settings;const reduction=settings.strengthSetReduction;
    const blocks=(item.details.strengthBlocks||[]).map(block=>({...block,sets:String(Math.max(2,(Number(block.sets)||3)-reduction)),target:`RIR ${settings.strengthRir}`}));
    const rationale=settings.strengthRir>2?`${item.rationale} Volume ridotto e target RIR ${settings.strengthRir} in base ai dati recenti.`:item.rationale;
    return {...item,details:{...item.details,targetRir:settings.strengthRir,strengthBlocks:blocks},rationale,notes:rationale};
  }
  function desiredTemplates(count,weekly,analysis){
    if(count<=0)return [];
    const settings=analysis.settings;const normalMinutes=Number(weekly.sessionMinutes)||60;const adaptedMinutes=roundFive(normalMinutes*settings.volumeFactor);
    const maxLong=Number(weekly.longRunMinutes)||120;const baseLong=Math.min(maxLong,Math.max(75,normalMinutes+30));const adaptedLong=Math.min(maxLong,roundFive(baseLong*settings.longFactor));
    const quality=settings.lowerBodyProtection?lowImpactReplacement(adaptedMinutes):qualityRun(adaptedMinutes,settings.qualityMode==='controlled');
    const singleStrength=settings.lowerBodyProtection?upperStrength(adaptedMinutes):fullStrength(adaptedMinutes);
    const secondStrength=settings.lowerBodyProtection?recoveryRide(adaptedMinutes,'Il secondo lavoro per gli arti inferiori lascia spazio a recupero low impact.'):settings.lowerBodyCaution?fullStrength(adaptedMinutes):lowerStrength(adaptedMinutes);
    const long=settings.suspendRunning?recoverySession(adaptedLong):longRun(adaptedLong,analysis.level);
    let templates=[];
    if(count===1)templates=[long];
    else if(count===2)templates=[singleStrength,long];
    else if(count===3)templates=[singleStrength,quality,long];
    else if(count===4)templates=[easyRun(adaptedMinutes),singleStrength,quality,long];
    else if(count===5)templates=[easyRun(adaptedMinutes),upperStrength(adaptedMinutes),quality,secondStrength,long];
    else templates=[easyRun(adaptedMinutes),upperStrength(adaptedMinutes),quality,secondStrength,recoveryRide(adaptedMinutes),long];
    if(settings.suspendRunning)templates=templates.map(item=>item.category==='running'?recoverySession(adaptedMinutes):item);
    return templates.map(item=>adaptStrength(item,analysis));
  }
  function isUserManual(item){return !item.planImport&&item.generated!==true&&!String(item.id||'').startsWith('sample-');}
  function lockedSessions(all,start,end,today){return all.filter(item=>item.date>=start&&item.date<=end&&(item.outcome||item.date<=today||isUserManual(item)));}
  function consumeLocked(templates,locked){
    const remaining=[...templates];const removalRank={optional:0,important:1,essential:2};
    locked.forEach(item=>{
      if(!remaining.length)return;const role=sessionRole(item);let index=remaining.findIndex(candidate=>sessionRole(candidate)===role);
      if(index<0&&item.category==='strength')index=remaining.findIndex(candidate=>candidate.category==='strength');
      if(index<0){const fallback=remaining.map((candidate,candidateIndex)=>({candidate,index:candidateIndex,score:(removalRank[candidate.priority]??1)+(isLong(candidate)||isQuality(candidate)?10:0)})).sort((a,b)=>a.score-b.score)[0];index=fallback.index;}
      remaining.splice(index,1);
    });
    return remaining;
  }
  function chooseSlots(slots,count,needsLong){if(slots.length<=count)return [...slots];if(!needsLong)return slots.slice(0,count);const weekend=slots.filter(slot=>slot.index>=5).slice(-1)[0]||slots[slots.length-1];return [...slots.filter(slot=>slot!==weekend).slice(0,count-1),weekend].sort((a,b)=>a.date.localeCompare(b.date));}
  function gapDays(a,b){return Math.abs((new Date(`${a}T12:00:00`)-new Date(`${b}T12:00:00`))/86400000);}
  function assignTemplates(templates,slots){
    const remainingTemplates=[...templates],remainingSlots=[...slots],assigned=[],warnings=[];
    function use(template,slot,source=template){remainingTemplates.splice(remainingTemplates.indexOf(source),1);remainingSlots.splice(remainingSlots.indexOf(slot),1);assigned.push({...template,date:slot.date});}
    const long=remainingTemplates.find(isLong);let longSlot=null;
    if(long&&remainingSlots.length){longSlot=remainingSlots.filter(slot=>slot.index>=5).slice(-1)[0]||remainingSlots[remainingSlots.length-1];use(long,longSlot);}
    const quality=remainingTemplates.find(isQuality);let qualitySlot=null;
    if(quality&&remainingSlots.length){
      qualitySlot=[...remainingSlots].sort((a,b)=>(longSlot?gapDays(b.date,longSlot.date)-gapDays(a.date,longSlot.date):a.date.localeCompare(b.date))||a.date.localeCompare(b.date))[0];
      const tooClose=longSlot&&gapDays(qualitySlot.date,longSlot.date)<2;
      if(tooClose&&quality.category==='running'){
        const easier=easyRun(quality.durationMin);const rationale='I giorni disponibili non lasciano 48 ore prima del lungo: la qualità viene convertita automaticamente in corsa facile.';
        use({...easier,priority:'important',rationale,notes:rationale},qualitySlot,quality);warnings.push('Qualità running convertita in corsa facile perché troppo vicina al lungo.');
      }else{
        use(quality,qualitySlot);
        if(tooClose)warnings.push('Qualità low impact e lungo sono ravvicinati: mantieni il lavoro facile e rivaluta il recupero.');
      }
    }
    const lower=remainingTemplates.find(isLowerStrength);
    if(lower&&remainingSlots.length){const anchors=[longSlot,qualitySlot].filter(Boolean);const slot=[...remainingSlots].sort((a,b)=>{const score=item=>anchors.length?Math.min(...anchors.map(anchor=>gapDays(item.date,anchor.date))):0;return score(b)-score(a)||a.date.localeCompare(b.date);})[0];use(lower,slot);}
    remainingSlots.sort((a,b)=>a.date.localeCompare(b.date));remainingTemplates.forEach((template,index)=>{if(remainingSlots[index])assigned.push({...template,date:remainingSlots[index].date});});
    return {sessions:assigned.sort((a,b)=>a.date.localeCompare(b.date)),warnings};
  }
  function assignImportedPlan(templates,slots,analysis){
    const remainingTemplates=[...templates],remainingSlots=[...slots],assigned=[],warnings=[];
    function use(template,slot){remainingTemplates.splice(remainingTemplates.indexOf(template),1);remainingSlots.splice(remainingSlots.indexOf(slot),1);assigned.push(adjustmentModel.withScheduledDate(template,slot.date,analysis));}
    const long=remainingTemplates.find(isLong);let longSlot=null;if(long&&remainingSlots.length){longSlot=remainingSlots.filter(slot=>slot.index>=5).slice(-1)[0]||remainingSlots[remainingSlots.length-1];use(long,longSlot);}
    const quality=remainingTemplates.find(isQuality);let qualitySlot=null;if(quality&&remainingSlots.length){qualitySlot=[...remainingSlots].sort((a,b)=>(longSlot?gapDays(b.date,longSlot.date)-gapDays(a.date,longSlot.date):a.date.localeCompare(b.date))||a.date.localeCompare(b.date))[0];use(quality,qualitySlot);if(longSlot&&gapDays(qualitySlot.date,longSlot.date)<2){const index=assigned.findIndex(item=>item.id===quality.id);assigned[index]=adjustmentModel.withInstruction(assigned[index],'Qualità e lungo sono ravvicinati: mantieni la qualità controllata e rivaluta il recupero prima della seduta.',analysis);warnings.push('Qualità e lungo hanno meno di 48 ore: la proposta lo segnala senza riscrivere la prescrizione originale.');}}
    const lower=remainingTemplates.find(isLowerStrength);if(lower&&remainingSlots.length){const anchors=[longSlot,qualitySlot].filter(Boolean);const slot=[...remainingSlots].sort((a,b)=>{const score=item=>anchors.length?Math.min(...anchors.map(anchor=>gapDays(item.date,anchor.date))):0;return score(b)-score(a)||a.date.localeCompare(b.date);})[0];use(lower,slot);}
    remainingSlots.sort((a,b)=>a.date.localeCompare(b.date));while(remainingTemplates.length&&remainingSlots.length)use(remainingTemplates[0],remainingSlots[0]);return{sessions:assigned.sort((a,b)=>a.date.localeCompare(b.date)),warnings};
  }
  function adaptationFor(weekly,allSessions){const bodyIssues=(window.rcBodyIssues?.active?.()||[]).map(issue=>({...issue,latestPain:window.rcBodyIssues.latest(issue)}));return window.rcAdaptiveEngine.analyze({sessions:allSessions,preCheckins:parse(PRE_KEY,[]),bodyIssues,whoopCycles:window.rcDataStore?.getDataset('whoopCycles')||[],whoopSleeps:window.rcDataStore?.getDataset('whoopSleeps')||[],targetWeekStart:weekly.weekStart});}
  function build(){
    const stored=parse(WEEKLY_KEY,null);if(!stored)return {missing:true};const weekly={...stored,weekStart:mondayFor(stored.weekStart)};
    const dayIndex={Lun:0,Mar:1,Mer:2,Gio:3,Ven:4,Sab:5,Dom:6};const allSessions=window.rcSessions.getAll();const analysis=adaptationFor(weekly,allSessions);
    const selected=(weekly.days||[]).map(day=>({day,index:dayIndex[day],date:dateFor(weekly.weekStart,dayIndex[day])})).filter(item=>Number.isInteger(item.index)).sort((a,b)=>a.index-b.index);if(!selected.length)return {missingDays:true,weekly};
    const requested=Number(weekly.sessions)||5;const adaptedCount=Math.max(1,Math.min(6,requested+analysis.settings.sessionDelta));const end=addDays(weekly.weekStart,6);const today=localDate();const weekSessions=allSessions.filter(item=>item.date>=weekly.weekStart&&item.date<=end);const locked=lockedSessions(allSessions,weekly.weekStart,end,today);const lockedIds=new Set(locked.map(item=>item.id)),lockedDates=new Set(locked.map(item=>item.date));const available=selected.filter(slot=>slot.date>=today&&!lockedDates.has(slot.date));const importedPlan=weekSessions.filter(item=>item.planImport&&!lockedIds.has(item.id));const hasAppliedAdjustments=weekSessions.some(item=>item.adaptiveAdjustment&&!item.outcome&&item.date>today);
    let assigned,sourceMode='generated',adjustedPlan=null;
    if(importedPlan.length&&adjustmentModel){
      sourceMode='excel';const targetCount=Math.min(importedPlan.length,Math.max(0,adaptedCount-locked.length),available.length);adjustedPlan=adjustmentModel.buildAdjustment({sessions:importedPlan,analysis,targetCount,now:new Date()});const slots=chooseSlots(available,adjustedPlan.active.length,adjustedPlan.active.some(isLong));const scheduled=assignImportedPlan(adjustedPlan.active,slots,analysis);assigned={sessions:[...scheduled.sessions,...adjustedPlan.paused].sort((a,b)=>a.date.localeCompare(b.date)),warnings:scheduled.warnings};
    }else{
      let templates=consumeLocked(desiredTemplates(adaptedCount,weekly,analysis),locked);const capacity=Math.min(templates.length,available.length);if(capacity<templates.length){const rank={essential:0,important:1,optional:2};templates=[...templates].sort((a,b)=>rank[a.priority]-rank[b.priority]||(isLong(b)?1:0)-(isLong(a)?1:0)).slice(0,capacity);}const slots=chooseSlots(available,templates.length,templates.some(isLong));assigned=assignTemplates(templates,slots);
    }
    const normalMinutes=Number(weekly.sessionMinutes)||60;const baseLong=Math.min(Number(weekly.longRunMinutes)||120,Math.max(75,normalMinutes+30));const plannedLong=assigned.sessions.find(isLong)?.durationMin;
    const changes=[];const adaptedMinutes=roundFive(normalMinutes*analysis.settings.volumeFactor);
    if(analysis.organization?.level==='adapt'&&analysis.settings.physiologySessionDelta===0&&adaptedCount<requested)changes.push(`Una seduta in meno per rendere la settimana coerente con i ${analysis.organization.total14} vincoli organizzativi recenti; durata e intensità delle singole sedute restano invariate.`);
    else if(analysis.organization?.level==='adapt'&&adaptedCount<requested)changes.push('I vincoli organizzativi confermano il limite di una seduta in meno già indicato dai segnali di recupero.');
    if(sourceMode==='generated'&&adaptedMinutes!==normalMinutes)changes.push(`Durata abituale ridotta da ${normalMinutes} a circa ${adaptedMinutes} minuti.`);
    if(sourceMode==='generated'&&plannedLong&&plannedLong!==baseLong)changes.push(`Lungo adattato da ${baseLong} a ${plannedLong} minuti.`);
    if(sourceMode==='generated'&&assigned.sessions.some(item=>item.details?.runType==='Progression run'))changes.push('Qualità trasformata in progressione controllata.');
    if(sourceMode==='generated'&&assigned.sessions.some(item=>/non lasciano 48 ore/i.test(item.rationale||'')))changes.push('Qualità running convertita in corsa facile per proteggere il lungo ravvicinato.');
    if(sourceMode==='generated'&&analysis.settings.strengthRir>2&&assigned.sessions.some(item=>item.category==='strength'))changes.push(`Forza impostata a RIR ${analysis.settings.strengthRir} con una serie in meno sui fondamentali.`);
    if(sourceMode==='generated'&&analysis.settings.lowerBodyProtection&&assigned.sessions.some(item=>item.category==='cycling'))changes.push('Qualità running sostituita con lavoro low impact; nessun nuovo lower pesante viene aggiunto.');
    if(sourceMode==='generated'&&analysis.settings.suspendRunning)changes.push('Running sospeso nella proposta automatica fino a nuova valutazione.');
    if(sourceMode==='excel'){
      if(adjustedPlan.paused.length)changes.push(`${adjustedPlan.paused.length} sedut${adjustedPlan.paused.length===1?'a sospesa':'e sospese'} senza eliminar${adjustedPlan.paused.length===1?'la':'le'} dal piano: potr${adjustedPlan.paused.length===1?'à':'anno'} essere ripristinat${adjustedPlan.paused.length===1?'a':'e'}.`);
      const instructions=[...new Set(assigned.sessions.flatMap(item=>item.adaptiveAdjustment?.instructions||[]))];instructions.forEach(instruction=>{if(!changes.includes(instruction))changes.push(instruction);});
      if(!adjustedPlan.changed&&!assigned.sessions.some(item=>item.adaptiveAdjustment))changes.push('Il programma Excel resta invariato: i dati non giustificano correzioni.');
    }
    if(!changes.length)changes.push(analysis.level==='progress'?'Solo il lungo aumenta del 5%, senza alzare l’intensità.':'Struttura e carico della settimana restano invariati.');
    const alerts=[...assigned.warnings];const activeProposed=assigned.sessions.filter(item=>item.adaptiveAdjustment?.status!=='paused').length;if(available.length+locked.length<adaptedCount)alerts.push(`Con i giorni disponibili la proposta contiene ${locked.length+activeProposed} sedute attive invece di ${adaptedCount}.`);if(sourceMode==='excel'&&importedPlan.length<Math.max(0,adaptedCount-locked.length))alerts.push('Il coach non aggiunge sedute generiche oltre a quelle previste dal programma Excel.');if(adaptedCount<requested)alerts.push(analysis.organization?.level==='adapt'&&analysis.settings.physiologySessionDelta===0?`Il coach propone temporaneamente ${adaptedCount} sedute invece di ${requested} per aumentare la fattibilità della settimana.`:`Il motore riduce temporaneamente il numero massimo da ${requested} a ${adaptedCount} sedute.`);if(locked.length)alerts.push(`${locked.length} sedut${locked.length===1?'a':'e'} già registrat${locked.length===1?'a':'e'}, passat${locked.length===1?'a':'e'} o manual${locked.length===1?'e':'i'} restano intatt${locked.length===1?'a':'e'}.`);
    return {weekly,sessions:assigned.sessions,lockedSessions:locked.sort((a,b)=>a.date.localeCompare(b.date)),alerts,analysis,changes,requested,adaptedCount,sourceMode,hasAppliedAdjustments};
  }

  function renderAdaptation(analysis){
    const box=document.getElementById('generator-adaptation');box.className=`generator-adaptation ${analysis.level}`;box.replaceChildren();
    const copy=document.createElement('div');const overline=document.createElement('small');overline.textContent='ADATTAMENTO AUTOMATICO';const title=document.createElement('strong');title.textContent=analysis.label;const summary=document.createElement('p');summary.textContent=analysis.summary;copy.append(overline,title,summary);
    const metrics=document.createElement('div');metrics.className='generator-metrics';analysis.metrics.forEach(item=>{const chip=document.createElement('span');chip.className=item.tone;const label=document.createElement('small');label.textContent=item.label;const value=document.createElement('b');value.textContent=item.value;chip.append(label,value);metrics.append(chip);});box.append(copy,metrics);
  }
  function renderRow(item,preserved=false){const date=new Date(`${item.date}T12:00:00`);const paused=item.adaptiveAdjustment?.status==='paused',adjusted=Boolean(item.adaptiveAdjustment);const row=document.createElement('article');row.className=`generator-session${preserved?' preserved':''}${paused?' paused':''}${adjusted&&!paused?' adjusted':''}`;const dateBox=document.createElement('div');dateBox.className='generator-date';const day=document.createElement('small');day.textContent=date.toLocaleDateString('it-IT',{weekday:'short'}).replace('.','').toUpperCase();const number=document.createElement('strong');number.textContent=String(date.getDate()).padStart(2,'0');dateBox.append(day,number);const content=document.createElement('div');const title=document.createElement('h3');title.textContent=item.title;const reason=document.createElement('p');const today=localDate();reason.textContent=preserved?(item.outcome?'Già registrata: il coach non la modifica.':item.date<today?'Seduta passata mantenuta per permettere la registrazione.':item.date===today?'Seduta di oggi mantenuta senza modifiche.':'Seduta manuale mantenuta senza modifiche.'):adjusted?(item.adaptiveAdjustment.instructions||[]).join(' '):(item.rationale||'Prescrizione del programma Excel confermata senza modifiche.');content.append(title,reason);const tag=document.createElement('span');tag.className=`tag ${preserved?'preserved':paused?'rest':categoryClasses[item.category]||'rest'}`;tag.textContent=preserved?'MANTENUTA':paused?'SOSPESA':adjusted?'ADATTATA':categoryLabels[item.category]||item.category.toUpperCase();row.append(dateBox,content,tag);return row;}
  function renderRationale(current){const box=document.getElementById('generator-rationale');box.replaceChildren();const title=document.createElement('strong');title.textContent='Perché questo piano';const summary=document.createElement('p');summary.textContent=current.analysis.summary;const reasons=document.createElement('ul');current.analysis.reasons.forEach(reason=>{const item=document.createElement('li');item.textContent=reason;reasons.append(item);});const changes=document.createElement('div');changes.className='generator-changes';current.changes.forEach(change=>{const item=document.createElement('span');item.textContent=change;changes.append(item);});box.append(title,summary,reasons,changes);}
  function openProposal(){
    proposal=build();if(proposal.missing){window.alert('Completa prima il check-in della settimana.');document.getElementById('open-weekly-checkin').click();return;}if(proposal.missingDays){window.alert('Seleziona almeno un giorno disponibile nel check-in settimanale.');return;}
    preview.replaceChildren();[...proposal.lockedSessions,...proposal.sessions].sort((a,b)=>a.date.localeCompare(b.date)).forEach(item=>preview.append(renderRow(item,proposal.lockedSessions.some(locked=>locked.id===item.id))));
    const active=proposal.sessions.filter(item=>item.adaptiveAdjustment?.status!=='paused').length,total=proposal.lockedSessions.length+proposal.sessions.length,paused=proposal.sessions.length-active;document.getElementById('generator-summary').textContent=`${total} voci · ${proposal.lockedSessions.length+active} sedute attive${paused?` · ${paused} sospes${paused===1?'a':'e'}`:''} · settimana dal ${new Date(`${proposal.weekly.weekStart}T12:00:00`).toLocaleDateString('it-IT')} · ${proposal.sourceMode==='excel'?'base programma Excel':'piano generato localmente'}`;
    document.getElementById('generator-restore').hidden=!proposal.hasAppliedAdjustments;renderAdaptation(proposal.analysis);const alert=document.getElementById('generator-alert');alert.hidden=!proposal.alerts.length;alert.textContent=proposal.alerts.join(' ');renderRationale(proposal);modal.classList.add('open');modal.setAttribute('aria-hidden','false');
  }
  function close(){modal.classList.remove('open');modal.setAttribute('aria-hidden','true');}

  document.getElementById('generate-week').addEventListener('click',openProposal);
  document.getElementById('generator-close').addEventListener('click',close);
  document.getElementById('generator-cancel').addEventListener('click',close);
  document.getElementById('generator-restore').addEventListener('click',()=>{if(!proposal||!window.confirm('Ripristinare le prescrizioni originali del programma Excel per questa settimana? Esiti e sedute manuali resteranno invariati.'))return;window.rcSessions.restoreWeekAdjustments(proposal.weekly.weekStart);close();toast();});
  document.getElementById('generator-confirm').addEventListener('click',()=>{if(!proposal)return;const sessions=applicationModel?.markSessions?applicationModel.markSessions(proposal.sessions,proposal.analysis,proposal.weekly.weekStart,new Date()):proposal.sessions;window.rcSessions.replaceWeek(proposal.weekly.weekStart,sessions);close();toast();});
  document.addEventListener('rc:weekly-checkin-updated',()=>setTimeout(openProposal,0));
  window.rcGenerator={build,open:openProposal};
})();
