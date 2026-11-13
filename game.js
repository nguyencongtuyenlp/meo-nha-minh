/* game.js — Mèo Nhà Mình: raise a math-built 3D cat from kitten to adult.
   Room diorama + sun/lamp lighting + shadow map, utility-AI cat with real cat behaviours,
   touch tools, behaviour journal, offline progress, PWA. */
(function(){'use strict';
var C=window.CAT3D;
var PI=Math.PI,TAU=PI*2,M=C.M,T=C.T,Sc=C.Sc,RX=C.RX,RY=C.RY,RZ=C.RZ,xf=C.xf,xf4=C.xf4,sub=C.sub,add=C.add,scl=C.scl,nrm=C.nrm,len3=C.len3,dot=C.dot,cross=C.cross,
  mix=C.mix,lerp=C.lerp,sm=C.sm,ease=C.ease,H=C.H,Mesh=C.Mesh,ell=C.ell,lathe=C.lathe,poly=C.poly,sEll=C.sEll,tube=C.tube,bez=C.bez,capR=C.capR,cst=C.cst,mul=C.mul,I4=C.I4;
var $=function(i){return document.getElementById(i)};
function now(){return performance.now()/1000}
function clamp(x,a,b){return x<a?a:x>b?b:x}
function rnd(a,b){return a+Math.random()*(b-a)}
function pick(a){return a[Math.floor(Math.random()*a.length)]}
function angD(a,b){return Math.atan2(Math.sin(b-a),Math.cos(b-a))}
function angLerp(a,b,k){return a+angD(a,b)*k}
function v3(a){return [a[0],a[1],a[2]]}
function d2(ax,az,bx,bz){return Math.hypot(ax-bx,az-bz)}
function inv4(a){var a00=a[0],a01=a[1],a02=a[2],a03=a[3],a10=a[4],a11=a[5],a12=a[6],a13=a[7],a20=a[8],a21=a[9],a22=a[10],a23=a[11],a30=a[12],a31=a[13],a32=a[14],a33=a[15];
  var b00=a00*a11-a01*a10,b01=a00*a12-a02*a10,b02=a00*a13-a03*a10,b03=a01*a12-a02*a11,b04=a01*a13-a03*a11,b05=a02*a13-a03*a12,b06=a20*a31-a21*a30,b07=a20*a32-a22*a30,b08=a20*a33-a23*a30,b09=a21*a32-a22*a31,b10=a21*a33-a23*a31,b11=a22*a33-a23*a32;
  var d=b00*b11-b01*b10+b02*b09+b03*b08-b04*b07+b05*b06;if(!d)return I4();d=1/d;
  return [(a11*b11-a12*b10+a13*b09)*d,(a02*b10-a01*b11-a03*b09)*d,(a31*b05-a32*b04+a33*b03)*d,(a22*b04-a21*b05-a23*b03)*d,(a12*b08-a10*b11-a13*b07)*d,(a00*b11-a02*b08+a03*b07)*d,(a32*b02-a30*b05-a33*b01)*d,(a20*b05-a22*b02+a23*b01)*d,
    (a10*b10-a11*b08+a13*b06)*d,(a01*b08-a00*b10-a03*b06)*d,(a30*b04-a31*b02+a33*b00)*d,(a21*b02-a20*b04-a23*b00)*d,(a11*b07-a10*b09-a12*b06)*d,(a00*b09-a01*b07+a02*b06)*d,(a31*b01-a30*b03-a32*b00)*d,(a20*b03-a21*b01+a22*b00)*d]}

/* ======================= save ======================= */
var KEY='meo-nha-v1',SV=null;
function defSave(){return {v:1,name:'Mochi',coat:'cam',born:Date.now(),grow:7,q:-1,sound:true,stats:{an:72,nuoc:74,nl:82,vs:88,vui:68,sach:86,tt:12},food:0,water:60,dirty:0,puddle:null,dex:{},last:Date.now()}}
function loadSave(){try{var s=JSON.parse(localStorage.getItem(KEY));if(s&&s.v===1&&s.stats)return s}catch(e){}return null}
function save(){if(!SV)return;SV.last=Date.now();try{localStorage.setItem(KEY,JSON.stringify(SV))}catch(e){}}

/* ======================= audio (all synthesized) ======================= */
var AC=null,master=null,purrG=null;
function ac(){if(!AC){var A=window.AudioContext||window.webkitAudioContext;if(!A)return null;try{if(navigator.audioSession)navigator.audioSession.type='playback'}catch(e){}
    AC=new A();master=AC.createGain();master.gain.value=SV&&SV.sound===false?0:0.8;master.connect(AC.destination);}
  if(AC.state==='suspended')AC.resume();return AC}
function setSound(on){if(SV)SV.sound=on;if(master)master.gain.setTargetAtTime(on?0.8:0,AC.currentTime,0.05);$('bSound').classList.toggle('off',!on);}
function noise(dur,type,freq,vol,delay,q){var a=AC;if(!a)return;var t=a.currentTime+(delay||0),len=Math.max(1,a.sampleRate*dur|0),b=a.createBuffer(1,len,a.sampleRate),d=b.getChannelData(0);
  for(var i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,2);var s=a.createBufferSource();s.buffer=b;var f=a.createBiquadFilter();f.type=type;f.frequency.value=freq;if(q)f.Q.value=q;
  var g=a.createGain();g.gain.value=vol;s.connect(f);f.connect(g);g.connect(master);s.start(t);}
function blip(f0,f1,dur,vol,type,delay){var a=AC;if(!a)return;var t=a.currentTime+(delay||0),o=a.createOscillator(),g=a.createGain();o.type=type||'sine';o.frequency.setValueAtTime(f0,t);o.frequency.exponentialRampToValueAtTime(f1,t+dur);
  g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(vol,t+0.01);g.gain.exponentialRampToValueAtTime(0.0001,t+dur);o.connect(g);g.connect(master);o.start(t);o.stop(t+dur+0.02);}
function mew(pitch,kind){var a=AC;if(!a)return;var t=a.currentTime+0.01,f0=pitch*(0.93+Math.random()*0.14),dur=(kind==='trill'?0.22:kind==='long'?0.62:0.36)+Math.random()*0.1;
  if(kind==='trill'){var tr=a.createOscillator();tr.type='triangle';tr.frequency.value=f0*0.6;var am=a.createGain();am.gain.value=0;var lf=a.createOscillator();lf.frequency.value=28;var lg=a.createGain();lg.gain.value=0.14;
    lf.connect(lg);lg.connect(am.gain);var tl=a.createBiquadFilter();tl.type='lowpass';tl.frequency.value=1800;tr.connect(am);am.connect(tl);tl.connect(master);tr.start(t);lf.start(t);tr.stop(t+0.18);lf.stop(t+0.18);t+=0.16;}
  var o=a.createOscillator();o.type='sawtooth';o.frequency.setValueAtTime(f0*0.82,t);o.frequency.exponentialRampToValueAtTime(f0*1.22,t+dur*0.32);o.frequency.exponentialRampToValueAtTime(f0*0.76,t+dur);
  var vib=a.createOscillator();vib.frequency.value=7.5;var vg=a.createGain();vg.gain.value=f0*0.03;vib.connect(vg);vg.connect(o.frequency);
  var F1=a.createBiquadFilter();F1.type='bandpass';F1.Q.value=3.5;F1.frequency.setValueAtTime(f0*1.5,t);F1.frequency.linearRampToValueAtTime(f0*2.5,t+dur*0.35);F1.frequency.linearRampToValueAtTime(f0*1.2,t+dur);
  var F2=a.createBiquadFilter();F2.type='bandpass';F2.Q.value=5;F2.frequency.setValueAtTime(f0*4.4,t);F2.frequency.linearRampToValueAtTime(f0*3.3,t+dur);
  var g2=a.createGain();g2.gain.value=0.55;var lp=a.createBiquadFilter();lp.type='lowpass';lp.frequency.value=5200;
  var env=a.createGain();env.gain.setValueAtTime(0.0001,t);env.gain.exponentialRampToValueAtTime(1.3,t+0.035);env.gain.setValueAtTime(1.3,t+dur*0.5);env.gain.exponentialRampToValueAtTime(0.0008,t+dur);
  o.connect(F1);o.connect(F2);F2.connect(g2);F1.connect(lp);g2.connect(lp);lp.connect(env);env.connect(master);o.start(t);vib.start(t);o.stop(t+dur+0.05);vib.stop(t+dur+0.05);}
function purrLevel(v){var a=AC;if(!a)return;if(!purrG){var len=a.sampleRate*2,b=a.createBuffer(1,len,a.sampleRate),d=b.getChannelData(0);for(var i=0;i<len;i++)d[i]=Math.random()*2-1;
    var s=a.createBufferSource();s.buffer=b;s.loop=true;var lp=a.createBiquadFilter();lp.type='lowpass';lp.frequency.value=240;var am=a.createGain();am.gain.value=0.5;
    var lf=a.createOscillator();lf.frequency.value=26;var lg=a.createGain();lg.gain.value=0.5;lf.connect(lg);lg.connect(am.gain);purrG=a.createGain();purrG.gain.value=0;
    s.connect(lp);lp.connect(am);am.connect(purrG);purrG.connect(master);s.start();lf.start();}
  purrG.gain.setTargetAtTime(v*0.9,a.currentTime,0.25);}
var SND={crunch:function(){noise(0.06,'bandpass',2600+Math.random()*900,0.22,0,1.5)},lap:function(){blip(900,600,0.05,0.05)},scratch:function(){noise(0.16,'highpass',2800,0.12)},
  thump:function(){noise(0.12,'lowpass',260,0.25)},chatter:function(){for(var i=0;i<5;i++)blip(1500,1100,0.03,0.05,'square',i*0.055)},clink:function(){blip(2300,2100,0.35,0.12);noise(0.15,'highpass',3500,0.12)},
  bird:function(){blip(3200,4200,0.08,0.04);blip(3600,4400,0.07,0.035,'sine',0.12)},hiss:function(){noise(0.5,'bandpass',4200,0.25,0,0.8)},pour:function(){for(var i=0;i<10;i++)noise(0.05,'bandpass',2000+Math.random()*1500,0.12,i*0.05,2)},
  water:function(){noise(0.6,'lowpass',900,0.2)},ding:function(){blip(1318,1310,0.5,0.08);blip(1760,1750,0.6,0.06,'sine',0.12)},sweep:function(){noise(0.35,'highpass',1500,0.15);noise(0.3,'highpass',1800,0.12,0.25)},
  shutter:function(){noise(0.05,'highpass',3000,0.3);noise(0.06,'highpass',2500,0.25,0.09)},ball:function(){noise(0.05,'lowpass',500,0.1)}};

/* ======================= engine & quality ======================= */
var cv=$('gl'),E=C.makeEngine(cv);
if(!E){$('loadMsg').textContent='Máy này chưa hỗ trợ WebGL nên chưa chơi được 😿';return}
var gl=E.gl,PHONE=Math.min(screen.width,screen.height)<560;
var shadowOK=E.initShadow(PHONE?1024:2048);
var Q={lvl:PHONE?1:2,scale:1};
function applyQ(l){Q.lvl=l;C.setFurQ(l===0?0.45:l===1?0.75:1);Q.scale=1;resize();}
var W_=1,H_=1,DPR=1;
function resize(){var dp=Math.min(window.devicePixelRatio||1,Q.lvl===0?1:Q.lvl===1?1.6:2)*Q.scale;W_=innerWidth;H_=innerHeight;DPR=dp;cv.width=Math.round(W_*dp);cv.height=Math.round(H_*dp);}
addEventListener('resize',resize);addEventListener('orientationchange',function(){setTimeout(resize,250)});
function repeatTex(tx){gl.bindTexture(gl.TEXTURE_2D,tx);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);}

/* ======================= room layout ======================= */
var RXH=7,RZH=6,WALLH=6.2,WX0=-3.2,WX1=0.2,WY0=2.1,WY1=5.0;
var OBJ={food:[-5.5,0,2.4],water:[-5.5,0,3.85],litter:{c:[4.85,0,-4.3],hx:1.25,hz:0.95,h:0.55,sand:0.3},bed:{c:[-4.6,0,-3.65],R:1.2,r:0.36},
  post:[5.85,0,0.7],table:{c:[1.6,0,-4.0],hx:1.5,hz:0.9,h:1.55},box:{c:[4.3,0,3.75],hx:1.25,hz:1.0,h:1.0},rug:{c:[-0.2,0,0.9],rx:4.0,rz:2.8},
  lamp:[-6.2,0,-0.6],sill:[-1.5,WY0,-5.4],plant1:[6.2,0,5.15],plant2:[-6.2,0,-5.25]};
var OBST=[[OBJ.bed.c,1.5],[OBJ.litter.c,1.55],[OBJ.post,0.62],[OBJ.box.c,1.6],[OBJ.food,0.62],[OBJ.water,0.62],[OBJ.lamp,0.5],[OBJ.plant1,0.6],[OBJ.plant2,0.6],
  [[OBJ.table.c[0]-1.35,0,OBJ.table.c[2]+0.75],0.25],[[OBJ.table.c[0]+1.35,0,OBJ.table.c[2]+0.75],0.25]];
var CUP_HOME=[2.25,OBJ.table.h,-3.45];

/* ---------- textures ---------- */
function canvas(n){var c=document.createElement('canvas');c.width=c.height=n;return c}
function floorTex(){var c=canvas(1024),g=c.getContext('2d');var rows=8,h=1024/rows;
  for(var r=0;r<rows;r++){var x=-((r*173)%420);while(x<1024){var w=380+((r*97+x)%5)*60,tone=0.92+((r*31+(x|0))%7)*0.018;
      g.fillStyle='rgb('+(214*tone|0)+','+(170*tone|0)+','+(124*tone|0)+')';g.fillRect(x,r*h,w,h);
      for(var k=0;k<14;k++){g.strokeStyle='rgba(120,78,44,'+(0.04+((k*13+r)%5)*0.012)+')';g.lineWidth=1+(k%3);g.beginPath();var yy=r*h+6+k*(h-12)/14;g.moveTo(x,yy);g.bezierCurveTo(x+w*0.3,yy+3,x+w*0.6,yy-3,x+w,yy+1);g.stroke();}
      g.fillStyle='rgba(90,55,30,0.55)';g.fillRect(x,r*h,3,h);x+=w;}
    g.fillStyle='rgba(90,55,30,0.5)';g.fillRect(0,r*h,1024,3);}
  var gr=g.createRadialGradient(512,512,100,512,512,760);gr.addColorStop(0,'rgba(255,255,255,0.06)');gr.addColorStop(1,'rgba(60,30,10,0.05)');g.fillStyle=gr;g.fillRect(0,0,1024,1024);return c}
function wallTex(){var c=canvas(512),g=c.getContext('2d');g.fillStyle='#f7e4da';g.fillRect(0,0,512,512);
  for(var i=0;i<8;i++){g.fillStyle=i%2?'rgba(255,255,255,0.35)':'rgba(240,200,190,0.18)';g.fillRect(i*64,0,64,512);}
  function heart(x,y,s){g.beginPath();g.moveTo(x,y+s*0.3);g.bezierCurveTo(x-s,y-s*0.35,x-s*0.45,y-s*1.05,x,y-s*0.45);g.bezierCurveTo(x+s*0.45,y-s*1.05,x+s,y-s*0.35,x,y+s*0.3);g.fill();}
  function paw(x,y,s){g.beginPath();g.ellipse(x,y,s*0.5,s*0.42,0,0,TAU);g.fill();[[-0.55,-0.6],[-0.2,-0.85],[0.2,-0.85],[0.55,-0.6]].forEach(function(o){g.beginPath();g.ellipse(x+o[0]*s,y+o[1]*s,s*0.17,s*0.2,0,0,TAU);g.fill();});}
  for(var y=0;y<4;y++)for(var x=0;x<4;x++){g.fillStyle=(x+y)%2?'rgba(232,140,160,0.22)':'rgba(214,150,110,0.2)';if((x+y)%2)heart(x*128+64,y*128+70,16);else paw(x*128+64,y*128+72,22);}
  return c}

/* ---------- static world ---------- */
function box(m,c,h,col,e,mx,nu,nv){m.surf(sEll(h[0],h[1],h[2],e||0.12),nu||10,nv||16,col,mx?M(mx,T(c)):T(c))}
function plane(m,x0,x1,y0,y1,z,nx,col,uvs){/* vertical plane facing +z (nx=1) or a floor plane when z==null */ m.surf(function(u,v){return z==null?[lerp(x0,x1,u),y0,lerp(y1,y0,v)]:[lerp(x0,x1,u),lerp(y0,y1,v),z]},2,2,col,null,function(u,v,lp){return z==null?[lp[0]*uvs,lp[2]*uvs]:[lp[0]*uvs,-lp[1]*uvs]})}
function planeX(m,z0,z1,y0,y1,x,col,uvs){m.surf(function(u,v){return [x,lerp(y0,y1,v),lerp(z0,z1,u)]},2,2,col,null,function(u,v,lp){return [lp[2]*uvs,-lp[1]*uvs]})}
var WOOD=H('#c8915f'),WOODD=H('#a8713f'),CREAM=H('#fffaf3'),WHITE=H('#ffffff');
function buildWorld(){
  var W=new Mesh();
  /* floor slab (the diorama base) */
  box(W,[0,-0.42,0],[RXH+0.35,0.42,RZH+0.35],H('#b98a62'),0.06,null,6,24);
  /* rug */
  var R=OBJ.rug;W.surf(function(u,v){var a=v*TAU,rr=u;return [R.c[0]+R.rx*rr*Math.cos(a),0.018+0.01*Math.sin(u*PI),R.c[2]+R.rz*rr*Math.sin(a)]},14,64,function(u){
    var s=Math.floor(u*7);return [H('#ffd8e0'),H('#fff3ea'),H('#bfe6dc'),H('#fff3ea'),H('#ffc7d4'),H('#fff3ea'),H('#f6b7c6')][Math.min(6,s)]});
  /* cat bed (donut + cushion) */
  var B=OBJ.bed;W.surf(lathe(function(u){var a=u*TAU;return [B.R-B.r+B.r*Math.cos(a),B.r+B.r*Math.sin(a)]}),18,40,function(u,v,lp){return lp[1]>B.r*1.3?H('#ffe9ef'):H('#f7b8c8')},T(B.c));
  W.surf(ell(B.R-B.r*0.9,0.12,B.R-B.r*0.9),10,30,H('#fff4ec'),T(B.c[0],0.1,B.c[2]));
  /* food & water bowls (static ceramic) */
  [OBJ.food,OBJ.water].forEach(function(p,i){W.surf(lathe(poly([[0,0],[0.42,0],[0.5,0.04],[0.56,0.26],[0.52,0.3],[0.46,0.1],[0,0.1]])),12,32,function(u,v,lp){return lp[1]>0.22?(i?H('#8fc8ff'):H('#ff9fb6')):WHITE},T(p));});
  /* litter box (open tray) + sand */
  var L=OBJ.litter,lc=L.c;box(W,[lc[0],0.04,lc[2]],[L.hx,0.04,L.hz],H('#9fd6c8'),0.15);
  [[0,L.hz],[0,-L.hz]].forEach(function(o){box(W,[lc[0],L.h/2,lc[2]+o[1]],[L.hx,L.h/2,0.05],H('#8fcbbd'),0.15,null,6,12)});
  [[L.hx,0],[-L.hx,0]].forEach(function(o){box(W,[lc[0]+o[0],L.h/2,lc[2]],[0.05,L.h/2,L.hz],H('#8fcbbd'),0.15,null,6,12)});
  W.surf(function(u,v){return [lc[0]-L.hx+0.06+u*(2*L.hx-0.12),L.sand+0.02*Math.sin(u*31)*Math.sin(v*23),lc[2]-L.hz+0.06+v*(2*L.hz-0.12)]},16,16,function(u,v,lp){var n=C.nz3(lp[0]*6,0,lp[2]*6);return mix(H('#efe2c8'),H('#d9c7a6'),0.5+n*12)});
  /* scratching post / cat tree */
  var P=OBJ.post;box(W,[P[0],0.08,P[2]],[0.7,0.08,0.7],H('#f3d7c6'),0.25);
  W.surf(tube(function(u){return [P[0],0.12+u*3.0,P[2]]},cst(0.27),8),8,20,function(u,v,lp){return Math.sin(lp[1]*38)>0?H('#d8b27e'):H('#c79e68')});
  W.surf(sEll(0.85,0.1,0.85,0.35),10,20,H('#f7c9d6'),T(P[0],3.15,P[2]));
  W.surf(tube(bez([P[0]-0.6,3.1,P[2]+0.3],[P[0]-0.62,2.6,P[2]+0.32],[P[0]-0.6,2.3,P[2]+0.31],[P[0]-0.6,2.1,P[2]+0.3]),cst(0.012),10),10,4,H('#fff'));
  W.surf(ell(0.13,0.13,0.13),8,10,H('#ff8fb1'),T(P[0]-0.6,2.02,P[2]+0.3));
  /* low table */
  var TB=OBJ.table,tc=TB.c;box(W,[tc[0],TB.h-0.07,tc[2]],[TB.hx,0.07,TB.hz],WOOD,0.12,null,8,20);
  [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(function(s){W.surf(tube(function(u){return [tc[0]+s[0]*(TB.hx-0.15),u*(TB.h-0.12),tc[2]+s[1]*(TB.hz-0.15)]},cst(0.07),4),4,8,WOODD)});
  /* cardboard box with open flaps */
  var X=OBJ.box,bc=X.c,KR=H('#d9a86b'),KR2=H('#c9955a');box(W,[bc[0],0.03,bc[2]],[X.hx,0.03,X.hz],KR2,0.08);
  [[0,X.hz],[0,-X.hz]].forEach(function(o){box(W,[bc[0],X.h/2,bc[2]+o[1]],[X.hx,X.h/2,0.03],KR,0.08,null,6,10)});
  [[X.hx,0],[-X.hx,0]].forEach(function(o){box(W,[bc[0]+o[0],X.h/2,bc[2]],[0.03,X.h/2,X.hz],KR,0.08,null,6,10)});
  [[0,X.hz,0],[0,-X.hz,PI]].forEach(function(o){box(W,[0,0.25,0],[X.hx*0.98,0.25,0.02],KR2,0.08,M(T(bc[0],X.h,bc[2]+o[1]),RY(o[2]),RX(-0.55)),6,10)});
  [[X.hx,0,PI/2],[-X.hx,0,-PI/2]].forEach(function(o){box(W,[0,0.22,0],[X.hz*0.98,0.22,0.02],KR2,0.08,M(T(bc[0]+o[0],X.h,bc[2]),RY(o[2]),RX(-0.55)),6,10)});
  /* floor lamp */
  var LP=OBJ.lamp;W.surf(ell(0.42,0.05,0.42),8,16,H('#e8d9cc'),T(LP[0],0.05,LP[2]));W.surf(tube(function(u){return [LP[0],u*4.4,LP[2]]},cst(0.045),4),4,8,H('#cdbfb4'));
  W.surf(lathe(function(u){return [0.38+0.32*u,0.75*(1-u)]}),4,24,H('#fff1d9'),T(LP[0],4.05,LP[2]));
  /* plants */
  [OBJ.plant1,OBJ.plant2].forEach(function(p,j){W.surf(lathe(poly([[0,0],[0.32,0],[0.42,0.62],[0.36,0.66],[0,0.6]])),6,20,H('#d9805f'),T(p));
    for(var i=0;i<11;i++){var a=i*2.4+j,el=0.55+0.35*((i*7)%5)/5,L2=0.55+0.3*((i*3)%4)/4;
      W.surf(ell(0.16,0.02,L2),6,10,mix(H('#5fae73'),H('#86c98e'),((i*5)%4)/4),M(T(p[0],0.62,p[2]),RY(a),RX(-el),T(0,0,L2*0.95)));}});
  return W;
}
/* walls: one mesh per wall so the ones between camera and room can be hidden (Sims-style cutaway) */
function buildWalls(){
  var th=0.18,WC=H('#f0d6cc'),walls=[];
  function wall(boxes,paper,base){var m=new Mesh(),p=new Mesh();boxes.forEach(function(b){box(m,b[0],b[1],WC,0.04,null,4,8)});paper(p);base(m);return {m:m,p:p}}
  /* back wall (z=-RZH) with the window hole, frame, sill and curtains */
  walls.push(wall([[[ (-RXH-th+WX0)/2,WALLH/2,-RZH-th],[(WX0+RXH+th)/2,WALLH/2,th]],[[(WX1+RXH+th)/2,WALLH/2,-RZH-th],[(RXH+th-WX1)/2,WALLH/2,th]],
      [[(WX0+WX1)/2,WY0/2,-RZH-th],[(WX1-WX0)/2,WY0/2,th]],[[(WX0+WX1)/2,(WY1+WALLH)/2,-RZH-th],[(WX1-WX0)/2,(WALLH-WY1)/2,th]]],
    function(p){var z=-RZH+0.003;plane(p,-RXH,WX0,1.5,WALLH,z,1,WHITE,0.33);plane(p,WX1,RXH,1.5,WALLH,z,1,WHITE,0.33);plane(p,WX0,WX1,WY1,WALLH,z,1,WHITE,0.33);plane(p,WX0,WX1,1.5,WY0,z,1,WHITE,0.33);},
    function(m){box(m,[0,0.75,-RZH+0.03],[RXH,0.75,0.03],CREAM,0.05,null,4,8);box(m,[0,1.52,-RZH+0.06],[RXH,0.03,0.06],WHITE,0.2,null,4,8);
      var fz=-RZH+0.05;box(m,[(WX0+WX1)/2,WY1+0.06,fz],[(WX1-WX0)/2+0.12,0.08,0.09],WHITE,0.15);box(m,[WX0-0.06,(WY0+WY1)/2,fz],[0.08,(WY1-WY0)/2+0.1,0.09],WHITE,0.15);
      box(m,[WX1+0.06,(WY0+WY1)/2,fz],[0.08,(WY1-WY0)/2+0.1,0.09],WHITE,0.15);box(m,[(WX0+WX1)/2,(WY0+WY1)/2,fz-0.08],[0.04,(WY1-WY0)/2,0.04],WHITE,0.2);
      box(m,[(WX0+WX1)/2,(WY0+WY1)/2+0.2,fz-0.08],[(WX1-WX0)/2,0.04,0.04],WHITE,0.2);
      box(m,[(WX0+WX1)/2,WY0-0.06,-RZH+0.45],[(WX1-WX0)/2+0.3,0.07,0.5],WHITE,0.12,null,6,12);
      [WX0-0.55,WX1+0.55].forEach(function(cx,i){m.surf(function(u,v){var x=cx+(u-0.5)*0.8,y=WY1+0.45-v*(WY1+0.1-WY0+0.3);return [x+0.04*Math.sin(u*TAU*3)*(i?1:-1),y,-RZH+0.22+0.07*Math.sin(u*TAU*3)]},18,6,H('#ffd7e2'))});
      box(m,[(WX0+WX1)/2,WY1+0.5,-RZH+0.22],[(WX1-WX0)/2+1.0,0.03,0.03],WOODD,0.2);}));
  /* left wall (x=-RXH) */
  walls.push(wall([[[-RXH-th,WALLH/2,0],[th,WALLH/2,RZH+th]]],function(p){planeX(p,RZH,-RZH,1.5,WALLH,-RXH+0.003,WHITE,0.33)},
    function(m){box(m,[-RXH+0.03,0.75,0],[0.03,0.75,RZH],CREAM,0.05,null,4,8);box(m,[-RXH+0.06,1.52,0],[0.06,0.03,RZH],WHITE,0.2,null,4,8);
  /* picture frames on the left wall */
  [[-RXH+0.05,3.6,-1.6,1.1,0.8,H('#ffd1dc')],[-RXH+0.05,3.4,1.0,0.8,1.0,H('#cfe8ff')]].forEach(function(f){box(m,[f[0]+0.04,f[1],f[2]],[0.05,f[4]/2+0.08,f[3]/2+0.08],WOOD,0.2);
    box(m,[f[0]+0.1,f[1],f[2]],[0.01,f[4]/2,f[3]/2],f[5],0.1);m.surf(ell(0.012,f[4]*0.18,f[3]*0.18),6,10,H('#ff8fae'),T(f[0]+0.12,f[1]+0.05,f[2]));});
    }));
  /* right wall (x=+RXH) */
  walls.push(wall([[[RXH+th,WALLH/2,0],[th,WALLH/2,RZH+th]]],function(p){planeX(p,-RZH,RZH,1.5,WALLH,RXH-0.003,WHITE,0.33)},
    function(m){box(m,[RXH-0.03,0.75,0],[0.03,0.75,RZH],CREAM,0.05,null,4,8);box(m,[RXH-0.06,1.52,0],[0.06,0.03,RZH],WHITE,0.2,null,4,8)}));
  /* front wall (z=+RZH) */
  walls.push(wall([[[0,WALLH/2,RZH+th],[RXH+th,WALLH/2,th]]],function(p){plane(p,RXH,-RXH,1.5,WALLH,RZH-0.003,1,WHITE,0.33)},
    function(m){box(m,[0,0.75,RZH-0.03],[RXH,0.75,0.03],CREAM,0.05,null,4,8);box(m,[0,1.52,RZH-0.06],[RXH,0.03,0.06],WHITE,0.2,null,4,8)}));
  return walls;
}
function buildDynamic(){
  var D={};
  var K=new Mesh();for(var i=0;i<46;i++){var a=i*2.39996,r=Math.sqrt(i/46)*0.36;K.surf(ell(0.065,0.045,0.06),5,6,mix(H('#b06a33'),H('#d48a4b'),(i%5)/5),T(Math.cos(a)*r,0.03+((i*7)%3)*0.02,Math.sin(a)*r));}D.kibble=K;
  D.waterS=new Mesh().surf(function(u,v){var r=0.45*u,a=v*TAU;return [r*Math.cos(a),0,r*Math.sin(a)]},3,24,H('#9fd8ff',0.35));
  D.clump=new Mesh().surf(ell(0.09,0.05,0.08),5,7,H('#b7a07c'));
  D.puddle=new Mesh().surf(function(u,v){var a=v*TAU,r=u*(0.5+0.08*Math.sin(a*3));return [r*Math.cos(a)*1.2,0.025,r*Math.sin(a)]},3,30,H('#e9d36a',0.25));
  D.ball=new Mesh().surf(ell(0.24,0.24,0.24),14,20,function(u,v,lp){var s=Math.sin((lp[0]*0.8+lp[1]*0.6)*44),s2=Math.sin((lp[2]*0.7-lp[1]*0.7)*40);return mix(H('#ff9dbb'),H('#ff6f99'),sm(0.5,0.95,Math.abs(lp[1]>0?s:s2)))});
  var CU=new Mesh();CU.surf(lathe(poly([[0,0],[0.17,0],[0.19,0.03],[0.2,0.34],[0.18,0.34],[0.17,0.05],[0,0.05]])),10,24,function(u,v,lp){return lp[1]>0.14&&lp[1]<0.2?H('#ff9fb6'):WHITE});
  CU.surf(tube(function(u){var a=-PI/2+u*PI;return [0.2+0.1*Math.cos(a),0.18+0.09*Math.sin(a),0]},cst(0.022),12),12,6,WHITE);D.cup=CU;
  var LU=new Mesh();[[0,'#ff8fb1'],[1.3,'#ffd36e'],[2.6,'#9ad7ff'],[3.9,'#c9b6ff'],[5.2,'#ffb3c8']].forEach(function(f){LU.surf(ell(0.035,0.025,0.22),5,8,H(f[1]),M(RY(f[0]),RX(-0.9),T(0,0,0.16)))});
  LU.surf(ell(0.05,0.05,0.05),6,8,H('#ffffff'));D.lure=LU;
  D.string=new Mesh().surf(tube(function(u){return [0,u,0]},cst(0.008),3),3,4,H('#ffffff'));
  D.rod=new Mesh().surf(tube(function(u){return [0,u,0]},cst(0.022),3),3,6,H('#c79a6a'));
  D.sky=new Mesh().surf(function(u,v){return [lerp(WX0-1.5,WX1+1.5,u),lerp(WY0-1.2,WY1+1.2,v),-RZH-2.6]},2,2,H('#ffffff',1));
  var CL=new Mesh();[[0,0,0.55],[0.5,0.12,0.42],[-0.45,0.06,0.38],[0.2,0.28,0.36]].forEach(function(b){CL.surf(ell(b[2],b[2]*0.62,0.2),8,12,H('#ffffff',1),T(b[0],b[1],0))});D.cloud=CL;
  var BI=new Mesh();BI.surf(ell(0.12,0.08,0.16),6,8,H('#5d6b8a'));BI.surf(ell(0.07,0.06,0.07),6,8,H('#5d6b8a'),T(0,0.07,0.13));BI.surf(ell(0.02,0.015,0.04),4,4,H('#ffb347'),T(0,0.06,0.21));D.bird=BI;
  D.wing=new Mesh().surf(function(u,v){return [u*0.26,0,(v-0.5)*0.14*(1-u*0.6)]},2,2,H('#7a88a8'));
  D.bulb=new Mesh().surf(ell(0.16,0.16,0.16),8,10,H('#ffffff',1));
  return D;
}

/* ======================= lighting by hour ======================= */
var ENV={};
function envAt(h){
  var day=sm(5.3,7.2,h)*(1-sm(17.6,19.4,h)),gold=Math.max(sm(5.5,6.8,h)*(1-sm(7.6,9.4,h)),sm(15.8,17.4,h)*(1-sm(18.2,19.4,h)));
  var a=clamp((h-6)/12,0.02,0.98)*PI,Ld=nrm([Math.cos(a)*0.95,0.22+Math.sin(a)*1.05,-0.95]),Ln=nrm([-0.4,0.85,-0.75]);
  var L=day>0.3?Ld:Ln,sunI=day>0.3?day:0.18;
  var sunC=mix(mix([1.0,0.96,0.88],[1.0,0.66,0.4],gold),[0.42,0.48,0.78],1-day).slice(0,3).map(function(x){return x*(0.22+0.52*sunI)});
  var amb1=mix([0.42,0.42,0.6],[0.84,0.83,0.9],day).slice(0,3),amb0=mix([0.34,0.3,0.42],[0.9,0.8,0.78],day).slice(0,3);
  var lampK=1-sm(0.2,0.65,day),lampC=[1.0*lampK*1.5,0.74*lampK*1.5,0.46*lampK*1.5];
  var sky=mix(mix([0.12,0.15,0.34],[0.66,0.84,1.0],day),[1.0,0.72,0.55],gold*0.75).slice(0,3);
  var bgT=mix(mix([0.16,0.17,0.32],[0.99,0.9,0.86],day),[1.0,0.82,0.7],gold*0.5).slice(0,3),bgB=mix([0.24,0.2,0.36],[0.96,0.93,0.86],day).slice(0,3);
  ENV={h:h,day:day,gold:gold,L:L,sunI:sunI,sun:sunC,amb0:amb0,amb1:amb1,lampC:lampC,lampP:[OBJ.lamp[0]+0.1,4.3,OBJ.lamp[2]],sky:sky,bgT:bgT,bgB:bgB,fog:bgB};
  return ENV;
}
function isNight(){return ENV.day<0.3}
function sunPatch(){if(ENV.day<0.55)return null;var L=ENV.L,W=[(WX0+WX1)/2,(WY0+WY1)/2,-RZH],t=W[1]/L[1],p=[W[0]-L[0]*t,0,W[2]-L[2]*t];
  if(p[0]<-RXH+0.8||p[0]>RXH-0.8||p[2]<-RZH+0.8||p[2]>RZH-0.8)return null;for(var i=0;i<OBST.length;i++)if(d2(p[0],p[2],OBST[i][0][0],OBST[i][0][2])<OBST[i][1]+0.3)return null;return p}

/* ======================= camera & picking ======================= */
var cam={yaw:-0.6,pitch:0.7,dist:11,tgt:[0,1.1,0.4],yawT:-0.6,pitchT:0.7,distT:11,follow:true,eye:[0,0,0],VP:I4(),iVP:I4(),V:I4()};
function updCam(dt){var k=1-Math.pow(0.002,dt);if(cam.follow&&catReady){var ft=[cat.x,cat.y+0.45*SC,cat.z];cam.tgt=mix(cam.tgt,ft,1-Math.pow(0.05,dt)).slice(0,3);}else cam.tgt=mix(cam.tgt,[0,1.1,0.4],1-Math.pow(0.1,dt)).slice(0,3);
  cam.pitchT=clamp(cam.pitchT,cam.follow?0.62:0.16,1.25);cam.distT=clamp(cam.distT,cam.follow?8.5:6.5,34);cam.yaw=angLerp(cam.yaw,cam.yawT,k);cam.pitch+=(cam.pitchT-cam.pitch)*k;cam.dist+=(cam.distT-cam.dist)*k;
  var cp=Math.cos(cam.pitch);cam.eye=[cam.tgt[0]+cam.dist*Math.sin(cam.yaw)*cp,cam.tgt[1]+cam.dist*Math.sin(cam.pitch),cam.tgt[2]+cam.dist*Math.cos(cam.yaw)*cp];
  var asp=W_/H_,fov=(asp<1.2?50:36)*PI/180;cam.V=C.lookAt(cam.eye,cam.tgt,[0,1,0]);cam.VP=mul(C.persp(fov,asp,0.3,90),cam.V);cam.iVP=inv4(cam.VP);}
function ray(sx,sy){var x=sx/W_*2-1,y=1-sy/H_*2,a=xf4(cam.iVP,[x,y,-1]),b=xf4(cam.iVP,[x,y,1]);return {o:[a[0],a[1],a[2]],d:nrm(sub([b[0],b[1],b[2]],[a[0],a[1],a[2]]))}}
function rayPlaneY(r,y){if(Math.abs(r.d[1])<1e-5)return null;var t=(y-r.o[1])/r.d[1];return t>0?add(r.o,scl(r.d,t)):null}
function raySphere(r,c,rad){var oc=sub(r.o,c),b=dot(oc,r.d),q=dot(oc,oc)-rad*rad,h=b*b-q;if(h<0)return -1;var t=-b-Math.sqrt(h);return t>0?t:-1}
function toScreen(p){var q=xf4(cam.VP,p);return [(q[0]*0.5+0.5)*W_,(1-(q[1]*0.5+0.5))*H_,q[3]]}
function floorPoint(sx,sy){var p=rayPlaneY(ray(sx,sy),0.05);if(!p)return null;p[0]=clamp(p[0],-RXH+0.4,RXH-0.4);p[2]=clamp(p[2],-RZH+0.4,RZH-0.4);return p}

/* ======================= the cat ======================= */
var CAT=null,GC=null,POSE=null,SC=1,G=0,STAGE=-1,catReady=false;
var CPX={loaf:{py:.155,pz:-.2,pitch:0.04,cp:0,fz:0,fG:0,frel:[0,-.085,.11],bz:0,bG:0,brel:[0,-.085,.13],tailUp:-0.35},
  curl:{py:.15,pz:-.2,pitch:0.02,cp:0.05,fz:0,fG:0,frel:[0,-.08,.12],bz:0,bG:0,brel:[0,-.08,.14],tailUp:-0.45},
  side:{py:.165,pz:-.2,pitch:0,cp:0,fz:0,fG:0,frel:[0,-.2,.08],bz:0,bG:0,brel:[0,-.2,-.02],tailUp:-0.1},
  eat:{py:.28,pz:-.2,pitch:.2,cp:.12,fz:-.01,fG:1,frel:[0,-.24,.03],bz:.05,bG:1,brel:[0,-.24,0],tailUp:0.05},
  squat:{py:.2,pz:-.2,pitch:-.28,cp:-.05,fz:0,fG:1,frel:[0,-.2,.03],bz:.12,bG:1,brel:[0,-.2,.08],tailUp:0.95},
  stalk:{py:.2,pz:-.2,pitch:.06,cp:.04,fz:-.02,fG:1,frel:[0,-.19,.05],bz:.05,bG:1,brel:[0,-.2,.04],tailUp:-0.2}};
for(var ck in CPX)C.CP[ck]=CPX[ck];
var cat={v:0,moved:false,x:-0.5,z:1.6,y:0,yaw:2.6,hop:0,roll:0,rollT:0,wig:0,st:C.catState(),pose:'sit',poseObj:null,prate:0.02,ex:'normal',lookP:null,hyT:0,hpT:0,ovL:null,ovR:null,ovW:0,
  tailAmp:0.35,tailRate:1.8,tailUpO:null,spd:0,script:null,act:'',lastAct:'',sleeping:false,purr:0,petting:false,petT:0,petP:null,lastAte:-99,slowBlink:-9,landT:-9,r:null,bubble:'',meowT:0,hunt:null};
function WALK(){return 1.35*SC+0.35}function RUN(){return 4.2*SC+1.2}
function catM0(){var m=M(T(cat.x,cat.y+cat.hop,cat.z),RY(cat.yaw+cat.wig));if(Math.abs(cat.roll)>1e-3){var h=cat.st.py*SC;m=M(m,T(0,h,0),RZ(cat.roll),T(0,-h,0));}return m}
function toLocal(p){var dx=p[0]-cat.x,dy=p[1]-(cat.y+cat.hop),dz=p[2]-cat.z,c=Math.cos(cat.yaw),s=Math.sin(cat.yaw);return [c*dx-s*dz,dy,s*dx+c*dz]}
function fwd(){return [Math.sin(cat.yaw),0,Math.cos(cat.yaw)]}
function catHead(){return cat.r?cat.r.headPos:[cat.x,cat.y+0.6*SC,cat.z]}

/* mesh loading: worker + IndexedDB cache */
var worker=null,wq={},wid=0;
try{if(location.protocol!=='file:'){worker=new Worker('worker.js?v=13');worker.onmessage=function(e){var q=wq[e.data.id];delete wq[e.data.id];if(q){if(e.data.error)q.rej(e.data.error);else q.res(e.data.cat)}};
  worker.onerror=function(){worker=null;for(var k in wq){var q=wq[k];delete wq[k];q.fallback()}}}}catch(e){worker=null}
function buildCatAsync(coat,k){return new Promise(function(res,rej){function local(){setTimeout(function(){try{res(window.buildPacked(coat,k))}catch(e){rej(e)}},30)}
  if(worker){var id=++wid;wq[id]={res:res,rej:rej,fallback:local};worker.postMessage({id:id,coat:coat,k:k});}else local();})}
var dbp=null;function db(){if(dbp)return dbp;dbp=new Promise(function(res){try{var r=indexedDB.open('meo-nha-mesh',1);r.onupgradeneeded=function(){r.result.createObjectStore('m')};r.onsuccess=function(){res(r.result)};r.onerror=function(){res(null)}}catch(e){res(null)}});return dbp}
function idbGet(k){return db().then(function(d){return d?new Promise(function(res){try{var q=d.transaction('m').objectStore('m').get(k);q.onsuccess=function(){res(q.result||null)};q.onerror=function(){res(null)}}catch(e){res(null)}}):null})}
function idbPut(k,v){db().then(function(d){if(d)try{d.transaction('m','readwrite').objectStore('m').put(v,k)}catch(e){}})}
var MESHV='m5';
function getCat(coat,k){var key=MESHV+'-'+coat+'-'+k;return idbGet(key).then(function(v){return v||buildCatAsync(coat,k).then(function(c){idbPut(key,c);return c})})}
function growG(){return clamp((Date.now()-SV.born)/(SV.grow*864e5),0,1)}
function stageOf(g){return Math.min(window.CAT_STAGES-1,Math.floor(g*(window.CAT_STAGES-1)+1e-6))}
function ageText(g){var w=6+g*46;return w<16?Math.round(w)+' tuần':Math.round(w/4.345)+' tháng'}
function stageName(g){return g<0.25?'Mèo con':g<0.6?'Mèo nhỡ':'Trưởng thành'}
function setCatMesh(c,k){if(GC){/* old buffers are left to GC; meshes are small */}CAT=c;GC=C.uploadCat(E,c);POSE=C.fitPoses(c);SC=c.S;STAGE=k;catReady=true;
  for(var key in POSE.sit)if(cat.st[key]!==undefined&&!Array.isArray(POSE.sit[key]))cat.st[key]=POSE.sit[key];}
var growing=false;
function checkGrowth(){if(!SV||growing)return;G=growG();var k=stageOf(G);if(k===STAGE)return;growing=true;var prev=STAGE;
  getCat(SV.coat,k).then(function(c){setCatMesh(c,k);growing=false;if(prev>=0){toast('🎉 '+SV.name+' vừa lớn thêm một chút!');dex('lonlen');if(prev===0)dex('doimaumat');mewNow('trill');}
    if(k+1<window.CAT_STAGES)getCat(SV.coat,k+1);}).catch(function(){growing=false});}

/* ======================= world objects (dynamic) ======================= */
var ball={on:false,x:0,z:0,y:0.24,vx:0,vy:0,vz:0,R:I4(),r:0.24};
var cup={st:'home',p:v3(CUP_HOME),v:[0,0,0],rot:0,t:0};
var lure={on:false,p:[0,0.06,0],held:false,until:0,tip:[0,1.7,0],tipT:[0,1.7,0],v:[0,0,0],len:1.75,caught:false};
var laser={on:false,p:[0,0.02,0],t:0,startT:0};
var birds=[],nextBird=8,clouds=[{x:-5,y:WY1-0.2,s:1},{x:-1,y:WY1+0.5,s:0.8},{x:3,y:WY0+0.4,s:1.1}];

/* ======================= behaviour journal ======================= */
var DEX=[['an','Ăn hạt','Mèo là loài ăn thịt bắt buộc. Tự nhiên chúng ăn nhiều bữa nhỏ trong ngày thay vì vài bữa lớn.'],
['uong','Uống nước bằng lưỡi','Mèo cong đầu lưỡi về sau, chạm nhẹ mặt nước rồi rút nhanh để kéo lên một cột nước, khoảng 4 lần mỗi giây.'],
['kheuan','Kêu đòi ăn','Mèo trưởng thành ít kêu "meo" với nhau; tiếng meo chủ yếu để nói chuyện với con người.'],
['ngu','Ngủ cuộn tròn','Mèo ngủ khoảng 12–16 tiếng mỗi ngày, mèo con còn nhiều hơn. Cuộn tròn giúp giữ ấm và che phần bụng.'],
['nhaobot','Nhào bột','Hai chân trước đạp nhịp nhàng: thói quen từ lúc bú mẹ, thường xuất hiện khi mèo thấy an toàn, dễ chịu.'],
['vuonvai','Vươn vai','Ngủ dậy là duỗi dài chân trước, cong lưng để kéo giãn cơ, sẵn sàng hoạt động.'],
['ngap','Ngáp','Một cái ngáp thật to sau giấc ngủ, khoe hết mấy chiếc răng nanh bé xíu.'],
['liemlong','Liếm lông','Mèo dành rất nhiều thời gian thức để tự chải chuốt (hay được nói là 30–50%). Lưỡi có gai nhỏ như một chiếc lược.'],
['caotru','Cào móng','Cào giúp tuốt lớp vỏ móng cũ, kéo giãn cơ và để lại mùi từ tuyến ở đệm chân, một kiểu "đánh dấu chủ quyền".'],
['vesinh','Đào – lấp cát','Mèo đào hố rồi lấp kín chất thải: bản năng giấu mùi khỏi kẻ săn mồi.'],
['cheban','Chê khay bẩn','Khay cát bẩn là lý do hay gặp khiến mèo không chịu đi vệ sinh trong khay. Dọn khay mỗi ngày nhé!'],
['dibay','Đi bậy','Khi khay bẩn quá lâu, mèo có thể tìm chỗ khác để giải quyết. Đây là tín hiệu cần dọn khay, đừng mắng bé.'],
['chayloan','Chạy loạn (zoomies)','Những pha chạy thục mạng bất chợt để xả năng lượng, hay gặp sau khi đi vệ sinh hoặc lúc chạng vạng.'],
['rinhvo','Rình – ngoáy mông – vồ','Hạ thấp người, ngoáy mông vài nhịp rồi lao tới. Người ta cho rằng ngoáy mông giúp chỉnh tư thế hai chân sau trước cú vồ.'],
['duoilaser','Đuổi chấm laser','Mèo mê chấm đỏ nhưng không bao giờ bắt được. Nên kết thúc bằng một món đồ chơi thật để bé "bắt" được.'],
['choibong','Đập bóng','Vỗ, đẩy rồi đuổi theo vật lăn: một trò tập săn mồi thu nhỏ.'],
['duoiduoi','Đuổi theo đuôi','Mèo con hay xoay vòng đuổi chính đuôi mình, vừa là trò chơi vừa là tập phối hợp.'],
['chuihop','Chui hộp','Chỗ kín và ấm giúp mèo thấy an toàn. Nghiên cứu ở trạm cứu hộ cho thấy mèo có hộp để trốn thì bớt căng thẳng nhanh hơn.'],
['phoinang','Phơi nắng','Mèo thích chỗ ấm. Vùng nhiệt dễ chịu của mèo cao hơn người khá nhiều (khoảng 30–38°C).'],
['ngamcuaso','Ngắm chim, kêu "kẹc kẹc"','Hàm run run, phát ra tiếng lách cách khi thấy chim ngoài cửa sổ: phấn khích pha chút bực vì không bắt được.'],
['dayly','Đẩy đồ khỏi bàn','Tò mò thử nghiệm, tập vồ mồi… và rất có thể là muốn bạn để ý tới bé.'],
['duoidung','Dựng đuôi chào','Đuôi dựng thẳng, chóp hơi cong như dấu hỏi: lời chào thân thiện, vui vẻ.'],
['phoibung','Lăn ra phơi bụng','Phơi bụng là dấu hiệu tin tưởng, nhưng không phải lời mời xoa bụng đâu nha!'],
['grugru','Gừ gừ','Tiếng gừ gừ phát ra từ thanh quản rung, thường khoảng 25–150 Hz, khi mèo thư giãn (đôi khi cả lúc tự trấn an).'],
['chopmat','Chớp mắt chậm','"Nụ hôn mèo": nhắm mắt chậm rồi mở ra là tín hiệu tin tưởng. Bạn chớp mắt chậm, mèo có thể đáp lại.'],
['vutduoi','Quẫy đuôi','Đuôi quất mạnh qua lại là bé đang khó chịu. Dừng vuốt ve trước khi bé "phản đòn" nhé.'],
['coxat','Cọ mình vào đồ vật','Mèo cọ má, cọ sườn vào đồ đạc để để lại mùi từ tuyến trên mặt, đánh dấu "nhà của mình".'],
['doimaumat','Mắt đổi màu','Mèo con mới sinh đều có mắt xanh; màu mắt thật lộ ra dần khi bé lớn, thường ổn định quanh 3 tháng tuổi.'],
['lonlen','Lớn lên','Mèo lớn rất nhanh trong năm đầu: mèo con đầu to chân ngắn, lớn lên thon dài và cân đối hơn.']];
var DEXN={};DEX.forEach(function(d){DEXN[d[0]]=d});
var dexQueue=[],dexShown=0;
function dex(id){if(!SV||SV.dex[id]||!DEXN[id])return;SV.dex[id]=Date.now();SV.dexNew=SV.dexNew||{};SV.dexNew[id]=1;dexQueue.push(id);save();$('tb').querySelector('[data-t=book]').classList.add('need');}

/* ======================= UI ======================= */
var TOOLS=[['pet','Vuốt ve','pet',1,'Kéo ngón tay trên người bé để vuốt ve'],['food','Cho ăn','food',0],['water','Nước','water',0],['wand','Cần câu','wand',1,'Kéo trên sàn để nhử bé rình rồi vồ'],
  ['laser','Laser','laser',1,'Kéo để chiếu chấm đỏ. Nhớ cho bé bắt đồ chơi thật sau đó nha'],['ball','Bóng len','ball',1,'Chạm lên sàn để ném bóng'],['clean','Dọn dẹp','clean',0],['brush','Chải lông','brush',1,'Kéo trên lưng bé để chải lông'],
  ['call','Gọi bé','call',0],['blink','Chớp mắt','blink',0],['photo','Chụp ảnh','photo',0],['book','Sổ tay','book',0]];
var tool='pet';
var tb=$('tb');TOOLS.forEach(function(t){var b=document.createElement('button');b.className='tool'+(t[0]===tool?' on':'');b.dataset.t=t[0];b.innerHTML='<span class="dot"></span><svg class="i"><use href="#i-'+t[2]+'"/></svg>'+t[1];
  b.addEventListener('click',function(){ac();onTool(t)});tb.appendChild(b)});
var STATS=[['an','🍗','No bụng'],['nuoc','💧','Nước'],['nl','⚡','Năng lượng'],['vs','🧻','Vệ sinh'],['vui','🧶','Vui vẻ'],['sach','✨','Sạch sẽ'],['tt','💗','Thân thiết']];
var statEls={};STATS.forEach(function(s){var d=document.createElement('div');d.className='st';d.innerHTML='<span>'+s[1]+'</span><div class="bar"><i></i></div><div class="lbl"><b>'+s[2]+'</b><em></em></div>';$('stats').appendChild(d);statEls[s[0]]={i:d.querySelector('i'),n:d.querySelector('em')}});
function updStats(){var s=SV.stats;STATS.forEach(function(k){var v=s[k[0]],e=statEls[k[0]];e.i.style.width=v.toFixed(0)+'%';e.i.style.background=v>60?'#7fd3a8':v>30?'#ffc46b':'#ff7d8f';e.n.textContent=Math.round(v)});
  tb.querySelector('[data-t=food]').classList.toggle('need',SV.food<1&&s.an<50);tb.querySelector('[data-t=water]').classList.toggle('need',SV.water<2&&s.nuoc<50);
  tb.querySelector('[data-t=clean]').classList.toggle('need',SV.dirty>=2||!!SV.puddle);
  $('cName').textContent=SV.name;$('cAge').textContent=ageText(G)+' · '+stageName(G);}
var hintT=0;function hint(msg,ms){var h=$('hint');h.textContent=msg;h.classList.remove('hide');clearTimeout(hintT);hintT=setTimeout(function(){h.classList.add('hide')},ms||3500)}
var toastT=0,toastBusy=0;function toast(msg,ms,cls){var t=$('toast');t.className=cls||'';t.textContent=msg;void t.offsetWidth;t.classList.add('on');clearTimeout(toastT);toastBusy=now()+(ms||3200)/1000;toastT=setTimeout(function(){t.classList.remove('on')},ms||3200)}
$('toast').addEventListener('click',function(){if(this.classList.contains('dex'))openDex()});
function onTool(t){
  var id=t[0];
  if(t[3]){tool=id;tb.querySelectorAll('.tool').forEach(function(b){b.classList.toggle('on',b.dataset.t===id)});if(t[4])hint(t[4]);if(id!=='wand')lure.on=false;if(id!=='laser')laser.on=false;return}
  if(id==='food'){SV.food=100;SND.pour();hint('Đã đổ đầy hạt vào bát 🍗');if(cat.act==='beg')cat.script=null;}
  else if(id==='water'){SV.water=100;SND.water();hint('Đã thay nước mới 💧');if(cat.act==='begw')cat.script=null;}
  else if(id==='clean'){var any=SV.dirty>0||SV.puddle;SV.dirty=0;SV.puddle=null;if(cup.st==='floor'){cup.st='home';cup.p=v3(CUP_HOME);cup.rot=0}SND.sweep();hint(any?'Khay cát sạch bong rồi ✨':'Phòng đã gọn gàng ✨');}
  else if(id==='call')playerCall();
  else if(id==='blink')playerBlink();
  else if(id==='photo')snapReq=true;
  else if(id==='book')openDex();
  save();updStats();
}
function openModal(id){$(id).hidden=false}function closeModal(el){el.closest('.modal').hidden=true}
document.querySelectorAll('[data-close]').forEach(function(b){b.addEventListener('click',function(){closeModal(b)})});
document.querySelectorAll('.modal').forEach(function(m){m.addEventListener('click',function(e){if(e.target===m&&m.id!=='mOnboard')m.hidden=true})});
function openDex(){var g=$('dexGrid');g.innerHTML='';var n=0;DEX.forEach(function(d){var got=SV.dex[d[0]];if(got)n++;var el=document.createElement('div');el.className='dx'+(got?'':' lock')+(SV.dexNew&&SV.dexNew[d[0]]?' new':'');
    el.innerHTML='<b>'+(got?d[1]:'??? ')+'</b><p>'+(got?d[2]:'Chưa thấy bé làm điều này. Chăm bé và quan sát nhé…')+'</p>';g.appendChild(el)});
  $('dexCount').textContent='Đã khám phá '+n+' / '+DEX.length+' tập tính của '+SV.name;SV.dexNew={};tb.querySelector('[data-t=book]').classList.remove('need');openModal('mDex');save();}
$('bMenu').addEventListener('click',function(){$('nameEdit').value=SV?SV.name:'';segOn('speedSeg',SV.grow);segOn('qSeg',Q.lvl);openModal('mMenu')});
$('bSound').addEventListener('click',function(){ac();setSound(!(SV&&SV.sound!==false));save()});
$('bFollow').addEventListener('click',function(){cam.follow=!cam.follow;this.classList.toggle('off',!cam.follow);if(cam.follow){cam.distT=Math.min(cam.distT,11);cam.pitchT=Math.max(cam.pitchT,0.7);hint('Camera đang theo bé')}else{cam.distT=17;hint('Camera nhìn cả phòng')}});

function segOn(id,v){$(id).querySelectorAll('button').forEach(function(b){b.classList.toggle('on',+b.dataset.v===+v)})}
$('speedSeg').addEventListener('click',function(e){var b=e.target.closest('button');if(!b||!SV)return;var g=growG();SV.grow=+b.dataset.v;SV.born=Date.now()-g*SV.grow*864e5;segOn('speedSeg',SV.grow);save();});
$('qSeg').addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;applyQ(+b.dataset.v);if(SV){SV.q=Q.lvl;save()}segOn('qSeg',Q.lvl)});
$('nameEdit').addEventListener('change',function(){var v=this.value.trim();if(v&&SV){SV.name=v.slice(0,14);save();updStats()}});
$('bReset').addEventListener('click',function(){if(!confirm('Xoá toàn bộ tiến trình và nuôi một bé mèo mới?'))return;try{localStorage.removeItem(KEY)}catch(e){}location.reload()});

