const vm=require('vm'),fs=require('fs');const c=require('./load.js');
const code=fs.readFileSync(__dirname+'/simtests.js','utf8').split("TT('")[0]+`
world('islands',2,12,{age:2});for(const p of G.players)p.res={f:3000,w:3000,g:3000,s:550};
const p=G.players[0];G.players[0].ai=true;aiInit();
const dockSite=(()=>{let best=null,bd=1e9;for(let y=2;y<G.H-5;y++)for(let x=2;x<G.W-5;x++){if(footprintOK('dock',x,y,0)!=='')continue;const d=Math.hypot(x-p.start.x,y-p.start.y);if(d<bd){bd=d;best=[x,y]}}return best})();
const dk=mkBld('dock',0,dockSite[0],dockSite[1],true);
const tr=[];for(let i=0;i<2;i++){const ex=exitPoint(dk,true);tr.push(mkUnit('transport',0,ex.x,ex.y))}
const tc=G.blds.find(b=>b.owner===0&&b.type==='towncenter');
for(let i=0;i<14;i++){const q=freeNear(tc.cx,tc.cy,4,9);mkUnit('militia',0,q.x,q.y)}
const S=aiSnap(p);aiStartInvasion(p,S);
const log=[];run(40);log.push(JSON.stringify(p.A.inv.troops.map(id=>{const u=G.byId.get(id);return [u.t,u.x|0,u.y|0,u.path?u.path.length:-1,u.pathFail>G.time?1:0]}))+' dock '+dk.x+','+dk.y+' ships '+tr.map(s=>[s.x,s.y]));
for(let t=0;t<300;t+=15){run(15);const inv=p.A.inv;log.push([G.time|0,inv?inv.phase:'none',tr.map(s=>s.cargo.length+'@'+(s.x|0)+','+(s.y|0)+':'+s.t).join(' '),G.units.filter(u=>!u.dead&&u.owner===0&&u.type==='militia'&&regionAt(u.x,u.y)!==regionAt(p.start.x,p.start.y)&&regionAt(u.x,u.y)>0).length].join(' '))}
log.join('\\n')
`;
console.log(vm.runInContext(code,c));
