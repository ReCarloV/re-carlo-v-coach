(function(root,factory){
  const eventDemand=typeof module!=='undefined'&&module.exports?require('./event-demand-model.js'):root?.rcEventDemandModel;
  const api=factory(eventDemand);
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.rcEventProgrammingModel=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(eventDemand){
  'use strict';

  const VERSION='1.0.0';
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
      appliesTo:['running','hyrox']
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
