/* cat3d.js — the math cat: SDF body -> surface nets mesh, 16-bone dual-quaternion skin, shell fur,
   procedural poses and expressions; tiny WebGL engine with sun shadow map. Works in a Worker too. */
(function(G){'use strict';
/* ================================================================
   MATH: column-major 4x4 matrices + parametric surfaces
   ================================================================ */
var PI=Math.PI,TAU=PI*2;
function I4(){return [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]}
function mul(a,b){var o=new Array(16);for(var c=0;c<4;c++)for(var r=0;r<4;r++){o[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];}return o;}
function M(){var m=arguments[0];for(var i=1;i<arguments.length;i++)m=mul(m,arguments[i]);return m;}
function T(x,y,z){if(x.length){z=x[2];y=x[1];x=x[0];}return [1,0,0,0,0,1,0,0,0,0,1,0,x,y,z,1]}
function Sc(x,y,z){if(y===undefined){y=x;z=x;}return [x,0,0,0,0,y,0,0,0,0,z,0,0,0,0,1]}
function RX(a){var c=Math.cos(a),s=Math.sin(a);return [1,0,0,0,0,c,s,0,0,-s,c,0,0,0,0,1]}
function RY(a){var c=Math.cos(a),s=Math.sin(a);return [c,0,-s,0,0,1,0,0,s,0,c,0,0,0,0,1]}
function RZ(a){var c=Math.cos(a),s=Math.sin(a);return [c,s,0,0,-s,c,0,0,0,0,1,0,0,0,0,1]}
function persp(f,asp,n,fa){var t=1/Math.tan(f/2);return [t/asp,0,0,0,0,t,0,0,0,0,(fa+n)/(n-fa),-1,0,0,2*fa*n/(n-fa),0]}
function ortho(l,r,b,t,n,f){return [2/(r-l),0,0,0,0,2/(t-b),0,0,0,0,-2/(f-n),0,-(r+l)/(r-l),-(t+b)/(t-b),-(f+n)/(f-n),1]}
function sub(a,b){return [a[0]-b[0],a[1]-b[1],a[2]-b[2]]}
function add(a,b){return [a[0]+b[0],a[1]+b[1],a[2]+b[2]]}
function scl(a,k){return [a[0]*k,a[1]*k,a[2]*k]}
function cross(a,b){return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]}
function dot(a,b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]}
function len3(a){return Math.sqrt(dot(a,a))}
function nrm(a){var l=len3(a)||1;return [a[0]/l,a[1]/l,a[2]/l]}
function lookAt(e,c,u){var z=nrm(sub(e,c)),x=nrm(cross(u,z)),y=cross(z,x);return [x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,e),-dot(y,e),-dot(z,e),1]}
function xf(m,p){return [m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]]}
function xf4(m,p){var w=m[3]*p[0]+m[7]*p[1]+m[11]*p[2]+m[15];var q=xf(m,p);return [q[0]/w,q[1]/w,q[2]/w,w]}
/* matrix whose local +y axis runs from P along dir, scaled to length L */
function alignY(P,dir,L){var y=nrm(dir),ref=Math.abs(y[1])<0.95?[0,1,0]:[1,0,0],x=nrm(cross(ref,y)),z=cross(x,y);return [x[0],x[1],x[2],0,y[0]*L,y[1]*L,y[2]*L,0,z[0],z[1],z[2],0,P[0],P[1],P[2],1]}
function sm(a,b,x){var t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t)}
function lerp(a,b,t){return a+(b-a)*t}
function mix(a,b,t){return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t,(a[3]||0)+((b[3]||0)-(a[3]||0))*t]}
function H(h,e){return [parseInt(h.substr(1,2),16)/255,parseInt(h.substr(3,2),16)/255,parseInt(h.substr(5,2),16)/255,e||0]}
function ease(t){t=Math.max(0,Math.min(1,t));return t*t*(3-2*t)}
var seed=7;function rnd(){seed=(seed*16807)%2147483647;return (seed-1)/2147483646}

/* every vertex also carries a material: [roughness, kind]. kind picks procedural surface detail in the shader:
   0 plain  1 wood  2 fabric  3 cardboard  4 glaze/ceramic  5 leaf  6 eye (wet cornea)  7 painted wall  8 wet (nose, tongue) */
function Mesh(){this.P=[];this.N=[];this.C=[];this.UV=[];this.I=[];this.R=[];this.mat=[0.8,0];}
Mesh.prototype.m=function(rough,kind){this.mat=[rough,kind||0];return this};
/* sample fn(u,v) on a grid; normals = cross product of finite-difference partial derivatives */
Mesh.prototype.surf=function(fn,nu,nv,col,Mx,uvf){
  var F=Mx?function(u,v){return xf(Mx,fn(u,v))}:fn,base=this.P.length/3,e=1e-3;
  function cl(x){return Math.min(1-2*e,Math.max(2*e,x))}
  for(var j=0;j<=nv;j++)for(var i=0;i<=nu;i++){
    var u=i/nu,v=j/nv,lp=fn(u,v),p=Mx?xf(Mx,lp):lp,uu=cl(u),vv=cl(v);
    var n=cross(sub(F(uu+e,vv),F(uu-e,vv)),sub(F(uu,vv+e),F(uu,vv-e))),l=len3(n);
    n=l>1e-14?[n[0]/l,n[1]/l,n[2]/l]:[0,1,0];
    var c=typeof col==='function'?col(u,v,lp,p):col,uv=uvf?uvf(u,v,lp,p):[u,v];
    this.P.push(p[0],p[1],p[2]);this.N.push(n[0],n[1],n[2]);this.C.push(c[0],c[1],c[2],c[3]||0);this.UV.push(uv[0],uv[1]);this.R.push(this.mat[0],this.mat[1]);
  }
  for(j=0;j<nv;j++)for(i=0;i<nu;i++){var a=base+j*(nu+1)+i;this.I.push(a,a+1,a+nu+2,a,a+nu+2,a+nu+1);}
  return this;
};
function ell(rx,ry,rz){return function(u,v){var t=u*PI,p=v*TAU;return [rx*Math.sin(t)*Math.cos(p),ry*Math.cos(t),rz*Math.sin(t)*Math.sin(p)]}}
function poly(pts){return function(u){var f=u*(pts.length-1),i=Math.min(pts.length-2,Math.floor(f)),t=f-i;return [pts[i][0]+(pts[i+1][0]-pts[i][0])*t,pts[i][1]+(pts[i+1][1]-pts[i][1])*t]}}
function lathe(prof){return function(u,v){var q=prof(u),p=v*TAU;return [q[0]*Math.sin(p),q[1],q[0]*Math.cos(p)]}}
function sp(x,e){return (x<0?-1:1)*Math.pow(Math.abs(x),e)}
function sEll(a,b,c,e){return function(u,v){var t=u*PI,p=v*TAU;return [a*sp(Math.sin(t),e)*sp(Math.cos(p),e),b*sp(Math.cos(t),e),c*sp(Math.sin(t),e)*sp(Math.sin(p),e)]}}
function bez(P0,P1,P2,P3){return function(u){var a=1-u;return [0,1,2].map(function(k){return a*a*a*P0[k]+3*a*a*u*P1[k]+3*a*u*u*P2[k]+u*u*u*P3[k]})}}
function capR(R,taper){return function(u){return R*(1-(taper||0)*u)*Math.sqrt(Math.max(0,Math.min(1,u/0.05,(1-u)/0.05)))}}
function cst(r){return function(){return r}}
/* tube along a curve with rotation-minimising (parallel transport) frames */
function tube(C,R,K){K=K||80;var pts=[],Ts=[],Ns=[],i;
  for(i=0;i<=K;i++)pts.push(C(i/K));
  for(i=0;i<=K;i++)Ts.push(nrm(sub(pts[Math.min(K,i+1)],pts[Math.max(0,i-1)])));
  Ns.push(nrm(cross(Ts[0],Math.abs(Ts[0][1])<0.9?[0,1,0]:[1,0,0])));
  for(i=1;i<=K;i++){var p=Ns[i-1],t=Ts[i],d=dot(p,t);Ns.push(nrm([p[0]-t[0]*d,p[1]-t[1]*d,p[2]-t[2]*d]));}
  return function(u,v){var f=u*K,i=Math.min(K-1,Math.floor(f)),s=f-i,c=C(u);
    var Tt=nrm(mix(Ts[i],Ts[i+1],s)),Nn=nrm(mix(Ns[i],Ns[i+1],s)),B=cross(Tt,Nn),r=R(u),a=v*TAU,ca=Math.cos(a),sa=Math.sin(a);
    return [c[0]+r*(ca*Nn[0]+sa*B[0]),c[1]+r*(ca*Nn[1]+sa*B[1]),c[2]+r*(ca*Nn[2]+sa*B[2])]}}
function polyCurve(pts,closed){
  if(closed)pts=pts.concat([pts[0]]);
  for(var it=0;it<3;it++){var q=closed?[]:[pts[0]];for(var i=0;i<pts.length-1;i++){var a=pts[i],b=pts[i+1];q.push(mix(a,b,.25).slice(0,3),mix(a,b,.75).slice(0,3));}if(closed)q.push(q[0]);else q.push(pts[pts.length-1]);pts=q;}
  var L=[0];for(i=1;i<pts.length;i++)L.push(L[i-1]+len3(sub(pts[i],pts[i-1])));var tot=L[L.length-1];
  return function(u){var d=u*tot,k=1;while(k<L.length-1&&L[k]<d)k++;var t=(d-L[k-1])/((L[k]-L[k-1])||1);return mix(pts[k-1],pts[k],Math.max(0,Math.min(1,t))).slice(0,3)}}
function heart2(t){return [16*Math.pow(Math.sin(t),3)/17,(13*Math.cos(t)-5*Math.cos(2*t)-2*Math.cos(3*t)-Math.cos(4*t))/17+0.12]}
function heart3(d){return function(u,v){var a=u*PI,h=heart2(v*TAU),s=Math.pow(Math.sin(a),0.6);return [h[0]*s,h[1]*s,d*Math.cos(a)]}}

/* ================= WebGL engine (one per canvas): static meshes + skinned meshes =================
   Lighting runs in linear space with physically based specular (GGX), soft sun shadows, a lamp, hemisphere sky light
   and a fake environment reflection; colour leaves through an ACES filmic curve. Fur gets Kajiya-Kay highlights and
   backlit tips. When the device can take it, the frame goes through a post chain: SSAO, bloom, FXAA, vignette, grain. */
var VS1='attribute vec3 aP;attribute vec3 aN;attribute vec4 aC;attribute vec2 aT;attribute vec2 aR;uniform mat4 uVP,uM;uniform vec3 uTint;varying vec3 vN,vW,vR,vTg;varying vec4 vC;varying vec2 vT,vM;varying float vF,vSh;'+
 'void main(){vR=aP;vF=0.;vSh=0.;vTg=vec3(0.);vM=aR;vec4 w=uM*vec4(aP,1.);vW=w.xyz;vN=(uM*vec4(aN,0.)).xyz;vC=vec4(aC.rgb*uTint,aC.a);vT=aT;gl_Position=uVP*w;}';
var VS3='attribute vec3 aP;attribute vec3 aN;attribute vec4 aC;attribute vec4 aB;attribute vec4 aW;uniform mat4 uVP,uR0;uniform vec4 uQ[44];uniform vec3 uTint;uniform float uSh,uFL;varying vec3 vN,vW,vR,vTg;varying vec4 vC;varying vec2 vT,vM;varying float vF,vSh;'+
 'void main(){int i0=int(aB.x+0.5),i1=int(aB.y+0.5),i2=int(aB.z+0.5),i3=int(aB.w+0.5);vec4 r0=uQ[i0*2],q=r0*aW.x,d=uQ[i0*2+1]*aW.x,rk;'+
 'rk=uQ[i1*2];float sg=dot(r0,rk)<0.?-aW.y:aW.y;q+=rk*sg;d+=uQ[i1*2+1]*sg;'+
 'rk=uQ[i2*2];sg=dot(r0,rk)<0.?-aW.z:aW.z;q+=rk*sg;d+=uQ[i2*2+1]*sg;'+
 'rk=uQ[i3*2];sg=dot(r0,rk)<0.?-aW.w:aW.w;q+=rk*sg;d+=uQ[i3*2+1]*sg;'+
 'float l=length(q);q/=l;d/=l;'+
 'vR=aP;vF=aC.a;vSh=uSh;vM=vec2(0.6,0.);vec3 pp=aP+(aN*uSh*0.55+vec3(0.,-0.38,-0.5)*uSh*(0.35+0.65*uSh))*(uFL*aC.a);'+
 'vec3 p=pp+2.*cross(q.xyz,cross(q.xyz,pp)+q.w*pp)+2.*(q.w*d.xyz-d.w*q.xyz+cross(q.xyz,d.xyz));vec3 n=aN+2.*cross(q.xyz,cross(q.xyz,aN)+q.w*aN);'+
 /* fur is combed back and down the body: that direction, kept tangent to the skin, drives the anisotropic highlight */
 'vec3 cb=vec3(0.,-0.32,-0.42);vec3 tg=cb-aN*dot(aN,cb);tg=tg+2.*cross(q.xyz,cross(q.xyz,tg)+q.w*tg);'+
 'vec4 w=uR0*vec4(p,1.);vW=w.xyz;vN=(uR0*vec4(n,0.)).xyz;vTg=(uR0*vec4(tg,0.)).xyz;vC=vec4(aC.rgb*uTint,0.);vT=vec2(0.);gl_Position=uVP*w;}';
