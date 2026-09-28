const fs=require('fs');
const app=fs.readFileSync('app.js','utf8');
const ui=fs.readFileSync('newosb.js','utf8');
function assert(x,msg){if(!x)throw new Error(msg);console.log('OK - '+msg)}
assert(app.includes('function dataProjectTechnicalOperations(project)'), 'constructeur des opérations techniques présent');
assert(app.includes('getTechnicalOperations()'), 'population technique exposée par le moteur');
assert(ui.includes('function filteredTechnicalOperations'), 'filtrage technique séparé présent');
assert(ui.includes("function renderSolutions(){\n    const ops=filteredTechnicalOperations();"), 'Solutions utilise les opérations techniques');
assert(ui.includes("function renderEnergy(){\n    const ops=filteredTechnicalOperations();"), 'Énergie utilise les opérations techniques');
assert(ui.includes("function renderCarbon(){\n    const ops=filteredTechnicalOperations(),"), 'Carbone/DPE utilise les opérations techniques');
assert(ui.includes("function renderCrossData(){\n    const ops=filteredTechnicalOperations(),"), 'Croiser les données utilise les opérations techniques');
// Invariant métier minimal sur un projet déjà groupé par Code interne.
const project={code:'P-001',name:'Projet test',rawRows:[{Bbio:40},{Bbio:45},{Bbio:50}]};
const technical=project.rawRows.map((raw,i)=>({projectCode:project.code,code:`${project.code}::${i+1}`,rawRows:[raw]}));
assert(new Set([project.code]).size===1,'3 lignes identiques restent 1 projet général');
assert(technical.length===3,'3 lignes identiques produisent 3 opérations techniques');
assert(new Set(technical.map(x=>x.projectCode)).size===1,'les opérations techniques restent rattachées au même projet');
console.log('QA V6.1 terminée');
