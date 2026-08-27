(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.rcPerformanceTestModel=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const SOURCES=['My Jump Lab','VBT encoder','Pedana di forza','Fotocellule','App / video analysis','Misurazione manuale'];
  const CATALOG=Object.freeze({
    cmj:{label:'CMJ',category:'Salti',description:'Countermovement jump · mani ai fianchi',primary:'jumpHeightCm',protocol:[],values:[numberField('jumpHeightCm','Altezza salto','cm',1,100,.1,true),numberField('flightTimeMs','Tempo di volo','ms',50,1500,1)]},
    'cmj-arms':{label:'CMJ con braccia',category:'Salti',description:'Countermovement jump · uso libero delle braccia',primary:'jumpHeightCm',protocol:[],values:[numberField('jumpHeightCm','Altezza salto','cm',1,100,.1,true),numberField('flightTimeMs','Tempo di volo','ms',50,1500,1)]},
    sj:{label:'Squat Jump',category:'Salti',description:'Partenza statica · nessun contromovimento',primary:'jumpHeightCm',protocol:[],values:[numberField('jumpHeightCm','Altezza salto','cm',1,100,.1,true),numberField('flightTimeMs','Tempo di volo','ms',50,1500,1)]},
    'single-leg-cmj':{label:'CMJ monopodalico',category:'Salti',description:'Confronta sempre lo stesso protocollo e lo stesso lato',primary:'jumpHeightCm',protocol:[choiceField('side','Lato',[['left','Sinistro'],['right','Destro']],true)],values:[numberField('jumpHeightCm','Altezza salto','cm',1,80,.1,true),numberField('flightTimeMs','Tempo di volo','ms',50,1500,1)]},
    'drop-jump':{label:'Drop Jump',category:'Reattività',description:'RSI da altezza del salto e tempo di contatto',primary:'rsi',protocol:[numberField('dropHeightCm','Altezza di caduta','cm',10,100,1,true)],values:[numberField('jumpHeightCm','Altezza salto','cm',1,100,.1,true),numberField('contactTimeMs','Tempo di contatto','ms',50,1500,1,true)]},
    'repeated-jump':{label:'Repeated Jump',category:'Reattività',description:'Media della prova 10/5 o di altro protocollo definito',primary:'rsi',protocol:[textField('protocolName','Protocollo',60,'es. 10/5',true)],values:[numberField('jumpCount','Salti validi','n',2,100,1,true),numberField('meanJumpHeightCm','Altezza media','cm',1,100,.1,true),numberField('meanContactTimeMs','Contatto medio','ms',50,1500,1,true)]},
    'broad-jump':{label:'Salto in lungo da fermo',category:'Potenza',description:'Distanza orizzontale da fermo',primary:'distanceCm',protocol:[],values:[numberField('distanceCm','Distanza','cm',20,500,.5,true)]},
    imtp:{label:'IMTP',category:'Forza',description:'Isometric Mid-Thigh Pull',primary:'peakForceN',protocol:[textField('device','Dispositivo',80,'es. pedana di forza')],values:[numberField('peakForceN','Picco di forza','N',1,10000,1,true),numberField('bodyMassKg','Peso al test','kg',20,300,.1)]},
    vbt:{label:'Profilo carico–velocità',category:'VBT',description:'Carichi e velocità dello stesso esercizio e della stessa metrica',primary:'vbt',protocol:[textField('exercise','Esercizio',80,'es. Bench Press',true),choiceField('velocityMetric','Metrica',[['mpv','MPV'],['mv','MV'],['pv','PV']],true)],values:[],points:true},
    sprint:{label:'Sprint lineare',category:'Velocità',description:'Tempo su distanza e partenza standardizzate',primary:'timeSec',protocol:[numberField('distanceM','Distanza','m',5,100,1,true),choiceField('startType','Partenza',[['standing','In piedi'],['three-point','Tre appoggi'],['flying','Lanciata']],true)],values:[numberField('timeSec','Tempo','s',.5,30,.001,true)]},
    'cod-505':{label:'505 Change of Direction',category:'Cambio direzione',description:'Tempo totale con lato di rotazione dichiarato',primary:'timeSec',protocol:[choiceField('side','Lato di rotazione',[['left','Sinistro'],['right','Destro']],true)],values:[numberField('timeSec','Tempo','s',.5,20,.001,true)]}
  });

  function numberField(key,label,unit,min,max,step,required=false){return{key,label,type:'number',unit,min,max,step,required};}
  function textField(key,label,maxLength,placeholder='',required=false){return{key,label,type:'text',maxLength,placeholder,required};}
  function choiceField(key,label,options,required=false){return{key,label,type:'choice',options,required};}
  function finite(value){return value!==''&&value!==null&&value!==undefined&&Number.isFinite(Number(value));}
  function dateKey(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const date=new Date(`${value}T00:00:00.000Z`);return!Number.isNaN(date.getTime())&&date.toISOString().slice(0,10)===value;}
  function cleanText(value,max=500){return String(value||'').trim().slice(0,max);}
  function round(value,digits=3){const factor=10**digits;return Math.round((Number(value)+Number.EPSILON)*factor)/factor;}
  function normalizeField(field,value){
    if(field.type==='number'){if(!finite(value))return null;const number=Number(value);if(number<field.min||number>field.max)return null;return round(number,field.step<.01?3:field.step<1?2:0);}
    if(field.type==='choice')return field.options.some(([key])=>key===value)?value:null;
    const text=cleanText(value,field.maxLength);return text||null;
  }
  function normalizePoints(points){return(Array.isArray(points)?points:[]).map(point=>({loadKg:finite(point?.loadKg)?round(point.loadKg,2):null,velocityMs:finite(point?.velocityMs)?round(point.velocityMs,3):null})).filter(point=>point.loadKg>0&&point.loadKg<=1000&&point.velocityMs>0&&point.velocityMs<=5).slice(0,12);}
  function linearRegression(points){
    const values=normalizePoints(points);if(values.length<2)return null;
    const n=values.length,meanX=values.reduce((sum,item)=>sum+item.loadKg,0)/n,meanY=values.reduce((sum,item)=>sum+item.velocityMs,0)/n;
    const numerator=values.reduce((sum,item)=>sum+(item.loadKg-meanX)*(item.velocityMs-meanY),0),denominator=values.reduce((sum,item)=>sum+(item.loadKg-meanX)**2,0);if(!denominator)return null;
    const slope=numerator/denominator,intercept=meanY-slope*meanX,predicted=values.map(item=>intercept+slope*item.loadKg),ssResidual=values.reduce((sum,item,index)=>sum+(item.velocityMs-predicted[index])**2,0),ssTotal=values.reduce((sum,item)=>sum+(item.velocityMs-meanY)**2,0);
    return{slope:round(slope,5),intercept:round(intercept,3),r2:ssTotal?round(1-ssResidual/ssTotal,3):1,points:values};
  }
  function derived(record){
    const values=record?.values||{};
    if(record?.testId==='drop-jump'&&finite(values.jumpHeightCm)&&finite(values.contactTimeMs))return{rsi:round(Number(values.jumpHeightCm)*10/Number(values.contactTimeMs),2)};
    if(record?.testId==='repeated-jump'&&finite(values.meanJumpHeightCm)&&finite(values.meanContactTimeMs))return{rsi:round(Number(values.meanJumpHeightCm)*10/Number(values.meanContactTimeMs),2)};
    if(record?.testId==='imtp'&&finite(values.peakForceN)&&finite(values.bodyMassKg))return{relativeForceNkg:round(Number(values.peakForceN)/Number(values.bodyMassKg),1)};
    if(record?.testId==='vbt')return linearRegression(record.points)||{};
    return{};
  }
  function createRecord(input={},options={}){
    const test=CATALOG[input.testId];if(!test)throw new Error('Seleziona un test valido.');
    if(!dateKey(input.date))throw new Error('Inserisci una data valida.');
    const protocol={},values={};
    test.protocol.forEach(field=>{const value=normalizeField(field,input.protocol?.[field.key]);if(field.required&&value===null)throw new Error(`Completa “${field.label}”.`);if(value!==null)protocol[field.key]=value;});
    test.values.forEach(field=>{const value=normalizeField(field,input.values?.[field.key]);if(field.required&&value===null)throw new Error(`Completa “${field.label}”.`);if(value!==null)values[field.key]=value;});
    const points=test.points?normalizePoints(input.points):undefined;if(test.points&&points.length<2)throw new Error('Inserisci almeno due coppie carico–velocità; tre o più sono consigliate.');
    const now=options.now instanceof Date?options.now:new Date(options.now||Date.now()),existingId=cleanText(input.id,120),id=existingId||`test-${input.testId}-${input.date}-${now.getTime().toString(36)}`;
    return{id,testId:input.testId,date:input.date,source:cleanText(input.source,120)||'Misurazione manuale',protocol,values,...(points?{points}:{}),notes:cleanText(input.notes,1000),createdAt:input.createdAt&&Date.parse(input.createdAt)?input.createdAt:now.toISOString(),updatedAt:now.toISOString()};
  }
  function normalizeRecord(input){try{return createRecord(input,{now:new Date(input?.updatedAt||input?.createdAt||Date.now())});}catch(_){return null;}}
  function normalizeRecords(records){return(Array.isArray(records)?records:[]).map(normalizeRecord).filter(Boolean).slice(0,500);}
  function protocolSignature(record){const protocol=record?.protocol||{};return`${record?.testId||''}|${Object.keys(protocol).sort().map(key=>`${key}:${protocol[key]}`).join('|')}`;}
  function sortedRecords(records){return normalizeRecords(records).sort((a,b)=>b.date.localeCompare(a.date)||b.updatedAt.localeCompare(a.updatedAt));}
  function latestByTest(records){const latest=new Map();sortedRecords(records).forEach(record=>{if(!latest.has(record.testId))latest.set(record.testId,record);});return[...latest.values()].sort((a,b)=>b.date.localeCompare(a.date));}
  function primaryNumeric(record){const test=CATALOG[record?.testId];if(!test)return null;const extra=derived(record);if(test.primary==='rsi')return extra.rsi??null;if(test.primary==='vbt')return extra.slope??null;const value=record?.values?.[test.primary];return finite(value)?Number(value):null;}
  function formatNumber(value,digits=2){return Number(value).toLocaleString('it-IT',{maximumFractionDigits:digits});}
  function primaryResult(record){
    const test=CATALOG[record?.testId];if(!test)return'—';const values=record.values||{},extra=derived(record);
    if(test.primary==='rsi')return extra.rsi?`RSI ${formatNumber(extra.rsi)}`:'RSI —';
    if(test.primary==='vbt')return extra.slope!==undefined?`Pendenza ${formatNumber(extra.slope,5)}`:`${record.points?.length||0} carichi`;
    const field=test.values.find(item=>item.key===test.primary),value=values[test.primary];return finite(value)?`${formatNumber(value,3)}${field?.unit?` ${field.unit}`:''}`:'—';
  }
  function secondaryResult(record){const extra=derived(record);if(record.testId==='imtp'&&extra.relativeForceNkg)return`${formatNumber(extra.relativeForceNkg,1)} N/kg`;if(record.testId==='vbt'&&extra.slope!==undefined)return`R² ${formatNumber(extra.r2,3)} · ${record.points.length} carichi · m/s/kg`;const test=CATALOG[record.testId],secondary=test?.values.find(field=>field.key!==test.primary&&finite(record.values?.[field.key]));return secondary?`${secondary.label} ${formatNumber(record.values[secondary.key],3)} ${secondary.unit}`:'';}
  function trendFor(record,records){const current=primaryNumeric(record);if(current===null)return null;const signature=protocolSignature(record),previous=sortedRecords(records).find(item=>item.id!==record.id&&item.date<=record.date&&protocolSignature(item)===signature&&primaryNumeric(item)!==null);if(!previous)return null;return{delta:round(current-primaryNumeric(previous),3),previous};}

  return{CATALOG,SOURCES,createRecord,normalizeRecord,normalizeRecords,derived,linearRegression,sortedRecords,latestByTest,protocolSignature,primaryNumeric,primaryResult,secondaryResult,trendFor};
});