var FS1='#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\n'+
 'varying vec3 vN,vW,vR,vTg;varying vec4 vC;varying vec2 vT,vM;varying float vF,vSh;uniform vec3 uCam,uL,uFog;uniform sampler2D uTex;uniform float uUseTex,uFlip,uFur,uFD,uShOn,uSMs,uSMr;'+
 'uniform vec3 uAmb0,uAmb1,uSunC,uLampP,uLampC;uniform vec4 uK;uniform float uExp;uniform mat4 uLVP;uniform sampler2D uSM;'+
 'float unp(vec4 c){return dot(c,vec4(1.,1./255.,1./65025.,1./16581375.));}'+
 'float hsh(vec3 p){p=fract(p*0.3183099+0.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}'+
 'float vn(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hsh(i),hsh(i+vec3(1.,0.,0.)),f.x),mix(hsh(i+vec3(0.,1.,0.)),hsh(i+vec3(1.,1.,0.)),f.x),f.y),'+
 'mix(mix(hsh(i+vec3(0.,0.,1.)),hsh(i+vec3(1.,0.,1.)),f.x),mix(hsh(i+vec3(0.,1.,1.)),hsh(i+vec3(1.,1.,1.)),f.x),f.y),f.z);}'+
 'float fbm(vec3 p){return vn(p)*0.55+vn(p*2.03+3.1)*0.3+vn(p*4.11+7.7)*0.15;}'+
 'vec3 bump(vec3 n,vec3 p,float a){return normalize(n+(vec3(vn(p),vn(p+5.2),vn(p+9.7))-0.5)*a);}'+
 'vec3 lin(vec3 c){return c*c*(c*0.3+0.7);}'+
 'vec3 aces(vec3 x){return clamp(x*(2.51*x+0.03)/(x*(2.43*x+0.59)+0.14),0.,1.);}'+
 'float ggx(float NH,float a2){float d=NH*NH*(a2-1.)+1.;return a2/(3.14159*d*d);}'+
 'void main(){vec3 n=normalize(vN);if(uFlip>0.5&&!gl_FrontFacing)n=-n;vec3 v=normalize(uCam-vW);'+
 'vec4 tx=texture2D(uTex,vT);vec3 b=mix(vC.rgb,tx.rgb,tx.a*uUseTex);float rough=clamp(vM.x,0.05,1.),kind=floor(vM.y+0.5),fl=0.,occ=1.;'+
 'if(uFur>0.5&&uFD>0.){vec3 ca=vec3(0.,-0.6,-0.8),cb=vec3(1.,0.,0.),cc=vec3(0.,0.8,-0.6);vec3 q=vec3(dot(vR,ca)*0.2,dot(vR,cb),dot(vR,cc))*uFD;vec3 fc=fract(q)-0.5;fc.x*=0.25;float hs=hsh(floor(q));fl=smoothstep(0.02,0.14,vF);'+
 '\n#ifdef DER\nif(vSh>0.001&&length(fwidth(vW))>2.6*length(fwidth(vR))+1e-5)discard;\n#endif\n'+
 'if(vSh>0.001&&fl>0.){float ln=mix(0.62,1.,hs)*(1.-dot(fc,fc)*1.5);if(vSh>ln)discard;}'+
 /* strands are dark at the root and catch light at the tip; the undercoat is shadowed by the hair above it */
 'float h2=hsh(floor(vec3(dot(vR,ca)*0.08,dot(vR,cb),dot(vR,cc))*uFD*0.45)+7.);float lum=dot(b,vec3(0.3,0.59,0.11));b*=mix(1.,mix(mix(0.7,0.88,smoothstep(0.55,0.9,lum)),1.05,vSh),fl)*(1.+((hs-0.5)*0.05+(h2-0.5)*0.04)*fl);occ=mix(1.,mix(mix(0.68,0.85,smoothstep(0.55,0.9,lum)),1.,vSh),fl);}'+
 'else if(kind>0.5&&uFur<0.5){'+
 ' if(kind<1.5){float g=fbm(vec3(vW.x*1.3,vW.y*34.,vW.z*34.));b*=0.84+0.3*g;rough*=mix(1.15,0.8,g);n=bump(n,vW*vec3(4.,90.,90.),0.05);}'+
 ' else if(kind<2.5){float w=sin(vW.x*240.)*sin(vW.z*240.+vW.y*240.);float fz=vn(vW*70.);b*=0.88+0.07*w*w+0.14*fz;n=bump(n,vW*150.,0.35);}'+
 ' else if(kind<3.5){float fz=fbm(vW*36.);b*=0.86+0.24*fz;n=bump(n,vW*60.,0.14);}'+
 ' else if(kind<4.5){b*=0.97+0.05*vn(vW*24.);}'+
 ' else if(kind<5.5){b*=0.8+0.3*fbm(vW*14.);n=bump(n,vW*40.,0.12);}'+
 ' else if(kind>6.5&&kind<7.5){b*=0.94+0.08*fbm(vW*2.6)+0.03*vn(vW*110.);n=bump(n,vW*80.,0.04);}}'+
 'vec3 al=lin(b);float d=dot(n,uL);'+
 'float shd=1.;if(uShOn>0.5){vec3 ng=normalize(vN);if(dot(ng,uL)<0.&&uFur<0.5)ng=-ng;vec4 lp=uLVP*vec4(vW+ng*(0.018+0.02*(1.-abs(d)))+uL*0.01,1.);vec3 sc=lp.xyz/lp.w*0.5+0.5;'+
 'if(sc.x>0.&&sc.x<1.&&sc.y>0.&&sc.y<1.&&sc.z<1.){float bias=0.0006+0.0012*(1.-abs(d));float s=0.;float rot=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(0.06711056,0.00583715))))*6.2832;'+
 'for(int i=0;i<12;i++){float fi=float(i);float r=sqrt((fi+0.5)/12.)*uSMr;float a=fi*2.39996+rot;vec2 o=vec2(cos(a),sin(a))*r*uSMs;s+=step(sc.z-bias,unp(texture2D(uSM,sc.xy+o)));}shd=s/12.;}}'+
 'float NV=max(dot(n,v),1e-3);vec3 sky=lin(uAmb1),gnd=lin(uAmb0);'+
 'vec3 amb=mix(gnd*(uFur>0.5?0.95:0.75),sky,n.y*0.5+0.5);'+
 'vec3 lv=uLampP-vW;float ld=length(lv);vec3 L2=lv/ld;float la=1./(1.+ld*ld*0.11);float d2=dot(n,L2);'+
 'float df=uFur>0.5?clamp((d+0.4)/1.4,0.,1.):max(d,0.),df2=uFur>0.5?clamp((d2+0.4)/1.4,0.,1.):max(d2,0.);'+
 'vec3 col=al*(amb*uK.y*occ+uSunC*uK.x*df*shd+uLampC*uK.z*df2*la);'+
 'if(uFur<0.5){float a=rough*rough,a2=a*a,k=a*0.5;'+
 ' vec3 h=normalize(uL+v);float NL=max(d,0.);float F=0.04+0.96*pow(1.-max(dot(h,v),0.),5.);'+
 ' col+=uSunC*uK.x*shd*NL*ggx(max(dot(n,h),0.),a2)*F*0.25/((NL*(1.-k)+k)*(NV*(1.-k)+k));'+
 ' vec3 h2=normalize(L2+v);float NL2=max(d2,0.);col+=uLampC*uK.z*la*NL2*ggx(max(dot(n,h2),0.),a2)*0.04*0.25/((NL2*(1.-k)+k)*(NV*(1.-k)+k));'+
 ' vec3 r=reflect(-v,n);float fr=0.04+0.96*pow(1.-NV,5.);vec3 env=mix(gnd*0.45,sky*1.25,smoothstep(-0.3,0.7,r.y));'+
 ' col+=env*fr*(1.-rough)*(1.-rough)*uK.y*occ*(kind>5.5&&kind<6.5||kind>7.5?2.2:1.);}'+
 'else{vec3 T=vTg-n*dot(n,vTg);float tl=length(T);'+
 ' if(tl>1e-4){T/=tl;vec3 h=normalize(uL+v);float t1=dot(T,h);float s1=pow(sqrt(max(1.-t1*t1,0.)),90.);vec3 T2=normalize(T+n*0.4);float t2=dot(T2,h);float s2=pow(sqrt(max(1.-t2*t2,0.)),16.);'+
 '  col+=uSunC*uK.x*smoothstep(-0.1,0.35,d)*shd*(s1*0.05+s2*0.2*al)*mix(0.35,1.,fl*vSh);}'+
 ' float bl=pow(1.-NV,3.)*clamp(0.6-dot(v,uL)*0.5,0.,1.);col+=al*(uSunC*uK.x*bl*0.4*shd+amb*uK.y*pow(1.-NV,2.)*0.22);}'+
 'col=mix(col,al*uK.w,vC.a);float dist=length(uCam-vW);col=mix(col,lin(uFog),smoothstep(34.,70.,dist)*0.4);'+
 'col=pow(aces(col*uExp),vec3(1./2.2));gl_FragColor=vec4(col,1.);}';
var FSD='precision highp float;void main(){vec4 e=fract(gl_FragCoord.z*vec4(1.,255.,65025.,16581375.));e-=e.yzww*vec4(1./255.,1./255.,1./255.,0.);gl_FragColor=e;}';
var VS2='attribute vec2 aQ;uniform mat4 uVP;uniform vec3 uCtr,uR,uU;uniform vec2 uSz;uniform float uBill;varying vec2 vQ;'+
 'void main(){vQ=aQ;vec3 p=uBill>0.5?uCtr+uR*aQ.x*uSz.x+uU*aQ.y*uSz.y:uCtr+vec3(aQ.x*uSz.x,0.,aQ.y*uSz.y);gl_Position=uVP*vec4(p,1.);}';
var FS2='precision mediump float;varying vec2 vQ;uniform vec4 uCol;uniform float uPow;void main(){float r=length(vQ);float a=pow(max(0.,1.-r),uPow)*uCol.a;gl_FragColor=vec4(uCol.rgb*a,a);}';
/* ---- post chain ---- */
var VSQ='attribute vec2 aQ;varying vec2 vU;void main(){vU=aQ*0.5+0.5;gl_Position=vec4(aQ,0.,1.);}';
/* scalable ambient obscurance from the depth buffer (McGuire's SAO, simplified) */
var FSAO='precision highp float;varying vec2 vU;uniform sampler2D uD;uniform vec2 uPx;uniform vec4 uPr;uniform float uRad,uInt;'+
 'float lz(float d){float z=d*2.-1.;return 2.*uPr.x*uPr.y/(uPr.y+uPr.x-z*(uPr.y-uPr.x));}'+
 'vec3 vp(vec2 uv){float z=lz(texture2D(uD,uv).x);return vec3((uv*2.-1.)*uPr.zw*z,-z);}'+
 'void main(){float d0=texture2D(uD,vU).x;if(d0>0.99999){gl_FragColor=vec4(1.);return;}vec3 P=vp(vU);'+
 'vec3 a=vp(vU+vec2(2.*uPx.x,0.))-P,b=P-vp(vU-vec2(2.*uPx.x,0.)),c=vp(vU+vec2(0.,2.*uPx.y))-P,e=P-vp(vU-vec2(0.,2.*uPx.y));'+
 'vec3 N=normalize(cross(dot(a,a)<dot(b,b)?a:b,dot(c,c)<dot(e,e)?c:e));'+
 'float rot=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(0.06711056,0.00583715))))*6.2832;float sr=uRad/(-P.z*uPr.w)*0.5;float s=0.;'+
 'for(int i=0;i<12;i++){float fi=float(i);float r=(fi+0.5)/12.;float an=fi*2.39996+rot;vec2 o=vec2(cos(an)*uPr.w/uPr.z,sin(an))*r*sr;'+
 ' vec3 v=vp(vU+o)-P;float vv=dot(v,v);s+=max(0.,dot(v,N)+P.z*0.012)/(vv+0.03*uRad*uRad)*max(0.,1.-vv/(uRad*uRad*1.4));}'+
 'float ao=max(0.,1.-uInt*s/12.);gl_FragColor=vec4(ao,1.,1.,1.);}';
var FSBR='precision mediump float;varying vec2 vU;uniform sampler2D uC;uniform vec2 uPx;uniform float uTh;'+
 'void main(){vec3 c=(texture2D(uC,vU+uPx*vec2(-1.,-1.)).rgb+texture2D(uC,vU+uPx*vec2(1.,-1.)).rgb+texture2D(uC,vU+uPx*vec2(-1.,1.)).rgb+texture2D(uC,vU+uPx*vec2(1.,1.)).rgb)*0.25;'+
 'float l=max(c.r,max(c.g,c.b));gl_FragColor=vec4(c*(uTh<0.?1.:smoothstep(uTh,1.,l)),1.);}';
var FSBL='precision mediump float;varying vec2 vU;uniform sampler2D uC;uniform vec2 uDir;'+
 'void main(){vec4 c=texture2D(uC,vU)*0.227;c+=(texture2D(uC,vU+uDir*1.385)+texture2D(uC,vU-uDir*1.385))*0.316;c+=(texture2D(uC,vU+uDir*3.231)+texture2D(uC,vU-uDir*3.231))*0.07;gl_FragColor=c;}';
/* depth-of-field gather: only out-of-focus pixels feed the blur, so the sharp kitten does not bleed a halo into the background */
var FSDS='precision highp float;varying vec2 vU;uniform sampler2D uC,uD;uniform vec2 uPx;uniform vec4 uPr;uniform float uFoc,uDof;'+
 'float coc(vec2 uv){float z=texture2D(uD,uv).x*2.-1.;z=2.*uPr.x*uPr.y/(uPr.y+uPr.x-z*(uPr.y-uPr.x));return clamp((abs(z-uFoc)/z-0.12)*uDof,0.,1.);}'+
 'vec4 tap(vec2 o){vec2 uv=vU+o*uPx;vec4 c=texture2D(uC,uv);float w=coc(uv)*c.a+0.002;return vec4(c.rgb*w,w);}'+
 'void main(){gl_FragColor=(tap(vec2(-1.,-1.))+tap(vec2(1.,-1.))+tap(vec2(-1.,1.))+tap(vec2(1.,1.)))*0.25;}';
