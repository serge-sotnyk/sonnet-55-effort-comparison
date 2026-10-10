const vm=require('vm'),fs=require('fs');const c=require('./load.js');
const code=fs.readFileSync(__dirname+'/simtests.js','utf8').split("TT('")[0]+`
world('islands',2,12,{age:1});for(const p of G.players)p.res={f:1500,w:1500,g:1500,s:600};
G.players[0].ai=true;G.players[0].diff=2;G.players[1].diff=2;aiInit();
run(200);
const p=G.players[1];const S=aiSnap(p);
const v=S.vils[0];
let sites=0;const tc=S.tc;for(let y=2;y<G.H-5;y++)for(let x=2;x<G.W-5;x++){const dd=Math.hypot(x+1.5-tc.cx,y+1.5-tc.cy);if(dd>26)continue;if(regionAt(x+1,y+1)!==regionAt(v.x,v.y))continue;if(footprintOK('dock',x,y,1)==='')sites++}
JSON.stringify({needNavy:p.A.needNavy,age:p.age,res:p.res,bc:S.bc,building:S.building,sites,vils:S.vils.length,wsize:G.wsize.slice(0,5),tc:[tc.cx,tc.cy],canDock:canBuildType(p,'dock')})
`;
console.log(vm.runInContext(code,c));
