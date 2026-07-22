(function(){
  const WEEKLY_KEY='rc-weekly-checkin-v1';
  const PRE_KEY='rc-pre-session-checkins-v1';
  const modal=document.getElementById('generator-modal');
  const preview=document.getElementById('generator-preview');
  const categoryLabels={running:'CORSA',swimming:'NUOTO',cycling:'BICI',strength:'FORZA',hyrox:'HYROX SPEC',metcon:'METCON',test:'TEST',recovery:'RECUPERO'};
  const categoryClasses={running:'run',swimming:'swim',cycling:'bike',strength:'strength',hyrox:'hyrox',metcon:'metcon',test:'test',recovery:'rest'};
  const adjustmentModel=window.rcWeeklyPlanAdjustmentModel;
  const applicationModel=window.rcAdaptiveApplicationModel;
  const phaseModel=window.rcPhaseConstraintsModel;
  const microcycleModel=window.rcMicrocyclePrescriptionModel;
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
  function session(category,title,durationMin,priority,details,rationale){return {id:crypto.randomUUID?crypto.randomUUID():`generated-${Date.now()}-${Math.random()}`,category,title,durationMin,priority,details,notes:rationale,titleMode:'custom',generated:true,generatorVersion:3,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),rationale};}

  function easyRun(minutes){const duration=Math.max(30,Math.min(roundFive(minutes),90));return session('running','Easy run',duration,'important',{runType:'Easy run',distanceKm:null,runTarget:'hr',hrZone:'Z2',paceMin:5,paceSec:0,runRpe:4,runBlocks:[{type:'segment',phase:'warmup',unit:'min',amount:10,targetType:'free',target:''},{type:'segment',phase:'work',unit:'min',amount:Math.max(15,duration-15),targetType:'hr',target:hrTarget('Z2')},{type:'segment',phase:'cooldown',unit:'min',amount:5,targetType:'free',target:''}]},'Volume aerobico facile per aumentare la frequenza di corsa senza aggiungere intensità.');}
  function qualityRun(minutes,controlled=false){
    const duration=Math.max(controlled?40:50,Math.min(roundFive(minutes),controlled?60:65));
    if(controlled){const z3=duration>=50?8:5;const z2=Math.max(17,duration-10-8-z3);return session('running','Progressione controllata',duration,'essential',{runType:'Progression run',distanceKm:null,runTarget:'hr',hrZone:'Z2',paceMin:5,paceSec:0,runRpe:6,runBlocks:[{type:'segment',phase:'warmup',unit:'min',amount:10,targetType:'free',target:''},{type:'segment',phase:'work',unit:'min',amount:z2,targetType:'hr',target:hrTarget('Z2')},{type:'segment',phase:'work',unit:'min',amount:z3,targetType:'hr',target:hrTarget('Z3')},{type:'segment',phase:'cooldown',unit:'min',amount:8,targetType:'free',target:''}]},'La qualità diventa una progressione controllata per assorbire i segnali recenti senza perdere continuità.');}
    return session('running','Intervalli soglia controllati',duration,'essential',{runType:'Intervals',distanceKm:null,runTarget:'pace',hrZone:'Z3',paceMin:4,paceSec:15,runRpe:7,runBlocks:[{type:'segment',phase:'warmup',unit:'min',amount:12,targetType:'free',target:''},{type:'repeat',repeats:6,steps:[{type:'segment',phase:'work',unit:'min',amount:3,targetType:'pace',target:thresholdPace()},{type:'segment',phase:'recovery',unit:'min',amount:2,targetType:'free',target:''}]},{type:'segment',phase:'cooldown',unit:'min',amount:10,targetType:'free',target:''}]},'Stimolo di soglia utile alla maratona, costruito sul PB attuale dei 10 km.');
  }
  function qualityRunForPack(minutes,controlled,phaseConstraints){
    if(controlled)return qualityRun(minutes,true);
    const style=phaseConstraints?.generated?.qualityStyle||'normal';
    if(style==='recall')return qualityRecallRun(minutes,phaseConstraints);
    const presets={
      '5k':{title:'Intervalli ritmo 5 km',repeats:6,work:3,recovery:2,rpe:8,reason:'Stimolo specifico 5 km: ritmo ed economia ad alta intensità restano l’unica qualità running principale.'},
      '10k':{title:'Blocchi ritmo 10 km / soglia',repeats:4,work:6,recovery:2,rpe:8,reason:'Stimolo specifico 10 km coordinato con volume facile e recupero del microciclo.'},
      half:{title:'Blocchi soglia / ritmo mezza',repeats:3,work:10,recovery:3,rpe:7,reason:'Soglia e ritmo mezza vengono sviluppati senza trasformare il lungo in una seconda seduta intensa.'},
      '30k':{title:'Blocchi ritmo 30 km',repeats:3,work:10,recovery:3,rpe:7,reason:'Ritmo sostenibile specifico per la 30 km, separato dal lungo e subordinato alla tolleranza reale.'},
      marathon:{title:'Blocchi ritmo maratona',repeats:3,work:10,recovery:3,rpe:7,reason:'Ritmo maratona controllato: la dose deriva dalla fase e non cresce insieme al lungo nella stessa decisione.'},
      hill:{title:'Salite e terreno controllato',repeats:6,work:3,recovery:2,rpe:7,targetType:'rpe',reason:'Stimolo specifico per terreno e salite: intensità guidata da RPE e tecnica, non da un passo stradale fittizio.'},
      normal:{title:'Intervalli soglia controllati',repeats:6,work:3,recovery:2,rpe:7,reason:'Stimolo di soglia costruito sui riferimenti attuali e mantenuto come unica qualità running principale.'}
    };
    const preset=presets[style]||presets.normal,target=phaseConstraints?.targetPace?.label||thresholdPace(),seconds=Number(phaseConstraints?.targetPace?.secondsPerKm)||0,usePace=preset.targetType!=='rpe'&&seconds>0,minimum=12+preset.repeats*(preset.work+preset.recovery)+5,duration=Math.min(70,Math.max(roundFive(minutes),Math.ceil(minimum/5)*5)),cooldown=Math.max(5,duration-12-preset.repeats*(preset.work+preset.recovery)),paceTarget=target==='Passo da definire'?'RPE controllato':target,workTarget=usePace?paceTarget:preset.targetType==='rpe'?`RPE ${preset.rpe} · tecnica stabile sul terreno`:`${paceTarget} · RPE ${preset.rpe}`;
    return session('running',preset.title,duration,'essential',{runType:'Intervals',distanceKm:null,runTarget:usePace?'pace':'rpe',hrZone:'Z3',paceMin:usePace?Math.floor(seconds/60):0,paceSec:usePace?seconds%60:0,runRpe:preset.rpe,runBlocks:[{type:'segment',phase:'warmup',unit:'min',amount:12,targetType:'free',target:''},{type:'repeat',repeats:preset.repeats,steps:[{type:'segment',phase:'work',unit:'min',amount:preset.work,targetType:usePace?'pace':'rpe',target:workTarget},{type:'segment',phase:'recovery',unit:'min',amount:preset.recovery,targetType:'free',target:''}]},{type:'segment',phase:'cooldown',unit:'min',amount:cooldown,targetType:'free',target:''}]},preset.reason);
  }
  function qualityRecallRun(minutes,phaseConstraints){const duration=Math.max(30,Math.min(roundFive(minutes*.7),45)),pace=phaseConstraints?.targetPace?.label||'Ritmo gara controllato',seconds=Number(phaseConstraints?.targetPace?.secondsPerKm)||0;return session('running','Richiamo ritmo gara',duration,'essential',{runType:'Intervals',distanceKm:null,runTarget:seconds?'pace':'rpe',hrZone:'Z3',paceMin:seconds?Math.floor(seconds/60):0,paceSec:seconds?seconds%60:0,runRpe:6,runBlocks:[{type:'segment',phase:'warmup',unit:'min',amount:10,targetType:'free',target:''},{type:'repeat',repeats:4,steps:[{type:'segment',phase:'work',unit:'min',amount:2,targetType:seconds?'pace':'rpe',target:seconds?pace:'RPE 6 · ritmo gara controllato'},{type:'segment',phase:'recovery',unit:'min',amount:2,targetType:'free',target:''}]},{type:'segment',phase:'cooldown',unit:'min',amount:Math.max(5,duration-26),targetType:'free',target:''}]},'Richiamo breve di intensità: mantiene gesto e ritmo senza ricreare il volume di una seduta piena.');}
  function longRun(minutes,level){const duration=Math.max(45,roundFive(minutes));const reasons={protect:'Lungo mantenuto in forma ridotta per proteggere il recupero.',reduce:'Lungo ridotto senza eliminare lo stimolo aerobico chiave.',steady:'Seduta chiave per costruire la resistenza specifica verso l’obiettivo principale.',progress:'Piccola progressione del lungo, limitata al tempo massimo dichiarato.'};return session('running','Lungo aerobico',duration,'essential',{runType:'Long run',distanceKm:null,runTarget:'hr',hrZone:'Z2',paceMin:5,paceSec:0,runRpe:5,runBlocks:[{type:'segment',phase:'warmup',unit:'min',amount:10,targetType:'free',target:''},{type:'segment',phase:'work',unit:'min',amount:Math.max(25,duration-20),targetType:'hr',target:hrTarget('Z2')},{type:'segment',phase:'cooldown',unit:'min',amount:10,targetType:'free',target:''}]},reasons[level]||reasons.steady);}
  function upperStrength(minutes){return session('strength','Upper strength',Math.min(roundFive(minutes),70),'important',{strengthFocus:'Upper body',targetRir:2,strengthBlocks:[{name:'Bench Press',sets:'4',reps:'5',target:'RIR 2',rest:'2–3 min'},{name:'Weighted Pull-up',sets:'4',reps:'5',target:'RIR 2',rest:'2–3 min'},{name:'Military Press',sets:'3',reps:'6',target:'RIR 2',rest:'2 min'}],strengthAccessories:'Complementari upper back, cuffia e core facoltativi.'},'Mantiene forza di spinta e tirata senza interferire eccessivamente con il carico di corsa.');}
  function lowerStrength(minutes){return session('strength','Lower strength',Math.min(roundFive(minutes),70),'important',{strengthFocus:'Lower body',targetRir:2,strengthBlocks:[{name:'Back Squat',sets:'4',reps:'5',target:'RIR 2',rest:'3 min'},{name:'Romanian Deadlift',sets:'3',reps:'6',target:'RIR 2',rest:'2–3 min'}],strengthAccessories:'Unilaterali e core facoltativi, senza accumulare cedimento.'},'Conserva la forza degli arti inferiori con volume compatibile con la preparazione maratona.');}
  function fullStrength(minutes){return session('strength','Full body strength',Math.min(roundFive(minutes),70),'important',{strengthFocus:'Full body',targetRir:2,strengthBlocks:[{name:'Back Squat',sets:'3',reps:'5',target:'RIR 2',rest:'3 min'},{name:'Bench Press',sets:'3',reps:'5',target:'RIR 2',rest:'2–3 min'},{name:'Weighted Pull-up',sets:'3',reps:'5',target:'RIR 2',rest:'2–3 min'}],strengthAccessories:'Solo complementari essenziali se rimane tempo.'},'Un’unica seduta mantiene i principali pattern di forza nelle settimane più dense.');}
  function recoveryRide(minutes,rationale='Cardio a basso impatto per aggiungere lavoro aerobico favorendo il recupero.',priority='optional'){return session('cycling','Low impact recovery',Math.max(25,Math.min(roundFive(minutes),45)),priority,{rideType:'Recovery ride',powerSource:'Technogym Ride',ftpMin:50,ftpMax:60,cadence:90},rationale);}
  function triathlonSwimForContract(minutes,phaseConstraints,contract,descriptor){
    const mode=phaseConstraints?.limits?.triathlonMode||'foundation',longCourse=Boolean(contract?.pack?.overlay?.longCourse),second=/continuità|open-water|aerobico/i.test(descriptor?.label||'');
    const duration=Math.max(30,Math.min(roundFive(minutes),mode==='primer'?40:70)),effort=mode==='primer'?5:mode==='race-specific'?7:6;
    const blocks=second
      ?[{name:'Riscaldamento + assetto',volume:'10 min',target:'RPE 3–4 · respirazione fluida',rest:'Libero'},{name:longCourse?'Continuità aerobica':'Aerobico controllato',volume:`${Math.max(15,duration-20)} min`,target:`RPE ${effort} · tecnica stabile`,rest:'Pause brevi se la tecnica cala'},{name:'Defaticamento',volume:'5–10 min',target:'Facile',rest:'—'}]
      :[{name:'Riscaldamento tecnico',volume:'10 min',target:'RPE 3 · assetto e respirazione',rest:'Libero'},{name:'Tecnica + continuità',volume:`${Math.max(15,duration-20)} min`,target:`RPE ${Math.min(effort,6)} · qualità prima della velocità`,rest:'20–40 s tra blocchi'},{name:'Defaticamento',volume:'5–10 min',target:'Facile',rest:'—'}];
    const type=second?(longCourse?'Open water skills / continuità':'Aerobico continuo'):'Tecnica / efficienza';
    const rationale=`Il nuoto viene prescritto su tecnica, durata e RPE: CSS o passo non vengono inventati senza un test reale. ${contract?.pack?.overlay?.ruleCaution||''}`.trim();
    return session('swimming',second?'Nuoto · continuità specifica':'Nuoto · tecnica ed efficienza',duration,descriptor?.priority||'essential',{swimType:type,swimDistanceM:null,swimRpe:effort,swimStructuredBlocks:blocks,triathlonRole:'tri-swim',triathlonVariant:contract?.pack?.key||null},rationale);
  }
  function triathlonBikeForContract(minutes,phaseConstraints,contract){
    const mode=phaseConstraints?.limits?.triathlonMode||'foundation',longCourse=Boolean(contract?.pack?.overlay?.longCourse),primer=mode==='primer';
    const duration=Math.max(35,Math.min(roundFive(minutes*(longCourse&&!primer?1.35:1)),longCourse?150:90));
    const ftpMin=primer?55:longCourse?60:mode==='race-specific'?80:70,ftpMax=primer?70:longCourse?75:mode==='race-specific'?92:82;
    const title=primer?'Bici · race activation':longCourse?'Bici · endurance e pacing':'Bici · qualità specifica';
    const work=Math.max(15,duration-20),rideBlocks=[{type:'segment',phase:'warmup',unit:'min',amount:10,targetType:'ftp',target:'50–60% FTP',ftpMin:50,ftpMax:60,cadence:90,intensity:'easy'},{type:'segment',phase:'work',unit:'min',amount:work,targetType:'ftp',target:`${ftpMin}–${ftpMax}% FTP · potenza regolare`,ftpMin,ftpMax,cadence:88,intensity:longCourse?'endurance':'tempo'},{type:'segment',phase:'cooldown',unit:'min',amount:10,targetType:'ftp',target:'45–55% FTP',ftpMin:45,ftpMax:55,cadence:90,intensity:'easy'}];
    const rationale=longCourse?'Pacing e continuità ciclistica hanno priorità; durata e intensità non crescono insieme e il fueling viene provato nei lavori adatti.':'Qualità ciclistica controllata e specifica; profilo del percorso e drafting restano da confermare sull’evento.';
    return session('cycling',title,duration,'essential',{rideType:longCourse?'Endurance ride':'Tempo ride',powerSource:'Altro / da scegliere',ftpMin,ftpMax,cadence:88,rideBlocks,prescriptionLocked:true,triathlonRole:'tri-bike',triathlonVariant:contract?.pack?.key||null},rationale);
  }
  function triathlonRunForContract(minutes,analysis,phaseConstraints,contract){
    const longCourse=Boolean(contract?.pack?.overlay?.longCourse),mode=phaseConstraints?.limits?.triathlonMode||'foundation';
    let item=longCourse&&mode!=='primer'?longRun(Math.max(45,Math.min(roundFive(minutes*1.15),100)),analysis.level):qualityRunForPack(minutes,mode==='foundation',phaseConstraints);
    if(mode==='primer')item=easyRun(Math.min(minutes,35));
    const title=mode==='primer'?'Corsa · race activation':longCourse?'Corsa · endurance controllata':'Corsa · ritmo triathlon';
    const rationale=`${item.rationale} La tolleranza meccanica viene letta dagli esiti running e non dedotta dal volume in bici.`;
    return{...item,title,details:{...item.details,triathlonRole:'tri-run',triathlonVariant:contract?.pack?.key||null},rationale,notes:rationale};
  }
  function triathlonBrickForContract(minutes,phaseConstraints,contract){
    const mode=phaseConstraints?.limits?.triathlonMode||'foundation',longCourse=Boolean(contract?.pack?.overlay?.longCourse),primer=mode==='primer';
    const duration=Math.max(40,Math.min(roundFive(minutes),primer?45:90)),runMinutes=primer?8:longCourse?20:15,bikeMinutes=Math.max(25,duration-runMinutes-5),ftpMin=primer?55:longCourse?65:75,ftpMax=primer?70:longCourse?78:88;
    const rideBlocks=[{type:'segment',phase:'warmup',unit:'min',amount:10,targetType:'ftp',target:'50–60% FTP',ftpMin:50,ftpMax:60,cadence:90,intensity:'easy'},{type:'segment',phase:'work',unit:'min',amount:Math.max(15,bikeMinutes-10),targetType:'ftp',target:`${ftpMin}–${ftpMax}% FTP · potenza stabile`,ftpMin,ftpMax,cadence:88,intensity:'tempo'}];
    const rationale='Brick frazionato per T2, controllo del pacing e corsa successiva: la bici e la corsa non aumentano insieme e la seduta non simula l’intera gara.';
    return session('cycling','Brick bici → corsa',duration,'essential',{rideType:'Brick ride',powerSource:'Altro / da scegliere',ftpMin,ftpMax,cadence:88,rideBlocks,prescriptionLocked:true,brickRun:{durationMin:runMinutes,target:longCourse?'RPE 5–6 · passo sostenibile':'RPE 6–7 · ritmo controllato',transition:'T2 rapida ma ordinata'},triathlonRole:'tri-brick',triathlonVariant:contract?.pack?.key||null},rationale);
  }
  function hyroxSpecific(minutes,mode='foundation'){
    const presets={foundation:{title:'HYROX tecnica + engine',format:'HYROX stations',rpe:6,cap:55,blocks:[{name:'Tecnica SkiErg / Row',volume:'3 × 4 min',target:'RPE 6',rest:'2 min'},{name:'Sled + wall ball skill',volume:'3 giri tecnici',target:'Qualità',rest:'2 min'}],rationale:'Tecnica e base ibrida a costo controllato, senza simulazione prematura.'},specific:{title:'HYROX strength endurance',format:'HYROX partial simulation',rpe:7,cap:65,blocks:[{name:'Run + stations',volume:'4 × (800 m + 1 stazione)',target:'RPE 7',rest:'2 min'},{name:'Transizioni',volume:'4 ingressi',target:'Fluide',rest:'Incluso'}],rationale:'Forza resistente e transizioni progrediscono senza trasformare ogni settimana in una gara.'},'race-specific':{title:'HYROX compromised running',format:'HYROX partial simulation',rpe:8,cap:65,blocks:[{name:'Compromised run',volume:'5 × (1 km + stazione)',target:'Ritmo gara controllato',rest:'90 s'},{name:'Wall ball finish',volume:'3 × 20',target:'Tecnica gara',rest:'90 s'}],rationale:'Stimolo specifico su corsa compromessa e stazioni, dosato come unica seduta ibrida chiave.'},primer:{title:'HYROX race primer',format:'HYROX stations',rpe:6,cap:40,blocks:[{name:'Stazioni gara',volume:'4 × 2 min',target:'Tecnica brillante',rest:'2 min'},{name:'Transizioni',volume:'4 passaggi',target:'Fluide',rest:'Completo'}],rationale:'Primer tecnico breve: conserva ritmo e coordinazione senza fatica residua.'}};const preset=presets[mode]||presets.foundation;return session('hyrox',preset.title,Math.max(30,Math.min(roundFive(minutes),preset.cap)),'essential',{hyroxFormat:preset.format,hyroxRpe:preset.rpe,hyroxStructuredBlocks:preset.blocks},preset.rationale);
  }
  function hyroxSpecificForContract(minutes,phaseConstraints,contract,descriptor={}){
    const transitionMode=descriptor.transitionMode==='technical'?'primer':descriptor.transitionMode||null;
    const base=hyroxSpecific(minutes,transitionMode||phaseConstraints?.limits?.hyroxMode),overlay=contract?.pack?.overlay;
    if(!overlay)return base;
    const extra=[];
    if(overlay.mode==='doubles')extra.push({name:'Strategia partner YGIG',volume:'4–6 cambi',target:'Cambi dichiarati e ripetibili',rest:'Come da strategia'});
    if(overlay.mode==='relay')extra.push({name:'Frazioni assegnate Relay',volume:'2 coppie run/station',target:'Ritmo e cambi di squadra',rest:'Completo tra le frazioni'});
    const loads=overlay.pro&&overlay.stationLoads?.length?` Carichi Pro di riferimento: ${overlay.stationLoads.join('; ')}.`:'';
    const transitionNote=descriptor.transitionMode?` Modalità di transizione post-gara: ${descriptor.transitionMode}; nessuna simulazione completa.`:'';
    const rationale=`${base.rationale} ${overlay.detail||''}${loads}${transitionNote}`.trim();
    return{...base,title:overlay.mode==='doubles'?'HYROX Doubles · YGIG e transizioni':overlay.mode==='relay'?'HYROX Relay · frazioni e cambi':base.title,details:{...base.details,hyroxStructuredBlocks:[...(base.details?.hyroxStructuredBlocks||[]),...extra],hyroxVariantMode:overlay.mode,hyroxPro:Boolean(overlay.pro),hyroxStationLoads:overlay.stationLoads||[],transitionMode:descriptor.transitionMode||null},rationale,notes:rationale};
  }
  function obstacleSpecificForContract(minutes,phaseConstraints,contract,descriptor){
    const mode=phaseConstraints?.limits?.obstacleMode||'foundation';
    const presets={
      foundation:{title:'OCR tecnica + grip',rpe:6,cap:55,blocks:[{name:'Grip e sospensioni tecniche',volume:'4 × 20–30 s',target:'Presa solida · stop prima del cedimento',rest:'60–90 s'},{name:'Carry e locomozioni',volume:'4 × 40–60 m',target:'Postura e appoggi',rest:'90 s'}],reason:'Tecnica di base, presa e trasporti a costo controllato; nessuna simulazione prematura.'},
      specific:{title:'OCR corsa + ostacoli',rpe:7,cap:65,blocks:[{name:'Corsa su terreno + ostacolo',volume:'4 × (5 min + 1 skill)',target:'RPE 7 · tecnica stabile',rest:'2 min'},{name:'Grip / carry sotto controllo',volume:'4 blocchi',target:'Nessun cedimento tecnico',rest:'90 s'}],reason:'Corsa, ostacoli e transizioni vengono integrati in blocchi frazionati e verificabili.'},
      'race-specific':{title:'OCR specifico frazionato',rpe:8,cap:70,blocks:[{name:'Corsa + obstacle cluster',volume:'3 × 10 min',target:'RPE 7–8 · transizioni fluide',rest:'3 min'},{name:'Carry + hanging',volume:'3 blocchi',target:'Qualità sotto fatica controllata',rest:'2 min'}],reason:'Specificità OCR ad alta qualità senza trasformare la seduta in una simulazione completa.'},
      primer:{title:'OCR primer tecnico',rpe:5,cap:40,blocks:[{name:'Grip e obstacle skill',volume:'3 × 3 min',target:'Rapido e pulito',rest:'2 min'},{name:'Carry breve',volume:'3 × 30 m',target:'RPE 5',rest:'Completo'}],reason:'Richiamo breve di presa e tecnica senza fatica residua prima della gara.'}
    };
    const preset=presets[mode]||presets.foundation,duration=Math.max(30,Math.min(roundFive(minutes),preset.cap)),overlay=contract?.pack?.overlay||{},gripOnly=/grip|sospension/i.test(descriptor?.label||'');
    const blocks=gripOnly?[{name:'Grip e sospensioni',volume:'5 × 20–40 s',target:'Tecnica stabile · 2–3 RIR di presa',rest:'60–120 s'},{name:'Carry',volume:'5 × 40–80 m',target:'Postura e passo controllati',rest:'90 s'}]:preset.blocks;
    const title=gripOnly?'OCR grip, sospensioni e carry':preset.title,rationale=`${preset.reason} ${overlay.detail||''} Gli ostacoli reali e le condizioni della sede restano da verificare.`.trim();
    return session('metcon',title,duration,descriptor?.priority||'essential',{metconType:'Intervals conditioning',metconRpe:preset.rpe,metconStructuredBlocks:blocks,ocrVariant:contract?.pack?.key||null,ocrMode:mode},rationale);
  }
  function athxStrengthForContract(minutes,phaseConstraints,contract){
    const mode=phaseConstraints?.limits?.athxMode||'foundation',primer=mode==='primer',late=['race-specific','primer'].includes(mode),rir=primer?4:late?3:2;
    const blocks=primer
      ?[
        {name:'Military Press',sets:'2',reps:'3',target:`RIR ${rir} · standard Strict Press`,rest:'2–3 min'},
        {name:'Back Squat',sets:'2',reps:'3',target:`RIR ${rir}`,rest:'3 min'},
        {name:'Deadlift',sets:'2',reps:'3',target:`RIR ${rir}`,rest:'3 min'}
      ]
      :[
        {name:'Military Press',sets:'4',reps:'3',target:`RIR ${rir} · standard Strict Press`,rest:'2–3 min'},
        {name:'Back Squat',sets:'4',reps:'4',target:`RIR ${rir}`,rest:'3 min'},
        {name:'Deadlift',sets:'3',reps:'5',target:`RIR ${rir}`,rest:'3 min'}
      ];
    const overlay=contract?.pack?.overlay||{},rationale=`I lift del workout 2026 vengono preparati con tecnica e riserva: il protocollo gara 1RM Strict Press, 3RM Back Squat e 5RM Deadlift non viene ritestato ogni settimana. ${overlay.detail||''}`.trim();
    return session('strength','ATHX Strength · press, squat, deadlift',Math.max(35,Math.min(roundFive(minutes),primer?45:70)),'essential',{strengthFocus:'Full body',targetRir:rir,strengthBlocks:blocks,strengthAccessories:'Nessun accessorio a cedimento prima delle sedute Endurance o MetCon chiave.',athxRole:'athx-strength',athxVariant:contract?.pack?.key||null,athxSeason:overlay.season||'2026'},rationale);
  }
  function athxSpecificForContract(minutes,phaseConstraints,contract,descriptor){
    const mode=phaseConstraints?.limits?.athxMode||'foundation',overlay=contract?.pack?.overlay||{},segment=Number(overlay.runSegmentM)||750,subRole=descriptor?.athxRole||descriptor?.key||'athx-combined',pairs=overlay.mode==='pairs';
    const effort=mode==='primer'?5:mode==='race-specific'?8:mode==='specific'?7:6;
    let title,blocks,reason,cap=65;
    if(subRole==='athx-endurance'){
      title=`ATHX Endurance · run/row ${segment} m`;
      blocks=mode==='primer'
        ?[{name:'Run / Row alternati',volume:`4 × ${Math.min(segment,500)} m`,target:'RPE 5 · cambi puliti',rest:'90 s'}]
        :[{name:'Run / Row alternati',volume:`${mode==='race-specific'?5:4} × (${segment} m run + ${segment} m row)`,target:`RPE ${effort} · split stabili`,rest:mode==='race-specific'?'60–90 s':'2 min'},{name:'Tecnica di cambio',volume:pairs?'6 cambi con partner':'6 transizioni run/row',target:'Procedura ripetibile',rest:'Incluso'}];
      reason=`Pacing e cambi specifici della divisione ${overlay.division||'ATHX'}; distanza, ritmo e densità non aumentano insieme.`;cap=60;
    }else if(subRole==='athx-metcon'){
      title=`ATHX MetCon X · ${overlay.division||'Standard'}`;
      blocks=mode==='primer'
        ?[{name:'Tecnica movimenti 2026',volume:'3 × 4 min EMOM',target:'RPE 5 · standard puliti',rest:'2 min'}]
        :mode==='foundation'
          ?[{name:'SkiErg + GTOH',volume:'4 × 4 min EMOM',target:'RPE 6 · tecnica',rest:'2 min'},{name:'Carry + box + lunge',volume:'3 giri tecnici',target:'Stop prima del degrado',rest:'2 min'}]
          :[{name:'MetCon X frazionato',volume:mode==='race-specific'?'3 × 7 min':'4 × 5 min',target:`RPE ${effort} · standard 2026`,rest:mode==='race-specific'?'3 min':'2 min'},{name:pairs?'Cambi e ripartizione Pairs':'Burpee broad jump + transizioni',volume:pairs?'6–8 cambi dichiarati':'3 blocchi brevi',target:'Tecnica stabile',rest:'Completo'}];
      reason='La densità cresce dopo la tecnica: i blocchi for-time restano frazionati e non diventano una simulazione completa automatica.';cap=65;
    }else{
      title=pairs?'ATHX Pairs · blocchi e strategia':'ATHX · blocchi specifici';
      blocks=[
        {name:'Endurance run / row',volume:`3 × (${segment} m + ${segment} m)`,target:`RPE ${Math.min(effort,7)} · split stabili`,rest:'2 min'},
        {name:'MetCon X tecnico',volume:mode==='primer'?'2 × 4 min':'3 × 6 min',target:`RPE ${effort} · standard puliti`,rest:'2–3 min'},
        ...(pairs?[{name:'Strategia Pairs',volume:'6 cambi dichiarati',target:'Distribuzione sostenibile',rest:'Incluso'}]:[])
      ];
      reason='Le qualità vengono integrate in dose frazionata senza replicare Strength + Endurance + MetCon X nella stessa seduta.';cap=70;
    }
    const caution=overlay.formatCaution?` ${overlay.formatCaution}`:'';
    const rationale=`${reason} ${overlay.detail||''}${caution}`.trim();
    return session('metcon',title,Math.max(30,Math.min(roundFive(minutes),mode==='primer'?40:cap)),descriptor?.priority||'essential',{metconType:'ATHX specific',metconRpe:effort,metconStructuredBlocks:blocks,athxRole:subRole,athxVariant:contract?.pack?.key||null,athxDivision:overlay.division||null,athxMode:mode,athxSeason:overlay.season||'2026',athxPairs:pairs},rationale);
  }
  function lowImpactReplacement(minutes){return recoveryRide(minutes,'La qualità running viene sostituita da lavoro aerobico facile e a basso impatto; interrompi se il fastidio aumenta.','essential');}
  function recoverySession(minutes){return session('recovery','Recupero e rivalutazione',Math.max(20,Math.min(roundFive(minutes),40)),'essential',{recoveryType:'Cardio rigenerante'},'Recupero, mobilità o cardio facile ben tollerato; rivalutare i segnali prima di reintrodurre lavoro più costoso.');}
  function isRace(item){return item?.details?.runType==='Race'||Boolean(item?.goalGenerated);}
  function isLong(item){return item.category==='running'&&(item.details?.runType==='Long run'||/lungo/i.test(item.title||''));}
  function isQuality(item){return !isRace(item)&&!isLong(item)&&item.priority==='essential'&&['running','cycling'].includes(item.category);}
  function isLowerStrength(item){return item.category==='strength'&&['Lower body','Full body'].includes(item.details?.strengthFocus);}
  function sessionRole(item){
    if(isRace(item))return 'race';
    if(item.details?.triathlonRole)return item.details.triathlonRole;
    if(item.category==='swimming')return'tri-swim';
    if(isLong(item))return 'long';
    if(item.category==='running'){const type=String(item.details?.runType||'').toLowerCase();return /(interval|tempo|threshold|progress|race)/.test(type)?'quality':'easy';}
    if(item.category==='strength')return `strength-${String(item.details?.strengthFocus||'').toLowerCase().replaceAll(' ','-')}`;
    if(item.category==='cycling')return item.priority==='essential'?'quality-low-impact':'cycling';
    if(item.details?.athxRole||/\bathx\b/i.test(`${item.title||''} ${item.details?.metconType||''}`))return'athx';
    if(item.category==='metcon'&&/\b(ocr|spartan|obstacle)\b/i.test(`${item.title||''} ${item.details?.metconType||''}`))return'obstacle';
    return item.category;
  }

  function adaptStrength(item,analysis){
    if(item.category!=='strength')return item;const settings=analysis.settings;const reduction=settings.strengthSetReduction;
    const blocks=(item.details.strengthBlocks||[]).map(block=>({...block,sets:String(Math.max(2,(Number(block.sets)||3)-reduction)),target:`RIR ${settings.strengthRir}`}));
    const rationale=settings.strengthRir>2?`${item.rationale} Volume ridotto e target RIR ${settings.strengthRir} in base ai dati recenti.`:item.rationale;
    return {...item,details:{...item.details,targetRir:settings.strengthRir,strengthBlocks:blocks},rationale,notes:rationale};
  }
  function adaptTransition(item,transition){
    if(!item||!transition)return item;const cap=Number(transition.maxDurationMin)||Number(item.durationMin)||0;let next={...item,durationMin:Math.min(Number(item.durationMin)||cap,cap)};
    const prefix=`${transition.label}: `;
    if(next.category==='strength'){
      const minimumRir=transition.stage==='restore'?4:3;
      const blocks=(next.details?.strengthBlocks||[]).map(block=>({...block,sets:String(Math.max(2,(Number(block.sets)||3)-(transition.stage==='convert'?0:1))),target:`RIR ${Math.max(minimumRir,Number(next.details?.targetRir)||0)}`}));
      next={...next,details:{...next.details,targetRir:Math.max(minimumRir,Number(next.details?.targetRir)||0),strengthBlocks:blocks}};
    }
    const rationale=`${prefix}${transition.summary} ${next.rationale||''}`.trim();
    return{...next,rationale,notes:rationale};
  }
  function templateForRole(descriptor,weekly,analysis,phaseConstraints,microcycle){
    const settings=analysis.settings,declaredMinutes=Number(weekly.sessionMinutes)||60,normalMinutes=microcycle?.transition?Math.min(declaredMinutes,Number(microcycle.transition.maxDurationMin)||declaredMinutes):declaredMinutes,adaptedMinutes=roundFive(normalMinutes*settings.volumeFactor),easyMinutes=roundFive(normalMinutes*Number(settings.aerobicVolumeFactor??settings.volumeFactor??1));
    const generated=phaseConstraints?.generated||{},maxLong=Number(weekly.longRunMinutes)||120,baseLong=Math.min(maxLong,Math.max(75,normalMinutes+30)),adaptedLong=Math.min(maxLong,roundFive(baseLong*settings.longFactor*Number(generated.longFactor||1)));
    let item=null;
    if(descriptor.role==='easy')item=easyRun(easyMinutes);
    else if(descriptor.role==='quality')item=settings.lowerBodyProtection?lowImpactReplacement(adaptedMinutes):qualityRunForPack(adaptedMinutes,settings.qualityMode==='controlled',phaseConstraints);
    else if(descriptor.role==='long')item=settings.suspendRunning?recoverySession(adaptedLong):longRun(adaptedLong,analysis.level==='progress'&&Number(settings.longFactor||1)<=1?'steady':analysis.level);
    else if(descriptor.role==='strength-upper')item=upperStrength(adaptedMinutes);
    else if(descriptor.role==='strength-lower')item=settings.lowerBodyProtection?recoveryRide(adaptedMinutes,'Il lavoro lower lascia spazio a recupero low impact.'):settings.lowerBodyCaution?fullStrength(adaptedMinutes):lowerStrength(adaptedMinutes);
    else if(descriptor.role==='strength')item=microcycle?.pack?.family==='athx'?(settings.lowerBodyProtection?upperStrength(adaptedMinutes):athxStrengthForContract(adaptedMinutes,phaseConstraints,microcycle)):(settings.lowerBodyProtection?upperStrength(adaptedMinutes):fullStrength(adaptedMinutes));
    else if(descriptor.role==='hyrox')item=hyroxSpecificForContract(adaptedMinutes,phaseConstraints,microcycle,descriptor);
    else if(descriptor.role==='obstacle')item=settings.lowerBodyProtection?recoveryRide(adaptedMinutes,'Il lavoro OCR lascia spazio a cardio low impact finché il segnale lower body non viene rivalutato.','essential'):obstacleSpecificForContract(adaptedMinutes,phaseConstraints,microcycle,descriptor);
    else if(descriptor.role==='athx')item=settings.lowerBodyProtection?recoveryRide(adaptedMinutes,'Il lavoro ATHX ad alto impatto lascia spazio a cardio low impact finché il segnale lower body non viene rivalutato.','essential'):athxSpecificForContract(adaptedMinutes,phaseConstraints,microcycle,descriptor);
    else if(descriptor.role==='tri-swim')item=triathlonSwimForContract(adaptedMinutes,phaseConstraints,microcycle,descriptor);
    else if(descriptor.role==='tri-bike')item=settings.lowerBodyProtection?recoveryRide(adaptedMinutes,'La seduta bici viene mantenuta facile e rivalutata se il segnale lower body aumenta.','essential'):triathlonBikeForContract(adaptedMinutes,phaseConstraints,microcycle);
    else if(descriptor.role==='tri-run')item=settings.suspendRunning?recoverySession(adaptedMinutes):triathlonRunForContract(adaptedMinutes,analysis,phaseConstraints,microcycle);
    else if(descriptor.role==='tri-brick')item=settings.lowerBodyProtection||settings.suspendRunning?triathlonSwimForContract(adaptedMinutes,phaseConstraints,microcycle,{priority:'essential',label:'Nuoto tecnico sostitutivo'}):triathlonBrickForContract(adaptedMinutes,phaseConstraints,microcycle);
    else if(descriptor.role==='cycling')item=recoveryRide(adaptedMinutes);
    else if(descriptor.role==='recovery')item=recoverySession(adaptedMinutes);
    if(!item)return null;
    if(descriptor.label&&descriptor.role==='long')item={...item,title:descriptor.label};
    if(settings.suspendRunning&&item.category==='running')item=recoverySession(adaptedMinutes);
    return adaptTransition(adaptStrength(item,analysis),microcycle?.transition);
  }
  function desiredTemplates(count,weekly,analysis,phaseConstraints,microcycle){
    if(count<=0)return [];
    if(microcycle?.plannedRoles)return microcycle.plannedRoles.map(item=>templateForRole(item,weekly,analysis,phaseConstraints,microcycle)).filter(Boolean);
    const settings=analysis.settings;const normalMinutes=Number(weekly.sessionMinutes)||60;const adaptedMinutes=roundFive(normalMinutes*settings.volumeFactor);const easyMinutes=roundFive(normalMinutes*Number(settings.aerobicVolumeFactor??settings.volumeFactor??1));
    const generated=phaseConstraints?.generated||{};const maxLong=Number(weekly.longRunMinutes)||120;const baseLong=Math.min(maxLong,Math.max(75,normalMinutes+30));const adaptedLong=Math.min(maxLong,roundFive(baseLong*settings.longFactor*Number(generated.longFactor||1)));
    const quality=settings.lowerBodyProtection?lowImpactReplacement(adaptedMinutes):generated.qualityStyle==='recall'?qualityRecallRun(adaptedMinutes,phaseConstraints):qualityRun(adaptedMinutes,settings.qualityMode==='controlled');
    const singleStrength=settings.lowerBodyProtection?upperStrength(adaptedMinutes):fullStrength(adaptedMinutes);
    const secondStrength=settings.lowerBodyProtection?recoveryRide(adaptedMinutes,'Il secondo lavoro per gli arti inferiori lascia spazio a recupero low impact.'):settings.lowerBodyCaution?fullStrength(adaptedMinutes):lowerStrength(adaptedMinutes);
    const long=settings.suspendRunning?recoverySession(adaptedLong):phaseConstraints?.phase?.key==='race-week'?easyRun(Math.min(adaptedMinutes,35)):longRun(adaptedLong,analysis.level==='progress'&&Number(settings.longFactor||1)<=1?'steady':analysis.level);
    let templates=[];
    if(phaseConstraints?.goal?.type==='hyrox'){
      const hybrid=hyroxSpecific(adaptedMinutes,phaseConstraints.limits?.hyroxMode);if(count===1)templates=[hybrid];else if(count===2)templates=[singleStrength,hybrid];else if(count===3)templates=[easyRun(easyMinutes),singleStrength,hybrid];else if(count===4)templates=[easyRun(easyMinutes),quality,singleStrength,hybrid];else if(count===5)templates=[easyRun(easyMinutes),quality,singleStrength,hybrid,recoveryRide(adaptedMinutes)];else templates=[easyRun(easyMinutes),upperStrength(adaptedMinutes),quality,secondStrength,hybrid,recoveryRide(adaptedMinutes)];if(settings.suspendRunning)templates=templates.map(item=>item.category==='running'?recoverySession(adaptedMinutes):item);return templates.map(item=>adaptStrength(item,analysis));
    }
    if(count===1)templates=[long];
    else if(count===2)templates=[singleStrength,long];
    else if(count===3)templates=[singleStrength,quality,long];
    else if(count===4)templates=[easyRun(easyMinutes),singleStrength,quality,long];
    else if(count===5)templates=[easyRun(easyMinutes),upperStrength(adaptedMinutes),quality,secondStrength,long];
    else templates=[easyRun(easyMinutes),upperStrength(adaptedMinutes),quality,secondStrength,recoveryRide(adaptedMinutes),long];
    if(settings.suspendRunning)templates=templates.map(item=>item.category==='running'?recoverySession(adaptedMinutes):item);
    return templates.map(item=>adaptStrength(item,analysis));
  }
  function isUserManual(item){return !item.planImport&&item.generated!==true&&!String(item.id||'').startsWith('sample-');}
  function lockedSessions(all,start,end,today){return all.filter(item=>item.date>=start&&item.date<=end&&(item.outcome||item.date<=today||isUserManual(item)||isRace(item)||item.goalSubstitution));}
  function consumeLocked(templates,locked){
    const remaining=[...templates];const removalRank={optional:0,important:1,essential:2};
    locked.forEach(item=>{
      if(!remaining.length)return;const role=sessionRole(item);let index=remaining.findIndex(candidate=>sessionRole(candidate)===role);
      if(index<0&&role==='race')index=item.category==='hyrox'?remaining.findIndex(candidate=>candidate.category==='hyrox'):remaining.findIndex(isLong);
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
    const specificSlots=[];let specific=remainingTemplates.find(item=>['hyrox','metcon'].includes(item.category));
    while(specific&&remainingSlots.length){const anchors=[longSlot,qualitySlot,...specificSlots].filter(Boolean);const slot=[...remainingSlots].sort((a,b)=>{const score=item=>anchors.length?Math.min(...anchors.map(anchor=>gapDays(item.date,anchor.date))):0;return score(b)-score(a)||a.date.localeCompare(b.date);})[0];use(specific,slot);specificSlots.push(slot);specific=remainingTemplates.find(item=>['hyrox','metcon'].includes(item.category));}
    const lower=remainingTemplates.find(isLowerStrength);
    if(lower&&remainingSlots.length){const anchors=[longSlot,qualitySlot,...specificSlots].filter(Boolean);const slot=[...remainingSlots].sort((a,b)=>{const score=item=>anchors.length?Math.min(...anchors.map(anchor=>gapDays(item.date,anchor.date))):0;return score(b)-score(a)||a.date.localeCompare(b.date);})[0];use(lower,slot);}
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
  function phaseFor(weekly,allSessions,analysis){const goals=window.rcDataStore?.getDataset('goals')||[];if(!phaseModel||!window.rcGoalsModel)return{analysis,context:null,goal:null,goals};const goal=window.rcGoalsModel.classifyGoals(goals,weekly.weekStart).current;const context=phaseModel.forWeek({goal,weekStart:weekly.weekStart,sessions:allSessions,analysis});return{analysis:phaseModel.constrainAnalysis(analysis,context),context,goal,goals};}
  function build(){
    const stored=parse(WEEKLY_KEY,null);if(!stored)return {missing:true};const weekly={...stored,weekStart:mondayFor(stored.weekStart)};
    const dayIndex={Lun:0,Mar:1,Mer:2,Gio:3,Ven:4,Sab:5,Dom:6};const allSessions=window.rcSessions.getAll();const phaseDecision=phaseFor(weekly,allSessions,adaptationFor(weekly,allSessions)),analysis=phaseDecision.analysis,phaseConstraints=phaseDecision.context;
    const selected=(weekly.days||[]).map(day=>({day,index:dayIndex[day],date:dateFor(weekly.weekStart,dayIndex[day])})).filter(item=>Number.isInteger(item.index)).sort((a,b)=>a.index-b.index);if(!selected.length)return {missingDays:true,weekly};
    const requested=Number(weekly.sessions)||5;const readinessCount=Math.max(1,Math.min(6,requested+analysis.settings.sessionDelta)),phaseCap=Number(phaseConstraints?.limits?.maxActiveSessions)||6,adaptedCount=Math.min(readinessCount,phaseCap);const end=addDays(weekly.weekStart,6);const today=localDate();const weekSessions=allSessions.filter(item=>item.date>=weekly.weekStart&&item.date<=end);const locked=lockedSessions(allSessions,weekly.weekStart,end,today),activeLocked=locked.filter(item=>item.adaptiveAdjustment?.status!=='paused');const lockedIds=new Set(locked.map(item=>item.id)),lockedDates=new Set(locked.map(item=>item.date));const available=selected.filter(slot=>slot.date>=today&&!lockedDates.has(slot.date));const importedPlan=weekSessions.filter(item=>item.planImport&&!lockedIds.has(item.id));const hasAppliedAdjustments=weekSessions.some(item=>item.adaptiveAdjustment&&!item.outcome&&!item.goalSubstitution&&item.date>today);const microcycle=microcycleModel?.build({goal:phaseDecision.goal,goals:phaseDecision.goals,weekStart:weekly.weekStart,sessionCount:adaptedCount,sessionMinutes:Number(weekly.sessionMinutes)||60,longSessionMinutes:Number(weekly.longRunMinutes)||120,phaseConstraints,lockedSessions:activeLocked,sessions:allSessions,analysis})||null;
    const contractCount=Number(microcycle?.count??adaptedCount);let assigned,sourceMode='generated',adjustedPlan=null;
    if(importedPlan.length&&adjustmentModel){
      sourceMode='excel';const targetCount=Math.min(importedPlan.length,Math.max(0,adaptedCount-activeLocked.length),available.length);adjustedPlan=adjustmentModel.buildAdjustment({sessions:importedPlan,analysis,phaseConstraints,targetCount,now:new Date()});const slots=chooseSlots(available,adjustedPlan.active.length,adjustedPlan.active.some(isLong));const scheduled=assignImportedPlan(adjustedPlan.active,slots,analysis);assigned={sessions:[...scheduled.sessions,...adjustedPlan.paused].sort((a,b)=>a.date.localeCompare(b.date)),warnings:scheduled.warnings};
    }else{
      let templates=desiredTemplates(adaptedCount,weekly,analysis,phaseConstraints,microcycle);if(!microcycle)templates=consumeLocked(templates,locked);const capacity=Math.min(templates.length,available.length);if(capacity<templates.length){const rank={essential:0,important:1,optional:2};templates=[...templates].sort((a,b)=>rank[a.priority]-rank[b.priority]||(isLong(b)?1:0)-(isLong(a)?1:0)).slice(0,capacity);}const slots=chooseSlots(available,templates.length,templates.some(isLong));assigned=assignTemplates(templates,slots);
    }
    const normalMinutes=Number(weekly.sessionMinutes)||60;const baseLong=Math.min(Number(weekly.longRunMinutes)||120,Math.max(75,normalMinutes+30));const plannedLong=assigned.sessions.find(isLong)?.durationMin;
    const changes=[...(analysis.phaseDecisionChanges||[])];const adaptedMinutes=roundFive(normalMinutes*analysis.settings.volumeFactor);const easyMinutes=roundFive(normalMinutes*Number(analysis.settings.aerobicVolumeFactor??analysis.settings.volumeFactor??1));
    if(adaptedCount<readinessCount)changes.push(`La fase ${phaseConstraints.phase.label} limita la proposta a ${adaptedCount} sedute attive: non viene aggiunta fatica tardiva per riempire la disponibilità.`);
    if(analysis.organization?.level==='adapt'&&analysis.settings.physiologySessionDelta===0&&adaptedCount<requested)changes.push(`Una seduta in meno per rendere la settimana coerente con i ${analysis.organization.total14} vincoli organizzativi recenti; durata e intensità delle singole sedute restano invariate.`);
    else if(analysis.organization?.level==='adapt'&&adaptedCount<requested)changes.push('I vincoli organizzativi confermano il limite di una seduta in meno già indicato dai segnali di recupero.');
    if(sourceMode==='generated'&&adaptedMinutes!==normalMinutes)changes.push(`Durata abituale ridotta da ${normalMinutes} a circa ${adaptedMinutes} minuti.`);
    if(sourceMode==='generated'&&easyMinutes!==adaptedMinutes)changes.push(`Corsa facile indicativa da ${normalMinutes} a ${easyMinutes} minuti; qualità, forza e lavoro ibrido non aumentano.`);
    if(sourceMode==='generated'&&plannedLong&&plannedLong!==baseLong)changes.push(`Lungo adattato da ${baseLong} a ${plannedLong} minuti.`);
    if(sourceMode==='generated'&&assigned.sessions.some(item=>item.details?.runType==='Progression run'))changes.push('Qualità trasformata in progressione controllata.');
    if(sourceMode==='generated'&&assigned.sessions.some(item=>/non lasciano 48 ore/i.test(item.rationale||'')))changes.push('Qualità running convertita in corsa facile per proteggere il lungo ravvicinato.');
    if(sourceMode==='generated'&&analysis.settings.strengthRir>2&&assigned.sessions.some(item=>item.category==='strength'))changes.push(`Forza impostata a RIR ${analysis.settings.strengthRir} con una serie in meno sui fondamentali.`);
    if(sourceMode==='generated'&&analysis.settings.lowerBodyProtection&&assigned.sessions.some(item=>item.category==='cycling'))changes.push('Qualità running sostituita con lavoro low impact; nessun nuovo lower pesante viene aggiunto.');
    if(sourceMode==='generated'&&analysis.settings.suspendRunning)changes.push('Running sospeso nella proposta automatica fino a nuova valutazione.');
    if(sourceMode==='generated'&&microcycle?.eventDirective?.replacesLong)changes.push(`${microcycle.eventDirective.goal.name} assorbe il lungo specifico della settimana: non viene creato un secondo lungo né volume compensatorio.`);
    if(sourceMode==='generated'&&microcycle?.transition)changes.push(`${microcycle.transition.label}: massimo ${microcycle.transition.maxSessions} sedute da ${microcycle.transition.maxDurationMin} minuti prima di riaprire il normale pack ${microcycle.pack?.label||'del nuovo obiettivo'}.`);
    if(sourceMode==='excel'){
      if(adjustedPlan.paused.length)changes.push(`${adjustedPlan.paused.length} sedut${adjustedPlan.paused.length===1?'a sospesa':'e sospese'} senza eliminar${adjustedPlan.paused.length===1?'la':'le'} dal piano: potr${adjustedPlan.paused.length===1?'à':'anno'} essere ripristinat${adjustedPlan.paused.length===1?'a':'e'}.`);
      const instructions=[...new Set(assigned.sessions.flatMap(item=>item.adaptiveAdjustment?.instructions||[]))];instructions.forEach(instruction=>{if(!changes.includes(instruction))changes.push(instruction);});
      if(!adjustedPlan.changed&&!assigned.sessions.some(item=>item.adaptiveAdjustment))changes.push('Il programma Excel resta invariato: i dati non giustificano correzioni.');
    }
    if(!changes.length)changes.push(analysis.level==='progress'?'Aumentano solo gli elementi autorizzati dai controlli di tolleranza; intensità e forza restano stabili.':'Struttura e carico della settimana restano invariati.');
    const phaseAudit=phaseModel?.auditSessions([...activeLocked,...assigned.sessions],phaseConstraints)||{warnings:[]};const alerts=[...assigned.warnings,...phaseAudit.warnings,...(microcycle?.warnings||[])];const activeProposed=assigned.sessions.filter(item=>item.adaptiveAdjustment?.status!=='paused').length;
    const expectedCount=sourceMode==='generated'?contractCount:adaptedCount;
    if(available.length+activeLocked.length<expectedCount)alerts.push(`Con i giorni disponibili la proposta contiene ${activeLocked.length+activeProposed} sedute attive invece di ${expectedCount}.`);
    if(sourceMode==='excel'&&importedPlan.length<Math.max(0,adaptedCount-activeLocked.length))alerts.push('Il coach non aggiunge sedute generiche oltre a quelle previste dal programma Excel.');
    if(sourceMode==='excel'&&microcycle?.transition)alerts.push(`${microcycle.transition.label}: il piano esterno resta autorevole e non viene riscritto, ma le sedute oltre i limiti post-maratona richiedono una revisione esplicita.`);
    if(sourceMode==='generated'&&contractCount<adaptedCount&&microcycle?.transition)alerts.push(`${microcycle.transition.label}: il blocco post-maratona limita temporaneamente la proposta a ${contractCount} sedute.`);
    else if(adaptedCount<requested)alerts.push(analysis.organization?.level==='adapt'&&analysis.settings.physiologySessionDelta===0?`Il coach propone temporaneamente ${adaptedCount} sedute invece di ${requested} per aumentare la fattibilità della settimana.`:adaptedCount<readinessCount?`La fase ${phaseConstraints.phase.label} limita temporaneamente il numero massimo da ${requested} a ${adaptedCount} sedute.`:`Il motore riduce temporaneamente il numero massimo da ${requested} a ${adaptedCount} sedute.`);
    if(locked.length)alerts.push(`${locked.length} voc${locked.length===1?'e protetta resta':'i protette restano'} intatt${locked.length===1?'a':'e'}: esiti, passato, sedute manuali, gare e sostituzioni dichiarate non vengono riscritti.`);
    return {weekly,sessions:assigned.sessions,lockedSessions:locked.sort((a,b)=>a.date.localeCompare(b.date)),alerts,analysis,phaseConstraints,phaseAudit,microcycle,changes,requested,adaptedCount:expectedCount,sourceMode,hasAppliedAdjustments};
  }

  function renderAdaptation(analysis){
    const box=document.getElementById('generator-adaptation');box.className=`generator-adaptation ${analysis.level}`;box.replaceChildren();
    const copy=document.createElement('div');const overline=document.createElement('small');overline.textContent='ADATTAMENTO AUTOMATICO';const title=document.createElement('strong');title.textContent=analysis.label;const summary=document.createElement('p');summary.textContent=analysis.summary;copy.append(overline,title,summary);
    const metrics=document.createElement('div');metrics.className='generator-metrics';analysis.metrics.forEach(item=>{const chip=document.createElement('span');chip.className=item.tone;const label=document.createElement('small');label.textContent=item.label;const value=document.createElement('b');value.textContent=item.value;chip.append(label,value);metrics.append(chip);});box.append(copy,metrics);
  }
  function renderPhase(context){
    const box=document.getElementById('generator-phase');box.replaceChildren();box.hidden=!context;if(!context)return;box.className=`generator-phase ${context.phase.key}`;
    const head=document.createElement('div');head.className='generator-phase-head';const copy=document.createElement('div');const overline=document.createElement('small');overline.textContent=`${context.standard?.label||'STANDARD COACH ELITE'} · FASE OBIETTIVO`;const title=document.createElement('strong');title.textContent=`${context.phase.label} · ${context.goal.name}`;const summary=document.createElement('p');summary.textContent=`${context.phase.days} giorni alla gara. ${context.summary}`;copy.append(overline,title,summary);const confidence=document.createElement('span');confidence.textContent=context.confidence==='contextual'?'EVIDENZA CONTESTUALE':'VINCOLI SUPPORTATI';head.append(copy,confidence);
    const guards=document.createElement('div');guards.className='generator-phase-guards';context.guards.forEach(item=>{const card=document.createElement('article');card.className=item.tone;const label=document.createElement('small');label.textContent=item.label;const state=document.createElement('b');state.textContent=item.state;const detail=document.createElement('p');detail.textContent=item.detail;card.append(label,state,detail);guards.append(card);});box.append(head,guards);
  }
  function renderMicrocycle(contract){
    const box=document.getElementById('generator-microcycle');box.replaceChildren();box.hidden=!contract;if(!contract)return;
    box.className=`generator-microcycle ${contract.confidence||'pending'}`;
    const head=document.createElement('div');head.className='generator-microcycle-head';const copy=document.createElement('div');const overline=document.createElement('small');overline.textContent='CONTRATTO DEL MICROCICLO';const title=document.createElement('strong');title.textContent=contract.label;const summary=document.createElement('p');summary.textContent=contract.summary;copy.append(overline,title,summary);const badge=document.createElement('span');badge.textContent=contract.confidence==='supported'?'PACK ATTIVO':contract.confidence==='contextual'?'PACK CONTESTUALE':'PACK DA REVISIONARE';head.append(copy,badge);
    const roles=document.createElement('div');roles.className='generator-microcycle-roles';contract.roles.filter(item=>item.status!=='omitted').forEach(item=>{const chip=document.createElement('article');chip.className=item.status;const state=document.createElement('small');state.textContent=item.status==='covered'?'GIÀ COPERTA':'DA PROGRAMMARE';const label=document.createElement('b');label.textContent=item.label;const reason=document.createElement('p');reason.textContent=item.status==='covered'?`${item.sessionDate} · ${item.sessionTitle}`:item.reason;chip.append(state,label,reason);roles.append(chip);});
    box.append(head);
    if(contract.transition){
      const transition=document.createElement('article');transition.className=`generator-transition ${contract.transition.status}`;
      const overlineTransition=document.createElement('small');overlineTransition.textContent=`TRANSIZIONE POST-MARATONA · GIORNO +${contract.transition.daysAfter}`;
      const titleTransition=document.createElement('b');titleTransition.textContent=`${contract.transition.label} → ${contract.transition.activeGoal.name}`;
      const summaryTransition=document.createElement('p');summaryTransition.textContent=contract.transition.summary;
      const criteria=document.createElement('ul');contract.transition.exitCriteria.forEach(value=>{const item=document.createElement('li');item.textContent=value;criteria.append(item);});
      transition.append(overlineTransition,titleTransition,summaryTransition,criteria);box.append(transition);
    }
    box.append(roles);
    if(contract.eventDirective){
      const event=document.createElement('article');event.className=`generator-microcycle-event ${contract.eventDirective.tone||'warn'}`;const overlineEvent=document.createElement('small');overlineEvent.textContent=contract.eventDirective.replacesLong?'GARA C · LUNGO SPECIFICO':'GARA SECONDARIA';const titleEvent=document.createElement('b');titleEvent.textContent=`${contract.eventDirective.goal.name} · ${contract.eventDirective.goal.date}`;const summaryEvent=document.createElement('p');summaryEvent.textContent=contract.eventDirective.summary;const actions=document.createElement('ul');contract.eventDirective.actions.forEach(value=>{const item=document.createElement('li');item.textContent=value;actions.append(item);});event.append(overlineEvent,titleEvent,summaryEvent,actions);box.append(event);
    }
  }
  function renderTolerance(analysis){
    const box=document.getElementById('generator-tolerance'),tolerance=analysis.tolerance;box.replaceChildren();box.hidden=!tolerance;if(!tolerance)return;
    const head=document.createElement('div');head.className='generator-tolerance-head';const copy=document.createElement('div');const overline=document.createElement('small');overline.textContent='CONTROLLO DI TOLLERANZA';const title=document.createElement('strong');title.textContent='Prima di aumentare il carico';const summary=document.createElement('p');summary.textContent=tolerance.summary;copy.append(overline,title,summary);head.append(copy);
    const targets=document.createElement('div');targets.className='generator-tolerance-targets';[tolerance.volume,tolerance.long].forEach(target=>{const card=document.createElement('article');card.className=target.allowed?'allowed':'hold';const label=document.createElement('small');label.textContent=target.label;const state=document.createElement('b');state.textContent=target.allowed?`AUTORIZZATO · +${Math.round((target.factor-1)*100)}%`:target.eligible&&target.phase?'MANTIENI · VINCOLO FASE':'MANTIENI';const detail=document.createElement('p');detail.textContent=target.allowed?target.reason:target.eligible&&target.phase?`La tolleranza è adeguata, ma la fase ${target.phase} non autorizza l’aumento.`:target.reason;card.append(label,state,detail);targets.append(card);});
    const checks=document.createElement('div');checks.className='generator-tolerance-checks';tolerance.checks.filter(item=>item.required).forEach(item=>{const chip=document.createElement('span');chip.className=item.passed?'passed':'failed';chip.textContent=`${item.passed?'✓':'–'} ${item.label}`;chip.title=item.detail;checks.append(chip);});box.append(head,targets,checks);
  }
  function renderRow(item,preserved=false){const date=new Date(`${item.date}T12:00:00`);const paused=item.adaptiveAdjustment?.status==='paused',adjusted=Boolean(item.adaptiveAdjustment);const row=document.createElement('article');row.className=`generator-session${preserved?' preserved':''}${paused?' paused':''}${adjusted&&!paused?' adjusted':''}`;const dateBox=document.createElement('div');dateBox.className='generator-date';const day=document.createElement('small');day.textContent=date.toLocaleDateString('it-IT',{weekday:'short'}).replace('.','').toUpperCase();const number=document.createElement('strong');number.textContent=String(date.getDate()).padStart(2,'0');dateBox.append(day,number);const content=document.createElement('div');const title=document.createElement('h3');title.textContent=item.title;const reason=document.createElement('p');const today=localDate();reason.textContent=item.goalSubstitution?(item.adaptiveAdjustment?.instructions||[]).join(' '):preserved?(item.outcome?'Già registrata: il coach non la modifica.':item.date<today?'Seduta passata mantenuta per permettere la registrazione.':item.date===today?'Seduta di oggi mantenuta senza modifiche.':'Seduta manuale mantenuta senza modifiche.'):adjusted?(item.adaptiveAdjustment.instructions||[]).join(' '):(item.rationale||'Prescrizione del programma Excel confermata senza modifiche.');content.append(title,reason);const tag=document.createElement('span');tag.className=`tag ${paused?'rest':preserved?'preserved':categoryClasses[item.category]||'rest'}`;tag.textContent=item.goalSubstitution?'SOSPESA · CONSERVATA':preserved?'MANTENUTA':paused?'SOSPESA':adjusted?'ADATTATA':categoryLabels[item.category]||item.category.toUpperCase();row.append(dateBox,content,tag);return row;}
  function renderRationale(current){const box=document.getElementById('generator-rationale');box.replaceChildren();const title=document.createElement('strong');title.textContent='Perché questo piano';const summary=document.createElement('p');summary.textContent=current.analysis.summary;const reasons=document.createElement('ul');current.analysis.reasons.forEach(reason=>{const item=document.createElement('li');item.textContent=reason;reasons.append(item);});const changes=document.createElement('div');changes.className='generator-changes';current.changes.forEach(change=>{const item=document.createElement('span');item.textContent=change;changes.append(item);});box.append(title,summary,reasons,changes);}
  function openProposal(){
    proposal=build();if(proposal.missing){window.alert('Completa prima il check-in della settimana.');document.getElementById('open-weekly-checkin').click();return;}if(proposal.missingDays){window.alert('Seleziona almeno un giorno disponibile nel check-in settimanale.');return;}
    preview.replaceChildren();[...proposal.lockedSessions,...proposal.sessions].sort((a,b)=>a.date.localeCompare(b.date)).forEach(item=>preview.append(renderRow(item,proposal.lockedSessions.some(locked=>locked.id===item.id))));
    const active=proposal.sessions.filter(item=>item.adaptiveAdjustment?.status!=='paused').length,activeLocked=proposal.lockedSessions.filter(item=>item.adaptiveAdjustment?.status!=='paused').length,total=proposal.lockedSessions.length+proposal.sessions.length,paused=total-active-activeLocked;document.getElementById('generator-summary').textContent=`${total} voci · ${activeLocked+active} sedute attive${paused?` · ${paused} sospes${paused===1?'a':'e'}`:''} · settimana dal ${new Date(`${proposal.weekly.weekStart}T12:00:00`).toLocaleDateString('it-IT')} · ${proposal.sourceMode==='excel'?'base programma Excel':'piano generato localmente'}`;
    document.getElementById('generator-restore').hidden=!proposal.hasAppliedAdjustments;renderAdaptation(proposal.analysis);renderPhase(proposal.phaseConstraints);renderMicrocycle(proposal.microcycle);renderTolerance(proposal.analysis);const alert=document.getElementById('generator-alert');alert.hidden=!proposal.alerts.length;alert.textContent=proposal.alerts.join(' ');renderRationale(proposal);modal.classList.add('open');modal.setAttribute('aria-hidden','false');
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
