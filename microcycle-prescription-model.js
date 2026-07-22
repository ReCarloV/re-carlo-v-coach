(function(root,factory){
  const programming=typeof module!=='undefined'&&module.exports?require('./event-programming-model.js'):root?.rcEventProgrammingModel;
  const eventDemand=typeof module!=='undefined'&&module.exports?require('./event-demand-model.js'):root?.rcEventDemandModel;
  const api=factory(programming,eventDemand);
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.rcMicrocyclePrescriptionModel=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(programming,eventDemand){
  'use strict';

  const VERSION='1.3.0';
  const priorityRank={essential:3,important:2,optional:1};
  const clone=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
  const sentence=value=>{const text=String(value||'');return text?`${text[0].toUpperCase()}${text.slice(1)}`:text;};
  const addDays=(value,days)=>{const date=new Date(`${value}T12:00:00`);date.setDate(date.getDate()+days);return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;};
  const role=(key,label,priority='important',reason='',options={})=>({key,role:key.replace(/-\d+$/,''),label,priority,reason,source:'pack',generated:true,...options});
  const easy=(index=1)=>role(`easy-${index}`,index>1?`Corsa facile ${index}`:'Corsa facile','important','Frequenza e volume chiaramente facili sostengono l’assorbimento degli stimoli chiave.');
  const quality=(label='Qualità running')=>role('quality',sentence(label),'essential','Un solo stimolo running principale, coerente con distanza e fase.');
  const long=(label='Lungo')=>role('long',sentence(label),'essential','Seduta chiave di durata; dose e progressione restano subordinate alla tolleranza osservata.');
  const strength=(kind='strength')=>role(kind,kind==='strength-upper'?'Forza upper':kind==='strength-lower'?'Forza lower':'Forza full body','important','Forza di supporto con costo compatibile con gli stimoli specifici.');
  const cycling=()=>role('cycling','Cardio low impact','optional','Volume aerobico opzionale a basso impatto, senza intensità nascosta.');
  const hyrox=(label='HYROX specifico')=>role('hyrox',label,'essential','Unica seduta ibrida chiave coordinata con corsa e forza.');
  const obstacle=(key='obstacle',label='OCR specifico',priority='essential',reason='Tecnica, grip, carry e transizioni vengono integrati in blocchi frazionati e verificabili.')=>role(key,label,priority,reason,{role:'obstacle'});
  const athx=(key='athx-combined',label='ATHX specifico',priority='essential',reason='Le richieste ATHX vengono preparate in blocchi distinti e verificabili.')=>role(key,label,priority,reason,{role:'athx',athxRole:key});
  const triathlon=(key,label,priority='essential',reason='Le discipline e le transizioni vengono dosate separatamente.')=>role(key,label,priority,reason,{role:key.replace(/-\d+$/,''),triathlonRole:key.replace(/-\d+$/,'')});

  function sessionRole(item={}){
    if(item.details?.runType==='Race'||item.goalGenerated)return'race';
    if(item.details?.triathlonRole)return item.details.triathlonRole;
    if(item.category==='swimming')return'tri-swim';
    if(item.category==='running'&&(item.details?.runType==='Long run'||/lungo/i.test(item.title||'')))return'long';
    if(item.category==='running'){
      const text=`${item.details?.runType||''} ${item.title||''}`.toLowerCase();
      return/(interval|tempo|threshold|progress|quality|marathon pace|ripetut|soglia|medio)/.test(text)?'quality':'easy';
    }
    if(item.category==='strength'){
      const focus=String(item.details?.strengthFocus||'').toLowerCase();
      if(focus==='upper body')return'strength-upper';
      if(focus==='lower body')return'strength-lower';
      return'strength';
    }
    if(item.details?.athxRole||/\bathx\b/i.test(`${item.title||''} ${item.details?.metconType||''}`))return'athx';
    if(item.category==='metcon'&&/\b(ocr|spartan|obstacle)\b/i.test(`${item.title||''} ${item.details?.metconType||''}`))return'obstacle';
    if(item.category==='hyrox'||item.category==='metcon')return'hyrox';
    if(item.category==='cycling')return'cycling';
    if(item.category==='recovery')return'recovery';
    return item.category||'other';
  }

  function runningRoles(pack,count,phaseKey){
    const key=pack?.key||'',definition=pack?.definition||{},qualityLabel=definition.quality||'Qualità running',longLabel=definition.longLabel||'Lungo';
    const short=['road-5k','road-10k'].includes(key),half=key==='road-half';
    let roles;
    if(short){
      roles=[
        [quality(qualityLabel)],
        [easy(),quality(qualityLabel)],
        [easy(),quality(qualityLabel),strength()],
        [easy(),quality(qualityLabel),strength(),long(longLabel)],
        [easy(),easy(2),quality(qualityLabel),strength(),long(longLabel)],
        [easy(),easy(2),quality(qualityLabel),strength('strength-upper'),strength('strength-lower'),long(longLabel)]
      ][count-1];
    }else if(half){
      roles=[
        [long(longLabel)],
        [quality(qualityLabel),long(longLabel)],
        [easy(),quality(qualityLabel),long(longLabel)],
        [easy(),quality(qualityLabel),strength(),long(longLabel)],
        [easy(),easy(2),quality(qualityLabel),strength(),long(longLabel)],
        [easy(),easy(2),quality(qualityLabel),strength('strength-upper'),strength('strength-lower'),long(longLabel)]
      ][count-1];
    }else{
      roles=[
        [long(longLabel)],
        [strength(),long(longLabel)],
        [strength(),quality(qualityLabel),long(longLabel)],
        [easy(),strength(),quality(qualityLabel),long(longLabel)],
        [easy(),strength('strength-upper'),quality(qualityLabel),strength('strength-lower'),long(longLabel)],
        [easy(),strength('strength-upper'),quality(qualityLabel),strength('strength-lower'),cycling(),long(longLabel)]
      ][count-1];
      if(['specific-build','specific','peak'].includes(phaseKey)&&count>=5){
        roles=count===5
          ?[easy(),easy(2),quality(qualityLabel),strength(),long(longLabel)]
          :[easy(),easy(2),quality(qualityLabel),strength(),cycling(),long(longLabel)];
      }
      if(phaseKey==='taper'&&count>=4){
        roles=count===4
          ?[easy(),quality(qualityLabel),strength(),long(longLabel)]
          :count===5
            ?[easy(),quality(qualityLabel),strength(),cycling(),long(longLabel)]
            :[easy(),easy(2),quality(qualityLabel),strength(),cycling(),long(longLabel)];
      }
    }
    return roles||[];
  }

  function hyroxRoles(pack,count){
    const overlay=pack?.overlay||{},formatLabel=overlay.mode==='doubles'
      ?'HYROX Doubles · stazioni, cambi YGIG e strategia'
      :overlay.mode==='relay'
        ?'HYROX Relay · frazioni assegnate e cambi'
        :`HYROX ${overlay.label||'Individual'} · corsa compromessa e stazioni`;
    return[
      [hyrox(formatLabel)],
      [strength(),hyrox(formatLabel)],
      [easy(),strength(),hyrox(formatLabel)],
      [easy(),quality('Qualità running HYROX'),strength(),hyrox(formatLabel)],
      [easy(),quality('Qualità running HYROX'),strength(),hyrox(formatLabel),cycling()],
      [easy(),strength('strength-upper'),quality('Qualità running HYROX'),strength('strength-lower'),hyrox(formatLabel),cycling()]
    ][count-1]||[];
  }

  function obstacleRoles(pack,count){
    const definition=pack?.definition||{},short=Number(definition.distanceKm||0)<=5,longFormat=Number(definition.distanceKm||0)>=21;
    const specific=obstacle('obstacle-technique',`${definition.label||'OCR'} · tecnica, carry e transizioni`);
    const grip=obstacle('obstacle-grip','Grip, sospensioni e carry','important','Presa e forza resistente progrediscono separatamente, senza cedimento tecnico sistematico.');
    const terrain=quality('Salite, discese e ritmo su terreno');
    const endurance=long(longFormat?'Lungo trail specifico':'Endurance trail');
    if(short)return[
      [specific],
      [strength(),specific],
      [easy(),strength(),specific],
      [easy(),terrain,strength(),specific],
      [easy(),terrain,strength(),specific,cycling()],
      [easy(),terrain,strength('strength-upper'),strength('strength-lower'),specific,cycling()]
    ][count-1]||[];
    return[
      [specific],
      [endurance,specific],
      [strength(),endurance,specific],
      [easy(),strength(),endurance,specific],
      [easy(),terrain,strength(),endurance,specific],
      [easy(),terrain,strength(),endurance,grip,specific]
    ][count-1]||[];
  }

  function athxRoles(pack,count){
    const overlay=pack?.overlay||{},pairs=overlay.mode==='pairs',segment=Number(overlay.runSegmentM)||750;
    const endurance=athx('athx-endurance',`ATHX Endurance · run/row ${segment} m`,'essential','Pacing e cambi specifici della divisione progrediscono senza aumentare insieme ritmo, durata e densità.');
    const metcon=athx('athx-metcon',`ATHX MetCon X · ${overlay.division||'Standard'}`,'essential','Tecnica e densità dei movimenti ufficiali crescono senza trasformare ogni settimana in un test for-time.');
    const combined=athx('athx-combined',pairs?'ATHX Pairs · blocchi e strategia':'ATHX · blocchi specifici','essential',pairs?'Endurance, MetCon e cambi partner vengono provati in dose frazionata; il volume della coppia non viene duplicato sul singolo atleta.':'Endurance e MetCon vengono integrati in dose frazionata senza simulare l’intera giornata gara.');
    return[
      [combined],
      [strength(),combined],
      [easy(),strength(),combined],
      [easy(),strength(),endurance,metcon],
      [easy(),quality('Qualità running / row ATHX'),strength(),endurance,metcon],
      [easy(),quality('Qualità running / row ATHX'),strength(),endurance,metcon,cycling()]
    ][count-1]||[];
  }

  function triathlonRoles(pack,count){
    const definition=pack?.definition||{},longCourse=Boolean(definition.longCourse),label=definition.label||'Triathlon';
    const swimTechnique=triathlon('tri-swim',`Nuoto · tecnica ed efficienza`,'essential','Assetto, respirazione e continuità precedono l’intensità; nessun passo viene inventato senza un test reale.');
    const swimEndurance=triathlon('tri-swim-2',longCourse?'Nuoto · continuità e open-water skills':'Nuoto · aerobico / ritmo controllato','important','Una seconda esposizione consolida continuità e abilità specifiche senza aumentare insieme volume e densità.');
    const bike=triathlon('tri-bike',longCourse?'Bici · endurance, pacing e fueling':'Bici · qualità specifica','essential','Il carico ciclistico usa FTP/RPE e profilo dell’evento senza autorizzare automaticamente più corsa.');
    const run=triathlon('tri-run',longCourse?'Corsa · endurance su fatica controllata':'Corsa · ritmo specifico','essential','La tolleranza meccanica running resta distinta dal carico a basso impatto della bici.');
    const brick=triathlon('tri-brick','Brick bici-corsa e transizioni','essential','T2 e corsa successiva vengono allenate in blocchi controllati, non con una simulazione completa automatica.');
    const strengthRole=strength();strengthRole.reason=`Forza di supporto compatibile con i carichi chiave di ${label}.`;
    return[
      [brick],
      [swimTechnique,brick],
      [swimTechnique,bike,run],
      [swimTechnique,bike,run,brick],
      [swimTechnique,bike,run,brick,strengthRole],
      [swimTechnique,swimEndurance,bike,run,brick,strengthRole]
    ][count-1]||[];
  }

  function genericRoles(count){
    const fallback=[
      [easy()],
      [easy(),strength()],
      [easy(),strength(),cycling()],
      [easy(),easy(2),strength(),cycling()],
      [easy(),easy(2),strength(),cycling(),role('recovery','Recupero / mobilità','optional','Seduta neutra finché il formato gara non dispone di un pack revisionato.')],
      [easy(),easy(2),strength('strength-upper'),strength('strength-lower'),cycling(),role('recovery','Recupero / mobilità','optional','Seduta neutra finché il formato gara non dispone di un pack revisionato.')]
    ];
    return fallback[count-1]||[];
  }

  function eventInWeek(goal,start,end){return goal?.status==='planned'&&goal.date>=start&&goal.date<=end;}
  function eventRole(goal,relation,primary=false){
    const preparation=relation?.role==='preparatory';
    return role(primary?'race-primary':'race-preparatory',goal.name||'Gara','essential',
      primary?'La priorità A sostituisce qualsiasi lungo o seduta specifica aggiuntiva.':relation?.summary||'La gara secondaria deve servire la priorità A.',
      {role:'race',generated:false,source:'goal',goalId:goal.id,eventDate:goal.date,preparatory:preparation,relation:clone(relation)||null}
    );
  }
  function insertEvent(roles,eventDescriptor,replaceLong){
    const next=[...roles];
    let index=replaceLong?next.findIndex(item=>item.role==='long'):-1;
    if(index<0&&next.length)index=next.map((item,itemIndex)=>({item,itemIndex,rank:priorityRank[item.priority]||0})).sort((a,b)=>a.rank-b.rank||b.itemIndex-a.itemIndex)[0].itemIndex;
    if(index>=0)next.splice(index,1,eventDescriptor);
    else next.push(eventDescriptor);
    return next;
  }
  function matches(descriptor,session,preparatoryEvent){
    if(descriptor.goalId)return session.goalId===descriptor.goalId||session.date===descriptor.eventDate&&sessionRole(session)==='race';
    const actual=sessionRole(session);
    if(descriptor.role===actual)return true;
    if(descriptor.role==='strength')return actual.startsWith('strength');
    if(descriptor.role.startsWith('strength-')&&actual==='strength')return true;
    if(descriptor.role==='tri-swim'&&actual==='swimming')return true;
    if(descriptor.role==='tri-bike'&&actual==='cycling')return true;
    if(descriptor.role==='tri-run'&&['easy','quality','long'].includes(actual))return true;
    if(descriptor.role==='long'&&actual==='race'&&preparatoryEvent&&session.goalId===preparatoryEvent.id)return true;
    return false;
  }
  function trimForUnmatchedLocked(remaining,count){
    if(count<=0)return[];
    if(remaining.length<=count)return remaining;
    return [...remaining].sort((a,b)=>(priorityRank[b.priority]||0)-(priorityRank[a.priority]||0)||a.key.localeCompare(b.key)).slice(0,count);
  }

  function build(input={}){
    const goal=input.goal||null,weekStart=input.weekStart||null,count=Math.max(0,Math.min(6,Number(input.sessionCount)||0));
    const weekEnd=weekStart?addDays(weekStart,6):null,pack=programming?.packFor?.(goal)||null,phase=input.phaseConstraints?.phase||programming?.phaseFor?.(goal,weekStart)||null;
    const goals=(Array.isArray(input.goals)?input.goals:[]).filter(Boolean),locked=(Array.isArray(input.lockedSessions)?input.lockedSessions:[]).filter(Boolean);
    let targetRoles=pack?.family==='running'
      ?runningRoles(pack,count,phase?.key)
      :pack?.family==='hyrox'&&pack.status!=='pending'
        ?hyroxRoles(pack,count)
      :pack?.family==='obstacle'&&pack.status!=='pending'
        ?obstacleRoles(pack,count)
        :pack?.family==='athx'&&pack.status!=='pending'
          ?athxRoles(pack,count)
          :pack?.family==='triathlon'&&pack.status!=='pending'
            ?triathlonRoles(pack,count)
          :genericRoles(count);
    const primaryEvent=goal&&weekStart&&eventInWeek(goal,weekStart,weekEnd)?goal:null;
    const secondaryEvents=weekStart?goals.filter(item=>item.id!==goal?.id&&eventInWeek(item,weekStart,weekEnd)).map(item=>({goal:item,relation:eventDemand?.relationFor?.(goal,item,weekStart)||null})):[];
    const preparatory=secondaryEvents.find(item=>item.relation?.role==='preparatory')||null;
    if(primaryEvent)targetRoles=insertEvent(targetRoles,eventRole(primaryEvent,null,true),true);
    if(preparatory){
      const compatibleLong=pack?.key==='road-marathon'&&eventDemand?.profileFor?.(preparatory.goal)?.key==='road-30k';
      targetRoles=insertEvent(targetRoles,eventRole(preparatory.goal,preparatory.relation,false),compatibleLong);
    }
    targetRoles=targetRoles.slice(0,count);

    const remaining=[...targetRoles],covered=[],extras=[];
    locked.forEach(item=>{
      const index=remaining.findIndex(descriptor=>matches(descriptor,item,preparatory?.goal));
      if(index>=0){
        const [descriptor]=remaining.splice(index,1);
        covered.push({...descriptor,status:'covered',sessionId:item.id,sessionTitle:item.title,sessionDate:item.date});
      }else extras.push({sessionId:item.id,sessionTitle:item.title,sessionDate:item.date,role:sessionRole(item)});
    });
    const planned=trimForUnmatchedLocked(remaining,Math.max(0,count-covered.length-extras.length)).map(item=>({...item,status:'planned'}));
    const omitted=remaining.filter(item=>!planned.includes(item)).map(item=>({...item,status:'omitted'}));
    const allRoles=[...covered,...planned,...omitted].sort((a,b)=>{
      const ai=targetRoles.findIndex(item=>item.key===a.key),bi=targetRoles.findIndex(item=>item.key===b.key);
      return ai-bi;
    });
    const warnings=[];
    if(pack?.status==='pending')warnings.push('Il formato non dispone ancora di un pack prescrittivo revisionato: il Coach usa soltanto ruoli generici e conservativi.');
    if(pack?.family==='triathlon'&&count<3)warnings.push('Con meno di tre sedute la settimana non copre stabilmente nuoto, bici e corsa: il Coach mostra il limite invece di fingere una preparazione completa.');
    const weeklyCapacity=count*Math.max(0,Number(input.sessionMinutes)||0);
    if(pack?.family==='triathlon'&&pack.definition?.longCourse&&(count<5||weeklyCapacity&&weeklyCapacity<300))warnings.push('La disponibilità dichiarata è ridotta per un obiettivo long-course: il piano resta contestuale e la confidenza sulla copertura di 70.3/Full viene abbassata.');
    const uncoveredEvents=allRoles.filter(item=>item.role==='race'&&item.status!=='covered');
    if(uncoveredEvents.length)warnings.push('La gara della settimana non risulta ancora presente tra le sedute protette: sincronizza l’obiettivo prima di confermare il piano.');
    if(extras.length)warnings.push(`${extras.length} sedut${extras.length===1?'a protetta occupa':'e protette occupano'} spazio nel microciclo senza essere riscritt${extras.length===1?'a':'e'} dal Coach.`);
    const eventDirective=preparatory?{
      goal:clone(preparatory.goal),title:preparatory.relation.title,summary:preparatory.relation.summary,
      actions:clone(preparatory.relation.actions),tone:preparatory.relation.tone,
      replacesLong:pack?.key==='road-marathon'&&eventDemand?.profileFor?.(preparatory.goal)?.key==='road-30k'
    }:null;
    const packLabel=pack?.label||'Pack non disponibile',phaseLabel=phase?.label||'Fase da definire';
    const summary=eventDirective?.replacesLong
      ?`${eventDirective.goal.name} assorbe il lungo della settimana: nessun secondo lungo e nessun volume compensatorio.`
      :`${planned.length} sedut${planned.length===1?'a da programmare':'e da programmare'}, ${covered.length} già copert${covered.length===1?'a':'e'} e ${extras.length} protett${extras.length===1?'a':'e'} fuori dal contratto.`;
    return{
      version:VERSION,weekStart,weekEnd,count,pack:pack?{key:pack.key,label:pack.label,family:pack.family,status:pack.status,confidence:pack.confidence,overlay:clone(pack.overlay)||null}:null,
      phase:phase?clone(phase):null,targetRoles:clone(targetRoles),roles:allRoles,coveredRoles:covered,plannedRoles:planned,omittedRoles:omitted,
      protectedExtras:extras,eventDirective,warnings,summary,label:`${packLabel} · ${phaseLabel}`,
      confidence:pack?.confidence||'pending'
    };
  }

  return{VERSION,build,sessionRole};
});