/* final: FXAA on the scene, ambient occlusion, bloom, vignette and a whisper of film grain */
var FSC='precision highp float;varying vec2 vU;uniform sampler2D uC,uA,uB,uD,uF;uniform vec2 uPx,uPa;uniform vec4 uPr;uniform float uAOk,uBk,uT,uVig,uFx,uFoc,uDof;'+
 'vec4 fxaa(){vec4 M=texture2D(uC,vU);if(uFx<0.5)return M;vec3 L=vec3(0.299,0.587,0.114);'+
 'float nw=dot(texture2D(uC,vU+vec2(-1.,-1.)*uPx).rgb,L),ne=dot(texture2D(uC,vU+vec2(1.,-1.)*uPx).rgb,L),sw=dot(texture2D(uC,vU+vec2(-1.,1.)*uPx).rgb,L),se=dot(texture2D(uC,vU+vec2(1.,1.)*uPx).rgb,L),m=dot(M.rgb,L);'+
 'float mn=min(m,min(min(nw,ne),min(sw,se))),mx=max(m,max(max(nw,ne),max(sw,se)));if(mx-mn<max(0.03,mx*0.12))return M;'+
 'vec2 dir=vec2(-((nw+ne)-(sw+se)),(nw+sw)-(ne+se));float rd=max((nw+ne+sw+se)*0.03125,0.0078125);float rc=1./(min(abs(dir.x),abs(dir.y))+rd);dir=clamp(dir*rc,-8.,8.)*uPx;'+
 'vec4 A=0.5*(texture2D(uC,vU+dir*(1./3.-0.5))+texture2D(uC,vU+dir*(2./3.-0.5)));vec4 B=A*0.5+0.25*(texture2D(uC,vU-dir*0.5)+texture2D(uC,vU+dir*0.5));'+
 'float lb=dot(B.rgb,L);return (lb<mn||lb>mx)?A:B;}'+
 'void main(){vec4 c=fxaa();if(uDof>0.){float z=texture2D(uD,vU).x*2.-1.;z=2.*uPr.x*uPr.y/(uPr.y+uPr.x-z*(uPr.y-uPr.x));float coc=clamp((abs(z-uFoc)/z-0.12)*uDof,0.,1.);vec4 F=texture2D(uF,vU);c.rgb=mix(c.rgb,F.rgb/max(F.a,1e-3),coc*smoothstep(0.,0.04,F.a));}float ao=(texture2D(uA,vU+uPa*vec2(-0.75,-0.75)).r+texture2D(uA,vU+uPa*vec2(0.75,-0.75)).r+texture2D(uA,vU+uPa*vec2(-0.75,0.75)).r+texture2D(uA,vU+uPa*vec2(0.75,0.75)).r)*0.25;'+
 'vec3 bl=texture2D(uB,vU).rgb*uBk;vec3 col=c.rgb*mix(1.,ao,uAOk)+bl;float lu=dot(col,vec3(0.299,0.587,0.114));col=mix(vec3(lu),col,1.08);col=mix(col,col*col*(3.-2.*col),0.22);vec2 q=vU-0.5;col*=1.-uVig*smoothstep(0.25,0.85,dot(q,q)*2.2);'+
 'col+=(fract(sin(dot(vU*uT,vec2(12.9898,78.233)))*43758.5453)-0.5)*0.018*c.a;gl_FragColor=vec4(col,max(c.a,min(1.,dot(bl,vec3(0.4)))));}';
function makeEngine(cv){
  var gl=null;try{gl=cv.getContext('webgl',{antialias:true,alpha:true,premultipliedAlpha:true})||cv.getContext('experimental-webgl');}catch(e){}
  if(!gl)return null;
  var U32=!!gl.getExtension('OES_element_index_uint'),AN=gl.getExtension('EXT_texture_filter_anisotropic')||gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic');
  var DT=gl.getExtension('WEBGL_depth_texture')||gl.getExtension('WEBKIT_WEBGL_depth_texture'),bad=0;
  function sh(type,src){var s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){bad++;console.error(gl.getShaderInfoLog(s));}return s}
  function prog(vs,fs,attrs){var p=gl.createProgram();gl.attachShader(p,sh(gl.VERTEX_SHADER,vs));gl.attachShader(p,sh(gl.FRAGMENT_SHADER,fs));attrs.forEach(function(a,i){gl.bindAttribLocation(p,i,a)});gl.linkProgram(p);
    if(!gl.getProgramParameter(p,gl.LINK_STATUS)){bad++;console.error(gl.getProgramInfoLog(p));}var u={},n=gl.getProgramParameter(p,gl.ACTIVE_UNIFORMS);for(var i=0;i<n;i++){var nm=gl.getActiveUniform(p,i).name;u[nm]=gl.getUniformLocation(p,nm)}return {p:p,u:u,n:attrs.length}}
  var FSX=(gl.getExtension('OES_standard_derivatives')?'#extension GL_OES_standard_derivatives : enable\n#define DER\n':'')+FS1;
  var A1=['aP','aN','aC','aT','aR'];
  var P1=prog(VS1,FSX,A1),P2=prog(VS2,FS2,['aQ']),P3=prog(VS3,FSX,['aP','aN','aC','aB','aW']);
  var PD1=prog(VS1,FSD,A1),PD3=prog(VS3,FSD,['aP','aN','aC','aB','aW']),SH=null;
  var sceneBad=bad;
  var PAO=prog(VSQ,FSAO,['aQ']),PBR=prog(VSQ,FSBR,['aQ']),PBL=prog(VSQ,FSBL,['aQ']),PC=prog(VSQ,FSC,['aQ']),PDS=prog(VSQ,FSDS,['aQ']),postBad=bad>sceneBad;
  var quad=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,quad);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
  var blank=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,blank);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([0,0,0,0]));
  var white=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,white);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([255,255,255,255]));
  var black=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,black);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([0,0,0,255]));
  var cur=null;
  function use(P){if(cur===P)return;gl.useProgram(P.p);for(var i=0;i<6;i++){if(i<P.n)gl.enableVertexAttribArray(i);else gl.disableVertexAttribArray(i);}cur=P;}
  function buf(arr,Ty,tgt){var b=gl.createBuffer();gl.bindBuffer(tgt||gl.ARRAY_BUFFER,b);gl.bufferData(tgt||gl.ARRAY_BUFFER,new Ty(arr),gl.STATIC_DRAW);return b}
  function attr(i,b,n){gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.vertexAttribPointer(i,n,gl.FLOAT,false,0,0);}
  /* meshes cached before materials existed have no material buffer: feed a constant instead */
  function matAttr(g){if(g.r){gl.enableVertexAttribArray(4);attr(4,g.r,2);}else{gl.disableVertexAttribArray(4);gl.vertexAttrib2f(4,0.8,0);}}
  /* ---- post-processing targets ---- */
  var PP=null,POST={on:false,ao:true,bloom:true,aoQ:1,fx:true,foc:10,dof:0},PROJ=[0.15,90,1,1];
  function tex2(w,h,fmt,type,filt){var t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texImage2D(gl.TEXTURE_2D,0,fmt,w,h,0,fmt,type,null);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,filt);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,filt);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);return t}
  function fbo(t,dep,rb){var f=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,f);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,t,0);
    if(dep)gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.TEXTURE_2D,dep,0);if(rb)gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,rb);
    var ok=gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE;gl.bindFramebuffer(gl.FRAMEBUFFER,null);return ok?f:null}
  function freePP(){if(!PP)return;[PP.col,PP.dep,PP.aoT,PP.b0,PP.b1,PP.d0,PP.d1].forEach(function(t){if(t)gl.deleteTexture(t)});[PP.f,PP.aoF,PP.f0,PP.f1,PP.g0,PP.g1].forEach(function(f){if(f)gl.deleteFramebuffer(f)});if(PP.rb)gl.deleteRenderbuffer(PP.rb);PP=null}
  function ensurePP(w,h){if(PP&&PP.w===w&&PP.h===h)return PP;freePP();
    var o={w:w,h:h,col:tex2(w,h,gl.RGBA,gl.UNSIGNED_BYTE,gl.LINEAR)};
    if(DT){o.dep=tex2(w,h,gl.DEPTH_COMPONENT,gl.UNSIGNED_INT,gl.NEAREST);o.f=fbo(o.col,o.dep);}
    if(!o.f){if(o.dep){gl.deleteTexture(o.dep);o.dep=null;}o.rb=gl.createRenderbuffer();gl.bindRenderbuffer(gl.RENDERBUFFER,o.rb);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT16,w,h);o.f=fbo(o.col,null,o.rb);}
    if(!o.f){PP=o;freePP();POST.on=false;return null}
    o.aw=Math.max(1,w>>1);o.ah=Math.max(1,h>>1);o.aoT=tex2(o.aw,o.ah,gl.RGBA,gl.UNSIGNED_BYTE,gl.LINEAR);o.aoF=fbo(o.aoT);
    o.bw=Math.max(1,w>>2);o.bh=Math.max(1,h>>2);o.b0=tex2(o.bw,o.bh,gl.RGBA,gl.UNSIGNED_BYTE,gl.LINEAR);o.b1=tex2(o.bw,o.bh,gl.RGBA,gl.UNSIGNED_BYTE,gl.LINEAR);o.f0=fbo(o.b0);o.f1=fbo(o.b1);
    o.d0=tex2(o.bw,o.bh,gl.RGBA,gl.UNSIGNED_BYTE,gl.LINEAR);o.d1=tex2(o.bw,o.bh,gl.RGBA,gl.UNSIGNED_BYTE,gl.LINEAR);o.g0=fbo(o.d0);o.g1=fbo(o.d1);
    PP=o;return o}
  function quadDraw(P){use(P);gl.bindBuffer(gl.ARRAY_BUFFER,quad);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);}
  function bindT(unit,t){gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,t);}
  var pf=0;
  function runPost(){var o=PP,w=o.w,h=o.h,t=(pf=(pf+1)%997)+1;gl.disable(gl.DEPTH_TEST);gl.disable(gl.BLEND);gl.depthMask(false);gl.disable(gl.CULL_FACE);
    var aoOn=POST.ao&&o.dep&&o.aoF,blOn=POST.bloom&&o.f0&&o.f1;
    if(aoOn){gl.bindFramebuffer(gl.FRAMEBUFFER,o.aoF);gl.viewport(0,0,o.aw,o.ah);use(PAO);bindT(0,o.dep);var u=PAO.u;gl.uniform1i(u.uD,0);gl.uniform2f(u.uPx,1/w,1/h);gl.uniform4fv(u.uPr,PROJ);
      gl.uniform1f(u.uRad,0.5);gl.uniform1f(u.uInt,POST.aoQ>1?0.5:0.42);quadDraw(PAO);}
    if(blOn){gl.bindFramebuffer(gl.FRAMEBUFFER,o.f0);gl.viewport(0,0,o.bw,o.bh);use(PBR);bindT(0,o.col);gl.uniform1i(PBR.u.uC,0);gl.uniform2f(PBR.u.uPx,1/w,1/h);gl.uniform1f(PBR.u.uTh,0.93);quadDraw(PBR);
      use(PBL);gl.uniform1i(PBL.u.uC,0);gl.bindFramebuffer(gl.FRAMEBUFFER,o.f1);bindT(0,o.b0);gl.uniform2f(PBL.u.uDir,1/o.bw,0);quadDraw(PBL);
      gl.bindFramebuffer(gl.FRAMEBUFFER,o.f0);bindT(0,o.b1);gl.uniform2f(PBL.u.uDir,0,1/o.bh);quadDraw(PBL);}
    var dfOn=POST.dof>0.01&&o.dep&&o.g0&&o.g1;
    if(dfOn){gl.bindFramebuffer(gl.FRAMEBUFFER,o.g0);gl.viewport(0,0,o.bw,o.bh);use(PDS);var q=PDS.u;bindT(0,o.col);bindT(1,o.dep);gl.uniform1i(q.uC,0);gl.uniform1i(q.uD,1);gl.uniform2f(q.uPx,1/w,1/h);gl.uniform4fv(q.uPr,PROJ);gl.uniform1f(q.uFoc,POST.foc);gl.uniform1f(q.uDof,POST.dof);quadDraw(PDS);gl.activeTexture(gl.TEXTURE0);
      use(PBL);gl.uniform1i(PBL.u.uC,0);for(var it=0;it<2;it++){gl.bindFramebuffer(gl.FRAMEBUFFER,o.g1);bindT(0,o.d0);gl.uniform2f(PBL.u.uDir,(1+it)/o.bw,0);quadDraw(PBL);
      gl.bindFramebuffer(gl.FRAMEBUFFER,o.g0);bindT(0,o.d1);gl.uniform2f(PBL.u.uDir,0,(1+it)/o.bh);quadDraw(PBL);}}
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,w,h);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);use(PC);var c=PC.u;
    bindT(0,o.col);bindT(1,aoOn?o.aoT:white);bindT(2,blOn?o.b0:black);bindT(3,dfOn?o.dep:white);bindT(4,dfOn?o.d0:black);gl.uniform1i(c.uC,0);gl.uniform1i(c.uA,1);gl.uniform1i(c.uB,2);gl.uniform1i(c.uD,3);gl.uniform1i(c.uF,4);gl.uniform4fv(c.uPr,PROJ);gl.uniform1f(c.uFoc,POST.foc);gl.uniform1f(c.uDof,dfOn?POST.dof:0);
    gl.uniform2f(c.uPx,1/w,1/h);gl.uniform2f(c.uPa,1/o.aw,1/o.ah);gl.uniform1f(c.uAOk,aoOn?1:0);gl.uniform1f(c.uBk,blOn?0.32:0);gl.uniform1f(c.uT,t);gl.uniform1f(c.uVig,0.32);gl.uniform1f(c.uFx,POST.fx?1:0);
    quadDraw(PC);gl.activeTexture(gl.TEXTURE0);gl.depthMask(true);}
  var E={gl:gl,ok:!sceneBad,
    upload:function(m){return {p:buf(m.P,Float32Array),n:buf(m.N,Float32Array),c:buf(m.C,Float32Array),t:buf(m.UV,Float32Array),r:m.R&&m.R.length?buf(m.R,Float32Array):null,i:buf(m.I,U32?Uint32Array:Uint16Array,gl.ELEMENT_ARRAY_BUFFER),cnt:m.I.length};},
    uploadSkin:function(m){return {p:buf(m.P,Float32Array),n:buf(m.N,Float32Array),c:buf(m.C,Float32Array),b:buf(m.B,Float32Array),w:buf(m.W,Float32Array),i:buf(m.I,U32?Uint32Array:Uint16Array,gl.ELEMENT_ARRAY_BUFFER),cnt:m.I.length};},
    setTex:function(tx,canvas){gl.bindTexture(gl.TEXTURE_2D,tx);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,canvas);gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      if(AN)gl.texParameterf(gl.TEXTURE_2D,AN.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(8,gl.getParameter(AN.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));},
    texture:function(canvas){var tx=gl.createTexture();E.setTex(tx,canvas);return tx},
    /* post chain on/off and its quality; returns whether it can actually run here */
    setPost:function(o){for(var k in o)POST[k]=o[k];if(postBad)POST.on=false;return POST.on},
    postOn:function(){return POST.on&&!postBad},
    dbg:function(){return {POST:POST,PROJ:PROJ,PP:PP&&{w:PP.w,h:PP.h,dep:!!PP.dep}}},
    /* projection parameters for depth reconstruction: near, far, tan(fovX/2), tan(fovY/2) */
    setProj:function(near,far,fovY,asp){var ty=Math.tan(fovY/2);PROJ=[near,far,ty*asp,ty];},
    /* shadow map: RGBA-packed depth rendered from the sun */
    initShadow:function(size){var t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,size,size,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      var rb=gl.createRenderbuffer();gl.bindRenderbuffer(gl.RENDERBUFFER,rb);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT16,size,size);
      var fb=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,fb);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,t,0);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,rb);
      var ok=gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE;gl.bindFramebuffer(gl.FRAMEBUFFER,null);SH=ok?{t:t,fb:fb,size:size,LVP:null}:null;return ok},
    shadowBegin:function(LVP){if(!SH)return false;gl.bindFramebuffer(gl.FRAMEBUFFER,SH.fb);gl.viewport(0,0,SH.size,SH.size);gl.clearColor(1,1,1,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST);gl.depthMask(true);gl.disable(gl.BLEND);gl.disable(gl.CULL_FACE);SH.LVP=LVP;[PD1,PD3].forEach(function(P){cur=null;use(P);gl.uniformMatrix4fv(P.u.uVP,false,LVP);});return true},
    drawD:function(g,m){use(PD1);gl.uniformMatrix4fv(PD1.u.uM,false,m);attr(0,g.p,3);attr(1,g.n,3);attr(2,g.c,4);attr(3,g.t,2);matAttr(g);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,g.i);gl.drawElements(gl.TRIANGLES,g.cnt,U32?gl.UNSIGNED_INT:gl.UNSIGNED_SHORT,0);},
    drawSkinD:function(g,dq,R0){use(PD3);var u=PD3.u;gl.uniform4fv(u['uQ[0]'],dq);gl.uniformMatrix4fv(u.uR0,false,R0);gl.uniform1f(u.uSh,0);gl.uniform1f(u.uFL,0);
      attr(0,g.p,3);attr(1,g.n,3);attr(2,g.c,4);attr(3,g.b,4);attr(4,g.w,4);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,g.i);gl.drawElements(gl.TRIANGLES,g.cnt,U32?gl.UNSIGNED_INT:gl.UNSIGNED_SHORT,0);},
    shadowEnd:function(){gl.bindFramebuffer(gl.FRAMEBUFFER,null);},
    begin:function(w,h,VP,eye,light,fog,env){env=env||{};var post=POST.on&&!postBad&&ensurePP(w,h);E.posting=!!post;
      gl.bindFramebuffer(gl.FRAMEBUFFER,post?PP.f:null);gl.viewport(0,0,w,h);gl.clearColor(0,0,0,0);gl.depthMask(true);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST);gl.disable(gl.BLEND);gl.disable(gl.CULL_FACE);
      var shOn=!!(SH&&SH.LVP&&env.shadow!==false);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,shOn?SH.t:blank);gl.activeTexture(gl.TEXTURE0);
      var K=env.k||[2.6,1.0,1.6,1.4];
      [P1,P3].forEach(function(P){cur=null;use(P);gl.uniformMatrix4fv(P.u.uVP,false,VP);gl.uniform3fv(P.u.uCam,eye);gl.uniform3fv(P.u.uL,light);gl.uniform3fv(P.u.uFog,fog);gl.uniform1i(P.u.uTex,0);gl.uniform1f(P.u.uUseTex,0);
        gl.uniform3fv(P.u.uAmb0,env.amb0||[1.0,0.85,0.86]);gl.uniform3fv(P.u.uAmb1,env.amb1||[0.98,0.97,1.0]);gl.uniform3fv(P.u.uSunC,env.sun||[1.0,0.96,0.9]);
        gl.uniform3fv(P.u.uLampP,env.lampP||[0,50,0]);gl.uniform3fv(P.u.uLampC,env.lampC||[0,0,0]);gl.uniform1i(P.u.uSM,1);gl.uniform1f(P.u.uShOn,shOn?1:0);
        gl.uniform4fv(P.u.uK,K);gl.uniform1f(P.u.uExp,env.exp||1);gl.uniform1f(P.u.uSMr,env.smr||2.2);
        gl.uniform1f(P.u.uSMs,SH?1/SH.size:0);if(shOn)gl.uniformMatrix4fv(P.u.uLVP,false,SH.LVP);});
      gl.uniform1f(P3.u.uFlip,0);gl.uniform1f(P3.u.uFur,1);use(P1);gl.uniform1f(P1.u.uFlip,1);gl.uniform1f(P1.u.uFur,0);E.VP=VP;},
    draw:function(g,m,tint,tex){use(P1);var u=P1.u;gl.uniformMatrix4fv(u.uM,false,m);gl.uniform3fv(u.uTint,tint||[1,1,1]);gl.uniform1f(u.uUseTex,tex?1:0);gl.bindTexture(gl.TEXTURE_2D,tex||blank);
      attr(0,g.p,3);attr(1,g.n,3);attr(2,g.c,4);attr(3,g.t,2);matAttr(g);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,g.i);gl.drawElements(gl.TRIANGLES,g.cnt,U32?gl.UNSIGNED_INT:gl.UNSIGNED_SHORT,0);},
    drawSkin:function(g,dq,R0,tint,fur){use(P3);var u=P3.u;gl.uniform4fv(u['uQ[0]'],dq);gl.uniformMatrix4fv(u.uR0,false,R0);gl.uniform3fv(u.uTint,tint||[1,1,1]);gl.bindTexture(gl.TEXTURE_2D,blank);
      attr(0,g.p,3);attr(1,g.n,3);attr(2,g.c,4);attr(3,g.b,4);attr(4,g.w,4);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,g.i);
      var ns=fur?fur.n:0,ty=U32?gl.UNSIGNED_INT:gl.UNSIGNED_SHORT;gl.uniform1f(u.uFL,fur?fur.len:0);gl.uniform1f(u.uFD,fur?fur.den:0);
      for(var k=0;k<=ns;k++){gl.uniform1f(u.uSh,ns?k/ns:0);gl.drawElements(gl.TRIANGLES,g.cnt,ty,0);}},
    sprites:function(camR,camU){use(P2);gl.bindBuffer(gl.ARRAY_BUFFER,quad);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
      gl.uniformMatrix4fv(P2.u.uVP,false,E.VP);gl.uniform3fv(P2.u.uR,camR);gl.uniform3fv(P2.u.uU,camU);gl.enable(gl.BLEND);gl.depthMask(false);},
    sprite:function(ctr,sz,col,pw,bill,additive){var u=P2.u;gl.blendFunc(gl.ONE,additive?gl.ONE:gl.ONE_MINUS_SRC_ALPHA);gl.uniform3fv(u.uCtr,ctr);gl.uniform2fv(u.uSz,sz);gl.uniform4fv(u.uCol,col);gl.uniform1f(u.uPow,pw);gl.uniform1f(u.uBill,bill?1:0);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);},
    end:function(){gl.depthMask(true);gl.disable(gl.BLEND);if(E.posting){try{runPost()}catch(e){console.error('[post] disabled: '+e);POST.on=false;gl.bindFramebuffer(gl.FRAMEBUFFER,null);}E.posting=false;}}
  };
  cv.addEventListener('webglcontextlost',function(e){e.preventDefault();},false);
  return E;
}

