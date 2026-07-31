import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import model from '../evidence-watch-model.js';

const here=path.dirname(fileURLToPath(import.meta.url));
const outputPath=process.env.EVIDENCE_WATCH_OUTPUT||path.join(here,'..','evidence-watch.json');
const now=new Date(),windowDays=Math.max(7,Math.min(30,Number(process.env.EVIDENCE_WATCH_DAYS)||14));
const dayMs=86400000,from=new Date(now.getTime()-(windowDays-1)*dayMs);
const isoDay=date=>date.toISOString().slice(0,10);
const ncbiDay=date=>isoDay(date).replaceAll('-','/');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));

const domains=[
  {key:'endurance',label:'Endurance',query:'(("endurance training"[Title/Abstract] OR running[Title/Abstract] OR marathon[Title/Abstract]) AND (athlete*[Title/Abstract] OR trained[Title/Abstract] OR runner*[Title/Abstract]))'},
  {key:'strength',label:'Forza',query:'(("resistance training"[Title/Abstract] OR "strength training"[Title/Abstract]) AND (athlete*[Title/Abstract] OR trained[Title/Abstract] OR sport*[Title/Abstract]))'},
  {key:'concurrent',label:'Concurrent / hybrid',query:'(("concurrent training"[Title/Abstract] OR "concurrent exercise"[Title/Abstract] OR "hybrid training"[Title/Abstract]) AND (athlete*[Title/Abstract] OR trained[Title/Abstract] OR performance[Title/Abstract]))'},
  {key:'hyrox',label:'HYROX',query:'(HYROX[Title/Abstract] OR ("hybrid athlete"[Title/Abstract] AND performance[Title/Abstract]))'},
  {key:'plyometric',label:'Pliometria',query:'((plyometric*[Title/Abstract] OR "reactive strength"[Title/Abstract]) AND (athlete*[Title/Abstract] OR trained[Title/Abstract] OR sport*[Title/Abstract]))'},
  {key:'recovery',label:'Recupero e sonno',query:'((sleep[Title/Abstract] OR recovery[Title/Abstract] OR overreaching[Title/Abstract]) AND (athlete*[Title/Abstract] OR trained[Title/Abstract] OR sport*[Title/Abstract]))'},
  {key:'wearables',label:'Wearable e HRV',query:'((wearable*[Title/Abstract] OR "heart rate variability"[Title/Abstract] OR HRV[Title/Abstract]) AND (athlete*[Title/Abstract] OR training[Title/Abstract] OR sport*[Title/Abstract]))'},
  {key:'monitoring',label:'Monitoraggio del carico',query:'(("training load"[Title/Abstract] OR "internal load"[Title/Abstract] OR sRPE[Title/Abstract]) AND (athlete*[Title/Abstract] OR sport*[Title/Abstract] OR training[Title/Abstract]))'},
  {key:'return-to-sport',label:'Return to sport',query:'(("return to sport"[Title/Abstract] OR "return to play"[Title/Abstract]) AND (athlete*[Title/Abstract] OR sport*[Title/Abstract]))'}
];

