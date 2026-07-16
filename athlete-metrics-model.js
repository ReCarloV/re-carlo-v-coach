(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.rcAthleteMetricsModel=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const clone=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
  function iso(date){return`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
  function addDays(value,days){const date=new Date(`${value}T12:00:00`);date.setDate(date.getDate()+days);return iso(date);}
  function finite(value,min,max){const parsed=Number(value);return value!==null&&value!==undefined&&value!==''&&Number.isFinite(parsed)&&parsed>=min&&parsed<=max?parsed:null;}
  function median(values){const sorted=values.filter(value=>Number.isFinite(value)).sort((a,b)=>a-b);if(!sorted.length)return null;const middle=Math.floor(sorted.length/2);return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2;}
  function observedHeartRates(input={}){
    const today=input.today||iso(new Date()),start=addDays(today,-27);const cycles=(Array.isArray(input.cycles)?input.cycles:[]).filter(item=>item?.date>=start&&item.date<=today).sort((a,b)=>a.date.localeCompare(b.date));const restingValues=cycles.map(item=>finite(item.restingHr,25,120)).filter(value=>value!==null);const restingMedian=median(restingValues);const maxHr=finite(input.bodyMeasurement?.max_heart_rate,100,230);const syncedAt=input.syncedAt||cycles.at(-1)?.source?.syncedAt||cycles.at(-1)?.source?.importedAt||null;
    return{maxHr:maxHr===null?null:Math.round(maxHr),restingHr:restingMedian===null?null:Math.round(restingMedian),restingSamples:restingValues.length,syncedAt};
  }
  function observedBodyMetrics(input={}){
    const measurement=input.bodyMeasurement||{};const heightMeters=finite(measurement.height_meter,.8,2.5),weightKg=finite(measurement.weight_kilogram,30,300);const syncedAt=input.syncedAt||null;
    return{heightCm:heightMeters===null?null:+(heightMeters*100).toFixed(1),weightKg:weightKg===null?null:+weightKg.toFixed(1),syncedAt};
  }
  function applyWhoopMetrics(profile,input={}){
    const source=observedHeartRates(input),body=observedBodyMetrics(input),next=clone(profile)||{};next.heartRateSources={...(next.heartRateSources||{})};next.bodyMeasurementSources={...(next.bodyMeasurementSources||{})};let changed=false;
    if(source.maxHr!==null){if(Number(next.maxHr)!==source.maxHr)changed=true;next.maxHr=source.maxHr;const value={provider:'whoop',method:'body_measurement',value:source.maxHr,observedAt:source.syncedAt};if(JSON.stringify(next.heartRateSources.maxHr)!==JSON.stringify(value))changed=true;next.heartRateSources.maxHr=value;}
    if(source.restingHr!==null){if(Number(next.restingHr)!==source.restingHr)changed=true;next.restingHr=source.restingHr;const value={provider:'whoop',method:'median_28d',value:source.restingHr,sampleDays:source.restingSamples,observedAt:source.syncedAt};if(JSON.stringify(next.heartRateSources.restingHr)!==JSON.stringify(value))changed=true;next.heartRateSources.restingHr=value;}
    if(body.heightCm!==null){if(Number(next.heightCm)!==body.heightCm)changed=true;next.heightCm=body.heightCm;const value={provider:'whoop',method:'body_measurement',value:body.heightCm,observedAt:body.syncedAt};if(JSON.stringify(next.bodyMeasurementSources.heightCm)!==JSON.stringify(value))changed=true;next.bodyMeasurementSources.heightCm=value;}
    if(body.weightKg!==null){if(Number(next.weightKg)!==body.weightKg)changed=true;next.weightKg=body.weightKg;const value={provider:'whoop',method:'body_measurement',value:body.weightKg,observedAt:body.syncedAt};if(JSON.stringify(next.bodyMeasurementSources.weightKg)!==JSON.stringify(value))changed=true;next.bodyMeasurementSources.weightKg=value;}
    if(!Object.keys(next.heartRateSources).length)delete next.heartRateSources;
    if(!Object.keys(next.bodyMeasurementSources).length)delete next.bodyMeasurementSources;
    return{profile:next,changed,observed:{...source,...body}};
  }
  const applyWhoopHeartRates=applyWhoopMetrics;
  function manualOverrideSources(profile,{maxHr,restingHr}){
    const sources={...(profile?.heartRateSources||{})};if(Number(maxHr)!==Number(profile?.maxHr))delete sources.maxHr;if(Number(restingHr)!==Number(profile?.restingHr))delete sources.restingHr;return Object.keys(sources).length?sources:undefined;
  }
  function manualOverrideBodySources(profile,{heightCm,weightKg}){
    const sources={...(profile?.bodyMeasurementSources||{})};if(Number(heightCm)!==Number(profile?.heightCm))delete sources.heightCm;if(Number(weightKg)!==Number(profile?.weightKg))delete sources.weightKg;return Object.keys(sources).length?sources:undefined;
  }

  return{observedHeartRates,observedBodyMetrics,applyWhoopMetrics,applyWhoopHeartRates,manualOverrideSources,manualOverrideBodySources,median,addDays};
});
