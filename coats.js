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

/* one painter for the photo-referenced coats. All colours are hex.
   base / dark = coat and its markings, white = pale parts, ear = inner ear.
   stripes 0..1 tabby strength · bib 0..1 how far the white reaches (muzzle, chest, belly, paws) ·
   snow = almost all white · points = darker ears, mask and tail (colourpoint, ragdoll) · cap = colour only on top of the head */
function painter(q){
  var B=H(q.base),D=H(q.dark),W=H(q.white),E=H(q.ear||'#eeb0b4'),K=q.stripes||0,bib=q.bib===undefined?0.4:q.bib;
  return function(p,n,J,S,hc){
    var x=p[0]/S,y=p[1]/S,z=p[2]/S,h=headLocal(p,S,hc),hd=Math.sqrt(h[0]*h[0]+h[1]*h[1]+h[2]*h[2]),e=nz3(x,y,z)*0.7,Hf=1+(hc[1]/S-0.6)/0.07,c=B;
    if(hd<0.2*Hf+0.04&&h[1]>-0.15*Hf){
      var ax=Math.abs(h[0]),inEar=S1(0.075*Hf,ax,0.012)*S1(0.13*Hf,h[1],0.015)*S1(0.15,n[2],0.12);
      /* forehead M, cheek lines, line running back from the outer eye corner */
      c=mix(c,D,K*sm(0.35,0.92,Math.cos(h[0]*92/Hf+e*10))*S1(0.055*Hf,h[1],0.022)*S1(-0.04,h[2],0.035)*(1-S1(0.095*Hf,ax,0.022)));
      c=mix(c,D,K*S1(0.115*Hf,ax,0.022)*S1(0,h[2],0.035)*sm(0.35,0.92,Math.sin(h[1]*105/Hf+ax*40+1+e*8))*S1(-0.075*Hf,h[1],0.02));
      if(q.points){c=mix(c,D,q.points*S1(0.085*Hf,ax,0.03)*S1(-0.03*Hf,h[1],0.04));}
      /* muzzle, chin and the blaze up the nose */
      var muzzle=(1-S1((-0.045+0.03*bib)*Hf+e*0.4,h[1],0.022))*S1(0.03,h[2],0.03)*(1-S1((0.075+0.06*bib)*Hf,ax,0.025));
      var blaze=bib>0.6?(1-S1((0.018+(0.04*Hf-h[1])*0.25)+e*0.5,ax,0.012))*S1(0.04,h[2],0.025)*(1-S1(0.115*Hf,h[1],0.025)):0;
      var low=bib>0.6?(1-S1(-0.01*Hf+e,h[1],0.03))*S1(-0.02,h[2],0.04):0;
      c=mix(c,W,Math.max(muzzle,blaze,low));
      if(q.snow)c=mix(c,W,q.snow*(1-q.points*S1(0.075*Hf,ax,0.02)*S1(0.09*Hf,h[1],0.02)));
      return mix(c,E,0.75*inEar);}
    if(z<-0.36&&y>0.26){var tz=-z;c=mix(B,D,Math.max(K*S1(0.8,tz,0.04),K*sm(0.2,0.8,Math.sin(tz*34+e*10)),(q.points||0)*0.85));return q.snow&&!q.points?mix(c,W,q.snow):c;}
    var top=S1(0.3,y,0.05);
    c=mix(c,D,K*top*sm(0.3,0.85,Math.sin(z*44+Math.sin(x*24)*1.5+e*34)));
    c=mix(c,D,K*top*0.7*(1-S1(0.016,Math.abs(x),0.012))*S1(0.38,y,0.02));
    c=mix(c,D,K*(1-top)*sm(0.45,0.95,Math.sin(y*66+e*22))*(1-sm(0.5,0.85,Math.abs(n[1]))));
    var chest=S1(0.2-0.12*bib,z,0.05)*(1-S1(0.44,y,0.04))*S1(0.1,y,0.03)*(1-S1(0.06+0.1*bib+e,Math.abs(x),0.04));
    var belly=sm(-0.1,-0.55,n[1])*(1-S1(0.2+0.14*bib,y,0.04));
    var socks=1-S1(0.04+0.12*bib+e*0.5,y,0.016);
    var side=bib>0.6?(1-S1(0.25+e*1.6,y,0.04))*S1(-0.12+e*2,z,0.07):0;
    c=mix(c,W,Math.max(bib>0.05?Math.max(chest,belly,socks):belly*0.6,side));
    return q.snow?mix(c,W,q.snow*(1-S1(0.34,y,0.1)*0.4)):c;
  };
}

