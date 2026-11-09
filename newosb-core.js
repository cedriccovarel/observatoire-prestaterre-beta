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
    {key:'status',label:'Avancement',unit:'',source:'OPERATIONS',type:'normalized',definition:'Étape de l’évaluation (liste fermée) : Proposition commerciale en cours, Non démarrée, Dossier incomplet, Dossier complet, Analyse planifiée, Analyse réalisée, Visite réalisée, Évaluation conforme.',method:"Colonne Opération: Évaluation: Statut (BC) en priorité. Si BC est vide pour une ligne, la colonne « État du dossier » (AV) est utilisée : elle porte l’avancement des lignes historiques sans code interne (même liste de valeurs ; aucune ligne n’a les deux). Une valeur BC renseignée mais non reconnue n’est pas remplacée : elle est signalée en Qualité. Une alerte s’affiche si moins de 80 % des valeurs non vides de BC sont reconnues. Lecture tolérante : majuscules, accents, espaces, ponctuation, pluriels, numérotation, compléments et fautes de frappe légères. « Proposition commerciale en cours » = ligne sans code interne ET sans avancement en BC ni en État du dossier. Projet à plusieurs lignes : étape la moins avancée ; opération détaillée : statut exact de sa ligne. Sans avancement exploitable : « Non renseigné », listé en Qualité & données."},
    {key:'affairStage',label:'Statut commercial',unit:'',source:'OPERATIONS',type:'source',definition:'Statut du contrat / de l’opération utilisé pour identifier les sorties définitives.',method:'Colonne Statut ; utilisée notamment pour exclure perdu / abandonné / annulé des statistiques actives.'},
    {key:'dwellings',label:'Logements',unit:'logements',source:'OPERATIONS',type:'source',definition:'Nombre de logements associé à l’opération.',method:'Valeur numérique source.'},
    {key:'surface',label:'Surface',unit:'m²',source:'OPERATIONS',type:'source',definition:'Surface totale de l’opération.',method:'Colonne Total surface (alias Surface).'},
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
    {key:'dpeGesAfter',label:'DPE GES après',unit:'classe',source:'OPERATIONS / DPE',type:'source',definition:'Classe GES après travaux.',method:'Classe A à G issue de la source.'},
    {key:'cepnr',label:'Cep,nr projet',unit:'kWhEP/m².an',source:'OPERATIONS / RSET',type:'source',definition:'Consommation d’énergie primaire non renouvelable du projet.',method:'Valeur source.'},
    {key:'cepnrMax',label:'Cep,nr max',unit:'kWhEP/m².an',source:'OPERATIONS / RSET',type:'source',definition:'Seuil Cep,nr maximal applicable.',method:'Valeur source.'},
    {key:'tic',label:'TIC projet',unit:'°C',source:'OPERATIONS / RSET',type:'source',definition:'Température intérieure conventionnelle du projet.',method:'Valeur source.'},
    {key:'ticRef',label:'TIC ref',unit:'°C',source:'OPERATIONS / RSET',type:'source',definition:'TIC de référence (valeur maximale à ne pas dépasser).',method:'Valeur source.'},
    {key:'cepBefore',label:'Cep initial',unit:'kWhEP/m².an',source:'OPERATIONS / étude thermique',type:'source',definition:'Consommation d’énergie primaire avant travaux.',method:'Valeur source.'},
    {key:'cepAfter',label:'Cep après travaux',unit:'kWhEP/m².an',source:'OPERATIONS / étude thermique',type:'source',definition:'Consommation d’énergie primaire après travaux.',method:'Valeur source ; à défaut, Cep projet.'},
    {key:'median',label:'Médiane',unit:'',source:'Calcul Observatoire',type:'calculated',definition:'Valeur du milieu : la moitié des opérations est au-dessous, l’autre moitié au-dessus. Contrairement à la moyenne, elle n’est pas tirée par quelques valeurs extrêmes. La « moitié centrale » va du 1er au 3e quartile (25 % à 75 % des opérations).',method:'Lecture principale des onglets Énergie & transition et Carbone & DPE depuis la V6.51. Moitié centrale affichée seulement à partir de 5 opérations ; la moyenne reste en information secondaire.'},
    {key:'thresholdMargin',label:'Marge au seuil',unit:'%',source:'Calcul Observatoire',type:'calculated',definition:'De combien les opérations restent sous leur seuil maximal (Cep max, Cep,nr max, Bbio max, DH max, TIC ref, IC Énergie max, IC Construction max). Le seuil est une butée : il ne doit pas être dépassé.',method:'Seules les opérations ayant la valeur ET son seuil sont retenues. Pour chacune : ratio = valeur ÷ seuil. Marge = 1 − médiane des ratios. Moins de 5 opérations : échantillon faible (pas de moitié centrale). Aucune opération : « Non calculable » (jamais 0 %). Une valeur au-dessus de son seuil est écartée de la médiane, listée et signalée en Qualité (erreur de saisie, de référentiel ou d’unité probable). DH : sans DH max, seuil par défaut 1 250 °C·h, indiqué sous la barre.'},
    {key:'beforeAfterMedian',label:'Avant → après (Ubat, Cep)',unit:'',source:'Calcul Observatoire',type:'calculated',definition:'Évolution entre la valeur avant travaux et la valeur après travaux (Ubat initial → Ubat projet ; Cep initial → Cep après travaux).',method:'Opérations ayant les deux valeurs ; médiane avant → médiane après et écart en %. Ubat hors plage 0,1–5 W/m².K écarté et signalé en Qualité.'},
    {key:'windowFamilies',label:'Menuiseries extérieures (familles)',unit:'',source:'OPERATIONS',type:'calculated',definition:'Regroupement des textes libres Matériau, Vitrage et Occultation des menuiseries en familles comparables, et combinaisons les plus fréquentes.',method:'Matériau : PVC, Bois, Aluminium ; plusieurs matériaux cités (ex. « Bois + PVC sur autres façades ») → Matériaux combinés ; autre matériau seul (acier…) → Autre ; vide → Non renseigné. Vitrage : « triple » → Triple vitrage ; « argon » ou le mot isolé « Ar » (ex. « 10.10.4 Ar ») → Double vitrage argon ; « simple vitrage » seul → Simple vitrage ; sinon Double vitrage ; vide → Non renseigné. Occultation : « roulant » → Volets roulants ; « persienne » ou « battant » → Persiennes / battants ; « store », BSO ou brise-soleil → Stores ; plusieurs familles → Occultations combinées ; « sans occultation » → Sans occultation ; texte non reconnu → Autre ; vide → Non renseigné. Base des pourcentages : opérations ayant au moins un champ menuiserie ; une combinaison compte les opérations ayant EXACTEMENT ces trois familles.'},
    {key:'dpeGain',label:'Gain de classes DPE',unit:'classes',source:'Calcul Observatoire',type:'calculated',definition:'Nombre de classes gagnées entre avant et après travaux (ex. E → C = +2), pour l’étiquette énergie et l’étiquette GES.',method:'Seules les opérations ayant la classe avant ET après. Une étiquette ne peut pas se dégrader avec des travaux : toute dégradation est affichée en rouge, listée et signalée en Qualité ; la donnée n’est pas corrigée par l’Observatoire.'}
  ];
  const dictByKey = Object.fromEntries(DICTIONARY.map(x=>[x.key,x]));
  // Clés lues comme des nombres (contrôle de lisibilité en Qualité & données).
  const NUMERIC_KEYS = [...DICTIONARY.filter(d=>d.unit&&d.unit!=='classe'&&d.type!=='calculated'&&d.key!=='surface'&&!/^icConstruction20/.test(d.key)).map(d=>d.key),'roofThickness','wallThickness','floorThickness'];
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
    // V6.51 : un seuil est un maximum ; le dépasser signale une erreur de saisie, de référentiel ou d'unité.
    THRESHOLD_PAIRS.forEach(([vKey,mKey,l])=>{const v=rawNumber(op,vKey);let m=rawNumber(op,mKey),dflt=false;if(v!==null&&(m===null||!(m>0))&&vKey==='dh'){m=DH_DEFAULT_MAX;dflt=true;}if(v!==null&&m!==null&&m>0&&v>m)issues.push({severity:'warn',code:`threshold:${vKey}`,label:`${l} au-dessus de son seuil${dflt?' par défaut':''} (${v} > ${m}) : saisie, référentiel ou unité à contrôler`});});
    [['ubatBefore','Ubat initial'],['ubatAfter','Ubat projet']].forEach(([k,l])=>{const n=rawNumber(op,k);if(n!==null&&(n<UBAT_RANGE[0]||n>UBAT_RANGE[1]))issues.push({severity:'warn',code:`range:${k}`,label:`${l} hors plage plausible ${UBAT_RANGE[0]}–${UBAT_RANGE[1]} W/m².K : ${n}`});});
    [['dpeEnergyBefore','dpeEnergyAfter','DPE énergie','energy'],['dpeGesBefore','dpeGesAfter','DPE GES','ges']].forEach(([b,a,l,t])=>{const g=dpeGain(op,b,a);if(g&&g.gain<0)issues.push({severity:'warn',code:`dpe:degraded:${t}`,label:`${l} dégradé après travaux (${g.before} → ${g.after}) : étiquette à corriger dans la source`});});
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
  // ---- V6.51 : barre de marge, avant → après, DPE en escalier --------------------------------
  const DH_DEFAULT_MAX=1250, UBAT_RANGE=[0.1,5], MIN_SAMPLE=5, DPE_LETTERS='ABCDEFG';
  const THRESHOLD_PAIRS=[['cep','cepMax','Cep'],['cepnr','cepnrMax','Cep,nr'],['bbio','bbioMax','Bbio'],['dh','dhMax','DH'],['tic','ticRef','TIC'],['icEnergy','icEnergyMax','IC Énergie'],['icConstruction','icConstructionMax','IC Construction']];
  function quantile(sorted,p){if(!sorted.length)return null;const pos=(sorted.length-1)*p,base=Math.floor(pos),rest=pos-base;return sorted[base+1]!==undefined?sorted[base]+rest*(sorted[base+1]-sorted[base]):sorted[base];}
  const median=vals=>quantile([...vals].sort((a,b)=>a-b),.5);
  // Code projet affichable : en mode anonymisé, le projectCode d'une opération technique reste le vrai code ;
  // il est donc pseudonymisé ici comme le code du projet (même résultat, la fiche s'ouvre).
  function projectCode(op){const base=String(op?.projectCode||String(op?.code??'').split('::')[0]);const P=(typeof window!=='undefined'&&window.NEWOSB_PRIVACY)||null;return op?.__newosbAnonymized&&op?.projectCode&&P?.operationCode?P.operationCode(base):base;}
  // Ratio valeur ÷ seuil opération par opération ; médiane des ratios ; dépassements écartés.
  function thresholdMargin(ops,valueKey,maxKey,options={}){
    const rows=[],over=[];let withValue=0,withoutMax=0,defaulted=0;
    (ops||[]).forEach(op=>{
      const v=rawNumber(op,valueKey);if(v===null)return;withValue++;
      let m=rawNumber(op,maxKey),dflt=false;
      if((m===null||!(m>0))&&options.defaultMax>0){m=options.defaultMax;dflt=true;}
      if(m===null||!(m>0)){withoutMax++;return;}
      const row={op,code:projectCode(op),value:v,max:m,ratio:v/m,defaulted:dflt};
      if(v>m)over.push(row);else{rows.push(row);if(dflt)defaulted++;}
    });
    const n=rows.length, ratios=rows.map(r=>r.ratio).sort((a,b)=>a-b);
    const reason=n?'':(!withValue?'aucune valeur projet renseignée':(over.length&&!withoutMax?'toutes les valeurs renseignées dépassent leur seuil':'seuil non renseigné pour les valeurs présentes'));
    const med=quantile(ratios,.5), enough=n>=MIN_SAMPLE;
    return {valueKey,maxKey,population:(ops||[]).length,withValue,withoutMax,n,rows,over,defaulted,
      medianRatio:med,q1:enough?quantile(ratios,.25):null,q3:enough?quantile(ratios,.75):null,
      margin:med===null?null:1-med,medianValue:n?median(rows.map(r=>r.value)):null,medianMax:n?median(rows.map(r=>r.max)):null,
      meanValue:n?rows.reduce((s,r)=>s+r.value,0)/n:null,underRate:(n+over.length)?100*n/(n+over.length):null,
      lowSample:n>0&&n<MIN_SAMPLE,reason};
  }
  // Médiane avant → médiane après sur les opérations ayant les deux valeurs (hors plage écartée).
  function beforeAfterMedian(ops,beforeKey,afterKey,options={}){
    const range=options.range||null, fallback=options.afterFallback||'', outOfRange=[], pairs=[];
    const inRange=v=>!range||(v>=range[0]&&v<=range[1]);
    (ops||[]).forEach(op=>{
      const b=rawNumber(op,beforeKey);let a=rawNumber(op,afterKey);if(a===null&&fallback)a=rawNumber(op,fallback);
      let bad=false;
      if(b!==null&&!inRange(b)){outOfRange.push({op,code:projectCode(op),key:beforeKey,value:b});bad=true;}
      if(a!==null&&!inRange(a)){outOfRange.push({op,code:projectCode(op),key:afterKey,value:a});bad=true;}
      if(b!==null&&a!==null&&!bad)pairs.push({op,before:b,after:a});
    });
    const n=pairs.length, before=n?median(pairs.map(p=>p.before)):null, after=n?median(pairs.map(p=>p.after)):null;
    return {n,before,after,change:(n&&before)?(after-before)/Math.abs(before):null,outOfRange,lowSample:n>0&&n<MIN_SAMPLE};
  }
  function dpeLetterOf(op,key){return String(rawValue(op,key)||'').toUpperCase().match(/[A-G]/)?.[0]||'';}
  function dpeGain(op,beforeKey,afterKey){const b=dpeLetterOf(op,beforeKey),a=dpeLetterOf(op,afterKey);if(!b||!a)return null;return {before:b,after:a,gain:DPE_LETTERS.indexOf(b)-DPE_LETTERS.indexOf(a)};}
  function dpeGainBucket(gain){return gain<0?'worse':gain>=4?'4plus':String(gain);}
  // DPE en escalier : effectifs avant / après par classe + histogramme du gain (paires seulement).
  function dpeStaircase(ops,beforeKey,afterKey){
    const before=Object.fromEntries([...DPE_LETTERS].map(l=>[l,0])), after={...before}, buckets={worse:0,'0':0,'1':0,'2':0,'3':0,'4plus':0}, degraded=[], bl=[], al=[];
    (ops||[]).forEach(op=>{
      const b=dpeLetterOf(op,beforeKey),a=dpeLetterOf(op,afterKey);
      if(b){before[b]++;bl.push(DPE_LETTERS.indexOf(b));} if(a){after[a]++;al.push(DPE_LETTERS.indexOf(a));}
      if(b&&a){const g=DPE_LETTERS.indexOf(b)-DPE_LETTERS.indexOf(a);buckets[dpeGainBucket(g)]++;if(g<0)degraded.push({op,code:projectCode(op),before:b,after:a});}
    });
    const medLetter=list=>{if(!list.length)return '';const sorted=[...list].sort((x,y)=>x-y);return DPE_LETTERS[sorted[Math.floor((sorted.length-1)/2)]];};
    return {before,after,beforeCount:bl.length,afterCount:al.length,pairs:Object.values(buckets).reduce((s,v)=>s+v,0),buckets,degraded,medianBefore:medLetter(bl),medianAfter:medLetter(al)};
  }

  // ---- V6.52 : menuiseries extérieures (textes libres → familles) -----------------------------
  const WINDOW_OTHER=['Non renseigné','Autre'];
  function windowMaterialFamily(value){
    const s=normalize(value); if(!s) return 'Non renseigné';
    const found=[]; if(/\bpvc\b/.test(s))found.push('PVC'); if(/\bbois\b/.test(s))found.push('Bois'); if(/\balu(minium)?\b/.test(s))found.push('Aluminium'); if(/\b(acier|metal|metallique)\b/.test(s))found.push('Acier');
    if(found.length>1) return 'Matériaux combinés';
    return ['PVC','Bois','Aluminium'].includes(found[0])?found[0]:'Autre';
  }
  function glazingFamily(value){
    const s=normalize(value); if(!s) return 'Non renseigné';
    if(/\btriple\b/.test(s)) return 'Triple vitrage';
    if(/argon|\bar\b/.test(s)) return 'Double vitrage argon';
    if(/\bsimple vitrage\b/.test(s)&&!/double/.test(s)) return 'Simple vitrage';
    return 'Double vitrage';
  }
  function shadingFamily(value){
    const s=normalize(value); if(!s) return 'Non renseigné';
    if(/\b(sans occultation|sans volet|sans fermeture|aucune occultation)\b/.test(s)) return 'Sans occultation';
    const found=[]; if(/roulant/.test(s))found.push('Volets roulants'); if(/persienne|battant/.test(s))found.push('Persiennes / battants'); if(/\bstores?\b|\bbso\b|brise soleil/.test(s))found.push('Stores');
    if(found.length>1) return 'Occultations combinées';
    return found[0]||'Autre';
  }
  // Bandes 100 % + combinaisons exactes, sur les opérations ayant au moins un champ menuiserie.
  function windowComposition(ops,get={}){
    const g={material:get.material||(o=>o.windowMaterial),glazing:get.glazing||(o=>o.windowGlazing),shading:get.shading||(o=>o.windowShading)};
    const filled=(ops||[]).filter(o=>['material','glazing','shading'].some(k=>String(g[k](o)??'').trim()));
    const n=filled.length, fam={material:windowMaterialFamily,glazing:glazingFamily,shading:shadingFamily};
    const band=k=>{const m=new Map();filled.forEach(o=>{const f=fam[k](g[k](o));m.set(f,(m.get(f)||0)+1);});return [...m].map(([name,count])=>({name,count,share:n?100*count/n:null})).sort((a,b)=>(WINDOW_OTHER.includes(a.name)-WINDOW_OTHER.includes(b.name))||b.count-a.count||a.name.localeCompare(b.name,'fr'));};
    const combos=new Map();filled.forEach(o=>{const c=[fam.material(g.material(o)),fam.glazing(g.glazing(o)),fam.shading(g.shading(o))],k=c.join('\u0001');const e=combos.get(k)||{parts:c,count:0};e.count++;combos.set(k,e);});
    const combinations=[...combos.values()].map(e=>({...e,key:e.parts.join('\u0001'),share:n?100*e.count/n:null})).sort((a,b)=>b.count-a.count||a.key.localeCompare(b.key,'fr'));
    return {n,population:(ops||[]).length,material:band('material'),glazing:band('glazing'),shading:band('shading'),combinations};
  }

  // ---- V6.53 : Croiser les données ------------------------------------------------------------
  // Paires pertinentes : [axe X, axe Y]. Pour les paires « seuil », X = seuil, Y = valeur (sous la ligne y = x = sous le seuil).
  const CROSS_PAIRS=[['cepMax','cep'],['bbioMax','bbio'],['ticRef','tic'],['ubatBefore','ubatAfter'],['cepBefore','cepAfter'],['surface','dwellings'],['icEnergy','icConstruction']];
  function crossValue(op,key){if(key==='cepAfter'){const v=rawNumber(op,'cepAfter');return v!==null?v:rawNumber(op,'cep');}return rawNumber(op,key);}
  function crossPoints(ops,x,y){return (ops||[]).map(op=>({op,x:crossValue(op,x),y:crossValue(op,y)})).filter(p=>p.x!==null&&p.y!==null).map(p=>({...p,ratio:p.x?p.y/p.x:null}));}
  function crossMetricCounts(ops,keys){return Object.fromEntries((keys||[]).map(k=>[k,(ops||[]).filter(o=>crossValue(o,k)!==null).length]));}
  function bestCrossPair(ops,pairs=CROSS_PAIRS){let best=null;pairs.forEach(([x,y])=>{const n=crossPoints(ops,x,y).length;if(!best||n>best.n)best={x,y,n};});return best;}
  function isThresholdPair(x,y){return THRESHOLD_PAIRS.some(([v,m])=>(x===m&&y===v)||(x===v&&y===m));}
  // Valeur hors cadre : au-delà du 99e percentile ET franchement aberrante (au-delà de Q3 + 3 × IQR, ou en deçà du 1er percentile et de Q1 − 3 × IQR).
  // Le double critère évite de masquer systématiquement la plus grande valeur d'un petit échantillon sain.
  function robustOutliers(values){
    const v=(values||[]).filter(Number.isFinite).sort((a,b)=>a-b);if(v.length<4)return {lo:v[0]??null,hi:v.at(-1)??null,isOut:()=>false};
    const q1=quantile(v,.25),q3=quantile(v,.75),iqr=q3-q1,p1=quantile(v,.01),p99=quantile(v,.99),hiF=q3+3*iqr,loF=q1-3*iqr;
    const isOut=x=>(x>p99&&x>hiF)||(x<p1&&x<loF);const kept=v.filter(x=>!isOut(x));
    return {lo:kept[0],hi:kept.at(-1),isOut};
  }

  // ---- V6.54 : carte des projets de la Vue d'ensemble -------------------------------------------
  const GEO_MIN_K=5;
  const toNum=v=>{if(v===null||v===undefined||String(v).trim()==='')return null;const n=Number(String(v).replace(',','.').trim());return Number.isFinite(n)?n:null;};
  function validLatLon(lat,lon){return lat!==null&&lon!==null&&lat>40&&lat<55&&lon>-10&&lon<15&&!(lat===0&&lon===0);}
  function validInsee(v){return /^(\d{5}|2[AB]\d{3})$/i.test(String(v??'').trim());}
  // Précise (latitude / longitude valides) → approximative (centre de la commune, code INSEE) → non localisée.
  function geoClass(op){
    const lat=toNum(op?.latitude),lon=toNum(op?.longitude);
    if(validLatLon(lat,lon))return {kind:'precise',lat,lon};
    if(validInsee(op?.insee))return {kind:'commune',insee:String(op.insee).trim().toUpperCase(),department:String(op?.department||'')};
    return {kind:'none'};
  }
  // Mode anonymisé : jamais de coordonnées exactes ni d'adresse (le script et privacy.js les retirent) ; un projet dont la commune
  // est connue est placé au centre de la commune si elle compte au moins 5 projets dans la sélection, sinon au centre du
  // département ; sans commune : non localisé.
  function geoPlan(projects,{anonymized=false}={}){
    if(!anonymized)return (projects||[]).map(op=>({op,...geoClass(op)}));
    const key=op=>`${normalize(op?.city)}|${String(op?.department||'')}`, counts=new Map();
    (projects||[]).forEach(op=>{if(normalize(op?.city)&&op?.department)counts.set(key(op),(counts.get(key(op))||0)+1);});
    return (projects||[]).map(op=>{
      const dep=String(op?.department||'');
      if(!normalize(op?.city)||!dep)return {op,kind:'none'};
      if(counts.get(key(op))>=GEO_MIN_K)return {op,kind:'commune',city:String(op.city).trim(),department:dep};
      return {op,kind:'department',department:dep};
    });
  }
  // Regroupement des points qui se chevauchent (distance en unités de la carte).
  function clusterPoints(points,radius){
    const clusters=[];
    (points||[]).forEach(p=>{const c=clusters.find(c=>Math.hypot(c.x-p.x,c.y-p.y)<=radius);if(c){c.items.push(p);c.x=(c.x*(c.items.length-1)+p.x)/c.items.length;c.y=(c.y*(c.items.length-1)+p.y)/c.items.length;}else clusters.push({x:p.x,y:p.y,items:[p]});});
    return clusters;
  }
  function columnTags(op){
    const out=[],seen=new Set(),add=v=>String(v??'').split(',').map(x=>x.trim()).filter(Boolean).forEach(x=>{const k=normalize(x);if(k&&!seen.has(k)){seen.add(k);out.push(x);}});
    add(op?.tags);const h=op?.fields?.tags;if(h)rows(op).forEach(r=>add(r?.[h]));return out;
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

  window.NEWOSB_CORE={version:'06.13',normalize,number,rawValue,rawNumber,parseValue,unreadableValues,numericKeys:[...NUMERIC_KEYS,...Object.keys(DATE_KEYS)],dateKeys:DATE_KEYS,affairStage,isExcludedOperation,dictionary:DICTIONARY,dictByKey,provenance,coverage,qualityForOperation,qualitySummary,comparableSet,stats,quantile,thresholdMargin,beforeAfterMedian,dpeGain,dpeGainBucket,dpeStaircase,windowMaterialFamily,glazingFamily,shadingFamily,windowComposition,displayCode:projectCode,geoClass,geoPlan,clusterPoints,columnTags,GEO_MIN_K,crossPairs:CROSS_PAIRS,crossValue,crossPoints,crossMetricCounts,bestCrossPair,isThresholdPair,robustOutliers,thresholdPairs:THRESHOLD_PAIRS,DH_DEFAULT_MAX,UBAT_RANGE,carbonThresholds,carbonBand,duplicateSummary,geoIssues};
})();