/* ================================================================
   REALISTIC CAT: signed-distance body -> surface nets mesh -> skinned to 14 bones
   ================================================================ */
/* --- allocation-free SDF primitives --- */
function sdRC(a,b,r1,r2){var bx=b[0]-a[0],by=b[1]-a[1],bz=b[2]-a[2],l2=bx*bx+by*by+bz*bz,rr=r1-r2,a2=l2-rr*rr,il2=1/l2,sg=rr>0?1:(rr<0?-1:0),ax=a[0],ay=a[1],az=a[2];
  var f=function(px,py,pz){var qx=px-ax,qy=py-ay,qz=pz-az,y=qx*bx+qy*by+qz*bz,z=y-l2,xx=qx*l2-bx*y,xy=qy*l2-by*y,xz=qz*l2-bz*y,x2=xx*xx+xy*xy+xz*xz,y2=y*y*l2,z2=z*z*l2,k=sg*rr*rr*x2;
    if((z>0?1:(z<0?-1:0))*a2*z2>k)return Math.sqrt(x2+z2)*il2-r2;
    if((y>0?1:(y<0?-1:0))*a2*y2<k)return Math.sqrt(x2+y2)*il2-r1;
    return (Math.sqrt(x2*a2*il2)+y*rr)*il2-r1;};
  f.c=[(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2];f.r=Math.sqrt(l2)/2+Math.max(r1,r2);return f}
function sdEL(c,r){var cx=c[0],cy=c[1],cz=c[2],rx=r[0],ry=r[1],rz=r[2];
  var f=function(px,py,pz){var x=(px-cx)/rx,y=(py-cy)/ry,z=(pz-cz)/rz,k0=Math.sqrt(x*x+y*y+z*z),x1=x/rx,y1=y/ry,z1=z/rz,k1=Math.sqrt(x1*x1+y1*y1+z1*z1);return k1>1e-9?k0*(k0-1)/k1:-Math.min(rx,ry,rz)};
  f.c=c.slice();f.r=Math.max(rx,ry,rz);return f}
function sminK(a,b,k){if(k<=0)return Math.min(a,b);var h=Math.max(k-Math.abs(a-b),0)/k;return Math.min(a,b)-h*h*k*0.25}
function SDF(){this.ops=[]}
SDF.prototype.add=function(f,k){this.ops.push({f:f,k:k||0,sub:false});return this};
SDF.prototype.sub=function(f,k){this.ops.push({f:f,k:k||0,sub:true});return this};
SDF.prototype.eval=function(x,y,z){var d=1e9,o=this.ops;
  for(var i=0;i<o.length;i++){var op=o[i],f=op.f,dx=x-f.c[0],dy=y-f.c[1],dz=z-f.c[2],lb=Math.sqrt(dx*dx+dy*dy+dz*dz)-f.r;
    if(op.sub){if(lb>op.k)continue;var v=f(x,y,z);d=-sminK(-d,v,op.k);}
    else{if(lb>d+op.k)continue;d=sminK(d,f(x,y,z),op.k);}}
  return d};
SDF.prototype.grad=function(x,y,z,e){return [this.eval(x+e,y,z)-this.eval(x-e,y,z),this.eval(x,y+e,z)-this.eval(x,y-e,z),this.eval(x,y,z+e)-this.eval(x,y,z-e)]};
SDF.prototype.bounds=function(pad){var mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];this.ops.forEach(function(op){if(op.sub)return;for(var k=0;k<3;k++){mn[k]=Math.min(mn[k],op.f.c[k]-op.f.r-pad);mx[k]=Math.max(mx[k],op.f.c[k]+op.f.r+pad);}});return [mn,mx]};
/* march from o along unit dir d until the surface is crossed, then bisect */
SDF.prototype.hit=function(o,d,maxT){var t=0,step=maxT/200,prev=this.eval(o[0],o[1],o[2]),lo=0;
  for(var i=0;i<200;i++){t+=step;var v=this.eval(o[0]+d[0]*t,o[1]+d[1]*t,o[2]+d[2]*t);if((v>0)!==(prev>0)){var a=t-step,b=t;for(var j=0;j<24;j++){var m=(a+b)/2,vm=this.eval(o[0]+d[0]*m,o[1]+d[1]*m,o[2]+d[2]*m);if((vm>0)===(v>0))b=m;else a=m;}t=(a+b)/2;break;}prev=v;}
  var p=[o[0]+d[0]*t,o[1]+d[1]*t,o[2]+d[2]*t],g=nrm(this.grad(p[0],p[1],p[2],1e-4));return {p:p,n:g}};

/* --- naive surface nets: one vertex per sign-changing cell, quads across sign-changing edges --- */
function surfaceNets(D,cell){
  var B=D.bounds(cell*2),mn=B[0],nx=Math.ceil((B[1][0]-mn[0])/cell),ny=Math.ceil((B[1][1]-mn[1])/cell),nz=Math.ceil((B[1][2]-mn[2])/cell);
  var sx=nx+1,sy=ny+1,sxy=sx*sy,V=new Float32Array(sxy*(nz+1)),x,y,z;
  for(z=0;z<=nz;z++)for(y=0;y<=ny;y++)for(x=0;x<=nx;x++)V[x+sx*y+sxy*z]=D.eval(mn[0]+x*cell,mn[1]+y*cell,mn[2]+z*cell);
  var vid=new Int32Array(V.length).fill(-1),P=[],Q=[],off=[],c;
  for(c=0;c<8;c++)off.push((c&1)+((c>>1)&1)*sx+((c>>2)&1)*sxy);
  var EDG=[[0,1],[2,3],[4,5],[6,7],[0,2],[1,3],[4,6],[5,7],[0,4],[1,5],[2,6],[3,7]],str=[1,sx,sxy],g=new Float32Array(8);
  for(z=0;z<nz;z++)for(y=0;y<ny;y++)for(x=0;x<nx;x++){
    var idx=x+sx*y+sxy*z,mask=0;for(c=0;c<8;c++){g[c]=V[idx+off[c]];if(g[c]<0)mask|=1<<c;}
    if(mask===0||mask===255)continue;
    var ax=0,ay=0,az=0,n=0;
    for(var e=0;e<12;e++){var a=EDG[e][0],b=EDG[e][1];if(((mask>>a)&1)===((mask>>b)&1))continue;var t=g[a]/(g[a]-g[b]);
      ax+=(a&1)+((b&1)-(a&1))*t;ay+=((a>>1)&1)+(((b>>1)&1)-((a>>1)&1))*t;az+=((a>>2)&1)+(((b>>2)&1)-((a>>2)&1))*t;n++;}
    vid[idx]=P.length/3;P.push(mn[0]+(x+ax/n)*cell,mn[1]+(y+ay/n)*cell,mn[2]+(z+az/n)*cell);
    var cc=[x,y,z];
    for(var i=0;i<3;i++){if(((mask&1)!==0)===(((mask>>(1<<i))&1)!==0))continue;var iu=(i+1)%3,iv=(i+2)%3;if(cc[iu]===0||cc[iv]===0)continue;
      var du=str[iu],dv=str[iv],A=vid[idx],Bq=vid[idx-du],Cq=vid[idx-du-dv],Dq=vid[idx-dv];if(Bq<0||Cq<0||Dq<0)continue;
      if(mask&1)Q.push(A,Bq,Cq,Dq);else Q.push(A,Dq,Cq,Bq);}
  }
  // project onto the true surface (2 Newton steps) and take normals from the SDF gradient
  var N=new Array(P.length),e2=cell*0.3;
  for(var v=0;v<P.length;v+=3){var px=P[v],py=P[v+1],pz=P[v+2];
    for(var it=0;it<2;it++){var d=D.eval(px,py,pz),gr=D.grad(px,py,pz,e2),l2=gr[0]*gr[0]+gr[1]*gr[1]+gr[2]*gr[2];if(l2<1e-14)break;var k=d*2*e2/l2;px-=gr[0]*k;py-=gr[1]*k;pz-=gr[2]*k;}
    P[v]=px;P[v+1]=py;P[v+2]=pz;var gn=nrm(D.grad(px,py,pz,e2));N[v]=gn[0];N[v+1]=gn[1];N[v+2]=gn[2];}
  // consistent winding: triangles must face along the gradient normal
  var I=[],vote=0;
  for(var q=0;q<Q.length;q+=4){var a0=Q[q]*3,b0=Q[q+1]*3,c0=Q[q+2]*3;var fnm=cross([P[b0]-P[a0],P[b0+1]-P[a0+1],P[b0+2]-P[a0+2]],[P[c0]-P[a0],P[c0+1]-P[a0+1],P[c0+2]-P[a0+2]]);vote+=fnm[0]*N[a0]+fnm[1]*N[a0+1]+fnm[2]*N[a0+2];}
  for(q=0;q<Q.length;q+=4){if(vote>=0)I.push(Q[q],Q[q+1],Q[q+2],Q[q],Q[q+2],Q[q+3]);else I.push(Q[q],Q[q+2],Q[q+1],Q[q],Q[q+3],Q[q+2]);}
  return {P:P,N:N,I:I};
}

