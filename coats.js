/* coats.js — coat patterns + body proportions by age. Shared by the page and the build worker. */
(function(G){'use strict';
var C=G.CAT3D,H=C.H,mix=C.mix,sm=C.sm,S1=C.S1,nz3=C.nz3,headLocal=C.headLocal;

/* black-and-white "tuxedo": black coat, white bib, belly, muzzle blaze and socks */
var BK=H('#232026'),BK2=H('#3a3540'),WH=H('#f7f3ee'),PK=H('#f3a7b6');
function tuxedoColor(p,n,J,S,hc){
  var x=p[0]/S,y=p[1]/S,z=p[2]/S,h=headLocal(p,S,hc),hd=Math.sqrt(h[0]*h[0]+h[1]*h[1]+h[2]*h[2]),e=nz3(x,y,z)*0.6,Hf=1+(hc[1]/S-0.6)/0.07,c;
  if(hd<0.2*Hf+0.04&&h[1]>-0.15*Hf){
    c=mix(BK,BK2,sm(-0.2,0.6,n[1])*0.5);
    var muzzle=(1-S1(-0.028*Hf+e*0.5,h[1],0.012))*S1(0.045*Hf,h[2],0.02);
    var blaze=(1-S1(0.02+e*0.4,Math.abs(h[0]),0.008))*S1(0.035,h[2],0.02)*(1-S1(0.06*Hf,h[1],0.015));
    c=mix(c,WH,Math.max(muzzle,blaze));
    return mix(c,PK,S1(0.075*Hf,Math.abs(h[0]),0.008)*S1(0.13*Hf,h[1],0.01)*S1(0.15,n[2],0.1));}
  if(z<-0.36&&y>0.26)return BK;
  c=mix(BK,BK2,sm(-0.1,0.8,n[1])*0.45);
  var bib=S1(0.16,z,0.03)*(1-S1(0.44,y,0.03))*S1(0.1,y,0.02)*(1-S1(0.11+e,Math.abs(x),0.02));
  var belly=sm(-0.3,-0.6,n[1])*(1-S1(0.3,y,0.02));
  var socks=1-S1(0.075+e*0.5,y,0.012);
  return mix(c,WH,Math.max(bib,belly,socks));
}

var COATS={
  cam:   {name:'Mướp cam',  color:C.tabbyColor,  iris:['#c98d3e','#3a200d'], nose:'#ee8fa2', lip:'#5e3138', whisker:'#fbf3ec', blush:'#ff97b0', bean:'#ff9db5', swatch:['#f4a057','#d5733a','#fff0dc']},
  tamthe:{name:'Tam thể',   color:C.calicoColor, iris:['#9cc35e','#2c4718'], nose:'#f39cb1', lip:'#7e4f57', whisker:'#e6dcd6', blush:'#ffa3ba', bean:'#ffa3b9', swatch:['#fbf6f1','#f0a159','#8e7f7b']},
  mun:   {name:'Mun tuxedo',color:tuxedoColor,   iris:['#cfd85c','#3b4a12'], nose:'#2b2428', lip:'#140f12', whisker:'#f4f1ee', blush:'#d98a9c', bean:'#3a2f35', swatch:['#232026','#f7f3ee','#cfd85c']}
};
var KITTEN_IRIS=['#86bde9','#1f3466'];   // every kitten starts with blue eyes

/* age stage k = 0..4  ->  build options (kitten: big head, short legs, round & fluffy) */
var STAGES=5;
/* the player's shape settings: style 0 = realistic, 1 = cute; the rest are multipliers around 1 */
var SHAPE0={style:0.45,head:1,eye:1,ear:1,body:1,fat:1,leg:1,tail:1};
function shapeOf(sh){var o={};for(var k in SHAPE0)o[k]=sh&&typeof sh[k]==='number'?sh[k]:SHAPE0[k];return o}
function shapeKey(sh){var o=shapeOf(sh),a=[];for(var k in SHAPE0)a.push(Math.round(o[k]*100));return a.join('.')}
function catParams(coat,k,shape){
  var cf=COATS[coat]||COATS.cam,g=k/(STAGES-1),eyeG=sm(0,0.45,g),sh=shapeOf(shape),cu=sh.style;
  function L(a,b){return a+(b-a)*cu}
  var iris=[mix(H(KITTEN_IRIS[0]),H(cf.iris[0]),eyeG),mix(H(KITTEN_IRIS[1]),H(cf.iris[1]),eyeG)];
  return {S:0.8+0.8*g, fat:(1.0+0.22*g)*sh.fat, head:(1.5-0.3*g)*L(0.8,1.02)*sh.head, leg:0.9+0.16*g, legL:L(1.1,0.95)*sh.leg, tail:0.82+0.4*g, tailL:sh.tail,
    body:L(1.06,0.95)*sh.body, ear:L(1.04,0.94)*sh.ear, lash:L(0.2,1), blushK:L(0,0.4), cell:0.0145,
    color:cf.color, iris:iris, nose:H(cf.nose), lip:H(cf.lip), whisker:H(cf.whisker), blush:H(cf.blush), bean:H(cf.bean),
    eyeK:(1.16-0.12*g)*L(0.76,1.0)*sh.eye, shells:12, furLen:(0.015-0.003*g)*L(0.85,1.15), furDen:380};
}
/* plain, clonable copy of a built cat (no functions), with typed arrays */
function pack(o){
  if(Array.isArray(o)){
    if(o.length&&typeof o[0]==='number')return o.slice();
    return o.map(pack);}
  if(o&&typeof o==='object'&&!(o instanceof Float32Array)&&!(o instanceof Uint32Array)){
    var r={};for(var k in o){if(k==='D'||typeof o[k]==='function')continue;
      if((k==='P'||k==='N'||k==='C'||k==='UV'||k==='B'||k==='W')&&Array.isArray(o[k]))r[k]=new Float32Array(o[k]);
      else if(k==='I'&&Array.isArray(o[k]))r[k]=new Uint32Array(o[k]);
      else r[k]=pack(o[k]);}
    return r;}
  return o;
}
function buildPacked(coat,k,shape){return pack(C.buildCat(catParams(coat,k,shape)))}
G.COATS=COATS;G.SHAPE0=SHAPE0;G.shapeOf=shapeOf;G.shapeKey=shapeKey;G.CAT_STAGES=STAGES;G.catParams=catParams;G.buildPacked=buildPacked;
})(typeof self!=='undefined'?self:this);
