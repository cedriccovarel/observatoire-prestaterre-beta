'use strict';
const fs=require('fs');
const html=fs.readFileSync('index.html','utf8');
const js=fs.readFileSync('newosb.js','utf8');
const css=fs.readFileSync('newosb.css','utf8');
function assert(x,msg){if(!x)throw new Error(msg);console.log('OK - '+msg)}
assert(html.includes('V6.9'),'version V6.9 displayed');
assert(html.includes('newosb.css?v=6.9.0')&&html.includes('newosb.js?v=6.9.0'),'V6.9 cache forced');
assert(!js.includes("technicalCard('Famille chauffage'"),'heating family card removed');
assert(!js.includes("technicalCard('Famille ECS'"),'ECS family card removed');
assert(js.includes("technicalCard('Vecteur chauffage'")&&js.includes("technicalCard('Vecteur ECS'"),'heating and ECS vector cards kept');
assert(css.includes('.obs-window-distributions .obs-pie-layout{display:flex;flex-direction:column'),'window pie layout optimized');
assert(css.includes('.obs-systems-grid{grid-template-columns:repeat(2'),'systems grid adapted to four cards');
console.log('QA V6.9 completed');
