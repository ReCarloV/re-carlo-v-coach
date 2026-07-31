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

  const datasetLabels=Object.freeze({
    profile:'Profilo atleta',hrZones:'Zone cardiache',profilePhoto:'Foto profilo',sessions:'Piano e registrazioni',weeklyCheckin:'Check-in settimana',weeklyAvailabilityHistory:'Disponibilità settimanali',preSessionCheckins:'Check-in pre-sessione',bodyIssues:'Mappa fastidi',importedActivities:'Attività Strava',importBatches:'Importazioni Strava',whoopCycles:'Recovery WHOOP',whoopSleeps:'Sonno WHOOP',whoopWorkouts:'Allenamenti WHOOP',whoopJournal:'Diario WHOOP',whoopImportBatches:'Importazioni WHOOP',reconciliationDecisions:'Abbinamenti sedute',evidenceReviews:'Revisioni scientifiche',goals:'Obiettivi e gare',preferences:'Preferenze app'
  });
  const fieldLabels=Object.freeze({firstName:'nome',lastName:'cognome',birthDate:'data di nascita',heightCm:'altezza',weightKg:'peso',hrMax:'FC massima',restingHr:'FC a riposo',ftp:'FTP',sports:'discipline',equipment:'attrezzatura',personalBests:'personal best',strengthMaxes:'massimali',planView:'vista Piano',uiTheme:'tema'});
  const diffPriority=Object.freeze(['sessions','goals','preSessionCheckins','weeklyCheckin','weeklyAvailabilityHistory','bodyIssues','reconciliationDecisions','whoopCycles','whoopSleeps','whoopWorkouts','importedActivities','profile','hrZones','profilePhoto','evidenceReviews','preferences','whoopJournal','importBatches','whoopImportBatches']);

  function recordKey(item,index){
    if(item&&typeof item==='object'){
      for(const field of ['id','pmid','externalId','weekStart','createdAt'])if(item[field]!==undefined&&item[field]!==null&&String(item[field]).trim())return`${field}:${String(item[field])}`;
      const date=String(item.date||item.sessionDate||''),session=String(item.sessionId||'');if(date||session)return`date:${date}:${session}`;
    }
    return`item:${index}:${fnv1a(stable(item))}`;
  }
  function recordLabel(item,index){
    if(!item||typeof item!=='object')return`elemento ${index+1}`;
    const name=item.title||item.name||item.zoneLabel||item.question||item.label;
    const date=item.date||item.sessionDate||item.weekStart;
    if(name&&date)return`${String(name).slice(0,70)} · ${date}`;
    if(name)return String(name).slice(0,90);
    if(date)return String(date);
    return`record ${String(item.id||item.pmid||item.externalId||index+1).slice(0,50)}`;
  }
  function arrayDiff(localValue,remoteValue){
    const local=Array.isArray(localValue)?localValue:[],cloud=Array.isArray(remoteValue)?remoteValue:[];
    const localMap=new Map(local.map((item,index)=>[recordKey(item,index),{item,index}])),cloudMap=new Map(cloud.map((item,index)=>[recordKey(item,index),{item,index}]));
    const localOnly=[],cloudOnly=[],changed=[];
    localMap.forEach((entry,key)=>{if(!cloudMap.has(key))localOnly.push(recordLabel(entry.item,entry.index));else if(!sameData(entry.item,cloudMap.get(key).item))changed.push(recordLabel(entry.item,entry.index));});
    cloudMap.forEach((entry,key)=>{if(!localMap.has(key))cloudOnly.push(recordLabel(entry.item,entry.index));});
    return{kind:'records',localTotal:local.length,cloudTotal:cloud.length,localOnly:localOnly.length,cloudOnly:cloudOnly.length,changed:changed.length,details:[...localOnly.slice(0,2).map(label=>({side:'local',label})),...cloudOnly.slice(0,2).map(label=>({side:'cloud',label})),...changed.slice(0,2).map(label=>({side:'changed',label}))].slice(0,4)};
  }
  function objectDiff(localValue,remoteValue){
    const local=localValue&&typeof localValue==='object'&&!Array.isArray(localValue)?localValue:{},cloud=remoteValue&&typeof remoteValue==='object'&&!Array.isArray(remoteValue)?remoteValue:{};
    const fields=[...new Set([...Object.keys(local),...Object.keys(cloud)])].filter(key=>key!=='cloudSyncCursor'&&!sameData(local[key],cloud[key]));
    return{kind:'fields',localTotal:Object.keys(local).length,cloudTotal:Object.keys(cloud).length,localOnly:fields.filter(key=>!(key in cloud)).length,cloudOnly:fields.filter(key=>!(key in local)).length,changed:fields.filter(key=>key in local&&key in cloud).length,details:fields.slice(0,4).map(key=>({side:key in local&&key in cloud?'changed':key in local?'local':'cloud',label:fieldLabels[key]||key}))};
  }
  function snapshotDiff(localSnapshot,remoteSnapshot){
    if(!localSnapshot?.data||!remoteSnapshot?.data)throw new Error('Le copie da confrontare non sono valide.');
    const local=synchronizedData(localSnapshot),cloud=synchronizedData(remoteSnapshot),keys=[...new Set([...Object.keys(local),...Object.keys(cloud)])];
    const changes=keys.filter(key=>!sameData(local[key],cloud[key])).map(key=>{
      const localValue=local[key]?.value,cloudValue=cloud[key]?.value;
      let detail;if(Array.isArray(localValue)||Array.isArray(cloudValue))detail=arrayDiff(localValue,cloudValue);else if((localValue&&typeof localValue==='object')||(cloudValue&&typeof cloudValue==='object'))detail=objectDiff(localValue,cloudValue);else detail={kind:'value',localTotal:localValue===null||localValue===undefined?0:1,cloudTotal:cloudValue===null||cloudValue===undefined?0:1,localOnly:localValue!==null&&localValue!==undefined?1:0,cloudOnly:cloudValue!==null&&cloudValue!==undefined?1:0,changed:1,details:[]};
      return{key,label:datasetLabels[key]||key,...detail};
    }).sort((a,b)=>{const ai=diffPriority.indexOf(a.key),bi=diffPriority.indexOf(b.key);return(ai<0?999:ai)-(bi<0?999:bi)||a.label.localeCompare(b.label);});
    return{changedDatasets:changes.length,localFingerprint:fingerprintSnapshot(localSnapshot),cloudFingerprint:fingerprintSnapshot(remoteSnapshot),changes};
  }

  function normalizeRevision(value){
    const revision=Number(value?.revision),createdAt=String(value?.created_at||value?.updated_at||'');
    if(!Number.isInteger(revision)||revision<1||!value?.payload||typeof value.payload!=='object'||Number.isNaN(new Date(createdAt).getTime()))return null;
    return{revision,payload:value.payload,deviceName:safeDeviceName(value.device_name),createdAt};
  }
  function normalizeRevisions(values,currentRevision){
    const seen=new Set();return(Array.isArray(values)?values:[]).map(normalizeRevision).filter(item=>item&&!seen.has(item.revision)&&seen.add(item.revision)).sort((a,b)=>b.revision-a.revision).map(item=>({...item,current:item.revision===Number(currentRevision)}));
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
    'rc:whoop-updated','rc:reconciliation-updated','rc:evidence-reviews-updated'
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

  return{stable,sameData,fnv1a,fingerprintSnapshot,cursorForUser,createCursor,snapshotSummary,snapshotDiff,normalizeRevision,normalizeRevisions,planRemoteAcceptance,shouldQueueLocalSync,decideSync,safeDeviceName};
});
