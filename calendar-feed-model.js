(function(root,factory){const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;if(root)root.rcCalendarFeedModel=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const DEFAULT_START_TIME='09:00';
  function isStartTime(value){return typeof value==='string'&&/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);}
  function startTime(value){return isStartTime(value)?value:DEFAULT_START_TIME;}
  function safeDuration(value){const duration=Number(value);return Number.isFinite(duration)&&duration>0?Math.round(duration):60;}
  function eventWindow(session={}){
    const start=startTime(session.startTime),durationMin=safeDuration(session.durationMin),[hours,minutes]=start.split(':').map(Number);
    const total=hours*60+minutes+durationMin,endDayOffset=Math.floor(total/1440),endMinutes=((total%1440)+1440)%1440;
    return{startTime:start,endTime:`${String(Math.floor(endMinutes/60)).padStart(2,'0')}:${String(endMinutes%60).padStart(2,'0')}`,durationMin,endDayOffset};
  }
  function timeRange(session){const value=eventWindow(session);return`${value.startTime}–${value.endTime}${value.endDayOffset?` (+${value.endDayOffset}g)`:''}`;}
  return{DEFAULT_START_TIME,isStartTime,startTime,eventWindow,timeRange};
});