/* time of day */
var liveTime=true,manualH=12;
$('tSlider').addEventListener('input',function(){liveTime=false;manualH=+this.value;$('live').classList.remove('on')});
$('live').addEventListener('click',function(){liveTime=true;this.classList.add('on')});
function hourNow(){if(!liveTime)return manualH;var d=new Date();return d.getHours()+d.getMinutes()/60+d.getSeconds()/3600}

/* ======================= stats over time ======================= */
var RATE={an:-0.55,nuoc:-0.7,nl:-0.32,vs:-0.5,vui:-0.42,sach:-0.12,tt:-0.03};
function tickStats(dt){var s=SV.stats,m=dt/60,kit=G<0.35?1.3:1;
  s.an+=RATE.an*m*kit*(cat.sleeping?0.5:1);s.nuoc+=RATE.nuoc*m*(cat.sleeping?0.5:1);s.nl+=cat.sleeping?9*m:RATE.nl*m*kit;s.vs+=RATE.vs*m;s.vui+=RATE.vui*m*(cat.sleeping?0.3:1);s.sach+=RATE.sach*m;s.tt+=RATE.tt*m;
  for(var k in s)s[k]=clamp(s[k],3,100);}
function offline(){var m=clamp((Date.now()-SV.last)/60000,0,2880);if(m<1)return 0;var s=SV.stats;
  s.an=Math.max(8,s.an+RATE.an*m*0.6);s.nuoc=Math.max(8,s.nuoc+RATE.nuoc*m*0.6);s.nl=Math.min(100,s.nl+m*1.5);s.vs=Math.max(10,s.vs+RATE.vs*m*0.6);s.vui=Math.max(10,s.vui+RATE.vui*m*0.6);
  s.sach=Math.max(30,s.sach+RATE.sach*m);s.tt=Math.max(5,s.tt+RATE.tt*m);if(m>180&&s.vs<40&&SV.dirty<3)SV.dirty=Math.min(3,SV.dirty+1);
  var eat=Math.min(SV.food,(100-s.an)*0.6);SV.food-=eat;s.an+=eat*1.6;var dr=Math.min(SV.water,(100-s.nuoc)*0.5);SV.water-=dr;s.nuoc+=dr*1.5;for(var k in s)s[k]=clamp(s[k],3,100);return m}

