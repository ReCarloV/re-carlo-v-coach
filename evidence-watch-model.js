(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.rcEvidenceWatchModel=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const SCHEMA_VERSION=1;
  const MAX_CANDIDATES=60;
  const allowedStatuses=new Set(['awaiting-first-scan','ok','partial','error']);

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
        approvedChanges:Array.isArray(review.approvedChanges)?review.approvedChanges.slice(0,20):[],
        unresolvedConflicts:Array.isArray(review.unresolvedConflicts)?review.unresolvedConflicts.slice(0,20):[]
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
    const approved=feed.review.approvedChanges.length,conflicts=feed.review.unresolvedConflicts.length,candidates=rankCandidates(feed.candidates).map(item=>({...item,athleteApplicability:athleteApplicability(item,options.athleteContext)}));
    const labels={waiting:'Prima scansione in attesa',error:'Scansione non riuscita',partial:'Scansione parziale',stale:'Report da aggiornare',current:'Sorveglianza aggiornata'};
    const noRelevantChange=approved===0&&conflicts===0;
    return{
      state,label:labels[state]||'Report non disponibile',feed,ageDays,
      domainsCovered:feed.domains.filter(item=>item.status==='ok').length,
      domainCount:feed.domains.length,
      candidates,
      priorityCandidates:candidates.filter(item=>['A','B'].includes(item.evidenceType.tier)&&item.practicalRelevance!=='low'&&item.athleteApplicability.key!=='low'),
      approvedChanges:approved,
      unresolvedConflicts:conflicts,
      noRelevantChange,
      standardAligned:!standardVersion||!feed.standardVersion||standardVersion===feed.standardVersion,
      detail:noRelevantChange?'Nessuna modifica è stata approvata: lo Standard Coach resta invariato.':'Sono presenti elementi che richiedono una decisione umana e una nuova versione dello Standard.'
    };
  }

  return{SCHEMA_VERSION,MAX_CANDIDATES,publicationType,populationFit,classifyCandidate,validateFeed,rankCandidates,athleteApplicability,summarize,daysBetween};
});
