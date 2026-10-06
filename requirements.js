(() => {
  'use strict';

  const STORAGE_KEY='newosb_requirements_source_v1';
  const VERSION='6.14';
  const MENTIONS=()=>window.NEWOSB_MENTIONS;
  const MENTION_CATALOG=()=>window.NEWOSB_MENTION_CATALOG||null;
  // V6.14 : client du pont sécurisé propre à la source Exigences (clé distincte de celle d'OPERATIONS, gardée en mémoire seulement).
  const bridge=window.NEWOSB_BRIDGE?window.NEWOSB_BRIDGE.create('exigences'):null;
  const THEME_COLORS={'1':'#7da7d9','2':'#76b65c','3':'#ed9a42','4':'#8f77bd'};
  const TARGET_NAMES={'1':'Éco-Conception & Management du projet','2':'Le bâtiment dans son environnement','3':'Sobriété et Efficacité du bâtiment','4':'Usages & qualité de vie'};
  const state={
    url:'', rows:[], connected:false, loading:false, error:'', errorKind:'', loadProgress:'', warnings:[],
    filters:{year:[],referential:[],moaGroup:[],status:[],moa:[],region:[],department:[],profile:[],socialZone:[],period:[],nature:[],mention:[],moaSector:[],theme:[]},
    filterSearch:{}, requirement:'', mentionFocus:'', search:'', searchEditing:false, infoRequirement:'', infoKind:'', openFilter:'',
    loadedAt:'',
    views:{chronology:'list',topGlobal:'list',target1:'list',target2:'list',target3:'list',target4:'list',evolution:'list',mentions:'list',mentionReqs:'list'},
    pages:{},
    // Encart « Compatibilité des exigences sélectionnées avec les mentions » (V6.14).
    compat:{context:'',manualMention:'',values:{},size:'',openBouquet:false,openDiag:false,openFields:false},
    focusSelector:''
  };
  // URL mémorisée sans aucune clé. Une ancienne URL « …?key=… » (V6.13) est nettoyée et la clé
  // est seulement reprise en mémoire pour cette session.
  (function restoreSourceUrl(){
    let stored='';try{stored=localStorage.getItem(STORAGE_KEY)||'';}catch{}
    if(!stored)return;
    const split=window.NEWOSB_BRIDGE?window.NEWOSB_BRIDGE.splitUrl(stored):{url:stored,key:''};
    state.url=split.url;
    if(split.key){bridge?.setKey(split.key);state.migratedKey=true;}
    if(split.url!==stored){try{localStorage.setItem(STORAGE_KEY,split.url);}catch{}}
  })();

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const attr=esc;
  const norm=v=>String(v??'').replace(/&lt;br\s*\/?\s*&gt;/gi,' ').replace(/<br\s*\/?\s*>/gi,' ').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’'`´]/g,"'").replace(/\s+/g,' ').trim();
  const fmt=(n,d=0)=>Number(n||0).toLocaleString('fr-FR',{maximumFractionDigits:d,minimumFractionDigits:d});
  const uniq=arr=>[...new Set(arr.filter(v=>String(v??'').trim()!==''))].sort((a,b)=>String(a).localeCompare(String(b),'fr',{numeric:true,sensitivity:'base'}));
  const pct=(a,b)=>b?100*a/b:0;
  const splitMulti=v=>{const BR='\u2028';return String(v??'').replace(/&lt;br\s*\/?\s*&gt;/gi,BR).replace(/<br\s*\/?\s*>/gi,BR).split(/\n|;|\s*\|\s*/).map(s=>s.replace(new RegExp(BR,'g'),'\n').trim()).filter(Boolean);};
  const themeNo=v=>{const m=String(v??'').trim().match(/^([1-4])/);return m?m[1]:'';};
  const targetFromText=v=>{const m=String(v??'').trim().match(/^\s*([1-4])(?=\s*(?:\.|-|–|—|:|$))/);return m?m[1]:'';};
  const natureFromRef=v=>/r[ée]novation/i.test(String(v||''))?'Rénovation':(/neuf/i.test(String(v||''))?'Neuf':'Autre');
  const sectorFromRef=v=>/tertiaire/i.test(String(v||''))?'Tertiaire':(/logement/i.test(String(v||''))?'Logement':'Autre');
  const enc=v=>encodeURIComponent(String(v??''));
  const dec=v=>{try{return decodeURIComponent(v||'');}catch{return String(v||'');}};
  const privacy=()=>window.NEWOSB_PRIVACY;
  const displayMoa=v=>privacy()?.enabled?.()?privacy().moa(v):String(v??'');
  const displayOperation=v=>privacy()?.enabled?.()?privacy().operationCode(v):String(v??'');
  const displayEvaluation=v=>privacy()?.enabled?.()?privacy().evaluationCode(v):String(v??'');
  const catalog=()=>Array.isArray(window.NEWOSB_REQUIREMENT_CATALOG)?window.NEWOSB_REQUIREMENT_CATALOG:[];
  const asArray=v=>Array.isArray(v)?v:((v===undefined||v===null||v==='')?[]:[v]);
  const filterValues=key=>asArray(state.filters[key]);
  const hasFilter=key=>filterValues(key).length>0;
  const filterHas=(key,value)=>filterValues(key).some(v=>norm(v)===norm(value));
  const matchesFilter=(key,value)=>!hasFilter(key)||filterHas(key,value);
  const hasAnyFilters=()=>Object.keys(state.filters).some(k=>hasFilter(k));

  const alias=(row,names)=>{
    const keys=Object.keys(row||{}), map=new Map(keys.map(k=>[norm(k),k]));
    for(const n of names){const k=map.get(norm(n));if(k!==undefined&&String(row[k]??'').trim()!=='')return row[k];}
    return '';
  };
  const pick=(...vals)=>{for(const v of vals){if(v!==undefined&&v!==null&&String(v).trim()!=='')return v;}return '';};
  function normalizeRow(r){
    const referential=pick(r.referential,alias(r,['Évaluation: Opération: Référentiel: Nom du référentiel','Référentiel']));
    let y=Number(pick(r.year,r.versionYear,0))||0;
    if(!y){const d=String(pick(r.referentialDate,r.versionDate,alias(r,['Version du ref ( date )','Date version']),r.referentialVersion,alias(r,['Évaluation: Opération: Version du référentiel applicable: Version'])));const m=d.match(/(20\d{2})/);if(m)y=Number(m[1]);}
    const requirement=pick(r.requirement,alias(r,['Intitulé','Exigence','Exigences']));
    const theme=pick(r.theme,alias(r,['Thème','Theme']));
    const requirementReference=pick(r.requirementReference,alias(r,['Exigence de référence','Exigence de reference']));
    const requirementCode=pick(r.requirementCode,alias(r,["Code d'exigence",'Code d’exigence']));
    const requirementNumber=pick(r.requirementNumber,alias(r,["Numéro d'exigence",'Numéro d’exigence']));
    const requirementLabel=pick(r.requirementLabel,alias(r,['iNTITULE SANS REF','INTITULE SANS REF','Exigence associée: Nom']));
    const associatedRequirementReferenceTitle=pick(r.associatedRequirementReferenceTitle,alias(r,['Exigence associée: Exigence de référence: Intitulé','Exigence associee: Exigence de reference: Intitule']));
    return {
      evaluationCode:String(pick(r.evaluationCode,r.codeEvaluation,alias(r,['Code EVA interne','Évaluation: Code interne']))),
      operationCode:String(pick(r.operationCode,alias(r,['Évaluation: Opération: Code interne','Evaluation: Operation: Code interne','Code opération']))),
      region:String(pick(r.region,alias(r,['Évaluation: Opération: Région','Région']))),
      department:String(pick(r.department,alias(r,['Évaluation: Opération: Département','Département']))),
      referential:String(referential), referentialVersion:String(pick(r.referentialVersion,alias(r,['Évaluation: Opération: Version du référentiel applicable: Version']))),
      referentialDate:String(pick(r.referentialDate,alias(r,['Version du ref ( date )']))), year:y,
      mentions:String(pick(r.mentions,alias(r,['Mention ','Évaluation: Opération: Mentions']))),
      profile:String(pick(r.profile,alias(r,['Profil spécifique']))), performance:String(pick(r.performance,alias(r,['Évaluation: Opération: Performance']))),
      status:String(pick(r.status,alias(r,['Évaluation: Statut']))), moa:String(pick(r.moa,alias(r,["Évaluation: Opération: Maître d'ouvrage: Nom de la société"]))),
      moaSector:String(pick(r.moaSector,alias(r,["Évaluation: Opération: Maître d'ouvrage: Secteur d'activité"]))), group:String(pick(r.moaGroup,r.group,alias(r,["Évaluation: Opération: Maître d'ouvrage: Groupe principal Nom"]))),
      groupSector:String(pick(r.groupSector,alias(r,["Évaluation: Opération: Maître d'ouvrage: Groupe principal Secteur d'activité"]))),
      operationYear:Number(pick(r.operationYear,alias(r,['Évaluation: Opération: Année','Evaluation: Operation: Annee','Année opération','Annee operation'])))||0,
      socialZone:String(pick(r.socialZone,alias(r,['Évaluation: Opération: Zonage logement social 1/2/3','Evaluation: Operation: Zonage logement social 1/2/3','Zonage logement social 1/2/3','Zonage']))),
      requirementReference:String(requirementReference), requirementLabel:String(requirementLabel), requirementCode:String(requirementCode), requirementNumber:String(requirementNumber),
      associatedRequirementReferenceTitle:String(associatedRequirementReferenceTitle), target:String(pick(r.target,'')),
      referentialVersionDate:String(pick(r.referentialVersionDate,alias(r,['Version du ref ( date )','Version du ref (date)']))),
      requirementValidated:String(pick(r.requirementValidated,alias(r,['Exigence validée','Exigence validee']))),
      sourceRow:Number(r.sourceRow)||0,
      theme:String(theme), requirement:String(requirement), nature:String(pick(r.nature,natureFromRef(referential))), sector:String(pick(r.sector,sectorFromRef(referential)))
    };
  }

  function emit(){
    const page=document.getElementById('obsPage');
    const detail={scroll:{top:Number(page?.scrollTop)||0,left:Number(page?.scrollLeft)||0,winX:Number(window.scrollX)||0,winY:Number(window.scrollY)||0}};
    window.dispatchEvent(new CustomEvent('newosb:requirementschange',{detail}));
  }
  // ---------------------------------------------------------------- chargement (pont sécurisé, V6.14)
  let opIndex=null,pseudoIndex=null,pseudoIndexPrivacy='';
  function resetIndexes(){opIndex=null;pseudoIndex=null;pseudoIndexPrivacy='';}
  function clearPrivateData(){state.rows=[];state.connected=false;state.loadedAt='';state.warnings=[];resetIndexes();}
  async function load(rawUrl){
    const split=window.NEWOSB_BRIDGE?window.NEWOSB_BRIDGE.splitUrl(rawUrl):{url:String(rawUrl||'').trim(),key:''};
    const url=split.url;if(split.key)bridge?.setKey(split.key);
    if(!url){state.error='Colle l’URL /exec du déploiement Apps Script Exigences.';state.errorKind='config';emit();return;}
    if(!bridge){state.error='Module de pont indisponible (newosb-bridge.js).';state.errorKind='config';emit();return;}
    if(!bridge.hasKey()){clearPrivateData();state.url=url;state.error='Saisis la clé d’accès de la source Exigences (propriété NEWOSB_ACCESS_KEY de son projet Apps Script).';state.errorKind='auth';emit();return;}
    const token=++loadToken;
    state.url=url;try{localStorage.setItem(STORAGE_KEY,url);}catch{}
    state.loading=true;state.error='';state.errorKind='';state.loadProgress='Connexion…';emit();
    try{
      const ping=await bridge.request(url,{mode:'ping'},120000);
      if(ping?.service&&ping.service!=='NEWOSB EXIGENCES')throw new Error('Cette URL n’est pas celle du script Exigences (service « '+ping.service+' »).');
      const meta=await bridge.request(url,{mode:'meta'},120000);
      const total=Math.max(0,Number(meta?.rowCount)||0),limit=Math.max(200,Math.min(3000,Number(meta?.chunkSize)||1500)),out=[];
      if(!total)throw new Error('L’onglet RAPPORT ne contient aucune ligne de données.');
      const offsets=[];for(let o=0;o<total;o+=limit)offsets.push(o);
      for(let i=0;i<offsets.length;i+=2){
        if(token!==loadToken)return;
        state.loadProgress=`Chargement RAPPORT… ${fmt(Math.min(total,offsets[i]))} / ${fmt(total)} lignes`;emit();
        const chunks=await Promise.all(offsets.slice(i,i+2).map(offset=>bridge.request(url,{mode:'chunk',offset,limit},120000)));
        chunks.sort((a,b)=>(Number(a?.offset)||0)-(Number(b?.offset)||0)).forEach(c=>{if(Array.isArray(c?.rows))out.push(...c.rows);});
      }
      if(token!==loadToken)return;
      const rows=out.map(normalizeRow).filter(r=>r.evaluationCode&&r.requirement);
      if(!rows.length)throw new Error('Aucune ligne exploitable reçue depuis l’onglet RAPPORT.');
      resetIndexes();state.rows=rows;state.connected=true;state.loadedAt=new Date().toISOString();state.error='';state.errorKind='';state.warnings=Array.isArray(meta?.warnings)?meta.warnings.slice(0,12).map(String):[];
      if(!state.mentionFocus)state.mentionFocus=topMentions(state.rows,1)[0]?.name||'';
      bridge.closePopupSoon(600);
    }catch(e){
      if(token!==loadToken)return;
      // Une erreur ne laisse jamais un ancien jeu de données affiché comme s'il était à jour ou autorisé.
      clearPrivateData();
      state.errorKind=e?.authError?'auth':'error';
      state.error=e?.authError?`Accès refusé : ${String(e.message||e)}`:String(e?.message||e);
      if(e?.authError)bridge.clearKey();
    }finally{if(token===loadToken){state.loading=false;state.loadProgress='';emit();}}
  }
  let loadToken=0;
  function disconnect(){
    loadToken++;bridge?.clearKey();bridge?.destroy('Source Exigences déconnectée.');
    clearPrivateData();state.loading=false;state.error='';state.errorKind='';state.search='';state.infoRequirement='';state.compat.manualMention='';state.compat.context='';
    emit();
  }
  function forgetSource(){disconnect();state.url='';try{localStorage.removeItem(STORAGE_KEY);}catch{}emit();}

  function periodMatch(y,p){if(!p)return true;if(p==='pre2024')return y&&y<2024;if(p==='2024')return y===2024;if(p==='2025plus')return y>=2025;return String(y)===String(p);}
  function rowHasMention(r,m){return !m||splitMulti(r.mentions).some(x=>norm(x)===norm(m));}
  function rowHasAnyMention(r,mentions){return !mentions.length||mentions.some(m=>rowHasMention(r,m));}
  function filteredRows(options={}){
    const req=options.ignoreRequirement?'':state.requirement;
    return state.rows.filter(r=>{
      if(options.forceReferential&&norm(r.referential)!==norm(options.forceReferential))return false;
      if(!options.forceReferential&&!matchesFilter('referential',r.referential))return false;
      if(hasFilter('year')&&!filterValues('year').some(v=>String(r.operationYear)===String(v)))return false;
      if(!matchesFilter('moaGroup',r.group||'Non précisé'))return false;
      if(!matchesFilter('status',r.status))return false;
      if(!matchesFilter('moa',r.moa))return false;
      if(!matchesFilter('region',r.region))return false;
      if(!matchesFilter('department',r.department))return false;
      if(!matchesFilter('profile',r.profile))return false;
      if(!matchesFilter('socialZone',r.socialZone||'Non précisé'))return false;
      if(!options.ignorePeriod&&hasFilter('period')&&!filterValues('period').some(p=>periodMatch(r.year,p)))return false;
      if(!matchesFilter('nature',r.nature))return false;
      if(!rowHasAnyMention(r,filterValues('mention')))return false;
      if(!matchesFilter('moaSector',r.moaSector))return false;
      if(!options.ignoreTheme&&hasFilter('theme')&&!filterValues('theme').includes(rowTarget(r)))return false;
      if(req&&norm(r.requirement)!==norm(req))return false;
      return true;
    });
  }
  function occurrenceRows(rows){const seen=new Set();return rows.filter(r=>{const k=`${r.evaluationCode}\u0001${norm(r.requirement)}`;if(seen.has(k))return false;seen.add(k);return true;});}
  function evaluations(rows){const m=new Map();rows.forEach(r=>{if(!m.has(r.evaluationCode))m.set(r.evaluationCode,r);});return [...m.values()];}
  function countBy(rows,getter){const m=new Map();rows.forEach(r=>{const k=getter(r)||'Non précisé';m.set(k,(m.get(k)||0)+1);});return [...m.entries()].map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count||String(a.name).localeCompare(String(b.name),'fr'));}
  function requirementCounts(rows){return countBy(occurrenceRows(rows),r=>r.requirement);}
  function topMentions(rows,n=12){const evs=evaluations(rows),m=new Map();evs.forEach(r=>splitMulti(r.mentions).forEach(x=>m.set(x,(m.get(x)||0)+1)));return [...m.entries()].map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count).slice(0,n);}
  function themeColor(t){return THEME_COLORS[String(t)]||'#16864f';}
  function reqCode(v){const m=String(v||'').match(/\b([1-4]\.\d+\.\d+)\b/);return m?m[1]:'';}
  function reqLabel(v){return String(v||'').replace(/^\s*[1-4]\.[A-Za-z0-9]+(?:\.[A-Za-z0-9]+)?\s*[-.–—:]?\s*/,'').trim();}
  let targetCatalogIndexCache=null;
  function targetCatalogIndex(){
    if(targetCatalogIndexCache)return targetCatalogIndexCache;
    const byKindTitle=new Map(),byTitle=new Map(),ambiguous=new Set();
    catalog().forEach(c=>{
      const t=String(c.cibleCode||'');if(!/^[1-4]$/.test(t))return;
      const title=norm(c.title||'');if(!title)return;
      byKindTitle.set(`${norm(c.kind)}|${title}`,t);
      if(byTitle.has(title)&&byTitle.get(title)!==t)ambiguous.add(title);else byTitle.set(title,t);
    });
    ambiguous.forEach(k=>byTitle.delete(k));
    targetCatalogIndexCache={byKindTitle,byTitle};return targetCatalogIndexCache;
  }
  function rowTarget(r){
    // La cible sémantique du référentiel 2026 est prioritaire quand le titre est reconnu exactement.
    // Cela corrige les anciennes numérotations (ex. 4.B.2) et les colonnes Thème historiques incohérentes.
    const idx=targetCatalogIndex();
    const labels=[r.requirement,r.associatedRequirementReferenceTitle,r.requirementLabel,r.requirementReference].map(v=>norm(reqLabel(v))).filter(Boolean);
    for(const label of labels){const byKind=idx.byKindTitle.get(`${norm(r.nature)}|${label}`);if(byKind)return byKind;const any=idx.byTitle.get(label);if(any)return any;}
    const direct=[r.target,r.requirementCode,r.requirementNumber,r.associatedRequirementReferenceTitle,r.requirement,r.requirementReference,r.requirementLabel];
    for(const v of direct){const t=targetFromText(v);if(t)return t;}
    return themeNo(r.theme);
  }
  function words(v){return new Set(norm(v).replace(/[^a-z0-9à-ÿ]+/gi,' ').split(/\s+/).filter(x=>x.length>2));}
  function similarity(a,b){
    const na=norm(a),nb=norm(b);if(!na||!nb)return 0;if(na===nb)return 1;if(na.includes(nb)||nb.includes(na))return .9;
    const A=words(a),B=words(b);if(!A.size||!B.size)return 0;let inter=0;A.forEach(x=>{if(B.has(x))inter++;});return inter/Math.max(A.size,B.size);
  }
  function catalogCandidates(requirement){
    const all=catalog(),code=reqCode(requirement),label=reqLabel(requirement), preferred=filterValues('nature')[0]||'';
    let scored=all.map(x=>{
      const titleScore=similarity(label,x.title), codeBonus=code&&x.code===code?.22:0;
      return {x,score:titleScore+codeBonus};
    }).filter(o=>o.score>=.58 || (code&&o.x.code===code&&o.score>=.42));
    if(preferred)scored.sort((a,b)=>(a.x.kind===preferred?-1:0)-(b.x.kind===preferred?-1:0)||b.score-a.score);else scored.sort((a,b)=>b.score-a.score);
    const best=scored[0]?.score||0;return scored.filter(o=>o.score>=Math.max(.58,best-.12)).map(o=>o.x).slice(0,4);
  }
  function inferredKind(requirement,candidates){
    if(state.infoKind&&candidates.some(x=>x.kind===state.infoKind))return state.infoKind;
    const preferred=filterValues('nature')[0]||'';if(preferred&&candidates.some(x=>x.kind===preferred))return preferred;
    const rr=filteredRows({ignoreRequirement:true}).filter(r=>norm(r.requirement)===norm(requirement));
    const kinds=uniq(rr.map(r=>r.nature));if(kinds.length===1&&candidates.some(x=>x.kind===kinds[0]))return kinds[0];
    return candidates[0]?.kind||'';
  }
  function infoButton(name){return `<button type="button" class="req-info-btn" data-req-info="${attr(enc(name))}" title="Information sur cette exigence" aria-label="Information sur ${attr(name)}">i</button>`;}
  function bars(items,maxItems=10,clickType='requirement',denominator=0){
    const top=items.slice(0,maxItems),mx=Math.max(1,...top.map(x=>x.count)),base=Math.max(0,Number(denominator)||0);
    if(!top.length)return '<div class="obs-empty">Aucune donnée sur cette sélection.</div>';
    return `<div class="req-bars">${top.map(x=>{const share=base?100*x.count/base:0;return `<div class="req-bar-row"><button type="button" class="req-bar" ${clickType==='requirement'?`data-req-requirement="${attr(enc(x.name))}"`:''}><span title="${attr(x.name)}">${esc(x.name)}</span><i><b style="width:${(100*x.count/mx).toFixed(2)}%"></b></i><strong><b>${fmt(x.count)}</b><small>${fmt(share,1)} %</small></strong></button>${clickType==='requirement'?infoButton(x.name):''}</div>`;}).join('')}</div>`;
  }

  function reqViewToggle(key,modes=['list','bar']){
    const view=state.views[key]||'list',icons={list:'☷',bar:'▥',tiles:'▦'},titles={list:'Vue liste',bar:'Graphique à barres · Top 5',tiles:'Tuiles proportionnelles par cible'};
    return `<div class="req-view-toggle" role="group" aria-label="Mode d’affichage">${modes.map(mode=>`<button type="button" class="${view===mode?'is-active':''}" data-req-view="${attr(key)}" data-view="${mode}" title="${attr(titles[mode]||mode)}">${icons[mode]||'●'}</button>`).join('')}</div>`;
  }
  function reqPaged(items,key,pageSize=15){
    const total=items.length,pages=Math.max(1,Math.ceil(total/pageSize)),page=Math.max(1,Math.min(pages,Number(state.pages[key]||1))),start=(page-1)*pageSize;
    state.pages[key]=page;return {items:items.slice(start,start+pageSize),total,pages,page,start,end:Math.min(total,start+pageSize)};
  }
  function reqPagination(key,model){
    if(model.pages<=1)return `<div class="req-pager req-pager-single"><span>${fmt(model.total)} ligne${model.total>1?'s':''}</span></div>`;
    return `<div class="req-pager"><button type="button" data-req-page="${attr(key)}" data-page="${Math.max(1,model.page-1)}" ${model.page<=1?'disabled':''}>‹ Précédent</button><span>Page ${model.page} / ${model.pages}</span><button type="button" data-req-page="${attr(key)}" data-page="${Math.min(model.pages,model.page+1)}" ${model.page>=model.pages?'disabled':''}>Suivant ›</button></div>`;
  }
  function requirementList(items,key){
    if(!items.length)return '<div class="obs-empty">Aucune donnée sur cette sélection.</div>';
    const model=reqPaged(items,key,15);
    return `<div class="req-target-list">${model.items.map((x,i)=>`<div class="req-target-row"><button type="button" data-req-requirement="${attr(enc(x.name))}"><em>${model.start+i+1}</em><span title="${attr(x.name)}">${esc(x.name)}</span><strong>${fmt(x.count)}</strong></button>${infoButton(x.name)}</div>`).join('')}</div>${reqPagination(key,model)}`;
  }
  function requirementListOrBars(items,key,clickType='requirement',denominator=0){
    return (state.views[key]||'list')==='bar'?bars(items,5,clickType,denominator):requirementList(items,key);
  }

  function requirementTarget(name,rows){
    const counts=new Map();(rows||[]).forEach(r=>{if(norm(r.requirement)!==norm(name))return;const t=rowTarget(r)||'';if(t)counts.set(t,(counts.get(t)||0)+1);});
    return [...counts.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0]||'';
  }
  function treemapBinaryLayout(nodes,x=0,y=0,w=100,h=100,out=[]){
    if(!nodes.length)return out;
    if(nodes.length===1){out.push({...nodes[0],x,y,w,h});return out;}
    const total=nodes.reduce((s,n)=>s+Math.max(0,Number(n.count)||0),0)||1;
    let acc=0,split=1,best=Infinity;
    for(let i=1;i<nodes.length;i++){acc+=Math.max(0,Number(nodes[i-1].count)||0);const d=Math.abs(total/2-acc);if(d<best){best=d;split=i;}}
    const a=nodes.slice(0,split),b=nodes.slice(split),sumA=a.reduce((s,n)=>s+Math.max(0,Number(n.count)||0),0),ratio=Math.max(.02,Math.min(.98,sumA/total));
    if(w>=h){const aw=w*ratio;treemapBinaryLayout(a,x,y,aw,h,out);treemapBinaryLayout(b,x+aw,y,w-aw,h,out);}
    else{const ah=h*ratio;treemapBinaryLayout(a,x,y,w,ah,out);treemapBinaryLayout(b,x,y+ah,w,h-ah,out);}
    return out;
  }
  function requirementTiles(items,rows,denominator=0){
    const ranked=items.slice().sort((a,b)=>b.count-a.count),top=ranked.slice(0,15),total=Math.max(1,Number(denominator)||ranked.reduce((a,x)=>a+x.count,0)||1);
    if(!top.length)return '<div class="obs-empty">Aucune donnée sur cette sélection.</div>';
    const visible=top.reduce((s,x)=>s+(Number(x.count)||0),0),other=Math.max(0,total-visible);
    const nodes=top.map(x=>({...x,target:requirementTarget(x.name,rows),other:false}));
    if(other>0)nodes.push({name:'Autres exigences',count:other,target:'',other:true});
    const rects=treemapBinaryLayout(nodes);
    const legend=`<div class="req-volume-legend" aria-label="Légende des cibles">${['1','2','3','4'].map(t=>`<span><i style="--req-legend-color:${themeColor(t)}"></i><b>Cible ${t}</b><small>${esc(TARGET_NAMES[t]||'')}</small></span>`).join('')}</div>`;
    return `${legend}<div class="req-volume-treemap" role="group" aria-label="Treemap des exigences proportionnelle au volume total">${rects.map(r=>{if(r.other)return `<span class="req-volume-hidden-other" aria-hidden="true" style="left:${r.x.toFixed(3)}%;top:${r.y.toFixed(3)}%;width:${r.w.toFixed(3)}%;height:${r.h.toFixed(3)}%"></span>`;const share=100*r.count/total,cls=share<2.5?'is-tiny':share<5?'is-small':'',style=`left:${r.x.toFixed(3)}%;top:${r.y.toFixed(3)}%;width:${r.w.toFixed(3)}%;height:${r.h.toFixed(3)}%;--req-tile-color:${r.target?themeColor(r.target):'#87938d'}`,title=`${r.name} · ${r.count} occurrence${r.count>1?'s':''} · ${share.toFixed(1).replace('.',',')} % du total${r.target?` · Cible ${r.target}`:''}`;return `<button type="button" class="req-volume-tile ${cls}" data-req-requirement="${attr(enc(r.name))}" title="${attr(title)}" style="${style}"><span class="req-volume-target">${r.target?`Cible ${esc(r.target)}`:'Cible non classée'}</span><b>${esc(r.name)}</b><strong>${fmt(r.count)}</strong><small>${fmt(share,1)} % du total</small></button>`;}).join('')}</div>`;
  }

  function filterOptions(){
    const evs=evaluations(state.rows);
    const region=uniq(evs.map(r=>r.region));
    const selectedRegions=filterValues('region');
    const depBase=selectedRegions.length?evs.filter(r=>selectedRegions.some(v=>norm(r.region)===norm(v))):evs;
    return {
      year:uniq(evs.map(r=>r.operationYear).filter(Boolean)), referential:uniq(evs.map(r=>r.referential)), moaGroup:uniq(evs.map(r=>r.group||'Non précisé')), status:uniq(evs.map(r=>r.status)), moa:uniq(evs.map(r=>r.moa)), region, department:uniq(depBase.map(r=>r.department)), profile:uniq(evs.map(r=>r.profile)), socialZone:uniq(evs.map(r=>r.socialZone||'Non précisé')),
      nature:uniq(evs.map(r=>r.nature)), mention:uniq(evs.flatMap(r=>splitMulti(r.mentions))), moaSector:uniq(evs.map(r=>r.moaSector)), theme:['1','2','3','4']
    };
  }
  // V6.14 : en mode anonymisé, les filtres MOA et Groupe MOA n'exposent que des pseudonymes,
  // y compris dans la valeur des cases (le nom réel n'est jamais écrit dans la page).
  const PRIVATE_FILTERS={moa:v=>displayMoa(v),moaGroup:v=>(privacy()?.enabled?.()&&v&&v!=='Non précisé')?`Groupe ${privacy().id(v,'GRP').slice(4)}`:v};
  let privateFilterMap=new Map();
  function filterOut(key,v){return privacy()?.enabled?.()&&PRIVATE_FILTERS[key]?PRIVATE_FILTERS[key](v):v;}
  function filterIn(key,v){if(!(privacy()?.enabled?.()&&PRIVATE_FILTERS[key]))return v;return privateFilterMap.get(`${key}\u0001${v}`)??v;}
  function checkFilter(key,label,values,lab=v=>v){
    if(privacy()?.enabled?.()&&PRIVATE_FILTERS[key]){values.forEach(v=>privateFilterMap.set(`${key}\u0001${filterOut(key,v)}`,v));const raw=values;values=raw.map(v=>filterOut(key,v));lab=v=>v;const sel=new Set(filterValues(key).map(v=>norm(filterOut(key,v))));return checkFilterHtml(key,label,values,lab,v=>sel.has(norm(v)),sel.size);}
    return checkFilterHtml(key,label,values,lab,v=>filterHas(key,v),filterValues(key).length);
  }
  function checkFilterHtml(key,label,values,lab,isChecked,count){
    const summary=count?`${count} sélectionné${count>1?'s':''}`:'Tous',query=norm(state.filterSearch?.[key]||'');
    const search=`<label class="req-check-search"><span>⌕</span><input type="search" data-req-filter-search="${key}" value="${attr(state.filterSearch?.[key]||'')}" placeholder="${attr(`Rechercher dans ${String(label).toLowerCase()}…`)}" autocomplete="off"></label>`;
    return `<details class="req-check-filter ${count?'has-selection':''}" ${state.openFilter===key?'open':''}><summary><span>${esc(label)}</span><b>${esc(summary)}</b></summary><div class="req-check-menu">${search}<div class="req-check-actions"><button type="button" data-req-filter-all="${key}">Tout cocher</button><button type="button" data-req-filter-clear="${key}">Effacer</button></div>${values.length?values.map(v=>{const text=lab(v),hidden=query&&!norm(text).includes(query);return `<label data-req-filter-option="${key}" class="${hidden?'is-search-hidden':''}" ${hidden?'hidden':''}><input type="checkbox" data-req-filter-check="${key}" value="${attr(v)}" ${isChecked(v)?'checked':''}><span>${esc(text)}</span></label>`;}).join(''):'<small>Aucune valeur disponible</small>'}</div></details>`;
  }
  function filtersHtml(){
    const o=filterOptions();
    const activeCount=Object.keys(state.filters).reduce((n,k)=>n+filterValues(k).length,0);
    return `<div class="req-filterbar req-filterbar-checks">${checkFilter('year','Année',o.year)}${checkFilter('referential','Référentiel',o.referential)}${checkFilter('moaGroup','Groupe MOA',o.moaGroup)}${checkFilter('status','Avancement',o.status)}${checkFilter('moa','Maître d’ouvrage',o.moa)}${checkFilter('region','Région',o.region)}${checkFilter('department','Département',o.department)}${checkFilter('profile','Profil',o.profile)}${checkFilter('socialZone','Zonage',o.socialZone)}${checkFilter('nature','Nature',o.nature)}${checkFilter('mention','Mention',o.mention)}${checkFilter('moaSector','Secteur MOA',o.moaSector)}${checkFilter('theme','Thème',o.theme,v=>`${v} · ${TARGET_NAMES[v]||''}`)}${checkFilter('period','Période réf.',['pre2024','2024','2025plus'],v=>v==='pre2024'?'Avant 2024':v==='2025plus'?'2025–2026':'2024')}<button type="button" class="req-reset-filters" data-req-reset-filters="1" ${activeCount?'':'disabled'}>Réinitialiser les filtres${activeCount?` · ${activeCount}`:''}</button></div>${state.requirement?`<div class="req-active"><span>Exigence filtrée : <b>${esc(state.requirement)}</b></span><button type="button" data-req-clear-requirement="1">× Retirer</button></div>`:''}`;
  }

  function sourceStatusText(){
    if(state.loading)return state.loadProgress||'Connexion…';
    if(state.connected)return `${fmt(evaluations(state.rows).length)} évaluations · ${fmt(occurrenceRows(state.rows).length)} occurrences chargées${state.loadedAt?` · actualisé le ${new Date(state.loadedAt).toLocaleString('fr-FR')}`:''}`;
    if(state.errorKind==='auth')return 'Source Exigences privée : accès non autorisé ou clé non saisie';
    if(state.error)return 'Source Exigences indisponible';
    return state.url?'Source Exigences configurée · clé d’accès à saisir pour cette session':'Source Exigences non connectée';
  }
  function sourceCard(){
    const keyOk=bridge?.hasKey?.();
    return `<article class="req-source-card ${state.connected?'is-connected':''}"><div class="req-source-copy"><span>SOURCE EXIGENCES · PRIVÉE</span><h2>Google Sheet · onglet RAPPORT</h2><p role="status" aria-live="polite">${esc(sourceStatusText())}</p></div><div class="req-source-controls"><input id="reqSourceUrl" type="url" value="${attr(state.url)}" placeholder="https://script.google.com/macros/s/…/exec" aria-label="URL /exec du script Exigences" autocomplete="off"><input id="reqSourceKey" type="password" value="" placeholder="${keyOk?'Clé d’accès en mémoire · ressaisir pour changer':'Clé d’accès Exigences'}" aria-label="Clé d’accès de la source Exigences (gardée en mémoire pendant la session)" autocomplete="off" spellcheck="false"><button type="button" data-req-connect="1">${state.connected?'Actualiser':'Connecter'}</button>${(state.connected||keyOk||state.loading)?'<button class="soft" type="button" data-req-disconnect="1">Déconnecter</button>':''}${state.url&&!state.connected&&!state.loading?'<button class="soft" type="button" data-req-forget="1">Oublier l’URL</button>':''}<a class="req-code-link" href="Code_Exigences.gs" download>Code_Exigences.gs ↓</a></div>${state.error?`<div class="req-source-error" role="alert">${esc(state.error)}</div>`:''}${state.migratedKey?'<div class="req-source-note">La clé figurant dans l’ancienne URL mémorisée a été retirée du stockage du navigateur ; elle n’est conservée qu’en mémoire pour cette session.</div>':''}${state.connected&&state.warnings.length?`<details class="req-source-warnings"><summary>${fmt(state.warnings.length)} remarque${state.warnings.length>1?'s':''} du script</summary><ul>${state.warnings.map(w=>`<li>${esc(w)}</li>`).join('')}</ul></details>`:''}<small>La clé est demandée à chaque session : elle n’est enregistrée ni dans l’URL, ni dans le navigateur. Le script vérifie la clé avant toute lecture de RAPPORT. Le mode anonymisé masque l’affichage mais ne protège pas la source.</small></article>`;
  }

  function panelChronology(rows){
    const evs=evaluations(rows), years=uniq(evs.map(r=>r.year).filter(Boolean)).sort((a,b)=>a-b), refs=uniq(evs.map(r=>r.referential));
    if(!years.length||!refs.length)return '<div class="obs-empty">Chronologie indisponible.</div>';
    if((state.views.chronology||'list')==='bar'){
      const items=refs.map(ref=>({name:ref,count:evs.filter(r=>r.referential===ref).length})).sort((a,b)=>b.count-a.count);
      return bars(items,5,'none',evs.length);
    }
    const model=reqPaged(refs,'chronology',15);
    return `<div class="req-table-wrap"><table class="req-matrix"><thead><tr><th>Référentiel</th>${years.map(y=>`<th>${y}</th>`).join('')}<th>Total</th></tr></thead><tbody>${model.items.map(ref=>{const rr=evs.filter(r=>r.referential===ref);return `<tr><td>${esc(ref)}</td>${years.map(y=>`<td>${fmt(rr.filter(r=>r.year===y).length)}</td>`).join('')}<td><b>${fmt(rr.length)}</b></td></tr>`;}).join('')}</tbody></table>${reqPagination('chronology',model)}</div>`;
  }
  function sectorCard(rows){
    const evs=evaluations(rows), data=countBy(evs,r=>r.nature), total=evs.length;
    return `<div class="req-sector">${data.map(x=>`<div><span>${esc(x.name)}</span><b>${fmt(x.count)}</b><small>${fmt(pct(x.count,total),1)} %</small><i><em style="width:${pct(x.count,total).toFixed(1)}%"></em></i></div>`).join('')}</div>`;
  }
  function targetRequirementTable(items,key,viewKey,denominator=0){
    if(!items.length)return '<div class="obs-empty req-target-empty">Aucune exigence sur cette sélection.</div>';
    return (state.views[viewKey]||'list')==='bar'?bars(items,5,'requirement',denominator):requirementList(items,key);
  }
  function themePanels(rows){
    const cards=['1','2','3','4'].map(t=>{
      const tr=rows.filter(r=>rowTarget(r)===t),neufRows=tr.filter(r=>r.nature==='Neuf'),renoRows=tr.filter(r=>r.nature==='Rénovation'),neuf=requirementCounts(neufRows),reno=requirementCounts(renoRows);
      const totalOcc=occurrenceRows(tr).length,neufOcc=occurrenceRows(neufRows).length,renoOcc=occurrenceRows(renoRows).length,viewKey=`target${t}`;
      return `<article class="obs-card req-theme-card" style="--req-theme:${themeColor(t)}"><div class="obs-card-head"><div><span>CIBLE ${t}</span><h2>${esc(TARGET_NAMES[t])}</h2></div><div class="req-head-actions"><small>${fmt(totalOcc)} occurrences</small>${reqViewToggle(viewKey)}</div></div><div class="req-split req-target-split"><section><div class="req-target-subhead"><b>Neuf</b><small>${fmt(neufOcc)} occ. · ${fmt(neuf.length)} exigence${neuf.length>1?'s':''}</small></div>${targetRequirementTable(neuf,`${viewKey}-neuf`,viewKey,neufOcc)}</section><section><div class="req-target-subhead"><b>Rénovation</b><small>${fmt(renoOcc)} occ. · ${fmt(reno.length)} exigence${reno.length>1?'s':''}</small></div>${targetRequirementTable(reno,`${viewKey}-reno`,viewKey,renoOcc)}</section></div></article>`;
    }).join('');
    const unclassified=occurrenceRows(rows.filter(r=>!rowTarget(r))).length;
    return `<div class="req-theme-grid">${cards}</div>${unclassified?`<div class="req-target-warning"><b>${fmt(unclassified)} occurrence${unclassified>1?'s':''} non classée${unclassified>1?'s':''}</b><span>Ces lignes n’ont pas de correspondance suffisamment fiable avec les cibles 1 à 4 et ne sont pas forcées dans une mauvaise cible.</span></div>`:''}`;
  }
  function evolutionTable(){
    const rows=filteredRows({ignorePeriod:true}), occ=occurrenceRows(rows), years=uniq(occ.map(r=>r.year).filter(Boolean)).sort((a,b)=>b-a), all=requirementCounts(filteredRows());
    if(!all.length||!years.length)return '<div class="obs-empty">Aucune évolution disponible.</div>';
    if((state.views.evolution||'list')==='bar')return bars(all,5,'requirement',occurrenceRows(filteredRows()).length);
    const model=reqPaged(all,'evolution',15);
    return `<div class="req-table-wrap"><table class="req-matrix req-evolution"><thead><tr><th>Exigence</th>${years.map(y=>`<th>${y}</th>`).join('')}</tr></thead><tbody>${model.items.map(x=>{const req=x.name;return `<tr><td><button type="button" class="req-table-select" data-req-requirement="${attr(enc(req))}">${esc(req)}</button>${infoButton(req)}</td>${years.map(y=>`<td>${fmt(occ.filter(r=>r.year===y&&norm(r.requirement)===norm(req)).length)}</td>`).join('')}</tr>`;}).join('')}</tbody></table>${reqPagination('evolution',model)}</div>`;
  }
  function mentionsSection(rows){
    const mentions=topMentions(rows,9999);if(!state.mentionFocus&&mentions[0])state.mentionFocus=mentions[0].name;
    const selected=state.mentionFocus||mentions[0]?.name||'';const evalCodes=new Set(evaluations(rows).filter(r=>rowHasMention(r,selected)).map(r=>r.evaluationCode));
    const reqs=requirementCounts(rows.filter(r=>evalCodes.has(r.evaluationCode)));
    const mentionBody=(state.views.mentions||'list')==='bar'?bars(mentions,5,'none',evaluations(rows).length):(()=>{const model=reqPaged(mentions,'mentions',15);return `<div class="req-target-list">${model.items.map((x,i)=>`<div class="req-target-row"><button type="button" data-req-mention-focus-button="${attr(x.name)}"><em>${model.start+i+1}</em><span>${esc(x.name)}</span><strong>${fmt(x.count)}</strong></button></div>`).join('')}</div>${reqPagination('mentions',model)}`;})();
    const mentionReqRows=rows.filter(r=>evalCodes.has(r.evaluationCode));
    const reqBody=requirementListOrBars(reqs,'mentionReqs','requirement',occurrenceRows(mentionReqRows).length);
    return `<div class="obs-grid-2"><article class="obs-card"><div class="obs-card-head"><div><span>MENTIONS</span><h2>Mentions les plus demandées</h2></div><div class="req-head-actions"><small>évaluations</small>${reqViewToggle('mentions')}</div></div>${mentionBody}</article><article class="obs-card"><div class="obs-card-head"><div><span>EXIGENCES PAR MENTION</span><h2>Exigences associées</h2></div><div class="req-head-actions"><label class="req-inline-select"><select data-req-mention-focus="1">${mentions.map(m=>`<option value="${attr(m.name)}" ${norm(m.name)===norm(selected)?'selected':''}>${esc(m.name)}</option>`).join('')}</select></label>${reqViewToggle('mentionReqs')}</div></div>${reqBody}</article></div>`;
  }

  function reportRowsForRequirement(display, rows){
    const code=reqCode(display),label=reqLabel(display);return rows.filter(r=>{
      if(norm(r.requirement)===norm(display))return true;
      const rc=reqCode(r.requirement),rl=reqLabel(r.requirement);
      if(code&&rc===code&&similarity(label,rl)>=.62)return true;
      return similarity(label,rl)>=.92;
    });
  }
  function searchUniverse(){
    const map=new Map();
    state.rows.forEach(r=>{const k=norm(r.requirement);if(k&&!map.has(k))map.set(k,{name:r.requirement,fromReport:true});});
    catalog().forEach(c=>{const name=`${c.code} - ${c.title}`,k=norm(name);if(!map.has(k))map.set(k,{name,fromCatalog:true});else map.get(k).fromCatalog=true;});
    return [...map.values()];
  }
  function searchScore(name,q){
    const n=norm(name),qq=norm(q);if(!qq)return 0;if(n===qq)return 100;if(n.startsWith(qq))return 90;if(n.includes(qq))return 80;
    const code=reqCode(name);if(code&&code.startsWith(qq))return 95;
    const Q=words(q),N=words(name);let hit=0;Q.forEach(w=>{if([...N].some(x=>x.includes(w)||w.includes(x)))hit++;});return Q.size?60*hit/Q.size:0;
  }
  function topDimension(rows,getter){
    const data=countBy(rows,r=>getter(r)).filter(x=>x.name&&x.name!=='Non précisé');return data[0]||{name:'—',count:0};
  }
  function topMentionDimension(rows){
    const m=new Map();rows.forEach(r=>splitMulti(r.mentions).forEach(v=>m.set(v,(m.get(v)||0)+1)));
    return [...m.entries()].map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count||String(a.name).localeCompare(String(b.name),'fr'))[0]||{name:'—',count:0};
  }
  function searchBreakdown(rows){
    return {profile:topDimension(rows,r=>r.profile),region:topDimension(rows,r=>r.region),department:topDimension(rows,r=>r.department),referential:topDimension(rows,r=>r.referential),mention:topMentionDimension(rows)};
  }
  function breakdownCell(label,item){return `<div class="req-search-dim"><span>${esc(label)}</span><b title="${attr(item.name)}">${esc(item.name)}</b><em>${fmt(item.count)} occ.</em></div>`;}

  function manualSearchHtml(){
    const q=state.search.trim();
    let results=[];
    if(q){results=searchUniverse().map(x=>({...x,score:searchScore(x.name,q)})).filter(x=>x.score>=35).sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name,'fr')).slice(0,12);}
    const selectionBase=filteredRows({ignoreRequirement:true}), allBase=state.rows, selectionActive=hasAnyFilters();
    return `<article class="obs-card req-search-card"><div class="req-search-head"><div><span>RECHERCHE MANUELLE</span><h2>Rechercher une exigence dans RAPPORT</h2><p>Code ou mots-clés : <b>3.3.14</b>, <b>IC Construction</b>, <b>Analyse de site</b>… Les cases cochées filtrent les occurrences et les profils / territoires / référentiels dominants.</p></div><label class="req-manual-search"><span>⌕</span><input data-req-search type="search" value="${attr(state.search)}" placeholder="Rechercher une exigence…" autocomplete="off"></label></div>${!q?`<div class="req-search-hint">Saisis une référence ou un intitulé pour connaître son nombre d’occurrences et où cette exigence apparaît le plus souvent.</div>`:results.length?`<div class="req-search-results">${results.map(x=>{
      const all=occurrenceRows(reportRowsForRequirement(x.name,allBase)),sel=occurrenceRows(reportRowsForRequirement(x.name,selectionBase)),basis=sel,breakdown=searchBreakdown(basis),evAll=evaluations(all).length,evSel=evaluations(sel).length;
      return `<div class="req-search-result req-search-result-rich"><div class="req-search-result-main"><button type="button" class="req-search-select" data-req-requirement="${attr(enc(x.name))}"><span>${esc(x.name)}</span><small>${fmt(evAll)} dossier${evAll>1?'s':''} dans RAPPORT · ${fmt(evSel)} dans la sélection${selectionActive?' filtrée':''}</small></button><div class="req-search-counts"><div class="req-search-count"><b>${fmt(all.length)}</b><span>occ. RAPPORT</span></div><div class="req-search-count is-selection"><b>${fmt(sel.length)}</b><span>occ. sélection</span></div>${infoButton(x.name)}</div></div><div class="req-search-breakdown">${breakdownCell('Profil',breakdown.profile)}${breakdownCell('Région',breakdown.region)}${breakdownCell('Département',breakdown.department)}${breakdownCell('Référentiel',breakdown.referential)}${breakdownCell('Mention',breakdown.mention)}</div></div>`;
    }).join('')}</div>`:`<div class="obs-empty">Aucune exigence correspondant à « ${esc(q)} ».</div>`}</article>`;
  }


  function infoModal(){
    if(!state.infoRequirement)return '';
    const candidates=catalogCandidates(state.infoRequirement),kind=inferredKind(state.infoRequirement,candidates),current=candidates.find(x=>x.kind===kind)||candidates[0];
    const allRows=occurrenceRows(reportRowsForRequirement(state.infoRequirement,state.rows)),selRows=occurrenceRows(reportRowsForRequirement(state.infoRequirement,filteredRows({ignoreRequirement:true})));
    const tabs=uniq(candidates.map(x=>x.kind));
    if(!current){
      return `<div class="req-info-overlay" data-req-info-close="1"><article class="req-info-modal" data-req-info-panel><button class="req-info-close" type="button" data-req-info-close="1">×</button><div class="req-info-title"><span>FICHE RÉFÉRENTIEL 2026</span><h2>${esc(state.infoRequirement)}</h2></div><div class="req-info-stats"><div><b>${fmt(allRows.length)}</b><span>occurrences RAPPORT</span></div><div><b>${fmt(selRows.length)}</b><span>dans la sélection</span></div></div><div class="req-info-warning">Cette exigence existe dans RAPPORT mais aucune correspondance suffisamment fiable n’a été trouvée dans les référentiels BEE Logement Neuf / Rénovation du 04/05/2026. Cela peut correspondre à une exigence d’une ancienne version du référentiel.</div></article></div>`;
    }
    const descParts=String(current.description||'').split('\n').filter(Boolean);
    return `<div class="req-info-overlay" data-req-info-close="1"><article class="req-info-modal" data-req-info-panel><button class="req-info-close" type="button" data-req-info-close="1">×</button><div class="req-info-title"><span>FICHE EXIGENCE · RÉFÉRENTIEL 04/05/2026</span><h2>${esc(current.code)} · ${esc(current.title)}</h2><small>${esc(current.referential)}</small></div>${tabs.length>1?`<div class="req-info-tabs">${tabs.map(t=>`<button type="button" data-req-info-kind="${attr(t)}" class="${t===current.kind?'is-active':''}">${esc(t)}</button>`).join('')}</div>`:''}<div class="req-info-stats"><div><b>${fmt(allRows.length)}</b><span>occurrences RAPPORT</span></div><div><b>${fmt(selRows.length)}</b><span>dans la sélection</span></div></div><div class="req-info-grid"><section><span>Cible</span><b>${esc(current.cibleCode)} · ${esc(current.cible)}</b></section><section><span>Thème</span><b>${esc(current.themeCode)} · ${esc(current.theme)}</b></section></div><section class="req-info-section"><h3>Description / objectif</h3>${descParts.length?descParts.map(p=>`<p>${esc(p)}</p>`).join(''):'<p>Non précisé dans la fiche extraite.</p>'}</section><section class="req-info-section"><h3>Pièces justificatives</h3>${current.pieces?.length?`<ul>${current.pieces.map(p=>`<li>${esc(p)}</li>`).join('')}</ul>`:'<p>Aucune pièce justificative explicitement listée dans cette section du référentiel.</p>'}</section></article></div>`;
  }

  // ---------------------------------------------------------------- V6.14 · exigences d'une opération (API des fiches projets)
  const normId=v=>MENTIONS()?.normalizeId?MENTIONS().normalizeId(v):String(v??'').trim().toUpperCase();
  const SYNTHETIC_EVALUATION=/^(OP|ROW|LIGNE):/;
  function operationIndex(){
    if(opIndex)return opIndex;
    opIndex=new Map();
    state.rows.forEach(r=>{const k=normId(r.operationCode);if(!k)return;if(!opIndex.has(k))opIndex.set(k,[]);opIndex.get(k).push(r);});
    return opIndex;
  }
  // En mode anonymisé, la fiche ne connaît que le pseudonyme « OP-123456 » : on le retrouve par le même calcul.
  function pseudoOperationIndex(){
    const p=privacy();const tag=p?.enabled?.()?'on':'off';
    if(pseudoIndex&&pseudoIndexPrivacy===tag)return pseudoIndex;
    pseudoIndex=new Map();pseudoIndexPrivacy=tag;
    if(tag==='on'){const seen=new Set();state.rows.forEach(r=>{const raw=String(r.operationCode||'').trim();if(!raw||seen.has(raw))return;seen.add(raw);const k=normId(raw);const ps=p.operationCode(raw);if(!pseudoIndex.has(ps))pseudoIndex.set(ps,new Set());pseudoIndex.get(ps).add(k);});}
    return pseudoIndex;
  }
  const deepFreeze=o=>{if(o&&typeof o==='object'&&!Object.isFrozen(o)){Object.freeze(o);Object.values(o).forEach(deepFreeze);}return o;};
  function sourceState(){
    if(state.loading)return 'loading';
    if(state.connected)return 'ready';
    if(state.errorKind==='auth')return 'unauthorized';
    if(state.error)return 'error';
    return 'disconnected';
  }
  function targetLabelFor(r,ctx){
    if(ctx.family==='BEE_TN'||ctx.family==='BEE_TE')return '';
    const t=rowTarget(r);return /^[1-4]$/.test(t)?t:'';
  }
  // Instantané immuable : les fiches ne lisent jamais l'état interne du module.
  function getOperationRequirements(code,options={}){
    const st=sourceState();
    const base={state:st,error:state.error,loadedAt:state.loadedAt,version:VERSION};
    if(st!=='ready')return deepFreeze({...base,evaluations:[],matched:false});
    let keys=[];const raw=String(code??'').trim();
    if(options.pseudonymized&&/^OP-\d{6}$/.test(raw))keys=[...(pseudoOperationIndex().get(raw)||[])];
    else if(raw)keys=[normId(raw)];
    const rows=keys.flatMap(k=>operationIndex().get(k)||[]);
    if(!rows.length)return deepFreeze({...base,matched:false,evaluations:[],partial:[]});
    const exactRaw=rows.every(r=>String(r.operationCode)===raw);
    const M=MENTIONS(),cat=MENTION_CATALOG();
    const groups=new Map();
    rows.forEach(r=>{
      const ctx=M?M.rowContext(r,cat):{key:'',family:'',version:''};
      const evalKey=`${r.evaluationCode}\u0001${ctx.key||norm(r.referential)+'|'+norm(r.referentialVersion)}`;
      if(!groups.has(evalKey))groups.set(evalKey,{evaluationCode:r.evaluationCode,synthetic:SYNTHETIC_EVALUATION.test(r.evaluationCode),referential:r.referential,referentialVersion:r.referentialVersion||r.referentialVersionDate,contextKey:ctx.key,family:ctx.family,versionDate:ctx.version,status:r.status,rows:0,items:new Map(),unresolved:0});
      const g=groups.get(evalKey);g.rows++;
      const res=M?M.resolveRequirement(r,cat,ctx):{code:reqCode(r.requirement),label:reqLabel(r.requirement),status:'uncatalogued'};
      const code=res.code||'';const label=res.label||reqLabel(r.requirement)||r.requirement;
      const k=code?`c:${code}`:`l:${norm(label)}`;
      if(!code)g.unresolved++;
      if(!g.items.has(k))g.items.set(k,{code,label,target:targetLabelFor(r,ctx),validated:String(r.requirementValidated||'').trim(),resolution:res.status,reason:res.reason||'',sourceRows:[]});
      const it=g.items.get(k);if(r.sourceRow)it.sourceRows.push(r.sourceRow);if(!it.validated&&r.requirementValidated)it.validated=String(r.requirementValidated).trim();
    });
    const evaluationsOut=[...groups.values()].map(g=>({
      evaluationCode:g.synthetic?'':displayEvaluation(g.evaluationCode),synthetic:g.synthetic,referential:g.referential,referentialVersion:g.referentialVersion,contextKey:g.contextKey,versionDate:g.versionDate,status:g.status,rows:g.rows,
      duplicatesRemoved:Math.max(0,g.rows-g.items.size),unresolved:g.unresolved,
      requirements:[...g.items.values()].map(x=>({...x,sourceRows:x.sourceRows.slice(0,20)})).sort((a,b)=>(a.code&&b.code?String(a.code).localeCompare(String(b.code),'fr',{numeric:true}):(a.code?-1:b.code?1:0))||String(a.label).localeCompare(String(b.label),'fr'))
    })).sort((a,b)=>String(b.versionDate||'').localeCompare(String(a.versionDate||''))||String(a.evaluationCode).localeCompare(String(b.evaluationCode),'fr',{numeric:true}));
    const partial=[];
    if(!exactRaw)partial.push('Rapprochement après normalisation de l’écriture du code (espaces, casse ou caractères invisibles).');
    const unres=evaluationsOut.reduce((n,e)=>n+e.unresolved,0);if(unres)partial.push(`${unres} exigence${unres>1?'s':''} sans code d’exigence fiable : affichée${unres>1?'s':''} par son intitulé, sans rattachement normatif.`);
    if(evaluationsOut.some(e=>e.synthetic))partial.push('Certaines lignes RAPPORT n’ont pas de code d’évaluation : elles sont regroupées à part.');
    if(evaluationsOut.some(e=>!e.contextKey))partial.push('Référentiel ou version non reconnu sur certaines lignes.');
    return deepFreeze({...base,matched:true,evaluations:evaluationsOut,partial,multiple:evaluationsOut.length>1,contexts:new Set(evaluationsOut.map(e=>e.contextKey||e.referential)).size});
  }

  // ---------------------------------------------------------------- V6.14 · compatibilité avec les mentions
  function compatScopeRows(){
    // Périmètre = filtres généraux de l'onglet. Le focus local sur une exigence, la fiche « i », la recherche et le filtre Thème
    // (qui retire des exigences et non des opérations) ne réduisent pas le bouquet.
    return filteredRows({ignoreRequirement:true,ignoreTheme:true});
  }
  let compatCache=null;
  function compatModel(){
    const M=MENTIONS(),cat=MENTION_CATALOG();
    if(!M||!cat)return {error:'Moteur ou catalogue des mentions indisponible (newosb-mentions.js / mentions_catalog.js).'};
    const rows=compatScopeRows();
    const size=state.compat.size||M.BOUQUET_SIZE;
    const sig=`${rows.length}|${state.rows.length}|${state.loadedAt}|${JSON.stringify(state.filters)}|${size}`;
    let bouquets;
    if(compatCache&&compatCache.sig===sig)bouquets=compatCache.bouquets;else{bouquets=M.buildBouquets(rows,cat,{size});compatCache={sig,bouquets};}
    const contexts=bouquets.contexts;
    let ctx=contexts.find(c=>c.key===state.compat.context);
    // Périmètre initial : le plus documenté parmi ceux dont les règles sont disponibles (sinon le plus documenté).
    if(!ctx){const covered=contexts.find(c=>c.source&&c.source.status==='available');ctx=covered||contexts[0]||null;state.compat.autoContext=ctx?.key||'';if(state.compat.context&&!contexts.some(c=>c.key===state.compat.context))state.compat.context='';}
    const values=state.compat.values[ctx?.key||'']||{};
    const analysis=ctx?M.analyseContext(ctx,cat,values):null;
    return {M,cat,rows,bouquets,ctx,values,analysis};
  }
  const STATE_ICONS={covered:['✓','is-covered','Présente dans le bouquet comparé'],absent:['○','is-absent','Absente du bouquet comparé'],unknown:['?','is-unknown','Condition inconnue'],unresolved:['?','is-unknown','Correspondance non résolue (à vérifier)'],na:['—','is-na','Non applicable'],partial:['◐','is-unknown','Partiellement couvert']};
  function reqTitle(cat,ctxKey,code){const s=MENTIONS()?.sourceFor?.(cat,ctxKey);return s?.requirements?.find(r=>r.code===code)?.title||'';}
  function unitHtml(u,cat,ctxKey){
    const [icon,cls,title]=STATE_ICONS[u.state]||STATE_ICONS.unknown;
    const codeLabel=c=>{const t=reqTitle(cat,ctxKey,c);return `<b>${esc(c)}</b>${t?` ${esc(t)}`:''}`;};
    let main='';
    if(u.kind==='req'){
      main=u.label?esc(u.label):codeLabel(u.code);
      const via=u.label?(u.via||[]):(u.via||[]).filter(c=>c!==u.code);
      if(u.state==='covered'&&via.length)main+=`<em>couvert par ${via.map(esc).join(', ')}</em>`;
      if(u.state==='unresolved')main+=`<em>${esc(u.note)} (${(u.via||[]).map(esc).join(', ')})</em>`;
      if(u.state==='unknown'||u.state==='na')main+=`<em>${esc(u.note||'')}</em>`;
    }else if(u.kind==='mention'){main=`Mention « ${esc(u.label)} »<em>${esc(u.note||'')}</em>`;}
    else if(u.kind==='atLeast'){main=`${esc(u.label||'Au moins '+u.k)} · ${fmt(u.coveredUnits)}/${fmt(u.units)}`;}
    else if(u.kind==='any'||u.kind==='all'){main=`${esc(u.label||(u.kind==='any'?'Une alternative parmi':'Groupe'))}${u.via?.length?`<em>couvert par ${u.via.map(esc).join(', ')}</em>`:''}`;}
    else main=`${esc(u.label||'Critère indéterminé')}<em>${esc(u.note||'')}</em>`;
    return `<li class="req-compat-unit ${cls}"><span class="req-compat-icon" aria-hidden="true">${icon}</span><span class="sr-only">${esc(title)} : </span><span class="req-compat-unit-text">${main}</span></li>`;
  }
  function mentionCardHtml(result,slot,model,extra=''){
    const {cat,ctx}=model;const m=result?.mention;
    const slotLabel=slot===1?'Mention la plus compatible':slot===2?'2e mention la plus compatible':(state.compat.manualMention?'Comparaison libre':'3e mention la plus compatible');
    if(!result)return `<article class="req-compat-mention is-empty"><header><span>${esc(slotLabel)}</span><h3>Aucun résultat calculable</h3></header><p class="req-compat-empty">Moins de ${slot} mention${slot>1?'s':''} calculable${slot>1?'s':''} de façon fiable dans ce périmètre et ce contexte.</p>${extra}</article>`;
    const src=MENTIONS().sourceFor(cat,m.context);
    let score;
    if(result.status==='ok')score=`<div class="req-compat-score"><strong>${fmt(result.pct,0)} %</strong><span>${fmt(result.covered)} / ${fmt(result.required)} critère${result.required>1?'s':''} couvert${result.covered>1?'s':''}</span><i role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(result.pct)}" aria-label="Couverture"><b style="width:${Math.max(0,Math.min(100,result.pct)).toFixed(1)}%"></b></i></div>`;
    else if(result.status==='provisional')score=`<div class="req-compat-score is-provisional"><strong>${result.pct===null?'—':fmt(result.pct,0)+' %'}</strong><span>Provisoire · ${fmt(result.covered)} / ${fmt(result.required)} critères déterminés couverts · ${fmt(result.unknownUnits||0)} indéterminé${(result.unknownUnits||0)>1?'s':''}</span><small>${esc(result.reason)}</small></div>`;
    else if(result.status==='not_applicable')score=`<div class="req-compat-score is-na"><strong>Non applicable</strong><small>${esc(result.reason)}</small></div>`;
    else score=`<div class="req-compat-score is-na"><strong>Non calculable</strong><small>${esc(result.reason)}</small></div>`;
    const units=(result.units||[]).length?`<ul class="req-compat-units">${result.units.map(u=>unitHtml(u,cat,m.context)).join('')}</ul>`:'';
    const present=model.analysis?.present||new Set();
    const listCodes=(codes,label)=>codes?.length?`<div class="req-compat-extra"><span>${esc(label)}</span>${codes.map(c=>`<b class="${present.has(c)?'is-present':''}" title="${attr(reqTitle(cat,m.context,c))}">${esc(c)}${present.has(c)?' ✓':''}</b>`).join('')}</div>`:'';
    const notes=[m.points?.text&&`Seuil de points : ${m.points.text}`,m.cumulation?.text&&`Cumul : ${m.cumulation.text}`,...(m.prerequisites||[]).map(p=>`Prérequis : ${p.text}`),...(m.applicability||[]).map(a=>`Application : ${a.text}`)].filter(Boolean);
    const sources=(m.sources||[]).map(s=>`${s.doc} (${s.version}) p. ${s.pages}`).join(' · ');
    return `<article class="req-compat-mention ${slot===3&&state.compat.manualMention?'is-manual':''}" aria-label="${attr(slotLabel+' : '+m.name)}"><header><span>${esc(slotLabel)}</span><h3>${esc(m.name)}</h3><small>${esc(src?`${src.title} · ${src.versionLabel}`:m.context)} · mention ${esc(m.kind||'')}</small></header>${score}${extra}${units}${listCodes(m.optional,'Optionnelles (sans effet sur le score)')}${listCodes(m.recommended,'Recommandées (sans effet sur le score)')}${notes.length?`<details class="req-compat-notes"><summary>Prérequis, seuils et cumul (${fmt(notes.length)})</summary><ul>${notes.map(n=>`<li>${esc(n)}</li>`).join('')}</ul></details>`:''}<footer>Source : ${esc(sources||'—')}</footer></article>`;
  }
  function compatSection(){
    const head=`<div class="obs-section-title req-compat-title"><div><span>04</span><h2>Compatibilité des exigences sélectionnées avec les mentions</h2></div><p>Mentions dont les critères nécessaires sont les mieux couverts par les exigences les plus sélectionnées du périmètre filtré.</p></div>`;
    const disclaimer=`<p class="req-compat-disclaimer">Compatibilité des sélections ; l’obtention d’une mention reste soumise à la validation des exigences, aux prérequis et aux seuils applicables.</p>`;
    const model=compatModel();
    if(model.error)return `${head}<article class="obs-card req-compat-card"><div class="obs-empty">${esc(model.error)}</div>${disclaimer}</article>`;
    const {M,cat,bouquets,ctx}=model;
    if(!ctx)return `${head}<article class="obs-card req-compat-card"><div class="obs-empty">Aucune opération documentée (avec un code opération et un référentiel BEE reconnu) dans ce périmètre.</div>${diagHtml(model)}${disclaimer}</article>`;
    const ctxSelect=bouquets.contexts.length>1?`<label class="req-inline-select req-compat-context"><span>Périmètre normatif</span><select data-req-compat-context="1">${bouquets.contexts.map(c=>`<option value="${attr(c.key)}" ${c.key===ctx.key?'selected':''}>${esc(`${c.familyLabel} · ${c.versionLabel} — ${fmt(c.operations)} opération${c.operations>1?'s':''}${c.source?.status==='available'?'':' · règles non disponibles'}`)}${c.key===state.compat.autoContext?' (par défaut)':''}</option>`).join('')}</select></label>`:'';
    const fields=M.contextFieldsFor(cat,ctx.key);
    const values=model.values;
    const fieldsHtml=fields.length?`<details class="req-compat-fields" ${state.compat.openFields?'open':''} data-req-compat-toggle="openFields"><summary>Conditions d’application du contexte (${fmt(fields.filter(f=>values[f.id]).length)} / ${fmt(fields.length)} renseignées)</summary><p>Une condition laissée « Inconnu » rend les mentions concernées provisoires : elles sont alors exclues du classement automatique.</p><div class="req-compat-field-grid">${fields.map(f=>`<label><span>${esc(f.label)}</span><select data-req-compat-field="${attr(f.id)}"><option value="">Inconnu</option>${f.values.map(([v,l])=>`<option value="${attr(v)}" ${values[f.id]===v?'selected':''}>${esc(l)}</option>`).join('')}</select></label>`).join('')}</div></details>`:'';
    const source=ctx.source;
    const analysis=model.analysis;
    const sizes=[[String(M.BOUQUET_SIZE),`Top ${M.BOUQUET_SIZE} (par défaut)`],['40','Top 40'],['all','Toutes les exigences du périmètre filtré']];
    const curSize=String(state.compat.size||M.BOUQUET_SIZE);
    const sizeSelect=`<label class="req-compat-size"><span>Bouquet comparé</span><select data-req-compat-size="1">${sizes.map(([v,l])=>`<option value="${v}" ${curSize===v?'selected':''}>${esc(l)}</option>`).join('')}</select></label>`;
    const meta=`<div class="req-compat-meta"><div><span>Référentiel comparé</span><b>${esc(ctx.familyLabel)}</b><small>${ctx.source?.status==='available'?`règles du ${esc(ctx.versionLabel)}, appliquées à toutes les versions`:'règles non fournies'}</small></div><div><span>Opérations documentées</span><b>${fmt(ctx.operations)}</b><small>opérations distinctes ayant des lignes RAPPORT</small></div><div>${sizeSelect}<b>${fmt(ctx.top.length)} exigence${ctx.top.length>1?'s':''}</b><small>${curSize==='all'?'toutes les exigences sélectionnées au moins une fois':ctx.top.length<ctx.size?`moins de ${fmt(ctx.size)} exigences disponibles`:`les plus sélectionnées, par opérations distinctes`}</small></div></div>`;
    let cards='';
    if(!source||source.status!=='available'){
      cards+=`<div class="req-compat-uncovered" role="note"><b>Règles non disponibles</b><span>${esc(source?.missing||`Aucune règle de mentions n’a été fournie pour ${ctx.familyLabel}.`)}</span></div>`;
    }
    const ranked=analysis?.ranked||[];
    const menu=M.mentionMenu(cat);
    const allMentions=menu.flatMap(g=>g.mentions);
    const manual=state.compat.manualMention?allMentions.find(m=>m.id===state.compat.manualMention):null;
    if(state.compat.manualMention&&!manual)state.compat.manualMention='';
    const third=ranked[2]||null;
    const selectHtml=`<label class="req-compat-select"><span>Comparer une autre mention</span><select data-req-compat-mention="1" aria-label="Mention de la troisième carte"><option value="">3e résultat automatique${third?` (${third.name})`:''}</option>${menu.map(g=>`<optgroup label="${attr(g.label+(g.status==='source_missing'?' — règles non fournies':''))}">${g.mentions.map(m=>`<option value="${attr(m.id)}" ${state.compat.manualMention===m.id?'selected':''}>${esc(m.name)}</option>`).join('')}</optgroup>`).join('')}</select></label>${state.compat.manualMention?'<button type="button" class="req-compat-reset" data-req-compat-auto="1">Revenir au 3e résultat automatique</button>':''}`;
    let thirdHtml;
    if(manual){
      let result=null,extra='';
      if(manual.context!==ctx.key){
        const target=bouquets.contexts.find(c=>c.key===manual.context);
        const s=M.sourceFor(cat,manual.context);
        extra=`<div class="req-compat-mismatch" role="note"><b>Contexte différent</b><span>Cette mention relève de ${esc(s?`${s.title} · ${s.versionLabel}`:manual.context)} ; le bouquet comparé est celui de ${esc(ctx.familyLabel)} · ${esc(ctx.versionLabel)}. Les codes de référentiels différents ne sont pas comparés.</span>${target?`<button type="button" data-req-compat-context-go="${attr(target.key)}">Comparer sur ce périmètre (${fmt(target.operations)} opération${target.operations>1?'s':''})</button>`:'<small>Aucune opération documentée de ce périmètre dans les filtres actuels.</small>'}</div>`;
        result={mention:manual,status:'not_computable',reason:'Contexte normatif différent du bouquet comparé.',units:[],covered:0,required:0,pct:null};
      }else{
        result=analysis.results.find(r=>r.id===manual.id);
        const dup=ranked.slice(0,2).findIndex(r=>r.id===manual.id);
        if(dup>=0)extra=`<div class="req-compat-dup" role="note">Même mention que la carte ${dup+1} : comparaison libre affichée à l’identique.</div>`;
      }
      thirdHtml=mentionCardHtml(result,3,model,selectHtml+extra);
    }else thirdHtml=mentionCardHtml(third,3,model,selectHtml);
    const lessThan3=ranked.length<3?`<p class="req-compat-few" role="note">${ranked.length?`Seulement ${fmt(ranked.length)} mention${ranked.length>1?'s':''} calculable${ranked.length>1?'s':''} de façon fiable dans ce contexte.`:'Aucune mention calculable de façon fiable dans ce contexte.'} Les mentions provisoires ou non calculables figurent dans le tableau ci-dessus avec leur raison.</p>`:'';
    const allRes=(analysis?.results||[]).slice().sort((a,b)=>{const rk=r=>r.status==='ok'?0:r.status==='provisional'?1:2;return rk(a)-rk(b)||((b.pct??-1)-(a.pct??-1))||(b.required-a.required)||String(a.name).localeCompare(String(b.name),'fr');});
    const statusLabel=r=>r.status==='ok'?'Calculée':r.status==='provisional'?'Provisoire':r.status==='not_applicable'?'Non applicable':'Non calculable';
    const tableHtml=allRes.length?`<div class="req-compat-all"><h3>Compatibilité des opérations filtrées avec chaque mention · ${esc(ctx.familyLabel)}</h3><div class="req-table-wrap"><table class="req-matrix req-compat-table"><thead><tr><th>Mention</th><th>Compatibilité</th><th>Critères couverts</th><th>Statut</th><th></th></tr></thead><tbody>${allRes.map(r=>`<tr class="is-${attr(r.status)}"><td><b>${esc(r.name)}</b></td><td class="req-compat-pct">${r.pct===null||r.pct===undefined||r.status==='not_applicable'||r.status==='not_computable'?'—':`<span class="req-compat-bar"><i style="width:${Math.max(0,Math.min(100,r.pct)).toFixed(1)}%"></i></span><b>${fmt(r.pct,0)} %</b>`}</td><td>${r.required?`${fmt(r.covered)} / ${fmt(r.required)}`:'—'}${r.unknownUnits?` <small>+ ${fmt(r.unknownUnits)} indéterminé${r.unknownUnits>1?'s':''}</small>`:''}</td><td><span class="req-compat-status is-${attr(r.status)}" title="${attr(r.reason||'')}">${statusLabel(r)}</span>${r.status!=='ok'&&r.reason?`<small>${esc(r.reason)}</small>`:''}</td><td><button type="button" class="req-compat-see" data-req-compat-see="${attr(r.id)}">Détail</button></td></tr>`).join('')}</tbody></table></div></div>`:'';
    const others=[];
    const othersHtml=others.length?`<details class="req-compat-others"><summary>Mentions non classées dans ce contexte (${fmt(others.length)})</summary><ul>${others.map(r=>`<li><b>${esc(r.name)}</b> · ${esc(r.status==='provisional'?'provisoire':r.status==='not_applicable'?'non applicable':'non calculable')}${r.status==='provisional'&&r.pct!==null?` (${fmt(r.pct,0)} % sur les critères déterminés)`:''} — ${esc(r.reason)}</li>`).join('')}</ul></details>`:'';
    const legend=`<div class="req-compat-legend" aria-label="Légende"><span class="is-covered"><i aria-hidden="true">✓</i>Présente dans le bouquet comparé</span><span class="is-absent"><i aria-hidden="true">○</i>Absente du bouquet comparé</span><span class="is-unknown"><i aria-hidden="true">?</i>Condition inconnue ou correspondance non résolue</span><span class="is-na"><i aria-hidden="true">—</i>Non applicable</span></div>`;
    const grid=(source&&source.status==='available')?`<div class="req-compat-grid">${mentionCardHtml(ranked[0]||null,1,model)}${mentionCardHtml(ranked[1]||null,2,model)}${thirdHtml}</div>`:`<div class="req-compat-grid req-compat-grid-single">${thirdHtml}</div>`;
    return `${head}<article class="obs-card req-compat-card" aria-labelledby="reqCompatTitle"><div class="obs-card-head"><div><span>MENTIONS × BOUQUET D’EXIGENCES</span><h2 id="reqCompatTitle">Couverture des critères par le bouquet</h2></div><div class="req-head-actions">${ctxSelect}</div></div>${meta}${cards}${fieldsHtml}${tableHtml}${legend}${lessThan3}${grid}${othersHtml}${bouquetHtml(ctx)}${diagHtml(model)}${disclaimer}</article>`;
  }
  function bouquetHtml(ctx){
    const rows=ctx.top.map((it,i)=>`<tr><td>${i+1}</td><td><b>${esc(it.code)}</b></td><td>${esc(it.label)}</td><td>${fmt(it.operations)}</td><td>${fmt(100*it.frequency,1)} %</td></tr>`).join('');
    return `<details class="req-compat-bouquet" ${state.compat.openBouquet?'open':''} data-req-compat-toggle="openBouquet"><summary>Consulter le bouquet comparé (${fmt(ctx.top.length)} exigence${ctx.top.length>1?'s':''} · ${fmt(ctx.operations)} opération${ctx.operations>1?'s':''} documentée${ctx.operations>1?'s':''})</summary><p>Fréquence = opérations distinctes ayant sélectionné l’exigence / opérations distinctes disposant de lignes RAPPORT dans ce contexte. Une opération ne compte qu’une fois par exigence, quel que soit le nombre de lignes ou d’évaluations. Une exigence hors de ce Top peut avoir été sélectionnée sur certains projets.</p><div class="req-table-wrap"><table class="req-matrix"><thead><tr><th>#</th><th>Code</th><th>Intitulé</th><th>Opérations</th><th>Fréquence</th></tr></thead><tbody>${rows||'<tr><td colspan="5">Aucune exigence.</td></tr>'}</tbody></table></div></details>`;
  }
  function diagHtml(model){
    const ctx=model.ctx,d=model.bouquets?.diagnostics||{},list=[];
    (ctx?.unresolved||[]).forEach(u=>list.push(`<tr><td>${esc(u.code||'—')}</td><td>${esc(u.label)}</td><td>${esc(u.reason)}</td><td>${fmt(u.operations)}</td></tr>`));
    (d.withoutContext||[]).forEach(w=>list.push(`<tr><td>—</td><td>Lignes hors contexte normatif</td><td>${esc(w.reason)}</td><td>${fmt(w.operations)}</td></tr>`));
    if(d.rowsWithoutOperation)list.push(`<tr><td>—</td><td>Lignes sans code opération</td><td>Impossible de compter une opération distincte : lignes exclues du calcul</td><td>${fmt(d.rowsWithoutOperation)} ligne${d.rowsWithoutOperation>1?'s':''}</td></tr>`);
    const others=(model.bouquets?.contexts||[]).filter(c=>c.key!==ctx?.key).map(c=>`${c.familyLabel} · ${c.versionLabel} (${fmt(c.operations)})`);
    const vers=(d.versions||[]);
    const versHtml=vers.length?`<h4 class="req-compat-diag-title">Référentiels et versions lus dans RAPPORT (périmètre filtré) — la version est indicative, seules les familles Neuf / Rénovation comptent</h4><div class="req-table-wrap"><table class="req-matrix"><thead><tr><th>Référentiel (RAPPORT)</th><th>Version (RAPPORT)</th><th>Opérations</th><th>Rattachement</th></tr></thead><tbody>${vers.map(v=>`<tr><td>${esc(v.referential||'—')}</td><td>${esc(v.version||'—')}</td><td>${fmt(v.operations)}</td><td>${v.covered?`✓ règles ${esc(v.sourceLabel)}`:esc(v.reason||(v.sourceLabel?`${v.sourceLabel} : règles non fournies`:'Version non couverte'))}</td></tr>`).join('')}</tbody></table></div>`:'';
    const uncoveredOps=vers.filter(v=>!v.covered).reduce((n,v)=>n+v.operations,0);
    return `<details class="req-compat-diag" ${state.compat.openDiag?'open':''} data-req-compat-toggle="openDiag"><summary>Diagnostic : versions lues et exigences sans correspondance fiable (${fmt(list.length)}${uncoveredOps?` · ${fmt(uncoveredOps)} opération${uncoveredOps>1?'s':''} sans règles disponibles`:''})</summary>${versHtml}${others.length?`<p>Autres périmètres présents dans les filtres, non mélangés : ${esc(others.join(' · '))}.</p>`:''}${list.length?`<div class="req-table-wrap"><table class="req-matrix"><thead><tr><th>Code</th><th>Exigence</th><th>Raison de l’exclusion</th><th>Opérations</th></tr></thead><tbody>${list.join('')}</tbody></table></div>`:'<p>Toutes les exigences du contexte ont une correspondance fiable.</p>'}</details>`;
  }

  function render(){
    const source=sourceCard();
    if(!state.connected)return `${source}<div class="req-empty-state"><span>▤</span><h2>Connecter le Google Sheet des exigences</h2><p>Cette rubrique repart exclusivement de l’onglet <b>RAPPORT</b>. Les référentiels BEE Logement Neuf et Rénovation du 04/05/2026 sont déjà intégrés pour les fiches d’information « i » et la recherche manuelle.</p><a href="Code_Exigences.gs" download>Télécharger Code_Exigences.gs</a></div>${infoModal()}`;
    const rows=filteredRows(), occ=occurrenceRows(rows), evs=evaluations(rows), refs=uniq(evs.map(r=>r.referential)), years=uniq(evs.map(r=>r.year).filter(Boolean)).sort((a,b)=>a-b), neuf=evs.filter(r=>r.nature==='Neuf').length,reno=evs.filter(r=>r.nature==='Rénovation').length;
    return `${source}${filtersHtml()}<div class="req-page-title"><div><span>ANALYSE DES EXIGENCES</span><h1>${filterValues('profile').length===1?`Profil ${esc(filterValues('profile')[0].replace(/^Profil\s+/i,''))}`:filterValues('profile').length>1?`${filterValues('profile').length} profils sélectionnés`:'Toutes évaluations'}</h1><p>Retraitement dynamique de RAPPORT · filtres par profil, région et département · fiches référentiel 2026 accessibles avec le bouton <b>i</b>.</p></div><div class="req-page-meta">${years.length?`${years[0]}–${years[years.length-1]}`:'—'}<small>${refs.length} référentiel${refs.length>1?'s':''}</small></div></div>
    <div class="obs-grid-kpi req-kpis"><article class="obs-kpi"><span>Dossiers analysés</span><strong>${fmt(evs.length)}</strong><small>évaluations uniques</small></article><article class="obs-kpi"><span>Exigences sélectionnées</span><strong>${fmt(occ.length)}</strong><small>occurrences distinctes</small></article><article class="obs-kpi"><span>Neuf</span><strong>${fmt(neuf)}</strong><small>${fmt(pct(neuf,evs.length),1)} % du panel</small></article><article class="obs-kpi"><span>Rénovation</span><strong>${fmt(reno)}</strong><small>${fmt(pct(reno,evs.length),1)} % du panel</small></article></div>
    ${manualSearchHtml()}
    <div class="obs-grid-2"><article class="obs-card"><div class="obs-card-head"><div><span>RÉPARTITION SECTORIELLE</span><h2>Neuf / Rénovation</h2></div><small>${fmt(evs.length)} dossiers</small></div>${sectorCard(rows)}</article><article class="obs-card"><div class="obs-card-head"><div><span>STRUCTURE DU PANEL</span><h2>Chronologie par référentiel</h2></div><div class="req-head-actions"><small>année de version du référentiel</small>${reqViewToggle('chronology')}</div></div>${panelChronology(rows)}</article></div>
    <article class="obs-card req-top-card"><div class="obs-card-head"><div><span>VOLUME GLOBAL</span><h2>Exigences les plus récurrentes</h2></div><div class="req-head-actions"><small>Liste = 15 / page · Tuiles = importance + cible</small>${reqViewToggle('topGlobal',['list','tiles'])}</div></div>${(state.views.topGlobal||'list')==='tiles'?requirementTiles(requirementCounts(rows),rows,occ.length):requirementList(requirementCounts(rows),'topGlobal')}</article>
    <div class="obs-section-title"><div><span>01</span><h2>Management, environnement, sobriété & usages</h2></div><p>Lecture par cible avec comparaison Neuf / Rénovation.</p></div>${themePanels(rows)}
    <div class="obs-section-title"><div><span>02</span><h2>Évolution des exigences</h2></div><p>Les autres filtres restent actifs ; la période est volontairement dépliée par année.</p></div><article class="obs-card"><div class="obs-card-head"><div><span>ÉVOLUTION</span><h2>Exigences par année</h2></div><div class="req-head-actions"><small>Liste = 15 / page · Barres = Top 5</small>${reqViewToggle('evolution')}</div></div>${evolutionTable()}</article>
    <div class="obs-section-title"><div><span>03</span><h2>Mentions & exigences associées</h2></div><p>Mentions les plus demandées et Top 5 des exigences associées.</p></div>${mentionsSection(rows)}${compatSection()}${infoModal()}`;
  }

  function afterRender(){
    if(state.searchEditing){setTimeout(()=>{const input=document.querySelector('[data-req-search]');if(input){const p=input.value.length;try{input.focus({preventScroll:true});input.setSelectionRange(p,p);}catch{try{input.focus();}catch{}}}state.searchEditing=false;},0);}
    if(state.focusSelector){const sel=state.focusSelector;state.focusSelector='';const el=document.querySelector(sel);if(el){try{el.focus({preventScroll:true});}catch{}}}
  }
  function handleClick(e){
    const view=e.target.closest('[data-req-view][data-view]');if(view){const mode=['list','bar','tiles'].includes(view.dataset.view)?view.dataset.view:'list';state.views[view.dataset.reqView]=mode;state.pages[view.dataset.reqView]=1;emit();return true;}
    const pager=e.target.closest('[data-req-page][data-page]');if(pager){state.pages[pager.dataset.reqPage]=Math.max(1,Number(pager.dataset.page)||1);emit();return true;}
    const mentionBtn=e.target.closest('[data-req-mention-focus-button]');if(mentionBtn){state.mentionFocus=mentionBtn.dataset.reqMentionFocusButton||'';emit();return true;}
    const connect=e.target.closest('[data-req-connect]');if(connect){
      const input=document.getElementById('reqSourceUrl'),keyInput=document.getElementById('reqSourceKey');
      const typed=String(keyInput?.value||'').trim();if(typed)bridge?.setKey(typed);if(keyInput)keyInput.value='';
      const split=window.NEWOSB_BRIDGE?window.NEWOSB_BRIDGE.splitUrl(input?.value||state.url):{url:input?.value||state.url,key:''};
      if(split.key)bridge?.setKey(split.key);const url=split.url;
      // Fenêtre Google ouverte pendant le clic (sinon bloquée) : elle permet l'autorisation du compte si nécessaire.
      if(bridge&&bridge.hasKey()&&url)bridge.preparePopup(url);
      state.focusSelector='[data-req-connect]';load(url);return true;}
    if(e.target.closest('[data-req-disconnect]')){state.focusSelector='[data-req-connect]';disconnect();return true;}
    if(e.target.closest('[data-req-forget]')){forgetSource();return true;}
    const see=e.target.closest('[data-req-compat-see]');if(see){state.compat.manualMention=see.dataset.reqCompatSee||'';state.focusSelector='[data-req-compat-mention]';emit();setTimeout(()=>{try{document.querySelector('[data-req-compat-mention]')?.closest('.req-compat-mention')?.scrollIntoView({block:'nearest'});}catch{}},40);return true;}
    if(e.target.closest('[data-req-compat-auto]')){state.compat.manualMention='';state.focusSelector='[data-req-compat-mention]';emit();return true;}
    const go=e.target.closest('[data-req-compat-context-go]');if(go){state.compat.context=go.dataset.reqCompatContextGo||'';state.focusSelector='[data-req-compat-mention]';emit();return true;}
    const tg=e.target.closest('details[data-req-compat-toggle]>summary');if(tg){const d=tg.parentElement,k=d.dataset.reqCompatToggle;setTimeout(()=>{if(k in state.compat)state.compat[k]=!!d.open;},0);return false;}
    const info=e.target.closest('[data-req-info]');if(info){state.infoRequirement=dec(info.dataset.reqInfo);state.infoKind='';emit();return true;}
    const kind=e.target.closest('[data-req-info-kind]');if(kind){state.infoKind=kind.dataset.reqInfoKind||'';emit();return true;}
    const close=e.target.closest('[data-req-info-close]');if(close&&!e.target.closest('[data-req-info-panel]')){state.infoRequirement='';state.infoKind='';emit();return true;}
    if(e.target.matches('.req-info-close')){state.infoRequirement='';state.infoKind='';emit();return true;}
    const req=e.target.closest('[data-req-requirement]');if(req){const v=dec(req.dataset.reqRequirement);state.requirement=norm(state.requirement)===norm(v)?'':v;emit();return true;}
    if(e.target.closest('[data-req-clear-requirement]')){state.requirement='';emit();return true;}
    const clear=e.target.closest('[data-req-filter-clear]');if(clear){state.openFilter=clear.dataset.reqFilterClear;state.filters[clear.dataset.reqFilterClear]=[];if(clear.dataset.reqFilterClear==='region'){const valid=filterOptions().department;state.filters.department=filterValues('department').filter(d=>valid.some(v=>norm(v)===norm(d)));}emit();return true;}
    const all=e.target.closest('[data-req-filter-all]');if(all){const key=all.dataset.reqFilterAll;state.openFilter=key;const visible=[...document.querySelectorAll(`[data-req-filter-check="${key}"]`)].filter(i=>!i.closest('[data-req-filter-option]')?.hidden).map(i=>filterIn(key,i.value));state.filters[key]=uniq([...filterValues(key),...visible]);if(key==='region'){const valid=filterOptions().department;state.filters.department=filterValues('department').filter(d=>valid.some(v=>norm(v)===norm(d)));}emit();return true;}
    if(e.target.closest('[data-req-reset-filters]')){Object.keys(state.filters).forEach(k=>state.filters[k]=[]);state.filterSearch={};state.openFilter='';emit();return true;}
    const filterSearch=e.target.closest('[data-req-filter-search]');if(filterSearch){e.stopPropagation();try{filterSearch.focus({preventScroll:true});}catch{filterSearch.focus();}return true;}
    const summary=e.target.closest('.req-check-filter>summary');if(summary){const details=summary.parentElement;setTimeout(()=>{if(details?.open){const input=details.querySelector('[data-req-filter-search]');try{input?.focus({preventScroll:true});}catch{input?.focus();}}},0);}
    return false;
  }
  function handleChange(e){
    const f=e.target.closest('[data-req-filter-check]');if(f){const key=f.dataset.reqFilterCheck,value=filterIn(f.dataset.reqFilterCheck,f.value||'');state.openFilter=key;const values=filterValues(key).filter(v=>norm(v)!==norm(value));if(f.checked)values.push(value);state.filters[key]=values;if(key==='region'){const valid=filterOptions().department;state.filters.department=filterValues('department').filter(d=>valid.some(v=>norm(v)===norm(d)));}if(key==='mention'&&f.checked)state.mentionFocus=value;emit();return true;}
    const mf=e.target.closest('[data-req-mention-focus]');if(mf){state.mentionFocus=mf.value||'';emit();return true;}
    // Encart compatibilité : ces choix ne modifient ni les filtres généraux ni les deux premières cartes.
    const cm=e.target.closest('[data-req-compat-mention]');if(cm){state.compat.manualMention=cm.value||'';state.focusSelector='[data-req-compat-mention]';emit();return true;}
    const cs=e.target.closest('[data-req-compat-size]');if(cs){state.compat.size=cs.value&&cs.value!==String(MENTIONS()?.BOUQUET_SIZE)?cs.value:'';state.focusSelector='[data-req-compat-size]';emit();return true;}
    const cc=e.target.closest('[data-req-compat-context]');if(cc){state.compat.context=cc.value||'';state.focusSelector='[data-req-compat-context]';emit();return true;}
    const cf=e.target.closest('[data-req-compat-field]');if(cf){const ctxKey=compatModel().ctx?.key||'';const f=cf.dataset.reqCompatField;state.compat.values[ctxKey]={...(state.compat.values[ctxKey]||{}),[f]:cf.value||''};state.compat.openFields=true;state.focusSelector=`[data-req-compat-field="${typeof CSS!=="undefined"&&CSS.escape?CSS.escape(f):f}"]`;emit();return true;}
    return false;
  }
  function applyRequirementFilterSearch(fs){
    if(!fs)return false;const key=fs.dataset.reqFilterSearch||'';state.filterSearch[key]=fs.value||'';state.openFilter=key;const q=norm(fs.value||''),menu=fs.closest('.req-check-menu');
    menu?.querySelectorAll(`[data-req-filter-option="${key}"]`).forEach(label=>{const hide=Boolean(q&&!norm(label.textContent).includes(q));label.classList.toggle('is-search-hidden',hide);label.hidden=hide;});return true;
  }
  function handleInput(e){
    const fs=e.target.closest('[data-req-filter-search]');if(fs)return applyRequirementFilterSearch(fs);
    const s=e.target.closest('[data-req-search]');if(s){state.search=s.value||'';state.searchEditing=true;emit();return true;}return false;
  }
  function handleKeyup(e){
    if(e.key==='Enter'&&e.target.matches?.('#reqSourceKey,#reqSourceUrl')){document.querySelector('[data-req-connect]')?.click();return true;}
    const fs=e.target.closest('[data-req-filter-search]');return fs?applyRequirementFilterSearch(fs):false;}
  function status(){return {connected:state.connected,count:evaluations(state.rows).length,url:state.url,loading:state.loading,error:state.error,errorKind:state.errorKind,loadedAt:state.loadedAt,hasKey:!!bridge?.hasKey?.()};}
  function auditInfo(){const f=filteredRows(),ev=evaluations(f),occ=occurrenceRows(f);return {connected:state.connected,source:'RAPPORT',rows:state.rows.length,filteredRows:f.length,evaluations:ev.length,occurrences:occ.length,loadedAt:state.loadedAt};}
  window.addEventListener('newosb:privacychange',emit);
  // V6.14 : getOperationRequirements renvoie un instantané figé, indépendant des filtres de l'onglet Exigences.
  window.NEWOSB_REQUIREMENTS={render,afterRender,handleClick,handleChange,handleInput,handleKeyup,load,disconnect,status,auditInfo,getOperationRequirements,
    // Accès de test / diagnostic, sans exposer l'état mutable.
    _compatSnapshot(){const m=compatModel();return m.error?{error:m.error}:{context:m.ctx?.key||'',contexts:m.bouquets.contexts.map(c=>({key:c.key,operations:c.operations,top:c.top.map(i=>({code:i.code,operations:i.operations,frequency:i.frequency}))})),ranked:(m.analysis?.ranked||[]).map(r=>({id:r.id,pct:r.pct,covered:r.covered,required:r.required})),results:(m.analysis?.results||[]).map(r=>({id:r.id,status:r.status,pct:r.pct,covered:r.covered,required:r.required})),manual:state.compat.manualMention};}};
})();
