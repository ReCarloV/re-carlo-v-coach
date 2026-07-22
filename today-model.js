(function (root, factory) {
  const symptomModel=typeof module!=='undefined'&&module.exports?require('./symptom-recency-model.js'):root.rcSymptomRecencyModel;
  const skipReasonModel=typeof module!=='undefined'&&module.exports?require('./skip-reason-model.js'):root.rcSkipReasonModel;
  const recoveryModel=typeof module!=='undefined'&&module.exports?require('./recovery-trend-model.js'):root.rcRecoveryTrendModel;
  const freshnessModel=typeof module!=='undefined'&&module.exports?require('./device-freshness-model.js'):root.rcDeviceFreshnessModel;
  const applicationModel=typeof module!=='undefined'&&module.exports?require('./adaptive-application-model.js'):root.rcAdaptiveApplicationModel;
  const api = factory(symptomModel,skipReasonModel,recoveryModel,freshnessModel,applicationModel);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.rcTodayModel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (symptomModel,skipReasonModel,recoveryModel,freshnessModel,applicationModel) {
  'use strict';

  const categoryMeta = {
    running:{label:'CORSA',css:'run'},swimming:{label:'NUOTO',css:'swim'},cycling:{label:'BICI',css:'bike'},strength:{label:'FORZA',css:'strength'},
    hyrox:{label:'HYROX SPEC',css:'hyrox'},metcon:{label:'METCON',css:'metcon'},test:{label:'TEST',css:'test'},recovery:{label:'RECUPERO',css:'rest'}
  };
  const priorityRank = {essential:0,important:1,optional:2};
  const priorityLabel = {essential:'Essenziale',important:'Importante',optional:'Opzionale'};
  const outcomeLabel = {completed:'Svolta',partial:'Parziale',skipped:'Non svolta'};
  const recommendationMeta = {
    proceed:{value:'Confermata',tone:'good'},reduce:{value:'Da adattare',tone:'warn'},replace:{value:'Da sostituire',tone:'danger'}
  };
  const adaptiveMeta = {
    protect:{title:'Protezione del recupero',tone:'danger'},
    reduce:{title:'Carico ridotto',tone:'warn'},
    steady:{title:'Carico mantenuto',tone:'neutral'},
    progress:{title:'Progressione controllata',tone:'good'}
  };
  const confidenceLabels={low:'Bassa',medium:'Media',high:'Alta'};

  function iso(date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
  function dateAtNoon(value) { return new Date(`${value}T12:00:00`); }
  function addDays(value,days) { const date=dateAtNoon(value);date.setDate(date.getDate()+days);return iso(date); }
  function mondayFor(value) { const date=dateAtNoon(value);const day=date.getDay()||7;date.setDate(date.getDate()-day+1);return iso(date); }
  function timestampDate(value) { const date=new Date(value);return Number.isNaN(date.getTime())?null:iso(date); }
  function performed(session) { return ['completed','partial'].includes(session.outcome?.status); }
  function paused(session) { return session.adaptiveAdjustment?.status==='paused'&&!session.outcome; }
  function number(value) { const parsed=Number(value);return Number.isFinite(parsed)?parsed:0; }
  function reductionLabel(factor,label){const reduction=Math.round((1-Number(factor||1))*100);return reduction>0?`${label} −${reduction}%`:null;}
  function impactFor(settings={}){
    const parts=[];const sessionDelta=Number(settings.sessionDelta)||0;
    if(sessionDelta<0)parts.push(`${Math.abs(sessionDelta)} seduta in meno`);
    const volume=reductionLabel(settings.volumeFactor,'volume');if(volume)parts.push(volume);
    const long=reductionLabel(settings.longFactor,'lungo');if(long)parts.push(long);
    if(settings.qualityMode==='controlled')parts.push('qualità controllata');
    if(Number(settings.strengthRir)>2)parts.push(`forza RIR ${Number(settings.strengthRir)}`);
    if(Number(settings.longFactor)>1)parts.push(`lungo +${Math.round((Number(settings.longFactor)-1)*100)}%`);
    return parts.length?{label:'Se confermi la proposta',detail:parts.join(' · ')}:{label:'Piano invariato',detail:'Nessuna seduta viene modificata senza una tua conferma esplicita.'};
  }
  function ringTone(progress){return progress>66?'good':progress>=33?'warn':'danger';}
  function ringMetric(id,label,value,max,suffix){
    const parsed=value===null||value===undefined||value===''?null:Number(value);if(!Number.isFinite(parsed))return{id,label,value:null,display:'—',progress:0,tone:'neutral',available:false};const progress=Math.max(0,Math.min(100,parsed/max*100));const display=id==='strain'?`${parsed.toLocaleString('it-IT',{maximumFractionDigits:1})}/21`:`${Math.round(parsed)}${suffix}`;return{id,label,value:parsed,display,progress:Math.round(progress),tone:ringTone(progress),available:true};
  }
  function buildWhoopOverview(input={}){
    const today=input.today||iso(new Date());const freshness=freshnessModel?freshnessModel.analyzeDeviceFreshness({today,whoopCycles:input.whoopCycles,whoopSleeps:input.whoopSleeps,whoopImportBatches:input.whoopImportBatches}):{whoop:{showOnDashboard:false}};const days=recoveryModel?.mergedDays?.(input.whoopCycles,input.whoopSleeps,today)||[];const latest=days.at(-1)||null;const rings=latest?[ringMetric('recovery','Recovery',latest.recoveryScore,100,'%'),ringMetric('sleep','Sonno',latest.sleepPerformancePct,100,'%'),ringMetric('strain','Strain',latest.dayStrain,21,'')]:[];
    return{visible:Boolean(freshness.whoop.showOnDashboard&&latest&&rings.some(item=>item.available)),date:latest?.date||null,freshness:freshness.whoop,rings};
  }
  function whoopInfluence(recovery={}){
    const hasScore=recovery.avgRecovery!==null&&recovery.avgRecovery!==undefined&&recovery.avgRecovery!==''&&Number.isFinite(Number(recovery.avgRecovery));
    const score=hasScore?` · media ${Math.round(Number(recovery.avgRecovery))}%`:'';
    if(recovery.level==='stable')return{label:`Segnale stabile${score}`,detail:'WHOOP non richiede correzioni e non autorizza da solo un aumento del carico.',tone:'good'};
    if(recovery.level==='caution')return{label:`Segnale di cautela${score}`,detail:'Blocca una progressione; riduce la settimana solo se coincide con altri segnali.',tone:'warn'};
    if(recovery.level==='protect')return{label:`Segnale da proteggere${score}`,detail:'Se isolato propone una riduzione. La protezione più forte richiede conferma da esiti, check-in o fastidi.',tone:'danger'};
    if(recovery.level==='stale')return{label:'Dato da aggiornare',detail:'La lettura resta visibile, ma non modifica la programmazione.',tone:'warn'};
    if(recovery.level==='insufficient')return{label:'Baseline ancora breve',detail:'WHOOP viene mostrato, ma non modifica il carico finché la baseline non è sufficiente.',tone:'neutral'};
    return{label:'Non disponibile',detail:'Nessun valore WHOOP viene inventato o usato nella decisione.',tone:'neutral'};
  }
  function buildAdaptiveCoach(analysis={},application={applied:false,stale:false,application:null}){
    const level=adaptiveMeta[analysis?.level]?analysis.level:'steady';const meta=adaptiveMeta[level];const confidence=confidenceLabels[analysis?.confidence]||confidenceLabels.low;const whoop=whoopInfluence(analysis?.recovery||{});const impact=impactFor(analysis?.settings||{});const reasons=Array.isArray(analysis?.reasons)?analysis.reasons.filter(Boolean).slice(0,3):[];const reviewRequired=Boolean(application.reviewRequired),reviewTrigger=application.reviewTrigger||null;
    const decisionTitle=analysis?.label||meta.title;if(application.applied){return{level:'applied',tone:'good',title:'Piano aggiornato',decisionTitle,kicker:'DECISIONE LIVE · APPLICATA',statusLabel:'✓ APPLICATA',summary:`La proposta “${decisionTitle}” è già stata applicata alla settimana corrente.`,confidence,whoop,impact:{label:'Applicato al piano',detail:impact.label==='Piano invariato'?'La struttura è stata confermata senza correzioni.':impact.detail},reasons,applied:true,stale:false,appliedAt:application.application?.appliedAt||null};}
    const reviewSummary=reviewRequired?`Hai registrato “${reviewTrigger?.title||'una seduta chiave'}”. Il Coach ha ricalcolato i segnali e deve confrontare la decisione con ${application.remainingCount||0} sedut${application.remainingCount===1?'a':'e'} ancora apert${application.remainingCount===1?'a':'e'} prima di confermare il resto del microciclo.`:null;
    return{level,tone:reviewRequired?'warn':meta.tone,title:reviewRequired?'Rivalutazione del microciclo':decisionTitle,decisionTitle,kicker:reviewRequired?'MICROCICLO · DA RIVEDERE':application.stale?'DECISIONE LIVE · DA RIVEDERE':'DECISIONE LIVE · SOLO ANTEPRIMA',statusLabel:reviewRequired?'SEDUTA CHIAVE REGISTRATA':`AFFIDABILITÀ ${confidence.toUpperCase()}`,summary:reviewSummary||(application.stale?`${analysis?.summary||'La decisione corrente è cambiata.'} I dati sono cambiati dopo l’ultima applicazione: rivedi l’anteprima prima di aggiornare di nuovo il piano.`:analysis?.summary||'Dati recenti ancora limitati: il coach mantiene una proposta prudente e modificabile.'),confidence,whoop,impact,reasons,applied:false,stale:Boolean(application.stale),reviewRequired,reviewTrigger,appliedAt:null};
  }
  function activeIssues(items,today) {
    return (Array.isArray(items)?items:[]).filter(issue=>issue.status!=='resolved').map(issue=>symptomModel?symptomModel.decorate(issue,today):{...issue,latestPain:Number(issue.latestPain??issue.initialPain)||0,isFresh:true,requiresUpdate:false}).sort((a,b)=>Number(b.isFresh)-Number(a.isFresh)||(Number(b.latestPain)||0)-(Number(a.latestPain)||0));
  }
  function issueRegion(issue){const zone=String(issue?.zone||''),label=String(issue?.zoneLabel||'');if(/^(hip|quad|knee|ankle|glute|hamstring|calf)(-|$)/.test(zone)||/(anca|quadricipite|ginocchio|caviglia|gluteo|femorale|polpaccio)/i.test(label))return 'lower';if(/^(shoulder|elbow|wrist)(-|$)/.test(zone)||/(spalla|gomito|polso)/i.test(label))return 'upper';if(/^(chest|upper-back|lower-back|neck)(-|$)/.test(zone)||/(petto|dorso|schiena|lombare|collo)/i.test(label))return 'trunk';if(/^head(?:-|$)/.test(zone)||/testa/i.test(label))return 'head';return 'unknown';}
  function regionsForSession(session){if(!session)return new Set(['lower','upper','trunk','head','unknown']);if(['running','cycling'].includes(session.category))return new Set(['lower','trunk','head','unknown']);if(session.category==='swimming')return new Set(['upper','trunk','head','unknown']);if(session.category==='strength'){const focus=String(session.details?.strengthFocus||'').toLowerCase();if(/upper/.test(focus))return new Set(['upper','trunk','head','unknown']);if(/lower/.test(focus))return new Set(['lower','trunk','head','unknown']);}return new Set(['lower','upper','trunk','head','unknown']);}
  function sessionSubtype(session) {
    const details=session.details||{};
    return {running:details.runType,swimming:details.swimType,cycling:details.rideType,strength:details.strengthFocus,hyrox:details.hyroxFormat,metcon:details.metconType,test:details.testType,recovery:details.recoveryType}[session.category]||'';
  }
  function sessionTag(session) {
    const meta=categoryMeta[session.category]||{label:String(session.category||'SEDUTA').toUpperCase(),css:'rest'};
    return {label:[meta.label,sessionSubtype(session)].filter(Boolean).join(' · '),css:meta.css};
  }
  function formatSegment(segment) {
    const amount=number(segment.amount); const unit={min:"'",km:' km',m:' m'}[segment.unit]||` ${segment.unit||''}`;
    const quantity=amount?`${amount}${unit}`.trim():'Durata libera';
    return [quantity,segment.target||'libero',segment.paceHint].filter(Boolean).join(' · ');
  }
  function prescriptionFor(session) {
    const details=session.details||{};
    if (session.category==='running'&&Array.isArray(details.runBlocks)&&details.runBlocks.length) {
      const phaseLabels={warmup:'Riscaldamento',work:'Lavoro',recovery:'Recupero',cooldown:'Defaticamento',free:'Corsa libera'};
      return details.runBlocks.map(item=>{
        if(item.type==='repeat')return {label:`${number(item.repeats)||1}× sequenza`,value:(item.steps||[]).map(formatSegment).join(' / ')||'Fasi da definire',intensity:item.intensity||item.steps?.[0]?.intensity||'tempo'};
        return {label:phaseLabels[item.phase]||'Blocco',value:formatSegment(item),intensity:item.intensity||'easy'};
      });
    }
    if(session.category==='running') {
      const target=details.runTarget==='pace'&&Number.isFinite(Number(details.paceMin))
        ? `${number(details.paceMin)}:${String(number(details.paceSec)).padStart(2,'0')}/km`
        : details.runTarget==='rpe'&&details.runRpe ? `RPE ${details.runRpe}` : details.hrZone||'Libero';
      return [
        {label:'Durata',value:`${session.durationMin} min`},
        ...(details.distanceKm?[{label:'Distanza',value:`${details.distanceKm} km`}]:[]),
        {label:'Obiettivo',value:target}
      ];
    }
    if(session.category==='swimming'){
      const blocks=Array.isArray(details.swimStructuredBlocks)?details.swimStructuredBlocks:[];
      if(blocks.length)return blocks.map(item=>({label:item.name||'Blocco',value:[item.volume,item.target,item.rest?`rec. ${item.rest}`:''].filter(Boolean).join(' · '),intensity:/rpe\s*(7|8|9|10)|soglia|css/i.test(`${item.target||''} ${item.name||''}`)?'threshold':'easy'}));
      return[{label:'Durata',value:`${session.durationMin} min`},...(details.swimDistanceM?[{label:'Distanza',value:`${details.swimDistanceM} m`}]:[]),{label:'Obiettivo',value:[details.swimType,details.swimRpe?`RPE ${details.swimRpe}`:''].filter(Boolean).join(' · ')||'Tecnica controllata'}];
    }
    if(session.category==='cycling'&&Array.isArray(details.rideBlocks)&&details.rideBlocks.length){
      const phaseLabels={warmup:'Riscaldamento',work:'Lavoro',recovery:'Recupero',cooldown:'Defaticamento'};
      const blocks=details.rideBlocks.map(item=>item.type==='repeat'
        ?{label:`${number(item.repeats)||1}× sequenza`,value:(item.steps||[]).map(formatSegment).join(' / ')||'Fasi da definire',intensity:item.intensity||item.steps?.[0]?.intensity||'tempo'}
        :{label:phaseLabels[item.phase]||'Blocco',value:formatSegment(item),intensity:item.intensity||'easy'});
      if(details.brickRun)blocks.push({label:'T2 → corsa',value:`${details.brickRun.durationMin} min · ${details.brickRun.target||'ritmo controllato'} · ${details.brickRun.transition||'transizione ordinata'}`,intensity:'tempo'});
      return blocks;
    }
    if(session.category==='cycling'){
      const watts=number(details.ftpMin)&&number(details.ftpMax)?`${details.ftpMin}–${details.ftpMax}% FTP`:'Da definire';
      return[{label:'Durata',value:`${session.durationMin} min`},{label:'Potenza',value:watts},{label:'Cadenza',value:details.cadence?`${details.cadence} rpm`:'Da definire'}];
    }
    if(session.category==='strength') {
      if(performed(session)){
        const actual=Array.isArray(session.outcome?.strengthPerformance)?session.outcome.strengthPerformance:[];
        if(actual.length)return actual.map(item=>{
          const load=Number(item.loadKg),reps=Number(item.reps),hasRpe=item.rpe!==null&&item.rpe!==undefined&&item.rpe!=='',rpe=Number(item.rpe),external=/trazioni|weighted (?:pull|chin)/i.test(String(item.exercise||''));
          return {label:item.exercise||'Esercizio principale',value:[Number.isFinite(load)?`${external?'+':''}${load.toLocaleString('it-IT',{maximumFractionDigits:1})} kg`:null,Number.isFinite(reps)?`× ${reps}`:null,hasRpe&&Number.isFinite(rpe)?`RPE ${rpe.toLocaleString('it-IT',{maximumFractionDigits:1})}`:null].filter(Boolean).join(' · '),actual:true};
        });
        return [{label:'Set principali effettivi',value:'Nessun set principale registrato',actual:true}];
      }
      const blocks=Array.isArray(details.strengthBlocks)?details.strengthBlocks:[];
      if(blocks.length)return blocks.map(item=>({label:item.name||'Esercizio',value:[item.sets&&item.reps?`${item.sets}×${item.reps}`:'',item.target,item.rest?`rec. ${item.rest}`:''].filter(Boolean).join(' · ')}));
      const legacy=String(details.exercises||'').split('\n').map(item=>item.trim()).filter(Boolean);
      if(legacy.length)return legacy.map((item,index)=>({label:`Esercizio ${index+1}`,value:item}));
      return [{label:'Durata',value:`${session.durationMin} min`},{label:'Focus',value:details.strengthFocus||'Da definire'},{label:'Intensità',value:details.targetRir!==undefined&&details.targetRir!==''?`RIR ${details.targetRir}`:'Da definire'}];
    }
    if(['hyrox','metcon'].includes(session.category)) {
      const blocks=session.category==='hyrox'?details.hyroxStructuredBlocks:details.metconStructuredBlocks;
      if(Array.isArray(blocks)&&blocks.length)return blocks.map(item=>({label:item.name||'Blocco',value:[item.volume,item.target,item.rest?`rec. ${item.rest}`:''].filter(Boolean).join(' · ')}));
      const legacy=String(session.category==='hyrox'?details.hyroxBlocks:details.metconBlocks).split('\n').map(item=>item.trim()).filter(Boolean);
      if(legacy.length)return legacy.map((item,index)=>({label:`Blocco ${index+1}`,value:item}));
      const format=session.category==='hyrox'?details.hyroxFormat:details.metconType;const rpe=session.category==='hyrox'?details.hyroxRpe:details.metconRpe;
      return [{label:'Durata',value:`${session.durationMin} min`},{label:'Formato',value:format||'Da definire'},...(rpe?[{label:'Intensità',value:`RPE ${rpe}`}]:[])];
    }
    if(session.category==='cycling')return [
      {label:'Durata',value:`${session.durationMin} min`},
      {label:'Intensità',value:details.ftpMin&&details.ftpMax?`${details.ftpMin}–${details.ftpMax}% FTP`:'Target da definire'},
      {label:'Cadenza',value:details.cadence?`${details.cadence} rpm`:'Libera'}
    ];
    if(session.category==='test')return [{label:'Protocollo',value:details.testProtocol||details.testType||'Da definire'}];
    if(session.category==='recovery')return [{label:'Recupero',value:details.recoveryType||`${session.durationMin} min`}];
    return [{label:'Durata prevista',value:`${session.durationMin} min`}];
  }
  function sessionSummary(session) {
    const details=session.details||{}; const parts=[`${session.durationMin} min`,priorityLabel[session.priority]];
    if(session.category==='running'&&details.distanceKm)parts.splice(1,0,`${details.distanceKm} km`);
    if(session.category==='swimming'&&details.swimDistanceM)parts.splice(1,0,`${details.swimDistanceM} m`);
    if(session.category==='cycling'&&details.ftpMin&&details.ftpMax)parts.splice(1,0,`${details.ftpMin}–${details.ftpMax}% FTP`);
    if(session.outcome?.status==='skipped')return `Non svolta${session.outcome.skipReason?` · ${skipReasonModel.label(session.outcome.skipReason)}`:''}`;
    if(performed(session))return [outcomeLabel[session.outcome.status],session.outcome.actualDurationMin?`${session.outcome.actualDurationMin} min reali`:'',session.outcome.rpe?`RPE ${session.outcome.rpe}`:''].filter(Boolean).join(' · ');
    return parts.filter(Boolean).join(' · ');
  }
  function sortTodaySessions(sessions) {
    return [...sessions].sort((a,b)=>{
      const outcomeA=a.outcome?1:0,outcomeB=b.outcome?1:0;
      if(outcomeA!==outcomeB)return outcomeA-outcomeB;
      const priorityDifference=(priorityRank[a.priority]??1)-(priorityRank[b.priority]??1);
      return priorityDifference||String(a.createdAt||a.id||'').localeCompare(String(b.createdAt||b.id||''));
    });
  }
  function checkinsForToday(items,today) {
    return (Array.isArray(items)?items:[]).filter(item=>item.sessionDate===today||(!item.sessionDate&&timestampDate(item.createdAt)===today)).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  }
  function currentCheckin(items,today,sessionId) {
    const todayItems=checkinsForToday(items,today);
    if(sessionId)return todayItems.find(item=>item.sessionId===sessionId)||todayItems.find(item=>!item.sessionId)||null;
    return todayItems.find(item=>!item.sessionId)||todayItems[0]||null;
  }
  function executionGuidance(category,reason) {
    if(reason==='time') {
      if(category==='strength')return 'Proteggi riscaldamento e fondamentali; togli accessori o l’ultima serie, non la preparazione al carico.';
      if(category==='running')return 'Proteggi il riscaldamento e il blocco chiave; riduci ripetizioni o volume finale, non partire a freddo.';
      return 'Proteggi la preparazione e il blocco principale; riduci il volume secondario.';
    }
    return {
      running:'Mantieni intensità controllata e tecnica pulita; esegui circa il 75% del volume e interrompi ciò che aumenta il fastidio.',
      swimming:'Proteggi riscaldamento e tecnica; riduci il volume centrale e interrompi se assetto o sintomi peggiorano.',
      strength:'Una serie in meno sui fondamentali, almeno RIR 3 e nessun cedimento; elimina gli accessori se necessario.',
      cycling:'Resta in intensità facile e regolare, circa Z1–Z2 o 5–10% FTP sotto il target previsto.',
      hyrox:'Riduci del 25% volume e densità; niente tentativi massimali e corsa soltanto se ben tollerata.',
      metcon:'Riduci del 25% volume e densità; mantieni un ritmo controllato e nessun tentativo massimale.',
      test:'Il test non è più interpretabile: trasformalo in familiarizzazione tecnica controllata oppure rimandalo.',
      recovery:'Mantieni soltanto attività facile e tollerata, senza forzare il recupero.'
    }[category]||'Riduci volume o intensità del 20–30% e mantieni soltanto lavoro ben tollerato.';
  }
  function buildExecution(session,checkin) {
    const base=prescriptionFor(session);const recommendation=checkin?.recommendation;
    if(!recommendation||recommendation.level==='proceed'||session.outcome)return {adapted:false,mode:'planned',title:session.title,effectiveDurationMin:number(session.durationMin),prescription:base};
    const planned=number(session.durationMin);const reason=recommendation.reason||'recovery';
    if(recommendation.level==='replace') {
      const available=number(checkin.availableMinutes);const effective=Math.max(5,Math.min(planned||40,available||40,40));
      return {adapted:true,mode:'replace',title:'Recupero e rivalutazione',effectiveDurationMin:effective,prescription:[
        {label:'Durata odierna',value:`${effective} min al massimo · seduta originale ${planned} min`},
        {label:'Attività',value:reason==='pain'?'Riposo o attività che non aumenta il fastidio monitorato':'Riposo oppure cardio rigenerante molto facile'},
        {label:'Regola di stop',value:reason==='pain'?'Interrompi se il sintomo aumenta e rivaluta prima della prossima seduta':'Nessun obiettivo prestativo: termina se il recupero peggiora'}
      ]};
    }
    const available=number(checkin.availableMinutes);const target=reason==='time'&&available?Math.min(planned,available):planned*.75;const effective=Math.min(planned,Math.max(Math.min(planned,15),Math.round(target/5)*5));
    return {adapted:true,mode:'reduce',title:session.title,effectiveDurationMin:effective,prescription:[
      {label:'Durata odierna',value:`${effective} min · piano originale ${planned} min`},
      {label:'Regola operativa',value:executionGuidance(session.category,reason)},
      ...base.map(item=>({label:`Piano base · ${item.label}`,value:item.value}))
    ]};
  }
  function coachNote(primary,checkin,issues) {
    if(primary?.outcome) {
      if(primary.outcome.status==='skipped')return {tone:'neutral',title:'Seduta non svolta',text:'La registrazione resta nello storico e contribuirà alla prossima proposta settimanale.'};
      const durationKnown=number(primary.outcome.actualDurationMin)>0,rpeKnown=number(primary.outcome.rpe)>0;
      const missingLoadFields=[!durationKnown?'durata reale':'',!rpeKnown?'RPE':''].filter(Boolean);
      const loadText=durationKnown&&rpeKnown?`Carico interno ${number(primary.outcome.sessionLoad)} AU`:`Carico interno non calcolato: completa ${missingLoadFields.join(' e ')}`;
      if(!durationKnown||!rpeKnown)return {tone:'warn',title:'Registrazione incompleta',text:`${loadText}.`};
      return {tone:'good',title:loadText,text:number(primary.outcome.pain)?`Dolore massimo ${number(primary.outcome.pain)}/10.`:''};
    }
    if(checkin?.recommendation)return {tone:checkin.recommendation.level||'neutral',title:checkin.recommendation.title,text:checkin.recommendation.text};
    const regions=regionsForSession(primary);const relevant=issues.filter(issue=>regions.has(issueRegion(issue)));const stale=relevant.find(issue=>issue.requiresUpdate);const worst=relevant.filter(issue=>issue.isFresh).sort((a,b)=>b.latestPain-a.latestPain)[0];
    if(stale&&primary)return {tone:'warn',title:`${stale.zoneLabel||'Fastidio monitorato'} · aggiornamento richiesto`,text:`L’ultima valutazione risale a ${stale.ageLabel}. Inserisci un valore attuale nel check-in prima di decidere se mantenere o adattare la seduta.`};
    if(worst?.latestPain>=5&&primary)return {tone:'danger',title:`${worst.zoneLabel||'Fastidio monitorato'} · ${worst.latestPain}/10`,text:'Completa il check-in prima della seduta: il coach deve valutare se ridurre o sostituire il lavoro previsto.'};
    if(primary)return {tone:'neutral',title:'Valutazione ancora da completare',text:'Compila il check-in pre sessione: la proposta verrà confrontata con energia, fatica, tempo disponibile e fastidi attivi.'};
    return {tone:'neutral',title:'Nessuna seduta prevista oggi',text:'Puoi usare la giornata per recupero oppure aggiornare la disponibilità della settimana.'};
  }

  function buildTodayModel(input={}) {
    const today=input.today||iso(new Date()); const sessions=Array.isArray(input.sessions)?input.sessions:[];const activeSessions=sessions.filter(item=>!paused(item));
    const todaySessions=sortTodaySessions(activeSessions.filter(item=>item.date===today)); const primary=todaySessions[0]||null;
    const nextSession=activeSessions.filter(item=>item.date>today).sort((a,b)=>a.date.localeCompare(b.date)||(priorityRank[a.priority]??1)-(priorityRank[b.priority]??1))[0]||null;
    const issues=activeIssues(input.bodyIssues,today);const staleIssues=issues.filter(issue=>issue.requiresUpdate); const checkin=primary?currentCheckin(input.preCheckins,today,primary.id):null;const execution=primary?buildExecution(primary,checkin):null;
    const weekStart=mondayFor(today),weekEnd=addDays(weekStart,6); const weekSessions=activeSessions.filter(item=>item.date>=weekStart&&item.date<=weekEnd);
    const performedWeek=weekSessions.filter(performed); const completedCount=performedWeek.length;
    const load7Start=addDays(today,-6); const last7=activeSessions.filter(item=>item.date>=load7Start&&item.date<=today&&performed(item));
    const load7Known=last7.filter(item=>number(item.outcome.actualDurationMin)>0&&number(item.outcome.rpe)>0);const load7=load7Known.reduce((sum,item)=>sum+number(item.outcome.sessionLoad),0);const load7Partial=load7Known.length<last7.length;
    const actualMinutes=performedWeek.reduce((sum,item)=>sum+number(item.outcome.actualDurationMin),0);
    const performedRuns=performedWeek.filter(item=>item.category==='running');const runningWithDistance=performedRuns.filter(item=>number(item.outcome.actualDistanceKm)>0);
    const runningDistance=runningWithDistance.reduce((sum,item)=>sum+number(item.outcome.actualDistanceKm),0);
    const strengthCount=performedWeek.filter(item=>item.category==='strength').length;
    const pastUnrecorded=weekSessions.filter(item=>item.date<today&&!item.outcome).length;
    const days=Array.from({length:7},(_,index)=>{
      const date=addDays(weekStart,index);const items=weekSessions.filter(item=>item.date===date);const performedItems=items.filter(performed);const dayLoad=performedItems.reduce((sum,item)=>sum+number(item.outcome.sessionLoad),0);
      return {date,label:['L','M','M','G','V','S','D'][index],dayName:['Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato','Domenica'][index],isToday:date===today,load:dayLoad,performed:performedItems.length,planned:items.filter(item=>!item.outcome).length,skipped:items.filter(item=>item.outcome?.status==='skipped').length};
    });
    const maxDayLoad=Math.max(1,...days.map(day=>day.load));days.forEach(day=>{day.height=day.load?Math.max(12,Math.round(day.load/maxDayLoad*100)):day.performed?12:day.planned?12:day.skipped?6:0;});
    const recommendation=checkin?.recommendation; const subjectiveMeta=recommendationMeta[recommendation?.level];
    const sleepObserved=recoveryModel?recoveryModel.todaySleepMetric({today,cycles:input.whoopCycles,sleeps:input.whoopSleeps}):{value:'—',summary:'Nessun dato WHOOP importato'};const freshness=freshnessModel?freshnessModel.analyzeDeviceFreshness({today,whoopCycles:input.whoopCycles,whoopSleeps:input.whoopSleeps,whoopImportBatches:input.whoopImportBatches}):{whoop:{showOnDashboard:false}};const sleep={...sleepObserved,visible:Boolean(freshness.whoop.showOnDashboard&&sleepObserved.value!=='—'),freshness:freshness.whoop};const application=applicationModel?.applicationState?.(sessions,input.adaptiveAnalysis,weekStart,{today})||{applied:false,stale:false,application:null};
    const subjective=subjectiveMeta?{value:subjectiveMeta.value,tone:subjectiveMeta.tone,summary:recommendation.title}:primary?{value:'—',tone:'neutral',summary:'Compila il check-in pre sessione'}:weekSessions.length?{value:'REST DAY',tone:'rest',summary:'Nessuna seduta programmata oggi'}:{value:'PIANO LIBERO',tone:'neutral',summary:'Nessuna settimana programmata'};
    return {
      today,weekStart,weekEnd,
      todaySessions,primary,secondary:todaySessions.slice(1),nextSession,
      primaryTag:primary?sessionTag(primary):null,
      primarySummary:primary?sessionSummary(primary):'',
      prescription:[...(primary?.adaptiveAdjustment?.instructions?.length?[{label:'Adattamento settimanale',value:primary.adaptiveAdjustment.instructions.join(' ')}]:[]),...(execution?.prescription||[])],execution,
      checkin,issues,staleIssues,worstIssue:issues.find(issue=>issue.isFresh)||issues[0]||null,
      coachNote:coachNote(primary,checkin,issues),
      subjective,
      adaptiveCoach:buildAdaptiveCoach(input.adaptiveAnalysis,application),
      whoopOverview:buildWhoopOverview({...input,today}),
      sleep,
      load7:{value:Math.round(load7),sessions:last7.length,knownSessions:load7Known.length,partial:load7Partial,summary:last7.length?`${last7.length} sedut${last7.length===1?'a svolta':'e svolte'} negli ultimi 7 giorni${load7Partial?` · carico parziale ${load7Known.length}/${last7.length}`:''}`:'Nessun allenamento svolto'},
      issuesMetric:staleIssues.length?{value:issues.length,tone:'warn',summary:`${staleIssues[0].zoneLabel||'Fastidio'}: da aggiornare · ultima valutazione ${staleIssues[0].ageLabel}`}:{value:issues.length,summary:issues.length?`${issues[0].zoneLabel||'Fastidio'}: ${issues[0].latestPain}/10 · ${String(issues[0].label||'aggiornato').toLowerCase()}`:'Nessun fastidio monitorato'},
      week:{sessions:weekSessions.length,completedCount,actualMinutes,runningDistance,distanceKnown:runningWithDistance.length>0,distancePartial:runningWithDistance.length<performedRuns.length,strengthCount,pastUnrecorded,days}
    };
  }

  return { buildTodayModel, buildAdaptiveCoach, buildWhoopOverview, buildExecution, prescriptionFor, sessionSummary, mondayFor, addDays };
});
