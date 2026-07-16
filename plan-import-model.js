(function(root,factory){
  const dependency=typeof module!=='undefined'&&module.exports?require('./activity-import-model.js'):root?.rcActivityImportModel;
  const api=factory(dependency);
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.rcPlanImportModel=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(activityModel){
  'use strict';

  class PlanImportError extends Error{
    constructor(code,message){super(message);this.name='PlanImportError';this.code=code;}
  }
  const fail=(code,message)=>{throw new PlanImportError(code,message);};
  if(!activityModel)fail('MISSING_IMPORT_DEPENDENCY','Il lettore locale dei file Excel non è disponibile.');
  const {listZipEntries,decompressZipEntry}=activityModel;
  const MONTHS={gennaio:1,febbraio:2,marzo:3,aprile:4,maggio:5,giugno:6,luglio:7,agosto:8,settembre:9,ottobre:10,novembre:11,dicembre:12};

  const text=value=>String(value??'').trim();
  const number=value=>value!==null&&value!==''&&Number.isFinite(Number(value))?Number(value):null;
  const pad=value=>String(value).padStart(2,'0');
  const dateKey=(year,month,day)=>`${year}-${pad(month)}-${pad(day)}`;
  function decodeXml(value){
    return String(value||'').replace(/&#(x?[0-9a-f]+);|&(amp|lt|gt|quot|apos);/gi,(match,numeric,named)=>{
      if(numeric){const code=numeric[0].toLowerCase()==='x'?parseInt(numeric.slice(1),16):parseInt(numeric,10);return Number.isFinite(code)?String.fromCodePoint(code):match;}
      return {amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"}[named.toLowerCase()]||match;
    });
  }
  function normalizePath(value){
    const parts=[];String(value||'').replace(/^\//,'').split('/').forEach(part=>{if(!part||part==='.')return;if(part==='..')parts.pop();else parts.push(part);});return parts.join('/');
  }
  function columnIndex(reference){
    const letters=String(reference||'').match(/^[A-Z]+/i)?.[0]?.toUpperCase();if(!letters)return-1;let result=0;for(const letter of letters)result=result*26+letter.charCodeAt(0)-64;return result-1;
  }
  function parseSharedStrings(xml){
    return [...String(xml||'').matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/gi)].map(match=>[...match[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/gi)].map(item=>decodeXml(item[1])).join(''));
  }
  function parseWorksheetXml(xml,sharedStrings=[]){
    const rows=[];
    for(const rowMatch of String(xml||'').matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/gi)){
      const row=[];const body=rowMatch[1];const cellPattern=/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/gi;
      for(const cellMatch of body.matchAll(cellPattern)){
        const attributes=cellMatch[1]||'';const inner=cellMatch[2]||'';const reference=attributes.match(/\br="([^"]+)"/i)?.[1];const index=columnIndex(reference);if(index<0)continue;
        const type=attributes.match(/\bt="([^"]+)"/i)?.[1]||'';const raw=inner.match(/<v\b[^>]*>([\s\S]*?)<\/v>/i)?.[1]??'';let value=null;
        if(type==='s')value=sharedStrings[Number(raw)]??'';
        else if(type==='inlineStr')value=[...inner.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/gi)].map(item=>decodeXml(item[1])).join('');
        else if(type==='str')value=decodeXml(raw);
        else if(raw!==''){const numeric=Number(raw);value=Number.isFinite(numeric)?numeric:decodeXml(raw);}
        row[index]=value;
      }
      rows.push(row);
    }
    return rows;
  }
  function worksheetPath(workbookXml,relationshipsXml,sheetName='Planner'){
    const sheets=[...String(workbookXml||'').matchAll(/<sheet\b([^>]*?)\/>/gi)].map(match=>({name:decodeXml(match[1].match(/\bname="([^"]+)"/i)?.[1]||''),id:match[1].match(/\br:id="([^"]+)"/i)?.[1]||''}));
    const sheet=sheets.find(item=>item.name.toLowerCase()===sheetName.toLowerCase());if(!sheet)fail('MISSING_PLANNER_SHEET',`Nel file Excel manca il foglio “${sheetName}”.`);
    const relationships=[...String(relationshipsXml||'').matchAll(/<Relationship\b([^>]*?)\/>/gi)].map(match=>({id:match[1].match(/\bId="([^"]+)"/i)?.[1]||'',target:decodeXml(match[1].match(/\bTarget="([^"]+)"/i)?.[1]||'')}));
    const relation=relationships.find(item=>item.id===sheet.id);if(!relation?.target)fail('INVALID_XLSX_RELATIONSHIP','Il foglio Planner non è collegato correttamente nel file Excel.');
    return normalizePath(relation.target.startsWith('/')?relation.target:`xl/${relation.target}`);
  }
  async function entryText(archive,name,required=true){
    const normalized=normalizePath(name).toLowerCase();const entry=archive.entries.find(item=>normalizePath(item.name).toLowerCase()===normalized);
    if(!entry){if(required)fail('INVALID_XLSX',`Nel file Excel manca ${name}.`);return'';}
    return new TextDecoder('utf-8').decode(await decompressZipEntry(archive,entry));
  }
  async function readPlanWorkbook(file){
    if(!file||typeof file.arrayBuffer!=='function')fail('INVALID_PLAN_FILE','Seleziona il file Excel della programmazione.');
    if(!String(file.name||'').toLowerCase().endsWith('.xlsx'))fail('UNSUPPORTED_PLAN_FILE','È supportato un file Excel .xlsx con il foglio Planner.');
    const archive=listZipEntries(await file.arrayBuffer());const workbookXml=await entryText(archive,'xl/workbook.xml');const relationshipsXml=await entryText(archive,'xl/_rels/workbook.xml.rels');const sharedXml=await entryText(archive,'xl/sharedStrings.xml',false);const path=worksheetPath(workbookXml,relationshipsXml,'Planner');const sheetXml=await entryText(archive,path);const matrix=parseWorksheetXml(sheetXml,parseSharedStrings(sharedXml));const parsed=parsePlannerMatrix(matrix,{sourceName:file.name,now:new Date()});
    return {...parsed,sourceName:file.name,sheetName:'Planner'};
  }

  function excelSerialDate(value){
    const serial=number(value);if(serial===null||serial<=0)return null;const date=new Date(Date.UTC(1899,11,30)+Math.floor(serial)*86400000);return date.toISOString().slice(0,10);
  }
  function addDays(key,days){const [year,month,day]=key.split('-').map(Number);const date=new Date(year,month-1,day,12);date.setDate(date.getDate()+days);return dateKey(date.getFullYear(),date.getMonth()+1,date.getDate());}
  function weekStart(label,year){
    const value=text(label).toLowerCase().replace(/\s+/g,' ');const match=value.match(/^(\d{1,2})(?:\s+([a-zà]+))?\s*[-–]\s*\d{1,2}\s+([a-zà]+)$/i);if(!match)fail('INVALID_PLAN_WEEK',`Settimana non riconosciuta: ${label}`);
    const month=MONTHS[match[2]||match[3]];const day=Number(match[1]);if(!month)fail('INVALID_PLAN_WEEK',`Mese non riconosciuto: ${label}`);const date=new Date(year,month-1,day,12);if(date.getFullYear()!==year||date.getMonth()!==month-1||date.getDate()!==day)fail('INVALID_PLAN_WEEK',`Data di inizio settimana non valida: ${label}`);return dateKey(year,month,day);
  }
  function weekEnd(label,year){
    const value=text(label).toLowerCase().replace(/\s+/g,' ');const match=value.match(/^(\d{1,2})(?:\s+([a-zà]+))?\s*[-–]\s*(\d{1,2})\s+([a-zà]+)$/i);if(!match)fail('INVALID_PLAN_WEEK',`Settimana non riconosciuta: ${label}`);
    const startMonth=MONTHS[match[2]||match[4]],endMonth=MONTHS[match[4]],startDay=Number(match[1]),endDay=Number(match[3]);if(!startMonth||!endMonth)fail('INVALID_PLAN_WEEK',`Mese non riconosciuto: ${label}`);let endYear=year;if(endMonth<startMonth||endMonth===startMonth&&endDay<startDay)endYear+=1;const date=new Date(endYear,endMonth-1,endDay,12);if(date.getFullYear()!==endYear||date.getMonth()!==endMonth-1||date.getDate()!==endDay)fail('INVALID_PLAN_WEEK',`Data di fine settimana non valida: ${label}`);return dateKey(endYear,endMonth,endDay);
  }
  function normalizeHeader(value){return text(value).toLowerCase().replace(/\s+/g,' ');}
  function plannerColumns(headers){
    const map=new Map(headers.map((value,index)=>[normalizeHeader(value),index]));const aliases={week:['week'],weekLabel:['date'],phase:['phase'],priority:['priority'],session:['session'],type:['type'],plannedKm:['planned km'],plannedMin:['planned min'],plan:['plan'],coachNotes:['coach notes'],status:['status'],actualDate:['actual date'],actualKm:['actual km'],actualMin:['actual min'],avgPace:['avg pace'],avgHr:['avg hr'],pain:['knee 0-10'],rpe:['rpe'],notes:['your notes']};const result={};
    Object.entries(aliases).forEach(([key,names])=>{result[key]=names.map(name=>map.get(name)).find(index=>index!==undefined)??-1;});
    ['week','weekLabel','priority','session','type','plannedMin','status'].forEach(key=>{if(result[key]<0)fail('INVALID_PLANNER_HEADERS',`Nel foglio Planner manca la colonna ${aliases[key][0]}.`);});return result;
  }
  function rowValue(row,index){return index<0?null:row[index]??null;}
  function categoryFor(row){
    const type=text(row.type).toLowerCase();const content=`${row.session} ${row.plan}`.toLowerCase();if(/gara|run|long run|easy run/.test(type))return'running';if(/forza/.test(type))return'strength';if(/bike|cicl|rulli/.test(content))return'cycling';return'recovery';
  }
  function runTypeFor(row){
    const value=`${row.type} ${row.session}`.toLowerCase();if(/gara/.test(value))return'Race';if(/long run/.test(value))return'Long run';if(/recovery/.test(value))return'Recovery run';if(/easy/.test(value))return'Easy run';if(/progressiv/.test(value))return'Progression run';if(/fartlek|interval|soglia|cruise|qualità/.test(value))return'Intervals';if(/ritmo|medio/.test(value))return'Tempo / Threshold';return'Easy run';
  }
  function strengthFocusFor(row){const title=text(row.session).toLowerCase();const plan=text(row.plan).toLowerCase();if(/upper/.test(title))return'Upper body';if(/lower/.test(title))return'Lower body';if(/full body|travel|attivazione/.test(title))return'Full body';if(/upper/.test(plan))return'Upper body';if(/lower/.test(plan))return'Lower body';return'Accessori / prevenzione';}
  const liftDefinitions=[
    {pattern:/\btrap(?: bar)?\b/i,name:'Deadlift'},
    {pattern:/\brdl\b|romanian deadlift/i,name:'Romanian Deadlift'},
    {pattern:/\bsquat\b/i,name:'Back Squat'},
    {pattern:/\bbench\b|panca/i,name:'Bench Press'},
    {pattern:/pull[- ]?up|trazioni/i,name:'Weighted Pull-up'},
    {pattern:/\bmilitary\b/i,name:'Military Press'}
  ];
  function strengthBlocks(plan){
    const result=[];for(const segment of text(plan).split(';').map(item=>item.trim()).filter(Boolean)){if(/split squat|goblet squat|bulgarian/i.test(segment))continue;const lift=liftDefinitions.find(item=>item.pattern.test(segment));if(!lift||result.some(item=>item.name===lift.name))continue;const scheme=segment.match(/(\d+)\s*[x×]\s*(\d+)/i);result.push({name:lift.name,sets:scheme?.[1]||'',reps:scheme?.[2]||'',target:segment,rest:''});}return result;
  }
  function sessionDetails(row,category){
    if(category==='running')return{runType:runTypeFor(row),distanceKm:number(row.plannedKm),runTarget:'free',hrZone:'',paceMin:0,paceSec:0,runRpe:0,runBlocks:[]};
    if(category==='strength')return{strengthFocus:strengthFocusFor(row),targetRir:'',strengthBlocks:strengthBlocks(row.plan),strengthAccessories:text(row.plan)};
    if(category==='cycling')return{rideType:/recuper|facile/i.test(`${row.session} ${row.plan}`)?'Recovery ride':'Endurance ride',powerSource:'FC / RPE',ftpMin:null,ftpMax:null,cadence:null};
    return{recoveryType:/cammin/i.test(`${row.session} ${row.plan}`)?'Camminata':'Cardio rigenerante'};
  }
  function cleanTitle(value){const original=text(value);const cleaned=original.replace(/^(?:RUN\s*\d+|FORZA\s*\d*|CARDIO|NUOTO(?:\/CAMMINATA)?|ATTIVAZIONE|GARA)\s*[-–]\s*/i,'').trim();if(/^opzionale$/i.test(cleaned)){if(/^NUOTO\/CAMMINATA/i.test(original))return'Nuoto / camminata opzionale';if(/^ATTIVAZIONE/i.test(original))return'Attivazione opzionale';if(/^CARDIO/i.test(original))return'Cardio opzionale';}return cleaned||original;}
  function isRace(row){return/(^|\s)gara(?:\s|[-–:]|$)|race day|competition/i.test(`${row.type} ${row.session}`);}
  function isLongOrRace(row){return/long run/i.test(`${row.type} ${row.session}`)||isRace(row);}
  function priorityFor(row){if(/opzionale/i.test(`${row.session} ${row.coachNotes}`))return'optional';if(Number(row.priority)===1||isLongOrRace(row))return'essential';return'important';}
  function outcomeFor(row,date,nowIso){
    const statusText=text(row.status).toLowerCase();const status=statusText==='fatta'?'completed':statusText==='parziale'?'partial':statusText==='saltata'?'skipped':null;if(!status)return null;const skipped=status==='skipped';const duration=skipped?null:number(row.actualMin);const distance=skipped?null:number(row.actualKm);const rpe=skipped?null:number(row.rpe);const pain=skipped?null:number(row.pain);const recordedAt=`${row.actualDate||date}T18:00:00.000Z`;
    return{status,actualDurationMin:duration,actualDistanceKm:distance,rpe,sessionLoad:duration!==null&&rpe!==null?Math.round(duration*rpe):0,execution:null,pain,skipReason:skipped?'other':null,notes:text(row.notes),recordedAt,updatedAt:nowIso};
  }
  function assignDates(rows,year){
    const groups=new Map();rows.forEach(row=>{const key=String(row.week);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row);});
    groups.forEach(group=>{
      group.sort((a,b)=>Number(a.priority)-Number(b.priority));const start=weekStart(group[0].weekLabel,year);const templates={1:[2],2:[1,6],3:[0,3,6],4:[0,2,4,6],5:[0,1,3,4,6],6:[0,1,2,3,4,6]};const preferred=templates[Math.min(6,group.length)]||[0,1,2,3,4,5,6];const used=new Set();
      group.forEach(row=>{if(row.actualDate){const offset=Math.round((new Date(`${row.actualDate}T12:00:00`)-new Date(`${start}T12:00:00`))/86400000);if(offset>=0&&offset<=6)used.add(offset);row.date=row.actualDate;}});
      group.filter(row=>!row.date&&isRace(row)).forEach(row=>{row.date=weekEnd(row.weekLabel,year);const offset=Math.round((new Date(`${row.date}T12:00:00`)-new Date(`${start}T12:00:00`))/86400000);if(offset>=0&&offset<=6)used.add(offset);});
      group.filter(row=>!row.date&&/long run/i.test(`${row.type} ${row.session}`)).forEach(row=>{const offset=!used.has(6)?6:!used.has(5)?5:preferred.find(value=>!used.has(value));used.add(offset);row.date=addDays(start,offset);});
      group.filter(row=>!row.date).forEach(row=>{let offset=preferred.find(value=>!used.has(value)&&value!==6);if(offset===undefined)offset=[0,1,2,3,4,5,6].find(value=>!used.has(value));used.add(offset);row.date=addDays(start,offset);});
    });
    return rows;
  }
  function migrateImportedRaceDate(session){
    if(!session?.planImport?.weekLabel||!isRace({type:session.details?.runType,session:`${session.title||''} ${session.planImport.originalTitle||''}`}))return session;
    const year=Number(String(session.date||'').slice(0,4));if(!Number.isInteger(year))return session;let expected;try{expected=weekEnd(session.planImport.weekLabel,year);}catch(_){return session;}return expected&&expected!==session.date?{...session,date:expected,updatedAt:new Date().toISOString()}:session;
  }
  function detectYear(rows,sourceName){const actual=rows.map(row=>row.actualDate).find(Boolean);if(actual)return Number(actual.slice(0,4));const named=String(sourceName||'').match(/20\d{2}/)?.[0];return named?Number(named):new Date().getFullYear();}
  function parsePlannerMatrix(matrix,options={}){
    if(!Array.isArray(matrix)||matrix.length<2)fail('EMPTY_PLANNER','Il foglio Planner non contiene sedute.');const columns=plannerColumns(matrix[0]);const importedAt=(options.now instanceof Date?options.now:new Date(options.now||Date.now())).toISOString();const raw=[];
    matrix.slice(1).forEach((row,index)=>{const session=text(rowValue(row,columns.session));if(!session)return;const plannedMin=number(rowValue(row,columns.plannedMin));if(plannedMin===null||plannedMin<=0)fail('INVALID_PLAN_ROW',`Alla riga ${index+2} manca una durata pianificata valida.`);raw.push({rowNumber:index+2,week:number(rowValue(row,columns.week)),weekLabel:text(rowValue(row,columns.weekLabel)),phase:text(rowValue(row,columns.phase)),priority:number(rowValue(row,columns.priority)),session,type:text(rowValue(row,columns.type)),plannedKm:number(rowValue(row,columns.plannedKm)),plannedMin,plan:text(rowValue(row,columns.plan)),coachNotes:text(rowValue(row,columns.coachNotes)),status:text(rowValue(row,columns.status)),actualDate:excelSerialDate(rowValue(row,columns.actualDate)),actualKm:number(rowValue(row,columns.actualKm)),actualMin:number(rowValue(row,columns.actualMin)),avgPace:text(rowValue(row,columns.avgPace)),avgHr:number(rowValue(row,columns.avgHr)),pain:number(rowValue(row,columns.pain)),rpe:number(rowValue(row,columns.rpe)),notes:text(rowValue(row,columns.notes))});});
    if(!raw.length)fail('EMPTY_PLANNER','Il foglio Planner non contiene sedute.');const year=detectYear(raw,options.sourceName);assignDates(raw,year);const sessions=raw.map(row=>{const category=categoryFor(row);const notes=[row.plan?`Piano: ${row.plan}`:'',row.coachNotes?`Coach: ${row.coachNotes}`:'',row.phase?`Fase: ${row.phase}`:'',row.avgPace?`Passo Excel: ${row.avgPace}`:'',row.avgHr!==null?`FC media Excel: ${row.avgHr} bpm`:''].filter(Boolean).join('\n');return{id:`excel-plan:${year}:w${pad(row.week)}:p${pad(row.priority)}`,date:row.date,category,title:cleanTitle(row.session),durationMin:row.plannedMin,priority:priorityFor(row),details:sessionDetails(row,category),notes,outcome:outcomeFor(row,row.date,importedAt),titleMode:'custom',planImport:{provider:'excel',sourceName:String(options.sourceName||'Piano Excel'),sheet:'Planner',row:row.rowNumber,week:row.week,weekLabel:row.weekLabel,phase:row.phase,originalTitle:row.session,importedAt},createdAt:importedAt,updatedAt:importedAt};});const dates=sessions.map(item=>item.date).sort();return{sessions,year,rows:raw.length,completed:sessions.filter(item=>item.outcome?.status==='completed').length,partial:sessions.filter(item=>item.outcome?.status==='partial').length,skipped:sessions.filter(item=>item.outcome?.status==='skipped').length,earliestDate:dates[0],latestDate:dates.at(-1)};
  }
  function comparable(session){return JSON.stringify({date:session.date,category:session.category,title:session.title,durationMin:session.durationMin,priority:session.priority,details:session.details,notes:session.notes,outcome:session.outcome?{...session.outcome,updatedAt:undefined}:null});}
  function buildPlanImportPreview(incoming,existing=[]){
    if(!Array.isArray(incoming)||!Array.isArray(existing))fail('INVALID_PLAN_LIST','L’elenco delle sedute non è valido.');const byId=new Map(existing.map(item=>[item.id,item]));const semantic=new Map(existing.map(item=>[`${item.date}|${text(item.title).toLowerCase()}`,item]));const newSessions=[],duplicates=[],conflicts=[];
    incoming.forEach(session=>{const current=byId.get(session.id);if(current){if(comparable(current)===comparable(session))duplicates.push(session);else conflicts.push({incoming:session,existing:current});return;}const same=semantic.get(`${session.date}|${text(session.title).toLowerCase()}`);if(same){duplicates.push(session);return;}newSessions.push(session);});
    return{total:incoming.length,newSessions,duplicates,conflicts,merged:[...existing,...newSessions].sort((a,b)=>a.date.localeCompare(b.date)||a.title.localeCompare(b.title,'it'))};
  }

  return{PlanImportError,decodeXml,parseSharedStrings,parseWorksheetXml,worksheetPath,excelSerialDate,weekStart,weekEnd,parsePlannerMatrix,readPlanWorkbook,buildPlanImportPreview,assignDates,migrateImportedRaceDate};
});
