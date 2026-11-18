// npm install --no-save playwright; node tests/ribbon-browser.cjs
// Test-only source instrumentation exposes closure functions and stops RAF.
const {chromium}=require('playwright');
const fs=require('node:fs');const assert=require('node:assert/strict');const path=require('node:path');
const root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1000,height:700}});let errors=[];page.on('pageerror',e=>errors.push(e.message));
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8').replaceAll('requestAnimationFrame(frame);','').replace('})();\n</script>','window.testRibbon = {RIBBON, G2, S, seats, camera, renderer, scene, startGame, ribbonStartPlay, ribbonPickTarget, ribbonFindWindow, ribbonBuildLaunch, ribbonStepRoll, ribbonLaunch, ribbonTick, ribbonTickSettled, ribbonUpdateMesh, ribbonMakeTrail, ribbonCancelGesture, finishRibbonGame, closeRibbonSummary, onAudienceChanged, setMode, ribbonPhysicsStep, ribbonOutcome, ribbonRopeStep, ribbonSetPower, getPicker:()=>ribbonPickTarget, setPicker:f=>ribbonPickTarget=f};\n})();\n</script>');
 await page.route('**/TPEFanService/',r=>r.fulfill({body:html,contentType:'text/html'}));
 await page.route('**/ribbon-world.js*',r=>r.fulfill({body:fs.readFileSync(path.join(root,'ribbon-world.js')),contentType:'application/javascript'}));await page.route('**/ribbon-crowd.js*',r=>r.fulfill({body:fs.readFileSync(path.join(root,'ribbon-crowd.js')),contentType:'application/javascript'}));
 await page.route('**/three.min.js',r=>r.fulfill({body:fs.readFileSync(process.env.THREE_PATH||require.resolve("three/build/three.min.js")),contentType:'application/javascript'}));
 await page.route('**/ribbon-records.js*',r=>r.fulfill({body:fs.readFileSync(path.join(root,'ribbon-records.js')),contentType:'application/javascript'}));
 await page.goto('http://127.0.0.1:8765/TPEFanService/',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>!!window.testRibbon);
 const fixtures=JSON.parse(fs.readFileSync(path.join(__dirname,"reference-launch-fixtures.json"),"utf8"));
 const report=await page.evaluate(async(fixtures)=>{
  const t=testRibbon,r=t.RIBBON,out=[];const check=(ok,label)=>{if(!ok)throw Error(label);out.push(label)};
  check(!!t.renderer.getContext(),'WebGL context');
  t.startGame('ribbon');
  const original=t.getPicker();let release;
  t.setPicker(()=>new Promise(resolve=>release=resolve));
  const pending=t.ribbonStartPlay(performance.now());
  check(r.phase==='selecting' && !r.target && !r.window && ribbonTargetMark.hidden && ribbonPowerBand.hidden && ribbonPerfectBand.hidden,'selecting hides candidate and bands');
  t.finishRibbonGame();t.startGame('ribbon');const session=r.session;
  release({target:t.seats[1],window:{lo:0.2,hi:0.4}});await pending;
  check(r.session===session && !r.target && r.phase==='countdown','old search cannot publish into restarted session');
  t.setPicker(async()=>{throw Error('injected search failure')});await t.ribbonStartPlay(performance.now());
  check(r.phase==='result' && ribbonResultMessage.textContent.includes('錯誤'),'search rejection finishes with readable error');
  t.setPicker(original);
  for(let i=0;i<4;i++){t.startGame('ribbon');const p=t.ribbonStartPlay(performance.now());t.finishRibbonGame();await p;check(!r.target,'cancel search '+i)}
  t.startGame('ribbon');await t.ribbonStartPlay(performance.now());
  check(r.phase==='play' && r.target && r.window,'reachable target selected');
  const target=r.target,win=r.window;let samples=0;
  function simulate(power){const s=t.ribbonBuildLaunch(power,0);const f={roll:s.origin.clone(),velocity:s.velocity.clone(),tilt:s.tilt,paid:0,apex:s.origin.y,hit:false,time:0};let o;for(let i=0;i<960;i++){o=t.ribbonStepRoll(f,target);if(o.done)break}return {f,o};}
  for(let u=win.lo;u<=win.hi+1e-9;u+=1.35/120){const {o}=simulate(u);check(o.caught?.seat===target,'hit interval sample '+samples++);}
  if(win.pfLo!==null){for(let u=win.pfLo;u<=win.pfHi+1e-9;u+=1.35/120){const {f,o}=simulate(u);check(o.caught?.distance<.3 && !o.caught.pickup && !f.hit,'perfect uses actual distance');}}
  check(r.target===target,'target remains fixed');
  const savedThrower=r.thrower;
  for(const sample of fixtures.inputs) {
    r.thrower={...savedThrower,release:new THREE.Vector3(...sample.origin)};
    const fake={...target,m:new THREE.Matrix4().makeTranslation(sample.person.x,0,sample.person.z-.04),headZ:.04};
    const launch=t.ribbonBuildLaunch(sample.power,sample.angle,fake),actual=[launch.velocity.x,launch.velocity.y,launch.velocity.z,launch.tilt];
    check(actual.every((v,i)=>Math.abs(v-sample.velocity[i])<1e-10),'reference launch parity '+sample.power+'/'+sample.angle);
  }
  r.thrower=savedThrower;
  t.ribbonLaunch((win.lo+win.hi)/2,0,performance.now());let f=r.flight;
  for(let i=0;i<45 && !f.resolved;i++)t.ribbonPhysicsStep(f,1/120,performance.now());
  check(f.nodes.length>2,'ribbon feeds more than two nodes');
  for(let i=0;i<960 && !f.resolved;i++)t.ribbonPhysicsStep(f,1/120,performance.now());
  check(f.resolved && r.attempts===1,'actual throw resolves exactly once');
  const attempts=r.attempts;t.ribbonTick(f.removeAt+1);check(r.attempts===attempts,'no duplicate scoring');
  // Fourteen distinct station slots; ten-throw rounds use the same real physics.
  t.finishRibbonGame();t.startGame('ribbon');
  async function checkpoint(){if(r.phase!=='resultWait')throw Error('missing checkpoint');t.ribbonTick(r.nextAt+1);for(let n=0;n<40&&r.phase==='resultWait';n++)t.ribbonTick(r.lastFrame+50);check(document.getElementById('ribbonSummary').hidden,'photo animation precedes round summary');const oldCount=r.settled.length,attempts=r.attempts,hits=r.hits;for(let n=0;n<220&&!r.presentationReady;n++)t.ribbonTick(r.lastFrame+17);check(!!r.photoURL&&r.presentationReady,'round photo completes before advance');document.getElementById('ribbonNext').click();document.getElementById('ribbonNext').click();check(r.phase==='countdown'&&!r.settled.length&&r.attempts===attempts&&r.hits===hits,'explicit next round clears tapes and retains cumulative totals once');await t.ribbonStartPlay(performance.now());}
  const seen=[];
  for(let round=0;round<14;round++) {
    await t.ribbonStartPlay(performance.now());
    check(r.phase==='play','round '+round+' has reachable target');seen.push(r.slot);
    t.ribbonLaunch(r.window.mid,0,performance.now());
    const shot=r.flight;
    for(let k=0;k<960 && !shot.resolved;k++)t.ribbonPhysicsStep(shot,1/120,performance.now());
    check(r.hits===round+1,'round '+round+' scores once');
    r.settled.push(shot);r.flight=null;if(round===9)await checkpoint();
  }
  check(new Set(seen).size===14 && seen[0]===0,'fourteen distinct stand-ins rotate independently of ten-throw rounds');
  check(r.phase==='play','fourteen hits continue into the second ten-throw round');
  for(let miss=0;miss<6;miss++){await t.ribbonStartPlay(performance.now());t.ribbonLaunch(r.window.mid,0,performance.now());t.ribbonOutcome(null,performance.now());if(miss<5){r.settled.push(r.flight);r.flight=null;}}
  check(r.phase==='resultWait' && r.attempts===20,'challenge completes ten throws and fails with four hits');
  t.ribbonTick(r.nextAt+1);for(let n=0;n<40&&r.phase==='resultWait';n++)t.ribbonTick(r.lastFrame+50);check(r.phase==='result','challenge transitions to result');
  async function rulesCase(pattern,expectedCount,cleared,label) {
    t.closeRibbonSummary();t.startGame('ribbon');await t.ribbonStartPlay(performance.now());
    for(let n=0;n<pattern.length;n++) {
      if(n)await t.ribbonStartPlay(performance.now());
      t.ribbonLaunch(r.window.mid,0,performance.now());const flight=r.flight;
      t.ribbonOutcome(pattern[n]?{seat:r.target,distance:.1}:null,performance.now());
      t.ribbonOutcome(null,performance.now());check(r.attempts===n+1,'one settlement per throw '+label+' '+n);
      if(r.phase==='resultWait'){if(n<pattern.length-1){await checkpoint();continue;}break;}
      check(n%10!==9 || ribbonDots.children.length===10,'ten progress dots');
      r.settled.push(flight);r.flight=null;
    }
    check(r.attempts===expectedCount && r.phase==='resultWait' && r.cleared===cleared,label);
    t.ribbonTick(r.nextAt+1);for(let n=0;n<40&&r.phase==='resultWait';n++)t.ribbonTick(r.lastFrame+50);check(r.phase==='result',label+' result');
    check(document.getElementById('ribbonRoundResults').children.length===Math.ceil(expectedCount/10),'only played round summaries');
  }
  const round=n=>Array.from({length:10},(_,i)=>i<n);
  await rulesCase(round(4),10,false,'first round 4 of 10 fails');
  await rulesCase([...round(5),...round(6)],20,false,'first round 5 passes; challenge 6 fails');
  await rulesCase([...round(5),...round(7),...round(0)],30,true,'challenge 7 passes; final has no hit threshold');
  await rulesCase([...round(5),...round(7),...round(10)],30,true,'five and seven qualify; final completes ten throws');
  // Long challenge: preserve 64 full ribbons; warm them to sleep, then require no physics changes.
  t.finishRibbonGame();
  const base=r.settled[0];check(!!base,'result keeps ribbon');
  for(let i=0;i<1200;i++)t.ribbonTickSettled(1/120);
  check(base.asleep,'settled ribbon sleeps');
  const time=base.time;
  while(r.settled.length<64) {
    const trail=t.ribbonMakeTrail('#ffbbee');
    const copy={...base,...trail,nodes:base.nodes.map(n=>({p:n.p.clone(),prev:n.prev.clone()})),anchor:base.anchor.clone(),roll:base.roll.clone(),meshCamera:base.meshCamera.clone(),sleepAnchor:base.sleepAnchor.clone(),sleepRoll:base.sleepRoll.clone()};
    t.ribbonUpdateMesh(copy);r.settled.push(copy);
  }
  const begin=performance.now();for(let i=0;i<1000;i++)t.ribbonTickSettled(1/120);
  check(base.time===time && r.settled.length===64,'64 sleeping ribbons retain display without physics');out.push('64 ribbons / 1000 ticks ms: '+(performance.now()-begin).toFixed(1));
  base.roll.x+=.05;t.ribbonTickSettled(1/60);check(!base.asleep,'endpoint motion wakes ribbon');
  t.renderer.render(t.scene,t.camera);
  const gpuGeometries=t.renderer.info.memory.geometries;
  const meshBefore=t.scene.children.length;
  t.closeRibbonSummary();check(t.scene.children.length<=meshBefore-128,'64 tape and roll meshes removed');check(t.renderer.info.memory.geometries<=gpuGeometries-64,'uploaded ribbon GPU geometries disposed');out.push('GPU geometry count: '+gpuGeometries+' -> '+t.renderer.info.memory.geometries);check(r.settled.length===0 && !r.flight && ribbonTargetMark.hidden,'return menu disposes ribbons');
  // Visibility event time compensation in countdown, flight, catch waiting and result.
  let hidden=false;Object.defineProperty(document,'hidden',{configurable:true,get:()=>hidden});
  t.startGame('ribbon');hidden=true;const hiddenSearch=t.ribbonStartPlay(performance.now());await new Promise(resolve=>setTimeout(resolve,30));check(r.phase==='selecting' && !r.target,'background search waits before publishing');hidden=false;await hiddenSearch;check(r.phase==='play','background search resumes');t.finishRibbonGame();t.closeRibbonSummary();
  t.startGame('ribbon');const cd=r.cdStart;hidden=true;document.dispatchEvent(new Event('visibilitychange'));r.pausedAt-=5000;hidden=false;document.dispatchEvent(new Event('visibilitychange'));check(r.cdStart>=cd+5000,'countdown compensated');
  await t.ribbonStartPlay(performance.now());t.ribbonLaunch((r.window.lo+r.window.hi)/2,0,performance.now());f=r.flight;
  const position=f.roll.clone();hidden=true;document.dispatchEvent(new Event('visibilitychange'));t.ribbonTick(performance.now()+5000);check(f.roll.equals(position),'hidden flight frozen');check(r.power===0,'background cancels swipe power');
  f.resolved=true;f.removeAt=performance.now()+900;r.nextAt=performance.now()+900;const remove=f.removeAt,next=r.nextAt;r.pausedAt-=5000;hidden=false;document.dispatchEvent(new Event('visibilitychange'));check(r.crowd.last===r.lastFrame,'audience reaction clock resumes without hidden time');check(f.removeAt>=remove+5000 && r.nextAt>=next+5000,'catch and next-target timestamps compensated');
  t.finishRibbonGame();hidden=true;document.dispatchEvent(new Event('visibilitychange'));const resultTime=r.settled[0].time;t.ribbonTick(performance.now()+5000);check(r.settled[0].time===resultTime,'result background frozen');hidden=false;document.dispatchEvent(new Event('visibilitychange'));
  t.closeRibbonSummary();t.setMode('seat');t.setMode('over');t.setMode('game');t.startGame();check(t.G2.phase==='countdown' && !r.active,'original modes and fan game still start');
  t.startGame('ribbon');
  for(let i=0;i<10;i++) {
    await t.ribbonStartPlay(performance.now());check(r.phase==='play','first lap failure test target '+i);
    t.ribbonLaunch(r.window.mid,0,performance.now());
    t.ribbonOutcome(i<3?{seat:r.target,distance:.1}:null,performance.now());
    check(r.attempts===i+1 && (i===9?r.phase==='resultWait':r.phase==='play'),'first-lap misses still complete all ten throws '+i);
    r.settled.push(r.flight);r.flight=null;
  }
  t.ribbonTick(r.nextAt+1);for(let n=0;n<40&&r.phase==='resultWait';n++)t.ribbonTick(r.lastFrame+50);check(r.phase==='result' && r.hits===3,'first lap below five hits ends after ten');t.closeRibbonSummary();
  t.startGame('ribbon');await t.ribbonStartPlay(performance.now());t.ribbonLaunch(r.window.mid,0,performance.now());
  t.onAudienceChanged();check(!r.active && r.phase==='idle' && !r.flight && !r.settled.length && !r.world && ribbonTargetMark.hidden,'settings change disposes flight and cancels session');
  t.startGame('ribbon');await t.ribbonStartPlay(performance.now());t.finishRibbonGame();document.getElementById('gMember').value='2';t.startGame('ribbon');check(r.roster[0]===2 && document.getElementById('startPanel').hidden,'replay after result preserves newly selected member and hides menu');t.finishRibbonGame();t.closeRibbonSummary();
  return out;
 },fixtures);
 console.log(report.join('\n'));assert.deepEqual(errors,[]);await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