/* --- rotations --- */
function rotTo(a,b){a=nrm(a);b=nrm(b);var v=cross(a,b),c=dot(a,b);
  if(c<-0.9999){var ax=nrm(cross(a,Math.abs(a[0])<0.9?[1,0,0]:[0,1,0]));return rotAxis(ax,PI)}
  var k=1/(1+c),x=v[0],y=v[1],z=v[2];
  return [1-k*(y*y+z*z),z+k*x*y,-y+k*x*z,0, -z+k*x*y,1-k*(x*x+z*z),x+k*y*z,0, y+k*x*z,-x+k*y*z,1-k*(x*x+y*y),0, 0,0,0,1]}
function rotAxis(u,a){var c=Math.cos(a),s=Math.sin(a),t=1-c,x=u[0],y=u[1],z=u[2];return [t*x*x+c,t*x*y+s*z,t*x*z-s*y,0, t*x*y-s*z,t*y*y+c,t*y*z+s*x,0, t*x*z+s*y,t*y*z-s*x,t*z*z+c,0, 0,0,0,1]}
function rotOf(m){return [m[0],m[1],m[2],0,m[4],m[5],m[6],0,m[8],m[9],m[10],0,0,0,0,1]}
function rv(m,v){return [m[0]*v[0]+m[4]*v[1]+m[8]*v[2],m[1]*v[0]+m[5]*v[1]+m[9]*v[2],m[2]*v[0]+m[6]*v[1]+m[10]*v[2]]}
/* two-bone IK: hip H, target F, lengths a,b, bend hint direction -> knee */
function ik2(H,F,a,b,hint){var d=sub(F,H),L=len3(d),dir=L>1e-6?scl(d,1/L):[0,-1,0];L=Math.max(Math.abs(a-b)+1e-4,Math.min(a+b-1e-4,L));
  var ca=(a*a+L*L-b*b)/(2*a*L),sa=Math.sqrt(Math.max(0,1-ca*ca)),p=sub(hint,scl(dir,dot(hint,dir)));p=len3(p)<1e-6?[0,0,1]:nrm(p);
  return {K:add(H,add(scl(dir,a*ca),scl(p,a*sa))),F:add(H,scl(dir,L))}}

