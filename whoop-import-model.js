(function(root,factory){
  const dependency=typeof module!=='undefined'&&module.exports?require('./activity-import-model.js'):root?.rcActivityImportModel;
  const core=factory(dependency);
  if(typeof module!=='undefined'&&module.exports)module.exports=core;
  if(root)root.rcWhoopImportModel=core;
})(typeof globalThis!=='undefined'?globalThis:this,function(activityModel){
  'use strict';

  class WhoopImportError extends Error{constructor(code,message){super(message);this.name='WhoopImportError';this.code=code;}}
  const fail=(code,message)=>{throw new WhoopImportError(code,message);};
  if(!activityModel)fail('MISSING_IMPORT_DEPENDENCY','Il lettore locale degli archivi non è disponibile.');
  const {parseCsv,listZipEntries,decompressZipEntry}=activityModel;
  const FILES={
    cycles:['cicli_fisiologici.csv','physiological_cycles.csv'],
    sleeps:['sonno.csv','sleeps.csv'],
    workouts:['allenamenti.csv','workouts.csv'],
    journal:['voci_diario.csv','journal_entries.csv']
  };
  const DATASET_NAMES={cycles:'whoopCycles',sleeps:'whoopSleeps',workouts:'whoopWorkouts',journal:'whoopJournal'};
  const SOURCE_SCOPES={cycles:'cycle',sleeps:'sleep',workouts:'workout',journal:'journal'};
  const SOURCE_FILES={cycles:'cicli_fisiologici.csv',sleeps:'sonno.csv',workouts:'allenamenti.csv',journal:'voci_diario.csv'};
  const number=value=>String(value??'').trim()===''?null:(Number.isFinite(Number(value))?Number(value):null);
  const boolean=value=>String(value??'').trim().toLowerCase()==='true';
  const localTimestamp=value=>{
    const text=String(value??'').trim();
    if(!text)return null;
    const match=/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/.exec(text);
    if(!match)fail('INVALID_WHOOP_DATE',`Data WHOOP non riconosciuta: ${text}`);
    const [,year,month,day,hour,minute,second]=match;const date=new Date(Date.UTC(+year,+month-1,+day,+hour,+minute,+second));
    if(date.getUTCFullYear()!==+year||date.getUTCMonth()!==+month-1||date.getUTCDate()!==+day||date.getUTCHours()!==+hour||date.getUTCMinutes()!==+minute||date.getUTCSeconds()!==+second)fail('INVALID_WHOOP_DATE',`Data WHOOP non valida: ${text}`);
    return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
  };
  const dateFromTimestamp=value=>value?value.slice(0,10):null;
  const idPart=value=>String(value).replace(/[^0-9A-Za-z]+/g,'-').replace(/^-|-$/g,'').toLowerCase();
  const rowObject=(headers,row)=>Object.fromEntries(headers.map((header,index)=>[header,String(row[index]??'').trim()]));
  const required=(object,label,file)=>{
    if(!Object.prototype.hasOwnProperty.call(object,label))fail('INVALID_WHOOP_CSV',`Nel file ${file} manca la colonna “${label}”.`);
    return object[label];
  };
  function table(text,file){
    const rows=parseCsv(String(text??'').replace(/^\uFEFF/,''));
    if(rows.length<2)fail('EMPTY_WHOOP_CSV',`Il file ${file} non contiene dati.`);
    const headers=rows[0].map(value=>String(value).trim());
    return rows.slice(1).filter(row=>row.some(value=>String(value??'').trim())).map(row=>rowObject(headers,row));
  }
  function commonCycle(row,file){
    const cycleStart=localTimestamp(required(row,'Ora di inizio ciclo',file));
    return {cycleStart,cycleEnd:localTimestamp(row['Ora di fine ciclo']),date:dateFromTimestamp(cycleStart),timezone:String(required(row,'Fuso orario ciclo',file))};
  }
  function sleepMetrics(row){return {
    sleepStart:localTimestamp(row['Inizio del sonno']),wakeStart:localTimestamp(row['Inizio del risveglio']),sleepPerformancePct:number(row['Andamento del sonno %']),respiratoryRate:number(row['Frequenza respiratoria (rpm)']),sleepDurationMin:number(row['Durata del sonno (min)']),timeInBedMin:number(row['Tempo a letto (min)']),lightSleepMin:number(row['Durata del sonno leggero (min)']),deepSleepMin:number(row['Durata profondo (SWS) (min)']),remSleepMin:number(row['Durata REM (min)']),awakeMin:number(row['Durata del risveglio (min)']),sleepNeedMin:number(row['Sonno richiesto (min)']),sleepDebtMin:number(row['Sonno arretrato (min)']),sleepEfficiencyPct:number(row['Efficienza del sonno %']),sleepConsistencyPct:number(row['Regolarità del sonno %'])
  };}
  function parseCyclesCsv(text){
    const file=SOURCE_FILES.cycles;return table(text,file).map(row=>{
      const common=commonCycle(row,file);const metrics=sleepMetrics(row);const externalId=common.cycleStart;
      return {id:`whoop:cycle:${idPart(externalId)}`,externalId,...common,date:dateFromTimestamp(metrics.wakeStart||common.cycleStart),recoveryScore:number(required(row,'Punteggio di recupero %',file)),restingHr:number(row['Frequenza cardiaca a riposo (bpm)']),hrvMs:number(row['Variabilità della frequenza cardiaca (ms)']),skinTempC:number(row['Temp. cutanea (C)']),spo2Pct:number(row['Ossigeno nel sangue %']),dayStrain:number(row['Sforzo giornaliero']),energyKcal:number(row['Energia bruciata (cal)']),maxHr:number(row['FC max. (bpm)']),averageHr:number(row['FC media (bpm)']),...metrics};
    });
  }
  function parseSleepsCsv(text){
    const file=SOURCE_FILES.sleeps;return table(text,file).map(row=>{
      const common=commonCycle(row,file);const metrics=sleepMetrics(row);if(!metrics.sleepStart)fail('INVALID_WHOOP_SLEEP','Una registrazione del sonno non contiene l’orario di inizio.');
      const nap=boolean(required(row,'Riposo breve',file));const externalId=`${metrics.sleepStart}:${nap?'nap':'sleep'}`;
      return {id:`whoop:sleep:${idPart(externalId)}`,externalId,...common,date:dateFromTimestamp(metrics.wakeStart||metrics.sleepStart),...metrics,nap};
    });
  }
  function workoutCategory(name){
    const value=String(name||'').toLowerCase();
    if(/\brunning\b|trail running|corsa/.test(value))return'running';
    if(/\bcycling\b|ciclismo|spinning|mountain bike/.test(value))return'cycling';
    if(/weightlifting|weight training|sollevamento pesi/.test(value))return'strength';
    if(/functional fitness|fitness funzionale/.test(value))return'metcon';
    if(/swimming|nuoto/.test(value))return'swimming';
    if(/climbing|arrampicata/.test(value))return'climbing';
    if(/pallavolo|calcio|badminton|tennis|padel/.test(value))return'team-sport';
    if(/camminata/.test(value))return'recovery';
    if(/escursionismo|kayak/.test(value))return'outdoor';
    return'other';
  }
  function parseWorkoutsCsv(text){
    const file=SOURCE_FILES.workouts;return table(text,file).map(row=>{
      const common=commonCycle(row,file);const start=localTimestamp(required(row,'Ora di inizio allenamento',file));const end=localTimestamp(required(row,'Ora di fine allenamento',file));const name=String(required(row,'Nome attività',file))||'Allenamento WHOOP';const externalId=start;
      return {id:`whoop:workout:${idPart(externalId)}`,externalId,...common,date:dateFromTimestamp(start),start,end,durationMin:number(row['Durata (min)']),name,category:workoutCategory(name),strain:number(row["Sforzo richiesto dall'attività"]),calories:number(row['Energia bruciata (cal)']),maxHr:number(row['FC max. (bpm)']),averageHr:number(row['FC media (bpm)']),hrZonePct:[1,2,3,4,5].map(zone=>number(row[`Zona FC ${zone} %`])),gpsEnabled:boolean(row['GPS abilitato'])};
    });
  }
  function parseJournalCsv(text){
    const file=SOURCE_FILES.journal;const grouped=new Map();
    table(text,file).forEach(row=>{
      const common=commonCycle(row,file);const question=String(required(row,'Testo domanda',file));if(!question)fail('INVALID_WHOOP_JOURNAL','Una voce del diario non contiene la domanda.');
      const current=grouped.get(common.cycleStart)||{...common,entries:[]};
      if(current.entries.some(entry=>entry.question===question))fail('DUPLICATE_WHOOP_JOURNAL_ENTRY',`Il diario contiene due risposte alla domanda “${question}” nello stesso ciclo.`);
      current.entries.push({question,answer:boolean(required(row,'Risposta affermativa',file)),notes:String(row.Note||'')});grouped.set(common.cycleStart,current);
    });
    return [...grouped.values()].map(item=>{item.entries.sort((a,b)=>a.question.localeCompare(b.question,'it'));const externalId=item.cycleStart;return{id:`whoop:journal:${idPart(externalId)}`,externalId,...item};});
  }
  async function readArchiveFileTexts(file){
    if(!file||typeof file.arrayBuffer!=='function')fail('INVALID_WHOOP_FILE','Seleziona l’archivio ZIP scaricato da WHOOP.');
    if(!String(file.name||'').toLowerCase().endsWith('.zip'))fail('UNSUPPORTED_WHOOP_FILE','Per WHOOP è supportato l’archivio ZIP completo.');
    const archive=listZipEntries(await file.arrayBuffer());const result={};
    for(const [kind,names] of Object.entries(FILES)){
      const entry=archive.entries.find(item=>names.includes(item.name.replace(/^\.\//,'').split('/').at(-1).toLowerCase()));
      if(!entry)fail('INCOMPLETE_WHOOP_ARCHIVE',`Nell’archivio WHOOP manca ${SOURCE_FILES[kind]}.`);
      result[kind]=new TextDecoder('utf-8').decode(await decompressZipEntry(archive,entry));
    }
    return result;
  }
  async function readWhoopExport(file){
    const texts=await readArchiveFileTexts(file);const records={cycles:parseCyclesCsv(texts.cycles),sleeps:parseSleepsCsv(texts.sleeps),workouts:parseWorkoutsCsv(texts.workouts),journal:parseJournalCsv(texts.journal)};
    const dates=Object.values(records).flat().map(item=>item.date).filter(Boolean).sort();
    return {sourceName:file.name||'export WHOOP.zip',records,rows:Object.fromEntries(Object.entries(records).map(([key,value])=>[key,value.length])),totalRecords:Object.values(records).reduce((sum,items)=>sum+items.length,0),earliestDate:dates[0]||null,latestDate:dates.at(-1)||null};
  }
  const comparable=record=>{const copy={...record};delete copy.source;return copy;};
  const equal=(a,b)=>JSON.stringify(comparable(a))===JSON.stringify(comparable(b));
  function buildWhoopPreview(incoming,existing={}){
    const groups={};let total=0,newCount=0,duplicateCount=0,conflictCount=0;
    for(const kind of Object.keys(DATASET_NAMES)){
      const records=Array.isArray(incoming?.[kind])?incoming[kind]:[];const current=Array.isArray(existing?.[kind])?existing[kind]:[];const known=new Map(current.map(item=>[item.id,item]));const added=[];const duplicates=[];const conflicts=[];
      records.forEach(record=>{const match=known.get(record.id);if(!match)added.push(record);else if(equal(record,match))duplicates.push(record);else conflicts.push({incoming:record,existing:match});});
      groups[kind]={total:records.length,newRecords:added,duplicates,conflicts};total+=records.length;newCount+=added.length;duplicateCount+=duplicates.length;conflictCount+=conflicts.length;
    }
    const dates=Object.values(incoming||{}).flat().map(item=>item.date).filter(Boolean).sort();
    return {groups,total,newCount,duplicateCount,conflictCount,earliestDate:dates[0]||null,latestDate:dates.at(-1)||null};
  }
  function createWhoopImportBatch(preview,metadata={},now=new Date()){
    const importedAt=now instanceof Date?now.toISOString():new Date(now).toISOString();const suffix=importedAt.replace(/[^0-9]/g,'').slice(0,17);
    return {id:`whoop-${suffix}`,provider:'whoop',importedAt,sourceName:String(metadata.sourceName||'export WHOOP.zip'),sourceRows:preview.total,addedIds:Object.fromEntries(Object.entries(preview.groups).map(([kind,value])=>[kind,value.newRecords.map(item=>item.id)])),duplicateCount:preview.duplicateCount,conflictCount:preview.conflictCount,earliestDate:preview.earliestDate,latestDate:preview.latestDate};
  }
  function attachWhoopSource(preview,batch){
    return Object.fromEntries(Object.entries(preview.groups).map(([kind,value])=>[kind,value.newRecords.map(record=>({...record,source:{provider:'whoop',scope:SOURCE_SCOPES[kind],externalId:record.externalId,sourceFile:SOURCE_FILES[kind],batchId:batch.id,importedAt:batch.importedAt}}))]));
  }
  const average=values=>{const valid=values.filter(value=>Number.isFinite(Number(value))).map(Number);return valid.length?+(valid.reduce((a,b)=>a+b,0)/valid.length).toFixed(1):null;};
  function calculateWhoopSummary(records,options={}){
    const cycles=Array.isArray(records?.cycles)?records.cycles:[];const sleeps=Array.isArray(records?.sleeps)?records.sleeps:[];const workouts=Array.isArray(records?.workouts)?records.workouts:[];const dates=[...cycles,...sleeps,...workouts].map(item=>item.date).filter(Boolean).sort();const endDate=options.endDate||dates.at(-1)||null;
    if(!endDate)return{days:Number(options.days)||7,endDate:null,startDate:null,cycleDays:0,recoveryDays:0,avgRecovery:null,avgHrv:null,avgRestingHr:null,avgSleepHours:null,avgSleepPerformance:null,workouts:0,avgWorkoutStrain:null,latest:null,daily:[]};
    const days=Math.max(1,Number(options.days)||7);const [year,month,day]=endDate.split('-').map(Number);const start=new Date(year,month-1,day);start.setDate(start.getDate()-(days-1));const startDate=`${start.getFullYear()}-${String(start.getMonth()+1).padStart(2,'0')}-${String(start.getDate()).padStart(2,'0')}`;
    const selectedCycles=cycles.filter(item=>item.date>=startDate&&item.date<=endDate);const selectedSleeps=sleeps.filter(item=>!item.nap&&item.date>=startDate&&item.date<=endDate);const selectedWorkouts=workouts.filter(item=>item.date>=startDate&&item.date<=endDate);const recoveryCycles=selectedCycles.filter(item=>item.recoveryScore!==null);const latest=cycles.filter(item=>item.date<=endDate).slice().sort((a,b)=>a.cycleStart.localeCompare(b.cycleStart)).at(-1)||null;
    return {days,endDate,startDate,cycleDays:selectedCycles.length,recoveryDays:recoveryCycles.length,avgRecovery:average(recoveryCycles.map(item=>item.recoveryScore)),avgHrv:average(recoveryCycles.map(item=>item.hrvMs)),avgRestingHr:average(recoveryCycles.map(item=>item.restingHr)),avgSleepHours:average(selectedSleeps.map(item=>item.sleepDurationMin===null?null:item.sleepDurationMin/60)),avgSleepPerformance:average(selectedSleeps.map(item=>item.sleepPerformancePct)),workouts:selectedWorkouts.length,avgWorkoutStrain:average(selectedWorkouts.map(item=>item.strain)),latest,daily:selectedCycles.slice().sort((a,b)=>a.date.localeCompare(b.date)).map(item=>({date:item.date,recoveryScore:item.recoveryScore,hrvMs:item.hrvMs,restingHr:item.restingHr,sleepHours:item.sleepDurationMin===null?null:+(item.sleepDurationMin/60).toFixed(1),sleepPerformancePct:item.sleepPerformancePct}))};
  }

  return{WhoopImportError,DATASET_NAMES,SOURCE_FILES,parseCyclesCsv,parseSleepsCsv,parseWorkoutsCsv,parseJournalCsv,readWhoopExport,buildWhoopPreview,createWhoopImportBatch,attachWhoopSource,calculateWhoopSummary,workoutCategory};
});
