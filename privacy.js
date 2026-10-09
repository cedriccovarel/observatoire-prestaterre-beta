(() => {
  'use strict';

  const STORAGE_KEY = 'newosb-privacy-anonymized-v1';
  const EVENT_NAME = 'newosb:privacychange';

  const norm = (v) => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[’'`´]/g, "'").replace(/\s+/g, ' ').trim();
  // V6.13 : pseudonymes dérivés d'un SHA-256 avec une clé secrète locale.
  // Sans la clé, on ne peut plus retrouver un MOA en hachant une liste de noms.
  // Les collisions (deux noms → même numéro) sont détectées et résolues.
  const SECRET_KEY = 'newosb-privacy-secret-v1';
  function sha256Hex(message){
    const K=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
    const bytes=new TextEncoder().encode(message), l=bytes.length, withPad=((l+9+63)>>6)<<6, buf=new Uint8Array(withPad);
    buf.set(bytes); buf[l]=0x80; const dv=new DataView(buf.buffer); dv.setUint32(withPad-4,(l*8)>>>0); dv.setUint32(withPad-8,Math.floor(l/0x20000000));
    let h=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]; const w=new Uint32Array(64);
    const r=(x,n)=>(x>>>n)|(x<<(32-n));
    for(let o=0;o<withPad;o+=64){
      for(let i=0;i<16;i++)w[i]=dv.getUint32(o+i*4);
      for(let i=16;i<64;i++){const s0=r(w[i-15],7)^r(w[i-15],18)^(w[i-15]>>>3),s1=r(w[i-2],17)^r(w[i-2],19)^(w[i-2]>>>10);w[i]=(w[i-16]+s0+w[i-7]+s1)>>>0;}
      let [a,b,c,d,e,f,g,k]=h;
      for(let i=0;i<64;i++){const S1=r(e,6)^r(e,11)^r(e,25),ch=(e&f)^(~e&g),t1=(k+S1+ch+K[i]+w[i])>>>0,S0=r(a,2)^r(a,13)^r(a,22),maj=(a&b)^(a&c)^(b&c),t2=(S0+maj)>>>0;k=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;}
      h=[h[0]+a,h[1]+b,h[2]+c,h[3]+d,h[4]+e,h[5]+f,h[6]+g,h[7]+k].map(x=>x>>>0);
    }
    return h.map(x=>x.toString(16).padStart(8,'0')).join('');
  }
  function randomSecret(){
    try{const a=new Uint8Array(16);crypto.getRandomValues(a);return Array.from(a,b=>b.toString(16).padStart(2,'0')).join('');}catch{return String(Date.now())+Math.random().toString(36).slice(2);}
  }
  let secretCache='';
  function secret(){
    if(secretCache)return secretCache;
    try{secretCache=localStorage.getItem(SECRET_KEY)||'';if(!secretCache){secretCache=randomSecret();localStorage.setItem(SECRET_KEY,secretCache);}}catch{secretCache=secretCache||randomSecret();}
    return secretCache;
  }
  const registries=new Map(), hashCache=new Map();
  function resetRegistries(){registries.clear();hashCache.clear();}
  // Pour obtenir les mêmes pseudonymes sur plusieurs postes, saisir la même
  // phrase secrète partout : NEWOSB_PRIVACY.setSecret('…') dans la console.
  function setSecret(value){
    const v=String(value||'').trim()||randomSecret();
    try{localStorage.setItem(SECRET_KEY,v);}catch{}
    secretCache=v;resetRegistries();
    try{window.dispatchEvent(new CustomEvent(EVENT_NAME,{detail:{enabled:enabled(),secretChanged:true}}));}catch{}
  }
  function six(value,ns='id'){
    const n=norm(value)||'vide';
    let reg=registries.get(ns);if(!reg){reg={byValue:new Map(),byCode:new Map()};registries.set(ns,reg);}
    if(reg.byValue.has(n))return reg.byValue.get(n);
    for(let attempt=0;attempt<50;attempt++){
      const key=`${secret()}|${ns}|${n}|${attempt}`;
      let hex=hashCache.get(key);if(!hex){hex=sha256Hex(key);hashCache.set(key,hex);}
      const code=String((parseInt(hex.slice(0,12),16)%900000)+100000);
      const owner=reg.byCode.get(code);
      if(owner===undefined||owner===n){reg.byCode.set(code,n);reg.byValue.set(n,code);return code;}
    }
    throw new Error('Pseudonymisation : collisions répétées');
  }
  // V6.15 : un lien de partage anonymisé impose le mode anonymisé, sans modifier le réglage du navigateur.
  function forced(){ return !!(window.NEWOSB_SHARE&&window.NEWOSB_SHARE.forcePrivacy); }
  function enabled(){ if(forced())return true; try{return localStorage.getItem(STORAGE_KEY)==='1';}catch{return false;} }
  function setEnabled(on){
    if(forced())return;
    try{localStorage.setItem(STORAGE_KEY,on?'1':'0');}catch{}
    try{window.dispatchEvent(new CustomEvent(EVENT_NAME,{detail:{enabled:Boolean(on)}}));}catch{}
  }
  function moa(value){
    const s=String(value??'').trim();
    if(!s || norm(s)==='non precise' || norm(s)==='non précisé') return 'MOA non précisé';
    if(/^MOA \d{6}$/.test(s)) return s;
    return `MOA ${six(s,'moa')}`;
  }
  function id(value,prefix='ID'){const s=String(value??'').trim();if(!s)return `${prefix}-000000`;const re=new RegExp(`^${prefix}-\\d{6}$`);if(re.test(s))return s;return `${prefix}-${six(s,prefix)}`;}
  function operationCode(value){return id(value,'OP');}
  function evaluationCode(value){return id(value,'EVA');}
  function operationName(op){
    if(op?.__newosbAnonymized && op?.name) return op.name;
    const basis=op?.code||op?.name||'operation';
    return `Opération ${six(basis,'operation')}`;
  }
  function sensitiveHeader(key){
    const k=norm(key);
    return /(maitre d.?ouvrage|maitre ouvrage|\bmoa\b|societe|groupe principal|adresse|code postal|postal code|\binsee\b|longitude|latitude|contact|courriel|e-mail|email|telephone|telephone|\btel\b|nom de l.?operation|nom operation|nom du programme|programme \(client\)|nom programme|raison sociale|montant|chiffre d.?affaires|honoraires)/.test(k);
  }
  function scrubRaw(raw, op){
    if(!raw || typeof raw!=='object') return raw;
    const out={};
    for(const [k,v] of Object.entries(raw)){
      const nk=norm(k);
      if(/secteur d.?activite|hierarchie/.test(nk)) out[k]=v;
      else if(/montant|chiffre d.?affaires|honoraires|\bprix\b/.test(nk)) out[k]='';
      else if(/maitre d.?ouvrage|maitre ouvrage|\bmoa\b|societe|groupe principal|raison sociale/.test(nk)) out[k]=moa(v);
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
    return {...row,moa:moa(row.moa),group:row.group?`Groupe ${six(row.group,'group')}`:'',operationCode:operationCode(row.operationCode||row.evaluationCode)};
  }
  function displayRequirementMoa(value){ return enabled()?moa(value):String(value??''); }
  function displayRequirementOperation(value){ return enabled()?operationCode(value):String(value??''); }

  function syncControls(){
    const on=enabled();
    document.documentElement.classList.toggle('newosb-anonymized',on);
    document.querySelectorAll('[data-privacy-toggle]').forEach(input=>{ input.checked=on; input.disabled=forced(); input.setAttribute('aria-checked',on?'true':'false'); });
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

  window.NEWOSB_PRIVACY={STORAGE_KEY,EVENT_NAME,enabled,setEnabled,setSecret,moa,id,operationCode,evaluationCode,operationName,sensitiveHeader,scrubRaw,anonymizeOperation,anonymizeOperations,anonymizeRequirementRow,displayRequirementMoa,displayRequirementOperation,syncControls,bindControls};
})();
