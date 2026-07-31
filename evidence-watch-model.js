(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.rcEvidenceWatchModel=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const SCHEMA_VERSION=1;
  const MAX_CANDIDATES=60;
  const allowedStatuses=new Set(['awaiting-first-scan','ok','partial','error']);
  const personalReviewStatuses=new Set(['shortlisted','monitor','excluded','reviewed']);
  const applicabilityStatuses=new Set(['to-review','direct','contextual','low']);
  const agreementStatuses=new Set(['to-review','supports','extends','conflicts','unclear']);

  function cleanText(value,max=500){return typeof value==='string'?value.trim().slice(0,max):'';}
  function unique(items){return[...new Set((Array.isArray(items)?items:[]).filter(Boolean))];}
  function dateValue(value){const time=Date.parse(value||'');return Number.isFinite(time)?time:null;}
  function daysBetween(a,b){const start=dateValue(a),end=dateValue(b);return start===null||end===null?null:Math.floor((end-start)/86400000);}
  function publicationType(pubTypes=[],title=''){
    const types=unique(pubTypes.map(item=>cleanText(item,100))),haystack=`${types.join(' ')} ${title}`.toLowerCase();
    if(/consensus|position stand|practice guideline|clinical guideline/.test(haystack))return{key:'anchor',tier:'A',label:'Consensus / linea guida'};
    if(/meta-analysis|systematic review|systematic-review/.test(haystack))return{key:'synthesis',tier:'B',label:'Revisione sistematica / meta-analisi'};
    if(/randomized controlled trial|controlled clinical trial|randomised controlled trial/.test(haystack))return{key:'controlled',tier:'C',label:'Studio controllato'};
    if(/review/.test(haystack))return{key:'review',tier:'C',label:'Revisione narrativa / scoping'};
    return{key:'primary',tier:'D',label:'Studio primario / altro'};
  }
  function populationFit(title=''){
    const value=title.toLowerCase();
    if(/patient|disease|cancer|cardiac|cardiovascular imaging|diabetes|fibromyalgia|older adult|elderly|injur|surg|reconstruction|diagnos|medical imaging|ligament|dislocation/.test(value))return{key:'limited',label:'Applicabilità limitata'};
    if(/athlete|runner|trained|sport|cyclist|triath|football|soccer|rugby|hyrox/.test(value))return{key:'direct',label:'Popolazione sportiva'};
    return{key:'contextual',label:'Applicabilità contestuale'};
  }
  function classifyCandidate(input={}){
    const pmid=String(input.pmid||'').replace(/\D/g,'').slice(0,12),title=cleanText(input.title,600);
    if(!pmid||!title)return null;
    const evidence=publicationType(input.publicationTypes,title),population=populationFit(title);
    const practicalRelevance=population.key==='limited'?'low':evidence.tier==='A'||(evidence.tier==='B'&&population.key==='direct')?'high':'medium';
    return{
      pmid,title,
      url:`https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
      publishedAt:cleanText(input.publishedAt,30)||null,
      journal:cleanText(input.journal,180)||'Rivista non indicata',
      authors:unique((Array.isArray(input.authors)?input.authors:[]).map(item=>cleanText(item,120))).slice(0,6),
      domains:unique((Array.isArray(input.domains)?input.domains:[]).map(item=>cleanText(item,60))).slice(0,10),
      publicationTypes:unique((Array.isArray(input.publicationTypes)?input.publicationTypes:[]).map(item=>cleanText(item,100))).slice(0,12),
      evidenceType:evidence,
      population,
      practicalRelevance,
      applicability:'to-review',
      agreementWithStandard:'to-review',
      reviewStatus:'candidate',
      firstSeenAt:cleanText(input.firstSeenAt,30)||null,
      lastSeenAt:cleanText(input.lastSeenAt,30)||null
    };
  }
  function normalizeDomain(input={}){
    const key=cleanText(input.key,60),label=cleanText(input.label,120);
    if(!key||!label)return null;
    return{key,label,resultCount:Math.max(0,Number(input.resultCount)||0),status:['ok','error'].includes(input.status)?input.status:'ok'};
  }
  function normalizeApprovedChange(input={}){
    const id=cleanText(input.id,100),title=cleanText(input.title,300),standardVersion=cleanText(input.standardVersion,40);
    if(!/^[a-z0-9][a-z0-9._-]{2,99}$/i.test(id)||!title||!/^\d+\.\d+\.\d+$/.test(standardVersion))return null;
    return{
      id,title,standardVersion,status:'approved',
      rationale:cleanText(input.rationale,1600),
      domains:unique((Array.isArray(input.domains)?input.domains:[]).map(item=>cleanText(item,60))).slice(0,10),
      pmids:unique((Array.isArray(input.pmids)?input.pmids:[]).map(item=>String(item||'').replace(/\D/g,'').slice(0,12))).filter(Boolean).slice(0,30),
      affectedRuleIds:unique((Array.isArray(input.affectedRuleIds)?input.affectedRuleIds:[]).map(item=>cleanText(item,100))).slice(0,30),
      approvedAt:cleanText(input.approvedAt,30)||null,
      effectiveFrom:cleanText(input.effectiveFrom,20)||null
    };
  }
  function normalizeConflict(input={}){
    const id=cleanText(input.id,100),title=cleanText(input.title,300);
    if(!/^[a-z0-9][a-z0-9._-]{2,99}$/i.test(id)||!title)return null;
    return{id,title,summary:cleanText(input.summary,1200),domains:unique((Array.isArray(input.domains)?input.domains:[]).map(item=>cleanText(item,60))).slice(0,10),pmids:unique((Array.isArray(input.pmids)?input.pmids:[]).map(item=>String(item||'').replace(/\D/g,'').slice(0,12))).filter(Boolean).slice(0,30),openedAt:cleanText(input.openedAt,30)||null,status:'open'};
  }
  function normalizePersonalReview(input={}){
    const pmid=String(input.pmid||'').replace(/\D/g,'').slice(0,12),status=cleanText(input.status,30),title=cleanText(input.title,600),reviewedAt=cleanText(input.reviewedAt,30);
    if(!pmid||!title||!personalReviewStatuses.has(status)||!dateValue(reviewedAt))return null;
    const applicability=applicabilityStatuses.has(input.applicability)?input.applicability:'to-review',agreement=agreementStatuses.has(input.agreement)?input.agreement:'to-review',rationale=cleanText(input.rationale,1600),fullTextRead=Boolean(input.fullTextRead);
    if(status==='reviewed'&&(!fullTextRead||applicability==='to-review'||agreement==='to-review'||rationale.length<20))return null;
    return{version:1,pmid,title,status,applicability,agreement,rationale,fullTextRead,feedGeneratedAt:cleanText(input.feedGeneratedAt,30)||null,reviewedAt};
  }
  function upsertPersonalReview(reviews,candidate,input={},now=new Date().toISOString()){
    const current=(Array.isArray(reviews)?reviews:[]).map(normalizePersonalReview).filter(Boolean),pmid=String(candidate?.pmid||'').replace(/\D/g,'').slice(0,12);
    if(!pmid||!candidate?.title)throw new Error('Il candidato scientifico non è valido.');
    const next=current.filter(item=>item.pmid!==pmid);
    if(input.status==='unread'||!input.status)return next;
    const record=normalizePersonalReview({...input,pmid,title:candidate.title,feedGeneratedAt:input.feedGeneratedAt||null,reviewedAt:now});
    if(!record)throw new Error(input.status==='reviewed'?'Per completare la revisione servono testo integrale letto, applicabilità, confronto con lo Standard e una motivazione di almeno 20 caratteri.':'La valutazione scientifica non è completa o non è valida.');
    return[...next,record].sort((a,b)=>a.reviewedAt.localeCompare(b.reviewedAt));
  }
  function personalReviewSummary(candidates=[],reviews=[]){
    const candidateIds=new Set((Array.isArray(candidates)?candidates:[]).map(item=>String(item?.pmid||''))),valid=(Array.isArray(reviews)?reviews:[]).map(normalizePersonalReview).filter(item=>item&&candidateIds.has(item.pmid)),byStatus={shortlisted:0,monitor:0,excluded:0,reviewed:0};
    valid.forEach(item=>{byStatus[item.status]+=1;});
    return{total:valid.length,unread:Math.max(0,candidateIds.size-valid.length),...byStatus};
  }
  function resolveStandardChanges(review={},options={}){
    const version=cleanText(options.standardVersion,40),registered=new Set(Array.isArray(options.approvedChangeIds)?options.approvedChangeIds:[]),approved=(Array.isArray(review.approvedChanges)?review.approvedChanges:[]).map(normalizeApprovedChange).filter(Boolean);
    const active=approved.filter(item=>item.standardVersion===version&&registered.has(item.id));
    const awaitingRelease=approved.filter(item=>!active.includes(item));
    return{approved,active,awaitingRelease,conflicts:(Array.isArray(review.unresolvedConflicts)?review.unresolvedConflicts:[]).map(normalizeConflict).filter(Boolean)};
  }
  function validateFeed(input){
    if(!input||typeof input!=='object'||Number(input.schemaVersion)!==SCHEMA_VERSION)return null;
    const domains=(Array.isArray(input.domains)?input.domains:[]).map(normalizeDomain).filter(Boolean);
    const candidates=(Array.isArray(input.candidates)?input.candidates:[]).map(classifyCandidate).filter(Boolean).slice(0,MAX_CANDIDATES);
    const review=input.review&&typeof input.review==='object'?input.review:{};
    return{
      schemaVersion:SCHEMA_VERSION,
      status:allowedStatuses.has(input.status)?input.status:'error',
      generatedAt:cleanText(input.generatedAt,30)||null,
      standardVersion:cleanText(input.standardVersion,40)||null,
      scan:{
        from:cleanText(input.scan?.from,20)||null,
        to:cleanText(input.scan?.to,20)||null,
        windowDays:Math.max(1,Math.min(60,Number(input.scan?.windowDays)||14))
      },
      source:{
        label:cleanText(input.source?.label,120)||'PubMed · NCBI E-utilities',
        url:cleanText(input.source?.url,300)||'https://pubmed.ncbi.nlm.nih.gov/'
      },
      domains,candidates,
      review:{
        approvedChanges:(Array.isArray(review.approvedChanges)?review.approvedChanges:[]).map(normalizeApprovedChange).filter(Boolean).slice(0,20),
        unresolvedConflicts:(Array.isArray(review.unresolvedConflicts)?review.unresolvedConflicts:[]).map(normalizeConflict).filter(Boolean).slice(0,20)
      },
      errors:(Array.isArray(input.errors)?input.errors:[]).map(item=>cleanText(item,240)).filter(Boolean).slice(0,12)
    };
  }
  function rankCandidates(candidates=[]){
    const tierScore={A:4,B:3,C:2,D:1},relevanceScore={high:3,medium:2,low:1};
    return[...candidates].sort((a,b)=>{
      const score=(tierScore[b.evidenceType?.tier]||0)-(tierScore[a.evidenceType?.tier]||0)||(relevanceScore[b.practicalRelevance]||0)-(relevanceScore[a.practicalRelevance]||0);
      return score||String(b.publishedAt||'').localeCompare(String(a.publishedAt||''))||String(a.pmid).localeCompare(String(b.pmid));
    });
  }
  function athleteApplicability(candidate={},context={}){
    const title=String(candidate.title||'').toLowerCase(),age=Number(context.age),active=new Set(Array.isArray(context.activeDomains)?context.activeDomains:[]),domains=Array.isArray(candidate.domains)?candidate.domains:[];
    if(candidate.population?.key==='limited')return{key:'low',label:'Per il profilo: bassa'};
    if(Number.isFinite(age)&&((/adolescent|youth|child|pediatric/.test(title)&&age>=21)||(/older adult|elderly|geriatric/.test(title)&&age<55)))return{key:'low',label:'Per il profilo: bassa'};
    if(active.size&&domains.length&&!domains.some(key=>active.has(key)))return{key:'contextual',label:'Per il profilo: contestuale'};
    if(candidate.population?.key==='direct')return{key:'direct',label:'Per il profilo: diretta'};
    return{key:'contextual',label:'Per il profilo: da verificare'};
  }
  function summarize(input,options={}){
    const feed=validateFeed(input),now=options.now||new Date().toISOString(),standardVersion=cleanText(options.standardVersion,40)||null;
    if(!feed)return{state:'unavailable',label:'Report non disponibile',detail:'Il report non è valido o non è raggiungibile.',feed:null};
    const ageDays=feed.generatedAt?daysBetween(feed.generatedAt,now):null;
    let state=feed.status==='awaiting-first-scan'?'waiting':feed.status==='error'?'error':feed.status==='partial'?'partial':'current';
    if(ageDays!==null&&ageDays>14&&state==='current')state='stale';
    const governance=resolveStandardChanges(feed.review,options),approved=governance.active.length,conflicts=governance.conflicts.length,candidates=rankCandidates(feed.candidates).map(item=>({...item,athleteApplicability:athleteApplicability(item,options.athleteContext)})),reviews=(Array.isArray(options.personalReviews)?options.personalReviews:[]).map(normalizePersonalReview).filter(Boolean),reviewsByPmid=new Map(reviews.map(item=>[item.pmid,item]));
    const reviewedCandidates=candidates.map(item=>({...item,personalReview:reviewsByPmid.get(item.pmid)||null}));
    const labels={waiting:'Prima scansione in attesa',error:'Scansione non riuscita',partial:'Scansione parziale',stale:'Report da aggiornare',current:'Sorveglianza aggiornata'};
    const noRelevantChange=approved===0&&governance.awaitingRelease.length===0&&conflicts===0;
    return{
      state,label:labels[state]||'Report non disponibile',feed,ageDays,
      domainsCovered:feed.domains.filter(item=>item.status==='ok').length,
      domainCount:feed.domains.length,
      candidates:reviewedCandidates,
      priorityCandidates:reviewedCandidates.filter(item=>['A','B'].includes(item.evidenceType.tier)&&item.practicalRelevance!=='low'&&item.athleteApplicability.key!=='low'&&item.personalReview?.status!=='excluded'),
      personalReviewSummary:personalReviewSummary(reviewedCandidates,reviews),
      approvedChanges:approved,
      approvedAwaitingRelease:governance.awaitingRelease.length,
      unresolvedConflicts:conflicts,
      noRelevantChange,
      standardAligned:(!standardVersion||!feed.standardVersion||standardVersion===feed.standardVersion)&&governance.awaitingRelease.length===0,
      detail:noRelevantChange?'Nessuna modifica è stata approvata: lo Standard Coach resta invariato.':governance.awaitingRelease.length?'Esistono modifiche approvate nel report ma non ancora registrate in una release del Coach: restano inattive.':'Sono presenti elementi che richiedono una decisione umana e una nuova versione dello Standard.'
    };
  }

  return{SCHEMA_VERSION,MAX_CANDIDATES,publicationType,populationFit,classifyCandidate,normalizeApprovedChange,normalizePersonalReview,upsertPersonalReview,personalReviewSummary,resolveStandardChanges,validateFeed,rankCandidates,athleteApplicability,summarize,daysBetween};
});
