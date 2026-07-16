(function(root,factory){
  const core=factory();if(typeof module!=='undefined'&&module.exports)module.exports=core;if(root)root.rcExecutionEvidenceModel=core;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const number=value=>value!==null&&value!==''&&Number.isFinite(Number(value))?Number(value):null;
  const round=(value,digits=1)=>value===null?null:+value.toFixed(digits);
  const stravaDuration=activity=>{const seconds=number(activity?.movingSec)??number(activity?.elapsedSec);return seconds&&seconds>0?seconds/60:null;};
  const whoopDuration=workout=>{const minutes=number(workout?.durationMin);return minutes&&minutes>0?minutes:null;};
  const distanceKm=activity=>{const meters=number(activity?.distanceM);return meters&&meters>0?meters/1000:null;};
  const planDistance=session=>{const value=number(session?.details?.distanceKm);return value&&value>0?value:null;};
  const deviceValue=(value,source)=>value===null?null:{value,source};

  function chooseDuration(session,strava,whoop){
    const stravaMin=stravaDuration(strava),whoopMin=whoopDuration(whoop);const endurance=['running','cycling'].includes(session?.category);let selected=null;
    if(endurance)selected=deviceValue(stravaMin,'strava')||deviceValue(whoopMin,'whoop');
    else selected=deviceValue(whoopMin,'whoop')||deviceValue(stravaMin,'strava');
    const difference=stravaMin!==null&&whoopMin!==null?Math.abs(stravaMin-whoopMin):null;const reference=Math.max(stravaMin||0,whoopMin||0);const conflict=difference!==null&&difference>Math.max(10,reference*.25);
    return{selected,stravaMin:round(stravaMin),whoopMin:round(whoopMin),differenceMin:round(difference),conflict};
  }

  function quality(decision,sourceCount,durationConflict){
    const score=number(decision?.confidence)??0;if(durationConflict||sourceCount<2||score<.68)return'low';if(score>=.85)return'high';return'medium';
  }

  function buildSessionEvidence(session,input={}){
    if(!session?.id)return null;const decisions=Array.isArray(input.decisions)?input.decisions:[];const decision=decisions.find(item=>item.status==='confirmed'&&item.sessionId===session.id);if(!decision)return null;
    const strava=(input.stravaActivities||[]).find(item=>item.id===decision.stravaActivityId)||null;const whoop=(input.whoopWorkouts||[]).find(item=>item.id===decision.whoopWorkoutId)||null;if(!strava&&!whoop)return null;
    const duration=chooseDuration(session,strava,whoop);const observedDistance=['running','cycling'].includes(session.category)?distanceKm(strava):null;const plannedDuration=number(session.durationMin);const plannedDistance=planDistance(session);const selectedDuration=duration.selected?.value??null;const movingSeconds=number(strava?.movingSec);const paceSeconds=session.category==='running'&&observedDistance&&movingSeconds?movingSeconds/observedDistance:null;const sourceCount=Number(Boolean(strava))+Number(Boolean(whoop));const warnings=[];
    if(duration.conflict)warnings.push(`Le durate Strava e WHOOP differiscono di ${Math.round(duration.differenceMin)} minuti: controlla il valore prima di salvare.`);
    return{
      sessionId:session.id,decisionId:decision.id,date:session.date,stravaActivityId:strava?.id||null,whoopWorkoutId:whoop?.id||null,sourceCount,matchConfidence:number(decision.confidence),quality:quality(decision,sourceCount,duration.conflict),warnings,
      planned:{durationMin:plannedDuration,distanceKm:plannedDistance},
      observed:{
        durationMin:round(selectedDuration),durationSource:duration.selected?.source||null,stravaDurationMin:duration.stravaMin,whoopDurationMin:duration.whoopMin,distanceKm:round(observedDistance,2),averagePaceSecPerKm:round(paceSeconds,0),
        stravaAverageHr:number(strava?.averageHr),stravaMaxHr:number(strava?.maxHr),whoopAverageHr:number(whoop?.averageHr),whoopMaxHr:number(whoop?.maxHr),averageWatts:number(strava?.averageWatts),weightedWatts:number(strava?.weightedWatts),relativeEffort:number(strava?.relativeEffort),whoopStrain:number(whoop?.strain)
      },
      comparison:{durationDeltaMin:selectedDuration===null||plannedDuration===null?null:round(selectedDuration-plannedDuration),durationDeltaPct:selectedDuration===null||!plannedDuration?null:round((selectedDuration-plannedDuration)/plannedDuration*100,0),distanceDeltaKm:observedDistance===null||plannedDistance===null?null:round(observedDistance-plannedDistance,2),durationConflict:duration.conflict,deviceDurationDifferenceMin:duration.differenceMin},
      prefill:{actualDurationMin:selectedDuration===null?null:Math.max(1,Math.round(selectedDuration)),actualDistanceKm:observedDistance===null?null:round(observedDistance,2)}
    };
  }

  function buildEvidenceIndex(sessions,input={}){
    const result=new Map();(Array.isArray(sessions)?sessions:[]).forEach(session=>{const evidence=buildSessionEvidence(session,input);if(evidence)result.set(session.id,evidence);});return result;
  }

  function createDeviceEvidenceSnapshot(evidence,values={},now=new Date()){
    if(!evidence?.decisionId)throw new TypeError('Evidenza dispositivo non valida.');const actualDuration=number(values.actualDurationMin),actualDistance=number(values.actualDistanceKm);const usedFields=[];
    if(actualDuration!==null&&evidence.prefill.actualDurationMin!==null&&actualDuration===evidence.prefill.actualDurationMin)usedFields.push('actualDurationMin');
    if(actualDistance!==null&&evidence.prefill.actualDistanceKm!==null&&Math.abs(actualDistance-evidence.prefill.actualDistanceKm)<.005)usedFields.push('actualDistanceKm');
    return{reconciliationDecisionId:evidence.decisionId,stravaActivityId:evidence.stravaActivityId,whoopWorkoutId:evidence.whoopWorkoutId,observedDurationMin:evidence.observed.durationMin,observedDistanceKm:evidence.observed.distanceKm,usedFields,reviewedAt:(now instanceof Date?now:new Date(now)).toISOString()};
  }

  return{buildSessionEvidence,buildEvidenceIndex,createDeviceEvidenceSnapshot,chooseDuration};
});
