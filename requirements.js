(() => {
  'use strict';

  const STORAGE_KEY='newosb_requirements_source_v1';
  const THEME_COLORS={'1':'#7da7d9','2':'#76b65c','3':'#ed9a42','4':'#8f77bd'};
  const TARGET_NAMES={'1':'Éco-Conception & Management du projet','2':'Le bâtiment dans son environnement','3':'Sobriété et Efficacité du bâtiment','4':'Usages & qualité de vie'};
  const state={
    url:localStorage.getItem(STORAGE_KEY)||'', rows:[], connected:false, loading:false, error:'', loadedUrl:'',
    filters:{year:[],referential:[],moaGroup:[],status:[],moa:[],region:[],department:[],profile:[],socialZone:[],period:[],nature:[],mention:[],moaSector:[],theme:[]},
    filterSearch:{}, requirement:'', mentionFocus:'', search:'', searchEditing:false, infoRequirement:'', infoKind:'', openFilter:'',
    loadedAt:'',
    views:{chronology:'list',topGlobal:'list',target1:'list',target2:'list',target3:'list',target4:'list',evolution:'list',mentions:'list',mentionReqs:'list'},
    pages:{}
  };

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
      operationCode:String(pick(r.operationCode,alias(r,['Évaluation: Opération: Code interne','Code opération']))),
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
      theme:String(theme), requirement:String(requirement), nature:String(pick(r.nature,natureFromRef(referential))), sector:String(pick(r.sector,sectorFromRef(referential)))
    };
  }

  function emit(){
    const page=document.getElementById('obsPage');
    const detail={scroll:{top:Number(page?.scrollTop)||0,left:Number(page?.scrollLeft)||0,winX:Number(window.scrollX)||0,winY:Number(window.scrollY)||0}};
    window.dispatchEvent(new CustomEvent('newosb:requirementschange',{detail}));
  }
  function sourceUrl(url,mode='data'){const sep=url.includes('?')?'&':'?';return `${url}${sep}mode=${encodeURIComponent(mode)}&_=${Date.now()}`;}
  async function load(url){
    url=String(url||'').trim(); if(!url){state.error='Colle l’URL /exec du déploiement Apps Script.';emit();return;}
    state.loading=true;state.error='';state.loadedUrl=url;emit();
    try{
      const res=await fetch(sourceUrl(url),{cache:'no-store'});if(!res.ok)throw new Error(`HTTP ${res.status}`);
      const payload=await res.json();if(payload&&payload.ok===false)throw new Error(payload.error||'Source indisponible');
      const rows=Array.isArray(payload)?payload:(payload.rows||payload.data||[]);if(!Array.isArray(rows)||!rows.length)throw new Error('Aucune ligne reçue depuis l’onglet RAPPORT.');
      state.rows=rows.map(normalizeRow).filter(r=>r.evaluationCode&&r.requirement);state.connected=true;state.loadedAt=new Date().toISOString();state.loadedUrl=url;state.url=url;state.error='';
      localStorage.setItem(STORAGE_KEY,url);
      if(!state.mentionFocus)state.mentionFocus=topMentions(state.rows,1)[0]?.name||'';
    }catch(e){state.connected=false;state.error=String(e?.message||e);}
    finally{state.loading=false;emit();}
  }
  function disconnect(){state.url='';state.loadedUrl='';state.rows=[];state.connected=false;state.error='';state.search='';state.infoRequirement='';localStorage.removeItem(STORAGE_KEY);emit();}

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
  function checkFilter(key,label,values,lab=v=>v){
    const selected=filterValues(key),count=selected.length,summary=count?`${count} sélectionné${count>1?'s':''}`:'Tous',query=norm(state.filterSearch?.[key]||'');
    const search=`<label class="req-check-search"><span>⌕</span><input type="search" data-req-filter-search="${key}" value="${attr(state.filterSearch?.[key]||'')}" placeholder="${attr(`Rechercher dans ${String(label).toLowerCase()}…`)}" autocomplete="off"></label>`;
    return `<details class="req-check-filter ${count?'has-selection':''}" ${state.openFilter===key?'open':''}><summary><span>${esc(label)}</span><b>${esc(summary)}</b></summary><div class="req-check-menu">${search}<div class="req-check-actions"><button type="button" data-req-filter-all="${key}">Tout cocher</button><button type="button" data-req-filter-clear="${key}">Effacer</button></div>${values.length?values.map(v=>{const text=lab(v),hidden=query&&!norm(text).includes(query);return `<label data-req-filter-option="${key}" class="${hidden?'is-search-hidden':''}" ${hidden?'hidden':''}><input type="checkbox" data-req-filter-check="${key}" value="${attr(v)}" ${filterHas(key,v)?'checked':''}><span>${esc(text)}</span></label>`;}).join(''):'<small>Aucune valeur disponible</small>'}</div></details>`;
  }
  function filtersHtml(){
    const o=filterOptions();
    const activeCount=Object.keys(state.filters).reduce((n,k)=>n+filterValues(k).length,0);
    return `<div class="req-filterbar req-filterbar-checks">${checkFilter('year','Année',o.year)}${checkFilter('referential','Référentiel',o.referential)}${checkFilter('moaGroup','Groupe MOA',o.moaGroup)}${checkFilter('status','Avancement',o.status)}${checkFilter('moa','Maître d’ouvrage',o.moa)}${checkFilter('region','Région',o.region)}${checkFilter('department','Département',o.department)}${checkFilter('profile','Profil',o.profile)}${checkFilter('socialZone','Zonage',o.socialZone)}${checkFilter('nature','Nature',o.nature)}${checkFilter('mention','Mention',o.mention)}${checkFilter('moaSector','Secteur MOA',o.moaSector)}${checkFilter('theme','Thème',o.theme,v=>`${v} · ${TARGET_NAMES[v]||''}`)}${checkFilter('period','Période réf.',['pre2024','2024','2025plus'],v=>v==='pre2024'?'Avant 2024':v==='2025plus'?'2025–2026':'2024')}<button type="button" class="req-reset-filters" data-req-reset-filters="1" ${activeCount?'':'disabled'}>Réinitialiser les filtres${activeCount?` · ${activeCount}`:''}</button></div>${state.requirement?`<div class="req-active"><span>Exigence filtrée : <b>${esc(state.requirement)}</b></span><button type="button" data-req-clear-requirement="1">× Retirer</button></div>`:''}`;
  }

  function sourceCard(){
    const status=state.loading?'Connexion…':state.connected?`${fmt(evaluations(state.rows).length)} évaluations · ${fmt(occurrenceRows(state.rows).length)} occurrences chargées`:'Source Exigences non connectée';
    return `<article class="req-source-card ${state.connected?'is-connected':''}"><div class="req-source-copy"><span>SOURCE EXIGENCES</span><h2>Google Sheet · onglet RAPPORT</h2><p>${esc(status)}</p></div><div class="req-source-controls"><input id="reqSourceUrl" type="url" value="${attr(state.url)}" placeholder="https://script.google.com/macros/s/…/exec"><button type="button" data-req-connect="1">${state.connected?'Actualiser':'Connecter'}</button>${state.connected?'<button class="soft" type="button" data-req-disconnect="1">Déconnecter</button>':''}<a class="req-code-link" href="Code_Exigences.gs" download>Code.gs ↓</a></div>${state.error?`<div class="req-source-error">${esc(state.error)}</div>`:''}<small>Le script lit uniquement <b>RAPPORT</b>. Référentiel, profil, région, département, mention et statut d’évaluation sont croisés en multi-sélection avec toutes les occurrences.</small></article>`;
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

  function render(){
    const source=sourceCard();
    if(!state.connected)return `${source}<div class="req-empty-state"><span>▤</span><h2>Connecter le Google Sheet des exigences</h2><p>Cette rubrique repart exclusivement de l’onglet <b>RAPPORT</b>. Les référentiels BEE Logement Neuf et Rénovation du 04/05/2026 sont déjà intégrés pour les fiches d’information « i » et la recherche manuelle.</p><a href="Code_Exigences.gs" download>Télécharger le Code.gs</a></div>${infoModal()}`;
    const rows=filteredRows(), occ=occurrenceRows(rows), evs=evaluations(rows), refs=uniq(evs.map(r=>r.referential)), years=uniq(evs.map(r=>r.year).filter(Boolean)).sort((a,b)=>a-b), neuf=evs.filter(r=>r.nature==='Neuf').length,reno=evs.filter(r=>r.nature==='Rénovation').length;
    return `${source}${filtersHtml()}<div class="req-page-title"><div><span>ANALYSE DES EXIGENCES</span><h1>${filterValues('profile').length===1?`Profil ${esc(filterValues('profile')[0].replace(/^Profil\s+/i,''))}`:filterValues('profile').length>1?`${filterValues('profile').length} profils sélectionnés`:'Toutes évaluations'}</h1><p>Retraitement dynamique de RAPPORT · filtres par profil, région et département · fiches référentiel 2026 accessibles avec le bouton <b>i</b>.</p></div><div class="req-page-meta">${years.length?`${years[0]}–${years[years.length-1]}`:'—'}<small>${refs.length} référentiel${refs.length>1?'s':''}</small></div></div>
    <div class="obs-grid-kpi req-kpis"><article class="obs-kpi"><span>Dossiers analysés</span><strong>${fmt(evs.length)}</strong><small>évaluations uniques</small></article><article class="obs-kpi"><span>Exigences sélectionnées</span><strong>${fmt(occ.length)}</strong><small>occurrences distinctes</small></article><article class="obs-kpi"><span>Neuf</span><strong>${fmt(neuf)}</strong><small>${fmt(pct(neuf,evs.length),1)} % du panel</small></article><article class="obs-kpi"><span>Rénovation</span><strong>${fmt(reno)}</strong><small>${fmt(pct(reno,evs.length),1)} % du panel</small></article></div>
    ${manualSearchHtml()}
    <div class="obs-grid-2"><article class="obs-card"><div class="obs-card-head"><div><span>RÉPARTITION SECTORIELLE</span><h2>Neuf / Rénovation</h2></div><small>${fmt(evs.length)} dossiers</small></div>${sectorCard(rows)}</article><article class="obs-card"><div class="obs-card-head"><div><span>STRUCTURE DU PANEL</span><h2>Chronologie par référentiel</h2></div><div class="req-head-actions"><small>année de version du référentiel</small>${reqViewToggle('chronology')}</div></div>${panelChronology(rows)}</article></div>
    <article class="obs-card req-top-card"><div class="obs-card-head"><div><span>VOLUME GLOBAL</span><h2>Exigences les plus récurrentes</h2></div><div class="req-head-actions"><small>Liste = 15 / page · Tuiles = importance + cible</small>${reqViewToggle('topGlobal',['list','tiles'])}</div></div>${(state.views.topGlobal||'list')==='tiles'?requirementTiles(requirementCounts(rows),rows,occ.length):requirementList(requirementCounts(rows),'topGlobal')}</article>
    <div class="obs-section-title"><div><span>01</span><h2>Management, environnement, sobriété & usages</h2></div><p>Lecture par cible avec comparaison Neuf / Rénovation.</p></div>${themePanels(rows)}
    <div class="obs-section-title"><div><span>02</span><h2>Évolution des exigences</h2></div><p>Les autres filtres restent actifs ; la période est volontairement dépliée par année.</p></div><article class="obs-card"><div class="obs-card-head"><div><span>ÉVOLUTION</span><h2>Exigences par année</h2></div><div class="req-head-actions"><small>Liste = 15 / page · Barres = Top 5</small>${reqViewToggle('evolution')}</div></div>${evolutionTable()}</article>
    <div class="obs-section-title"><div><span>03</span><h2>Mentions & exigences associées</h2></div><p>Mentions les plus demandées et Top 5 des exigences associées.</p></div>${mentionsSection(rows)}${infoModal()}`;
  }

  function afterRender(){if(state.url&&!state.connected&&!state.loading&&state.loadedUrl!==state.url)load(state.url);if(state.searchEditing){setTimeout(()=>{const input=document.querySelector('[data-req-search]');if(input){const p=input.value.length;try{input.focus({preventScroll:true});input.setSelectionRange(p,p);}catch{try{input.focus();}catch{}}}state.searchEditing=false;},0);}}
  function handleClick(e){
    const view=e.target.closest('[data-req-view][data-view]');if(view){const mode=['list','bar','tiles'].includes(view.dataset.view)?view.dataset.view:'list';state.views[view.dataset.reqView]=mode;state.pages[view.dataset.reqView]=1;emit();return true;}
    const pager=e.target.closest('[data-req-page][data-page]');if(pager){state.pages[pager.dataset.reqPage]=Math.max(1,Number(pager.dataset.page)||1);emit();return true;}
    const mentionBtn=e.target.closest('[data-req-mention-focus-button]');if(mentionBtn){state.mentionFocus=mentionBtn.dataset.reqMentionFocusButton||'';emit();return true;}
    const connect=e.target.closest('[data-req-connect]');if(connect){const input=document.getElementById('reqSourceUrl');load(input?.value||state.url);return true;}
    if(e.target.closest('[data-req-disconnect]')){disconnect();return true;}
    const info=e.target.closest('[data-req-info]');if(info){state.infoRequirement=dec(info.dataset.reqInfo);state.infoKind='';emit();return true;}
    const kind=e.target.closest('[data-req-info-kind]');if(kind){state.infoKind=kind.dataset.reqInfoKind||'';emit();return true;}
    const close=e.target.closest('[data-req-info-close]');if(close&&!e.target.closest('[data-req-info-panel]')){state.infoRequirement='';state.infoKind='';emit();return true;}
    if(e.target.matches('.req-info-close')){state.infoRequirement='';state.infoKind='';emit();return true;}
    const req=e.target.closest('[data-req-requirement]');if(req){const v=dec(req.dataset.reqRequirement);state.requirement=norm(state.requirement)===norm(v)?'':v;emit();return true;}
    if(e.target.closest('[data-req-clear-requirement]')){state.requirement='';emit();return true;}
    const clear=e.target.closest('[data-req-filter-clear]');if(clear){state.openFilter=clear.dataset.reqFilterClear;state.filters[clear.dataset.reqFilterClear]=[];if(clear.dataset.reqFilterClear==='region'){const valid=filterOptions().department;state.filters.department=filterValues('department').filter(d=>valid.some(v=>norm(v)===norm(d)));}emit();return true;}
    const all=e.target.closest('[data-req-filter-all]');if(all){const key=all.dataset.reqFilterAll;state.openFilter=key;const visible=[...document.querySelectorAll(`[data-req-filter-check="${key}"]`)].filter(i=>!i.closest('[data-req-filter-option]')?.hidden).map(i=>i.value);state.filters[key]=uniq([...filterValues(key),...visible]);if(key==='region'){const valid=filterOptions().department;state.filters.department=filterValues('department').filter(d=>valid.some(v=>norm(v)===norm(d)));}emit();return true;}
    if(e.target.closest('[data-req-reset-filters]')){Object.keys(state.filters).forEach(k=>state.filters[k]=[]);state.filterSearch={};state.openFilter='';emit();return true;}
    const filterSearch=e.target.closest('[data-req-filter-search]');if(filterSearch){e.stopPropagation();try{filterSearch.focus({preventScroll:true});}catch{filterSearch.focus();}return true;}
    const summary=e.target.closest('.req-check-filter>summary');if(summary){const details=summary.parentElement;setTimeout(()=>{if(details?.open){const input=details.querySelector('[data-req-filter-search]');try{input?.focus({preventScroll:true});}catch{input?.focus();}}},0);}
    return false;
  }
  function handleChange(e){
    const f=e.target.closest('[data-req-filter-check]');if(f){const key=f.dataset.reqFilterCheck,value=f.value||'';state.openFilter=key;const values=filterValues(key).filter(v=>norm(v)!==norm(value));if(f.checked)values.push(value);state.filters[key]=values;if(key==='region'){const valid=filterOptions().department;state.filters.department=filterValues('department').filter(d=>valid.some(v=>norm(v)===norm(d)));}if(key==='mention'&&f.checked)state.mentionFocus=value;emit();return true;}
    const mf=e.target.closest('[data-req-mention-focus]');if(mf){state.mentionFocus=mf.value||'';emit();return true;}
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
  function handleKeyup(e){const fs=e.target.closest('[data-req-filter-search]');return fs?applyRequirementFilterSearch(fs):false;}
  function status(){return {connected:state.connected,count:evaluations(state.rows).length,url:state.url,loading:state.loading,error:state.error,loadedAt:state.loadedAt};}
  function auditInfo(){const f=filteredRows(),ev=evaluations(f),occ=occurrenceRows(f);return {connected:state.connected,source:'RAPPORT',rows:state.rows.length,filteredRows:f.length,evaluations:ev.length,occurrences:occ.length,loadedAt:state.loadedAt};}
  window.addEventListener('newosb:privacychange',emit);
  window.NEWOSB_REQUIREMENTS={render,afterRender,handleClick,handleChange,handleInput,handleKeyup,load,status,auditInfo};
})();