/* ======================= script engine ======================= */
function setScript(name,steps,prio){if(cat.sleeping&&name!=='wake'){cat.sleeping=false}cat.script={name:name,steps:steps,i:0,prio:prio||0};cat.lastAct=cat.act;cat.act=name;cat.hunt=null;}
function stepDefaults(){cat.poseObj=null;cat.ex=moodEx();cat.lookP=null;cat.hyT=0;cat.hpT=0;cat.ovW=0;cat.tailAmp=0.35;cat.tailRate=1.8;cat.tailUpO=null;cat.rollT=0;cat.wig=0;cat.prate=0.02;cat.sleeping=false;cat.bubble='';}
function runScript(dt,t){var S=cat.script;if(!S)return false;var s=S.steps[S.i];if(!s){cat.script=null;return false}
  if(!s._init){s._init=true;s._t0=t;stepDefaults();if(s.pose)cat.pose=s.pose;if(s.roll!==undefined)cat.rollT=s.roll;if(s.init)s.init(s);}
  var el=t-s._t0,k=s.dur?clamp(el/s.dur,0,1):0,done=false;
  if(s.go)done=doGo(s,dt);else if(s.face)done=doFace(s,dt);else if(s.jump)done=doJump(s,t);else if(s.fn){s.fn(s);done=true;}
  if(s.tick&&!done){var r=s.tick(k,dt,el,s);if(r===true)done=true;}
  if(s.dur&&!s.go&&!s.face&&!s.jump&&el>=s.dur)done=true;
  if(done){if(s.end)s.end(s);S.i++;}
  return true}
