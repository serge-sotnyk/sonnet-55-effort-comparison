const vm=require('vm');const c=require('./load.js');
const type=process.argv[2]||'arabia',secs=+process.argv[3]||600;
const out=vm.runInContext(`
const md=genMap({type:'${type}',size:64,seed:7,np:3});
const settings={players:[{name:'Me',civ:'britons',color:'#2f6fe0',team:0},{name:'AI1',civ:'franks',color:'#d83a3a',team:1,ai:true,diff:2},{name:'AI2',civ:'mongols',color:'#2fa84f',team:2,ai:true,diff:2}],res:{f:200,w:200,g:100,s:200},speed:1,startAge:0,visibility:'normal',cheats:true};
newGame(settings,md);aiInit();
const errs=[];const oe=console.error;console.error=(...a)=>{errs.push(a.join(' ').slice(0,200))};
for(let i=0;i<${secs}*10;i++){stepGame(0.1);if(i%600==0){}}
const rep=G.players.map(p=>({n:p.name,age:p.age,pop:p.pop,cap:p.popCap,res:Object.values(p.res).map(Math.floor).join('/'),vils:G.units.filter(u=>!u.dead&&u.owner===p.id&&u.type==='villager').length,army:G.units.filter(u=>!u.dead&&u.owner===p.id&&u.def.atk>0&&u.type!=='villager').length,blds:G.blds.filter(b=>!b.dead&&b.owner===p.id).map(b=>b.type[0]+b.type[1]).join(','),alive:p.alive}));
JSON.stringify({t:G.time,over:G.over,errs:errs.slice(0,5),rep},null,0)
`,c);console.log(out);
