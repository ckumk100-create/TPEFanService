const {chromium}=require('playwright');const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try {
  const page=await browser.newPage({viewport:{width:1100,height:760}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  let html=process.argv.includes('--baseline')?execFileSync('git',['show','HEAD:index.html'],{cwd:root,encoding:'utf8',maxBuffer:8*1024*1024}):fs.readFileSync(path.join(root,'index.html'),'utf8');
  html=html.replaceAll('requestAnimationFrame(frame);','').replace('})();\n</script>','window.reviewRibbon={RIBBON,S,camera,seats,performers,startGame,ribbonStartPlay,ribbonLaunch,ribbonCatchAt,ribbonStepRoll,ribbonTick,ribbonTickSettled,ribbonDrawPreview,ribbonUpdateMarker,ribbonFaceTarget,resize,updateCamera,headWorld,finishRibbonGame,closeRibbonSummary};\n})();\n</script>');
  await page.route('**/TPEFanService/',r=>r.fulfill({body:html,contentType:'text/html'}));await page.route('**/ribbon-world.js*',r=>r.fulfill({body:fs.readFileSync(path.join(root,'ribbon-world.js')),contentType:'application/javascript'}));await page.route('**/ribbon-crowd.js*',r=>r.fulfill({body:fs.readFileSync(path.join(root,'ribbon-crowd.js')),contentType:'application/javascript'}));await page.route('**/three.min.js',r=>r.fulfill({body:fs.readFileSync(require.resolve('three/build/three.min.js')),contentType:'application/javascript'}));
  await page.route('**/ribbon-records.js*',r=>r.fulfill({body:fs.readFileSync(path.join(root,'ribbon-records.js')),contentType:'application/javascript'}));
 await page.goto('http://ribbon.test/TPEFanService/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.reviewRibbon);
  const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'reference-roll-fixtures.json'),'utf8'));
  const cases=await page.evaluate(async fixture=>{
   const t=reviewRibbon,r=t.RIBBON,out=[];t.startGame('ribbon');await t.ribbonStartPlay(performance.now());
   const actualWorld=r.world,actualGrid=r.catchGrid;r.world={collide:()=>({hit:false,landed:false})};r.catchGrid=new Map();
   const f={roll:new THREE.Vector3(...fixture.origin),velocity:new THREE.Vector3(...fixture.velocity.slice(0,3)),tilt:fixture.velocity[3],paid:0,apex:fixture.origin[1],hit:false,time:0};
   for(let i=1;i<=24;i++){t.ribbonStepRoll(f,t.seats[0]);const expected=fixture.snapshots.find(x=>x.steps===i);if(expected){const actual=[f.roll.x,f.roll.y,f.roll.z,f.velocity.x,f.velocity.y,f.velocity.z,f.paid,f.time],values=[expected.x,expected.y,expected.z,expected.vx,expected.vy,expected.vz,expected.paid,expected.time],error=Math.max(...actual.map((v,j)=>Math.abs(v-values[j])));out.push({name:'reference roll parity after '+i+' tape steps',pass:error<1e-10,maxError:error});}}
   r.world=actualWorld;
   const pillars=r.world.boxes.filter(b=>b.blocksTarget),columnCases=[];
   for(const box of pillars)for(const axis of ['x','z'])for(const sign of [-1,1]){
     const center=box.getCenter(new THREE.Vector3());center.y=2;
     center[axis]=sign<0?box.min[axis]-.2:box.max[axis]+.2;
     const velocity=new THREE.Vector3();velocity[axis]=-sign*11.99;
     const roll={roll:center,velocity,tilt:0,paid:0,apex:center.y,hit:false,time:0};let crossed=false;
     for(let i=0;i<12;i++){t.ribbonStepRoll(roll,t.seats[0]);if(sign<0?roll.roll[axis]>box.min[axis]-.029:roll.roll[axis]<box.max[axis]+.029)crossed=true;}
     columnCases.push({axis,sign,hit:roll.hit,crossed,bounced:sign*roll.velocity[axis]>0});
   }
   out.push({name:'both actual TPE pillars physically block maximum-speed rolls from four directions',pass:pillars.length===2&&columnCases.every(c=>c.hit&&!c.crossed&&c.bounced),columns:pillars.length,cases:columnCases});
   const near={i:-11,headZ:0},far={i:-12,headZ:0};r.catchGrid=new Map([['0:0',[{seat:near,x:.1,y:1.05,z:0,floor:0,k:1,inverse:new THREE.Matrix4().makeTranslation(0,0,-.3),shoulder:new THREE.Vector3(.2,1,0)},{seat:far,x:.2,y:1.25,z:0,floor:0,k:1,inverse:new THREE.Matrix4().makeTranslation(0,0,-.3),shoulder:new THREE.Vector3(.2,1,0)}]]]);
   const catchResult=t.ribbonCatchAt(new THREE.Vector3(0,1.5,0),{i:-99});out.push({name:'other spectators ranked by actual 3D catch distance without target priority',pass:catchResult.seat===far&&Math.abs(catchResult.distance-.2)<1e-8});
   r.catchGrid=actualGrid;
   t.ribbonLaunch(r.window.mid,0,performance.now());const interrupted=r.flight,start=interrupted.roll.clone();t.finishRibbonGame();
   for(let i=0;i<190;i++)t.ribbonTick(r.lastFrame+17);
   out.push({name:'interrupted flight completes visually without scoring',pass:interrupted.resolved && interrupted.roll.distanceTo(start)>.01 && r.attempts===0,distance:interrupted.roll.distanceTo(start),resolved:interrupted.resolved,attempts:r.attempts});
   const visual=r.settled.find(f=>!f.decorative);visual.catchFrom=visual.roll.clone();visual.catchTo=visual.receiver?visual.receiver.hold.clone():visual.roll.clone().add(new THREE.Vector3(0,.2,0));visual.catchAge=0;for(let i=0;i<24;i++)t.ribbonTickSettled(.05);
   out.push({name:'catch reaction finishes after transfer to settled ribbons',pass:visual.catchAge>0&&visual.roll.distanceTo(visual.pickup&&visual.receiver?visual.receiver.hand:visual.catchTo)<1e-6});
   let updates=0;const originals=t.performers.map(p=>p.g.updateMatrixWorld);t.performers.forEach(p=>p.g.updateMatrixWorld=function(...args){updates++;return originals[p.i].apply(this,args)});
   const ctx=document.getElementById('ribbonPreview').getContext('2d'),clear=ctx.clearRect;let clears=0;ctx.clearRect=function(...args){clears++;return clear.apply(this,args)};
   for(let i=0;i<100;i++)t.ribbonTick(r.lastFrame+17);
   out.push({name:'completed finale skips per-ribbon skeleton walks',pass:updates===0,skeletonUpdates:updates});out.push({name:'idle result skips empty preview redraw',pass:clears===0,previewClears:clears});
   t.performers.forEach((p,i)=>p.g.updateMatrixWorld=originals[i]);ctx.clearRect=clear;
   t.closeRibbonSummary();t.startGame('ribbon');await t.ribbonStartPlay(performance.now());
   t.S.yaw+=.4;t.updateCamera();t.ribbonUpdateMarker();const marker=document.getElementById('ribbonTargetMark'),left=parseFloat(marker.style.left),top=parseFloat(marker.style.top);t.camera.updateMatrixWorld(true);const p=new THREE.Vector3();t.headWorld(r.target,p);p.project(t.camera);const view=document.getElementById('view'),x=(p.x+1)*view.clientWidth/2,y=(1-p.y)*view.clientHeight/2;out.push({name:'ribbon marker uses current camera before renderer',pass:Math.abs(left-x)<.01&&Math.abs(top-y)<.01,pixelError:Math.hypot(left-x,top-y)});
   const canvas=document.getElementById('gl'),box=canvas.getBoundingClientRect();canvas.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:19,pointerType:'touch',isPrimary:true,clientX:box.x+box.width/2,clientY:box.y+box.height*.8}));
   out.push({name:'swipe started before orientation change',pass:!!r.gesture});return out;
  },fixture);
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(150);
  cases.push(...await page.evaluate(()=>{const t=reviewRibbon,r=t.RIBBON;t.resize();const fov=t.camera.fov;t.updateCamera();return[{name:'ribbon rotation cancels old-coordinate swipe',pass:!r.gesture&&r.power===0},{name:'ribbon resize updates lens immediately',pass:Math.abs(fov-t.camera.fov)<1e-8,resizeFov:fov,expected:t.camera.fov}]}));
  cases.push(await page.evaluate(()=>{const t=reviewRibbon,r=t.RIBBON,target=r.target,yaw=t.S.yaw;t.ribbonFaceTarget();t.ribbonLaunch(r.window.mid,80,performance.now());for(let i=0;i<15;i++)t.ribbonTick(r.lastFrame+17);const change=Math.abs(Math.atan2(Math.sin(t.S.yaw-yaw),Math.cos(t.S.yaw-yaw)));return{name:'wild throw follows roll without changing target',pass:change>.01&&r.target===target,yawChange:change}}));
  console.log(JSON.stringify(cases,null,2));assert.deepEqual(errors,[]);assert(cases.every(x=>x.pass),'ribbon review regressions: '+cases.filter(x=>!x.pass).map(x=>x.name).join('; '));
 } finally {await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