/* ================= cat builder ================= */
var BONES=22;
function buildCat(o){
  var S=o.S,F=o.fat||1,Hf=o.head||1,Lf=o.leg||1,Tf=o.tail||1,BL=o.body||1,TLf=o.tailL||1,EA=o.ear||1,LL=o.legL||1,LW=o.lash===undefined?1:o.lash;
  function v(x,y,z){return [x*S,y*S,z*S]}function r(x){return x*S}
  /* torso points: the body-length slider stretches the spine front to back; the head keeps its own shape */
  function vb(x,y,z){return [x*S,y*S,z*S*BL]}
  var fx=.075*(1+(F-1)*0.6),bx=.085*(1+(F-1)*0.6);
  /* skeleton after the domestic cat: sacrum/pelvis, lumbar, thorax, cervical, skull; 5 caudal segments;
     fore limb = humerus (elbow points back) + radius/ulna + metacarpus/digits (digitigrade);
     hind limb = femur (stifle points forward) + tibia/fibula + long metatarsus (hock high and back) */
  function tl(y,z){var b=vb(0,.37,-.4);return [0,b[1]+(y-.37)*S*TLf,b[2]+(z+.4)*S*TLf]}
  var J={P0:vb(0,.34,-.2),L0:vb(0,.355,-.02),T0:vb(0,.37,.14),N0:vb(0,.45,.3),HC:vb(0,.6+(Hf-1)*.07,(.43+(Hf-1)*.05)),
    TL:[tl(.37,-.4),tl(.41,-.52),tl(.47,-.63),tl(.54,-.73),tl(.61,-.81),tl(.68,-.87)],
    FS:[vb(-fx,.315,.265),vb(fx,.315,.265)],FE:[vb(-fx,.19,.215),vb(fx,.19,.215)],FW:[vb(-fx,.058,.245),vb(fx,.058,.245)],FP:[vb(-fx,.03,.296),vb(fx,.03,.296)],
    BH:[vb(-bx,.31,-.22),vb(bx,.31,-.22)],BK:[vb(-bx,.2,-.125),vb(bx,.2,-.125)],BA:[vb(-bx,.1,-.27),vb(bx,.1,-.27)],BP:[vb(-bx,.03,-.215),vb(bx,.03,-.215)]};
  /* leg length scales from the hip/shoulder down, so long legs lift the body instead of sinking into it */
  if(LL!==1){['FE','FW','FP'].forEach(function(k2){for(var s2=0;s2<2;s2++){var a2=J.FS[s2],p2=J[k2][s2];J[k2][s2]=[p2[0],a2[1]+(p2[1]-a2[1])*LL,p2[2]];}});
    ['BK','BA','BP'].forEach(function(k2){for(var s2=0;s2<2;s2++){var a2=J.BH[s2],p2=J[k2][s2];J[k2][s2]=[p2[0],a2[1]+(p2[1]-a2[1])*LL,p2[2]];}});
    var lift=(LL-1)*0.285*S;['P0','L0','T0','N0','HC'].forEach(function(k2){J[k2]=add(J[k2],[0,lift,0])});J.TL=J.TL.map(function(p2){return add(p2,[0,lift,0])});
    ['FS','BH'].forEach(function(k2){J[k2]=J[k2].map(function(p2){return add(p2,[0,lift,0])})});
    ['FE','FW','BK','BA'].forEach(function(k2){J[k2]=J[k2].map(function(p2){return add(p2,[0,lift*(p2[1]>0.1*S?0.5:0.15),0])})});}
  J.MID=J.L0;J.T1=J.TL[0];J.TE=J.TL[5];
  var hc=J.HC,hr=.155*Hf,D=new SDF();
  function hv(x,y,z){return add(hc,v(x*Hf,y*Hf,z*Hf))}
  J.HN=hv(0,-.075,-.075);J.EB=[hv(-.083,.075,-.012),hv(.083,.075,-.012)];J.ET=[mix(J.EB[0],hv(-.136,.222,-.03),EA).slice(0,3),mix(J.EB[1],hv(.136,.222,-.03),EA).slice(0,3)];
  var LY=LL!==1?[0,(LL-1)*0.285*S,0]:[0,0,0];function vt(x,y,z){return add(vb(x,y,z),LY)}
  D.add(sdRC(vt(0,.345,-.23),vt(0,.37,.22),r(.15*F),r(.132*F)));
  D.add(sdEL(vt(0,.305,-.03),[r(.128*F),r(.12*F),r(.25*BL)]),r(.07));
  D.add(sdEL(vt(0,.36,.2),[r(.112*F),r(.13*F),r(.12*BL)]),r(.06));
  D.add(sdEL(vt(0,.35,-.24),[r(.135*F),r(.14*F),r(.13*BL)]),r(.06));
  D.add(sdRC(vt(0,.4,.24),add(hc,v(0,-.07,-.05)),r(.1*Math.sqrt(F)),r(.085*Hf)),r(.06));
  /* throat and chest ruff: fills the front of the neck so it never thins into a stalk */
  D.add(sdEL(add(mix(vt(0,.36,.26),add(hc,v(0,-.1,-.02)),0.45).slice(0,3),[0,0,r(.02)]),[r(.085*Math.sqrt(F)),r(.1),r(.08)]),r(.06));
  D.add(sdEL(hc,[r(hr*1.07),r(hr*.94),r(hr*.9)]),r(.04));
  [-1,1].forEach(function(s){D.add(sdEL(hv(s*.092,-.055,.02),[r(.09*Hf),r(.072*Hf),r(.075*Hf)]),r(.05));});
  D.add(sdEL(hv(0,-.06,.088),[r(.042*Hf),r(.028*Hf),r(.032*Hf)]),r(.045));
  
  [-1,1].forEach(function(s){D.add(sdEL(hv(s*.024,-.07,.092),[r(.03*Hf),r(.024*Hf),r(.026*Hf)]),r(.022));});
  [-1,1].forEach(function(s){var b0=hv(s*.083,.075,-.012),tp=mix(b0,hv(s*.136,.222,-.03),EA).slice(0,3);function ep(x,y,z){return mix(b0,hv(x,y,z),EA).slice(0,3)}
    D.add(sdRC(b0,tp,r(.066*Hf*Math.sqrt(EA)),r(.012*Hf)),r(.045));
    D.sub(sdRC(ep(s*.096,.13,.034),ep(s*.13,.208,-.002),r(.03*Hf*Math.sqrt(EA)),r(.003*Hf)),r(.01));});
  [0,1].forEach(function(i){
    D.add(sdRC(J.FS[i],J.FE[i],r(.05*Lf*Math.sqrt(F)),r(.038*Lf)),r(.05));D.add(sdRC(J.FE[i],J.FW[i],r(.036*Lf),r(.03*Lf)),r(.02));
    D.add(sdEL(mix(J.FW[i],J.FP[i],0.6).slice(0,3),[r(.039*Lf),r(.03*Lf),r(.05*Lf)]),r(.025));
    D.add(sdRC(J.BH[i],J.BK[i],r(.095*Lf*Math.sqrt(F)),r(.055*Lf)),r(.06));D.add(sdRC(J.BK[i],J.BA[i],r(.042*Lf),r(.031*Lf)),r(.025));
    D.add(sdRC(J.BA[i],J.BP[i],r(.031*Lf),r(.029*Lf)),r(.015));D.add(sdEL(add(J.BP[i],v(0,.003,.004)),[r(.039*Lf),r(.03*Lf),r(.052*Lf)]),r(.022));});
  for(var ti=0;ti<5;ti++)D.add(sdRC(J.TL[ti],J.TL[ti+1],r((.045-.004*ti)*Tf),r((.041-.0035*ti)*Tf)),r(ti?0.012:0.04));
  var net=surfaceNets(D,r(o.cell||0.016));
  /* bones: segment for weighting, joint for skinning */
  /* 22 bones: 0 pelvis 1 lumbar 2 thorax 3 neck 4 skull | 5-9 tail | 10-12 left fore (humerus, forearm, manus) 13-15 right fore | 16-18 left hind (femur, tibia, pes) 19-21 right hind */
  var bn=[{a:J.P0,b:J.L0,R:.17},{a:J.L0,b:J.T0,R:.16},{a:J.T0,b:J.N0,R:.16},{a:J.N0,b:J.HN,R:.11},{a:J.HN,b:hc,R:.2*Hf+0.02}];
  for(ti=0;ti<5;ti++)bn.push({a:J.TL[ti],b:J.TL[ti+1],R:.055-.004*ti});
  [0,1].forEach(function(i){bn.push({a:J.FS[i],b:J.FE[i],R:.065},{a:J.FE[i],b:J.FW[i],R:.05},{a:J.FW[i],b:J.FP[i],R:.045});});
  [0,1].forEach(function(i){bn.push({a:J.BH[i],b:J.BK[i],R:.09},{a:J.BK[i],b:J.BA[i],R:.055},{a:J.BA[i],b:J.BP[i],R:.045});});
  function legSide(bi){return bi>=10&&bi<=12||bi>=16&&bi<=18?-1:bi>=13&&bi<=15||bi>=19?1:0}
  function segD(p,a,b){var ab=sub(b,a),t=Math.max(0,Math.min(1,dot(sub(p,a),ab)/dot(ab,ab)));return len3(sub(p,add(a,scl(ab,t))))}
  var m={P:net.P,N:net.N,I:net.I,C:[],B:[],W:[]};
  function wAt(p,outB,outW){var cand=[];
    for(var bi=0;bi<bn.length;bi++){var B=bn[bi],side=legSide(bi);if(side&&p[0]*side<-r(0.02))continue;
      if(bi<=2&&p[1]<r(0.16)&&Math.abs(p[0])>r(0.04))continue; // keep the lower legs off the torso bones
      if(bi>=3&&bi<=4&&p[2]<r(0.2))continue;
      var d=segD(p,B.a,B.b)/r(B.R);cand.push([1/(1e-4+d*d*d*d),bi]);}
    /* 4 bones per vertex; subtracting the 5th weight makes each bone fade to exactly 0 before it drops out -> no seams */
    cand.sort(function(a,b){return b[0]-a[0]});var w5=cand.length>4?cand[4][0]:0,ws=[],tot=0;
    for(var q4=0;q4<4;q4++){var cw=q4<cand.length?Math.max(0,cand[q4][0]-w5):0;ws.push(cw);tot+=cw;}
    for(q4=0;q4<4;q4++){outB.push(q4<cand.length?cand[q4][1]:cand[0][1]);outW.push(tot>0?ws[q4]/tot:(q4?0:1));}}
  for(var vi=0;vi<net.P.length;vi+=3){var p=[net.P[vi],net.P[vi+1],net.P[vi+2]],nn=[net.N[vi],net.N[vi+1],net.N[vi+2]];wAt(p,m.B,m.W);
    var col=o.color(p,nn,J,S,hc);m.C.push(col[0],col[1],col[2],0);}
  /* rigid parts riding on bones, positioned on the real SDF surface */
  var parts={head:[],chest:[]},hd=new Mesh(),eyes=[new Mesh(),new Mesh()],pup=[new Mesh(),new Mesh()],eyeF=[],eyeFi=[],blushP=[],tongue=new Mesh(),beans=[new Mesh(),new Mesh()],eyeC=[],happy=[new Mesh(),new Mesh()],wink=[new Mesh(),new Mesh()],mouth=[],lipM=new Mesh(),mouthTop=null;
  function onS(dir,from){return D.hit(from||hc,nrm(dir),r(0.4))}
  function frameZ(n){var z=nrm(n),x=nrm(cross([0,1,0],z)),y=cross(z,x);return [x[0],x[1],x[2],0,y[0],y[1],y[2],0,z[0],z[1],z[2],0,0,0,0,1]}
  var er=r(.05*Hf*(o.eyeK||1));
  function rinv(m){return [m[0],m[4],m[8],0,m[1],m[5],m[9],0,m[2],m[6],m[10],0,-(m[0]*m[12]+m[1]*m[13]+m[2]*m[14]),-(m[4]*m[12]+m[5]*m[13]+m[6]*m[14]),-(m[8]*m[12]+m[9]*m[13]+m[10]*m[14]),1]}
  [-1,1].forEach(function(s,i){var h=onS([s*0.5,-0.04,0.86]),F0=M(T(h.p),frameZ(add(h.n,[0,0,0.18]))),EY=1.12;
    /* every eye part is projected onto the real head surface, then lifted a little: the eye bulges like an eyeball instead of a flat disc */
    function hitAt(x,y){var w=xf(F0,[x,y,0]);return D.hit(hc,nrm(sub(w,hc)),r(0.5))}
    function dome(x,y,lift){var hh=hitAt(x,y);return add(hh.p,scl(hh.n,lift))}
    function lift(rho){return r(.0012)+er*0.11*Math.max(0,1-rho*rho)}
    eyes[i].m(0.06,6);pup[i].m(0.06,6);happy[i].m(0.7,0);wink[i].m(0.7,0);
    eyes[i].surf(function(u,vv){var a=vv*TAU;return dome(u*er*Math.cos(a),u*er*EY*Math.sin(a),lift(u))},16,40,function(u,vv){var a=vv*TAU,x=u*Math.cos(a),y=u*Math.sin(a),rr=u;
      if(rr<0.22){return H('#1d1220')}
      var an=Math.atan2(y,x),fib=0.5+0.5*Math.sin(an*23+Math.sin(an*7)*2.2);
      var c=mix(o.iris[1],o.iris[0],sm(0.4,-0.9,y));c=mix(c,o.iris[1],sm(0.5,0.22,rr)*0.55);c=mix(c,mix(o.iris[0],H('#ffffff'),0.35),fib*0.3*sm(0.3,0.6,rr)*sm(0.95,0.7,rr));
      c=mix(c,H('#ffffff'),sm(-0.5,-0.95,y)*0.3*sm(0.5,0.8,rr));
      return mix(c,H('#24151e'),sm(0.8,0.97,rr))});
    var c0=dome(0,0,lift(0)),hc0=hitAt(0,0),Fc=M(T(c0),frameZ(hc0.n));eyeF.push(Fc);eyeFi.push(rinv(Fc));eyeC.push(c0);
    pup[i].surf(function(u,vv){var a=vv*TAU,q=u*0.47;return dome(q*er*Math.cos(a),q*er*EY*Math.sin(a),lift(q)+r(.0009))},6,28,function(u){return mix(H('#150c18'),H('#33203a'),sm(0.5,1,u)*0.6)});
    eyes[i].m(0.06,6);[[0.3,0.34,0.22],[-0.3,-0.36,0.09]].forEach(function(g){var hh=hitAt(g[0]*er,g[1]*er*EY),rho=Math.hypot(g[0],g[1]);
      eyes[i].surf(ell(er*g[2],er*g[2],er*0.05),8,10,H('#ffffff',1),M(T(add(hh.p,scl(hh.n,lift(rho)+r(.0016)))),frameZ(hh.n)));});
    eyes[i].m(0.7,0);
    // thin lash line hugging the upper rim, flicking out at the outer corner
    eyes[i].surf(tube(function(u){var a=PI*(0.12+u*0.76),rr=1.03+0.03*Math.sin(u*PI);return dome(Math.cos(a)*er*rr,Math.sin(a)*er*EY*rr,r(.0022))},function(u){return er*(0.012+0.03*LW)*(0.6+0.8*Math.sin(u*PI))},24),24,6,H('#2b1a22'));
    eyes[i].surf(tube(function(u){var a=PI*(s>0?0.12:0.88),x0=Math.cos(a)*er*1.03,y0=Math.sin(a)*er*EY*1.03;return dome(x0+s*u*er*(0.1+0.16*LW),y0+u*er*(0.06+0.12*LW),r(.0022))},capR(er*(0.015+0.03*LW)),8),8,5,H('#2b1a22'));
    // closed-eye shapes painted flush on the fur: gentle happy arch and wink
    var ap=[];for(var k=0;k<=12;k++){var a=PI*(0.2+0.6*k/12);ap.push(dome(Math.cos(a)*er*0.95,(Math.sin(a)-0.78)*er*0.9,r(.002)));}
    happy[i].surf(tube(polyCurve(ap),capR(er*0.08),40),40,8,H('#3a2228'));
    var wp=[dome(s*0.55*er,0.38*er,r(.002)),dome(-s*0.4*er,0.0,r(.002)),dome(s*0.55*er,-0.36*er,r(.002))];
    wink[i].surf(tube(polyCurve(wp),capR(er*0.08),40),40,8,H('#3a2228'));
    if(o.blush)blushP.push(onS([s*0.72,-0.34,0.6]).p);
  });
  var nz=onS([0,-0.33,1]),nose=M(T(nz.p),frameZ(nz.n));hd.m(0.32,8);lipM.m(0.55,0);tongue.m(0.3,8);
  hd.surf(function(u,vv){var a=vv*TAU,t=u*PI,R=r(.016*Hf)*(1-0.3*Math.max(0,-Math.sin(a)));return [R*Math.sin(t)*Math.cos(a),R*0.75*Math.sin(t)*Math.sin(a),R*0.55*Math.cos(t)]},10,16,o.nose,nose);
  function proj(x,y){return D.hit([hc[0]+x,hc[1]+y,hc[2]],[0,0,1],r(0.3)).p}
  lipM.surf(tube(function(u){var x=(u-0.5)*r(.062*Hf),y=(nz.p[1]-hc[1])-r(.02*Hf)-r(.012*Hf)*Math.abs(Math.sin(TAU*u));var q=proj(x,y);return add(q,[0,0,r(.0015)])},capR(r(.0027*Hf)),36),36,5,o.lip);
  hd.m(0.55,0);hd.surf(tube(function(u){var y=(nz.p[1]-hc[1])-r(.009*Hf)-u*r(.011*Hf);return add(proj(0,y),[0,0,r(.0015)])},cst(r(.0024*Hf)),6),6,5,o.lip);
  (function(){var yL=(nz.p[1]-hc[1])-r(.02*Hf),A=r(.033*Hf),nu=10,nv=32;
    function lipY(x){return yL-r(.005*Hf)-r(.0045*Hf)*Math.abs(Math.sin(PI*Math.max(-1,Math.min(1,x/A))))}
    mouthTop=add(proj(0,yL-r(.006*Hf)),[0,0,r(.0035)]);
    for(var lv=1;lv<=5;lv++){(function(B){var G=[],mm=new Mesh().m(0.38,8);
      for(var j=0;j<=nv;j++){G.push([]);for(var ii=0;ii<=nu;ii++){var th=PI+PI*j/nv,u=ii/nu,x=u*A*Math.cos(th),y=lipY(x)-u*B*Math.pow(-Math.sin(th),0.7),hh=D.hit([hc[0]+x,hc[1]+y,hc[2]],[0,0,1],r(0.4));G[j].push(add(hh.p,scl(hh.n,r(.003))));}}
      mm.surf(function(u,v){var fj=v*nv,j=Math.min(nv-1,Math.floor(fj)),tj=fj-j,fi=u*nu,i2=Math.min(nu-1,Math.floor(fi)),ti=fi-i2;
        var a0=mix(G[j][i2],G[j][i2+1],ti),a1=mix(G[j+1][i2],G[j+1][i2+1],ti);return mix(a0,a1,tj).slice(0,3)},nu,nv,function(u,v){var th=PI+PI*v,x=u*Math.cos(th),y=u*Math.sin(th),q=(x*x)/0.42+(y+1.02)*(y+1.02)/0.4;if(u>0.9||y>-0.07)return o.lip;var tq=(x*x)/0.62+(y+1.05)*(y+1.05)/0.42;return tq<1?mix(H('#ffa5b8'),H('#f2879e'),sm(0.08,0,Math.abs(x))*0.4):mix(H('#9c3a52'),H('#c25670'),sm(-0.15,-0.7,y)*0.6)});
      mouth.push(mm);})(r(.03*Hf)*lv/5);}})();
  hd.m(0.35,0);[-1,1].forEach(function(s){for(var w=0;w<3;w++){var rt=onS([s*0.48,-0.42+w*0.06,0.78]).p,dv=[s*1,0.1-w*0.12,-0.25];
    hd.surf(tube(bez(rt,add(rt,scl(dv,r(.05*Hf))),add(rt,add(scl(dv,r(.11*Hf)),[0,-r(.012),0])),add(rt,add(scl(dv,r(.17*Hf)),[0,-r(.03),0]))),cst(r(.0022)),16),16,4,o.whisker);}});
  /* little tongue (blep) hanging from the lip line */
  (function(){var y0=(nz.p[1]-hc[1])-r(.027*Hf),tp=proj(0,y0);
    tongue.surf(function(u,vv){var t=u*PI,a=vv*TAU,w=r(.017*Hf),l=r(.03*Hf);return [w*Math.sin(t)*Math.cos(a)*(1-0.25*Math.max(0,Math.cos(t))),-l*0.5*(1-Math.cos(t)),r(.006*Hf)*Math.sin(t)*Math.sin(a)]},10,14,function(u,vv,lp){return mix(H('#ff8fa6'),H('#f0708c'),sm(r(.004*Hf),0,Math.abs(lp[0]))*0.6)},T(tp[0],tp[1],tp[2]+r(.004)));
    tongue.top=tp;})();
  /* pink toe beans under the front paws, skinned with the same bone weights as the paw skin */
  var beanP=[];
  [0,1].forEach(function(i){var c0=mix(J.FW[i],J.FP[i],0.6).slice(0,3);c0[2]+=r(0.004);
    [[0,-.012,.02,.016],[-.024,.02,.0095,.011],[-.009,.033,.0095,.011],[.009,.033,.0095,.011],[.024,.02,.0095,.011]].forEach(function(b){
      var h=D.hit([c0[0]+r(b[0]*Lf),c0[1],c0[2]+r(b[1]*Lf)],[0,-1,0],r(0.1));beanP.push(h.p);
      beans[i].surf(ell(r(b[2]*Lf),r(.006*Lf),r(b[3]*Lf)),8,10,o.bean||H('#ff9db5'),M(T(add(h.p,scl(h.n,-r(.0015)))),RX(b[1]>0.015?-0.5:0)));});
    beans[i].B=[];beans[i].W=[];for(var bv=0;bv<beans[i].P.length;bv+=3)wAt([beans[i].P[bv],beans[i].P[bv+1],beans[i].P[bv+2]],beans[i].B,beans[i].W);});
  /* fur length per vertex (stored in colour alpha) + blush painted into the coat */
  var mTop=mouthTop;
  for(vi=0;vi<net.P.length;vi+=3){p=[net.P[vi],net.P[vi+1],net.P[vi+2]];var ci=vi/3*4,x=p[0]/S,y=p[1]/S,z=p[2]/S,nz_=net.N[vi+2];
    var hl=[(p[0]-hc[0])/S/Hf,(p[1]-hc[1])/S/Hf,(p[2]-hc[2])/S/Hf],hd_=Math.sqrt(hl[0]*hl[0]+hl[1]*hl[1]+hl[2]*hl[2])*Hf,Lh=1;
    if(hd_<0.2*Hf+0.04&&hl[1]>-0.15){
      Lh=0.6+0.55*sm(0.02,-0.08,hl[1])*sm(0.07,0.12,Math.abs(hl[0]));
      Lh*=1-0.5*sm(0.04,0.1,hl[2]);
      var earZ=sm(0.09,0.13,hl[1])*sm(0.05,0.08,Math.abs(hl[0]));Lh=lerp(Lh,nz_>0.15?0.1:0.3,earZ);
      for(var e2=0;e2<2;e2++)Lh*=sm(1.12,1.9,len3(sub(p,eyeC[e2]))/er);
      Lh*=sm(1.0,2.4,len3(sub(p,nz.p))/r(.016*Hf));
      Lh*=sm(0.55,1.25,len3(sub(p,add(mTop,[0,-r(.02*Hf),0])))/r(.045*Hf));
      for(e2=0;e2<blushP.length;e2++){var bd=sub(p,blushP[e2]),bq=Math.sqrt(bd[0]*bd[0]*0.45+bd[1]*bd[1]+bd[2]*bd[2]*0.45)/r(.04*Hf),bk=(o.blushK===undefined?0.42:o.blushK)*sm(1.25,0.35,bq);
        m.C[ci]+=(o.blush[0]-m.C[ci])*bk;m.C[ci+1]+=(o.blush[1]-m.C[ci+1])*bk;m.C[ci+2]+=(o.blush[2]-m.C[ci+2])*bk;}
    }else if(z<-0.36&&y>0.26)Lh=1.3;
    else{Lh=lerp(0.3,1,sm(0.05,0.22,y));if(z>0.12&&y>0.2&&y<0.44)Lh=1.25;Lh*=sm(0.008,0.035,y);
      for(e2=0;e2<beanP.length;e2++)Lh*=sm(0.012,0.03,len3(sub(p,beanP[e2]))/S);}
    m.C[ci+3]=Lh;}
  if(o.extraHead)o.extraHead(hd,{onS:onS,hc:hc,r:r,hv:hv,frameZ:frameZ});
  var ch=new Mesh();if(o.extraChest)o.extraChest(ch,{D:D,J:J,r:r,v:v,frameZ:frameZ});
  return {S:S,J:J,mesh:m,head:hd,chest:ch,eyes:eyes,lip:lipM,pup:pup,eyeF:eyeF,eyeFi:eyeFi,tongue:tongue,beans:beans,fur:{n:o.shells||10,len:r(o.furLen||.02),den:(o.furDen||60)/S},eyeC:eyeC,happy:happy,wink:wink,mouth:mouth,mouthTop:mouthTop,D:D,
    La:[len3(sub(J.FE[0],J.FS[0])),len3(sub(J.FW[0],J.FE[0])),len3(sub(J.FP[0],J.FW[0]))],Lb:[len3(sub(J.BK[0],J.BH[0])),len3(sub(J.BA[0],J.BK[0])),len3(sub(J.BP[0],J.BA[0]))]};
}

