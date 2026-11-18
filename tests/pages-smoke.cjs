// Run after Pages builds: node tests/pages-smoke.cjs [URL]
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try {
  const page=await browser.newPage({viewport:{width:1100,height:760}}),errors=[],failed=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>failed.push({url:r.url(),error:r.failure()}));
  await page.goto(process.argv[2]||'https://andytwmvp.github.io/TPEFanService/',{waitUntil:'domcontentloaded',timeout:90000});
  await page.locator('#gStart').click({timeout:60000});
  await page.locator('#ribbonStart').click({timeout:60000});
  await page.waitForFunction(()=>!ribbonHud.hidden && !ribbonTargetMark.hidden,null,{timeout:60000});
  console.log(JSON.stringify(await page.evaluate(()=>({url:location.href,webgl:!!document.getElementById('gl').getContext('webgl2'),target:ribbonTargetText.textContent,hint:ribbonHint.textContent,adapter:typeof RibbonWorld,testAPI:typeof window.testRibbon})),null,2));
  await page.locator('#ribbonStop').click();await page.locator('#ribbonSummary').waitFor({state:'visible',timeout:300000});await page.locator('#ribbonClose').click();
  if(errors.length)throw Error(JSON.stringify({errors,failed}));
  console.log('Live Pages start / target / stop / menu passed; requests failing: '+JSON.stringify(failed));
 } finally {await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
