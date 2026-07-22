(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.rcEventDemandModel=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const VERSION='2.3.0';
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
    distanceRunning:{label:'Distance runners · periodizzazione e pratica osservata',url:'https://pubmed.ncbi.nlm.nih.gov/35418513/'},
    enduranceTaper:{label:'Endurance taper · revisione sistematica e meta-analisi',url:'https://pubmed.ncbi.nlm.nih.gov/37163550/'},
    concurrent:{label:'Concurrent training · revisione sistematica e meta-analisi',url:'https://pubmed.ncbi.nlm.nih.gov/34757594/'},
    hyroxSingles:{label:'HYROX · Singles Rulebook 2025/26',url:'https://hyrox.com/wp-content/uploads/2025/06/25_26-Singles-Rulebook_en_R1.pdf'},
    hyroxDoubles:{label:'HYROX · Doubles Rulebook 2026/27',url:'https://hyrox.com/wp-content/uploads/2025/07/25_26_HYROX_RulebookDoubles_EN.pdf'},
    hyroxRelay:{label:'HYROX · Relay Rulebook 2026/27',url:'https://hyrox.com/wp-content/uploads/2025/07/25_26_HYROX_RulebookRelay_EN.pdf'},
    hyroxAdaptive:{label:'HYROX · Rulebook Adaptive corrente',url:'https://hyrox.com/rulebook/'},
    spartanFormat:{label:'Spartan · formati ufficiali delle gare',url:'https://www.spartan.com/en/race/spartan-races'},
    spartanObstacles:{label:'Spartan · ostacoli e richieste ufficiali',url:'https://www.spartan.com/en/race/spartan-race-obstacles'},
    ocrPhysiology:{label:'Obstacle course racing · risposte fisiologiche Sprint e Super',url:'https://doi.org/10.3390/app14209604'},
    ocrDeterminants:{label:'Obstacle course · determinanti fisiologici della prestazione',url:'https://pubmed.ncbi.nlm.nih.gov/10628164/'},
    ocrExtreme:{label:'Obstacle course racing estremo · studio fisiologico esplorativo',url:'https://pmc.ncbi.nlm.nih.gov/articles/PMC6720877/'},
    ocrInjuries:{label:'Obstacle course racing · analisi longitudinale degli infortuni',url:'https://pubmed.ncbi.nlm.nih.gov/29977946/'},
    worldTriathlon:{label:'World Triathlon · Competition Rules 2026',url:'https://triathlon.org/agegroup'},
    ironmanFormat:{label:'IRONMAN · distanze 70.3 e full',url:'https://www.ironman.com/proseries/about-ironman'},
    athxFormat:{label:'ATHX Games · struttura ufficiale',url:'https://athxgames.com/'},
    athxWorkouts2026:{label:'ATHX Games · workout ufficiali 2026',url:'https://athxgames.com/workouts/2026'},
    athxStandards2026:{label:'ATHX Games · movement standards 2026',url:'https://athxgames.com/movement-standards/2026'},
    hiftDeterminants:{label:'Functional fitness · determinanti di forza e capacità aerobica',url:'https://pubmed.ncbi.nlm.nih.gov/32456306/'},
    hiftResponses:{label:'High-intensity functional training · risposta fisiologica acuta',url:'https://pubmed.ncbi.nlm.nih.gov/39649788/'}
  };

  function clone(value){return JSON.parse(JSON.stringify(value));}
  function clamp(value,min,max){return Math.max(min,Math.min(max,value));}
  function unique(items){return[...new Set(items.filter(Boolean))];}
  function sourceList(keys=[]){return unique(keys).map(key=>sources[key]).filter(Boolean);}
  function normalizedDemands(raw={}){
    return Object.fromEntries(dimensions.map(item=>[item.key,clamp(Math.round(Number(raw[item.key])||0),0,5)]));
  }
  function family(key,label,confidence,duration,disciplines,demands,keyRoles,sourceKeys,transitionCost,extra={}){
    return{
      key,label,version:VERSION,confidence,duration,disciplines,demands,keyRoles,
      sourceKeys,transitionCost,programmingStatus:'pending',...extra
    };
  }
  const families={
    running:family(
      'running','Running su strada','generic',
      {classKey:'unknown',label:'Distanza da specificare'},
      ['Corsa'],
      {aerobic:4,threshold:4,strength:1,power:2,strengthEndurance:2,skill:2,impact:4,transitions:0,terrain:2,pacing:4,fueling:2},
      ['Corsa facile','Qualità specifica','Pacing'],
      ['distanceRunning','enduranceTaper','concurrent'],
      'medium'
    ),
    hyrox:family(
      'hyrox','HYROX · formato da specificare','contextual',
      {classKey:'medium-long',label:'Durata medio-lunga intermittente'},
      ['Corsa','Stazioni functional','Transizioni'],
      {aerobic:4,threshold:4,strength:4,power:3,strengthEndurance:5,skill:4,impact:4,transitions:5,terrain:1,pacing:4,fueling:2},
      ['Corsa specifica','Forza','Forza resistente','Stazioni','Corsa compromessa e transizioni'],
      ['hyroxSingles','hyroxDoubles','hyroxRelay','hyroxAdaptive','concurrent'],
      'high',
      {
        formatSummary:'8 × 1 km di corsa alternati alle 8 stazioni ufficiali.',
        formatDetails:['8 km di corsa totali','8 stazioni nello stesso ordine ufficiale','Carichi e modalità di condivisione dipendono dalla divisione']
      }
    ),
    obstacle:family(
      'obstacle','Spartan / obstacle race','format-verified',
      {classKey:'unknown',label:'Distanza e ostacoli dipendono dal formato'},
      ['Corsa off-road','Ostacoli','Terreno variabile'],
      {aerobic:4,threshold:3,strength:4,power:3,strengthEndurance:5,skill:5,impact:5,transitions:4,terrain:5,pacing:3,fueling:3},
      ['Corsa trail','Forza di presa','Carry e ostacoli','Tecnica terreno'],
      ['spartanFormat','spartanObstacles','ocrPhysiology','ocrDeterminants','ocrExtreme','ocrInjuries','concurrent'],
      'high'
    ),
    triathlon:family(
      'triathlon','Triathlon · formato da specificare','format-verified',
      {classKey:'unknown',label:'Distanza da specificare'},
      ['Nuoto','Ciclismo','Corsa','Transizioni'],
      {aerobic:5,threshold:4,strength:2,power:2,strengthEndurance:3,skill:5,impact:3,transitions:5,terrain:2,pacing:5,fueling:4},
      ['Nuoto specifico','Ciclismo specifico','Corsa','Brick e transizioni','Pacing e fueling'],
      ['worldTriathlon','ironmanFormat','concurrent'],
      'high'
    ),
    athx:family(
      'athx','ATHX · formato da specificare','format-verified',
      {classKey:'medium-long',label:'Competizione continua di circa 2,5 ore'},
      ['Forza','Endurance','MetCon','Recupero tra zone'],
      {aerobic:4,threshold:4,strength:4,power:4,strengthEndurance:5,skill:4,impact:4,transitions:5,terrain:1,pacing:4,fueling:3},
      ['Forza','Endurance','MetCon X','Pacing tra zone','Refuel e recovery'],
      ['athxFormat','athxWorkouts2026','athxStandards2026','hiftDeterminants','hiftResponses','concurrent'],
      'high',
      {
        formatSummary:'Sei zone consecutive in una finestra continua di circa 2,5 ore.',
        formatDetails:['Warm-Up','Strength','Refuel','Endurance','Recovery','MetCon X']
      }
    )
  };

  const runningVariants=[
    {
      key:'road-5k',family:'running',label:'5 km su strada',confidence:'supported',programmingStatus:'active',
      distanceKm:5,sessionDurationMin:25,duration:{classKey:'short',label:'Durata breve ad alta intensità aerobica'},
      demands:{aerobic:4,threshold:5,strength:1,power:4,strengthEndurance:2,skill:3,impact:4,transitions:0,terrain:1,pacing:4,fueling:1},
      keyRoles:['Corsa facile','VO₂ / ritmo 5 km','Soglia','Economia e velocità'],
      formatSummary:'5,000 km continui; il profilo del percorso resta specifico dell’evento.'
    },
    {
      key:'road-10k',family:'running',label:'10 km su strada',confidence:'supported',programmingStatus:'active',
      distanceKm:10,sessionDurationMin:45,duration:{classKey:'medium',label:'Durata media ad alta intensità aerobica'},
      demands:{aerobic:5,threshold:5,strength:1,power:3,strengthEndurance:2,skill:3,impact:4,transitions:0,terrain:1,pacing:5,fueling:1},
      keyRoles:['Corsa facile','Soglia','Ritmo 10 km','Economia e velocità'],
      formatSummary:'10,000 km continui; il profilo del percorso resta specifico dell’evento.'
    },
    {
      key:'road-half',family:'running',label:'Mezza maratona',confidence:'supported',programmingStatus:'active',
      distanceKm:21.0975,sessionDurationMin:110,duration:{classKey:'medium-long',label:'Durata medio-lunga continua'},
      demands:{aerobic:5,threshold:4,strength:1,power:1,strengthEndurance:2,skill:2,impact:4,transitions:0,terrain:2,pacing:5,fueling:3},
      keyRoles:['Corsa facile','Lungo','Soglia / ritmo mezza','Pacing e fueling'],
      formatSummary:'21,0975 km continui.'
    },
    {
      key:'road-30k',family:'running',label:'30 km su strada',confidence:'supported',programmingStatus:'active',
      distanceKm:30,sessionDurationMin:165,duration:{classKey:'long',label:'Durata lunga e continua'},
      demands:{aerobic:5,threshold:3,strength:2,power:1,strengthEndurance:2,skill:2,impact:5,transitions:0,terrain:2,pacing:5,fueling:5},
      keyRoles:['Corsa facile','Lungo','Ritmo maratona','Pacing e fueling'],
      formatSummary:'30 km continui; può diventare un lungo specifico soltanto se ruolo e intensità sono espliciti.'
    },
    {
      key:'road-marathon',family:'running',label:'Maratona',confidence:'supported',programmingStatus:'active',
      distanceKm:42.195,sessionDurationMin:240,duration:{classKey:'long',label:'Durata lunga e continua'},
      demands:{aerobic:5,threshold:3,strength:2,power:1,strengthEndurance:2,skill:2,impact:5,transitions:0,terrain:2,pacing:5,fueling:5},
      keyRoles:['Corsa facile','Lungo','Qualità running','Forza di supporto','Pacing e fueling'],
      formatSummary:'42,195 km continui.'
    }
  ];

  const hyroxLoads={
    womenOpen:{sledPushKg:102,sledPullKg:78,farmerKg:16,lungeKg:10,wallBallKg:4},
    sharedOpen:{sledPushKg:152,sledPullKg:103,farmerKg:24,lungeKg:20,wallBallKg:6},
    menPro:{sledPushKg:202,sledPullKg:153,farmerKg:32,lungeKg:30,wallBallKg:9}
  };
  function hyroxStations(loadKey){
    const load=hyroxLoads[loadKey];
    if(!load)return[];
    return[
      {name:'SkiErg',work:'1.000 m'},
      {name:'Sled Push',work:'4 × 12,5 m',load:`${load.sledPushKg} kg incluso sled`},
      {name:'Sled Pull',work:'4 × 12,5 m',load:`${load.sledPullKg} kg incluso sled`},
      {name:'Burpee Broad Jumps',work:'80 m'},
      {name:'Row',work:'1.000 m'},
      {name:'Farmers Carry',work:'200 m',load:`2 × ${load.farmerKg} kg`},
      {name:'Sandbag Lunges',work:'100 m',load:`${load.lungeKg} kg`},
      {name:'Wall Balls',work:'100 ripetizioni',load:`${load.wallBallKg} kg`}
    ];
  }
  function hyroxVariant(key,label,mode,loadKey){
    const doubles=mode==='doubles';
    return{
      key,family:'hyrox',label,confidence:'contextual',programmingStatus:'contextual',
      sessionDurationMin:90,loadKey,stations:hyroxStations(loadKey),
      duration:{classKey:'medium-long',label:'8 km di corsa e 8 stazioni alternate'},
      demands:families.hyrox.demands,
      formatSummary:doubles
        ?'Entrambi gli atleti corrono tutti gli 8 × 1 km; le stazioni si dividono in modalità “You Go, I Go”.'
        :'L’atleta completa tutti gli 8 × 1 km e tutte le 8 stazioni.',
      formatDetails:doubles
        ?['8 × 1 km corsi insieme','Tutto il lavoro di stazione completato dalla coppia','Cambio libero tra compagni in modalità You Go, I Go']
        :['8 × 1 km individuali','Tutte le stazioni completate individualmente'],
      sourceKeys:[doubles?'hyroxDoubles':'hyroxSingles','concurrent']
    };
  }
  const hyroxVariants=[
    hyroxVariant('hyrox-single-women-open','Individual Women Open','single','womenOpen'),
    hyroxVariant('hyrox-single-women-pro','Individual Women Pro','single','sharedOpen'),
    hyroxVariant('hyrox-single-men-open','Individual Men Open','single','sharedOpen'),
    hyroxVariant('hyrox-single-men-pro','Individual Men Pro','single','menPro'),
    hyroxVariant('hyrox-doubles-women-open','Doubles Women Open','doubles','womenOpen'),
    hyroxVariant('hyrox-doubles-women-pro','Doubles Women Pro','doubles','sharedOpen'),
    hyroxVariant('hyrox-doubles-men-open','Doubles Men Open','doubles','sharedOpen'),
    hyroxVariant('hyrox-doubles-men-pro','Doubles Men Pro','doubles','menPro'),
    hyroxVariant('hyrox-doubles-mixed','Doubles Mixed','doubles','sharedOpen'),
    {
      key:'hyrox-relay-women',family:'hyrox',label:'Relay Women',confidence:'contextual',programmingStatus:'contextual',sessionDurationMin:90,
      stations:hyroxStations('womenOpen'),demands:families.hyrox.demands,sourceKeys:['hyroxRelay','concurrent'],
      duration:{classKey:'medium-long',label:'8 km e 8 stazioni divisi tra 4 atlete'},
      formatSummary:'Team di 4 atlete; ciascuna completa 2 × 1 km e le 2 stazioni corrispondenti.',
      formatDetails:['4 atlete','2 × 1 km e 2 stazioni per atleta','Ordine delle due coppie run/station scelto dal team']
    },
    {
      key:'hyrox-relay-men',family:'hyrox',label:'Relay Men',confidence:'contextual',programmingStatus:'contextual',sessionDurationMin:90,
      stations:hyroxStations('sharedOpen'),demands:families.hyrox.demands,sourceKeys:['hyroxRelay','concurrent'],
      duration:{classKey:'medium-long',label:'8 km e 8 stazioni divisi tra 4 atleti'},
      formatSummary:'Team di 4 atleti; ciascuno completa 2 × 1 km e le 2 stazioni corrispondenti.',
      formatDetails:['4 atleti','2 × 1 km e 2 stazioni per atleta','Ordine delle due coppie run/station scelto dal team']
    },
    {
      key:'hyrox-relay-mixed',family:'hyrox',label:'Relay Mixed',confidence:'contextual',programmingStatus:'contextual',sessionDurationMin:90,
      stations:hyroxStations('sharedOpen'),demands:families.hyrox.demands,sourceKeys:['hyroxRelay','concurrent'],
      duration:{classKey:'medium-long',label:'8 km e 8 stazioni divisi tra 4 atleti'},
      formatSummary:'Team di 2 donne e 2 uomini; ciascun componente completa 2 × 1 km e le 2 stazioni corrispondenti.',
      formatDetails:['2 donne e 2 uomini','2 × 1 km e 2 stazioni per atleta','Ordine delle due coppie run/station scelto dal team']
    },
    {
      key:'hyrox-adaptive-women',family:'hyrox',label:'Adaptive Women',confidence:'format-verified',programmingStatus:'pending',sessionDurationMin:100,
      demands:families.hyrox.demands,sourceKeys:['hyroxAdaptive','concurrent'],
      duration:{classKey:'medium-long',label:'8 × 1 km e 8 stazioni adattive'},
      formatSummary:'Divisione individuale Adaptive Women; classificazione, modifiche e carichi devono seguire il rulebook corrente dell’evento.',
      formatDetails:['8 × 1 km','8 stazioni adattive','Standard e classificazione da verificare sul rulebook corrente']
    },
    {
      key:'hyrox-adaptive-men',family:'hyrox',label:'Adaptive Men',confidence:'format-verified',programmingStatus:'pending',sessionDurationMin:100,
      demands:families.hyrox.demands,sourceKeys:['hyroxAdaptive','concurrent'],
      duration:{classKey:'medium-long',label:'8 × 1 km e 8 stazioni adattive'},
      formatSummary:'Divisione individuale Adaptive Men; classificazione, modifiche e carichi devono seguire il rulebook corrente dell’evento.',
      formatDetails:['8 × 1 km','8 stazioni adattive','Standard e classificazione da verificare sul rulebook corrente']
    }
  ];
  function spartanVariant(key,label,distanceKm,obstacleCount,sessionDurationMin,formatSummary,demands={},terrain='off-road'){
    return{
      key,family:'obstacle',label,confidence:'contextual',programmingStatus:'contextual',distanceKm,obstacleCount,sessionDurationMin,terrain,
      formatSummary,
      formatDetails:[`${distanceKm} km`,`${obstacleCount} ostacoli`,terrain==='stadium'?'Percorso in ambiente stadium':'Percorso off-road e profilo altimetrico specifico della sede'],
      keyRoles:['Corsa su terreno specifico','Forza relativa','Grip e sospensioni','Carry','Tecnica ostacoli e transizioni'],
      sourceKeys:['spartanFormat','spartanObstacles','ocrPhysiology','ocrDeterminants','ocrExtreme','ocrInjuries','concurrent'],
      demands:{...families.obstacle.demands,...demands}
    };
  }
  const spartanVariants=[
    spartanVariant('spartan-stadion','Spartan Stadion',5,20,60,'5 km e 20 ostacoli in ambiente stadium.',{terrain:2,fueling:1},'stadium'),
    spartanVariant('spartan-sprint','Spartan Sprint',5,20,75,'5 km e 20 ostacoli off-road.',{threshold:4,pacing:4,fueling:1}),
    spartanVariant('spartan-super','Spartan Super',10,25,120,'10 km e 25 ostacoli off-road.',{aerobic:4,threshold:4,pacing:4,fueling:3}),
    spartanVariant('spartan-beast','Spartan Beast',21,30,240,'21 km e 30 ostacoli off-road.',{aerobic:5,threshold:3,pacing:4,fueling:4}),
    spartanVariant('spartan-ultra','Spartan Ultra',50,60,480,'50 km e 60 ostacoli off-road.',{aerobic:5,threshold:2,pacing:5,fueling:5})
  ];
  const triathlonVariants=[
    {
      key:'triathlon-sprint',family:'triathlon',label:'Triathlon Sprint',confidence:'format-verified',programmingStatus:'pending',sessionDurationMin:90,
      formatSummary:'750 m nuoto + circa 20 km bici + 5 km corsa.',formatDetails:['Nuoto 0,75 km','Bici circa 20 km','Corsa 5 km','T1 e T2'],
      demands:{...families.triathlon.demands,threshold:5,fueling:2}
    },
    {
      key:'triathlon-standard',family:'triathlon',label:'Triathlon Standard / Olimpico',confidence:'format-verified',programmingStatus:'pending',sessionDurationMin:150,
      formatSummary:'1,5 km nuoto + 40 km bici + 10 km corsa.',formatDetails:['Nuoto 1,5 km','Bici 40 km','Corsa 10 km','T1 e T2'],
      demands:{...families.triathlon.demands,fueling:3}
    },
    {
      key:'ironman-70-3',family:'triathlon',label:'IRONMAN 70.3',confidence:'format-verified',programmingStatus:'pending',sessionDurationMin:360,
      formatSummary:'1,9 km nuoto + 90 km bici + 21,1 km corsa.',formatDetails:['Nuoto 1,9 km','Bici 90 km','Corsa 21,1 km','Totale 113 km / 70.3 mi'],
      demands:{...families.triathlon.demands,aerobic:5,threshold:3,impact:4,pacing:5,fueling:5}
    },
    {
      key:'ironman-full',family:'triathlon',label:'IRONMAN Full',confidence:'format-verified',programmingStatus:'pending',sessionDurationMin:720,
      formatSummary:'3,8 km nuoto + 180 km bici + 42,2 km corsa.',formatDetails:['Nuoto 3,8 km','Bici 180 km','Corsa 42,2 km','Totale 226 km / 140.6 mi'],
      demands:{...families.triathlon.demands,aerobic:5,threshold:2,impact:5,pacing:5,fueling:5}
    }
  ];
  const athxStrength2026=['1RM Strict Press','3RM Back Squat','5RM Deadlift'];
  function athxVariant(key,label,division,teamMode='Individual'){
    const pairs=teamMode==='Pairs',lite=division==='Lite',pro=division==='Pro';
    const runSegmentM=lite?500:pro?1000:750;
    const formatDetails=[
      ...families.athx.formatDetails,
      `Strength 2026 · ${athxStrength2026.join(' + ')}`,
      `Endurance 2026 · cambi run/row ogni ${runSegmentM} m · time cap 22 min`,
      pairs?'Pairs · lavoro condiviso secondo gli standard della singola zona':'Individual · volume individuale previsto dalla divisione',
      pro?'Pro · carichi, altezze e modalità MetCon più impegnativi':lite?'Lite · volumi, carichi e movimenti scalati':'ATHX · carichi e standard della divisione regular'
    ];
    return{
      key,family:'athx',label:`${label} · ${teamMode}`,confidence:'contextual',programmingStatus:'contextual',sessionDurationMin:150,
      division,teamMode,runSegmentM,strengthProtocol:athxStrength2026,
      formatSummary:`${teamMode}; circa 2,5 ore in sei zone consecutive. Nel 2026: Strength, Endurance run/row e MetCon X con standard ${division}.`,
      formatDetails,
      keyRoles:['Forza massimale sui lift di gara','Endurance run/row','MetCon X','Gestione dei recuperi tra zone',pairs?'Strategia e cambi Pairs':'Pacing individuale'],
      sourceKeys:['athxFormat','athxWorkouts2026','athxStandards2026','hiftDeterminants','hiftResponses','concurrent'],
      demands:{...families.athx.demands,strength:pro?5:lite?3:4,power:pro?5:lite?3:4,strengthEndurance:pro?5:lite?4:5,skill:pro?5:lite?3:4,impact:pro?5:lite?3:4}
    };
  }
  const athxVariants=[
    athxVariant('athx-lite-individual','ATHX Lite','Lite'),
    athxVariant('athx-individual','ATHX','Standard'),
    athxVariant('athx-pro-individual','ATHX Pro','Pro'),
    athxVariant('athx-lite-pairs','ATHX Lite','Lite','Pairs'),
    athxVariant('athx-pairs','ATHX','Standard','Pairs'),
    athxVariant('athx-pro-pairs','ATHX Pro','Pro','Pairs')
  ];
  const variants=[...runningVariants,...hyroxVariants,...spartanVariants,...triathlonVariants,...athxVariants];
  const variantIndex=new Map(variants.map(item=>[item.key,item]));
  const typeFamilies={
    marathon:'running','half-marathon':'running',running:'running',hyrox:'hyrox',
    obstacle:'obstacle',triathlon:'triathlon',athx:'athx'
  };
  const genericTemplates={
    cycling:{duration:{classKey:'unknown',label:'Durata da confermare'},disciplines:['Ciclismo'],demands:{aerobic:5,threshold:4,strength:2,power:3,strengthEndurance:3,skill:3,impact:1,transitions:0,terrain:3,pacing:5,fueling:4},roles:['Volume aerobico','Soglia / potenza','Tecnica e pacing'],transitionCost:'medium'},
    'strength-test':{duration:{classKey:'short',label:'Durata breve, alta intensità'},disciplines:['Forza'],demands:{aerobic:1,threshold:1,strength:5,power:4,strengthEndurance:2,skill:4,impact:3,transitions:0,terrain:0,pacing:2,fueling:1},roles:['Forza massima','Tecnica dei fondamentali','Primer'],transitionCost:'medium'},
    test:{duration:{classKey:'unknown',label:'Protocollo da confermare'},disciplines:['Test'],demands:{aerobic:2,threshold:2,strength:2,power:2,strengthEndurance:2,skill:2,impact:2,transitions:1,terrain:1,pacing:2,fueling:1},roles:['Protocollo specifico'],transitionCost:'medium'},
    other:{duration:{classKey:'unknown',label:'Richieste da confermare'},disciplines:['Evento non classificato'],demands:{aerobic:2,threshold:2,strength:2,power:2,strengthEndurance:2,skill:2,impact:2,transitions:2,terrain:2,pacing:2,fueling:2},roles:['Analisi richiesta'],transitionCost:'medium'}
  };

  function familyForType(type){return typeFamilies[type]||null;}
  function defaultVariantForType(type){
    return type==='marathon'?'road-marathon':type==='half-marathon'?'road-half':'';
  }
  function inferVariantKey(goal={}){
    const name=String(goal.name||'').toLowerCase();
    if(goal.type==='marathon')return'road-marathon';
    if(goal.type==='half-marathon')return'road-half';
    if(goal.type==='running'){
      if(/\b(42[,.]?195|maratona|marathon)\b/.test(name))return'road-marathon';
      if(/\b(30)\s*(km|k)\b/.test(name))return'road-30k';
      if(/\b(mezza|half|21[,.]?1)\b/.test(name))return'road-half';
      if(/\b10\s*(km|k)\b/.test(name))return'road-10k';
      if(/\b5\s*(km|k)\b/.test(name))return'road-5k';
    }
    if(goal.type==='hyrox'){
      if(/\b(doppio|doubles?)\b/.test(name)&&/\b(pro)\b/.test(name)&&/\b(uomo|men|male)\b/.test(name))return'hyrox-doubles-men-pro';
      if(/\b(doppio|doubles?)\b/.test(name)&&/\b(misto|mixed)\b/.test(name))return'hyrox-doubles-mixed';
      if(/\b(doppio|doubles?)\b/.test(name)&&/\b(uomo|men|male)\b/.test(name))return'hyrox-doubles-men-open';
      if(/\b(pro)\b/.test(name)&&/\b(uomo|men|male)\b/.test(name))return'hyrox-single-men-pro';
    }
    if(goal.type==='obstacle'){
      if(/\bultra\b/.test(name))return'spartan-ultra';
      if(/\bbeast\b/.test(name))return'spartan-beast';
      if(/\bsuper\b/.test(name))return'spartan-super';
      if(/\bsprint\b/.test(name))return'spartan-sprint';
      if(/\bstadion\b/.test(name))return'spartan-stadion';
    }
    if(goal.type==='triathlon'){
      if(/\b(140[,.]6|full)\b|ironman(?!\s*70)/.test(name))return'ironman-full';
      if(/\b70[,.]3\b|half\s*ironman/.test(name))return'ironman-70-3';
      if(/\b(olimpico|olympic|standard)\b/.test(name))return'triathlon-standard';
      if(/\bsprint\b/.test(name))return'triathlon-sprint';
    }
    if(goal.type==='athx'){
      const pairs=/\b(pair|pairs|coppia|doppio)\b/.test(name),pro=/\bpro\b/.test(name),lite=/\blite\b/.test(name);
      if(pairs&&pro)return'athx-pro-pairs';
      if(pairs&&lite)return'athx-lite-pairs';
      if(pairs)return'athx-pairs';
      if(pro)return'athx-pro-individual';
      if(lite)return'athx-lite-individual';
      return'athx-individual';
    }
    return'';
  }
  function variantFor(goal={}){
    const familyKey=familyForType(goal.type);
    const requested=String(goal.variant||defaultVariantForType(goal.type)||inferVariantKey(goal));
    const variant=variantIndex.get(requested);
    return variant&&variant.family===familyKey?clone(variant):null;
  }
  function variantsFor(type){
    const familyKey=familyForType(type);
    const list=variants.filter(item=>item.family===familyKey);
    if(type==='marathon')return list.filter(item=>item.key==='road-marathon').map(clone);
    if(type==='half-marathon')return list.filter(item=>item.key==='road-half').map(clone);
    return list.map(clone);
  }
  function profileFor(goal={}){
    const familyKey=familyForType(goal.type),base=familyKey?families[familyKey]:null,variant=variantFor(goal);
    if(base){
      const sourceKeys=unique([...(base.sourceKeys||[]),...(variant?.sourceKeys||[])]);
      return{
        ...clone(base),...(variant?clone(variant):{}),
        key:variant?.key||base.key,
        label:variant?`${base.label.split(' · ')[0]} · ${variant.label}`:base.label,
        version:VERSION,
        confidence:variant?.confidence||base.confidence,
        programmingStatus:variant?.programmingStatus||base.programmingStatus,
        duration:clone(variant?.duration||base.duration),
        disciplines:clone(base.disciplines),
        demands:normalizedDemands(variant?.demands||base.demands),
        keyRoles:clone(variant?.keyRoles||base.keyRoles),
        sources:sourceList(sourceKeys),
        sourceKeys,
        formatSummary:variant?.formatSummary||base.formatSummary||'',
        formatDetails:clone(variant?.formatDetails||base.formatDetails||[]),
        stations:clone(variant?.stations||[]),
        variant:variant?clone(variant):null,
        goal:{id:goal.id||null,name:goal.name||variant?.label||base.label,type:goal.type||'other',variant:variant?.key||null}
      };
    }
    const template=genericTemplates[goal.type]||genericTemplates.other;
    return{
      key:`generic-${goal.type||'other'}`,label:'Profilo generico da confermare',version:VERSION,confidence:'generic',programmingStatus:'pending',
      duration:clone(template.duration),disciplines:clone(template.disciplines),demands:normalizedDemands(template.demands),
      keyRoles:clone(template.roles),sources:[],sourceKeys:[],transitionCost:template.transitionCost,
      formatSummary:'',formatDetails:[],stations:[],variant:null,
      goal:{id:goal.id||null,name:goal.name||'Obiettivo',type:goal.type||'other',variant:null}
    };
  }
  function demandList(profile){
    return dimensions.map(item=>({...item,level:profile?.demands?.[item.key]||0,levelLabel:levelLabels[profile?.demands?.[item.key]||0]}));
  }
  function dateAtNoon(value){return new Date(`${value}T12:00:00`);}
  function daysBetween(from,to){return Math.round((dateAtNoon(to)-dateAtNoon(from))/86400000);}
  function overlapBetween(first,second){
    const a=profileFor(first),b=profileFor(second),values=dimensions.map(item=>[a.demands[item.key],b.demands[item.key]]);
    const dot=values.reduce((sum,[left,right])=>sum+left*right,0),leftNorm=Math.sqrt(values.reduce((sum,[left])=>sum+left*left,0)),rightNorm=Math.sqrt(values.reduce((sum,[,right])=>sum+right*right,0));
    const score=leftNorm&&rightNorm?clamp(dot/(leftNorm*rightNorm),0,1):0;
    const shared=dimensions.filter(item=>a.demands[item.key]>=3&&b.demands[item.key]>=3).sort((x,y)=>Math.min(b.demands[y.key],a.demands[y.key])-Math.min(b.demands[x.key],a.demands[x.key])).map(item=>item.label);
    const divergent=dimensions.filter(item=>Math.abs(a.demands[item.key]-b.demands[item.key])>=3).sort((x,y)=>Math.abs(a.demands[y.key]-b.demands[y.key])-Math.abs(a.demands[x.key]-b.demands[x.key])).map(item=>item.label);
    return{score:+score.toFixed(2),percent:Math.round(score*100),label:score>=.85?'Molto alta':score>=.7?'Alta':score>=.5?'Media':'Bassa',shared:shared.slice(0,4),divergent:divergent.slice(0,3)};
  }
  function relationFor(primary,secondary,today){
    const gapDays=daysBetween(primary.date,secondary.date),distance=Math.abs(gapDays),overlap=overlapBetween(primary,secondary),primaryProfile=profileFor(primary),secondaryProfile=profileFor(secondary);
    let tone='neutral',role='separate',title='Obiettivo separato',summary='Il calendario lascia spazio a un blocco dedicato; il Coach non assume che le due preparazioni siano equivalenti.',actions=[];
    const marathonWith30k=primaryProfile.key==='road-marathon'&&secondaryProfile.key==='road-30k'&&gapDays<0&&distance<=28;
    if(marathonWith30k){
      role='preparatory';tone='warn';title='Lungo specifico in gara';
      summary='La 30 km ha un’altissima sovrapposizione con la maratona, ma deve restare un lungo specifico controllato e non diventare un secondo picco.';
      actions=['Definire prima un tetto di ritmo: ritmo maratona previsto solo se tolleranza e fase lo consentono','Provare strategia di fueling e materiali senza aggiungere volume compensatorio','Proteggere il recupero e la seduta chiave successiva'];
    }else if(gapDays<0){
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
    }else{
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
    if(secondaryProfile.confidence==='generic')actions.push('Specificare il formato dell’evento prima di una prescrizione specifica');
    if(secondaryProfile.programmingStatus==='pending')actions.push('Il formato è verificato, ma il pack di programmazione specifico deve ancora essere revisionato');
    return{goal:clone(secondary),profile:secondaryProfile,gapDays,distanceDays:distance,role,tone,title,summary,overlap,actions:unique(actions)};
  }
  function coordinate(input={}){
    const today=input.today||null,primary=input.primary||null,goals=(Array.isArray(input.goals)?input.goals:[]).filter(item=>item&&item.status==='planned'&&(!today||item.date>=today));
    if(!primary)return null;
    const primaryProfile=profileFor(primary);
    const secondary=goals.filter(item=>item.id!==primary.id).sort((a,b)=>a.date.localeCompare(b.date)).map(item=>relationFor(primary,item,today));
    const urgent=secondary.filter(item=>['danger','warn'].includes(item.tone)).length;
    return{
      version:VERSION,primary:{goal:clone(primary),profile:primaryProfile,demands:demandList(primaryProfile)},secondary,
      summary:secondary.length?urgent?`${urgent} coordinament${urgent===1?'o richiede':'i richiedono'} una scelta esplicita prima di modificare il piano.`:'Gli obiettivi presenti possono essere separati senza un conflitto immediato evidente.':'Nessuna gara B/C futura da coordinare con la priorità A.',
      guardrail:'Il formato e le richieste sono descrittivi. Nessuna relazione genera o modifica sedute senza una regola Coach revisionata e una conferma esplicita.'
    };
  }

  return{
    VERSION,dimensions,levelLabels,sources,families,
    familyForType,defaultVariantForType,variantsFor,variantFor,profileFor,hyroxStations,
    demandList,overlapBetween,relationFor,coordinate,daysBetween
  };
});