/* ================= pose controller ================= */
var CP={
  stand:{py:.34,pz:-.2,pitch:0,cp:0,fz:0,fG:1,frel:[0,-.24,.03],bz:.02,bG:1,brel:[0,-.24,0],tailUp:0.1},
  sit:{py:.11,pz:-.17,pitch:-0.6,cp:-0.7,sd:0.075,nk:0.7,nd:0.1,ts:0.25,bsp:0.02,fz:0,fG:1,frel:[0,-.24,.03],bz:.15,bG:1,brel:[0,-.2,.16],tailUp:-0.4},
  crouch:{py:.25,pz:-.2,pitch:.05,cp:.05,fz:-.02,fG:1,frel:[0,-.2,.03],bz:.07,bG:1,brel:[0,-.2,.05],tailUp:-0.1},
  jump:{py:.34,pz:-.2,pitch:-.2,cp:0,fz:0,fG:0,frel:[0,-.15,.17],bz:0,bG:0,brel:[0,-.17,-.16],tailUp:0.3},
  tuck:{py:.34,pz:-.2,pitch:.05,cp:0,fz:0,fG:0,frel:[0,-.12,.06],bz:0,bG:0,brel:[0,-.13,.07],tailUp:0.1},
  beg:{py:.24,pz:-.2,pitch:-1.3,cp:-0.12,fz:0,fG:0,frel:[0,-.2,.04],bz:.1,bG:1,brel:[0,-.2,.1],tailUp:-0.2},
  hop:{py:.34,pz:-.2,pitch:-.45,cp:-.1,fz:0,fG:0,frel:[0,-.21,.07],bz:0,bG:0,brel:[0,-.23,.03],tailUp:0.6},
  meme:{py:.3,pz:-.2,pitch:-.95,cp:-.15,fz:0,fG:0,frel:[0,-.2,.06],bz:0,bG:0,brel:[0,-.27,.02],tailUp:0.9},
  memeLand:{py:.21,pz:-.2,pitch:-.8,cp:-.1,fz:0,fG:0,frel:[0,-.18,.08],bz:.06,bG:1,brel:[0,-.2,.05],tailUp:0.6},
  stretch:{py:.3,pz:-.2,pitch:.42,cp:.12,fz:.24,fG:1,frel:[0,-.2,.1],bz:0,bG:1,brel:[0,-.2,0],tailUp:0.6}
};
function catState(){var s={eye:['open','open'],pup:[0.7,1],eyeS:1,blep:0,earO:0,earF:0,mouth:0,hy:0,hp:0,tilt:0,blink:1,tailSw:0.4,tailCurl:0,sq:0,gAmp:0,gPh:0,ovL:null,ovR:null,ovLw:0,ovRw:0,tailT:0,feet:[[0,0,0],[0,0,0],[0,0,0],[0,0,0]],footW:[0,0,0,0],scap:[0,0],flex:0,bob:null};var P=CP.sit;for(var k in P)s[k]=Array.isArray(P[k])?P[k].slice():P[k];return s}
function toCP(st,P,k){for(var key in P){var v=P[key];if(Array.isArray(v)){for(var i=0;i<3;i++)st[key][i]+=(v[i]-st[key][i])*k}else st[key]+=(v-st[key])*k}
  if(P.lat===undefined)st.lat=(st.lat||0)*(1-k);if(P.ts===undefined)st.ts=(st.ts||0)*(1-k);if(P.bsp===undefined)st.bsp=(st.bsp||0)*(1-k);if(P.nk===undefined)st.nk=(st.nk===undefined?0.5:st.nk)+(0.5-(st.nk===undefined?0.5:st.nk))*k;if(P.nd===undefined)st.nd=(st.nd||0)*(1-k);if(P.twist===undefined)st.twist=(st.twist||0)*(1-k);}
var GAIT=[0.25,0.75,0,0.5]; // FL FR BL BR: lateral-sequence walk LH→LF→RH→RF, as cats walk
/* rigid matrix -> unit dual quaternion (real xyzw, dual xyzw) */
function dqOf(m,o,k){var a=m[0],b=m[5],c=m[10],tr=a+b+c,x,y,z,w,S;
  if(tr>0){S=Math.sqrt(tr+1)*2;w=0.25*S;x=(m[6]-m[9])/S;y=(m[8]-m[2])/S;z=(m[1]-m[4])/S;}
  else if(a>b&&a>c){S=Math.sqrt(1+a-b-c)*2;w=(m[6]-m[9])/S;x=0.25*S;y=(m[4]+m[1])/S;z=(m[8]+m[2])/S;}
  else if(b>c){S=Math.sqrt(1+b-a-c)*2;w=(m[8]-m[2])/S;x=(m[4]+m[1])/S;y=0.25*S;z=(m[9]+m[6])/S;}
  else{S=Math.sqrt(1+c-a-b)*2;w=(m[1]-m[4])/S;x=(m[8]+m[2])/S;y=(m[9]+m[6])/S;z=0.25*S;}
  var tx=m[12],ty=m[13],tz=m[14];o[k]=x;o[k+1]=y;o[k+2]=z;o[k+3]=w;
  o[k+4]=0.5*(tx*w+ty*z-tz*y);o[k+5]=0.5*(-tx*z+ty*w+tz*x);o[k+6]=0.5*(tx*y-ty*x+tz*w);o[k+7]=-0.5*(tx*x+ty*y+tz*z);}
/* anatomical pose: spine chain, 5-segment tail, 3-segment digitigrade legs solved by IK (distal segment first, then 2-bone IK) */
function ng(p){return [-p[0],-p[1],-p[2]]}
function poseCat(c,st,M0,t){
  var S=c.S,J=c.J,q=st.sq,R0=M(M0,Sc(1+q*0.5,1-q,1+q*0.5)),fl=st.flex||0;
  var bob=st.bob!==null&&st.bob!==undefined?st.bob:st.gAmp*0.012*S*Math.abs(Math.sin(TAU*st.gPh*2));
  var Sp=M(T(0,st.py*S+bob,st.pz*S),RX(st.pitch),T(ng(J.P0)));
  var br=0.012*Math.sin(t*2.1+S);
  var la=st.lat||0,tw=st.twist||0;
  var Sl=M(Sp,T(J.L0),RX(st.cp*0.5+fl*0.55),RY(la*0.56),RZ(tw*0.5),T(ng(J.L0)));
  var comp=-(st.pitch+st.cp+fl)*0.95,hy=Math.max(-0.85,Math.min(0.85,st.hy)),ts=st.ts||0;
  var St=M(Sl,T(J.T0),RX(st.cp*0.5+fl*0.45+br+comp*ts),RY(la*0.56),RZ(tw*0.5),T(ng(J.T0)));comp*=1-ts;
  var nk=st.nk===undefined?0.5:st.nk; /* how much of the level-head correction the neck base takes: more = head sits forward on the shoulders */
  var Sn=M(St,T(J.N0),T(0,-(st.nd||0)*S,-(st.nd||0)*0.4*S),RX(comp*nk),RY(hy*0.45+la*0.45),T(ng(J.N0)));
  var Sh=M(Sn,T(J.HN),RX(comp*(1-nk)),RY(hy*0.55),RX(st.hp),RZ(st.tilt),T(ng(J.HN)));
  var out=[Sp,Sl,St,Sn,Sh],prev=Sp,tt=st.tailT,A=st.tailSw,cu=st.tailCurl;
  for(var i=0;i<5;i++){var jt=J.TL[i];prev=M(prev,T(jt),RX(st.tailUp*(0.36-0.05*i)+0.035*i),RY(Math.sin(tt-i*0.55)*A*(0.42+0.18*i)+cu*(0.4+0.17*i)-la*0.12),T(ng(jt)));out.push(prev);}
  var Rt=rotOf(St),Rp=rotOf(Sp),feet=[],FT=st.feet,FW=st.footW;
  function leg(i){var front=i<2,s=i%2,A=front?J.FS[s]:J.BH[s],B=front?J.FE[s]:J.BK[s],Cc=front?J.FW[s]:J.BA[s],Dd=front?J.FP[s]:J.BP[s],
      par=front?St:Sp,Rpar=front?Rt:Rp,Hj=xf(par,A);
    if(front&&st.scap)Hj=add(Hj,rv(Rpar,[0,st.scap[s]*S,0]));
    if(front&&st.sd)Hj=add(Hj,[0,-st.sd*S,0]); /* sitting: the shoulder blades slide, the forelegs reach further down */
    var a=len3(sub(B,A)),b=len3(sub(Cc,B)),cl=len3(sub(Dd,Cc)),rel=front?st.frel:st.brel,G=front?st.fG:st.bG,gz=front?st.fz:st.bz;
    var gt=[Hj[0]*0.97,Dd[1],Hj[2]+gz*S+(Dd[2]-A[2])*0.6];
    if(st.gAmp>0.001&&!(FW&&FW[i]>0.01)){var f=st.gPh+GAIT[i];gt[2]+=-0.1*S*st.gAmp*Math.cos(TAU*f);gt[1]+=0.06*S*st.gAmp*Math.max(0,Math.sin(TAU*f));}
    var sgn=s?1:-1,spl=front?0:(st.bsp||0);if(spl){gt[0]+=sgn*spl*S;}
    var rt=add(Hj,rv(Rpar,add(scl(rel,S),[sgn*spl*S,0,0]))),F=mix(rt,gt,G).slice(0,3),contact=G;
    if(FT&&FW&&FW[i]>0){F=mix(F,FT[i],FW[i]).slice(0,3);var lifted=sm(0.006*S,0.05*S,FT[i][1]-Dd[1]);contact=contact*(1-FW[i])+FW[i]*(1-lifted);}
    var ov=front?(s?st.ovR:st.ovL):null,ow=front?(s?st.ovRw:st.ovLw):0;if(ov&&ow>0){F=mix(F,ov,ow).slice(0,3);contact*=1-ow;}
    /* distal segment: lies along its standing direction while weight-bearing; in the air the paw hangs and the toes flex */
    var dRest=nrm(sub(Dd,Cc)),dAir=rv(Rpar,front?nrm([0,-0.97,0.24]):nrm([0,-0.8,0.6])),dd=nrm(mix(dAir,dRest,contact));
    /* crouched or sitting (paw much closer to the hip than the limb is long): the hind metatarsus lies down, hock on the floor,
       exactly as a sitting cat rests on its hocks; the fore paw stays digitigrade but its wrist bends forward */
    var ratio=len3(sub(F,Hj))/(a+b+cl),flat=sm(0.78,0.5,ratio)*contact;
    if(flat>0)dd=nrm(mix(dd,front?[0,-0.6,0.8]:nrm([0,-0.12,1]),front?flat*0.4:flat));
    var W=sub(F,scl(dd,cl));
    var hint=rv(Rpar,front?[0,0.1,-1]:[sgn*spl*14,0.3,1]),k=ik2(Hj,W,a,b,hint); /* sitting: knees turn out so the haunches spread into a pear */
    var d0=rv(Rpar,sub(B,A)),d1=sub(k.K,Hj),Rs;
    if(front){var fw=rv(Rpar,[0,0.25,1]);Rs=M(rotTo(fw,d1),rotTo(d0,fw));}else Rs=rotTo(d0,d1);
    var R1=M(Rs,Rpar),S1=M(T(Hj),R1,T(ng(A)));
    var R2=M(rotTo(rv(R1,sub(Cc,B)),sub(k.F,k.K)),R1),S2=M(T(k.K),R2,T(ng(B)));
    var R3=M(rotTo(rv(R2,sub(Dd,Cc)),sub(F,k.F)),R2),S3=M(T(k.F),R3,T(ng(Cc)));
    out.push(S1,S2,S3);feet.push(xf(S3,Dd));}
  leg(0);leg(1);leg(2);leg(3);
  var buf=new Float32Array(BONES*16),dq=new Float32Array(BONES*8);for(i=0;i<BONES;i++){var w=M(R0,out[i]);for(var j=0;j<16;j++)buf[i*16+j]=w[j];dqOf(out[i],dq,i*8);}
  return {bones:buf,dq:dq,head:M(R0,Sh),chest:M(R0,St),pelvis:M(R0,Sp),feet:feet,feetW:feet.map(function(p){return xf(R0,p)}),
    headPos:xf(M(R0,Sh),J.HC),pawL:xf(R0,feet[0]),pawR:xf(R0,feet[1]),shoulderMid:xf(M(R0,St),mix(J.FS[0],J.FS[1],0.5).slice(0,3)),R0:R0,Scb:St};
}
/* draw: skinned body + rigid head/chest parts + blinking eyes */
function uploadCat(E,c){return {skin:E.uploadSkin(c.mesh),head:E.upload(c.head),chest:E.upload(c.chest),eyes:[E.upload(c.eyes[0]),E.upload(c.eyes[1])],happy:[E.upload(c.happy[0]),E.upload(c.happy[1])],wink:[E.upload(c.wink[0]),E.upload(c.wink[1])],mouth:c.mouth.map(function(q){return E.upload(q)}),lip:E.upload(c.lip),pup:[E.upload(c.pup[0]),E.upload(c.pup[1])],tongue:E.upload(c.tongue),beans:[E.uploadSkin(c.beans[0]),E.uploadSkin(c.beans[1])]}}
/* e: eye shapes, m: mouth open, p: pupil [w,h] (cats: slit when calm, big & round when excited), s: eye size, b: tongue out, o/f: ears out/forward */
var EXPR={normal:{e:['open','open'],m:0,p:[0.62,1],s:1,b:0,o:0,f:0},smile:{e:['open','open'],m:0.45,p:[0.9,1.05],s:1.03,b:0,o:0.05,f:0.05},
  laugh:{e:['happy','happy'],m:1,p:[1,1],s:1,b:0,o:0.18,f:-0.12},wink:{e:['open','wink'],m:0.8,p:[1,1.1],s:1.02,b:0,o:0.12,f:0.1},
  bliss:{e:['happy','happy'],m:0.12,p:[1,1],s:1,b:0,o:0.15,f:-0.08},sparkle:{e:['open','open'],m:0.3,p:[1.2,1.2],s:1.05,b:0,o:-0.06,f:0.2},
  meow:{e:['open','open'],m:0.7,p:[1.15,1.15],s:1.04,b:0,o:0.05,f:0.12},
  blep:{e:['open','open'],m:0,p:[1.05,1.1],s:1.03,b:1,o:0.08,f:0.1}};
function expr(st,name,dt){var X=EXPR[name]||EXPR.normal,k=1-Math.pow(0.0005,dt),k2=1-Math.pow(0.004,dt);st.eye=X.e;st.mouth+=(X.m-st.mouth)*k;
  st.pup[0]+=(X.p[0]-st.pup[0])*k2;st.pup[1]+=(X.p[1]-st.pup[1])*k2;st.eyeS+=(X.s-st.eyeS)*k2;st.blep+=(X.b-st.blep)*k;st.earO+=(X.o-st.earO)*k2;st.earF+=(X.f-st.earF)*k2;}
