(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.rcTrainingZonesModel=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const HR_METHODS=Object.freeze({
    hrr:{label:'Karvonen · % riserva cardiaca',shortLabel:'Karvonen (%HRR)'},
    hrmax:{label:'Percentuale della FC massima',shortLabel:'% FCmax'},
    average:{label:'Media Karvonen + % FCmax',shortLabel:'Media dei 2 metodi'},
    custom:{label:'Limiti personalizzati',shortLabel:'Manuale'}
  });
  const FTP_METHODS=Object.freeze({
    coggan7:{label:'Coggan · 7 zone',shortLabel:'Coggan 7 zone'},
    coggan5:{label:'Coggan · 5 zone condensate',shortLabel:'Coggan 5 zone'}
  });
  const HR_COLORS=['#6b8dbd','#4d9df7','#42d392','#ffb454','#ff6678'];
  const FTP_COLORS=['#6b8dbd','#4d9df7','#42d392','#ffb454','#ff6678','#c78cff','#e5eaf2'];

  function validNumber(value){const number=Number(value);return Number.isFinite(number)?number:null;}
  function validHrInputs(maxHr,restingHr){const max=validNumber(maxHr),rest=validNumber(restingHr);return max&&rest&&max>rest&&rest>0?{max,rest}:null;}
  function boundary(percent,inputs,method){
    const hrr=inputs.rest+(inputs.max-inputs.rest)*percent;
    const hrmax=inputs.max*percent;
    if(method==='hrmax')return hrmax;
    if(method==='average')return (hrr+hrmax)/2;
    return hrr;
  }
  function normalizedCustomUpper(values){
    if(!Array.isArray(values)||values.length!==5)return null;
    const numbers=values.map(validNumber);
    if(numbers.some(value=>value===null)||numbers.some((value,index)=>index&&value<=numbers[index-1]))return null;
    return numbers.map(Math.round);
  }
  function hrZones({maxHr,restingHr,method='hrr',customUpper=null}={}){
    const inputs=validHrInputs(maxHr,restingHr);if(!inputs)return {method:'hrr',zones:[],upperBounds:[],valid:false};
    const selected=HR_METHODS[method]?method:'hrr';
    const normalizedCustom=selected==='custom'?normalizedCustomUpper(customUpper):null;
    const custom=normalizedCustom&&normalizedCustom[0]>inputs.rest&&normalizedCustom.at(-1)<=inputs.max?normalizedCustom:null;
    const effective=selected==='custom'&&!custom?'hrr':selected;
    const upper=custom||[.6,.7,.8,.9,1].map(percent=>Math.round(boundary(percent,inputs,effective)));
    const firstMin=selected==='custom'?Math.round(inputs.rest)+1:Math.round(boundary(.5,inputs,effective));
    const zones=upper.map((max,index)=>({
      id:`Z${index+1}`,index:index+1,min:index===0?firstMin:upper[index-1]+1,max,color:HR_COLORS[index]
    }));
    return {method:selected,effectiveMethod:effective,zones,upperBounds:upper,valid:true,customValid:selected!=='custom'||Boolean(custom)};
  }

  const FTP_BANDS={
    coggan7:[
      ['Recupero attivo',55],['Endurance',75],['Tempo',90],['Soglia',105],['VO₂max',120],['Capacità anaerobica',null],['Neuromuscolare','na']
    ],
    coggan5:[
      ['Recupero attivo',55],['Endurance',75],['Tempo',90],['Soglia',105],['Alta intensità',null]
    ]
  };
  function ftpZones(ftp,method='coggan7'){
    const value=validNumber(ftp),selected=FTP_METHODS[method]?method:'coggan7';
    if(value===null||value<=0)return {method:selected,zones:[],valid:false};
    let previousMax=null;
    const zones=FTP_BANDS[selected].map(([label,upper],index)=>{
      const notFtpDefined=upper==='na';
      const min=notFtpDefined?null:index===0?0:previousMax+1;
      const max=upper===null||notFtpDefined?null:Math.round(value*upper/100);
      if(max!==null)previousMax=max;
      return {id:`Z${index+1}`,index:index+1,label,min,max,upperPercent:notFtpDefined?null:upper,notFtpDefined,color:FTP_COLORS[index]};
    });
    return {method:selected,zones,valid:true};
  }
  function hrTarget(zone,options={}){
    const result=hrZones(options),number=Number(String(zone||'').replace(/\D/g,'')),item=result.zones[number-1];
    return item?`${item.id} · ${item.min}–${item.max} bpm`:null;
  }
  function zoneColor(zone,type='hr'){
    const number=Number(String(zone||'').match(/\bZ(\d)\b/i)?.[1]),colors=type==='ftp'?FTP_COLORS:HR_COLORS;
    return Number.isInteger(number)&&number>=1&&number<=colors.length?colors[number-1]:null;
  }

  function explicitZone(value,max=7){
    const number=Number(String(value||'').match(/\bZ(\d)\b/i)?.[1]);
    return Number.isInteger(number)&&number>=1&&number<=max?`Z${number}`:null;
  }
  function ftpZoneFromTarget(value,method='coggan7'){
    const explicit=explicitZone(value,7);if(explicit)return explicit;
    const match=String(value||'').match(/(\d+(?:[.,]\d+)?)\s*(?:[–—-]\s*(\d+(?:[.,]\d+)?)\s*)?%\s*FTP/i);if(!match)return null;
    const min=Number(match[1].replace(',','.')),max=Number((match[2]||match[1]).replace(',','.')),midpoint=(min+max)/2;
    const upper=method==='coggan5'?[55,75,90,105,Infinity]:[55,75,90,105,120,Infinity,Infinity];
    const index=upper.findIndex(value=>midpoint<=value);return `Z${Math.max(0,index)+1}`;
  }
  function zoneForTarget(value,{type='hr',intensity='',phase='',linkedZone=null,ftpMethod='coggan7'}={}){
    const linked=explicitZone(linkedZone,type==='ftp'?7:5);if(linked)return linked;
    const explicit=explicitZone(value,type==='ftp'?7:5);if(explicit)return explicit;
    if(type==='ftp'){
      const ftpZone=ftpZoneFromTarget(value,ftpMethod);if(ftpZone)return ftpZone;
    }
    if(['warmup','recovery','cooldown'].includes(phase))return'Z1';
    return{recovery:'Z1',easy:'Z2',steady:'Z3',tempo:'Z3',threshold:'Z4',vo2:'Z5',race:'Z4'}[intensity]||null;
  }

  return {HR_METHODS,FTP_METHODS,hrZones,ftpZones,hrTarget,zoneColor,explicitZone,ftpZoneFromTarget,zoneForTarget,normalizedCustomUpper};
});