function steer(dir,tg){var dx=dir[0],dz=dir[1];for(var i=0;i<OBST.length;i++){var o=OBST[i],c=o[0],r=o[1]+0.35*SC+0.15;if(d2(tg[0],tg[1],c[0],c[2])<r+0.1)continue;
    var vx=cat.x-c[0],vz=cat.z-c[2],dd=Math.hypot(vx,vz);if(dd>r+1.2||dd<1e-4)continue;var toward=-(vx*dx+vz*dz)/dd;if(toward<-0.2&&dd>r)continue;
    var push=clamp((r+1.2-dd)/1.2,0,1),side=(dx*vz-dz*vx)>0?1:-1;dx+=(-vz/dd*side)*push*1.6+(vx/dd)*push*(dd<r?1.5:0.4);dz+=(vx/dd*side)*push*1.6+(vz/dd)*push*(dd<r?1.5:0.4);}
  var l=Math.hypot(dx,dz)||1;return [dx/l,dz/l]}
function clampRoom(){cat.x=clamp(cat.x,-RXH+0.45,RXH-0.45);cat.z=clamp(cat.z,-RZH+0.45,RZH-0.45);}
var GRAV=24;
/* keep the cat's body out of furniture and walls (circle-vs-circle push-out) */
function collideCat(){if(cat.y>0.25)return;for(var i=0;i<OBST.length;i++){var o=OBST[i],c=o[0],rr=o[1]*0.82+0.22*SC,dx=cat.x-c[0],dz=cat.z-c[2],d=Math.hypot(dx,dz);
    if(d<rr&&d>1e-4){cat.x=c[0]+dx/d*rr;cat.z=c[2]+dz/d*rr;}}clampRoom();}
/* walk toward a point like a real animal: accelerate, brake before arriving, turn with a radius that grows with speed */
function doGo(s,dt){var tg=typeof s.go==='function'?s.go():s.go;if(!tg)return true;if(!s.direct)tg=[clamp(tg[0],-RXH+0.55,RXH-0.55),clamp(tg[1],-RZH+0.55,RZH-0.55)];
  var tol=s.tol||0.12,dx=tg[0]-cat.x,dz=tg[1]-cat.z,d=Math.hypot(dx,dz);if(d<tol){return true}
  var tn=now();if(s._sd===undefined||d<s._sd-0.08){s._sd=d;s._st=tn}else if(tn-s._st>1.5)return true;
  var vmax=s.speed?s.speed():WALK(),acc=4.5*SC+3,dec=7*SC+4,vStop=Math.sqrt(2*dec*Math.max(0,d-tol*0.5))+0.12,dir=[dx/d,dz/d];if(!s.direct)dir=steer(dir,tg);
  var want=Math.atan2(dir[0],dir[1]),dd=angD(cat.yaw,want),wmax=2.4+5.5/(1+cat.v*1.4);cat.yaw+=clamp(dd,-wmax*dt,wmax*dt);
  var face=Math.max(0,Math.cos(dd)),vd=Math.min(vmax,vStop)*(0.12+0.88*face*face);cat.v+=clamp(vd-cat.v,-dec*dt,acc*dt);
  var stp=Math.min(cat.v*dt,d+0.05);cat.x+=Math.sin(cat.yaw)*stp;cat.z+=Math.cos(cat.yaw)*stp;cat.spd=cat.v;cat.moved=true;if(!s.direct)collideCat();
  cat.pose=s.stalk?'stalk':'stand';if(s.look)cat.lookP=s.look();return false}
