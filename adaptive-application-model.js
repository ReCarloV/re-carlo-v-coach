(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.rcAdaptiveApplicationModel=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const settingFields=['volumeFactor','longFactor','sessionDelta','qualityMode','strengthRir','strengthSetReduction','lowerBodyProtection','lowerBodyCaution','suspendRunning'];
  const clone=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
  function stableAnalysis(analysis={}){
    const settings={};settingFields.forEach(field=>{const value=analysis?.settings?.[field];if(value!==undefined)settings[field]=value;});
    return{level:analysis.level||'steady',settings};
  }
  function hash(value){let result=2166136261;for(let index=0;index<value.length;index+=1){result^=value.charCodeAt(index);result=Math.imul(result,16777619);}return(result>>>0).toString(16).padStart(8,'0');}
  function signatureFor(analysis={}){return`adaptive-v1-${hash(JSON.stringify(stableAnalysis(analysis)))}`;}
  function markSessions(sessions,analysis,weekStart,now=new Date()){
    const appliedAt=now instanceof Date?now.toISOString():new Date(now).toISOString();const application={version:1,weekStart,appliedAt,signature:signatureFor(analysis),level:analysis?.level||'steady',confidence:analysis?.confidence||'low'};
    return(Array.isArray(sessions)?sessions:[]).map(session=>({...clone(session),coachApplication:{...application}}));
  }
  function applicationState(sessions,analysis,weekStart){
    const applications=(Array.isArray(sessions)?sessions:[]).map(item=>item?.coachApplication).filter(item=>item?.weekStart===weekStart).sort((a,b)=>String(b.appliedAt).localeCompare(String(a.appliedAt)));const latest=applications[0]||null;if(!latest)return{applied:false,stale:false,application:null,signature:signatureFor(analysis)};
    const signature=signatureFor(analysis);return{applied:latest.signature===signature,stale:latest.signature!==signature,application:clone(latest),signature};
  }

  return{signatureFor,markSessions,applicationState,stableAnalysis};
});
