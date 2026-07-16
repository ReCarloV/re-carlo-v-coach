(function(root,factory){const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;if(root)root.rcCloudSyncModel=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  function stable(value){
    if(value===null||typeof value!=='object')return JSON.stringify(value);
    if(Array.isArray(value))return`[${value.map(stable).join(',')}]`;
    return`{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
  }

  function fnv1a(text){
    let hash=0x811c9dc5;
    for(let index=0;index<text.length;index+=1){hash^=text.charCodeAt(index);hash=Math.imul(hash,0x01000193);}
    return(hash>>>0).toString(16).padStart(8,'0');
  }

  function sameData(first,second){return stable(first)===stable(second);}

  function synchronizedData(snapshot){
    const data={...(snapshot?.data||{})};delete data.cloudSyncCursor;
    if(data.preferences&&typeof data.preferences==='object'&&!Array.isArray(data.preferences)){
      const preferences={...data.preferences};
      if(preferences.value&&typeof preferences.value==='object'&&!Array.isArray(preferences.value)){
        preferences.value={...preferences.value};delete preferences.value.cloudSyncCursor;
      }
      data.preferences=preferences;
    }
    return data;
  }
  function fingerprintSnapshot(snapshot){
    if(!snapshot||typeof snapshot!=='object'||!snapshot.data||typeof snapshot.data!=='object')throw new Error('La copia dati da sincronizzare non è valida.');
    return`athlete-${fnv1a(stable(synchronizedData(snapshot)))}`;
  }

  function cursorForUser(value,userId){
    if(!value||typeof value!=='object'||String(value.userId||'')!==String(userId||'')||!Number.isInteger(Number(value.revision))||Number(value.revision)<1||!/^athlete-[0-9a-f]{8}$/.test(String(value.fingerprint||'')))return null;
    return{revision:Number(value.revision),fingerprint:String(value.fingerprint),updatedAt:value.updatedAt||null};
  }
  function createCursor(userId,revision,fingerprint,updatedAt){return{userId:String(userId||''),revision:Number(revision),fingerprint:String(fingerprint||''),updatedAt:String(updatedAt||new Date().toISOString())};}

  function value(snapshot,name){return snapshot?.data?.[name]?.value;}
  function count(snapshot,name){const item=value(snapshot,name);return Array.isArray(item)?item.length:0;}
  function snapshotSummary(snapshot){
    const profile=value(snapshot,'profile');
    return{
      athleteName:profile?[profile.firstName,profile.lastName].filter(Boolean).join(' '):'',
      sessions:count(snapshot,'sessions'),
      checkins:count(snapshot,'preSessionCheckins'),
      activities:count(snapshot,'importedActivities'),
      whoopDays:count(snapshot,'whoopCycles'),
      goals:count(snapshot,'goals'),
      exportedAt:snapshot?.exportedAt||null
    };
  }

  function planRemoteAcceptance(input={}){
    const remoteRevision=Number(input.remoteRevision);
    const remoteFingerprint=fingerprintSnapshot(input.remoteSnapshot);
    const restoredFingerprint=fingerprintSnapshot(input.restoredSnapshot);
    return{
      revision:Number.isFinite(remoteRevision)?remoteRevision:null,
      remoteFingerprint,
      restoredFingerprint,
      requiresCloudRewrite:remoteFingerprint!==restoredFingerprint
    };
  }

  const localMutationEvents=new Set([
    'rc:sessions-updated','rc:goals-updated','rc:profile-updated','rc:body-issues-updated',
    'rc:pre-checkin-updated','rc:weekly-checkin-updated','rc:weekly-availability-history-updated',
    'rc:whoop-updated','rc:reconciliation-updated'
  ]);
  function shouldQueueLocalSync(eventName,detail={}){
    if(localMutationEvents.has(String(eventName||'')))return true;
    return eventName==='rc:data-restored'&&Boolean(detail&&typeof detail==='object'&&detail.type);
  }

  function decideSync(input={}){
    const local=String(input.localFingerprint||'');
    const remote=input.remoteFingerprint===null||input.remoteFingerprint===undefined?null:String(input.remoteFingerprint);
    const remoteRevision=input.remoteRevision===null||input.remoteRevision===undefined?null:Number(input.remoteRevision);
    const baseRevision=input.baseRevision===null||input.baseRevision===undefined?null:Number(input.baseRevision);
    const base=String(input.baseFingerprint||'');
    if(!local)return{action:'blocked',reason:'local-invalid'};
    if(remote===null)return{action:'upload',reason:'cloud-empty',expectedRevision:0};
    if(local===remote)return{action:'in-sync',reason:'same-content',revision:remoteRevision};
    if(baseRevision===null||!base)return{action:'choose',reason:'first-device-link',revision:remoteRevision};
    if(remoteRevision===baseRevision&&local!==base)return{action:'upload',reason:'local-only-change',expectedRevision:baseRevision};
    if(local===base&&remoteRevision!==baseRevision)return{action:'download',reason:'remote-only-change',revision:remoteRevision};
    return{action:'conflict',reason:'both-changed',revision:remoteRevision};
  }

  function safeDeviceName(value){return String(value||'Dispositivo').replace(/[<>]/g,'').trim().slice(0,60)||'Dispositivo';}

  return{stable,sameData,fnv1a,fingerprintSnapshot,cursorForUser,createCursor,snapshotSummary,planRemoteAcceptance,shouldQueueLocalSync,decideSync,safeDeviceName};
});
