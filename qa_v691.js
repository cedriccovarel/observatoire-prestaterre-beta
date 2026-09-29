'use strict';
const fs=require('fs');
const html=fs.readFileSync('index.html','utf8');
const app=fs.readFileSync('app.js','utf8');
function assert(x,msg){if(!x)throw new Error(msg);console.log('OK - '+msg)}
assert(html.includes('V6.9.1'),'version V6.9.1 displayed');
assert(html.includes('app.js?v=29.7.15-newosb6.9.1'),'app.js cache-busting updated');
assert(html.includes('newosb.css?v=6.9.1')&&html.includes('newosb.js?v=6.9.1'),'V6.9.1 assets cache-busting updated');
assert(app.includes("state.presentation.instanceData[tabId] = deepMerge(clone(defaults[type]), clone(existing));"),'old instance data is remigrated');
assert(app.includes("if(type==='envelope')"),'envelope import guard present');
assert(app.includes("model.r=clone(defaults.envelope?.r"),'envelope.r repair present');
assert(app.includes("if(type==='dpe')"),'DPE import guard present');
assert(app.includes("if(type==='equipments')"),'equipment metrics guard present');
console.log('QA V6.9.1 completed');