function doFace(s,dt){var p=typeof s.face==='function'?s.face():s.face;var want=Math.atan2(p[0]-cat.x,p[2]-cat.z),dd=angD(cat.yaw,want);cat.yaw+=dd*(1-Math.pow(0.003,dt));
  if(Math.abs(dd)>0.3){cat.spd=0.5*SC+0.2;cat.pose=s.pose||'stand';}return Math.abs(dd)<0.08}
function doJump(s,t){var j=s.jump;if(!s._j){var to=typeof j.to==='function'?j.to():j.to,apex=Math.max(cat.y,to[1])+(j.h||0.4),vy=Math.sqrt(2*GRAV*Math.max(0.01,apex-cat.y)),
      dur=vy/GRAV+Math.sqrt(2*Math.max(0.01,apex-to[1])/GRAV);s._j={x0:cat.x,y0:cat.y,z0:cat.z,t0:t,to:to,vy:vy,dur:dur,prep:j.prep===undefined?0.3:j.prep};cat.v=0;
    var dx=to[0]-cat.x,dz=to[2]-cat.z;if(Math.hypot(dx,dz)>0.05)s._j.yaw=Math.atan2(dx,dz);}
  var J=s._j,e=t-J.t0;if(J.yaw!==undefined)cat.yaw=angLerp(cat.yaw,J.yaw,0.25);if(e<J.prep){cat.pose='crouch';cat.prate=0.002;cat.st.sq=0.12*Math.sin(Math.min(1,e/J.prep)*PI*0.5);return false}
  var ta=e-J.prep,a=clamp(ta/J.dur,0,1);cat.x=lerp(J.x0,J.to[0],a);cat.z=lerp(J.z0,J.to[2],a);cat.y=a<1?J.y0+J.vy*ta-0.5*GRAV*ta*ta:J.to[1];
  cat.poseObj=C.jumpPose(POSE,0.2+0.62*a);cat.prate=0.0004;
  if(a>=1){cat.y=J.to[1];cat.landT=t;cat.poseObj=null;cat.pose='crouch';SND.thump();return true}return false}
function approach(p,d){var dx=cat.x-p[0],dz=cat.z-p[2],l=Math.hypot(dx,dz)||1;return [p[0]+dx/l*d,p[2]+dz/l*d]}
function randFloor(){for(var i=0;i<30;i++){var x=rnd(-RXH+1,RXH-1),z=rnd(-RZH+1,RZH-1),ok=true;for(var j=0;j<OBST.length;j++)if(d2(x,z,OBST[j][0][0],OBST[j][0][2])<OBST[j][1]+0.5)ok=false;if(ok)return [x,z]}return [0,1]}
function playerSpot(){var e=cam.eye;if(cam.follow){var dx=e[0]-cat.x,dz=e[2]-cat.z,q=Math.hypot(dx,dz)||1;return [clamp(cat.x+dx/q*1.6,-RXH+1.2,RXH-1.2),clamp(cat.z+dz/q*1.6,-RZH+1.2,RZH-1.2)]}var l=Math.hypot(e[0],e[2])||1;return [clamp(e[0]/l*3.6,-RXH+1.6,RXH-1.6),clamp(e[2]/l*3.6,-RZH+1.6,RZH-1.6)]}
function moodEx(){var s=SV.stats;if(s.vui<20||s.an<15)return 'sad';return s.vui>70&&s.tt>40?'smile':'normal'}
function mewNow(kind){ac();mew(lerp(980,560,G),kind);cat.meowT=now();}
function sayMeow(t,every){if(t-cat.meowT>every){mewNow(Math.random()<0.3?'long':'');cat.exHold=t+0.55}}
function pawTo(side,world,w){var l=toLocal(world);if(side<0)cat.ovL=l;else cat.ovR=l;cat.ovW=w===undefined?1:w;}
function shoulderW(){return cat.r?cat.r.shoulderMid:[cat.x,cat.y+0.35*SC,cat.z]}

/* ======================= behaviours ======================= */
function bEat(){var b=OBJ.food;return [{go:approach(b,0.55*SC+0.45)},{face:b},
  {pose:'eat',dur:rnd(6,9),tick:function(k,dt,el){cat.hpT=0.8;cat.ex='chew';if((el%0.42)<dt)SND.crunch();var take=Math.min(SV.food,dt*6);SV.food-=take;SV.stats.an=Math.min(100,SV.stats.an+take*2);if(SV.food<=0||SV.stats.an>=99)return true},end:function(){cat.lastAte=now();dex('an')}},
  {pose:'sit',dur:1.6,tick:function(){cat.ex='blep'}}]}
function bDrink(){var b=OBJ.water;return [{go:approach(b,0.55*SC+0.45)},{face:b},
  {pose:'eat',dur:rnd(4,6),tick:function(k,dt,el){cat.hpT=0.85;cat.ex='lap';if((el%0.25)<dt)SND.lap();var take=Math.min(SV.water,dt*4);SV.water-=take;SV.stats.nuoc=Math.min(100,SV.stats.nuoc+take*3);if(SV.water<=0||SV.stats.nuoc>=99)return true},end:function(){dex('uong')}}]}
function bBeg(kind){var b=kind==='food'?OBJ.food:OBJ.water;return [{go:approach(b,0.6*SC+0.6)},{face:function(){return cam.eye}},
  {pose:'sit',dur:8,tick:function(k,dt,el,s){cat.lookP=cam.eye;cat.bubble=kind==='food'?'🍗':'💧';sayMeow(now(),2.6);if(el>0.5)dex('kheuan');if(kind==='food'?SV.food>1:SV.water>1)return true},
    init:function(){if(now()-toastBusy>0)toast(SV.name+(kind==='food'?' đói rồi, kêu meo meo đòi ăn. Bấm “Cho ăn” nhé!':' khát nước rồi. Bấm “Nước” nhé!'))}}]}
function kneadTick(k,dt,el){cat.ex='bliss';cat.purr=0.6;var sh=shoulderW(),f=fwd(),f1=Math.sin(el*7);
  pawTo(-1,[sh[0]+f[0]*0.16*SC-f[2]*0.06*SC,cat.y+0.02*SC+Math.max(0,f1)*0.07*SC,sh[2]+f[2]*0.16*SC+f[0]*0.06*SC]);
  pawTo(1,[sh[0]+f[0]*0.16*SC+f[2]*0.06*SC,cat.y+0.02*SC+Math.max(0,-f1)*0.07*SC,sh[2]+f[2]*0.16*SC-f[0]*0.06*SC]);cat.hpT=0.25;}
function sleepTick(k,dt,el){cat.sleeping=true;cat.ex='sleep';cat.hyT=cat.pose==='curl'?0.7:0;cat.hpT=cat.pose==='curl'?0.55:0.1;cat.tailAmp=0.08;cat.tailRate=0.6;cat.bubble='💤';cat.purr=SV.stats.tt>40?0.25:0;
  if(el>2)dex('ngu');if(SV.stats.nl>=98&&el>8)return true}
function wakeSteps(){return [{pose:'stretch',dur:1.8,tick:function(){cat.ex='bliss';cat.tailAmp=0.2},init:function(){dex('vuonvai')}},
  {pose:'sit',dur:1.5,tick:function(k){cat.ex=k<0.75?'yawn':'normal';cat.hpT=-0.2},init:function(){dex('ngap')}}]}
function bSleep(){var p=sunPatch(),steps;
  if(p&&Math.random()<0.55){steps=[{go:[p[0],p[2]]},{pose:'loaf',dur:1.2},{pose:'side',roll:1.3,dur:rnd(30,60),tick:sleepTick,init:function(){dex('phoinang')}}];}
  else{var B=OBJ.bed.c;steps=[{go:approach(B,OBJ.bed.R+0.25)},{jump:{to:[B[0],0.2,B[2]],h:0.3,dur:0.45}},
    {pose:'stand',dur:2.8,tick:kneadTick,init:function(){dex('nhaobot')}},
    {pose:'stand',dur:1.3,tick:function(k,dt){cat.yaw+=dt*TAU/1.3;cat.spd=0.5*SC}},
    {pose:'curl',dur:rnd(40,90),tick:sleepTick}];}
  return steps.concat(wakeSteps())}
function bLitter(refuse){var L=OBJ.litter,c=L.c,en=[c[0]-L.hx-0.5*SC-0.25,c[2]],steps=[{go:en},{face:c}];
  if(refuse)return steps.concat([{pose:'stand',dur:1.6,tick:function(){cat.hpT=0.7;cat.ex='annoyed';cat.bubble='🤢'},init:function(){dex('cheban');if(now()-toastBusy>0)toast('Khay cát bẩn quá, '+SV.name+' không chịu đi. Bấm “Dọn dẹp” nhé!')}},{go:randFloor()}]);
  return steps.concat([{jump:{to:[c[0]-0.15,L.sand,c[2]],h:0.35,dur:0.5}},
    {pose:'stand',dur:1.1,tick:function(){cat.hpT=0.75}},
    {pose:'stand',dur:2.0,tick:function(k,dt,el){cat.hpT=0.6;var f=fwd(),s=shoulderW(),ph=(el*2.2)%1;pawTo(1,[s[0]+f[0]*(0.25-ph*0.3)*SC,L.sand+0.03+Math.sin(ph*PI)*0.06*SC,s[2]+f[2]*(0.25-ph*0.3)*SC]);if((el%0.45)<dt)SND.scratch()}},
    {face:function(){return [c[0]-5,0,c[2]]}},
    {pose:'squat',dur:3.2,tick:function(k,dt){SV.stats.vs=Math.min(100,SV.stats.vs+dt*30);cat.ex='normal';cat.lookP=cam.eye}},
    {face:function(){return [c[0]+5,0,c[2]]}},
    {pose:'stand',dur:1.8,tick:function(k,dt,el){cat.hpT=0.6;var f=fwd(),s=shoulderW(),ph=(el*2.4)%1;pawTo(-1,[s[0]+f[0]*(0.25-ph*0.3)*SC,L.sand+0.03+Math.sin(ph*PI)*0.06*SC,s[2]+f[2]*(0.25-ph*0.3)*SC]);if((el%0.4)<dt)SND.scratch()},end:function(){SV.dirty=Math.min(5,SV.dirty+1);dex('vesinh');save()}},
    {jump:{to:[en[0],0,en[1]],h:0.35,dur:0.5}}]).concat(Math.random()<0.4?bZoomies():[])}
function bAccident(){var R=OBJ.rug.c;return [{go:[R[0]+rnd(-1.5,1.5),R[2]+rnd(-1,1)]},{pose:'squat',dur:2.6,tick:function(k,dt){SV.stats.vs=Math.min(100,SV.stats.vs+dt*40);cat.ex='annoyed'},
  end:function(){SV.puddle=[cat.x-Math.sin(cat.yaw)*0.4*SC,cat.z-Math.cos(cat.yaw)*0.4*SC];SV.stats.tt=Math.max(3,SV.stats.tt-4);dex('dibay');toast(SV.name+' đi bậy ra thảm vì khay cát bẩn quá lâu… Bấm “Dọn dẹp” nhé.',4200);save()}},{go:randFloor()}]}
function bGroom(){return [{pose:'sit',dur:0.5},
  {pose:'sit',dur:2.3,tick:function(k,dt,el){cat.ex='lick';var h=catHead(),f=fwd();pawTo(1,[h[0]+f[0]*0.12*SC,h[1]-0.13*SC+Math.sin(el*9)*0.015*SC,h[2]+f[2]*0.12*SC]);cat.hpT=0.3;cat.hyT=0.15},init:function(){dex('liemlong')}},
  {pose:'sit',dur:2.0,tick:function(k,dt,el){cat.ex='bliss';var h=catHead(),f=fwd(),a=el*6;pawTo(1,[h[0]+f[0]*0.06*SC+f[2]*(0.06+0.05*Math.cos(a))*SC,h[1]-0.02*SC+Math.sin(a)*0.06*SC,h[2]+f[2]*0.06*SC-f[0]*(0.06+0.05*Math.cos(a))*SC]);cat.hpT=0.2;cat.hyT=0.25}},
  {pose:'sit',dur:2.2,tick:function(k,dt){cat.ex='lick';cat.hyT=0.85;cat.hpT=0.5;SV.stats.sach=Math.min(100,SV.stats.sach+dt*6)}},
  {pose:'sit',dur:1.6,tick:function(k,dt){cat.ex='lick';cat.hyT=0;cat.hpT=0.95;SV.stats.sach=Math.min(100,SV.stats.sach+dt*6)}}]}
function bScratch(){var P=OBJ.post,sx=P[0]-0.27-0.36*SC-0.2;return [{go:[sx,P[2]]},{face:P},
  {pose:'beg',dur:3.4,tick:function(k,dt,el){var s=shoulderW(),ph=(el*2.6)%1,ph2=(el*2.6+0.5)%1;
    pawTo(-1,[P[0]-0.28,s[1]+(0.14-ph*0.26)*SC,P[2]-0.09*SC]);pawTo(1,[P[0]-0.28,s[1]+(0.14-ph2*0.26)*SC,P[2]+0.09*SC]);cat.hpT=-0.1;if((el%0.38)<dt)SND.scratch()},init:function(){dex('caotru')}}]}
function bWander(){var p=randFloor();return [{go:p},{pose:Math.random()<0.5?'stand':'sit',dur:rnd(1.2,3),tick:function(k){cat.hpT=k<0.5?0.6:0;}}]}
function bIdle(){var loaf=Math.random()<0.35,looks=[],n=3;for(var i=0;i<n;i++)looks.push(Math.random()<0.4?null:[cat.x+rnd(-5,5),rnd(0,3),cat.z+rnd(-5,5)]);
  return [{pose:loaf?'loaf':'sit',dur:rnd(5,9),tick:function(k,dt,el,s){var i=Math.min(n-1,Math.floor(k*n)),lp=looks[i];cat.lookP=lp||cam.eye;
    if(!lp&&SV.stats.tt>35&&!s._sb&&el>1){s._sb=1;cat.slowBlink=now();dex('chopmat')}}}]}
function bSun(){var p=sunPatch();if(!p)return bIdle();return [{go:[p[0],p[2]]},{pose:'loaf',dur:1},{pose:'side',roll:1.3,dur:rnd(18,30),tick:function(k,dt,el){cat.ex='bliss';cat.tailAmp=0.12;SV.stats.vui=Math.min(100,SV.stats.vui+dt*0.5);if(el>2)dex('phoinang');if(!sunPatch())return true}}]}
function bWindow(){var S=OBJ.sill;return [{go:[S[0],-4.35]},{jump:{to:[S[0],S[1],S[2]],h:0.55,dur:0.6}},{face:[S[0],3,-20]},
  {pose:'sit',dur:rnd(10,18),tick:function(k,dt,el){var b=nearBird();if(b){cat.lookP=[b.x,b.y,b.z];cat.ex='chatter';cat.tailAmp=0.7;cat.tailRate=8;if((el%0.6)<dt)SND.chatter();dex('ngamcuaso')}else{cat.lookP=[S[0]+Math.sin(el*0.7)*3,S[1]+1,-12];}}},
  {face:[S[0],0,0]},{jump:{to:[S[0],0,-4.1],h:0.3,dur:0.55}}]}
function nearBird(){for(var i=0;i<birds.length;i++){var b=birds[i];if(b.x>WX0-1.5&&b.x<WX1+1.5)return b}return null}
function bBox(){var X=OBJ.box.c,ex=[X[0]-OBJ.box.hx-0.5*SC-0.3,X[2]];return [{go:ex},{face:X},{jump:{to:[X[0],0.06,X[2]],h:OBJ.box.h+0.25,dur:0.6}},
  {pose:'loaf',dur:rnd(12,22),tick:function(k,dt,el){cat.lookP=el%6<3?cam.eye:null;if(el>1.5)dex('chuihop')}},{pose:'sit',dur:0.6},{jump:{to:[ex[0],0,ex[1]],h:OBJ.box.h+0.25,dur:0.6}}]}
