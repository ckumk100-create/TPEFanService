const THREE=require('three'),assert=require('node:assert/strict');require('../ribbon-world.js');
const scene=new THREE.Scene(),wall=new THREE.Mesh(new THREE.BoxGeometry(.05,2,2),new THREE.MeshBasicMaterial());wall.userData.ribbonBlocksTarget=true;wall.rotation.y=Math.PI/4;wall.position.set(2,1,0);scene.add(wall);
const empty=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial(),0),world=new global.RibbonWorld(THREE,scene,{pad:empty,back:empty,torso:empty,head:empty},[],{width:20,height:10,depth:20,z:0,platforms:new THREE.Group()});
const corner=new THREE.Vector3(2.6,1,-.6);assert.equal(world.collide(corner,null,.03).hit,false,'empty corner of rotated AABB must not be an invisible obstacle');
const inside=new THREE.Vector3(2,1,0),velocity=new THREE.Vector3(1,0,-1);assert(world.collide(inside,velocity,.03).hit,'visible rotated wall still collides');
const local=wall.worldToLocal(inside.clone());assert(Math.abs(local.x)>=.0549,'contact pushed outside actual wall, including roll radius');
console.log('rotated obstacle bounds: no invisible AABB corners; actual oriented wall collision passed');

assert(world.blocked(new THREE.Vector3(1,1,1),new THREE.Vector3(3,1,-1)),'pillar blocks sight and catch across its solid volume');
assert(!world.blocked(new THREE.Vector3(-2,1,3),new THREE.Vector3(-2,1,-3)),'unobstructed direction remains usable');

const actor=new THREE.Group();actor.position.set(-3,1,0);actor.add(new THREE.Mesh(new THREE.BoxGeometry(.4,1.5,.3),new THREE.MeshBasicMaterial()));scene.add(actor);world.setActors([{i:7,g:actor}]);
assert(world.blocked(new THREE.Vector3(-3,1,-1),new THREE.Vector3(-3,1,1),0),'standing member blocks target sight');
assert(!world.blocked(new THREE.Vector3(-3,1,-1),new THREE.Vector3(-3,1,1),7),'own hidden model excluded');
let bodyPoint=new THREE.Vector3(-3,1,0),bodyVelocity=new THREE.Vector3(0,0,4);assert.equal(world.collide(bodyPoint,bodyVelocity,.03,0).actor,7,'standing member physically collides');
assert(!world.collide(new THREE.Vector3(-3,1,0),null,.03,7).hit,'own model cannot obstruct release');
const snapshot=world.snapshotActors(),revision=world.actorRevision();world.setActors([{i:7,g:actor}]);assert.equal(world.actorRevision(),revision,'unchanged poses keep cache revision');actor.position.x=-5;world.setActors([{i:7,g:actor}]);assert(!world.blocked(new THREE.Vector3(-3,1,-1),new THREE.Vector3(-3,1,1),0),'old body location removed');assert(world.blocked(new THREE.Vector3(-3,1,-1),new THREE.Vector3(-3,1,1),0,snapshot),'asynchronous search retains immutable pose snapshot');world.setActors([]);assert.equal(world.actorBounds().length,0);
console.log('member sight / physical collision / self exclusion / pose update / stable snapshot / cleanup passed');

const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),appRoot=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(appRoot,'index.html'),'utf8');
for(const name of ['ribbon-world.js','ribbon-records.js','ribbon-crowd.js']){const digest=crypto.createHash('sha256').update(fs.readFileSync(path.join(appRoot,name))).digest('hex').slice(0,12);assert(html.includes('./'+name+'?v='+digest),'deployment must version runtime assets by their content');}
console.log('runtime asset versions match content hashes');

const bodyScene=new THREE.Scene(),bodyIM={};for(const name of ['pad','back','torso','head']){const mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(.4,1,.3),new THREE.MeshBasicMaterial(),1);mesh.setMatrixAt(0,name==='torso'?new THREE.Matrix4().makeTranslation(0,1,0):new THREE.Matrix4().makeScale(0,0,0));bodyIM[name]=mesh;}
const movingWorld=new global.RibbonWorld(THREE,bodyScene,bodyIM,[{i:0}],{width:20,height:10,depth:20,z:0,platforms:new THREE.Group()}),bodies=movingWorld.snapshotBodies();movingWorld.updateAudience(0,{torso:new THREE.Matrix4().makeTranslation(2,1,0)});assert.equal(movingWorld.collide(new THREE.Vector3(0,1,0),null,.03).hit,false,'old body position is cleared');assert.equal(movingWorld.collide(new THREE.Vector3(0,1,0),null,.03,undefined,undefined,bodies).audience,0,'in-flight and batched searches retain immutable body snapshots');const fixed=new THREE.Vector3(2,1,1),free=new THREE.Vector3(2,1,-1),unchanged=fixed.clone();assert(movingWorld.bodyCrosses(free,fixed));movingWorld.constrainBodySegment(free,fixed,true,false,.012);assert(fixed.equals(unchanged)&&!movingWorld.bodyCrosses(free,fixed),'body link chooses the fixed hand side without moving the hand');console.log('moving audience collision / immutable body snapshot / fixed-end segment resolution passed');

assert(!movingWorld.blocked(new THREE.Vector3(2,1,-1),new THREE.Vector3(2,1,1),7),'audience body does not hide DOM head marker');assert(movingWorld.pickupBlocked(new THREE.Vector3(2,1,-1),new THREE.Vector3(2,1,1),1,7),'other audience still blocks physical pickup');assert(!movingWorld.pickupBlocked(new THREE.Vector3(2,1,-1),new THREE.Vector3(2,1,1),0,7),'pickup ignores only the reaching spectator body');console.log('head marker overlay and physical pickup obstruction remain separate');

const supportNodes=[{p:new THREE.Vector3(1.9,1.514,0)},{p:new THREE.Vector3(2.1,1.514,0)}],supportRevision=movingWorld.bodyRevision();movingWorld.updateAudience(0,{torso:new THREE.Matrix4().makeTranslation(3,1,0)});assert(movingWorld.touchesChanged(supportNodes,supportRevision),'removing a body support wakes a nearby resting ribbon');assert(!movingWorld.touchesChanged([{p:new THREE.Vector3(-5,3,0)},{p:new THREE.Vector3(-4,3,0)}],supportRevision),'distant body changes do not wake unrelated ribbons');console.log('moving support and selective sleeping-ribbon wake passed');
