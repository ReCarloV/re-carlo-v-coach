(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.rcStrengthPerformanceModel=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const LIFTS={
    pullup:{label:'Trazioni zavorrate',externalLoad:true,aliases:['weighted pull-up','weighted pullup','weighted chin-up','weighted chinup','trazioni zavorrate','trazione zavorrata']},
    bench:{label:'Panca piana',externalLoad:false,aliases:['bench press','panca piana']},
    military:{label:'Military Press',externalLoad:false,aliases:['military press','overhead press','strict press']},
    squat:{label:'Squat',externalLoad:false,aliases:['back squat','squat']},
    deadlift:{label:'Stacco',externalLoad:false,aliases:['deadlift','stacco','stacco da terra']}
  };
  const FORMULAS=Object.freeze({
    epley:{label:'Epley',shortLabel:'EPLEY'},
    brzycki:{label:'Brzycki',shortLabel:'BRZYCKI'},
    lombardi:{label:'Lombardi',shortLabel:'LOMBARDI'},
    average:{label:'Media Epley + Brzycki + Lombardi',shortLabel:'MEDIA 3'}
  });

  function normalizedName(value){return String(value||'').trim().toLocaleLowerCase('it-IT').replace(/[–—]/g,'-').replace(/\s+/g,' ');}
  function liftKey(exercise){const name=normalizedName(exercise);return Object.keys(LIFTS).find(key=>LIFTS[key].aliases.includes(name))||null;}
  function roundHalf(value){return Math.round(Number(value)*2)/2;}
  function normalizedRpe(value){
    if(value===null||value===undefined||value==='')return null;const rpe=Number(value);return Number.isFinite(rpe)&&rpe>=6&&rpe<=10&&Number.isInteger(rpe*2)?rpe:null;
  }
  function rirFromRpe(value){const rpe=normalizedRpe(value);return rpe===null?null:roundHalf(10-rpe);}
  function effectiveReps(reps,rpe){
    const count=Number(reps);if(!Number.isInteger(count)||count<1||count>10)return null;const rir=rirFromRpe(rpe);return rir===null?count:count+rir;
  }
  function rawEstimate(load,reps,formula){
    if(formula==='brzycki')return load*36/(37-reps);
    if(formula==='lombardi')return load*Math.pow(reps,.1);
    if(formula==='average')return (rawEstimate(load,reps,'epley')+rawEstimate(load,reps,'brzycki')+rawEstimate(load,reps,'lombardi'))/3;
    return load*(1+reps/30);
  }
  function estimateE1rm(loadKg,reps,options={}){
    const load=Number(loadKg),count=Number(reps);if(!Number.isFinite(load)||load<=0||!Number.isInteger(count)||count<1||count>10)return null;
    const hasRpe=options.rpe!==null&&options.rpe!==undefined&&options.rpe!=='';const rpe=normalizedRpe(options.rpe);if(hasRpe&&rpe===null)return null;const adjustedCount=effectiveReps(count,rpe);
    if(adjustedCount===1)return roundHalf(load);
    const formula=FORMULAS[options.formula]?options.formula:'epley';
    if(options.externalLoad){const bodyweight=Number(options.bodyweightKg);if(!Number.isFinite(bodyweight)||bodyweight<=0)return null;return roundHalf(rawEstimate(bodyweight+load,adjustedCount,formula)-bodyweight);}
    return roundHalf(rawEstimate(load,adjustedCount,formula));
  }
  function normalizedEntry(entry){
    const key=liftKey(entry?.exercise),loadKg=Number(entry?.loadKg),reps=Number(entry?.reps);if(!key||!Number.isFinite(loadKg)||loadKg<=0||!Number.isInteger(reps)||reps<1||reps>10)return null;
    const hasRpe=entry?.rpe!==null&&entry?.rpe!==undefined&&entry?.rpe!=='',rpe=normalizedRpe(entry?.rpe);if(hasRpe&&rpe===null)return null;
    const bodyweightKg=Number(entry?.bodyweightKg);return {key,exercise:String(entry.exercise).trim(),loadKg:roundHalf(loadKg),reps,...(rpe!==null?{rpe}:{}),...(key==='pullup'&&Number.isFinite(bodyweightKg)&&bodyweightKg>0?{bodyweightKg:roundHalf(bodyweightKg)}:{})};
  }
  function plannedValues(block){
    const hasLoad=block?.loadKg!==''&&block?.loadKg!==null&&block?.loadKg!==undefined,load=Number(block?.loadKg),reps=Number(block?.reps);return{...(hasLoad&&Number.isFinite(load)&&load>=0?{plannedLoadKg:roundHalf(load)}:{}),...(Number.isInteger(reps)&&reps>0?{plannedReps:reps}:{})};
  }
  function editableLifts(session){
    const result=[],seen=new Set();
    const add=(exercise,block=null)=>{const key=liftKey(exercise);if(!key||seen.has(key))return;seen.add(key);result.push({key,label:LIFTS[key].label,exercise:String(exercise).trim(),externalLoad:LIFTS[key].externalLoad,planned:Boolean(block),...plannedValues(block)});};
    (Array.isArray(session?.details?.strengthBlocks)?session.details.strengthBlocks:[]).forEach(item=>add(item?.name,item));
    (Array.isArray(session?.outcome?.strengthPerformance)?session.outcome.strengthPerformance:[]).forEach(item=>add(item?.exercise));
    return result;
  }
  function deriveMaxes({sessions=[],manualMaxes={},bodyweightKg=null,formula='epley'}={}){
    const selectedFormula=FORMULAS[formula]?formula:'epley';
    const result=Object.fromEntries(Object.keys(LIFTS).map(key=>[key,null]));
    (Array.isArray(sessions)?sessions:[]).forEach(session=>{
      if(session?.category!=='strength'||!['completed','partial'].includes(session?.outcome?.status))return;
      (Array.isArray(session.outcome.strengthPerformance)?session.outcome.strengthPerformance:[]).forEach(raw=>{
        const entry=normalizedEntry(raw);if(!entry)return;const lift=LIFTS[entry.key];const observationBodyweight=entry.bodyweightKg||bodyweightKg;const value=estimateE1rm(entry.loadKg,entry.reps,{externalLoad:lift.externalLoad,bodyweightKg:observationBodyweight,formula:selectedFormula,rpe:entry.rpe});if(value===null)return;
        const candidate={key:entry.key,label:lift.label,value,source:'recorded',formula:selectedFormula,exercise:entry.exercise,loadKg:entry.loadKg,reps:entry.reps,...(entry.rpe!==undefined?{rpe:entry.rpe,rir:rirFromRpe(entry.rpe),effectiveReps:effectiveReps(entry.reps,entry.rpe)}:{}),...(entry.bodyweightKg?{bodyweightKg:entry.bodyweightKg}:{}),date:session.date||'',sessionId:session.id||''};const current=result[entry.key];
        if(!current||candidate.value>current.value||(candidate.value===current.value&&candidate.date>current.date))result[entry.key]=candidate;
      });
    });
    Object.keys(LIFTS).forEach(key=>{const value=Number(manualMaxes?.[key]);if(Number.isFinite(value)&&value>0)result[key]={key,label:LIFTS[key].label,value:roundHalf(value),source:'manual',externalLoad:LIFTS[key].externalLoad};});
    return result;
  }

  return {LIFTS,FORMULAS,liftKey,rirFromRpe,effectiveReps,estimateE1rm,normalizedEntry,plannedValues,editableLifts,deriveMaxes};
});
