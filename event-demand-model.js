(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.rcEventDemandModel=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const VERSION='1.0.0';
  const dimensions=[
    {key:'aerobic',label:'Resistenza aerobica'},
    {key:'threshold',label:'Soglia / ritmo sostenuto'},
    {key:'strength',label:'Forza massima'},
    {key:'power',label:'Potenza'},
    {key:'strengthEndurance',label:'Forza resistente'},
    {key:'skill',label:'Tecnica / abilità'},
    {key:'impact',label:'Impatto muscolo-tendineo'},
    {key:'transitions',label:'Transizioni'},
    {key:'terrain',label:'Terreno'},
    {key:'pacing',label:'Pacing'},
    {key:'fueling',label:'Fueling'}
  ];
  const levelLabels=['Non rilevante','Molto bassa','Bassa','Media','Alta','Molto alta'];
  const sources={
    marathonPractice:{label:'Distance runners · periodizzazione e pratica osservata',url:'https://pubmed.ncbi.nlm.nih.gov/35418513/'},
    enduranceTaper:{label:'Endurance taper · revisione sistematica e meta-analisi',url:'https://pubmed.ncbi.nlm.nih.gov/37163550/'},
    concurrent:{label:'Concurrent training · revisione sistematica e meta-analisi',url:'https://pubmed.ncbi.nlm.nih.gov/34757594/'},
    hyroxFormat:{label:'HYROX · Rulebook Singles 2025/26',url:'https://hyrox.com/wp-content/uploads/2025/06/25_26-Singles-Rulebook_en_R1.pdf'}
  };
  const pack=(key,label,confidence,duration,disciplines,demands,keyRoles,sourceKeys,transitionCost)=>({
    key,label,version:VERSION,confidence,duration,disciplines,demands,keyRoles,
    sources:sourceKeys.map(sourceKey=>sources[sourceKey]),transitionCost
  });
  const packs={
    marathon:pack(
      'marathon','Pack Maratona','supported',
      {classKey:'long',label:'Durata lunga e continua'},
      ['Corsa'],
      {aerobic:5,threshold:3,strength:2,power:1,strengthEndurance:2,skill:2,impact:5,transitions:0,terrain:2,pacing:5,fueling:5},
      ['Corsa facile','Lungo','Qualità running','Forza di supporto','Pacing e fueling'],
      ['marathonPractice','enduranceTaper','concurrent'],
      'high'
    ),
    hyrox:pack(
      'hyrox','Pack HYROX','contextual',
      {classKey:'medium-long',label:'Durata medio-lunga intermittente'},
      ['Corsa','Stazioni functional','Transizioni'],
      {aerobic:4,threshold:4,strength:4,power:3,strengthEndurance:5,skill:4,impact:4,transitions:5,terrain:1,pacing:4,fueling:2},
      ['Corsa specifica','Forza','Forza resistente','Stazioni','Corsa compromessa e transizioni'],
      ['hyroxFormat','concurrent'],
      'high'
    )
  };
  const genericTemplates={
    'half-marathon':{duration:{classKey:'medium-long',label:'Durata medio-lunga continua'},disciplines:['Corsa'],demands:{aerobic:5,threshold:4,strength:1,power:1,strengthEndurance:2,skill:2,impact:4,transitions:0,terrain:2,pacing:5,fueling:3},roles:['Corsa facile','Lungo','Qualità running','Pacing'],transitionCost:'medium'},
    running:{duration:{classKey:'unknown',label:'Durata da confermare'},disciplines:['Corsa'],demands:{aerobic:4,threshold:4,strength:1,power:2,strengthEndurance:2,skill:2,impact:4,transitions:0,terrain:2,pacing:4,fueling:2},roles:['Corsa facile','Qualità specifica','Pacing'],transitionCost:'medium'},
    obstacle:{duration:{classKey:'unknown',label:'Durata e formato da confermare'},disciplines:['Corsa','Ostacoli','Terreno variabile'],demands:{aerobic:4,threshold:3,strength:4,power:3,strengthEndurance:5,skill:5,impact:5,transitions:4,terrain:5,pacing:3,fueling:3},roles:['Corsa trail','Forza di presa','Ostacoli','Tecnica terreno'],transitionCost:'high'},
    cycling:{duration:{classKey:'unknown',label:'Durata da confermare'},disciplines:['Ciclismo'],demands:{aerobic:5,threshold:4,strength:2,power:3,strengthEndurance:3,skill:3,impact:1,transitions:0,terrain:3,pacing:5,fueling:4},roles:['Volume aerobico','Soglia / potenza','Tecnica e pacing'],transitionCost:'medium'},
    'strength-test':{duration:{classKey:'short',label:'Durata breve, alta intensità'},disciplines:['Forza'],demands:{aerobic:1,threshold:1,strength:5,power:4,strengthEndurance:2,skill:4,impact:3,transitions:0,terrain:0,pacing:2,fueling:1},roles:['Forza massima','Tecnica dei fondamentali','Primer'],transitionCost:'medium'},
    test:{duration:{classKey:'unknown',label:'Protocollo da confermare'},disciplines:['Test'],demands:{aerobic:2,threshold:2,strength:2,power:2,strengthEndurance:2,skill:2,impact:2,transitions:1,terrain:1,pacing:2,fueling:1},roles:['Protocollo specifico'],transitionCost:'medium'},
    other:{duration:{classKey:'unknown',label:'Richieste da confermare'},disciplines:['Evento non classificato'],demands:{aerobic:2,threshold:2,strength:2,power:2,strengthEndurance:2,skill:2,impact:2,transitions:2,terrain:2,pacing:2,fueling:2},roles:['Analisi richiesta'],transitionCost:'medium'}
  };

  function clone(value){return JSON.parse(JSON.stringify(value));}
  function clamp(value,min,max){return Math.max(min,Math.min(max,value));}
  function dateAtNoon(value){return new Date(`${value}T12:00:00`);}
  function daysBetween(from,to){return Math.round((dateAtNoon(to)-dateAtNoon(from))/86400000);}
  function normalizedDemands(raw={}){
    return Object.fromEntries(dimensions.map(item=>[item.key,clamp(Math.round(Number(raw[item.key])||0),0,5)]));
  }
  function profileFor(goal={}){
    const specialized=packs[goal.type];
    if(specialized)return{...clone(specialized),goal:{id:goal.id||null,name:goal.name||specialized.label,type:goal.type||'other'},demands:normalizedDemands(specialized.demands)};
    const template=genericTemplates[goal.type]||genericTemplates.other;
    return{
      key:`generic-${goal.type||'other'}`,label:'Profilo generico da confermare',version:VERSION,confidence:'generic',
      duration:clone(template.duration),disciplines:clone(template.disciplines),demands:normalizedDemands(template.demands),
      keyRoles:clone(template.roles),sources:[],transitionCost:template.transitionCost,
      goal:{id:goal.id||null,name:goal.name||'Obiettivo',type:goal.type||'other'}
    };
  }
  function demandList(profile){
    return dimensions.map(item=>({...item,level:profile?.demands?.[item.key]||0,levelLabel:levelLabels[profile?.demands?.[item.key]||0]}));
  }
  function overlapBetween(first,second){
    const a=profileFor(first),b=profileFor(second),values=dimensions.map(item=>[a.demands[item.key],b.demands[item.key]]);
    const dot=values.reduce((sum,[left,right])=>sum+left*right,0),leftNorm=Math.sqrt(values.reduce((sum,[left])=>sum+left*left,0)),rightNorm=Math.sqrt(values.reduce((sum,[,right])=>sum+right*right,0));
    const score=leftNorm&&rightNorm?clamp(dot/(leftNorm*rightNorm),0,1):0;
    const shared=dimensions.filter(item=>a.demands[item.key]>=3&&b.demands[item.key]>=3).sort((x,y)=>Math.min(b.demands[y.key],a.demands[y.key])-Math.min(b.demands[x.key],a.demands[x.key])).map(item=>item.label);
    const divergent=dimensions.filter(item=>Math.abs(a.demands[item.key]-b.demands[item.key])>=3).sort((x,y)=>Math.abs(a.demands[y.key]-b.demands[y.key])-Math.abs(a.demands[x.key]-b.demands[x.key])).map(item=>item.label);
    return{score:+score.toFixed(2),percent:Math.round(score*100),label:score>=.85?'Molto alta':score>=.7?'Alta':score>=.5?'Media':'Bassa',shared:shared.slice(0,4),divergent:divergent.slice(0,3)};
  }
  function relationFor(primary,secondary,today){
    const gapDays=daysBetween(primary.date,secondary.date),distance=Math.abs(gapDays),overlap=overlapBetween(primary,secondary),secondaryProfile=profileFor(secondary);
    let tone='neutral',role='separate',title='Obiettivo separato',summary='Il calendario lascia spazio a un blocco dedicato; il Coach non assume che le due preparazioni siano equivalenti.',actions=[];
    if(gapDays<0){
      role='preparatory';
      if(distance<=7){
        tone='danger';title='Evento troppo vicino alla priorità A';summary='Il costo della gara B/C può interferire con freschezza e sedute chiave della priorità A.';
        actions=['Definire prima il ruolo dell’evento e un limite di intensità','Non recuperare nei giorni successivi il lavoro eventualmente perso'];
      }else if(distance<=28){
        tone='warn';title=overlap.score>=.7?'Gara preparatoria specifica':'Gara preparatoria da contenere';summary=overlap.score>=.7?'Le richieste sono compatibili, ma la gara deve servire la priorità A e non diventare un secondo picco.':'La vicinanza e le richieste differenti aumentano il costo di transizione.';
        actions=['Confermare se sarà test controllato o gara piena','Proteggere il recupero e la seduta chiave successiva'];
      }else{
        tone=overlap.score>=.7?'good':'neutral';title=overlap.score>=.7?'Stimolo preparatorio compatibile':'Obiettivo secondario distinto';summary=overlap.score>=.7?'Una parte importante della preparazione è condivisa; la specificità residua resta subordinata alla priorità A.':'Il tempo disponibile riduce il conflitto, ma il Coach deve separare gli stimoli specifici.';
        actions=['Usare soltanto le qualità che trasferiscono alla priorità A'];
      }
    }else if(gapDays>=0){
      role='post-primary';
      if(gapDays<=13){
        tone='danger';title='Transizione post-gara molto stretta';summary='Non è prudente programmare subito un nuovo picco: esito, sintomi e recupero reale devono precedere la specificità.';
        actions=['Chiudere il risultato della priorità A','Rivalutare prima di reintrodurre carico specifico'];
      }else if(gapDays<=27){
        tone='warn';title='Transizione breve';summary='Il secondo obiettivo richiede una reintroduzione progressiva, non un passaggio automatico dal Race Day a un nuovo blocco intenso.';
        actions=['Prima recupero e continuità facile','Poi reintroduzione delle richieste non condivise'];
      }else if(gapDays<=56){
        tone='good';title='Finestra di conversione';summary='Esiste spazio per recuperare dalla priorità A e convertire gradualmente il lavoro verso le richieste del secondo evento.';
        actions=['Conservare le qualità condivise','Reintrodurre in seguito le richieste specifiche del secondo evento'];
      }
    }
    if(secondaryProfile.confidence==='generic')actions.push('Confermare manualmente le richieste dell’evento prima di una prescrizione specifica');
    return{goal:clone(secondary),profile:secondaryProfile,gapDays,distanceDays:distance,role,tone,title,summary,overlap,actions:[...new Set(actions)]};
  }
  function coordinate(input={}){
    const today=input.today||null,primary=input.primary||null,goals=(Array.isArray(input.goals)?input.goals:[]).filter(item=>item&&item.status==='planned'&&(!today||item.date>=today));
    if(!primary)return null;
    const secondary=goals.filter(item=>item.id!==primary.id).sort((a,b)=>a.date.localeCompare(b.date)).map(item=>relationFor(primary,item,today));
    const urgent=secondary.filter(item=>['danger','warn'].includes(item.tone)).length;
    return{
      version:VERSION,primary:{goal:clone(primary),profile:profileFor(primary),demands:demandList(profileFor(primary))},secondary,
      summary:secondary.length?urgent?`${urgent} coordinament${urgent===1?'o richiede':'i richiedono'} una scelta esplicita prima di modificare il piano.`:'Gli obiettivi presenti possono essere separati senza un conflitto immediato evidente.':'Nessuna gara B/C futura da coordinare con la priorità A.',
      guardrail:'Questa analisi descrive richieste, sovrapposizioni e transizioni. Non genera né modifica sedute.'
    };
  }

  return{VERSION,dimensions,levelLabels,sources,profileFor,demandList,overlapBetween,relationFor,coordinate,daysBetween};
});
