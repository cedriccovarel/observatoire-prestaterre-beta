(() => {
  'use strict';
  const stripDiacritics = v => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const normalize = v => stripDiacritics(v).toLowerCase().replace(/&lt;br\s*\/?\s*&gt;/gi,' ').replace(/<br\s*\/?\s*>/gi,' ').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
  // V6.13 : toutes les lectures numériques passent par NEWOSB_RULES (newosb-rules.js).
  // Une valeur illisible ou ambiguë devient null (jamais 0) et est signalée en Qualité.
  const RULES = (typeof window!=='undefined' && window.NEWOSB_RULES) || (typeof globalThis!=='undefined' && globalThis.NEWOSB_RULES);
  if (!RULES) throw new Error('newosb-rules.js doit être chargé avant newosb-core.js');
  const number = v => RULES.parseNumber(v).value;
  const rows = op => op?.rawRows || [op?.raw || {}];
  const THICKNESS_KEYS=new Set(['roofThickness','wallThickness','floorThickness']);
  const R_KEYS=new Set(['roofR','wallR','floorR']);
  const measureKind = key => THICKNESS_KEYS.has(key)?'thickness':(R_KEYS.has(key)?'resistance':'');
  function parseValue(value,key){
    if(key==='certificationDecisionDate'||key==='createdDate')return RULES.parseDateYear(value);
    const kind=measureKind(key);
    return kind?RULES.parseMeasure(value,kind):RULES.parseNumber(value);
  }
  function maxMetricValue(value,key){ return parseValue(value,key).value; }
  function rawValue(op,key){
    const special=!!measureKind(key),header=op?.fields?.[key];
    if(header){
      if(special){const vals=[];for(const row of rows(op)){const v=row?.[header];if(String(v??'').trim()==='')continue;const n=maxMetricValue(v,key);if(n!==null)vals.push(n);}if(vals.length)return Math.max(...vals);}
      else {for(const row of rows(op)){const v=row?.[header];if(String(v??'').trim()!=='')return v;}}
    }
    if(op && Object.prototype.hasOwnProperty.call(op,key) && String(op[key]??'').trim()!==''){if(special){const n=maxMetricValue(op[key],key);return n===null?'':n;}return op[key];}
    return '';
  }
  // Première valeur lisible parmi les lignes de l'opération (une cellule « n.c. »
  // sur la première ligne ne masque plus une valeur valide sur la suivante).
  function rawNumber(op,key){
    const header=op?.fields?.[key];
    if(measureKind(key)) return number(rawValue(op,key));
    if(header){for(const row of rows(op)){const r=parseValue(row?.[header],key);if(r.status==='ok')return r.value;}}
    if(op && Object.prototype.hasOwnProperty.call(op,key)){const r=parseValue(op[key],key);if(r.status==='ok')return r.value;}
    return null;
  }
  // Valeurs présentes mais illisibles pour une clé numérique (pour la page Qualité).
  function unreadableValues(op,key){
    const header=op?.fields?.[key], out=[];
    if(!header) return out;
    rows(op).forEach((row,index)=>{const v=row?.[header];if(String(v??'').trim()==='')return;const r=parseValue(v,key);if(r.status==='doubtful')out.push({key,header,row:index+1,raw:String(v),reason:r.reason});});
    return out;
  }
  function affairStage(op){
    if(String(op?.affairStage||'').trim()) return String(op.affairStage).trim();
    for(const row of rows(op)) for(const [k,v] of Object.entries(row||{})) if(/affaire etape/.test(normalize(k))&&String(v??'').trim()) return String(v).trim();
    return '';
  }
  function isExcludedOperation(op){
    if(op?.analysisExcluded) return true;
    return /(^| )(perdu|perdue|perdus|perdues|abandon|abandonne|abandonnee|abandonnes|abandonnees|annule|annulee|annules|annulees)( |$)/.test(normalize(affairStage(op)));
  }

  const DICTIONARY = [
    {key:'code',label:'Code projet',unit:'',source:'OPERATIONS',type:'source',definition:'Identifiant interne du projet. Plusieurs lignes portant le même code appartiennent au même projet.',method:'Colonne Opération: Code interne ; clé de regroupement Projet.'},
    {key:'name',label:'Nom projet',unit:'',source:'OPERATIONS',type:'source',definition:'Nom de l’opération.',method:'Valeur source.'},
    {key:'moaGroup',label:'Groupe MOA',unit:'',source:'OPERATIONS',type:'source',definition:'Groupe principal auquel est rattaché le maître d’ouvrage.',method:"Colonne Nom de la société: Groupe principal Nom."},
    {key:'moa',label:'Maître d’ouvrage',unit:'',source:'OPERATIONS',type:'source',definition:'Société maître d’ouvrage retenue par le mapping NEWOSB.',method:'Colonne Nom de la société: Nom de la société.'},
    {key:'moaType',label:'Famille de maître d’ouvrage',unit:'',source:'OPERATIONS',type:'source',definition:'Secteur/famille du maître d’ouvrage.',method:"Colonne Nom de la société: Secteur d'activité."},
    {key:'department',label:'Département',unit:'',source:'OPERATIONS',type:'normalized',definition:'Code département de l’opération.',method:"Colonne Département de l'opération ; repli sur CP/adresse si nécessaire."},
    {key:'region',label:'Région',unit:'',source:'OPERATIONS',type:'normalized',definition:'Région administrative de l’opération.',method:"Colonne Région de l'opération ; repli sur la correspondance département → région si absente."},
    {key:'year',label:'Année de certification',unit:'',source:'OPERATIONS',type:'normalized',definition:'Année de la décision de certification. Utilisée par le filtre « Année certification » et la courbe d’évolution.',method:"Année de la colonne Date de décision de certification (date : 15/03/2024, 15/03/24, 2024-03-15 ou numéro de série). Aucun repli sur une autre date : un projet sans décision n’a pas d’année de certification. Dates illisibles signalées en Qualité."},
    {key:'createdYear',label:'Année de création',unit:'',source:'OPERATIONS',type:'normalized',definition:'Année de création du dossier. Utilisée par le filtre « Année de création » et la chronologie de l’avancement.',method:'Année de la colonne Date de création (mêmes formats de date acceptés). Dates illisibles signalées en Qualité.'},
    {key:'constructionYear',label:'Année de construction',unit:'',source:'OPERATIONS',type:'source',definition:'Année de construction du bâtiment en particulier pour les opérations de rénovation.',method:"Colonne Année de construction (alias Année conservé pour compatibilité). Donnée descriptive du bâtiment, distincte de l'année de certification."},
    {key:'referential',label:'Référentiel',unit:'',source:'OPERATIONS',type:'normalized',definition:'Référentiel de certification.',method:'Colonne Référentiel.'},
    {key:'nature',label:'Nature',unit:'',source:'OPERATIONS',type:'normalized',definition:'Neuf / rénovation / autre nature renseignée.',method:'Valeur source normalisée.'},
    {key:'tags',label:'Tags projet',unit:'',source:'OPERATIONS',type:'source',definition:'Mots-clés représentatifs du projet ou de l’opération technique.',method:'Dernière colonne Tags de la feuille OPERATIONS ; plusieurs tags sont séparés par des virgules.'},
    {key:'status',label:'Avancement',unit:'',source:'OPERATIONS',type:'normalized',definition:'Étape de l’évaluation (liste fermée) : Proposition commerciale en cours, Non démarrée, Dossier incomplet, Dossier complet, Analyse planifiée, Analyse réalisée, Visite réalisée, Évaluation conforme.',method:"Colonne Opération: Évaluation: Statut (colonne BC), toujours utilisée ; une alerte s’affiche si moins de 80 % de ses valeurs non vides sont reconnues. Lecture tolérante : majuscules, accents, espaces, ponctuation, pluriels, numérotation, compléments et fautes de frappe légères. Ligne sans code interne : « Proposition commerciale en cours ». Projet à plusieurs lignes : étape la moins avancée ; opération détaillée : statut exact de sa ligne. Valeurs non reconnues : « Non renseigné », listées en Qualité & données."},
    {key:'affairStage',label:'Statut commercial',unit:'',source:'OPERATIONS',type:'source',definition:'Statut du contrat / de l’opération utilisé pour identifier les sorties définitives.',method:'Colonne Statut ; utilisée notamment pour exclure perdu / abandonné / annulé des statistiques actives.'},
    {key:'dwellings',label:'Logements',unit:'logements',source:'OPERATIONS',type:'source',definition:'Nombre de logements associé à l’opération.',method:'Valeur numérique source.'},
    {key:'buildings',label:'Bâtiments',unit:'bâtiments',source:'OPERATIONS',type:'source',definition:'Nombre de bâtiments associé à l’opération.',method:'Valeur numérique source.'},
    {key:'bbio',label:'Bbio projet',unit:'points',source:'OPERATIONS / RSET',type:'source',definition:'Besoin bioclimatique du projet.',method:'Valeur source identifiée par le mapping.'},
    {key:'bbioMax',label:'Bbio max',unit:'points',source:'OPERATIONS / RSET',type:'source',definition:'Seuil Bbio maximal applicable.',method:'Valeur source.'},
    {key:'cep',label:'CEP projet',unit:'kWhEP/m².an',source:'OPERATIONS / RSET',type:'source',definition:'Consommation d’énergie primaire du projet.',method:'Valeur source.'},
    {key:'cepMax',label:'CEP max',unit:'kWhEP/m².an',source:'OPERATIONS / RSET',type:'source',definition:'Seuil CEP maximal applicable.',method:'Valeur source.'},
    {key:'dh',label:'DH',unit:'°C.h',source:'OPERATIONS / RSET',type:'source',definition:'Degrés-heures d’inconfort.',method:'Valeur source.'},
    {key:'dhMax',label:'DH max',unit:'°C.h',source:'OPERATIONS / RSET',type:'source',definition:'Seuil maximal de degrés-heures.',method:'Valeur source.'},
    {key:'ubatBefore',label:'Ubat initial',unit:'W/m².K',source:'OPERATIONS / étude thermique',type:'source',definition:'Coefficient moyen de déperdition initial.',method:'Valeur source.'},
    {key:'ubatAfter',label:'Ubat projet',unit:'W/m².K',source:'OPERATIONS / étude thermique',type:'source',definition:'Coefficient moyen de déperdition après travaux/projet.',method:'Valeur source.'},
    {key:'roofR',label:'R toiture',unit:'m².K/W',source:'OPERATIONS / RSET',type:'normalized',definition:'Résistance thermique de la toiture.',method:'Valeur source. Valeurs séparées par / ou ; : la plus élevée est retenue ; valeurs reliées par + : additionnées (couches). Une valeur suivie de mm/cm est une épaisseur et est ignorée ; une valeur en W/m².K (coefficient U) ou hors 0,05–20 est écartée et signalée.'},
    {key:'wallR',label:'R façade',unit:'m².K/W',source:'OPERATIONS / RSET',type:'normalized',definition:'Résistance thermique de la façade.',method:'Valeur source. Valeurs séparées par / ou ; : la plus élevée est retenue ; valeurs reliées par + : additionnées (couches). Une valeur suivie de mm/cm est une épaisseur et est ignorée ; une valeur en W/m².K (coefficient U) ou hors 0,05–20 est écartée et signalée.'},
    {key:'floorR',label:'R plancher bas',unit:'m².K/W',source:'OPERATIONS / RSET',type:'normalized',definition:'Résistance thermique du plancher bas.',method:'Valeur source. Valeurs séparées par / ou ; : la plus élevée est retenue ; valeurs reliées par + : additionnées (couches). Une valeur suivie de mm/cm est une épaisseur et est ignorée ; une valeur en W/m².K (coefficient U) ou hors 0,05–20 est écartée et signalée.'},
    {key:'icEnergy',label:'IC Énergie',unit:'kgCO₂e/m²',source:'OPERATIONS / RSEnv',type:'source',definition:'Indicateur carbone énergie.',method:'Valeur source.'},
    {key:'icEnergyMax',label:'IC Énergie max',unit:'kgCO₂e/m²',source:'OPERATIONS / RSEnv',type:'source',definition:'Seuil IC Énergie applicable.',method:'Valeur source.'},
    {key:'icConstruction',label:'IC Construction',unit:'kgCO₂e/m²',source:'OPERATIONS / RSEnv',type:'source',definition:'Indicateur carbone construction.',method:'Valeur source.'},
    {key:'icConstructionMax',label:'IC Construction max',unit:'kgCO₂e/m²',source:'OPERATIONS / RSEnv',type:'source',definition:'Seuil IC Construction réglementaire applicable à l’opération.',method:'Valeur source. Sert de niveau réglementaire courant dans les comparaisons carbone.'},
    {key:'icConstruction2028',label:'Seuil IC Construction 2028',unit:'kgCO₂e/m²',source:'RSEnv / Calcul NEWOSB',type:'normalized',definition:'Seuil carbone construction applicable au jalon 2028.',method:'Recherche prioritaire d’une colonne source contenant IC Construction et 2028 ; à défaut valeur de référence NEWOSB 589,63 kgCO₂e/m².'},
    {key:'icConstruction2031',label:'Seuil IC Construction 2031',unit:'kgCO₂e/m²',source:'RSEnv / Calcul NEWOSB',type:'normalized',definition:'Seuil carbone construction applicable au jalon 2031.',method:'Recherche prioritaire d’une colonne source contenant IC Construction et 2031 ; à défaut valeur de référence NEWOSB 498,16 kgCO₂e/m².'},
    {key:'dpeEnergyBefore',label:'DPE énergie avant',unit:'classe',source:'OPERATIONS / DPE',type:'source',definition:'Classe énergie avant travaux.',method:'Classe A à G issue de la source.'},
    {key:'dpeEnergyAfter',label:'DPE énergie après',unit:'classe',source:'OPERATIONS / DPE',type:'source',definition:'Classe énergie après travaux.',method:'Classe A à G issue de la source.'},
    {key:'dpeGesBefore',label:'DPE GES avant',unit:'classe',source:'OPERATIONS / DPE',type:'source',definition:'Classe GES avant travaux.',method:'Classe A à G issue de la source.'},
    {key:'dpeGesAfter',label:'DPE GES après',unit:'classe',source:'OPERATIONS / DPE',type:'source',definition:'Classe GES après travaux.',method:'Classe A à G issue de la source.'}
  ];
  const dictByKey = Object.fromEntries(DICTIONARY.map(x=>[x.key,x]));
  // Clés lues comme des nombres (contrôle de lisibilité en Qualité & données).
  const NUMERIC_KEYS = [...DICTIONARY.filter(d=>d.unit&&d.unit!=='classe'&&!/^icConstruction20/.test(d.key)).map(d=>d.key),'roofThickness','wallThickness','floorThickness'];
  // Colonnes de dates lues pour les années (contrôle de lisibilité en Qualité).
  const DATE_KEYS = {certificationDecisionDate:'Date de décision de certification',createdDate:'Date de création'};
  function provenance(op,key){
    const d=dictByKey[key]||{key,label:key,source:'NEWOSB',type:'unknown',definition:'',method:''};
    const header=op?.fields?.[key]||'';
    return {...d,header,value:rawValue(op,key)};
  }
  function coverage(ops,key){
    const population=(ops||[]).length;
    let available=0;
    (ops||[]).forEach(op=>{const v=rawValue(op,key);if(String(v??'').trim()!=='')available++;});
    return {key,population,available,missing:population-available,rate:population?100*available/population:0};
  }
  function qualityForOperation(op){
    const issues=[];
    const req=[['code','Code opération'],['name','Nom opération'],['moa','Maître d’ouvrage'],['department','Département'],['referential','Référentiel']];
    req.forEach(([k,l])=>{if(String(rawValue(op,k)||op?.[k]||'').trim()==='')issues.push({severity:'error',code:`missing:${k}`,label:`${l} manquant`});});
    if(isExcludedOperation(op)) issues.push({severity:'info',code:'excluded',label:`Hors statistiques actives : ${affairStage(op)||'sortie définitive'}`});
    const dwell=number(op?.dwellings),build=number(op?.buildings);
    if(dwell!==null&&dwell<0)issues.push({severity:'error',code:'negative:dwellings',label:'Nombre de logements négatif'});
    if(build!==null&&build<0)issues.push({severity:'error',code:'negative:buildings',label:'Nombre de bâtiments négatif'});
    if(dwell===0&&build>0&&/logement|resident/i.test(String(op?.referential||'')+' '+String(op?.nature||'')))issues.push({severity:'warn',code:'zero:dwellings',label:'0 logement avec bâtiment(s) résidentiel(s)'});
    [['roofR','R toiture',0,20],['wallR','R façade',0,15],['floorR','R plancher bas',0,15],['bbio','Bbio',0,500],['cep','CEP',0,2000],['dh','DH',0,10000],['icConstruction','IC Construction',0,3000],['icEnergy','IC Énergie',0,3000]].forEach(([k,l,min,max])=>{const n=rawNumber(op,k);if(n!==null&&(n<min||n>max))issues.push({severity:'warn',code:`outlier:${k}`,label:`${l} atypique : ${n}`});});
    [['bbio','bbioMax','Bbio'],['cep','cepMax','CEP'],['dh','dhMax','DH'],['icEnergy','icEnergyMax','IC Énergie'],['icConstruction','icConstructionMax','IC Construction']].forEach(([vKey,mKey,l])=>{const v=rawNumber(op,vKey),m=rawNumber(op,mKey);if(v!==null&&m!==null&&v>m)issues.push({severity:'warn',code:`threshold:${vKey}`,label:`${l} supérieur au seuil (${v} > ${m})`});});
    NUMERIC_KEYS.forEach(k=>unreadableValues(op,k).forEach(u=>issues.push({severity:'warn',code:`unreadable:${k}`,label:`${(dictByKey[k]?.label)||k} illisible : « ${u.raw} » (${u.reason})`,detail:u})));
    if(op?.progressState==='invalid')issues.push({severity:'warn',code:'progress:invalid',label:`Avancement hors liste : « ${op.rawStatus||''} »`});
    else if(op?.progressState==='empty'||op?.status==='unknown')issues.push({severity:'info',code:'progress:missing',label:'Avancement non renseigné'});
    const score=Math.max(0,100-issues.reduce((s,i)=>s+(i.severity==='error'?20:i.severity==='warn'?8:0),0));
    return {score,issues,errors:issues.filter(i=>i.severity==='error').length,warnings:issues.filter(i=>i.severity==='warn').length};
  }
  function qualitySummary(ops){
    const reports=(ops||[]).map(op=>({op,report:qualityForOperation(op)}));
    const errors=reports.reduce((s,x)=>s+x.report.errors,0),warnings=reports.reduce((s,x)=>s+x.report.warnings,0);
    const withIssues=reports.filter(x=>x.report.errors||x.report.warnings).length;
    const avgScore=reports.length?reports.reduce((s,x)=>s+x.report.score,0)/reports.length:100;
    return {reports,errors,warnings,withIssues,avgScore};
  }
  function comparableSet(target,ops){
    const candidates=(ops||[]).filter(o=>o!==target && !isExcludedOperation(o));
    const score=o=>{
      let s=0;
      if(normalize(o.referential)===normalize(target.referential))s+=4;
      if(normalize(o.nature)===normalize(target.nature))s+=3;
      const oy=o.constructionYear||o.year, ty=target.constructionYear||target.year;
      if(String(oy)===String(ty))s+=2;
      else if(Number.isFinite(Number(oy))&&Number.isFinite(Number(ty))&&Math.abs(Number(oy)-Number(ty))<=1)s+=1;
      if(normalize(o.moaType)===normalize(target.moaType)&&normalize(target.moaType))s+=1;
      if(normalize(o.department)===normalize(target.department))s+=1;
      const td=Number(target.dwellings)||0,od=Number(o.dwellings)||0;
      if(td&&od&&Math.abs(od-td)/Math.max(td,1)<=.35)s+=2;
      return s;
    };
    const ranked=candidates.map(o=>({o,s:score(o)})).filter(x=>x.s>=5).sort((a,b)=>b.s-a.s);
    return ranked.slice(0,100).map(x=>x.o);
  }
  function stats(ops,key){
    const vals=(ops||[]).map(o=>rawNumber(o,key)).filter(v=>v!==null).sort((a,b)=>a-b);
    if(!vals.length)return {n:0,mean:null,median:null,q1:null,q3:null,min:null,max:null};
    const q=p=>{const pos=(vals.length-1)*p,base=Math.floor(pos),rest=pos-base;return vals[base+1]!==undefined?vals[base]+rest*(vals[base+1]-vals[base]):vals[base];};
    return {n:vals.length,mean:vals.reduce((a,b)=>a+b,0)/vals.length,median:q(.5),q1:q(.25),q3:q(.75),min:vals[0],max:vals.at(-1)};
  }

  function thresholdFromRaw(op,year){
    const direct=rawNumber(op,year===2028?'icConstruction2028':'icConstruction2031');
    if(direct!==null)return direct;
    const yr=String(year);
    for(const row of rows(op))for(const [k,v] of Object.entries(row||{})){
      const nk=normalize(k); if(nk.includes('ic construction')&&nk.includes(yr)){const n=number(v);if(n!==null)return n;}
    }
    return year===2028?589.63:498.16;
  }
  function carbonThresholds(op){
    return {current:rawNumber(op,'icConstructionMax'),y2028:thresholdFromRaw(op,2028),y2031:thresholdFromRaw(op,2031)};
  }
  function carbonBand(op){
    const value=rawNumber(op,'icConstruction'); if(value===null)return {key:'missing',label:'IC Construction non renseigné',color:'#9AA8A2',value:null,...carbonThresholds(op)};
    const t=carbonThresholds(op);
    if(value<=t.y2031)return {key:'2031',label:'Niveau 2031 atteint ou dépassé',color:'#168456',value,...t};
    if(value<=t.y2028)return {key:'2028-2031',label:'Entre les seuils 2028 et 2031',color:'#2C6E9B',value,...t};
    return {key:'current-2028',label:'Entre le niveau réglementaire courant et 2028',color:'#C94C4C',value,...t};
  }
  function duplicateSummary(ops){
    const byCode=new Map(),byName=new Map();(ops||[]).forEach(op=>{const c=normalize(op?.code),n=normalize(op?.name);if(c){byCode.set(c,(byCode.get(c)||0)+1)}if(n){byName.set(n,(byName.get(n)||0)+1)}});
    return {duplicateCodes:[...byCode.values()].filter(v=>v>1).length,duplicateNames:[...byName.values()].filter(v=>v>1).length};
  }
  function geoIssues(ops){
    return (ops||[]).filter(op=>{const cp=String(op?.postalCode||'').replace(/\D/g,'');const d=String(op?.department||'').toUpperCase();if(cp.length<2||!d)return false;if(d==='2A'||d==='2B')return cp.startsWith('20')===false;return cp.slice(0,2)!==d.slice(0,2);}).length;
  }

  window.NEWOSB_CORE={version:'06.13',normalize,number,rawValue,rawNumber,parseValue,unreadableValues,numericKeys:[...NUMERIC_KEYS,...Object.keys(DATE_KEYS)],dateKeys:DATE_KEYS,affairStage,isExcludedOperation,dictionary:DICTIONARY,dictByKey,provenance,coverage,qualityForOperation,qualitySummary,comparableSet,stats,carbonThresholds,carbonBand,duplicateSummary,geoIssues};
})();