function bKnockCup(){var TB=OBJ.table,tc=TB.c,fl=[tc[0]-TB.hx-0.45*SC-0.25,-4.15];return [{go:fl},{face:[tc[0],0,-4.15]},{jump:{to:[tc[0]-TB.hx+0.35,TB.h,-4.15],h:0.45,dur:0.55}},
  {go:function(){return [cup.p[0],cup.p[2]-0.55*SC-0.14]},direct:true,speed:function(){return WALK()*0.6}},{face:function(){return cup.p}},
  {pose:'sit',dur:1.4,tick:function(){cat.lookP=cam.eye;cat.ex='normal'}},
  {pose:'stand',dur:2.2,tick:function(k){cat.lookP=cup.p;var c=cup.p;pawTo(1,[c[0],c[1]+0.12,c[2]-0.15+k*0.12],1);if(k>0.55&&cup.st==='home'){cup.st='slide';cup.v=[0,0,1.35];cup.w=0;dex('dayly')}}},
  {pose:'stand',dur:1.3,tick:function(){cat.lookP=cup.p;cat.hpT=0.6;cat.ex='sparkle'}},
  {face:[0,0,0]},{jump:{to:function(){return [clamp(cat.x,0.4,2.8),0,-2.55]},h:0.3,dur:0.55}}]}
function bZoomies(){var s=[];for(var i=0;i<5;i++)s.push({go:randFloor(),speed:RUN,tol:0.5,init:function(){cat.tailUpO=0.9}});
  s[0].init=function(){cat.tailUpO=0.9;dex('chayloan')};s.push({pose:'sit',dur:1.2,tick:function(){cat.ex='lick';cat.hyT=0.8;cat.hpT=0.5}});return s}
function bChaseTail(){return [{pose:'stand',dur:2.8,tick:function(k,dt){cat.yaw+=dt*6.5;cat.spd=1.2*SC;cat.hyT=0.85;cat.hpT=0.3;cat.tailAmp=0.9;cat.tailRate=6;cat.ex='sparkle'},init:function(){dex('duoiduoi')}},{pose:'sit',dur:1,tick:function(){cat.ex='smile'}}]}
function bBall(){if(!ball.on)return bWander();var s=[];for(var i=0;i<3;i++){s.push({go:function(){var a=Math.atan2(cat.x-ball.x,cat.z-ball.z);return [ball.x+Math.sin(a)*(0.42*SC+0.3),ball.z+Math.cos(a)*(0.42*SC+0.3)]},speed:function(){return RUN()*0.75},tol:0.2,look:function(){return [ball.x,0,ball.z]}});
  s.push({face:function(){return [ball.x,0,ball.z]}});
  s.push({pose:'crouch',dur:0.6,tick:function(k,dt,el,st){cat.lookP=[ball.x,0,ball.z];pawTo(1,[ball.x,0.12,ball.z],sm(0.2,0.5,k)*(1-sm(0.7,1,k)));if(k>0.45&&!st._hit){st._hit=1;var f=fwd(),sp=rnd(3,5.5),a=rnd(-0.6,0.6);ball.vx=(f[0]*Math.cos(a)-f[2]*Math.sin(a))*sp;ball.vz=(f[2]*Math.cos(a)+f[0]*Math.sin(a))*sp;ball.vy=rnd(1.2,3.2);SND.ball();dex('choibong');SV.stats.vui=Math.min(100,SV.stats.vui+5)}}});}return s}
function bAttention(){var p=playerSpot(),steps=[{go:p,speed:function(){return WALK()*1.25}},{face:function(){return cam.eye}},
  {pose:'sit',dur:3.6,tick:function(k,dt,el){cat.lookP=cam.eye;cat.tailUpO=1.15;cat.ex=el<0.6?'meow':'smile';if(el<0.05)mewNow('trill');dex('duoidung')}}];
  if(SV.stats.tt>55&&Math.random()<0.6)steps.push({pose:'loaf',dur:0.6},{pose:'side',roll:2.5,dur:4.5,tick:function(){cat.ex='bliss';cat.lookP=cam.eye;cat.hpT=-0.3;dex('phoibung')}},{pose:'loaf',dur:0.8});
  return steps}
function bRub(){var o=pick([OBJ.post,OBJ.lamp,[OBJ.table.c[0]-1.35,0,OBJ.table.c[2]+0.75]]),cl=Math.hypot(o[0],o[2])||1,n=[-o[0]/cl,-o[2]/cl],p=[n[1],-n[0]],off=0.42*SC+0.3,dir=Math.random()<0.5?1:-1,
  A=[o[0]+p[0]*1.1*dir+n[0]*off,o[2]+p[1]*1.1*dir+n[1]*off],B=[o[0]-p[0]*1.1*dir+n[0]*off,o[2]-p[1]*1.1*dir+n[1]*off],mv=[B[0]-A[0],B[1]-A[1]],side=(mv[0]*(-n[1])-mv[1]*(-n[0]))>0?1:-1;
  return [{go:A},{face:[B[0],0,B[1]]},{go:B,speed:function(){return WALK()*0.55},init:function(){dex('coxat')},tick:function(){cat.rollT=0.2*side;cat.ex='bliss';cat.tailUpO=1.0}}]}
function bPlaySolo(){var o=[bZoomies,bScratch];if(ball.on)o.push(bBall,bBall);if(G<0.5)o.push(bChaseTail,bChaseTail);return pick(o)()}

/* ---------- decision making (utility AI) ---------- */
function decide(t){var s=SV.stats,o=[];function a(n,sc,f){if(n===cat.lastAct)sc-=12;o.push([sc+Math.random()*10,n,f])}
  if(SV.food>1)a('eat',(100-s.an)*1.3-12,bEat);else if(s.an<42)a('beg',(100-s.an)*1.1,function(){return bBeg('food')});
  if(SV.water>2)a('drink',(100-s.nuoc)*1.2-14,bDrink);else if(s.nuoc<42)a('begw',(100-s.nuoc),function(){return bBeg('water')});
  a('sleep',(100-s.nl)*1.35-12+(isNight()?16:0)+(G<0.3?10:0),bSleep);
  if(s.vs<60){if(SV.dirty<3)a('litter',(100-s.vs)*1.6-30,function(){return bLitter(false)});else if(s.vs<15&&!SV.puddle)a('accident',95,bAccident);else a('refuse',(100-s.vs)*0.75,function(){return bLitter(true)});}
  a('groom',(100-s.sach)*0.8+(t-cat.lastAte<40?30:0),bGroom);a('play',(100-s.vui)*0.75+(G<0.4?10:0),bPlaySolo);a('scratch',13,bScratch);a('wander',20,bWander);a('idle',19,bIdle);
  if(sunPatch())a('sun',18+(100-s.nl)*0.25,bSun);if(ENV.day>0.5)a('window',15,bWindow);a('box',12,bBox);if(cup.st==='home')a('cup',7+(100-s.tt)*0.08,bKnockCup);
  a('attention',(100-s.tt)*0.3+(100-s.vui)*0.15,bAttention);a('rub',10,bRub);
  o.sort(function(x,y){return y[0]-x[0]});setScript(o[0][1],o[0][2]())}

/* ---------- player actions ---------- */
function playerCall(){if(!catReady)return;if(SV.stats.tt<8&&Math.random()<0.6){cat.lookP=cam.eye;mewNow('');hint(SV.name+' còn ngại, chỉ ngước nhìn bạn. Chăm bé thêm để thân hơn nhé');return}
  var steps=(cat.act==='sleep'&&cat.sleeping?wakeSteps():[]).concat(bAttention());setScript('call',steps,1);hint('Bạn gọi “'+SV.name+' ơi!”');}
var blinkFx=0;function playerBlink(){var fx=$('blinkfx');fx.style.display='block';fx.classList.add('on');setTimeout(function(){fx.classList.remove('on')},650);setTimeout(function(){fx.style.display='none'},1100);
  if(!catReady)return;if(cat.sleeping){hint(SV.name+' đang ngủ say');return}
  if(SV.stats.tt>=12){setTimeout(function(){cat.slowBlink=now();cat.lookP=cam.eye;if(now()-blinkFx>20){SV.stats.tt=Math.min(100,SV.stats.tt+4);blinkFx=now()}dex('chopmat');hint(SV.name+' chớp mắt chậm đáp lại bạn: “nụ hôn mèo” đó 💗',4000)},900)}
  else hint(SV.name+' nhìn bạn tò mò… thân hơn chút nữa bé sẽ chớp mắt lại');}

/* ======================= per-frame cat update ======================= */
var EXB={chew:'normal',lap:'normal',meow:'meow',yawn:'laugh',sleep:'normal',chatter:'sparkle',lick:'bliss',bliss:'bliss',happy:'laugh',smile:'smile',normal:'normal',sparkle:'sparkle',blep:'blep',annoyed:'normal',sad:'normal',wink:'wink'};
function updateCat(dt,t){
  cat.spd=0;cat.purr=0;cat.moved=false;var hq=(t-(cat.hopT||-9))/0.42;cat.hop=hq>=0&&hq<1?4*0.14*SC*hq*(1-hq):0;
  var busyToy=updateToys(dt,t);
  if(!busyToy){if(cat.petting)updatePet(dt,t);else if(!runScript(dt,t))decide(t);}
  /* momentum: when nothing drives the cat any more it glides to a stop instead of freezing */
  if(!cat.moved&&cat.v>0.01&&cat.y<0.3){cat.v=Math.max(0,cat.v-(8*SC+5)*dt);var sl=cat.v*dt;cat.x+=Math.sin(cat.yaw)*sl;cat.z+=Math.cos(cat.yaw)*sl;cat.spd=cat.v;collideCat();}else if(!cat.moved)cat.v=0;
  var st=cat.st,P=cat.poseObj||POSE[cat.pose]||POSE.sit;C.toCP(st,P,1-Math.pow(cat.prate,dt));if(!cat.poseObj)cat.prate=0.02;
  if(cat.tailUpO!==null&&cat.tailUpO!==undefined)st.tailUp+=(cat.tailUpO-st.tailUp)*(1-Math.pow(0.01,dt));
  var moving=cat.spd>0.05;st.gAmp+=((moving?1:0)-st.gAmp)*(1-Math.pow(0.002,dt));if(moving)st.gPh+=cat.spd*dt/(0.42*SC+0.05);
  cat.roll+=(cat.rollT-cat.roll)*(1-Math.pow(0.05,dt));
  var lt=t-cat.landT;st.sq=lt<0.35?Math.sin(lt/0.35*PI)*0.16:st.sq*0.85;
  /* head */
  var hyT=cat.hyT,hpT=cat.hpT;if(cat.lookP&&cat.r){var h=cat.r.headPos,d=sub(cat.lookP,h),rel=angD(cat.yaw,Math.atan2(d[0],d[2]));hyT=clamp(rel,-0.85,0.85);hpT=clamp(Math.atan2(-d[1],Math.hypot(d[0],d[2]))*0.8+0.05,-0.6,0.8);}
  var hk=1-Math.pow(0.004,dt);st.hy+=(hyT-st.hy)*hk;st.hp+=(hpT-st.hp)*hk;st.tilt+=((cat.ex==='sparkle'||cat.ex==='bliss'?0.18*Math.sin(t*0.8):0.06*Math.sin(t*0.6))-st.tilt)*hk;
  /* paws */
  var pw=cat.ovW;st.ovLw+=((cat.ovL&&pw?pw:0)-st.ovLw)*(1-Math.pow(0.001,dt));st.ovRw+=((cat.ovR&&pw?pw:0)-st.ovRw)*(1-Math.pow(0.001,dt));if(cat.ovL)st.ovL=cat.ovL;if(cat.ovR)st.ovR=cat.ovR;
  if(!pw){cat.ovL=cat.ovL&&st.ovLw>0.02?cat.ovL:null;cat.ovR=cat.ovR&&st.ovRw>0.02?cat.ovR:null;}
  /* face */
  var ex=cat.ex;if(cat.exHold&&t<cat.exHold)ex='meow';C.expr(st,EXB[ex]||'normal',dt);
  if(ex==='chew')st.mouth=0.12+0.18*Math.abs(Math.sin(t*9));else if(ex==='lap'){st.blep=Math.sin(t*25)>0?1:0.15;st.mouth=0.04}else if(ex==='lick')st.blep=0.6+0.4*Math.sin(t*12);
  else if(ex==='chatter')st.mouth=Math.sin(t*30)>0?0.45:0.08;else if(ex==='annoyed'){st.pup[0]+=(0.35-st.pup[0])*0.2}else if(ex==='sad'){st.eyeS+=(0.97-st.eyeS)*0.1}
  var bl=C.blinkAt(t,0.7),sb=t-cat.slowBlink;if(sb>=0&&sb<1.8)bl=Math.min(bl,1-0.94*Math.sin(Math.min(1,sb/1.8)*PI));if(ex==='sleep')bl=0.06;st.blink=bl;
  /* tail */
  st.tailT+=dt*cat.tailRate;st.tailSw+=(cat.tailAmp-st.tailSw)*(1-Math.pow(0.05,dt));var cu=cat.pose==='curl'?1.5:(cat.pose==='sit'||cat.pose==='loaf')?0.6:0;st.tailCurl+=(cu-st.tailCurl)*(1-Math.pow(0.1,dt));
  purrLevel(Math.max(cat.purr,cat.petting?0.8:0));if(cat.purr>0.3||cat.petting)dexLater('grugru',3);
}
var dexTimers={};function dexLater(id,s){if(SV.dex[id])return;var t=now();if(!dexTimers[id])dexTimers[id]=t;if(t-dexTimers[id]>s)dex(id)}

/* ---------- toys: feather wand & laser (they take over the cat while active) ---------- */
function updateToys(dt,t){
  if(cat.sleeping&&!(lure.on||laser.on))return false;
  if(lure.on&&t>lure.until&&!lure.held)lure.on=false;
  if(laser.on&&!laser.held&&t>laser.until){laser.on=false;if(cat.hunt&&cat.hunt.kind==='laser'){setScript('search',[{pose:'sit',dur:2.6,tick:function(k){cat.lookP=[cat.x+Math.sin(k*9)*4,0,cat.z+Math.cos(k*7)*4];cat.ex='normal'}}]);
    if(!SV.seenLaserTip){SV.seenLaserTip=1;hint('Chấm đỏ biến mất, bé ngơ ngác tìm… Hãy cho bé vồ cần câu để “bắt được” nha',5000)}}}
  var toy=lure.on?'wand':laser.on?'laser':null;if(!toy){if(cat.hunt){cat.hunt=null;cat.script=null}return false}
  if(cat.y>0.3)return false; /* on furniture: finish the current script first */
  if(!cat.hunt||cat.hunt.kind!==toy){cat.script=null;cat.sleeping=false;cat.hunt={kind:toy,st:'chase',t0:t};stepDefaults();}
  var hn=cat.hunt,tp=toy==='wand'?lure.p:laser.p,d=d2(cat.x,cat.z,tp[0],tp[2]);cat.lookP=[tp[0],0.05,tp[2]];cat.ex='sparkle';cat.tailAmp=0.6;cat.tailRate=5;
  if(hn.st==='chase'){var near=toy==='wand'?1.1*SC+0.6:0.55*SC+0.25;
    if(d>near){doGo({go:[tp[0],tp[2]],speed:function(){return toy==='laser'||d>3?RUN():WALK()*0.65},stalk:toy==='wand'&&d<3.5,tol:0.05},dt);}
    else{hn.st=toy==='wand'?'wiggle':'pounce';hn.t0=t;hn.j=null;}}
  else if(hn.st==='wiggle'){cat.pose='stalk';doFace({face:[tp[0],0,tp[2]]},dt);cat.wig=Math.sin((t-hn.t0)*24)*0.1;cat.tailAmp=0.3;if(t-hn.t0>0.95){cat.wig=0;hn.st='pounce';hn.t0=t;hn.j=null;}}
  else if(hn.st==='pounce'){if(!hn.j){var a=Math.atan2(tp[0]-cat.x,tp[2]-cat.z),back=0.3*SC;hn.j={jump:{to:[tp[0]-Math.sin(a)*back,0,tp[2]-Math.cos(a)*back],h:0.3*SC+0.1,dur:0.4,prep:toy==='wand'?0.12:0.05}};}
    if(doJump(hn.j,t)){var hit=d2(cat.x,cat.z,tp[0],tp[2])<0.55*SC+0.25;
      if(toy==='wand'){if(hit){hn.st='caught';hn.t0=t;SV.stats.vui=Math.min(100,SV.stats.vui+12);SV.stats.tt=Math.min(100,SV.stats.tt+2);dex('rinhvo');hint('Bắt được rồi! 🎉');mewNow('trill')}else{hn.st='chase'}}
      else{hn.st='slap';hn.t0=t;SV.stats.vui=Math.min(100,SV.stats.vui+3);if(t-laser.startT>3)dex('duoilaser')}}}
  else if(hn.st==='caught'){cat.pose='crouch';lure.caught=true;var f3=fwd();lure.p=[cat.x+f3[0]*0.42*SC,0.06,cat.z+f3[2]*0.42*SC];pawTo(-1,[lure.p[0]-f3[2]*0.06,0.06,lure.p[2]+f3[0]*0.06]);pawTo(1,[lure.p[0]+f3[2]*0.06,0.06,lure.p[2]-f3[0]*0.06]);cat.ex='happy';
    if(t-hn.t0>1.6||!lure.caught){lure.caught=false;hn.st='chase';cat.ovW=0}}
  else if(hn.st==='slap'){cat.pose='crouch';pawTo(1,[tp[0],0.05,tp[2]],t-hn.t0<0.3?1:0);if(t-hn.t0>0.45)hn.st='chase';}
  return true}

