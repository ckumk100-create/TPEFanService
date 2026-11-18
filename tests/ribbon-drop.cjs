// Actual divider geometry and actual result/rope ticks; cover both sides and edge placements.
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');const root=path.resolve(__dirname,'..');
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});try{
 const page=await browser.newPage({viewport:{width:1100,height:760}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 let html=fs.readFileSync(path.join(root,'index.html'),'utf8').replaceAll('requestAnimationFrame(frame);','').replace('})();\n</script>','window.dropTest={RIBBON,S,scene,applyStage,startGame,finishRibbonGame,ribbonMakeTrail,ribbonAddPoint,ribbonPrepareDrop,ribbonTick,ribbonDisposeSpool,closeRibbonSummary};\n})();\n</script>');
 await page.route('**/TPEFanService/',r=>r.fulfill({body:html,contentType:'text/html'}));for(const file of ['ribbon-world.js','ribbon-records.js','ribbon-crowd.js'])await page.route('**/'+file+'*',r=>r.fulfill({body:fs.readFileSync(path.join(root,file)),contentType:'application/javascript'}));await page.route('**/three.min.js',r=>r.fulfill({body:fs.readFileSync(require.resolve('three/build/three.min.js')),contentType:'application/javascript'}));await page.goto('http://ribbon.test/TPEFanService/');await page.waitForFunction(()=>window.dropTest);
 const result=await page.evaluate(()=>{const t=dropTest,r=t.RIBBON;t.startGame('ribbon');t.finishRibbonGame();let cases=0,segments=0,maxSlide=0;const failures=[];
  const scenarios=[];for(const sign of [-1,1])for(const hold of [3.49,3.54,3.55,3.58,3.61])for(const target of [4.37,5.27])for(const height of [1,1.6])for(const dz of [-1,0,1])scenarios.push({stage:0,sign,hold,target,height,dz});for(const stage of [.4,.8])for(const sign of [-1,1])scenarios.push({stage,sign,hold:3.55,target:4.37,height:1,dz:0});
  for(const {stage,sign,hold,target,height,dz} of scenarios){
   if(stage!==t.S.stageH){t.closeRibbonSummary();t.S.stageH=stage;t.applyStage();t.startGame('ribbon');t.finishRibbonGame();}
   const f=t.ribbonMakeTrail('#ff77aa');f.owner=sign<0?6:10;f.anchor=new THREE.Vector3(sign*hold,t.S.stageH+.99,-4);f.roll=new THREE.Vector3(sign*target,height,-4+dz);f.velocity=new THREE.Vector3();f.resolved=true;f.paid=0;f.time=0;f.acc=0;f.lastLen=.12;
   const count=Math.ceil(f.anchor.distanceTo(f.roll)/.12)+3;for(let i=0;i<=count;i++){const p=f.anchor.clone().lerp(f.roll,i/count);p.y+=.25*Math.sin(Math.PI*i/count);t.ribbonAddPoint(f,p);}f.finaleFrom=f.anchor.clone();t.ribbonPrepareDrop(f);r.settled=[f];r.resultAge=0;r.finaleDone=false;r.photoAttempted=true;r.lastFrame=performance.now();
   for(let frame=0;frame<360;frame++){
    t.ribbonTick(r.lastFrame+1000/120);
    for(let i=1;i<f.nodes.length;i++){segments++;if(r.world.barrierCrosses(f.nodes[i-1].p,f.nodes[i].p)){failures.push({sign,hold,target,height,dz,frame,segment:i,a:f.nodes[i-1].p.toArray(),b:f.nodes[i].p.toArray()});break;}}
    if(failures.length)break;
   }
   maxSlide=Math.max(maxSlide,Math.abs(f.anchor.x-f.finaleFrom.x));if(failures.length)return {cases:cases+1,segments,maxSlide,failures};if(f.anchor.distanceTo(f.dropRoute.floor)>1e-6)throw Error('released end did not reach safe floor');
   t.scene.remove(f.mesh);f.geo.dispose();f.mesh.material.dispose();t.ribbonDisposeSpool(f.rollMesh);r.settled=[];cases++;if(failures.length)break;
  }
  t.closeRibbonSummary();return {cases,segments,maxSlide,failures};
 });console.log(JSON.stringify(result,null,2));assert.equal(result.cases,124);assert.deepEqual(result.failures,[]);assert(result.maxSlide<.15);assert.deepEqual(errors,[]);
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
