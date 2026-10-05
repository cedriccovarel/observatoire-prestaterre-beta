(() => {
  'use strict';

  const engine = window.NEWOSB_ENGINE;
  const core = window.NEWOSB_CORE;
  const pageEl = document.getElementById('obsPage');
  const filtersEl = document.getElementById('obsFilters');
  const filterDependenciesEl = document.getElementById('obsFilterDependencies');
  const countEl = document.getElementById('obsFilterCount');
  const demoBanner = document.getElementById('obsDemoBanner');
  const searchEl = document.getElementById('obsGlobalSearch');
  const sourceDot = document.getElementById('obsSourceDot');
  const sourceLabel = document.getElementById('obsSourceLabel');
  const drawer = document.getElementById('obsOperationDrawer');
  const drawerTitle = document.getElementById('obsDrawerTitle');
  const drawerMeta = document.getElementById('obsDrawerMeta');
  const drawerTabs = document.getElementById('obsDrawerTabs');
  const drawerBody = document.getElementById('obsDrawerBody');
  const layoutEl = document.querySelector('.obs-layout');
  const sidebarToggle = document.getElementById('obsSidebarToggle');
  const SIDEBAR_STORAGE_KEY = 'newosb_sidebar_collapsed';

  if (!engine || !pageEl) {
    console.error('NEWOSB: moteur V29.7.13 indisponible.');
    return;
  }

  // V6.13 : avancement en liste fermée (newosb-rules.js). 'unknown' = vide ou hors liste ;
  // il n'apparaît ni dans le filtre Avancement ni dans le tunnel.
  const RULES = window.NEWOSB_RULES;
  const PROGRESS_ORDER = (RULES?.PROGRESS_KEYS)||['proposal','notStarted','incomplete','complete','planned','analysis','visit','compliant'];
  const STATUS_LABELS = {
    proposal:'Proposition commerciale en cours', notStarted:'Non démarrée', incomplete:'Dossier incomplet', complete:'Dossier complet', planned:'Analyse planifiée',
    analysis:'Analyse réalisée', visit:'Visite réalisée', compliant:'Évaluation conforme', unknown:'Non renseigné', cancelled:'Annulée / abandonnée'
  };
  const CHRONOLOGY_STATUS_LABELS = {...STATUS_LABELS,lostAffair:'Affaire perdue',abandonedAffair:'Affaire abandonnée',cancelledAffair:'Affaire annulée'};
  const STATUS_COLORS = {
    proposal:'#b8a7d9', notStarted:'#9aa8a2', incomplete:'#d49a32', complete:'#b4a24a', planned:'#6f9cb9', analysis:'#4b9881', visit:'#16864f',
    compliant:'#06402b', unknown:'#c9d1cd', cancelled:'#dc5b4d'
  };
  const CHRONOLOGY_STATUS_COLORS = {...STATUS_COLORS,lostAffair:'#9c3f3f',abandonedAffair:'#c96c45',cancelledAffair:'#dc5b4d'};
  const ANALYTIC_PAGES = new Set(['territories','stakeholders','certification','performance','solutions','energy','carbon','crossdata','operations','quality','dictionary']);
  const PRESENTATION_STORAGE_KEY = 'newosb_v0518_presentation';
  const pageMeta = {
    overview:['Vue d’ensemble','Les chiffres clés de la sélection et les principaux signaux de l’Observatoire.'],
    territories:['Territoires','Explorer la géographie des projets, les concentrations régionales et départementales et le détail territorial.'],
    stakeholders:['Acteurs','Analyser les portefeuilles des maîtres d’ouvrage et leurs profils dans la sélection.'],
    certification:['Certification','Comprendre l’avancement, les statuts et les taux de passage dans le tunnel de certification.'],
    performance:['Labels & performances','Croiser mentions, niveaux de performance et populations de projets sans répéter les répartitions déjà visibles ailleurs.'],
    requirements:['Exigences','Analyser les exigences sélectionnées par évaluation à partir de la source dédiée RAPPORT.'],
    solutions:['Solutions constructives','Comparer les choix constructifs, isolants, menuiseries et équipements techniques.'],
    energy:['Énergie & transitions','Explorer les transitions chauffage / ECS et les niveaux de performance énergétique.'],
    carbon:['Carbone & DPE','Analyser les indicateurs carbone, le respect des seuils et les évolutions DPE / GES.'],
    crossdata:['Croiser les données','Explorer les relations entre deux indicateurs avec un nuage de points et les jalons carbone 2028 / 2031.'],
    presentation:['Présentation','Composer une restitution type OSBslide à partir des graphes et tableaux de l’Observatoire Prestaterre, puis exporter en PNG 4K ou SVG.'],
    operations:['Projets & opérations','Explorer les projets uniques puis leurs opérations techniques ligne par ligne.'],
    quality:['Qualité & données','Contrôler la fiabilité, la complétude, les incohérences et les anomalies de la sélection.'],
    dictionary:['Dictionnaire','Comprendre chaque donnée : définition, source, unité, calcul et règles de lecture.'],
    reports:['Rapports & exports','Passer de l’exploration à une restitution prête à présenter ou à exploiter.']
  };

  const state = {
    page:'overview',
    search:'',
    filters:{year:[],createdYear:[],referential:[],moaGroup:[],status:[],moa:[],region:[],department:[],profile:[],socialZone:[]},
    crossFilters:[],
    activeOperation:null,
    drawerTab:'summary',
    mapLayers:{departments:true,regions:true,zoning:false,operations:true,intercommunalities:true,cities:false},
    mapOperationGrouping:'department',
    mapView:{x:0,y:0,w:700,h:500},
    osmMapView:{lat:46.55,lng:2.35,zoom:5},
    mapBasemap:'ign',
    osmTileProviderIndex:0,
    flowFocus:{heating:'',ecs:'',dpeEnergy:'',dpeGes:''},
    solutionMetric:'ubat',
    solutionViews:{},
    mapFocusRegion:'',
    mapFocusPending:false,
    moaPage:1,
    mentionPage:1,
    performancePage:1,
    territoryPage:1,
    territorySummaryPage:1,
    operationsPage:1,
    rawPage:1,
    rawView:'list',
    overviewMentionPage:1,
    overviewPerformancePage:1,
    overviewMentionView:'list',
    overviewPerformanceView:'list',
    territoryTableView:'list',
    moaTableView:'list',
    statusYearView:'list',
    statusYearShowExcluded:true,
    statusYearPage:1,
    mentionTableView:'list',
    performanceTableView:'list',
    performanceMatrixView:'matrix',
    performanceMatrixPage:1,
    performanceMatrixMentions:[],
    performanceMatrixPerformances:[],matrixSearch:{mention:'',performance:''},
    energyCepViews:{usage:'pie',vector:'pie'},
    activeProject:null,
    projectWindowTab:'general',
    projectWindowTechnicalCode:'',
    projectTagFilter:'',
    operationsTableView:'list',
    operationsEntityView:'operations',
    activeMoaGroup:'',
    activeGroupMoa:'',
    crossX:'icConstructionMax',
    crossY:'icConstruction',
    overviewShowTotal:true,
    qualityIssuePage:1,
    dictionaryPage:1,
    dictionarySearch:'',
    mentionSearch:'',
    performanceSearch:'',
    filterSearch:{},
    autoMoaFromGroup:[],
    openGlobalFilter:'',
    renderToken:0,
    presentationSlides:[],
    presentationActiveId:'',
    presentationCounter:0
  };

  function setSidebarCollapsed(collapsed){
    const on=Boolean(collapsed);
    layoutEl?.classList.toggle('is-sidebar-collapsed',on);
    document.body.classList.toggle('newosb-sidebar-collapsed',on);
    if(sidebarToggle){sidebarToggle.textContent=on?'›':'‹';sidebarToggle.title=on?'Déplier la barre latérale':'Replier la barre latérale';sidebarToggle.setAttribute('aria-label',sidebarToggle.title);sidebarToggle.setAttribute('aria-expanded',String(!on));}
    try{localStorage.setItem(SIDEBAR_STORAGE_KEY,on?'1':'0');}catch{}
    setTimeout(()=>window.dispatchEvent(new Event('resize')),60);
  }
  function loadSidebarState(){
    let collapsed=false;try{collapsed=localStorage.getItem(SIDEBAR_STORAGE_KEY)==='1';}catch{}
    document.querySelectorAll('#obsNav [data-page]').forEach(btn=>{if(!btn.title)btn.title=btn.textContent.trim();});
    setSidebarCollapsed(collapsed);
  }

  let uiScrollRestoreToken=0;
  // V6.13.5 : les listes internes marquées data-scroll-key (listes à cocher défilantes)
  // gardent leur position de défilement et le focus lors d'un nouveau rendu de la page.
  function captureInnerScroll(){
    const inner={}, roots=[pageEl,filtersEl].filter(Boolean);
    roots.forEach(root=>root.querySelectorAll('[data-scroll-key]').forEach(el=>{inner[el.dataset.scrollKey]=el.scrollTop||0;}));
    const a=document.activeElement;let focus=null;
    if(a&&roots.some(r=>r.contains(a))){
      if(a.matches?.('[data-performance-matrix-check]'))focus={type:'check',kind:a.dataset.performanceMatrixCheck,value:a.value};
      else if(a.matches?.('[data-matrix-search]'))focus={type:'search',kind:a.dataset.matrixSearch,start:a.selectionStart,end:a.selectionEnd};
      else if(a.matches?.('[data-global-filter-check]'))focus={type:'gcheck',kind:a.dataset.globalFilterCheck,value:a.value};
    }
    return {inner,focus};
  }
  function restoreInnerScroll(snap){
    if(!snap)return;
    const roots=[pageEl,filtersEl].filter(Boolean), {inner,focus}=snap;
    const all=roots.flatMap(r=>[...r.querySelectorAll('[data-scroll-key]')]);
    Object.keys(inner||{}).forEach(key=>{const el=all.find(x=>x.dataset.scrollKey===key);if(el&&Math.abs((el.scrollTop||0)-inner[key])>1)el.scrollTop=inner[key];});
    if(focus){
      let el=null;
      if(focus.type==='check')el=[...pageEl.querySelectorAll('[data-performance-matrix-check]')].find(x=>x.dataset.performanceMatrixCheck===focus.kind&&x.value===focus.value);
      else if(focus.type==='gcheck')el=[...(filtersEl?.querySelectorAll('[data-global-filter-check]')||[])].find(x=>x.dataset.globalFilterCheck===focus.kind&&x.value===focus.value);
      else el=pageEl.querySelector(`[data-matrix-search="${focus.kind}"]`);
      if(el){try{el.focus({preventScroll:true});if(focus.type==='search'&&focus.start!=null)el.setSelectionRange(focus.start,focus.end);}catch{}}
    }
  }
  function captureUiScroll(){
    return {
      pageTop:Number(pageEl?.scrollTop)||0,
      pageLeft:Number(pageEl?.scrollLeft)||0,
      winX:Number(window.scrollX)||0,
      winY:Number(window.scrollY)||0,
      ...captureInnerScroll()
    };
  }
  function restoreUiScroll(snapshot){
    if(!snapshot)return;
    const token=++uiScrollRestoreToken;
    const apply=()=>{
      if(token!==uiScrollRestoreToken)return;
      if(pageEl){
        if(Math.abs((pageEl.scrollTop||0)-snapshot.pageTop)>1) pageEl.scrollTop=snapshot.pageTop;
        if(Math.abs((pageEl.scrollLeft||0)-snapshot.pageLeft)>1) pageEl.scrollLeft=snapshot.pageLeft;
      }
      if(Math.abs((window.scrollY||0)-snapshot.winY)>1 || Math.abs((window.scrollX||0)-snapshot.winX)>1) window.scrollTo(snapshot.winX,snapshot.winY);
    };
    apply();
    restoreInnerScroll(snapshot);
    requestAnimationFrame(()=>{apply();restoreInnerScroll(snapshot);requestAnimationFrame(apply);});
    setTimeout(apply,60);
    setTimeout(apply,140);
  }
  function preserveUiScroll(action){
    const snapshot=captureUiScroll();
    const result=action?.();
    restoreUiScroll(snapshot);
    return result;
  }

  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const attr = esc;
  const norm = (v) => engine.normalize ? engine.normalize(v) : String(v ?? '').toLowerCase().trim();
  const fmt = (n, digits=0) => Number(n || 0).toLocaleString('fr-FR',{maximumFractionDigits:digits,minimumFractionDigits:digits});
  const sum = (arr, getter) => arr.reduce((s,x) => s + (Number(getter(x)) || 0), 0);
  const uniq = (values) => [...new Set(values.filter(v => String(v ?? '').trim() !== ''))].sort((a,b)=>String(a).localeCompare(String(b),'fr',{numeric:true,sensitivity:'base'}));
  const pct = (v,total) => total ? (100*v/total) : 0;
  const shorten = (v,n) => { v=String(v||''); return v.length>n ? v.slice(0,n-1)+'…' : v; };
  const escLines = v => esc(String(v??'').replace(/&lt;br\s*\/?\s*&gt;/gi,'\n').replace(/<br\s*\/?\s*>/gi,'\n'));


  function defaultCoverModel(){
    state.presentationCounter += 1;
    return {id:`cover_${Date.now()}_${state.presentationCounter}`,type:'cover',title:'Observatoire du bâtiment durable',subtitle:'Synthèse des indicateurs et analyses',dateText:new Date().toLocaleDateString('fr-FR',{month:'long',year:'numeric'}),footerText:'Prestaterre Certifications',confidentialText:'CONFIDENTIEL',fontFamily:'Arial, sans-serif',titleSize:64,subtitleSize:28,dateSize:26,createdAt:new Date().toISOString()};
  }
  function loadPresentationState(){
    try{
      const raw=localStorage.getItem(PRESENTATION_STORAGE_KEY) || localStorage.getItem('newosb_v0517_presentation');
      if(raw){
        const parsed=JSON.parse(raw);
        if(Array.isArray(parsed?.slides)) state.presentationSlides=parsed.slides.map(s=>({type:'content',confidentialText:'CONFIDENTIEL',...s}));
        state.presentationActiveId=parsed?.activeId||state.presentationSlides[0]?.id||'';
        state.presentationCounter=Math.max(Number(parsed?.counter)||0,state.presentationSlides.length||0);
      }
      if(!state.presentationSlides.some(s=>s.type==='cover')) state.presentationSlides.unshift(defaultCoverModel());
      const cover=state.presentationSlides.find(s=>s.type==='cover');
      const ci=state.presentationSlides.findIndex(s=>s.type==='cover');
      if(ci>0){state.presentationSlides.splice(ci,1);state.presentationSlides.unshift(cover);}
      if(!state.presentationActiveId) state.presentationActiveId=cover?.id||state.presentationSlides[0]?.id||'';
      savePresentationState();
    }catch{
      state.presentationSlides=[defaultCoverModel()];
      state.presentationActiveId=state.presentationSlides[0].id;
    }
  }
  function savePresentationState(){
    try{
      localStorage.setItem(PRESENTATION_STORAGE_KEY, JSON.stringify({
        slides:state.presentationSlides,
        activeId:state.presentationActiveId,
        counter:state.presentationCounter
      }));
    }catch{}
  }
  function currentPresentationSlide(){
    if(!state.presentationSlides.length) return null;
    if(!state.presentationSlides.some(s=>s.id===state.presentationActiveId)) state.presentationActiveId=state.presentationSlides[0].id;
    return state.presentationSlides.find(s=>s.id===state.presentationActiveId) || state.presentationSlides[0] || null;
  }
  function fontChoices(){
    return ['Arial, sans-serif','Helvetica, Arial, sans-serif','Georgia, serif','Times New Roman, serif','Trebuchet MS, sans-serif','Verdana, sans-serif'];
  }
  function activeFilterScopeText(){
    const defs=[['year','Année certification'],['createdYear','Année de création'],['referential','Référentiel'],['moaGroup','Groupe MOA'],['status','Avancement'],['moa','Maître d’ouvrage'],['region','Région'],['department','Département'],['profile','Profil'],['socialZone','Zonage']];
    const parts=defs.map(([key,label])=>{
      const vals=globalFilterValues(key);
      if(!vals.length)return '';
      const display=vals.map(v=>key==='status'?(STATUS_LABELS[v]||v):(key==='department'?`${v} ${departmentName(v)}`:v));
      return `${label} : ${display.join(', ')}`;
    }).filter(Boolean);
    const analytics=state.crossFilters.map(f=>f.label).filter(Boolean);
    const combined=[];
    if(parts.length) combined.push(`Filtres : ${parts.join(' · ')}`);
    if(analytics.length) combined.push(`Analyse croisée : ${analytics.join(' · ')}`);
    if(String(state.search||'').trim()) combined.push(`Recherche : ${String(state.search).trim()}`);
    return combined.join(' | ') || 'Périmètre : ensemble de la base disponible';
  }
  function generatorLaunchScope(){
    const ops=filteredOperations();
    return {
      operationCodes:[...new Set(ops.map(o=>String(o.code||'').trim()).filter(Boolean))],
      count:ops.length,
      summary:activeFilterScopeText(),
      sourcePage:state.page,
      search:String(state.search||''),
      filters:{
        year:globalFilterValues('year'),
        createdYear:globalFilterValues('createdYear'),
        referential:globalFilterValues('referential'),
        moaGroup:globalFilterValues('moaGroup'),
        status:globalFilterValues('status'),
        moa:globalFilterValues('moa'),
        region:globalFilterValues('region'),
        department:globalFilterValues('department'),
        profile:globalFilterValues('profile'),
        socialZone:globalFilterValues('socialZone')
      },
      crossFilters:state.crossFilters.map(f=>({key:f.key,value:f.value,label:f.label}))
    };
  }
  async function cloneAsPortableHtml(node){
    const clone=node.cloneNode(true);
    clone.querySelectorAll('[data-add-presentation], .obs-pres-head-tools, .obs-kpi-group-pres-btn, .obs-table-pager, .req-pager, .obs-view-toggle, .req-view-toggle, .obs-table-search').forEach(el=>el.remove());
    clone.querySelectorAll('button').forEach(btn=>{btn.setAttribute('type','button');});
    const imgs=[...clone.querySelectorAll('img')];
    await Promise.all(imgs.map(async img=>{
      const src=img.getAttribute('src');if(!src)return;
      const abs=new URL(src,location.href).href;
      try{const res=await fetch(abs,{cache:'force-cache'});if(!res.ok)throw new Error();img.setAttribute('src',await dataUrlFromBlob(await res.blob()));}
      catch{img.setAttribute('src',abs);}
    }));
    clone.querySelectorAll('[contenteditable]').forEach(el=>el.removeAttribute('contenteditable'));
    return clone.outerHTML;
  }
  async function addCurrentCardToPresentation(trigger){
    const card=trigger?.closest('.obs-card, .obs-kpi-summary-group, .obs-kpi');
    if(!card)return;
    const isKpi=card.classList.contains('obs-kpi');
    const isKpiGroup=card.classList.contains('obs-kpi-summary-group');
    const head=card.querySelector('.obs-card-head');
    const title=(isKpiGroup?'Chiffres clés':(isKpi?(card.querySelector(':scope > span')?.textContent||'Chiffre clé'):(head?.querySelector('h2')?.textContent||'Slide'))).trim();
    const kicker=(isKpiGroup?'VUE D’ENSEMBLE':(isKpi?'CHIFFRE CLÉ':(head?.querySelector('span')?.textContent||'OBSERVATOIRE DU BÂTIMENT DURABLE'))).trim();
    const legend=(isKpiGroup?'Opérations · Logements · Bâtiments · Maîtres d’ouvrage':(isKpi?(card.querySelector(':scope > small')?.textContent||''):(head?.querySelector('small')?.textContent||card.querySelector('.obs-table-note')?.textContent||''))).trim();
    const clone=card.cloneNode(true);
    clone.querySelectorAll('.obs-pres-head-tools,.obs-kpi-pres-btn,.obs-kpi-group-pres-btn').forEach(el=>el.remove());
    clone.querySelectorAll('.obs-card-head .obs-card-action').forEach(el=>el.remove());
    const clonedHead=clone.querySelector('.obs-card-head');
    if(clonedHead) clonedHead.remove();
    state.presentationCounter += 1;
    const id=`slide_${Date.now()}_${state.presentationCounter}`;
    const slide={
      id,
      type:'content',
      title,
      kicker,
      legend,
      notes:'',
      scope:activeFilterScopeText(),
      confidentialText:'CONFIDENTIEL',
      fontFamily:fontChoices()[0],
      titleSize:50,
      legendSize:20,
      footerSize:16,
      bodyScale:isKpi?115:(isKpiGroup?105:100),
      sourcePage:state.page,
      contentHtml:await cloneAsPortableHtml(clone),
      createdAt:new Date().toISOString()
    };
    state.presentationSlides.push(slide);
    state.presentationActiveId=id;
    savePresentationState();
    try{engine.toast?.(`Ajouté à la présentation : ${title}`);}catch{}
  }
  function ensureCoverSlide(){
    let cover=state.presentationSlides.find(s=>s.type==='cover');
    if(!cover){
      cover=defaultCoverModel();
      state.presentationSlides.unshift(cover);
    }else{
      const i=state.presentationSlides.findIndex(s=>s.id===cover.id);
      if(i>0){state.presentationSlides.splice(i,1);state.presentationSlides.unshift(cover);}
    }
    state.presentationActiveId=cover.id;
    savePresentationState();
    renderPage();
  }
  function updatePresentationField(id,key,value){
    const slide=state.presentationSlides.find(s=>s.id===id); if(!slide)return;
    if(['titleSize','legendSize','footerSize','bodyScale','subtitleSize','dateSize'].includes(key)) slide[key]=Number(value)||0;
    else slide[key]=value;
    savePresentationState();
  }
  function duplicatePresentationSlide(id){
    const source=state.presentationSlides.find(s=>s.id===id); if(!source)return;
    if(source.type==='cover') return;
    state.presentationCounter += 1;
    const copy=JSON.parse(JSON.stringify(source));
    copy.id=`slide_${Date.now()}_${state.presentationCounter}`;
    copy.title=`${source.title} (copie)`;
    state.presentationSlides.splice(state.presentationSlides.findIndex(s=>s.id===id)+1,0,copy);
    state.presentationActiveId=copy.id;
    savePresentationState();
    renderPage();
  }
  function movePresentationSlide(id,delta){
    const i=state.presentationSlides.findIndex(s=>s.id===id); if(i<0)return;
    if(state.presentationSlides[i]?.type==='cover') return;
    const coverOffset=state.presentationSlides[0]?.type==='cover'?1:0;
    const j=i+delta; if(j<coverOffset||j>=state.presentationSlides.length)return;
    const [slide]=state.presentationSlides.splice(i,1); state.presentationSlides.splice(j,0,slide);
    state.presentationActiveId=slide.id;
    savePresentationState();
    renderPage();
  }
  function deletePresentationSlide(id){
    const i=state.presentationSlides.findIndex(s=>s.id===id); if(i<0)return;
    state.presentationSlides.splice(i,1);
    state.presentationActiveId=state.presentationSlides[Math.max(0,i-1)]?.id || state.presentationSlides[0]?.id || '';
    savePresentationState();
    renderPage();
  }
  function clearPresentationSlides(){
    const cover=defaultCoverModel(); state.presentationSlides=[cover]; state.presentationActiveId=cover.id; savePresentationState(); renderPage();
  }
  function presentationSlideMarkup(slide){
    if(!slide) return `<div class="obs-empty">Aucune slide. Ajoute une couverture ou utilise l’icône ▣ sur un graphe / tableau.</div>`;
    const slideIndex=Math.max(1,state.presentationSlides.findIndex(s=>s.id===slide.id)+1);
    if(slide.type==='cover'){
      return `<article id="obsPresentationStage" class="obs-pres-stage obs-pres-stage-cover" style="--pres-title-size:${Number(slide.titleSize)||64}px;--pres-subtitle-size:${Number(slide.subtitleSize)||28}px;--pres-date-size:${Number(slide.dateSize)||26}px;font-family:${attr(slide.fontFamily||fontChoices()[0])}">
        <img class="obs-pres-cover-bg" src="assets/cover_template_base.png" alt="Fond de couverture Prestaterre">
        <img class="obs-pres-cover-logo" src="assets/prestaterre_logo_black.png" alt="Prestaterre Certifications">
        <div class="obs-pres-cover-copy">
          <h2 contenteditable="true" spellcheck="false" data-pres-editable="title" data-pres-id="${attr(slide.id)}">${esc(slide.title||'Observatoire du bâtiment durable')}</h2>
          <p contenteditable="true" spellcheck="false" data-pres-editable="subtitle" data-pres-id="${attr(slide.id)}">${esc(slide.subtitle||'')}</p>
        </div>
        <div class="obs-pres-cover-date" contenteditable="true" spellcheck="false" data-pres-editable="dateText" data-pres-id="${attr(slide.id)}">${esc(slide.dateText||'')}</div>
        <div class="obs-pres-cover-footer" contenteditable="true" spellcheck="false" data-pres-editable="footerText" data-pres-id="${attr(slide.id)}">${esc(slide.footerText||'Prestaterre Certifications')}</div>
        <div class="obs-pres-cover-conf" contenteditable="true" spellcheck="false" data-pres-editable="confidentialText" data-pres-id="${attr(slide.id)}">${esc(slide.confidentialText||'CONFIDENTIEL')}</div><div class="obs-pres-cover-page">1</div>
      </article>`;
    }
    return `<article id="obsPresentationStage" class="obs-pres-stage obs-pres-stage-standard" style="--pres-title-size:${Number(slide.titleSize)||50}px;--pres-legend-size:${Number(slide.legendSize)||20}px;--pres-footer-size:${Number(slide.footerSize)||16}px;--pres-body-scale:${(Number(slide.bodyScale)||100)/100};font-family:${attr(slide.fontFamily||fontChoices()[0])}">
      <div class="obs-pres-osb-brand"><img src="assets/prestaterre_logo_green.png" alt="Prestaterre"></div>
      <div class="obs-pres-confidential" contenteditable="true" spellcheck="false" data-pres-editable="confidentialText" data-pres-id="${attr(slide.id)}">${esc(slide.confidentialText||'CONFIDENTIEL')}</div>
      <div class="obs-pres-top"><div class="obs-pres-title-line"></div><div class="obs-pres-title-block"><div class="obs-pres-kicker" contenteditable="true" spellcheck="false" data-pres-editable="kicker" data-pres-id="${attr(slide.id)}">${esc(slide.kicker||'OBSERVATOIRE DU BÂTIMENT DURABLE')}</div><h2 contenteditable="true" spellcheck="false" data-pres-editable="title" data-pres-id="${attr(slide.id)}">${esc(slide.title||'Titre de slide')}</h2><p contenteditable="true" spellcheck="false" data-pres-editable="legend" data-pres-id="${attr(slide.id)}">${esc(slide.legend||'')}</p></div></div>
      <div class="obs-pres-figure-wrap"><div class="obs-pres-figure">${slide.contentHtml||''}</div></div>
      <div class="obs-pres-bottom"><div class="obs-pres-scope" contenteditable="true" spellcheck="false" data-pres-editable="scope" data-pres-id="${attr(slide.id)}">${esc(slide.scope||'')}</div><div class="obs-pres-notes" contenteditable="true" spellcheck="false" data-pres-editable="notes" data-pres-id="${attr(slide.id)}">${esc(slide.notes||'')}</div><div class="obs-pres-page-number">${slideIndex}</div></div>
    </article>`;
  }
  function presentationEditor(slide){
    if(!slide)return '<div class="obs-pres-editor-card"><h3>Édition de la slide</h3><p>Sélectionne ou crée une slide pour commencer.</p></div>';
    if(slide.type==='cover'){
      return `<div class="obs-pres-editor-card"><h3>Couverture</h3>
        <label>Titre<input type="text" data-pres-field="title" data-pres-id="${attr(slide.id)}" value="${attr(slide.title||'')}"></label>
        <label>Sous-titre<textarea data-pres-field="subtitle" data-pres-id="${attr(slide.id)}">${esc(slide.subtitle||'')}</textarea></label>
        <label>Date / période<input type="text" data-pres-field="dateText" data-pres-id="${attr(slide.id)}" value="${attr(slide.dateText||'')}"></label>
        <label>Texte bas de page<input type="text" data-pres-field="footerText" data-pres-id="${attr(slide.id)}" value="${attr(slide.footerText||'')}"></label>
        <label>Mention confidentialité<input type="text" data-pres-field="confidentialText" data-pres-id="${attr(slide.id)}" value="${attr(slide.confidentialText||'')}"></label>
        <label>Police<select data-pres-field="fontFamily" data-pres-id="${attr(slide.id)}">${fontChoices().map(f=>`<option value="${attr(f)}" ${slide.fontFamily===f?'selected':''}>${esc(f.split(',')[0])}</option>`).join('')}</select></label>
        <label>Taille titre <input type="range" min="40" max="92" step="1" data-pres-field="titleSize" data-pres-id="${attr(slide.id)}" value="${attr(slide.titleSize||64)}"><span>${fmt(slide.titleSize||64)} px</span></label>
        <label>Taille sous-titre <input type="range" min="18" max="44" step="1" data-pres-field="subtitleSize" data-pres-id="${attr(slide.id)}" value="${attr(slide.subtitleSize||28)}"><span>${fmt(slide.subtitleSize||28)} px</span></label>
        <label>Taille date <input type="range" min="18" max="42" step="1" data-pres-field="dateSize" data-pres-id="${attr(slide.id)}" value="${attr(slide.dateSize||26)}"><span>${fmt(slide.dateSize||26)} px</span></label>
      </div>`;
    }
    return `<div class="obs-pres-editor-card"><h3>Édition de la slide</h3>
      <label>Titre<input type="text" data-pres-field="title" data-pres-id="${attr(slide.id)}" value="${attr(slide.title||'')}"></label>
      <label>Sur-titre<input type="text" data-pres-field="kicker" data-pres-id="${attr(slide.id)}" value="${attr(slide.kicker||'')}"></label>
      <label>Légende / sous-titre<textarea data-pres-field="legend" data-pres-id="${attr(slide.id)}">${esc(slide.legend||'')}</textarea></label>
      <label>Périmètre / filtres<textarea data-pres-field="scope" data-pres-id="${attr(slide.id)}">${esc(slide.scope||'')}</textarea></label>
      <label>Note libre<textarea data-pres-field="notes" data-pres-id="${attr(slide.id)}">${esc(slide.notes||'')}</textarea></label>
      <label>Mention confidentialité<input type="text" data-pres-field="confidentialText" data-pres-id="${attr(slide.id)}" value="${attr(slide.confidentialText||'')}"></label>
      <label>Police<select data-pres-field="fontFamily" data-pres-id="${attr(slide.id)}">${fontChoices().map(f=>`<option value="${attr(f)}" ${slide.fontFamily===f?'selected':''}>${esc(f.split(',')[0])}</option>`).join('')}</select></label>
      <label>Taille du titre <input type="range" min="32" max="76" step="1" data-pres-field="titleSize" data-pres-id="${attr(slide.id)}" value="${attr(slide.titleSize||50)}"><span>${fmt(slide.titleSize||50)} px</span></label>
      <label>Taille des textes <input type="range" min="14" max="34" step="1" data-pres-field="legendSize" data-pres-id="${attr(slide.id)}" value="${attr(slide.legendSize||20)}"><span>${fmt(slide.legendSize||20)} px</span></label>
      <label>Taille du bas de page <input type="range" min="12" max="26" step="1" data-pres-field="footerSize" data-pres-id="${attr(slide.id)}" value="${attr(slide.footerSize||16)}"><span>${fmt(slide.footerSize||16)} px</span></label>
      <label>Échelle du visuel <input type="range" min="80" max="120" step="1" data-pres-field="bodyScale" data-pres-id="${attr(slide.id)}" value="${attr(slide.bodyScale||100)}"><span>${fmt(slide.bodyScale||100)} %</span></label>
    </div>`;
  }
  function renderPresentation(){
    const slide=currentPresentationSlide();
    const right=`<div class="obs-presentation-head-actions"><button type="button" class="obs-card-action" data-pres-cover="1">Couverture</button><button type="button" class="obs-card-action obs-google-slides-btn" data-pres-google-slides="1">Google Slides ↗</button><button type="button" class="obs-card-action" data-pres-export-pptx="1">PPTX</button><button type="button" class="obs-card-action" data-pres-export-all="png">PNG 4K</button><button type="button" class="obs-card-action" data-pres-export-all="svg">SVG</button></div>`;
    const thumbs=state.presentationSlides.map((s,i)=>`<button type="button" class="obs-pres-thumb ${s.id===slide?.id?'is-active':''}" data-pres-select="${attr(s.id)}"><span class="obs-pres-thumb-index">${i+1}</span><b>${esc(shorten(s.type==='cover'?'Couverture':(s.title||'Slide'),40))}</b><small>${esc(shorten(s.type==='cover'?(s.subtitle||''):(s.scope||''),70))}</small></button>`).join('') || '<div class="obs-empty">Aucune slide pour le moment.</div>';
    const editor=presentationEditor(slide);
    const controls=slide?`<div class="obs-pres-slide-actions">${slide.type!=='cover'?`<button type="button" class="obs-card-action" data-pres-duplicate="${attr(slide.id)}">Dupliquer</button><button type="button" class="obs-card-action" data-pres-move="up" data-pres-id="${attr(slide.id)}">Monter</button><button type="button" class="obs-card-action" data-pres-move="down" data-pres-id="${attr(slide.id)}">Descendre</button>`:''}<button type="button" class="obs-card-action" data-pres-fullscreen="1">Plein écran</button><button type="button" class="obs-card-action" data-pres-export="png" data-pres-id="${attr(slide.id)}">PNG 4K</button><button type="button" class="obs-card-action" data-pres-export="svg" data-pres-id="${attr(slide.id)}">SVG</button><button type="button" class="obs-card-action danger" data-pres-delete="${attr(slide.id)}">Supprimer</button></div>`:`<div class="obs-pres-slide-actions"><button type="button" class="obs-card-action" data-pres-cover="1">Créer une couverture</button></div>`;
    return `${pageHead('presentation',right)}
      <div class="obs-pres-help">Les textes restent éditables dans l’Observatoire Prestaterre. Le bouton Google Slides reproduit fidèlement chaque slide dans Drive, graphiques et mises en page compris. Le rendu est envoyé comme visuel haute définition afin d’éviter toute déformation des graphiques. Le PPTX reste disponible comme export secondaire.</div>
      <div class="obs-presentation-layout">
        <aside class="obs-presentation-side">
          <div class="obs-pres-side-head"><h3>Slides</h3><div class="obs-pres-side-actions"><button type="button" class="obs-card-action" data-pres-cover="1">+ Couverture</button><button type="button" class="obs-card-action danger" data-pres-clear="1">Vider</button></div></div>
          <div class="obs-pres-thumbs">${thumbs}</div>
          ${editor}
        </aside>
        <section class="obs-presentation-main">
          ${controls}
          <div class="obs-pres-canvas-wrap">${presentationSlideMarkup(slide)}</div>
        </section>
      </div>`;
  }
  function cssTextForExport(){
    let css='';
    for(const sheet of Array.from(document.styleSheets||[])){
      try{ for(const rule of Array.from(sheet.cssRules||[])) css += rule.cssText+'\n'; }catch{}
    }
    return css;
  }
  function dataUrlFromBlob(blob){
    return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result||''));reader.onerror=reject;reader.readAsDataURL(blob);});
  }
  async function assetDataUrl(url){
    const res=await fetch(new URL(url,location.href).href,{cache:'force-cache'}); if(!res.ok)throw new Error(`Asset indisponible : ${url}`); return dataUrlFromBlob(await res.blob());
  }
  function svgMarkupForNode(node,width,height){
    const clone=node.cloneNode(true);
    clone.querySelectorAll('[contenteditable]').forEach(el=>el.removeAttribute('contenteditable'));
    clone.querySelectorAll('img').forEach(img=>{const src=img.getAttribute('src');if(src)img.setAttribute('src',new URL(src,location.href).href);});
    clone.style.width=`${width}px`; clone.style.height=`${height}px`; clone.style.maxWidth=`${width}px`;
    const xhtml=`<div xmlns="http://www.w3.org/1999/xhtml"><style>${cssTextForExport()}</style>${clone.outerHTML}</div>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><foreignObject width="100%" height="100%">${xhtml}</foreignObject></svg>`;
  }
  async function pngDataUrlFromNode(node,width=1920,height=1080){
    const svg=svgMarkupForNode(node,width,height);
    const svgBlob=new Blob([svg],{type:'image/svg+xml;charset=utf-8'});
    const url=URL.createObjectURL(svgBlob);
    try{
      const img=await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=url;});
      const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,width,height);ctx.drawImage(img,0,0,width,height);return canvas.toDataURL('image/png');
    }finally{URL.revokeObjectURL(url);}
  }
  async function bodyPngForSlide(slide){
    if(!slide||slide.type==='cover'||!slide.contentHtml)return '';
    const host=document.createElement('div');
    host.className='obs-pres-ppt-body';
    host.style.cssText='position:fixed;left:-20000px;top:0;width:1600px;height:760px;overflow:hidden;background:#fff;padding:22px;z-index:-9999;';
    host.innerHTML=slide.contentHtml;
    document.body.appendChild(host);
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    try{return await pngDataUrlFromNode(host,2400,1140);}finally{host.remove();}
  }
  function exportStageNode(node,filename,format='png'){
    if(!node)return;
    const svg=svgMarkupForNode(node,3840,2160);
    const svgBlob=new Blob([svg],{type:'image/svg+xml;charset=utf-8'});
    const download=(blob,name)=>{const a=document.createElement('a');const url=URL.createObjectURL(blob);a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);};
    if(format==='svg'){download(svgBlob,`${filename}.svg`);return;}
    const url=URL.createObjectURL(svgBlob);const img=new Image();
    img.onload=()=>{const canvas=document.createElement('canvas');canvas.width=3840;canvas.height=2160;const ctx=canvas.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);canvas.toBlob(blob=>{if(blob)download(blob,`${filename}.png`);URL.revokeObjectURL(url);},'image/png');};
    img.onerror=()=>URL.revokeObjectURL(url);img.src=url;
  }
  function exportPresentationSlide(id,format='png'){
    const slide=state.presentationSlides.find(s=>s.id===id);if(!slide)return;
    const node=document.getElementById('obsPresentationStage');
    exportStageNode(node,`Observatoire_Prestaterre_${slide.type==='cover'?'couverture':String(slide.title||'slide').replace(/[^a-z0-9_-]+/gi,'_').slice(0,60)}`,format);
  }
  function exportAllPresentationSlides(format='png'){
    if(!state.presentationSlides.length)return;
    const currentId=state.presentationActiveId,ids=state.presentationSlides.map(s=>s.id);let i=0;
    const next=()=>{if(i>=ids.length){state.presentationActiveId=currentId;savePresentationState();renderPage();return;}state.presentationActiveId=ids[i];savePresentationState();renderPage();requestAnimationFrame(()=>requestAnimationFrame(()=>{exportPresentationSlide(ids[i],format);i+=1;setTimeout(next,350);}));};next();
  }
  function googleSlidesNumber(value){
    const raw=String(value??'').replace(/\u00a0/g,' ').trim();
    const m=raw.match(/-?[\d\s]+(?:[.,]\d+)?/);
    if(!m)return null;
    const n=Number(m[0].replace(/\s/g,'').replace(',','.'));
    return Number.isFinite(n)?n:null;
  }
  function googleSlidesText(el){return String(el?.textContent||'').replace(/\s+/g,' ').trim();}
  function googleSlidesVisualDescriptor(model){
    if(!model||model.type==='cover'||!model.contentHtml)return {type:'empty'};
    const host=document.createElement('div');host.innerHTML=model.contentHtml;
    host.querySelectorAll('.obs-pres-head-tools,[data-add-presentation],.obs-table-pager,.obs-view-toggle,.obs-card-action').forEach(el=>el.remove());

    const evolution=host.querySelector('.obs-evolution-multi');
    if(evolution){
      const seriesMap=new Map();
      evolution.querySelectorAll('.obs-evolution-series circle title').forEach(t=>{
        const s=googleSlidesText(t),m=s.match(/^(.*?)\s*·\s*(\d{4})\s*:\s*([\d\s.,]+)/);
        if(!m)return;
        const name=m[1].trim(),year=m[2],value=googleSlidesNumber(m[3]);
        if(value===null)return;
        if(!seriesMap.has(name))seriesMap.set(name,[]);
        seriesMap.get(name).push({x:year,y:value});
      });
      const series=[...seriesMap.entries()].map(([name,points])=>({name,points:points.sort((a,b)=>Number(a.x)-Number(b.x))}));
      if(series.length)return {type:'line',series};
    }

    const kpis=[...host.querySelectorAll('.obs-kpi')].map(el=>({label:googleSlidesText(el.querySelector('span')),value:googleSlidesText(el.querySelector('strong')),note:googleSlidesText(el.querySelector('small'))})).filter(x=>x.label||x.value);
    if(kpis.length>=2)return {type:'kpi',items:kpis.slice(0,8)};

    const table=host.querySelector('.obs-table, .obs-heatmap table, table');
    if(table){
      const headers=[...table.querySelectorAll('thead th')].map(googleSlidesText).slice(0,9);
      const rows=[...table.querySelectorAll('tbody tr')].slice(0,15).map(tr=>[...tr.querySelectorAll('th,td')].map(googleSlidesText).slice(0,9));
      if(headers.length||rows.length)return {type:'table',headers,rows};
    }

    const bars=[...host.querySelectorAll('.obs-bar-row')].map(el=>{
      const label=googleSlidesText(el.querySelector('span:first-child'));
      const valueText=googleSlidesText(el.querySelector('strong'));
      return {label,valueText,value:googleSlidesNumber(valueText)};
    }).filter(x=>x.label||x.valueText);
    if(bars.length)return {type:'bars',items:bars.slice(0,15)};

    const tunnel=[...host.querySelectorAll('.obs-tunnel-step')].map(el=>({label:googleSlidesText(el.querySelector('span')),value:googleSlidesText(el.querySelector('strong')),note:googleSlidesText(el.querySelector('small'))})).filter(x=>x.label);
    if(tunnel.length)return {type:'tunnel',items:tunnel.slice(0,8)};

    const tiles=[...host.querySelectorAll('.obs-data-tile,.obs-mini-treemap button,.obs-tag,.obs-compact-list-row')].map(el=>({label:googleSlidesText(el.querySelector('span'))||googleSlidesText(el).replace(/\s+[\d.,%]+.*$/,''),value:googleSlidesText(el.querySelector('b,strong')),note:googleSlidesText(el.querySelector('small'))})).filter(x=>x.label||x.value);
    if(tiles.length)return {type:'tiles',items:tiles.slice(0,15)};

    const gauge=host.querySelector('.obs-performance-gauge');
    if(gauge){
      return {type:'gauge',left:googleSlidesText(gauge.querySelector('.obs-gauge-scale span:first-child')),right:googleSlidesText(gauge.querySelector('.obs-gauge-scale span:last-child')),label:googleSlidesText(gauge.querySelector('.obs-gauge-project span')),value:googleSlidesText(gauge.querySelector('.obs-gauge-project strong')),note:googleSlidesText(gauge.querySelector('.obs-gauge-project small'))};
    }

    const beforeAfter=host.querySelector('.obs-before-after');
    if(beforeAfter){
      const items=[...beforeAfter.querySelectorAll(':scope > div')].map(el=>({label:googleSlidesText(el.querySelector('span')),value:googleSlidesText(el.querySelector('b'))}));
      return {type:'beforeAfter',items,note:googleSlidesText(beforeAfter.querySelector(':scope > small'))};
    }

    const flow=host.querySelector('.obs-flow');
    if(flow){
      const readNodes=sel=>[...flow.querySelectorAll(sel)].map(el=>({label:googleSlidesText(el.querySelector('span')),value:googleSlidesText(el.querySelector('b')),note:googleSlidesText(el.querySelector('small'))})).filter(x=>x.label);
      return {type:'flow',before:readNodes('.obs-flow-column.before .obs-flow-node').slice(0,10),after:readNodes('.obs-flow-column.after .obs-flow-node').slice(0,10),caption:googleSlidesText(host.querySelector('.obs-flow-caption'))};
    }

    const dpe=[...host.querySelectorAll('.obs-dpe-row')].map(el=>({label:googleSlidesText(el.querySelector('.obs-dpe-letter')),before:googleSlidesText(el.querySelector('.obs-dpe-bar:not(.after) strong')),after:googleSlidesText(el.querySelector('.obs-dpe-bar.after strong'))})).filter(x=>x.label);
    if(dpe.length)return {type:'dpe',items:dpe};

    const map=host.querySelector('.obs-map-stage,.obs-france-map,.obs-osm-native');
    if(map){
      const labels=[...host.querySelectorAll('.obs-map-region-label,.obs-map-dept-label,.obs-map-major-city,.obs-map-city-name,.obs-osm-region-label,.obs-osm-dept-label,.obs-osm-major-city,.obs-osm-city-name')].map(googleSlidesText).filter(Boolean);
      const markers=[...host.querySelectorAll('.obs-map-marker,.obs-map-dep-op,.obs-osm-dep-op')].slice(0,40).map(el=>({label:googleSlidesText(el.querySelector('title'))||el.getAttribute('aria-label')||'',x:Number(el.getAttribute('cx')||el.getAttribute('x')||0),y:Number(el.getAttribute('cy')||el.getAttribute('y')||0),r:Number(el.getAttribute('r')||5)}));
      return {type:'map',labels:[...new Set(labels)].slice(0,25),markers};
    }

    const metric=[...host.querySelectorAll('.obs-envelope-metrics > div,.obs-detail,.obs-hist-bin')].map(el=>({label:googleSlidesText(el.querySelector('span'))||googleSlidesText(el.querySelector('td:first-child')),value:googleSlidesText(el.querySelector('b,strong,.obs-hist-count'))||googleSlidesText(el.querySelector('td:last-child')),note:googleSlidesText(el.querySelector('small'))})).filter(x=>x.label||x.value);
    if(metric.length)return {type:'tiles',items:metric.slice(0,15)};

    const textItems=[...host.querySelectorAll('strong,b,th,td,span')].map(googleSlidesText).filter(t=>t&&t.length<180);
    return {type:'list',items:[...new Set(textItems)].slice(0,22)};
  }
  async function googleSlideSnapshot(model){
    const wrap=document.createElement('div');wrap.className='obs-google-slide-snapshot';wrap.style.cssText='position:fixed;left:-20000px;top:0;width:1280px;height:720px;overflow:hidden;background:#fff;z-index:-99999;';wrap.innerHTML=presentationSlideMarkup(model);document.body.appendChild(wrap);
    const node=wrap.querySelector('#obsPresentationStage');
    try{await Promise.all([...node.querySelectorAll('img')].map(img=>img.complete?Promise.resolve():new Promise(r=>{img.onload=r;img.onerror=r;})));await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const svg=svgMarkupForNode(node,1600,900),blob=new Blob([svg],{type:'image/svg+xml;charset=utf-8'}),url=URL.createObjectURL(blob);try{const img=await new Promise((res,rej)=>{const im=new Image();im.onload=()=>res(im);im.onerror=rej;im.src=url;});const canvas=document.createElement('canvas');canvas.width=1600;canvas.height=900;const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,1600,900);ctx.drawImage(img,0,0,1600,900);return canvas.toDataURL('image/jpeg',0.92);}finally{URL.revokeObjectURL(url);}}finally{wrap.remove();}
  }
  async function buildGoogleSlidesPayload(){
    const slides=[];
    for(let i=0;i<state.presentationSlides.length;i++){const model=state.presentationSlides[i];slides.push({type:'snapshot',title:model.title||'',slideNumber:i+1,imageData:await googleSlideSnapshot(model)});}
    return {title:`Observatoire Prestaterre – ${new Date().toLocaleDateString('fr-FR')}`,createdAt:new Date().toISOString(),renderMode:'snapshot-v1',slides};
  }

  async function exportPresentationGoogleSlides(){
    if(!state.presentationSlides.length)return;
    if(typeof engine.createGoogleSlides!=='function'){alert('Le pont Google Slides n’est pas disponible dans cette version.');return;}
    const target=window.open('about:blank','newosb_google_slides');
    if(target){try{target.document.write('<title>Observatoire Prestaterre → Google Slides</title><div style="font-family:Arial;padding:32px">Création de la présentation Google Slides en cours…</div>');}catch{}}
    try{
      const payload=await buildGoogleSlidesPayload();
      const result=await engine.createGoogleSlides(payload);
      if(!result?.ok)throw new Error(result?.error||'Création Google Slides impossible.');
      if(target&&!target.closed)target.location.href=result.url;else if(result.url)window.open(result.url,'_blank','noopener');
      const toast=document.getElementById('toast');if(toast){toast.textContent='Présentation Google Slides créée.';toast.classList.add('is-visible');setTimeout(()=>toast.classList.remove('is-visible'),2200);}
    }catch(err){
      try{if(target&&!target.closed)target.close();}catch{}
      console.error(err);alert('Google Slides impossible : '+(err?.message||err));
    }
  }
  function pptxFontName(cssFont){return String(cssFont||'Arial').split(',')[0].replace(/["']/g,'').trim()||'Arial';}
  async function exportPresentationPptx(){
    if(!state.presentationSlides.length)return;
    if(typeof window.PptxGenJS!=='function'){alert('Le module PPTX est indisponible. Recharge la page puis réessaie.');return;}
    const Pptx=window.PptxGenJS,pptx=new Pptx();pptx.layout='LAYOUT_WIDE';pptx.author='Prestaterre Certifications';pptx.subject='Observatoire Prestaterre';pptx.title='Observatoire Prestaterre – Présentation';pptx.company='Prestaterre Certifications';pptx.lang='fr-FR';pptx.theme={headFontFace:'Arial',bodyFontFace:'Arial',lang:'fr-FR'};
    let logoData='',coverData='';
    try{[logoData,coverData]=await Promise.all([assetDataUrl('assets/prestaterre_logo_green.png'),assetDataUrl('assets/cover_template_base.png')]);}catch{}
    for(let i=0;i<state.presentationSlides.length;i++){
      const model=state.presentationSlides[i],s=pptx.addSlide();s.background={color:'FFFFFF'};
      const font=pptxFontName(model.fontFamily);
      if(model.type==='cover'){
        if(coverData)s.addImage({data:coverData,x:0,y:0,w:13.333,h:7.5});
        s.addText(String(model.title||''),{x:.72,y:3.55,w:8.8,h:.78,fontFace:font,fontSize:Math.max(28,Math.min(48,(Number(model.titleSize)||64)*.58)),bold:true,color:'06402B',margin:0,breakLine:false,fit:'shrink'});
        s.addText(String(model.subtitle||''),{x:.75,y:4.42,w:8.8,h:.55,fontFace:font,fontSize:Math.max(15,Math.min(27,(Number(model.subtitleSize)||28)*.72)),color:'315D50',margin:0,fit:'shrink'});
        s.addText(String(model.dateText||''),{x:9.2,y:4.52,w:3.35,h:.45,fontFace:font,fontSize:Math.max(14,Math.min(24,(Number(model.dateSize)||26)*.72)),bold:true,color:'111111',align:'right',margin:0,fit:'shrink'});
        s.addText(String(model.footerText||''),{x:.42,y:7.08,w:3.4,h:.22,fontFace:font,fontSize:8.5,color:'111111',margin:0,fit:'shrink'});
        s.addText(String(model.confidentialText||''),{x:10.35,y:7.05,w:1.7,h:.22,fontFace:font,fontSize:8.5,color:'A30000',align:'right',margin:0,fit:'shrink'});
      }else{
        if(logoData)s.addImage({data:logoData,x:.46,y:.13,w:1.06,h:.42});
        s.addShape(pptx.ShapeType.rect,{x:1.74,y:.30,w:.045,h:.78,line:{color:'06402B',transparency:100},fill:{color:'06402B'}});
        s.addText(String(model.kicker||''),{x:1.92,y:.18,w:7.9,h:.22,fontFace:font,fontSize:9,color:'648075',bold:true,charSpacing:1.6,margin:0,fit:'shrink'});
        s.addText(String(model.title||''),{x:1.92,y:.42,w:8.7,h:.55,fontFace:font,fontSize:Math.max(22,Math.min(38,(Number(model.titleSize)||50)*.62)),bold:true,color:'102D25',margin:0,fit:'shrink'});
        s.addText(String(model.legend||''),{x:1.92,y:1.02,w:8.7,h:.34,fontFace:font,fontSize:Math.max(10,Math.min(19,(Number(model.legendSize)||20)*.7)),color:'315D50',margin:0,fit:'shrink'});
        s.addText(String(model.confidentialText||''),{x:11.2,y:.18,w:1.45,h:.28,fontFace:font,fontSize:8.5,bold:true,color:'FFFFFF',align:'center',valign:'mid',margin:0,fill:{color:'06402B'},fit:'shrink'});
        let body='';try{body=await bodyPngForSlide(model);}catch{}
        if(body)s.addImage({data:body,x:.46,y:1.52,w:12.40,h:4.72,transparency:0});
        else s.addText('Visuel indisponible lors de l’export – conserve la slide de l’Observatoire Prestaterre pour réexporter.',{x:1.0,y:3.2,w:11.3,h:.5,fontFace:font,fontSize:16,color:'728279',align:'center',margin:0});
        s.addShape(pptx.ShapeType.line,{x:.46,y:6.48,w:12.4,h:0,line:{color:'C9D8D1',width:1}});
        s.addText(String(model.scope||''),{x:.46,y:6.60,w:8.4,h:.48,fontFace:font,fontSize:Math.max(8.5,Math.min(12,(Number(model.footerSize)||16)*.65)),color:'38544A',margin:0,fit:'shrink'});
        s.addText(String(model.notes||''),{x:9.0,y:6.60,w:3.15,h:.48,fontFace:font,fontSize:Math.max(8.5,Math.min(12,(Number(model.footerSize)||16)*.65)),color:'38544A',align:'right',margin:0,fit:'shrink'});
        s.addText(String(i+1),{x:12.33,y:7.05,w:.45,h:.18,fontFace:font,fontSize:8,color:'7A8882',align:'right',margin:0});
      }
    }
    const fn=`Observatoire_Prestaterre_Presentation_${new Date().toISOString().slice(0,10)}.pptx`;
    await pptx.writeFile({fileName:fn});
  }
  function decoratePresentationButtons(){
    if(state.page==='presentation') return;
    pageEl.querySelectorAll('.obs-card').forEach(card=>{
      const head=card.querySelector('.obs-card-head');
      if(!head || head.querySelector('.obs-pres-head-tools')) return;
      const wrap=document.createElement('div');
      wrap.className='obs-pres-head-tools';
      wrap.innerHTML='<button type="button" class="obs-card-action obs-pres-add-btn obs-pres-icon-btn" data-add-presentation="1" title="Ajouter à la présentation" aria-label="Ajouter à la présentation">▣</button>';
      const mapActions=head.querySelector('.obs-map-head-actions');if(mapActions)mapActions.appendChild(wrap);else head.appendChild(wrap);
    });
  }

  function decorateAuditButtons(){
    if(state.page==='presentation') return;
    pageEl.querySelectorAll('.obs-card').forEach(card=>{
      const head=card.querySelector('.obs-card-head');
      if(!head || head.querySelector('[data-audit-card]')) return;
      const btn=document.createElement('button');btn.type='button';btn.className='obs-card-action obs-audit-btn';btn.dataset.auditCard='1';btn.title='Source, calcul et population';btn.setAttribute('aria-label','Source, calcul et population');btn.textContent='ⓘ';
      const tools=head.querySelector('.obs-card-head-tools')||head.querySelector('.obs-map-head-actions');if(tools)tools.appendChild(btn);else head.appendChild(btn);
    });
    pageEl.querySelectorAll('.obs-kpi').forEach(k=>{if(!k.dataset.auditLabel)k.dataset.auditLabel=k.querySelector('span')?.textContent?.trim()||'Indicateur';k.title=(k.title?k.title+' · ':'')+'Cliquer pour voir la source et la couverture';k.classList.add('obs-auditable');});
  }
  function inferredDictionaryMetric(label){
    if(!core?.dictionary)return '';
    const n=norm(label);const exact=core.dictionary.find(d=>norm(d.label)===n);if(exact)return exact.key;
    const fuzzy=core.dictionary.find(d=>n.includes(norm(d.label))||norm(d.label).includes(n));return fuzzy?.key||'';
  }
  function auditHtml(title,metric=''){
    if(state.page==='requirements'){const info=window.NEWOSB_REQUIREMENTS?.auditInfo?.()||{};return `<div class="obs-audit-content"><div class="obs-audit-kpis"><div><span>Évaluations filtrées</span><b>${fmt(info.evaluations||0)}</b></div><div><span>Occurrences distinctes</span><b>${fmt(info.occurrences||0)}</b></div><div><span>Lignes filtrées</span><b>${fmt(info.filteredRows||0)}</b></div><div><span>Lignes chargées</span><b>${fmt(info.rows||0)}</b></div></div><div class="obs-audit-section"><h4>Source dédiée Exigences</h4><p>Google Sheet · onglet <b>RAPPORT</b> via Code_Exigences.gs.</p><p>${info.loadedAt?`Dernière actualisation : ${esc(new Date(info.loadedAt).toLocaleString('fr-FR'))}`:'Date d’actualisation non disponible.'}</p><p>Les filtres Exigences sont indépendants des filtres OPERATIONS. Les occurrences sont dédupliquées par couple évaluation + exigence.</p></div><div class="obs-audit-section"><h4>Calcul du visuel</h4><p>Le visuel « ${esc(title)} » est recalculé à partir de la population RAPPORT filtrée dans l’onglet Exigences.</p></div></div>`;}
    const technicalPage=['solutions','energy','carbon','crossdata'].includes(state.page); const ops=technicalPage?filteredTechnicalOperations():filteredOperations(), all=technicalPage?sourceTechnicalOperations():sourceOperations(), excluded=excludedOperations();
    const key=metric||inferredDictionaryMetric(title), d=key?core?.dictByKey?.[key]:null, cov=key&&core?.coverage?core.coverage(ops,key):null;
    const selectedCodes=new Set(ops.map(o=>String(o.code))); const missingOps=key?ops.filter(o=>String(rawValue(o,key)??'').trim()===''):[];
    return `<div class="obs-audit-content"><div class="obs-audit-kpis"><div><span>${technicalPage?'Opérations techniques':'Projets actifs'}</span><b>${fmt(ops.length)}</b></div><div><span>Hors statistiques</span><b>${fmt(excluded.length)}</b></div>${cov?`<div><span>Valeurs disponibles</span><b>${fmt(cov.available)} / ${fmt(cov.population)}</b></div><div><span>Couverture</span><b>${fmt(cov.rate,1)} %</b></div>`:''}</div><div class="obs-audit-section"><h4>Périmètre</h4><p>${esc(activeFilterScopeText())}</p><p>${fmt(all.length)} ${technicalPage?'opérations techniques':'projets'} chargés · ${fmt(excluded.length)} perdues/abandonnées/annulées exclues des statistiques actives.</p><p>Source : ${esc(runtime().connected?(runtime().mode||'connectée'):'démonstration')} · ${runtime().lastLoadedAt?`dernière actualisation ${esc(new Date(runtime().lastLoadedAt).toLocaleString('fr-FR'))}`:'date d’actualisation non disponible'}</p></div>${d?`<div class="obs-audit-section"><h4>${esc(d.label)}</h4><dl><dt>Définition</dt><dd>${esc(d.definition)}</dd><dt>Source</dt><dd>${esc(d.source)}</dd><dt>Nature</dt><dd>${esc(d.type)}</dd><dt>Unité</dt><dd>${esc(d.unit||'—')}</dd><dt>Méthode</dt><dd>${esc(d.method)}</dd></dl></div>`:`<div class="obs-audit-section"><h4>Calcul / agrégation</h4><p>Ce visuel est calculé à partir de la population filtrée de l’Observatoire Prestaterre. Les projets identifiés comme perdus, abandonnés ou annulés via <b>Statut</b> sont exclus avant agrégation.</p></div>`}${missingOps.length?`<div class="obs-audit-section"><h4>Données manquantes</h4><p>${fmt(missingOps.length)} opération${missingOps.length>1?'s':''} de la sélection sans valeur pour cet indicateur.</p></div>`:''}</div>`;
  }
  function openAudit(title,metric=''){
    let modal=document.getElementById('obsAuditModal');if(!modal){modal=document.createElement('div');modal.id='obsAuditModal';modal.className='obs-audit-modal';modal.innerHTML='<div class="obs-audit-backdrop" data-audit-close="1"></div><section class="obs-audit-panel"><header><div><span>TRAÇABILITÉ</span><h3 id="obsAuditTitle"></h3></div><button type="button" data-audit-close="1">×</button></header><div id="obsAuditBody"></div></section>';document.body.appendChild(modal);modal.addEventListener('click',e=>{if(e.target.closest('[data-audit-close]'))modal.classList.remove('is-open');});}
    modal.querySelector('#obsAuditTitle').textContent=title||'Source et calcul';modal.querySelector('#obsAuditBody').innerHTML=auditHtml(title,metric);modal.classList.add('is-open');
  }

  function runtime(){ return engine.getRuntime(); }
  function privacy(){ return window.NEWOSB_PRIVACY; }
  function sourceOperations(){ const ops=runtime().connected ? engine.getOperations() : engine.getDemoOperations(); return privacy()?.anonymizeOperations?.(ops)||ops; }
  function sourceTechnicalOperations(){ const ops=runtime().connected ? (engine.getTechnicalOperations?.()||engine.getOperations()) : (engine.getDemoTechnicalOperations?.()||engine.getDemoOperations()); return privacy()?.anonymizeOperations?.(ops)||ops; }
  function operationAffairStage(op){
    if(core?.affairStage) return core.affairStage(op);
    if(String(op?.affairStage||'').trim()) return String(op.affairStage).trim();
    return '';
  }
  function isLostAbandonedOperation(op){
    if(core?.isExcludedOperation) return core.isExcludedOperation(op);
    return Boolean(op?.analysisExcluded);
  }
  function excludedOperations(){ return sourceOperations().filter(isLostAbandonedOperation); }
  function baseOperations(){ return sourceOperations().filter(o=>!isLostAbandonedOperation(o)); }
  function baseTechnicalOperations(){ const excludedCodes=new Set(excludedOperations().map(o=>String(o.code))); return sourceTechnicalOperations().filter(o=>!excludedCodes.has(String(o.projectCode||String(o.code).split('::')[0]))&&!isLostAbandonedOperation(o)); }
  function regionName(code){ return engine.regionForDepartment(code) || 'Non localisé'; }
  function operationRegion(op){
    const direct=String(op?.region||'').trim();
    return direct||regionName(op?.department);
  }
  function departmentName(code){ return engine.departmentName(code) || code || 'Non localisé'; }

  function matchesTag(value, wanted){
    if (!wanted) return true;
    return norm(value).includes(norm(wanted));
  }

  function rawValue(op,key){
    if(core?.rawValue) return core.rawValue(op,key);
    if(op && Object.prototype.hasOwnProperty.call(op,key) && String(op[key]??'').trim()!=='') return op[key];
    return '';
  }
  function rawNumber(op,key){
    if(core?.rawNumber) return core.rawNumber(op,key);
    const n=Number(rawValue(op,key));return Number.isFinite(n)?n:null;
  }
  function dpeLetter(op,key){ return String(rawValue(op,key)||'').toUpperCase().match(/[A-G]/)?.[0] || ''; }
  function operationHasTag(op,kind,label){
    if(engine.operationHasTag) return engine.operationHasTag(op,kind,label);
    return matchesTag(kind==='mention'?op.mentions:op.performance,label);
  }

  function technicalChildrenForProject(op){
    if(!op||!Array.isArray(op.rawRows)||op.rawRows.length<=1)return [];
    const code=String(op.code||'');
    return sourceTechnicalOperations().filter(x=>String(x.projectCode||'')===code);
  }
  function isTechnicalCrossKey(key){
    return ['structure','roofStructure','wallStructure','floorStructure','wallInsulation','roofInsulation','floorInsulation','windowMaterial','windowGlazing','windowShading','ventilation','cooling','heatingBefore','heatingAfter','heatingModeAfter','ecsBefore','ecsAfter','dpeEnergyBefore','dpeEnergyAfter','dpeGesBefore','dpeGesAfter'].includes(key)||key.startsWith('range:')||key.startsWith('threshold:')||key.startsWith('dpeGain:')||key.startsWith('transition:');
  }

  function chronologyStatus(op){
    const stage=norm(operationAffairStage(op)||''), raw=norm(op?.rawStatus||''), combined=`${stage} ${raw}`.trim();
    if(isLostAbandonedOperation(op)||op?.status==='cancelled'||/(^| )(perdu|perdue|perte|abandon|abandonne|abandonnee|annul|annule|annulee)( |$)/.test(combined)){
      if(/annul/.test(combined)) return 'cancelledAffair';
      if(/abandon/.test(combined)) return 'abandonedAffair';
      if(/perdu|perte/.test(combined)) return 'lostAffair';
      return 'cancelledAffair';
    }
    return op?.status||'notStarted';
  }

  function matchesCross(op,f){
    const value=f.value;
    if(Array.isArray(op?.rawRows)&&op.rawRows.length>1&&isTechnicalCrossKey(f.key)){
      const children=technicalChildrenForProject(op); if(children.length)return children.some(child=>matchesCross(child,f));
    }
    if(f.key==='region') return norm(operationRegion(op))===norm(value);
    if(f.key==='department') return String(op.department)===String(value);
    if(f.key==='city') return norm(op.city||'Non précisé')===norm(value);
    if(f.key==='intercommunality') return norm(op.intercommunality||'Non précisé')===norm(value);
    if(f.key==='moa') return norm(op.moa)===norm(value);
    if(f.key==='moaType') return norm(op.moaType||'Non précisé')===norm(value);
    if(f.key==='status') return op.status===value;
    if(f.key==='rawStatus') return norm(op.rawStatus||STATUS_LABELS[op.status])===norm(value);
    if(f.key==='sold') return Boolean(op.sold)===String(value)==='true';
    if(f.key==='referential') return norm(op.referential)===norm(value);
    if(f.key==='nature') return norm(op.nature)===norm(value);
    if(f.key==='year') return String(op.year)===String(value);
    if(f.key==='socialZone') return norm(op.socialZone||'Non précisé')===norm(value);
    if(f.key==='mention') return operationHasTag(op,'mention',value);
    if(f.key==='performance') return operationHasTag(op,'performance',value);
    if(f.key==='mentionPerformance'){
      const [m,p]=String(value).split('\u0001');
      return operationHasTag(op,'mention',m) && operationHasTag(op,'performance',p);
    }
    if(f.key==='statusYear'){
      const [year,status]=String(value).split('\u0001');
      return String(op.createdYear)===String(year) && chronologyStatus(op)===status;
    }
    if(f.key.startsWith('transition:')){
      const [,beforeKey,afterKey]=f.key.split(':');
      const [before,after]=String(value).split('\u0001');
      return norm(transitionValue(op,beforeKey))===norm(before) && norm(transitionValue(op,afterKey))===norm(after);
    }
    if(f.key.startsWith('range:')){
      const metric=f.key.slice(6), [loRaw,hiRaw]=String(value).split('\u0001');
      const n=rawNumber(op,metric), lo=Number(loRaw), hi=Number(hiRaw);
      return n!==null && n>=lo && n<=hi;
    }
    if(f.key.startsWith('threshold:')){
      const metric=f.key.slice(10), maxKey=metric==='icEnergy'?'icEnergyMax':'icConstructionMax';
      const v=rawNumber(op,metric), max=rawNumber(op,maxKey);
      if(v===null||max===null||max===0) return false;
      return value==='under' ? v<=max : v>max;
    }
    if(f.key.startsWith('dpeGain:')){
      const type=f.key.slice(8), beforeKey=type==='energy'?'dpeEnergyBefore':'dpeGesBefore', afterKey=type==='energy'?'dpeEnergyAfter':'dpeGesAfter';
      const b='ABCDEFG'.indexOf(dpeLetter(op,beforeKey))+1, a='ABCDEFG'.indexOf(dpeLetter(op,afterKey))+1;
      if(!b||!a) return false;
      const gain=b-a;
      if(value==='2plus') return gain>=2;
      if(value==='1') return gain===1;
      if(value==='stable') return gain===0;
      if(value==='worse') return gain<0;
      return false;
    }
    if(f.key.startsWith('norm:')) return norm(normalizedValue(op,f.key.slice(5)))===norm(value);
    if(['structure','roofStructure','wallStructure','floorStructure','wallInsulation','roofInsulation','floorInsulation','windowMaterial','windowGlazing','windowShading','ventilation','cooling','heatingBefore','heatingAfter','heatingModeAfter','ecsBefore','ecsAfter'].includes(f.key)){
      return norm(op[f.key]||'Non précisé')===norm(value);
    }
    if(['dpeEnergyBefore','dpeEnergyAfter','dpeGesBefore','dpeGesAfter'].includes(f.key)) return dpeLetter(op,f.key)===String(value).toUpperCase();
    return true;
  }

  function transitionValue(op,key){
    if(['dpeEnergyBefore','dpeEnergyAfter','dpeGesBefore','dpeGesAfter'].includes(key)) return dpeLetter(op,key)||'Non précisé';
    return String(op?.[key]||'Non précisé').trim()||'Non précisé';
  }

  function normalizedTokens(value){
    return norm(value||'').replace(/[–—]/g,'-').replace(/\s+/g,' ').trim();
  }
  function normalizeInsulationFamily(value){
    const s=normalizedTokens(value);
    if(!s||s==='non precise'||s==='non renseigne') return 'Non renseigné';
    if(/sans isol|non isol|aucun isol|absence d.isol/.test(s)) return 'Sans isolant';
    const families=[];
    const add=v=>{if(!families.includes(v))families.push(v);};
    if(/laine de verre|laine de roche|laine miner|isover|isoconfort|isofacade|gr ?32|gr32|jetrock|rockwool|ecorock|rockfeu|fibrexpan|promaspray|flocage fibre/.test(s)) add('Laines minérales');
    if(/pse|eps|xps|polysty|knauf therm|sto top|doublissimo/.test(s)) add('Polystyrène');
    if(/polyure|\bpur\b|\bpir\b|efigreen/.test(s)) add('Polyuréthane / PIR');
    if(/fibre de bois|laine de bois|panneau bois/.test(s)) add('Fibre de bois');
    if(/ouate|cellulose/.test(s)) add('Ouate de cellulose');
    if(/chanvre|\blin\b|coton|textile|biosource|bio-source/.test(s)) add('Biosourcés');
    if(/verre cellulaire|foamglas/.test(s)) add('Verre cellulaire');
    if(/isolant mince|multicouche/.test(s)) add('Isolant mince');
    if(families.length>1) return 'Mixte';
    if(families.length===1) return families[0];
    return 'Autre isolant';
  }
  function normalizeStructureFamily(value){
    const s=normalizedTokens(value);
    if(!s||s==='non precise'||s==='non renseigne') return 'Non renseigné';
    const families=[]; const add=v=>{if(!families.includes(v))families.push(v);};
    if(/ossature bois|clt|bois massif/.test(s)) add('Bois / ossature bois');
    else if(/plancher bois|solive bois|charpente bois|\bbois\b/.test(s)) add('Bois / ossature bois');
    if(/parpaing|bloc beton|bloc de beton|agglo/.test(s)) add('Parpaing / bloc béton');
    else if(/beton|dalle|voile/.test(s)) add('Béton');
    if(/brique/.test(s)) add('Brique');
    if(/pierre|pise|terre crue|meuliere|moellon|bauge/.test(s)) add('Pierre / terre');
    if(/acier|metal|metallique/.test(s)) add('Métal');
    if(families.length>1) return 'Mixte';
    return families[0]||'Autre structure';
  }
  function normalizeFloorFamily(value){
    const s=normalizedTokens(value);
    if(!s||s==='non precise'||s==='non renseigne') return 'Non renseigné';
    const out=[]; const add=v=>{if(!out.includes(v))out.push(v);};
    if(/terre.?plein/.test(s)) add('Terre-plein');
    if(/vide sanitaire/.test(s)) add('Vide sanitaire');
    if(/sous.?sol|parking|cave/.test(s)) add('Sous-sol / cave / parking');
    if(/local non chauffe|hall|circulation/.test(s)) add('Local non chauffé');
    if(/bois|solive/.test(s)) add('Plancher bois');
    if(/beton|dalle|hourdis/.test(s)) add('Dalle / plancher béton');
    if(out.length>1) return 'Mixte';
    return out[0]||'Autre plancher';
  }
  function normalizeWindowMaterialFamily(value){
    const s=normalizedTokens(value);
    if(!s) return 'Non renseigné';
    const out=[]; const add=v=>{if(!out.includes(v))out.push(v);};
    if(/pvc/.test(s)) add('PVC'); if(/bois/.test(s)) add('Bois'); if(/alu|aluminium/.test(s)) add('Aluminium'); if(/acier|metal/.test(s)) add('Acier / métal');
    if(out.includes('Bois')&&out.includes('Aluminium')&&out.length===2) return 'Mixte bois / alu';
    if(out.length>1) return 'Mixte'; return out[0]||'Autre matériau';
  }
  function normalizeGlazingFamily(value){
    const s=normalizedTokens(value);
    if(!s) return 'Non renseigné';
    if(/triple|3 vitr/.test(s)) return 'Triple vitrage';
    if(/double|4\s*\/\s*\d+\s*\/\s*4|2 vitr/.test(s)) return 'Double vitrage';
    if(/simple|1 vitr/.test(s)) return 'Simple vitrage';
    return 'Autre vitrage';
  }
  function normalizeShadingFamily(value){
    const s=normalizedTokens(value);
    if(!s) return 'Non renseigné';
    if(/sans occult|sans fermeture|aucun|absence/.test(s)) return 'Sans occultation';
    const out=[]; const add=v=>{if(!out.includes(v))out.push(v);};
    if(/volet roulant/.test(s)) add('Volets roulants');
    if(/volet battant|persienne/.test(s)) add('Volets battants / persiennes');
    if(/bso|brise.?soleil/.test(s)) add('BSO / brise-soleil');
    if(/store/.test(s)) add('Stores');
    if(out.length>1) return 'Mixte'; return out[0]||'Autre occultation';
  }
  function normalizeEnergyVectorFamily(value){
    const s=normalizedTokens(value);
    if(!s) return 'Non renseigné';
    if(/rcu|reseau de chaleur|chauffage urbain|cpcu/.test(s)) return 'RCU';
    if(/pac|pompe a chaleur|thermodynam/.test(s)) return 'PAC';
    if(/gaz/.test(s)) return 'Gaz';
    if(/electri|effet joule|radiateur elect|ballon elect/.test(s)) return 'Électricité';
    if(/bois|biomasse|granule|pellet/.test(s)) return 'Bois / biomasse';
    if(/fioul|fuel/.test(s)) return 'Fioul';
    if(/solaire/.test(s)) return 'Solaire';
    if(/hybride/.test(s)) return 'Hybride';
    if(/aucun|sans/.test(s)) return 'Aucun';
    return 'Autre';
  }
  function normalizeHeatingFamily(op){
    const s=normalizedTokens(`${op.heatingModeAfter||''} ${op.heatingAfter||''}`);
    if(!s) return 'Non renseigné';
    if(/rcu|reseau de chaleur|chauffage urbain|cpcu/.test(s)) return 'Réseau de chaleur';
    if(/pac air.?air|air\/air/.test(s)) return 'PAC air / air';
    if(/pac air.?eau|air\/eau/.test(s)) return 'PAC air / eau';
    if(/pac eau.?eau|eau\/eau/.test(s)) return 'PAC eau / eau';
    if(/geotherm/.test(s)) return 'PAC géothermique';
    if(/chaudiere.*gaz|gaz.*chaudiere|condensation/.test(s)) return 'Chaudière gaz';
    if(/chaudiere.*fioul|fioul.*chaudiere/.test(s)) return 'Chaudière fioul';
    if(/chaudiere.*bois|biomasse/.test(s)) return 'Chaudière bois / biomasse';
    if(/poele|insert/.test(s)) return 'Poêle / insert bois';
    if(/radiateur elect|effet joule|convecteur/.test(s)) return 'Électrique direct';
    if(/plancher chauffant/.test(s)) return 'Plancher chauffant';
    if(/hybride/.test(s)) return 'Système hybride';
    return normalizeEnergyVectorFamily(op.heatingAfter||op.heatingModeAfter)==='PAC'?'PAC':'Autre système';
  }
  function normalizeEcsFamily(op){
    const s=normalizedTokens(`${op.ecs||''} ${op.ecsAfter||''}`);
    if(!s) return 'Non renseigné';
    if(/thermodynam|cet|chauffe.?eau thermo/.test(s)) return 'Chauffe-eau thermodynamique';
    if(/rcu|reseau de chaleur|chauffage urbain|cpcu/.test(s)) return 'Réseau de chaleur';
    if(/solaire/.test(s)) return 'Solaire thermique';
    if(/ballon.*elect|chauffe.?eau.*elect/.test(s)) return 'Ballon électrique';
    if(/chaudiere.*gaz|gaz.*chaudiere|gaz/.test(s)) return 'ECS sur chaudière gaz';
    if(/pac|pompe a chaleur/.test(s)) return 'PAC';
    if(/collectif/.test(s)) return 'Système collectif';
    if(/individuel/.test(s)) return 'Système individuel';
    if(/aucun|sans/.test(s)) return 'Aucun';
    return 'Autre système';
  }
  function normalizeVentilationFamily(value){
    const s=normalizedTokens(value);
    if(!s) return 'Non renseigné';
    if(/double flux/.test(s)) return 'VMC double flux';
    if(/hygro.*b|hygroreglable b|hygro b/.test(s)) return 'VMC simple flux Hygro B';
    if(/hygro.*a|hygroreglable a|hygro a/.test(s)) return 'VMC simple flux Hygro A';
    if(/autoregl|auto-regl/.test(s)) return 'VMC simple flux autoréglable';
    if(/naturelle/.test(s)) return 'Ventilation naturelle';
    if(/hybride/.test(s)) return 'Ventilation hybride';
    if(/simple flux|vmc/.test(s)) return 'VMC simple flux';
    if(/aucun|sans/.test(s)) return 'Sans ventilation identifiée';
    return 'Autre ventilation';
  }
  function normalizeCoolingFamily(value){
    const s=normalizedTokens(value);
    if(!s) return 'Non renseigné';
    if(/aucun|sans|non refroid/.test(s)) return 'Aucun';
    if(/vrv|drv/.test(s)) return 'VRV / DRV';
    if(/plancher rafra/.test(s)) return 'Plancher rafraîchissant';
    if(/adiab/.test(s)) return 'Adiabatique';
    if(/groupe froid/.test(s)) return 'Groupe froid';
    if(/reseau de froid|rcu froid/.test(s)) return 'Réseau de froid';
    if(/brasseur|hvls/.test(s)) return 'Brasseurs d’air / HVLS';
    if(/pac air.?air|air\/air|split|multisplit/.test(s)) return 'PAC air / air réversible';
    if(/pac air.?eau|air\/eau/.test(s)) return 'PAC air / eau réversible';
    return 'Autre refroidissement';
  }
  function normalizedValue(op,key){
    if(key==='structure'||key==='roofStructure'||key==='wallStructure') return normalizeStructureFamily(op[key]);
    if(key==='floorSolution') return normalizeFloorFamily(op.floorStructure);
    if(key==='roofInsulation'||key==='wallInsulation'||key==='floorInsulation') return normalizeInsulationFamily(op[key]);
    if(key==='windowMaterial') return normalizeWindowMaterialFamily(op.windowMaterial);
    if(key==='windowGlazing') return normalizeGlazingFamily(op.windowGlazing);
    if(key==='windowShading') return normalizeShadingFamily(op.windowShading);
    if(key==='heatingVector') return normalizeEnergyVectorFamily(op.heatingAfter);
    if(key==='heatingSystem') return normalizeHeatingFamily(op);
    if(key==='ecsVector') return normalizeEnergyVectorFamily(op.ecsAfter||op.ecs);
    if(key==='ecsSystem') return normalizeEcsFamily(op);
    if(key==='ventilationFamily') return normalizeVentilationFamily(op.ventilation);
    if(key==='coolingFamily') return normalizeCoolingFamily(op.cooling);
    return 'Non renseigné';
  }
  function globalFilterValues(key){
    const v=state.filters?.[key];
    if(Array.isArray(v)) return v;
    if(String(v??'').trim()==='') return [];
    return [String(v)];
  }
  function globalFilterHas(key,value){
    return globalFilterValues(key).some(v=>norm(v)===norm(value));
  }
  function globalFilterMatch(key,value){
    const selected=globalFilterValues(key);
    if(!selected.length) return true;
    return selected.some(v=>norm(v)===norm(value));
  }
  function filterOperationList(source,options={}){
    const q=norm(state.search), ignoreCrossKey=options.ignoreCrossKey||'', ignoreCrossKeys=new Set([...(options.ignoreCrossKeys||[]),...(ignoreCrossKey?[ignoreCrossKey]:[])]);
    return (source||[]).filter(o=>{
      if(!globalFilterMatch('year',String(o.year))) return false;
      if(!globalFilterMatch('createdYear',String(o.createdYear))) return false;
      if(!globalFilterMatch('referential',o.referential)) return false;
      if(!globalFilterMatch('moaGroup',o.moaGroup||'Non précisé')) return false;
      if(!globalFilterMatch('status',o.status)) return false;
      if(!globalFilterMatch('moa',o.moa)) return false;
      if(!globalFilterMatch('region',operationRegion(o))) return false;
      if(!globalFilterMatch('department',String(o.department))) return false;
      if(!globalFilterMatch('profile',o.profile||'Non précisé')) return false;
      if(!globalFilterMatch('socialZone',o.socialZone||'Non précisé')) return false;
      if(q && ![o.code,o.name,o.moa,o.moaGroup,o.referential,o.department,o.city,o.nature,o.rawStatus,o.mentions,o.performance,o.tags].some(v=>norm(v).includes(q))) return false;
      for(const cf of state.crossFilters){
        if(ignoreCrossKeys.has(cf.key)) continue;
        if(!matchesCross(o,cf)) return false;
      }
      return true;
    });
  }
  function filteredOperations(options={}){ return filterOperationList(baseOperations(),options); }
  function filteredTechnicalOperations(options={}){ return filterOperationList(baseTechnicalOperations(),options); }
  function filteredExcludedOperations(options={}){ return filterOperationList(excludedOperations(),options); }

  function countBy(ops,getter){
    const map=new Map();
    ops.forEach(o=>{
      const label=String(getter(o)||'Non précisé').trim() || 'Non précisé';
      const key=norm(label);
      if(!map.has(key)) map.set(key,{name:label,value:0,dwellings:0,buildings:0});
      const x=map.get(key); x.value++; x.dwellings+=Number(o.dwellings)||0; x.buildings+=Number(o.buildings)||0;
    });
    return [...map.values()].sort((a,b)=>b.value-a.value || a.name.localeCompare(b.name,'fr'));
  }

  function paged(items,page=1,pageSize=15){
    const total=Math.max(0,items.length),pages=Math.max(1,Math.ceil(total/pageSize)),safe=Math.max(1,Math.min(pages,Number(page)||1)),start=(safe-1)*pageSize;
    return {items:items.slice(start,start+pageSize),page:safe,pages,total,start,end:Math.min(total,start+pageSize)};
  }
  function paginationHtml(kind,model){
    if(model.pages<=1)return `<div class="obs-table-pager obs-table-pager-single"><span>${fmt(model.total)} ligne${model.total>1?'s':''}</span></div>`;
    return `<div class="obs-table-pager obs-table-pager-simple"><div><button type="button" data-table-page="${kind}" data-page="${Math.max(1,model.page-1)}" ${model.page<=1?'disabled':''} aria-label="Page précédente">‹ Précédent</button><span>Page ${model.page} / ${model.pages}</span><button type="button" data-table-page="${kind}" data-page="${Math.min(model.pages,model.page+1)}" ${model.page>=model.pages?'disabled':''} aria-label="Page suivante">Suivant ›</button></div></div>`;
  }
  function tableSearchHtml(kind,value,placeholder){
    return `<label class="obs-table-search"><span>⌕</span><input type="search" data-table-search="${kind}" value="${attr(value||'')}" placeholder="${attr(placeholder)}" autocomplete="off"></label>`;
  }

  function tableViewToggle(kind,view,modes=['list','bar']){
    const labels={list:'Liste',bar:'Barres',histogram:'Histogramme',tiles:'Tuiles',map:'Carte',matrix:'Matrice'};
    const icons={list:'☷',bar:'▥',histogram:'▤',tiles:'▦',map:'⌖',matrix:'▦'};
    return `<div class="obs-view-toggle obs-table-view-toggle" role="group" aria-label="Mode d’affichage">${modes.map(m=>`<button type="button" class="${view===m?'is-active':''}" data-table-view="${attr(kind)}" data-view="${attr(m)}" title="${attr(labels[m]||m)}">${icons[m]||'●'}</button>`).join('')}</div>`;
  }
  function tableBarRows(items,{name=x=>x.name,value=x=>x.value,secondary=x=>'',crossKey='',crossValue=x=>x.name,crossLabel=x=>x.name,total=0}={}){
    if(!items.length)return '<div class="obs-empty">Aucune donnée disponible.</div>';
    const max=Math.max(1,...items.map(x=>Number(value(x))||0)),base=Number(total)||items.reduce((s,x)=>s+(Number(value(x))||0),0)||1;
    return `<div class="obs-table-chart-bars">${items.map((x,i)=>{const v=Number(value(x))||0,cv=crossValue(x),cl=crossLabel(x);return `<button type="button" class="obs-table-chart-row ${crossKey&&activeCross(crossKey,cv)?'is-active':''}" ${crossKey?crossAttrs(crossKey,cv,cl):''}><span class="obs-table-chart-rank">${i+1}</span><span class="obs-table-chart-label"><b>${esc(name(x))}</b><small>${esc(secondary(x)||'')}</small></span><span class="obs-table-chart-track"><i style="width:${Math.max(2,100*v/max).toFixed(1)}%"></i></span><strong>${fmt(v)}<small>${fmt(pct(v,base),1)} %</small></strong></button>`}).join('')}</div>`;
  }

  function activeCross(key,value){ return state.crossFilters.some(f=>f.key===key && String(f.value)===String(value)); }
  function crossAttrs(key,value,label){
    return `data-cross-key="${attr(key)}" data-cross-value="${attr(encodeURIComponent(String(value)))}" data-cross-label="${attr(encodeURIComponent(String(label||value)))}" data-cross-encoded="1"`;
  }
  function setCrossFilter(key,value,label){
    const idx=state.crossFilters.findIndex(f=>f.key===key);
    if(idx>=0 && String(state.crossFilters[idx].value)===String(value)) state.crossFilters.splice(idx,1);
    else {
      const item={key:String(key),value:String(value),label:String(label||value)};
      if(idx>=0) state.crossFilters.splice(idx,1,item); else state.crossFilters.push(item);
    }
    renderPage();
  }


  function renderFilterDependencies(){
    if(!filterDependenciesEl)return;
    const groups=globalFilterValues('moaGroup');
    if(!groups.length){filterDependenciesEl.innerHTML='';filterDependenciesEl.hidden=true;return;}
    const base=baseOperations();
    filterDependenciesEl.hidden=false;
    filterDependenciesEl.innerHTML=groups.map(group=>{const ops=base.filter(o=>norm(o.moaGroup||'Non précisé')===norm(group));const moas=uniq(ops.map(o=>o.moa).filter(Boolean));return `<span class="obs-dependency-pill"><b>${esc(group)}</b><i>${fmt(moas.length)} MOA</i><i>${fmt(ops.length)} projets</i></span>`;}).join('');
  }

  function pageHead(page, right=''){
    const [title,sub]=pageMeta[page]||pageMeta.overview;
    const total=filteredOperations().length;
    return `<div class="obs-page-head"><div><h1>${esc(title)}</h1><p>${esc(sub)}</p></div>${right||`<div class="obs-selection-note">${fmt(total)} projet${total>1?'s':''} sélectionné${total>1?'s':''}</div>`}</div>`;
  }

  function analyticsToolbar(){
    const ops=filteredOperations(), chips=state.crossFilters;
    return `<div class="obs-analytics-toolbar ${chips.length?'has-filters':''}">
      <div class="obs-analytics-copy"><span>ANALYSE CROISÉE</span><b>${chips.length?`${chips.length} filtre${chips.length>1?'s':''} analytique${chips.length>1?'s':''}`:'Clique sur un élément pour croiser les données'}</b><small>${privacy()?.enabled?.()?'Mode anonymisé actif · identités et adresses exactes masquées.':'Les sélections restent actives quand tu changes de dashboard.'}</small></div>
      <div class="obs-cross-chips">${chips.length?chips.map((f,i)=>`<button type="button" class="obs-cross-chip" data-remove-cross="${i}" title="Retirer ce filtre"><span>${esc(f.label)}</span><b>×</b></button>`).join(''):'<span class="obs-cross-empty">Aucun filtre analytique actif</span>'}</div>
      <div class="obs-analytics-actions"><button type="button" class="obs-drill-btn" data-drilldown-current="1">Voir les ${fmt(ops.length)} projets →</button>${chips.length?'<button type="button" class="obs-clear-cross" data-clear-cross="1">Effacer l’analyse</button>':''}</div>
    </div>`;
  }

  function visualIconFor(label){
    const l=norm(label||'');
    if(l.includes('logement')) return '⌂';
    if(l.includes('batiment')) return '▥';
    if(l.includes('maitre')||l.includes('moa')) return '◎';
    if(l.includes('operation')) return '▤';
    if(l.includes('energie')||l.includes('cep')) return 'ϟ';
    if(l.includes('construction')) return '▦';
    if(l.includes('carbone')||l.includes('ic ')) return '◒';
    if(l.includes('region')||l.includes('departement')||l.includes('territoire')) return '⌖';
    if(l.includes('performance')||l.includes('mention')||l.includes('label')) return '◆';
    if(l.includes('conforme')||l.includes('seuil')) return '✓';
    if(l.includes('annule')) return '×';
    return '●';
  }

  function kpiGrid(items){
    return `<div class="obs-grid-kpi">${items.map(item=>`<article class="obs-kpi obs-kpi-visual ${item.className||''}" data-audit-label="${attr(item.label)}" data-audit-metric="${attr(item.metric||'')}" ${item.crossKey?crossAttrs(item.crossKey,item.crossValue,item.crossLabel||item.label):''}><i class="obs-kpi-visual-icon" aria-hidden="true">${visualIconFor(item.label)}</i><span>${esc(item.label)}</span><strong>${item.raw?item.value:esc(item.value)}</strong><small>${esc(item.note||'')}${item.sample!==undefined?lowSample(item.sample):''}</small><em class="obs-kpi-visual-ring" aria-hidden="true"></em></article>`).join('')}</div>`;
  }
  function kpis(ops){
    const grid=kpiGrid([
      {label:'Projets',value:fmt(ops.length),note:'codes internes uniques',metric:'code'},
      {label:'Logements',value:fmt(sum(ops,o=>o.dwellings)),note:'total déclaré',metric:'dwellings'},
      {label:'Bâtiments',value:fmt(sum(ops,o=>o.buildings)),note:'total déclaré',metric:'buildings'},
      {label:'Maîtres d’ouvrage',value:fmt(uniq(ops.map(o=>o.moa)).length),note:'acteurs distincts',metric:'moa'}
    ]);
    return `<section class="obs-kpi-summary-group" aria-label="Chiffres clés de la sélection"><button type="button" class="obs-kpi-group-pres-btn" data-add-presentation="1" title="Ajouter les 4 chiffres clés à la présentation" aria-label="Ajouter les 4 chiffres clés à la présentation">▣</button>${grid}</section>`;
  }

  function crossBars(items,{maxItems=10,key='',labelPrefix='',valueKey='name',totalOverride=0,rankOffset=0}={}){
    const top=items.slice(0,maxItems), max=Math.max(1,...top.map(x=>x.value)), total=Number(totalOverride)||items.reduce((s,x)=>s+(Number(x.value)||0),0)||1;
    if(!top.length) return '<div class="obs-empty">Aucune donnée disponible pour cette sélection.</div>';
    return `<div class="obs-bars obs-bars-visual">${top.map((item,index)=>{
      const value=item[valueKey], label=labelPrefix?`${labelPrefix} : ${item.name}`:item.name, fixed=key?crossKeyValueFix(key,value,label):null, active=key&&fixed&&activeCross(fixed.key,fixed.value), share=pct(item.value,total);
      return `<button class="obs-bar-row obs-bar-row-visual ${active?'is-active':''}" type="button" ${key?crossAttrs(key,value,label):''}><span class="obs-bar-label"><i>${rankOffset+index+1}</i><b title="${attr(item.name)}">${esc(item.name)}</b></span><span class="obs-bar-track"><i class="obs-bar-fill" style="width:${Math.max(2,100*item.value/max).toFixed(1)}%"></i></span><strong><b>${fmt(item.value)}</b><small>${fmt(share,1)} %</small></strong></button>`;
    }).join('')}</div>`;
  }
  function pagedCrossBars(items,{pageKey='territorySummaryPage',pageKind='territory-summary',pageSize=15,key='',labelPrefix='',valueKey='name'}={}){
    const model=paged(items,state[pageKey],pageSize); state[pageKey]=model.page;
    const total=items.reduce((s,x)=>s+(Number(x.value)||0),0)||1;
    return `${crossBars(model.items,{maxItems:pageSize,key,labelPrefix,valueKey,totalOverride:total,rankOffset:model.start})}${paginationHtml(pageKind,model)}`;
  }
  function topBars(items,maxItems=8,field='',valueKey='name'){
    const top=items.slice(0,maxItems), max=Math.max(1,...top.map(x=>x.value)), total=items.reduce((s,x)=>s+(Number(x.value)||0),0)||1;
    if(!top.length) return '<div class="obs-empty">Aucune donnée disponible pour cette sélection.</div>';
    return `<div class="obs-bars obs-bars-visual">${top.map((item,index)=>`<button class="obs-bar-row obs-bar-row-visual" type="button" ${field?`data-quick-filter="${attr(field)}" data-quick-value="${attr(item[valueKey])}"`:''}><span class="obs-bar-label"><i>${index+1}</i><b title="${attr(item.name)}">${esc(item.name)}</b></span><span class="obs-bar-track"><i class="obs-bar-fill" style="width:${Math.max(2,100*item.value/max).toFixed(1)}%"></i></span><strong><b>${fmt(item.value)}</b><small>${fmt(pct(item.value,total),1)} %</small></strong></button>`).join('')}</div>`;
  }

  function evolutionSvg(ops,showTotal=true){
    const years=uniq(ops.map(o=>o.year).filter(y=>/^\d{4}$/.test(String(y)))).sort((a,b)=>Number(a)-Number(b));
    const refs=uniq(ops.map(o=>o.referential||'Non précisé'));
    if(!years.length) return '<div class="obs-empty">Aucune année exploitable dans la sélection.</div>';
    if(!refs.length) return '<div class="obs-empty">Aucun référentiel exploitable dans la sélection.</div>';
    const palette=['#0B6B43','#FF7A24','#2376D2','#7B4CC7','#E0A11B','#C85050','#3AA66A','#2A8A91','#B45C8A','#65707A','#A36D2D','#425CB5'];
    const series=refs.map((ref,idx)=>({ref,color:palette[idx%palette.length],values:years.map(year=>ops.filter(o=>String(o.year)===String(year)&&String(o.referential||'Non précisé')===String(ref)).length)})).sort((a,b)=>b.values.reduce((s,v)=>s+v,0)-a.values.reduce((s,v)=>s+v,0));
    const totals=years.map(year=>ops.filter(o=>String(o.year)===String(year)).length);
    const W=820,H=300,pad={l:48,r:24,t:28,b:42}, max=Math.max(1,...series.flatMap(s=>s.values),...(showTotal?totals:[]));
    const x=i=>years.length===1?W/2:pad.l+i*(W-pad.l-pad.r)/(years.length-1);
    const y=v=>H-pad.b-(v/max)*(H-pad.t-pad.b);
    const grid=[0,.25,.5,.75,1].map(k=>{const yy=y(max*k);return `<line class="obs-gridline" x1="${pad.l}" y1="${yy}" x2="${W-pad.r}" y2="${yy}"/><text class="obs-axis-label" x="4" y="${yy+4}">${fmt(max*k)}</text>`}).join('');
    const defs=`<defs>${series.map((s,i)=>`<linearGradient id="obsEvoGrad${i}" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="${s.color}" stop-opacity=".16"/><stop offset="100%" stop-color="${s.color}" stop-opacity="0"/></linearGradient>`).join('')}<linearGradient id="obsTotalGrad" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#06402B" stop-opacity=".12"/><stop offset="100%" stop-color="#06402B" stop-opacity="0"/></linearGradient></defs>`;
    const paths=series.map((s,si)=>{
      const points=s.values.map((v,i)=>`${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
      const area=`${x(0).toFixed(1)},${(H-pad.b).toFixed(1)} ${points} ${x(years.length-1).toFixed(1)},${(H-pad.b).toFixed(1)}`;
      const showLabels=series.length<=5 || si<3;
      return `<g class="obs-evolution-series"><polygon points="${area}" fill="url(#obsEvoGrad${si})"/><polyline fill="none" stroke="${s.color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" points="${points}"/>${s.values.map((v,i)=>`<g><circle class="obs-evolution-ref-dot" data-quick-filter="year" data-quick-value="${attr(years[i])}" cx="${x(i)}" cy="${y(v)}" r="4.8" fill="${s.color}"><title>${esc(s.ref)} · ${esc(years[i])} : ${fmt(v)} projet${v>1?'s':''}</title></circle>${showLabels&&v?`<text class="obs-evolution-value" x="${x(i)}" y="${Math.max(12,y(v)-9)}" text-anchor="middle" fill="${s.color}">${fmt(v)}</text>`:''}</g>`).join('')}</g>`;
    }).join('');
    const totalPts=totals.map((v,i)=>`${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' '), totalArea=`${x(0).toFixed(1)},${H-pad.b} ${totalPts} ${x(years.length-1).toFixed(1)},${H-pad.b}`;
    const totalPath=showTotal?`<g class="obs-evolution-total"><polygon points="${totalArea}" fill="url(#obsTotalGrad)"/><polyline fill="none" stroke="#06402B" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" points="${totalPts}"/>${totals.map((v,i)=>`<circle cx="${x(i)}" cy="${y(v)}" r="5.5" fill="#06402B" stroke="#fff" stroke-width="2"><title>Total · ${esc(years[i])} : ${fmt(v)}</title></circle><text class="obs-evolution-total-value" x="${x(i)}" y="${Math.max(13,y(v)-12)}" text-anchor="middle">${fmt(v)}</text>`).join('')}</g>`:'';
    const labels=years.map((yr,i)=>`<text class="obs-axis-label" x="${x(i)}" y="${H-11}" text-anchor="middle">${esc(yr)}</text>`).join('');
    const legend=`<div class="obs-evolution-legend obs-evolution-legend-visual">${series.map(s=>`<button type="button" data-quick-filter="referential" data-quick-value="${attr(s.ref)}" title="Filtrer sur ${attr(s.ref)}"><i style="background:${s.color}"></i><span>${esc(s.ref)}</span></button>`).join('')}<button type="button" class="obs-evolution-total-legend ${showTotal?'is-active':'is-muted'}" data-overview-total-toggle="1" aria-pressed="${showTotal?'true':'false'}" title="${showTotal?'Masquer':'Afficher'} le Total général"><i></i><span>Total général</span></button></div>`;
    return `<div class="obs-evolution-multi obs-evolution-visual"><svg class="obs-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Évolution des projets par année et par référentiel">${defs}${grid}${paths}${totalPath}${labels}</svg>${legend}</div>`;
  }

  function tunnel(ops,{analytic=false}={}){
    const a=engine.aggregateTunnel(ops), order=PROGRESS_ORDER;
    const icons={proposal:'✎',notStarted:'▤',incomplete:'◔',complete:'◕',planned:'▣',analysis:'⌕',visit:'⌂',compliant:'✓'};
    return `<div class="obs-tunnel-scroll"><div class="obs-tunnel obs-tunnel-visual obs-tunnel-oneline" style="--obs-tunnel-steps:${order.length}">${order.map((key,index)=>{const v=a.counts[key]||0, active=analytic&&activeCross('status',key), share=pct(v,ops.length);return `<button class="obs-tunnel-step ${active?'is-active':''}" type="button" ${analytic?crossAttrs('status',key,STATUS_LABELS[key]):`data-quick-filter="status" data-quick-value="${key}"`} style="--obs-step-color:${STATUS_COLORS[key]}"><i class="obs-tunnel-icon">${icons[key]||'●'}</i><span>${esc(STATUS_LABELS[key])}</span><strong>${fmt(v)}</strong><small>${fmt(share,1)} %</small><em>${index+1}</em></button>`}).join('')}</div></div>${tunnelUnknownNote(a,analytic)}`;
  }
  // V6.13.6 : les projets sans avancement exploitable restent visibles et listables.
  function tunnelUnknownNote(a,analytic){
    const unk=Number(a?.unknown)||0;if(!unk)return '';
    const btn=analytic?`<button type="button" class="obs-link-btn" ${crossAttrs('status','unknown','Non renseigné')}>afficher la liste</button>`:`<button type="button" class="obs-link-btn" data-quick-filter="status" data-quick-value="unknown">afficher la liste</button>`;
    return `<p class="obs-tunnel-note"><b>${fmt(unk)}</b> projet${unk>1?'s':''} sans avancement exploitable (colonne BC vide, ou valeur non reconnue) · ${btn}</p>`;
  }

  function tags(ops,kind,max=12){
    const items=engine.aggregateTags(ops,kind).slice(0,max);
    if(!items.length) return '<div class="obs-empty">Aucune information renseignée.</div>';
    return `<div class="obs-tags">${items.map(x=>`<button class="obs-tag" type="button" data-tag-filter="${kind}" data-tag-value="${attr(x.name)}">${esc(x.name)} <b>${fmt(x.value)}</b></button>`).join('')}</div>`;
  }

  function compactViewToggle(kind,view,modes=['list','bar']){
    const labels={list:'Liste',bar:'Barres',treemap:'Treemap'};
    return `<div class="obs-view-toggle" role="group" aria-label="Mode d’affichage">${modes.map(m=>`<button type="button" class="${view===m?'is-active':''}" data-overview-view="${kind}" data-view="${m}" title="${labels[m]}">${m==='list'?'☷':m==='bar'?'▥':'▦'}</button>`).join('')}</div>`;
  }
  function tagTreemap(items,kind,max=15){
    const top=items.slice(0,max),total=top.reduce((a,x)=>a+x.value,0)||1;
    if(!top.length)return '<div class="obs-empty">Aucune information renseignée.</div>';
    return `<div class="obs-mini-treemap">${top.map((x,i)=>`<button type="button" data-tag-filter="${kind}" data-tag-value="${attr(x.name)}" style="--share:${Math.max(1,100*x.value/total)};--rank:${i}"><span>${escLines(x.name)}</span><b>${fmt(x.value)}</b></button>`).join('')}</div>`;
  }
  function overviewTagList(items,kind,pageKey){
    const model=paged(items,state[pageKey],15);state[pageKey]=model.page;
    return `<div class="obs-compact-list">${model.items.map(x=>`<button type="button" class="obs-compact-list-row" data-tag-filter="${kind}" data-tag-value="${attr(x.name)}"><span title="${attr(x.name)}">${escLines(x.name)}</span><b>${fmt(x.value)}</b></button>`).join('')}</div>${paginationHtml(`overview-${kind}`,model)}`;
  }
  function overviewTagWidget(ops,kind){
    const items=engine.aggregateTags(ops,kind),view=kind==='mention'?state.overviewMentionView:state.overviewPerformanceView,pageKey=kind==='mention'?'overviewMentionPage':'overviewPerformancePage';
    if(!items.length)return '<div class="obs-empty">Aucune information renseignée.</div>';
    if(view==='bar'){
      const top=items.slice(0,5),mx=Math.max(1,...top.map(x=>x.value)),total=items.reduce((s,x)=>s+(Number(x.value)||0),0)||1;
      return `<div class="obs-bars obs-bars-visual">${top.map((x,index)=>`<button class="obs-bar-row obs-bar-row-visual" type="button" data-tag-filter="${kind}" data-tag-value="${attr(x.name)}"><span class="obs-bar-label"><i>${index+1}</i><b title="${attr(x.name)}">${escLines(x.name)}</b></span><span class="obs-bar-track"><i class="obs-bar-fill" style="width:${Math.max(2,100*x.value/mx).toFixed(1)}%"></i></span><strong><b>${fmt(x.value)}</b><small>${fmt(pct(x.value,total),1)} %</small></strong></button>`).join('')}</div>`;
    }
    if(view==='treemap')return tagTreemap(items,kind,15);
    return overviewTagList(items,kind,pageKey);
  }

  function lostAbandonedNotice(){
    const excluded=filteredExcludedOperations();
    if(!excluded.length)return '';
    const nonStarted=excluded.filter(o=>o.status==='notStarted').length;
    const byStage=countBy(excluded,o=>operationAffairStage(o)||'Perdu / abandonné').slice(0,4);
    const byYear=countBy(excluded,o=>String(o.createdYear||'Année de création non renseignée')).sort((a,b)=>{const an=Number(a.name),bn=Number(b.name);if(Number.isFinite(an)&&Number.isFinite(bn))return an-bn;return String(a.name).localeCompare(String(b.name),'fr');}).slice(0,8);
    const stageText=byStage.map(x=>`${x.name} : ${fmt(x.value)}`).join(' · ');
    const yearText=byYear.map(x=>`${x.name} : ${fmt(x.value)}`).join(' · ');
    return `<div class="obs-excluded-projects"><div><i>!</i><strong>${fmt(excluded.length)} projet${excluded.length>1?'s':''} perdu${excluded.length>1?'s':''} / abandonné${excluded.length>1?'s':''} exclu${excluded.length>1?'s':''} des statistiques</strong><span>Détection via <b>Statut</b>${nonStarted?` · dont ${fmt(nonStarted)} classé${nonStarted>1?'s':''} « Non démarré » côté évaluation`:''}.</span></div><small>${esc(stageText)}${yearText?` · ${esc(yearText)}`:''}</small></div>`;
  }

  function renderOverview(){
    const ops=filteredOperations();
    const deps=countBy(ops,o=>departmentName(o.department));
    const moas=countBy(ops,o=>o.moa);
    return `${pageHead('overview')}${kpis(ops)}
      <div class="obs-grid-2">
        <article class="obs-card"><div class="obs-card-head"><div><span>DYNAMIQUE</span><h2>Évolution des projets</h2></div><div class="obs-evolution-head-tools"><small>Une courbe par référentiel · clique sur une année ou la légende pour filtrer · clique sur « Total général » dans la légende pour l’afficher/masquer</small></div></div><div class="obs-chart">${evolutionSvg(ops,state.overviewShowTotal)}</div>${lostAbandonedNotice()}</article>
        <article class="obs-card"><div class="obs-card-head"><div><span>TERRITOIRES</span><h2>Départements les plus représentés</h2></div><button class="obs-card-action" data-page-link="territories">Explorer</button></div>${topBars(deps,8,'departmentName')}</article>
      </div>
      <article class="obs-card" style="margin-bottom:12px"><div class="obs-card-head"><div><span>CERTIFICATION</span><h2>Avancement</h2></div><button class="obs-card-action" data-page-link="certification">Voir le détail</button></div>${tunnel(ops)}</article>
      <div class="obs-grid-3">
        <article class="obs-card"><div class="obs-card-head"><div><span>ACTEURS</span><h2>Principaux maîtres d’ouvrage</h2></div><button class="obs-card-action" data-page-link="stakeholders">Tous</button></div>${topBars(moas,7,'moa')}</article>
        <article class="obs-card"><div class="obs-card-head"><div><span>MENTIONS</span><h2>Labels et mentions</h2></div>${compactViewToggle('mention',state.overviewMentionView,['list','bar','treemap'])}</div>${overviewTagWidget(ops,'mention')}</article>
        <article class="obs-card"><div class="obs-card-head"><div><span>PERFORMANCES</span><h2>Niveaux déclarés</h2></div>${compactViewToggle('performance',state.overviewPerformanceView,['list','bar','treemap'])}</div>${overviewTagWidget(ops,'performance')}</article>
      </div>`;
  }

  function renderTerritories(){
    const ops=filteredOperations();
    const regionUniverse=filteredOperations({ignoreCrossKey:'region'}), depUniverse=filteredOperations({ignoreCrossKey:'department'});
    const regions=countBy(regionUniverse,o=>operationRegion(o));
    const deps=countBy(depUniverse,o=>departmentName(o.department));
    const groupingRegion=!state.mapFocusRegion&&state.mapOperationGrouping==='region';
    const summaryItems=groupingRegion?regions:deps;
    const summaryKey=groupingRegion?'region':'departmentNameProxy';
    const summaryLabel=groupingRegion?'Région':'Département';
    const layer=(key,label,icon)=>`<button type="button" class="obs-layer-toggle ${state.mapLayers[key]?'is-active':''}" data-map-layer="${key}"><span>${icon}</span>${label}</button>`;
    return `${pageHead('territories')}${analyticsToolbar()}${kpiGrid([
      {label:'Opérations',value:fmt(ops.length),note:'population croisée'},
      {label:'Logements',value:fmt(sum(ops,o=>o.dwellings)),note:'total sélectionné'},
      {label:'Régions',value:fmt(uniq(ops.map(o=>operationRegion(o))).length),note:'territoires représentés'},
      {label:'Départements',value:fmt(uniq(ops.map(o=>o.department)).length),note:'départements représentés'}
    ])}
    <div class="obs-grid-map obs-grid-map-focus">
      <article class="obs-card obs-map-card"><div class="obs-card-head obs-map-head"><div><span>CARTE TERRITORIALE</span><h2>Répartition des projets</h2></div><div class="obs-map-head-actions"><small>${state.mapFocusRegion?`Région sélectionnée : ${esc(state.mapFocusRegion)} · répartition départementale`:'Clique sur une région pour la détailler'}</small>${state.mapFocusRegion?'<button type="button" class="obs-card-action" data-map-reset-region="1">← Retour France</button>':''}<button type="button" class="obs-card-action obs-map-fullscreen-btn" data-map-fullscreen="1">⛶ Plein écran</button></div></div>
        <div class="obs-map-basemapbar"><b>Fond</b><button type="button" class="obs-basemap-toggle ${state.mapBasemap==='legacy'?'is-active':''}" data-map-basemap="legacy">Neutre</button><button type="button" class="obs-basemap-toggle ${state.mapBasemap==='ign'?'is-active':''}" data-map-basemap="ign">IGN</button><button type="button" class="obs-basemap-toggle ${state.mapBasemap==='osm'?'is-active':''}" data-map-basemap="osm">OSM</button><label class="obs-map-group-switch ${state.mapFocusRegion?'is-locked':''}"><span>Département</span><input type="checkbox" data-map-grouping-toggle="1" ${groupingRegion?'checked':''} ${state.mapFocusRegion?'disabled':''}><i></i><span>Région</span></label></div>
        <div class="obs-map-layerbar"><b>Couches</b>${layer('regions','Régions','▱')}${layer('departments','Départements','▦')}${layer('intercommunalities','Intercommunalités','◎')}${layer('operations',`Opérations · ${groupingRegion?'région':'département'}`,'●')}${layer('zoning','Zonage 1·2·3','◫')}</div>
        <div id="obsTerritoryMap" class="obs-map-stage"><div class="obs-map-loading">Chargement du fond de carte…</div></div>
      </article>
      <article class="obs-card obs-territory-summary"><div class="obs-card-head"><div><span>${groupingRegion?'RÉGIONS':'DÉPARTEMENTS'}</span><h2>${state.mapFocusRegion?`Départements de ${esc(state.mapFocusRegion)}`:(groupingRegion?'Régions':'Départements')+' les plus représentés'}</h2></div><small>15 lignes maximum</small></div>${pagedCrossBars(summaryItems,{pageKey:'territorySummaryPage',pageKind:'territory-summary',pageSize:15,key:summaryKey,labelPrefix:summaryLabel})}</article>
    </div>
    <article class="obs-card"><div class="obs-card-head"><div><span>DRILL-DOWN TERRITORIAL</span><h2>${state.mapFocusRegion?`Départements de ${esc(state.mapFocusRegion)}`:'Départements de la sélection'}</h2></div><div class="obs-card-head-tools"><small>15 lignes par page</small>${tableViewToggle('territory',state.territoryTableView,['list','bar'])}</div></div>${territoryTable(ops)}</article>`;
  }

  function territoryTable(ops){
    const byName=new Map();
    ops.forEach(o=>{
      const name=departmentName(o.department);
      if(!byName.has(name)) byName.set(name,{code:o.department,region:operationRegion(o),ops:0,dwellings:0,buildings:0,moas:new Set()});
      const x=byName.get(name);x.ops++;x.dwellings+=Number(o.dwellings)||0;x.buildings+=Number(o.buildings)||0;x.moas.add(o.moa);
    });
    const rows=[...byName.entries()].sort((a,b)=>b[1].ops-a[1].ops),model=paged(rows,state.territoryPage,15);state.territoryPage=model.page;
    if(state.territoryTableView==='bar'){
      const total=rows.reduce((s,[,x])=>s+x.ops,0)||1;
      return `${tableBarRows(model.items,{name:([name])=>name,value:([,x])=>x.ops,secondary:([,x])=>`${x.region} · ${fmt(x.dwellings)} lgts · ${fmt(x.buildings)} bât.`,crossKey:'department',crossValue:([,x])=>x.code,crossLabel:([name])=>`Département : ${name}`,total})}${paginationHtml('territory',model)}`;
    }
    return `<div class="obs-table-wrap"><table class="obs-table"><thead><tr><th>Département</th><th>Région</th><th>Opérations</th><th>Logements</th><th>Bâtiments</th><th>MOA</th></tr></thead><tbody>${model.items.map(([name,x])=>`<tr class="obs-cross-row ${activeCross('department',x.code)?'is-active':''}" ${crossAttrs('department',x.code,`Département : ${name}`)}><td><strong>${esc(name)}</strong></td><td>${esc(x.region)}</td><td>${fmt(x.ops)}</td><td>${fmt(x.dwellings)}</td><td>${fmt(x.buildings)}</td><td>${fmt(x.moas.size)}</td></tr>`).join('')}</tbody></table>${paginationHtml('territory',model)}</div>`;
  }


  function renderStakeholders(){
    const ops=filteredOperations(), moaUniverse=filteredOperations({ignoreCrossKey:'moa'}), typeUniverse=filteredOperations({ignoreCrossKey:'moaType'}), statusUniverse=filteredOperations({ignoreCrossKey:'status'});
    const moas=engine.aggregateMoa(moaUniverse).sort((a,b)=>b.value-a.value), types=countBy(typeUniverse,o=>o.moaType||'Non précisé'), statuses=countBy(statusUniverse,o=>STATUS_LABELS[o.status]||o.rawStatus||o.status);
    const distinct=uniq(ops.map(o=>o.moa)).length, top=engine.aggregateMoa(ops).sort((a,b)=>b.value-a.value)[0], avg=distinct?ops.length/distinct:0;
    return `${pageHead('stakeholders')}${analyticsToolbar()}${kpiGrid([
      {label:'Maîtres d’ouvrage',value:fmt(distinct),note:'acteurs distincts'},
      {label:'Opérations / MOA',value:fmt(avg,1),note:'moyenne sur la sélection'},
      {label:'Part du 1er portefeuille',value:top?`${fmt(pct(top.value,ops.length),1)} %`:'—',note:top?.name||'aucune donnée'},
      {label:'Logements',value:fmt(sum(ops,o=>o.dwellings)),note:'portefeuille sélectionné'}
    ])}
    <div class="obs-stakeholder-top">
      <article class="obs-card obs-portfolio-card"><div class="obs-card-head"><div><span>PORTEFEUILLES</span><h2>Maîtres d’ouvrage</h2></div><div class="obs-card-head-tools"><small>15 par page</small>${tableViewToggle('moa',state.moaTableView,['list','bar'])}</div></div>${moaTable(moas,ops)}</article>
      <article class="obs-card obs-family-pie-card"><div class="obs-card-head"><div><span>FAMILLES</span><h2>Familles de maîtres d’ouvrage</h2></div><small>Groupe principal · Secteur d’activité</small></div>${pieDistribution(types,{key:'moaType',labelPrefix:'Famille MOA',maxItems:12})}</article>
    </div>
    <article class="obs-card obs-stakeholder-progress"><div class="obs-card-head"><div><span>AVANCEMENT</span><h2>Statuts des portefeuilles</h2></div><small>Toute la largeur pour comparer les étapes</small></div>${crossBars(statuses,{maxItems:15,key:'statusLabelProxy',labelPrefix:'Avancement'})}</article>`;
  }

  function moaTable(moas,currentOps){
    const currentByMoa=new Map();
    currentOps.forEach(o=>{const k=norm(o.moa);if(!currentByMoa.has(k)){currentByMoa.set(k,{total:0,compliant:0});}const x=currentByMoa.get(k);x.total++;if(o.status==='compliant')x.compliant++;});
    const model=paged(moas,state.moaPage,15);state.moaPage=model.page;
    if(state.moaTableView==='bar'){
      const total=moas.reduce((s,x)=>s+(Number(x.value)||0),0)||1;
      return `${tableBarRows(model.items,{name:x=>x.name,value:x=>x.value,secondary:x=>`${fmt(x.dwellings)} lgts · ${fmt(x.buildings)} bât.`,crossKey:'moa',crossValue:x=>x.name,crossLabel:x=>`MOA : ${x.name}`,total})}${paginationHtml('moa',model)}<div class="obs-table-note">Classement sur le nombre de projets du portefeuille.</div>`;
    }
    return `<div class="obs-table-wrap obs-table-compact"><table class="obs-table"><thead><tr><th>Maître d’ouvrage</th><th>Opérations</th><th>Logements</th><th>Bâtiments</th><th>Taux conforme*</th></tr></thead><tbody>${model.items.map(x=>{const c=currentByMoa.get(norm(x.name))||{total:x.value,compliant:0};return `<tr class="obs-cross-row ${activeCross('moa',x.name)?'is-active':''}" ${crossAttrs('moa',x.name,`MOA : ${x.name}`)}><td><strong>${escLines(x.name)}</strong></td><td>${fmt(x.value)}</td><td>${fmt(x.dwellings)}</td><td>${fmt(x.buildings)}</td><td>${fmt(pct(c.compliant,c.total),1)} %</td></tr>`}).join('')}</tbody></table>${paginationHtml('moa',model)}<div class="obs-table-note">* Taux calculé sur la population actuellement croisée quand le MOA est présent.</div></div>`;
  }


  function renderCertification(){
    const ops=filteredOperations(), statusUniverse=filteredOperations({ignoreCrossKey:'status'}), excluded=filteredExcludedOperations({ignoreCrossKey:'status'});
    const inactiveByCode=new Map();[...ops.filter(o=>['lostAffair','abandonedAffair','cancelledAffair'].includes(chronologyStatus(o))),...excluded].forEach(o=>inactiveByCode.set(String(o.code||o.name),o));
    const inactive=[...inactiveByCode.values()],a=engine.aggregateTunnel(ops), compliant=a.counts.compliant||0;
    return `${pageHead('certification')}${analyticsToolbar()}${kpiGrid([
      {label:'Opérations',value:fmt(ops.length),note:'population croisée'},
      {label:'Évaluations conformes',value:fmt(compliant),note:`${fmt(pct(compliant,ops.length),1)} % de la sélection`,crossKey:'status',crossValue:'compliant',crossLabel:'Évaluation conforme'},
      {label:'Soldés',value:fmt(a.sold),note:'dossiers marqués soldés',crossKey:'sold',crossValue:'true',crossLabel:'Dossiers soldés'},
      {label:'Perdus / abandonnés / annulés',value:fmt(inactive.length),note:'hors tunnel actif'}
    ])}
    <article class="obs-card" style="margin-bottom:12px"><div class="obs-card-head"><div><span>AVANCEMENT</span><h2>Avancement</h2></div><small>Chaque étape filtre l’ensemble du dashboard</small></div>${tunnel(statusUniverse,{analytic:true})}</article>
    <article class="obs-card obs-cert-chronology"><div class="obs-card-head"><div><span>CHRONOLOGIE</span><h2>Statut par année de création</h2></div><div class="obs-cert-head-controls"><label class="obs-cert-excluded-toggle" title="Afficher ou masquer les affaires perdues, abandonnées et annulées dans cette chronologie"><input type="checkbox" data-status-year-excluded-toggle="1" ${state.statusYearShowExcluded?'checked':''}><span>Afficher perdus / abandonnés / annulés</span></label><div class="obs-card-head-tools"><small>Non démarrée reste distinct des sorties commerciales</small>${tableViewToggle('status-year',state.statusYearView,['list','histogram'])}</div></div></div>${statusYearMatrix([...filteredOperations({ignoreCrossKey:'statusYear'}),...(state.statusYearShowExcluded&&!globalFilterValues('status').length?filteredExcludedOperations({ignoreCrossKey:'statusYear'}):[])])}</article>`;
  }

  function statusYearMatrix(ops){
    // V6.13.1 : la chronologie de l'avancement suit l'année de création (un dossier en cours n'a pas encore d'année de certification).
    const years=uniq(ops.map(o=>o.createdYear)).filter(v=>/^\d{4}$/.test(String(v))).sort((a,b)=>Number(a)-Number(b));
    const activeStatuses=[...PROGRESS_ORDER,'unknown'];
    const excludedStatuses=['lostAffair','abandonedAffair','cancelledAffair'];
    const statuses=state.statusYearShowExcluded?[...activeStatuses,...excludedStatuses]:activeStatuses;
    if(!years.length) return '<div class="obs-empty">Aucune année disponible.</div>';
    const count=(year,status)=>ops.filter(o=>String(o.createdYear)===String(year)&&chronologyStatus(o)===status).length;
    if(state.statusYearView==='histogram'){
      const totals=years.map(y=>({year:y,total:statuses.reduce((n,s)=>n+count(y,s),0)})),mx=Math.max(1,...totals.map(x=>x.total));
      return `<div class="obs-status-year-chart">${totals.map(({year,total})=>`<div class="obs-status-year-col"><div class="obs-status-year-stack" style="height:${Math.max(10,100*total/mx)}%">${statuses.map(s=>{const v=count(year,s),share=total?100*v/total:0,value=`${year}\u0001${s}`,excluded=excludedStatuses.includes(s);return v?`<button type="button" class="${excluded?'is-excluded-status':''}" style="height:${share}% ;--status-color:${CHRONOLOGY_STATUS_COLORS[s]||'#8b9892'}" ${excluded?'':crossAttrs('statusYear',value,`${year} · ${CHRONOLOGY_STATUS_LABELS[s]||s}`)} title="${attr(CHRONOLOGY_STATUS_LABELS[s]||s)} : ${fmt(v)}${excluded?' · hors statistiques actives':''}"></button>`:''}).join('')}</div><strong>${fmt(total)}</strong><span>${esc(year)}</span></div>`).join('')}</div><div class="obs-status-year-legend">${statuses.map(s=>`<span class="${excludedStatuses.includes(s)?'is-excluded-status':''}"><i style="background:${CHRONOLOGY_STATUS_COLORS[s]||'#8b9892'}"></i>${esc(CHRONOLOGY_STATUS_LABELS[s]||s)}${excludedStatuses.includes(s)?' · hors stats':''}</span>`).join('')}</div>`;
    }
    const max=Math.max(1,...years.flatMap(y=>statuses.map(s=>count(y,s)))),model=paged(years,state.statusYearPage,15);state.statusYearPage=model.page;
    return `<div class="obs-heatmap"><table><thead><tr><th>Année</th>${statuses.map(s=>`<th>${esc(shorten(CHRONOLOGY_STATUS_LABELS[s]||s,15))}</th>`).join('')}</tr></thead><tbody>${model.items.map(y=>`<tr><th>${esc(y)}</th>${statuses.map(s=>{const v=count(y,s), key='statusYear', value=`${y}\u0001${s}`, active=!excludedStatuses.includes(s)&&activeCross(key,value),excluded=excludedStatuses.includes(s);return `<td class="${v?'':'is-zero'} ${active?'is-active':''} ${excluded?'is-excluded-status':''}" style="--heat:${v/max}" ${v&&!excluded?crossAttrs(key,value,`${y} · ${CHRONOLOGY_STATUS_LABELS[s]||s}`):''} title="${excluded&&v?'Hors statistiques actives':''}">${fmt(v)}</td>`}).join('')}</tr>`).join('')}</tbody></table>${paginationHtml('status-year-list',model)}</div>`;
  }


  const operationTagCache=new WeakMap();
  function cachedOperationTags(op,kind){
    if(!op)return[];let rec=operationTagCache.get(op);if(!rec){rec={};operationTagCache.set(op,rec);}if(!rec[kind])rec[kind]=(engine.aggregateTags([op],kind)||[]).map(x=>x.name);return rec[kind];
  }
  function aggregateCachedTags(ops,kind){
    const map=new Map();
    (ops||[]).forEach(o=>cachedOperationTags(o,kind).forEach(name=>{const k=norm(name);if(!map.has(k))map.set(k,{name,value:0,dwellings:0,buildings:0});const x=map.get(k);x.value++;x.dwellings+=Number(o.dwellings)||0;x.buildings+=Number(o.buildings)||0;}));
    return [...map.values()].sort((a,b)=>b.value-a.value||a.name.localeCompare(b.name,'fr'));
  }
  function performanceIndex(ops){
    const mentions=aggregateCachedTags(ops,'mention'),performances=aggregateCachedTags(ops,'performance'),pairs=new Map();
    (ops||[]).forEach(o=>{const ms=cachedOperationTags(o,'mention'),ps=cachedOperationTags(o,'performance');ms.forEach(m=>ps.forEach(p=>{const k=`${norm(m)}\u0000${norm(p)}`;pairs.set(k,(pairs.get(k)||0)+1);}));});
    return {mentions,performances,pairs};
  }
  function renderPerformance(){
    const ops=filteredOperations(), mentionUniverse=filteredOperations({ignoreCrossKey:'mention'}), perfUniverse=filteredOperations({ignoreCrossKey:'performance'}),idx=performanceIndex(ops);
    const mentionCoverage=ops.filter(o=>cachedOperationTags(o,'mention').length>0).length, perfCoverage=ops.filter(o=>cachedOperationTags(o,'performance').length>0).length;
    return `${pageHead('performance')}${analyticsToolbar()}${kpiGrid([
      {label:'Opérations',value:fmt(ops.length),note:'population croisée'},
      {label:'Avec mention / label',value:fmt(mentionCoverage),note:`${fmt(pct(mentionCoverage,ops.length),1)} % renseignées`},
      {label:'Avec performance',value:fmt(perfCoverage),note:`${fmt(pct(perfCoverage,ops.length),1)} % renseignées`},
      {label:'Logements',value:fmt(sum(ops,o=>o.dwellings)),note:'dans la population'}
    ])}
    <div class="obs-grid-2">
      <article class="obs-card"><div class="obs-card-head obs-card-head-search"><div><span>MENTIONS</span><h2>Mentions et labels</h2></div><div class="obs-card-head-tools">${tableSearchHtml('mention',state.mentionSearch,'Rechercher une mention…')}${tableViewToggle('mention',state.mentionTableView,['list','bar','tiles'])}</div></div>${tagTable(mentionUniverse,'mention')}</article>
      <article class="obs-card"><div class="obs-card-head obs-card-head-search"><div><span>PERFORMANCES</span><h2>Niveaux de performance</h2></div><div class="obs-card-head-tools">${tableSearchHtml('performance',state.performanceSearch,'Rechercher une performance…')}${tableViewToggle('performance',state.performanceTableView,['list','bar','tiles'])}</div></div>${tagTable(perfUniverse,'performance')}</article>
    </div>
    <article class="obs-card"><div class="obs-card-head"><div><span>CROISEMENT</span><h2>Mentions × performances</h2></div><div class="obs-card-head-tools"><small>Sélection personnalisable + matrice rapide</small>${tableViewToggle('performance-matrix',state.performanceMatrixView,['list','matrix'])}</div></div>${tagMatrix(ops,idx)}</article>`;
  }

  function tagTable(ops,kind){
    const all=aggregateCachedTags(ops,kind), key=kind==='mention'?'mention':'performance', query=norm(kind==='mention'?state.mentionSearch:state.performanceSearch);
    const items=query?all.filter(x=>norm(x.name).includes(query)):all;
    if(!items.length) return '<div class="obs-empty">Aucun résultat pour cette recherche.</div>';
    const pageKey=kind==='mention'?'mentionPage':'performancePage',view=kind==='mention'?state.mentionTableView:state.performanceTableView,model=paged(items,state[pageKey],15);state[pageKey]=model.page;
    if(view==='bar'){
      const total=items.reduce((ss,x)=>ss+(Number(x.value)||0),0)||1;
      return `${tableBarRows(model.items,{name:x=>x.name,value:x=>x.value,secondary:x=>`${fmt(x.dwellings)} lgts · ${fmt(x.buildings)} bât.`,crossKey:key,crossValue:x=>x.name,crossLabel:x=>`${kind==='mention'?'Mention':'Performance'} : ${x.name}`,total})}${paginationHtml(kind,model)}`;
    }
    if(view==='tiles'){
      const max=Math.max(1,...model.items.map(x=>x.value)),total=items.reduce((ss,x)=>ss+(Number(x.value)||0),0)||1;
      return `<div class="obs-table-tiles">${model.items.map(x=>`<button type="button" class="obs-table-tile ${activeCross(key,x.name)?'is-active':''}" ${crossAttrs(key,x.name,`${kind==='mention'?'Mention':'Performance'} : ${x.name}`)} style="--tile-weight:${Math.max(.12,x.value/max)}"><span>${escLines(x.name)}</span><strong>${fmt(x.value)}</strong><small>${fmt(pct(x.value,total),1)} % · ${fmt(x.dwellings)} lgts</small></button>`).join('')}</div>${paginationHtml(kind,model)}`;
    }
    return `<div class="obs-table-wrap"><table class="obs-table"><thead><tr><th>Libellé</th><th>Opérations</th><th>Logements</th><th>Bâtiments</th><th>Part</th></tr></thead><tbody>${model.items.map(x=>`<tr class="obs-cross-row ${activeCross(key,x.name)?'is-active':''}" ${crossAttrs(key,x.name,`${kind==='mention'?'Mention':'Performance'} : ${x.name}`)}><td><strong>${escLines(x.name)}</strong></td><td>${fmt(x.value)}</td><td>${fmt(x.dwellings)}</td><td>${fmt(x.buildings)}</td><td>${fmt(pct(x.value,ops.length),1)} %</td></tr>`).join('')}</tbody></table>${paginationHtml(kind,model)}</div>`;
  }

  function matrixSelectionValues(kind){
    const key=kind==='mention'?'performanceMatrixMentions':'performanceMatrixPerformances';
    return Array.isArray(state[key])?state[key]:[];
  }
  function matrixSelectionHas(kind,value){ return matrixSelectionValues(kind).some(v=>norm(v)===norm(value)); }
  function matrixSelectionMatch(op){
    const ms=matrixSelectionValues('mention'), ps=matrixSelectionValues('performance');
    const opM=cachedOperationTags(op,'mention'), opP=cachedOperationTags(op,'performance');
    const mentionOk=!ms.length||ms.some(sel=>opM.some(v=>norm(v)===norm(sel)));
    const performanceOk=!ps.length||ps.some(sel=>opP.some(v=>norm(v)===norm(sel)));
    return mentionOk&&performanceOk;
  }
  function applyMatrixSelection(ops){ return (ops||[]).filter(matrixSelectionMatch); }
  // V6.13.5 : recherche dans les listes à cocher « Mentions × performances ».
  // Tous les mots saisis doivent apparaître (ordre libre, accents et casse ignorés).
  function matrixSearchTokens(query){return norm(query||'').split(/\s+/).filter(Boolean);}
  function matrixOptionMatches(name,tokens){if(!tokens.length)return true;const n=norm(name);return tokens.every(t=>n.includes(t));}
  function matrixCheckboxPanel(kind,items){
    const selected=matrixSelectionValues(kind), label=kind==='mention'?'Mentions / labels':'Performances';
    const query=String(state.matrixSearch?.[kind]||''), tokens=matrixSearchTokens(query);
    const visible=items.filter(x=>matrixOptionMatches(x.name,tokens)).length;
    return `<section class="obs-matrix-check-panel"><header><div><span>${esc(label)}</span><b>${selected.length?`${fmt(selected.length)} sélectionnée${selected.length>1?'s':''}`:'Toutes'}</b></div><button type="button" data-matrix-clear="${kind}" ${selected.length?'':'disabled'}>Tout afficher</button></header><label class="obs-matrix-check-search"><span>⌕</span><input type="search" data-matrix-search="${kind}" value="${attr(query)}" placeholder="Rechercher…" autocomplete="off"></label><div class="obs-matrix-check-empty" data-matrix-empty="${kind}" ${visible?'hidden':''}>Aucun résultat pour cette recherche.</div><div class="obs-matrix-check-list" data-matrix-check-list="${kind}" data-scroll-key="matrix-list-${kind}">${items.map(x=>`<label data-matrix-option="${attr(norm(x.name))}" ${matrixOptionMatches(x.name,tokens)?'':'hidden'}><input type="checkbox" data-performance-matrix-check="${kind}" value="${attr(x.name)}" ${matrixSelectionHas(kind,x.name)?'checked':''}><span>${escLines(x.name)}</span><small>${fmt(x.value)}</small></label>`).join('')}</div></section>`;
  }
  function matrixSelectionSummary(ops){
    const ms=matrixSelectionValues('mention'),ps=matrixSelectionValues('performance');
    if(!ms.length&&!ps.length)return 'Toutes les mentions et performances';
    return `${ms.length?`${ms.length} mention${ms.length>1?'s':''}`:'toutes mentions'} · ${ps.length?`${ps.length} performance${ps.length>1?'s':''}`:'toutes performances'}`;
  }
  function tagMatrix(ops,idx=performanceIndex(ops)){
    const allM=idx.mentions,allP=idx.performances;
    if(!allM.length||!allP.length) return '<div class="obs-empty">Pas assez de données pour croiser mentions et performances.</div>';
    state.performanceMatrixMentions=matrixSelectionValues('mention').filter(v=>allM.some(x=>norm(x.name)===norm(v)));
    state.performanceMatrixPerformances=matrixSelectionValues('performance').filter(v=>allP.some(x=>norm(x.name)===norm(v)));
    const pairCount=(m,p)=>idx.pairs.get(`${norm(m)}\u0000${norm(p)}`)||0;
    const selectedOps=applyMatrixSelection(ops);
    const selector=`<div class="obs-matrix-selector obs-matrix-selector-multi"><div class="obs-matrix-checks">${matrixCheckboxPanel('mention',allM)}<b class="obs-matrix-times">×</b>${matrixCheckboxPanel('performance',allP)}</div><div class="obs-matrix-selection-kpis"><strong>${fmt(selectedOps.length)}<small>opérations</small></strong><strong>${fmt(sum(selectedOps,o=>o.dwellings))}<small>logements</small></strong><strong>${fmt(sum(selectedOps,o=>o.buildings))}<small>bâtiments</small></strong><strong>${fmt(pct(selectedOps.length,ops.length),1)} %<small>de la sélection</small></strong></div><p class="obs-matrix-scope-note">Cette sélection multicoche alimente aussi les transitions DPE énergie et GES de l’onglet Carbone & DPE. Sans case cochée, toutes les valeurs sont prises en compte.</p></div>`;
    const combos=[];idx.pairs.forEach((value,k)=>{const [mk,pk]=k.split('\u0000'),m=allM.find(x=>norm(x.name)===mk)?.name||mk,p=allP.find(x=>norm(x.name)===pk)?.name||pk;combos.push({mention:m,performance:p,value});});combos.sort((a,b)=>b.value-a.value||a.mention.localeCompare(b.mention,'fr'));
    if(state.performanceMatrixView==='list'){
      const scopedCombos=combos.filter(x=>(!state.performanceMatrixMentions.length||matrixSelectionHas('mention',x.mention))&&(!state.performanceMatrixPerformances.length||matrixSelectionHas('performance',x.performance)));
      const model=paged(scopedCombos,state.performanceMatrixPage,15);state.performanceMatrixPage=model.page;
      return `${selector}<div class="obs-table-wrap"><table class="obs-table"><thead><tr><th>Mention</th><th>Performance</th><th>Opérations</th><th>Part</th></tr></thead><tbody>${model.items.map(x=>{const value=`${x.mention}\u0001${x.performance}`;return `<tr class="obs-cross-row ${activeCross('mentionPerformance',value)?'is-active':''}" ${crossAttrs('mentionPerformance',value,`${x.mention} + ${x.performance}`)}><td><strong>${escLines(x.mention)}</strong></td><td>${escLines(x.performance)}</td><td>${fmt(x.value)}</td><td>${fmt(pct(x.value,ops.length),1)} %</td></tr>`}).join('')}</tbody></table>${paginationHtml('performance-matrix',model)}</div>`;
    }
    const selectedM=allM.filter(x=>matrixSelectionHas('mention',x.name)), selectedP=allP.filter(x=>matrixSelectionHas('performance',x.name));
    const topM=state.performanceMatrixMentions.length?selectedM:allM.slice(0,6), topP=state.performanceMatrixPerformances.length?selectedP:allP.slice(0,6);
    const visibleM=topM.slice(0,12), visibleP=topP.slice(0,12), max=Math.max(1,...visibleM.flatMap(m=>visibleP.map(p=>pairCount(m.name,p.name))));
    return `${selector}<div class="obs-heatmap obs-performance-heatmap"><table><thead><tr><th>Mention ↓</th>${visibleP.map(p=>`<th class="${matrixSelectionHas('performance',p.name)?'is-selected-axis':''}" title="${attr(p.name)}">${esc(shorten(p.name,14))}</th>`).join('')}</tr></thead><tbody>${visibleM.map(m=>`<tr class="${matrixSelectionHas('mention',m.name)?'is-selected-axis':''}"><th title="${attr(m.name)}">${esc(shorten(m.name,18))}</th>${visibleP.map(p=>{const v=pairCount(m.name,p.name),value=`${m.name}\u0001${p.name}`,active=activeCross('mentionPerformance',value),selected=matrixSelectionHas('mention',m.name)&&matrixSelectionHas('performance',p.name);return `<td class="${v?'':'is-zero'} ${active?'is-active':''} ${selected?'is-target-cell':''}" style="--heat:${v/max}" ${v?crossAttrs('mentionPerformance',value,`${m.name} + ${p.name}`):''}>${fmt(v)}</td>`}).join('')}</tr>`).join('')}</tbody></table></div>${(topM.length>visibleM.length||topP.length>visibleP.length)?'<div class="obs-table-note">Affichage matriciel limité à 12 mentions × 12 performances ; la sélection complète reste appliquée aux calculs et aux transitions DPE/GES.</div>':''}`;
  }

  function solutionCardView(cardKey){ return state.solutionViews?.[cardKey]==='pie'?'pie':'bar'; }
  function solutionViewToggle(cardKey){
    const view=solutionCardView(cardKey);
    return `<div class="obs-view-toggle obs-solution-view-toggle" role="group" aria-label="Mode d’affichage"><button type="button" class="${view==='bar'?'is-active':''}" data-solution-view="${attr(cardKey)}" data-view="bar" title="Barres">▥</button><button type="button" class="${view==='pie'?'is-active':''}" data-solution-view="${attr(cardKey)}" data-view="pie" title="Camembert">◕</button></div>`;
  }
  function normalizedDistribution(key,options={}){
    const crossKey=`norm:${key}`, universe=filteredTechnicalOperations({ignoreCrossKey:crossKey});
    return {items:countBy(universe,o=>normalizedValue(o,key)),crossKey,...options};
  }
  function vectorColor(value){
    const s=norm(value);
    if(/gaz/.test(s)) return '#e58a2b';
    if(/electric|electr|elec/.test(s)) return '#e2b600';
    if(/rcu|reseau de chaleur/.test(s)) return '#7b61d1';
    if(/pac|pompe a chaleur|thermodynam|cet/.test(s)) return '#2f80ed';
    if(/bois|biomasse/.test(s)) return '#5b8f45';
    if(/fioul/.test(s)) return '#8b6f61';
    if(/solair/.test(s)) return '#f2a900';
    if(/hybrid/.test(s)) return '#009a93';
    if(/aucun|sans/.test(s)) return '#a8b3ad';
    if(/autre/.test(s)) return '#7c8d85';
    return '#168456';
  }
  function vectorColorStyle(value){return `--vector-color:${vectorColor(value)}`;}

  function pieDistribution(items,{key='',labelPrefix='',maxItems=10,colorFn=null}={}){
    if(!items.length) return '<div class="obs-empty">Aucune donnée disponible pour cette sélection.</div>';
    const total=items.reduce((a,x)=>a+(Number(x.value)||0),0)||1;
    let rows=items.slice(0,maxItems).map(x=>({...x}));
    const rest=items.slice(maxItems).reduce((s,x)=>s+(Number(x.value)||0),0);
    if(rest) rows.push({name:'Autres',value:rest,isOther:true});
    const palette=['#06402b','#168456','#4b9881','#79a98f','#a4bcae','#d4a24c','#7d9bb0','#8a769d','#b96d69','#8d9a94','#c2a98a'];
    let acc=0; const stops=[];
    rows.forEach((x,i)=>{const a=100*acc/total;acc+=Number(x.value)||0;const b=100*acc/total;const color=colorFn?colorFn(x.name):palette[i%palette.length];stops.push(`${color} ${a.toFixed(2)}% ${b.toFixed(2)}%`);x._color=color;});
    return `<div class="obs-pie-layout"><div class="obs-pie-chart" style="background:conic-gradient(${stops.join(',')})" role="img" aria-label="Répartition en camembert"></div><div class="obs-pie-legend">${rows.map(x=>{const clickable=key&&!x.isOther;return `<${clickable?'button':'div'} ${clickable?`type="button" class="${activeCross(key,x.name)?'is-active':''}" ${crossAttrs(key,x.name,`${labelPrefix||key} : ${x.name}`)}`:'class="obs-pie-legend-static"'}><i style="background:${x._color}"></i><span>${esc(x.name)}</span><strong>${fmt(x.value)}<small>${fmt(pct(x.value,total),1)} %</small></strong></${clickable?'button':'div'}>`;}).join('')}</div></div>`;
  }
  function distributionVisual(items,{view='bar',key='',labelPrefix='',maxItems=12,colorFn=null}={}){
    return view==='pie'?pieDistribution(items,{key,labelPrefix,maxItems,colorFn}):tileDistribution(items,{key,labelPrefix,maxItems,colorFn});
  }
  function envelopeCard(title,cardKey,materialKey,materialLabel,rKey,thicknessKey,structureNormKey=''){
    const view=solutionCardView(cardKey), material=normalizedDistribution(materialKey), r=averageRaw(filteredTechnicalOperations(),rKey), th=averageRaw(filteredTechnicalOperations(),thicknessKey);
    const structure=structureNormKey?normalizedDistribution(structureNormKey):null;
    return `<article class="obs-card obs-envelope-card"><div class="obs-card-head"><div><span>ENVELOPPE NORMALISÉE</span><h2>${esc(title)}</h2></div><div class="obs-card-head-tools"><small>${r.count?`${fmt(r.count)} valeurs R`:'R non renseigné'}${lowSample(r.count)}</small>${solutionViewToggle(cardKey)}</div></div>
      <div class="obs-envelope-metrics"><div><span>R moyen</span><b>${r.avg===null?'—':fmt(r.avg,2)}</b><small>m²·K/W</small></div><div><span>Épaisseur moy.</span><b>${th.avg===null?'—':fmt(th.avg,0)}</b><small>mm</small></div></div>
      <div class="obs-subsection-title">${esc(materialLabel)}</div>${distributionVisual(material.items,{view,key:material.crossKey,maxItems:10,labelPrefix:title})}
      ${structure?`<div class="obs-subsection-title">${structureNormKey==='floorSolution'?'Type de plancher':'Famille de structure'}</div>${distributionVisual(structure.items,{view,key:structure.crossKey,maxItems:10,labelPrefix:`${title} · structure`})}`:''}
    </article>`;
  }

  function tileDistribution(items,{key='',labelPrefix='',maxItems=12,colorFn=null}={}){
    const rows=items.slice(0,maxItems), total=items.reduce((a,x)=>a+(Number(x.value)||0),0)||1, max=Math.max(1,...rows.map(x=>x.value));
    if(!rows.length) return '<div class="obs-empty">Aucune donnée disponible pour cette sélection.</div>';
    return `<div class="obs-visual-dist">${rows.map((item,index)=>{
      const fixed=key?crossKeyValueFix(key,item.name,`${labelPrefix||key} : ${item.name}`):null;
      const active=fixed&&activeCross(fixed.key,fixed.value), share=pct(item.value,total);
      return `<button type="button" class="obs-visual-dist-row ${active?'is-active':''}" ${key?crossAttrs(key,item.name,`${labelPrefix||key} : ${item.name}`):''}><i class="obs-visual-dist-icon">${visualIconFor(item.name)}</i><span><b>${esc(item.name)}</b><em><u style="width:${Math.max(3,100*item.value/max).toFixed(1)}%;${colorFn?`background:${colorFn(item.name)}`:''}"></u></em></span><strong><b>${fmt(item.value)}</b><small>${fmt(share,1)} %</small></strong></button>`;
    }).join('')}</div>`;
  }

  function normalizedSingleCard(title,cardKey,normKey,subtitle='Grande famille normalisée'){
    const view=solutionCardView(cardKey), dist=normalizedDistribution(normKey);
    return `<article class="obs-card obs-envelope-card"><div class="obs-card-head"><div><span>ENVELOPPE NORMALISÉE</span><h2>${esc(title)}</h2></div><div class="obs-card-head-tools"><small>${esc(subtitle)}</small>${solutionViewToggle(cardKey)}</div></div>${distributionVisual(dist.items,{view,key:dist.crossKey,maxItems:12,labelPrefix:title})}</article>`;
  }

  function technicalCard(title,cardKey,normKey){
    const view=solutionCardView(cardKey),dist=normalizedDistribution(normKey),isVector=['heatingVector','ecsVector'].includes(normKey);
    return `<article class="obs-card obs-technical-card ${isVector?'obs-vector-card':''}"><div class="obs-card-head"><div><span>SYSTÈMES NORMALISÉS</span><h2>${esc(title)}</h2></div><div class="obs-card-head-tools"><small>Grandes familles</small>${solutionViewToggle(cardKey)}</div></div>${distributionVisual(dist.items,{view,key:dist.crossKey,maxItems:12,labelPrefix:title,colorFn:isVector?vectorColor:null})}</article>`;
  }

  function solutionMetricKpi(ops){
    const metric=state.solutionMetric||'ubat';
    const defs={
      ubat:{label:'Ubat projet moyen',key:'ubatAfter',refKey:'ubatBefore',digits:2,unit:'W/m²·K',note:'Ubat avant → projet'},
      tic:{label:'TIC moyen',key:'tic',refKey:'ticRef',digits:1,unit:'°C',note:'TIC projet / TIC ref'},
      dh:{label:'DH moyen',key:'dh',refKey:'dhMax',digits:0,unit:'°C·h',note:'DH projet / DH max'}
    };
    const d=defs[metric]||defs.ubat, val=averageRaw(ops,d.key), ref=averageRaw(ops,d.refKey);
    return `<article class="obs-kpi obs-kpi-selector"><div class="obs-kpi-selectline"><span>INDICATEUR ENVELOPPE / CONFORT</span><select data-solution-metric aria-label="Indicateur enveloppe et confort"><option value="ubat" ${metric==='ubat'?'selected':''}>Ubat</option><option value="tic" ${metric==='tic'?'selected':''}>TIC</option><option value="dh" ${metric==='dh'?'selected':''}>DH</option></select></div><strong>${val.avg===null?'—':fmt(val.avg,d.digits)}</strong><small>${esc(d.unit)} · ${ref.avg===null?`${fmt(val.count)} / ${fmt(val.population)} opérations · couverture ${fmt(val.coverage,1)} %`:`${d.note} : ${fmt(ref.avg,d.digits)} · couverture ${fmt(val.coverage,1)} %`}${lowSample(val.count)}</small></article>`;
  }

  function solutionRGauge(label,metric,icon,max=10,reference=3){
    const value=metric.avg, pos=value===null?0:Math.max(0,Math.min(100,100*value/max)), ref=Math.max(0,Math.min(100,100*reference/max));
    return `<article class="obs-kpi obs-solution-rgauge"><i class="obs-solution-r-icon">${icon}</i><span>${esc(label)}</span><strong>${value===null?'—':fmt(value,1)}</strong><small>m²·K/W · ${fmt(metric.count)} / ${fmt(metric.population)} opérations · couverture ${fmt(metric.coverage,1)} %${lowSample(metric.count)}</small><div class="obs-solution-r-track"><i style="width:${pos}%"></i><b style="left:${ref}%"></b></div><div class="obs-solution-r-scale"><em>0</em><em>Réf. ${fmt(reference,1)}</em><em>${fmt(max,0)}</em></div></article>`;
  }

  function renderSolutions(){
    const ops=filteredTechnicalOperations();
    const roofR=averageRaw(ops,'roofR'), wallR=averageRaw(ops,'wallR'), floorR=averageRaw(ops,'floorR');
    const windowsView=solutionCardView('windows');
    const winMat=normalizedDistribution('windowMaterial'), winGlass=normalizedDistribution('windowGlazing'), winShade=normalizedDistribution('windowShading');
    return `${pageHead('solutions',`<div class="obs-selection-note">${fmt(ops.length)} opération${ops.length>1?'s':''} technique${ops.length>1?'s':''}</div>`)}${analyticsToolbar()}<div class="obs-grid-kpi obs-grid-kpi-technical">
      ${solutionRGauge('Toiture · R moyen',roofR,'⌂',12,3)}
      ${solutionRGauge('Façade · R moyen',wallR,'▦',10,3)}
      ${solutionRGauge('Plancher bas · R moyen',floorR,'▱',10,3)}
      ${solutionMetricKpi(ops)}
    </div>
    <div class="obs-section-title"><div><span>01</span><h2>Enveloppe du bâtiment</h2></div><p>Lecture compacte par grandes familles ; les valeurs détaillées restent conservées dans les données source.</p></div>
    <div class="obs-solutions-grid">
      <div class="obs-solutions-construction">${normalizedSingleCard('Mode constructif','construction','structure')}</div>
      <div>${envelopeCard('Toitures / planchers hauts','roof','roofInsulation','Famille d’isolant','roofR','roofThickness','roofStructure')}</div>
      <div>${envelopeCard('Façades / parois verticales','walls','wallInsulation','Famille d’isolant','wallR','wallThickness','wallStructure')}</div>
      <div>${envelopeCard('Planchers bas','floors','floorInsulation','Famille d’isolant','floorR','floorThickness','floorSolution')}</div>
      <article class="obs-card obs-envelope-card obs-windows-wide"><div class="obs-card-head"><div><span>ENVELOPPE NORMALISÉE</span><h2>Menuiseries extérieures</h2></div><div class="obs-card-head-tools"><small>Grandes familles</small>${solutionViewToggle('windows')}</div></div>
        <div class="obs-window-distributions"><section><div class="obs-subsection-title">Matériau</div>${distributionVisual(winMat.items,{view:windowsView,key:winMat.crossKey,maxItems:8,labelPrefix:'Menuiseries'})}</section><section><div class="obs-subsection-title">Vitrage</div>${distributionVisual(winGlass.items,{view:windowsView,key:winGlass.crossKey,maxItems:8,labelPrefix:'Vitrage'})}</section><section><div class="obs-subsection-title">Occultations</div>${distributionVisual(winShade.items,{view:windowsView,key:winShade.crossKey,maxItems:8,labelPrefix:'Occultations'})}</section></div>
      </article>
    </div>
    <div class="obs-section-title"><div><span>02</span><h2>Systèmes techniques</h2></div><p>Chauffage, ECS, ventilation et refroidissement sont ramenés à des familles homogènes ; chaque encart peut basculer entre barres et camembert.</p></div>
    <div class="obs-systems-grid">
      ${technicalCard('Vecteur chauffage','heating-vector','heatingVector')}
      ${technicalCard('Vecteur ECS','ecs-vector','ecsVector')}
      ${technicalCard('Ventilation','ventilation','ventilationFamily')}${technicalCard('Refroidissement','cooling','coolingFamily')}
    </div>`;
  }

  function metricPairStats(ops,valueKey,maxKey){
    const rows=ops.map(o=>[rawNumber(o,valueKey),rawNumber(o,maxKey)]).filter(([v,m])=>v!==null&&m!==null&&m>0);
    const avg=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:null;
    const values=rows.map(r=>r[0]), maxes=rows.map(r=>r[1]), margins=rows.map(([v,m])=>m-v), gains=rows.map(([v,m])=>(m-v)/m*100);
    const under=rows.filter(([v,m])=>v<=m).length;
    return {count:rows.length,population:ops.length,valueAvg:avg(values),maxAvg:avg(maxes),marginAvg:avg(margins),gainAvg:avg(gains),under,rate:pct(under,rows.length)};
  }

  function performanceGauge(stats,label,options={}){
    if(!stats.count) return '<div class="obs-empty">Aucune paire valeur / maximum exploitable.</div>';
    const ratio=stats.maxAvg?Math.max(0,Math.min(1.35,stats.valueAvg/stats.maxAvg)):0;
    const marker=Math.min(100,ratio*100), digits=Number.isInteger(options.digits)?options.digits:1, unit=options.unit?` ${options.unit}`:'';
    const left=options.leftLabel||'0', right=options.referenceLabel||`${label} max moyen`;
    return `<div class="obs-performance-gauge"><div class="obs-gauge-scale"><span>${esc(left)}</span><span>${esc(right)} · ${fmt(stats.maxAvg,digits)}${esc(unit)}</span></div><div class="obs-gauge-track"><i class="obs-gauge-good"></i><b style="left:${marker}%"></b></div><div class="obs-gauge-project"><span>${esc(label)} projet moyen</span><strong>${fmt(stats.valueAvg,digits)}${esc(unit)}</strong><small>Marge moyenne ${stats.marginAvg>=0?'+':''}${fmt(stats.marginAvg,digits)}${esc(unit)} · ${fmt(stats.rate,1)} % sous la référence · couverture ${fmt(pct(stats.count,stats.population),1)} % (${fmt(stats.count)}/${fmt(stats.population)})${lowSample(stats.count)}</small></div></div>`;
  }
  function beforeAfterGauge(before,after,label,unit='',digits=2){
    if(before.avg===null||after.avg===null)return '<div class="obs-empty">Valeurs avant / après insuffisantes.</div>';
    const max=Math.max(before.avg,after.avg,0.0001), gain=before.avg?((before.avg-after.avg)/before.avg*100):null;
    return `<div class="obs-before-after"><div><span>Avant travaux</span><b>${fmt(before.avg,digits)}${unit?` ${esc(unit)}`:''}</b><i><em style="width:${Math.max(3,100*before.avg/max).toFixed(1)}%"></em></i></div><div><span>Projet / après travaux</span><b>${fmt(after.avg,digits)}${unit?` ${esc(unit)}`:''}</b><i><em style="width:${Math.max(3,100*after.avg/max).toFixed(1)}%"></em></i></div><small>${gain===null?'':`Évolution moyenne : ${gain>=0?'−':'+'}${fmt(Math.abs(gain),1)} %`}</small></div>`;
  }

  function metricAverageBars(ops,defs){
    const rows=defs.map(([key,label])=>{const a=averageRaw(ops,key);return {key,label,avg:a.avg,count:a.count};}).filter(x=>x.count&&x.avg!==null);
    if(!rows.length) return '<div class="obs-empty">Aucune donnée de décomposition CEP renseignée.</div>';
    const max=Math.max(1,...rows.map(x=>x.avg));
    return `<div class="obs-bars obs-metric-bars">${rows.map(x=>`<div class="obs-bar-row obs-metric-row"><span title="${attr(x.label)}">${esc(x.label)}</span><span class="obs-bar-track"><i class="obs-bar-fill" style="width:${Math.max(2,100*x.avg/max).toFixed(1)}%"></i></span><strong>${fmt(x.avg,1)}</strong><small>${fmt(x.count)} op.</small></div>`).join('')}</div>`;
  }

  function energyCepViewToggle(cardKey){const view=state.energyCepViews?.[cardKey]||'pie';return `<div class="obs-view-toggle" role="group" aria-label="Mode d’affichage CEP"><button type="button" class="${view==='bar'?'is-active':''}" data-energy-cep-view="${attr(cardKey)}" data-view="bar" title="Barres">▥</button><button type="button" class="${view==='pie'?'is-active':''}" data-energy-cep-view="${attr(cardKey)}" data-view="pie" title="Camembert">◕</button></div>`;}
  function metricAverageItems(ops,defs){return defs.map(([key,label])=>{const a=averageRaw(ops,key);return {key,name:label,value:a.avg,count:a.count};}).filter(x=>x.count&&x.value!==null&&x.value>=0);}
  function metricAverageVisual(ops,defs,cardKey){const rows=metricAverageItems(ops,defs);if(!rows.length)return '<div class="obs-empty">Aucune donnée de décomposition CEP renseignée.</div>';const view=state.energyCepViews?.[cardKey]||'pie',colorFn=cardKey==='vector'?vectorColor:null;if(view==='pie')return pieDistribution(rows,{maxItems:10,colorFn});const max=Math.max(1,...rows.map(x=>x.value));return `<div class="obs-bars obs-metric-bars">${rows.map(x=>`<div class="obs-bar-row obs-metric-row"><span title="${attr(x.name)}">${esc(x.name)}</span><span class="obs-bar-track"><i class="obs-bar-fill" style="width:${Math.max(2,100*x.value/max).toFixed(1)}%;${colorFn?`background:${colorFn(x.name)}`:''}"></i></span><strong>${fmt(x.value,1)}</strong><small>${fmt(x.count)} op.</small></div>`).join('')}</div>`;}

  function renderEnergy(){
    const ops=filteredTechnicalOperations();
    const cepStats=metricPairStats(ops,'cep','cepMax'), cepnrStats=metricPairStats(ops,'cepnr','cepnrMax'), bbioStats=metricPairStats(ops,'bbio','bbioMax');
    const dhStats=metricPairStats(ops,'dh','dhMax'), ticStats=metricPairStats(ops,'tic','ticRef');
    const ubBefore=averageRaw(ops,'ubatBefore'), ubAfter=averageRaw(ops,'ubatAfter');
    return `${pageHead('energy',`<div class="obs-selection-note">${fmt(ops.length)} opération${ops.length>1?'s':''} technique${ops.length>1?'s':''}</div>`)}${analyticsToolbar()}${kpiGrid([
      {label:'Cep projet moyen',value:cepStats.valueAvg===null?'—':fmt(cepStats.valueAvg,1),note:`${fmt(cepStats.count)} / ${fmt(ops.length)} opérations · couverture ${fmt(pct(cepStats.count,ops.length),1)} %`,sample:cepStats.count,metric:'cep'},
      {label:'Cep max moyen',value:cepStats.maxAvg===null?'—':fmt(cepStats.maxAvg,1),note:`référence maximale moyenne · couverture ${fmt(pct(cepStats.count,ops.length),1)} %`,metric:'cepMax'},
      {label:'Marge au Cep max',value:cepStats.marginAvg===null?'—':`${cepStats.marginAvg>=0?'+':''}${fmt(cepStats.marginAvg,1)}`,note:'Cep max − Cep projet'},
      {label:'Sous le Cep max',value:cepStats.count?`${fmt(cepStats.rate,1)} %`:'—',note:`${fmt(cepStats.under)} / ${fmt(cepStats.count)} opérations comparables`}
    ])}
    <article class="obs-card obs-cep-card"><div class="obs-card-head"><div><span>CEP PROJET / CEP MAX</span><h2>Position de la consommation conventionnelle</h2></div><small>Plus le curseur reste à gauche du seuil, meilleure est la marge</small></div>${performanceGauge(cepStats,'Cep',{unit:'kWhEP/m².an',leftLabel:'0 / BEPOS',referenceLabel:'Cep max moyen'})}</article>
    <div class="obs-section-title"><div><span>01</span><h2>Transitions énergétiques</h2></div><p>Les vecteurs sont regroupés en catégories comparables : Gaz, Électricité, PAC, CET, RCU, Bois / biomasse, etc.</p></div>
    <div class="obs-grid-2">
      <article class="obs-card obs-flow-card"><div class="obs-card-head"><div><span>CHAUFFAGE</span><h2>Vecteurs avant → après travaux</h2></div><small>Clique d’abord sur un vecteur à gauche</small></div>${transitionFlow(filteredOperations({ignoreCrossKey:'transition:heatingBefore:heatingAfter'}),'heatingBefore','heatingAfter','Chauffage','heating')}</article>
      <article class="obs-card obs-flow-card"><div class="obs-card-head"><div><span>ECS</span><h2>Vecteurs avant → après travaux</h2></div><small>Clique d’abord sur un vecteur à gauche</small></div>${transitionFlow(filteredOperations({ignoreCrossKey:'transition:ecsBefore:ecsAfter'}),'ecsBefore','ecsAfter','ECS','ecs')}</article>
    </div>
    <div class="obs-section-title"><div><span>02</span><h2>Performance énergétique</h2></div><p>Lecture simple : valeur projet moyenne comparée à la valeur maximale ou de référence moyenne.</p></div>
    <div class="obs-grid-3 obs-performance-compare-grid">
      <article class="obs-card"><div class="obs-card-head"><div><span>CEP,NR</span><h2>Projet vs Cep,nr max</h2></div><small>${cepnrStats.count?`${fmt(cepnrStats.rate,1)} % sous le max`:'données insuffisantes'}</small></div>${performanceGauge(cepnrStats,'Cep,nr',{unit:'kWhEP/m².an',referenceLabel:'Cep,nr max moyen'})}</article>
      <article class="obs-card"><div class="obs-card-head"><div><span>BBIO</span><h2>Projet vs Bbio max</h2></div><small>${bbioStats.count?`${fmt(bbioStats.rate,1)} % sous le max`:'données insuffisantes'}</small></div>${performanceGauge(bbioStats,'Bbio',{unit:'points',referenceLabel:'Bbio max moyen'})}</article>
      <article class="obs-card"><div class="obs-card-head"><div><span>CONFORT D’ÉTÉ</span><h2>DH projet vs DH max</h2></div><small>${dhStats.count?`${fmt(dhStats.rate,1)} % sous le DH max`:'données insuffisantes'}</small></div>${performanceGauge(dhStats,'DH',{unit:'°C·h',digits:0,referenceLabel:'DH max moyen'})}</article>
    </div>
    <div class="obs-grid-2">
      <article class="obs-card"><div class="obs-card-head"><div><span>TIC</span><h2>TIC projet vs TIC de référence</h2></div><small>Utilisé lorsque le référentiel renseigne TIC/TIC ref</small></div>${performanceGauge(ticStats,'TIC',{unit:'°C',digits:1,referenceLabel:'TIC ref moyenne'})}</article>
      <article class="obs-card"><div class="obs-card-head"><div><span>UBAT</span><h2>Transmission thermique avant / projet</h2></div><small>Une valeur plus basse traduit une enveloppe plus performante</small></div>${beforeAfterGauge(ubBefore,ubAfter,'Ubat','W/m²·K',2)}</article>
    </div>
    <div class="obs-section-title"><div><span>03</span><h2>D’où vient le Cep ?</h2></div><p>Décomposition moyenne des usages et vecteurs lorsqu’ils sont renseignés dans la source.</p></div>
    <div class="obs-grid-2">
      <article class="obs-card"><div class="obs-card-head"><div><span>PAR USAGE</span><h2>Contribution moyenne au Cep</h2></div><div class="obs-card-head-tools"><small>kWhEP/m².an</small>${energyCepViewToggle('usage')}</div></div>${metricAverageVisual(ops,[['cepCooling','Refroidissement'],['cepLighting','Éclairage'],['cepAuxVent','Auxiliaires ventilation'],['cepAuxDist','Auxiliaires distribution'],['cepMobility','Déplacement occupants']],'usage')}</article>
      <article class="obs-card"><div class="obs-card-head"><div><span>PAR VECTEUR</span><h2>Contribution moyenne au Cep</h2></div><div class="obs-card-head-tools"><small>kWhEP/m².an</small>${energyCepViewToggle('vector')}</div></div>${metricAverageVisual(ops,[['cepElectricity','Électricité'],['cepGas','Gaz'],['cepDistrict','Réseau de chaleur'],['cepWood','Bois / biomasse']],'vector')}</article>
    </div>`;
  }

  function transitionFlow(ops,beforeKey,afterKey,label,focusKey){
    const dpeMode=['dpeEnergyBefore','dpeGesBefore'].includes(beforeKey);
    const flowOps=dpeMode?(ops||[]).filter(o=>dpeLetter(o,beforeKey)&&dpeLetter(o,afterKey)):(ops||[]);
    const before=countBy(flowOps,o=>transitionValue(o,beforeKey)).slice(0,12), after=countBy(flowOps,o=>transitionValue(o,afterKey)).slice(0,12);
    if(!before.length||!after.length) return '<div class="obs-empty">Données de transition insuffisantes.</div>';
    const matrix=new Map();
    flowOps.forEach(o=>{const a=transitionValue(o,beforeKey),b=transitionValue(o,afterKey);matrix.set(`${a}\u0000${b}`,(matrix.get(`${a}\u0000${b}`)||0)+1);});
    const transitionKey=`transition:${beforeKey}:${afterKey}`;
    const activeTransition=state.crossFilters.find(f=>f.key===transitionKey);
    const activeParts=activeTransition?String(activeTransition.value).split('\u0001'):[];
    let focus=state.flowFocus[focusKey]||activeParts[0]||'';
    if(focus&&!before.some(x=>norm(x.name)===norm(focus))) focus='';
    const rows=Math.max(before.length,after.length), H=Math.max(330,rows*58), ys=(i,n)=>((i+.5)*H/n);
    const focusRow=before.findIndex(x=>norm(x.name)===norm(focus));
    const flows=focus?after.map((b,j)=>({name:b.name,count:matrix.get(`${focus}\u0000${b.name}`)||0,j})).filter(x=>x.count>0):[];
    const maxFlow=Math.max(1,...flows.map(x=>x.count));
    const curves=focusRow>=0?flows.map(x=>{const y1=ys(focusRow,before.length),y2=ys(x.j,after.length),w=2+12*Math.sqrt(x.count/maxFlow),value=`${focus}\u0001${x.name}`,active=activeTransition&&String(activeTransition.value)===value;return `<g class="obs-flow-link ${active?'is-active':''}" style="${dpeMode?'':vectorColorStyle(focus)}" ${crossAttrs(transitionKey,value,`${label} : ${focus} → ${x.name}`)}><path d="M5 ${y1.toFixed(1)} C135 ${y1.toFixed(1)},265 ${y2.toFixed(1)},395 ${y2.toFixed(1)}" style="--flow-width:${w.toFixed(1)}"></path><text x="200" y="${((y1+y2)/2-5).toFixed(1)}" text-anchor="middle">${fmt(x.count)}</text></g>`;}).join(''):'';
    const rightCounts=new Map(after.map(x=>[x.name,focus?(matrix.get(`${focus}\u0000${x.name}`)||0):x.value]));
    const nodeTitle=name=>{
      const letter=String(name||'').toUpperCase();
      if(dpeMode&&/^[A-G]$/.test(letter)) return `<span class="obs-flow-dpe-name"><i class="obs-dpe-letter dpe-${letter.toLowerCase()}">${letter}</i><em>Classe ${letter}</em></span>`;
      return `<span class="obs-flow-vector-name"><i style="background:${vectorColor(name)}"></i>${esc(name)}</span>`;
    };
    return `<div class="obs-flow-caption"><span>AVANT TRAVAUX</span><b>${focus?`Trajectoires depuis « ${esc(focus)} »`:(dpeMode?'Choisis une classe à gauche':'Choisis un vecteur à gauche')}</b><span>APRÈS TRAVAUX</span></div><div class="obs-flow ${dpeMode?'obs-flow-dpe':''}" style="--flow-h:${H}px">
      <div class="obs-flow-column before">${before.map(x=>`<button type="button" class="obs-flow-node ${dpeMode?'':'obs-vector-node'} ${norm(x.name)===norm(focus)?'is-selected':''}" style="${dpeMode?'':vectorColorStyle(x.name)}" data-flow-focus="${focusKey}" data-flow-before="${attr(encodeURIComponent(x.name))}">${nodeTitle(x.name)}<b>${fmt(x.value)}</b><small>opération${x.value>1?'s':''} avant travaux</small></button>`).join('')}</div>
      <div class="obs-flow-canvas">${focus?`<svg viewBox="0 0 400 ${H}" preserveAspectRatio="none">${curves}</svg>`:`<div class="obs-flow-hint"><b>←</b><span>${dpeMode?'Clique sur une classe avant travaux pour révéler les transitions.':'Clique sur un vecteur avant travaux pour révéler les transitions.'}</span><b>→</b></div>`}</div>
      <div class="obs-flow-column after">${after.map(x=>{const c=rightCounts.get(x.name)||0,value=`${focus}\u0001${x.name}`,active=focus&&activeTransition&&String(activeTransition.value)===value;return `<button type="button" class="obs-flow-node ${dpeMode?'':'obs-vector-node'} ${focus?'is-reachable':''} ${c?'has-value':''} ${active?'is-selected':''}" style="${dpeMode?'':vectorColorStyle(x.name)}" ${focus&&c?crossAttrs(transitionKey,value,`${label} : ${focus} → ${x.name}`):''}>${nodeTitle(x.name)}<b>${fmt(c)}</b><small>${focus?`transition${c>1?'s':''} depuis ${esc(shorten(focus,18))}`:`opération${c>1?'s':''} après travaux`}</small></button>`}).join('')}</div>
    </div>`;
  }

  // V6.13 : signalement des petits échantillons (moyenne affichée mais à lire avec prudence).
  const MIN_SAMPLE=5;
  function lowSample(n){n=Number(n)||0;return n>0&&n<MIN_SAMPLE?` · <b class="obs-low-sample" title="Moins de ${MIN_SAMPLE} valeurs : moyenne peu représentative">⚠ échantillon faible (n = ${fmt(n)})</b>`:'';}
  function averageRaw(ops,key){const vals=ops.map(o=>rawNumber(o,key)).filter(v=>v!==null);return {avg:vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:null,count:vals.length,population:ops.length,coverage:ops.length?100*vals.length/ops.length:0};}
  function averageDpe(ops,key){const vals=ops.map(o=>dpeLetter(o,key)).filter(Boolean).map(l=>'ABCDEFG'.indexOf(l)+1);if(!vals.length)return {avg:null,count:0,label:'—'};const avg=vals.reduce((a,b)=>a+b,0)/vals.length;return {avg,count:vals.length,label:'ABCDEFG'[Math.max(0,Math.min(6,Math.round(avg)-1))]};}

  function dpeVisualSummary(db,da,gb,ga){
    const gainEnergy=(db.avg!==null&&da.avg!==null)?db.avg-da.avg:null, gainGes=(gb.avg!==null&&ga.avg!==null)?gb.avg-ga.avg:null;
    const badge=(letter,kind)=>`<b class="obs-dpe-chevron dpe-${String(letter||'').toLowerCase()} ${kind}">${esc(letter||'—')}</b>`;
    return `<article class="obs-card obs-dpe-hero"><div class="obs-card-head"><div><span>AVANT / APRÈS</span><h2>DPE énergie & GES</h2></div><small>Classes moyennes de la sélection filtrée</small></div><div class="obs-dpe-hero-grid"><section><i class="obs-dpe-hero-icon">ϟ</i><div><span>Classe énergie</span><div class="obs-dpe-route"><small>Avant</small>${badge(db.label,'before')}<em>→</em>${badge(da.label,'after')}<small>Après</small></div><strong>${gainEnergy===null?'Gain non calculable':`Gain ≈ ${fmt(gainEnergy,1)} classe${Math.abs(gainEnergy)>1?'s':''}`}</strong></div></section><section><i class="obs-dpe-hero-icon purple">◒</i><div><span>Classe GES</span><div class="obs-dpe-route"><small>Avant</small>${badge(gb.label,'before')}<em>→</em>${badge(ga.label,'after')}<small>Après</small></div><strong>${gainGes===null?'Gain non calculable':`Gain ≈ ${fmt(gainGes,1)} classe${Math.abs(gainGes)>1?'s':''}`}</strong></div></section></div></article>`;
  }

  function renderCarbon(){
    const ops=filteredTechnicalOperations(), transitionOps=applyMatrixSelection(ops), ice=averageRaw(ops,'icEnergy'), icc=averageRaw(ops,'icConstruction'), db=averageDpe(transitionOps,'dpeEnergyBefore'), da=averageDpe(transitionOps,'dpeEnergyAfter'), gb=averageDpe(transitionOps,'dpeGesBefore'), ga=averageDpe(transitionOps,'dpeGesAfter');
    const iceStats=metricPairStats(ops,'icEnergy','icEnergyMax'), iccStats=metricPairStats(ops,'icConstruction','icConstructionMax');
    return `${pageHead('carbon',`<div class="obs-selection-note">${fmt(ops.length)} opération${ops.length>1?'s':''} technique${ops.length>1?'s':''}</div>`)}${analyticsToolbar()}${kpiGrid([
      {label:'IC Énergie projet moyen',value:ice.avg===null?'—':fmt(ice.avg,1),note:`${fmt(ice.count)} opérations renseignées`,sample:ice.count},
      {label:'IC Énergie sous seuil',value:iceStats.count?`${fmt(iceStats.rate,1)} %`:'—',note:`${fmt(iceStats.under)} / ${fmt(iceStats.count)} comparables`,crossKey:'threshold:icEnergy',crossValue:'under',crossLabel:'IC Énergie sous seuil'},
      {label:'IC Construction projet moyen',value:icc.avg===null?'—':fmt(icc.avg,1),note:`${fmt(icc.count)} opérations renseignées`,sample:icc.count},
      {label:'IC Construction sous seuil',value:iccStats.count?`${fmt(iccStats.rate,1)} %`:'—',note:`${fmt(iccStats.under)} / ${fmt(iccStats.count)} comparables`,crossKey:'threshold:icConstruction',crossValue:'under',crossLabel:'IC Construction sous seuil'}
    ])}
    ${dpeVisualSummary(db,da,gb,ga)}${(matrixSelectionValues('mention').length||matrixSelectionValues('performance').length)?`<div class="obs-dpe-matrix-scope"><b>Périmètre Label & performance</b><span>${esc(matrixSelectionSummary(transitionOps))}</span><small>${fmt(transitionOps.length)} opération${transitionOps.length>1?'s':''} technique${transitionOps.length>1?'s':''} retenue${transitionOps.length>1?'s':''} pour les transitions DPE/GES.</small></div>`:''}
    <div class="obs-section-title"><div><span>01</span><h2>Position des émissions carbone par rapport aux maximums</h2></div><p>Le curseur représente la valeur projet moyenne ; la borne droite représente le maximum moyen renseigné.</p></div>
    <div class="obs-grid-2">
      <article class="obs-card obs-carbon-gauge"><div class="obs-card-head"><div><span>IC ÉNERGIE</span><h2>Projet vs IC Énergie max</h2></div><small>${iceStats.count?`${fmt(iceStats.rate,1)} % sous le seuil`:'maximum non renseigné'}</small></div>${performanceGauge(iceStats,'IC Énergie',{unit:'kgCO₂e/m²',referenceLabel:'IC Énergie max moyen'})}</article>
      <article class="obs-card obs-carbon-gauge"><div class="obs-card-head"><div><span>IC CONSTRUCTION</span><h2>Projet vs IC Construction max</h2></div><small>${iccStats.count?`${fmt(iccStats.rate,1)} % sous le seuil`:'maximum non renseigné'}</small></div>${performanceGauge(iccStats,'IC Construction',{unit:'kgCO₂e/m²',referenceLabel:'IC Construction max moyen'})}</article>
    </div>
    <div class="obs-section-title"><div><span>02</span><h2>DPE avant / après travaux</h2></div><p>Lecture des classes énergie et GES avant et après travaux.</p></div>
    <div class="obs-grid-2"><article class="obs-card obs-flow-card"><div class="obs-card-head"><div><span>DPE ÉNERGIE</span><h2>Classes avant → après travaux</h2></div><small>${db.label} → ${da.label} en moyenne · clique sur une classe à gauche</small></div>${transitionFlow(applyMatrixSelection(filteredTechnicalOperations({ignoreCrossKey:'transition:dpeEnergyBefore:dpeEnergyAfter'})),'dpeEnergyBefore','dpeEnergyAfter','DPE énergie','dpeEnergy')}</article><article class="obs-card obs-flow-card"><div class="obs-card-head"><div><span>DPE GES</span><h2>Classes avant → après travaux</h2></div><small>${gb.label} → ${ga.label} en moyenne · clique sur une classe à gauche</small></div>${transitionFlow(applyMatrixSelection(filteredTechnicalOperations({ignoreCrossKey:'transition:dpeGesBefore:dpeGesAfter'})),'dpeGesBefore','dpeGesAfter','DPE GES','dpeGes')}</article></div>
    <div class="obs-grid-2"><article class="obs-card"><div class="obs-card-head"><div><span>GAIN DPE</span><h2>Évolution énergie</h2></div></div>${dpeGainBars(applyMatrixSelection(filteredOperations({ignoreCrossKey:'dpeGain:energy'})),'energy')}</article><article class="obs-card"><div class="obs-card-head"><div><span>GAIN GES</span><h2>Évolution GES</h2></div></div>${dpeGainBars(applyMatrixSelection(filteredOperations({ignoreCrossKey:'dpeGain:ges'})),'ges')}</article></div>`;
  }

  function numericHistogram(ops,key,label,bins=6){
    const vals=ops.map(o=>rawNumber(o,key)).filter(v=>v!==null);
    if(!vals.length) return '<div class="obs-empty">Aucune valeur numérique disponible.</div>';
    let min=Math.min(...vals),max=Math.max(...vals);
    if(min===max){ const value=`${min}\u0001${max}`;return `<button class="obs-hist-single ${activeCross(`range:${key}`,value)?'is-active':''}" ${crossAttrs(`range:${key}`,value,`${label} : ${fmt(min,1)}`)}><b>${fmt(vals.length)}</b><span>${esc(label)} = ${fmt(min,1)}</span></button>`; }
    const step=(max-min)/bins, ranges=[];
    for(let i=0;i<bins;i++){const lo=min+i*step,hi=i===bins-1?max:min+(i+1)*step;const count=vals.filter(v=>v>=lo&&(i===bins-1?v<=hi:v<hi)).length;ranges.push({lo,hi,count});}
    const peak=Math.max(1,...ranges.map(r=>r.count));
    return `<div class="obs-histogram">${ranges.map((r,i)=>{const value=`${r.lo}\u0001${r.hi}`,active=activeCross(`range:${key}`,value);return `<button class="obs-hist-bin ${active?'is-active':''}" ${crossAttrs(`range:${key}`,value,`${label} : ${fmt(r.lo,1)} – ${fmt(r.hi,1)}`)}><span class="obs-hist-count">${fmt(r.count)}</span><i style="height:${Math.max(6,100*r.count/peak)}%"></i><small>${fmt(r.lo,0)}${i===ranges.length-1?`–${fmt(r.hi,0)}`:''}</small></button>`}).join('')}</div>`;
  }

  function dpeCompare(ops,beforeKey,afterKey,label){
    const letters='ABCDEFG'.split(''), counts=(key)=>Object.fromEntries(letters.map(l=>[l,ops.filter(o=>dpeLetter(o,key)===l).length]));
    const b=counts(beforeKey),a=counts(afterKey),max=Math.max(1,...letters.flatMap(l=>[b[l],a[l]]));
    return `<div class="obs-dpe-compare">${letters.map(l=>`<div class="obs-dpe-row"><b class="obs-dpe-letter dpe-${l.toLowerCase()}">${l}</b><button class="obs-dpe-bar ${activeCross(beforeKey,l)?'is-active':''}" ${crossAttrs(beforeKey,l,`${label} avant : ${l}`)}><span>Avant</span><i style="width:${100*b[l]/max}%"></i><strong>${fmt(b[l])}</strong></button><button class="obs-dpe-bar after ${activeCross(afterKey,l)?'is-active':''}" ${crossAttrs(afterKey,l,`${label} après : ${l}`)}><span>Après</span><i style="width:${100*a[l]/max}%"></i><strong>${fmt(a[l])}</strong></button></div>`).join('')}</div>`;
  }

  function dpeGainBars(ops,type){
    const beforeKey=type==='energy'?'dpeEnergyBefore':'dpeGesBefore', afterKey=type==='energy'?'dpeEnergyAfter':'dpeGesAfter', key=`dpeGain:${type}`;
    const groups=[['2plus','Gain ≥ 2 classes'],['1','Gain de 1 classe'],['stable','Stable'],['worse','Dégradation']].map(([value,name])=>({value,name,count:ops.filter(o=>matchesCross(o,{key,value})).length}));
    const max=Math.max(1,...groups.map(g=>g.count));
    return `<div class="obs-bars">${groups.map(g=>`<button class="obs-bar-row ${activeCross(key,g.value)?'is-active':''}" ${crossAttrs(key,g.value,`${type==='energy'?'DPE énergie':'DPE GES'} : ${g.name}`)}><span>${esc(g.name)}</span><span class="obs-bar-track"><i class="obs-bar-fill" style="width:${Math.max(2,100*g.count/max)}%"></i></span><strong>${fmt(g.count)}</strong></button>`).join('')}</div>`;
  }

  function renderOperations(){
    const ops=filteredOperations(), groupMode=state.operationsEntityView==='groups';
    const toggle=`<label class="obs-entity-switch"><span>Projets</span><input type="checkbox" data-operations-entity-toggle="1" ${groupMode?'checked':''}><i></i><span>Groupes MOA</span></label>`;
    if(groupMode)return `${pageHead('operations',`<div class="obs-selection-note">${fmt(uniq(ops.map(o=>o.moaGroup||'Non précisé')).length)} groupe${uniq(ops.map(o=>o.moaGroup||'Non précisé')).length>1?'s':''}</div>`)}${analyticsToolbar()}<article class="obs-card"><div class="obs-card-head"><div><span>PORTEFEUILLES</span><h2>Vue par groupe MOA</h2></div><div class="obs-card-head-tools">${toggle}</div></div>${moaGroupCards(ops)}</article>`;
    return `${pageHead('operations',`<div class="obs-selection-note">${fmt(ops.length)} projet${ops.length>1?'s':''}</div>`)}${analyticsToolbar()}<article class="obs-card"><div class="obs-card-head"><div><span>DRILL-DOWN</span><h2>Projets de la sélection</h2></div><div class="obs-card-head-tools">${toggle}${tableViewToggle('operations',state.operationsTableView,['list','tiles'])}<button class="obs-card-action" data-export-current="csv">Exporter CSV</button></div></div>${operationsTable(ops)}</article>`;
  }

  function moaGroupCards(ops){
    const map=new Map();(ops||[]).forEach(o=>{const name=o.moaGroup||'Non précisé',k=norm(name);if(!map.has(k))map.set(k,{name,ops:[],moas:new Set(),dwellings:0,buildings:0});const g=map.get(k);g.ops.push(o);if(o.moa)g.moas.add(o.moa);g.dwellings+=Number(o.dwellings)||0;g.buildings+=Number(o.buildings)||0;});
    const rows=[...map.values()].sort((a,b)=>b.ops.length-a.ops.length||a.name.localeCompare(b.name,'fr'));
    if(!rows.length)return '<div class="obs-empty">Aucun groupe MOA dans cette sélection.</div>';
    return `<div class="obs-moa-group-grid">${rows.map(g=>`<button type="button" class="obs-moa-group-card" data-moa-group-card="${attr(g.name)}"><span>GROUPE MOA</span><strong>${esc(g.name)}</strong><div><b>${fmt(g.moas.size)}<small>MOA</small></b><b>${fmt(g.ops.length)}<small>projets</small></b><b>${fmt(g.dwellings)}<small>logements</small></b></div><footer>Ouvrir la fiche groupe →</footer></button>`).join('')}</div>`;
  }

  function operationsTable(ops){
    if(!ops.length)return '<div class="obs-empty">Aucun projet ne correspond aux filtres actuels.</div>';
    const model=paged(ops,state.operationsPage,15);state.operationsPage=model.page;
    if(state.operationsTableView==='tiles'){
      return `<div class="obs-operation-tiles">${model.items.map(o=>`<button type="button" class="obs-operation-tile" data-op-code="${attr(o.code)}"><span class="obs-operation-tile-code">Projet · ${esc(o.code)}</span><strong>${esc(o.name)}</strong><small>${esc(o.moa)}</small><div><span>⌖ ${esc([o.city,departmentName(o.department)].filter(Boolean).join(' · '))}</span><span>◆ ${esc(o.referential)}</span></div><footer><span class="obs-pill ${o.status==='cancelled'?'red':(o.status==='incomplete'?'warn':'')}">${esc(o.rawStatus||STATUS_LABELS[o.status]||o.status)}</span><b>${fmt(o.dwellings)} lgts</b></footer></button>`).join('')}</div>${paginationHtml('operations',model)}`;
    }
    return `<div class="obs-table-wrap"><table class="obs-table"><thead><tr><th>Code</th><th>Projet</th><th>MOA</th><th>Localisation</th><th>Référentiel</th><th>Avancement</th><th>Logements</th></tr></thead><tbody>${model.items.map(o=>`<tr data-op-code="${attr(o.code)}"><td><strong>${esc(o.code)}</strong></td><td>${esc(o.name)}</td><td>${esc(o.moa)}</td><td>${esc([o.city,departmentName(o.department)].filter(Boolean).join(' · '))}</td><td>${esc(o.referential)}</td><td><span class="obs-pill ${o.status==='cancelled'?'red':(o.status==='incomplete'?'warn':'')}">${esc(o.rawStatus||STATUS_LABELS[o.status]||o.status)}</span></td><td>${fmt(o.dwellings)}</td></tr>`).join('')}</tbody></table>${paginationHtml('operations',model)}</div>`;
  }

  const CROSS_METRICS=['dwellings','buildings','bbio','bbioMax','cep','cepMax','dh','dhMax','ubatBefore','ubatAfter','roofR','wallR','floorR','icEnergy','icEnergyMax','icConstruction','icConstructionMax'];
  function crossMetricOptions(selected){return CROSS_METRICS.filter(k=>core?.dictByKey?.[k]).map(k=>`<option value="${attr(k)}" ${selected===k?'selected':''}>${esc(core.dictByKey[k].label)}</option>`).join('');}
  function scatterPlot(ops){
    const pts=ops.map(op=>({op,x:rawNumber(op,state.crossX),y:rawNumber(op,state.crossY),band:core?.carbonBand?.(op)})).filter(p=>p.x!==null&&p.y!==null);
    if(!pts.length)return '<div class="obs-empty">Aucune opération ne possède simultanément les deux indicateurs sélectionnés.</div>';
    const W=940,H=520,pad={l:72,r:30,t:30,b:64};let minX=Math.min(...pts.map(p=>p.x)),maxX=Math.max(...pts.map(p=>p.x)),minY=Math.min(...pts.map(p=>p.y)),maxY=Math.max(...pts.map(p=>p.y));if(minX===maxX){minX-=1;maxX+=1}if(minY===maxY){minY-=1;maxY+=1};const dx=(maxX-minX)*.06,dy=(maxY-minY)*.08;minX-=dx;maxX+=dx;minY-=dy;maxY+=dy;const sx=v=>pad.l+(v-minX)/(maxX-minX)*(W-pad.l-pad.r),sy=v=>H-pad.b-(v-minY)/(maxY-minY)*(H-pad.t-pad.b);
    const xDef=core.dictByKey[state.crossX],yDef=core.dictByKey[state.crossY];let grid='';for(let i=0;i<=5;i++){const gx=pad.l+i*(W-pad.l-pad.r)/5,gy=pad.t+i*(H-pad.t-pad.b)/5;const xv=minX+i*(maxX-minX)/5,yv=maxY-i*(maxY-minY)/5;grid+=`<line x1="${gx}" y1="${pad.t}" x2="${gx}" y2="${H-pad.b}"/><text x="${gx}" y="${H-34}" text-anchor="middle">${fmt(xv,1)}</text><line x1="${pad.l}" y1="${gy}" x2="${W-pad.r}" y2="${gy}"/><text x="${pad.l-10}" y="${gy+4}" text-anchor="end">${fmt(yv,1)}</text>`;}
    return `<div class="obs-scatter-wrap"><svg class="obs-scatter" viewBox="0 0 ${W} ${H}" role="img" aria-label="Nuage de points ${attr(xDef?.label||state.crossX)} et ${attr(yDef?.label||state.crossY)}"><g class="obs-scatter-grid">${grid}</g><text class="obs-scatter-axis" x="${W/2}" y="${H-7}" text-anchor="middle">${esc(xDef?.label||state.crossX)}${xDef?.unit?` · ${esc(xDef.unit)}`:''}</text><text class="obs-scatter-axis" transform="translate(18 ${H/2}) rotate(-90)" text-anchor="middle">${esc(yDef?.label||state.crossY)}${yDef?.unit?` · ${esc(yDef.unit)}`:''}</text><g>${pts.map(p=>`<circle class="obs-scatter-point" data-scatter-op="${attr(p.op.code)}" data-scatter-project="${attr(p.op.projectCode||p.op.code)}" cx="${sx(p.x).toFixed(1)}" cy="${sy(p.y).toFixed(1)}" r="7" fill="${p.band?.color||'#9AA8A2'}"><title>${esc(p.op.name)} · ${esc(xDef?.label||state.crossX)} ${fmt(p.x,2)} · ${esc(yDef?.label||state.crossY)} ${fmt(p.y,2)} · ${esc(p.band?.label||'')}</title></circle>`).join('')}</g></svg></div>`;
  }
  function renderCrossData(){
    const ops=filteredTechnicalOperations(), t2028=core?.carbonThresholds?.(ops.find(o=>rawNumber(o,'icConstruction')!==null)||{})?.y2028??589.63,t2031=core?.carbonThresholds?.(ops.find(o=>rawNumber(o,'icConstruction')!==null)||{})?.y2031??498.16;
    return `${pageHead('crossdata',`<div class="obs-selection-note">${fmt(ops.length)} opération${ops.length>1?'s':''} technique${ops.length>1?'s':''}</div>`)}${analyticsToolbar()}<article class="obs-card"><div class="obs-card-head"><div><span>NUAGE DE POINTS</span><h2>Croisement libre de deux indicateurs</h2></div><div class="obs-cross-selectors"><label>Axe X<select data-cross-metric="x">${crossMetricOptions(state.crossX)}</select></label><label>Axe Y<select data-cross-metric="y">${crossMetricOptions(state.crossY)}</select></label></div></div><div class="obs-carbon-band-legend"><span><i style="background:#C94C4C"></i>Niveau courant → seuil 2028</span><span><i style="background:#2C6E9B"></i>2028 → 2031</span><span><i style="background:#168456"></i>Niveau 2031 atteint / dépassé</span><small>Seuils détectés automatiquement : 2028 ${fmt(t2028,2)} · 2031 ${fmt(t2031,2)} kgCO₂e/m². La performance carbone est meilleure quand l’IC Construction diminue.</small></div>${scatterPlot(ops)}<div class="obs-scatter-help">Clique sur un point pour ouvrir à droite la fiche de l’opération technique correspondante.</div></article>`;
  }

  function renderDictionary(){
    return `${pageHead('dictionary')}<article class="obs-card"><div class="obs-card-head"><div><span>RÉFÉRENTIEL DES DONNÉES</span><h2>Définitions, calculs et règles de lecture</h2></div><small>${fmt((core?.dictionary||[]).length)} variables documentées</small></div><div class="obs-dictionary-help"><b>Comment lire ce dictionnaire ?</b><span>Chaque ligne précise ce que mesure la donnée, son unité, sa source et la règle appliquée par l’Observatoire Prestaterre. Les données calculées ou normalisées sont explicitement distinguées des données sources.</span></div>${dictionaryTable()}</article>`;
  }


  function qualityIssueTable(ops){
    if(!core?.qualitySummary)return '<div class="obs-empty">Moteur qualité indisponible.</div>';
    const q=core.qualitySummary(ops), rows=[];q.reports.forEach(({op,report})=>report.issues.filter(i=>i.severity!=='info').forEach(i=>rows.push({op,issue:i})));
    const model=paged(rows,state.qualityIssuePage,15);state.qualityIssuePage=model.page;
    if(!rows.length)return '<div class="obs-empty obs-quality-ok">✓ Aucun contrôle bloquant ou avertissement détecté sur la sélection.</div>';
    return `<div class="obs-table-wrap"><table class="obs-table"><thead><tr><th>Niveau</th><th>Projet</th><th>Contrôle</th><th>Action</th></tr></thead><tbody>${model.items.map(x=>`<tr><td><span class="obs-quality-severity ${x.issue.severity}">${x.issue.severity==='error'?'Erreur':'Alerte'}</span></td><td><strong>${esc(x.op.code)}</strong><br><small>${esc(x.op.name)}</small></td><td>${esc(x.issue.label)}</td><td><button type="button" class="obs-link-btn" data-op-code="${attr(x.op.code)}">Ouvrir la fiche</button></td></tr>`).join('')}</tbody></table>${paginationHtml('quality-issues',model)}</div>`;
  }
  function coverageRows(projects,technicalOps){
    const projectKeys=['moa','department','referential','dwellings','buildings'];
    const technicalKeys=['bbio','cep','dh','roofR','wallR','floorR','icEnergy','icConstruction','dpeEnergyBefore','dpeEnergyAfter'];
    return [...projectKeys.map(key=>({key,populationType:'Projet',...core.coverage(projects,key)})),...technicalKeys.map(key=>({key,populationType:'Opération technique',...core.coverage(technicalOps,key)}))].map(c=>({...c,label:core.dictByKey[c.key]?.label||c.key})).sort((a,b)=>a.rate-b.rate);
  }
  function dictionaryReading(d){
    const k=d?.key||'';
    if(['bbio','cep','dh','icEnergy','icConstruction'].includes(k))return 'Comparer au seuil/max associé. Une valeur inférieure au seuil est plus performante ou conforme au critère considéré.';
    if(['bbioMax','cepMax','dhMax','icEnergyMax','icConstructionMax','icConstruction2028','icConstruction2031'].includes(k))return 'Valeur de référence/seuil : elle sert de borne de comparaison, pas de performance projet.';
    if(['roofR','wallR','floorR'].includes(k))return 'Plus R est élevé, plus la résistance thermique de la paroi est importante.';
    if(['ubatBefore','ubatAfter'].includes(k))return 'Plus Ubat est faible, plus l’enveloppe est performante thermiquement.';
    if(k.startsWith('dpe'))return 'Classe A = meilleure performance ; classe G = moins bonne. Lire avant/après pour mesurer l’évolution.';
    if(k==='dwellings'||k==='buildings')return 'Effectif brut du projet ; les agrégats généraux de l’Observatoire Prestaterre dédupliquent les projets par Code interne.';
    if(k==='status')return 'Étape de la colonne BC (8 étapes, dont Proposition commerciale en cours pour les lignes sans code interne) ; les affaires perdues/abandonnées/annulées restent hors statistiques actives.';
    return d?.type==='calculated'?'Valeur calculée par l’Observatoire Prestaterre à partir des données sources et des règles documentées.':'Valeur issue de la source ; l’interpréter selon sa définition, son unité et le périmètre filtré.';
  }
  function dictionaryTable(){
    const q=norm(state.dictionarySearch), rows=(core?.dictionary||[]).filter(d=>!q||norm([d.label,d.key,d.definition,d.source,d.unit,d.method,dictionaryReading(d)].join(' ')).includes(q));
    const model=paged(rows,state.dictionaryPage,15);state.dictionaryPage=model.page;
    return `<div class="obs-table-searchbar"><input type="search" data-table-search="dictionary" value="${attr(state.dictionarySearch)}" placeholder="Rechercher une donnée, une unité, une source…"><span>${fmt(rows.length)} définition${rows.length>1?'s':''}</span></div><div class="obs-table-wrap"><table class="obs-table obs-dictionary"><thead><tr><th>Donnée</th><th>Définition</th><th>Source</th><th>Unité</th><th>Calcul / traitement</th><th>Comment lire</th></tr></thead><tbody>${model.items.map(d=>`<tr><td><strong>${esc(d.label)}</strong><br><small>${esc(d.key)}</small></td><td>${esc(d.definition)}</td><td>${esc(d.source)}</td><td>${esc(d.unit||'—')}</td><td>${esc(d.method)}</td><td>${esc(dictionaryReading(d))}</td></tr>`).join('')}</tbody></table>${paginationHtml('dictionary',model)}</div>`;
  }
  function renderQuality(){
    const ops=filteredOperations(), technicalOps=filteredTechnicalOperations(), q=core?.qualitySummary?core.qualitySummary(ops):{avgScore:0,errors:0,warnings:0,withIssues:0}, cov=core?coverageRows(ops,technicalOps):[],dup=core?.duplicateSummary?.(ops)||{duplicateCodes:0,duplicateNames:0},geo=core?.geoIssues?.(ops)||0;
    const thresholdIssues=q.reports?.reduce((n,r)=>n+r.report.issues.filter(i=>String(i.code||'').startsWith('threshold:')).length,0)||0;
    return `${pageHead('quality')}${analyticsToolbar()}${kpiGrid([{label:'Complétude / cohérence',value:`${fmt(q.avgScore,0)} %`,note:'indice transparent basé sur contrôles',metric:''},{label:'Projets avec anomalie',value:fmt(q.withIssues),note:`sur ${fmt(ops.length)} projets`,metric:''},{label:'Doublons potentiels',value:fmt(dup.duplicateCodes+dup.duplicateNames),note:`${fmt(dup.duplicateCodes)} codes · ${fmt(dup.duplicateNames)} noms`,metric:''},{label:'Incohérences géographiques',value:fmt(geo),note:'code postal / département',metric:''}])}<div class="obs-quality-checks"><div><span>Seuils dépassés / incohérents</span><b>${fmt(thresholdIssues)}</b><small>énergie, confort ou carbone</small></div><div><span>Erreurs bloquantes</span><b>${fmt(q.errors)}</b><small>données essentielles manquantes</small></div><div><span>Alertes</span><b>${fmt(q.warnings)}</b><small>valeurs atypiques ou cohérence</small></div></div><div class="obs-grid-2wide"><article class="obs-card"><div class="obs-card-head"><div><span>COUVERTURE STATISTIQUE</span><h2>Disponibilité des indicateurs</h2></div><small>${fmt(ops.length)} projets · ${fmt(technicalOps.length)} opérations techniques</small></div><div class="obs-coverage-list">${cov.map(c=>`<button type="button" class="obs-coverage-row" data-audit-label="${attr(c.label)}" data-audit-metric="${attr(c.key)}"><span><b>${esc(c.label)}</b><small>${esc(c.populationType)} · ${fmt(c.available)} renseignées · ${fmt(c.missing)} manquantes</small></span><i><em style="width:${Math.max(0,Math.min(100,c.rate)).toFixed(1)}%"></em></i><strong>${fmt(c.rate,1)} %</strong></button>`).join('')}</div></article><article class="obs-card"><div class="obs-card-head"><div><span>RÈGLES DE FIABILITÉ</span><h2>Contrôles automatiques</h2></div><small>15 lignes par page</small></div>${qualityIssueTable(ops)}</article></div><div class="obs-grid-2wide">${progressQualityCard(ops)}${unreadableValuesCard(ops)}</div>`;
  }
  // V6.13 : contrôle de la colonne d'avancement (liste fermée).
  function progressQualityCard(ops){
    const d=runtime().progress||null, pct1=v=>fmt(100*(Number(v)||0),1);
    const empty=ops.filter(o=>o.status==='unknown'&&o.progressState!=='invalid').length, invalidOps=ops.filter(o=>o.progressState==='invalid');
    const counts=PROGRESS_ORDER.map(k=>({k,v:ops.filter(o=>o.status===k).length}));
    const head=`<div class="obs-card-head"><div><span>AVANCEMENT</span><h2>Colonne « ${esc(RULES?.PROGRESS_SOURCE_HEADER||'Opération: Évaluation: Statut')} »</h2></div><small>valeurs admises : ${esc(PROGRESS_ORDER.map(k=>STATUS_LABELS[k]).join(' · '))}</small></div>`;
    if(!d) return `<article class="obs-card">${head}<div class="obs-empty">Aucun diagnostic disponible (source non connectée).</div></article>`;
    const status=d.found?`<p class="obs-progress-diag ${d.warning?'is-warn':'is-ok'}"><b>Colonne utilisée : « ${esc(d.header)} »${d.column?` · colonne ${esc(d.column)} de la Sheet`:''}</b>${d.ratio!==undefined?` · ${pct1(d.ratio)} % des valeurs reconnues`:''}${d.origin&&d.origin!=='nom attendu'?` · détectée par ${esc(d.origin)}`:''}${d.warning?`<br>${esc(d.message)}`:''}</p>`:`<p class="obs-progress-diag is-error"><b>${esc(d.message||'Colonne d’avancement non trouvée.')}</b><br>L’avancement est affiché « Non renseigné » tant que la colonne n’est pas corrigée dans la Google Sheet.</p>`;
    const rejected=(d.checked||[]).filter(c=>c.header!==d.header);
    const rejectedHtml=rejected.length?`<p class="obs-progress-diag is-warn">Colonne${rejected.length>1?'s':''} écartée${rejected.length>1?'s':''} : ${rejected.map(c=>`« ${esc(c.header)} » (${pct1(c.ratio)} % conformes${c.invalidValues?.length?`, ex. ${esc(c.invalidValues.slice(0,3).map(x=>x.value).join(', '))}`:''})`).join(' ; ')}</p>`:'';
    const invalidByValue=countBy(invalidOps,o=>o.rawStatus||'(vide)').slice(0,8);
    const invalidHtml=invalidOps.length?`<p class="obs-progress-diag is-warn"><b>${fmt(invalidOps.length)} projet${invalidOps.length>1?'s':''} avec une valeur hors liste</b> : ${invalidByValue.map(x=>`« ${esc(x.name)} » ×${fmt(x.value)}`).join(' · ')}</p>`:'';
    const y=runtime().years||null, yearLine=(diag,label,expected)=>diag?.header?`<b>${label}</b> : colonne « ${esc(diag.header)} »${diag.column?` (${esc(diag.column)})`:''}`:`<b>${label}</b> : colonne « ${esc(expected)} » ${diag?.match==='ambigu'?'ambiguë (plusieurs colonnes possibles)':'introuvable'}`;
    const yearsHtml=y?`<p class="obs-progress-diag ${y.certification?.header&&y.created?.header?'':'is-warn'}">${yearLine(y.certification,'Année de certification',RULES?.CERTIFICATION_DATE_HEADER||'Date de décision de certification')}<br>${yearLine(y.created,'Année de création',RULES?.CREATION_DATE_HEADER||'Date de création')}</p>`:'';
    const rec=d.reconciliation, rc=d.rowCounts||null, fbCol=d.fallback?.column||'AV', fbHead=d.fallback?.header||'État du dossier';
    const recHtml=rec&&rc?`<div class="obs-progress-recon"><h3>Contrôle ligne à ligne de l’avancement</h3><p class="obs-progress-diag">Pour comparer avec la Google Sheet : filtre la colonne ${esc(d.column||'BC')} (puis « ${esc(fbHead)} », colonne ${esc(fbCol)}, pour les lignes dont BC est vide) et compte les lignes par valeur. Les deux colonnes sont complémentaires : BC pour les opérations avec code interne, « ${esc(fbHead)} » pour les lignes historiques.</p><div class="obs-table-wrap"><table class="obs-table obs-progress-recon-table"><thead><tr><th>Avancement lu</th><th>Lignes en ${esc(d.column||'BC')}</th><th>Lignes en ${esc(fbCol)} (${esc(fbHead)})</th><th>Lignes sans avancement</th><th>Projets</th><th>dont annulés / abandonnés</th><th>Dans le tunnel</th></tr></thead><tbody>${(()=>{const all=sourceOperations(),cells=k=>{const p=all.filter(o=>o.status===k),x=p.filter(o=>o.analysisExcluded).length;return `<td>${fmt(p.length)}</td><td>${fmt(x)}</td><td><b>${fmt(p.length-x)}</b></td>`;};const rows=PROGRESS_ORDER.map(k=>`<tr class="${k==='proposal'?'is-proposal':''}"><td>${esc(STATUS_LABELS[k])}</td><td>${k==='proposal'?'—':fmt(rc.primary[k]||0)}</td><td>${k==='proposal'?'—':fmt(rc.fallback[k]||0)}</td><td>${k==='proposal'?fmt(rc.proposal):'—'}</td>${cells(k)}</tr>`);rows.push(`<tr class="is-unknown"><td>Non renseigné</td><td>${fmt(rc.invalidTotals?.primary||0)}</td><td>${fmt(rc.invalidTotals?.fallback||0)}</td><td>${fmt(rc.emptyCoded)}</td>${cells('unknown')}</tr>`);return rows.join('');})()}</tbody></table></div><p class="obs-progress-diag">« Lignes en ${esc(d.column||'BC')} » doit correspondre exactement au filtre de la colonne ${esc(d.column||'BC')} dans la Sheet. « Proposition commerciale en cours » = ligne sans code interne <b>et</b> sans avancement ni en ${esc(d.column||'BC')} ni en ${esc(fbCol)}. « Non renseigné » = ligne avec code interne mais sans avancement exploitable. Le tunnel compte des <b>projets</b> (un code interne = un projet) et retire les affaires annulées ou abandonnées (colonne Statut).</p>
      ${(rc.invalidValues.primary.length||rc.invalidValues.fallback.length)?`<p class="obs-progress-diag is-warn"><b>Valeurs non reconnues</b> : ${[...rc.invalidValues.primary.map(v=>`${esc(d.column||'BC')} « ${esc(v.value)} » ×${fmt(v.count)}`),...rc.invalidValues.fallback.map(v=>`${esc(fbCol)} « ${esc(v.value)} » ×${fmt(v.count)}`)].join(' · ')}</p>`:''}
      <ol class="obs-progress-steps"><li><b>${fmt(rec.sourceRows)}</b> lignes lues dans la Sheet, dont <b>${fmt(rec.rowsWithoutCode)}</b> sans code interne (${fmt(rc.noCodeFromFallback)} ont leur avancement dans « ${esc(fbHead)} », ${fmt(rc.proposal)} n’en ont aucun)</li><li><b>${fmt(rec.projects)}</b> projets après regroupement par code interne (sans code : par numéro de contrat)${rec.multiRowProjects?` (${fmt(rec.multiRowProjects)} projets ont plusieurs lignes : leur avancement global est l’étape la moins avancée de leurs lignes ; la fiche détaillée de chaque opération garde le statut exact de sa ligne)`:''}</li><li><b>${fmt(rec.excludedProjects)}</b> projets perdus / abandonnés / annulés (colonne Statut), hors tunnel</li><li><b>${fmt(rec.projects-rec.excludedProjects)}</b> projets dans le tunnel d’avancement (avant filtres)</li></ol>
      ${rec.conflictCount?`<p class="obs-progress-diag is-warn"><b>${fmt(rec.conflictCount)} projet${rec.conflictCount>1?'s':''} avec des statuts différents selon les lignes</b> : ${rec.conflicts.slice(0,12).map(c=>`${esc(c.code)} (${c.keys.map(k=>esc(STATUS_LABELS[k]||k)).join(' / ')} → retenu : ${esc(STATUS_LABELS[c.retained]||c.retained)})`).join(' · ')}${rec.conflictCount>12?' …':''}</p>`:''}
      <p class="obs-progress-diag"><button type="button" class="obs-card-action" data-copy-progress-report>Copier le diagnostic de l’avancement</button> <small data-copy-progress-report-status></small></p></div>`:'';

    return `<article class="obs-card obs-progress-card">${head}${status}${rejectedHtml}${invalidHtml}${recHtml}${yearsHtml}<div class="obs-progress-counts">${counts.map(c=>`<span><i style="background:${STATUS_COLORS[c.k]}"></i>${esc(STATUS_LABELS[c.k])}<b>${fmt(c.v)}</b></span>`).join('')}<span><i style="background:${STATUS_COLORS.unknown}"></i>Non renseigné<b>${fmt(empty)}</b></span></div></article>`;
  }
  // V6.13.6 : texte de diagnostic compact (sans URL ni donnée client) à copier-coller pour le support.
  function progressReportText(){
    const rt=runtime(),d=rt.progress||{},rec=d.reconciliation||{},rc=d.rowCounts||{},fb=d.fallback||{},sm=rt.sourceMeta||{};
    const all=engine.getOperations?engine.getOperations():[], a=engine.aggregateTunnel(all);
    const line=(label,obj)=>`${label} : ${PROGRESS_ORDER.map(k=>`${STATUS_LABELS[k]} ${obj?.[k]||0}`).join(' | ')}`;
    const lst=v=>(v||[]).map(x=>`« ${x.value} » ×${x.count}`).join(', ')||'aucune';
    return [
      'DIAGNOSTIC AVANCEMENT — Observatoire '+(document.querySelector('.obs-version b')?.textContent||''),
      `Navigateur : ${navigator.userAgent}`,
      `Source : ${rt.mode||'?'} ; en-têtes ligne ${sm.headerRow||'?'} ; 1re ligne de données ${sm.firstDataRow||'?'} ; chargé le ${rt.lastLoadedAt||'?'}`,
      `Lignes lues : ${rec.sourceRows??'?'} ; projets : ${rec.projects??'?'} ; lignes sans code interne : ${rec.rowsWithoutCode??'?'}`,
      `Colonne principale : ${d.header?`« ${d.header} » colonne ${d.column||'?'} (${d.ratio!==undefined?Math.round(d.ratio*100):'?'} % reconnu)`:'INTROUVABLE'}${d.warning?' — ALERTE : '+d.message:''}`,
      `Colonne de repli : ${fb.header?`« ${fb.header} » colonne ${fb.column||'?'}`:'INTROUVABLE'}`,
      line('Lu en colonne principale (lignes)',rc.primary),
      line('Lu en colonne de repli (lignes)',rc.fallback),
      `Sans code ni avancement (→ proposition commerciale) : ${rc.proposal??'?'} ; avec code sans avancement : ${rc.emptyCoded??'?'}`,
      `Valeurs non reconnues colonne principale : ${lst(rc.invalidValues?.primary)}`,
      `Valeurs non reconnues colonne de repli : ${lst(rc.invalidValues?.fallback)}`,
      line('Tunnel (projets actifs)',a.counts)+` | Non renseigné ${a.unknown||0} | Annulés/abandonnés/perdus ${a.cancelled||0}`,
      `Projets à plusieurs lignes : ${rec.multiRowProjects??'?'} ; avec statuts différents : ${rec.conflictCount??'?'}`
    ].join('\n');
  }

  // V6.13 : valeurs numériques présentes mais illisibles (jamais converties en chiffre).
  function unreadableValuesCard(ops){
    const list=[];
    if(core?.unreadableValues&&core?.numericKeys)ops.forEach(o=>core.numericKeys.forEach(k=>core.unreadableValues(o,k).forEach(u=>list.push({...u,code:o.code,label:core.dictByKey?.[k]?.label||core.dateKeys?.[k]||k}))));
    const byField=countBy(list,u=>u.label).slice(0,10);
    const head=`<div class="obs-card-head"><div><span>LECTURE DES NOMBRES</span><h2>Valeurs non interprétées</h2></div><small>${fmt(list.length)} cellule${list.length>1?'s':''} exclue${list.length>1?'s':''} des moyennes</small></div>`;
    if(!list.length) return `<article class="obs-card">${head}<div class="obs-empty">Toutes les valeurs numériques renseignées sont lisibles.</div></article>`;
    const rows=list.slice(0,40).map(u=>`<tr><td><strong>${esc(u.code)}</strong>${u.row>1?`<br><small>ligne ${fmt(u.row)}</small>`:''}</td><td>${esc(u.label)}</td><td><code>${esc(u.raw)}</code></td><td>${esc(u.reason)}</td></tr>`).join('');
    return `<article class="obs-card">${head}<p class="obs-progress-diag">${byField.map(x=>`${esc(x.name)} : <b>${fmt(x.value)}</b>`).join(' · ')}</p><div class="obs-table-wrap"><table class="obs-table"><thead><tr><th>Projet</th><th>Donnée</th><th>Valeur saisie</th><th>Raison</th></tr></thead><tbody>${rows}</tbody></table>${list.length>40?`<p class="obs-progress-diag">… et ${fmt(list.length-40)} autres. Corriger la Google Sheet puis actualiser.</p>`:''}</div></article>`;
  }


  function renderReports(){
    return `${pageHead('reports')}<div class="obs-report-cards"><article class="obs-report-card"><div class="icon">▣</div><h3>Générateur de rapports</h3><p>Retrouver le générateur V29.7.13 complet : slides 16:9, présentation et exports PNG / SVG / PDF.</p><button data-open-generator="1">Ouvrir le générateur ↗</button></article><article class="obs-report-card"><div class="icon">⇩</div><h3>Exporter la sélection</h3><p>Exporter les opérations correspondant aux filtres globaux et analytiques actuels pour retraitement dans Excel.</p><button data-export-current="csv">Exporter CSV</button></article><article class="obs-report-card"><div class="icon">⌁</div><h3>Source projets / opérations</h3><p>Connecter ou actualiser le Google Sheet / Apps Script commun à l’Observatoire et au générateur.</p><button data-open-source="1">Gérer la source</button></article><article class="obs-report-card"><div class="icon">▤</div><h3>Source exigences</h3><p>La rubrique Exigences dispose de sa propre source Google Sheet et lit exclusivement l’onglet RAPPORT.</p><button data-page-link="requirements">Ouvrir Exigences →</button></article></div>`;
  }

  function renderPage(options={}){
    const scrollSnapshot=captureUiScroll();
    const renderers={overview:renderOverview,territories:renderTerritories,stakeholders:renderStakeholders,certification:renderCertification,performance:renderPerformance,requirements:()=>window.NEWOSB_REQUIREMENTS?.render?.()||'<div class="obs-empty">Module Exigences indisponible.</div>',solutions:renderSolutions,energy:renderEnergy,carbon:renderCarbon,crossdata:renderCrossData,presentation:renderPresentation,operations:renderOperations,quality:renderQuality,dictionary:renderDictionary,reports:renderReports};
    state.renderToken++;
    const token=state.renderToken;
    pageEl.innerHTML=(renderers[state.page]||renderOverview)();
    pageEl.querySelectorAll('button:not([type])').forEach(btn=>btn.type='button');
    decoratePresentationButtons();
    decorateAuditButtons();
    const requirementsMode=state.page==='requirements';
    const isolatedMode=requirementsMode||state.page==='presentation';
    const filterWrap=document.querySelector('.obs-filterbar-wrap'); if(filterWrap)filterWrap.hidden=isolatedMode;
    const topSearch=searchEl?.closest('.obs-search'); if(topSearch)topSearch.hidden=isolatedMode;
    if(demoBanner) demoBanner.hidden=isolatedMode ? true : runtime().connected;
    if(!isolatedMode){ countEl.textContent=fmt(filteredOperations().length); renderFilterDependencies(); }
    restoreUiScroll(scrollSnapshot);
    if(state.page==='territories') hydrateTerritoryMap(token);
    if(requirementsMode) window.NEWOSB_REQUIREMENTS?.afterRender?.();
  }

  function filterOptions(){
    const ops=baseOperations(), selectedRegions=globalFilterValues('region');
    const depOps=selectedRegions.length?ops.filter(o=>selectedRegions.some(r=>norm(operationRegion(o))===norm(r))):ops;
    return {
      year:uniq(ops.map(o=>o.year)).filter(v=>String(v).trim()!=='').sort((a,b)=>Number(a)-Number(b)), createdYear:uniq(ops.map(o=>o.createdYear)).filter(v=>String(v).trim()!=='').sort((a,b)=>Number(a)-Number(b)), referential:uniq(ops.map(o=>o.referential)), moaGroup:uniq(ops.map(o=>o.moaGroup||'Non précisé')),
      status:[...PROGRESS_ORDER,'unknown'].filter(k=>ops.some(o=>o.status===k)), moa:uniq(ops.map(o=>o.moa)), region:uniq(ops.map(o=>operationRegion(o))), department:uniq(depOps.map(o=>o.department)).sort((a,b)=>String(a).localeCompare(String(b),'fr',{numeric:true})),
      profile:uniq(ops.map(o=>o.profile||'Non précisé')), socialZone:uniq(ops.map(o=>o.socialZone||'Non précisé'))
    };
  }
  function syncMoaSelectionFromGroups(){
    const selectedGroups=globalFilterValues('moaGroup');
    const previousAuto=new Set((state.autoMoaFromGroup||[]).map(norm));
    const manual=globalFilterValues('moa').filter(m=>!previousAuto.has(norm(m)));
    const auto=selectedGroups.length?uniq(baseOperations().filter(o=>selectedGroups.some(g=>norm(g)===norm(o.moaGroup||'Non précisé'))).map(o=>o.moa).filter(Boolean)):[];
    state.autoMoaFromGroup=auto;
    state.filters.moa=uniq([...manual,...auto]);
  }

  function reconcileTerritoryGlobalFilters(changedKey){
    if(changedKey!=='region')return;
    const validDeps=filterOptions().department||[];
    state.filters.department=globalFilterValues('department').filter(d=>validDeps.some(v=>String(v)===String(d)));
    const regions=globalFilterValues('region');
    if(regions.length===1){focusTerritoryRegion(regions[0]);state.mapOperationGrouping='department';state.territorySummaryPage=1;state.territoryPage=1;}else{resetTerritoryMapFocus();state.mapOperationGrouping='region';}
  }

  function globalFilterSummary(key){
    const vals=globalFilterValues(key);
    if(!vals.length)return 'Tous';
    if(vals.length===1)return String(vals[0]);
    return `${vals.length} sélectionnés`;
  }
  function renderFilters(){
    const scrollSnapshot=captureUiScroll();
    const options=filterOptions();
    const defs=[['year','Année certification',v=>v],['createdYear','Année de création',v=>v],['referential','Référentiel',v=>v],['moaGroup','Groupe MOA',v=>v],['status','Avancement',v=>STATUS_LABELS[v]||v],['moa','Maître d’ouvrage',v=>v],['region','Région',v=>v],['department','Département',v=>`${v} · ${departmentName(v)}`],['profile','Profil',v=>v],['socialZone','Zonage',v=>v]];
    filtersEl.innerHTML=defs.map(([key,label,labeller])=>{
      const values=options[key]||[],selected=globalFilterValues(key),query=norm(state.filterSearch?.[key]||'');
      const placeholder=`Rechercher dans ${String(label).toLowerCase()}…`;
      const search=`<label class="obs-check-search"><span>⌕</span><input type="search" data-global-filter-search="${key}" value="${attr(state.filterSearch?.[key]||'')}" placeholder="${attr(placeholder)}" autocomplete="off"></label>`;
      return `<details class="obs-check-filter ${selected.length?'has-selection':''}" ${state.openGlobalFilter===key?'open':''}><summary><span>${esc(label)}</span><b>${esc(selected.length===1?labeller(selected[0]):globalFilterSummary(key))}</b></summary><div class="obs-check-menu" data-scroll-key="global-filter-${key}">${search}<div class="obs-check-actions"><button type="button" data-global-filter-all="${key}">Tout cocher</button><button type="button" data-global-filter-clear="${key}">Effacer</button></div>${values.length?values.map(v=>{const text=labeller(v),hidden=query&&!norm(text).includes(query);return `<label data-filter-option="${key}" class="${hidden?'is-search-hidden':''}" ${hidden?'hidden':''}><input type="checkbox" data-global-filter-check="${key}" value="${attr(v)}" ${globalFilterHas(key,v)?'checked':''}><span>${esc(text)}</span></label>`;}).join(''):'<small>Aucune valeur disponible</small>'}</div></details>`;
    }).join('');
    restoreUiScroll(scrollSnapshot);
  }

  function updateDataModalWording(){
    const modal=document.getElementById('dataConnectModal'); if(!modal)return;
    const kicker=modal.querySelector('.data-kicker'); if(kicker)kicker.textContent='OBSERVATOIRE PRESTATERRE · MULTI-SOURCES';
    const intro=modal.querySelector('.data-modal-head p'); if(intro)intro.textContent='L’Observatoire Prestaterre et le générateur de rapports utilisent la même base de projets et opérations techniques. Les dashboards V04 ajoutent une source dédiée Exigences (onglet RAPPORT) en plus de la base d’opérations, tout en conservant la cartographie, les flux énergétiques et le traitement enveloppe / Cep.';
    const help=modal.querySelector('.data-connected-help'); if(help)help.innerHTML='<b>Les filtres globaux et analytiques se combinent.</b><br>Un clic dans un graphique applique un filtre analytique persistant, visible sous forme de pastille dans chaque dashboard.';
    const title=modal.querySelector('.data-filter-title b'); if(title)title.textContent='Filtres globaux de l’Observatoire';
    const modalCount=document.getElementById('dataFilteredCount'); if(modalCount)modalCount.textContent=`${runtime().connected?runtime().count:0} opération${runtime().count>1?'s':''}`;
    if(runtime().connected){const feedback=document.getElementById('dataFeedback');if(feedback){const rt=runtime(),pd=rt.progress,y=rt.years;const parts=[];if(pd){if(pd.found){const nFb=Object.values(pd.rowCounts?.fallback||{}).reduce((a,b)=>a+b,0);parts.push(`Avancement : « ${pd.header} »${pd.column?` (colonne ${pd.column})`:''}${pd.fallback?.header&&nFb?`, puis « ${pd.fallback.header} »${pd.fallback.column?` (colonne ${pd.fallback.column})`:''} quand BC est vide (${fmt(nFb)} lignes)`:''}`);}else parts.push(`⚠ ${pd.message}`);}if(y&&rt.mode!=='demo'){[[y.certification,'Date de décision de certification'],[y.created,'Date de création']].forEach(([d,l])=>{if(!d?.header)parts.push(`⚠ colonne « ${l} » ${d?.match==='ambigu'?'ambiguë':'introuvable'}`);});}feedback.textContent=`${rt.count} projets chargés. L’Observatoire Prestaterre et le générateur utilisent cette source.${parts.length?' '+parts.join(' · ')+'.':''}`;feedback.classList.toggle('is-error',!!(pd&&!pd.found&&rt.mode!=='demo'));}}
  }

  function updateSourceStatus(){
    const rt=runtime();
    sourceDot.classList.toggle('is-on',rt.connected);
    sourceLabel.textContent=rt.connected?`${fmt(rt.count)} projets`:'Données';
    demoBanner.hidden=rt.connected;
    updateDataModalWording();
  }

  function changePage(page){
    if(!pageMeta[page])page='overview'; state.page=page;
    document.querySelectorAll('#obsNav [data-page]').forEach(b=>b.classList.toggle('is-active',b.dataset.page===page));
    renderPage();
  }

  function findCodeForDepartmentName(name){
    const dep=engine.departments.find(d=>norm(d.name)===norm(name)); return dep?.code||'';
  }
  function quickFilter(field,value){
    const key=field==='departmentName'?'department':field;
    const finalValue=field==='departmentName'?findCodeForDepartmentName(value):String(value);
    if(!Object.prototype.hasOwnProperty.call(state.filters,key)||!finalValue)return;
    const values=globalFilterValues(key).filter(v=>norm(v)!==norm(finalValue));
    if(!globalFilterHas(key,finalValue))values.push(finalValue);
    state.filters[key]=values;
    renderFilters(); renderPage();
  }

  function crossKeyValueFix(key,value,label){
    if(key==='departmentNameProxy'){
      const code=findCodeForDepartmentName(value);
      return {key:'department',value:code,label:label||`Département : ${value}`};
    }
    if(key==='statusLabelProxy'){
      const status=Object.keys(STATUS_LABELS).find(k=>norm(STATUS_LABELS[k])===norm(value));
      return {key:'status',value:status||value,label:label||`Avancement : ${value}`};
    }
    return {key,value,label};
  }

  let projectWindowEl=null;
  function projectTechnicalOperations(project){
    return (sourceTechnicalOperations()||[]).filter(o=>{
      const parent=String(o.projectCode||'');
      return parent===String(project?.code||'')||(privacy()?.enabled?.()&&privacy().operationCode(parent)===String(project?.code||''));
    });
  }
  function projectTechnicalLabel(op,index){
    const raw=op?.raw||{},candidate=Object.entries(raw).find(([k,v])=>/^(batiment|bâtiment|operation technique|opération technique)$/i.test(String(k).trim())&&String(v??'').trim());
    return candidate?String(candidate[1]).trim():`Bâtiment / opération ${index+1}`;
  }
  function splitProjectTags(value){return String(value||'').split(',').map(x=>x.trim()).filter(Boolean);}
  function projectTags(project,tech){
    const out=[],seen=new Set(),add=v=>{String(v||'').split(/\n|<br\s*\/?\s*>/i).forEach(part=>{const x=part.trim();if(!x)return;const k=norm(x);if(!seen.has(k)){seen.add(k);out.push(x);}});};
    const addCustom=o=>{splitProjectTags(o?.tags).forEach(add);const h=o?.fields?.tags;if(h)(o.rawRows||[o.raw||{}]).forEach(r=>splitProjectTags(r?.[h]).forEach(add));};
    addCustom(project);addCustom(tech);add(project?.nature);add(project?.profile);add(project?.referential);add(project?.moaType);
    cachedOperationTags(project,'mention').forEach(add);cachedOperationTags(project,'performance').forEach(add);
    if(tech){add(tech.structure);add(tech.wallInsulation);add(tech.roofInsulation);add(tech.heatingAfter);add(tech.ventilation);}
    const cy=tech?.constructionYear||project?.constructionYear;if(cy)add(`Construction ${cy}`);
    return out.slice(0,18);
  }
  function projectHasTag(project,tag){const techs=projectTechnicalOperations(project);return [project,...techs].some(o=>projectTags(project,o).some(t=>norm(t)===norm(tag)));}
  function projectAutoDescription(project,tech){
    const text=v=>String(v??'').replace(/<br\s*\/?\s*>/gi,' ').trim();
    const nature=norm(project.nature),parts=[];
    let sentence=/renov/.test(nature)?'Projet de r\u00e9novation':(/neuf/.test(nature)?'Projet de construction neuve':'Projet suivi par Prestaterre');
    if(project.dwellings)sentence+=` de ${fmt(project.dwellings)} logements`;
    if(project.buildings)sentence+=` r\u00e9partis sur ${fmt(project.buildings)} b\u00e2timent${Number(project.buildings)>1?'s':''}`;
    const loc=[project.city,departmentName(project.department)].filter(Boolean).join(' \u00b7 ');
    if(loc)sentence+=`, situ\u00e9 \u00e0 ${loc}`;parts.push(sentence+'.');
    const cy=tech?.constructionYear;if(cy)parts.push(`Construction du b\u00e2timent s\u00e9lectionn\u00e9 : ${text(cy)}.`);
    const ref=tech?.referential||project.referential;if(ref)parts.push(`R\u00e9f\u00e9rentiel : ${text(ref)}.`);
    return parts.join(' ');
  }
  function energyChargeEstimate(op){
    const prices={electricity:.25,gas:.12,district:.14,wood:.10}, factors={electricity:2.3,gas:1,district:1,wood:1};
    const rows=[['electricity','cepElectricity'],['gas','cepGas'],['district','cepDistrict'],['wood','cepWood']].map(([kind,key])=>({kind,key,ep:rawNumber(op,key)})).filter(x=>x.ep!==null&&x.ep>0);
    let cost=0,basis='';
    if(rows.length){rows.forEach(x=>{cost+=(x.ep/factors[x.kind])*prices[x.kind];});basis='décomposition CEP par vecteur renseignée';}
    else{
      const cep=rawNumber(op,'cep')??rawNumber(op,'cepAfter');if(cep===null)return {cost:null,basis:'CEP non renseigné'};
      const vector=norm(`${op.heatingAfter||''} ${op.ecsAfter||''}`);let kind=/rcu|reseau de chaleur/.test(vector)?'district':(/bois|biomasse/.test(vector)?'wood':(/gaz/.test(vector)?'gas':'electricity'));
      cost=(cep/factors[kind])*prices[kind];basis=`CEP global affecté au vecteur dominant ${kind==='district'?'réseau de chaleur':kind==='wood'?'bois / biomasse':kind==='gas'?'gaz':'électricité / PAC'}`;
    }
    return {cost,basis,assumptions:'Hypothèses V6.8 : électricité 0,25 €/kWhEF avec conversion EP→EF 2,30 ; gaz 0,12 €/kWh ; réseau de chaleur 0,14 €/kWh ; bois/biomasse 0,10 €/kWh. Estimation énergétique conventionnelle uniquement : hors abonnement, maintenance, usages non couverts par le CEP, météo réelle et comportement des occupants.'};
  }
  function projectMetric(label,value,unit=''){return `<div class="obs-project-metric"><span>${esc(label)}</span><b>${String(value??'').trim()===''?'—':esc(value)}</b><small>${esc(unit)}</small></div>`;}
  function projectThermalCard(title,icon,structure,insulation,rValue,thickness){
    const rawR=String(rValue??'').trim(),rv=projectUxNumericValue(rawR),th=String(thickness??'').trim(),bar=Number.isFinite(rv)?Math.max(3,Math.min(100,rv/10*100)):0;
    return `<article class="obs-project-envelope-card"><header><i>${icon}</i><div><span>${esc(title)}</span><b>${esc(structure||'Structure non renseignée')}</b></div></header><div class="obs-project-envelope-material"><small>Isolation</small><strong>${esc(insulation||'Non renseignée')}</strong></div><div class="obs-project-thermal-line"><div><span>R thermique</span><b>${rawR?esc(rawR):'—'}<small>${rawR&&!/m²|m2|k\/w/i.test(rawR)?' m²·K/W':''}</small></b></div><div><span>Épaisseur</span><b>${th?esc(th):'—'}<small>${th&&!/mm|cm|m\b/i.test(th)?' mm':''}</small></b></div></div><div class="obs-project-rbar"><i style="width:${bar.toFixed(1)}%"></i></div></article>`;
  }
  function projectVectorCep(op,vector){
    const v=normalizeEnergyVectorFamily(vector);const key=v==='Gaz'?'cepGas':v==='Électricité'||v==='PAC'?'cepElectricity':v==='RCU'?'cepDistrict':v==='Bois / biomasse'?'cepWood':'';return key?rawNumber(op,key):null;
  }
  function projectSystemCard(title,icon,vector,description,cepValue,cepLabel){
    const v=vector||'Non renseigné',cep=cepValue===null||cepValue===undefined?null:Number(cepValue);
    return `<article class="obs-project-system-card" style="${vectorColorStyle(v)}"><header><i>${icon}</i><div><span>${esc(title)}</span><b>${esc(v)}</b></div></header><p>${esc(description||'Description non renseignée')}</p><div class="obs-project-system-foot"><span>${esc(cepLabel||'CEP associé')}</span><strong>${Number.isFinite(cep)?`${fmt(cep,1)} <small>kWhEP/m².an</small>`:'—'}</strong></div></article>`;
  }
  function projectBuildingHtml(project,op){
    if(!op)return '<div class="obs-empty">Aucune opération technique rattachée.</div>';
    const heatVector=op.heatingAfter||op.heatingBefore||'',ecsVector=op.ecsAfter||op.ecsBefore||'',heatCep=projectVectorCep(op,heatVector),ecsCep=projectVectorCep(op,ecsVector),ventCep=rawNumber(op,'cepAuxVent'),coolCep=rawNumber(op,'cepCooling');
    const vectorRows=[['Électricité','cepElectricity'],['Gaz','cepGas'],['Réseau de chaleur','cepDistrict'],['Bois / biomasse','cepWood']].map(([name,key])=>({name,value:rawNumber(op,key)})).filter(x=>x.value!==null&&x.value>0);
    const usageRows=[['Refroidissement','cepCooling'],['Éclairage','cepLighting'],['Aux. ventilation','cepAuxVent'],['Aux. distribution','cepAuxDist'],['Déplacement','cepMobility']].map(([name,key])=>({name,value:rawNumber(op,key)})).filter(x=>x.value!==null&&x.value>0);
    return `<div class="obs-project-building"><section class="obs-project-building-hero"><div><span>BÂTIMENT & ÉQUIPEMENTS</span><h3>Analyse du système constructif & enveloppe</h3><p>Typologie structurelle, menuiseries et lecture thermique des parois pour l'opération / bâtiment sélectionné.</p></div><div class="obs-project-building-kpis">${projectMetric('Structure',normalizeStructureFamily(op.structure||op.wallStructure)||op.structure||'—')}${projectMetric('Ubat projet',rawValue(op,'ubatAfter'),'W/m²·K')}${projectMetric('R façade',rawValue(op,'wallR'),'m²·K/W')}${projectMetric('R toiture',rawValue(op,'roofR'),'m²·K/W')}</div></section><section class="obs-project-section-block"><div class="obs-project-section-head"><div><span>01 · ENVELOPPE</span><h3>Parois et performances thermiques</h3></div><small>Valeurs du bâtiment sélectionné</small></div><div class="obs-project-envelope-grid">${projectThermalCard('Toiture / plancher haut','⌂',op.roofStructure,op.roofInsulation,rawValue(op,'roofR'),rawValue(op,'roofThickness'))}${projectThermalCard('Façades / parois verticales','▦',op.wallStructure,op.wallInsulation,rawValue(op,'wallR'),rawValue(op,'wallThickness'))}${projectThermalCard('Plancher bas','▱',op.floorStructure,op.floorInsulation,rawValue(op,'floorR'),rawValue(op,'floorThickness'))}</div></section><section class="obs-project-section-block"><div class="obs-project-section-head"><div><span>02 · MENUISERIES</span><h3>Composition des baies</h3></div></div><div class="obs-project-window-grid"><article><i>▤</i><span>Matériau</span><b>${esc(op.windowMaterial||'—')}</b></article><article><i>◫</i><span>Vitrage</span><b>${esc(op.windowGlazing||'—')}</b></article><article><i>▥</i><span>Occultations</span><b>${esc(op.windowShading||'—')}</b></article></div></section><section class="obs-project-section-block"><div class="obs-project-section-head"><div><span>03 · CVC & ECS</span><h3>Équipements techniques & consommations CEP associées</h3></div><small>Le CEP par vecteur est un total bâtiment : il n'est pas attribué à un usage lorsqu'il n'est pas distingué dans la source.</small></div><div class="obs-project-system-grid">${projectSystemCard('Chauffage','♨',heatVector,op.heatingModeAfter||op.heatingAfter,heatCep,'CEP du vecteur bâtiment')}${projectSystemCard('Eau chaude sanitaire','♨',ecsVector,op.ecs||op.ecsAfter,ecsCep,'CEP du vecteur bâtiment')}${projectSystemCard('Ventilation','↻','Électricité',op.ventilation,ventCep,'CEP auxiliaires ventilation')}${projectSystemCard('Rafraîchissement','❄',op.cooling&&norm(op.cooling)!=='aucun'?'Électricité':'Aucun',op.cooling||'Aucun',coolCep,'CEP refroidissement')}</div><div class="obs-grid-2 obs-project-building-charts"><article class="obs-card"><div class="obs-card-head"><div><span>CEP PAR VECTEUR</span><h3>Répartition énergétique déclarée</h3></div></div>${vectorRows.length?pieDistribution(vectorRows,{maxItems:8,colorFn:vectorColor}):'<div class="obs-empty">Pas de CEP par vecteur renseigné.</div>'}</article><article class="obs-card"><div class="obs-card-head"><div><span>CEP PAR USAGE</span><h3>Usages disponibles dans OPERATIONS</h3></div></div>${usageRows.length?pieDistribution(usageRows,{maxItems:8}):'<div class="obs-empty">Pas de décomposition CEP par usage disponible.</div>'}</article></div></section></div>`;
  }

  function projectEnergyHtml(project,op){
    if(!op)return '<div class="obs-empty">Aucune opération technique rattachée.</div>';
    const charges=energyChargeEstimate(op),usage=[['Refroidissement','cepCooling'],['Éclairage','cepLighting'],['Aux. ventilation','cepAuxVent'],['Aux. distribution','cepAuxDist'],['Déplacement','cepMobility']].map(([name,key])=>({name,value:rawNumber(op,key)})).filter(x=>x.value!==null&&x.value>0),vectors=[['Électricité','cepElectricity'],['Gaz','cepGas'],['Réseau de chaleur','cepDistrict'],['Bois / biomasse','cepWood']].map(([name,key])=>({name,value:rawNumber(op,key)})).filter(x=>x.value!==null&&x.value>0);
    return `<div class="obs-project-energy"><div class="obs-project-route-grid"><article><span>CHAUFFAGE</span><b class="obs-project-vector-pill" style="${vectorColorStyle(op.heatingBefore||'')}">${esc(op.heatingBefore||'—')}</b><i>→</i><b class="obs-project-vector-pill" style="${vectorColorStyle(op.heatingAfter||'')}">${esc(op.heatingAfter||'—')}</b><small>${esc(op.heatingModeAfter||'')}</small></article><article><span>ECS</span><b class="obs-project-vector-pill" style="${vectorColorStyle(op.ecsBefore||'')}">${esc(op.ecsBefore||'—')}</b><i>→</i><b class="obs-project-vector-pill" style="${vectorColorStyle(op.ecsAfter||op.ecs||'')}">${esc(op.ecsAfter||op.ecs||'—')}</b><small>${esc(op.ecs||'')}</small></article></div><div class="obs-project-metric-grid">${projectMetric('CEP projet',rawValue(op,'cep'),'kWhEP/m².an')}${projectMetric('CEP max',rawValue(op,'cepMax'),'kWhEP/m².an')}${projectMetric('Bbio projet',rawValue(op,'bbio'),'points')}${projectMetric('Bbio max',rawValue(op,'bbioMax'),'points')}${projectMetric('DH projet',rawValue(op,'dh'),'°C·h')}${projectMetric('DH max',rawValue(op,'dhMax'),'°C·h')}${projectMetric('TIC projet',rawValue(op,'tic'),'°C')}${projectMetric('TIC ref',rawValue(op,'ticRef'),'°C')}${projectMetric('Ubat initial',rawValue(op,'ubatBefore'),'W/m²·K')}${projectMetric('Ubat projet',rawValue(op,'ubatAfter'),'W/m²·K')}</div><section class="obs-project-charge"><div><span>ESTIMATION DES CHARGES ÉNERGÉTIQUES</span><strong>${charges.cost===null?'—':`${fmt(charges.cost,1)} €/m².an`}</strong><p>${esc(charges.basis)}</p></div><small>${esc(charges.assumptions||'Le CEP est une consommation conventionnelle et ne constitue pas une facture prévisionnelle.')}</small></section><div class="obs-grid-2 obs-project-cep-split"><article class="obs-card"><div class="obs-card-head"><div><span>CEP PAR USAGE</span><h3>Répartition déclarée</h3></div></div>${usage.length?pieDistribution(usage,{maxItems:8}):'<div class="obs-empty">Pas de décomposition par usage.</div>'}</article><article class="obs-card"><div class="obs-card-head"><div><span>CEP PAR VECTEUR</span><h3>Répartition déclarée</h3></div></div>${vectors.length?pieDistribution(vectors,{maxItems:8,colorFn:vectorColor}):'<div class="obs-empty">Pas de décomposition par vecteur.</div>'}</article></div></div>`;
  }
  function projectDpeBadge(letter){const l=String(letter||'').toUpperCase().match(/[A-G]/)?.[0]||'';return l?`<b class="obs-dpe-chevron dpe-${l.toLowerCase()}">${l}</b>`:'<b class="obs-dpe-chevron">—</b>';}
  function projectValueGauge(label,value,max,unit=''){
    const v=(value===null||value===undefined||value==='')?NaN:Number(value),m=(max===null||max===undefined||max==='')?NaN:Number(max),ok=Number.isFinite(v)&&Number.isFinite(m)&&m>0,ratio=ok?Math.max(0,Math.min(1.25,v/m)):0;
    return `<article class="obs-project-value-gauge"><header><span>${esc(label)}</span><b>${Number.isFinite(v)?fmt(v,1):'—'} <small>${esc(unit)}</small></b></header>${ok?`<div class="obs-project-value-track"><i style="width:${Math.min(100,ratio*100).toFixed(1)}%"></i><b style="left:${Math.min(100,100).toFixed(1)}%"></b></div><footer><span>0</span><strong>Seuil ${fmt(m,1)}</strong></footer>`:'<div class="obs-project-gauge-empty">Seuil ou valeur non renseigné</div>'}</article>`;
  }
  function projectCarbonHtml(project,op){
    if(!op)return '<div class="obs-empty">Aucune opération technique rattachée.</div>';const deB=projectUxLetter(op,'dpeEnergyBefore'),deA=projectUxLetter(op,'dpeEnergyAfter'),dgB=projectUxLetter(op,'dpeGesBefore'),dgA=projectUxLetter(op,'dpeGesAfter');
    return `<div class="obs-project-carbon"><div class="obs-project-carbon-gauges">${projectValueGauge('IC Énergie',rawNumber(op,'icEnergy'),rawNumber(op,'icEnergyMax'),'kgCO₂e/m²')}${projectValueGauge('IC Construction',rawNumber(op,'icConstruction'),rawNumber(op,'icConstructionMax'),'kgCO₂e/m²')}</div><div class="obs-project-threshold-grid">${projectMetric('Seuil construction 2028',rawValue(op,'icConstruction2028'),'kgCO₂e/m²')}${projectMetric('Seuil construction 2031',rawValue(op,'icConstruction2031'),'kgCO₂e/m²')}</div><div class="obs-project-dpe-grid"><article><span>DPE ÉNERGIE</span><div><small>Avant</small>${projectDpeBadge(deB)}<i>→</i>${projectDpeBadge(deA)}<small>Après</small></div></article><article><span>DPE GES</span><div><small>Avant</small>${projectDpeBadge(dgB)}<i>→</i>${projectDpeBadge(dgA)}<small>Après</small></div></article></div></div>`;
  }
  function projectEconomicsHtml(){return `<div class="obs-project-economics"><div class="obs-project-econ-intro"><span>DONNÉES ÉCONOMIQUES</span><h3>Structure prête pour les futures données DPGF et financement</h3><p>Cet onglet reste vide tant que les données économiques ne sont pas reliées à OPERATIONS.</p></div><div class="obs-grid-2"><article class="obs-card"><div class="obs-card-head"><div><span>DPGF</span><h3>Répartition par macro-lot</h3></div></div><div class="obs-econ-empty-chart"><i></i><b>Aucune donnée</b><span>Montants HT par macro-lot</span></div></article><article class="obs-card"><div class="obs-card-head"><div><span>DPGF</span><h3>Répartition par lot</h3></div></div><div class="obs-econ-empty-chart bars"><i></i><b>Aucune donnée</b><span>Montants HT par lot</span></div></article></div><article class="obs-card"><div class="obs-card-head"><div><span>DÉTAIL DES COÛTS</span><h3>Tableau DPGF</h3></div></div><div class="obs-table-wrap"><table class="obs-table"><thead><tr><th>Macro-lot</th><th>Lot</th><th>Montant HT</th><th>Part</th></tr></thead><tbody><tr><td colspan="4">Aucune donnée économique disponible.</td></tr></tbody></table></div></article><article class="obs-card"><div class="obs-card-head"><div><span>FINANCEMENT</span><h3>Aides mobilisées</h3></div></div><div class="obs-table-wrap"><table class="obs-table"><thead><tr><th>Dispositif</th><th>Financeur</th><th>Montant</th><th>Statut</th><th>Commentaire</th></tr></thead><tbody><tr><td colspan="5">Aucune aide renseignée pour le moment.</td></tr></tbody></table></div></article></div>`;}
  // V6.12 - editorial project sheet. All figures come from the selected source row.
  const PROJECT_UX_TABS = [['general','Vue d\u2019ensemble','home'],['building','B\u00e2timent & \u00e9quipements','layers'],['energy','\u00c9nergie & transition','energy'],['carbon','Carbone & DPE','leaf'],['economics','Donn\u00e9es \u00e9conomiques','wallet']];
  const PROJECT_UX_COVERAGE = [['structure','Structure'],['roofInsulation','Isolation toiture'],['wallInsulation','Isolation fa\u00e7ade'],['floorInsulation','Isolation plancher'],['roofR','R toiture'],['wallR','R fa\u00e7ade'],['floorR','R plancher'],['windowMaterial','Mat\u00e9riau des menuiseries'],['windowGlazing','Vitrage'],['heatingAfter','Chauffage apr\u00e8s'],['ecsAfter','ECS apr\u00e8s'],['ventilation','Ventilation'],['cooling','Rafra\u00eechissement'],['cep','CEP projet']];
  let projectUxReturnFocus=null,projectUxBackgroundScroll=null,projectUxPreviousInert=false;
  let projectUxShowSource=false,projectUxExportBusy=false;

  function projectUxIcon(name){
    const paths={
      home:'<path d="M3 10 12 3l9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
      building:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 7h1m4 0h1M9 11h1m4 0h1M9 15h1m4 0h1m-5 6v-3h4v3"/>',
      layers:'<path d="m12 3 10 5-10 5L2 8zm-10 9 10 5 10-5M2 16l10 5 10-5"/>',
      energy:'<path d="m13 2-9 12h7l-1 8 10-12h-7z"/>',
      leaf:'<path d="M20 3C9 1 2 6 4 14c2 8 17 8 16-11Z M3 22l12-13"/>',
      chart:'<path d="M4 3v18h18M8 17v-5m5 5V8m5 9V5"/>',
      pin:'<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
      people:'<circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 4v3"/>',
      check:'<path d="m6 12 4 4 8-8"/><circle cx="12" cy="12" r="10"/>',
      clock:'<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
      heat:'<path d="M5 20V6m5 14V6m4 14V6m5 14V6M3 9h18M3 17h18M9 3V1m6 2V1"/>',
      water:'<path d="M12 2S4 11 4 15a8 8 0 0 0 16 0c0-4-8-13-8-13Z"/>',
      fan:'<circle cx="12" cy="12" r="2"/><path d="M11 10C0 7 8-3 12 3c1 2 1 4 0 7m2 1c3-11 13-3 7 1-2 1-4 1-7 0m-1 2c11 3 3 13-1 7-1-2-1-4 0-7m-2-1c-3 11-13 3-7-1 2-1 4-1 7 0"/>',
      snow:'<path d="M12 2v20M3.34 7l17.32 10M3.34 17 20.66 7M9 4l3 3 3-3M9 20l3-3 3 3M4 10l4-1-1-4m13 9-4 1 1 4M4 14l4 1-1 4m13-9-4-1 1-4"/>',
      window:'<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M12 3v18M4 12h16M10 8v1m4-1v1"/>',
      source:'<path d="M14 2H5a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9zm0 0v7h7M7 13h10M7 17h7"/>',
      download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
      arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',
      back:'<path d="M20 12H4m6-6-6 6 6 6"/>',
      wallet:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 8V4l15-2v3m3 6h-6v6h6"/><circle cx="17" cy="14" r=".5"/>',
      info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-11v1"/>',
      tag:'<path d="M3 3h8l10 10-8 8L3 11z"/><circle cx="7" cy="7" r="1"/>',
      close:'<path d="m6 6 12 12M6 18 18 6"/>'
    };
    return `<svg class="p10-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]||paths.info}</svg>`;
  }
  function projectUxText(v){return String(v??'').replace(/\\?<br\s*\/?\s*>|&lt;br\s*\/?\s*&gt;/gi,' \u00b7 ').replace(/\s+/g,' ').trim();}
  function projectUxValue(op,key){
    const h=op?.fields?.[key];
    // Do not borrow a technical value from another building when this row is blank.
    if(h&&op?.raw&&Object.prototype.hasOwnProperty.call(op.raw,h))return op.raw[h]??'';
    return rawValue(op,key);
  }
  function projectUxNumericValue(value){
    if(value===null||value===undefined||String(value).trim()==='')return null;
    if(typeof value==='number')return Number.isFinite(value)?value:null;
    const s=String(value).trim().replace(/[\u00a0\u202f]/g,' ').replace(/(?<=\d) (?=\d{3}(?:\D|$))/g,'');
    const m=s.match(/^([+-]?\d+(?:[.,]\d+)?)\s*(?:kWh(?:EP|EF)?(?:\/[\w\u00b2\u00b7.\/-]+)?|m\u00b2[\u00b7.]?K\/W|W\/m\u00b2[\u00b7.]?K|kgCO\u2082e?\/m\u00b2|points?|\u00b0C(?:[\u00b7.]?h)?)?$/i);
    if(!m)return null;const n=Number(m[1].replace(',','.'));return Number.isFinite(n)?n:null;
  }
  const PROJECT_UX_MEASURES={roofR:'resistance',wallR:'resistance',floorR:'resistance',roofThickness:'thickness',wallThickness:'thickness',floorThickness:'thickness'};
  function projectUxNumber(op,key){const v=projectUxValue(op,key),kind=PROJECT_UX_MEASURES[key];if(kind&&RULES&&typeof v!=='number'){const r=RULES.parseMeasure(v,kind);return r.status==='ok'?r.value:null;}return projectUxNumericValue(v);}
  function projectUxLetter(op,key){
    const s=projectUxText(projectUxValue(op,key)).toUpperCase();
    const m=s.match(/^(?:CLASSE\s+)?([A-G])(?:\s*\([^)]*\))?$/);return m?m[1]:'';
  }
  function projectUxScopedOperation(op){
    if(!op)return null;const out={...op};
    const keys=['structure','roofStructure','roofInsulation','wallStructure','wallInsulation','floorStructure','floorInsulation','windowMaterial','windowGlazing','windowShading','heatingBefore','heatingAfter','heatingModeAfter','ecsBefore','ecsAfter','ecs','ventilation','cooling','constructionYear','cep','cepAfter','cepBefore','cepMax','bbio','bbioMax','dh','dhMax','tic','ticRef','ubatBefore','ubatAfter','roofR','wallR','floorR'];
    keys.forEach(k=>{if(op.fields?.[k]&&op.raw&&Object.prototype.hasOwnProperty.call(op.raw,op.fields[k])&&String(op.raw[op.fields[k]]??'').trim()==='')out[k]='';});
    return out;
  }
  function projectUxCoverage(op){
    const items=PROJECT_UX_COVERAGE.map(([key,label])=>({key,label,present:projectUxText(projectUxValue(op,key))!==''}));
    const count=items.filter(x=>x.present).length;return {items,count,total:items.length,percent:Math.round(100*count/items.length)};
  }
  function projectUxCep(op){return projectUxNumber(op,'cepAfter')??projectUxNumber(op,'cep');}
  function projectUxGain(op){const before=projectUxNumber(op,'cepBefore'),after=projectUxCep(op);return before!==null&&before>0&&after!==null&&after>=0?100*(before-after)/before:null;}
  function projectUxStatus(op){const code=chronologyStatus(op||{});return {code,label:CHRONOLOGY_STATUS_LABELS[code]||projectUxText(op?.rawStatus)||'Non renseign\u00e9',color:CHRONOLOGY_STATUS_COLORS[code]||'#70817b'};}
  function projectUxRawHeader(op,header){const r=op?.raw||{},hit=Object.keys(r).find(k=>norm(k)===norm(header));return hit?projectUxText(r[hit]):'';}
  function projectUxHeading(title,icon,tab=''){
    return `<div class="p10-card-head"><h3>${projectUxIcon(icon)}${esc(title)}</h3>${tab?`<button type="button" class="p10-text-link" data-project-tab="${attr(tab)}">D\u00e9tail ${projectUxIcon('arrow')}</button>`:''}</div>`;
  }
  function projectUxDatum(label,value){return `<div class="p10-datum"><dt>${esc(label)}</dt><dd>${esc(projectUxText(value)||'Non renseign\u00e9')}</dd></div>`;}
  function projectUxKpi(label,value,subtitle,icon,tone=''){
    return `<article class="p10-kpi ${tone}"><i>${projectUxIcon(icon)}</i><div><span>${esc(label)}</span><strong>${esc(value??'\u2014')}</strong><small>${esc(subtitle)}</small></div></article>`;
  }
  function projectUxHeroHtml(project,op){
    const cov=projectUxCoverage(op),status=projectUxStatus(op||project),name=projectUxText(project.name||project.code);
    const loc=[project.city,departmentName(project.department)].filter(Boolean).join(' \u00b7 ');
    const description=projectAutoDescription(project,op),demo=!runtime().connected||runtime().mode==='demo';
    return `<section class="p10-hero"><figure class="p10-illustration"><img src="assets/building_final.png" alt="Illustration g\u00e9n\u00e9rique d\u2019un b\u00e2timent, non contractuelle"/><figcaption>Illustration \u00b7 pas une photo du projet</figcaption></figure><div class="p10-hero-story"><div class="p10-eyebrow">FICHE PROJET / OP\u00c9RATION${demo?' \u00b7 D\u00c9MONSTRATION':''}</div><h2 id="obsProjectUxTitle">${esc(name)}</h2><p class="p10-location">${projectUxIcon('pin')}${esc(loc||'Localisation non renseign\u00e9e')}</p><div class="p10-badges"><span>${projectUxIcon('home')}${esc(projectUxText(project.nature)||'Nature non renseign\u00e9e')}</span><span class="p10-status" style="--p10-status:${status.color}"><i></i>${esc(status.label)}</span></div><p class="p10-description">${esc(description)}</p></div><div class="p10-hero-aside"><div class="p10-coverage"><svg viewBox="0 0 110 110" role="img" aria-label="${cov.count} champs techniques renseign\u00e9s sur ${cov.total}"><circle cx="55" cy="55" r="46" class="p10-ring-base"/><circle cx="55" cy="55" r="46" class="p10-ring-value" pathLength="100" stroke-dasharray="${cov.percent} 100"/><text x="55" y="52" class="p10-ring-number">${cov.count}<tspan class="p10-ring-denom">/${cov.total}</tspan></text><text x="55" y="70" class="p10-ring-small">champs</text></svg><div><b>Donn\u00e9es renseign\u00e9es</b><small>B\u00e2timent s\u00e9lectionn\u00e9</small><details><summary>Comment est-ce calcul\u00e9 ?</summary><div>${cov.items.map(x=>`<p>${x.present?'\u2713':'\u2014'} ${esc(x.label)}</p>`).join('')}<p>Pr\u00e9sence de ${cov.total} champs descriptifs. Ce n\u2019est ni un score environnemental ni une \u00e9valuation de conformit\u00e9.</p></div></details></div></div><div class="p10-hero-actions"><button type="button" data-project-export="1" class="p10-button p10-primary">${projectUxIcon('download')}Exporter la fiche</button><button type="button" data-project-source="1" class="p10-button" aria-expanded="${projectUxShowSource}">${projectUxIcon('source')}Donn\u00e9es source</button></div></div></section>`;
  }
  function projectUxKpisHtml(project,op,techs){
    const cep=projectUxCep(op),gain=projectUxGain(op),before=projectUxLetter(op,'dpeEnergyBefore'),after=projectUxLetter(op,'dpeEnergyAfter'),ic=projectUxNumber(op,'icConstruction');
    const amount=(v)=>v===null||v===undefined||String(v).trim()===''?'\u2014':fmt(v);
    return `<section class="p10-kpis" aria-label="Chiffres cl\u00e9s du projet et du b\u00e2timent">${projectUxKpi('Logements',amount(project.dwellings),'Total du projet','home')}${projectUxKpi('B\u00e2timents',amount(project.buildings),`${techs.length} ligne${techs.length>1?'s':''} technique${techs.length>1?'s':''} analys\u00e9e${techs.length>1?'s':''}`,'building')}${projectUxKpi('CEP projet',cep===null?'\u2014':fmt(cep,1),'kWhEP/m\u00b2.an \u00b7 b\u00e2timent','energy')}${projectUxKpi('Gain CEP',gain===null?'\u2014':`${gain>0?'+':''}${fmt(gain,1)} %`,gain===null?'Avant / apr\u00e8s non disponibles':gain<0?'Hausse de consommation':'R\u00e9duction avant / apr\u00e8s','chart',gain!==null&&gain<0?'p10-warning':'')}${projectUxKpi('DPE \u00e9nergie',`${before||'\u2014'} \u2192 ${after||'\u2014'}`,'Classes du b\u00e2timent','chart')}${projectUxKpi('IC construction',ic===null?'\u2014':fmt(ic,1),'kgCO\u2082e/m\u00b2 \u00b7 b\u00e2timent','leaf')}</section>`;
  }
  function projectUxTimelineHtml(project,op){
    const status=projectUxStatus(op||project),order=PROGRESS_ORDER;
    const dates=[['D\u00e9cision AP','certificationApDate'],['D\u00e9cision CD','certificationCdDate']];
    return `<article class="p10-card p10-timeline-card">${projectUxHeading('Parcours de certification','check')}<div class="p10-timeline" aria-label="Statut d\u00e9clar\u00e9 : ${attr(status.label)}">${order.map((k,i)=>`<div class="${status.code===k?'is-current':''}" ${status.code===k?'aria-current="step"':''}><i>${status.code===k&&k==='compliant'?projectUxIcon('check'):i+1}</i><span>${esc(STATUS_LABELS[k])}</span></div>`).join('')}</div><p class="p10-stage"><i style="background:${status.color}"></i><b>${esc(status.label)}</b><small>Statut d\u00e9clar\u00e9, pas un pourcentage de travaux.</small></p><div class="p10-dates">${dates.map(([l,k])=>`<div>${projectUxIcon('clock')}<span>${l}<b>${esc(projectUxText(projectUxValue(op,k))||'Non renseign\u00e9e')}</b></span></div>`).join('')}</div></article>`;
  }
  function projectUxRChart(op){
    const data=[['Toiture','roofR'],['Fa\u00e7ade','wallR'],['Plancher bas','floorR']].map(([label,key])=>({label,value:projectUxNumber(op,key),raw:projectUxText(projectUxValue(op,key))}));
    const max=Math.max(1,...data.map(x=>x.value??0));
    return `<div class="p10-rchart" aria-label="R\u00e9sistances thermiques des isolants"><p>R des isolants <small>m\u00b2\u00b7K/W</small></p>${data.map(x=>`<div class="p10-rrow"><span>${x.label}</span><div class="p10-track"><i style="width:${x.value!==null&&x.value>=0?100*x.value/max:0}%"></i></div><b>${esc(x.raw||'\u2014')}</b></div>`).join('')}<small>Comparaison descriptive. Une valeur multiple reste textuelle.</small></div>`;
  }
  function projectUxEnvelopeHtml(op){
    return `<article class="p10-card">${projectUxHeading('Syst\u00e8me constructif & enveloppe','layers','building')}<div class="p10-structure"><i>${projectUxIcon('layers')}</i><div><span>Structure principale</span><b>${esc(projectUxText(op?.structure||op?.wallStructure)||'Non renseign\u00e9e')}</b></div></div>${projectUxRChart(op)}<dl class="p10-material-list">${projectUxDatum('Toiture',op?.roofInsulation)}${projectUxDatum('Fa\u00e7ade',op?.wallInsulation)}${projectUxDatum('Plancher bas',op?.floorInsulation)}</dl></article>`;
  }
  function projectUxCvcHtml(op){
    const data=[['Chauffage','heat',op?.heatingAfter,projectUxValue(op,'heatingModeAfter')||op?.heatingModeAfter],['Eau chaude sanitaire','water',op?.ecsAfter,projectUxValue(op,'ecs')||op?.ecs],['Ventilation','fan','',projectUxValue(op,'ventilation')||op?.ventilation],['Rafra\u00eechissement','snow','',projectUxValue(op,'cooling')||op?.cooling]];
    return `<article class="p10-card">${projectUxHeading('\u00c9quipements CVC','fan','building')}<div class="p10-cvc">${data.map(([l,i,v,d])=>`<section><i class="p10-system-icon" ${v?`style="${vectorColorStyle(v)}"`:''}>${projectUxIcon(i)}</i><h4>${esc(l)}</h4>${v?`<b class="p10-vector" style="${vectorColorStyle(v)}">${esc(v)}</b>`:''}<p>${esc(projectUxText(d)||'Non renseign\u00e9')}</p></section>`).join('')}</div><p class="p10-note">Descriptions du b\u00e2timent s\u00e9lectionn\u00e9 apr\u00e8s travaux.</p></article>`;
  }
  function projectUxCompareChart(op){
    const before=projectUxNumber(op,'cepBefore'),after=projectUxCep(op),max=Math.max(1,before??0,after??0),gain=projectUxGain(op);
    return `<section class="p10-energy-compare"><h4>Consommation d\u2019\u00e9nergie primaire</h4><p>kWhEP/m\u00b2.an \u00b7 valeurs d\u00e9clar\u00e9es</p><div class="p10-columns">${[[before,'Avant travaux'],[after,'Projet / apr\u00e8s']].map(([v,l],i)=>`<div class="p10-column"><strong>${v===null?'\u2014':fmt(v,1)}</strong><div class="p10-column-area"><i class="${i?'is-after':'is-before'}" style="height:${v===null?0:Math.max(0,100*v/max)}%"></i>${v===null?'<span>Non renseign\u00e9</span>':''}</div><span>${l}</span></div>`).join('')}</div>${gain!==null?`<div class="p10-gain ${gain<0?'p10-warning':''}">${gain>=0?'Baisse':'Hausse'} de <b>${fmt(Math.abs(gain),1)} %</b></div><p class="p10-note">Comparaison \u00e0 m\u00e9thode et surface de r\u00e9f\u00e9rence identiques \u00e0 v\u00e9rifier dans les sources.</p>`:'<div class="p10-note">Le gain n\u2019est calcul\u00e9 que si les deux valeurs sont disponibles.</div>'}</section>`;
  }
  function projectUxDpeHtml(op){
    return `<section class="p10-dpe-compare"><h4>\u00c9tiquettes avant / apr\u00e8s</h4>${[['\u00c9nergie','dpeEnergyBefore','dpeEnergyAfter'],['GES','dpeGesBefore','dpeGesAfter']].map(([l,b,a])=>{const bv=projectUxLetter(op,b),av=projectUxLetter(op,a);return `<div class="p10-dpe-pair"><span>${l}</span><div><small>Avant</small>${projectDpeBadge(bv)}</div>${projectUxIcon('arrow')}<div><small>Apr\u00e8s</small>${projectDpeBadge(av)}</div></div>`;}).join('')}<p class="p10-note">Classes lues dans les colonnes DPE, jamais d\u00e9duites du CEP.</p></section>`;
  }
  function projectUxWindowsHtml(op){return `<article class="p10-card p10-window-card">${projectUxHeading('Menuiseries ext\u00e9rieures','window','building')}<div class="p10-windows">${[['Mat\u00e9riau',op?.windowMaterial],['Vitrage',op?.windowGlazing],['Occultations',op?.windowShading]].map(([l,v])=>`<section>${projectUxIcon('window')}<span>${esc(l)}</span><b>${esc(projectUxText(v)||'Non renseign\u00e9')}</b></section>`).join('')}</div><small class="p10-note">Aucune r\u00e9partition en % sans quantit\u00e9s par type de baie.</small></article>`;}
  function projectUxSynthesisHtml(project,op){
    const cov=projectUxCoverage(op),gain=projectUxGain(op),status=projectUxStatus(op||project),cep=projectUxCep(op),ic=projectUxNumber(op,'icConstruction');
    const lines=[['check',status.label],['energy',cep===null?'CEP projet non renseign\u00e9.':`CEP projet : ${fmt(cep,1)} kWhEP/m\u00b2.an.`],['chart',gain===null?'Gain avant / apr\u00e8s non calculable.':`${gain>=0?'R\u00e9duction':'Hausse'} du CEP de ${fmt(Math.abs(gain),1)} %.`],['leaf',ic===null?'IC construction non renseign\u00e9.':`IC construction : ${fmt(ic,1)} kgCO\u2082e/m\u00b2.`],['source',`${cov.count} des ${cov.total} champs techniques de synth\u00e8se sont renseign\u00e9s.`]];
    return `<article class="p10-card p10-synthesis">${projectUxHeading('En synth\u00e8se','leaf')}<ul>${lines.map(([i,t])=>`<li>${projectUxIcon(i)}<span>${esc(t)}</span></li>`).join('')}</ul><p>Lecture automatique du b\u00e2timent s\u00e9lectionn\u00e9.</p></article><article class="p10-card p10-place-card">${projectUxHeading('Localisation','pin')}<div class="p10-place-icon">${projectUxIcon('pin')}</div><b>${esc(projectUxText(project.city)||'Commune non renseign\u00e9e')}</b><p>${esc([projectUxText(project.address),project.postalCode].filter(Boolean).join(' \u00b7 '))}</p><span>${esc(departmentName(project.department))}</span><small>${esc(operationRegion(project))}</small>${project.department?'<button type="button" class="p10-button" data-project-locate="1">Voir ce territoire '+projectUxIcon('arrow')+'</button>':''}</article>`;
  }
  function projectUxTagsHtml(project,op){
    const tags=projectTags(project,op).map(projectUxText),selected=state.projectTagFilter;let result='';
    if(selected){
      const children=sourceTechnicalOperations(),projects=baseOperations();const groups=new Map();children.forEach(t=>{let p=String(t.projectCode||'');if(privacy()?.enabled?.())p=privacy().operationCode(p);if(!groups.has(p))groups.set(p,[]);groups.get(p).push(t);});
      const matches=projects.filter(p=>[p,...(groups.get(String(p.code))||[])].some(t=>projectTags(p,t).some(tag=>norm(projectUxText(tag))===norm(selected))));
      result=`<div class="p10-tag-results"><header><b>${fmt(matches.length)} projet${matches.length>1?'s':''} avec le tag \u00ab ${esc(selected)} \u00bb</b><button type="button" class="p10-text-link" data-project-tag-clear="1">Effacer</button></header><div>${matches.map(p=>`<button type="button" data-project-open="${attr(p.code)}"><b>${esc(projectUxText(p.name||p.code))}</b><span>${esc(projectUxText(p.moa))}</span>${projectUxIcon('arrow')}</button>`).join('')||'<p>Aucun autre projet dans la population active.</p>'}</div></div>`;
    }
    return `<article class="p10-card p10-tags-card">${projectUxHeading('Tags & projets similaires','tag')}<div class="p10-tags">${tags.map(t=>`<button type="button" data-project-tag="${attr(t)}" aria-pressed="${norm(selected)===norm(t)}">${esc(t)}</button>`).join('')||'<span class="p10-note">Aucun tag renseign\u00e9.</span>'}</div>${result}</article>`;
  }
  function projectGeneralHtml(project,op){
    const cert=op||project;
    return `<div class="p10-dashboard"><div class="p10-dashboard-main"><div class="p10-pair"><article class="p10-card">${projectUxHeading('Identit\u00e9 du projet','source')}<dl class="p10-data-list">${projectUxDatum('Code projet',project.code)}${projectUxDatum('Ma\u00eetre d\u2019ouvrage',project.moa)}${projectUxDatum('Groupe MOA',privacy()?.enabled?.()&&project.moaGroup?privacy().moa(project.moaGroup):project.moaGroup)}${projectUxDatum('Ann\u00e9e de construction',op?.constructionYear)}${projectUxDatum('Ann\u00e9e de certification',cert.year)}${projectUxDatum('R\u00e9f\u00e9rentiel',cert.referential)}</dl></article>${projectUxTimelineHtml(project,op)}</div><div class="p10-pair">${projectUxEnvelopeHtml(op)}${projectUxCvcHtml(op)}</div><article class="p10-card p10-performance-card">${projectUxHeading('Performances \u00e9nerg\u00e9tiques','chart','energy')}<div class="p10-performance-grid">${projectUxCompareChart(op)}${projectUxDpeHtml(op)}</div></article>${projectUxWindowsHtml(op)}${projectUxTagsHtml(project,op)}</div><aside class="p10-dashboard-aside">${projectUxSynthesisHtml(project,op)}<article class="p10-card p10-cert-card">${projectUxHeading('Certification','check')}<dl class="p10-data-list">${projectUxDatum('Mention / label',projectUxValue(cert,'mentions')||cert.mentions)}${projectUxDatum('Performance',projectUxValue(cert,'performance')||cert.performance)}${projectUxDatum('Profil',projectUxValue(cert,'profile')||cert.profile)}${projectUxDatum('Version du r\u00e9f\u00e9rentiel',projectUxText(cert?.version)||projectUxRawHeader(cert,'Version')||projectUxRawHeader(cert,'Version du r\u00e9f\u00e9rentiel applicable: Version'))}</dl></article></aside></div>`;
  }
  function projectUxSourceHtml(op){
    const entries=Object.entries(op?.raw||{});
    return `<section class="p10-card p10-source-card" aria-label="Donn\u00e9es source du b\u00e2timent"><div class="p10-card-head"><h3>${projectUxIcon('source')}Donn\u00e9es source \u00b7 ligne s\u00e9lectionn\u00e9e</h3><button class="p10-text-link" data-project-source="1" type="button">Masquer</button></div><div class="p10-source-scroll"><table><thead><tr><th>Colonne OPERATIONS</th><th>Valeur d\u00e9clar\u00e9e</th></tr></thead><tbody>${entries.map(([k,v])=>`<tr><th scope="row">${esc(k)}</th><td>${esc(projectUxText(v))||'\u2014'}</td></tr>`).join('')||'<tr><td colspan="2">Aucune ligne source disponible.</td></tr>'}</tbody></table></div></section>`;
  }
  function projectUxSelected(){
    const project=state.activeProject,techs=projectTechnicalOperations(project),selected=techs.find(o=>String(o.code)===String(state.projectWindowTechnicalCode))||techs[0]||project;
    return {project,techs,selected:projectUxScopedOperation(selected)};
  }
  function projectUxPosition(){
    if(!projectWindowEl)return;const main=document.querySelector('.obs-main'),top=document.querySelector('.obs-topbar');
    const left=window.innerWidth>=1260&&main?Math.max(12,main.getBoundingClientRect().left+10):12;
    const y=window.innerWidth>=1260&&top?Math.max(12,top.getBoundingClientRect().bottom+10):12;
    projectWindowEl.style.setProperty('--p10-left',left+'px');projectWindowEl.style.setProperty('--p10-top',y+'px');
  }
  function projectUxRestoreFocus(kind,value){
    if(!kind||!projectWindowEl)return;
    const attrName={'tab':'data-project-tab','tag':'data-project-tag','source':'data-project-source','select':'data-project-building-select'}[kind];
    const nodes=projectWindowEl.querySelectorAll('['+attrName+']'),match=Array.from(nodes).find(el=>kind==='select'||kind==='source'||el.getAttribute(attrName)===value);
    match?.focus({preventScroll:true});
  }
  function projectUxRefresh(kind,value){
    const sc=projectWindowEl?.querySelector('[data-project-scroll]'),snapshot=sc?{top:sc.scrollTop,left:sc.scrollLeft}:null;
    renderProjectWindow();projectUxRestoreFocus(kind,value);
    if(snapshot){const restore=()=>{sc.scrollTop=snapshot.top;sc.scrollLeft=snapshot.left;};restore();requestAnimationFrame(restore);}
  }
  function ensureProjectWindow(){
    if(projectWindowEl)return projectWindowEl;
    projectWindowEl=document.createElement('div');projectWindowEl.className='obs-project-window obs-project-ux10';projectWindowEl.setAttribute('aria-hidden','true');
    projectWindowEl.innerHTML=`<div class="obs-project-window-backdrop" data-project-close="1"></div><section class="obs-project-window-panel" role="dialog" aria-modal="true" aria-labelledby="obsProjectUxTitle"><div class="p10-toolbar"><button type="button" class="p10-back" data-project-close="1">${projectUxIcon('back')}Retour \u00e0 l\u2019Observatoire</button><span>PROJETS & OP\u00c9RATIONS <b data-project-code></b></span><button type="button" class="p10-close" data-project-close="1" aria-label="Fermer la fiche projet">${projectUxIcon('close')}</button></div><div class="p10-scroll" data-project-scroll><div class="p10-intro" data-project-intro></div><div class="p10-selector" data-project-selector></div><nav class="p10-tabs" data-project-main-tabs role="tablist" aria-label="Rubriques de la fiche"></nav><div class="p10-source-slot" data-project-source-slot></div><main class="p10-body" data-project-body role="tabpanel" id="obsProjectUxPanel"></main><footer class="p10-footer">Observatoire Prestaterre \u00b7 V6.12 <span>Les valeurs absentes ne sont pas remplac\u00e9es par z\u00e9ro.</span></footer></div></section>`;
    document.body.appendChild(projectWindowEl);
    projectWindowEl.addEventListener('click',e=>{
      if(e.target.closest('[data-project-close]')){closeProjectWindow();return;}
      const tab=e.target.closest('[data-project-tab]');if(tab){state.projectWindowTab=tab.dataset.projectTab;projectUxRefresh('tab',state.projectWindowTab);return;}
      const tag=e.target.closest('[data-project-tag]');if(tag){state.projectTagFilter=tag.dataset.projectTag;projectUxRefresh('tag',state.projectTagFilter);return;}
      if(e.target.closest('[data-project-tag-clear]')){state.projectTagFilter='';projectUxRefresh();return;}
      const open=e.target.closest('[data-project-open]');if(open){openProjectWindow(open.dataset.projectOpen);return;}
      if(e.target.closest('[data-project-source]')){projectUxShowSource=!projectUxShowSource;projectUxRefresh('source');return;}
      if(e.target.closest('[data-project-export]')){projectUxExport();return;}
      if(e.target.closest('[data-project-locate]')){const dep=state.activeProject?.department;closeProjectWindow();if(dep)quickFilter('department',dep);changePage('territories');}
    });
    projectWindowEl.addEventListener('change',e=>{if(e.target.matches('[data-project-building-select]')){state.projectWindowTechnicalCode=e.target.value;projectUxRefresh('select');}});
    projectWindowEl.addEventListener('keydown',e=>{
      if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closeProjectWindow();return;}
      if(e.target.matches('[role="tab"]')&&['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){
        e.preventDefault();const keys=PROJECT_UX_TABS.map(t=>t[0]),index=keys.indexOf(state.projectWindowTab);state.projectWindowTab=e.key==='Home'?keys[0]:e.key==='End'?keys[keys.length-1]:keys[(index+(e.key==='ArrowRight'?1:-1)+keys.length)%keys.length];projectUxRefresh('tab',state.projectWindowTab);return;
      }
      if(e.key==='Tab'){
        const nodes=Array.from(projectWindowEl.querySelectorAll('button:not([disabled]),select,input,summary,a[href],[tabindex="0"]')).filter(n=>n.getClientRects().length&&!n.closest('[hidden]'));
        const first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
      }
    });
    window.addEventListener('resize',projectUxPosition);
    return projectWindowEl;
  }
  function renderProjectWindow(){
    if(!state.activeProject)return;const el=ensureProjectWindow(),{project,techs,selected}=projectUxSelected();
    if(selected?.code)state.projectWindowTechnicalCode=selected.code;
    el.querySelector('[data-project-code]').textContent=project.code||'';
    el.querySelector('[data-project-intro]').innerHTML=projectUxHeroHtml(project,selected)+projectUxKpisHtml(project,selected,techs);
    const index=techs.findIndex(t=>String(t.code)===String(selected?.code));
    el.querySelector('[data-project-selector]').innerHTML=`<div><span class="p10-eyebrow">P\u00c9RIM\u00c8TRE TECHNIQUE</span><label for="obsProjectBuildingSelect">${projectUxIcon('building')}B\u00e2timent / op\u00e9ration</label></div><select id="obsProjectBuildingSelect" data-project-building-select ${techs.length<=1?'disabled':''}>${(techs.length?techs:[selected]).map((o,i)=>`<option value="${attr(o?.code)}" ${String(o?.code)===String(selected?.code)?'selected':''}>${esc(projectTechnicalLabel(o,i))}</option>`).join('')}</select><p><b>${techs.length>1?`${index+1} / ${techs.length}`:'1 ligne technique'}</b>Les graphiques et les descriptifs suivent cette s\u00e9lection. Les logements et b\u00e2timents du bandeau sont les totaux du projet.</p>`;
    el.querySelector('[data-project-main-tabs]').innerHTML=PROJECT_UX_TABS.map(([k,l,i])=>`<button type="button" id="obsProjectTab-${k}" data-project-tab="${k}" class="${state.projectWindowTab===k?'is-active':''}" role="tab" aria-selected="${state.projectWindowTab===k}" aria-controls="obsProjectUxPanel" tabindex="${state.projectWindowTab===k?0:-1}">${projectUxIcon(i)}${esc(l)}</button>`).join('');
    el.querySelector('[data-project-source-slot]').innerHTML=projectUxShowSource?projectUxSourceHtml(selected):'';
    const body={general:()=>projectGeneralHtml(project,selected),building:()=>projectBuildingHtml(project,selected),energy:()=>projectEnergyHtml(project,selected),carbon:()=>projectCarbonHtml(project,selected),economics:()=>projectEconomicsHtml()}[state.projectWindowTab];
    const panel=el.querySelector('[data-project-body]');panel.setAttribute('aria-labelledby','obsProjectTab-'+state.projectWindowTab);panel.innerHTML=body?body():projectGeneralHtml(project,selected);projectUxPosition();
  }
  function openProjectWindow(code,technicalCode=''){
    const project=sourceOperations().find(o=>String(o.code)===String(code));if(!project)return;
    const alreadyOpen=projectWindowEl?.classList.contains('is-open');
    if(!alreadyOpen){projectUxReturnFocus=document.activeElement;projectUxBackgroundScroll=captureUiScroll();const shell=document.getElementById('appShell');projectUxPreviousInert=Boolean(shell?.inert);if(shell)shell.inert=true;}
    closeDrawer();state.activeProject=project;state.projectWindowTab='general';state.projectTagFilter='';projectUxShowSource=false;
    const techs=projectTechnicalOperations(project);state.projectWindowTechnicalCode=technicalCode||techs[0]?.code||'';
    const el=ensureProjectWindow();renderProjectWindow();el.classList.add('is-open');el.setAttribute('aria-hidden','false');document.body.classList.add('obs-project-window-open');el.querySelector('[data-project-scroll]').scrollTop=0;
    requestAnimationFrame(()=>el.querySelector('.p10-close')?.focus({preventScroll:true}));
  }
  function closeProjectWindow(){
    if(!projectWindowEl?.classList.contains('is-open'))return;
    projectWindowEl.classList.remove('is-open');projectWindowEl.setAttribute('aria-hidden','true');document.body.classList.remove('obs-project-window-open');
    const shell=document.getElementById('appShell');if(shell)shell.inert=projectUxPreviousInert;
    state.activeProject=null;state.projectTagFilter='';projectUxShowSource=false;projectWindowEl.querySelector('[data-project-body]').innerHTML='';projectWindowEl.querySelector('[data-project-intro]').innerHTML='';projectWindowEl.querySelector('[data-project-source-slot]').innerHTML='';projectWindowEl.querySelector('[data-project-code]').textContent='';projectWindowEl.querySelector('[data-project-selector]').innerHTML='';
    if(projectUxReturnFocus?.isConnected)projectUxReturnFocus.focus({preventScroll:true});restoreUiScroll(projectUxBackgroundScroll);
  }
  async function projectUxExport(){
    if(projectUxExportBusy||!state.activeProject)return;projectUxExportBusy=true;
    const {project,selected,techs}=projectUxSelected(),button=projectWindowEl.querySelector('[data-project-export]');if(button)button.disabled=true;
    try{
      const css=await Promise.all(['newosb.css?v=6.13.6','project-ux.css?v=6.13.6'].map(async path=>{const response=await fetch(path);if(!response.ok)throw new Error('Feuille de style indisponible');return response.text();}));
      const picture=await fetch('assets/building_final.png');if(!picture.ok)throw new Error('Illustration indisponible');const blob=await picture.blob();const image=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(blob);});
      const sections=[['Vue d\u2019ensemble',projectGeneralHtml(project,selected)],['B\u00e2timent & \u00e9quipements',projectBuildingHtml(project,selected)],['\u00c9nergie & transition',projectEnergyHtml(project,selected)],['Carbone & DPE',projectCarbonHtml(project,selected)],['Donn\u00e9es \u00e9conomiques',projectEconomicsHtml()]];
      const htmlBody=projectUxHeroHtml(project,selected)+projectUxKpisHtml(project,selected,techs)+`<p>Op\u00e9ration technique : ${esc(projectTechnicalLabel(selected,Math.max(0,techs.findIndex(t=>t.code===selected.code))))} \u00b7 ${esc(selected.code)} \u00b7 export du ${esc(new Date().toLocaleDateString('fr-FR'))}</p>`+sections.map(([l,h])=>`<section class="p10-export-section"><h2>${esc(l)}</h2>${h}</section>`).join('');
      const holder=document.createElement('div');holder.innerHTML=htmlBody;holder.querySelectorAll('button').forEach(b=>{if(b.matches('[data-project-tag]')){const span=document.createElement('span');span.textContent=b.textContent;b.replaceWith(span);}else b.remove();});holder.querySelectorAll('img').forEach(img=>img.src=image);
      const doc='<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(project.name||project.code)+' - Observatoire Prestaterre</title><style>'+css.join('\n').replace(/<\/style/gi,'<\\/style')+'\nbody{margin:0;padding:24px;font-family:Arial,sans-serif;background:#f3f6f4}.obs-project-ux10{position:static!important;visibility:visible!important;pointer-events:auto!important;max-width:1600px;margin:auto}.p10-export-section{margin-top:28px;break-before:auto}.p10-hero-actions{display:none!important}.p10-export-section>.obs-project-building,.p10-export-section>.obs-project-energy,.p10-export-section>.obs-project-carbon{max-width:none}.p10-tags>span{border:1px solid #dfe8e4;border-radius:16px;padding:6px 10px;background:#f6faf8}@media print{body{padding:0}.p10-card{break-inside:avoid}.p10-export-section{break-before:page}}</style></head><body><main class="obs-project-ux10">'+holder.innerHTML+'</main></body></html>';
      const url=URL.createObjectURL(new Blob([doc],{type:'text/html;charset=utf-8'})),link=document.createElement('a');link.href=url;link.download='Fiche_'+String(project.code||'projet').replace(/[^a-z0-9_-]/gi,'_')+'_'+String(selected.technicalIndex||1)+'.html';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
    }catch(error){console.error('Export fiche',error);const notice=document.createElement('p');notice.className='p10-export-error';notice.setAttribute('role','alert');notice.textContent='Export indisponible. Les donn\u00e9es restent accessibles dans la fiche.';projectWindowEl.querySelector('.p10-hero-actions')?.appendChild(notice);}
    finally{projectUxExportBusy=false;if(button?.isConnected)button.disabled=false;}
  }

  function openTechnicalOperation(code){
    const op=sourceTechnicalOperations().find(o=>String(o.code)===String(code));if(!op)return;
    const parent=privacy()?.enabled?.()?privacy().operationCode(op.projectCode):op.projectCode;
    openProjectWindow(parent,op.code);
  }
  function openOperation(code){closeDrawer();openProjectWindow(code);}
  function closeDrawer(){drawer.classList.remove('is-open');drawer.setAttribute('aria-hidden','true');state.activeMoaGroup='';state.activeGroupMoa='';}
  function detail(label,value){return `<div class="obs-detail"><span>${esc(label)}</span><b>${esc(value||'—')}</b></div>`;}
  function openMoaGroupDrawer(group){
    state.activeMoaGroup=group;state.activeGroupMoa='';state.activeOperation=null;
    drawerTitle.textContent=group||'Groupe MOA';drawerMeta.textContent='Portefeuille Groupe MOA';renderDrawer();drawer.classList.add('is-open');drawer.setAttribute('aria-hidden','false');
  }
  function renderMoaGroupDrawer(){
    const group=state.activeMoaGroup,ops=filteredOperations().filter(o=>norm(o.moaGroup||'Non précisé')===norm(group)),moas=countBy(ops,o=>o.moa).map(x=>({...x,ops:ops.filter(o=>norm(o.moa)===norm(x.name))}));
    drawerTabs.innerHTML='';
    if(state.activeGroupMoa){const list=ops.filter(o=>norm(o.moa)===norm(state.activeGroupMoa));drawerBody.innerHTML=`<button type="button" class="obs-group-back" data-group-back="1">← Retour au groupe</button><div class="obs-group-title"><span>MAÎTRE D’OUVRAGE</span><h3>${esc(state.activeGroupMoa)}</h3><p>${fmt(list.length)} projets · ${fmt(sum(list,o=>o.dwellings))} logements</p></div>${operationsTable(list)}`;return;}
    drawerBody.innerHTML=`<div class="obs-group-kpis"><div><b>${fmt(moas.length)}</b><span>MOA</span></div><div><b>${fmt(ops.length)}</b><span>projets</span></div><div><b>${fmt(sum(ops,o=>o.dwellings))}</b><span>logements</span></div><div><b>${fmt(sum(ops,o=>o.buildings))}</b><span>bâtiments</span></div></div><div class="obs-group-moa-list"><h3>Maîtres d’ouvrage du groupe</h3>${moas.map(m=>`<button type="button" data-group-moa="${attr(m.name)}"><span><b>${esc(m.name)}</b><small>${fmt(m.value)} projets · ${fmt(m.dwellings)} logements</small></span><strong>→</strong></button>`).join('')}</div>`;
  }

  function renderDrawer(){
    if(state.activeMoaGroup){renderMoaGroupDrawer();return;}
    const op=state.activeOperation;if(!op)return;
    const isTechnical=Boolean(op.projectCode); const tabs=[['summary',isTechnical?'Opération technique':'Projet 360°'],['certification','Certification'],['technical','Technique'],['energy','Énergie'],['carbon','Carbone & DPE'],['quality','Qualité'],['compare','Comparables'],['trace','Traçabilité'],['source','Données source']];
    drawerTabs.innerHTML=tabs.map(([k,l])=>`<button type="button" data-drawer-tab="${k}" class="${state.drawerTab===k?'is-active':''}">${l}</button>`).join('');
    const content={
      summary:()=>`<div class="obs-detail-grid">${detail(isTechnical?'Projet parent':'Code projet',isTechnical?op.projectCode:op.code)}${isTechnical?detail('Opération technique',`Ligne ${op.technicalIndex||'—'}`):''}${detail('Maître d’ouvrage',op.moa)}${detail('Groupe MOA',op.moaGroup||'Non précisé')}${detail('Référentiel',op.referential)}${detail('Nature',op.nature)}${detail('Localisation',[op.address,op.postalCode,op.city,departmentName(op.department)].filter(Boolean).join(' · '))}${detail('Année certification',op.year)}${detail('Année construction',op.constructionYear)}${!isTechnical?detail('Logements',fmt(op.dwellings)):''}${!isTechnical?detail('Bâtiments',fmt(op.buildings)):''}${detail(!isTechnical&&(op.rawRows||[]).length>1?'Avancement global (étape la moins avancée)':'Avancement',op.rawStatus||STATUS_LABELS[op.status])}${detail('Affaire : Étape',operationAffairStage(op))}${!isTechnical?detail('Opérations techniques',fmt((op.rawRows||[op.raw]).length)):''}</div>${isTechnical?'':projectTechnicalChildrenHtml(op)}${operationTimelineHtml(op)}`,
      certification:()=>`<div class="obs-detail-grid">${detail('Statut',op.rawStatus||STATUS_LABELS[op.status])}${detail('Étape normalisée',STATUS_LABELS[op.status]||op.status)}${detail('Soldée',op.sold?'Oui':'Non')}${detail('Mentions',op.mentions)}${detail('Performance',op.performance)}${detail('Profil',op.profile)}</div>`,
      technical:()=>`<div class="obs-detail-grid">${detail('Structure principale',op.structure)}${detail('Structure toiture',op.roofStructure)}${detail('Isolation toiture',op.roofInsulation)}${detail('R toiture',rawValue(op,'roofR'))}${detail('Épaisseur toiture',rawValue(op,'roofThickness'))}${detail('Structure façade',op.wallStructure)}${detail('Isolation façade',op.wallInsulation)}${detail('R façade',rawValue(op,'wallR'))}${detail('Épaisseur façade',rawValue(op,'wallThickness'))}${detail('Structure plancher bas',op.floorStructure)}${detail('Isolation plancher',op.floorInsulation)}${detail('R plancher',rawValue(op,'floorR'))}${detail('Épaisseur plancher',rawValue(op,'floorThickness'))}${detail('Menuiseries',op.windowMaterial)}${detail('Vitrage',op.windowGlazing)}${detail('Occultations',op.windowShading)}${detail('Ventilation',op.ventilation)}${detail('Refroidissement',op.cooling)}</div>`,
      energy:()=>`<div class="obs-detail-grid">${detail('Chauffage avant',op.heatingBefore)}${detail('Chauffage après',op.heatingAfter)}${detail('Mode chauffage après',op.heatingModeAfter)}${detail('ECS avant',op.ecsBefore)}${detail('ECS après',op.ecsAfter)}${detail('Bbio',rawValue(op,'bbio'))}${detail('Bbio max',rawValue(op,'bbioMax'))}${detail('Cep',rawValue(op,'cep'))}${detail('Cep max',rawValue(op,'cepMax'))}${detail('Cep,nr',rawValue(op,'cepnr'))}${detail('Cep,nr max',rawValue(op,'cepnrMax'))}${detail('DH',rawValue(op,'dh'))}${detail('DH max',rawValue(op,'dhMax'))}${detail('Ubat avant',rawValue(op,'ubatBefore'))}${detail('Ubat après',rawValue(op,'ubatAfter'))}${detail('Cep avant travaux',rawValue(op,'cepBefore'))}${detail('Cep après travaux',rawValue(op,'cepAfter'))}</div>`,
      carbon:()=>`<div class="obs-detail-grid">${detail('IC Énergie',rawValue(op,'icEnergy'))}${detail('IC Énergie max',rawValue(op,'icEnergyMax'))}${detail('IC Construction',rawValue(op,'icConstruction'))}${detail('IC Construction max',rawValue(op,'icConstructionMax'))}${detail('DPE énergie avant',rawValue(op,'dpeEnergyBefore'))}${detail('DPE énergie après',rawValue(op,'dpeEnergyAfter'))}${detail('DPE GES avant',rawValue(op,'dpeGesBefore'))}${detail('DPE GES après',rawValue(op,'dpeGesAfter'))}</div>`,
      quality:()=>operationQualityHtml(op),
      compare:()=>operationComparablesHtml(op),
      trace:()=>operationTraceHtml(op),
      source:()=>rawTable(op)
    }[state.drawerTab];
    drawerBody.innerHTML=content?content():'';
  }
  function projectTechnicalChildrenHtml(project){
    const children=(engine.getTechnicalOperations?.()||[]).filter(o=>String(o.projectCode||'')===String(project.code));
    if(children.length<=1)return '<div class="obs-project-children"><h3>Opérations techniques</h3><p>1 ligne technique rattachée à ce projet.</p></div>';
    return `<div class="obs-project-children"><h3>Opérations techniques · ${fmt(children.length)}</h3><div class="obs-project-child-list">${children.map((o,i)=>{const tech=[['Bbio','bbio'],['CEP','cep'],['DH','dh'],['TIC','tic'],['IC Construction','icConstruction']].map(([l,k])=>{const v=rawValue(o,k);return String(v??'').trim()?`${l} ${v}`:''}).filter(Boolean).slice(0,3).join(' · ');return `<button type="button" class="obs-project-child-btn" data-tech-op-code="${attr(o.code)}"><b>Opération ${i+1}</b><span>${esc(tech||'Données techniques disponibles dans la ligne source')}</span><strong>→</strong></button>`;}).join('')}</div></div>`;
  }

  function operationTimelineHtml(op){
    const raw=(op.rawRows&&op.rawRows[0])||op.raw||{};
    const wanted=[['création','Création'],['accepte','Acceptation'],['activation','Activation'],['decision ap','Décision AP'],['decision cd','Décision CD'],['visite','Visite'],['conforme','Conformité']];
    const events=[];
    Object.entries(raw).forEach(([k,v])=>{if(!String(v??'').trim())return;const nk=norm(k);const hit=wanted.find(([needle])=>nk.includes(needle));if(!hit)return;const d=new Date(String(v).replace(/(\d{2})\/(\d{2})\/(\d{4})/,'$3-$2-$1'));if(!Number.isNaN(d.getTime()))events.push({label:hit[1],source:k,date:d,value:v});});
    const dedup=[];events.sort((a,b)=>a.date-b.date).forEach(e=>{if(!dedup.some(x=>x.label===e.label&&x.date.getTime()===e.date.getTime()))dedup.push(e);});
    if(!dedup.length)return '<div class="obs-op-timeline"><h3>Chronologie</h3><div class="obs-empty">Aucune date métier exploitable dans les données source de cette opération.</div></div>';
    return `<div class="obs-op-timeline"><h3>Chronologie</h3><div class="obs-op-timeline-track">${dedup.slice(0,10).map(e=>`<article><i></i><b>${esc(e.label)}</b><span>${esc(e.date.toLocaleDateString('fr-FR'))}</span><small title="${attr(e.source)}">${esc(shorten(e.source,42))}</small></article>`).join('')}</div></div>`;
  }

  function operationQualityHtml(op){
    const q=core?.qualityForOperation?.(op)||{score:0,issues:[]};
    const fields=['moa','department','referential','dwellings','buildings','bbio','cep','dh','icConstruction','dpeEnergyBefore','dpeEnergyAfter'];
    const complete=fields.filter(k=>String(rawValue(op,k)||op?.[k]||'').trim()!=='').length, rate=100*complete/fields.length;
    return `<div class="obs-op-quality"><div class="obs-op-quality-score"><strong>${fmt(q.score,0)} %</strong><span>cohérence</span></div><div class="obs-op-quality-score"><strong>${fmt(rate,0)} %</strong><span>complétude clé</span></div></div><div class="obs-quality-issues">${q.issues.length?q.issues.map(i=>`<div class="obs-quality-issue ${i.severity}"><b>${i.severity==='error'?'Erreur':i.severity==='warn'?'Alerte':'Information'}</b><span>${esc(i.label)}</span></div>`).join(''):'<div class="obs-empty obs-quality-ok">✓ Aucun contrôle déclenché.</div>'}</div>`;
  }
  function operationComparablesHtml(op){
    const comps=core?.comparableSet?.(op,baseOperations())||[];const metrics=['bbio','cep','dh','icConstruction'];
    const rows=metrics.map(k=>{const target=rawNumber(op,k),st=core?.stats?.(comps,k),d=core?.dictByKey?.[k];return {k,target,st,d};}).filter(x=>x.target!==null&&x.st?.n);
    return `<div class="obs-comparable-head"><b>${fmt(comps.length)} opérations comparables</b><p>Même référentiel et nature privilégiés, puis proximité année, taille, famille MOA et territoire. Aucun classement : comparaison descriptive uniquement.</p></div>${rows.length?`<div class="obs-table-wrap"><table class="obs-table"><thead><tr><th>Indicateur</th><th>Projet</th><th>Médiane comparable</th><th>Q1 – Q3</th><th>n</th></tr></thead><tbody>${rows.map(x=>`<tr><td><strong>${esc(x.d?.label||x.k)}</strong><br><small>${esc(x.d?.unit||'')}</small></td><td>${fmt(x.target,1)}</td><td>${fmt(x.st.median,1)}</td><td>${fmt(x.st.q1,1)} – ${fmt(x.st.q3,1)}</td><td>${fmt(x.st.n)}</td></tr>`).join('')}</tbody></table></div>`:'<div class="obs-empty">Pas assez de données comparables sur les indicateurs disponibles.</div>'}`;
  }
  function operationTraceHtml(op){
    const keys=['code','name','moa','moaGroup','department','referential','status','affairStage','dwellings','buildings','bbio','cep','dh','icEnergy','icConstruction','dpeEnergyBefore','dpeEnergyAfter'];
    return `<div class="obs-trace-list">${keys.map(k=>{const p=core?.provenance?.(op,k)||{};const v=rawValue(op,k)||op?.[k]||'';return `<article><div><b>${esc(p.label||k)}</b><small>${esc(p.type||'source')}</small></div><strong>${esc(v||'—')}</strong><p>${esc(p.header?`Colonne source : ${p.header}`:(p.source||'Observatoire Prestaterre'))}</p><p>${esc(p.method||'')}</p></article>`;}).join('')}</div>`;
  }

  function rawTable(op){
    const raw=(op.rawRows&&op.rawRows[0])||op.raw||{}, rows=Object.entries(raw).filter(([,v])=>String(v??'').trim()!=='');
    const model=paged(rows,state.rawPage,15); state.rawPage=model.page;
    const toggle=`<div class="obs-raw-view-head"><span>Données source · ${fmt(rows.length)} champs</span>${tableViewToggle('raw',state.rawView,['list','tiles'])}</div>`;
    if(state.rawView==='tiles'){
      return `${toggle}<div class="obs-raw-tiles">${model.items.map(([k,v])=>`<article><span>${esc(k)}</span><b>${esc(v)}</b></article>`).join('')}</div>${paginationHtml('raw',model)}`;
    }
    return `${toggle}<div class="obs-table-wrap"><table class="obs-raw"><tbody>${model.items.map(([k,v])=>`<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}</tbody></table>${paginationHtml('raw',model)}</div>`;
  }


  function csvCurrent(){
    const ops=filteredOperations(); const header=['Code projet','Nom projet','Maître d’ouvrage','Groupe MOA','Département','Ville','Référentiel','Avancement','Année certification','Année construction','Nature','Total logements','Total bâtiments'];
    const cell=v=>`"${String(v??'').replace(/"/g,'""')}"`;
    return [header,...ops.map(o=>[o.code,o.name,o.moa,o.moaGroup||'',o.department,o.city,o.referential,o.rawStatus,o.year,o.constructionYear||'',o.nature,o.dwellings,o.buildings])].map(row=>row.map(cell).join(';')).join('\n');
  }
  function exportCurrentCsv(){
    const blob=new Blob(['\ufeff'+csvCurrent()],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=`Observatoire_Prestaterre_selection_${new Date().toISOString().slice(0,10)}.csv`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
  }

  function walkCoordinates(geometry,callback){
    if(!geometry?.coordinates)return;
    const walk=value=>{if(Array.isArray(value)&&value.length>=2&&typeof value[0]==='number'&&typeof value[1]==='number'){callback(value[0],value[1]);return;}if(Array.isArray(value))value.forEach(walk);};
    walk(geometry.coordinates);
  }
  function projector(features,box){
    const points=[];features.forEach(f=>walkCoordinates(f.geometry,(lon,lat)=>points.push([lon,lat])));if(!points.length)return()=>[box.x,box.y];
    const avgLat=points.reduce((s,p)=>s+p[1],0)/points.length, cos=Math.cos(avgLat*Math.PI/180);let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
    points.forEach(([lon,lat])=>{const x=lon*cos;minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,lat);maxY=Math.max(maxY,lat);});
    const width=Math.max(.0001,maxX-minX),height=Math.max(.0001,maxY-minY),scale=Math.min(box.width/width,box.height/height),usedW=width*scale,usedH=height*scale,ox=box.x+(box.width-usedW)/2,oy=box.y+(box.height-usedH)/2;
    return(lon,lat)=>[ox+(lon*cos-minX)*scale,oy+usedH-(lat-minY)*scale];
  }
  function geometryPath(geometry,project){
    const ringPath=ring=>{let d='';ring.forEach((point,i)=>{const p=project(point[0],point[1]);d+=`${i?'L':'M'}${p[0].toFixed(1)},${p[1].toFixed(1)} `;});return d+'Z ';};
    let d='';if(geometry.type==='Polygon')geometry.coordinates.forEach(r=>d+=ringPath(r));else if(geometry.type==='MultiPolygon')geometry.coordinates.forEach(poly=>poly.forEach(r=>d+=ringPath(r)));return d;
  }
  function featureCode(feature){const p=feature?.properties||{};return String(p.code||p.CODE||p.CODE_DEPT||'').toUpperCase().trim();}
  function metroDepartment(code){if(code==='2A'||code==='2B')return true;return /^\d{2}$/.test(code)&&Number(code)>=1&&Number(code)<=95;}

  function mapZoneColor(zone){
    const z=norm(zone).replace(/\s+/g,'');
    if(z==='zone1'||z==='1'||z==='i'||z==='zonei') return '#06402B';
    if(z==='zone2'||z==='2'||z==='ii'||z==='zoneii') return '#79A98F';
    if(z==='zone3'||z==='3'||z==='iii'||z==='zoneiii') return '#D5E5C8';
    return '#E9EEEB';
  }
  function featureCenter(feature,project){
    let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
    walkCoordinates(feature.geometry,(lon,lat)=>{const [x,y]=project(lon,lat);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);});
    return Number.isFinite(minX)?[(minX+maxX)/2,(minY+maxY)/2]:[0,0];
  }
  function groupCenter(features,project){
    let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
    features.forEach(feature=>walkCoordinates(feature.geometry,(lon,lat)=>{const [x,y]=project(lon,lat);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}));
    return Number.isFinite(minX)?[(minX+maxX)/2,(minY+maxY)/2]:[0,0];
  }
  function regionBoundaryPath(features,project){
    const segments=new Map();
    const addRing=(ring,region)=>{
      for(let i=1;i<ring.length;i++){
        const a=ring[i-1],b=ring[i];
        const pa=`${a[0].toFixed(4)},${a[1].toFixed(4)}`,pb=`${b[0].toFixed(4)},${b[1].toFixed(4)}`,key=pa<pb?`${pa}|${pb}`:`${pb}|${pa}`;
        if(!segments.has(key))segments.set(key,{a,b,regions:new Set(),count:0});const seg=segments.get(key);seg.regions.add(region);seg.count++;
      }
    };
    features.forEach(f=>{const region=regionName(featureCode(f));const g=f.geometry;if(g?.type==='Polygon')g.coordinates.forEach(r=>addRing(r,region));else if(g?.type==='MultiPolygon')g.coordinates.forEach(poly=>poly.forEach(r=>addRing(r,region)));});
    let d='';segments.forEach(seg=>{if(seg.count===1||seg.regions.size>1){const [x1,y1]=project(seg.a[0],seg.a[1]),[x2,y2]=project(seg.b[0],seg.b[1]);d+=`M${x1.toFixed(1)},${y1.toFixed(1)}L${x2.toFixed(1)},${y2.toFixed(1)} `;}});
    return d;
  }


  const REGION_CODE_BY_NAME = {
    'auvergne rhone alpes':'84','bourgogne franche comte':'27','bretagne':'53','centre val de loire':'24','corse':'94',
    'grand est':'44','hauts de france':'32','ile de france':'11','normandie':'28','nouvelle aquitaine':'75',
    'occitanie':'76','pays de la loire':'52','provence alpes cote d azur':'93',
    'guadeloupe':'01','martinique':'02','guyane':'03','la reunion':'04','reunion':'04','mayotte':'06'
  };
  const regionMajorCitiesCache=new Map();
  function regionFeatures(features,region){return (features||[]).filter(f=>norm(regionName(featureCode(f)))===norm(region));}
  function geometryLonLatBounds(features){
    let minLon=Infinity,maxLon=-Infinity,minLat=Infinity,maxLat=-Infinity;
    (features||[]).forEach(f=>walkCoordinates(f.geometry,(lon,lat)=>{minLon=Math.min(minLon,lon);maxLon=Math.max(maxLon,lon);minLat=Math.min(minLat,lat);maxLat=Math.max(maxLat,lat);}));
    return Number.isFinite(minLon)?{minLon,maxLon,minLat,maxLat}:null;
  }
  function resetTerritoryMapFocus(){
    state.mapFocusRegion='';state.mapFocusPending=false;
    state.mapView={x:0,y:0,w:700,h:500};state.osmMapView={lat:46.55,lng:2.35,zoom:5};
  }
  function fitOsmRegion(features,region,host){
    const rf=regionFeatures(features,region),b=geometryLonLatBounds(rf);if(!b)return false;
    const rect=host?.getBoundingClientRect?.()||{width:700,height:390},width=Math.max(360,rect.width||700)*.82,height=Math.max(260,rect.height||390)*.78;
    let chosen=6,centerLng=(b.minLon+b.maxLon)/2,centerLat=(b.minLat+b.maxLat)/2;
    for(let z=10;z>=5;z--){const a=osmWorld(b.minLon,b.maxLat,z),c=osmWorld(b.maxLon,b.minLat,z);if(Math.abs(c[0]-a[0])<=width&&Math.abs(c[1]-a[1])<=height){chosen=z;break;}}
    const p1=osmWorld(b.minLon,b.maxLat,chosen),p2=osmWorld(b.maxLon,b.minLat,chosen),ll=osmLonLat((p1[0]+p2[0])/2,(p1[1]+p2[1])/2,chosen);
    state.osmMapView={lng:ll[0]||centerLng,lat:ll[1]||centerLat,zoom:chosen};return true;
  }
  function fitLegacyRegion(features,region,project){
    const rf=regionFeatures(features,region);if(!rf.length)return false;
    let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;rf.forEach(f=>walkCoordinates(f.geometry,(lon,lat)=>{const [x,y]=project(lon,lat);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}));
    if(!Number.isFinite(minX))return false;
    const padX=Math.max(18,(maxX-minX)*.12),padY=Math.max(14,(maxY-minY)*.12);let x=minX-padX,y=minY-padY,w=(maxX-minX)+2*padX,h=(maxY-minY)+2*padY;
    const ratio=MAP_CANVAS.width/MAP_CANVAS.height;if(w/h>ratio)h=w/ratio;else w=h*ratio;state.mapView={x:x-(w-((maxX-minX)+2*padX))/2,y:y-(h-((maxY-minY)+2*padY))/2,w,h};clampMapView();return true;
  }
  async function getRegionMajorCities(region){
    const key=norm(region).replace(/[^a-z0-9]+/g,' ').trim();if(regionMajorCitiesCache.has(key))return regionMajorCitiesCache.get(key);const code=REGION_CODE_BY_NAME[key];if(!code){regionMajorCitiesCache.set(key,[]);return [];}
    try{const rows=await fetchGeoJson(`https://geo.api.gouv.fr/communes?codeRegion=${encodeURIComponent(code)}&fields=nom,code,centre,population,codeDepartement&format=json&geometry=centre&boost=population&limit=50`);const out=(Array.isArray(rows)?rows:[]).filter(c=>Array.isArray(c?.centre?.coordinates)&&Number(c.population)>0).sort((a,b)=>Number(b.population)-Number(a.population)).slice(0,12).map(c=>({name:String(c.nom||''),population:Number(c.population)||0,department:String(c.codeDepartement||''),lon:Number(c.centre.coordinates[0]),lat:Number(c.centre.coordinates[1])}));regionMajorCitiesCache.set(key,out);return out;}catch(err){console.warn('NEWOSB grandes villes région:',region,err);regionMajorCitiesCache.set(key,[]);return [];}
  }
  function focusTerritoryRegion(region){
    if(!region)return;state.mapFocusRegion=region;state.mapFocusPending=true;
  }
  const MAP_CANVAS = {width:700,height:500,maxZoom:8};
  function clampMapView(){
    const minW=MAP_CANVAS.width/MAP_CANVAS.maxZoom;
    const minH=MAP_CANVAS.height/MAP_CANVAS.maxZoom;
    const v=state.mapView || (state.mapView={x:0,y:0,w:MAP_CANVAS.width,h:MAP_CANVAS.height});
    v.w=Math.max(minW,Math.min(MAP_CANVAS.width,Number(v.w)||MAP_CANVAS.width));
    v.h=Math.max(minH,Math.min(MAP_CANVAS.height,v.w*MAP_CANVAS.height/MAP_CANVAS.width));
    v.x=Math.max(0,Math.min(MAP_CANVAS.width-v.w,Number(v.x)||0));
    v.y=Math.max(0,Math.min(MAP_CANVAS.height-v.h,Number(v.y)||0));
    return v;
  }
  function territoryMapViewBox(){
    const v=clampMapView();
    return `${v.x.toFixed(2)} ${v.y.toFixed(2)} ${v.w.toFixed(2)} ${v.h.toFixed(2)}`;
  }
  function territoryMapZoomPercent(){
    const v=clampMapView();
    return Math.round(MAP_CANVAS.width/v.w*100);
  }
  function territoryMapDetailLevel(){
    const z=territoryMapZoomPercent();
    if(z<145)return 1;       // régions
    if(z<240)return 2;       // départements
    if(z<390)return 3;       // intercommunalités
    if(z<600)return 4;       // villes
    return 5;                // opérations
  }
  function territoryMapDetailLabel(level){
    return ({1:'Régions',2:'Départements',3:'Intercommunalités',4:'Zoom fin',5:'Opérations'})[level]||'Territoires';
  }
  function territoryMapCityLabelMetrics(zoom){
    const scale=Math.max(1,Number(zoom||100)/100);
    const progress=Math.max(0,Math.min(1,(Number(zoom||100)-120)/480));
    const cityScreen=5.6+1.7*progress;
    const majorScreen=6.4+1.8*progress;
    const metaScreen=4.6+1.2*progress;
    return {
      city:cityScreen/scale,
      cityActive:(cityScreen+.7)/scale,
      major:majorScreen/scale,
      meta:metaScreen/scale,
      stroke:Math.max(.7,2.1/scale)
    };
  }
  function applyTerritoryMapView(svg,host){
    if(!svg)return;
    svg.setAttribute('viewBox',territoryMapViewBox());
    const zoom=territoryMapZoomPercent(), level=territoryMapDetailLevel();
    const label=host?.querySelector('[data-map-zoom-label]');
    if(label)label.textContent=`${zoom}%`;
    if(host){
      host.dataset.detailLevel=String(level);
      const m=territoryMapCityLabelMetrics(zoom);
      host.style.setProperty('--obs-map-city-name-size',`${m.city.toFixed(2)}px`);
      host.style.setProperty('--obs-map-city-active-size',`${m.cityActive.toFixed(2)}px`);
      host.style.setProperty('--obs-map-major-city-size',`${m.major.toFixed(2)}px`);
      host.style.setProperty('--obs-map-city-meta-size',`${m.meta.toFixed(2)}px`);
      host.style.setProperty('--obs-map-city-stroke',`${m.stroke.toFixed(2)}px`);
      host.style.setProperty('--obs-map-city-meta-display',level>=5?'inline':'none');
      host.style.setProperty('--obs-map-major-meta-display',level>=3?'inline':'none');
      const historicalNamesVisible=host.dataset.basemap!=='legacy'||level>=4;
      host.style.setProperty('--obs-map-city-name-display',historicalNamesVisible?'inline':'none');
      host.style.setProperty('--obs-map-major-name-display',historicalNamesVisible?'inline':'none');
      const d=host.querySelector('[data-map-detail-label]');if(d)d.textContent=`Détail : ${territoryMapDetailLabel(level)}`;
    }
  }
  function zoomTerritoryMap(svg,host,factor,clientX,clientY){
    if(!svg||!Number.isFinite(factor)||factor<=0)return;
    const rect=svg.getBoundingClientRect(); if(!rect.width||!rect.height)return;
    const v=clampMapView();
    const rx=Math.max(0,Math.min(1,(Number.isFinite(clientX)?clientX:rect.left+rect.width/2)-rect.left)/rect.width);
    const ry=Math.max(0,Math.min(1,(Number.isFinite(clientY)?clientY:rect.top+rect.height/2)-rect.top)/rect.height);
    const focusX=v.x+rx*v.w, focusY=v.y+ry*v.h;
    const targetW=Math.max(MAP_CANVAS.width/MAP_CANVAS.maxZoom,Math.min(MAP_CANVAS.width,v.w/factor));
    const targetH=targetW*MAP_CANVAS.height/MAP_CANVAS.width;
    v.x=focusX-rx*targetW; v.y=focusY-ry*targetH; v.w=targetW; v.h=targetH;
    clampMapView(); applyTerritoryMapView(svg,host);
  }
  function setupTerritoryMapNavigation(host){
    const svg=host?.querySelector('.obs-france-map'); if(!svg)return;
    applyTerritoryMapView(svg,host);
    svg.addEventListener('wheel',e=>{
      e.preventDefault();
      zoomTerritoryMap(svg,host,e.deltaY<0?1.18:(1/1.18),e.clientX,e.clientY);
    },{passive:false});
    svg.addEventListener('contextmenu',e=>e.preventDefault());
    let dragging=false,lastX=0,lastY=0,pointerId=null;
    svg.addEventListener('pointerdown',e=>{
      if(e.button!==2)return;
      e.preventDefault(); dragging=true; pointerId=e.pointerId; lastX=e.clientX; lastY=e.clientY;
      svg.classList.add('is-panning');
      try{svg.setPointerCapture(e.pointerId);}catch{}
    });
    svg.addEventListener('pointermove',e=>{
      if(!dragging||e.pointerId!==pointerId)return;
      e.preventDefault();
      const rect=svg.getBoundingClientRect(); if(!rect.width||!rect.height)return;
      const dx=e.clientX-lastX,dy=e.clientY-lastY; lastX=e.clientX; lastY=e.clientY;
      const v=clampMapView(); v.x-=dx*v.w/rect.width; v.y-=dy*v.h/rect.height;
      clampMapView(); applyTerritoryMapView(svg,host);
    });
    const stop=e=>{
      if(!dragging||e.pointerId!==pointerId)return;
      dragging=false; pointerId=null; svg.classList.remove('is-panning');
      try{svg.releasePointerCapture(e.pointerId);}catch{}
    };
    svg.addEventListener('pointerup',stop); svg.addEventListener('pointercancel',stop);
    host.querySelectorAll('[data-map-zoom]').forEach(btn=>btn.addEventListener('click',e=>{
      e.preventDefault(); e.stopPropagation();
      const action=btn.dataset.mapZoom;
      if(action==='in')zoomTerritoryMap(svg,host,1.35);
      else if(action==='out')zoomTerritoryMap(svg,host,1/1.35);
    }));
  }

  const MAP_GEO_CACHE_KEY='newosb-map-communes-v1';
  const mapGeoCache=(()=>{try{return new Map(Object.entries(JSON.parse(localStorage.getItem(MAP_GEO_CACHE_KEY)||'{}')));}catch{return new Map();}})();
  const mapEpciCache=new Map();
  function saveMapGeoCache(){try{const obj=Object.fromEntries([...mapGeoCache.entries()].slice(-500));localStorage.setItem(MAP_GEO_CACHE_KEY,JSON.stringify(obj));}catch{}}
  async function fetchGeoJson(url){const r=await fetch(url,{cache:'force-cache'});if(!r.ok)throw new Error(`Géo API ${r.status}`);return r.json();}
  async function resolveEpciName(code){
    if(!code)return''; if(mapEpciCache.has(code))return mapEpciCache.get(code);
    try{const d=await fetchGeoJson(`https://geo.api.gouv.fr/epcis/${encodeURIComponent(code)}?fields=nom,code`);const name=String(d?.nom||'').trim();mapEpciCache.set(code,name);return name;}catch{mapEpciCache.set(code,'');return'';}
  }
  function mapLocationKey(op){return [op.insee||'',op.postalCode||'',op.city||'',op.department||''].join('|');}
  async function resolveOperationMapGeo(op){
    const lon=Number(op.longitude),lat=Number(op.latitude);
    if(Number.isFinite(lon)&&Number.isFinite(lat)&&lon>-10&&lon<15&&lat>40&&lat<55)return {lon,lat,city:op.city||'',epci:op.intercommunality||'',insee:op.insee||''};
    const key=mapLocationKey(op); if(mapGeoCache.has(key))return mapGeoCache.get(key);
    let url='';
    if(op.insee)url=`https://geo.api.gouv.fr/communes/${encodeURIComponent(op.insee)}?fields=nom,code,centre,codeDepartement,codeEpci,epci&format=json&geometry=centre`;
    else if(op.postalCode)url=`https://geo.api.gouv.fr/communes?codePostal=${encodeURIComponent(op.postalCode)}&fields=nom,code,centre,codeDepartement,codeEpci,epci&format=json&geometry=centre`;
    else if(op.city)url=`https://geo.api.gouv.fr/communes?nom=${encodeURIComponent(op.city)}${op.department?`&codeDepartement=${encodeURIComponent(op.department)}`:''}&boost=population&fields=nom,code,centre,codeDepartement,codeEpci,epci&format=json&geometry=centre`;
    if(!url){mapGeoCache.set(key,null);return null;}
    try{
      const d=await fetchGeoJson(url), list=Array.isArray(d)?d:[d];
      let c=list.find(x=>op.city&&norm(x?.nom)===norm(op.city))||list.find(x=>String(x?.codeDepartement||'')===String(op.department||''))||list[0];
      const coords=c?.centre?.coordinates; if(!Array.isArray(coords)||coords.length<2)throw new Error('centre absent');
      let epci=String(op.intercommunality||c?.epci?.nom||'').trim(); if(!epci&&c?.codeEpci)epci=await resolveEpciName(c.codeEpci);
      const meta={lon:Number(coords[0]),lat:Number(coords[1]),city:String(c?.nom||op.city||'').trim(),epci,insee:String(c?.code||op.insee||'').trim()};
      mapGeoCache.set(key,meta); saveMapGeoCache();
      if(!op.intercommunality&&epci)op.intercommunality=epci;
      return meta;
    }catch(err){console.warn('NEWOSB géolocalisation commune:',op.city||op.postalCode||op.insee,err);mapGeoCache.set(key,null);saveMapGeoCache();return null;}
  }
  async function hydrateTerritoryDetailOverlay(host,project,ops,token){
    const svg=host?.querySelector('.obs-france-map'), layer=host?.querySelector('#obsMapDetailLayer'); if(!svg||!layer)return;
    const unique=new Map();
    (ops||[]).forEach(op=>{const key=mapLocationKey(op)||op.code;if(!unique.has(key))unique.set(key,{op,members:[]});unique.get(key).members.push(op);});
    const sample=[...unique.values()].slice(0,120);
    const geos=await Promise.all(sample.map(async item=>({op:item.op,members:item.members,geo:await resolveOperationMapGeo(item.op)})));
    if(token!==state.renderToken||!document.getElementById('obsTerritoryMap'))return;
    const cities=new Map(), epcis=new Map(), points=[];
    geos.forEach(({op,members,geo})=>{if(!geo||!Number.isFinite(geo.lon)||!Number.isFinite(geo.lat))return;const [x,y]=project(geo.lon,geo.lat), weight=Math.max(1,members.length);const city=geo.city||op.city||'Commune non précisée',ck=`${norm(city)}|${op.department||''}`;if(!cities.has(ck))cities.set(ck,{name:city,department:op.department||'',x:0,y:0,n:0,zones:new Map(),epci:geo.epci||op.intercommunality||''});const c=cities.get(ck);c.x+=x*weight;c.y+=y*weight;c.n+=weight;members.forEach(m=>{const z=m.socialZone||'Non précisé';c.zones.set(z,(c.zones.get(z)||0)+1);if(!m.intercommunality&&(geo.epci||op.intercommunality))m.intercommunality=geo.epci||op.intercommunality;points.push({op:m,x,y});});if(!c.epci&&(geo.epci||op.intercommunality))c.epci=geo.epci||op.intercommunality;const eName=geo.epci||op.intercommunality||'';if(eName){const ek=norm(eName);if(!epcis.has(ek))epcis.set(ek,{name:eName,x:0,y:0,n:0});const e=epcis.get(ek);e.x+=x*weight;e.y+=y*weight;e.n+=weight;}});
    const epciSvg=state.mapLayers.intercommunalities?[...epcis.values()].map(e=>{const x=e.x/e.n,y=e.y/e.n;return `<g class="obs-map-epci-label ${activeCross('intercommunality',e.name)?'is-active':''}" ${crossAttrs('intercommunality',e.name,`Intercommunalité : ${e.name}`)}><rect x="${(x-48).toFixed(1)}" y="${(y-10).toFixed(1)}" width="96" height="20" rx="10"></rect><text x="${x.toFixed(1)}" y="${(y+2).toFixed(1)}" text-anchor="middle">${esc(shorten(e.name,24))}</text><title>${esc(e.name)} · ${fmt(e.n)} opération${e.n>1?'s':''} localisée${e.n>1?'s':''}</title></g>`;}).join(''):'';
    const citySvg=''; // V05.30: repères de villes volontairement supprimés pour alléger la cartographie.
    const opSvg='';
    layer.innerHTML=`${epciSvg}${citySvg}${opSvg}`;
    applyTerritoryMapView(svg,host);
  }

  const OSM_TILE_SIZE=256, OSM_MIN_ZOOM=4, OSM_MAX_ZOOM=18;
  const OSM_TILE_PROVIDERS=[
    {
      id:'ign',
      name:'Plan IGN',
      tile(z,x,y){return `https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&FORMAT=image/png&TILEMATRIXSET=PM&TILEMATRIX=${z}&TILEROW=${y}&TILECOL=${x}`;},
      attribution:'© IGN · Plan IGN'
    },
    {
      id:'osm-de',
      name:'OpenStreetMap DE',
      tile(z,x,y){return `https://tile.openstreetmap.de/${z}/${x}/${y}.png`;},
      attribution:'© OpenStreetMap contributors · FOSSGIS'
    },
    {
      id:'osm',
      name:'OpenStreetMap',
      tile(z,x,y){return `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;},
      attribution:'© OpenStreetMap contributors'
    }
  ];
  function osmProviderIndex(){
    const raw=Number(state.osmTileProviderIndex);
    return Number.isFinite(raw)&&raw>=0&&raw<OSM_TILE_PROVIDERS.length?Math.floor(raw):0;
  }
  function osmProvider(){return OSM_TILE_PROVIDERS[osmProviderIndex()]||OSM_TILE_PROVIDERS[0];}
  function osmUpdateProviderUi(ctx){
    const provider=osmProvider();
    const attr=ctx?.host?.querySelector('[data-osm-attribution]');
    if(attr)attr.innerHTML=provider.id==='ign'?'<a href="https://www.ign.fr/" target="_blank" rel="noopener">© IGN</a> · Plan IGN':'<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap</a> contributors'+(provider.id==='osm-de'?' · FOSSGIS':'');
    const btn=ctx?.host?.querySelector('[data-osm-provider]');
    if(btn){btn.textContent=provider.id==='ign'?'IGN':'OSM';btn.title=`Fond actuel : ${provider.name}. Cliquer pour changer.`;}
  }
  function osmSetProvider(ctx,index,{manual=false}={}){
    index=(index+OSM_TILE_PROVIDERS.length)%OSM_TILE_PROVIDERS.length;
    state.osmTileProviderIndex=index;
    state.mapBasemap=OSM_TILE_PROVIDERS[index]?.id==='ign'?'ign':'osm';
    if(ctx){ctx.tileFailureCount=0;ctx.providerSwitching=false;ctx.providerExhausted=false;osmUpdateProviderUi(ctx);scheduleOsmRender(ctx);}
    if(manual)showToast?.(`Fond cartographique : ${OSM_TILE_PROVIDERS[index].name}`);
  }
  function osmTileFailed(ctx){
    if(!ctx||ctx.providerSwitching||ctx.providerExhausted)return;
    ctx.tileFailureCount=(ctx.tileFailureCount||0)+1;
    if(ctx.tileFailureCount<3)return;
    ctx.providerSwitching=true;
    const next=osmProviderIndex()+1;
    if(next<OSM_TILE_PROVIDERS.length){
      state.osmTileProviderIndex=next;state.mapBasemap=OSM_TILE_PROVIDERS[next]?.id==='ign'?'ign':'osm';ctx.tileFailureCount=0;ctx.providerSwitching=false;osmUpdateProviderUi(ctx);scheduleOsmRender(ctx);
    }else{
      ctx.providerExhausted=true;ctx.providerSwitching=false;
      const notice=ctx.host.querySelector('[data-osm-provider-status]');
      if(notice){notice.hidden=false;notice.textContent='Fond cartographique distant indisponible · couches Observatoire Prestaterre conservées';}
    }
  }
  function osmClampLat(lat){return Math.max(-85.05112878,Math.min(85.05112878,Number(lat)||0));}
  function osmWrapLng(lng){lng=Number(lng)||0;while(lng<-180)lng+=360;while(lng>=180)lng-=360;return lng;}
  function osmWorld(lon,lat,zoom){
    lon=osmWrapLng(lon);lat=osmClampLat(lat);const scale=OSM_TILE_SIZE*Math.pow(2,zoom),rad=lat*Math.PI/180;
    return [(lon+180)/360*scale,(1-Math.log(Math.tan(rad)+1/Math.cos(rad))/Math.PI)/2*scale];
  }
  function osmLonLat(x,y,zoom){
    const scale=OSM_TILE_SIZE*Math.pow(2,zoom),lng=x/scale*360-180,n=Math.PI-2*Math.PI*y/scale,lat=180/Math.PI*Math.atan(Math.sinh(n));
    return [osmWrapLng(lng),osmClampLat(lat)];
  }
  function osmDetailLevel(zoom){if(zoom<=5)return 1;if(zoom<=7)return 2;if(zoom<=9)return 3;if(zoom<=11)return 4;return 5;}
  function applyOsmCityLabelScale(host,zoom){
    if(!host)return;
    const z=Math.max(OSM_MIN_ZOOM,Math.min(OSM_MAX_ZOOM,Number(zoom)||OSM_MIN_ZOOM));
    const city=Math.min(7.4,6.0+Math.max(0,z-10)*.18);
    const major=Math.min(8.2,6.7+Math.max(0,z-6)*.14);
    const meta=Math.min(6.2,5.1+Math.max(0,z-10)*.14);
    host.dataset.osmZoom=String(Math.round(z));
    host.style.setProperty('--obs-osm-city-name-size',`${city.toFixed(2)}px`);
    host.style.setProperty('--obs-osm-city-active-size',`${(city+.6).toFixed(2)}px`);
    host.style.setProperty('--obs-osm-major-city-size',`${major.toFixed(2)}px`);
    host.style.setProperty('--obs-osm-city-meta-size',`${meta.toFixed(2)}px`);
    host.style.setProperty('--obs-osm-city-stroke',z>=12?'1.8px':'1.4px');
    host.style.setProperty('--obs-osm-city-meta-display',z>=12?'inline':'none');
    host.style.setProperty('--obs-osm-major-meta-display',z>=8?'inline':'none');
  }
  function osmDetailLabel(zoom){return territoryMapDetailLabel(osmDetailLevel(zoom));}
  function osmDominantZone(zoneMap){return [...(zoneMap||new Map()).entries()].filter(([z])=>norm(z)!=='non precise'&&norm(z)!=='non précisé').sort((a,b)=>b[1]-a[1])[0]?.[0]||'';}
  function osmZoneSummary(zoneMap){const rows=[...(zoneMap||new Map()).entries()].sort((a,b)=>b[1]-a[1]);return rows.length?rows.map(([z,n])=>`${z}: ${n}`).join(' · '):'Zonage non renseigné';}
  function osmViewport(ctx){
    const rect=ctx.mapEl.getBoundingClientRect(),width=Math.max(320,Math.round(rect.width||700)),height=Math.max(240,Math.round(rect.height||390));
    const z=Math.round(state.osmMapView.zoom||5),center=osmWorld(state.osmMapView.lng,state.osmMapView.lat,z);
    return {width,height,z,centerX:center[0],centerY:center[1],left:center[0]-width/2,top:center[1]-height/2};
  }
  function renderOsmTiles(ctx,v){
    const n=Math.pow(2,v.z),x0=Math.floor(v.left/OSM_TILE_SIZE),x1=Math.floor((v.left+v.width)/OSM_TILE_SIZE),y0=Math.max(0,Math.floor(v.top/OSM_TILE_SIZE)),y1=Math.min(n-1,Math.floor((v.top+v.height)/OSM_TILE_SIZE));
    const provider=osmProvider();let html='';
    for(let ty=y0;ty<=y1;ty++)for(let tx=x0;tx<=x1;tx++){
      const wrapped=((tx%n)+n)%n,left=tx*OSM_TILE_SIZE-v.left,top=ty*OSM_TILE_SIZE-v.top,src=provider.tile(v.z,wrapped,ty);
      html+=`<img class="obs-osm-tile" data-osm-tile="${provider.id}" src="${esc(src)}" alt="" draggable="false" loading="eager" decoding="async" referrerpolicy="strict-origin-when-cross-origin" style="left:${left.toFixed(1)}px;top:${top.toFixed(1)}px">`;
    }
    ctx.tiles.innerHTML=html;
    ctx.tiles.querySelectorAll('[data-osm-tile]').forEach(img=>{
      img.addEventListener('load',()=>{ctx.tileFailureCount=0;},{once:true});
      img.addEventListener('error',()=>{img.style.display='none';osmTileFailed(ctx);},{once:true});
    });
    osmUpdateProviderUi(ctx);
  }
  function legacyMapMarkerScale(){const z=Math.max(.6,territoryMapZoomPercent()/100);return Math.max(.52,Math.min(1.28,1/z));}
  function groupedMapMarkerSvg(features,project,counts,mode='department',className='obs-map-marker'){
    const max=Math.max(1,...counts.values()),legacy=className==='obs-map-marker',scale=legacy?legacyMapMarkerScale():1;
    if(mode==='region'){
      const groups=new Map();
      features.forEach(f=>{const code=featureCode(f),r=regionName(code);if(!groups.has(r))groups.set(r,{features:[],count:0});const g=groups.get(r);g.features.push(f);g.count+=counts.get(code)||0;});
      const maxR=Math.max(1,...[...groups.values()].map(g=>g.count));
      return [...groups.entries()].map(([r,g])=>{if(!g.count)return'';const c=groupCenter(g.features,project);if(legacy){const digits=String(g.count).length,h=(16+Math.min(7,Math.sqrt(g.count)))*scale,w=(22+digits*6+Math.min(20,Math.sqrt(g.count)*2.2))*scale,y=c[1]+(17*scale);return `<g class="${className} obs-map-group-region obs-map-count-pill" ${crossAttrs('region',r,`Région : ${r}`)}><rect x="${(c[0]-w/2).toFixed(1)}" y="${(y-h/2).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="${(h/2).toFixed(1)}"></rect><text x="${c[0].toFixed(1)}" y="${(y+2.7*scale).toFixed(1)}" text-anchor="middle" style="font-size:${(7.5*scale).toFixed(2)}px">${fmt(g.count)}</text><title>${esc(r)} · ${fmt(g.count)} opération${g.count>1?'s':''}</title></g>`;}const rad=7+10*Math.sqrt(g.count/maxR);return `<g class="${className} obs-map-group-region" ${crossAttrs('region',r,`Région : ${r}`)}><circle cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" r="${rad.toFixed(1)}"></circle><text x="${c[0].toFixed(1)}" y="${(c[1]+4).toFixed(1)}" text-anchor="middle">${fmt(g.count)}</text><title>${esc(r)} · ${fmt(g.count)} opération${g.count>1?'s':''}</title></g>`;}).join('');
    }
    return features.map(f=>{const code=featureCode(f),count=counts.get(code)||0;if(!count)return'';const c=featureCenter(f,project),rad=(5+8*Math.sqrt(count/max))*scale;return `<g class="${className}" ${crossAttrs('department',code,`Département : ${departmentName(code)}`)}><circle cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" r="${rad.toFixed(1)}"></circle><text x="${c[0].toFixed(1)}" y="${(c[1]+3*scale).toFixed(1)}" text-anchor="middle" ${legacy?`style="font-size:${(7.5*scale).toFixed(2)}px"`:''}>${fmt(count)}</text><title>${esc(departmentName(code))} · ${fmt(count)} opération${count>1?'s':''}</title></g>`;}).join('');
  }


  function renderOsmOverlay(ctx,v){
    applyOsmCityLabelScale(ctx.host,v.z);
    const project=(lon,lat)=>{const p=osmWorld(lon,lat,v.z);return [p[0]-v.left,p[1]-v.top];};
    const level=osmDetailLevel(v.z),defs=[],paths=[],counts=ctx.counts,zonesByDep=ctx.zonesByDep,max=ctx.max;
    ctx.features.forEach((f,idx)=>{
      const code=featureCode(f),count=counts.get(code)||0,active=activeCross('department',code),zoneMap=zonesByDep.get(code)||new Map();
      let fill='rgba(22,134,79,.06)';
      if(state.mapLayers.zoning&&zoneMap.size){
        const entries=[...zoneMap.entries()].filter(([z])=>norm(z)!=='non precise'&&norm(z)!=='non précisé');
        if(entries.length===1)fill=mapZoneColor(entries[0][0]);
        else if(entries.length>1){const id=`osm-zone-${code.replace(/[^A-Z0-9]/gi,'')}-${idx}`,total=entries.reduce((a,[,n])=>a+n,0)||1;let cursor=0,stops='';entries.sort((a,b)=>a[0].localeCompare(b[0],'fr')).forEach(([z,n])=>{const a=cursor/total*100;cursor+=n;const b=cursor/total*100,c=mapZoneColor(z);stops+=`<stop offset="${a}%" stop-color="${c}"/><stop offset="${b}%" stop-color="${c}"/>`;});defs.push(`<linearGradient id="${id}" x1="0%" y1="0%" x2="100%" y2="100%">${stops}</linearGradient>`);fill=`url(#${id})`;}
      }
      const fillOpacity=state.mapLayers.zoning?(count?.26:.05):(state.mapLayers.operations&&count?(.07+.24*Math.sqrt(count/max)):.03),stroke=state.mapLayers.departments?'rgba(255,255,255,.95)':'rgba(6,64,43,.18)',sw=state.mapLayers.departments?1.2:.45;
      paths.push(`<path class="obs-osm-dep ${active?'is-active':''}" d="${geometryPath(f.geometry,project)}" fill="${fill}" fill-opacity="${fillOpacity.toFixed(2)}" stroke="${stroke}" stroke-width="${sw}" ${crossAttrs('department',code,`Département : ${departmentName(code)}`)}><title>${esc(departmentName(code))} · ${fmt(count)} opération${count>1?'s':''} · ${esc(osmZoneSummary(zoneMap))}</title></path>`);
    });
    const regionGroups=new Map();ctx.features.forEach(f=>{const r=regionName(featureCode(f));if(!regionGroups.has(r))regionGroups.set(r,[]);regionGroups.get(r).push(f);});
    let regionSvg='';if(state.mapLayers.regions&&level<=2){regionSvg=`<path class="obs-osm-region-outline" d="${regionBoundaryPath(ctx.features,project)}"/>`+[...regionGroups.entries()].map(([r,fs])=>{const c=groupCenter(fs,project);return `<g class="obs-osm-region-label ${activeCross('region',r)?'is-active':''}" ${crossAttrs('region',r,`Région : ${r}`)}><rect x="${(c[0]-48).toFixed(1)}" y="${(c[1]-12).toFixed(1)}" width="96" height="24" rx="12"></rect><text x="${c[0].toFixed(1)}" y="${(c[1]+4).toFixed(1)}" text-anchor="middle">${esc(shorten(r,20))}</text></g>`;}).join('');}
    let depSvg='';if(state.mapLayers.departments&&level>=2&&level<=3)depSvg=ctx.features.map(f=>{const code=featureCode(f),c=featureCenter(f,project);return `<g class="obs-osm-dept-label ${activeCross('department',code)?'is-active':''}" ${crossAttrs('department',code,`Département : ${departmentName(code)}`)}><circle cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" r="13"></circle><text x="${c[0].toFixed(1)}" y="${(c[1]+3.5).toFixed(1)}" text-anchor="middle">${esc(code)}</text></g>`;}).join('');
    let depOps='';if(state.mapLayers.operations)depOps=groupedMapMarkerSvg(ctx.features,project,counts,state.mapOperationGrouping,'obs-osm-dep-op');
    let epciSvg='';if(state.mapLayers.intercommunalities&&level>=3&&ctx.epcis)epciSvg=[...ctx.epcis.values()].map(e=>{const p=project(e.lon/e.n,e.lat/e.n);return `<g class="obs-osm-epci-label ${activeCross('intercommunality',e.name)?'is-active':''}" ${crossAttrs('intercommunality',e.name,`Intercommunalité : ${e.name}`)}><rect x="${(p[0]-62).toFixed(1)}" y="${(p[1]-11).toFixed(1)}" width="124" height="22" rx="11"></rect><text x="${p[0].toFixed(1)}" y="${(p[1]+3).toFixed(1)}" text-anchor="middle">${esc(shorten(e.name,28))} · ${fmt(e.n)}</text></g>`;}).join('');
    let majorCitySvg=''; // V05.30: aucun repère de ville.
    let citySvg=''; // V05.30: aucun repère de ville.
    let opSvg='';
    ctx.overlay.setAttribute('viewBox',`0 0 ${v.width} ${v.height}`);ctx.overlay.setAttribute('width',v.width);ctx.overlay.setAttribute('height',v.height);
    ctx.overlay.innerHTML=`<defs>${defs.join('')}</defs>${paths.join('')}${regionSvg}${depSvg}${depOps}${epciSvg}${majorCitySvg}${citySvg}${opSvg}`;
    const detail=ctx.host.querySelector('[data-osm-detail]');if(detail)detail.textContent=`Détail : ${osmDetailLabel(v.z)} · zoom ${v.z}`;
  }
  function renderOsmNative(ctx){if(!ctx?.mapEl?.isConnected)return;const v=osmViewport(ctx);renderOsmTiles(ctx,v);renderOsmOverlay(ctx,v);}
  function scheduleOsmRender(ctx){if(!ctx?.mapEl?.isConnected)return;if(ctx.renderRaf)return;ctx.renderRaf=requestAnimationFrame(()=>{ctx.renderRaf=0;renderOsmNative(ctx);});}
  function osmZoomAt(ctx,newZoom,clientX,clientY){
    newZoom=Math.max(OSM_MIN_ZOOM,Math.min(OSM_MAX_ZOOM,Math.round(newZoom)));const oldZoom=Math.round(state.osmMapView.zoom||5);if(newZoom===oldZoom){renderOsmNative(ctx);return;}
    const rect=ctx.mapEl.getBoundingClientRect(),px=Number.isFinite(clientX)?clientX-rect.left:rect.width/2,py=Number.isFinite(clientY)?clientY-rect.top:rect.height/2,oldV=osmViewport(ctx),focusWorld=[oldV.left+px,oldV.top+py],focus=osmLonLat(focusWorld[0],focusWorld[1],oldZoom),focusNew=osmWorld(focus[0],focus[1],newZoom),newCenter=[focusNew[0]-(px-rect.width/2),focusNew[1]-(py-rect.height/2)],ll=osmLonLat(newCenter[0],newCenter[1],newZoom);
    state.osmMapView={lng:ll[0],lat:ll[1],zoom:newZoom};scheduleOsmRender(ctx);
  }
  function setupOsmNativeNavigation(ctx){
    const el=ctx.mapEl;let dragging=false,pointerId=null,lastX=0,lastY=0;
    el.addEventListener('wheel',e=>{e.preventDefault();osmZoomAt(ctx,(state.osmMapView.zoom||5)+(e.deltaY<0?1:-1),e.clientX,e.clientY);},{passive:false});
    el.addEventListener('contextmenu',e=>e.preventDefault());
    el.addEventListener('pointerdown',e=>{if(e.button!==2)return;e.preventDefault();dragging=true;pointerId=e.pointerId;lastX=e.clientX;lastY=e.clientY;el.classList.add('is-panning');try{el.setPointerCapture(e.pointerId);}catch{}});
    el.addEventListener('pointermove',e=>{if(!dragging||e.pointerId!==pointerId)return;e.preventDefault();const dx=e.clientX-lastX,dy=e.clientY-lastY;lastX=e.clientX;lastY=e.clientY;const z=Math.round(state.osmMapView.zoom||5),center=osmWorld(state.osmMapView.lng,state.osmMapView.lat,z),ll=osmLonLat(center[0]-dx,center[1]-dy,z);state.osmMapView.lng=ll[0];state.osmMapView.lat=ll[1];scheduleOsmRender(ctx);});
    const stop=e=>{if(!dragging||e.pointerId!==pointerId)return;dragging=false;pointerId=null;el.classList.remove('is-panning');try{el.releasePointerCapture(e.pointerId);}catch{}};el.addEventListener('pointerup',stop);el.addEventListener('pointercancel',stop);
    ctx.host.querySelectorAll('[data-osm-zoom]').forEach(btn=>btn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();osmZoomAt(ctx,(state.osmMapView.zoom||5)+(btn.dataset.osmZoom==='in'?1:-1));}));
    ctx.host.querySelector('[data-osm-provider]')?.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();osmSetProvider(ctx,osmProviderIndex()+1,{manual:true});});
    if(window.ResizeObserver){ctx.resizeObserver=new ResizeObserver(()=>scheduleOsmRender(ctx));ctx.resizeObserver.observe(el);}
  }
  async function hydrateOsmDetails(ctx,token){
    const unique=new Map();(ctx.mapOps||[]).forEach(op=>{const key=mapLocationKey(op)||op.code;if(!unique.has(key))unique.set(key,{op,members:[]});unique.get(key).members.push(op);});const sample=[...unique.values()].slice(0,250);
    const geos=await Promise.all(sample.map(async item=>({op:item.op,members:item.members,geo:await resolveOperationMapGeo(item.op)})));if(token!==state.renderToken||!ctx.host.isConnected)return;
    const cities=new Map(),epcis=new Map(),points=[];geos.forEach(({op,members,geo})=>{if(!geo||!Number.isFinite(geo.lon)||!Number.isFinite(geo.lat))return;const weight=Math.max(1,members.length),city=geo.city||op.city||'Commune non précisée',ck=`${norm(city)}|${op.department||''}`;if(!cities.has(ck))cities.set(ck,{name:city,department:op.department||'',lat:0,lon:0,n:0,zones:new Map(),epci:geo.epci||op.intercommunality||''});const c=cities.get(ck);c.lat+=geo.lat*weight;c.lon+=geo.lon*weight;c.n+=weight;members.forEach(m=>{const z=m.socialZone||'Non précisé';c.zones.set(z,(c.zones.get(z)||0)+1);if(!m.intercommunality&&(geo.epci||op.intercommunality))m.intercommunality=geo.epci||op.intercommunality;points.push({op:m,lat:geo.lat,lon:geo.lon});});if(!c.epci&&(geo.epci||op.intercommunality))c.epci=geo.epci||op.intercommunality;const eName=geo.epci||op.intercommunality||'';if(eName){const ek=norm(eName);if(!epcis.has(ek))epcis.set(ek,{name:eName,lat:0,lon:0,n:0});const e=epcis.get(ek);e.lat+=geo.lat*weight;e.lon+=geo.lon*weight;e.n+=weight;}});ctx.cities=cities;ctx.epcis=epcis;ctx.points=points;scheduleOsmRender(ctx);
  }
  async function hydrateTerritoryMap(token){
    const host=document.getElementById('obsTerritoryMap');if(!host||!engine.getDepartmentGeoJSON)return;
    if(state.mapBasemap==='legacy') return hydrateTerritoryMapLegacy(token);
    state.osmTileProviderIndex=state.mapBasemap==='ign'?0:(state.osmTileProviderIndex===0?1:state.osmTileProviderIndex);
    try{
      host.dataset.basemap=state.mapBasemap==='ign'?'ign':'osm';
      const geo=await engine.getDepartmentGeoJSON();if(token!==state.renderToken||!host.isConnected)return;const features=(geo?.features||[]).filter(f=>metroDepartment(featureCode(f))),mapOps=filteredOperations({ignoreCrossKeys:['department','region']}),counts=new Map(),zonesByDep=new Map();mapOps.forEach(o=>{const dep=String(o.department||'');if(!dep)return;counts.set(dep,(counts.get(dep)||0)+1);const z=o.socialZone||'Non précisé';if(!zonesByDep.has(dep))zonesByDep.set(dep,new Map());const m=zonesByDep.get(dep);m.set(z,(m.get(z)||0)+1);});
      host.innerHTML=`<div class="obs-osm-native"><div class="obs-osm-tiles" aria-hidden="true"></div><svg class="obs-osm-overlay" role="img" aria-label="Fond cartographique et couches Observatoire Prestaterre"></svg><div class="obs-osm-controls"><button type="button" data-osm-zoom="in" aria-label="Zoom avant" title="Zoom avant">+</button><button type="button" data-osm-zoom="out" aria-label="Zoom arrière" title="Zoom arrière">−</button><button type="button" class="obs-osm-provider-btn" data-osm-provider aria-label="Changer le fond cartographique" title="Changer le fond cartographique">IGN</button></div><div class="obs-osm-detail" data-osm-detail></div><div class="obs-osm-provider-status" data-osm-provider-status hidden></div>${state.mapLayers.zoning?'<div class="obs-zone-legend obs-zone-legend-osm"><span><i style="--z:#06402B"></i>Zone 1</span><span><i style="--z:#79A98F"></i>Zone 2</span><span><i style="--z:#D5E5C8"></i>Zone 3</span><span><i style="--z:#E9EEEB"></i>Non renseigné</span></div>':''}<div class="obs-osm-attribution" data-osm-attribution><a href="https://www.ign.fr/" target="_blank" rel="noopener">© IGN</a> · Plan IGN</div><div class="obs-map-legend-note obs-osm-note">Molette = zoom · clic droit maintenu = déplacer · le détail augmente avec le zoom</div></div>`;
      const ctx={host,mapEl:host.querySelector('.obs-osm-native'),tiles:host.querySelector('.obs-osm-tiles'),overlay:host.querySelector('.obs-osm-overlay'),features,mapOps,counts,zonesByDep,max:Math.max(1,...counts.values()),cities:new Map(),epcis:new Map(),points:[],majorCities:[]};host._newosbOsmCtx=ctx;if(state.mapFocusPending&&state.mapFocusRegion){fitOsmRegion(features,state.mapFocusRegion,ctx.mapEl);state.mapFocusPending=false;}setupOsmNativeNavigation(ctx);renderOsmNative(ctx);hydrateOsmDetails(ctx,token).catch(err=>console.warn('NEWOSB détails OSM:',err));if(state.mapFocusRegion)getRegionMajorCities(state.mapFocusRegion).then(cities=>{if(token===state.renderToken&&ctx.host.isConnected){ctx.majorCities=cities;scheduleOsmRender(ctx);}}).catch(()=>{});
    }catch(err){console.warn('NEWOSB fond OpenStreetMap:',err);if(token===state.renderToken&&host.isConnected)hydrateTerritoryMapLegacy(token);}
  }

  async function hydrateTerritoryMapLegacy(token){
    const host=document.getElementById('obsTerritoryMap'); if(!host||!engine.getDepartmentGeoJSON)return;
    host.dataset.basemap='legacy';
    try{
      const geo=await engine.getDepartmentGeoJSON(); if(token!==state.renderToken||!document.getElementById('obsTerritoryMap'))return;
      const features=(geo?.features||[]).filter(f=>metroDepartment(featureCode(f))), project=projector(features,{x:24,y:20,width:652,height:450});
      if(state.mapFocusPending&&state.mapFocusRegion){fitLegacyRegion(features,state.mapFocusRegion,project);state.mapFocusPending=false;}
      const visibleFeatures=state.mapFocusRegion?regionFeatures(features,state.mapFocusRegion):features;
      const mapOps=state.mapFocusRegion?filteredOperations({ignoreCrossKey:'department'}):filteredOperations({ignoreCrossKeys:['department','region']}), counts=new Map(), zonesByDep=new Map();
      mapOps.forEach(o=>{const dep=String(o.department||'');if(!dep)return;counts.set(dep,(counts.get(dep)||0)+1);const z=o.socialZone||'Non précisé';if(!zonesByDep.has(dep))zonesByDep.set(dep,new Map());const m=zonesByDep.get(dep);m.set(z,(m.get(z)||0)+1);});
      const max=Math.max(1,...counts.values()), defs=[], paths=[];
      visibleFeatures.forEach((f,idx)=>{
        const code=featureCode(f),v=counts.get(code)||0,active=activeCross('department',code), zoneMap=zonesByDep.get(code)||new Map();
        let fill='#F5F8F6';
        if(state.mapLayers.zoning && zoneMap.size){
          const entries=[...zoneMap.entries()].filter(([z])=>norm(z)!=='non precise'&&norm(z)!=='non précisé');
          if(entries.length===1) fill=mapZoneColor(entries[0][0]);
          else if(entries.length>1){
            const id=`obs-zone-${code.replace(/[^A-Z0-9]/gi,'')}-${idx}`,total=entries.reduce((a,[,n])=>a+n,0)||1;let cursor=0,stops='';
            entries.sort((a,b)=>a[0].localeCompare(b[0],'fr')).forEach(([z,n])=>{const a=cursor/total*100;cursor+=n;const b=cursor/total*100,c=mapZoneColor(z);stops+=`<stop offset="${a}%" stop-color="${c}"/><stop offset="${b}%" stop-color="${c}"/>`;});
            defs.push(`<linearGradient id="${id}" x1="0%" y1="0%" x2="100%" y2="100%">${stops}</linearGradient>`);fill=`url(#${id})`;
          }
        } else if(state.mapLayers.operations && v){ fill=`rgba(22,134,79,${(.12+.62*Math.sqrt(v/max)).toFixed(3)})`; }
        const stroke=state.mapLayers.departments?'#FFFFFF':'rgba(255,255,255,.18)',sw=state.mapLayers.departments?1.15:.3;
        paths.push(`<path class="obs-map-dep ${active?'is-active':''}" d="${geometryPath(f.geometry,project)}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" ${crossAttrs('department',code,`Département : ${departmentName(code)}`)}><title>${esc(departmentName(code))} · ${fmt(v)} projet${v>1?'s':''}${zoneMap.size?` · ${[...zoneMap.entries()].map(([z,n])=>`${z}: ${n}`).join(' / ')}`:''}</title></path>`);
      });
      const regionGroups=new Map();visibleFeatures.forEach(f=>{const r=regionName(featureCode(f));if(!regionGroups.has(r))regionGroups.set(r,[]);regionGroups.get(r).push(f);});
      const regionOutline=state.mapLayers.regions?`<path class="obs-map-region-outline" d="${regionBoundaryPath(visibleFeatures,project)}"/>`:'';
      const regionHitOverlay=state.mapLayers.regions&&!state.mapFocusRegion?[...regionGroups.entries()].map(([r,fs])=>`<path class="obs-map-region-hit" d="${fs.map(f=>geometryPath(f.geometry,project)).join(' ')}" ${crossAttrs('region',r,`Région : ${r}`)}><title>${esc(r)} · cliquer pour zoomer</title></path>`).join(''):'';
      const regionLabels=state.mapLayers.regions?[...regionGroups.entries()].map(([r,fs])=>{const c=groupCenter(fs,project),active=activeCross('region',r),sc=legacyMapMarkerScale(),w=76*sc,h=20*sc;return `<g class="obs-map-region-label ${active?'is-active':''}" ${crossAttrs('region',r,`Région : ${r}`)}><rect x="${(c[0]-w/2).toFixed(1)}" y="${(c[1]-h/2).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="${(h/2).toFixed(1)}"></rect><text x="${c[0].toFixed(1)}" y="${(c[1]+3*sc).toFixed(1)}" text-anchor="middle" style="font-size:${(8*sc).toFixed(2)}px">${esc(shorten(r,16))}</text></g>`;}).join(''):'';
      const regionOverlay=regionOutline+regionHitOverlay+regionLabels;
      const departmentLabels=state.mapLayers.departments?visibleFeatures.map(f=>{const code=featureCode(f),v=counts.get(code)||0,c=featureCenter(f,project);return `<g class="obs-map-dept-label ${activeCross('department',code)?'is-active':''}" ${crossAttrs('department',code,`Département : ${departmentName(code)}`)}><text x="${c[0].toFixed(1)}" y="${c[1].toFixed(1)}" text-anchor="middle">${esc(code)}</text><title>${esc(departmentName(code))} · ${fmt(v)} projet${v>1?'s':''}</title></g>`;}).join(''):'';
      const markers=state.mapLayers.operations?groupedMapMarkerSvg(visibleFeatures,project,counts,state.mapFocusRegion?'department':state.mapOperationGrouping,'obs-map-marker'):'';
      const zoningLegend=state.mapLayers.zoning?`<div class="obs-zone-legend"><span><i style="--z:#06402B"></i>Zone 1</span><span><i style="--z:#79A98F"></i>Zone 2</span><span><i style="--z:#D5E5C8"></i>Zone 3</span><span><i style="--z:#E9EEEB"></i>Non renseigné</span></div>`:'';
      host.innerHTML=`<div class="obs-map-controls" aria-label="Commandes de zoom de la carte"><button type="button" data-map-zoom="in" title="Zoom avant" aria-label="Zoom avant">+</button><button type="button" data-map-zoom="out" title="Zoom arrière" aria-label="Zoom arrière">−</button><span data-map-zoom-label>${territoryMapZoomPercent()}%</span><small data-map-detail-label>Détail : ${territoryMapDetailLabel(territoryMapDetailLevel())}</small></div><svg class="obs-france-map" viewBox="${territoryMapViewBox()}" role="img" aria-label="Carte multicouche des territoires"><defs>${defs.join('')}</defs>${paths.join('')}${regionOverlay}${departmentLabels}${markers}<g id="obsMapDetailLayer"></g></svg>${zoningLegend}<div class="obs-map-legend-note">${state.mapLayers.zoning?'Fond = zonage 1/2/3 des opérations localisées':'Fond = densité d’opérations'} · zoom = détail croissant · molette = zoom · clic droit maintenu = déplacer</div>`;
      setupTerritoryMapNavigation(host);
      hydrateTerritoryDetailOverlay(host,project,mapOps,token).catch(err=>console.warn('NEWOSB détails cartographiques:',err));
    }catch(err){
      console.warn('NEWOSB carte:',err);
      if(token===state.renderToken&&document.getElementById('obsTerritoryMap'))host.innerHTML='<div class="obs-empty">Le fond cartographique n’a pas pu être chargé. Les répartitions Région / Département restent utilisables.</div>';
    }
  }


  function applyGlobalFilterSearch(input){
    if(!input)return;
    const key=input.dataset.globalFilterSearch||'';if(!state.filterSearch)state.filterSearch={};state.filterSearch[key]=input.value||'';state.openGlobalFilter=key;
    const q=norm(input.value||''),menu=input.closest('.obs-check-menu');
    menu?.querySelectorAll(`[data-filter-option="${key}"]`).forEach(label=>{const hide=Boolean(q&&!norm(label.textContent).includes(q));label.classList.toggle('is-search-hidden',hide);label.hidden=hide;});
  }
  filtersEl?.addEventListener('input',e=>{const input=e.target.closest('[data-global-filter-search]');if(!input)return;applyGlobalFilterSearch(input);});
  filtersEl?.addEventListener('keyup',e=>{const input=e.target.closest('[data-global-filter-search]');if(!input)return;applyGlobalFilterSearch(input);});
  filtersEl?.addEventListener('pointerdown',e=>{const input=e.target.closest('[data-global-filter-search]');if(!input)return;e.stopPropagation();});
  filtersEl?.addEventListener('click',e=>{const input=e.target.closest('[data-global-filter-search]');if(input){e.stopPropagation();try{input.focus({preventScroll:true});}catch{input.focus();}return;}});
  filtersEl?.addEventListener('change',e=>{const c=e.target.closest('[data-global-filter-check]');if(!c)return;preserveUiScroll(()=>{const key=c.dataset.globalFilterCheck,value=c.value;state.openGlobalFilter=key;let vals=globalFilterValues(key).filter(v=>norm(v)!==norm(value));if(c.checked)vals.push(value);state.filters[key]=vals;if(key==='moaGroup')syncMoaSelectionFromGroups();reconcileTerritoryGlobalFilters(key);renderFilters();renderPage();});});
  filtersEl?.addEventListener('click',e=>{
    const summary=e.target.closest('.obs-check-filter>summary');if(summary){const details=summary.parentElement;setTimeout(()=>{if(details?.open){const input=details.querySelector('[data-global-filter-search]');try{input?.focus({preventScroll:true});}catch{input?.focus();}}},0);}
    const all=e.target.closest('[data-global-filter-all]');if(all){e.preventDefault();preserveUiScroll(()=>{const key=all.dataset.globalFilterAll;state.openGlobalFilter=key;const visible=[...filtersEl.querySelectorAll(`[data-global-filter-check="${key}"]`)].filter(i=>!i.closest('[data-filter-option]')?.hidden).map(i=>i.value);state.filters[key]=uniq([...globalFilterValues(key),...visible]);if(key==='moaGroup')syncMoaSelectionFromGroups();reconcileTerritoryGlobalFilters(key);renderFilters();renderPage();});return;}const clear=e.target.closest('[data-global-filter-clear]');if(clear){e.preventDefault();preserveUiScroll(()=>{const key=clear.dataset.globalFilterClear;state.openGlobalFilter=key;state.filters[key]=[];if(key==='moaGroup')syncMoaSelectionFromGroups();reconcileTerritoryGlobalFilters(key);renderFilters();renderPage();});}});
  sidebarToggle?.addEventListener('click',()=>setSidebarCollapsed(!layoutEl?.classList.contains('is-sidebar-collapsed')));
  document.getElementById('obsNav')?.addEventListener('click',e=>{const b=e.target.closest('[data-page]');if(b)changePage(b.dataset.page);});
  document.getElementById('obsReportsNav')?.addEventListener('click',()=>changePage('reports'));
  document.getElementById('obsResetFilters')?.addEventListener('click',()=>preserveUiScroll(()=>{Object.keys(state.filters).forEach(k=>state.filters[k]=[]);state.filterSearch={};state.openGlobalFilter='';state.autoMoaFromGroup=[];state.crossFilters=[];state.performanceMatrixMentions=[];state.performanceMatrixPerformances=[];state.matrixSearch={mention:'',performance:''};resetTerritoryMapFocus();state.search='';if(searchEl)searchEl.value='';renderFilters();renderPage();}));
  searchEl?.addEventListener('input',e=>{state.search=e.target.value||'';renderPage();});
  document.getElementById('obsSourceBtn')?.addEventListener('click',()=>engine.showDataSource());
  document.getElementById('obsDemoConnect')?.addEventListener('click',()=>engine.showDataSource());
  document.getElementById('obsRefreshBtn')?.addEventListener('click',async()=>{if(runtime().connected||engine.sourceConfigured()){try{await engine.refresh();}catch{}}else engine.showDataSource();});
  document.getElementById('obsGeneratorBtn')?.addEventListener('click',()=>engine.openGenerator(generatorLaunchScope()));
  document.querySelectorAll('[data-obs-drawer-close="1"]').forEach(el=>el.addEventListener('click',closeDrawer));
  drawerTabs?.addEventListener('click',e=>{const b=e.target.closest('[data-drawer-tab]');if(!b)return;state.drawerTab=b.dataset.drawerTab;renderDrawer();});
  drawerBody?.addEventListener('click',e=>{const gm=e.target.closest('[data-group-moa]');if(gm){state.activeGroupMoa=gm.dataset.groupMoa;state.operationsPage=1;renderDrawer();return;}const gb=e.target.closest('[data-group-back]');if(gb){state.activeGroupMoa='';state.operationsPage=1;renderDrawer();return;}const opPager=e.target.closest('[data-table-page="operations"][data-page]');if(opPager&&state.activeMoaGroup){state.operationsPage=Math.max(1,Number(opPager.dataset.page)||1);renderDrawer();return;}const opLink=e.target.closest('[data-op-code]');if(opLink&&state.activeMoaGroup){openOperation(opLink.dataset.opCode);return;}const view=e.target.closest('[data-table-view="raw"][data-view]');if(view){state.rawView=view.dataset.view==='tiles'?'tiles':'list';renderDrawer();return;}const pager=e.target.closest('[data-table-page="raw"][data-page]');if(!pager)return;state.rawPage=Math.max(1,Number(pager.dataset.page)||1);renderDrawer();});

  pageEl.addEventListener('click',e=>{
    if(state.page==='requirements' && window.NEWOSB_REQUIREMENTS?.handleClick?.(e)) return;
    const audit=e.target.closest('[data-audit-card],.obs-kpi[data-audit-label],.obs-coverage-row[data-audit-label]'); if(audit){const card=audit.closest('.obs-card'),title=audit.dataset.auditLabel||card?.querySelector('h2')?.textContent||'Source et calcul';openAudit(title,audit.dataset.auditMetric||'');return;}
    const entityToggle=e.target.closest('[data-operations-entity-toggle]');if(entityToggle){state.operationsEntityView=entityToggle.checked?'groups':'operations';state.operationsPage=1;renderPage();return;}
    const groupCard=e.target.closest('[data-moa-group-card]');if(groupCard){openMoaGroupDrawer(groupCard.dataset.moaGroupCard);return;}const techOp=e.target.closest('[data-tech-op-code]');if(techOp){openTechnicalOperation(techOp.dataset.techOpCode);return;}
    const scatter=e.target.closest('[data-scatter-op]');if(scatter){openTechnicalOperation(scatter.dataset.scatterOp);return;}
    const addPres=e.target.closest('[data-add-presentation]'); if(addPres){ addCurrentCardToPresentation(addPres).catch(err=>{console.error(err);alert('Ajout à la présentation impossible : '+(err?.message||err));}); return; }
    const presSelect=e.target.closest('[data-pres-select]'); if(presSelect){ state.presentationActiveId=presSelect.dataset.presSelect; savePresentationState(); renderPage(); return; }
    const presDelete=e.target.closest('[data-pres-delete]'); if(presDelete){ deletePresentationSlide(presDelete.dataset.presDelete); return; }
    const presDup=e.target.closest('[data-pres-duplicate]'); if(presDup){ duplicatePresentationSlide(presDup.dataset.presDuplicate); return; }
    const presMove=e.target.closest('[data-pres-move][data-pres-id]'); if(presMove){ movePresentationSlide(presMove.dataset.presId, presMove.dataset.presMove==='up' ? -1 : 1); return; }
    const presClear=e.target.closest('[data-pres-clear]'); if(presClear){ clearPresentationSlides(); return; }
    const presCover=e.target.closest('[data-pres-cover]'); if(presCover){ ensureCoverSlide(); return; }
    const presGoogle=e.target.closest('[data-pres-google-slides]'); if(presGoogle){ exportPresentationGoogleSlides(); return; }
    const presPptx=e.target.closest('[data-pres-export-pptx]'); if(presPptx){ exportPresentationPptx().catch(err=>{console.error(err);alert('Export PPTX impossible : '+(err?.message||err));}); return; }
    const presExport=e.target.closest('[data-pres-export][data-pres-id]'); if(presExport){ exportPresentationSlide(presExport.dataset.presId, presExport.dataset.presExport||'png'); return; }
    const presExportAll=e.target.closest('[data-pres-export-all]'); if(presExportAll){ exportAllPresentationSlides(presExportAll.dataset.presExportAll||'png'); return; }
    const presFull=e.target.closest('[data-pres-fullscreen]'); if(presFull){ document.getElementById('obsPresentationStage')?.requestFullscreen?.(); return; }
    const pageLink=e.target.closest('[data-page-link]'); if(pageLink){changePage(pageLink.dataset.pageLink);return;}
    const basemap=e.target.closest('[data-map-basemap]'); if(basemap){const mode=basemap.dataset.mapBasemap;if(['legacy','ign','osm'].includes(mode)){state.mapBasemap=mode;if(mode==='ign')state.osmTileProviderIndex=0;else if(mode==='osm'&&state.osmTileProviderIndex===0)state.osmTileProviderIndex=1;if(state.mapFocusRegion)state.mapFocusPending=true;renderPage();}return;}
    const layer=e.target.closest('[data-map-layer]'); if(layer){const key=layer.dataset.mapLayer;if(Object.prototype.hasOwnProperty.call(state.mapLayers,key)){state.mapLayers[key]=!state.mapLayers[key];renderPage();}return;}
    const flow=e.target.closest('[data-flow-focus][data-flow-before]'); if(flow){const key=flow.dataset.flowFocus,val=decodeURIComponent(flow.dataset.flowBefore||'');if(state.flowFocus[key]!==undefined){state.flowFocus[key]=norm(state.flowFocus[key])===norm(val)?'':val;renderPage();}return;}
    const q=e.target.closest('[data-quick-filter]'); if(q){quickFilter(q.dataset.quickFilter,q.dataset.quickValue);return;}
    const fullscreen=e.target.closest('[data-map-fullscreen]'); if(fullscreen){const card=fullscreen.closest('.obs-map-card')||document.querySelector('.obs-map-card');if(card){if(document.fullscreenElement)document.exitFullscreen?.();else card.requestFullscreen?.();}return;}
    if(e.target.closest('[data-overview-total-toggle]')){preserveUiScroll(()=>{state.overviewShowTotal=!state.overviewShowTotal;renderPage();});return;}
    const solutionView=e.target.closest('[data-solution-view][data-view]'); if(solutionView){preserveUiScroll(()=>{const key=solutionView.dataset.solutionView;state.solutionViews[key]=solutionView.dataset.view==='pie'?'pie':'bar';renderPage();});return;}
    const energyCepView=e.target.closest('[data-energy-cep-view][data-view]');if(energyCepView){preserveUiScroll(()=>{const key=energyCepView.dataset.energyCepView;if(!state.energyCepViews)state.energyCepViews={};state.energyCepViews[key]=energyCepView.dataset.view==='bar'?'bar':'pie';renderPage();});return;}
    const copyReport=e.target.closest?.('[data-copy-progress-report]');if(copyReport){const text=progressReportText(),st=copyReport.parentElement?.querySelector('[data-copy-progress-report-status]');const done=ok=>{if(st)st.textContent=ok?'Copié : colle-le dans la conversation.':'Copie impossible : sélectionne le texte ci-dessous.';if(!ok&&st){let ta=pageEl.querySelector('[data-progress-report-text]');if(!ta){ta=document.createElement('textarea');ta.setAttribute('data-progress-report-text','');ta.style.cssText='width:100%;height:180px;margin-top:8px;font:11px monospace';copyReport.parentElement.appendChild(ta);}ta.value=text;ta.select();}};try{navigator.clipboard.writeText(text).then(()=>done(true),()=>done(false));}catch{done(false);}return;}
    const matrixClear=e.target.closest?.('[data-matrix-clear]');if(matrixClear){const kind=matrixClear.dataset.matrixClear,key=kind==='mention'?'performanceMatrixMentions':'performanceMatrixPerformances';state[key]=[];state.performanceMatrixPage=1;renderPage();return;}
        const tableView=e.target.closest('[data-table-view][data-view]'); if(tableView){const map={territory:'territoryTableView',moa:'moaTableView','status-year':'statusYearView',mention:'mentionTableView',performance:'performanceTableView','performance-matrix':'performanceMatrixView',operations:'operationsTableView'},key=map[tableView.dataset.tableView];if(key){state[key]=tableView.dataset.view;renderPage();}return;}
    const resetRegion=e.target.closest('[data-map-reset-region]'); if(resetRegion){state.crossFilters=state.crossFilters.filter(f=>f.key!=='region'&&f.key!=='department');resetTerritoryMapFocus();state.mapOperationGrouping='region';state.territorySummaryPage=1;state.territoryPage=1;renderPage();return;}
    const pager=e.target.closest('[data-table-page][data-page]'); if(pager){const kind=pager.dataset.tablePage,page=Math.max(1,Number(pager.dataset.page)||1);if(kind==='moa')state.moaPage=page;else if(kind==='mention')state.mentionPage=page;else if(kind==='performance')state.performancePage=page;else if(kind==='territory')state.territoryPage=page;else if(kind==='territory-summary')state.territorySummaryPage=page;else if(kind==='operations')state.operationsPage=page;else if(kind==='overview-mention')state.overviewMentionPage=page;else if(kind==='overview-performance')state.overviewPerformancePage=page;else if(kind==='performance-matrix')state.performanceMatrixPage=page;else if(kind==='status-year-list')state.statusYearPage=page;else if(kind==='quality-issues')state.qualityIssuePage=page;else if(kind==='dictionary')state.dictionaryPage=page;renderPage();return;}
    const viewToggle=e.target.closest('[data-overview-view][data-view]'); if(viewToggle){const kind=viewToggle.dataset.overviewView,view=viewToggle.dataset.view;if(kind==='mention'){state.overviewMentionView=view;state.overviewMentionPage=1;}else if(kind==='performance'){state.overviewPerformanceView=view;state.overviewPerformancePage=1;}renderPage();return;}
    const cross=e.target.closest('[data-cross-key][data-cross-value]'); if(cross){const decodedValue=cross.dataset.crossEncoded==='1'?decodeURIComponent(cross.dataset.crossValue):cross.dataset.crossValue, decodedLabel=cross.dataset.crossEncoded==='1'?decodeURIComponent(cross.dataset.crossLabel||''):cross.dataset.crossLabel;const fixed=crossKeyValueFix(cross.dataset.crossKey,decodedValue,decodedLabel);if(fixed.value){if(state.page==='territories'&&fixed.key==='region'){if(activeCross('region',fixed.value)){resetTerritoryMapFocus();state.mapOperationGrouping='region';}else{focusTerritoryRegion(fixed.value);state.mapOperationGrouping='department';state.mapLayers.departments=true;state.mapLayers.regions=true;state.territorySummaryPage=1;state.territoryPage=1;}}setCrossFilter(fixed.key,fixed.value,fixed.label);}return;}
    const remove=e.target.closest('[data-remove-cross]'); if(remove){const i=Number(remove.dataset.removeCross);if(Number.isInteger(i)&&state.crossFilters[i]){if(state.crossFilters[i].key==='region'){resetTerritoryMapFocus();state.mapOperationGrouping='region';}state.crossFilters.splice(i,1);renderPage();}return;}
    if(e.target.closest('[data-clear-cross]')){state.crossFilters=[];resetTerritoryMapFocus();state.mapOperationGrouping='region';renderPage();return;}
    if(e.target.closest('[data-drilldown-current]')){changePage('operations');return;}
    const tag=e.target.closest('[data-tag-kind][data-tag-name]'); if(tag){const ops=filteredOperations().filter(o=>operationHasTag(o,tag.dataset.tagKind,tag.dataset.tagName));engine.openExplorer(tag.dataset.tagName,ops,`${ops.length} opération${ops.length>1?'s':''}`);return;}
    const tagChip=e.target.closest('[data-tag-filter][data-tag-value]'); if(tagChip){const kind=tagChip.dataset.tagFilter,val=tagChip.dataset.tagValue;const ops=filteredOperations().filter(o=>operationHasTag(o,kind,val));engine.openExplorer(val,ops,`${ops.length} opération${ops.length>1?'s':''}`);return;}
    const op=e.target.closest('[data-op-code]'); if(op){openOperation(op.dataset.opCode);return;}
    if(e.target.closest('[data-open-generator]')){engine.openGenerator(generatorLaunchScope());return;}
    if(e.target.closest('[data-open-source]')){engine.showDataSource();return;}
    if(e.target.closest('[data-export-current]')){exportCurrentCsv();return;}
  });

  pageEl.addEventListener('change',e=>{const cm=e.target.closest?.('[data-cross-metric]');if(cm){if(cm.dataset.crossMetric==='x')state.crossX=cm.value;else state.crossY=cm.value;renderPage();return;}
    const performanceCheck=e.target.closest?.('[data-performance-matrix-check]');if(performanceCheck){const kind=performanceCheck.dataset.performanceMatrixCheck,key=kind==='mention'?'performanceMatrixMentions':'performanceMatrixPerformances',vals=matrixSelectionValues(kind).slice(),value=performanceCheck.value,idx=vals.findIndex(v=>norm(v)===norm(value));if(performanceCheck.checked&&idx<0)vals.push(value);if(!performanceCheck.checked&&idx>=0)vals.splice(idx,1);state[key]=vals;state.performanceMatrixPage=1;renderPage();return;}
    const statusYearExcluded=e.target.closest?.('[data-status-year-excluded-toggle]');if(statusYearExcluded){state.statusYearShowExcluded=Boolean(statusYearExcluded.checked);state.statusYearPage=1;renderPage();return;}
    if(state.page==='requirements' && window.NEWOSB_REQUIREMENTS?.handleChange?.(e)) return;
    const mapGroup=e.target.closest?.('[data-map-grouping-toggle]'); if(mapGroup){state.mapOperationGrouping=state.mapFocusRegion?'department':(mapGroup.checked?'region':'department');state.territorySummaryPage=1;renderPage();return;}
    const presField=e.target.closest?.('[data-pres-field][data-pres-id]'); if(presField){ updatePresentationField(presField.dataset.presId, presField.dataset.presField, presField.value); renderPage(); return; }
    const metric=e.target.closest?.('[data-solution-metric]'); if(metric){state.solutionMetric=metric.value||'ubat';const top=pageEl.scrollTop;renderPage();requestAnimationFrame(()=>{pageEl.scrollTop=top;});return;}
  });
  pageEl.addEventListener('keyup',e=>{if(state.page==='requirements' && window.NEWOSB_REQUIREMENTS?.handleKeyup?.(e)) return;});
  pageEl.addEventListener('pointerdown',e=>{const input=e.target.closest?.('[data-req-filter-search]');if(input)e.stopPropagation();});

  pageEl.addEventListener('input',e=>{if(state.page==='requirements' && window.NEWOSB_REQUIREMENTS?.handleInput?.(e)) return;const presField=e.target.closest?.('[data-pres-field][data-pres-id]'); if(presField){ updatePresentationField(presField.dataset.presId, presField.dataset.presField, presField.value); const slide=currentPresentationSlide(); if(slide && slide.id===presField.dataset.presId){ const live=document.querySelector(`[data-pres-editable="${presField.dataset.presField}"][data-pres-id="${presField.dataset.presId}"]`); if(live) live.textContent=presField.value; } return; } const editable=e.target.closest?.('[data-pres-editable][data-pres-id]'); if(editable){ updatePresentationField(editable.dataset.presId, editable.dataset.presEditable, editable.textContent||''); return; } const matrixSearch=e.target.closest?.('[data-matrix-search]');if(matrixSearch){const kind=matrixSearch.dataset.matrixSearch,tokens=matrixSearchTokens(matrixSearch.value||'');if(!state.matrixSearch)state.matrixSearch={mention:'',performance:''};state.matrixSearch[kind]=matrixSearch.value||'';let shown=0;const list=pageEl.querySelector(`[data-matrix-check-list="${kind}"]`);list?.querySelectorAll('[data-matrix-option]').forEach(el=>{const ok=!tokens.length||tokens.every(t=>String(el.dataset.matrixOption||'').includes(t));el.hidden=!ok;if(ok)shown++;});if(list)list.scrollTop=0;const empty=pageEl.querySelector(`[data-matrix-empty="${kind}"]`);if(empty)empty.hidden=shown>0;return;} const search=e.target.closest?.('[data-table-search]');if(search){const kind=search.dataset.tableSearch,value=search.value||'';if(kind==='mention'){state.mentionSearch=value;state.mentionPage=1;}else if(kind==='performance'){state.performanceSearch=value;state.performancePage=1;}else if(kind==='dictionary'){state.dictionarySearch=value;state.dictionaryPage=1;}const snap=captureUiScroll();renderPage();restoreUiScroll(snap);requestAnimationFrame(()=>{const el=pageEl.querySelector(`[data-table-search="${kind}"]`);if(el){el.focus();try{el.setSelectionRange(value.length,value.length);}catch{}}});}});

  document.addEventListener('fullscreenchange',()=>{const btn=document.querySelector('[data-map-fullscreen]');if(btn)btn.textContent=document.fullscreenElement?'⛶ Quitter le plein écran':'⛶ Plein écran';const host=document.getElementById('obsTerritoryMap');if(host?._newosbOsmCtx)scheduleOsmRender(host._newosbOsmCtx);});
  window.addEventListener('newosb:requirementschange',e=>{if(state.page!=='requirements')return;const d=e?.detail?.scroll;const snapshot=d?{pageTop:Number(d.top)||0,pageLeft:Number(d.left)||0,winX:Number(d.winX)||0,winY:Number(d.winY)||0}:captureUiScroll();renderPage();restoreUiScroll(snapshot);});
  window.addEventListener('newosb:datachange',()=>{updateSourceStatus();renderFilters();renderPage();});
  window.addEventListener('newosb:privacychange',()=>{state.filters.moa=[];state.autoMoaFromGroup=[];state.crossFilters=state.crossFilters.filter(f=>f.key!=='moa');state.activeOperation=null;closeDrawer();closeProjectWindow();if(searchEl){searchEl.value='';searchEl.placeholder=privacy()?.enabled?.()?'Rechercher un projet anonymisé, un référentiel…':'Rechercher un projet, un MOA…';}state.search='';renderFilters();renderPage();});
  window.addEventListener('keydown',e=>{if(e.key!=='Escape')return;if(projectWindowEl?.classList.contains('is-open')){closeProjectWindow();return;}if(drawer.classList.contains('is-open'))closeDrawer();});

  if(searchEl) searchEl.placeholder=privacy()?.enabled?.()?'Rechercher un projet anonymisé, un référentiel…':'Rechercher un projet, un MOA…';
  loadPresentationState();
  loadSidebarState();
  window.NEWOSB_PRIVACY?.bindControls?.();
  updateSourceStatus(); renderFilters(); renderPage();
  setTimeout(()=>{updateSourceStatus();renderFilters();renderPage();},400);
})();