/* ---------- petting & brushing ---------- */
var petOver=0,heartT=0;
function heartAt(x,y,em){var h=document.createElement('span');h.className='hf';h.textContent=em||'💗';h.style.left=(x+rnd(-14,14))+'px';h.style.top=(y-10)+'px';document.body.appendChild(h);setTimeout(function(){h.remove()},950)}
function startPet(p){if(!catReady)return;cat.petting=true;cat.petP=p;cat.petT=cat.petT>0&&now()-cat.petEnd<4?cat.petT:0;if(!cat.sleeping){cat.script=null;stepDefaults();}}
function endPet(){if(cat.petting){cat.petting=false;cat.petEnd=now();}}
function updatePet(dt,t){var brush=tool==='brush',belly=Math.abs(cat.roll)>2;cat.petT+=dt;
  if(cat.sleeping){cat.ex='sleep';cat.purr=0.6;cat.bubble='💗';return}
  if(cat.y<0.3&&cat.pose!=='side'&&cat.pose!=='loaf')cat.pose=cat.pose==='stand'?'stand':'sit';
  cat.lookP=cat.petP;cat.ex='bliss';cat.tailAmp=0.18;cat.tailRate=1;cat.tailUpO=cat.pose==='sit'?0.4:null;cat.bubble='💗';
  SV.stats.tt=Math.min(100,SV.stats.tt+dt*(brush?0.7:1.3));SV.stats.vui=Math.min(100,SV.stats.vui+dt*0.8);if(brush)SV.stats.sach=Math.min(100,SV.stats.sach+dt*3.5);
  var limit=belly?1.6:(brush?16:9+SV.stats.tt*0.04);
  if(cat.petT>limit){cat.ex='annoyed';cat.tailAmp=1.0;cat.tailRate=10;cat.bubble='😾';dex('vutduoi');if(t-petOver>6){petOver=t;hint(belly?'Bé không thích bị xoa bụng đâu!':'Đuôi bé quất mạnh rồi: bé đang bảo “đủ rồi đó!”',3500)}}
  if(cat.petT>limit+2.6){cat.petting=false;cat.petT=0;SND.hiss();SV.stats.tt=Math.max(3,SV.stats.tt-3);var away=randFloor();
    setScript('swat',[{pose:belly?'loaf':'crouch',dur:0.45,tick:function(k){cat.ex='annoyed';pawTo(1,cam.eye,k<0.6?1:0)}},{go:away,speed:RUN,init:function(){cat.tailUpO=0.2}}]);}}
function hitCat(sx,sy){if(!catReady||!cat.r)return null;var r=ray(sx,sy),R=cat.r,pts=[[R.headPos,0.2*SC*1.45],[xf(R.chest,CAT.J.N0),0.2*SC*1.25],[xf(R.pelvis,CAT.J.MID),0.2*SC*1.3],[xf(R.pelvis,CAT.J.P0),0.19*SC*1.25]],best=-1;
  for(var i=0;i<pts.length;i++){var tt=raySphere(r,pts[i][0],pts[i][1]);if(tt>0&&(best<0||tt<best))best=tt}if(best>0)return add(r.o,scl(r.d,best));
  /* fingers are big and the kitten is small: accept touches near the cat on screen too */
  var c=pts[1][0],sc=toScreen(c),hs=toScreen(R.headPos),rad=Math.max(56,Math.hypot(sc[0]-hs[0],sc[1]-hs[1])*1.6);return Math.hypot(sx-sc[0],sy-sc[1])<rad||Math.hypot(sx-hs[0],sy-hs[1])<rad*0.8?c:null}

/* ======================= physics: ball, cup, birds ======================= */
function updWorld(dt,t){
  if(ball.on){var B=ball,n=2;for(var it=0;it<n;it++){var h=dt/n;B.vy-=GRAV*h;B.x+=B.vx*h;B.y+=B.vy*h;B.z+=B.vz*h;
      if(B.y<B.r){B.y=B.r;if(B.vy<-1.4){B.vy=-B.vy*0.45;SND.ball()}else B.vy=0;}
      var onF=B.y<=B.r+0.01;if(onF){var fr=Math.exp(-0.9*h);B.vx*=fr;B.vz*=fr;var sp=Math.hypot(B.vx,B.vz);if(sp<0.04){B.vx=0;B.vz=0}}
      if(B.x<-RXH+B.r||B.x>RXH-B.r){B.vx*=-0.6;B.x=clamp(B.x,-RXH+B.r,RXH-B.r);SND.ball()}if(B.z<-RZH+B.r||B.z>RZH-B.r){B.vz*=-0.6;B.z=clamp(B.z,-RZH+B.r,RZH-B.r);SND.ball()}
      for(var i=0;i<OBST.length;i++){var o=OBST[i],dx=B.x-o[0][0],dz=B.z-o[0][2],dd=Math.hypot(dx,dz),rr=o[1]*0.8+B.r;if(dd<rr&&dd>1e-4){var nx=dx/dd,nz=dz/dd,vn=B.vx*nx+B.vz*nz;if(vn<0){B.vx-=1.55*vn*nx;B.vz-=1.55*vn*nz;}B.x=o[0][0]+nx*rr;B.z=o[0][2]+nz*rr;}}
      /* the cat's body shoves the ball when it walks into it */
      if(catReady&&cat.y<0.3&&B.y<0.7){var f=fwd(),cx=cat.x+f[0]*0.12*SC,cz=cat.z+f[2]*0.12*SC,cr=0.3*SC+B.r,ex=B.x-cx,ez=B.z-cz,ed=Math.hypot(ex,ez);
        if(ed<cr&&ed>1e-4){var mx=ex/ed,mz=ez/ed,rv=(B.vx-f[0]*cat.v)*mx+(B.vz-f[2]*cat.v)*mz;if(rv<0){B.vx-=1.5*rv*mx;B.vz-=1.5*rv*mz;}B.x=cx+mx*cr;B.z=cz+mz*cr;}}}
    var spd=Math.hypot(B.vx,B.vz);if(spd>1e-3&&B.y<B.r+0.05)B.R=mul(C.rotAxis(nrm([B.vz,0,-B.vx]),spd*dt/B.r),B.R);}
  /* feather on a string: a damped pendulum hanging from the rod tip, dragging on the floor */
  if(lure.on){var L=lure;L.tip=mix(L.tip,L.tipT,1-Math.exp(-14*dt)).slice(0,3);if(!L.held)L.tipT=[L.tipT[0],Math.min(L.tipT[1]+dt*0.6,2.6),L.tipT[2]];
    for(var k2=0;k2<3;k2++){var hh=dt/3;if(L.caught){L.v=[0,0,0];break}L.v[1]-=GRAV*hh;var drag=Math.exp(-1.6*hh);L.v=scl(L.v,drag);L.p=add(L.p,scl(L.v,hh));
      var dv=sub(L.p,L.tip),dl=len3(dv);if(dl>L.len){var nn=scl(dv,1/dl);L.p=add(L.tip,scl(nn,L.len));var vr=dot(L.v,nn);if(vr>0)L.v=sub(L.v,scl(nn,vr));}
      if(L.p[1]<0.05){L.p[1]=0.05;if(L.v[1]<0)L.v[1]=0;var g2=Math.exp(-7*hh);L.v[0]*=g2;L.v[2]*=g2;}}}
  var TBz=OBJ.table.c[2]+OBJ.table.hz;
  if(cup.st==='slide'){cup.v[2]=Math.max(0,cup.v[2]-1.1*dt);cup.p[2]+=cup.v[2]*dt;if(cup.p[2]>TBz-0.05){cup.st='tip';cup.w=0.5}else if(cup.v[2]<=0)cup.st='home';}
  else if(cup.st==='tip'){cup.w+=GRAV/0.3*Math.sin(Math.max(0.05,cup.rot))*dt*0.35;cup.rot+=cup.w*dt;cup.p[2]+=Math.max(0.3,cup.v[2])*dt;if(cup.rot>0.55||cup.p[2]>TBz+0.12){cup.st='fall';cup.v=[0,0.2,Math.max(0.5,cup.v[2])];}}
  else if(cup.st==='fall'){cup.v[1]-=GRAV*dt;cup.p[0]+=cup.v[0]*dt;cup.p[1]+=cup.v[1]*dt;cup.p[2]+=cup.v[2]*dt;cup.rot+=cup.w*dt;var ch=0.19*Math.abs(Math.sin(cup.rot));
    if(cup.p[1]<=ch){cup.p[1]=ch;if(cup.v[1]<-2){cup.v[1]=-cup.v[1]*0.32;cup.w*=0.45;cup.v[2]*=0.6;SND.clink();}else{cup.st='floor';cup.t=t;cup.v=[0,0,cup.v[2]*0.5];SND.clink();}}}
  else if(cup.st==='floor'){var tr=Math.round((cup.rot-PI/2)/PI)*PI+PI/2;cup.rot+=(tr-cup.rot)*(1-Math.exp(-8*dt));cup.v[2]*=Math.exp(-3*dt);cup.p[2]+=cup.v[2]*dt;cup.p[1]=0.19*Math.abs(Math.sin(cup.rot));if(t-cup.t>60){cup.st='home';cup.p=v3(CUP_HOME);cup.rot=0}}
  if(ENV.day>0.45&&t>nextBird&&birds.length<2){var dir=Math.random()<0.5?1:-1;birds.push({x:dir>0?WX0-4:WX1+4,y:rnd(WY0+0.6,WY1-0.4),z:-RZH-1.6,vx:dir*rnd(1.2,2.2),ph:rnd(0,6)});nextBird=t+rnd(9,25);}
  for(var b=birds.length-1;b>=0;b--){var B=birds[b];B.x+=B.vx*dt;B.y+=Math.sin(t*2+B.ph)*0.4*dt;if(Math.random()<dt*0.6&&B.x>WX0&&B.x<WX1)SND.bird();if(Math.abs(B.x-(WX0+WX1)/2)>7)birds.splice(b,1);}
  clouds.forEach(function(c){c.x+=dt*0.12;if(c.x>WX1+3)c.x=WX0-3});}
function throwBall(p){var s=playerSpot();ball.on=true;ball.x=s[0];ball.z=s[1];ball.y=1.3;var dx=p[0]-s[0],dz=p[2]-s[1],l=Math.hypot(dx,dz)||1,T0=0.55;ball.vx=dx/T0*0.75;ball.vz=dz/T0*0.75;ball.vy=(0.24-1.3)/T0+0.5*GRAV*T0;SND.ball();
  if(catReady&&!cat.sleeping&&cat.y<0.3&&SV.stats.nl>15&&cat.act!=='eat')setScript('ball',bBall());}

/* ======================= input ======================= */
var ptrs={},drag=null,pinch=null,snapReq=false;
cv.addEventListener('pointerdown',function(e){ac();try{cv.setPointerCapture(e.pointerId)}catch(_){}ptrs[e.pointerId]={x:e.clientX,y:e.clientY};var ids=Object.keys(ptrs);
  if(ids.length===1){var m='orbit',hp=null;if((tool==='pet'||tool==='brush')&&(hp=hitCat(e.clientX,e.clientY)))m='pet';else if(tool==='wand')m='wand';else if(tool==='laser')m='laser';
    drag={m:m,id:e.pointerId,sx:e.clientX,sy:e.clientY,x:e.clientX,y:e.clientY,t:now(),moved:false};
    if(m==='pet')startPet(hp);else if(m==='wand'){var p=floorPoint(e.clientX,e.clientY);if(p){var fresh=!lure.on;lure.on=true;lure.held=true;lure.caught=false;lure.tipT=[p[0],1.7,p[2]];if(fresh){lure.tip=v3(lure.tipT);lure.p=[p[0],0.06,p[2]];lure.v=[0,0,0];}}}
    else if(m==='laser'){var q=floorPoint(e.clientX,e.clientY);if(q){if(!laser.on)laser.startT=now();laser.on=true;laser.held=true;laser.p=[q[0],0.02,q[2]];}}}
  else if(ids.length===2){if(drag){endDrag();drag=null}var a=ptrs[ids[0]],b=ptrs[ids[1]];pinch={d:Math.hypot(a.x-b.x,a.y-b.y),dist:cam.distT,cx:(a.x+b.x)/2,yaw:cam.yawT};}});
cv.addEventListener('pointermove',function(e){var p=ptrs[e.pointerId];if(!p)return;var dx=e.clientX-p.x,dy=e.clientY-p.y;p.x=e.clientX;p.y=e.clientY;var ids=Object.keys(ptrs);
  if(ids.length>=2&&pinch){var a=ptrs[ids[0]],b=ptrs[ids[1]],d=Math.hypot(a.x-b.x,a.y-b.y);cam.distT=clamp(pinch.dist*pinch.d/Math.max(30,d),6.5,34);cam.yawT=pinch.yaw-((a.x+b.x)/2-pinch.cx)*0.008;return}
  if(!drag||drag.id!==e.pointerId)return;if(Math.hypot(e.clientX-drag.sx,e.clientY-drag.sy)>8)drag.moved=true;
  if(drag.m==='orbit'){cam.yawT-=dx*0.008;cam.pitchT+=dy*0.005;}
  else if(drag.m==='pet'){var hp=hitCat(e.clientX,e.clientY);if(hp)cat.petP=hp;if(now()-heartT>0.14){heartT=now();heartAt(e.clientX,e.clientY,tool==='brush'?'✨':(cat.petT>9?'💢':'💗'))}}
  else if(drag.m==='wand'){var q=floorPoint(e.clientX,e.clientY);if(q){lure.tipT=[q[0],1.7,q[2]];if(lure.caught&&len3(sub(lure.tipT,lure.tip))>0.6)lure.caught=false;}}
  else if(drag.m==='laser'){var r2=floorPoint(e.clientX,e.clientY);if(r2)laser.p=[r2[0],0.02,r2[2]];}});
function laserJitter(t){if(laser.on&&laser.held){laser.p[0]+=Math.sin(t*23.1)*0.004+Math.sin(t*7.3)*0.003;laser.p[2]+=Math.cos(t*19.7)*0.004;}}
function endDrag(){if(!drag)return;if(drag.m==='pet')endPet();if(drag.m==='wand'){lure.held=false;lure.until=now()+3;}if(drag.m==='laser'){laser.held=false;laser.until=now()+0.3;}}
function onUp(e){var p=ptrs[e.pointerId];delete ptrs[e.pointerId];if(Object.keys(ptrs).length<2)pinch=null;
  if(drag&&drag.id===e.pointerId){var tap=!drag.moved&&now()-drag.t<0.45;endDrag();if(tap&&e.type==='pointerup')onTap(e.clientX,e.clientY,drag.m);drag=null;}}
