'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const js=fs.readFileSync('app.js','utf8');
const headers=JSON.parse(fs.readFileSync('../headers_2026_09_30.json','utf8'));
const start=js.indexOf('  const DATA_FIELD_ALIASES = {');
const bodyStart=js.indexOf('{',start);
const end=js.indexOf('\n  };',bodyStart);
assert(start>=0&&bodyStart>=0&&end>bodyStart,'DATA_FIELD_ALIASES introuvable');
const aliases=vm.runInNewContext('('+js.slice(bodyStart,end+4)+')');
function norm(v){return String(v??'').replace(/&lt;br\s*\/?\s*&gt;/gi,' ').replace(/<br\s*\/?\s*>/gi,' ').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’']/g,"'").replace(/\s+/g,' ').trim();}
function resolve(headers,aa,fieldKey){
 const hh=headers.map(norm), al=(aa||[]).map(norm).filter(Boolean);
 for(const a of al){const i=hh.findIndex(h=>h===a);if(i>=0)return i;}
 let best=-1,bestScore=-Infinity;
 al.forEach(a=>hh.forEach((h,i)=>{if(!h.includes(a))return;let score=(a.length*20)-Math.max(0,h.length-a.length);if(h.startsWith(a)||h.endsWith(a))score+=30;if(fieldKey==='moa'){if(/secteur d'activite|secteur activite|hierarchie/.test(h))score-=100000;if(/groupe principal/.test(h))score-=5000;if(/nom de la societe/.test(h))score+=10000;else if(/societe principale/.test(h)&&/\bnom\b/.test(h))score+=7000;else if(/\bnom\b/.test(h))score+=3000;}if(score>bestScore){bestScore=score;best=i;}}));
 return best;
}
const fields={};for(const [k,a] of Object.entries(aliases)){const i=resolve(headers,a,k);fields[k]=i>=0?headers[i]:null;}
const expected={
 code:'Opération: Code interne',name:"Nom de l'opération",region:"Région de l'opération",department:"Département de l'opération",referential:'Référentiel',version:'Version',moa:'Nom de la société: Nom de la société',moaGroup:'Nom de la société: Groupe principal Nom',moaType:"Nom de la société: Secteur d'activité",affairStage:'Statut',status:'Opération: Évaluation: Statut',mentions:'Opération: Mentions',performance:'Opération: Performance',profile:'Opération: Profil choisi',constructionYear:'Année',certificationApDate:'Certification: Date de décision AP',certificationCdDate:'Certification: Date de décision CD'
};
let checks=0;
for(const [k,v] of Object.entries(expected)){assert.strictEqual(fields[k],v,`${k}: attendu ${v}, obtenu ${fields[k]}`);checks++;}
for(const k of ['heatingBefore','heatingAfter','ecsBefore','ecsAfter','structure','roofInsulation','wallInsulation','floorInsulation','windowMaterial','dh','tic','bbio','cep','cepnr','ubatBefore','ubatAfter','icEnergy','icConstruction','dpeEnergyBefore','dpeEnergyAfter','dpeGesBefore','dpeGesAfter']){assert(fields[k],`${k} non reconnu`);checks++;}
console.log(checks+' contrôles V6.11 en-têtes OK');
console.log(JSON.stringify(Object.fromEntries(Object.keys(expected).map(k=>[k,fields[k]])),null,2));
