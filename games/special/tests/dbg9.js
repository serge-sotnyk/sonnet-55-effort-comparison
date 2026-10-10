const vm=require('vm'),fs=require('fs');const c=require('./load.js');
const code=fs.readFileSync(__dirname+'/simtests.js','utf8').split("TT('")[0]+`
world('arabia',2,1);const a=G.players[0].start,b=G.players[1].start;
const r=findPath(a.x,a.y,(x,y)=>Math.hypot(x+.5-b.x,y+.5-b.y)<3,b.x,b.y,0,false,false,30000);
// flood from a
const W=G.W;const seen=new Uint8Array(W*G.H);const q=[Math.floor(a.y)*W+Math.floor(a.x)];seen[q[0]]=1;
for(let h=0;h<q.length;h++){const i=q[h],x=i%W,y=(i/W)|0;for(let d=0;d<8;d++){const X=x+DX8[d],Y=y+DY8[d];if(X<0||Y<0||X>=W||Y>=G.H)continue;const j=Y*W+X;if(seen[j]||!tilePass(X,Y,0,false,false)||Math.abs(G.hgt[j]-G.hgt[i])>=2)continue;seen[j]=1;q.push(j)}}
JSON.stringify({ok:r.ok,len:r.path.length,reach:q.length,startBlocked:!tilePass(Math.floor(a.x),Math.floor(a.y),0,false,false),a,b,last:r.path[r.path.length-1]})
`;
console.log(vm.runInContext(code,c));