function endpoint(name,params){
  const url=new URL(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/${name}.fcgi`);
  Object.entries({db:'pubmed',retmode:'json',tool:'ReCarloVEvidenceWatch',email:'recarlov@users.noreply.github.com',...params}).forEach(([key,value])=>url.searchParams.set(key,String(value)));
  return url;
}
async function ncbiJson(url){
  const response=await fetch(url,{headers:{Accept:'application/json','User-Agent':'ReCarloVEvidenceWatch/1.0 (public research surveillance; recarlov@users.noreply.github.com)'}});
  if(!response.ok)throw new Error(`NCBI ${response.status} ${response.statusText}`);
  return response.json();
}
async function search(domain){
  const data=await ncbiJson(endpoint('esearch',{term:domain.query,datetype:'pdat',mindate:ncbiDay(from),maxdate:ncbiDay(now),retmax:8,sort:'pub date'}));
  const ids=Array.isArray(data?.esearchresult?.idlist)?data.esearchresult.idlist:[];
  return{ids,count:Number(data?.esearchresult?.count)||0};
}
function publicationDate(record={}){
  const raw=String(record.sortpubdate||record.pubdate||'').trim(),match=raw.match(/\d{4}(?:[-/]\d{2})?(?:[-/]\d{2})?/);
  return match?match[0].replaceAll('/','-'):null;
}
function recordCandidate(record,domain,seenAt){
  return model.classifyCandidate({
    pmid:record.uid,title:record.title,publishedAt:publicationDate(record),journal:record.fulljournalname||record.source,
    authors:(Array.isArray(record.authors)?record.authors:[]).map(item=>item?.name).filter(Boolean),
    publicationTypes:Array.isArray(record.pubtype)?record.pubtype:[],domains:[domain.key],lastSeenAt:seenAt
  });
}
async function summaries(ids,domain,seenAt){
  if(!ids.length)return[];
  const data=await ncbiJson(endpoint('esummary',{id:ids.join(','),version:'2.0'})),uids=Array.isArray(data?.result?.uids)?data.result.uids:ids;
  return uids.map(id=>recordCandidate(data?.result?.[id]||{uid:id},domain,seenAt)).filter(Boolean);
}
async function previousFeed(){try{return model.validateFeed(JSON.parse(await fs.readFile(outputPath,'utf8')));}catch{return null;}}
function mergeCandidates(previous,current,seenAt){
  const byId=new Map();
  for(const item of previous||[])byId.set(item.pmid,item);
  for(const item of current){const old=byId.get(item.pmid);byId.set(item.pmid,{...item,domains:[...new Set([...(old?.domains||[]),...item.domains])],firstSeenAt:old?.firstSeenAt||seenAt,lastSeenAt:seenAt});}
  const retentionStart=new Date(Date.parse(seenAt)-180*dayMs).toISOString();
  return model.rankCandidates([...byId.values()].filter(item=>!item.lastSeenAt||item.lastSeenAt>=retentionStart)).slice(0,model.MAX_CANDIDATES);
}

const previous=await previousFeed(),seenAt=now.toISOString(),results=[],domainReports=[],errors=[];
for(const domain of domains){
  try{
    const found=await search(domain);await delay(425);
    results.push(...await summaries(found.ids,domain,seenAt));
    domainReports.push({key:domain.key,label:domain.label,resultCount:found.count,status:'ok'});
  }catch(error){
    domainReports.push({key:domain.key,label:domain.label,resultCount:0,status:'error'});
    errors.push(`${domain.label}: ${error instanceof Error?error.message:String(error)}`);
  }
  await delay(425);
}

const feed={
  schemaVersion:model.SCHEMA_VERSION,status:errors.length?(errors.length===domains.length?'error':'partial'):'ok',generatedAt:seenAt,standardVersion:previous?.standardVersion||'1.0.0',
  scan:{from:isoDay(from),to:isoDay(now),windowDays},source:{label:'PubMed · NCBI E-utilities',url:'https://pubmed.ncbi.nlm.nih.gov/'},
  domains:domainReports,candidates:mergeCandidates(previous?.candidates,results,seenAt),
  review:{approvedChanges:previous?.review?.approvedChanges||[],unresolvedConflicts:previous?.review?.unresolvedConflicts||[]},errors
};
const valid=model.validateFeed(feed);
if(!valid)throw new Error('Il report generato non supera la validazione locale.');
const temporary=`${outputPath}.tmp`;
await fs.writeFile(temporary,`${JSON.stringify(feed,null,2)}\n`,'utf8');
await fs.rename(temporary,outputPath);
console.log(JSON.stringify({status:feed.status,generatedAt:feed.generatedAt,domains:feed.domains.length,candidates:feed.candidates.length,errors:feed.errors.length}));
