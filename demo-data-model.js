(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.rcDemoDataModel=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const DEMO_ID='giugno-2026-v1';
  const DEMO_MONTH='2026-06';
  function clone(value){return typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value));}
  function runDetails(runType,distanceKm,runTarget='hr',target='Z2'){
    return {runType,distanceKm,runTarget,hrZone:runTarget==='hr'?target:'',paceMin:runTarget==='pace'?Number(target.split(':')[0]):0,paceSec:runTarget==='pace'?Number(target.split(':')[1]):0,runRpe:6,runBlocks:[]};
  }
  function strengthDetails(focus,blocks,rir=2){return {strengthFocus:focus,targetRir:rir,strengthBlocks:blocks,strengthAccessories:'Complementari liberi, senza raccolta dati.'};}
  function outcome(date,result){
    const status=result.status||'completed';const skipped=status==='skipped';const duration=skipped?null:Number(result.duration);
    return {status,actualDurationMin:duration,actualDistanceKm:skipped?null:(result.distance??null),rpe:skipped?null:Number(result.rpe),sessionLoad:skipped?0:Math.round(duration*Number(result.rpe)),execution:skipped?null:(result.execution||'as-planned'),pain:skipped?null:Number(result.pain||0),skipReason:skipped?(result.skipReason||'other'):null,notes:result.notes||'Dato dimostrativo.',...(Array.isArray(result.strengthPerformance)?{strengthPerformance:result.strengthPerformance.map(item=>({...item}))}:{}),recordedAt:`${date}T18:30:00.000Z`,updatedAt:`${date}T18:30:00.000Z`};
  }
  function buildSessions(){
    const templates=[
      ['easy-01','2026-06-01','running','Easy run aerobica',50,'important',runDetails('Easy run',10,'hr','Z2'),{duration:50,distance:9.7,rpe:5}],
      ['upper-02','2026-06-02','strength','Upper strength',60,'important',strengthDetails('Upper body',[{name:'Bench Press',sets:'4',reps:'5',target:'82.5 kg',rest:'2 min'},{name:'Weighted Pull-up',sets:'4',reps:'4',target:'+22.5 kg',rest:'2 min'},{name:'Military Press',sets:'3',reps:'6',target:'47.5 kg',rest:'90 s'}]),{duration:62,rpe:7,strengthPerformance:[{exercise:'Bench Press',loadKg:82.5,reps:5},{exercise:'Weighted Pull-up',loadKg:22.5,reps:4,bodyweightKg:79},{exercise:'Military Press',loadKg:47.5,reps:6}]}],
      ['tempo-04','2026-06-04','running','Tempo / Threshold',65,'essential',runDetails('Tempo / Threshold',12,'pace','4:05'),{duration:66,distance:12.2,rpe:8,execution:'harder',pain:1}],
      ['lower-06','2026-06-06','strength','Lower strength',55,'important',strengthDetails('Lower body',[{name:'Back Squat',sets:'4',reps:'5',target:'105 kg',rest:'2 min'},{name:'Romanian Deadlift',sets:'3',reps:'6',target:'95 kg',rest:'2 min'}],3),{duration:55,rpe:7,strengthPerformance:[{exercise:'Back Squat',loadKg:105,reps:5}]}],
      ['long-07','2026-06-07','running','Lungo aerobico',90,'essential',runDetails('Long run',17,'hr','Z2'),{duration:92,distance:17.4,rpe:6}],
      ['ride-08','2026-06-08','cycling','Recovery ride',45,'optional',{rideType:'Recovery ride',powerSource:'Technogym Ride',ftpMin:55,ftpMax:65,cadence:90},{duration:44,rpe:3}],
      ['intervals-09','2026-06-09','running','Intervals 6 × 3 minuti',60,'essential',runDetails('Intervals',11,'pace','3:55'),{duration:61,distance:11.3,rpe:8,pain:2}],
      ['upper-11','2026-06-11','strength','Upper strength',65,'important',strengthDetails('Upper body',[{name:'Bench Press',sets:'5',reps:'4',target:'85 kg',rest:'2 min'},{name:'Barbell Row',sets:'4',reps:'6',target:'80 kg',rest:'90 s'}],2),{status:'partial',duration:45,rpe:7,notes:'Seduta interrotta per un impegno lavorativo.',strengthPerformance:[{exercise:'Bench Press',loadKg:85,reps:4}]}],
      ['easy-13','2026-06-13','running','Easy run',50,'important',runDetails('Easy run',10,'hr','Z2'),{duration:49,distance:9.8,rpe:5}],
      ['long-14','2026-06-14','running','Lungo progressivo',105,'essential',runDetails('Progression run',20,'pace','4:55'),{duration:104,distance:20.3,rpe:7,pain:1}],
      ['lower-15','2026-06-15','strength','Lower strength',60,'important',strengthDetails('Lower body',[{name:'Back Squat',sets:'5',reps:'4',target:'110 kg',rest:'2 min'},{name:'Bulgarian Split Squat',sets:'3',reps:'8',target:'24 kg',rest:'90 s'}],2),{duration:61,rpe:8,execution:'harder',pain:2,strengthPerformance:[{exercise:'Back Squat',loadKg:110,reps:4}]}],
      ['tempo-17','2026-06-17','running','Tempo controllato',60,'essential',runDetails('Tempo / Threshold',11,'pace','4:08'),{status:'partial',duration:42,distance:7.6,rpe:8,execution:'harder',pain:3,notes:'Ridotto il blocco centrale per gambe pesanti.'}],
      ['hyrox-19','2026-06-19','hyrox','HYROX engine',60,'important',{hyroxFormat:'HYROX engine',hyroxRpe:8,hyroxStructuredBlocks:[{name:'SkiErg + sled push',volume:'4 giri',target:'RPE 8',rest:'90 s'}]},{status:'skipped',skipReason:'time',notes:'Impegno universitario imprevisto.'}],
      ['easy-20','2026-06-20','running','Easy run breve',45,'important',runDetails('Easy run',9,'hr','Z2'),{duration:44,distance:8.6,rpe:4}],
      ['long-21','2026-06-21','running','Lungo aerobico',110,'essential',runDetails('Long run',21,'hr','Z2'),{duration:112,distance:21.4,rpe:6,pain:1}],
      ['ride-22','2026-06-22','cycling','Endurance ride',40,'optional',{rideType:'Endurance ride',powerSource:'Garmin Tacx / Neo Bike',ftpMin:60,ftpMax:70,cadence:88},{duration:40,rpe:3}],
      ['intervals-23','2026-06-23','running','Intervals 5 × 1 km',65,'essential',runDetails('Intervals',12,'pace','3:58'),{duration:66,distance:12.5,rpe:8,pain:2}],
      ['fullbody-25','2026-06-25','strength','Forza full body',60,'important',strengthDetails('Full body',[{name:'Deadlift',sets:'4',reps:'4',target:'135 kg',rest:'2 min'},{name:'Bench Press',sets:'4',reps:'6',target:'80 kg',rest:'90 s'},{name:'Weighted Pull-up',sets:'3',reps:'5',target:'+20 kg',rest:'90 s'}],3),{duration:59,rpe:7,strengthPerformance:[{exercise:'Deadlift',loadKg:135,reps:4},{exercise:'Bench Press',loadKg:80,reps:6},{exercise:'Weighted Pull-up',loadKg:20,reps:5,bodyweightKg:79}]}],
      ['metcon-27','2026-06-27','metcon','Mixed modal conditioning',50,'optional',{metconType:'Mixed modal conditioning',metconRpe:8,metconStructuredBlocks:[{name:'Row + burpee broad jump',volume:'5 giri',target:'RPE 8',rest:'60 s'}]},{status:'partial',duration:35,rpe:8,execution:'harder',pain:1}],
      ['long-28','2026-06-28','running','Lungo aerobico',120,'essential',runDetails('Long run',23,'hr','Z2'),{status:'skipped',skipReason:'fatigue',notes:'Recupero insufficiente: scelto riposo.'}]
    ];
    return templates.map(([slug,date,category,title,durationMin,priority,details,result])=>({id:`demo-june-2026-${slug}`,date,category,title,durationMin,priority,details,notes:'Seduta dimostrativa: valori realistici creati per esplorare l’app.',outcome:outcome(date,result),titleMode:'custom',demoDataset:DEMO_ID,createdAt:`${date}T06:00:00.000Z`,updatedAt:`${date}T18:30:00.000Z`}));
  }
  function buildCheckins(sessions){
    const signals={
      '2026-06-17':{energy:2,fatigue:4,soreness:6,motivation:3,level:'reduce',reason:'recovery',title:'Riduci il carico della seduta',text:'Segnali dimostrativi di recupero incompleto: mantieni lo stimolo ma riduci il volume.'},
      '2026-06-19':{energy:3,fatigue:3,soreness:3,motivation:3,availableMinutes:25,level:'reduce',reason:'time',title:'Adatta la seduta al tempo disponibile',text:'Il vincolo dimostrativo è organizzativo e non viene interpretato come fatica.'},
      '2026-06-28':{energy:1,fatigue:5,soreness:7,motivation:2,level:'replace',reason:'recovery',title:'Sostituisci la seduta intensa',text:'Segnali dimostrativi di recupero insufficiente: scegli recupero o riposo.'}
    };
    return sessions.map((session,index)=>{
      const custom=signals[session.date]||{};const level=custom.level||'proceed';
      return {id:`demo-pre-${session.id}`,sessionId:session.id,sessionDate:session.date,energy:custom.energy??(index%4===0?4:3),fatigue:custom.fatigue??(index%5===0?2:3),soreness:custom.soreness??(index%6===0?3:2),motivation:custom.motivation??4,availableMinutes:custom.availableMinutes??session.durationMin,notes:'Check-in dimostrativo.',issueReadings:[],maxIssuePain:0,worstIssue:'',recommendation:{level,reason:custom.reason||'ready',title:custom.title||'Seduta confermata',text:custom.text||'I segnali dimostrativi sono compatibili con il lavoro previsto.'},demoDataset:DEMO_ID,createdAt:`${session.date}T07:15:00.000Z`,updatedAt:`${session.date}T07:15:00.000Z`};
    });
  }
  function buildAvailability(){
    return [
      ['2026-06-01',5,60,90,['Lun','Mar','Gio','Sab','Dom'],'Settimana demo regolare.'],
      ['2026-06-08',5,60,105,['Lun','Mar','Gio','Sab','Dom'],'Giovedì soltanto 45 minuti.'],
      ['2026-06-15',4,60,110,['Lun','Mer','Ven','Sab','Dom'],'Settimana demo con università e clienti.'],
      ['2026-06-22',5,60,120,['Lun','Mar','Gio','Sab','Dom'],'Domenica da confermare in base al recupero.']
    ].map(([weekStart,sessions,sessionMinutes,longRunMinutes,days,constraints])=>({weekStart,sessions,sessionMinutes,longRunMinutes,days,weekendLong:'yes',constraints,demoDataset:DEMO_ID,createdAt:`${weekStart}T06:30:00.000Z`,updatedAt:`${weekStart}T06:30:00.000Z`}));
  }
  function buildDemoDataset(){const sessions=buildSessions();return {sessions,preSessionCheckins:buildCheckins(sessions),weeklyAvailabilityHistory:buildAvailability()};}
  function mergeCollection(existing,demo,keyFor){
    const value=clone(Array.isArray(existing)?existing:[]);let added=0,replaced=0,skipped=0;
    demo.forEach(item=>{const key=keyFor(item);const index=value.findIndex(current=>keyFor(current)===key);if(index<0){value.push(clone(item));added++;return;}if(value[index]?.demoDataset===DEMO_ID){value[index]=clone(item);replaced++;return;}skipped++;});
    return {value,added,replaced,skipped};
  }
  function mergeDemoData(existing={}){
    const demo=buildDemoDataset();const sessions=mergeCollection(existing.sessions,demo.sessions,item=>item.id);const preSessionCheckins=mergeCollection(existing.preSessionCheckins,demo.preSessionCheckins,item=>item.id);const weeklyAvailabilityHistory=mergeCollection(existing.weeklyAvailabilityHistory,demo.weeklyAvailabilityHistory,item=>item.weekStart);weeklyAvailabilityHistory.value.sort((a,b)=>a.weekStart.localeCompare(b.weekStart));
    return {sessions:sessions.value,preSessionCheckins:preSessionCheckins.value,weeklyAvailabilityHistory:weeklyAvailabilityHistory.value,stats:{sessions,preSessionCheckins,weeklyAvailabilityHistory}};
  }
  function removeDemoData(existing={}){
    const clean=value=>(Array.isArray(value)?value:[]).filter(item=>item?.demoDataset!==DEMO_ID).map(clone);
    return {sessions:clean(existing.sessions),preSessionCheckins:clean(existing.preSessionCheckins),weeklyAvailabilityHistory:clean(existing.weeklyAvailabilityHistory)};
  }
  function countDemo(value){return (Array.isArray(value)?value:[]).filter(item=>item?.demoDataset===DEMO_ID).length;}

  return {DEMO_ID,DEMO_MONTH,buildDemoDataset,mergeDemoData,removeDemoData,countDemo};
});
