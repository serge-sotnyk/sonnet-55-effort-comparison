const c=require('./load.js');
const run=(s)=>vm.runInContext(s,c);const vm=require('vm');
const out=run(`
const md=genMap({type:'arabia',size:64,seed:3,np:2});
const settings={players:[{name:'Me',civ:'britons',color:'#2f6fe0',team:0},{name:'AI',civ:'franks',color:'#d83a3a',team:1,ai:true,diff:1}],res:{f:200,w:200,g:100,s:200},speed:1,startAge:0,visibility:'normal',cheats:true};
newGame(settings,md);
const me=G.players[0];
const vils=G.units.filter(u=>u.owner===0&&u.type==='villager');
const tree=findResNear(vils[0].x,vils[0].y,e=>e.res==='w',20);
orderGather(vils[0],tree);
const sheep=G.units.filter(u=>u.type==='sheep'&&u.owner===0).length;
const berry=findResNear(vils[1].x,vils[1].y,e=>e.type==='berries',20);
// build mill
const spot=freeNear(me.start.x,me.start.y,5,9);
let r=placeBuilding(me,'house',Math.floor(spot.x),Math.floor(spot.y),[vils[2],vils[3]]);
for(let i=0;i<600;i++)stepGame(0.1);
JSON.stringify({time:G.time,wood:me.res.w,house:r.err||r.b.built,sheepOwned:G.units.filter(u=>u.type==='sheep'&&u.owner===0).length,units:G.units.length,popCap:me.popCap,v0:vils[0].t+':'+vils[0].gs})
`);
console.log(out);
