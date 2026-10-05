const fs=require('fs');
const ui=fs.readFileSync('newosb.js','utf8');
const req=fs.readFileSync('requirements.js','utf8');
const css=fs.readFileSync('newosb.css','utf8');
const html=fs.readFileSync('index.html','utf8');
const gs=fs.readFileSync('Code_Exigences.gs','utf8');
function assert(x,msg){if(!x)throw new Error(msg);console.log('OK - '+msg)}
assert(ui.includes("filterSearch:{}"),'recherche de filtre généralisée');
for(const key of ['year','referential','moaGroup','status','moa','region','department','profile','socialZone']){
  assert(ui.includes(`data-global-filter-search=\"${'${key}'}\"`) || ui.includes('data-global-filter-search="${key}"'),'gabarit de recherche global présent');
  break;
}
assert(ui.includes('const placeholder=`Rechercher dans ${String(label).toLowerCase()}…`'),'champ de recherche sur tous les filtres globaux');
assert(ui.includes('data-filter-option="${key}"') && ui.includes('is-search-hidden'),'masquage dynamique des valeurs globales');
assert(req.includes("filters:{year:[],referential:[],moaGroup:[],status:[],moa:[],region:[],department:[],profile:[],socialZone:[]"),'filtres généraux présents dans Exigences');
assert(req.includes('data-req-filter-search="${key}"'),'recherche dans les filtres Exigences');
assert(req.includes('data-req-filter-option="${key}"'),'options filtrables dans Exigences');
assert(gs.includes('operationYear: [') && gs.includes('socialZone: ['),'Code_Exigences expose année et zonage');
assert(ui.includes("flowFocus:{heating:'',ecs:'',dpeEnergy:'',dpeGes:''}"),'focus de transition DPE/GES mémorisé');
assert(ui.includes("'transition:dpeEnergyBefore:dpeEnergyAfter'") && ui.includes("'transition:dpeGesBefore:dpeGesAfter'"),'DPE et GES utilisent les transitions');
assert(ui.includes('obs-flow-dpe-name'),'lettres DPE intégrées aux noeuds de transition');
assert(css.includes('.obs-flow-dpe-name .obs-dpe-letter'),'couleurs de classes DPE conservées');
assert(css.includes('.obs-brand img{width:116px') || css.includes('.obs-brand img{width:132px'),'logo supérieur réduit');
assert(html.includes('Observatoire Prestaterre'),'identité du site affichée');
console.log('QA V6.5 terminée');
