'use strict';
// ===== Isometric building sprites (cached per type/civ/age/colour) =====
const BCACHE={};
function bstyle(civ,age){
  const cs=CIVS[civ].style;
  if(age===0)return{wall:'#a8885c',roof:'#cfae52',trim:'#6a4a2a',kind:'wood',age,thatch:true};
  if(age===1)return{wall:cs.wall,roof:cs.roof,trim:cs.trim,kind:'plaster',age};
  if(age===2)return{wall:shade(cs.wall,-.12),roof:shade(cs.roof,-.15),trim:cs.trim,kind:'stone',age};
  return{wall:shade(cs.wall,.08),roof:shade(cs.roof,.05),trim:'#e0b830',kind:'stone',age,gold:true};
}
function pj(lx,ly,z){return[(lx-ly)*32,(lx+ly)*16-z]}
function face(c,pts,fill,tex,st){
  poly(c,pts,fill,'rgba(30,20,10,0.55)',1);
  // texture lines
  if(tex==='stone'){const n=4;for(let i=1;i<n;i++){const t=i/n;const a=[pts[0][0]+(pts[3][0]-pts[0][0])*t,pts[0][1]+(pts[3][1]-pts[0][1])*t],b=[pts[1][0]+(pts[2][0]-pts[1][0])*t,pts[1][1]+(pts[2][1]-pts[1][1])*t];ln(c,a[0],a[1],b[0],b[1],0.6,'rgba(0,0,0,0.22)');
      // brick offsets
      const m=6;for(let j=1;j<m;j+=1){const u=(j+(i%2)*0.5)/m;if(u>=1)continue;const x1=a[0]+(b[0]-a[0])*u,y1=a[1]+(b[1]-a[1])*u;const t2=(i+1)/n;const a2=[pts[0][0]+(pts[3][0]-pts[0][0])*t2,pts[0][1]+(pts[3][1]-pts[0][1])*t2],b2=[pts[1][0]+(pts[2][0]-pts[1][0])*t2,pts[1][1]+(pts[2][1]-pts[1][1])*t2];if(i<n)ln(c,x1,y1,a2[0]+(b2[0]-a2[0])*u,a2[1]+(b2[1]-a2[1])*u,0.4,'rgba(0,0,0,0.14)')}}}
  else if(tex==='wood'){const n=5;for(let j=1;j<n;j++){const u=j/n;ln(c,pts[0][0]+(pts[1][0]-pts[0][0])*u,pts[0][1]+(pts[1][1]-pts[0][1])*u,pts[3][0]+(pts[2][0]-pts[3][0])*u,pts[3][1]+(pts[2][1]-pts[3][1])*u,0.7,'rgba(50,30,10,0.35)')}}
  else if(tex==='plaster'){ // timber frame
    const f=(u,v)=>[pts[0][0]+(pts[1][0]-pts[0][0])*u+(pts[3][0]-pts[0][0])*v,pts[0][1]+(pts[1][1]-pts[0][1])*u+(pts[3][1]-pts[0][1])*v];
    for(const u of[0.02,0.5,0.98]){const a=f(u,0),b=f(u,1);ln(c,a[0],a[1],b[0],b[1],1.4,st&&st.trim||'#5a3a1a')}
    const a=f(0,0.5),b=f(1,0.5);ln(c,a[0],a[1],b[0],b[1],1.2,st&&st.trim||'#5a3a1a');
    const a1=f(0,0),b1=f(0.5,1);ln(c,a1[0],a1[1],b1[0],b1[1],0.9,st&&st.trim||'#5a3a1a');
  }
}
function fpt(pts,u,v){return[pts[0][0]+(pts[1][0]-pts[0][0])*u+(pts[3][0]-pts[0][0])*v,pts[0][1]+(pts[1][1]-pts[0][1])*u+(pts[3][1]-pts[0][1])*v]}
function blk(c,a,b,cc,d,z0,h,st,o){
  o=o||{};const wall=o.wall||st.wall,tex=o.tex||st.kind;
  // left face (ly=d), right face (lx=b), top
  const L=[pj(a,d,z0),pj(b,d,z0),pj(b,d,z0+h),pj(a,d,z0+h)];
  const R=[pj(b,d,z0),pj(b,cc,z0),pj(b,cc,z0+h),pj(b,d,z0+h)];
  face(c,L,shade(wall,0.04),tex,st);face(c,R,shade(wall,-0.2),tex,st);
  if(!o.noTop){const T=[pj(a,d,z0+h),pj(b,d,z0+h),pj(b,cc,z0+h),pj(a,cc,z0+h)];poly(c,T,shade(o.top||wall,0.12),'rgba(30,20,10,0.5)',1)}
  return{L,R};
}
function door(c,F,u,w,h,col){ // on a face quad
  const p0=fpt(F,u,0),p1=fpt(F,u+w,0),p2=fpt(F,u+w,h),p3=fpt(F,u,h);
  poly(c,[p0,p1,p2,p3],col||'#3a2412','#1a0e06');
  const m=fpt(F,u+w/2,h);c.beginPath();c.moveTo(p3[0],p3[1]);c.quadraticCurveTo(m[0],m[1]-3,p2[0],p2[1]);c.fillStyle=col||'#3a2412';c.fill();
}
function win(c,F,u,v,w,h,lit){
  const p0=fpt(F,u,v),p1=fpt(F,u+w,v),p2=fpt(F,u+w,v+h),p3=fpt(F,u,v+h);
  poly(c,[p0,p1,p2,p3],lit?'#f4d070':'#2a3040','#1a1008');
  const m=fpt(F,u+w/2,v),n=fpt(F,u+w/2,v+h);ln(c,m[0],m[1],n[0],n[1],0.6,'#1a1008');
}
function roofGableX(c,a,b,cc,d,z,rh,st,o){ // ridge along x; visible: slope toward +y, gable end at x=b
  o=o||{};const mid=(cc+d)/2,ov=o.ov===undefined?0.12:o.ov;
  const col=o.col||st.roof;
  const aa=a-ov,bb=b+ov,d2=d+ov;
  // right gable end triangle
  const tri=[pj(b,cc,z),pj(b,d,z),pj(b,mid,z+rh)];
  poly(c,tri,shade(o.wall||st.wall,-.2),'rgba(30,20,10,.6)',1);
  // front slope
  const S=[pj(aa,d2,z-2),pj(bb,d2,z-2),pj(bb,mid,z+rh),pj(aa,mid,z+rh)];
  poly(c,S,shade(col,.02),'rgba(30,20,10,.65)',1);
  const n=Math.max(3,Math.round((b-a)*5));
  for(let i=1;i<n;i++){const t=i/n;const p=[pj(aa+(bb-aa)*t,d2,z-2),pj(aa+(bb-aa)*t,mid,z+rh)];ln(c,p[0][0],p[0][1],p[1][0],p[1][1],0.7,'rgba(0,0,0,.18)')}
  for(let k=1;k<4;k++){const t=k/4;const p=[pj(aa,d2+(mid-d2)*t,z-2+(rh+2)*t),pj(bb,d2+(mid-d2)*t,z-2+(rh+2)*t)];ln(c,p[0][0],p[0][1],p[1][0],p[1][1],0.5,'rgba(0,0,0,.14)')}
  const r1=pj(aa,mid,z+rh),r2=pj(bb,mid,z+rh);ln(c,r1[0],r1[1],r2[0],r2[1],2,shade(col,-.3));
}
function roofGableY(c,a,b,cc,d,z,rh,st,o){ // ridge along y; visible: slope toward +x, gable at ly=d
  o=o||{};const mid=(a+b)/2,ov=o.ov===undefined?0.12:o.ov;const col=o.col||st.roof;
  const cc2=cc-ov,d2=d+ov,b2=b+ov;
  const tri=[pj(a,d,z),pj(b,d,z),pj(mid,d,z+rh)];
  poly(c,tri,shade(o.wall||st.wall,.03),'rgba(30,20,10,.6)',1);
  const S=[pj(b2,d2,z-2),pj(b2,cc2,z-2),pj(mid,cc2,z+rh),pj(mid,d2,z+rh)];
  poly(c,S,shade(col,-.18),'rgba(30,20,10,.65)',1);
  const n=Math.max(3,Math.round((d-cc)*5));
  for(let i=1;i<n;i++){const t=i/n;const y=cc2+(d2-cc2)*t;const p=[pj(b2,y,z-2),pj(mid,y,z+rh)];ln(c,p[0][0],p[0][1],p[1][0],p[1][1],0.7,'rgba(0,0,0,.2)')}
  const r1=pj(mid,cc2,z+rh),r2=pj(mid,d2,z+rh);ln(c,r1[0],r1[1],r2[0],r2[1],2,shade(col,-.4));
}
function roofPyramid(c,a,b,cc,d,z,rh,st,o){
  o=o||{};const mx=(a+b)/2,my=(cc+d)/2,ov=o.ov===undefined?0.12:o.ov;const col=o.col||st.roof;
  const ap=pj(mx,my,z+rh);
  poly(c,[pj(b+ov,cc-ov,z-2),pj(b+ov,d+ov,z-2),ap],shade(col,-.2),'rgba(30,20,10,.65)',1);
  poly(c,[pj(a-ov,d+ov,z-2),pj(b+ov,d+ov,z-2),ap],shade(col,.04),'rgba(30,20,10,.65)',1);
  for(let i=1;i<4;i++){const t=i/4;const p=[pj(a-ov+(b-a+2*ov)*t,d+ov,z-2),ap];ln(c,p[0][0],p[0][1],p[1][0],p[1][1],0.6,'rgba(0,0,0,.2)')}
  return ap;
}
function crenels(c,a,b,cc,d,z,st,n){
  // small merlons on top edges of front (visible) sides
  n=n||Math.max(3,Math.round((b-a)*4));
  for(let i=0;i<n;i++){const t=(i+0.25)/n,t2=(i+0.75)/n;
    const x1=a+(b-a)*t,x2=a+(b-a)*t2;
    blk(c,x1,x2,d-0.12,d,z,5,st,{noTop:false});
  }
  const m=Math.max(3,Math.round((d-cc)*4));
  for(let i=0;i<m;i++){const t=(i+0.25)/m,t2=(i+0.75)/m;const y1=cc+(d-cc)*t,y2=cc+(d-cc)*t2;blk(c,b-0.12,b,y1,y2,z,5,st)}
}
function roundTower(c,x,y,r,z0,h,st,rc,rh,flagCol){
  const[cx,cy]=pj(x,y,z0);const rx=r*45,ry=r*22;
  c.beginPath();c.moveTo(cx-rx,cy);c.lineTo(cx-rx,cy-h);c.ellipse(cx,cy-h,rx,ry,0,Math.PI,0,true);c.lineTo(cx+rx,cy);c.ellipse(cx,cy,rx,ry,0,0,Math.PI,false);c.closePath();
  const g=c.createLinearGradient(cx-rx,0,cx+rx,0);g.addColorStop(0,shade(st.wall,.1));g.addColorStop(.6,shade(st.wall,-.05));g.addColorStop(1,shade(st.wall,-.3));c.fillStyle=g;c.fill();c.strokeStyle='rgba(30,20,10,.6)';c.lineWidth=1;c.stroke();
  for(let i=1;i<4;i++){c.beginPath();c.ellipse(cx,cy-h*i/4,rx,ry,0,0,Math.PI);c.strokeStyle='rgba(0,0,0,.18)';c.stroke()}
  if(rc){ // conical roof
    const top=[cx,cy-h-rh];poly(c,[[cx-rx-3,cy-h],[cx+rx+3,cy-h],top],rc,'rgba(30,20,10,.6)');poly(c,[[cx+rx*.2,cy-h],[cx+rx+3,cy-h],top],shade(rc,-.25));
    ell(c,cx,cy-h,rx+3,ry+1.5,null,'rgba(30,20,10,.6)');
    return top;
  }
  // crenelated top
  c.beginPath();c.ellipse(cx,cy-h,rx,ry,0,0,TAU);c.fillStyle=shade(st.wall,.15);c.fill();c.strokeStyle='rgba(30,20,10,.5)';c.stroke();
  for(let i=0;i<9;i++){const a=i/9*TAU;if(Math.sin(a)<-0.2)continue;const mx=cx+Math.cos(a)*rx,my=cy-h+Math.sin(a)*ry;rect(c,mx-2,my-4,4,5,shade(st.wall,.05),'rgba(30,20,10,.5)')}
  // arrow slits
  for(const k of[-.4,.3]){rect(c,cx+k*rx-.8,cy-h*.6,1.6,6,'#1a1008')}
  return null;
}
function bannerAt(c,x,y,h,col,st){ln(c,x,y,x,y-h,1.6,'#3a2a1a');poly(c,[[x,y-h],[x+11,y-h+2],[x+9,y-h+5],[x+11,y-h+8],[x,y-h+8]],col,'rgba(0,0,0,.6)')}
function shadowFoot(c,sz){const p=[pj(-sz/2,-sz/2,0),pj(sz/2,-sz/2,0),pj(sz/2,sz/2,0),pj(-sz/2,sz/2,0)];poly(c,p,'rgba(60,40,20,0.28)')}
function pavement(c,sz,col){const p=[pj(-sz/2,-sz/2,0),pj(sz/2,-sz/2,0),pj(sz/2,sz/2,0),pj(-sz/2,sz/2,0)];poly(c,p,col||'rgba(120,100,70,.45)')}
// ----- per-building painters (c origin = footprint centre on ground) -----
const BPAINT={
house(c,st,col,o){
  const s=0.8+0;pavement(c,2,'rgba(110,130,70,.3)');
  const h=st.age>=2?17:13;
  blk(c,-.62,.62,-.5,.5,0,h,st);
  const F=[pj(-.62,.5,0),pj(.62,.5,0),pj(.62,.5,h),pj(-.62,.5,h)];
  door(c,F,0.12,0.22,0.6);win(c,F,0.55,0.4,0.22,0.3,st.age>=1);
  const R=[pj(.62,.5,0),pj(.62,-.5,0),pj(.62,-.5,h),pj(.62,.5,h)];win(c,R,0.3,0.4,0.22,0.3,st.age>=1);
  roofGableX(c,-.62,.62,-.5,.5,h,st.age>=2?11:9,st,{});
  if(st.age>=2)blk(c,-.3,-.1,-.2,0,h+4,8,st,{wall:'#8a8a8a'});
  if(st.age>=3)bannerAt(c,...pj(.4,-.3,h+8),10,col,st);
  return{smoke:st.age>=1?pj(-.2,-.1,h+14):null};
},
towncenter(c,st,col,o){
  pavement(c,4,'rgba(130,110,80,.5)');c.scale(1.22,1.22);
  const a=st.age,h=22+a*5;
  // main hall
  blk(c,-1.5,1.3,-1.2,1.3,0,h,st);
  const F=[pj(-1.5,1.3,0),pj(1.3,1.3,0),pj(1.3,1.3,h),pj(-1.5,1.3,h)];
  door(c,F,0.38,0.2,0.5,'#2a180c');win(c,F,0.1,0.45,0.1,0.25,1);win(c,F,0.72,0.45,0.1,0.25,1);
  const R=[pj(1.3,1.3,0),pj(1.3,-1.2,0),pj(1.3,-1.2,h),pj(1.3,1.3,h)];win(c,R,0.2,0.45,0.1,0.25,1);win(c,R,0.65,0.45,0.1,0.25,1);
  if(a>=1){ // second-storey stripe / timber
    ln(c,...pj(-1.5,1.3,h*0.5),...pj(1.3,1.3,h*0.5),1.2,st.trim);ln(c,...pj(1.3,1.3,h*0.5),...pj(1.3,-1.2,h*0.5),1.2,shade(st.trim,-.3))}
  roofGableX(c,-1.5,1.3,-1.2,1.3,h,12+a*3,st,{ov:0.18});
  // central tower
  const tz=h+4;
  if(a>=2){roundTower(c,-1.1,-0.9,0.45,0,h+16,st,st.roof,14);roundTower(c,.95,-0.9,0.4,0,h+10,st,st.roof,12)}
  blk(c,-.45,.45,-.45,.45,h+4,16+a*3,st,{wall:shade(st.wall,.05)});
  roofPyramid(c,-.45,.45,-.45,.45,h+20+a*3,14+a*2,st,{ov:.18});
  const fl=pj(0,0,h+36+a*5);bannerAt(c,fl[0],fl[1],14,col,st);
  // front steps & barrels
  for(let i=0;i<3;i++)rect(c,...pj(0.2+0,1.5+i*0.1,0).map((v,j)=>j?v-i*1.5:v-14),28,2.2,'#a09078','rgba(0,0,0,.4)');
  ell(c,...pj(-1.3,1.7,0),5,2.5,'rgba(0,0,0,.25)');rect(c,...pj(-1.3,1.7,0).map((v,j)=>j?v-8:v-3.5),7,8,'#8a5a2e','#3a2a10');
  return{flag:[fl[0],fl[1]-14],smoke:pj(-1,0,h+10)};
},
mill(c,st,col,o){
  pavement(c,2,'rgba(130,110,60,.35)');
  const h=15;
  blk(c,-.5,.5,-.5,.5,0,h,st,{});
  const F=[pj(-.5,.5,0),pj(.5,.5,0),pj(.5,.5,h),pj(-.5,.5,h)];door(c,F,0.38,0.24,0.5);
  roofPyramid(c,-.5,.5,-.5,.5,h,12,st,{ov:.1});
  // hub for blades (drawn live)
  const hub=pj(.5,.1,h-2);
  return{blades:hub,bladeR:24+st.age*2,col};
},
lumber(c,st,col,o){
  pavement(c,2,'rgba(110,90,50,.3)');
  blk(c,-.8,0.1,-.7,.2,0,10,st,{});
  roofGableX(c,-.8,.1,-.7,.2,10,8,st,{ov:.1});
  // log pile
  for(let i=0;i<3;i++)for(let j=0;j<3-i;j++){const p=pj(.55,.5-i*.0-j*.35,3+i*5);ell(c,p[0]+i*3,p[1]-j*1,6,3,'#a0703a','#4a2a10');ell(c,p[0]+i*3+3,p[1]-j,2,2.4,'#d8b078')}
  const f=pj(-.7,-.5,14);bannerAt(c,f[0],f[1],0,col,st);ln(c,...pj(-.7,-.55,0),...pj(-.7,-.55,22),1.5,'#3a2a1a');poly(c,[...[[0,0],[10,2],[8,5],[10,8],[0,8]].map(q=>[q[0]+pj(-.7,-.55,22)[0],q[1]+pj(-.7,-.55,22)[1]])],col,'rgba(0,0,0,.6)');
  return{};
},
mining(c,st,col,o){
  pavement(c,2,'rgba(100,100,100,.3)');
  blk(c,-.8,.1,-.7,.2,0,10,st,{});
  roofGableX(c,-.8,.1,-.7,.2,10,8,st,{ov:.1});
  // ore pile + cart
  for(let i=0;i<5;i++){const p=pj(.55+((i*37)%5)*.06,.3-i*.18,i%2*3);ell(c,p[0],p[1],4.2,2.6,i%2?'#d9ab20':'#9a9ea6','#444')}
  const cp=pj(.1,.75,0);poly(c,[[cp[0]-6,cp[1]-6],[cp[0]+6,cp[1]-6],[cp[0]+4,cp[1]],[cp[0]-4,cp[1]]],'#6a4a2a','#222');ell(c,cp[0],cp[1]-6,6,1.6,'#d9ab20');ell(c,cp[0]-4,cp[1]+1,2,2,'#222');ell(c,cp[0]+4,cp[1]+1,2,2,'#222');
  const fp=pj(-.7,-.55,0);ln(c,fp[0],fp[1],fp[0],fp[1]-22,1.5,'#3a2a1a');poly(c,[[fp[0],fp[1]-22],[fp[0]+10,fp[1]-20],[fp[0]+8,fp[1]-17],[fp[0]+10,fp[1]-14],[fp[0],fp[1]-14]],col,'rgba(0,0,0,.6)');
  return{};
},
farm(c,st,col,o){return{}}, // drawn live
dock(c,st,col,o){
  // wooden pier on posts
  const sz=3;
  poly(c,[pj(-1.5,-1.5,4),pj(1.5,-1.5,4),pj(1.5,1.5,4),pj(-1.5,1.5,4)],'#8a6a3a','#3a2a14');
  for(let i=-1.4;i<1.5;i+=0.3){const a=pj(i,-1.5,4),b=pj(i,1.5,4);ln(c,a[0],a[1],b[0],b[1],.7,'rgba(40,25,10,.5)')}
  for(const[x,y]of[[-1.4,-1.4],[1.4,-1.4],[-1.4,1.4],[1.4,1.4],[0,1.4],[1.4,0],[-1.4,0],[0,-1.4]]){const p=pj(x,y,4),q=pj(x,y,-4);ln(c,p[0],p[1],q[0],q[1],3,'#4a3018')}
  // shed
  blk(c,-1.2,-0.2,-1.2,-0.1,4,12,st,{});roofGableY(c,-1.2,-.2,-1.2,-.1,16,8,st,{ov:.1});
  // crates, rope coil, barrels
  rect(c,...pj(.5,.6,4).map((v,i)=>i?v-8:v-5),10,8,'#a8783a','#4a2a10');ell(c,...pj(.9,1.0,4),5,2.4,'#c8b080','#6a5a3a');
  const m=pj(1.2,-1.1,4);ln(c,m[0],m[1],m[0],m[1]-24,2,'#3a2a1a');poly(c,[[m[0],m[1]-24],[m[0]+10,m[1]-22],[m[0]+8,m[1]-18],[m[0],m[1]-17]],col,'#222');
  return{pier:1};
},
market(c,st,col,o){
  pavement(c,3,'rgba(150,130,90,.5)');
  // stalls with striped awnings
  for(const[x,y,cc]of[[-.8,-.6,col],[.5,-.6,'#e8d8a8'],[-.8,.5,'#e8d8a8'],[.5,.5,col]]){
    blk(c,x-.38,x+.38,y-.3,y+.3,0,7,st,{wall:'#8a5a2e',tex:'wood'});
    for(let i=0;i<5;i++){const t=i/5,t2=(i+1)/5;const a=pj(x-.5+t,y+.45,12),b=pj(x-.5+t2,y+.45,12),b2=pj(x-.5+t2,y-.1,17),a2=pj(x-.5+t,y-.1,17);poly(c,[a,b,b2,a2],i%2?'#f4ecd8':cc,'rgba(0,0,0,.4)')}
    for(let k=0;k<3;k++){const p=pj(x-.2+k*.2,y+.1,7);ell(c,p[0],p[1],2.4,2,['#d33','#d9ab20','#4a9a3a'][k])}
  }
  const t=pj(0,0,0);ln(c,t[0],t[1],t[0],t[1]-28,2,'#3a2a1a');poly(c,[[t[0],t[1]-28],[t[0]+12,t[1]-26],[t[0]+9,t[1]-22],[t[0]+12,t[1]-18],[t[0],t[1]-18]],col,'#222');ell(c,t[0],t[1]-30,3,3,'#d9ab20');
  return{};
},
barracks(c,st,col,o){
  pavement(c,3,'rgba(120,100,70,.4)');const h=16+st.age*2;
  blk(c,-1.2,1.2,-.8,.8,0,h,st,{});
  const F=[pj(-1.2,.8,0),pj(1.2,.8,0),pj(1.2,.8,h),pj(-1.2,.8,h)];door(c,F,0.4,0.2,0.55,'#2a180c');win(c,F,0.12,0.5,0.1,0.25,1);win(c,F,0.78,0.5,0.1,0.25,1);
  roofGableX(c,-1.2,1.2,-.8,.8,h,12,st,{});
  // weapon rack + shields
  const p=pj(1.0,1.2,0);ln(c,p[0]-6,p[1],p[0]-6,p[1]-12,1.6,'#5a3a1a');ln(c,p[0]+6,p[1],p[0]+6,p[1]-12,1.6,'#5a3a1a');ln(c,p[0]-6,p[1]-9,p[0]+6,p[1]-9,1.4,'#5a3a1a');
  for(let i=0;i<4;i++)ln(c,p[0]-4.5+i*3,p[1]-9,p[0]-5.5+i*3,p[1]-19,1,'#bcc0c8');
  for(let i=0;i<3;i++){const q=pj(-.7+i*.7,.85,h-6);ell(c,q[0],q[1],4,4.6,i%2?col:shade(col,.3),'#222')}
  bannerAt(c,...pj(.9,-.6,h+10),14,col,st);
  return{smoke:null};
},
archery(c,st,col,o){
  pavement(c,3,'rgba(120,100,70,.4)');const h=14+st.age*2;
  blk(c,-1.3,.5,-1,1,0,h,st,{});
  const F=[pj(-1.3,1,0),pj(.5,1,0),pj(.5,1,h),pj(-1.3,1,h)];
  door(c,F,.4,.22,.55,'#2a180c');win(c,F,.1,.5,.12,.25,1);
  roofGableX(c,-1.3,.5,-1,1,h,10,st,{});
  // target butts
  for(let i=0;i<2;i++){const p=pj(1,-.3+i*1,0);ln(c,p[0]-5,p[1],p[0]-5,p[1]-9,1.4,'#5a3a1a');ln(c,p[0]+5,p[1],p[0]+5,p[1]-9,1.4,'#5a3a1a');ell(c,p[0],p[1]-12,9,9,'#f0e8c8','#333');ell(c,p[0],p[1]-12,6.5,6.5,'#c33');ell(c,p[0],p[1]-12,4,4,'#f0e8c8');ell(c,p[0],p[1]-12,2,2,'#d9ab20');ln(c,p[0]+2,p[1]-14,p[0]-4,p[1]-9,1,'#ddd')}
  bannerAt(c,...pj(-1,-.8,h+10),14,col,st);return{};
},
stable(c,st,col,o){
  pavement(c,3,'rgba(130,110,60,.4)');const h=14+st.age*2;
  blk(c,-1.3,.7,-.9,.9,0,h,st,{});
  const F=[pj(-1.3,.9,0),pj(.7,.9,0),pj(.7,.9,h),pj(-1.3,.9,h)];
  // big open stall door with hay
  const d0=fpt(F,.3,0),d1=fpt(F,.7,0),d2=fpt(F,.7,.65),d3=fpt(F,.3,.65);poly(c,[d0,d1,d2,d3],'#2a180c','#111');
  const hh=fpt(F,.5,.05);ell(c,hh[0],hh[1],7,3,'#d8b848','#8a6a20');
  roofGableX(c,-1.3,.7,-.9,.9,h,11,st,{});
  // horse head sticking out + hay bale
  const hp=pj(.2,1.0,12);ell(c,hp[0],hp[1],4,5,'#8a5a34','#4a2a10');ell(c,hp[0]+3,hp[1]+4,3,2.4,'#9a6a44');poly(c,[[hp[0]-2,hp[1]-5],[hp[0]-1,hp[1]-9],[hp[0]+1,hp[1]-5]],'#8a5a34');
  rect(c,...pj(1.1,.9,0).map((v,i)=>i?v-8:v-6),12,8,'#d8b848','#8a6a20');ln(c,...pj(1.1,.9,0).map((v,i)=>i?v-4:v-6),...pj(1.1,.9,0).map((v,i)=>i?v-4:v+6),.8,'#8a6a20');
  // fence
  for(let i=0;i<4;i++){const p=pj(-.8+i*.45,1.4,0);ln(c,p[0],p[1],p[0],p[1]-7,1.4,'#5a3a1a')}
  const p1=pj(-.8,1.4,5),p2=pj(.9,1.4,5);ln(c,p1[0],p1[1],p2[0],p2[1],1.2,'#5a3a1a');
  bannerAt(c,...pj(.55,-.8,h+10),14,col,st);return{};
},
smith(c,st,col,o){
  pavement(c,2,'rgba(80,70,60,.4)');const h=13+st.age*2;
  blk(c,-.7,.5,-.6,.6,0,h,st,{});
  const F=[pj(-.7,.6,0),pj(.5,.6,0),pj(.5,.6,h),pj(-.7,.6,h)];door(c,F,.1,.28,.6,'#1a0c06');
  const g=fpt(F,.1,.05);ell(c,g[0]+4,g[1]-4,3,3,'#ff7a20');
  roofGableX(c,-.7,.5,-.6,.6,h,9,st,{});
  blk(c,-.55,-.3,-.5,-.25,h+3,13,st,{wall:'#7a7a7a',tex:'stone'}); // chimney
  // anvil
  const a=pj(.8,.7,0);poly(c,[[a[0]-5,a[1]-6],[a[0]+6,a[1]-6],[a[0]+3,a[1]-3],[a[0]+3,a[1]],[a[0]-3,a[1]],[a[0]-3,a[1]-3]],'#4a4e56','#111');
  ln(c,a[0]-8,a[1]-3,a[0]-5,a[1]-5,1.5,'#555');
  rect(c,a[0]-16,a[1]-6,6,6,'#6a6a70','#222');
  bannerAt(c,...pj(.5,-.5,h+4),12,col,st);
  return{smoke:pj(-.42,-.37,h+16),fire:fpt(F,.14,.1)};
},
monastery(c,st,col,o){
  pavement(c,3,'rgba(150,140,120,.5)');const h=20+st.age*2;
  // nave
  blk(c,-1.3,.7,-.8,.8,0,h,st,{wall:shade(st.wall,.05)});
  const F=[pj(-1.3,.8,0),pj(.7,.8,0),pj(.7,.8,h),pj(-1.3,.8,h)];
  // arched windows
  for(const u of[.12,.3,.58,.78]){const p0=fpt(F,u,.35),p1=fpt(F,u+.08,.35),p2=fpt(F,u+.08,.7),p3=fpt(F,u,.7);poly(c,[p0,p1,p2,p3],'#5a7ab0','#222');const m=fpt(F,u+.04,.8);c.beginPath();c.moveTo(p3[0],p3[1]);c.quadraticCurveTo(m[0],m[1],p2[0],p2[1]);c.fillStyle='#5a7ab0';c.fill();c.stroke()}
  roofGableX(c,-1.3,.7,-.8,.8,h,12,st,{});
  // bell tower
  blk(c,.7,1.3,-.2,.4,0,h+14,st,{wall:shade(st.wall,.08)});
  const TF=[pj(.7,.4,0),pj(1.3,.4,0),pj(1.3,.4,h+14),pj(.7,.4,h+14)];
  const bp=fpt(TF,.3,.75);poly(c,[[bp[0],bp[1]],[bp[0]+10,bp[1]],[bp[0]+10,bp[1]+9],[bp[0],bp[1]+9]],'#1a1008');ell(c,bp[0]+5,bp[1]+5,3,4,'#d9ab20','#8a6a10');
  const ap=roofPyramid(c,.7,1.3,-.2,.4,h+14,18,st,{col:shade(st.roof,-.05),ov:.1});
  // cross
  ln(c,ap[0],ap[1],ap[0],ap[1]-11,1.8,'#e8d070');ln(c,ap[0]-4,ap[1]-7,ap[0]+4,ap[1]-7,1.8,'#e8d070');
  // door w/ cross
  door(c,F,.4,.18,.5,'#3a2010');
  return{};
},
university(c,st,col,o){
  pavement(c,3,'rgba(150,140,120,.5)');const h=18+st.age*2;
  blk(c,-1.3,1.3,-.9,.9,0,h,st,{wall:shade(st.wall,.07)});
  const F=[pj(-1.3,.9,0),pj(1.3,.9,0),pj(1.3,.9,h),pj(-1.3,.9,h)];
  for(let i=0;i<6;i++){const u=.08+i*.16;const a=fpt(F,u,0),b=fpt(F,u,.9);ln(c,a[0],a[1],b[0],b[1],2.4,shade(st.wall,.25))}
  door(c,F,.43,.14,.5,'#2a180c');
  poly(c,[pj(-1.35,.95,h),pj(1.35,.95,h),pj(1.35,.95,h+3),pj(-1.35,.95,h+3)],shade(st.wall,.2),'#444');
  roofGableX(c,-1.3,1.3,-.9,.9,h+2,7,st,{ov:.15});
  // dome
  const d=pj(0,-.1,h+8);c.beginPath();c.ellipse(d[0],d[1],18,8,0,Math.PI,0,true);c.lineTo(d[0]+18,d[1]);c.ellipse(d[0],d[1],18,5,0,0,Math.PI);c.closePath();c.fillStyle=st.gold?'#d9b030':shade(st.roof,.1);c.fill();c.strokeStyle='#333';c.stroke();
  c.beginPath();c.ellipse(d[0],d[1]-8,18,16,0,Math.PI,0);c.fillStyle=st.gold?'#e8c848':shade(st.roof,.15);c.fill();c.stroke();ln(c,d[0],d[1]-16,d[0],d[1]-24,1.6,'#e8d070');ell(c,d[0],d[1]-25,2,2,'#e8d070');
  bannerAt(c,...pj(1.0,-.7,h+8),12,col,st);return{};
},
siegews(c,st,col,o){
  pavement(c,3,'rgba(120,100,70,.4)');const h=15+st.age*2;
  blk(c,-1.2,.6,-.9,.9,0,h,st,{wall:shade(st.wall,-.06),tex:'wood'});
  const F=[pj(-1.2,.9,0),pj(.6,.9,0),pj(.6,.9,h),pj(-1.2,.9,h)];
  const d0=fpt(F,.25,0),d1=fpt(F,.75,0),d2=fpt(F,.75,.7),d3=fpt(F,.25,.7);poly(c,[d0,d1,d2,d3],'#2a180c','#111');
  roofGableX(c,-1.2,.6,-.9,.9,h,10,st,{});
  // crane / gear & log
  const g=pj(1.1,.2,0);ln(c,g[0],g[1],g[0],g[1]-24,2.4,'#5a3a1a');ln(c,g[0],g[1]-24,g[0]-14,g[1]-18,2,'#5a3a1a');ln(c,g[0]-14,g[1]-18,g[0]-14,g[1]-8,.9,'#ddd');
  drawWheel(c,g[0]+7,g[1]-5,7,0.3);rect(c,...[g[0]-18,g[1]-8],8,4,'#7a5a3a','#2a1a0a');
  const lg=pj(1.2,-.7,0);ln(c,lg[0]-10,lg[1]-3,lg[0]+8,lg[1]-9,5,'#5a3a20');ln(c,lg[0]-10,lg[1]-8,lg[0]+8,lg[1]-14,5,'#6a4a2a');
  bannerAt(c,...pj(.5,-.8,h+8),12,col,st);return{};
},
castle(c,st,col,o){
  const a=st.age;pavement(c,4,'rgba(120,110,90,.5)');
  const wh=20+a*2;
  // back walls first
  blk(c,-1.7,1.7,-1.9,-1.55,0,wh,st,{tex:'stone',noTop:false});
  blk(c,-1.9,-1.55,-1.7,1.7,0,wh,st,{tex:'stone'});
  roundTower(c,-1.75,-1.75,.5,0,wh+16,st,null);
  // keep
  blk(c,-.9,.9,-.9,.9,0,wh+14,st,{wall:shade(st.wall,.05)});
  const KF=[pj(-.9,.9,0),pj(.9,.9,0),pj(.9,.9,wh+14),pj(-.9,.9,wh+14)];
  for(const u of[.18,.72]){win(c,KF,u,.5,.1,.22,1);win(c,KF,u,.15,.1,.2,0)}
  crenels(c,-.9,.9,-.9,.9,wh+14,st,5);
  blk(c,-.45,.45,-.45,.45,wh+14,18,st,{wall:shade(st.wall,.1)});roofPyramid(c,-.45,.45,-.45,.45,wh+32,16,st,{ov:.15});
  const fp=pj(0,0,wh+48);bannerAt(c,fp[0],fp[1],16,col,st);
  // front walls with gate
  blk(c,-1.7,-.3,1.55,1.9,0,wh,st,{});
  blk(c,.3,1.7,1.55,1.9,0,wh,st,{});
  const GF=[pj(-.3,1.9,0),pj(.3,1.9,0),pj(.3,1.9,wh),pj(-.3,1.9,wh)];blk(c,-.3,.3,1.55,1.9,wh-8,8,st,{});
  poly(c,[pj(-.28,1.9,0),pj(.28,1.9,0),pj(.28,1.9,wh-10),pj(0,1.9,wh-5),pj(-.28,1.9,wh-10)],'#1e120a','#111');
  for(let i=0;i<4;i++){const p=pj(-.2+i*.13,1.9,0),q=pj(-.2+i*.13,1.9,wh-8);ln(c,p[0],p[1],q[0],q[1],.8,'#555')}
  blk(c,1.55,1.9,-1.7,1.7,0,wh,st,{});
  crenels(c,-1.7,-.3,1.55,1.9,wh,st,5);crenels(c,.3,1.7,1.55,1.9,wh,st,5);
  roundTower(c,1.75,-1.75,.5,0,wh+16,st,null);
  roundTower(c,-1.75,1.75,.52,0,wh+20,st,a>=1?shade(st.roof,0):null,14);
  roundTower(c,1.75,1.75,.55,0,wh+22,st,st.roof,16);
  const f2=pj(1.75,1.75,wh+38);bannerAt(c,f2[0],f2[1],10,col,st);
  return{flag:[fp[0],fp[1]-16]};
},
tower(c,st,col,o){
  pavement(c,2,'rgba(110,100,80,.4)');
  const h=34+st.age*4;
  const top=roundTower(c,0,0,.62,0,h,st,null);
  // wooden hoarding & crenel ring
  const cp=pj(0,0,h);poly(c,[[cp[0]-30,cp[1]],[cp[0]+30,cp[1]],[cp[0]+26,cp[1]-7],[cp[0]-26,cp[1]-7]],'#7a5a34','#2a1a0a');
  roundTower(c,0,0,.5,h-1,12,{wall:'#8a6a40'},st.roof,12);
  const fp=pj(0,0,h+25);bannerAt(c,fp[0],fp[1],12,col,st);
  const dp=pj(0,.62,0);ln(c,dp[0],dp[1],dp[0],dp[1]-9,5,'#2a180c');
  return{flag:[fp[0],fp[1]-12]};
},
};
function getBuildingSprite(type,civ,age,color){
  const key=type+'|'+civ+'|'+age+'|'+color;
  if(BCACHE[key])return BCACHE[key];
  const d=B[type],sz=d.sz;
  const W=Math.ceil(sz*64+90),H=Math.ceil(sz*32+190);
  const cv=document.createElement('canvas');cv.width=W;cv.height=H;
  const c=cv.getContext('2d');
  const ox=W/2,oy=H-sz*16-14;
  c.translate(ox,oy);
  const st=bstyle(civ,age);
  let info={};
  const fnName={blacksmith:'smith',siege:'siegews',archery:'archery',lumber:'lumber',mining:'mining'}[type]||type;
  const fn=BPAINT[fnName];
  if(fn)info=fn(c,st,color,{})||{};
  const spr={cv,ox,oy,info};BCACHE[key]=spr;return spr;
}
