const vm=require('vm'),fs=require('fs');const c=require('./load.js');
const code=fs.readFileSync(__dirname+'/simtests.js','utf8').split("TT('")[0]+`
world('islands',2,12,{size:64});const p=G.players[0];
const dockSite=(()=>{let best=null,bd=1e9;for(let y=2;y<G.H-5;y++)for(let x=2;x<G.W-5;x++){if(footprintOK('dock',x,y,0)!=='')continue;const d=Math.hypot(x-p.start.x,y-p.start.y);if(d<bd){bd=d;best=[x,y]}}return best})();
const dk=mkBld('dock',0,dockSite[0],dockSite[1],true);
const ex=exitPoint(dk,true);const ship=mkUnit('transport',0,ex.x,ex.y);
const sold=[];for(let i=0;i<5;i++){const q=freeNear(dk.cx,dk.cy,3,6);sold.push(mkUnit('militia',0,q.x,q.y))}
for(const s of sold)setCmd(s,'board',ship);
let out=[];for(let i=0;i<30;i++){stepGame(0.5);out.push(sold.map(s=>s.t+':'+Math.round(Math.hypot(s.x-ship.x,s.y-ship.y)*10)/10+(s.inside?'I':'')).join(' '))}
JSON.stringify({ship:[ship.x,ship.y],dock:[dk.x,dk.y],out:out.slice(0,6),last:out[out.length-1]})
`;
console.log(vm.runInContext(code,c));
