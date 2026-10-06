import {MAP_SIZE, BUILDINGS, UNITS, TECHS, AGES, AGE_COSTS, AGE_TIMES, rng, dist} from './data.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export class Game {
  constructor({seed=27419,difficulty='standard'}={}) {
    this.seed=seed; this.random=rng(seed); this.difficulty=difficulty;
    this.time=0; this.speed=1; this.paused=false; this.ended=false; this.winner=null; this.nextId=1;
    this.entities=[]; this.effects=[]; this.projectiles=[]; this.messages=[]; this.selected=[];
    this.players=[this.makePlayer(0),this.makePlayer(1)]; this.stats={gathered:0,built:0,trained:0,militaryTrained:0,kills:0,lost:0};
    this.explored=new Uint8Array(MAP_SIZE*MAP_SIZE); this.visible=new Uint8Array(MAP_SIZE*MAP_SIZE);
    this.terrain=[]; this.aiTick=0; this.visionTick=0; this.lastAttack=0; this.attackWarnings=-30;
    this.onEvent=()=>{}; this.createMap(); this.createSettlement(0,13,16); this.createSettlement(1,34,29);
    this.players[1].resources={food:350,wood:350,gold:220,stone:200};
    this.selected=[this.entities.find(e=>e.owner===0&&e.type==='towncenter').id];
    this.rebuildBlocked(); this.assignStartingWorkers(0); this.assignStartingWorkers(1); this.updateVision();
  }
  makePlayer(id) {return {id,age:0,resources:{food:250,wood:240,gold:140,stone:120},techs:{},defeated:false};}
  emit(type,text,extra={}) {this.onEvent({type,text,...extra});}
  get(id) {return this.entities.find(e=>e.id===id&&e.hp>0);}
  getSelected() {return this.selected.map(id=>this.get(id)).filter(Boolean);}
  own(owner=0,kind=null) {return this.entities.filter(e=>e.owner===owner&&e.hp>0&&(!kind||e.kind===kind));}
  population(owner=0) {return this.own(owner,'unit').length;}
  capacity(owner=0) {return Math.min(150,this.own(owner,'building').reduce((n,b)=>n+(b.complete?(BUILDINGS[b.type].pop||0):0),0));}
  reservedPop(owner) {return this.own(owner,'building').reduce((n,b)=>n+b.queue.filter(q=>q.kind==='unit').length,0);}
  canAfford(cost,owner=0) {return Object.entries(cost).every(([k,v])=>this.players[owner].resources[k]>=v);}
  spend(cost,owner=0) {if(!this.canAfford(cost,owner))return false; for(const [k,v] of Object.entries(cost))this.players[owner].resources[k]-=v; return true;}
  refund(cost,owner=0,mult=1) {for(const [k,v] of Object.entries(cost))this.players[owner].resources[k]+=v*mult;}
  resourceError(cost,owner=0) {const missing=Object.entries(cost).filter(([k,v])=>this.players[owner].resources[k]<v).map(([k,v])=>`${Math.ceil(v-this.players[owner].resources[k])} more ${k}`);this.emit('error',`You need ${missing.join(' and ')}.`);}
  createMap() {
    for(let y=0;y<MAP_SIZE;y++)for(let x=0;x<MAP_SIZE;x++) {
      const river=24+Math.sin(y*.24)*1.5;
      const water=Math.abs(x-river)<1.25;
      const bridge=water&&((y>=14&&y<=15)||(y>=31&&y<=32));
      this.terrain.push({x,y,kind:bridge?'bridge':water?'water':'grass',shade:this.random(),detail:this.random(),shore:Math.abs(x-river)<2.4});
    }
    const clusters=[[5,8,35],[17,6,27],[5,25,29],[18,29,27],[9,34,26],[29,8,25],[37,16,29],[40,38,30],[28,39,23],[39,6,18],[2,37,18],[15,39,15],[30,22,12],[3,16,14]];
    for(const [cx,cy,n] of clusters)for(let i=0;i<n;i++) {
      const angle=this.random()*Math.PI*2,rad=Math.sqrt(this.random())*3.9,x=cx+Math.cos(angle)*rad,y=cy+Math.sin(angle)*rad;
      if(x<1||y<1||x>42||y>42||this.terrain[Math.floor(y)*MAP_SIZE+Math.floor(x)].kind!=='grass')continue;
      if(this.entities.some(e=>dist(e,{x,y})<.67))continue;
      this.addResource('wood',x,y,180+this.random()*100);
    }
    for(const [kind,cx,cy,n] of [['gold',19,12,7],['gold',30,26,7],['gold',16,34,9],['gold',33,10,8],['stone',17,25,7],['stone',37,22,7],['stone',6,30,6],['food',7,18,8],['food',39,27,8],['food',13,28,5]]) {
      for(let i=0;i<n;i++) {const a=i*2.4,r=Math.sqrt(i)*.63;this.addResource(kind,cx+Math.cos(a)*r,cy+Math.sin(a)*r,kind==='food'?180:450);}
    }
  }
  addResource(resource,x,y,amount) {const e={id:this.nextId++,kind:'resource',type:resource,resource,owner:-1,x,y,hp:1,maxHp:1,amount,variant:Math.floor(this.random()*5),scale:.78+this.random()*.45};this.entities.push(e);return e;}
  addBuilding(type,owner,x,y,complete=true) {
    const d=BUILDINGS[type];
    this.entities=this.entities.filter(e=>e.kind!=='resource'||Math.abs(e.x-x)>d.size/2+.6||Math.abs(e.y-y)>d.size/2+.6);
    const b={id:this.nextId++,kind:'building',type,owner,x,y,hp:complete?d.hp:d.hp*.1,maxHp:d.hp,complete,progress:complete?1:0,queue:[],cooldown:0,rally:null,resource:type==='farm'?'food':null,amount:type==='farm'?999999:null};
    this.entities.push(b);return b;
  }
  addUnit(type,owner,x,y) {
    const d=UNITS[type],age=this.players[owner].age;
    const e={id:this.nextId++,kind:'unit',type,owner,x,y,hp:d.hp+(type==='militia'?age*12:0),maxHp:d.hp+(type==='militia'?age*12:0),order:{type:'idle'},path:[],cargo:0,cargoType:null,cooldown:0,anim:this.random()*6.28,facing:1,repath:0,stuck:0,combatTarget:null};
    this.entities.push(e);return e;
  }
  createSettlement(owner,x,y) {
    this.addBuilding('towncenter',owner,x,y);
    if(owner===0) {
      this.addBuilding('house',owner,8.5,14);this.addBuilding('house',owner,15,21.5);
      this.addBuilding('barracks',owner,18,18.5);this.addBuilding('mill',owner,8.5,21);
      this.addBuilding('farm',owner,8,24);this.addBuilding('farm',owner,11,23.5);
      this.addBuilding('lumbercamp',owner,11,9.5);
      for(const [ux,uy] of [[10.5,16],[10,17],[13,13.5],[15,14],[15.5,17],[11,19],[13,19.5]])this.addUnit('villager',owner,ux,uy);
      this.addUnit('scout',owner,18.5,15.5);this.addUnit('militia',owner,17,20.6);this.addUnit('militia',owner,18,21.2);
    } else {
      this.addBuilding('house',owner,38,24);this.addBuilding('house',owner,31,33);
      this.addBuilding('barracks',owner,35,34);this.addBuilding('mill',owner,37,32);
      this.addBuilding('farm',owner,40,31);this.addBuilding('farm',owner,40,34);
      for(const [ux,uy] of [[32,28],[32,30],[35,27],[36,28],[36,30],[34,31.5],[37,28]])this.addUnit('villager',owner,ux,uy);
      this.addUnit('militia',owner,32,25);this.addUnit('militia',owner,33,25);this.addUnit('archer',owner,34,25);
    }
  }
  assignStartingWorkers(owner) {
    const workers=this.own(owner,'unit').filter(e=>e.type==='villager'),types=['wood','food','wood','gold','food','farm'];
    for(let i=0;i<types.length&&i<workers.length;i++) {
      const type=types[i],w=workers[i];
      const candidates=this.entities.filter(e=>(type==='farm'?e.type==='farm'&&e.owner===owner:e.kind==='resource'&&e.resource===type)&&e.hp>0);
      candidates.sort((a,b)=>dist(w,a)-dist(w,b));if(candidates[0])this.commandGather(w,candidates[0]);
    }
  }
  rebuildBlocked() {
    this.blocked=new Uint8Array(MAP_SIZE*MAP_SIZE);
    for(const t of this.terrain)if(t.kind==='water')this.blocked[t.y*MAP_SIZE+t.x]=1;
    for(const b of this.entities) {
      if(b.hp<=0)continue;
      if(b.kind==='building'&&b.type!=='farm') {
        const s=BUILDINGS[b.type].size/2;
        for(let y=Math.floor(b.y-s);y<Math.ceil(b.y+s);y++)for(let x=Math.floor(b.x-s);x<Math.ceil(b.x+s);x++)
          if(x>=0&&y>=0&&x<MAP_SIZE&&y<MAP_SIZE&&Math.abs(x+.5-b.x)<s&&Math.abs(y+.5-b.y)<s)this.blocked[y*MAP_SIZE+x]=1;
      } else if(b.kind==='resource'&&b.resource!=='food') {const x=Math.floor(b.x),y=Math.floor(b.y);if(x>=0&&y>=0&&x<MAP_SIZE&&y<MAP_SIZE)this.blocked[y*MAP_SIZE+x]=1;}
    }
  }
  walkable(x,y) {return x>=0&&y>=0&&x<MAP_SIZE&&y<MAP_SIZE&&!this.blocked[Math.floor(y)*MAP_SIZE+Math.floor(x)];}
  findPath(from,to,range=0) {
    const sx=clamp(Math.floor(from.x),0,43),sy=clamp(Math.floor(from.y),0,43);
    let tx=clamp(Math.floor(to.x),0,43),ty=clamp(Math.floor(to.y),0,43);
    if(range>0||!this.walkable(tx,ty)) {
      let best=null,bestScore=Infinity;
      const r=Math.max(2,Math.ceil(range)+1);
      for(let y=Math.max(0,ty-r);y<=Math.min(43,ty+r);y++)for(let x=Math.max(0,tx-r);x<=Math.min(43,tx+r);x++) {
        if(!this.walkable(x,y))continue;
        const d=Math.hypot(x+.5-to.x,y+.5-to.y);
        if(range>0&&d>range+.05)continue;
        const score=Math.hypot(x-sx,y-sy)+d*.12;
        if(score<bestScore) {bestScore=score;best={x,y};}
      }
      if(!best)return [];tx=best.x;ty=best.y;
    }
    const start=sy*MAP_SIZE+sx,goal=ty*MAP_SIZE+tx;
    if(start===goal)return [{x:tx+.5,y:ty+.5}];
    const open=[start],g=new Float32Array(1936).fill(Infinity),f=new Float32Array(1936).fill(Infinity),came=new Int32Array(1936).fill(-1),closed=new Uint8Array(1936);
    g[start]=0;f[start]=Math.hypot(tx-sx,ty-sy);
    const dirs=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]];
    let iterations=0;
    while(open.length&&iterations++<2200) {
      let bi=0;for(let i=1;i<open.length;i++)if(f[open[i]]<f[open[bi]])bi=i;
      const cur=open.splice(bi,1)[0];
      if(cur===goal) {const path=[];let id=goal;while(id!==start&&id!==-1){path.push({x:id%MAP_SIZE+.5,y:Math.floor(id/MAP_SIZE)+.5});id=came[id];}return path.reverse();}
      closed[cur]=1;const x=cur%MAP_SIZE,y=Math.floor(cur/MAP_SIZE);
      for(const [dx,dy]of dirs) {
        const nx=x+dx,ny=y+dy;if(!this.walkable(nx,ny))continue;
        if(dx&&dy&&(!this.walkable(x+dx,y)||!this.walkable(x,y+dy)))continue;
        const ni=ny*MAP_SIZE+nx;if(closed[ni])continue;
        const ng=g[cur]+(dx&&dy?1.414:1);
        if(ng<g[ni]) {came[ni]=cur;g[ni]=ng;f[ni]=ng+Math.hypot(tx-nx,ty-ny);if(!open.includes(ni))open.push(ni);}
      }
    }
    return [];
  }
  targetRadius(target) {return target.kind==='building'?BUILDINGS[target.type].size*.53:target.kind==='resource'?.8:.25;}
  near(unit,target,extra=.65) {return dist(unit,target)<=this.targetRadius(target)+extra;}
  go(unit,target,range=0) {unit.path=this.findPath(unit,target,range);unit.repath=.9;return unit.path.length>0;}
  setIdle(u) {u.order={type:'idle'};u.path=[];u.combatTarget=null;}
  commandGather(u,target) {
    if(u.type!=='villager'||!target||!target.resource)return false;
    if(target.kind==='building'&&(target.owner!==u.owner||!target.complete))return false;
    u.order={type:'gather',target:target.id,resource:target.resource,phase:u.cargo>0&&u.cargoType!==target.resource?'return':'gather'};u.combatTarget=null;
    this.go(u,target,this.targetRadius(target)+.5);return true;
  }
  command(ids,target,mode='normal') {
    const units=ids.map(id=>this.get(id)).filter(e=>e?.owner===0&&e.kind==='unit');
    let n=0;
    for(const u of units) {
      u.combatTarget=null;u.path=[];
      if(target.id&&target.owner===1) {u.order={type:'attack',target:target.id};this.go(u,target,this.targetRadius(target)+UNITS[u.type].range*.8);}
      else if(target.id&&u.type==='villager'&&target.kind==='building'&&target.owner===0&&!target.complete) {u.order={type:'build',target:target.id};this.go(u,target,this.targetRadius(target)+.5);}
      else if(target.id&&u.type==='villager'&&target.resource&&(target.kind==='resource'||target.owner===0))this.commandGather(u,target);
      else if(target.id&&u.type==='villager'&&target.kind==='building'&&target.owner===0&&target.hp<target.maxHp) {u.order={type:'repair',target:target.id};this.go(u,target,this.targetRadius(target)+.5);}
      else {
        const offset=units.length>1?{x:(n%4-1.5)*.55,y:(Math.floor(n/4)-Math.floor(units.length/4)/2)*.55}:{x:0,y:0};
        const destination={x:clamp(target.x+offset.x,.5,43.5),y:clamp(target.y+offset.y,.5,43.5)};
        u.order={type:mode==='attackMove'?'attackMove':'move',...destination};this.go(u,destination);
      }
      n++;
    }
    if(units.length){this.effects.push({type:'command',x:target.x,y:target.y,life:1.2,maxLife:1.2,hostile:target.owner===1});this.emit('order','');}
    return units.length;
  }
  stop(ids) {for(const id of ids){const e=this.get(id);if(e?.owner===0&&e.kind==='unit')this.setIdle(e);}}
  canPlace(type,x,y,owner=0) {
    const d=BUILDINGS[type],s=d.size/2;
    if(x-s<1||y-s<1||x+s>43||y+s>43)return false;
    for(let ty=Math.floor(y-s);ty<Math.ceil(y+s);ty++)for(let tx=Math.floor(x-s);tx<Math.ceil(x+s);tx++) {
      if(this.terrain[ty*MAP_SIZE+tx]?.kind!=='grass')return false;
      if(owner===0&&!this.explored[ty*MAP_SIZE+tx])return false;
    }
    return !this.entities.some(e=>e.hp>0&&((e.kind==='building'&&Math.abs(e.x-x)<s+BUILDINGS[e.type].size/2+.3&&Math.abs(e.y-y)<s+BUILDINGS[e.type].size/2+.3)||(e.kind==='resource'&&Math.abs(e.x-x)<s+.5&&Math.abs(e.y-y)<s+.5)));
  }
  place(type,x,y,workerIds,owner=0) {
    const d=BUILDINGS[type];if(!d)return null;
    if(this.players[owner].age<d.age){if(owner===0)this.emit('error',`${d.name} requires the ${AGES[d.age]}.`);return null;}
    const workers=workerIds.map(id=>this.get(id)).filter(e=>e&&e.owner===owner&&e.type==='villager');
    if(!workers.length){if(owner===0)this.emit('error','Select a villager to construct a building.');return null;}
    if(!this.canPlace(type,x,y,owner)){if(owner===0)this.emit('error','Choose clear, explored ground for this building.');return null;}
    if(!this.spend(d.cost,owner)){if(owner===0)this.resourceError(d.cost);return null;}
    const b=this.addBuilding(type,owner,x,y,false);this.rebuildBlocked();
    for(const u of workers){u.order={type:'build',target:b.id};u.combatTarget=null;this.go(u,b,this.targetRadius(b)+.5);}
    // Keep all other routes coherent when a new foundation blocks a path.
    for(const u of this.own(owner,'unit'))if(u.path.some(p=>!this.walkable(p.x,p.y)))u.path=[];
    if(owner===0)this.emit('build',`${d.name} foundation placed.`);
    return b;
  }
  enqueue(buildingId,kind,type,owner=0) {
    const b=this.get(buildingId);if(!b||b.owner!==owner||b.kind!=='building'||!b.complete)return false;
    const p=this.players[owner];let cost,time,def;
    if(b.queue.length>=5){if(owner===0)this.emit('error','This production queue is full.');return false;}
    if(kind==='unit') {
      def=UNITS[type];if(!def||!BUILDINGS[b.type].units?.includes(type))return false;
      if(p.age<def.age){if(owner===0)this.emit('error',`${def.name} requires the ${AGES[def.age]}.`);return false;}
      if(this.population(owner)+this.reservedPop(owner)>=this.capacity(owner)){if(owner===0)this.emit('error','More houses needed. Your population limit is reached.');return false;}
      cost=def.cost;time=def.time;
    } else if(kind==='age') {
      if(b.type!=='towncenter'||p.age>=3)return false;
      if(this.own(owner,'building').some(e=>e.queue.some(q=>q.kind==='age'))){if(owner===0)this.emit('error','An age advancement is already underway.');return false;}
      cost=AGE_COSTS[p.age];time=AGE_TIMES[p.age];type=p.age+1;
    } else if(kind==='tech') {
      def=TECHS[type];if(!def||p.techs[type]||p.age<def.age)return false;
      if((type==='wheelbarrow'&&b.type!=='towncenter')||(type!=='wheelbarrow'&&b.type!=='blacksmith'))return false;
      if(this.own(owner,'building').some(e=>e.queue.some(q=>q.kind==='tech'&&q.type===type)))return false;
      cost=def.cost;time=def.time;
    } else return false;
    if(!this.spend(cost,owner)){if(owner===0)this.resourceError(cost,owner);return false;}
    b.queue.push({kind,type,time,total:time,cost});if(owner===0)this.emit('queue','');return true;
  }
  cancelQueue(buildingId,index) {const b=this.get(buildingId);if(b?.owner!==0||!b.queue[index])return;const q=b.queue.splice(index,1)[0];this.refund(q.cost);this.emit('info','Production canceled. Resources refunded.');}
  trade(resource,buy,owner=0) {
    if(!['food','wood','stone'].includes(resource))return false;
    if(!this.own(owner,'building').some(b=>b.type==='market'&&b.complete))return false;
    const cost=buy?{gold:100}:{[resource]:100};
    if(!this.spend(cost,owner)){if(owner===0)this.resourceError(cost);return false;}
    this.players[owner].resources[buy?resource:'gold']+=buy?100:65;
    if(owner===0)this.emit('success',buy?`Bought 100 ${resource} for 100 gold.`:`Sold 100 ${resource} for 65 gold.`);return true;
  }
  dropoff(u) {
    const buildings=this.own(u.owner,'building').filter(b=>b.complete&&(b.type==='towncenter'||b.type==='market'||(u.cargoType==='wood'&&b.type==='lumbercamp')||(u.cargoType==='food'&&b.type==='mill')||(['gold','stone'].includes(u.cargoType)&&b.type==='miningcamp')));
    return buildings.sort((a,b)=>dist(a,u)-dist(b,u))[0];
  }
  update(dt) {
    if(this.paused||this.ended)return;
    this.time+=dt;
    this.effects=this.effects.filter(e=>(e.life-=dt)>0);
    for(const p of this.projectiles)p.life-=dt;this.projectiles=this.projectiles.filter(p=>p.life>0);
    for(const e of [...this.entities]) {
      if(e.hp<=0)continue;
      e.cooldown=Math.max(0,(e.cooldown||0)-dt);
      if(e.kind==='building')this.updateBuilding(e,dt);
      if(e.kind==='unit')this.updateUnit(e,dt);
    }
    // Gentle separation keeps groups readable without making narrow bridges impassable.
    const units=this.entities.filter(e=>e.kind==='unit'&&e.hp>0);
    for(let i=0;i<units.length;i++)for(let j=i+1;j<units.length;j++) {
      const a=units[i],b=units[j],dx=a.x-b.x,dy=a.y-b.y,d=Math.hypot(dx,dy);
      if(d>0&&d<.38) {const push=(.38-d)*.12,ax=a.x+dx/d*push,ay=a.y+dy/d*push;if(this.walkable(ax,ay)){a.x=ax;a.y=ay;}const bx=b.x-dx/d*push,by=b.y-dy/d*push;if(this.walkable(bx,by)){b.x=bx;b.y=by;}}
    }
    this.visionTick-=dt;if(this.visionTick<=0){this.updateVision();this.visionTick=.55;}
    this.aiTick-=dt;if(this.aiTick<=0){this.updateAI();this.aiTick=3;}
    const bonus=this.difficulty==='relaxed'?.65:this.difficulty==='hard'?1.65:1;
    for(const [r,v] of Object.entries({food:1.7,wood:1.6,gold:1,stone:.4}))this.players[1].resources[r]+=v*dt*bonus;
    this.selected=this.selected.filter(id=>this.get(id));
    const before=this.entities.length;this.entities=this.entities.filter(e=>e.hp>0);
    if(before!==this.entities.length)this.rebuildBlocked();
  }
  updateBuilding(b,dt) {
    if(!b.complete)return;
    const q=b.queue[0];
    if(q) {
      // A lost house can pause training until there is room again.
      if(q.kind!=='unit'||this.population(b.owner)<this.capacity(b.owner))q.time-=dt;
      if(q.time<=0) {
        b.queue.shift();const p=this.players[b.owner];
        if(q.kind==='unit') {
          const spot=this.findSpawn(b);const u=this.addUnit(q.type,b.owner,spot.x,spot.y);
          if(b.rally) {
            const t=b.rally.id?this.get(b.rally.id):b.rally;
            if(t&&u.type==='villager'&&t.resource)this.commandGather(u,t);
            else if(t){u.order={type:'move',x:t.x,y:t.y};this.go(u,t);}
          }
          if(b.owner===0){this.stats.trained++;if(q.type!=='villager')this.stats.militaryTrained=(this.stats.militaryTrained||0)+1;this.emit('trained',`${UNITS[q.type].name} ready.`,{entity:u});}
        } else if(q.kind==='age') {
          p.age=q.type;
          for(const u of this.own(b.owner,'unit'))if(u.type==='militia'){u.maxHp+=12;u.hp+=12;}
          if(b.owner===0)this.emit('age',`A new era dawns. Welcome to the ${AGES[p.age]}!`);
          else this.emit('warning',`The rival kingdom has reached the ${AGES[p.age]}.`);
        } else {p.techs[q.type]=true;if(b.owner===0)this.emit('success',`${TECHS[q.type].name} research complete.`);}
      }
    }
    const d=BUILDINGS[b.type];
    if((d.attack||b.type==='towncenter')&&b.cooldown===0) {
      const range=d.range||6.3;
      const targets=this.entities.filter(e=>e.owner===1-b.owner&&e.kind==='unit'&&e.hp>0&&dist(e,b)<range);
      if(targets.length){targets.sort((a,c)=>dist(a,b)-dist(c,b));this.strike(b,targets[0],d.attack||8);b.cooldown=b.type==='castle'?.8:1.5;}
    }
  }
  findSpawn(b) {
    const s=BUILDINGS[b.type].size/2;
    for(let r=s+.8;r<s+5;r+=.75)for(let i=0;i<16;i++) {const a=i*Math.PI/8+.6,x=b.x+Math.cos(a)*r,y=b.y+Math.sin(a)*r;if(this.walkable(x,y)&&!this.entities.some(e=>e.kind==='unit'&&dist(e,{x,y})<.5))return{x,y};}
    return {x:clamp(b.x+s+1,.5,43.5),y:clamp(b.y+s+1,.5,43.5)};
  }
  updateUnit(u,dt) {
    u.anim+=dt*(u.path.length?9:2);u.repath-=dt;
    const d=UNITS[u.type];
    // Workers fight only when explicitly ordered; military automatically defend and attack-move.
    if(u.type!=='villager'&&u.order.type!=='move'&&u.order.type!=='build') {
      let target=this.get(u.order.type==='attack'?u.order.target:u.combatTarget);
      if(target&&u.order.type!=='attack'&&dist(u,target)>9)target=null;
      if(!target&&u.cooldown<=.1) {
        const sight=u.type==='scout'?8:6.5;
        const enemies=this.entities.filter(e=>e.owner===1-u.owner&&e.hp>0&&dist(u,e)<sight&&(!['ram','trebuchet'].includes(u.type)||e.kind==='building'));
        enemies.sort((a,b)=>((a.kind==='unit'?-3:0)+dist(u,a))-((b.kind==='unit'?-3:0)+dist(u,b)));
        target=enemies[0];u.combatTarget=target?.id||null;
      }
      if(target){this.fight(u,target,dt);return;}
      if(u.order.type==='attack')this.setIdle(u);
    }
    if(u.type==='villager'&&u.order.type==='attack') {const t=this.get(u.order.target);if(t){this.fight(u,t,dt);return;}this.setIdle(u);}
    if(u.order.type==='gather')this.updateGather(u,dt);
    else if(u.order.type==='build'||u.order.type==='repair') {
      const target=this.get(u.order.target);
      if(!target){this.setIdle(u);return;}
      if(u.order.type==='build'&&target.complete) {
        if(target.type==='farm')this.commandGather(u,target);else this.setIdle(u);return;
      }
      if(this.near(u,target,.85)) {
        u.path=[];
        if(u.order.type==='build') {
          const progress=dt/BUILDINGS[target.type].time;target.progress=Math.min(1,target.progress+progress);target.hp=Math.min(target.maxHp,target.hp+target.maxHp*.9*progress);
          if(target.progress>=1) {target.complete=true;target.hp=target.maxHp;if(u.owner===0){this.stats.built++;this.emit('success',`${BUILDINGS[target.type].name} completed.`);}if(target.type==='farm')this.commandGather(u,target);else this.setIdle(u);}
        } else {
          const cost=dt*.55;
          if(this.players[u.owner].resources.wood>=cost){this.players[u.owner].resources.wood-=cost;target.hp=Math.min(target.maxHp,target.hp+dt*28);}
          if(target.hp>=target.maxHp)this.setIdle(u);
        }
      } else if(!u.path.length&&u.repath<=0)this.go(u,target,this.targetRadius(target)+.5);
    } else if(['move','attackMove'].includes(u.order.type)) {
      if(!u.path.length) {
        if(dist(u,u.order)<1.3)this.setIdle(u);
        else if(u.repath<=0){if(!this.go(u,u.order))this.setIdle(u);}
      }
    }
    this.walk(u,dt,d.speed);
  }
  updateGather(u,dt) {
    const order=u.order;
    let target=this.get(order.target);
    if(order.phase==='return') {
      const drop=this.dropoff(u);
      if(!drop){this.setIdle(u);return;}
      if(this.near(u,drop,.9)) {
        this.players[u.owner].resources[u.cargoType]+=u.cargo;
        if(u.owner===0)this.stats.gathered+=u.cargo;
        if(u.cargo>0)this.effects.push({type:'deposit',x:drop.x,y:drop.y,life:1.1,maxLife:1.1,text:`+${Math.floor(u.cargo)}`,resource:u.cargoType});
        u.cargo=0;u.cargoType=null;order.phase='gather';u.path=[];
      } else if(!u.path.length||u.repath<=-2)this.go(u,drop,this.targetRadius(drop)+.65);
      return;
    }
    if(!target||target.amount<=0) {
      const candidates=this.entities.filter(e=>e.hp>0&&e.resource===order.resource&&e.amount>0&&(e.kind==='resource'||(e.owner===u.owner&&e.complete))&&dist(u,e)<16);
      candidates.sort((a,b)=>dist(a,u)-dist(b,u));
      for(const candidate of candidates) {if(this.near(u,candidate,.8)||this.go(u,candidate,this.targetRadius(candidate)+.5)){target=candidate;order.target=target.id;break;}}
      if(!target||target.hp<=0){if(u.cargo>0){order.phase='return';u.path=[];}else this.setIdle(u);return;}
    }
    if(this.near(u,target,.8)) {
      u.path=[];
      const occupied=target.type==='farm'&&this.entities.some(e=>e.id!==u.id&&e.type==='villager'&&e.order.type==='gather'&&e.order.target===target.id&&e.id<u.id);
      if(occupied){this.setIdle(u);if(u.owner===0)this.emit('info','This farm already has a villager. Build another farm.');return;}
      const rate=1.85*(this.players[u.owner].techs.wheelbarrow?1.25:1)*(target.type==='farm'?1.1:1);
      const max=10+(this.players[u.owner].techs.wheelbarrow?5:0),amount=Math.min(rate*dt,max-u.cargo,target.amount);
      u.cargo+=amount;u.cargoType=target.resource;target.amount-=amount;
      if(target.amount<=0&&target.kind==='resource'){target.hp=0;this.rebuildBlocked();}
      if(u.cargo>=max-.001){order.phase='return';u.path=[];}
    } else if(!u.path.length&&u.repath<=0) {
      if(!this.go(u,target,this.targetRadius(target)+.5)){order.target=null;u.repath=2;}
    }
  }
  walk(u,dt,speed) {
    if(!u.path.length)return;
    const next=u.path[0];
    if(!this.walkable(next.x,next.y)){u.path=[];return;}
    const dx=next.x-u.x,dy=next.y-u.y,d=Math.hypot(dx,dy),step=speed*dt;
    if(d<step){u.x=next.x;u.y=next.y;u.path.shift();}
    else {u.x+=dx/d*step;u.y+=dy/d*step;}
    u.x=clamp(u.x,.1,43.9);u.y=clamp(u.y,.1,43.9);u.facing=dx-dy>=0?1:-1;
  }
  fight(u,target,dt) {
    const d=UNITS[u.type],reach=d.range+this.targetRadius(target);
    if(dist(u,target)<=reach) {
      u.path=[];
      if(u.cooldown<=0) {
        let attack=d.attack+(this.players[u.owner].techs.attack&&u.type!=='villager'?3:0)+(u.type==='militia'?this.players[u.owner].age*2:0);
        if(u.type==='ram'&&target.kind!=='building')attack=3;
        if(u.type==='trebuchet'&&target.kind!=='building')attack=12;
        if(u.type==='archer'&&target.type==='ram')attack=1;
        this.strike(u,target,attack);u.cooldown=u.type==='trebuchet'?2.8:u.type==='ram'?1.7:u.type==='archer'?1.3:1.05;
      }
    } else {
      if(!u.path.length||u.repath<=0)this.go(u,target,Math.max(.6,reach-.35));
      this.walk(u,dt,d.speed);
    }
  }
  strike(attacker,target,attack) {
    const armor=target.kind==='unit'?UNITS[target.type].armor+(this.players[target.owner].techs.armor?2:0):target.type==='castle'?4:1;
    const damage=Math.max(1,attack-armor);target.hp-=damage;
    if(attacker.type==='archer'||attacker.type==='trebuchet'||attacker.kind==='building')this.projectiles.push({from:{x:attacker.x,y:attacker.y},to:{x:target.x,y:target.y},life:attacker.type==='trebuchet'?.8:.32,total:attacker.type==='trebuchet'?.8:.32,stone:attacker.type==='trebuchet',owner:attacker.owner,high:attacker.kind==='building'});
    this.effects.push({type:'hit',x:target.x,y:target.y,life:.3,maxLife:.3});
    if(target.owner===0&&this.time-this.attackWarnings>22){this.attackWarnings=this.time;this.emit('attack','Your kingdom is under attack!',{entity:target});}
    if(target.kind==='unit'&&target.type==='villager'&&target.order.type!=='attack'&&target.hp<target.maxHp*.65) {
      const town=this.own(target.owner,'building').find(e=>e.type==='towncenter');
      if(town&&dist(town,target)>4){target.order={type:'move',x:town.x-2,y:town.y+2};this.go(target,target.order);}
    }
    if(target.hp<=0) {
      this.effects.push({type:'death',x:target.x,y:target.y,life:target.kind==='building'?3:1.6,maxLife:target.kind==='building'?3:1.6,building:target.kind==='building'});
      if(attacker.owner===0)this.stats.kills++;if(target.owner===0&&target.kind==='unit')this.stats.lost++;
      if(target.kind==='building'&&target.type==='towncenter') {
        const alive=this.own(target.owner,'building').some(b=>b.type==='towncenter'&&b.id!==target.id);
        if(!alive){this.ended=true;this.winner=attacker.owner;this.players[target.owner].defeated=true;this.emit('end',attacker.owner===0?'Victory':'Defeat');}
      }
    }
  }
  updateVision() {
    this.visionVersion=(this.visionVersion||0)+1;
    this.visible.fill(0);
    for(const e of this.own(0)) {
      const r=e.kind==='building'?(BUILDINGS[e.type].sight||6):(e.type==='scout'?10:7);
      for(let y=Math.max(0,Math.floor(e.y-r));y<=Math.min(43,Math.ceil(e.y+r));y++)for(let x=Math.max(0,Math.floor(e.x-r));x<=Math.min(43,Math.ceil(e.x+r));x++)
        if(Math.hypot(x+.5-e.x,y+.5-e.y)<r){this.visible[y*MAP_SIZE+x]=1;this.explored[y*MAP_SIZE+x]=1;}
    }
  }
  isVisible(e) {return e.owner===0||!!this.visible[clamp(Math.floor(e.y),0,43)*MAP_SIZE+clamp(Math.floor(e.x),0,43)];}
  isExplored(e) {return !!this.explored[clamp(Math.floor(e.y),0,43)*MAP_SIZE+clamp(Math.floor(e.x),0,43)];}
  aiBuild(type,x,y) {
    if(!this.canAfford(BUILDINGS[type].cost,1))return null;
    const w=this.own(1,'unit').find(u=>u.type==='villager'&&!['build','repair'].includes(u.order.type));if(!w)return null;
    for(let i=0;i<20;i++){const px=i===0?x:x+Math.round((this.random()-.5)*10),py=i===0?y:y+Math.round((this.random()-.5)*10);if(this.canPlace(type,px,py,1))return this.place(type,px,py,[w.id],1);}
    return null;
  }
  updateAI() {
    if(this.players[1].defeated)return;
    const p=this.players[1],buildings=this.own(1,'building'),units=this.own(1,'unit'),tc=buildings.find(b=>b.type==='towncenter');if(!tc)return;
    const workers=units.filter(u=>u.type==='villager');
    for(const w of workers.filter(u=>u.order.type==='idle')) {
      const desired=p.resources.food<160?'food':p.resources.wood<180?'wood':p.resources.gold<120?'gold':['wood','food','gold'][w.id%3];
      const target=this.entities.filter(e=>e.hp>0&&e.kind==='resource'&&e.resource===desired&&dist(e,w)<18).sort((a,b)=>dist(a,w)-dist(b,w))[0];
      if(target)this.commandGather(w,target);
    }
    if(workers.length<12&&tc.queue.length<1)this.enqueue(tc.id,'unit','villager',1);
    if(this.population(1)+this.reservedPop(1)>=this.capacity(1)-2&&!buildings.some(b=>!b.complete&&b.type==='house'))this.aiBuild('house',30+this.random()*10,32+this.random()*6);
    const ageTargets=this.difficulty==='hard'?[115,280,510]:this.difficulty==='relaxed'?[260,620,1050]:[180,420,780];
    const savingForAge=p.age<3&&this.time>ageTargets[p.age]&&!buildings.some(b=>b.queue.some(q=>q.kind==='age'));
    if(savingForAge&&tc.queue.length<2)this.enqueue(tc.id,'age',null,1);
    for(const [type,x,y,time] of [['range',30,30,100],['stable',34,23,240],['blacksmith',38,36,260],['tower',28,31,200],['workshop',31,15,390],['castle',29,20,600]]) {
      if(this.time>time&&p.age>=BUILDINGS[type].age&&!buildings.some(b=>b.type===type))this.aiBuild(type,x,y);
    }
    const military=units.filter(u=>u.type!=='villager'),armyLimit=this.difficulty==='relaxed'?16:this.difficulty==='hard'?32:24;
    if(military.length<armyLimit)for(const b of buildings) {
      if(!b.complete||b.queue.length>=2||!BUILDINGS[b.type].units||b.type==='towncenter')continue;
      const types=BUILDINGS[b.type].units.filter(t=>p.age>=UNITS[t].age);const type=types[types.length-1];
      if(type){const saving=savingForAge&&Object.keys(UNITS[type].cost).some(r=>(AGE_COSTS[p.age]?.[r]||0)>p.resources[r]);if(!saving)this.enqueue(b.id,'unit',type,1);}
    }
    const smith=buildings.find(b=>b.type==='blacksmith'&&b.complete);if(smith&&!savingForAge&&p.resources.gold>220)this.enqueue(smith.id,'tech',p.techs.attack?'armor':'attack',1);
    const attackStart=this.difficulty==='relaxed'?300:this.difficulty==='hard'?130:210;
    const interval=this.difficulty==='hard'?65:this.difficulty==='relaxed'?130:105;
    if(this.time>attackStart&&this.time-this.lastAttack>interval&&military.length>=5) {
      const playerTown=this.own(0,'building').find(b=>b.type==='towncenter');
      if(playerTown) {
        const wave=Math.floor((this.time-attackStart)/interval);
        const waveSize=this.difficulty==='relaxed'?Math.min(6,3+wave):this.difficulty==='hard'?Math.min(16,8+wave*2):Math.min(12,4+wave*2);
        const raiders=military.filter(u=>u.order.type==='idle'||dist(u,tc)<12).slice(0,waveSize);
        for(const u of raiders){u.order={type:'attackMove',x:playerTown.x,y:playerTown.y};u.combatTarget=null;this.go(u,playerTown,5);}
        if(raiders.length){this.lastAttack=this.time;this.emit('warning','Scouts report a rival war party on the march.');}
      }
    }
  }
  serialize() {return JSON.stringify({version:1,seed:this.seed,difficulty:this.difficulty,time:this.time,speed:this.speed,nextId:this.nextId,players:this.players,entities:this.entities,explored:Array.from(this.explored),stats:this.stats,lastAttack:this.lastAttack,selected:this.selected,ended:this.ended,winner:this.winner});}
  static load(raw) {
    const s=JSON.parse(raw);
    if(s.version!==1||!Array.isArray(s.entities)||!s.players||!Array.isArray(s.explored)||s.explored.length!==1936)throw new Error('Invalid save file');
    const game=new Game({seed:s.seed,difficulty:s.difficulty});
    for(const k of ['time','speed','nextId','players','entities','stats','lastAttack','selected','ended','winner'])game[k]=s[k];
    game.explored=new Uint8Array(s.explored);game.rebuildBlocked();game.updateVision();return game;
  }
}
