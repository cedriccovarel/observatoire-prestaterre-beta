'use strict';
global.window=global;
require('./newosb-core.js');
const c=global.NEWOSB_CORE;
let failures=0;
function test(name,fn){try{fn();console.log('PASS',name);}catch(e){failures++;console.error('FAIL',name,'-',e.message);}}
function eq(a,b,msg=''){if(a!==b)throw new Error(`${msg} attendu=${b} obtenu=${a}`)}
function ok(v,msg='condition fausse'){if(!v)throw new Error(msg)}
const mkStage=s=>({affairStage:s,fields:{},raw:{}});
['Abandonné','abandonnée','PERDU','Affaire perdue','Projet abandonné','Annulée'].forEach(v=>test(`exclusion ${v}`,()=>eq(c.isExcludedOperation(mkStage(v)),true)));
test('En cours reste actif',()=>eq(c.isExcludedOperation(mkStage('En cours')),false));
test('normalisation br identique',()=>eq(c.normalize('BBCA<br>Standard V4.1'),c.normalize('BBCA Standard V4.1')));
test('normalisation br encode identique',()=>eq(c.normalize('BBCA&lt;br&gt;Standard V4.1'),c.normalize('BBCA Standard V4.1')));
const ops=[
 {code:'A',name:'A',moa:'MOA',department:'33',referential:'BEE',nature:'Neuf',year:2026,dwellings:20,buildings:1,fields:{cep:'CEP'},raw:{CEP:'100'}},
 {code:'B',name:'B',moa:'MOA',department:'33',referential:'BEE',nature:'Neuf',year:2026,dwellings:22,buildings:1,fields:{cep:'CEP'},raw:{CEP:'120'}},
 {code:'C',name:'C',moa:'MOA',department:'31',referential:'BEE',nature:'Neuf',year:2025,dwellings:24,buildings:1,fields:{cep:'CEP'},raw:{CEP:''}}
];
test('couverture CEP 2/3',()=>{const x=c.coverage(ops,'cep');eq(x.available,2);eq(x.population,3);ok(Math.abs(x.rate-66.666)<.1)});
test('stats médiane',()=>{const x=c.stats(ops,'cep');eq(x.n,2);eq(x.median,110)});
test('comparables privilégient même référentiel/nature',()=>ok(c.comparableSet(ops[0],ops).length>=1));
test('qualité détecte seuil dépassé',()=>{const op={code:'Q',name:'Q',moa:'M',department:'33',referential:'BEE',fields:{cep:'CEP',cepMax:'CEPMAX'},raw:{CEP:'150',CEPMAX:'100'}};ok(c.qualityForOperation(op).issues.some(i=>i.code==='threshold:cep'));});
test('dictionnaire documente CEP',()=>ok(c.dictByKey.cep&&c.dictByKey.cep.unit));
if(failures){console.error(`\n${failures} échec(s)`);process.exit(1);}else console.log('\nTous les tests V05.29 passent.');
