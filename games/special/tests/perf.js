const vm=require('vm'),fs=require('fs');const c=require('./load.js');
const code=fs.readFileSync(__dirname+'/simtests.js','utf8').split("TT('")[0]+`
world('arabia',4,8,{age:0,size:100});for(const p of G.players)p.res={f:200,w:200,g:100,s:200};
for(const p of G.players)p.ai=true;aiInit();
const t0=Date.now();let worst=0;const log=[];
for(let t=0;t<1200;t+=200){const a=Date.now();for(let i=0;i<2000;i++){const s=Date.now();stepGame(0.1);worst=Math.max(worst,Date.now()-s)}log.push([G.time|0,(Date.now()-a)+'ms/200s',G.units.length+' units',G.players.map(p=>p.age+':'+p.pop).join(' ')].join(' '))}
log.join('\\n')+'\\nworst tick '+worst+'ms total '+(Date.now()-t0)+'ms'
`;
console.log(vm.runInContext(code,c));
