const {launch,startGame}=require('./lib');
(async()=>{
  const {browser,page,errs}=await launch(1280,720);
  await page.goto('http://localhost:8765/index.html');await page.waitForTimeout(300);
  await page.click('#mm-play');await page.waitForTimeout(300);
  const info=await page.evaluate(async()=>{
    const out={unlocked:AudioSys.unlocked,ctx:null,lines:{},vi:AudioSys.voiceInfo()};
    await new Promise(r=>setTimeout(r,500));
    out.vi=AudioSys.voiceInfo();
    for(const civ of ['britons','franks','goths','byzantines','japanese','mongols','vikings','saracens','teutons','chinese']){
      out.lines[civ]=[];for(const [k,a] of [['vil','select'],['vil','gather'],['mil','attack'],['cav','move'],['monk','select']]){await new Promise(r=>setTimeout(r,300));out.lines[civ].push(String(AudioSys.voice(civ,k,a)))}}
    // rapid clicks: only few should start
    let started=0;for(let i=0;i<20;i++){if(AudioSys.voice('franks','mil','select'))started++}
    out.rapid=started;
    for(const n of AudioSys.sfxNames||[]){AudioSys.sfx(n)}
    AudioSys.setVol('music',.2);AudioSys.setMute('sfx',true);out.vol=[AudioSys.getVol('music'),AudioSys.getMute('sfx')];AudioSys.setMute('sfx',false);
    out.mood=(AudioSys.setMusicMood('battle'),'ok');
    return out;
  });
  console.log(JSON.stringify(info,null,1).slice(0,3500));
  console.log('ERR',errs.filter(e=>!/404/.test(e)).join('\n'));
  await browser.close();
})();
