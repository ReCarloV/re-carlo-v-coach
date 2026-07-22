(function(root,factory){
  const eventDemand=typeof module!=='undefined'&&module.exports?require('./event-demand-model.js'):root?.rcEventDemandModel;
  const api=factory(eventDemand);
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.rcEventProgrammingModel=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(eventDemand){
  'use strict';

  const VERSION='1.3.0';
  const DAY_MS=86400000;
  const sources={
    distancePractice:{
      label:'Distance running · caratteristiche della programmazione di alto livello',
      url:'https://pmc.ncbi.nlm.nih.gov/articles/PMC8975965/',
      appliesTo:['running']
    },
    distancePeriodization:{
      label:'Distance runners · periodizzazione e distribuzione dell’intensità',
      url:'https://pubmed.ncbi.nlm.nih.gov/35418513/',
      appliesTo:['running']
    },
    enduranceTaper:{
      label:'Endurance taper · revisione sistematica e meta-analisi',
      url:'https://pmc.ncbi.nlm.nih.gov/articles/PMC10171681/',
      appliesTo:['running','hyrox']
    },
    runningStrength:{
      label:'Runner allenati · forza massima e pliometria sulla durability',
      url:'https://pubmed.ncbi.nlm.nih.gov/40016936/',
      appliesTo:['running']
    },
    concurrentRunning:{
      label:'Running · forza ed endurance concorrenti in runner allenati',
      url:'https://pubmed.ncbi.nlm.nih.gov/34767655/',
      appliesTo:['running','hyrox','triathlon']
    },
    worldTriathlonFormat:{
      label:'World Triathlon · distanze Age Group Sprint e Standard',
      url:'https://triathlon.org/agegroup',
      appliesTo:['triathlon']
    },
    worldTriathlonRules:{
      label:'World Triathlon · regole correnti, muta e specificità dell’evento',
      url:'https://triathlon.org/faqs',
      appliesTo:['triathlon']
    },
    ironmanRules:{
      label:'IRONMAN · Competition Rules correnti',
      url:'https://www.ironman.com/resources/rules-and-policies/competition-rules',
      appliesTo:['triathlon']
    },
    triSprintTransition:{
      label:'Sprint triathlon · influenza del ciclismo sulla corsa successiva',
      url:'https://pubmed.ncbi.nlm.nih.gov/10211859/',
      appliesTo:['triathlon']
    },
    triTransitionReview:{
      label:'Triathlon · transizione ciclismo-corsa e implicazioni pratiche',
      url:'https://pubmed.ncbi.nlm.nih.gov/11049151/',
      appliesTo:['triathlon']
    },
    triVariableCycling:{
      label:'Triathlon · potenza ciclistica variabile e corsa successiva',
      url:'https://pubmed.ncbi.nlm.nih.gov/23347994/',
      appliesTo:['triathlon']
    },
    triOpenWater:{
      label:'Nuoto open water · efficienza e biomeccanica sui 1500 m',
      url:'https://pubmed.ncbi.nlm.nih.gov/38648801/',
      appliesTo:['triathlon']
    },
    triPoolTest:{
      label:'Triathlon · test in piscina e prestazione open water',
      url:'https://pubmed.ncbi.nlm.nih.gov/38132720/',
      appliesTo:['triathlon']
    },
    triFueling:{
      label:'Half-Ironman · assunzione di carboidrati e prestazione',
      url:'https://pubmed.ncbi.nlm.nih.gov/28350714/',
      appliesTo:['triathlon']
    },
    triLongCourse:{
      label:'IRONMAN age group · predittori ciclistici e running della prestazione',
      url:'https://pubmed.ncbi.nlm.nih.gov/40153133/',
      appliesTo:['triathlon']
    },
    triInjury:{
      label:'Triathlon · specializzazione, stress cumulativo e infortuni',
      url:'https://pubmed.ncbi.nlm.nih.gov/20042924/',
      appliesTo:['triathlon']
    },
    hyroxPhysiology:{
      label:'HYROX · richieste fisiologiche in una simulazione Individual Open',
      url:'https://pmc.ncbi.nlm.nih.gov/articles/PMC11994925/',
      appliesTo:['hyrox']
    },
    hyroxNorms:{
      label:'HYROX · profili prestativi per Individual, Doubles e Relay',
      url:'https://pubmed.ncbi.nlm.nih.gov/42189569/',
      appliesTo:['hyrox']
    },
    hyroxRules:{
      label:'HYROX · rulebook ufficiali correnti',
      url:'https://hyrox.com/rulebook/',
      appliesTo:['hyrox']
    },
    spartanFormat:{
      label:'Spartan · distanze e numero di ostacoli ufficiali',
      url:'https://www.spartan.com/en/race/spartan-races',
      appliesTo:['obstacle']
    },
    spartanObstacles:{
      label:'Spartan · famiglie e richieste degli ostacoli',
      url:'https://www.spartan.com/en/race/spartan-race-obstacles',
      appliesTo:['obstacle']
    },
    ocrPhysiology:{
      label:'OCR Sprint e Super · risposte fisiologiche, grip e stabilità',
      url:'https://doi.org/10.3390/app14209604',
      appliesTo:['obstacle']
    },
    ocrDeterminants:{
      label:'Obstacle course · determinanti fisiologici della prestazione',
      url:'https://pubmed.ncbi.nlm.nih.gov/10628164/',
      appliesTo:['obstacle']
    },
    ocrExtreme:{
      label:'OCR estremo · richieste intermittenti in uno studio esplorativo',
      url:'https://pmc.ncbi.nlm.nih.gov/articles/PMC6720877/',
      appliesTo:['obstacle']
    },
    ocrInjuries:{
      label:'Obstacle course racing · analisi longitudinale degli infortuni',
      url:'https://pubmed.ncbi.nlm.nih.gov/29977946/',
      appliesTo:['obstacle']
    },
    athxFormat:{
      label:'ATHX Games · struttura ufficiale in sei zone',
      url:'https://athxgames.com/',
      appliesTo:['athx']
    },
    athxWorkouts2026:{
      label:'ATHX Games · workout 2026: Strength, Endurance e MetCon X',
      url:'https://athxgames.com/workouts/2026',
      appliesTo:['athx']
    },
    athxStandards2026:{
      label:'ATHX Games · movement standards 2026',
      url:'https://athxgames.com/movement-standards/2026',
      appliesTo:['athx']
    },
    hiftDeterminants:{
      label:'Functional fitness · determinanti di forza, potenza e capacità aerobica',
      url:'https://pubmed.ncbi.nlm.nih.gov/32456306/',
      appliesTo:['athx']
    },
    hiftBenchmarks:{
      label:'Functional fitness · forza e soglia nei benchmark ad alta intensità',
      url:'https://pubmed.ncbi.nlm.nih.gov/26261428/',
      appliesTo:['athx']
    },
    hiftResponses:{
      label:'HIFT · risposta cardiaca, lattato e RPE in atleti allenati',
      url:'https://pubmed.ncbi.nlm.nih.gov/39649788/',
      appliesTo:['athx']
    },
    hiftTimeDomains:{
      label:'HIFT · intervalli prescritti e rounds-for-time a volume equivalente',
      url:'https://pubmed.ncbi.nlm.nih.gov/40007896/',
      appliesTo:['athx']
    }
  };

  const clone=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
  const unique=items=>[...new Set(items.filter(Boolean))];
  const phase=(min,key,label,focus)=>({min,key,label,focus});
  const session=(key,label,role,phases,detail)=>({key,label,role,phases,detail});
  const guard=(key,label,state,detail,tone='neutral')=>({key,label,state,detail,tone});
  function dateAtNoon(value){return new Date(`${value}T12:00:00`);}
  function daysBetween(from,to){return Math.round((dateAtNoon(to)-dateAtNoon(from))/DAY_MS);}
  function sourceList(keys){return unique(keys).map(key=>({key,...sources[key]})).filter(item=>item.url);}

  const runningDefinitions={
    'road-5k':{
      label:'5 km',distanceKm:5,quality:'ritmo 5 km / VO₂',longLabel:'Lungo aerobico di supporto',qualityPriority:116,longPriority:74,
      phases:[
        phase(70,'base','Base 5 km','Consolidare frequenza facile, economia di corsa, forza e tolleranza all’impatto.'),
        phase(42,'build','Costruzione 5 km','Sviluppare soglia e capacità aerobica ad alta intensità senza perdere continuità facile.'),
        phase(15,'specific','Specifico 5 km','Rendere preciso il ritmo gara con volume specifico controllato e recuperi completi.'),
        phase(6,'taper','Taper 5 km','Ridurre la fatica conservando ritmo gara, rapidità ed economia.'),
        phase(0,'race-week','Race week 5 km','Arrivare reattivo e fresco senza trasformare i richiami in test.')
      ]
    },
    'road-10k':{
      label:'10 km',distanceKm:10,quality:'soglia / ritmo 10 km',longLabel:'Lungo aerobico di supporto',qualityPriority:114,longPriority:82,
      phases:[
        phase(84,'base','Base 10 km','Consolidare volume facile, frequenza, economia e forza compatibile.'),
        phase(49,'build','Costruzione 10 km','Sviluppare soglia e capacità aerobica mantenendo un solo carico running principale.'),
        phase(18,'specific','Specifico 10 km','Integrare ritmo 10 km, soglia e richiami più rapidi senza sommare intensità nascoste.'),
        phase(7,'taper','Taper 10 km','Ridurre il volume mantenendo ritmo gara ed economia.'),
        phase(0,'race-week','Race week 10 km','Proteggere freschezza e precisione del ritmo.')
      ]
    },
    'road-half':{
      label:'Mezza maratona',distanceKm:21.0975,quality:'soglia / ritmo mezza',longLabel:'Lungo specifico progressivo',qualityPriority:108,longPriority:105,
      phases:[
        phase(99,'base','Base mezza maratona','Costruire continuità, volume facile e tolleranza al lungo.'),
        phase(56,'build','Costruzione mezza','Sviluppare soglia e lungo senza far crescere entrambi nella stessa decisione.'),
        phase(35,'specific-build','Sviluppo specifico mezza','Avvicinare una parte del lavoro a ritmo mezza mantenendo il resto chiaramente facile.'),
        phase(15,'specific','Specifico mezza','Stabilizzare ritmo gara, lungo specifico e strategia di assunzione quando necessaria.'),
        phase(8,'taper','Taper mezza','Ridurre la fatica conservando richiami di ritmo e routine.'),
        phase(0,'race-week','Race week mezza','Arrivare fresco senza compensare volume perso.')
      ]
    },
    'road-30k':{
      label:'30 km',distanceKm:30,quality:'ritmo 30 km / ritmo maratona',longLabel:'Lungo specifico e fueling',qualityPriority:102,longPriority:112,
      phases:[
        phase(99,'base','Base 30 km','Costruire frequenza, volume facile e tolleranza meccanica.'),
        phase(70,'build','Costruzione 30 km','Aumentare gradualmente lungo e capacità di assorbire il volume.'),
        phase(42,'specific-build','Sviluppo specifico 30 km','Integrare ritmo sostenibile, lunghi e strategia di fueling.'),
        phase(22,'specific','Specifico 30 km','Consolidare ritmo obiettivo e lunghi specifici senza un secondo picco tardivo.'),
        phase(15,'peak','Picco specifico 30 km','Completare gli ultimi stimoli chiave senza inseguire adattamenti tardivi.'),
        phase(8,'taper','Taper 30 km','Ridurre la fatica mantenendo ritmo, routine e fueling già provati.'),
        phase(0,'race-week','Race week 30 km','Proteggere freschezza e piano di esecuzione.')
      ]
    },
    'road-marathon':{
      label:'Maratona',distanceKm:42.195,quality:'ritmo maratona / soglia controllata',longLabel:'Lungo specifico e fueling',qualityPriority:100,longPriority:114,
      phases:[
        phase(99,'base','Base generale','Consolidare continuità, frequenza sostenibile e tolleranza al volume prima del lavoro più specifico.'),
        phase(70,'build','Costruzione','Aumentare gradualmente la capacità di assorbire lungo e qualità mantenendo la forza con costo controllato.'),
        phase(42,'specific-build','Sviluppo specifico','Avvicinare lunghi e qualità alle richieste della maratona senza concentrare troppo carico nella stessa settimana.'),
        phase(22,'specific','Specifico maratona','Rendere stabili ritmo gara, lunghi specifici e strategia di alimentazione, proteggendo il recupero.'),
        phase(15,'peak','Picco specifico','Completare gli ultimi stimoli chiave senza cercare adattamenti tardivi o carico aggiuntivo non necessario.'),
        phase(8,'taper','Taper','Ridurre la fatica mantenendo richiami di intensità, routine e fiducia nel lavoro svolto.'),
        phase(0,'race-week','Race week','Arrivare fresco alla gara: nessun recupero perso può essere compensato con lavoro dell’ultimo momento.')
      ]
    }
  };

  const runningTolerance=[
    'Due finestre recenti di sette giorni devono avere registrazioni sufficienti prima di proporre una progressione.',
    'Lungo e volume facile hanno autorizzazioni separate: superare un controllo non autorizza automaticamente l’altro.',
    'Una progressione del lungo richiede un lungo recente comparabile, completato con RPE, dolore ed esecuzione compatibili.',
    'Fase, disponibilità e sintomi possono bloccare una progressione anche quando la risposta fisiologica è favorevole.',
    'WHOOP sostiene la lettura del recupero, ma non decide da solo volume, intensità o periodizzazione.'
  ];
  const runningLimits=[
    'Il tetto del 5% è un limite operativo conservativo della singola proposta, non una soglia universale di rischio.',
    'Il lavoro facile resta la quota prevalente; il pack non impone una distribuzione polarizzata o piramidale unica per tutti.',
    'Forza e pliometria vengono mantenute soltanto se il loro costo è compatibile con gli stimoli running prioritari.',
    'Terreno, dislivello, clima, calendario reale e risposta individuale restano variabili obbligatorie della prescrizione.'
  ];

  function runningSessions(definition){
    const short=definition.distanceKm<=10;
    return[
      session('easy','Corsa facile','easy',['base','build','specific-build','specific','peak','taper','race-week'],'Costruisce o mantiene frequenza e volume con intensità chiaramente controllata.'),
      session('quality',definition.quality,'quality',['build','specific-build','specific','peak','taper'],'Un solo stimolo running principale per microciclo; dose e recuperi dipendono da storico e fase.'),
      session('long',definition.longLabel,'long',['base','build','specific-build','specific','peak'],short?'Supporta la capacità aerobica senza diventare il principale determinante della settimana.':'Sviluppa tolleranza alla durata; ritmo, progressione e fueling devono essere espliciti.'),
      session('economy','Economia, strides e tecnica','neuromuscular',['base','build','specific','taper'],'Richiamo breve e non esaustivo; non viene contato come una seconda seduta dura quando resta realmente neuromuscolare.'),
      session('strength','Forza e potenza di supporto','strength',['base','build','specific-build','specific','peak','taper'],'Fondamentali e pliometria con volume compatibile; la qualità si conserva prima degli accessori.'),
      ...(!short?[session('fueling','Pacing e fueling','fueling',['specific-build','specific','peak'],'Strategia provata nei lavori adatti, mai introdotta per la prima volta in gara.')]:[])
    ];
  }

  function runningConstraint(definition,phaseKey){
    const late=['specific','peak','taper','race-week'].includes(phaseKey);
    const taper=phaseKey==='taper',raceWeek=phaseKey==='race-week',peak=phaseKey==='peak';
    const short=definition.distanceKm<=10;
    const minStrengthRir=late?phaseKey==='race-week'?4:3:2;
    const strengthSetReduction=late?1:0;
    const maxActiveSessions=raceWeek?4:(peak||taper)?5:6;
    const longFactor=raceWeek?(short ? .6 : .45):taper?(short ? .8 : .7):(peak ? .9 : 1);
    const qualityStyle=taper||raceWeek?'recall':definition.distanceKm===5?'5k':definition.distanceKm===10?'10k':definition.distanceKm<=21.1?'half':definition.distanceKm===30?'30k':'marathon';
    const phaseSummary={
      base:`La base per ${definition.label} privilegia continuità facile, economia e tolleranza prima della specificità.`,
      build:`La costruzione per ${definition.label} sviluppa ${definition.quality} senza aumentare insieme tutte le fonti di carico.`,
      'specific-build':`La preparazione si avvicina alle richieste della ${definition.label}, mantenendo separati lungo, qualità e costo lower body.`,
      specific:`La specificità ${definition.label} ha priorità; il resto del lavoro deve permetterne l’assorbimento.`,
      peak:'Gli ultimi stimoli chiave vengono completati senza recuperare lavoro perso o aggiungere adattamenti tardivi.',
      taper:'Si riduce soprattutto il volume mantenendo richiami brevi di intensità, economia e routine.',
      'race-week':'Freschezza e Race Day sono intoccabili: nessuna compensazione o nuova fatica.'
    }[phaseKey]||`Vincoli specifici per ${definition.label}.`;
    const longState=short?'Supporto aerobico':raceWeek?'Nessun lungo aggiuntivo':taper?'Ridotto, non progressivo':peak?'Nessun aumento automatico':'Seduta chiave';
    return{
      summary:phaseSummary,
      limits:{
        longProgressionCap:['peak','taper','race-week'].includes(phaseKey)?1:1.05,
        aerobicProgressionCap:['peak','taper','race-week'].includes(phaseKey)?1:1.05,
        maxQuality:1,minStrengthRir,minStrengthSetReduction:strengthSetReduction,maxActiveSessions,
        hyroxMode:raceWeek?'off':late?'technical':phaseKey==='build'?'maintenance':'optional'
      },
      generated:{longFactor,qualityStyle},
      guards:[
        guard('long',short?'Lungo aerobico':'Lungo',longState,short?'Non deve sottrarre recupero alla qualità specifica e non cresce automaticamente.':raceWeek?'La gara sostituisce la seduta chiave; il volume perso non viene recuperato.':'Progressione soltanto dopo esiti, sintomi e tolleranza coerenti.',short?'neutral':late?'warn':'good'),
        guard('quality','Qualità',raceWeek?'Solo attivazione':'Massimo 1 stimolo',`${definition.quality}: volume e densità restano coerenti con la fase.`),
        guard('easy','Corsa facile',raceWeek?'Breve / shake-out':'Volume prevalente','Sostiene frequenza e assorbimento senza intensità nascosta.','good'),
        guard('strength','Forza',late?`Basso volume · RIR ${minStrengthRir}`:'Sviluppo compatibile','La qualità dei fondamentali viene conservata riducendo prima serie e accessori non essenziali.'),
        guard('hyrox','HYROX / Metcon',raceWeek?'Sospeso':late?'Solo tecnica':'Subordinato',raceWeek?'Nessuna fatica ibrida nella settimana gara.':'Non deve degradare il lavoro running prioritario.',raceWeek?'danger':late?'warn':'neutral')
      ],
      priorities:{
        race:130,quality:definition.qualityPriority,long:definition.longPriority,easy:84,
        'strength-upper':late?65:72,'strength-lower':late?58:68,
        hyrox:late?25:46,metcon:late?20:40,cycling:38,recovery:10,other:30
      }
    };
  }

  function hyroxMode(variantKey=''){
    if(variantKey.includes('relay'))return'relay';
    if(variantKey.includes('doubles'))return'doubles';
    if(variantKey.includes('adaptive'))return'adaptive';
    return'single';
  }
  function hyroxOverlay(profile){
    const key=profile?.key||'',mode=hyroxMode(key),pro=/-pro$/.test(key);
    const modeDetail={
      single:'L’atleta deve sostenere tutti gli 8 km e completare individualmente tutte le stazioni.',
      doubles:'Entrambi corrono gli 8 km; lavoro di stazione, cambi YGIG e strategia di coppia vanno allenati insieme.',
      relay:'Ogni atleta prepara le proprie due coppie run/station come frazioni assegnate, i cambi e il recupero tra le frazioni; non eredita il volume di una simulazione Individual.',
      adaptive:'Standard, classificazione e adattamenti devono essere confermati sul rulebook dell’evento prima di prescrivere.'
    }[mode];
    return{
      mode,pro,
      label:{single:'Individual',doubles:'Doubles',relay:'Relay',adaptive:'Adaptive'}[mode],
      detail:modeDetail,
      loadDetail:pro?'I carichi Pro ufficiali della divisione diventano un vincolo tecnico e di forza specifica, non un’etichetta generica.':'I carichi ufficiali della divisione selezionata restano il riferimento per la specificità.',
      stationLoads:(profile?.stations||[]).map(item=>[item.name,item.work,item.load].filter(Boolean).join(' · '))
    };
  }
  const hyroxPhases=[
    phase(70,'base','Base ibrida','Consolidare corsa, forza e tecnica delle stazioni senza simulazioni premature.'),
    phase(35,'build','Costruzione HYROX','Sviluppare forza resistente e qualità di corsa mantenendo separati gli stimoli più costosi.'),
    phase(15,'specific','Specifico HYROX','Integrare corsa compromessa, stazioni, transizioni e strategia del formato selezionato.'),
    phase(8,'taper','Taper HYROX','Ridurre il volume conservando ritmo, tecnica di stazione e confidenza nelle transizioni.'),
    phase(0,'race-week','Race week HYROX','Proteggere freschezza e qualità neuromuscolare senza aggiungere fatica residua.')
  ];
  const hyroxTolerance=[
    'La seduta specifica cresce soltanto se corsa, stazioni e transizioni precedenti hanno esiti sufficientemente completi.',
    'Corsa di qualità e HYROX ad alto costo non vengono sommate automaticamente nello stesso microciclo.',
    'La specificità usa il formato selezionato: Individual, Doubles e Relay non condividono lo stesso volume individuale.',
    'Dolore, esecuzione, RPE e disponibilità possono ridurre la dose anche quando il recovery del wearable è favorevole.',
    'I carichi di gara vengono introdotti in base a tecnica e riserva di forza osservate, non solo perché il formato li prevede.'
  ];
  const hyroxLimits=[
    'L’evidenza diretta HYROX è ancora limitata e non giustifica rapporti universali tra corsa, forza e stazioni.',
    'Lo studio fisiologico disponibile riguarda un piccolo campione recreational in una simulazione Individual Open; il trasferimento a Pro, Doubles e Relay è contestuale.',
    'I dati normativi descrivono risultati reali per categoria, ma non dimostrano da soli quale programma causi la prestazione.',
    'Le regole ufficiali definiscono il formato e i carichi, non la dose di allenamento individuale.'
  ];
  function hyroxSessions(overlay){
    const formatSpecific=overlay.mode==='doubles'?'Strategia di coppia e cambi YGIG':overlay.mode==='relay'?'Frazioni assegnate e cambi Relay':'Simulazione frazionata specifica';
    return[
      session('easy','Corsa facile','easy',['base','build','specific','taper','race-week'],'La corsa rappresenta una parte sostanziale del tempo gara e sostiene la capacità di ripetere gli 1.000 m.'),
      session('run-quality','Qualità running','quality',['build','specific','taper'],'Un solo stimolo running principale coordinato con il costo della seduta HYROX.'),
      session('strength','Forza massima e riserva di carico','strength',['base','build','specific','taper'],'Fondamentali e pattern utili conservano qualità prima della forza resistente.'),
      session('stations','Tecnica e forza resistente di stazione','hyrox',['base','build','specific','taper'],'Standard, carichi e tecnica derivano dalla divisione ufficiale selezionata.'),
      session('compromised','Corsa compromessa e transizioni','hyrox',['build','specific'],'Blocchi frazionati e verificabili, non una simulazione completa automatica.'),
      session('format',formatSpecific,'hyrox',['specific','taper'],overlay.detail)
    ];
  }
  function hyroxConstraint(phaseKey,overlay){
    const late=['specific','taper','race-week'].includes(phaseKey),raceWeek=phaseKey==='race-week',taper=phaseKey==='taper';
    const hyroxState=raceWeek?'Race primer':taper?'Primer tecnico':phaseKey==='specific'?'Priorità specifica':phaseKey==='build'?'1 seduta specifica':'1 seduta tecnica';
    return{
      summary:{
        base:'Corsa, forza e tecnica delle stazioni costruiscono la base senza simulazioni premature.',
        build:'Forza resistente, qualità di corsa e tecnica HYROX progrediscono senza sovrapporre tutti gli stimoli costosi.',
        specific:`Corsa compromessa e strategia ${overlay.label} diventano prioritarie; la forza massima viene mantenuta con volume ridotto.`,
        taper:'Il volume ibrido cala, mentre ritmo, tecnica di stazione e transizioni restano riconoscibili.',
        'race-week':'Freschezza, tecnica e Race Day vengono protetti; nessun lavoro perso viene recuperato.'
      }[phaseKey],
      limits:{
        longProgressionCap:1,aerobicProgressionCap:1,maxQuality:1,
        minStrengthRir:raceWeek?4:late?3:2,minStrengthSetReduction:late?1:0,
        maxActiveSessions:raceWeek?4:taper?5:6,
        hyroxMode:raceWeek?'primer':taper?'primer':phaseKey==='specific'?'race-specific':phaseKey==='build'?'specific':'foundation'
      },
      generated:{longFactor:1,qualityStyle:taper||raceWeek?'recall':'normal'},
      guards:[
        guard('long','Corsa lunga',raceWeek?'Esclusa':'Supporto aerobico','Resta facile e subordinata al microciclo ibrido.'),
        guard('quality','Qualità running',raceWeek?'Solo attivazione':'Massimo 1 stimolo','Separata dalla seduta HYROX più impegnativa.'),
        guard('easy','Corsa facile',raceWeek?'Breve / shake-out':'Volume sostenibile','Sostiene la capacità di ripetere la corsa senza aggiungere intensità nascosta.','good'),
        guard('strength','Forza',late?`Mantenimento · RIR ${raceWeek?4:3}`:'Sviluppo','Fondamentali di qualità; volume e accessori seguono il costo delle stazioni.'),
        guard('hyrox','HYROX',hyroxState,`${overlay.detail} ${overlay.loadDetail}`,phaseKey==='specific'?'good':late?'warn':'neutral')
      ],
      priorities:{race:130,hyrox:114,metcon:98,quality:92,'strength-lower':82,'strength-upper':78,easy:72,long:62,cycling:35,recovery:10,other:30}
    };
  }

  const obstacleDefinitions={
    'spartan-stadion':{label:'Spartan Stadion',distanceKm:5,obstacles:20,terrain:'stadium',longPriority:54,qualityPriority:108,specificPriority:116},
    'spartan-sprint':{label:'Spartan Sprint',distanceKm:5,obstacles:20,terrain:'off-road',longPriority:64,qualityPriority:106,specificPriority:116},
    'spartan-super':{label:'Spartan Super',distanceKm:10,obstacles:25,terrain:'off-road',longPriority:86,qualityPriority:100,specificPriority:116},
    'spartan-beast':{label:'Spartan Beast',distanceKm:21,obstacles:30,terrain:'off-road',longPriority:108,qualityPriority:94,specificPriority:116},
    'spartan-ultra':{label:'Spartan Ultra',distanceKm:50,obstacles:60,terrain:'off-road',longPriority:114,qualityPriority:86,specificPriority:112}
  };
  function obstaclePhases(definition){
    const long=definition.distanceKm>=21,ultra=definition.distanceKm>=50,short=definition.distanceKm<=5;
    return[
      phase(ultra?120:long?99:short?70:84,'base',`Base ${definition.label}`,'Costruire corsa aerobica, forza relativa, grip e tolleranza al terreno senza circuiti specifici prematuri.'),
      phase(ultra?84:long?70:short?42:49,'build',`Costruzione ${definition.label}`,'Sviluppare terreno, salite, carry e sospensioni mantenendo qualità tecnica degli ostacoli.'),
      ...(!short?[phase(ultra?49:long?42:28,'specific-build',`Sviluppo specifico ${definition.label}`,'Integrare corsa su terreno, ostacoli e transizioni con dose progressiva e verificabile.')]:[]),
      phase(ultra?22:long?22:15,'specific',`Specifico ${definition.label}`,'Rendere stabili ritmo sul terreno, grip, carry e tecnica sotto fatica senza trasformare ogni settimana in gara.'),
      ...(long?[phase(15,'peak',`Picco specifico ${definition.label}`,'Completare l’ultimo stimolo specifico senza nuovi picchi tardivi di volume o densità.')]:[]),
      phase(8,'taper',`Taper ${definition.label}`,'Ridurre volume e fatica conservando brevi richiami di terreno, presa e tecnica.'),
      phase(0,'race-week',`Race week ${definition.label}`,'Proteggere freschezza, mani, avambracci e arti inferiori; nessun lavoro perso viene recuperato.')
    ];
  }
  const obstacleTolerance=[
    'La corsa su terreno e il volume aerobico progrediscono soltanto dopo due finestre recenti sufficientemente registrate e tollerate.',
    'Grip, sospensioni e carry crescono separatamente: la riuscita di una componente non autorizza l’aumento automatico delle altre.',
    'Una seduta specifica più densa richiede tecnica conservata, RPE compatibile, dolore basso e nessun peggioramento netto dell’esecuzione.',
    'La dose di discese, salite e terreno irregolare dipende dall’esposizione recente e non viene dedotta dalla sola distanza della gara.',
    'Fase, disponibilità, sintomi e qualità delle mani o della presa possono mantenere la dose anche con recovery del wearable favorevole.'
  ];
  const obstacleLimits=[
    'L’evidenza diretta sull’allenamento OCR è limitata: il pack integra formato ufficiale, studi osservazionali e principi di concurrent/endurance training senza dichiarare una formula universale.',
    'Le associazioni tra grip, forza relativa e prestazione non dimostrano da sole quale dose di allenamento causi il miglioramento.',
    'Ordine degli ostacoli, dislivello, fango, meteo e penalità dipendono dall’evento: la scheda gara reale resta una verifica obbligatoria.',
    'Nessuna simulazione completa viene generata automaticamente; tecnica e densità specifica aumentano soltanto con esiti reali compatibili.',
    'Per l’Ultra l’estrapolazione è più ampia: pacing, fueling e tolleranza alla durata richiedono storico individuale e confidenza inferiore.'
  ];
  function obstacleOverlay(profile){
    const definition=obstacleDefinitions[profile?.key]||{};
    return{
      label:definition.label||profile?.variant?.label||'Obstacle race',
      detail:`${definition.distanceKm||profile?.distanceKm||'—'} km · ${definition.obstacles||profile?.obstacleCount||'—'} ostacoli · ${definition.terrain==='stadium'?'ambiente stadium':'terreno off-road'}.`,
      loadDetail:'Il Coach prepara famiglie di richieste e tecnica trasferibile; ostacoli esatti, carichi e penalità vengono verificati sull’evento.'
    };
  }
  function obstacleSessions(definition){
    const long=definition.distanceKm>=21,short=definition.distanceKm<=5;
    return[
      session('easy','Corsa facile su terreno compatibile','easy',['base','build','specific-build','specific','peak','taper','race-week'],'Costruisce frequenza aerobica e controllo del passo senza trasformare ogni uscita in trail intenso.'),
      session('terrain','Salite, discese e ritmo su terreno','quality',['build','specific-build','specific','peak','taper'],'Un solo stimolo running principale; tecnica e costo eccentrico dipendono dall’esposizione recente.'),
      ...(!short?[session('long',long?'Lungo trail specifico':'Endurance trail','long',['base','build','specific-build','specific','peak'],'Durata, dislivello e terreno progrediscono separatamente e soltanto dopo tolleranza osservata.')]:[]),
      session('strength','Forza relativa e riserva di tirata','strength',['base','build','specific-build','specific','peak','taper'],'Tirata, lower body e trunk mantengono qualità; il volume segue il costo di corsa, carry e ostacoli.'),
      session('grip','Grip, sospensioni e carry','obstacle',['base','build','specific-build','specific','peak','taper'],'Presa, hanging, locomozioni e trasporti con tecnica pulita e progressione separata della densità.'),
      session('obstacles','Tecnica ostacoli e transizioni','obstacle',['build','specific-build','specific','peak','taper'],'Blocchi frazionati di corsa e ostacoli; nessuna simulazione completa automatica.'),
      ...(long?[session('fueling','Pacing e fueling sul terreno','fueling',['specific-build','specific','peak'],'Strategia provata nei lunghi adatti e aggiornata per durata, clima e profilo della gara.')]:[])
    ];
  }
  function obstacleConstraint(definition,phaseKey){
    const late=['specific','peak','taper','race-week'].includes(phaseKey),raceWeek=phaseKey==='race-week',taper=phaseKey==='taper',peak=phaseKey==='peak';
    const short=definition.distanceKm<=5,long=definition.distanceKm>=21;
    const minStrengthRir=raceWeek?4:late?3:2,maxActiveSessions=raceWeek?4:(peak||taper)?5:6;
    const longFactor=raceWeek ? 0.45 : taper ? 0.7 : peak ? 0.9 : 1;
    const obstacleState=raceWeek?'Solo primer':taper?'Tecnica breve':phaseKey==='specific'?'Priorità specifica':phaseKey==='specific-build'?'Integrazione progressiva':phaseKey==='build'?'Tecnica + densità controllata':'Tecnica di base';
    return{
      summary:{
        base:`La base ${definition.label} coordina corsa, forza relativa e tecnica senza simulazioni premature.`,
        build:'Terreno, grip, carry e ostacoli progrediscono senza concentrare nello stesso giorno tutte le fonti di fatica.',
        'specific-build':'Corsa e ostacoli vengono integrati in blocchi frazionati; densità, dislivello e volume restano variabili separate.',
        specific:'La specificità OCR ha priorità; forza massima e volume aerobico vengono mantenuti con costo compatibile.',
        peak:'L’ultimo stimolo chiave viene completato senza aggiungere volume o densità tardivi.',
        taper:'Il volume cala, mentre terreno, presa e tecnica restano riconoscibili in richiami brevi.',
        'race-week':'Freschezza, integrità di mani e avambracci e Race Day vengono protetti.'
      }[phaseKey]||`Vincoli specifici per ${definition.label}.`,
      limits:{
        longProgressionCap:['peak','taper','race-week'].includes(phaseKey)?1:1.05,
        aerobicProgressionCap:['peak','taper','race-week'].includes(phaseKey)?1:1.05,
        maxQuality:1,maxObstacleSpecific:raceWeek||taper?1:2,minStrengthRir,minStrengthSetReduction:late?1:0,maxActiveSessions,
        hyroxMode:'optional',obstacleMode:raceWeek?'primer':taper?'primer':phaseKey==='specific'?'race-specific':phaseKey==='base'?'foundation':'specific'
      },
      generated:{longFactor:short?1:longFactor,qualityStyle:raceWeek||taper?'recall':'hill'},
      guards:[
        guard('long',short?'Endurance aerobica':'Lungo trail',short?'Supporto':raceWeek?'Escluso':taper?'Ridotto, non progressivo':peak?'Nessun aumento automatico':'Seduta chiave',short?'La distanza breve non rende il lungo la priorità del microciclo.':'Durata, terreno e dislivello progrediscono solo dopo tolleranza osservata.',late?'warn':'good'),
        guard('quality','Terreno / salite',raceWeek?'Solo attivazione':'Massimo 1 stimolo','Nessuna seconda qualità running nascosta dentro la seduta specifica.'),
        guard('easy','Corsa facile',raceWeek?'Breve / shake-out':'Volume sostenibile','Frequenza e controllo del passo restano chiaramente facili.','good'),
        guard('strength','Forza relativa',late?`Mantenimento · RIR ${minStrengthRir}`:'Sviluppo compatibile','Tirata, lower body e trunk mantengono qualità; accessori cedono prima degli stimoli specifici.'),
        guard('obstacle','OCR specifico',obstacleState,'Grip, carry, tecnica e transizioni vengono dosati per famiglie; nessuna simulazione completa automatica.',phaseKey==='specific'?'good':late?'warn':'neutral')
      ],
      priorities:{race:130,obstacle:definition.specificPriority,metcon:definition.specificPriority,quality:definition.qualityPriority,long:definition.longPriority,'strength-upper':94,'strength-lower':86,easy:78,hyrox:38,cycling:32,recovery:10,other:30}
    };
  }

  const athxDefinitions={
    'athx-lite-individual':{label:'ATHX Lite Individual',division:'Lite',mode:'individual',runSegmentM:500,formatCaution:'La pagina workout 2026 non esplicita il dettaglio Lite nella sezione Individual: carichi e volume esatti vanno verificati sulla scheda evento.'},
    'athx-individual':{label:'ATHX Individual',division:'Standard',mode:'individual',runSegmentM:750},
    'athx-pro-individual':{label:'ATHX Pro Individual',division:'Pro',mode:'individual',runSegmentM:1000},
    'athx-lite-pairs':{label:'ATHX Lite Pairs',division:'Lite',mode:'pairs',runSegmentM:500},
    'athx-pairs':{label:'ATHX Pairs',division:'Standard',mode:'pairs',runSegmentM:750},
    'athx-pro-pairs':{label:'ATHX Pro Pairs',division:'Pro',mode:'pairs',runSegmentM:1000}
  };
  const athxPhases=[
    phase(84,'base','Base ATHX','Costruire separatamente forza massima, capacità aerobica, tecnica run/row e competenza nei movimenti senza simulazioni premature.'),
    phase(49,'build','Costruzione ATHX','Sviluppare i tre punteggi gara senza sovrapporre nella stessa seduta tutti gli stimoli ad alto costo.'),
    phase(28,'specific-build','Sviluppo specifico ATHX','Integrare cambi run/row, movimenti MetCon e gestione delle finestre di forza in blocchi controllati.'),
    phase(15,'specific','Specifico ATHX','Rendere stabili strategia, pacing e tecnica sotto fatica preservando la forza massimale.'),
    phase(8,'taper','Taper ATHX','Ridurre il volume mantenendo richiami distinti di forza, endurance e MetCon.'),
    phase(0,'race-week','Race week ATHX','Arrivare fresco ai tre workout: nessuna simulazione completa o test massimale tardivo.')
  ];
  const athxTolerance=[
    'Forza, Endurance e MetCon X hanno controlli separati: il buon esito di una zona non autorizza a far crescere automaticamente le altre.',
    'I lift di gara vengono preparati con tecnica stabile e riserva; 1RM/3RM/5RM non vengono ritestati ogni settimana.',
    'La densità MetCon cresce soltanto con standard conservati, RPE compatibile, dolore basso e recupero sufficiente prima del successivo stimolo chiave.',
    'I cambi run/row progrediscono su distanza, ritmo o durata, non su tutte e tre le variabili nella stessa decisione.',
    'Una prova combinata tra zone richiede precedenti blocchi singoli tollerati e non diventa mai una simulazione automatica delle 2,5 ore.',
    'Per i Pairs, strategia e cambi vengono allenati insieme quando possibile; il volume totale della coppia non diventa volume obbligatorio per ciascun atleta.'
  ];
  const athxLimits=[
    'Non risultano studi di intervento specifici ATHX: il pack combina formato ufficiale e studi primari sul functional fitness, mantenendo la prescrizione contestuale.',
    'Gli studi sul functional fitness hanno campioni piccoli e workout differenti; associazioni con forza, potenza o VO₂max non dimostrano una dose ottimale universale.',
    'I workout ATHX cambiano tra stagioni: il riferimento 2026 deve essere ricontrollato per l’anno e la sede della gara selezionata.',
    'Le pause ufficiali tra le zone non autorizzano a concentrare abitualmente tre test massimali nella stessa seduta.',
    'Nessuna simulazione completa di Strength + Endurance + MetCon X viene generata automaticamente; eventuali rehearsal restano frazionati e confermati.'
  ];
  function athxOverlay(profile,definition){
    const pairs=definition.mode==='pairs',pro=definition.division==='Pro',lite=definition.division==='Lite';
    const divisionDetail=pro
      ?'La divisione Pro usa i segmenti run/row da 1.000 m e i carichi, le altezze e le modalità MetCon più impegnativi.'
      :lite
        ?'La divisione Lite usa segmenti running da 500 m e movimenti o carichi scalati quando dichiarati dal workout ufficiale.'
        :'La divisione ATHX usa segmenti run/row da 750 m e gli standard regular del workout ufficiale.';
    return{
      mode:definition.mode,division:definition.division,runSegmentM:definition.runSegmentM,label:definition.label,
      detail:`${divisionDetail} ${pairs?'Nel Pairs i punteggi sono di coppia: endurance alternata e MetCon condiviso richiedono una strategia di cambi esplicita.':'Nell’Individual tutti i punteggi derivano dal lavoro del singolo atleta.'}`,
      strengthProtocol:['1RM Strict Press','3RM Back Squat','5RM Deadlift'],
      metconMovements:['SkiErg','DB Ground to Overhead','Sandbag Carry','Box Over','Walking Lunge','Burpee Broad Jump'],
      formatCaution:definition.formatCaution||'',
      season:'2026'
    };
  }
  function athxSessions(definition,overlay){
    return[
      session('easy','Aerobico facile di supporto','easy',['base','build','specific-build','specific','taper','race-week'],'Sostiene recupero e capacità aerobica senza trasformarsi in una seconda prova Endurance.'),
      session('strength-zone','Strict Press, Back Squat e Deadlift','strength',['base','build','specific-build','specific','taper'],'I lift ufficiali 2026 vengono allenati con tecnica e riserva; i test massimali sono pianificati, non settimanali.'),
      session('endurance-zone',`Endurance run/row · cambi ogni ${definition.runSegmentM} m`,'athx',['base','build','specific-build','specific','taper'],'Pacing e transizioni sono specifici della divisione; durata, ritmo e densità progrediscono separatamente.'),
      session('metcon-zone','MetCon X · tecnica e densità','athx',['base','build','specific-build','specific','taper'],'I movimenti ufficiali vengono preparati prima in qualità e poi in blocchi più densi, senza continui test for-time.'),
      session('zone-strategy',overlay.mode==='pairs'?'Strategia Pairs e cambi':'Pacing, refuel e recovery tra zone','athx',['specific-build','specific','taper'],overlay.mode==='pairs'?'La distribuzione del lavoro viene provata senza attribuire a ogni atleta il volume totale della coppia.':'Le finestre ufficiali vengono usate per preparare routine ripetibili, non per giustificare tre test massimali abituali.'),
      session('quality','Qualità running / row di supporto','quality',['build','specific-build','specific'],'Massimo un secondo stimolo metabolico principale, separato dal MetCon più costoso.')
    ];
  }
  function athxConstraint(definition,phaseKey,overlay){
    const raceWeek=phaseKey==='race-week',taper=phaseKey==='taper',late=['specific','taper','race-week'].includes(phaseKey);
    const specificMode=raceWeek?'primer':taper?'primer':phaseKey==='specific'?'race-specific':phaseKey==='base'?'foundation':'specific';
    const maxSpecific=raceWeek||taper?1:2,minStrengthRir=raceWeek?4:late?3:2;
    return{
      summary:{
        base:'Forza, capacità aerobica e tecnica dei movimenti vengono costruite come qualità distinte, senza simulare l’intera giornata gara.',
        build:'Strength, Endurance e MetCon X progrediscono senza concentrare nello stesso giorno tutti gli stimoli ad alto costo.',
        'specific-build':`I cambi run/row da ${definition.runSegmentM} m e i movimenti MetCon entrano in blocchi specifici; la forza conserva priorità tecnica.`,
        specific:`La strategia ${overlay.mode==='pairs'?'Pairs':'Individual'} e il pacing tra zone diventano prioritari, mantenendo separati test massimali e MetCon più duro.`,
        taper:'Il volume cala; brevi richiami di lift, run/row e movimenti mantengono precisione senza fatica residua.',
        'race-week':'Freschezza per Strength, Endurance e MetCon X: nessun massimale, for-time completo o recupero di lavoro perso.'
      }[phaseKey]||`Vincoli specifici per ${definition.label}.`,
      limits:{
        longProgressionCap:1,aerobicProgressionCap:raceWeek||taper?1:1.05,maxQuality:1,maxAthxSpecific:maxSpecific,
        minStrengthRir,minStrengthSetReduction:late?1:0,maxActiveSessions:raceWeek?4:taper?5:6,
        hyroxMode:'optional',athxMode:specificMode
      },
      generated:{longFactor:1,qualityStyle:raceWeek||taper?'recall':'normal'},
      guards:[
        guard('athx-strength','Strength Zone',raceWeek?'Solo primer tecnico':late?`Mantenimento · RIR ${minStrengthRir}`:'Sviluppo dei lift','Strict Press, Back Squat e Deadlift restano tecnicamente precisi; i test 1/3/5RM non sono settimanali.',late?'warn':'good'),
        guard('athx-endurance','Endurance run/row',raceWeek?'Attivazione breve':phaseKey==='specific'?'Specifico divisione':'Progressione controllata',`Cambi ogni ${definition.runSegmentM} m; aumenta una sola variabile tra durata, ritmo e densità.`),
        guard('athx-metcon','MetCon X',raceWeek?'Tecnica facile':taper?'Primer':phaseKey==='specific'?'Priorità specifica':'Tecnica + capacità','EMOM e blocchi controllati precedono i for-time; nessuna simulazione completa automatica.',phaseKey==='specific'?'good':late?'warn':'neutral'),
        guard('quality','Seconda qualità',raceWeek?'Esclusa':'Massimo 1 stimolo','Non viene sommata automaticamente al MetCon più costoso.'),
        guard('recovery','Tra le zone',overlay.mode==='pairs'?'Routine + strategia partner':'Routine individuale','Refuel, recupero e pacing vengono provati in modo ripetibile senza replicare ogni settimana le 2,5 ore.')
      ],
      priorities:{race:130,athx:120,metcon:118,'strength-lower':110,'strength-upper':108,quality:90,easy:82,cycling:50,long:40,hyrox:32,obstacle:30,recovery:12,other:30}
    };
  }

  const triathlonDefinitions={
    'triathlon-sprint':{label:'Triathlon Sprint',swimKm:.75,bikeKm:20,runKm:5,longCourse:false,qualityPriority:110,bikePriority:108,runPriority:106},
    'triathlon-standard':{label:'Triathlon Standard / Olimpico',swimKm:1.5,bikeKm:40,runKm:10,longCourse:false,qualityPriority:106,bikePriority:110,runPriority:108},
    'ironman-70-3':{label:'IRONMAN 70.3',swimKm:1.9,bikeKm:90,runKm:21.1,longCourse:true,qualityPriority:88,bikePriority:116,runPriority:110},
    'ironman-full':{label:'IRONMAN Full',swimKm:3.8,bikeKm:180,runKm:42.2,longCourse:true,qualityPriority:76,bikePriority:120,runPriority:114}
  };
  function triathlonPhases(definition){
    const full=definition.runKm>40,long=definition.longCourse;
    return[
      phase(full?224:long?168:84,'base',`Base ${definition.label}`,'Costruire frequenza sostenibile nelle tre discipline, efficienza in acqua e tolleranza al carico senza brick prematuri.'),
      phase(full?154:long?112:56,'build',`Costruzione ${definition.label}`,'Sviluppare separatamente nuoto, bici e corsa prima di aumentare la specificità delle transizioni.'),
      ...(long?[phase(full?98:70,'specific-build',`Sviluppo specifico ${definition.label}`,'Integrare pacing, durata, brick controllati e fueling mantenendo distinti i carichi delle tre discipline.')]:[]),
      phase(full?49:long?35:15,'specific',`Specifico ${definition.label}`,'Rendere stabili transizioni, pacing e gestione dello sforzo senza simulazioni complete automatiche.'),
      ...(long?[phase(full?29:22,'peak',`Picco specifico ${definition.label}`,'Completare gli ultimi stimoli chiave senza nuovi picchi tardivi di durata o impatto.')]:[]),
      phase(full?18:long?15:8,'taper',`Taper ${definition.label}`,'Ridurre il volume conservando brevi richiami nelle tre discipline e routine di transizione.'),
      phase(0,'race-week',`Race week ${definition.label}`,'Proteggere freschezza, attrezzatura e piano di esecuzione; nessun lavoro perso viene recuperato.')
    ];
  }
  const triathlonTolerance=[
    'Nuoto, bici, corsa e brick hanno controlli di tolleranza separati: un buon esito in una disciplina non autorizza la progressione automatica delle altre.',
    'Il volume di corsa cresce soltanto dopo esiti, dolore, RPE e impatto compatibili; il basso impatto della bici non dimostra tolleranza meccanica alla corsa.',
    'Il nuoto progredisce su tecnica, continuità o volume, non su tutte le variabili insieme; CSS e passo vengono usati solo dopo un test reale registrato.',
    'Il brick cresce dopo sedute singole tollerate e resta frazionato: durata della bici e corsa successiva non aumentano automaticamente insieme.',
    'Per 70.3 e Full, pacing e fueling vengono provati nei lavori adatti e non introdotti per la prima volta in gara.',
    'WHOOP e frequenza cardiaca sostengono il contesto, ma non sostituiscono competenza tecnica in acqua, esiti e carico per disciplina.'
  ];
  const triathlonLimits=[
    'Il formato è verificato su fonti ufficiali; la dose resta contestuale perché corso, dislivello, drafting, temperatura dell’acqua e regole locali dipendono dall’evento.',
    'La letteratura disponibile non definisce una ripartizione universale ottimale tra nuoto, bici e corsa per ogni atleta e distanza.',
    'Nessuna simulazione completa di gara viene generata automaticamente, soprattutto per 70.3 e Full.',
    'Open water, muta, partenza di gruppo, orientamento e transizioni richiedono contesto reale e condizioni sicure; non vengono sostituiti da una prescrizione generica.',
    'Con meno di tre sedute settimanali non è possibile coprire stabilmente le tre discipline; per 70.3 e Full una disponibilità ridotta abbassa esplicitamente la confidenza.'
  ];
  function triathlonOverlay(definition){
    return{
      label:definition.label,longCourse:definition.longCourse,
      swimKm:definition.swimKm,bikeKm:definition.bikeKm,runKm:definition.runKm,
      detail:`${String(definition.swimKm).replace('.',',')} km nuoto · ${definition.bikeKm} km bici · ${String(definition.runKm).replace('.',',')} km corsa.`,
      ruleCaution:'Drafting, muta, cut-off, percorso e regolamento della singola gara devono essere confermati dalla guida atleta dell’evento.'
    };
  }
  function triathlonSessions(definition){
    const long=definition.longCourse;
    return[
      session('swim-technique','Nuoto · tecnica ed efficienza','tri-swim',['base','build','specific-build','specific','taper','race-week'],'Tecnica, assetto e respirazione precedono la densità; nessun passo viene inventato senza test reale.'),
      session('swim-endurance',long?'Nuoto · continuità e open-water skills':'Nuoto · aerobico / ritmo controllato','tri-swim',['build','specific-build','specific','peak','taper'],'Continuità e abilità specifiche progrediscono in ambiente sicuro e con riscontro tecnico.'),
      session('bike',long?'Bici · endurance, pacing e fueling':'Bici · qualità specifica','tri-bike',['base','build','specific-build','specific','peak','taper','race-week'],'La bici viene prescritta su FTP/RPE osservati e sul profilo reale del percorso, senza intensità nascosta.'),
      session('run',long?'Corsa · endurance su fatica controllata':'Corsa · ritmo specifico','tri-run',['base','build','specific-build','specific','peak','taper','race-week'],'Il carico di corsa conserva un controllo meccanico distinto dalla bici.'),
      session('brick','Brick bici-corsa e transizioni','tri-brick',['build','specific-build','specific','peak','taper'],'Blocchi controllati per pacing e T2; non sono simulazioni complete automatiche.'),
      session('strength','Forza di supporto','strength',['base','build','specific-build','specific','peak','taper'],'Forza e controllo neuromuscolare restano subordinati agli stimoli chiave nelle tre discipline.'),
      ...(long?[session('fueling','Fueling e piano di esecuzione','fueling',['specific-build','specific','peak'],'Strategia verificata in allenamento e adattata a durata, clima e tolleranza individuale.')]:[])
    ];
  }
  function triathlonConstraint(definition,phaseKey,overlay){
    const raceWeek=phaseKey==='race-week',taper=phaseKey==='taper',peak=phaseKey==='peak',late=['specific','peak','taper','race-week'].includes(phaseKey);
    const mode=raceWeek?'primer':taper?'primer':phaseKey==='specific'||peak?'race-specific':phaseKey==='base'?'foundation':'specific';
    const maxBrick=raceWeek?0:1,minStrengthRir=raceWeek?4:late?3:2;
    return{
      summary:{
        base:'Le tre discipline costruiscono frequenza e competenza separatamente; tecnica in acqua e continuità vengono prima dei brick.',
        build:'Nuoto, bici e corsa progrediscono con carichi distinti; entra un solo brick controllato quando le sedute singole sono tollerate.',
        'specific-build':'Durata, pacing, transizioni e fueling diventano più specifici senza far crescere insieme tutte le discipline.',
        specific:`Pacing e transizioni ${definition.label} hanno priorità; nessuna simulazione completa sostituisce la qualità delle singole discipline.`,
        peak:'Gli ultimi stimoli chiave vengono completati senza nuovi picchi tardivi di durata, impatto o densità.',
        taper:'Il volume cala nelle tre discipline; restano richiami brevi, transizioni e routine già provate.',
        'race-week':'Freschezza, attrezzatura e piano gara sono intoccabili: solo attivazioni brevi e nessun brick aggiuntivo.'
      }[phaseKey]||`Vincoli specifici per ${definition.label}.`,
      limits:{
        longProgressionCap:['peak','taper','race-week'].includes(phaseKey)?1:1.05,
        aerobicProgressionCap:['peak','taper','race-week'].includes(phaseKey)?1:1.05,
        swimProgressionCap:['peak','taper','race-week'].includes(phaseKey)?1:1.05,
        bikeProgressionCap:['peak','taper','race-week'].includes(phaseKey)?1:1.05,
        runProgressionCap:['peak','taper','race-week'].includes(phaseKey)?1:1.05,
        maxQuality:definition.longCourse?1:2,maxTriBrick:maxBrick,minStrengthRir,minStrengthSetReduction:late?1:0,
        maxActiveSessions:raceWeek?4:taper?5:6,hyroxMode:'optional',triathlonMode:mode
      },
      generated:{longFactor:raceWeek?0.45:taper?0.7:peak?0.9:1,qualityStyle:raceWeek||taper?'recall':definition.longCourse?'tri-endurance':'tri-short'},
      guards:[
        guard('tri-swim','Nuoto',raceWeek?'Attivazione breve':phaseKey==='base'?'Tecnica + continuità':'Tecnica + specificità','Nessun CSS o passo viene stimato senza test; open water e muta richiedono condizioni reali e sicure.','good'),
        guard('tri-bike','Bici',raceWeek?'Attivazione breve':definition.longCourse?'Pacing prioritario':'Qualità specifica','FTP, RPE e stabilità della potenza sono riferimenti distinti; terreno e drafting dipendono dalla gara.'),
        guard('tri-run','Corsa',raceWeek?'Shake-out':definition.longCourse?'Tolleranza + pacing':'Ritmo specifico','Il carico meccanico viene autorizzato dagli esiti running, non dal solo volume ciclistico.'),
        guard('tri-brick','Brick',raceWeek?'Escluso':taper?'Primer breve':'Massimo 1',raceWeek?'Nessun brick aggiuntivo nella settimana gara.':'Bici e corsa vengono combinate in dose controllata; nessuna simulazione completa automatica.',late?'warn':'neutral'),
        guard('strength','Forza',late?`Mantenimento · RIR ${minStrengthRir}`:'Sviluppo compatibile','Il volume di forza cede prima degli stimoli specifici nelle tre discipline.')
      ],
      priorities:{race:130,'tri-bike':definition.bikePriority,'tri-run':definition.runPriority,'tri-swim':112,'tri-brick':114,cycling:definition.bikePriority,running:definition.runPriority,quality:definition.qualityPriority,long:definition.runPriority-5,'strength-upper':70,'strength-lower':68,easy:74,hyrox:28,metcon:26,recovery:12,other:30}
    };
  }

  function packFor(goal={}){
    const profile=eventDemand?.profileFor?.(goal);
    if(!profile)return null;
    const running=runningDefinitions[profile.key];
    if(running){
      return{
        version:VERSION,key:profile.key,family:'running',label:`Pack ${running.label}`,status:'active',confidence:'supported',
        evidenceVersion:`running-${VERSION}`,distanceKm:running.distanceKm,phases:clone(running.phases),
        keySessions:runningSessions(running),toleranceChecks:clone(runningTolerance),limits:clone(runningLimits),
        sources:sourceList(['distancePractice','distancePeriodization','enduranceTaper','runningStrength','concurrentRunning']),
        guardrail:'Il pack definisce ruoli e confini; la dose concreta deriva da storico, disponibilità, esiti, sintomi e fase, con modifica sempre esplicita.',
        definition:clone(running)
      };
    }
    if(profile.variant?.family==='hyrox'||profile.key==='hyrox'){
      const overlay=hyroxOverlay(profile),pending=overlay.mode==='adaptive'||profile.programmingStatus==='pending';
      return{
        version:VERSION,key:profile.key,family:'hyrox',label:`Pack HYROX ${overlay.label}`,status:pending?'pending':'contextual',
        confidence:pending?'pending':'contextual',evidenceVersion:`hyrox-${VERSION}`,phases:clone(hyroxPhases),
        keySessions:hyroxSessions(overlay),toleranceChecks:clone(hyroxTolerance),limits:clone(hyroxLimits),
        sources:sourceList(['hyroxPhysiology','hyroxNorms','hyroxRules','concurrentRunning','enduranceTaper']),
        overlay,
        guardrail:pending
          ?'Il formato Adaptive resta descrittivo finché classificazione e standard dell’evento non sono confermati; il Coach non genera una dose specifica.'
          :'La prescrizione è contestuale: formato e carichi sono ufficiali, mentre dose e progressione vengono validate sulla risposta individuale.',
        definition:null
      };
    }
    const obstacle=obstacleDefinitions[profile.key];
    if(obstacle){
      const overlay=obstacleOverlay(profile);
      return{
        version:VERSION,key:profile.key,family:'obstacle',label:`Pack ${obstacle.label}`,status:'contextual',confidence:'contextual',
        evidenceVersion:`obstacle-${VERSION}`,distanceKm:obstacle.distanceKm,phases:obstaclePhases(obstacle),
        keySessions:obstacleSessions(obstacle),toleranceChecks:clone(obstacleTolerance),limits:clone(obstacleLimits),
        sources:sourceList(['spartanFormat','spartanObstacles','ocrPhysiology','ocrDeterminants','ocrExtreme','ocrInjuries','concurrentRunning','enduranceTaper']),
        overlay,definition:clone(obstacle),
        guardrail:'Il formato è ufficiale; la prescrizione resta contestuale perché l’evidenza OCR diretta è limitata e terreno, ostacoli e condizioni cambiano tra eventi.'
      };
    }
    const triathlon=triathlonDefinitions[profile.key];
    if(triathlon){
      const overlay=triathlonOverlay(triathlon);
      return{
        version:VERSION,key:profile.key,family:'triathlon',label:`Pack ${triathlon.label}`,status:'contextual',confidence:'contextual',
        evidenceVersion:`triathlon-${VERSION}`,phases:triathlonPhases(triathlon),keySessions:triathlonSessions(triathlon),
        toleranceChecks:clone(triathlonTolerance),limits:clone(triathlonLimits),
        sources:sourceList(['worldTriathlonFormat','worldTriathlonRules','ironmanRules','triSprintTransition','triTransitionReview','triVariableCycling','triOpenWater','triPoolTest','triFueling','triLongCourse','triInjury','concurrentRunning','enduranceTaper']),
        overlay,definition:clone(triathlon),
        guardrail:`La prescrizione è contestuale: distanze e struttura sono ufficiali, mentre dose, progressione e ripartizione tra discipline dipendono dallo storico individuale. ${overlay.ruleCaution}`
      };
    }
    const athx=athxDefinitions[profile.key];
    if(athx){
      const overlay=athxOverlay(profile,athx);
      return{
        version:VERSION,key:profile.key,family:'athx',label:`Pack ${athx.label}`,status:'contextual',confidence:'contextual',
        evidenceVersion:`athx-${VERSION}`,phases:clone(athxPhases),keySessions:athxSessions(athx,overlay),
        toleranceChecks:clone(athxTolerance),limits:clone(athxLimits),
        sources:sourceList(['athxFormat','athxWorkouts2026','athxStandards2026','hiftDeterminants','hiftBenchmarks','hiftResponses','hiftTimeDomains','concurrentRunning','enduranceTaper']),
        overlay,definition:clone(athx),
        guardrail:`Il formato 2026 è ufficiale; la prescrizione resta contestuale perché non esistono ancora studi di intervento specifici ATHX. ${overlay.formatCaution}`.trim()
      };
    }
    return{
      version:VERSION,key:profile.key,family:profile.variant?.family||profile.key,label:'Pack da revisionare',status:'pending',confidence:'pending',
      evidenceVersion:null,phases:[],keySessions:[],toleranceChecks:[],limits:['Il formato non possiede ancora un pack prescrittivo revisionato.'],sources:[],
      guardrail:'Il Coach conserva soltanto il profilo delle richieste e non presenta regole generiche come specifiche dell’evento.'
    };
  }

  function phaseFor(goal,today){
    const pack=packFor(goal);if(!pack?.phases?.length||!goal?.date||!today)return null;
    const days=Math.max(0,daysBetween(today,goal.date));
    const selected=pack.phases.find(item=>days>=item.min)||pack.phases.at(-1);
    return{...clone(selected),days,pack:{key:pack.key,version:pack.version,status:pack.status,confidence:pack.confidence}};
  }
  function constraintFor(goal,phaseKey){
    const pack=packFor(goal);if(!pack)return null;
    if(pack.family==='running'&&pack.definition)return{...runningConstraint(pack.definition,phaseKey),pack:{key:pack.key,version:pack.version,status:pack.status,confidence:pack.confidence}};
    if(pack.family==='hyrox'&&pack.overlay)return{...hyroxConstraint(phaseKey,pack.overlay),pack:{key:pack.key,version:pack.version,status:pack.status,confidence:pack.confidence,overlay:clone(pack.overlay)}};
    if(pack.family==='obstacle'&&pack.definition)return{...obstacleConstraint(pack.definition,phaseKey),pack:{key:pack.key,version:pack.version,status:pack.status,confidence:pack.confidence,overlay:clone(pack.overlay)}};
    if(pack.family==='triathlon'&&pack.definition)return{...triathlonConstraint(pack.definition,phaseKey,pack.overlay),pack:{key:pack.key,version:pack.version,status:pack.status,confidence:pack.confidence,overlay:clone(pack.overlay)}};
    if(pack.family==='athx'&&pack.definition)return{...athxConstraint(pack.definition,phaseKey,pack.overlay),pack:{key:pack.key,version:pack.version,status:pack.status,confidence:pack.confidence,overlay:clone(pack.overlay)}};
    return null;
  }
  function keySessionsFor(goal,phaseKey){
    const pack=packFor(goal);if(!pack)return[];
    return clone(pack.keySessions.filter(item=>!phaseKey||item.phases.includes(phaseKey)));
  }
  function distanceFor(goal){
    const pack=packFor(goal);return Number(pack?.distanceKm)||Number(eventDemand?.variantFor?.(goal)?.distanceKm)||null;
  }

  return{VERSION,sources,packFor,phaseFor,constraintFor,keySessionsFor,distanceFor,daysBetween};
});
