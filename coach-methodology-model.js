(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.rcCoachMethodologyModel=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const VERSION='1.0.0';
  const LABEL='Standard Coach Elite v1';
  const RELEASE_DATE='2026-07-16';

  const evidenceLevels={
    A:{label:'Consensus / position stand',note:'Riferimento principale per i confini e le decisioni generali.'},
    B:{label:'Revisione sistematica / meta-analisi',note:'Supporta la direzione della scelta, non una soglia universale.'},
    C:{label:'Evidenza specifica limitata',note:'Applicazione prudente, dipendente dallo sport e dall’atleta.'},
    D:{label:'Ipotesi individuale',note:'Da verificare sui dati dell’atleta prima di mantenerla.'}
  };

  const sources={
    load:{label:'Bourdon et al. 2017 · consensus sul monitoraggio del carico',url:'https://pubmed.ncbi.nlm.nih.gov/28463642/'},
    endurance:{label:'Rosenblat et al. 2025 · distribuzione dell’intensità',url:'https://pubmed.ncbi.nlm.nih.gov/39888556/'},
    runners:{label:'Casado et al. 2022 · periodizzazione nei runner elite',url:'https://pubmed.ncbi.nlm.nih.gov/35418513/'},
    taper:{label:'Wang et al. 2023 · taper endurance',url:'https://pubmed.ncbi.nlm.nih.gov/37163550/'},
    strength:{label:'ACSM 2026 · resistance training position stand',url:'https://acsm.org/resistance-training-guidelines-update-2026/'},
    concurrent:{label:'Schumann et al. 2022 · concurrent training',url:'https://pubmed.ncbi.nlm.nih.gov/34757594/'},
    plyometric:{label:'Ramirez-Campillo et al. 2025 · plyometric training',url:'https://pubmed.ncbi.nlm.nih.gov/41034241/'},
    sleep:{label:'Walsh et al. 2021 · sleep consensus',url:'https://doi.org/10.1136/bjsports-2020-102025'},
    hrv:{label:'Düking et al. 2021 · HRV-guided endurance training',url:'https://pubmed.ncbi.nlm.nih.gov/34489178/'},
    wearables:{label:'Lee et al. 2024 · consumer sleep wearables',url:'https://pubmed.ncbi.nlm.nih.gov/39484805/'}
  };

  const domains={
    monitoring:{
      key:'monitoring',label:'Monitoraggio integrato',evidence:'A',sourceKeys:['load'],
      principle:'Leggere insieme carico esterno, risposta interna, esecuzione, stato soggettivo, sintomi e vincoli; nessuna singola metrica decide da sola.'
    },
    endurance:{
      key:'endurance',label:'Endurance',evidence:'B',sourceKeys:['endurance','runners','taper'],
      principle:'Specificità, continuità e prevalenza di lavoro facile guidano la periodizzazione; distribuzione dell’intensità e taper dipendono da livello, fase e risposta reale.'
    },
    strength:{
      key:'strength',label:'Forza',evidence:'A',sourceKeys:['strength'],
      principle:'Carico, volume e velocità si scelgono in base all’obiettivo; in una fase endurance si preserva la qualità riducendo prima il costo non necessario.'
    },
    concurrent:{
      key:'concurrent',label:'Concurrent training',evidence:'B',sourceKeys:['concurrent'],
      principle:'Forza massima e ipertrofia sono generalmente compatibili con l’endurance; potenza ed esplosività richiedono più attenzione a ordine, fatica e separazione degli stimoli.'
    },
    hybrid:{
      key:'hybrid',label:'Hybrid / HYROX',evidence:'C',sourceKeys:['concurrent','load'],
      principle:'Integrare corsa, forza resistente e stazioni secondo le richieste gara senza sommare indiscriminatamente fatica; le regole HYROX restano ipotesi specifiche da validare sull’atleta.'
    },
    plyometric:{
      key:'plyometric',label:'Pliometria / potenza',evidence:'B',sourceKeys:['plyometric','concurrent'],
      principle:'La dose segue qualità dei contatti, capacità reattiva e tolleranza all’impatto; la progressione si ferma quando peggiorano qualità o sintomi.'
    },
    recovery:{
      key:'recovery',label:'Recupero e sonno',evidence:'A',sourceKeys:['sleep','hrv','wearables'],
      principle:'Sonno, HRV e recovery supportano la decisione come trend personali; un wearable non è diagnostico e un singolo valore non autorizza da solo una modifica.'
    },
    safety:{
      key:'safety',label:'Sintomi e sicurezza',evidence:'A',sourceKeys:['load'],
      principle:'I sintomi si interpretano per sede, andamento e attività coinvolta; il Coach adatta il carico ma non formula diagnosi e invia alla valutazione umana quando serve.'
    }
  };

  function unique(items){return[...new Set(items)];}
  function clone(value){return JSON.parse(JSON.stringify(value));}
  function windowSummary(window){
    if(!window)return'Dati non calcolati';
    if(window.distanceKnown)return`${window.kmPerWeek} km/sett · ${window.runs} ${window.runs===1?'corsa':'corse'}`;
    if(window.runs)return`${window.runs} ${window.runs===1?'corsa osservata':'corse osservate'} · distanza incompleta`;
    return'Nessuna corsa osservata';
  }
  function hasPlyometricWork(sessions){return(Array.isArray(sessions)?sessions:[]).some(item=>/plyo|pliometr|balz|jump|salti/i.test(`${item?.title||''} ${item?.details?.strengthFocus||''} ${item?.notes||''}`));}
  function hasStrengthWork(sessions,plan){return Boolean(plan?.strength)||(Array.isArray(sessions)?sessions:[]).some(item=>item?.category==='strength');}
  function hasHybridWork(sessions,plan,goal){return goal?.type==='hyrox'||Boolean(plan?.hyrox)||(Array.isArray(sessions)?sessions:[]).some(item=>['hyrox','metcon'].includes(item?.category));}
  function hasEnduranceWork(sessions,plan,goal,observed){return['marathon','half-marathon','running','cycling','obstacle'].includes(goal?.type)||Boolean(plan?.runs)||Boolean(observed?.runs)||(Array.isArray(sessions)?sessions:[]).some(item=>['running','cycling'].includes(item?.category));}
  function activeDomainKeys(input={}){
    const endurance=hasEnduranceWork(input.sessions,input.plan,input.goal,input.observed),strength=hasStrengthWork(input.sessions,input.plan),hybrid=hasHybridWork(input.sessions,input.plan,input.goal),plyometric=hasPlyometricWork(input.sessions),keys=['monitoring'];
    if(endurance)keys.push('endurance');
    if(strength)keys.push('strength');
    if(endurance&&strength)keys.push('concurrent');
    if(hybrid)keys.push('hybrid');
    if(plyometric)keys.push('plyometric');
    keys.push('recovery','safety');
    return unique(keys);
  }
  function confidence(input={}){
    const auditLevel=input.confidence?.level||'low',active=activeDomainKeys(input),limited=active.some(key=>domains[key].evidence==='C'||domains[key].evidence==='D');
    if(auditLevel==='high'&&!limited)return{level:'high',label:'Alta',note:'Buona copertura dei dati; restano necessari controllo e conferma dell’atleta.'};
    if(auditLevel==='low')return{level:'low',label:'Bassa',note:'I principi sono solidi, ma i dati individuali non bastano per una decisione forte.'};
    return{level:'medium',label:'Contestuale',note:limited?'Una parte della decisione è specifica hybrid e va validata sull’atleta.':'La direzione è supportata, ma richiede conferma sui trend individuali.'};
  }
  function timeWindows(input={}){
    const readinessUsable=Boolean(input.readiness&&(input.readiness.recovery?.usable||input.readiness.sleep?.usable||input.readiness.confidence));
    return[
      {key:'session',label:'Oggi / sessione',purpose:'Prontezza e contesto immediato',state:readinessUsable?'used':'missing',summary:readinessUsable?'Segnali recenti disponibili':'Nessun segnale recente utilizzabile'},
      {key:'acute',label:'7 giorni',purpose:'Corsa osservata recente',state:input.windows?.acute?.runs?'used':'sparse',summary:windowSummary(input.windows?.acute)},
      {key:'mesocycle',label:'28 giorni',purpose:'Baseline running operativa',state:input.windows?.mesocycle?.runs?'used':'sparse',summary:windowSummary(input.windows?.mesocycle||input.observed)},
      {key:'chronic',label:'84 giorni',purpose:'Tendenza running di fondo',state:input.windows?.chronic?.runs?'used':'sparse',summary:windowSummary(input.windows?.chronic)},
      {key:'goal',label:'Orizzonte obiettivo',purpose:'Fase e specificità gara',state:input.goal?.date?'used':'missing',summary:input.phase?`${input.phase.label} · ${input.phase.days} giorni`:'Obiettivo non datato'}
    ];
  }
  function contextForAudit(input={}){
    const keys=activeDomainKeys(input),activeDomains=keys.map(key=>domains[key]),sourceKeys=unique(activeDomains.flatMap(item=>item.sourceKeys));
    return{
      standard:{version:VERSION,label:LABEL,releasedAt:RELEASE_DATE},
      activeDomains:clone(activeDomains),
      coverage:Object.values(domains).map(item=>({key:item.key,label:item.label})),
      windows:timeWindows(input),
      confidence:confidence(input),
      sources:clone(sourceKeys.map(key=>sources[key])),
      guardrails:[
        'Nessun aumento o taglio importante viene autorizzato da una singola metrica.',
        'I dati mancanti riducono l’affidabilità: non vengono sostituiti con valori plausibili.',
        'Ogni modifica al piano deve restare spiegata, reversibile e confermata.',
        'Il Coach monitora i sintomi ma non formula diagnosi.'
      ]
    };
  }
  function manifest(){return clone({version:VERSION,label:LABEL,releasedAt:RELEASE_DATE,evidenceLevels,domains,sources});}

  return{VERSION,LABEL,manifest,contextForAudit,activeDomainKeys,timeWindows};
});
