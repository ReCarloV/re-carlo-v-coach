(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.rcCheckinModel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const LOWER_PATTERN = /^(hip|quad|knee|ankle|glute|hamstring|calf)(-|$)/;
  const UPPER_PATTERN = /^(shoulder|elbow|wrist)(-|$)/;
  const TRUNK_PATTERN = /^(chest|upper-back|lower-back|neck)(-|$)/;
  const LOWER_LABEL = /(anca|quadricipite|ginocchio|caviglia|gluteo|femorale|polpaccio)/i;
  const UPPER_LABEL = /(spalla|gomito|polso)/i;
  const TRUNK_LABEL = /(petto|dorso|schiena|lombare|collo)/i;

  function iso(date) {
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  }
  function timestampDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : iso(date);
  }
  function dateFor(checkin) {
    return checkin?.sessionDate || timestampDate(checkin?.createdAt);
  }
  function normalizeSessionId(value) {
    return value === undefined || value === null || value === '' ? null : String(value);
  }
  function checkinsForDate(history, date) {
    return (Array.isArray(history) ? history : [])
      .filter(item => dateFor(item) === date)
      .sort((a,b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
  }
  function findCheckin(history, sessionId, sessionDate, options = {}) {
    const wantedId = normalizeSessionId(sessionId);
    const items = checkinsForDate(history,sessionDate);
    const exact = items.find(item => normalizeSessionId(item.sessionId) === wantedId);
    if (exact) return exact;
    if (wantedId && options.fallbackGeneric) return items.find(item => normalizeSessionId(item.sessionId) === null) || null;
    return null;
  }
  function upsertCheckin(history, value, options = {}) {
    const items = Array.isArray(history) ? history : [];
    const now = typeof options.now === 'function' ? options.now() : (options.now || new Date().toISOString());
    const sessionId = normalizeSessionId(value.sessionId);
    const sessionDate = value.sessionDate || timestampDate(value.createdAt || now);
    const byId = value.id ? items.find(item => item.id === value.id) : null;
    const legacyByCreatedAt = !byId && value.createdAt ? items.find(item => !item.id && item.createdAt === value.createdAt) : null;
    const existing = byId || legacyByCreatedAt || findCheckin(items,sessionId,sessionDate);
    const idFactory = options.idFactory || (() => `pre-${sessionDate}-${sessionId || 'giorno'}-${String(now).replace(/\D/g,'')}`);
    const id = existing?.id || value.id || idFactory();
    const createdAt = existing?.createdAt || value.createdAt || now;
    const saved = {...(existing || {}),...value,id,sessionId,sessionDate,createdAt,updatedAt:now};
    const remaining = items.filter(item => {
      if (item.id && item.id === id) return false;
      if (existing && !existing.id && !item.id && item.createdAt === existing.createdAt && dateFor(item) === dateFor(existing) && normalizeSessionId(item.sessionId) === normalizeSessionId(existing.sessionId)) return false;
      return !(dateFor(item) === sessionDate && normalizeSessionId(item.sessionId) === sessionId);
    });
    return {history:[...remaining,saved],value:saved,created:!existing};
  }
  function upsertWeeklyAvailability(history, value, options = {}) {
    const items=Array.isArray(history)?history:[];
    const now=typeof options.now==='function'?options.now():(options.now||new Date().toISOString());
    const weekStart=value?.weekStart;
    const existing=items.find(item=>item?.weekStart===weekStart)||null;
    const saved={...(existing||{}),...value,weekStart,createdAt:existing?.createdAt||value?.createdAt||now,updatedAt:now};
    const next=items.filter(item=>item?.weekStart!==weekStart).concat(saved).sort((a,b)=>String(a.weekStart||'').localeCompare(String(b.weekStart||'')));
    return {history:next,value:saved,created:!existing};
  }

  function clampDuration(value, options = {}) {
    const min = Number(options.min) || 15;
    const max = Number(options.max) || 240;
    const step = Number(options.step) || 5;
    const parsed = Number(value);
    const safe = Number.isFinite(parsed) ? parsed : min;
    const stepped = min + Math.round((safe-min)/step)*step;
    return Math.max(min,Math.min(max,stepped));
  }
  function formatItalianDate(value) {
    const date = new Date(`${value}T12:00:00`);
    if (Number.isNaN(date.getTime())) return String(value || '');
    return date.toLocaleDateString('it-IT',{weekday:'long',day:'numeric',month:'long'});
  }

  function regionForIssue(issue = {}) {
    const zone = String(issue.zone || '');
    const label = String(issue.zoneLabel || '');
    if (LOWER_PATTERN.test(zone) || LOWER_LABEL.test(label)) return 'lower';
    if (UPPER_PATTERN.test(zone) || UPPER_LABEL.test(label)) return 'upper';
    if (TRUNK_PATTERN.test(zone) || TRUNK_LABEL.test(label)) return 'trunk';
    if (/^head(?:-|$)/.test(zone) || /testa/i.test(label)) return 'head';
    return 'unknown';
  }
  function regionsForSession(session) {
    if (!session) return ['lower','upper','trunk','head','unknown'];
    if (['running','cycling'].includes(session.category)) return ['lower','trunk'];
    if (session.category === 'strength') {
      const focus = String(session.details?.strengthFocus || '').toLowerCase();
      if (/upper/.test(focus)) return ['upper','trunk'];
      if (/lower/.test(focus)) return ['lower','trunk'];
      return ['lower','upper','trunk'];
    }
    if (session.category === 'recovery') return ['lower','upper','trunk'];
    return ['lower','upper','trunk','head','unknown'];
  }
  function contextualIssues(data, session) {
    const regions = new Set(regionsForSession(session));
    const readings = (Array.isArray(data.issueReadings) ? data.issueReadings : [])
      .map(item => ({...item,pain:Number(item.pain)||0,region:item.region || regionForIssue(item)}))
      .sort((a,b) => b.pain-a.pain);
    const relevant = readings.filter(item => ['unknown','head'].includes(item.region) || regions.has(item.region));
    const local = readings.filter(item => !['unknown','head'].includes(item.region) && !regions.has(item.region));
    return {relevant:relevant[0] || null,local:local[0] || null};
  }
  function appendLocalCaution(text, local) {
    if (!local || local.pain < 3) return text;
    return `${text} ${local.zoneLabel || 'Il fastidio locale'} è a ${local.pain}/10: evita comunque movimenti o appoggi che ne aumentano i sintomi.`;
  }
  function timeAdvice(session) {
    if (session?.category === 'strength') return 'Mantieni il riscaldamento e le serie di avvicinamento; riduci le serie di lavoro o gli accessori.';
    if (session?.category === 'recovery') return 'Usa il tempo disponibile per una versione breve e realmente rigenerante, senza aumentare l’intensità.';
    return 'Mantieni il riscaldamento previsto; riduci il numero di ripetute, la durata dei blocchi centrali o il volume accessorio.';
  }
  function recommendation(data = {}, session = null) {
    const fatigue = Number(data.fatigue), energy = Number(data.energy), soreness = Number(data.soreness);
    const available = Number(data.availableMinutes) || 0, plannedDuration = Number(session?.durationMin) || 0;
    const issues = contextualIssues(data,session); const relevant = issues.relevant, local = issues.local;
    const recoverySession = session?.category === 'recovery';
    if (energy === 1 || fatigue === 5) {
      if (recoverySession) return {level:'reduce',reason:'recovery',title:'Solo recupero molto leggero o riposo',text:appendLocalCaution('I segnali soggettivi indicano recupero insufficiente: mantieni soltanto attività rigenerante tollerata oppure riposo.',local)};
      return {level:'replace',reason:'recovery',title:'Sostituisci la seduta intensa',text:appendLocalCaution('I segnali soggettivi indicano recupero insufficiente per lo stimolo previsto: scegli una seduta rigenerante o riposo.',local)};
    }
    if (relevant?.pain >= 5) {
      const name = relevant.zoneLabel || 'Il fastidio monitorato';
      if (recoverySession) return {level:'reduce',reason:'pain',title:'Adatta il recupero alla zona monitorata',text:`${name} è a ${relevant.pain}/10: mantieni soltanto attività che non aumenti i sintomi e interrompila se peggiorano.`};
      return {level:'replace',reason:'pain',title:'Rivaluta o sostituisci la seduta',text:`${name} è a ${relevant.pain}/10 e coinvolge un distretto usato dalla seduta: scegli recupero o un’attività che non aumenti i sintomi e rivaluta prima del prossimo lavoro specifico.`};
    }
    if ((relevant?.pain || 0) >= 3 || fatigue >= 4 || soreness >= 7 || energy <= 2) {
      const painText = relevant?.pain >= 3 ? `${relevant.zoneLabel || 'Il fastidio monitorato'} è a ${relevant.pain}/10. ` : '';
      return {level:'reduce',reason:relevant?.pain >= 3?'pain':'recovery',title:'Riduci il carico della seduta',text:appendLocalCaution(`${painText}Mantieni l’obiettivo tecnico, ma riduci volume o intensità del 20–30% e modifica ciò che aumenta i sintomi.`,local)};
    }
    if (plannedDuration && available && available+5 < plannedDuration) {
      return {level:'reduce',reason:'time',title:`Adatta la seduta a ${available} minuti`,text:appendLocalCaution(`Hai ${available} minuti rispetto ai ${plannedDuration} previsti. ${timeAdvice(session)} La riduzione organizzativa non viene interpretata come fatica.`,local)};
    }
    if (local?.pain >= 3) {
      return {level:'proceed',reason:'ready-local-caution',title:'Seduta confermata con cautela locale',text:`I segnali generali sono compatibili con il lavoro previsto. ${local.zoneLabel || 'Il fastidio locale'} è a ${local.pain}/10 e non coinvolge direttamente i distretti principali della seduta: procedi soltanto se l’attività non aumenta i sintomi.`};
    }
    return {level:'proceed',reason:'ready',title:'Seduta confermata',text:'I segnali soggettivi sono compatibili con il lavoro previsto. Procedi e rivaluta le sensazioni durante il riscaldamento.'};
  }

  return {
    checkinsForDate,findCheckin,upsertCheckin,upsertWeeklyAvailability,clampDuration,formatItalianDate,
    regionForIssue,regionsForSession,recommendation
  };
});
