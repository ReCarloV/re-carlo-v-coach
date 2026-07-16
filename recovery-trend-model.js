(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.rcRecoveryTrendModel=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const DAY_MS=86400000;
  const levelMeta={
    unavailable:{label:'Non disponibile',tone:'neutral'},
    stale:{label:'Da aggiornare',tone:'warn'},
    insufficient:{label:'Baseline breve',tone:'neutral'},
    stable:{label:'Stabile',tone:'good'},
    caution:{label:'Cautela',tone:'warn'},
    protect:{label:'Recupero da proteggere',tone:'danger'}
  };

  function iso(date){return`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
  function dateAtNoon(value){return new Date(`${value}T12:00:00`);}
  function addDays(value,days){const date=dateAtNoon(value);date.setDate(date.getDate()+days);return iso(date);}
  function ageDays(from,to){return Math.max(0,Math.round((dateAtNoon(to)-dateAtNoon(from))/DAY_MS));}
  function finite(value){return value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value));}
  function values(items,field){return items.map(item=>item?.[field]).filter(finite).map(Number);}
  function mean(items){return items.length?items.reduce((sum,value)=>sum+value,0)/items.length:null;}
  function median(items){if(!items.length)return null;const sorted=[...items].sort((a,b)=>a-b);const middle=Math.floor(sorted.length/2);return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2;}
  function percentDelta(value,baseline){return finite(value)&&finite(baseline)&&Number(baseline)!==0?(Number(value)-Number(baseline))/Number(baseline)*100:null;}
  function round(value,digits=0){return value===null?null:+Number(value).toFixed(digits);}
  function latestPerDate(items,today){const byDate=new Map();(Array.isArray(items)?items:[]).filter(item=>item?.date&&item.date<=today).forEach(item=>{const current=byDate.get(item.date);const stamp=String(item.cycleStart||item.wakeStart||item.date);const currentStamp=String(current?.cycleStart||current?.wakeStart||current?.date||'');if(!current||stamp>currentStamp)byDate.set(item.date,item);});return[...byDate.values()].sort((a,b)=>a.date.localeCompare(b.date));}
  function mainSleepByDate(sleeps,today){const byDate=new Map();(Array.isArray(sleeps)?sleeps:[]).filter(item=>item?.date&&item.date<=today&&!item.nap).forEach(item=>{const current=byDate.get(item.date);if(!current||Number(item.sleepDurationMin||0)>Number(current.sleepDurationMin||0))byDate.set(item.date,item);});return byDate;}
  function mergedDays(cycles,sleeps,today){const sleepByDate=mainSleepByDate(sleeps,today);return latestPerDate(cycles,today).map(cycle=>{const sleep=sleepByDate.get(cycle.date);return{...cycle,sleepDurationMin:finite(cycle.sleepDurationMin)?Number(cycle.sleepDurationMin):finite(sleep?.sleepDurationMin)?Number(sleep.sleepDurationMin):null,sleepPerformancePct:finite(cycle.sleepPerformancePct)?Number(cycle.sleepPerformancePct):finite(sleep?.sleepPerformancePct)?Number(sleep.sleepPerformancePct):null};});}
  function empty(level='unavailable',latestDate=null){const meta=levelMeta[level];return{level,label:meta.label,tone:meta.tone,usable:false,confidence:'low',latestDate,ageDays:latestDate?null:null,recentDays:0,baselineDays:0,avgRecovery:null,avgHrv:null,avgRestingHr:null,avgSleepPerformance:null,avgSleepHours:null,baselineHrv:null,baselineRestingHr:null,hrvDeltaPct:null,restingHrDeltaPct:null,reasons:level==='unavailable'?['Nessun dato WHOOP disponibile per questa lettura.']:[],daily:[]};}
  function analyzeRecoveryTrend(input={}){
    const today=input.today||iso(new Date());const days=mergedDays(input.cycles,input.sleeps,today);if(!days.length)return empty();
    const latest=days.at(-1);const latestAge=ageDays(latest.date,today);const recentStart=addDays(today,-2);const recent=days.filter(item=>item.date>=recentStart&&item.date<=today);const baselineStart=addDays(today,-30);const baselineEnd=addDays(today,-3);const baseline=days.filter(item=>item.date>=baselineStart&&item.date<=baselineEnd);
    const baselineHrv=median(values(baseline,'hrvMs')),baselineRhr=median(values(baseline,'restingHr'));const avgRecovery=mean(values(recent,'recoveryScore')),avgHrv=mean(values(recent,'hrvMs')),avgRhr=mean(values(recent,'restingHr')),avgSleepPerformance=mean(values(recent,'sleepPerformancePct')),avgSleepMinutes=mean(values(recent,'sleepDurationMin'));
    const hrvDelta=percentDelta(avgHrv,baselineHrv),rhrDelta=percentDelta(avgRhr,baselineRhr);const baselineDays=Math.max(values(baseline,'hrvMs').length,values(baseline,'restingHr').length);const recoveryValues=values(recent,'recoveryScore');const redDays=recoveryValues.filter(value=>value<34).length;const belowFifty=recoveryValues.filter(value=>value<50).length;const reasons=[];
    let level='stable',usable=true,confidence=baselineDays>=14&&recent.length>=3?'high':'medium';
    if(latestAge>2){level='stale';usable=false;confidence='low';reasons.push(`Ultimo dato WHOOP disponibile: ${latest.date} (${latestAge} giorni fa).`);}
    else if(baselineDays<7||recent.length<2){level='insufficient';usable=false;confidence='low';reasons.push(`Baseline personale ancora breve: ${baselineDays} giorni di riferimento e ${recent.length} recenti.`);}
    else{
      const strongSuppression=hrvDelta!==null&&hrvDelta<=-15;const strongRhrRise=rhrDelta!==null&&rhrDelta>=8;const lowSleep=avgSleepPerformance!==null&&avgSleepPerformance<65;
      const pairedSuppression=hrvDelta!==null&&hrvDelta<=-10&&rhrDelta!==null&&rhrDelta>=5;
      if(redDays>=2&&(strongSuppression||strongRhrRise||lowSleep))level='protect';
      else if(belowFifty>=2||pairedSuppression||(avgSleepPerformance!==null&&avgSleepPerformance<70))level='caution';
      if(redDays)reasons.push(`${redDays} recovery WHOOP ross${redDays===1?'o':'i'} negli ultimi ${recent.length} giorni disponibili.`);
      if(hrvDelta!==null&&Math.abs(hrvDelta)>=8)reasons.push(`HRV recente ${hrvDelta<0?'sotto':'sopra'} la baseline personale del ${Math.abs(Math.round(hrvDelta))}%.`);
      if(rhrDelta!==null&&Math.abs(rhrDelta)>=4)reasons.push(`FC a riposo recente ${rhrDelta>0?'sopra':'sotto'} la baseline personale del ${Math.abs(Math.round(rhrDelta))}%.`);
      if(avgSleepPerformance!==null&&avgSleepPerformance<75)reasons.push(`Sleep performance media recente: ${Math.round(avgSleepPerformance)}%.`);
      if(!reasons.length)reasons.push('Recovery, HRV, frequenza a riposo e sonno non mostrano scostamenti ripetuti rilevanti.');
    }
    const meta=levelMeta[level];return{level,label:meta.label,tone:meta.tone,usable,confidence,latestDate:latest.date,ageDays:latestAge,recentDays:recent.length,baselineDays,avgRecovery:round(avgRecovery,1),avgHrv:round(avgHrv,1),avgRestingHr:round(avgRhr,1),avgSleepPerformance:round(avgSleepPerformance,1),avgSleepHours:avgSleepMinutes===null?null:round(avgSleepMinutes/60,1),baselineHrv:round(baselineHrv,1),baselineRestingHr:round(baselineRhr,1),hrvDeltaPct:round(hrvDelta,1),restingHrDeltaPct:round(rhrDelta,1),reasons,daily:recent};
  }
  function todaySleepMetric(input={}){
    const today=input.today||iso(new Date());const days=mergedDays(input.cycles,input.sleeps,today);if(!days.length)return{value:'—',summary:'Nessun dato WHOOP importato',tone:'neutral',date:null};
    const latest=days.at(-1),age=ageDays(latest.date,today);const sleepMinutes=finite(latest.sleepDurationMin)?Math.round(Number(latest.sleepDurationMin)):null;const value=sleepMinutes===null?'—':`${Math.floor(sleepMinutes/60)}h ${String(sleepMinutes%60).padStart(2,'0')}`;const parts=[];
    if(age)parts.push(`Ultimo dato ${age===1?'ieri':`${age} giorni fa`}`);else parts.push('WHOOP oggi');if(finite(latest.sleepPerformancePct))parts.push(`performance ${Math.round(Number(latest.sleepPerformancePct))}%`);if(finite(latest.recoveryScore))parts.push(`recovery ${Math.round(Number(latest.recoveryScore))}%`);if(sleepMinutes===null)parts.push('durata non disponibile');
    return{value,summary:parts.join(' · '),tone:age>2?'warn':'neutral',date:latest.date,recoveryScore:finite(latest.recoveryScore)?Number(latest.recoveryScore):null,sleepPerformancePct:finite(latest.sleepPerformancePct)?Number(latest.sleepPerformancePct):null};
  }

  return{analyzeRecoveryTrend,todaySleepMetric,mergedDays,median,percentDelta,addDays};
});
