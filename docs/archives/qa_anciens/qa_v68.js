const fs=require('fs');
const html=fs.readFileSync('index.html','utf8');
const js=fs.readFileSync('newosb.js','utf8');
const css=fs.readFileSync('newosb.css','utf8');
function assert(x,msg){if(!x)throw new Error(msg);console.log('OK - '+msg)}
assert(html.includes('<title>Observatoire Prestaterre — V6.8</title>'),'version V6.8 affichee');
assert(html.includes('newosb.css?v=6.8.0')&&html.includes('newosb.js?v=6.8.0'),'cache V6.8 force');
assert(js.includes('function vectorColor(value)'),'palette vecteurs presente');
for(const v of ['Gaz','Électricité','RCU','PAC','Bois / biomasse']) assert(js.includes(v),'vecteur '+v+' pris en charge');
assert(js.includes("['building','2. Bâtiment & équipements']"),'onglet Batiment & equipements present');
assert(js.includes('Analyse du système constructif & enveloppe'),'analyse enveloppe projet presente');
assert(js.includes('Équipements techniques & consommations CEP associées'),'equipements CVC et CEP presents');
assert(js.includes('projectValueGauge'),'jauges carbone projet presentes');
assert(css.includes('.obs-solutions-grid{grid-template-columns:repeat(3'),'grille solutions 3 colonnes sur grand ecran');
assert(css.includes('.obs-project-system-grid'),'grille equipements projet presente');
console.log('QA V6.8 terminee');
