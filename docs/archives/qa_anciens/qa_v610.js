'use strict';
// Run from the release directory with: node qa_v610.js
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const js=fs.readFileSync('newosb.js','utf8'),html=fs.readFileSync('index.html','utf8'),css=fs.readFileSync('project-ux.css','utf8');
let checks=0;
function test(label,fn){fn();checks++;console.log('PASS '+label);}
function fn(name){const from=js.indexOf('  function '+name+'(');assert(from>=0,'Missing '+name);const to=js.indexOf('\n  function ',from+1);return js.slice(from,to<0?undefined:to);}
const ctx={rawValue:(o,k)=>o?.[k]??''};
vm.createContext(ctx);
vm.runInContext(['projectUxText','projectUxValue','projectUxNumericValue','projectUxNumber','projectUxLetter','projectUxCep','projectUxGain'].map(fn).join('\n'),ctx);
test('V6.10 entry point and explicit stylesheet',()=>{assert(html.includes('V6.10'));assert(html.includes('project-ux.css?v=6.10.0'));assert(html.includes('newosb.js?v=6.10.0'));});
test('Presentation directly above dictionary, only one entry',()=>{const pages=Array.from(html.matchAll(/<button[^>]*data-page="([^"]+)"/g),m=>m[1]);assert.equal(pages[pages.indexOf('dictionary')-1],'presentation');assert.equal(pages.filter(x=>x==='presentation').length,1);});
test('Five project rubrics retained',()=>{for(const key of ['general','building','energy','carbon','economics'])assert(js.includes("['"+key+"',"));});
test('Missing numerical values are not zero',()=>{for(const v of [null,undefined,'','  ','Non renseigne','NaN'])assert.strictEqual(ctx.projectUxNumericValue(v),null);});
test('Zero is valid',()=>{assert.strictEqual(ctx.projectUxNumericValue('0'),0);assert.strictEqual(ctx.projectUxNumericValue(0),0);});
test('French decimals and single-valued units',()=>{assert.equal(ctx.projectUxNumericValue('3,15'),3.15);assert.equal(ctx.projectUxNumericValue('68 kWhEP/m\u00b2.an'),68);assert.equal(ctx.projectUxNumericValue('1\u202f200,5'),1200.5);});
test('Several R values are never combined into one number',()=>{assert.strictEqual(ctx.projectUxNumericValue('7,00 / 6,85'),null);assert.strictEqual(ctx.projectUxNumericValue('3,15 \u00e0 4,50'),null);});
test('Selected raw row overrides inherited values, even when blank',()=>{const o={fields:{cep:'CEP'},raw:{CEP:''},cep:999};assert.equal(ctx.projectUxValue(o,'cep'),'');assert.strictEqual(ctx.projectUxNumber(o,'cep'),null);o.raw.CEP='0';assert.strictEqual(ctx.projectUxNumber(o,'cep'),0);});
test('Gain formula and absent/zero baseline',()=>{assert.equal(ctx.projectUxGain({cepBefore:200,cepAfter:80}),60);assert.equal(ctx.projectUxGain({cepBefore:100,cepAfter:0}),100);assert.strictEqual(ctx.projectUxGain({cepBefore:0,cepAfter:100}),null);assert.strictEqual(ctx.projectUxGain({cepAfter:100}),null);});
test('DPE reads an explicit class, not an arbitrary letter',()=>{assert.equal(ctx.projectUxLetter({dpe:'D'},'dpe'),'D');assert.equal(ctx.projectUxLetter({dpe:'Classe B'},'dpe'),'B');assert.equal(ctx.projectUxLetter({dpe:'Non renseign\u00e9'},'dpe'),'');assert.equal(ctx.projectUxLetter({dpe:'Double vitrage'},'dpe'),'');});
test('Modal keyboard support, source access and independent scroll',()=>{assert(js.includes('aria-modal="true"'));assert(js.includes('projectUxRestoreFocus'));assert(js.includes('data-project-building-select'));assert(css.includes('overscroll-behavior:contain'));});
test('No fabricated score or window percentage in new overview',()=>{const code=fn('projectGeneralHtml');assert(!code.includes('Score global'));assert(js.includes('Aucune r\\u00e9partition en % sans quantit\\u00e9s'));});
test('V6.9.1 JSON guards kept',()=>{const a=fs.readFileSync('app.js','utf8');assert(a.includes('state.presentation.instanceData[tabId] = deepMerge(clone(defaults[type]), clone(existing));'));assert(a.includes('model.r=clone(defaults.envelope?.r'));assert(a.includes("if(type==='dpe')"));assert(a.includes("if(type==='equipments')"));});
console.log(checks+' V6.10 checks passed.');
