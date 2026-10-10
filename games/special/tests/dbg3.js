const vm=require('vm'),fs=require('fs');const c=require('./load.js');
const code=fs.readFileSync(__dirname+'/simtests.js','utf8').split("TT('")[0]+`
world('islands',2,12,{size:64});const p=G.players[0];
const dockSite=(()=>{let best=null,bd=1e9;for(let y=2;y<G.H-5;y++)for(let x=2;x<G.W-5;x++){if(footprintOK('dock',x,y,0)!=='')continue;const d=Math.hypot(x-p.start.x,y-p.start.y);if(d<bd){bd=d;best=[x,y]}}return best})();
const dk=mkBld('dock',0,dockSite[0],dockSite[1],true);
const ex=exitPoint(dk,true);const ship=mkUnit('transport',0,ex.x,ex.y);
const sold=[];for(let i=0;i<5;i++){const q=freeNear(dk.cx,dk.cy,3,6);sold.push(mkUnit('militia',0,q.x,q.y))}
for(const s of sold)setCmd(s,'board',ship);run(20);
const e=G.players[1].start;const enReg=regionAt(e.x,e.y);
let land=null,bd=1e9;for(let y=1;y<G.H-1;y++)for(let x=1;x<G.W-1;x++){if(G.region[y*G.W+x]!==enReg||G.occ[y*G.W+x])continue;const d=Math.hypot(x-e.x,y-e.y);if(d<bd&&d>8){let w=false;for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]])if(G.terr[(y+dy)*G.W+x+dx]>=3)w=true;if(w){bd=d;land=[x,y]}}}
orderMove(ship,land[0]+.5,land[1]+.5);
let out=[];for(let i=0;i<30;i++){run(5);out.push([ship.t,ship.gs,Math.round(ship.x),Math.round(ship.y),ship.path?ship.path.length:-1,ship.dock?ship.dock.join('/'):'',ship.cargo.length].join(','))}
JSON.stringify({land,out:out})
`;
console.log(vm.runInContext(code,c));
