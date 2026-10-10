const {launch,startGame}=require('./lib');
(async()=>{
  for(const map of ['islands','coastal','highlands','arabia']){
    const {browser,page,errs}=await launch(1280,720);
    await startGame(page,{seed:44,ai:3,map,size:'medium',vis:'all',age:1,res:'med'});
    const res=await page.evaluate(()=>{
      const t0=performance.now();
      G.players[0].ai=true;G.players[0].diff=2;aiInit();
      for(const p of G.players)p.diff=2;
      let drawMs=0,frames=0,maxDraw=0;
      for(let i=0;i<9000;i++){stepGame(0.1);if(i%12===0){const s=performance.now();
        // wander camera over map
        const p=G.players[i/12%G.players.length|0];centerOn(p.start.x,p.start.y);
        drawFrame(performance.now());drawMinimap(document.getElementById('minimap'),document.getElementById('minimap').getContext('2d'));if(i%120===0){updateMinimapBase();uiRefresh(true);selEnts()}const d=performance.now()-s;drawMs+=d;maxDraw=Math.max(maxDraw,d);frames++}}
      return{sec:G.time|0,real:((performance.now()-t0)/1000)|0,avgDraw:(drawMs/frames).toFixed(1),maxDraw:maxDraw.toFixed(0),units:G.units.length,ents:G.ents.length,ages:G.players.map(p=>p.age).join(''),pops:G.players.map(p=>p.pop).join('/'),alive:G.players.map(p=>p.alive).join(','),over:G.over&&G.over.text}
    });
    console.log(map,JSON.stringify(res));
    console.log('  errors:',[...new Set(errs.filter(e=>!/404/.test(e)))].slice(0,6).join(' || '));
    if(map==='islands')await page.screenshot({path:'/tmp/s_chaos.png'});
    await browser.close();
  }
})();
