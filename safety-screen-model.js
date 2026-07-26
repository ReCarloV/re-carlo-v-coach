(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.rcSafetyScreenModel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const SIGNALS = Object.freeze([
    { id:'chest-discomfort', label:'Dolore, pressione, costrizione o peso al torace' },
    { id:'syncope', label:'Svenimento, quasi svenimento, capogiro marcato o confusione' },
    { id:'unusual-dyspnea', label:'Fiato corto nuovo, estremo o sproporzionato allo sforzo' },
    { id:'symptomatic-palpitations', label:'Battito molto rapido o irregolare associato a dolore toracico, fiato corto o capogiro' }
  ]);
  const SIGNAL_IDS = new Set(SIGNALS.map(item => item.id));

  function normalize(value) {
    if (!value || typeof value !== 'object') return {status:'unknown',symptoms:[]};
    const symptoms = Array.isArray(value.symptoms) ? [...new Set(value.symptoms.filter(item => SIGNAL_IDS.has(item)))] : [];
    const status = value.status === 'clear' ? 'clear' : value.status === 'red-flag' && symptoms.length ? 'red-flag' : 'unknown';
    return {status,symptoms};
  }
  function isRedFlag(value) { return normalize(value).status === 'red-flag'; }
  function labels(value) {
    const screen=normalize(value),selected=new Set(screen.symptoms);
    return SIGNALS.filter(item=>selected.has(item.id)).map(item=>item.label);
  }
  function assessment(value) {
    const screen=normalize(value);
    if(screen.status==='red-flag')return{
      status:'red-flag',stopTraining:true,title:'Allenamento sospeso',symptoms:labels(screen),
      text:'Non iniziare o interrompi la seduta. Il Coach non interpreta la causa: richiedi una valutazione sanitaria prima di riprendere l’allenamento ordinario. Se il sintomo è presente ora, intenso, improvviso o in peggioramento, chiama il 112.'
    };
    if(screen.status==='clear')return{status:'clear',stopTraining:false,title:'Nessun segnale cardiopolmonare riferito',symptoms:[],text:''};
    return{status:'unknown',stopTraining:false,title:'Controllo sicurezza non compilato',symptoms:[],text:''};
  }
  function iso(date){return`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
  function addDays(value,days){const date=new Date(`${value}T12:00:00`);date.setDate(date.getDate()+days);return iso(date);}
  function timestampDate(value){const date=new Date(value);return Number.isNaN(date.getTime())?null:iso(date);}
  function summarizeRecent(input={}){
    const today=input.today||iso(new Date()),start=addDays(today,-6),events=[];
    (Array.isArray(input.preCheckins)?input.preCheckins:[]).forEach(item=>{
      const date=item.sessionDate||timestampDate(item.updatedAt||item.createdAt);if(date&&date>=start&&date<=today&&isRedFlag(item.cardiopulmonaryScreen))events.push({source:'pre',sessionId:item.sessionId||null,date,at:item.updatedAt||item.createdAt||`${date}T00:00:00`,screen:normalize(item.cardiopulmonaryScreen)});
    });
    (Array.isArray(input.sessions)?input.sessions:[]).forEach(item=>{
      if(item.date>=start&&item.date<=today&&isRedFlag(item.outcome?.cardiopulmonaryScreen))events.push({source:'post',sessionId:item.id||null,date:item.date,at:item.outcome.updatedAt||item.outcome.recordedAt||`${item.date}T23:59:59`,screen:normalize(item.outcome.cardiopulmonaryScreen)});
    });
    events.sort((a,b)=>new Date(b.at)-new Date(a.at));const seen=new Set(),distinct=[];
    events.forEach(item=>{const key=item.sessionId?`session:${item.sessionId}`:`day:${item.date}`;if(seen.has(key))return;seen.add(key);distinct.push(item);});
    const symptomIds=[...new Set(distinct.flatMap(item=>item.screen.symptoms))];const summary={status:symptomIds.length?'red-flag':'clear',symptoms:symptomIds};
    return{active:distinct.length>0,count:distinct.length,events:distinct,latest:distinct[0]||null,symptoms:labels(summary),windowStart:start,windowEnd:today};
  }

  return {SIGNALS,normalize,isRedFlag,labels,assessment,summarizeRecent};
});