/* fur quality steps down by itself when frames get slow (older phones) */
var FURQ=1,fpA=0,fpN=0;function setFurQ(q){FURQ=q}function getFurQ(){return FURQ}function furPerf(d){if(d>0.2)return;fpA+=d;if(++fpN>=45){if(fpA/fpN>0.03&&FURQ>0.45)FURQ-=0.2;fpA=0;fpN=0;}}
var NOFUR={n:0,len:0,den:0};
function drawCat(E,g,c,M0,st,t,tint){
  var r=poseCat(c,st,M0,t);E.drawSkin(g.skin,r.dq,r.R0,tint,{n:Math.max(3,Math.round(c.fur.n*FURQ)),len:c.fur.len,den:c.fur.den});E.draw(g.head,r.head,tint);E.draw(g.chest,r.chest,tint);
  E.drawSkin(g.beans[0],r.dq,r.R0,tint,NOFUR);E.drawSkin(g.beans[1],r.dq,r.R0,tint,NOFUR);
  if(st.blep>0.03){var tt=c.tongue.top;E.draw(g.tongue,M(r.head,T(tt),Sc(1,Math.min(1,st.blep),1),T(-tt[0],-tt[1],-tt[2])));}
  var b=Math.max(0.08,st.blink);for(var i=0;i<2;i++){var md=st.eye[i];if(md==='happy'||(b<0.2&&md==='open'&&st.mouth>0.4))E.draw(g.happy[i],r.head);else if(md==='wink')E.draw(g.wink[i],r.head);else{var ec=c.eyeC[i],es=st.eyeS,EM=M(r.head,T(ec),Sc(es,b*es,1),T(-ec[0],-ec[1],-ec[2]));E.draw(g.eyes[i],EM);E.draw(g.pup[i],M(EM,c.eyeF[i],Sc(st.pup[0],st.pup[1],1),c.eyeFi[i]));}}
  if(st.mouth>0.1)E.draw(g.mouth[Math.max(0,Math.min(4,Math.round(st.mouth*5)-1))],r.head);else E.draw(g.lip,r.head);
  return r;
}
/* solve pose heights so paws touch the ground with nearly straight legs */
function fitPoses(c){
  function shoulderY(P){var st=catState();for(var k in P)st[k]=Array.isArray(P[k])?P[k].slice():P[k];var J=c.J,S=c.S;
    var Sp=M(T(0,st.py*S,st.pz*S),RX(st.pitch),T(ng(J.P0))),St=M(Sp,T(J.L0),RX(st.cp*0.5),T(ng(J.L0)),T(J.T0),RX(st.cp*0.5-(st.pitch+st.cp)*0.95*(st.ts||0)),T(ng(J.T0)));return xf(St,J.FS[0])[1]}
  var reach=(c.La[0]+c.La[1])*0.96+c.J.FW[0][1],lo=-1.2,hi=0.2,P={};for(var k in CP.sit)P[k]=CP.sit[k];
  for(var i=0;i<30;i++){P.pitch=(lo+hi)/2;if(shoulderY(P)>reach+(P.sd||0)*c.S)lo=P.pitch;else hi=P.pitch;}
  var o={};for(k in CP)o[k]=CP[k];o.sit=P;
  var bg={};for(k in CP.beg)bg[k]=CP.beg[k];var hipY=(c.Lb[0]+c.Lb[1])*0.86+c.J.BA[0][1];bg.py=hipY/c.S+0.02;o.beg=bg;
  var ml={},mm={};for(k in bg){ml[k]=Array.isArray(bg[k])?bg[k].slice():bg[k];mm[k]=Array.isArray(bg[k])?bg[k].slice():bg[k];}
  ml.pitch=-1.38;ml.bG=1;ml.tailUp=-0.15;mm.pitch=-1.42;mm.bG=0;mm.brel=[0,-.21,.05];mm.py=bg.py+0.005;mm.tailUp=0.15;o.memeLand=ml;o.meme=mm;
  return o;
}

/* ================= the two cats ================= */
function blinkAt(t,off){var ph=(t+off)%4.1;return ph<0.14?Math.max(0.08,Math.abs(ph-0.07)/0.07):1}
function headLocal(p,S,hc){return [(p[0]-hc[0])/S,(p[1]-hc[1])/S,(p[2]-hc[2])/S]}
function nz3(x,y,z){return 0.022*(Math.sin(x*41+z*23)+Math.sin(y*37-z*29+1.3)+Math.sin(x*31-y*27+2.1))}
var CW=H('#fbf6f1'),CO=H('#f0a159'),CG=H('#8e7f7b'),CPK=H('#f6b3c1');
function S1(edge,x,w){return sm(edge-w,edge+w,x)}
function calicoColor(p,n,J,S,hc){
  var x=p[0]/S,y=p[1]/S,z=p[2]/S,h=headLocal(p,S,hc),hd=Math.sqrt(h[0]*h[0]+h[1]*h[1]+h[2]*h[2]),e=nz3(x,y,z),w=0.012,Hf=1+(hc[1]/S-0.6)/0.07;
  if(hd<0.2*Hf+0.04&&h[1]>-0.15*Hf){
    var c=CW,o=S1(0.01-e,-h[0],w)*S1(-0.01+e,h[1],w),g=S1(0.035+e,h[0],w)*S1(0.02+e,h[1],w);
    c=mix(c,CO,o);c=mix(c,CG,g);
    var blaze=(1-S1(0.028+e*0.6,Math.abs(h[0]),w))*S1(0.02,h[2],w)*(1-S1(0.09,h[1],w));c=mix(c,CW,blaze);
    c=mix(c,CW,(1-S1(-0.035,h[1],w))*S1(0.03,h[2],w));
    var ear=S1(0.07*Hf,Math.abs(h[0]),0.008)*S1(0.125*Hf,h[1],0.01)*S1(0.15,n[2],0.1);return mix(c,CPK,ear);}
  var c2=CW;
  if(z<-0.36&&y>0.26){var tw=S1(-0.4,-z,0.03);return mix(CW,Math.sin(-z*30+x*8)>0.15?CG:CO,tw);}
  var top=S1(0.335+e,y,0.02);
  c2=mix(c2,CO,top*(1-S1(0.15+e,Math.hypot((x+0.02)/1.15,z+0.04),0.02)));
  c2=mix(c2,CG,top*(1-S1(0.12+e,Math.hypot(x-0.03,z+0.3),0.02)));
  return c2;
}
var TO=H('#f4a057'),TD=H('#d5733a'),TC=H('#fff0dc'),TPK=H('#f7b2bf');
function tabbyColor(p,n,J,S,hc){
  var x=p[0]/S,y=p[1]/S,z=p[2]/S,h=headLocal(p,S,hc),hd=Math.sqrt(h[0]*h[0]+h[1]*h[1]+h[2]*h[2]),e=nz3(x,y,z)*0.6,c,Hf=1+(hc[1]/S-0.6)/0.07;
  if(hd<0.2*Hf+0.04&&h[1]>-0.15*Hf){
    c=TO;
    c=mix(c,TD,sm(0.35,0.75,Math.cos(h[0]*85/Hf))*S1(0.06*Hf,h[1],0.015)*S1(-0.04,h[2],0.02)*(1-S1(0.09*Hf,Math.abs(h[0]),0.01)));
    c=mix(c,TD,S1(0.13*Hf,Math.abs(h[0]),0.01)*S1(0,h[2],0.02)*sm(0.3,0.7,Math.sin(h[1]*110/Hf+1))*(1-S1(0.03*Hf,h[1],0.01))*S1(-0.07*Hf,h[1],0.01));
    c=mix(c,TC,(1-S1(-0.035*Hf,h[1],0.015))*S1(0.05*Hf,h[2],0.02));
    return mix(c,TPK,S1(0.075*Hf,Math.abs(h[0]),0.008)*S1(0.13*Hf,h[1],0.01)*S1(0.15,n[2],0.1));}
  if(z<-0.36&&y>0.26){var tz=-z;return mix(TO,TD,Math.max(S1(0.8,tz,0.02),sm(0.15,0.5,Math.sin(tz*36))));}
  c=TO;
  c=mix(c,TD,S1(0.3,y,0.02)*sm(0.3,0.6,Math.sin(z*40+Math.sin(x*22)*1.3+e*30)));
  c=mix(c,TD,(1-S1(0.3,y,0.02))*sm(0.5,0.8,Math.sin(y*62+e*20))*(1-sm(0.6,0.8,Math.abs(n[1]))));
  var cream=Math.max(1-S1(0.08,y,0.012),sm(-0.25,-0.5,n[1])*(1-S1(0.36,y,0.02)),S1(0.2,z,0.02)*(1-S1(0.43,y,0.02))*S1(0.12,y,0.02)*(1-S1(0.1+e,Math.abs(x),0.02)));
  return mix(c,TC,cream);
}
var KITTEN=null,KPOSE=null,MAINCAT=null,MPOSE=null;
function buildCats(){
  if(KITTEN)return;
  KITTEN=buildCat({S:1.25,fat:1,head:1.42,leg:1,tail:1,cell:0.0155,color:calicoColor,iris:[H('#7fb7ea'),H('#1d2f60')],nose:H('#f39cb1'),lip:H('#7e4f57'),whisker:H('#cfc3be'),blush:H('#ffa3ba'),eyeK:1.12,shells:9,furLen:.021,furDen:150,
    extraHead:function(m,k){var b=k.onS([0.42,0.82,0.15]),F=M(T(b.p),k.frameZ(b.n),RZ(0.4));
      m.surf(ell(k.r(.032),k.r(.02),k.r(.012)),10,12,H('#ff8fae'),M(F,T(-k.r(.028),0,k.r(.006)),RZ(0.3)));
      m.surf(ell(k.r(.032),k.r(.02),k.r(.012)),10,12,H('#ff8fae'),M(F,T(k.r(.028),0,k.r(.006)),RZ(-0.3)));
      m.surf(ell(k.r(.012),k.r(.012),k.r(.012)),8,8,H('#ffb3c6'),M(F,T(0,0,k.r(.01))));}});
  KPOSE=fitPoses(KITTEN);
  MAINCAT=buildCat({S:3.0,fat:1.4,head:1.48,leg:1.15,tail:1.25,cell:0.0125,color:tabbyColor,iris:[H('#b4733e'),H('#2c150e')],nose:H('#ee8fa2'),lip:H('#5e3138'),whisker:H('#fbf3ec'),blush:H('#ff97b0'),eyeK:1.08,shells:11,furLen:.02,furDen:230,
    extraHead:function(m,k){var b=k.onS([0.18,1,-0.12]),HT=M(alignY(sub(b.p,scl(b.n,k.r(.02))),add(b.n,[0.18,0,0]),1));
      m.surf(lathe(function(u){return [k.r(.085)*(1-u),k.r(.2)*u]}),24,36,function(u,v){return (Math.floor(u*7+v*5)%2)?H('#ff9fbd'):H('#fff1b8')},HT);
      m.surf(ell(k.r(.03),k.r(.03),k.r(.03)),10,12,H('#ffffff'),M(HT,T(0,k.r(.205),0)));
      m.surf(tube(function(u){var a=u*TAU;return [k.r(.085)*Math.cos(a),k.r(.006),k.r(.085)*Math.sin(a)]},cst(k.r(.011)),48),64,8,H('#ffffff'),HT);},
    extraChest:function(m,k){var h=k.D.hit(k.J.N0,nrm([0,-0.45,1]),k.r(0.4)),F=M(T(h.p),k.frameZ(h.n));
      m.surf(ell(k.r(.045),k.r(.026),k.r(.016)),10,12,H('#ff8fae'),M(F,T(-k.r(.04),0,k.r(.008)),RZ(-0.25)));
      m.surf(ell(k.r(.045),k.r(.026),k.r(.016)),10,12,H('#ff8fae'),M(F,T(k.r(.04),0,k.r(.008)),RZ(0.25)));
      m.surf(ell(k.r(.016),k.r(.016),k.r(.016)),8,8,H('#ffc1d0'),M(F,T(0,0,k.r(.014))));}});
  MPOSE=fitPoses(MAINCAT);
}

/* phased natural hop (from the card) */
function jumpPose(P,ph){var c=P.crouch,o={},k;function cp(src){for(k in src)o[k]=Array.isArray(src[k])?src[k].slice():src[k]}
  if(ph<0.18||ph>=0.84){cp(c);return o}cp(P.hop);
  var a=(ph-0.18)/0.66;function V(x,y,t){return [x[0]+(y[0]-x[0])*t,x[1]+(y[1]-x[1])*t,x[2]+(y[2]-x[2])*t]}
  o.pitch=a<0.3?lerp(-0.42,-0.15,a/0.3):lerp(-0.15,0.1,(a-0.3)/0.7);o.cp=o.pitch*0.2;o.fG=0;o.bG=0;
  o.frel=V([0,-.13,.13],[0,-.23,.06],sm(0.55,0.95,a));
  o.brel=a<0.35?V([0,-.25,-.11],[0,-.15,.05],a/0.35):V([0,-.15,.05],[0,-.22,.02],sm(0.6,1,a));
  o.tailUp=lerp(0.5,0.15,a);return o}
G.CAT3D={PI:PI,TAU:TAU,I4:I4,mul:mul,M:M,T:T,Sc:Sc,RX:RX,RY:RY,RZ:RZ,persp:persp,ortho:ortho,lookAt:lookAt,xf:xf,xf4:xf4,sub:sub,add:add,scl:scl,cross:cross,dot:dot,len3:len3,nrm:nrm,
  alignY:alignY,sm:sm,lerp:lerp,mix:mix,H:H,ease:ease,rnd:rnd,Mesh:Mesh,ell:ell,poly:poly,lathe:lathe,sEll:sEll,bez:bez,capR:capR,cst:cst,tube:tube,polyCurve:polyCurve,heart2:heart2,heart3:heart3,
  rotAxis:rotAxis,rv:rv,makeEngine:makeEngine,buildCat:buildCat,poseCat:poseCat,drawCat:drawCat,uploadCat:uploadCat,catState:catState,toCP:toCP,CP:CP,EXPR:EXPR,expr:expr,fitPoses:fitPoses,
  blinkAt:blinkAt,headLocal:headLocal,nz3:nz3,S1:S1,tabbyColor:tabbyColor,calicoColor:calicoColor,jumpPose:jumpPose,setFurQ:setFurQ,getFurQ:getFurQ,furPerf:furPerf,NOFUR:NOFUR,BONES:BONES};
})(typeof self!=='undefined'?self:this);
