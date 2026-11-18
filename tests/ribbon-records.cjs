const assert=require('node:assert/strict'),{create}=require('../ribbon-records.js');let value=null;const storage={getItem:()=>value,setItem:(_,v)=>value=v};let records=create(storage);const roster=Array.from({length:8},(_,i)=>i);
for(const member of roster)for(const row of 'ABCDNOPQ')records.setAvailable(0,member,row,true);
for(const member of roster)for(const row of 'ABCDNOPQ')records.hit(0,member,row,true);
records.finish(roster.map(member=>({ok:true,perfect:true,row:'D',member})),0,roster);
assert.deepEqual(records.collection(0,roster),{known:56,cells:56,got:56,perfect:56,total:56});
records=create(storage);assert.equal(records.get(0,7,'D'),2);assert.equal(records.get(1,7,'D'),0);assert.equal(records.snapshot().bestHit,8);assert(records.snapshot().titles.includes('allperfect'));assert(records.snapshot().titles.includes('eight'));
const saved=records.snapshot();records.hit(0,0,'A',false);assert.equal(records.get(0,0,'A'),2,'normal hit cannot downgrade perfect');assert.equal(saved.hits+1,records.snapshot().hits);
const limited=create({getItem:()=>'{corrupt',setItem:()=>{throw Error('quota')}});limited.hit(0,0,'A',true);assert.equal(limited.get(0,0,'A'),2);assert(limited.warning().includes('本次'));
console.log('record persistence, per-member rows, best score, milestones, perfect preservation and storage errors passed');

records.setAvailable(0,0,'A',false);assert.equal(records.available(0,0,'A'),true,'previously delivered cell remains reachable');

records.hit(0,3,'N',true);records.hit(0,3,'P',false);records=create(storage);assert.equal(records.get(0,3,'N'),2);assert.equal(records.get(0,3,'P'),2);assert.equal(records.collection(0,roster).total,56,'collection includes active front and side rows, preserving historical D separately');

const plays=records.snapshot().plays;records.finish(Array.from({length:20},()=>({ok:true,perfect:false,row:'A',member:0})),0,roster,false);assert.equal(records.snapshot().plays,plays,'round checkpoints must not count extra games');assert.equal(records.snapshot().bestHit,20,'checkpoint best totals remain cumulative');

const fresh=()=>create({getItem:()=>null,setItem:()=>{}});
for(const hits of [16,24]){const r=fresh();let remaining=hits;const results=Array.from({length:30},(_,i)=>({ok:i%5!==0&&remaining-->0}));r.finish(results,0,[0]);assert(!r.snapshot().titles.includes('sixteen'));assert(!r.snapshot().titles.includes('twentyfour'));}
const rounds=fresh();rounds.finish(Array.from({length:19},()=>({ok:true})),0,[0]);assert(!rounds.snapshot().titles.includes('sixteen'));rounds.finish(Array.from({length:20},()=>({ok:true})),0,[0],false);assert(rounds.snapshot().titles.includes('sixteen'));assert(!rounds.snapshot().titles.includes('twentyfour'));rounds.finish(Array.from({length:30},()=>({ok:true})),0,[0],false);assert(rounds.snapshot().titles.includes('twentyfour'));
const side=fresh();for(const row of 'ABCDNOPQ')side.setAvailable(0,0,row,true);for(const row of 'ABCD')side.hit(0,0,row,true);side.collection(0,[0]);assert(!side.snapshot().titles.includes('grid'));assert(!side.snapshot().titles.includes('member'));for(const row of 'NOPQ')side.hit(0,0,row,true);side.collection(0,[0]);assert(side.snapshot().titles.includes('grid'));assert(side.snapshot().titles.includes('allperfect'));
const migrated=create({getItem:()=>JSON.stringify({version:1,hits:24,grid:{'0:0:N':2},titles:['first','sixteen','twentyfour','member','grid','allperfect']}),setItem:()=>{}});assert.deepEqual(migrated.snapshot().titles,['first']);assert.equal(migrated.snapshot().hits,24);assert.equal(migrated.get(0,0,'N'),2);const stored=JSON.stringify(Object.assign(rounds.snapshot(),{titles:['sixteen','twentyfour']}));assert.deepEqual(create({getItem:()=>stored,setItem:()=>{}}).snapshot().titles,['sixteen','twentyfour']);
console.log('20/30 all-hit milestones, side collection and legacy migration passed');

const active=fresh();for(const row of 'ABCNOPQ'){active.setAvailable(0,0,row,true);active.hit(0,0,row,true);}active.setAvailable(0,0,'D',true);active.collection(0,[0]);assert(active.snapshot().titles.includes('grid'));assert(active.snapshot().titles.includes('allperfect'));assert.equal(active.get(0,0,'D'),0);active.finish([{ok:true,perfect:true,row:'C'}],0,[0]);assert(active.snapshot().titles.includes('row4'));const v2=create({getItem:()=>JSON.stringify({version:1,rules:2,grid:{'0:0:D':2},titles:['sixteen','grid','row4']}),setItem:()=>{}});assert.equal(v2.get(0,0,'D'),2);assert.deepEqual(v2.snapshot().titles,['sixteen','row4','grid']);console.log('active A-C / side collection, C-row title and historical D preservation passed');
