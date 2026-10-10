const {chromium}=require('playwright-core');
async function launch(w=1366,h=768){
  const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required','--use-gl=swiftshader']});
  const page=await browser.newPage({viewport:{width:w,height:h}});
  const errs=[];page.on('pageerror',e=>errs.push('PAGEERR '+e.message+' '+(e.stack||'').split('\n')[1]));page.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE '+m.text())});
  return{browser,page,errs};
}
module.exports={launch};
module.exports.startGame=async function(page,o={}){
  await page.goto('http://localhost:8765/index.html');await page.waitForTimeout(400);
  await page.click('#mm-play');
  if(o.map)await page.selectOption('#s-map',o.map);
  if(o.size)await page.selectOption('#s-size',o.size);
  if(o.ai)await page.selectOption('#s-ai',String(o.ai));
  if(o.civ)await page.selectOption('#s-civ',o.civ);
  if(o.seed)await page.fill('#s-seed',String(o.seed));
  if(o.age!==undefined)await page.selectOption('#s-age',String(o.age));
  if(o.res)await page.selectOption('#s-res',o.res);
  if(o.vis)await page.selectOption('#s-vis',o.vis);
  if(o.diff!==undefined)await page.selectOption('#s-diff',String(o.diff));
  if(o.teams)await page.selectOption('#s-teams',o.teams);
  await page.check('#s-cheats');
  await page.click('#s-start');await page.waitForTimeout(600);
};
