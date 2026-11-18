/* TPE-specific persistence of the reference game's delivery grid and milestones.
 * Reference behavior: https://tape-throw.pages.dev/ (see SOURCES.md).
 * Stores game counters only; no identity, account, or audience personal data. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.RibbonRecords=factory();})(typeof window==='undefined'?globalThis:window,function(){
  'use strict';
  var titles=[
    ['first','第一條彩帶','累計送達 1 條彩帶'],['six','送達六條','單次挑戰命中 6 次'],['eight','前八投全中','單次挑戰前 8 投全部命中'],
    ['sixteen','兩輪全中','單次挑戰前 20 投全部命中'],['twentyfour','三輪全中','單次挑戰 30 投全部命中'],
    ['perfect3','完美三投','單次挑戰完美接取 3 次'],['row4','後排完美','C 排完美接取（保留既有 D 排成就）'],['member','一人全排','同一位成員完成七排中的全部可達記錄'],
    ['total50','累計五十條','累計送達 50 條彩帶'],['perfect30','累計三十次完美','累計完美接取 30 次'],
    ['grid','實績全收集','當次成員的可達格全部命中'],['allperfect','全格完美','當次成員的可達格全部完美']
  ];
  function count(v){return Number.isSafeInteger(v)&&v>=0?Math.min(v,1000000000):0;}
  function create(storage){
    var key='TPEFanService.ribbon.v1',data={version:1,rules:3,plays:0,hits:0,perfects:0,bestHit:0,bestPerfect:0,grid:{},available:{},titles:[]},warning='';
    try {var saved=JSON.parse(storage.getItem(key)||'null');if(saved&&saved.version===1){
      ['plays','hits','perfects','bestHit','bestPerfect'].forEach(function(k){data[k]=count(saved[k]);});
      ['grid','available'].forEach(function(k){if(saved[k]&&typeof saved[k]==='object')Object.keys(saved[k]).slice(0,10000).forEach(function(id){if(/^\d+:\d+:[ABCDNOPQ]$/.test(id)){var v=saved[k][id];if(k==='grid'&&(v===1||v===2)||k==='available'&&typeof v==='boolean')data[k][id]=v;}});});
      data.titles=titles.filter(function(t){return Array.isArray(saved.titles)&&saved.titles.includes(t[0]);}).map(function(t){return t[0];});
      if((!saved.rules||saved.rules<2))data.titles=data.titles.filter(function(id){return !['sixteen','twentyfour','member','grid','allperfect'].includes(id);});
    }}catch(error){warning='無法讀取既有實績，先以本次使用的記錄顯示。';}
    function save(){try{storage.setItem(key,JSON.stringify(data));}catch(error){warning='瀏覽器未允許儲存，實績暫時只保留在本次使用。';}}
    function id(team,member,row){return team+':'+member+':'+row;}
    function get(team,member,row){return data.grid[id(team,member,row)]||0;}
    function grant(name){if(!data.titles.includes(name)){data.titles.push(name);return name;}return null;}
    function totals(){if(data.hits>=1)grant('first');if(data.hits>=50)grant('total50');if(data.perfects>=30)grant('perfect30');}
    function hit(team,member,row,perfect){
      data.hits++;if(perfect)data.perfects++;
      if(/^[ABCDNOPQ]$/.test(row)){var cell=id(team,member,row);data.grid[cell]=Math.max(get(team,member,row),perfect?2:1);data.available[cell]=true;}
      totals();save();
    }
    function available(team,member,row){var cell=id(team,member,row);return Object.prototype.hasOwnProperty.call(data.available,cell)?data.available[cell]:null;}
    function setAvailable(team,member,row,value){data.available[id(team,member,row)]=!!value||get(team,member,row)>0;}
    function collection(team,roster){
      var known=0,cells=0,got=0,pf=0;
      roster.forEach(function(member){var memberKnown=0,memberCells=0,memberGot=0;
        'ABCNOPQ'.split('').forEach(function(row){var a=available(team,member,row);if(a!==null){known++;memberKnown++;}if(a){cells++;memberCells++;var value=get(team,member,row);if(value){got++;memberGot++;}if(value===2)pf++;}});
        if(memberKnown===7&&memberCells>0&&memberGot===memberCells)grant('member');
      });
      if(known===roster.length*7&&cells>0){if(got===cells)grant('grid');if(pf===cells)grant('allperfect');}
      return {known:known,cells:cells,got:got,perfect:pf,total:roster.length*7};
    }
    function finish(results,team,roster,countPlay){
      var before=data.titles.slice(),hits=results.filter(function(r){return r.ok;}).length,perfect=results.filter(function(r){return r.perfect;}).length;
      if(results.length&&countPlay!==false)data.plays++;
      if(hits>data.bestHit||hits===data.bestHit&&perfect>data.bestPerfect){data.bestHit=hits;data.bestPerfect=perfect;}
      if(hits>=6)grant('six');if(hits>=8&&results.slice(0,8).every(function(r){return r.ok;}))grant('eight');
      if(results.length>=20&&results.slice(0,20).every(function(r){return r.ok;}))grant('sixteen');if(results.length>=30&&results.slice(0,30).every(function(r){return r.ok;}))grant('twentyfour');if(perfect>=3)grant('perfect3');if(results.some(function(r){return r.perfect&&(r.row==='C'||r.row==='D');}))grant('row4');
      totals();collection(team,roster);save();return data.titles.filter(function(t){return !before.includes(t);});
    }
    return {get:get,hit:hit,available:available,setAvailable:setAvailable,collection:collection,finish:finish,save:save,titles:titles,snapshot:function(){return JSON.parse(JSON.stringify(data));},warning:function(){return warning;}};
  }
  return {create:create};
});
