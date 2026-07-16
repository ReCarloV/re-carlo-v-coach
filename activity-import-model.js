(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.rcActivityImportModel=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const IT_MONTHS={gen:1,feb:2,mar:3,apr:4,mag:5,giu:6,lug:7,ago:8,set:9,ott:10,nov:11,dic:12};
  const EN_MONTHS={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
  const NUMBER_FIELDS=['elapsedSec','movingSec','distanceM','elevationGainM','averageHr','maxHr','averageWatts','weightedWatts','averageCadence','relativeEffort','perceivedEffort','calories'];

  class ActivityImportError extends Error{
    constructor(code,message){super(message);this.name='ActivityImportError';this.code=code;}
  }
  function fail(code,message){throw new ActivityImportError(code,message);}
  function pad(value){return String(value).padStart(2,'0');}
  function dateKey(year,month,day){return `${year}-${pad(month)}-${pad(day)}`;}
  function localDateFromKey(key){const [year,month,day]=String(key).split('-').map(Number);return new Date(year,month-1,day);}
  function isValidDateParts(year,month,day){
    const value=new Date(year,month-1,day);
    return value.getFullYear()===year&&value.getMonth()===month-1&&value.getDate()===day;
  }
  function parseLocalStart(value){
    const text=String(value||'').trim();
    let match=text.match(/^(\d{1,2})\s+([a-zà]+)\s+(\d{4}),\s*(\d{1,2}):(\d{2}):(\d{2})$/i);
    if(match){
      const day=Number(match[1]);const month=IT_MONTHS[match[2].toLowerCase()];const year=Number(match[3]);
      if(!month||!isValidDateParts(year,month,day))fail('INVALID_ACTIVITY_DATE',`Data Strava non riconosciuta: ${text}`);
      return {date:dateKey(year,month,day),localStart:`${dateKey(year,month,day)}T${pad(match[4])}:${match[5]}:${match[6]}`};
    }
    match=text.match(/^([a-z]{3})\s+(\d{1,2}),\s*(\d{4}),\s*(\d{1,2}):(\d{2}):(\d{2})(?:\s*(AM|PM))?$/i);
    if(match){
      const month=EN_MONTHS[match[1].toLowerCase()];const day=Number(match[2]);const year=Number(match[3]);let hour=Number(match[4]);
      const meridiem=String(match[7]||'').toUpperCase();if(meridiem==='PM'&&hour<12)hour+=12;if(meridiem==='AM'&&hour===12)hour=0;
      if(!month||!isValidDateParts(year,month,day))fail('INVALID_ACTIVITY_DATE',`Data Strava non riconosciuta: ${text}`);
      return {date:dateKey(year,month,day),localStart:`${dateKey(year,month,day)}T${pad(hour)}:${match[5]}:${match[6]}`};
    }
    fail('INVALID_ACTIVITY_DATE',`Data Strava non riconosciuta: ${text}`);
  }
  function parseNumber(value){
    if(value===null||value===undefined||String(value).trim()==='')return null;
    const normalized=String(value).trim().replace(/\s/g,'').replace(',','.');const number=Number(normalized);
    return Number.isFinite(number)?number:null;
  }
  function parseCsv(text){
    const input=String(text||'').replace(/^\uFEFF/,'');const rows=[];let row=[];let field='';let quoted=false;
    for(let index=0;index<input.length;index+=1){
      const char=input[index];
      if(quoted){
        if(char==='"'&&input[index+1]==='"'){field+='"';index+=1;}
        else if(char==='"')quoted=false;
        else field+=char;
      }else if(char==='"')quoted=true;
      else if(char===','){row.push(field);field='';}
      else if(char==='\n'){row.push(field);rows.push(row);row=[];field='';}
      else if(char!=='\r')field+=char;
    }
    if(quoted)fail('INVALID_CSV','Il riepilogo Strava contiene un campo di testo non chiuso.');
    if(field!==''||row.length){row.push(field);rows.push(row);}
    return rows.filter((item,index)=>index===0||item.some(value=>String(value).trim()!==''));
  }
  function lastHeaderIndex(headers,names){
    const candidates=new Set(names.map(name=>name.toLowerCase()));let found=-1;
    headers.forEach((header,index)=>{if(candidates.has(String(header).trim().toLowerCase()))found=index;});
    return found;
  }
  function firstHeaderIndex(headers,names){
    const candidates=new Set(names.map(name=>name.toLowerCase()));
    return headers.findIndex(header=>candidates.has(String(header).trim().toLowerCase()));
  }
  function requiredHeader(headers,names,label,{last=false}={}){
    const index=(last?lastHeaderIndex:firstHeaderIndex)(headers,names);
    if(index<0)fail('INVALID_STRAVA_CSV',`Nel file Strava manca la colonna ${label}.`);
    return index;
  }
  function optionalHeader(headers,names,{last=false}={}){return (last?lastHeaderIndex:firstHeaderIndex)(headers,names);}
  function cell(row,index){return index>=0?row[index]:'';}
  function activityCategory(type){
    const value=String(type||'').toLowerCase();
    if(/corsa|run|trail/.test(value))return 'running';
    if(/pesi|weight|strength/.test(value))return 'strength';
    if(/pedalata|ciclismo|ride|cycling|ellittico|elliptical/.test(value))return 'cycling';
    if(/arrampic|climb/.test(value))return 'climbing';
    if(/nuot|swim/.test(value))return 'swimming';
    if(/cammin|escursion|walk|hike/.test(value))return 'walking';
    if(/yoga|mobil/.test(value))return 'mobility';
    if(/calcio|tennis|padel|football|soccer/.test(value))return 'team';
    if(/sci|ski/.test(value))return 'winter';
    return 'other';
  }
  function fileType(filename){
    const value=String(filename||'').toLowerCase();
    for(const suffix of ['fit.gz','tcx.gz','gpx.gz','fit','tcx','gpx'])if(value.endsWith(`.${suffix}`))return suffix;
    return value?'other':null;
  }
  function parseStravaCsv(text){
    const rows=parseCsv(text);if(rows.length<2)fail('EMPTY_STRAVA_CSV','Il riepilogo Strava non contiene attività.');
    const headers=rows[0].map(value=>String(value).trim());
    const columns={
      id:requiredHeader(headers,['ID attività','Activity ID'],'ID attività'),
      date:requiredHeader(headers,["Data dell’attività",'Activity Date'],'Data attività'),
      name:requiredHeader(headers,['Nome attività','Activity Name'],'Nome attività'),
      sport:requiredHeader(headers,['Tipo attività','Activity Type'],'Tipo attività'),
      description:optionalHeader(headers,["Descrizione dell’attività",'Activity Description']),
      gear:optionalHeader(headers,['Attrezzatura attività','Activity Gear']),
      filename:optionalHeader(headers,['Nome del file','Filename']),
      elapsed:requiredHeader(headers,['Tempo trascorso','Elapsed Time'],'Tempo trascorso',{last:true}),
      moving:requiredHeader(headers,['Tempo in movimento','Moving Time'],'Tempo in movimento',{last:true}),
      distance:requiredHeader(headers,['Distanza','Distance'],'Distanza',{last:true}),
      elevation:optionalHeader(headers,['Dislivello positivo','Elevation Gain'],{last:true}),
      avgHr:optionalHeader(headers,['Frequenza cardiaca media','Average Heart Rate'],{last:true}),
      maxHr:optionalHeader(headers,['Frequenza cardiaca massima','Max Heart Rate'],{last:true}),
      avgWatts:optionalHeader(headers,['Watt medi','Average Watts'],{last:true}),
      weightedWatts:optionalHeader(headers,['Potenza media ponderata','Weighted Average Power'],{last:true}),
      avgCadence:optionalHeader(headers,['Cadenza media','Average Cadence'],{last:true}),
      relativeEffort:optionalHeader(headers,['Sforzo relativo','Relative Effort'],{last:true}),
      perceivedEffort:optionalHeader(headers,['Sforzo percepito','Perceived Exertion'],{last:true}),
      calories:optionalHeader(headers,['Calorie','Calories'],{last:true})
    };
    const seen=new Set();const activities=[];let invalidRows=0;
    rows.slice(1).forEach((row,rowIndex)=>{
      const externalId=String(cell(row,columns.id)||'').trim();
      if(!externalId)fail('INVALID_STRAVA_ROW',`Alla riga ${rowIndex+2} manca l’ID attività.`);
      if(seen.has(externalId))fail('DUPLICATE_STRAVA_ID',`Il file contiene due righe con ID Strava ${externalId}.`);
      seen.add(externalId);
      let start;try{start=parseLocalStart(cell(row,columns.date));}catch(error){invalidRows+=1;throw error;}
      const sportType=String(cell(row,columns.sport)||'').trim()||'Non specificato';
      const originalFilename=String(cell(row,columns.filename)||'').trim();
      const activity={
        id:`strava:${externalId}`,externalId,date:start.date,localStart:start.localStart,
        name:String(cell(row,columns.name)||'').trim()||'Attività Strava',
        description:String(cell(row,columns.description)||'').trim(),sportType,category:activityCategory(sportType),
        elapsedSec:parseNumber(cell(row,columns.elapsed))||0,movingSec:parseNumber(cell(row,columns.moving))||0,
        distanceM:parseNumber(cell(row,columns.distance))||0,elevationGainM:parseNumber(cell(row,columns.elevation)),
        averageHr:parseNumber(cell(row,columns.avgHr)),maxHr:parseNumber(cell(row,columns.maxHr)),
        averageWatts:parseNumber(cell(row,columns.avgWatts)),weightedWatts:parseNumber(cell(row,columns.weightedWatts)),
        averageCadence:parseNumber(cell(row,columns.avgCadence)),relativeEffort:parseNumber(cell(row,columns.relativeEffort)),
        perceivedEffort:parseNumber(cell(row,columns.perceivedEffort)),calories:parseNumber(cell(row,columns.calories)),
        gear:String(cell(row,columns.gear)||'').trim(),originalFilename,originalFileType:fileType(originalFilename)
      };
      activities.push(activity);
    });
    activities.sort((a,b)=>a.localStart.localeCompare(b.localStart));
    return {activities,rows:rows.length-1,invalidRows,headers};
  }

  function findEndOfCentralDirectory(bytes){
    const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);const minimum=Math.max(0,bytes.byteLength-65557);
    for(let offset=bytes.byteLength-22;offset>=minimum;offset-=1)if(view.getUint32(offset,true)===0x06054b50)return offset;
    fail('INVALID_ZIP','Il file non è un archivio ZIP Strava leggibile.');
  }
  function listZipEntries(input){
    const bytes=input instanceof Uint8Array?input:new Uint8Array(input);const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
    const eocd=findEndOfCentralDirectory(bytes);const count=view.getUint16(eocd+10,true);let offset=view.getUint32(eocd+16,true);const decoder=new TextDecoder('utf-8');const entries=[];
    for(let index=0;index<count;index+=1){
      if(view.getUint32(offset,true)!==0x02014b50)fail('INVALID_ZIP','La struttura centrale del file ZIP non è valida.');
      const method=view.getUint16(offset+10,true);const compressedSize=view.getUint32(offset+20,true);const uncompressedSize=view.getUint32(offset+24,true);
      const nameLength=view.getUint16(offset+28,true);const extraLength=view.getUint16(offset+30,true);const commentLength=view.getUint16(offset+32,true);const localOffset=view.getUint32(offset+42,true);
      const name=decoder.decode(bytes.subarray(offset+46,offset+46+nameLength));entries.push({name,method,compressedSize,uncompressedSize,localOffset});
      offset+=46+nameLength+extraLength+commentLength;
    }
    return {bytes,entries};
  }
  async function decompressZipEntry(archive,entry){
    const {bytes}=archive;const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);const offset=entry.localOffset;
    if(view.getUint32(offset,true)!==0x04034b50)fail('INVALID_ZIP','Una voce del file ZIP non è leggibile.');
    const nameLength=view.getUint16(offset+26,true);const extraLength=view.getUint16(offset+28,true);const start=offset+30+nameLength+extraLength;const compressed=bytes.subarray(start,start+entry.compressedSize);
    if(entry.uncompressedSize>20*1024*1024)fail('CSV_TOO_LARGE','Il riepilogo attività supera il limite di sicurezza di 20 MB.');
    if(entry.method===0)return compressed.slice();
    if(entry.method!==8)fail('UNSUPPORTED_ZIP',`Compressione ZIP non supportata (${entry.method}). Estrai activities.csv e caricalo direttamente.`);
    if(typeof DecompressionStream==='undefined')fail('ZIP_DECOMPRESSION_UNAVAILABLE','Questo browser non può aprire direttamente il file ZIP. Estrai activities.csv e caricalo direttamente.');
    try{
      const stream=new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      return new Uint8Array(await new Response(stream).arrayBuffer());
    }catch(_){fail('INVALID_ZIP','Non è stato possibile decomprimere activities.csv. Puoi estrarlo dal file ZIP e caricarlo direttamente.');}
  }
  async function extractActivitiesCsvFromZip(input){
    const archive=listZipEntries(input);const entry=archive.entries.find(item=>item.name.replace(/^\.\//,'').toLowerCase()==='activities.csv');
    if(!entry)fail('MISSING_ACTIVITIES_CSV','Nell’archivio non è presente activities.csv.');
    const content=await decompressZipEntry(archive,entry);return {text:new TextDecoder('utf-8').decode(content),entries:archive.entries.map(item=>item.name)};
  }
  async function readStravaExport(file){
    if(!file||typeof file.arrayBuffer!=='function')fail('INVALID_IMPORT_FILE','Seleziona un archivio ZIP o il file activities.csv.');
    const name=String(file.name||'').toLowerCase();let text;let entries=null;
    if(name.endsWith('.csv'))text=await file.text();
    else if(name.endsWith('.zip')){const extracted=await extractActivitiesCsvFromZip(await file.arrayBuffer());text=extracted.text;entries=extracted.entries;}
    else fail('UNSUPPORTED_IMPORT_FILE','Sono supportati l’archivio ZIP di Strava e il file activities.csv.');
    const parsed=parseStravaCsv(text);const entrySet=entries?new Set(entries):null;const referenced=parsed.activities.filter(activity=>activity.originalFilename).map(activity=>activity.originalFilename);
    const fileTypes={};parsed.activities.forEach(activity=>{const type=activity.originalFileType||'non disponibile';fileTypes[type]=(fileTypes[type]||0)+1;});
    return {
      ...parsed,sourceName:file.name||'activities.csv',archiveEntries:entries?entries.length:null,
      originalFileEntries:entries?entries.filter(entry=>/^activities\/.+[^/]$/.test(entry)).length:null,
      referencedOriginalFiles:referenced.length,
      missingOriginalFiles:entrySet?referenced.filter(filename=>!entrySet.has(filename)).length:null,fileTypes
    };
  }

  function comparableActivity(activity){
    const value={};['id','externalId','date','localStart','name','description','sportType','category',...NUMBER_FIELDS,'gear','originalFilename','originalFileType'].forEach(key=>{value[key]=activity[key]??null;});return value;
  }
  function activitiesEqual(a,b){return JSON.stringify(comparableActivity(a))===JSON.stringify(comparableActivity(b));}
  function buildImportPreview(incoming,existing=[]){
    if(!Array.isArray(incoming)||!Array.isArray(existing))fail('INVALID_ACTIVITY_LIST','L’elenco delle attività non è valido.');
    const known=new Map(existing.filter(item=>item&&item.id).map(item=>[item.id,item]));const newActivities=[];const duplicates=[];const conflicts=[];
    incoming.forEach(activity=>{
      const current=known.get(activity.id);if(!current)newActivities.push(activity);else if(activitiesEqual(activity,current))duplicates.push(activity);else conflicts.push({incoming:activity,existing:current});
    });
    const dates=incoming.map(item=>item.date).filter(Boolean).sort();
    return {total:incoming.length,newActivities,duplicates,conflicts,earliestDate:dates[0]||null,latestDate:dates.at(-1)||null};
  }
  function createImportBatch(preview,metadata={},now=new Date()){
    const importedAt=now instanceof Date?now.toISOString():new Date(now).toISOString();const suffix=importedAt.replace(/[^0-9]/g,'').slice(0,17);
    return {
      id:`strava-${suffix}`,provider:'strava',importedAt,sourceName:String(metadata.sourceName||'export Strava'),
      sourceRows:Number(metadata.sourceRows??preview.total),addedIds:preview.newActivities.map(item=>item.id),
      duplicateCount:preview.duplicates.length,conflictCount:preview.conflicts.length,
      earliestDate:preview.earliestDate,latestDate:preview.latestDate,
      originalFileEntries:metadata.originalFileEntries===null?null:Number(metadata.originalFileEntries||0),
      missingOriginalFiles:metadata.missingOriginalFiles===null?null:Number(metadata.missingOriginalFiles||0)
    };
  }
  function attachImportSource(activities,batch){
    return activities.map(activity=>({...activity,source:{provider:'strava',scope:'activity-summary',externalId:activity.externalId,sourceFile:'activities.csv',batchId:batch.id,importedAt:batch.importedAt,hasOriginalFile:Boolean(activity.originalFilename)}}));
  }
  function calculateBaseline(activities,options={}){
    const weeks=Math.max(1,Number(options.weeks)||4);const dated=(Array.isArray(activities)?activities:[]).filter(item=>item&&item.date).slice().sort((a,b)=>a.date.localeCompare(b.date));
    const endKey=options.endDate||dated.at(-1)?.date||null;if(!endKey)return {weeks,endDate:null,startDate:null,activities:0,totalHours:0,sessionsPerWeek:0,runs:0,runKm:0,runKmPerWeek:0,runSessionsPerWeek:0,longestRunKm:0,hrCoveragePct:0,powerCoveragePct:0,weekly:[]};
    const end=localDateFromKey(endKey);const start=new Date(end);start.setDate(start.getDate()-(weeks*7-1));const startKey=dateKey(start.getFullYear(),start.getMonth()+1,start.getDate());
    const selected=dated.filter(item=>item.date>=startKey&&item.date<=endKey);const runs=selected.filter(item=>item.category==='running');
    const totalSeconds=selected.reduce((sum,item)=>sum+(Number(item.movingSec)||0),0);const runKm=runs.reduce((sum,item)=>sum+(Number(item.distanceM)||0)/1000,0);
    const weekMap=new Map();
    selected.forEach(item=>{
      const value=localDateFromKey(item.date);const monday=new Date(value);monday.setDate(monday.getDate()-((monday.getDay()+6)%7));const key=dateKey(monday.getFullYear(),monday.getMonth()+1,monday.getDate());
      const current=weekMap.get(key)||{weekStart:key,activities:0,runs:0,runKm:0,totalHours:0};current.activities+=1;current.totalHours+=(Number(item.movingSec)||0)/3600;
      if(item.category==='running'){current.runs+=1;current.runKm+=(Number(item.distanceM)||0)/1000;}weekMap.set(key,current);
    });
    const weekly=[...weekMap.values()].sort((a,b)=>a.weekStart.localeCompare(b.weekStart)).map(item=>({...item,runKm:+item.runKm.toFixed(1),totalHours:+item.totalHours.toFixed(1)}));
    const runWithHr=runs.filter(item=>Number(item.averageHr)>0).length;const runWithPower=runs.filter(item=>Number(item.averageWatts)>0||Number(item.weightedWatts)>0).length;
    return {
      weeks,endDate:endKey,startDate:startKey,activities:selected.length,totalHours:+(totalSeconds/3600).toFixed(1),sessionsPerWeek:+(selected.length/weeks).toFixed(1),
      runs:runs.length,runKm:+runKm.toFixed(1),runKmPerWeek:+(runKm/weeks).toFixed(1),runSessionsPerWeek:+(runs.length/weeks).toFixed(1),
      longestRunKm:+Math.max(0,...runs.map(item=>(Number(item.distanceM)||0)/1000)).toFixed(1),
      hrCoveragePct:runs.length?+(runWithHr/runs.length*100).toFixed(0):0,powerCoveragePct:runs.length?+(runWithPower/runs.length*100).toFixed(0):0,weekly
    };
  }

  return {ActivityImportError,parseCsv,parseLocalStart,parseStravaCsv,listZipEntries,decompressZipEntry,extractActivitiesCsvFromZip,readStravaExport,buildImportPreview,createImportBatch,attachImportSource,calculateBaseline,activitiesEqual};
});