cv.addEventListener('pointerup',onUp);cv.addEventListener('pointercancel',onUp);
cv.addEventListener('wheel',function(e){e.preventDefault();cam.distT=clamp(cam.distT*Math.exp(e.deltaY*0.0012),6.5,34)},{passive:false});
['gesturestart','gesturechange'].forEach(function(n){document.addEventListener(n,function(e){e.preventDefault()},{passive:false})});
function onTap(x,y,m){var hc=hitCat(x,y);
  if(hc){for(var hi=0;hi<4;hi++)setTimeout(function(){heartAt(x,y)},hi*70);if(cat.sleeping){hint(SV.name+' đang ngủ, khẽ gừ gừ…');cat.purr=0.6;return}mewNow(Math.random()<0.5?'trill':'');cat.hopT=now();cat.lookP=cam.eye;cat.exHold=now()+0.5;SV.stats.tt=Math.min(100,SV.stats.tt+0.5);
    if(!cat.script||cat.script.name==='idle'||cat.script.name==='wander')setScript('look',[{pose:'sit',dur:2.2,tick:function(){cat.lookP=cam.eye;cat.ex='smile'}}]);return}
  if(tool==='ball'){var p=floorPoint(x,y);if(p)throwBall(p);return}
  if(cup.st==='floor'){var s=toScreen(cup.p);if(Math.hypot(s[0]-x,s[1]-y)<40){cup.st='home';cup.p=v3(CUP_HOME);cup.rot=0;cup.w=0;hint('Đã đặt lại cốc lên bàn');}}}

/* ======================= rendering ======================= */
var Gw=null,Gwalls=null,Gd=null,texFloor=null,texWall=null,Gfloor=null;
function buildScene(){var W=buildWorld();Gw=E.upload(W);var F=new Mesh();F.surf(function(u,v){return [lerp(-RXH,RXH,u),0.004,lerp(RZH,-RZH,v)]},2,2,WHITE,null,function(u,v,lp){return [lp[0]*0.25,lp[2]*0.25]});Gfloor=E.upload(F);
  texFloor=E.texture(floorTex());repeatTex(texFloor);texWall=E.texture(wallTex());repeatTex(texWall);
  Gwalls=buildWalls().map(function(w){return {m:E.upload(w.m),p:E.upload(w.p)}});var D=buildDynamic();Gd={};for(var k in D)Gd[k]=E.upload(D[k]);}
function wallVisible(i,e){return i===0?e[2]>-RZH:i===1?e[0]>-RXH:i===2?e[0]<RXH:e[2]<RZH}
var I=I4(),LVP=I4();
function drawDynamic(D,shadow){if(!SV)return;var dr=shadow?function(g,m){E.drawD(g,m)}:function(g,m,tint){E.draw(g,m,tint)};
  if(SV.food>0.5){var f=clamp(SV.food/100,0.15,1);dr(Gd.kibble,M(T(OBJ.food[0],0.08,OBJ.food[2]),Sc(1,f,1)));}
  if(SV.water>0.5&&!shadow)dr(Gd.waterS,T(OBJ.water[0],0.1+0.15*SV.water/100,OBJ.water[2]));
  var L=OBJ.litter;for(var i=0;i<SV.dirty;i++)dr(Gd.clump,T(L.c[0]+0.45*Math.cos(i*2.1+0.5)*(0.5+i*0.12),L.sand+0.03,L.c[2]+0.4*Math.sin(i*2.1+0.5)*(0.6+i*0.1)));
  if(SV.puddle&&!shadow)dr(Gd.puddle,T(SV.puddle[0],0,SV.puddle[1]));
  if(ball.on)dr(Gd.ball,M(T(ball.x,ball.y,ball.z),ball.R));
  dr(Gd.cup,M(T(cup.p),RX(cup.rot)));
  if(lure.on){var lp=lure.p,tp2=lure.tip,sd=sub(tp2,lp),sl=len3(sd)||1e-3,yaw2=Math.atan2(lure.v[0],lure.v[2]);dr(Gd.lure,M(T(lp[0],lp[1]+0.04,lp[2]),RY(yaw2)));
    if(!shadow){dr(Gd.string,C.alignY([lp[0],lp[1]+0.06,lp[2]],sd,sl));var rd=nrm(sub(cam.eye,tp2));dr(Gd.rod,C.alignY(tp2,[rd[0]*0.6,1,rd[2]*0.6],2.6));}}}
function render(t){
  var env=ENV,shOn=shadowOK&&Q.lvl>0&&env.sunI>0.2;
  if(shOn){var c=[0,1.5,-0.5],L=env.L,ey=add(c,scl(L,26));LVP=mul(C.ortho(-11.5,11.5,-11.5,11.5,4,50),C.lookAt(ey,c,Math.abs(L[1])>0.98?[0,0,1]:[0,1,0]));
    if(E.shadowBegin(LVP)){E.drawD(Gw,I);for(var i=0;i<4;i++)E.drawD(Gwalls[i].m,I);drawDynamic(Gd,true);
      if(catReady){var r0=C.poseCat(CAT,cat.st,catM0(),t);E.drawSkinD(GC.skin,r0.dq,r0.R0);E.drawD(GC.head,r0.head);E.drawD(GC.chest,r0.chest);}E.shadowEnd();}}
  E.begin(cv.width,cv.height,cam.VP,cam.eye,env.L,env.fog,{amb0:env.amb0,amb1:env.amb1,sun:env.sun,lampP:env.lampP,lampC:env.lampC,shadow:shOn});
  E.draw(Gw,I);E.draw(Gfloor,I,null,texFloor);
  for(var w=0;w<4;w++)if(wallVisible(w,cam.eye)){E.draw(Gwalls[w].m,I);E.draw(Gwalls[w].p,I,null,texWall);}
  if(wallVisible(0,cam.eye)){E.draw(Gd.sky,I,env.sky);var cc=mix([1,1,1],env.sky,0.35+0.4*(1-env.day)).slice(0,3);clouds.forEach(function(c){E.draw(Gd.cloud,M(T(c.x,c.y,-RZH-2.4),Sc(c.s)),cc)});
    birds.forEach(function(b){var fl=Math.sin(t*16+b.ph)*0.7,dir=b.vx>0?PI/2:-PI/2,Mb=M(T(b.x,b.y,b.z),RY(dir));E.draw(Gd.bird,Mb);E.draw(Gd.wing,M(Mb,T(0.05,0.04,0),RZ(fl)));E.draw(Gd.wing,M(Mb,Sc(-1,1,1),T(0.05,0.04,0),RZ(fl)));});}
  E.draw(Gd.bulb,T(env.lampP[0]-0.1,env.lampP[1]-0.15,env.lampP[2]),mix([0.95,0.92,0.88],[1,0.85,0.55],1-env.day).slice(0,3));
  drawDynamic(Gd,false);
  if(catReady)cat.r=C.drawCat(E,GC,CAT,catM0(),cat.st,t);
  /* soft sprites */
  E.sprites([cam.V[0],cam.V[4],cam.V[8]],[cam.V[1],cam.V[5],cam.V[9]]);
  if(catReady){var sh=1-Math.min(0.6,cat.hop+Math.max(0,cat.y-0.25)*0.0),gy=cat.y>0.3?cat.y:0;E.sprite([cat.x,gy+0.015,cat.z-0.05*SC],[0.55*SC*sh+0.1,0.8*SC*sh+0.1],[0.25,0.15,0.2,0.3],1.6,false);}
  if(ball.on)E.sprite([ball.x,0.015,ball.z],[0.32,0.32],[0.25,0.15,0.2,0.28],1.5,false);
  [[OBJ.bed.c,1.6],[OBJ.litter.c,1.7],[OBJ.box.c,1.4],[OBJ.post,1.0],[OBJ.table.c,1.9]].forEach(function(o){E.sprite([o[0][0],0.012,o[0][2]],[o[1],o[1]*0.8],[0.25,0.15,0.2,0.14],1.3,false)});
  if(env.lampC[0]>0.1)E.sprite([env.lampP[0]-0.1,env.lampP[1]-0.15,env.lampP[2]],[1.4,1.4],[env.lampC[0]*0.35,env.lampC[1]*0.35,env.lampC[2]*0.35,0.5],2.2,true,true);
  if(laser.on){E.sprite(laser.p,[0.09,0.09],[1,0.2,0.2,1],1.2,true,true);E.sprite(laser.p,[0.35,0.35],[1,0.1,0.1,0.5],2.5,true,true);}
  var sp=sunPatch();if(sp&&env.sunI>0.4){var Wc=[(WX0+WX1)/2,(WY0+WY1)/2,-RZH+0.2];for(var k=0;k<14;k++){var a=((t*0.05+k*0.0713)%1),q=mix(Wc,[sp[0],0.3,sp[2]],a),j=Math.sin(k*12.9+t*0.3)*0.6;
      E.sprite([q[0]+j,q[1]+Math.cos(k*7.1+t*0.4)*0.4,q[2]+Math.sin(k*3.3)*0.6],[0.05,0.05],[1,0.95,0.8,0.7*Math.sin(a*PI)],1.4,true,true);}}
  E.end();
  if(snapReq){snapReq=false;doSnap();}
}
function doSnap(){var o=document.createElement('canvas');o.width=cv.width;o.height=cv.height;var x=o.getContext('2d'),g=x.createLinearGradient(0,0,0,o.height);g.addColorStop(0,rgb(ENV.bgT));g.addColorStop(1,rgb(ENV.bgB));x.fillStyle=g;x.fillRect(0,0,o.width,o.height);x.drawImage(cv,0,0);
  var s=Math.round(18*DPR);x.font='800 '+s+'px "Baloo 2", Nunito, sans-serif';x.fillStyle='rgba(255,255,255,0.92)';x.shadowColor='rgba(0,0,0,0.35)';x.shadowBlur=6;x.fillText('🐾 '+SV.name+' · '+ageText(G),s,o.height-s);
  var url=o.toDataURL('image/jpeg',0.92);$('photoImg').src=url;SND.shutter();openModal('mPhoto');
  $('bShare').onclick=function(){fetch(url).then(function(r){return r.blob()}).then(function(b){var f=new File([b],SV.name+'.jpg',{type:'image/jpeg'});
    if(navigator.canShare&&navigator.canShare({files:[f]}))return navigator.share({files:[f],title:SV.name});var a=document.createElement('a');a.href=url;a.download=SV.name+'.jpg';a.click();}).catch(function(){})};}
function rgb(c){return 'rgb('+(c[0]*255|0)+','+(c[1]*255|0)+','+(c[2]*255|0)+')'}

/* ======================= HUD over the cat ======================= */
var bub=$('bubble'),bubOn=false;
function updHud(){if(!catReady||!cat.r){bub.classList.remove('on');return}var s=SV.stats,e=cat.bubble;
  if(!e){if(s.an<22)e='🍗';else if(s.nuoc<22)e='💧';else if(s.vs<20)e='🚽';else if(s.nl<18)e='😴';else if(s.vui<20)e='🧶';}
  if(e){var h=cat.r.headPos,p=toScreen([h[0],h[1]+0.42*SC+0.25,h[2]]);if(bub.textContent!==e)bub.textContent=e;bub.style.transform='translate3d('+(p[0]).toFixed(0)+'px,'+(p[1]).toFixed(0)+'px,0) translate(-50%,-100%)';if(!bubOn){bub.classList.add('on');bubOn=true}}
  else if(bubOn){bub.classList.remove('on');bubOn=false}
  if(dexQueue.length&&now()>toastBusy){var id=dexQueue.shift();toast('📖 Tập tính mới: '+DEXN[id][1]+' · chạm để đọc',3600,'dex');SND.ding();}}

/* ======================= main loop ======================= */
var lastT=now(),statT=0,saveT=0,growT=0,slowF=0,frames=0,fpsT=now();
function frame(){requestAnimationFrame(frame);if(document.hidden)return;var t=now(),dt=Math.min(0.05,t-lastT);lastT=t;
  if(cv.width!==Math.round(innerWidth*DPR)||cv.height!==Math.round(innerHeight*DPR))resize();
  envAt(hourNow());if(liveTime){$('tSlider').value=ENV.h.toFixed(2)}var hh=Math.floor(ENV.h),mm=Math.floor((ENV.h-hh)*60);$('clock').textContent=(hh<10?'0':'')+hh+':'+(mm<10?'0':'')+mm;
  if(SV&&catReady){tickStats(dt);updateCat(dt,t);}
  if(SV){updWorld(dt,t);laserJitter(t);}updCam(dt);render(t);
  if(SV&&catReady){updHud();statT+=dt;if(statT>0.4){statT=0;updStats();}saveT+=dt;if(saveT>5){saveT=0;save();}growT+=dt;if(growT>20){growT=0;checkGrowth();}}
  /* adaptive resolution: if the phone struggles, render fewer pixels */
  frames++;if(t-fpsT>2.5){var fps=frames/(t-fpsT);frames=0;fpsT=t;if(fps<24&&Q.scale>0.62){Q.scale*=0.88;resize();}else if(fps>52&&Q.scale<1){Q.scale=Math.min(1,Q.scale*1.08);resize();}}
  var bg=$('bg');var key=ENV.bgT.map(function(v){return (v*20|0)}).join();if(bg._k!==key){bg._k=key;bg.style.background='linear-gradient(180deg,'+rgb(ENV.bgT)+','+rgb(ENV.bgB)+')';}}
addEventListener('visibilitychange',function(){if(document.hidden){save();purrLevel(0)}else lastT=now()});
addEventListener('pagehide',save);

/* ======================= start ======================= */
function start(first){G=growG();var k=stageOf(G);$('loadMsg').textContent=first?'Bé đang ngó ra khỏi hộp…':'Đang gọi '+SV.name+' ra…';
  getCat(SV.coat,k).then(function(c){setCatMesh(c,k);updStats();$('loading').classList.add('gone');
    if(first){var X=OBJ.box.c;cat.x=X[0];cat.z=X[2];cat.y=0.06;cat.yaw=-PI/2;setScript('arrive',[{pose:'loaf',dur:1.4,tick:function(){cat.lookP=cam.eye}},{jump:{to:[X[0]-OBJ.box.hx-0.9,0,X[2]-0.3],h:OBJ.box.h+0.3,dur:0.6}},
      {pose:'sit',dur:2.5,tick:function(k,dt,el){cat.lookP=cam.eye;cat.ex='sparkle';if(el<0.05)mewNow('trill')}}]);toast('Chào mừng '+SV.name+' về nhà! 🏡',3600);setTimeout(function(){hint('Kéo ngón tay trên người bé để vuốt ve 🐾',4500)},3800);}
    else{var gone=SV._away||0;if(gone>60){setScript('greet',bAttention());toast(SV.name+' nhớ bạn quá, chạy ra đón nè!',3600)}}
    if(k+1<window.CAT_STAGES)setTimeout(function(){getCat(SV.coat,k+1)},4000);
  }).catch(function(err){$('loadMsg').textContent='Không dựng được bé mèo: '+err;});}
function onboard(){var wrap=$('coats'),sel='cam';wrap.innerHTML='';Object.keys(window.COATS).forEach(function(k){var c=window.COATS[k],d=document.createElement('button');d.className='coat'+(k===sel?' on':'');
    d.innerHTML='<div class="sw" style="background:linear-gradient(135deg,'+c.swatch[0]+' 0 45%,'+c.swatch[1]+' 45% 75%,'+c.swatch[2]+' 75%)"></div>'+c.name;
    d.addEventListener('click',function(){sel=k;wrap.querySelectorAll('.coat').forEach(function(x){x.classList.remove('on')});d.classList.add('on');getCat(sel,0)});wrap.appendChild(d);});
  getCat(sel,0);$('loading').classList.add('gone');openModal('mOnboard');
  $('bAdopt').onclick=function(){ac();SV=defSave();SV.coat=sel;SV.name=($('nameIn').value.trim()||'Mochi').slice(0,14);if(SV.q<0)SV.q=Q.lvl;save();$('mOnboard').hidden=true;$('loading').classList.remove('gone');start(true);};}
resize();buildScene();envAt(hourNow());
SV=loadSave();
if(SV){if(SV.q>=0)applyQ(SV.q);else applyQ(Q.lvl);SV._away=offline();setSound(SV.sound!==false);start(false);}else{applyQ(Q.lvl);onboard();}
requestAnimationFrame(frame);
/* test/debug handle */
window.__meo={cam:cam,cat:cat,get SV(){return SV},setScript:setScript,B:{eat:bEat,sleep:bSleep,groom:bGroom,scratch:bScratch,litter:bLitter,window:bWindow,box:bBox,cup:bKnockCup,zoom:bZoomies,tail:bChaseTail,att:bAttention,rub:bRub,sun:bSun},onTool:function(id){onTool(TOOLS.filter(function(t){return t[0]===id})[0])},lure:lure,laser:laser,ball:ball,cup:cup,throwBall:throwBall};
})();