var COATS={
  xam:   {name:'Mướp xám',  color:painter({base:'#9d8a70',dark:'#2f261f',white:'#e9e1d3',stripes:1,bib:0.25,ear:'#b98e85'}), iris:['#aeb25a','#4a4a1c'], keepEyes:true, earK:0.78, nose:'#b8665c', lip:'#4a2a26', whisker:'#f6f3ee', blush:'#caa08c', blushK:0.12, bean:'#6e4a46', swatch:['#9d8a70','#2f261f','#e9e1d3']},
  kem:   {name:'Kem mắt đen',color:painter({base:'#e8c59c',dark:'#c99565',white:'#fbf3e8',stripes:0.55,bib:0.45}), iris:['#8a6a2c','#2b1c08'], keepEyes:true, earK:0.74, pupil:1.16, nose:'#e08f7e', lip:'#8a5650', whisker:'#fdf9f2', blush:'#eeb09a', bean:'#eda49a', swatch:['#e8c59c','#c99565','#fbf3e8']},
  cup:   {name:'Tai cụp xám trắng',color:painter({base:'#b3a595',dark:'#6d5f52',white:'#fbf8f4',stripes:0.5,bib:0.95}), iris:['#8d9a6e','#33381f'], keepEyes:true, fold:true, nose:'#ee8f9c', lip:'#9a5c66', whisker:'#ffffff', blush:'#f3b8bc', bean:'#f6a8b4', swatch:['#b3a595','#fbf8f4','#6d5f52']},
  trang: {name:'Bạch mắt xanh',color:painter({base:'#f7f5f1',dark:'#e9e4de',white:'#fbfaf7',bib:1,snow:1,points:0,ear:'#efb3b2'}), iris:['#8fb8da','#2c4f78'], keepEyes:true, earK:0.9, nose:'#e99a9c', lip:'#a86b70', whisker:'#ffffff', blush:'#f6c3c3', bean:'#f7adb6', swatch:['#f7f5f1','#dfe8ef','#8fb8da']},
  ragdoll:{name:'Ragdoll lông dài',color:painter({base:'#efe6d8',dark:'#9c8670',white:'#fcfaf6',stripes:0.25,bib:1,points:0.95}), iris:['#58a6cf','#123a63'], keepEyes:true, earK:0.82, fur:1.7, nose:'#ee9aa6', lip:'#9a6068', whisker:'#ffffff', blush:'#f3bcbc', bean:'#f5aab6', swatch:['#efe6d8','#9c8670','#58a6cf']},
  vang:  {name:'Golden tai cụp',color:painter({base:'#cfa574',dark:'#8a6238',white:'#f8efe0',stripes:0.65,bib:0.5}), iris:['#93a690','#34443a'], keepEyes:true, fold:true, nose:'#cf7a76', lip:'#6e3c3c', whisker:'#fbf5ea', blush:'#e8a795', bean:'#b87a72', swatch:['#cfa574','#8a6238','#f8efe0']},
  cam:   {name:'Mướp cam',  color:C.tabbyColor,  iris:['#c98d3e','#3a200d'], nose:'#ee8fa2', lip:'#5e3138', whisker:'#fbf3ec', blush:'#ff97b0', bean:'#ff9db5', swatch:['#f4a057','#d5733a','#fff0dc']},
  tamthe:{name:'Tam thể',   color:C.calicoColor, iris:['#9cc35e','#2c4718'], nose:'#f39cb1', lip:'#7e4f57', whisker:'#e6dcd6', blush:'#ffa3ba', bean:'#ffa3b9', swatch:['#fbf6f1','#f0a159','#8e7f7b']},
  mun:   {name:'Mun tuxedo',color:tuxedoColor,   iris:['#cfd85c','#3b4a12'], nose:'#2b2428', lip:'#140f12', whisker:'#f4f1ee', blush:'#d98a9c', bean:'#3a2f35', swatch:['#232026','#f7f3ee','#cfd85c']}
};
var KITTEN_IRIS=['#86bde9','#1f3466'];   // every kitten starts with blue eyes

/* age stage k = 0..4  ->  build options (kitten: big head, short legs, round & fluffy) */
var STAGES=5;
/* the player's shape settings: style 0 = realistic, 1 = cute; the rest are multipliers around 1 */
var SHAPE0={style:0.6,head:1,eye:1,ear:1,body:1,fat:1,leg:1,tail:1};
function shapeOf(sh){var o={};for(var k in SHAPE0)o[k]=sh&&typeof sh[k]==='number'?sh[k]:SHAPE0[k];return o}
function shapeKey(sh){var o=shapeOf(sh),a=[];for(var k in SHAPE0)a.push(Math.round(o[k]*100));return a.join('.')}
function catParams(coat,k,shape){
  var cf=COATS[coat]||COATS.cam,g=k/(STAGES-1),eyeG=cf.keepEyes?1:sm(0,0.45,g),sh=shapeOf(shape),cu=sh.style;
  function L(a,b){return a+(b-a)*cu}
  var iris=[mix(H(KITTEN_IRIS[0]),H(cf.iris[0]),eyeG),mix(H(KITTEN_IRIS[1]),H(cf.iris[1]),eyeG)];
  return {S:0.8+0.8*g, fat:(1.0+0.22*g)*sh.fat, head:(1.5-0.3*g)*L(0.9,1.02)*sh.head, leg:0.9+0.16*g, legL:L(1.1,0.95)*sh.leg, tail:0.82+0.4*g, tailL:sh.tail,
    body:L(1.06,0.95)*sh.body, real:1-cu, ear:L(1.6,1.52)*sh.ear*(cf.earK||1), lash:L(0.2,1), blushK:cf.blushK!==undefined?cf.blushK:L(0,0.4), cell:0.0145,
    color:cf.color, iris:iris, nose:H(cf.nose), lip:H(cf.lip), whisker:H(cf.whisker), blush:H(cf.blush), bean:H(cf.bean), fold:!!cf.fold, pupilK:cf.pupil||1,
    eyeK:(1.12-0.14*g)*L(0.82,1.0)*sh.eye, almond:1.0-0.4*cu-0.12*(1-g), shells:20, furLen:(0.047-0.007*g)*L(0.95,1.1)*(cf.fur||1), furDen:820};
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
