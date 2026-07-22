(function (root, factory) {
  const core = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = core;
  if (root && root.localStorage) {
    root.rcDataStoreCore = core;
    root.rcDataStore = core.create(root.localStorage, {
      now: () => new Date(),
      dispatch: detail => {
        if (typeof root.dispatchEvent === 'function' && typeof root.CustomEvent === 'function') {
          root.dispatchEvent(new root.CustomEvent('rc:data-restored', { detail }));
        }
      }
    });
    root.rcDataStore.bootstrap();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const APP_NAME = 'Re Carlo V Personal Coach';
  const BACKUP_VERSION = 9;
  const MAX_PROFILE_PHOTO_BYTES = 2 * 1024 * 1024;
  const sessionCategories = new Set(['running','cycling','strength','hyrox','metcon','test','recovery']);
  const sessionPriorities = new Set(['essential','important','optional']);
  const outcomeStatuses = new Set(['completed','partial','skipped']);
  const weekDays = new Set(['Lun','Mar','Mer','Gio','Ven','Sab','Dom']);
  const strengthFormulas = new Set(['epley','brzycki','lombardi','average']);
  const hrZoneMethods = new Set(['hrr','hrmax','average','custom']);
  const ftpZoneMethods = new Set(['coggan7','coggan5']);
  const goalTypes = new Set(['marathon','half-marathon','running','hyrox','obstacle','triathlon','athx','cycling','strength-test','test','other']);
  const goalPriorities = new Set(['A','B','C']);
  const goalStatuses = new Set(['planned','completed','cancelled']);
  const strengthDefaults = { pullup:null, bench:null, military:null, squat:null, frontsquat:null, deadlift:null, trapbar:null };
  const datasets = Object.freeze({
    profile: { key:'rc-athlete-profile-v1', version:3, kind:'json', fallback:null },
    hrZones: { key:'rc-hr-zones', version:1, kind:'json', fallback:null },
    profilePhoto: { key:'rc-profile-photo', version:1, kind:'raw', fallback:null },
    sessions: { key:'rc-training-sessions-v1', version:1, kind:'json', fallback:[] },
    weeklyCheckin: { key:'rc-weekly-checkin-v1', version:1, kind:'json', fallback:null },
    weeklyAvailabilityHistory: { key:'rc-weekly-availability-history-v1', version:1, kind:'json', fallback:[] },
    preSessionCheckins: { key:'rc-pre-session-checkins-v1', version:1, kind:'json', fallback:[] },
    bodyIssues: { key:'rc-body-issues-v1', version:1, kind:'json', fallback:[] },
    importedActivities: { key:'rc-imported-activities-v1', version:1, kind:'json', fallback:[] },
    importBatches: { key:'rc-import-batches-v1', version:1, kind:'json', fallback:[] },
    whoopCycles: { key:'rc-whoop-cycles-v1', version:1, kind:'json', fallback:[] },
    whoopSleeps: { key:'rc-whoop-sleeps-v1', version:1, kind:'json', fallback:[] },
    whoopWorkouts: { key:'rc-whoop-workouts-v1', version:1, kind:'json', fallback:[] },
    whoopJournal: { key:'rc-whoop-journal-v1', version:1, kind:'json', fallback:[] },
    whoopImportBatches: { key:'rc-whoop-import-batches-v1', version:1, kind:'json', fallback:[] },
    reconciliationDecisions: { key:'rc-reconciliation-decisions-v1', version:1, kind:'json', fallback:[] },
    goals: { key:'rc-goals-v1', version:1, kind:'json', fallback:[] },
    planView: { key:'rc-plan-view-v1', version:1, kind:'raw', fallback:'list' },
    uiTheme: { key:'rc-ui-theme-v1', version:1, kind:'raw', fallback:'auto' },
    cloudSyncCursor: { key:'rc-cloud-sync-cursor-v1', version:1, kind:'json', fallback:null },
    legacyFtp: { key:'rc-ftp', version:1, kind:'raw', fallback:null, compatibilityOnly:true }
  });
  const allKeys = Object.freeze(Object.values(datasets).map(item => item.key));

  class DataStoreError extends Error {
    constructor(code, message) { super(message); this.name = 'DataStoreError'; this.code = code; }
  }

  function clone(value) {
    if (value === undefined) return undefined;
    if (typeof structuredClone === 'function') return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  function isObject(value) { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
  function owns(value, key) { return Object.prototype.hasOwnProperty.call(value,key); }
  function isFiniteValue(value) { return value !== '' && value !== null && Number.isFinite(Number(value)); }
  function isDateKey(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0,10) === value;
  }
  function isTimestamp(value) { return typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Date.parse(value)); }
  function invalid(code, message) { throw new DataStoreError(code,message); }

  function validateProfile(value) {
    if (value === null) return value;
    if (!isObject(value)) invalid('INVALID_PROFILE','Il profilo atleta non è valido.');
    if (owns(value,'schemaVersion')) {
      const version = Number(value.schemaVersion);
      if (!Number.isInteger(version) || version < 1) invalid('INVALID_PROFILE','La versione del profilo atleta non è valida.');
      if (version > datasets.profile.version) invalid('FUTURE_PROFILE','Il profilo atleta proviene da una versione più recente dell’app.');
    }
    if (!String(value.firstName || '').trim()) invalid('INVALID_PROFILE','Nel profilo atleta manca il nome.');
    ['firstName','lastName','nickname','birthDate','level','updatedAt'].forEach(field => {
      if (owns(value,field) && typeof value[field] !== 'string') invalid('INVALID_PROFILE',`Il campo ${field} del profilo non è valido.`);
    });
    ['heightCm','weightKg','maxHr','restingHr','ftp'].forEach(field => {
      if (owns(value,field) && !isFiniteValue(value[field])) invalid('INVALID_PROFILE',`Il campo ${field} del profilo non è valido.`);
    });
    if(owns(value,'profileSetupComplete')&&typeof value.profileSetupComplete!=='boolean')invalid('INVALID_PROFILE','Lo stato di configurazione del profilo non è valido.');
    if (owns(value,'sports') && (!Array.isArray(value.sports) || value.sports.some(item => typeof item !== 'string'))) invalid('INVALID_PROFILE','Gli sport del profilo non sono validi.');
    if (owns(value,'devices') && (!Array.isArray(value.devices) || value.devices.some(item => typeof item !== 'string'))) invalid('INVALID_PROFILE','I dispositivi legacy del profilo non sono validi.');
    if (owns(value,'equipment')) {
      if (!isObject(value.equipment) || Object.values(value.equipment).some(items => !Array.isArray(items) || items.some(item => typeof item !== 'string'))) invalid('INVALID_PROFILE','L’attrezzatura del profilo non è valida.');
    }
    if(owns(value,'heartRateSources')){
      if(!isObject(value.heartRateSources))invalid('INVALID_PROFILE','La provenienza delle frequenze cardiache non è valida.');
      Object.entries(value.heartRateSources).forEach(([field,source])=>{if(!['maxHr','restingHr'].includes(field)||!isObject(source)||source.provider!=='whoop'||!['body_measurement','median_28d'].includes(source.method)||!isFiniteValue(source.value)||(source.observedAt!==null&&source.observedAt!==undefined&&!isTimestamp(source.observedAt))||(owns(source,'sampleDays')&&(!Number.isInteger(Number(source.sampleDays))||Number(source.sampleDays)<1||Number(source.sampleDays)>28)))invalid('INVALID_PROFILE','Una fonte WHOOP delle frequenze cardiache non è valida.');});
    }
    if(owns(value,'bodyMeasurementSources')){
      if(!isObject(value.bodyMeasurementSources))invalid('INVALID_PROFILE','La provenienza delle misurazioni corporee non è valida.');
      Object.entries(value.bodyMeasurementSources).forEach(([field,source])=>{if(!['heightCm','weightKg'].includes(field)||!isObject(source)||source.provider!=='whoop'||source.method!=='body_measurement'||!isFiniteValue(source.value)||(source.observedAt!==null&&source.observedAt!==undefined&&!isTimestamp(source.observedAt)))invalid('INVALID_PROFILE','Una fonte WHOOP delle misurazioni corporee non è valida.');});
    }
    if (owns(value,'strengthMaxes')) {
      if (!isObject(value.strengthMaxes) || Object.values(value.strengthMaxes).some(item => item !== null && !isFiniteValue(item))) invalid('INVALID_PROFILE','I massimali del profilo non sono validi.');
    }
    if (owns(value,'strengthFormula') && !strengthFormulas.has(value.strengthFormula)) invalid('INVALID_PROFILE','La formula e1RM del profilo non è valida.');
    if (owns(value,'hrZoneMethod') && !hrZoneMethods.has(value.hrZoneMethod)) invalid('INVALID_PROFILE','Il metodo delle zone cardiache non è valido.');
    if (owns(value,'ftpZoneMethod') && !ftpZoneMethods.has(value.ftpZoneMethod)) invalid('INVALID_PROFILE','Il metodo delle zone FTP non è valido.');
    if (owns(value,'personalBests')) {
      if (!Array.isArray(value.personalBests) || value.personalBests.some(item => {
        if (!isObject(item) || typeof item.id !== 'string' || typeof item.label !== 'string' || typeof item.kind !== 'string') return true;
        return ['hours','minutes','seconds','distanceKm'].some(field => owns(item,field) && !isFiniteValue(item[field]));
      })) invalid('INVALID_PROFILE','I personal best del profilo non sono validi.');
    }
    return value;
  }

  function validateEnduranceBlocks(blocks,{actual=false}={}){
    const phases=new Set(['warmup','work','recovery','cooldown','free']),units=new Set(['min','km','m']),targets=new Set(['free','pace','hr','rpe','ftp']),intensities=new Set(['recovery','easy','steady','tempo','threshold','vo2','race']);
    const validSegment=item=>{
      if(!isObject(item)||item.type!=='segment'||!phases.has(item.phase)||!units.has(item.unit)||!isFiniteValue(item.amount)||Number(item.amount)<(actual?0:.01)||Number(item.amount)>2000)return false;
      if(owns(item,'targetType')&&!targets.has(item.targetType))return false;
      if(owns(item,'target')&&typeof item.target!=='string')return false;
      if(owns(item,'paceHint')&&typeof item.paceHint!=='string')return false;
      if(owns(item,'intensity')&&!intensities.has(item.intensity))return false;
      if(owns(item,'completed')&&typeof item.completed!=='boolean')return false;
      if(owns(item,'plannedAmount')&&(!isFiniteValue(item.plannedAmount)||Number(item.plannedAmount)<0||Number(item.plannedAmount)>2000))return false;
      if(owns(item,'targetSource')&&!isObject(item.targetSource))return false;
      return true;
    };
    if(!Array.isArray(blocks)||blocks.length>40)return false;
    return blocks.every(item=>{
      if(item?.type==='segment')return validSegment(item);
      if(!isObject(item)||item.type!=='repeat'||!Number.isInteger(Number(item.repeats))||Number(item.repeats)<(actual?0:1)||Number(item.repeats)>100||!Array.isArray(item.steps)||!item.steps.length||item.steps.length>20||!item.steps.every(validSegment))return false;
      if(owns(item,'plannedRepeats')&&(!Number.isInteger(Number(item.plannedRepeats))||Number(item.plannedRepeats)<0||Number(item.plannedRepeats)>100))return false;
      if(owns(item,'completed')&&typeof item.completed!=='boolean')return false;
      if(owns(item,'intensity')&&!intensities.has(item.intensity))return false;
      return true;
    });
  }

  function validateSession(session) {
    if (!isObject(session)) invalid('INVALID_SESSIONS','Una seduta del backup non è valida.');
    if (typeof session.id !== 'string' || !session.id.trim() || !isDateKey(session.date) || !sessionCategories.has(session.category) || typeof session.title !== 'string' || !session.title.trim()) invalid('INVALID_SESSIONS','Una seduta contiene identificativo, data, categoria o titolo non validi.');
    if (!isFiniteValue(session.durationMin) || Number(session.durationMin) <= 0 || !sessionPriorities.has(session.priority)) invalid('INVALID_SESSIONS','Una seduta contiene durata o priorità non valide.');
    if (!isObject(session.details)) invalid('INVALID_SESSIONS','I dettagli di una seduta non sono validi.');
    if(owns(session.details,'runBlocks')&&!validateEnduranceBlocks(session.details.runBlocks))invalid('INVALID_SESSIONS','La struttura della corsa non è valida.');
    if(owns(session.details,'rideBlocks')&&!validateEnduranceBlocks(session.details.rideBlocks))invalid('INVALID_SESSIONS','La struttura dei rulli non è valida.');
    if(owns(session.details,'prescriptionVersion')&&typeof session.details.prescriptionVersion!=='string')invalid('INVALID_SESSIONS','La versione della prescrizione non è valida.');
    if(owns(session.details,'strengthBlocks')){
      const blocks=session.details.strengthBlocks;if(!Array.isArray(blocks)||blocks.length>50||blocks.some(block=>!isObject(block)||typeof block.name!=='string'||!block.name.trim()||(owns(block,'loadKg')&&block.loadKg!==''&&block.loadKg!==null&&block.loadKg!==undefined&&(!isFiniteValue(block.loadKg)||Number(block.loadKg)<0||Number(block.loadKg)>700))))invalid('INVALID_SESSIONS','La prescrizione dei carichi di forza non è valida.');
    }
    if (owns(session,'notes') && typeof session.notes !== 'string') invalid('INVALID_SESSIONS','Le note di una seduta non sono valide.');
    if (owns(session,'titleMode') && !['auto','custom'].includes(session.titleMode)) invalid('INVALID_SESSIONS','La modalità del titolo di una seduta non è valida.');
    if(owns(session,'planImport')){
      const source=session.planImport;if(!isObject(source)||source.provider!=='excel'||typeof source.sourceName!=='string'||!source.sourceName.trim()||source.sheet!=='Planner'||!Number.isInteger(Number(source.row))||Number(source.row)<2||!Number.isInteger(Number(source.week))||Number(source.week)<1||typeof source.weekLabel!=='string'||!source.weekLabel.trim()||typeof source.phase!=='string'||typeof source.originalTitle!=='string'||!source.originalTitle.trim()||!isTimestamp(source.importedAt))invalid('INVALID_SESSIONS','La provenienza del piano Excel non è valida.');
    }
    if(owns(session,'adaptiveAdjustment')){
      const adjustment=session.adaptiveAdjustment,source=adjustment?.source;
      if(!isObject(adjustment)||adjustment.version!==1||!['active','paused'].includes(adjustment.status)||!['protect','reduce','steady','progress'].includes(adjustment.level)||!['low','medium','high'].includes(adjustment.confidence)||!isTimestamp(adjustment.preparedAt)||!Array.isArray(adjustment.instructions)||adjustment.instructions.length>20||adjustment.instructions.some(item=>typeof item!=='string'||!item.trim()))invalid('INVALID_SESSIONS','L’adattamento settimanale non è valido.');
      if(!isObject(source)||!isDateKey(source.date)||!sessionCategories.has(source.category)||typeof source.title!=='string'||!source.title.trim()||!isFiniteValue(source.durationMin)||Number(source.durationMin)<=0||!sessionPriorities.has(source.priority)||!isObject(source.details)||typeof source.notes!=='string'||!['auto','custom'].includes(source.titleMode))invalid('INVALID_SESSIONS','La prescrizione originale dell’adattamento non è valida.');
      if(Array.isArray(source.details.strengthBlocks)&&source.details.strengthBlocks.some(block=>owns(block,'loadKg')&&block.loadKg!==''&&block.loadKg!==null&&block.loadKg!==undefined&&(!isFiniteValue(block.loadKg)||Number(block.loadKg)<0||Number(block.loadKg)>700)))invalid('INVALID_SESSIONS','Il carico di forza originale dell’adattamento non è valido.');
    }
    if(owns(session,'goalSubstitution')){
      const substitution=session.goalSubstitution;
      if(!isObject(substitution)||substitution.version!==1||typeof substitution.goalId!=='string'||!substitution.goalId.trim()||typeof substitution.goalSessionId!=='string'||!substitution.goalSessionId.trim()||!isTimestamp(substitution.appliedAt)||substitution.reason!=='same-day-specific-race')invalid('INVALID_SESSIONS','La sostituzione della seduta con la gara non è valida.');
    }
    if(owns(session,'coachApplication')){
      const application=session.coachApplication,validVersion=[1,2].includes(application?.version);if(!isObject(application)||!validVersion||!isDateKey(application.weekStart)||!isTimestamp(application.appliedAt)||!/^adaptive-v1-[0-9a-f]{8}$/.test(String(application.signature||''))||!['protect','reduce','steady','progress'].includes(application.level)||!['low','medium','high'].includes(application.confidence))invalid('INVALID_SESSIONS','La conferma del piano adattivo non è valida.');
      if(application.version===2&&application.phase!==null&&application.phase!==undefined){const phase=application.phase;if(!isObject(phase)||(phase.version!==null&&phase.version!==undefined&&typeof phase.version!=='string')||(phase.goalId!==null&&phase.goalId!==undefined&&typeof phase.goalId!=='string')||(phase.phaseKey!==null&&phase.phaseKey!==undefined&&typeof phase.phaseKey!=='string')||(phase.label!==null&&phase.label!==undefined&&typeof phase.label!=='string'))invalid('INVALID_SESSIONS','La fase associata alla conferma del piano non è valida.');}
    }
    if (session.outcome !== null && session.outcome !== undefined) {
      if (!isObject(session.outcome) || !outcomeStatuses.has(session.outcome.status)) invalid('INVALID_OUTCOME','Una registrazione post-allenamento usa uno stato non riconosciuto. I dati originali sono stati preservati.');
      ['actualDurationMin','actualDistanceKm','rpe','sessionLoad','pain'].forEach(field => {
        if (owns(session.outcome,field) && session.outcome[field] !== null && !isFiniteValue(session.outcome[field])) invalid('INVALID_OUTCOME','Una registrazione post-allenamento contiene valori non validi.');
      });
      if(owns(session.outcome,'strengthPerformance')){
        const values=session.outcome.strengthPerformance;
        if(!Array.isArray(values)||values.length>20||values.some(item=>!isObject(item)||typeof item.exercise!=='string'||!item.exercise.trim()||!isFiniteValue(item.loadKg)||Number(item.loadKg)<=0||Number(item.loadKg)>700||!Number.isInteger(Number(item.reps))||Number(item.reps)<1||Number(item.reps)>10||(owns(item,'rpe')&&(!isFiniteValue(item.rpe)||Number(item.rpe)<6||Number(item.rpe)>10||!Number.isInteger(Number(item.rpe)*2)))||(owns(item,'bodyweightKg')&&(!isFiniteValue(item.bodyweightKg)||Number(item.bodyweightKg)<20||Number(item.bodyweightKg)>300))))invalid('INVALID_OUTCOME','I set principali registrati per il calcolo e1RM non sono validi.');
      }
      if(owns(session.outcome,'actualEnduranceBlocks')&&!validateEnduranceBlocks(session.outcome.actualEnduranceBlocks,{actual:true}))invalid('INVALID_OUTCOME','I blocchi realmente svolti non sono validi.');
      if(owns(session.outcome,'deviceEvidence')){
        const evidence=session.outcome.deviceEvidence;const allowedFields=new Set(['actualDurationMin','actualDistanceKm']);
        if(!isObject(evidence)||typeof evidence.reconciliationDecisionId!=='string'||!evidence.reconciliationDecisionId.trim()||!isTimestamp(evidence.reviewedAt)||!Array.isArray(evidence.usedFields)||new Set(evidence.usedFields).size!==evidence.usedFields.length||evidence.usedFields.some(field=>!allowedFields.has(field)))invalid('INVALID_OUTCOME','La provenienza dei dati dispositivo non è valida.');
        ['stravaActivityId','whoopWorkoutId'].forEach(field=>{if(evidence[field]!==null&&evidence[field]!==undefined&&(typeof evidence[field]!=='string'||!evidence[field].trim()))invalid('INVALID_OUTCOME','Un riferimento ai dati dispositivo non è valido.');});
        if(!evidence.stravaActivityId&&!evidence.whoopWorkoutId)invalid('INVALID_OUTCOME','La provenienza non contiene alcuna fonte dispositivo.');
        ['observedDurationMin','observedDistanceKm'].forEach(field=>{if(evidence[field]!==null&&evidence[field]!==undefined&&(!isFiniteValue(evidence[field])||Number(evidence[field])<=0))invalid('INVALID_OUTCOME','Una metrica osservata collegata non è valida.');});
        if(evidence.usedFields.includes('actualDurationMin')&&!isFiniteValue(evidence.observedDurationMin))invalid('INVALID_OUTCOME','La durata usata non ha una misura osservata valida.');
        if(evidence.usedFields.includes('actualDistanceKm')&&!isFiniteValue(evidence.observedDistanceKm))invalid('INVALID_OUTCOME','La distanza usata non ha una misura osservata valida.');
      }
    }
    return session;
  }

  function validateWeeklyCheckin(value) {
    if (value === null) return value;
    if (!isObject(value) || !isDateKey(value.weekStart) || !Number.isInteger(Number(value.sessions)) || !isFiniteValue(value.sessionMinutes) || !isFiniteValue(value.longRunMinutes)) invalid('INVALID_WEEKLY','Il check-in settimanale non è valido.');
    if (!Array.isArray(value.days) || value.days.some(day => !weekDays.has(day))) invalid('INVALID_WEEKLY','I giorni del check-in settimanale non sono validi.');
    if (owns(value,'weekendLong') && !['yes','maybe','no'].includes(value.weekendLong)) invalid('INVALID_WEEKLY','La preferenza per il lungo non è valida.');
    if (owns(value,'constraints') && typeof value.constraints !== 'string') invalid('INVALID_WEEKLY','I vincoli settimanali non sono validi.');
    if (owns(value,'updatedAt') && !isTimestamp(value.updatedAt)) invalid('INVALID_WEEKLY','La data del check-in settimanale non è valida.');
    return value;
  }

  function validateWeeklyAvailabilityHistory(value) {
    if (!Array.isArray(value)) invalid('INVALID_WEEKLY_HISTORY','Lo storico delle disponibilità settimanali non è valido.');
    const starts=new Set();
    value.forEach(item=>{
      validateWeeklyCheckin(item);
      if(starts.has(item.weekStart))invalid('INVALID_WEEKLY_HISTORY','Lo storico contiene più disponibilità per la stessa settimana.');
      starts.add(item.weekStart);
      if(owns(item,'createdAt')&&!isTimestamp(item.createdAt))invalid('INVALID_WEEKLY_HISTORY','La data di creazione di una disponibilità non è valida.');
    });
    return value;
  }

  function validatePreSessionCheckins(value) {
    if (!Array.isArray(value)) invalid('INVALID_PRE_CHECKINS','Lo storico dei check-in pre sessione non è valido.');
    value.forEach(item => {
      if (!isObject(item) || !isTimestamp(item.createdAt)) invalid('INVALID_PRE_CHECKINS','Un check-in pre sessione non è valido.');
      ['energy','fatigue','soreness','motivation','availableMinutes'].forEach(field => {
        if (!isFiniteValue(item[field])) invalid('INVALID_PRE_CHECKINS',`Il campo ${field} di un check-in non è valido.`);
      });
      if (owns(item,'sessionId') && item.sessionId !== null && typeof item.sessionId !== 'string') invalid('INVALID_PRE_CHECKINS','La seduta associata a un check-in non è valida.');
      if (owns(item,'sessionDate') && !isDateKey(item.sessionDate)) invalid('INVALID_PRE_CHECKINS','La data associata a un check-in non è valida.');
      if (owns(item,'notes') && typeof item.notes !== 'string') invalid('INVALID_PRE_CHECKINS','Le note di un check-in non sono valide.');
      if (owns(item,'issueReadings')) {
        if (!Array.isArray(item.issueReadings) || item.issueReadings.some(reading => !isObject(reading) || typeof reading.id !== 'string' || !isFiniteValue(reading.pain))) invalid('INVALID_PRE_CHECKINS','Le letture dei fastidi in un check-in non sono valide.');
      }
      if (owns(item,'recommendation') && item.recommendation !== null) {
        const recommendation=item.recommendation;
        if (!isObject(recommendation) || !['proceed','reduce','replace'].includes(recommendation.level) || typeof recommendation.title !== 'string' || typeof recommendation.text !== 'string') invalid('INVALID_PRE_CHECKINS','La raccomandazione di un check-in non è valida.');
      }
    });
    return value;
  }

  function validateBodyIssues(value) {
    if (!Array.isArray(value)) invalid('INVALID_BODY_ISSUES','Lo storico dei fastidi non è valido.');
    value.forEach(issue => {
      if (!isObject(issue) || typeof issue.id !== 'string' || !issue.id.trim() || typeof issue.zone !== 'string' || !issue.zone.trim() || !['active','resolved'].includes(issue.status)) invalid('INVALID_BODY_ISSUES','Un fastidio corporeo non è valido.');
      ['zoneLabel','type','description','notes'].forEach(field => {
        if (owns(issue,field) && typeof issue[field] !== 'string') invalid('INVALID_BODY_ISSUES',`Il campo ${field} di un fastidio non è valido.`);
      });
      if (owns(issue,'startedAt') && !isTimestamp(issue.startedAt)) invalid('INVALID_BODY_ISSUES','La data iniziale di un fastidio non è valida.');
      if (issue.status === 'resolved' && owns(issue,'resolvedAt') && !isTimestamp(issue.resolvedAt)) invalid('INVALID_BODY_ISSUES','La data di risoluzione di un fastidio non è valida.');
      if (owns(issue,'initialPain') && !isFiniteValue(issue.initialPain)) invalid('INVALID_BODY_ISSUES','Il dolore iniziale di un fastidio non è valido.');
      if (owns(issue,'history')) {
        if (!Array.isArray(issue.history) || issue.history.some(entry => !isObject(entry) || !isTimestamp(entry.date) || !isFiniteValue(entry.pain))) invalid('INVALID_BODY_ISSUES','Lo storico del dolore di un fastidio non è valido.');
      }
    });
    return value;
  }

  function validateGoals(value) {
    if (!Array.isArray(value) || value.length > 200) invalid('INVALID_GOALS','L’elenco degli obiettivi non è valido.');
    const ids=new Set();
    value.forEach(goal=>{
      if(!isObject(goal)||typeof goal.id!=='string'||!goal.id.trim()||typeof goal.name!=='string'||!goal.name.trim()||!goalTypes.has(goal.type)||!isDateKey(goal.date)||!goalPriorities.has(goal.priority)||!goalStatuses.has(goal.status))invalid('INVALID_GOALS','Un obiettivo contiene identificativo, nome, tipo, data, priorità o stato non validi.');
      if(ids.has(goal.id))invalid('INVALID_GOALS','L’elenco contiene obiettivi duplicati.');ids.add(goal.id);
      ['target','result','notes'].forEach(field=>{if(owns(goal,field)&&typeof goal[field]!=='string')invalid('INVALID_GOALS',`Il campo ${field} di un obiettivo non è valido.`);});
      if(owns(goal,'variant')&&(typeof goal.variant!=='string'||!goal.variant.trim()||goal.variant.length>80))invalid('INVALID_GOALS','Il formato specifico di un obiettivo non è valido.');
      if(owns(goal,'distanceKm')&&(!Number.isFinite(Number(goal.distanceKm))||Number(goal.distanceKm)<=0||Number(goal.distanceKm)>1000))invalid('INVALID_GOALS','La distanza di un obiettivo non è valida.');
      if(owns(goal,'dateAuthority')&&!['manual','plan'].includes(goal.dateAuthority))invalid('INVALID_GOALS','La provenienza della data di un obiettivo non è valida.');
      ['createdAt','updatedAt'].forEach(field=>{if(!isTimestamp(goal[field]))invalid('INVALID_GOALS',`La data ${field} di un obiettivo non è valida.`);});
      if(owns(goal,'inferredFromSessionId')&&(typeof goal.inferredFromSessionId!=='string'||!goal.inferredFromSessionId.trim()))invalid('INVALID_GOALS','La provenienza di un obiettivo non è valida.');
    });
    return value;
  }

  function validateImportedActivities(value) {
    if (!Array.isArray(value) || value.length > 100000) invalid('INVALID_IMPORTED_ACTIVITIES','Lo storico delle attività importate non è valido.');
    const ids=new Set();
    value.forEach(activity=>{
      if(!isObject(activity)||typeof activity.id!=='string'||!activity.id.trim()||typeof activity.externalId!=='string'||!activity.externalId.trim()||!isDateKey(activity.date)||typeof activity.localStart!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(activity.localStart))invalid('INVALID_IMPORTED_ACTIVITIES','Un’attività importata contiene identificativo o data non validi.');
      if(ids.has(activity.id))invalid('INVALID_IMPORTED_ACTIVITIES','Lo storico importato contiene attività duplicate.');ids.add(activity.id);
      ['name','description','sportType','category','gear'].forEach(field=>{if(typeof activity[field]!=='string')invalid('INVALID_IMPORTED_ACTIVITIES',`Il campo ${field} di un’attività importata non è valido.`);});
      ['originalFilename','originalFileType'].forEach(field=>{if(owns(activity,field)&&activity[field]!==null&&typeof activity[field]!=='string')invalid('INVALID_IMPORTED_ACTIVITIES',`Il campo ${field} di un’attività importata non è valido.`);});
      ['elapsedSec','movingSec','distanceM','elevationGainM','averageHr','maxHr','averageWatts','weightedWatts','averageCadence','relativeEffort','perceivedEffort','calories'].forEach(field=>{
        if(owns(activity,field)&&activity[field]!==null&&!isFiniteValue(activity[field]))invalid('INVALID_IMPORTED_ACTIVITIES',`Il campo ${field} di un’attività importata non è valido.`);
      });
      const source=activity.source;
      if(!isObject(source)||source.provider!=='strava'||source.scope!=='activity-summary'||source.externalId!==activity.externalId||typeof source.batchId!=='string'||!source.batchId.trim()||!isTimestamp(source.importedAt)||typeof source.sourceFile!=='string'||typeof source.hasOriginalFile!=='boolean')invalid('INVALID_IMPORTED_ACTIVITIES','La provenienza di un’attività importata non è valida.');
    });
    return value;
  }

  function validateImportBatches(value) {
    if(!Array.isArray(value)||value.length>10000)invalid('INVALID_IMPORT_BATCHES','Lo storico delle importazioni non è valido.');
    const ids=new Set();
    value.forEach(batch=>{
      if(!isObject(batch)||typeof batch.id!=='string'||!batch.id.trim()||batch.provider!=='strava'||!isTimestamp(batch.importedAt)||typeof batch.sourceName!=='string'||!batch.sourceName.trim())invalid('INVALID_IMPORT_BATCHES','Una importazione contiene identificativo, fonte o data non validi.');
      if(ids.has(batch.id))invalid('INVALID_IMPORT_BATCHES','Lo storico contiene importazioni duplicate.');ids.add(batch.id);
      ['sourceRows','duplicateCount','conflictCount'].forEach(field=>{if(!Number.isInteger(Number(batch[field]))||Number(batch[field])<0)invalid('INVALID_IMPORT_BATCHES',`Il campo ${field} di una importazione non è valido.`);});
      if(!Array.isArray(batch.addedIds)||new Set(batch.addedIds).size!==batch.addedIds.length||batch.addedIds.some(id=>typeof id!=='string'||!id.trim()))invalid('INVALID_IMPORT_BATCHES','Le attività associate a una importazione non sono valide.');
      ['earliestDate','latestDate'].forEach(field=>{if(batch[field]!==null&&!isDateKey(batch[field]))invalid('INVALID_IMPORT_BATCHES',`La data ${field} di una importazione non è valida.`);});
      ['originalFileEntries','missingOriginalFiles'].forEach(field=>{if(batch[field]!==null&&(!Number.isInteger(Number(batch[field]))||Number(batch[field])<0))invalid('INVALID_IMPORT_BATCHES',`Il campo ${field} di una importazione non è valido.`);});
    });
    return value;
  }

  function validateImportConsistency(activities,batches) {
    validateImportedActivities(activities);validateImportBatches(batches);
    const activityById=new Map(activities.map(activity=>[activity.id,activity]));const batchById=new Map(batches.map(batch=>[batch.id,batch]));
    activities.forEach(activity=>{
      const batch=batchById.get(activity.source.batchId);
      if(!batch||!batch.addedIds.includes(activity.id))invalid('INVALID_IMPORT_LINKS','Un’attività importata non è collegata correttamente alla sua importazione.');
    });
    batches.forEach(batch=>batch.addedIds.forEach(id=>{
      const activity=activityById.get(id);if(!activity||activity.source.batchId!==batch.id)invalid('INVALID_IMPORT_LINKS','Una importazione fa riferimento a un’attività mancante.');
    }));
    return true;
  }

  const whoopDatasetScopes=Object.freeze({whoopCycles:'cycle',whoopSleeps:'sleep',whoopWorkouts:'workout',whoopJournal:'journal'});
  const whoopBatchKinds=Object.freeze({cycles:'whoopCycles',sleeps:'whoopSleeps',workouts:'whoopWorkouts',journal:'whoopJournal'});
  function validateWhoopRecords(name,value) {
    const scope=whoopDatasetScopes[name];
    if(!scope||!Array.isArray(value)||value.length>100000)invalid('INVALID_WHOOP_DATA','Lo storico WHOOP non è valido.');
    const ids=new Set();
    value.forEach(record=>{
      if(!isObject(record)||typeof record.id!=='string'||!record.id.trim()||typeof record.externalId!=='string'||!record.externalId.trim()||!isDateKey(record.date))invalid('INVALID_WHOOP_DATA','Una registrazione WHOOP contiene identificativo o data non validi.');
      if(ids.has(record.id))invalid('INVALID_WHOOP_DATA','Lo storico WHOOP contiene registrazioni duplicate.');ids.add(record.id);
      const source=record.source;
      if(!isObject(source)||source.provider!=='whoop'||source.scope!==scope||source.externalId!==record.externalId||typeof source.sourceFile!=='string'||!source.sourceFile.trim()||typeof source.batchId!=='string'||!source.batchId.trim()||!isTimestamp(source.importedAt))invalid('INVALID_WHOOP_DATA','La provenienza di una registrazione WHOOP non è valida.');
      ['cycleStart','cycleEnd','sleepStart','wakeStart','start','end'].forEach(field=>{if(owns(record,field)&&record[field]!==null&&!isTimestamp(record[field]))invalid('INVALID_WHOOP_DATA',`L’orario ${field} di una registrazione WHOOP non è valido.`);});
      ['recoveryScore','restingHr','hrvMs','skinTempC','spo2Pct','dayStrain','energyKcal','maxHr','averageHr','sleepPerformancePct','respiratoryRate','sleepDurationMin','timeInBedMin','lightSleepMin','deepSleepMin','remSleepMin','awakeMin','sleepNeedMin','sleepDebtMin','sleepEfficiencyPct','sleepConsistencyPct','durationMin','strain','calories'].forEach(field=>{if(owns(record,field)&&record[field]!==null&&!isFiniteValue(record[field]))invalid('INVALID_WHOOP_DATA',`Il campo ${field} di una registrazione WHOOP non è valido.`);});
      if(scope==='sleep'&&typeof record.nap!=='boolean')invalid('INVALID_WHOOP_DATA','Il tipo di sonno WHOOP non è valido.');
      if(scope==='workout'){
        if(typeof record.name!=='string'||!record.name.trim()||typeof record.category!=='string'||!record.category.trim()||typeof record.gpsEnabled!=='boolean'||!Array.isArray(record.hrZonePct)||record.hrZonePct.length!==5||record.hrZonePct.some(item=>item!==null&&!isFiniteValue(item)))invalid('INVALID_WHOOP_DATA','Un allenamento WHOOP non è valido.');
      }
      if(scope==='journal'&&(!Array.isArray(record.entries)||!record.entries.length||record.entries.some(entry=>!isObject(entry)||typeof entry.question!=='string'||!entry.question.trim()||typeof entry.answer!=='boolean'||typeof entry.notes!=='string')))invalid('INVALID_WHOOP_DATA','Una voce del diario WHOOP non è valida.');
    });
    return value;
  }
  function validateWhoopImportBatches(value){
    if(!Array.isArray(value)||value.length>10000)invalid('INVALID_WHOOP_IMPORTS','Lo storico delle importazioni WHOOP non è valido.');
    const ids=new Set();
    value.forEach(batch=>{
      if(!isObject(batch)||typeof batch.id!=='string'||!batch.id.trim()||batch.provider!=='whoop'||!isTimestamp(batch.importedAt)||typeof batch.sourceName!=='string'||!batch.sourceName.trim())invalid('INVALID_WHOOP_IMPORTS','Una importazione WHOOP contiene identificativo, fonte o data non validi.');
      if(ids.has(batch.id))invalid('INVALID_WHOOP_IMPORTS','Lo storico contiene importazioni WHOOP duplicate.');ids.add(batch.id);
      ['sourceRows','duplicateCount','conflictCount'].forEach(field=>{if(!Number.isInteger(Number(batch[field]))||Number(batch[field])<0)invalid('INVALID_WHOOP_IMPORTS',`Il campo ${field} di una importazione WHOOP non è valido.`);});
      if(!isObject(batch.addedIds)||Object.keys(whoopBatchKinds).some(kind=>!Array.isArray(batch.addedIds[kind])||new Set(batch.addedIds[kind]).size!==batch.addedIds[kind].length||batch.addedIds[kind].some(id=>typeof id!=='string'||!id.trim())))invalid('INVALID_WHOOP_IMPORTS','Le registrazioni associate a una importazione WHOOP non sono valide.');
      if(owns(batch,'sourceMode')&&!['file','api'].includes(batch.sourceMode))invalid('INVALID_WHOOP_IMPORTS','La modalità della fonte WHOOP non è valida.');
      if(owns(batch,'updatedIds')&&(!isObject(batch.updatedIds)||Object.keys(whoopBatchKinds).some(kind=>!Array.isArray(batch.updatedIds[kind])||new Set(batch.updatedIds[kind]).size!==batch.updatedIds[kind].length||batch.updatedIds[kind].some(id=>typeof id!=='string'||!id.trim()))))invalid('INVALID_WHOOP_IMPORTS','Le registrazioni aggiornate da WHOOP non sono valide.');
      if(owns(batch,'updatedCount')&&(!Number.isInteger(Number(batch.updatedCount))||Number(batch.updatedCount)<0))invalid('INVALID_WHOOP_IMPORTS','Il conteggio degli aggiornamenti WHOOP non è valido.');
      ['earliestDate','latestDate'].forEach(field=>{if(batch[field]!==null&&!isDateKey(batch[field]))invalid('INVALID_WHOOP_IMPORTS',`La data ${field} di una importazione WHOOP non è valida.`);});
    });
    return value;
  }
  function validateWhoopConsistency(records,batches){
    Object.entries(whoopBatchKinds).forEach(([,dataset])=>validateWhoopRecords(dataset,records[dataset]));validateWhoopImportBatches(batches);
    const batchById=new Map(batches.map(batch=>[batch.id,batch]));
    Object.entries(whoopBatchKinds).forEach(([kind,dataset])=>{
      const byId=new Map(records[dataset].map(record=>[record.id,record]));
      records[dataset].forEach(record=>{const batch=batchById.get(record.source.batchId);if(!batch||!batch.addedIds[kind].includes(record.id))invalid('INVALID_WHOOP_LINKS','Una registrazione WHOOP non è collegata correttamente alla sua importazione.');});
      batches.forEach(batch=>batch.addedIds[kind].forEach(id=>{const record=byId.get(id);if(!record||record.source.batchId!==batch.id)invalid('INVALID_WHOOP_LINKS','Una importazione WHOOP fa riferimento a una registrazione mancante.');}));
    });
    return true;
  }
  function validateReconciliationDecisions(value){
    if(!Array.isArray(value)||value.length>100000)invalid('INVALID_RECONCILIATION','Lo storico degli abbinamenti non è valido.');const ids=new Set(),keys=new Set(),claimed={stravaActivityId:new Set(),whoopWorkoutId:new Set(),sessionId:new Set()};
    value.forEach(decision=>{
      if(!isObject(decision)||typeof decision.id!=='string'||!decision.id.trim()||typeof decision.key!=='string'||!decision.key.trim()||!['confirmed','dismissed'].includes(decision.status)||!isDateKey(decision.date)||!isTimestamp(decision.createdAt)||!isTimestamp(decision.updatedAt))invalid('INVALID_RECONCILIATION','Una decisione di abbinamento non è valida.');
      if(ids.has(decision.id)||keys.has(decision.key))invalid('INVALID_RECONCILIATION','Lo storico contiene decisioni di abbinamento duplicate.');ids.add(decision.id);keys.add(decision.key);
      const references=['stravaActivityId','whoopWorkoutId','sessionId'].filter(field=>decision[field]!==null&&decision[field]!==undefined);
      if(references.length<2||references.some(field=>typeof decision[field]!=='string'||!decision[field].trim()))invalid('INVALID_RECONCILIATION','Una decisione non collega almeno due fonti valide.');
      if(!isFiniteValue(decision.confidence)||Number(decision.confidence)<0||Number(decision.confidence)>1||!Array.isArray(decision.reasons)||decision.reasons.length>12||decision.reasons.some(reason=>typeof reason!=='string'||!reason.trim()))invalid('INVALID_RECONCILIATION','Affidabilità o motivazioni di un abbinamento non sono valide.');
      if(owns(decision,'replacesDecisionId')&&decision.replacesDecisionId!==null&&(typeof decision.replacesDecisionId!=='string'||!decision.replacesDecisionId.trim()))invalid('INVALID_RECONCILIATION','Il riferimento alla decisione precedente non è valido.');
      if(decision.status==='confirmed')references.forEach(field=>{if(claimed[field].has(decision[field]))invalid('INVALID_RECONCILIATION','Una fonte è stata confermata in più abbinamenti.');claimed[field].add(decision[field]);});
    });
    return value;
  }

  function validateProfilePhoto(value) {
    if (value === null) return value;
    if (typeof value !== 'string') invalid('INVALID_PHOTO','La foto profilo non è valida.');
    const match=/^data:image\/(?:jpeg|jpg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/i.exec(value);
    if (!match || match[1].length % 4 !== 0) invalid('INVALID_PHOTO','La foto profilo deve essere un’immagine raster in base64.');
    const payload=match[1];const padding=payload.endsWith('==')?2:payload.endsWith('=')?1:0;
    const bytes=Math.floor(payload.length*3/4)-padding;
    if (bytes > MAX_PROFILE_PHOTO_BYTES) invalid('PHOTO_TOO_LARGE','La foto profilo supera il limite di 2 MB.');
    return value;
  }
  function timeParts(value) {
    const parts = String(value || '').split(':').map(Number);
    if (parts.length === 3) return { hours:parts[0] || 0, minutes:parts[1] || 0, seconds:parts[2] || 0 };
    return { hours:0, minutes:parts[0] || 0, seconds:parts[1] || 0 };
  }
  function migratePersonalBests(value) {
    if (Array.isArray(value)) return clone(value);
    if (!isObject(value)) return [];
    const mapping = [
      ['fiveKm','run-5k','Corsa 5 km','running',5],
      ['tenKm','run-10k','Corsa 10 km','running',10],
      ['halfMarathon','run-half','Mezza maratona','running',21.0975],
      ['marathon','run-marathon','Maratona','running',42.195],
      ['hyroxOpen','hyrox-open','HYROX Individual Open','hyrox',null]
    ];
    return mapping.filter(([key]) => value[key]).map(([key,id,label,kind,distanceKm]) => ({
      id, label, kind, ...(distanceKm ? { distanceKm } : {}), ...timeParts(value[key])
    }));
  }
  function categorizeDevices(items) {
    const grouped = {};
    (Array.isArray(items) ? items : []).forEach(name => {
      let category = 'Altro';
      if (/whoop|watch|oura|suunto/i.test(name)) category = 'Wearable';
      else if (/polar|fascia|sensore|stryd|power meter/i.test(name)) category = 'Sensori';
      else if (/ride|tacx|neo|erg|rullo|tapis/i.test(name)) category = 'Cardio indoor';
      else if (/strava|mywhoosh|zwift|health|connect|trainingpeaks/i.test(name)) category = 'Piattaforme';
      (grouped[category] ||= []).push(name);
    });
    return grouped;
  }
  function normalizeProfile(value, legacyFtp = null) {
    if (value === null) return null;
    if (!isObject(value)) throw new DataStoreError('INVALID_PROFILE', 'Il profilo atleta non è valido.');
    if (owns(value,'schemaVersion')) {
      const version=Number(value.schemaVersion);
      if(!Number.isInteger(version)||version<1)invalid('INVALID_PROFILE','La versione del profilo atleta non è valida.');
      if(version>datasets.profile.version)invalid('FUTURE_PROFILE','Il profilo atleta proviene da una versione più recente dell’app.');
    }
    if (owns(value,'personalBests') && !Array.isArray(value.personalBests) && !isObject(value.personalBests)) invalid('INVALID_PROFILE','I personal best del profilo non sono validi.');
    if (owns(value,'strengthMaxes') && !isObject(value.strengthMaxes)) invalid('INVALID_PROFILE','I massimali del profilo non sono validi.');
    if (owns(value,'equipment') && !isObject(value.equipment)) invalid('INVALID_PROFILE','L’attrezzatura del profilo non è valida.');
    if (owns(value,'devices') && !Array.isArray(value.devices)) invalid('INVALID_PROFILE','I dispositivi legacy del profilo non sono validi.');
    const normalized = { ...clone(value) };
    if (Array.isArray(value.personalBests) || isObject(value.personalBests)) normalized.personalBests = migratePersonalBests(value.personalBests);
    else delete normalized.personalBests;
    normalized.strengthMaxes = { ...strengthDefaults, ...(isObject(value.strengthMaxes) ? value.strengthMaxes : {}) };
    if (!owns(normalized,'strengthFormula')) normalized.strengthFormula = 'epley';
    if (!owns(normalized,'hrZoneMethod')) normalized.hrZoneMethod = 'hrr';
    if (!owns(normalized,'ftpZoneMethod')) normalized.ftpZoneMethod = 'coggan7';
    if (!owns(normalized,'profileSetupComplete')) normalized.profileSetupComplete = true;
    if (!isObject(value.equipment) && Array.isArray(value.devices)) normalized.equipment = categorizeDevices(value.devices);
    const ftp = Number(value.ftp || legacyFtp);
    if (Number.isFinite(ftp) && ftp > 0) normalized.ftp = ftp;
    normalized.schemaVersion = 3;
    return validateProfile(normalized);
  }
  function normalizeSession(session) {
    if (!isObject(session)) throw new DataStoreError('INVALID_SESSIONS', 'Una seduta del backup non è valida.');
    if (owns(session,'details') && !isObject(session.details)) invalid('INVALID_SESSIONS','I dettagli di una seduta non sono validi.');
    const details = { ...(isObject(session.details) ? clone(session.details) : {}) };
    const runTypes = {Facile:'Easy run',Lungo:'Long run',Recupero:'Recovery run','Tempo / soglia':'Tempo / Threshold',Intervalli:'Intervals',Progressivo:'Progression run',Gara:'Race'};
    const rideTypes = {Endurance:'Endurance ride',Recupero:'Recovery ride',Tempo:'Tempo ride',Soglia:'Threshold ride',VO2max:'VO2max bike'};
    const hyroxTypes = {'Engine / conditioning':'HYROX engine','Stazioni tecniche':'HYROX stations','Simulation parziale':'HYROX partial simulation','Simulation completa':'HYROX full simulation'};
    if (runTypes[details.runType]) details.runType = runTypes[details.runType];
    if (rideTypes[details.rideType]) details.rideType = rideTypes[details.rideType];
    if (details.strengthFocus === 'Forza HYROX') details.strengthFocus = 'HYROX strength';
    if (hyroxTypes[details.hyroxFormat]) details.hyroxFormat = hyroxTypes[details.hyroxFormat];
    let outcome=null;
    if (session.outcome !== null && session.outcome !== undefined) {
      if (!isObject(session.outcome) || !outcomeStatuses.has(session.outcome.status)) invalid('INVALID_OUTCOME','Una registrazione post-allenamento usa uno stato non riconosciuto. I dati originali sono stati preservati.');
      outcome=clone(session.outcome);
    }
    return validateSession({ ...clone(session), details, outcome, titleMode:session.titleMode || 'custom' });
  }
  function normalizeSessions(value) {
    if (!Array.isArray(value)) throw new DataStoreError('INVALID_SESSIONS', 'L’elenco delle sedute non è valido.');
    return value.map(normalizeSession);
  }

  function validate(name, value) {
    switch (name) {
      case 'profile':
        return validateProfile(value);
      case 'hrZones':
        if (value !== null && (!Array.isArray(value) || value.length !== 5 || value.some(item => !Number.isFinite(Number(item))))) throw new DataStoreError('INVALID_HR_ZONES', 'Le zone cardiache non sono valide.');
        break;
      case 'profilePhoto':
        return validateProfilePhoto(value);
      case 'sessions':
        if (!Array.isArray(value)) throw new DataStoreError('INVALID_SESSIONS', 'L’elenco delle sedute non è valido.');
        value.forEach(validateSession);
        return value;
      case 'weeklyCheckin':
        return validateWeeklyCheckin(value);
      case 'weeklyAvailabilityHistory':
        return validateWeeklyAvailabilityHistory(value);
      case 'preSessionCheckins':
        return validatePreSessionCheckins(value);
      case 'bodyIssues':
        return validateBodyIssues(value);
      case 'importedActivities':
        return validateImportedActivities(value);
      case 'importBatches':
        return validateImportBatches(value);
      case 'whoopCycles':
      case 'whoopSleeps':
      case 'whoopWorkouts':
      case 'whoopJournal':
        return validateWhoopRecords(name,value);
      case 'whoopImportBatches':
        return validateWhoopImportBatches(value);
      case 'reconciliationDecisions':
        return validateReconciliationDecisions(value);
      case 'goals':
        return validateGoals(value);
      case 'planView':
        if (!['list','calendar'].includes(value)) throw new DataStoreError('INVALID_PREFERENCE', 'La preferenza del piano non è valida.');
        break;
      case 'uiTheme':
        if (!['auto','dark','light'].includes(value)) throw new DataStoreError('INVALID_PREFERENCE', 'Il tema dell’interfaccia non è valido.');
        break;
      case 'cloudSyncCursor':
        if(value!==null&&(!isObject(value)||typeof value.userId!=='string'||!value.userId.trim()||!Number.isInteger(Number(value.revision))||Number(value.revision)<1||!/^athlete-[0-9a-f]{8}$/.test(String(value.fingerprint||''))||!isTimestamp(value.updatedAt)))throw new DataStoreError('INVALID_CLOUD_SYNC_CURSOR','Lo stato locale della sincronizzazione cloud non è valido.');
        break;
    }
    return value;
  }

  function parseBackup(raw) {
    if (typeof raw === 'string') {
      try { return JSON.parse(raw); }
      catch (_) { throw new DataStoreError('INVALID_JSON', 'Il file non contiene JSON valido.'); }
    }
    if (!isObject(raw)) throw new DataStoreError('INVALID_BACKUP', 'Il backup non è valido.');
    return clone(raw);
  }

  function entryValue(data, name, definition = datasets[name]) {
    const entry = data[name];
    if (!isObject(entry) || !Object.prototype.hasOwnProperty.call(entry,'value')) throw new DataStoreError('INCOMPLETE_BACKUP', `Nel backup manca il dataset ${name}.`);
    const version = Number(entry.version);
    if (!definition || !Number.isInteger(version) || version < 1) throw new DataStoreError('INVALID_DATASET_VERSION', `La versione del dataset ${name} non è valida.`);
    if (version > definition.version) throw new DataStoreError('FUTURE_DATASET', `Il dataset ${name} proviene da una versione più recente dell’app.`);
    return clone(entry.value);
  }

  function prepareFullBackup(backup) {
    const sourceVersion=Number(backup.backupVersion);
    if (sourceVersion > BACKUP_VERSION) throw new DataStoreError('FUTURE_BACKUP', 'Questo backup è stato creato da una versione più recente dell’app.');
    if (![3,4,5,6,7,8,BACKUP_VERSION].includes(sourceVersion) || !isObject(backup.data)) throw new DataStoreError('UNSUPPORTED_BACKUP', 'Versione del backup non supportata.');
    const rawProfile = entryValue(backup.data,'profile');
    const profile = normalizeProfile(rawProfile);
    const weeklyCheckin=entryValue(backup.data,'weeklyCheckin');
    const values = {
      profile,
      hrZones:entryValue(backup.data,'hrZones'),
      profilePhoto:entryValue(backup.data,'profilePhoto'),
      sessions:normalizeSessions(entryValue(backup.data,'sessions')),
      weeklyCheckin,
      weeklyAvailabilityHistory:sourceVersion>=4
        ? entryValue(backup.data,'weeklyAvailabilityHistory')
        : weeklyCheckin?[{...clone(weeklyCheckin),...(weeklyCheckin.updatedAt?{createdAt:weeklyCheckin.updatedAt}:{})}]:[],
      preSessionCheckins:entryValue(backup.data,'preSessionCheckins'),
      bodyIssues:entryValue(backup.data,'bodyIssues'),
      importedActivities:sourceVersion>=5?entryValue(backup.data,'importedActivities'):[],
      importBatches:sourceVersion>=5?entryValue(backup.data,'importBatches'):[],
      whoopCycles:sourceVersion>=6?entryValue(backup.data,'whoopCycles'):[],
      whoopSleeps:sourceVersion>=6?entryValue(backup.data,'whoopSleeps'):[],
      whoopWorkouts:sourceVersion>=6?entryValue(backup.data,'whoopWorkouts'):[],
      whoopJournal:sourceVersion>=6?entryValue(backup.data,'whoopJournal'):[],
      whoopImportBatches:sourceVersion>=6?entryValue(backup.data,'whoopImportBatches'):[],
      reconciliationDecisions:sourceVersion>=7?entryValue(backup.data,'reconciliationDecisions'):[],
      goals:sourceVersion>=8?entryValue(backup.data,'goals'):[]
    };
    const preferences = entryValue(backup.data,'preferences',datasets.planView);
    if (!isObject(preferences)) throw new DataStoreError('INVALID_PREFERENCES', 'Le preferenze del backup non sono valide.');
    values.planView = preferences.planView || 'list';
    values.uiTheme = sourceVersion>=9 ? preferences.uiTheme : 'auto';
    values.cloudSyncCursor = Object.prototype.hasOwnProperty.call(preferences,'cloudSyncCursor') ? preferences.cloudSyncCursor : null;
    Object.entries(values).forEach(([name,value]) => validate(name,value));
    validateImportConsistency(values.importedActivities,values.importBatches);
    validateWhoopConsistency(values,values.whoopImportBatches);
    return { mode:'full', values, exportedAt:backup.exportedAt || null, sourceVersion };
  }

  function prepareLegacyBackup(backup) {
    const version = Number(backup.exportVersion || 0);
    if (version > 2) throw new DataStoreError('FUTURE_BACKUP', 'Questo backup profilo proviene da una versione più recente dell’app.');
    if (!isObject(backup.athlete) || !String(backup.athlete.firstName || '').trim()) throw new DataStoreError('INVALID_BACKUP', 'Il backup profilo non è valido.');
    const profileData = clone(backup.athlete);
    const hrZones = profileData.hrZones;
    delete profileData.hrZones;
    const profile = normalizeProfile(profileData);
    validate('profile',profile);
    const values = { profile };
    if (Array.isArray(hrZones)) { validate('hrZones',hrZones); values.hrZones = hrZones.map(Number); }
    if (typeof backup.profilePhoto === 'string' && backup.profilePhoto) { validate('profilePhoto',backup.profilePhoto); values.profilePhoto = backup.profilePhoto; }
    return { mode:'partial', values, exportedAt:backup.exportedAt || null, sourceVersion:version || 1 };
  }

  function prepareBackup(raw) {
    const backup = parseBackup(raw);
    if (Object.prototype.hasOwnProperty.call(backup,'backupVersion')) return prepareFullBackup(backup);
    if (Object.prototype.hasOwnProperty.call(backup,'athlete')) return prepareLegacyBackup(backup);
    throw new DataStoreError('INVALID_BACKUP', 'Il file non è un backup di Re Carlo V.');
  }

  function create(storage, environment = {}) {
    if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function' || typeof storage.removeItem !== 'function') throw new TypeError('Serve un archivio compatibile con localStorage.');
    const now = environment.now || (() => new Date());
    const dispatch = environment.dispatch || (() => {});
    let health = { migrated:[], warnings:[], rollbackIncomplete:[] };

    function read(name) {
      const definition = datasets[name];
      if (!definition) throw new DataStoreError('UNKNOWN_DATASET', `Dataset sconosciuto: ${name}`);
      const raw = storage.getItem(definition.key);
      if (raw === null) return clone(definition.fallback);
      if (definition.kind === 'raw') return raw;
      try { return JSON.parse(raw); }
      catch (_) { throw new DataStoreError('CORRUPT_DATA', `I dati locali di ${name} non sono leggibili. Esporta o conserva una copia prima di modificarli.`); }
    }

    function write(name, value) {
      const definition = datasets[name];
      if (!definition) throw new DataStoreError('UNKNOWN_DATASET', `Dataset sconosciuto: ${name}`);
      validate(name,value);
      if (value === null) { storage.removeItem(definition.key); return; }
      storage.setItem(definition.key, definition.kind === 'json' ? JSON.stringify(value) : String(value));
    }

    function remember(touched,key) {
      if (!touched.has(key)) touched.set(key,storage.getItem(key));
    }

    function rollbackTouched(touched) {
      const entries=[...touched.entries()].reverse();
      entries.forEach(([key,value]) => {
        try { if (value === null) storage.removeItem(key); else storage.setItem(key,value); } catch (_) {}
      });
      const failed=[];
      entries.forEach(([key,value]) => {
        try { if (storage.getItem(key) !== value) failed.push(key); }
        catch (_) { failed.push(key); }
      });
      return { complete:failed.length===0, failedKeys:failed };
    }

    function bootstrap() {
      const result = { migrated:[], warnings:[], rollbackIncomplete:[] };
      const profileTouched=new Map();
      try {
        const raw = storage.getItem(datasets.profile.key);
        if (raw !== null) {
          const parsed = JSON.parse(raw);
          const normalized = normalizeProfile(parsed,storage.getItem(datasets.legacyFtp.key));
          let changed=false;
          if (JSON.stringify(parsed) !== JSON.stringify(normalized)) {
            remember(profileTouched,datasets.profile.key);write('profile',normalized);changed=true;
          }
          if (Number(normalized?.ftp) > 0 && storage.getItem(datasets.legacyFtp.key) !== String(normalized.ftp)) {
            remember(profileTouched,datasets.legacyFtp.key);storage.setItem(datasets.legacyFtp.key,String(normalized.ftp));changed=true;
          }
          if(changed)result.migrated.push('profile');
        }
      } catch (_) {
        const rollback=rollbackTouched(profileTouched);
        if(!rollback.complete)result.rollbackIncomplete.push('profile');
        result.warnings.push('profile');
        result.migrated=result.migrated.filter(item=>item!=='profile');
      }
      const sessionsTouched=new Map();
      try {
        const raw = storage.getItem(datasets.sessions.key);
        if (raw !== null) {
          const parsed = JSON.parse(raw); const normalized = normalizeSessions(parsed);
          if (JSON.stringify(parsed) !== JSON.stringify(normalized)) {
            remember(sessionsTouched,datasets.sessions.key);write('sessions',normalized);result.migrated.push('sessions');
          }
        }
      } catch (_) {
        const rollback=rollbackTouched(sessionsTouched);
        if(!rollback.complete)result.rollbackIncomplete.push('sessions');
        result.warnings.push('sessions');
        result.migrated=result.migrated.filter(item=>item!=='sessions');
      }
      ['hrZones','profilePhoto','weeklyCheckin','weeklyAvailabilityHistory','preSessionCheckins','bodyIssues','importedActivities','importBatches','whoopCycles','whoopSleeps','whoopWorkouts','whoopJournal','whoopImportBatches','reconciliationDecisions','goals','planView','uiTheme','cloudSyncCursor'].forEach(name=>{
        try {
          const definition=datasets[name];const raw=storage.getItem(definition.key);
          if(raw===null)return;
          const value=definition.kind==='json'?JSON.parse(raw):raw;
          validate(name,value);
        } catch (_) { result.warnings.push(name); }
      });
      if(!result.warnings.includes('importedActivities')&&!result.warnings.includes('importBatches')){
        try{validateImportConsistency(read('importedActivities'),read('importBatches'));}
        catch(_){result.warnings.push('importedActivities','importBatches');}
      }
      const whoopNames=['whoopCycles','whoopSleeps','whoopWorkouts','whoopJournal','whoopImportBatches'];
      if(whoopNames.every(name=>!result.warnings.includes(name))){
        try{validateWhoopConsistency({whoopCycles:read('whoopCycles'),whoopSleeps:read('whoopSleeps'),whoopWorkouts:read('whoopWorkouts'),whoopJournal:read('whoopJournal')},read('whoopImportBatches'));}
        catch(_){result.warnings.push(...whoopNames);}
      }
      if(!result.warnings.includes('weeklyCheckin')&&!result.warnings.includes('weeklyAvailabilityHistory')){
        const weekly=read('weeklyCheckin');
        if(weekly){
          const history=read('weeklyAvailabilityHistory');const index=history.findIndex(item=>item.weekStart===weekly.weekStart);
          const existing=index>=0?history[index]:null;const record={...(existing||{}),...clone(weekly),createdAt:existing?.createdAt||weekly.updatedAt||now().toISOString()};
          const next=index>=0?history.map((item,itemIndex)=>itemIndex===index?record:item):[...history,record];
          next.sort((a,b)=>a.weekStart.localeCompare(b.weekStart));
          if(JSON.stringify(history)!==JSON.stringify(next)){
            try{write('weeklyAvailabilityHistory',next);result.migrated.push('weeklyAvailabilityHistory');}
            catch(_){result.warnings.push('weeklyAvailabilityHistory');}
          }
        }
      }
      health=clone(result);return result;
    }

    function createSnapshot() {
      let profile = read('profile');
      profile = normalizeProfile(profile,read('legacyFtp'));
      const data = {
        profile:{version:datasets.profile.version,value:profile},
        hrZones:{version:datasets.hrZones.version,value:read('hrZones')},
        profilePhoto:{version:datasets.profilePhoto.version,value:read('profilePhoto')},
        sessions:{version:datasets.sessions.version,value:normalizeSessions(read('sessions'))},
        weeklyCheckin:{version:datasets.weeklyCheckin.version,value:read('weeklyCheckin')},
        weeklyAvailabilityHistory:{version:datasets.weeklyAvailabilityHistory.version,value:read('weeklyAvailabilityHistory')},
        preSessionCheckins:{version:datasets.preSessionCheckins.version,value:read('preSessionCheckins')},
        bodyIssues:{version:datasets.bodyIssues.version,value:read('bodyIssues')},
        importedActivities:{version:datasets.importedActivities.version,value:read('importedActivities')},
        importBatches:{version:datasets.importBatches.version,value:read('importBatches')},
        whoopCycles:{version:datasets.whoopCycles.version,value:read('whoopCycles')},
        whoopSleeps:{version:datasets.whoopSleeps.version,value:read('whoopSleeps')},
        whoopWorkouts:{version:datasets.whoopWorkouts.version,value:read('whoopWorkouts')},
        whoopJournal:{version:datasets.whoopJournal.version,value:read('whoopJournal')},
        whoopImportBatches:{version:datasets.whoopImportBatches.version,value:read('whoopImportBatches')},
        reconciliationDecisions:{version:datasets.reconciliationDecisions.version,value:read('reconciliationDecisions')},
        goals:{version:datasets.goals.version,value:read('goals')},
        preferences:{version:datasets.planView.version,value:{planView:read('planView'),uiTheme:read('uiTheme'),cloudSyncCursor:read('cloudSyncCursor')}}
      };
      prepareFullBackup({ backupVersion:BACKUP_VERSION, data });
      return { app:APP_NAME, backupVersion:BACKUP_VERSION, exportedAt:now().toISOString(), data };
    }

    function createCloudSnapshot(){
      const result=createSnapshot();result.data.preferences.value.cloudSyncCursor=null;return result;
    }

    function inspectBackup(raw) {
      const prepared = prepareBackup(raw); const values = prepared.values;
      return {
        mode:prepared.mode,
        sourceVersion:prepared.sourceVersion,
        exportedAt:prepared.exportedAt,
        sessions:Array.isArray(values.sessions) ? values.sessions.length : null,
        weeklyAvailabilityWeeks:Array.isArray(values.weeklyAvailabilityHistory) ? values.weeklyAvailabilityHistory.length : null,
        preSessionCheckins:Array.isArray(values.preSessionCheckins) ? values.preSessionCheckins.length : null,
        bodyIssues:Array.isArray(values.bodyIssues) ? values.bodyIssues.length : null,
        importedActivities:Array.isArray(values.importedActivities) ? values.importedActivities.length : null,
        importBatches:Array.isArray(values.importBatches) ? values.importBatches.length : null,
        whoopCycles:Array.isArray(values.whoopCycles) ? values.whoopCycles.length : null,
        whoopSleeps:Array.isArray(values.whoopSleeps) ? values.whoopSleeps.length : null,
        whoopWorkouts:Array.isArray(values.whoopWorkouts) ? values.whoopWorkouts.length : null,
        reconciliationDecisions:Array.isArray(values.reconciliationDecisions) ? values.reconciliationDecisions.length : null,
        goals:Array.isArray(values.goals) ? values.goals.length : null,
        athleteName:values.profile ? [values.profile.firstName,values.profile.lastName].filter(Boolean).join(' ') : ''
      };
    }

    function restorePrepared(prepared,{preserveCloudSyncCursor=false}={}) {
      const touched = new Map();
      const apply = (name,value) => { const key=datasets[name].key; remember(touched,key); write(name,value); };
      try {
        Object.entries(prepared.values).forEach(([name,value]) => {if(preserveCloudSyncCursor&&name==='cloudSyncCursor')return;apply(name,value);});
        if (Object.prototype.hasOwnProperty.call(prepared.values,'profile')) {
          const key=datasets.legacyFtp.key; remember(touched,key); const ftp=Number(prepared.values.profile?.ftp);
          if (Number.isFinite(ftp) && ftp > 0) storage.setItem(key,String(ftp));
          else if (prepared.mode === 'full') storage.removeItem(key);
        }
      } catch (error) {
        const rollback=rollbackTouched(touched);
        if(!rollback.complete){
          const failure=new DataStoreError('ROLLBACK_INCOMPLETE',`Il ripristino è stato interrotto e non è stato possibile recuperare completamente i dati precedenti. Chiavi da verificare: ${rollback.failedKeys.join(', ')}.`);
          failure.failedKeys=rollback.failedKeys;throw failure;
        }
        throw new DataStoreError('RESTORE_FAILED', `Ripristino annullato senza modificare i dati: ${error.message || 'errore di scrittura'}`);
      }
      const detail = { mode:prepared.mode, restoredAt:now().toISOString(), datasets:Object.keys(prepared.values).filter(name=>!(preserveCloudSyncCursor&&name==='cloudSyncCursor')) };
      dispatch(detail); return detail;
    }

    function restoreBackup(raw){return restorePrepared(prepareBackup(raw));}
    function restoreCloudSnapshot(raw){return restorePrepared(prepareBackup(raw),{preserveCloudSyncCursor:true});}

    function writeImportState(nextActivities,nextBatches,detail,nextDecisions=null) {
      validateImportConsistency(nextActivities,nextBatches);if(nextDecisions!==null)validateReconciliationDecisions(nextDecisions);const touched=new Map();
      try{
        remember(touched,datasets.importedActivities.key);write('importedActivities',nextActivities);
        remember(touched,datasets.importBatches.key);write('importBatches',nextBatches);
        if(nextDecisions!==null){remember(touched,datasets.reconciliationDecisions.key);write('reconciliationDecisions',nextDecisions);}
      }catch(error){
        const rollback=rollbackTouched(touched);
        if(!rollback.complete){
          const failure=new DataStoreError('ROLLBACK_INCOMPLETE',`L’aggiornamento delle attività è stato interrotto e alcune chiavi devono essere verificate: ${rollback.failedKeys.join(', ')}.`);
          failure.failedKeys=rollback.failedKeys;throw failure;
        }
        throw new DataStoreError('IMPORT_WRITE_FAILED',`Importazione annullata senza modificare i dati: ${error.message||'errore di scrittura'}`);
      }
      dispatch(detail);return detail;
    }

    function commitImportBatch(batch,activities) {
      validateImportBatches([batch]);validateImportedActivities(activities);
      const activityIds=activities.map(activity=>activity.id).sort();const batchIds=batch.addedIds.slice().sort();
      if(JSON.stringify(activityIds)!==JSON.stringify(batchIds)||activities.some(activity=>activity.source.batchId!==batch.id))throw new DataStoreError('INVALID_IMPORT_LINKS','Le attività da importare non corrispondono al riepilogo dell’importazione.');
      const currentActivities=read('importedActivities');const currentBatches=read('importBatches');validateImportConsistency(currentActivities,currentBatches);
      if(currentBatches.some(item=>item.id===batch.id))throw new DataStoreError('DUPLICATE_IMPORT_BATCH','Questa importazione è già presente.');
      const known=new Set(currentActivities.map(activity=>activity.id));if(activities.some(activity=>known.has(activity.id)))throw new DataStoreError('DUPLICATE_IMPORTED_ACTIVITY','Una o più attività risultano già importate. Aggiorna l’anteprima prima di riprovare.');
      const nextActivities=[...currentActivities,...clone(activities)].sort((a,b)=>a.localStart.localeCompare(b.localStart));const nextBatches=[...currentBatches,clone(batch)].sort((a,b)=>a.importedAt.localeCompare(b.importedAt));
      return writeImportState(nextActivities,nextBatches,{type:'activity-import',provider:batch.provider,batchId:batch.id,added:activities.length,importedAt:batch.importedAt});
    }

    function removeImportBatch(batchId) {
      const currentActivities=read('importedActivities');const currentBatches=read('importBatches');validateImportConsistency(currentActivities,currentBatches);
      const batch=currentBatches.find(item=>item.id===batchId);if(!batch)throw new DataStoreError('UNKNOWN_IMPORT_BATCH','L’importazione selezionata non esiste più.');
      const removeIds=new Set(batch.addedIds);const nextActivities=currentActivities.filter(activity=>!removeIds.has(activity.id));const nextBatches=currentBatches.filter(item=>item.id!==batchId);const nextDecisions=read('reconciliationDecisions').filter(item=>!item.stravaActivityId||!removeIds.has(item.stravaActivityId));
      return writeImportState(nextActivities,nextBatches,{type:'activity-import-removed',provider:batch.provider,batchId:batch.id,removed:batch.addedIds.length,removedAt:now().toISOString()},nextDecisions);
    }

    function readWhoopState(){return{whoopCycles:read('whoopCycles'),whoopSleeps:read('whoopSleeps'),whoopWorkouts:read('whoopWorkouts'),whoopJournal:read('whoopJournal')};}
    function writeWhoopImportState(nextRecords,nextBatches,detail,nextDecisions=null){
      validateWhoopConsistency(nextRecords,nextBatches);if(nextDecisions!==null)validateReconciliationDecisions(nextDecisions);const touched=new Map();
      try{
        Object.values(whoopBatchKinds).forEach(name=>{remember(touched,datasets[name].key);write(name,nextRecords[name]);});
        remember(touched,datasets.whoopImportBatches.key);write('whoopImportBatches',nextBatches);
        if(nextDecisions!==null){remember(touched,datasets.reconciliationDecisions.key);write('reconciliationDecisions',nextDecisions);}
      }catch(error){
        const rollback=rollbackTouched(touched);
        if(!rollback.complete){const failure=new DataStoreError('ROLLBACK_INCOMPLETE',`L’importazione WHOOP è stata interrotta e alcune chiavi devono essere verificate: ${rollback.failedKeys.join(', ')}.`);failure.failedKeys=rollback.failedKeys;throw failure;}
        throw new DataStoreError('WHOOP_IMPORT_WRITE_FAILED',`Importazione WHOOP annullata senza modificare i dati: ${error.message||'errore di scrittura'}`);
      }
      dispatch(detail);return detail;
    }
    function commitWhoopImportBatch(batch,records){
      validateWhoopImportBatches([batch]);const incoming={};
      Object.entries(whoopBatchKinds).forEach(([kind,dataset])=>{incoming[dataset]=clone(records[kind]||[]);validateWhoopRecords(dataset,incoming[dataset]);const ids=incoming[dataset].map(item=>item.id).sort();const batchIds=batch.addedIds[kind].slice().sort();if(JSON.stringify(ids)!==JSON.stringify(batchIds)||incoming[dataset].some(item=>item.source.batchId!==batch.id))throw new DataStoreError('INVALID_WHOOP_LINKS','Le registrazioni WHOOP non corrispondono al riepilogo dell’importazione.');});
      const current=readWhoopState();const batches=read('whoopImportBatches');validateWhoopConsistency(current,batches);
      if(batches.some(item=>item.id===batch.id))throw new DataStoreError('DUPLICATE_WHOOP_IMPORT','Questa importazione WHOOP è già presente.');
      const next={};
      Object.entries(whoopBatchKinds).forEach(([,dataset])=>{const known=new Set(current[dataset].map(item=>item.id));if(incoming[dataset].some(item=>known.has(item.id)))throw new DataStoreError('DUPLICATE_WHOOP_RECORD','Una o più registrazioni WHOOP risultano già importate. Aggiorna l’anteprima prima di riprovare.');const sortField=dataset==='whoopWorkouts'?'start':dataset==='whoopSleeps'?'sleepStart':'cycleStart';next[dataset]=[...current[dataset],...incoming[dataset]].sort((a,b)=>String(a[sortField]).localeCompare(String(b[sortField])));});
      const nextBatches=[...batches,clone(batch)].sort((a,b)=>a.importedAt.localeCompare(b.importedAt));const added=Object.values(batch.addedIds).reduce((sum,ids)=>sum+ids.length,0);
      return writeWhoopImportState(next,nextBatches,{type:'whoop-import',provider:'whoop',batchId:batch.id,added,importedAt:batch.importedAt});
    }
    function commitWhoopApiSync(batch,records){
      validateWhoopImportBatches([batch]);if(batch.sourceMode!=='api'||!isObject(batch.updatedIds))throw new DataStoreError('INVALID_WHOOP_SYNC','La sincronizzazione WHOOP non è valida.');
      const current=readWhoopState();const batches=read('whoopImportBatches');validateWhoopConsistency(current,batches);if(batches.some(item=>item.id===batch.id))throw new DataStoreError('DUPLICATE_WHOOP_IMPORT','Questa sincronizzazione WHOOP è già presente.');const next={};
      Object.entries(whoopBatchKinds).forEach(([kind,dataset])=>{
        const incoming=clone(records[kind]||[]);validateWhoopRecords(dataset,incoming);const currentById=new Map(current[dataset].map(item=>[item.id,item]));const incomingIds=incoming.map(item=>item.id).sort();const expectedIds=[...batch.addedIds[kind],...batch.updatedIds[kind]].sort();
        if(JSON.stringify(incomingIds)!==JSON.stringify(expectedIds))throw new DataStoreError('INVALID_WHOOP_SYNC_LINKS','I dati ricevuti da WHOOP non corrispondono al riepilogo della sincronizzazione.');
        batch.addedIds[kind].forEach(id=>{const record=incoming.find(item=>item.id===id);if(currentById.has(id)||record?.source?.batchId!==batch.id)throw new DataStoreError('INVALID_WHOOP_SYNC_LINKS','Una nuova registrazione WHOOP non è collegata correttamente.');});
        batch.updatedIds[kind].forEach(id=>{const previous=currentById.get(id);const record=incoming.find(item=>item.id===id);if(!previous||!record||record.source.batchId!==previous.source.batchId)throw new DataStoreError('INVALID_WHOOP_SYNC_LINKS','Un aggiornamento WHOOP non conserva la propria provenienza.');});
        incoming.forEach(item=>currentById.set(item.id,item));const sortField=dataset==='whoopWorkouts'?'start':dataset==='whoopSleeps'?'sleepStart':'cycleStart';next[dataset]=[...currentById.values()].sort((a,b)=>String(a[sortField]).localeCompare(String(b[sortField])));
      });
      const nextBatches=[...batches,clone(batch)].sort((a,b)=>a.importedAt.localeCompare(b.importedAt));const added=Object.values(batch.addedIds).reduce((sum,ids)=>sum+ids.length,0);const updated=Object.values(batch.updatedIds).reduce((sum,ids)=>sum+ids.length,0);
      return writeWhoopImportState(next,nextBatches,{type:'whoop-api-sync',provider:'whoop',batchId:batch.id,added,updated,importedAt:batch.importedAt});
    }
    function removeWhoopImportBatch(batchId){
      const current=readWhoopState();const batches=read('whoopImportBatches');validateWhoopConsistency(current,batches);const batch=batches.find(item=>item.id===batchId);if(!batch)throw new DataStoreError('UNKNOWN_WHOOP_IMPORT','L’importazione WHOOP selezionata non esiste più.');const next={};
      Object.entries(whoopBatchKinds).forEach(([kind,dataset])=>{const removeIds=new Set(batch.addedIds[kind]);next[dataset]=current[dataset].filter(item=>!removeIds.has(item.id));});
      const removedWorkoutIds=new Set(batch.addedIds.workouts);const nextDecisions=read('reconciliationDecisions').filter(item=>!item.whoopWorkoutId||!removedWorkoutIds.has(item.whoopWorkoutId));const removed=Object.values(batch.addedIds).reduce((sum,ids)=>sum+ids.length,0);return writeWhoopImportState(next,batches.filter(item=>item.id!==batchId),{type:'whoop-import-removed',provider:'whoop',batchId,removed,removedAt:now().toISOString()},nextDecisions);
    }

    function mergeReconciliationDecision(current,incoming){
      const decision=clone(incoming);validateReconciliationDecisions([decision]);const existing=current.find(item=>item.id===decision.id||item.key===decision.key);if(existing)decision.createdAt=existing.createdAt;
      let next=current.filter(item=>item.id!==decision.id&&item.key!==decision.key);
      if(decision.status==='confirmed'){
        const overlapping=next.filter(item=>item.status==='confirmed'&&['stravaActivityId','whoopWorkoutId','sessionId'].some(field=>decision[field]&&item[field]===decision[field]));
        if(overlapping.some(item=>item.id!==decision.replacesDecisionId))throw new DataStoreError('RECONCILIATION_CONFLICT','Una delle fonti è già collegata a un altro abbinamento. Annullalo prima di continuare.');
        next=next.filter(item=>!overlapping.includes(item));
      }
      next.push(decision);next.sort((a,b)=>a.updatedAt.localeCompare(b.updatedAt));validateReconciliationDecisions(next);return next;
    }
    function saveReconciliationDecisions(decisions){
      if(!Array.isArray(decisions)||!decisions.length)throw new DataStoreError('INVALID_RECONCILIATION','Non ci sono decisioni di abbinamento da salvare.');let next=read('reconciliationDecisions');validateReconciliationDecisions(next);decisions.forEach(decision=>{next=mergeReconciliationDecision(next,decision);});write('reconciliationDecisions',next);const detail={type:'reconciliation-updated',saved:decisions.length,updatedAt:now().toISOString()};dispatch(detail);return detail;
    }
    function saveReconciliationDecision(decision){return saveReconciliationDecisions([decision]);}
    function removeReconciliationDecision(decisionId){
      const current=read('reconciliationDecisions');validateReconciliationDecisions(current);const next=current.filter(item=>item.id!==decisionId);if(next.length===current.length)throw new DataStoreError('UNKNOWN_RECONCILIATION','L’abbinamento selezionato non esiste più.');write('reconciliationDecisions',next);const detail={type:'reconciliation-removed',decisionId,removedAt:now().toISOString()};dispatch(detail);return detail;
    }

    function downloadBackup() {
      if (typeof document === 'undefined' || typeof URL === 'undefined' || typeof Blob === 'undefined') throw new DataStoreError('DOWNLOAD_UNAVAILABLE', 'Il download non è disponibile in questo ambiente.');
      const snapshot = createSnapshot();
      const blob = new Blob([JSON.stringify(snapshot,null,2)],{type:'application/json'});
      const link = document.createElement('a'); const url = URL.createObjectURL(blob);
      link.href=url; link.download=`re-carlo-v-backup-completo-${snapshot.exportedAt.slice(0,10)}.json`; link.click();
      setTimeout(() => URL.revokeObjectURL(url),0);
      return snapshot;
    }

    return { bootstrap, health:()=>clone(health), getDataset:read, setDataset:write, createSnapshot, createCloudSnapshot, inspectBackup, restoreBackup, restoreCloudSnapshot, commitImportBatch, removeImportBatch, commitWhoopImportBatch, commitWhoopApiSync, removeWhoopImportBatch, saveReconciliationDecision, saveReconciliationDecisions, removeReconciliationDecision, downloadBackup };
  }

  return {
    APP_NAME, BACKUP_VERSION, MAX_PROFILE_PHOTO_BYTES, DATASETS:datasets, ALL_KEYS:allKeys, DataStoreError,
    create, prepareBackup, normalizeProfile, normalizeSessions, validateImportConsistency, validateWhoopConsistency, validateReconciliationDecisions
  };
});
