(() => {
  'use strict';

  const STORAGE_KEY = 'newosb-privacy-anonymized-v1';
  const EVENT_NAME = 'newosb:privacychange';

  const norm = (v) => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[’'`´]/g, "'").replace(/\s+/g, ' ').trim();
  function hash32(value){
    const s=norm(value)||'vide';
    let h=2166136261;
    for(let i=0;i<s.length;i++){
      h^=s.charCodeAt(i);
      h=Math.imul(h,16777619);
    }
    return h>>>0;
  }
  function six(value){ return String((hash32(value)%900000)+100000); }
  function enabled(){ try{return localStorage.getItem(STORAGE_KEY)==='1';}catch{return false;} }
  function setEnabled(on){
    try{localStorage.setItem(STORAGE_KEY,on?'1':'0');}catch{}
    try{window.dispatchEvent(new CustomEvent(EVENT_NAME,{detail:{enabled:Boolean(on)}}));}catch{}
  }
  function moa(value){
    const s=String(value??'').trim();
    if(!s || norm(s)==='non precise' || norm(s)==='non précisé') return 'MOA non précisé';
    if(/^MOA \d{6}$/.test(s)) return s;
    return `MOA ${six(s)}`;
  }
  function id(value,prefix='ID'){const s=String(value??'').trim();if(!s)return `${prefix}-000000`;const re=new RegExp(`^${prefix}-\\d{6}$`);if(re.test(s))return s;return `${prefix}-${six(s)}`;}
  function operationCode(value){return id(value,'OP');}
  function evaluationCode(value){return id(value,'EVA');}
  function operationName(op){
    if(op?.__newosbAnonymized && op?.name) return op.name;
    const basis=op?.code||op?.name||'operation';
    return `Opération ${six(basis)}`;
  }
  function sensitiveHeader(key){
    const k=norm(key);
    return /(maitre d.?ouvrage|maitre ouvrage|\bmoa\b|societe|groupe principal|adresse|code postal|postal code|\binsee\b|longitude|latitude|contact|courriel|e-mail|email|telephone|telephone|\btel\b|nom de l.?operation|nom operation|nom du programme|programme \(client\)|nom programme|raison sociale)/.test(k);
  }
  function scrubRaw(raw, op){
    if(!raw || typeof raw!=='object') return raw;
    const out={};
    for(const [k,v] of Object.entries(raw)){
      const nk=norm(k);
      if(/maitre d.?ouvrage|maitre ouvrage|\bmoa\b|societe|groupe principal|raison sociale/.test(nk)) out[k]=moa(v);
      else if(/nom de l.?operation|nom operation|nom du programme|programme \(client\)|nom programme/.test(nk)) out[k]=operationName(op);
      else if((/^code interne$/.test(nk)||/code interne/.test(nk) && /operation/.test(nk))) out[k]=operationCode(v||op?.code);
      else if(/affaire.*nom|nom de l.?affaire|numero du contrat|numéro du contrat|contrat.*numero|contrat.*numéro|evaluation.*code interne|évaluation.*code interne/.test(nk)) out[k]=id(v||op?.code,'ID');
      else if(/adresse|code postal|postal code|\binsee\b|longitude|latitude|contact|courriel|e-mail|email|telephone|telephone|\btel\b/.test(nk)) out[k]='';
      else out[k]=v;
    }
    return out;
  }
  function anonymizeOperation(op){
    if(!op || typeof op!=='object') return op;
    if(op.__newosbAnonymized) return op;
    const out={...op};
    out.__newosbAnonymized=true;
    out.originalCode=undefined;
    out.code=operationCode(op.code||op.name);
    out.name=operationName(op);
    out.moa=moa(op.moa);
    out.address='';
    out.postalCode='';
    out.insee='';
    out.longitude=null;
    out.latitude=null;
    out.raw=scrubRaw(op.raw,op);
    out.rawRows=Array.isArray(op.rawRows)?op.rawRows.map(r=>scrubRaw(r,op)):[];
    return out;
  }
  function anonymizeOperations(ops){ return enabled() ? (ops||[]).map(anonymizeOperation) : (ops||[]); }
  function anonymizeRequirementRow(row){
    if(!enabled() || !row) return row;
    return {...row,moa:moa(row.moa),group:row.group?`Groupe ${six(row.group)}`:'',operationCode:operationCode(row.operationCode||row.evaluationCode)};
  }
  function displayRequirementMoa(value){ return enabled()?moa(value):String(value??''); }
  function displayRequirementOperation(value){ return enabled()?operationCode(value):String(value??''); }

  function syncControls(){
    const on=enabled();
    document.documentElement.classList.toggle('newosb-anonymized',on);
    document.querySelectorAll('[data-privacy-toggle]').forEach(input=>{ input.checked=on; input.setAttribute('aria-checked',on?'true':'false'); });
    document.querySelectorAll('[data-privacy-state]').forEach(el=>{el.textContent=on?'ACTIF':'INACTIF';});
  }
  function bindControls(){
    syncControls();
    document.querySelectorAll('[data-privacy-toggle]').forEach(input=>{
      if(input.dataset.privacyBound==='1') return;
      input.dataset.privacyBound='1';
      input.addEventListener('change',()=>{setEnabled(Boolean(input.checked));syncControls();});
    });
  }
  window.addEventListener('storage',e=>{if(e.key===STORAGE_KEY){syncControls();try{window.dispatchEvent(new CustomEvent(EVENT_NAME,{detail:{enabled:enabled(),external:true}}));}catch{}}});
  window.addEventListener(EVENT_NAME,syncControls);
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bindControls,{once:true}); else bindControls();

  window.NEWOSB_PRIVACY={STORAGE_KEY,EVENT_NAME,enabled,setEnabled,moa,id,operationCode,evaluationCode,operationName,sensitiveHeader,scrubRaw,anonymizeOperation,anonymizeOperations,anonymizeRequirementRow,displayRequirementMoa,displayRequirementOperation,syncControls,bindControls};
})();
