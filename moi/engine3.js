/* Lớp vẽ three.js cho Mèo Nhà Mình.
   Nhận đúng các lệnh vẽ mà game.js / cat3d.js / blendercat.js đang gọi (upload, draw, drawSkin, sprite...)
   nhưng vẽ bằng three.js: chất liệu vật lý (PBR), ánh nắng có bóng mềm, phản chiếu môi trường,
   che sáng môi trường (GTAO), bloom nhẹ và tone mapping ACES.
   Cần window.THREE và window.THREE_ADDONS (index.html nạp sẵn). Không có thì game dùng engine cũ. */
(function (G) {
  var THREE = G.THREE, AD = G.THREE_ADDONS;
  if (!THREE || !AD) return;

  function lin(c) { return Math.pow(Math.max(0, c), 2.2); }

  /* ---------- đoạn shader dùng chung ---------- */
  var NOISE = [
    'float hsh(vec3 p){p=fract(p*0.3183099+0.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}',
    'float vn(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hsh(i),hsh(i+vec3(1.,0.,0.)),f.x),mix(hsh(i+vec3(0.,1.,0.)),hsh(i+vec3(1.,1.,0.)),f.x),f.y),',
    'mix(mix(hsh(i+vec3(0.,0.,1.)),hsh(i+vec3(1.,0.,1.)),f.x),mix(hsh(i+vec3(0.,1.,1.)),hsh(i+vec3(1.,1.,1.)),f.x),f.y),f.z);}',
    'float fbm(vec3 p){return vn(p)*0.55+vn(p*2.03+3.1)*0.3+vn(p*4.11+7.7)*0.15;}',
    'vec3 nzv(vec3 p){return vec3(vn(p),vn(p+5.2),vn(p+9.7))-0.5;}'
  ].join('\n');

  /* chi tiết bề mặt theo "kind" của engine cũ: 1 gỗ, 2 vải, 3 nhám (carton, cát, gốm thô), 4 sứ, 5 lá, 6 mắt, 7 tường, 8 nước/bóng */
  var KIND_FRAG = [
    'float rMod=1.;float kd=floor(vMat.y+.5);vec3 bmp=vec3(0.);float envK=kd>5.5&&kd<6.5?0.1:kd>7.5?0.9:1.;',
    'if(kd>0.5&&kd<1.5){float g=fbm(vec3(vWp.x*1.3,vWp.y*34.,vWp.z*34.));float fine=vn(vWp*vec3(3.,160.,160.));diffuseColor.rgb*=(0.8+0.34*g)*(0.95+0.1*fine);rMod=mix(1.2,0.78,g);bmp=nzv(vWp*vec3(4.,90.,90.))*0.06;}',
    'else if(kd<2.5){float w=sin(vWp.x*260.)*sin(vWp.z*260.+vWp.y*260.);float fz=vn(vWp*70.);diffuseColor.rgb*=0.86+0.08*w*w+0.16*fz;bmp=nzv(vWp*170.)*0.45;rMod=1.05;}',
    'else if(kd<3.5){float fz=fbm(vWp*36.);diffuseColor.rgb*=0.84+0.28*fz;bmp=nzv(vWp*60.)*0.18;}',
    'else if(kd<4.5){diffuseColor.rgb*=0.97+0.05*vn(vWp*24.);}',
    'else if(kd<5.5){diffuseColor.rgb*=0.78+0.34*fbm(vWp*14.);bmp=nzv(vWp*40.)*0.14;}',
    'else if(kd>6.5&&kd<7.5){diffuseColor.rgb*=0.95+0.07*fbm(vWp*2.6)+0.03*vn(vWp*110.);bmp=nzv(vWp*80.)*0.05;}'
  ].join('\n');

  function sceneMaterial(variant, map) {
    /* engine cũ không loại mặt sau: nhiều lưới (thảm, rèm...) quay mặt sau lên trên */
    var m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, map: map || null, side: THREE.DoubleSide });
    if (variant === 'eye') m.envMapIntensity = 0.1; /* phòng mẫu RoomEnvironment rất sáng và xanh: phản chiếu mạnh làm mắt đục */
    if (variant === 'glass') m.envMapIntensity = 0.9; /* mũi, lưỡi, nước: ướt bóng */
    var U = { uTint: { value: new THREE.Vector3(1, 1, 1) }, uGlowK: { value: 1.3 } };
    m.userData.U = U;
    m.onBeforeCompile = function (sh) {
      sh.uniforms.uTint = U.uTint; sh.uniforms.uGlowK = U.uGlowK;
      sh.vertexShader = 'attribute vec2 aMat;attribute float aGlow;varying vec2 vMat;varying float vGlow;varying vec3 vWp;\n' +
        sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvMat=aMat;vGlow=aGlow;vWp=(modelMatrix*vec4(transformed,1.)).xyz;');
      sh.fragmentShader = 'uniform vec3 uTint;uniform float uGlowK;varying vec2 vMat;varying float vGlow;varying vec3 vWp;\n' + NOISE + '\n' +
        sh.fragmentShader
          .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb*=uTint;\n' + KIND_FRAG + '\nvec3 albK=diffuseColor.rgb;diffuseColor.rgb*=1.-vGlow;')
          .replace('#include <roughnessmap_fragment>', 'float roughnessFactor=clamp(vMat.x*rMod,0.04,1.);')
          .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal=normalize(normal+mat3(viewMatrix)*bmp*2.);')
          .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance+=albK*vGlow*uGlowK;')
          .replace('#include <lights_fragment_maps>', '#include <lights_fragment_maps>\n#if defined( RE_IndirectSpecular )\nradiance*=envK;\n#endif');
    };
    m.customProgramCacheKey = function () { return 'scene3'; };
    return m;
  }

  /* ---------- da mèo: skinning dual-quaternion + lông nhiều lớp (vỏ), giống shader cũ ---------- */
  var SKIN_VS_HEAD = [
    'attribute vec4 aB;attribute vec4 aW;attribute vec4 aC;attribute float aBR;',
    'uniform vec4 uQ[80];uniform float uSh,uFL,uFloor,uBreath;',
    'varying vec3 vR;varying vec4 vCol;varying float vF,vSh;varying vec3 vWp;',
    'void dqBlend(out vec4 q,out vec4 d){int i0=int(aB.x+0.5),i1=int(aB.y+0.5),i2=int(aB.z+0.5),i3=int(aB.w+0.5);',
    ' vec4 r0=uQ[i0*2],rk;q=r0*aW.x;d=uQ[i0*2+1]*aW.x;',
    ' rk=uQ[i1*2];float sg=dot(r0,rk)<0.?-aW.y:aW.y;q+=rk*sg;d+=uQ[i1*2+1]*sg;',
    ' rk=uQ[i2*2];sg=dot(r0,rk)<0.?-aW.z:aW.z;q+=rk*sg;d+=uQ[i2*2+1]*sg;',
    ' rk=uQ[i3*2];sg=dot(r0,rk)<0.?-aW.w:aW.w;q+=rk*sg;d+=uQ[i3*2+1]*sg;',
    ' float l=length(q);q/=l;d/=l;}',
    'vec3 dqP(vec4 q,vec4 d,vec3 p){return p+2.*cross(q.xyz,cross(q.xyz,p)+q.w*p)+2.*(q.w*d.xyz-d.w*q.xyz+cross(q.xyz,d.xyz));}',
    'vec3 dqN(vec4 q,vec3 n){return n+2.*cross(q.xyz,cross(q.xyz,n)+q.w*n);}'
  ].join('\n');
  var SKIN_BEGIN = [
    'vec4 bq,bd;dqBlend(bq,bd);',
    'vec3 pp=position+normal*uBreath*aBR+(normal*uSh*0.9+vec3(0.,-0.36,-0.48)*uSh*uSh*0.85)*(uFL*aC.a);',
    'vec3 transformed=dqP(bq,bd,pp);',
    /* thịt mềm chạm mặt đang nằm/đứng thì bẹp xuống, không bao giờ xuyên qua */
    'vec4 fw=modelMatrix*vec4(transformed,1.);float fh=fw.y-uFloor;',
    'if(fh<0.025){fw.y=uFloor+0.025*exp(fh/0.025-1.);transformed=transpose(mat3(modelMatrix))*(fw.xyz-modelMatrix[3].xyz);}',
    'vR=position;vF=aC.a;vSh=uSh;vCol=aC;vWp=fw.xyz;'
  ].join('\n');

  function skinMaterial(U, shell) {
    var m = new THREE.MeshStandardMaterial({ roughness: 0.88, metalness: 0 });
    m.envMapIntensity = 0.5;
    if (shell) { m.transparent = true; m.depthWrite = false; m.premultipliedAlpha = true; }
    var my = { uSh: { value: 0 }, uBl: { value: shell ? 1 : 0 } };
    m.userData.my = my;
    m.onBeforeCompile = function (sh) {
      ['uQ', 'uFloor', 'uFL', 'uFD', 'uTint', 'uLv', 'uSunW', 'uBreath'].forEach(function (k) { sh.uniforms[k] = U[k]; });
      sh.uniforms.uSh = my.uSh; sh.uniforms.uBl = my.uBl;
      sh.vertexShader = SKIN_VS_HEAD + '\n' + sh.vertexShader
        .replace('#include <beginnormal_vertex>', 'vec4 nq,nd;dqBlend(nq,nd);vec3 objectNormal=dqN(nq,normal);')
        .replace('#include <begin_vertex>', SKIN_BEGIN);
      sh.fragmentShader = [
        'uniform float uFD,uBl,uSh;uniform vec3 uTint,uLv,uSunW;varying vec3 vR;varying vec4 vCol;varying float vF,vSh;varying vec3 vWp;', NOISE
      ].join('\n') + '\n' + sh.fragmentShader
        .replace('#include <color_fragment>', [
          'vec3 b=vCol.rgb*uTint;float fl=0.,occ=1.,A=1.;',
          'if(uFD>0.){vec3 ca=vec3(0.,-0.6,-0.8),cb=vec3(1.,0.,0.),cc=vec3(0.,0.8,-0.6);',
          ' vec3 q=vec3(dot(vR,ca)*0.2,dot(vR,cb),dot(vR,cc))*uFD;vec3 fc=fract(q)-0.5;fc.x*=0.25;float hs=hsh(floor(q));fl=smoothstep(0.02,0.14,vF);',
          ' if(vSh>0.001&&length(fwidth(vWp))>2.6*length(fwidth(vR))+1e-5)discard;',
          ' if(vSh>0.001){if(fl<=0.)discard;float ln=mix(0.55,1.,hs)*(1.-dot(fc,fc)*1.6);A=smoothstep(-0.03,0.22,ln-vSh)*(1.-0.4*vSh);if(uBl<0.5&&A<0.45)discard;if(A<0.004)discard;}',
          ' float h2=hsh(floor(vec3(dot(vR,ca)*0.08,dot(vR,cb),dot(vR,cc))*uFD*0.45)+7.);float lum=dot(b,vec3(0.3,0.59,0.11));',
          ' b*=mix(1.,mix(mix(0.8,0.9,smoothstep(0.55,0.9,lum)),1.04,vSh),fl)*(1.+((hs-0.5)*0.03+(h2-0.5)*0.07)*fl);',
          ' occ=mix(1.,mix(mix(0.72,0.86,smoothstep(0.55,0.9,lum)),1.,vSh),fl);}',
          'diffuseColor=vec4(pow(max(b,0.),vec3(2.2)),A);'
        ].join('\n'))
        .replace('#include <lights_fragment_end>', [
          '#include <lights_fragment_end>',
          /* lông tán sáng: phần tối vẫn được ánh sáng vòng qua (wrap), gốc lông bị lớp trên che */
          'float dl=dot(normal,uLv);float wrapK=max(0.,clamp((dl+0.45)/1.45,0.,1.)-max(dl,0.));',
          'reflectedLight.directDiffuse+=diffuseColor.rgb*uSunW*wrapK*0.55*RECIPROCAL_PI*mix(1.,0.6,fl);',
          'reflectedLight.indirectDiffuse*=occ;reflectedLight.directDiffuse*=mix(1.,occ,0.6);'
        ].join('\n'));
    };
    m.customProgramCacheKey = function () { return 'skin3' + (shell ? 's' : 'b'); };
    return m;
  }
  function skinDepthMaterial(U) {
    var m = new THREE.MeshDepthMaterial();
    m.onBeforeCompile = function (sh) {
      ['uQ', 'uFloor', 'uFL', 'uBreath'].forEach(function (k) { sh.uniforms[k] = U[k]; });
      sh.uniforms.uSh = { value: 0 };
      sh.vertexShader = SKIN_VS_HEAD + '\n' + sh.vertexShader.replace('#include <begin_vertex>', SKIN_BEGIN);
    };
    m.customProgramCacheKey = function () { return 'skin3d'; };
    return m;
  }

  /* ---------- đốm mềm (bóng tiếp xúc, ánh đèn, tia laser, bụi nắng) ---------- */
  var SPRITE_VS = 'uniform vec3 uCtr,uR,uU;uniform vec2 uSz;uniform float uBill;varying vec2 vQ;' +
    'void main(){vQ=position.xy;vec3 p=uBill>0.5?uCtr+uR*position.x*uSz.x+uU*position.y*uSz.y:uCtr+vec3(position.x*uSz.x,0.,position.y*uSz.y);gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);}';
  var SPRITE_FS = 'varying vec2 vQ;uniform vec4 uCol;uniform float uPow;void main(){float r=length(vQ);float a=pow(max(0.,1.-r),uPow)*uCol.a;gl_FragColor=vec4(pow(uCol.rgb,vec3(2.2))*a,a);}';

  G.makeEngine3 = function (cv) {
    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: false, alpha: true, powerPreference: 'high-performance' });
    } catch (e) { console.error('[three] ' + e); return null; }
    var gl = renderer.getContext();
    renderer.setPixelRatio(1);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(40, 1, 0.35, 90);
    camera.matrixAutoUpdate = false;
    var pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new AD.RoomEnvironment(), 0.04).texture;

    var sun = new THREE.DirectionalLight(0xffffff, 1);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    var sc = sun.shadow.camera; sc.left = -11.5; sc.right = 11.5; sc.top = 11.5; sc.bottom = -11.5; sc.near = 4; sc.far = 50;
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.025; sun.shadow.radius = 3;
    sun.target.position.set(0, 1.5, -0.5);
    scene.add(sun, sun.target);
    var hemi = new THREE.HemisphereLight(0xffffff, 0xffffff, 1);
    scene.add(hemi);
    var lamp = new THREE.PointLight(0xffd0a0, 0, 0, 1.25);
    scene.add(lamp);

    /* hậu kỳ: ảnh HDR đa mẫu (khử răng cưa) có depth -> GTAO lấy depth đó -> bloom nhẹ -> tone mapping + sRGB */
    var rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4, depthTexture: new THREE.DepthTexture(4, 4) });
    var composer = new AD.EffectComposer(renderer, rt);
    var renderPass = new AD.RenderPass(scene, camera);
    var gtao = new AD.GTAOPass(scene, camera, 4, 4, { depthTexture: composer.renderTarget1.depthTexture });
    gtao.blendIntensity = 0.85;
    gtao.updateGtaoMaterial({ radius: 0.55, distanceExponent: 1.2, thickness: 1.2, scale: 1.0, samples: 12 });
    /* bộ đệm đọc/ghi đổi chỗ mỗi khung: trỏ GTAO vào depth của bộ đệm vừa vẽ cảnh */
    var depthHook = new AD.RenderPass(scene, camera); /* chỉ để lấy lớp Pass; render bị thay bên dưới */
    depthHook.needsSwap = false;
    depthHook.render = function (r, w, read) {
      var d = read.depthTexture;
      gtao.gtaoMaterial.uniforms.tDepth.value = d; gtao.pdMaterial.uniforms.tDepth.value = d;
      if (gtao.depthRenderMaterial) gtao.depthRenderMaterial.uniforms.tDepth.value = d;
    };
    var bloom = new AD.UnrealBloomPass(new THREE.Vector2(4, 4), 0.16, 0.45, 0.92);
    composer.addPass(renderPass); composer.addPass(depthHook); composer.addPass(gtao); composer.addPass(bloom); composer.addPass(new AD.OutputPass());

    var POST = { on: true, ao: true, bloom: true }, PROJ = { fov: 0.7, asp: 1, near: 0.35, far: 90 };
    var W = 0, H = 0, mode = 'main', shadowOn = false;
    var pool = [], used = 0, uploads = [], spPool = [], spUsed = 0, spCam = { r: new THREE.Vector3(), u: new THREE.Vector3() };
    var tmpM = new THREE.Matrix4(), BLANK_POS = new Float32Array(9);

    function attr(arr, n, Ty) { return new THREE.BufferAttribute(arr instanceof (Ty || Float32Array) ? arr : new (Ty || Float32Array)(arr), n); }
    function indexAttr(I, nv) { var Ty = nv > 65535 ? Uint32Array : Uint16Array; return new THREE.BufferAttribute(I instanceof Ty ? I : new Ty(I), 1); }

    function meshFrom(pool, i, make) { var o = pool[i]; if (!o) { o = pool[i] = make(); scene.add(o); } o.visible = true; return o; }
    function plainMesh() {
      var o = new THREE.Mesh(new THREE.BufferGeometry(), undefined);
      o.matrixAutoUpdate = false; o.frustumCulled = false; o.receiveShadow = true;
      o.onBeforeRender = function () { var t = this.userData.tint, U = this.material.userData.U; if (U) U.uTint.value.set(t[0], t[1], t[2]); };
      o.userData.tint = [1, 1, 1];
      return o;
    }

    var E = {
      gl: gl, ok: true, three: true, renderer: renderer, uploads: uploads, sun: sun, hemi: hemi, lamp: lamp, gtao: gtao, bloom: bloom, scene: scene, camera: camera, floorY: -100, VP: null,
      /* hệ số ánh sáng (chỉnh tay theo ảnh chụp) */
      tune: { sun: 1.3, hemi: 0.9, lamp: 9, env: 0.25, exp: 1.0 },
      initShadow: function (size) { sun.shadow.mapSize.set(size, size); return true; },
      setPost: function (o) { for (var k in o) POST[k] = o[k]; return POST.on; },
      postOn: function () { return POST.on; },
      setProj: function (near, far, fovY, asp) { PROJ = { fov: fovY, asp: asp, near: near, far: far }; },
      dbg: function () { return { POST: POST, calls: renderer.info.render.calls, tris: renderer.info.render.triangles, used: used }; },

      upload: function (m) {
        var nv = m.P.length / 3, g = new THREE.BufferGeometry(), C = m.C, col = new Float32Array(nv * 3), glow = new Float32Array(nv);
        var kinds = {}, R = m.R && m.R.length ? m.R : null, mat = new Float32Array(nv * 2);
        for (var i = 0; i < nv; i++) {
          col[i * 3] = lin(C[i * 4]); col[i * 3 + 1] = lin(C[i * 4 + 1]); col[i * 3 + 2] = lin(C[i * 4 + 2]); glow[i] = C[i * 4 + 3] || 0;
          var r = R ? R[i * 2] : 0.8, k = R ? R[i * 2 + 1] : 0; mat[i * 2] = r; mat[i * 2 + 1] = k; kinds[k] = (kinds[k] || 0) + 1;
        }
        g.setAttribute('position', attr(m.P, 3)); g.setAttribute('normal', attr(m.N, 3)); g.setAttribute('color', attr(col, 3));
        g.setAttribute('aGlow', attr(glow, 1)); g.setAttribute('aMat', attr(mat, 2));
        g.setAttribute('uv', attr(m.UV && m.UV.length ? m.UV : new Float32Array(nv * 2), 2));
        g.setIndex(indexAttr(m.I, nv));
        g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4); /* vài lưới miệng có đỉnh NaN (tam giác suy biến, không hiện) */
        var top = Object.keys(kinds).sort(function (a, b) { return kinds[b] - kinds[a]; })[0];
        var h = { geo: g, variant: top === '6' ? 'eye' : top === '8' ? 'glass' : '', mats: {}, n: 0, cast: false, cnt: m.I.length };
        uploads.push(h);
        return h;
      },
      /* đổi toạ độ đỉnh của lưới đã nạp (cùng số đỉnh): miệng, đồng tử biến hình liên tục */
      setVerts: function (g, P) { var a = g.geo.attributes.position; a.array.set(P); a.needsUpdate = true; },
      uploadSkin: function (m) {
        var nv = m.P.length / 3, g = new THREE.BufferGeometry();
        g.setAttribute('position', attr(m.P, 3)); g.setAttribute('normal', attr(m.N, 3)); g.setAttribute('aC', attr(m.C, 4));
        g.setAttribute('aB', attr(m.B, 4)); g.setAttribute('aW', attr(m.W, 4)); g.setIndex(indexAttr(m.I, nv));
        g.setAttribute('aBR', attr(m.BR && m.BR.length === nv ? m.BR : new Float32Array(nv), 1)); /* vùng phập phồng khi thở */
        var U = { uQ: { value: new Float32Array(320) }, uFloor: { value: -100 }, uBreath: { value: 0 }, uFL: { value: 0 }, uFD: { value: 0 }, uTint: { value: new THREE.Vector3(1, 1, 1) },
          uLv: { value: new THREE.Vector3(0, 1, 0) }, uSunW: { value: new THREE.Vector3() } };
        var base = new THREE.Mesh(g, skinMaterial(U, false));
        base.matrixAutoUpdate = false; base.frustumCulled = false; base.castShadow = true; base.receiveShadow = true;
        base.customDepthMaterial = skinDepthMaterial(U);
        scene.add(base);
        var h = { skin: true, geo: g, U: U, base: base, shells: [], used: false, cnt: m.I.length };
        uploads.push(h);
        return h;
      },
      texture: function (canvas) { var t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy(); return t; },
      setTex: function (t, canvas) { t.image = canvas; t.needsUpdate = true; },
      repeat: function (t) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.needsUpdate = true; },

      /* lượt bóng của game cũ: chỉ dùng để biết vật nào đổ bóng */
      shadowBegin: function () { mode = 'shadow'; return true; },
      drawD: function (g) { g.cast = true; },
      drawSkinD: function () {},
      shadowEnd: function () { mode = 'main'; },

      begin: function (w, h, VP, eye, L, fog, env) {
        env = env || {};
        if (w !== W || h !== H) { W = w; H = h; renderer.setSize(w, h, false); composer.setSize(w, h); gtao.setSize(w, h); }
        E.VP = VP;
        camera.fov = PROJ.fov * 180 / Math.PI; camera.aspect = PROJ.asp; camera.near = PROJ.near; camera.far = PROJ.far; camera.updateProjectionMatrix();
        if (env.view) { camera.matrix.fromArray(env.view).invert(); camera.matrixWorldNeedsUpdate = true; camera.updateMatrixWorld(true); }
        var K = env.k || [2.6, 1, 1.6, 1.4], sc = env.sun || [1, 0.96, 0.9], a0 = env.amb0 || [1, 0.85, 0.86], a1 = env.amb1 || [0.98, 0.97, 1];
        shadowOn = env.shadow !== false;
        sun.position.set(sun.target.position.x + L[0] * 30, sun.target.position.y + L[1] * 30, sun.target.position.z + L[2] * 30);
        var TU = E.tune;
        sun.color.setRGB(sc[0], sc[1], sc[2]); sun.intensity = K[0] * Math.PI * TU.sun; sun.castShadow = shadowOn;
        hemi.color.setRGB(lin(a1[0]), lin(a1[1]), lin(a1[2])); hemi.groundColor.setRGB(lin(a0[0]), lin(a0[1]), lin(a0[2])); hemi.intensity = K[1] * TU.hemi;
        var lc = env.lampC || [0, 0, 0], lp = env.lampP || [0, 50, 0], lm = Math.max(lc[0], lc[1], lc[2]);
        lamp.position.set(lp[0], lp[1], lp[2]); lamp.intensity = lm * K[2] * TU.lamp; if (lm > 0) lamp.color.setRGB(lc[0] / lm, lc[1] / lm, lc[2] / lm);
        scene.environmentIntensity = TU.env * K[1];
        renderer.toneMappingExposure = (env.exp || 1) * TU.exp;
        uploads.forEach(function (u) { u.n = 0; if (u.skin) u.used = false; });
        used = 0; spUsed = 0; mode = 'main';
        E._lw = new THREE.Vector3(L[0], L[1], L[2]); E._sunW = new THREE.Vector3(sc[0], sc[1], sc[2]).multiplyScalar(K[0] * Math.PI * 0.85);
      },
      draw: function (g, m, tint, tex) {
        if (mode !== 'main') return;
        var key = (tex ? tex.id : 0) + ':' + g.n++, mat = g.mats[key];
        if (!mat) mat = g.mats[key] = sceneMaterial(g.variant, tex || null);
        var o = meshFrom(pool, used++, plainMesh);
        o.geometry = g.geo; o.material = mat; o.castShadow = g.cast && shadowOn;
        o.matrix.fromArray(m); o.matrixWorldNeedsUpdate = true;
        var t = o.userData.tint; t[0] = tint ? lin(tint[0]) : 1; t[1] = tint ? lin(tint[1]) : 1; t[2] = tint ? lin(tint[2]) : 1;
      },
      drawSkin: function (g, dq, R0, tint, fur) {
        var U = g.U;
        U.uQ.value.set(dq.length > 320 ? dq.subarray(0, 320) : dq);
        U.uFloor.value = E.floorY; U.uBreath.value = E.breath || 0; U.uFL.value = fur ? fur.len : 0; U.uFD.value = fur ? fur.den : 0;
        U.uTint.value.set(tint ? tint[0] : 1, tint ? tint[1] : 1, tint ? tint[2] : 1);
        U.uLv.value.copy(E._lw).transformDirection(camera.matrixWorldInverse); U.uSunW.value.copy(E._sunW);
        tmpM.fromArray(R0);
        g.base.matrix.copy(tmpM); g.base.matrixWorldNeedsUpdate = true; g.base.visible = true; g.base.castShadow = shadowOn; g.used = true;
        var ns = fur ? fur.n : 0;
        for (var k = 0; k < Math.max(ns, g.shells.length); k++) {
          var s = g.shells[k];
          if (k >= ns) { if (s) s.visible = false; continue; }
          if (!s) {
            s = g.shells[k] = new THREE.Mesh(g.geo, skinMaterial(U, true));
            s.matrixAutoUpdate = false; s.frustumCulled = false; s.renderOrder = 10 + k; scene.add(s);
          }
          s.material.userData.my.uSh.value = (k + 1) / ns;
          s.matrix.copy(tmpM); s.matrixWorldNeedsUpdate = true; s.visible = true; s.renderOrder = 10 + k;
        }
      },
      sprites: function (camR, camU) { spCam.r.set(camR[0], camR[1], camR[2]); spCam.u.set(camU[0], camU[1], camU[2]); },
      sprite: function (ctr, sz, col, pw, bill, additive) {
        var o = meshFrom(spPool, spUsed++, function () {
          var mt = new THREE.ShaderMaterial({ vertexShader: SPRITE_VS, fragmentShader: SPRITE_FS, transparent: true, depthWrite: false,
            uniforms: { uCtr: { value: new THREE.Vector3() }, uR: { value: new THREE.Vector3() }, uU: { value: new THREE.Vector3() }, uSz: { value: new THREE.Vector2() },
              uBill: { value: 0 }, uCol: { value: new THREE.Vector4() }, uPow: { value: 1 } },
            blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor });
          var q = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mt); q.frustumCulled = false; q.renderOrder = 100; return q;
        });
        var u = o.material.uniforms;
        u.uCtr.value.set(ctr[0], ctr[1], ctr[2]); u.uSz.value.set(sz[0], sz[1]); u.uR.value.copy(spCam.r); u.uU.value.copy(spCam.u);
        u.uBill.value = bill ? 1 : 0; u.uPow.value = pw;
        /* bóng tiếp xúc giả (đốm tối trên sàn) nhẹ đi vì giờ đã có bóng và AO thật */
        var a = col[3] * (!bill && !additive && shadowOn ? 0.55 : 1);
        u.uCol.value.set(col[0], col[1], col[2], a);
        o.material.blendDst = additive ? THREE.OneFactor : THREE.OneMinusSrcAlphaFactor;
      },
      end: function () {
        for (var i = used; i < pool.length; i++) pool[i].visible = false;
        for (i = spUsed; i < spPool.length; i++) spPool[i].visible = false;
        uploads.forEach(function (u) { if (u.skin && !u.used) { u.base.visible = false; u.shells.forEach(function (s) { s.visible = false; }); } });
        if (POST.on) {
          gtao.enabled = !!POST.ao; bloom.enabled = POST.bloom !== false;
          composer.render();
        } else renderer.render(scene, camera);
      }
    };
    cv.addEventListener('webglcontextlost', function (e) { e.preventDefault(); }, false);
    return E;
  };
})(window);
