(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.rcSkipReasonModel=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const definitions={
    time:{label:'Impegni, lavoro o università',group:'organization',impact:'Il coach riorganizza la settimana; non lo interpreta come fatica fisica.'},
    logistics:{label:'Viaggio o problema logistico',group:'organization',impact:'Il coach considera la fattibilità delle prossime sedute; il carico fisiologico non viene ridotto automaticamente.'},
    fatigue:{label:'Fatica o recupero insufficiente',group:'recovery',impact:'Il coach confronta questo segnale con check-in e sedute recenti prima di ridurre il carico.'},
    pain:{label:'Fastidio o dolore',group:'symptom',impact:'Il coach protegge i distretti coinvolti e richiede una valutazione aggiornata, senza formulare diagnosi.'},
    motivation:{label:'Motivazione bassa o seduta poco sostenibile',group:'planning',impact:'Il coach usa il dato per rivedere sostenibilità e struttura, non come prova di fatica fisica.'},
    'program-change':{label:'Cambio di programma o priorità',group:'planning',impact:'La seduta viene trattata come superata dal nuovo programma e non penalizza l’aderenza.'},
    other:{label:'Altro',group:'unknown',impact:'Aggiungi una nota: il coach conserva il dato senza dedurre automaticamente la causa.'}
  };
  function get(value){return definitions[value]||definitions.other;}
  function label(value){return get(value).label;}
  function group(value){return get(value).group;}
  function impact(value){return get(value).impact;}
  function isOrganizational(value){return group(value)==='organization';}
  function isPhysiological(value){return ['recovery','symptom'].includes(group(value));}

  return {definitions,get,label,group,impact,isOrganizational,isPhysiological};
});
