/* Bé mèo thứ hai: dựng trong Blender (tools/blender/), xuất ra meo-blender.bin.
   Có xương và các clip chuyển động nướng sẵn; lông nhiều lớp do engine của game đắp lên.
   Tự đi lại, đứng, ngồi; né đồ đạc và nhường đường cho bé mèo chính. */
(function (G) {
  var C = G.CAT3D, T = C.T, RX = C.RX, RY = C.RY, M = C.M, xf = C.xf, sm = C.sm;
  /* gốc xương lúc nghỉ, hệ game (Blender (x,y,z) -> 0.2*(x, z, -(y-0.12))), lấy từ tools/blender/meo.py */
  function gp(x, y, z) { return [x * 0.2, z * 0.2, -(y - 0.12) * 0.2]; }
  var EAR_ROOT = { 'ear.L': gp(0.43, -1.42, 3.62), 'ear.R': gp(-0.43, -1.42, 3.62) };
  var TAIL_HEADS = (function () {
    var tp = [[0, 1.65, 2.14], [0, 2.18, 2.34], [0, 2.58, 2.62], [0, 2.86, 3.02], [0, 2.94, 3.48], [0, 2.82, 3.90], [0, 2.56, 4.18]], out = [];
    for (var i = 0; i < tp.length - 1; i++) { out.push(tp[i]); out.push([0, (tp[i][1] + tp[i + 1][1]) / 2, (tp[i][2] + tp[i + 1][2]) / 2]); }
    return out.slice(0, 12).map(function (p) { return gp(p[0], p[1], p[2]); });
  })();
  /* quaternion xyzw */
  function qmul(a, b) { return [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]]; }
  function qrot(q, v) { var x = q[0], y = q[1], z = q[2], w = q[3], tx = 2 * (y * v[2] - z * v[1]), ty = 2 * (z * v[0] - x * v[2]), tz = 2 * (x * v[1] - y * v[0]);
    return [v[0] + w * tx + y * tz - z * ty, v[1] + w * ty + z * tx - x * tz, v[2] + w * tz + x * ty - y * tx]; }
  function qaxis(ax, a) { var s = Math.sin(a / 2), l = Math.hypot(ax[0], ax[1], ax[2]) || 1; return [ax[0] / l * s, ax[1] / l * s, ax[2] / l * s, Math.cos(a / 2)]; }
  /* xoay các xương list quanh trục ax đi qua điểm p (đã ở tư thế hiện tại): x' = R(qx+t-p)+p */
  function turnBones(P, list, p, R) {
    list.forEach(function (b) {
      var o = b * 7, q = qmul(R, [P[o], P[o + 1], P[o + 2], P[o + 3]]), t = qrot(R, [P[o + 4] - p[0], P[o + 5] - p[1], P[o + 6] - p[2]]);
      P[o] = q[0]; P[o + 1] = q[1]; P[o + 2] = q[2]; P[o + 3] = q[3]; P[o + 4] = t[0] + p[0]; P[o + 5] = t[1] + p[1]; P[o + 6] = t[2] + p[2];
    });
  }
  function posed(P, b, rest) { var o = b * 7, v = qrot([P[o], P[o + 1], P[o + 2], P[o + 3]], rest); return [v[0] + P[o + 4], v[1] + P[o + 5], v[2] + P[o + 6]]; }

  function parse(buf) {
    var jl = new DataView(buf).getUint32(0, true), meta = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, jl))), base = 4 + jl;
    var TY = { h: Int16Array, b: Int8Array, B: Uint8Array, H: Uint16Array, f: Float32Array };
    function arr(d) { var A = TY[d[0]]; return new A(buf.slice(base + d[1], base + d[1] + d[2] * A.BYTES_PER_ELEMENT)); }
    function scaled(d, k) { var a = arr(d), o = new Float32Array(a.length); for (var i = 0; i < a.length; i++) o[i] = a[i] * k; return o; }
    function mesh(m, rigid) {
      var o = { P: scaled(m.P, meta.posK / 32767), N: scaled(m.N, 1 / 127), C: scaled(m.C, 1 / 255), I: arr(m.I) };
      if (m.B) {
        o.B = scaled(m.B, 1); o.W = scaled(m.W, 1 / 255);
        /* vùng phập phồng khi thở: sườn và bụng giữa vai và hông, nhiều nhất ở mạn dưới */
        var n = o.P.length / 3; o.BR = new Float32Array(n);
        for (var v = 0; v < n; v++) {
          var x = o.P[v * 3], y = o.P[v * 3 + 1], z = o.P[v * 3 + 2], nx = o.N[v * 3], ny = o.N[v * 3 + 1];
          o.BR[v] = sm(-0.27, -0.15, z) * sm(0.16, 0.05, z) * sm(0.15, 0.24, y) * sm(0.5, 0.38, y) * Math.min(1, Math.max(0, 0.25 - ny * 0.9 + Math.abs(nx) * 0.45)) * sm(0.01, 0.05, Math.abs(x) + Math.max(0, 0.34 - y));
        }
      }
      if (rigid) { o.R = arr(m.R); o.UV = new Float32Array(o.P.length / 3 * 2); }
      return o;
    }
    var out = { meta: meta, skin: mesh(meta.skin), face: mesh(meta.face, true), eyes: meta.eyes.map(function (m) { return mesh(m, true); }),
      lids: meta.lids.map(function (m) { return mesh(m, true); }), pupils: meta.pupils.map(function (m) { return mesh(m, true); }),
      mouth: mesh(meta.mouth, true), mouthShut: arr(meta.mouthShut), mouthHalf: arr(meta.mouthHalf), clips: {} };
    meta.clips.forEach(function (c) {
      var raw = arr(c.data), d = new Float32Array(raw.length);
      for (var i = 0; i < raw.length; i++) d[i] = raw[i] * (i % 7 < 4 ? 1 : meta.posK) / 32767;
      out.clips[c.name] = { n: c.n, loop: c.loop, sec: c.sec, dist: c.dist, data: d };
    });
    return out;
  }

  /* tư thế = [qx,qy,qz,qw,tx,ty,tz] cho từng xương, nội suy giữa hai khung */
  function sampleClip(cl, nb, u, out) {
    var f = cl.loop ? (u - Math.floor(u)) * cl.n : Math.max(0, Math.min(1, u)) * (cl.n - 1);
    var i0 = Math.floor(f), t = f - i0, i1 = cl.loop ? (i0 + 1) % cl.n : Math.min(cl.n - 1, i0 + 1);
    var d = cl.data, s = nb * 7;
    for (var b = 0; b < nb; b++) {
      var a = i0 * s + b * 7, c = i1 * s + b * 7;
      blendBone(d, a, d, c, t, out, b * 7);
    }
    return out;
  }
  function blendBone(A, a, B, c, t, out, o) {
    var sg = A[a] * B[c] + A[a + 1] * B[c + 1] + A[a + 2] * B[c + 2] + A[a + 3] * B[c + 3] < 0 ? -1 : 1, k;
    for (k = 0; k < 4; k++) out[o + k] = A[a + k] * (1 - t) + B[c + k] * sg * t;
    var l = Math.hypot(out[o], out[o + 1], out[o + 2], out[o + 3]) || 1;
    for (k = 0; k < 4; k++) out[o + k] /= l;
    for (k = 4; k < 7; k++) out[o + k] = A[a + k] * (1 - t) + B[c + k] * t;
  }
  function toDQ(p, nb, dq) {
    for (var b = 0; b < nb; b++) {
      var o = b * 7, x = p[o], y = p[o + 1], z = p[o + 2], w = p[o + 3], tx = p[o + 4], ty = p[o + 5], tz = p[o + 6], k = b * 8;
      dq[k] = x; dq[k + 1] = y; dq[k + 2] = z; dq[k + 3] = w;
      dq[k + 4] = 0.5 * (tx * w + ty * z - tz * y); dq[k + 5] = 0.5 * (-tx * z + ty * w + tz * x);
      dq[k + 6] = 0.5 * (tx * y - ty * x + tz * w); dq[k + 7] = -0.5 * (tx * x + ty * y + tz * z);
    }
    return dq;
  }
  function boneMatrix(p, b) {
    var o = b * 7, x = p[o], y = p[o + 1], z = p[o + 2], w = p[o + 3];
    return [1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w), 0,
      2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w), 0,
      2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y), 0, p[o + 4], p[o + 5], p[o + 6], 1];
  }

  /* thân hai bé xấp xỉ bằng chuỗi hình cầu [vị trí dọc thân, bán kính] để nhường đường */
  var BODY = [[0.42, 0.17], [0.18, 0.2], [-0.08, 0.2], [-0.32, 0.19], [-0.52, 0.09]];
  var MAIN_BODY = [[0.44, 0.17], [0.18, 0.19], [-0.05, 0.19], [-0.3, 0.19], [-0.62, 0.1]];
  var SKIN_GAP = 0.03, NAV_R = 0.42;
  function spheres(x, z, yaw, list, S) {
    var fx = Math.sin(yaw), fz = Math.cos(yaw);
    return list.map(function (s) { return [x + fx * s[0] * S, z + fz * s[0] * S, s[1] * S]; });
  }
  /* khe hở nhỏ nhất giữa hai thân và hướng đẩy bé này ra */
  function gapTo(me, other) {
    var best = 9, dx = 0, dz = 1;
    me.forEach(function (a) {
      other.forEach(function (b) {
        var x = a[0] - b[0], z = a[1] - b[1], l = Math.hypot(x, z), g = l - a[2] - b[2];
        if (g < best) { best = g; dx = x / (l || 1); dz = z / (l || 1); }
      });
    });
    return { gap: best, dx: dx, dz: dz };
  }

  function create(E, data) {
    var meta = data.meta, nb = meta.bones.length;
    /* lưới đổi dáng được (đồng tử, miệng) nạp bằng bản sao toạ độ để không ghi đè dữ liệu gốc */
    function copy(m) { return { P: new Float32Array(m.P), N: m.N, C: m.C, UV: m.UV, I: m.I, R: m.R }; }
    var gpu = { skin: E.uploadSkin(data.skin), face: E.upload(data.face), eyes: data.eyes.map(E.upload), lids: data.lids.map(E.upload),
      pupils: data.pupils.map(function (m) { return E.upload(copy(m)); }), mouth: E.upload(copy(data.mouth)) };
    var mouthV = new Float32Array(data.mouth.P), mouthAt = -9, pupilAt = -9;
    var pupilV = data.pupils.map(function (m) { return new Float32Array(m.P); });
    /* đồng tử: dời đỉnh trên mặt cầu. wk = bề ngang (nhỏ = khe dọc khi trời sáng, 1 = tròn to khi tối/hào hứng) */
    function shapePupils(wk) {
      if (Math.abs(wk - pupilAt) < 0.012) return;
      pupilAt = wk;
      var hk = 1 + (1 - Math.min(1, wk)) * 0.22;
      meta.eyeInfo.forEach(function (e, ei) {
        var v = pupilV[ei], k = 0;
        for (var j = 0; j < e.angs.length; j++) {
          var s = Math.sin(e.angs[j]);
          for (var i = 0; i < e.seg; i++) {
            var ph = i / e.seg * 6.283185307, x = Math.cos(ph) * s * wk, y = Math.sin(ph) * s * hk, z = Math.sqrt(Math.max(0, 1 - x * x - y * y));
            for (var a = 0; a < 3; a++) v[k++] = e.c[a] + e.r * (e.rt[a] * x + e.up[a] * y + e.fwd[a] * z);
          }
        }
        E.setVerts(gpu.pupils[ei], v);
      });
    }
    /* miệng: nội suy ngậm -> há một nửa -> há to */
    function shapeMouth(o) {
      if (Math.abs(o - mouthAt) < 0.008) return;
      mouthAt = o;
      var A = o < 0.5 ? data.mouthShut : data.mouthHalf, B = o < 0.5 ? data.mouthHalf : data.mouth.P, t = o < 0.5 ? o * 2 : o * 2 - 1;
      for (var q = 0; q < mouthV.length; q++) mouthV[q] = A[q] + (B[q] - A[q]) * t;
      E.setVerts(gpu.mouth, mouthV);
    }
    var cur = new Float32Array(nb * 7), prevPose = new Float32Array(nb * 7), mixed = new Float32Array(nb * 7);
    var dqArr = new Float32Array(nb * 8), skinC = { mesh: data.skin };
    var K = {
      x: 0, z: 0, yaw: 0, state: 'stand', u: 0, k: 0, wait: 2, path: null, target: null, fade: 0, placed: false,
      gaze: [0, 0], gazeT: [0, 0], sacT: 0, lid: 0, slowT: -9, stuck: 0, r: null, data: data, pup: 0.6, excite: 0, meowAt: -9, mouth: 0
    };

    function say(state) {                     /* đổi trạng thái, hoà tư thế cũ vào tư thế mới */
      if (K.r) { prevPose.set(mixed); K.fade = 1; }
      K.state = state;
    }
    function farSpot(w, minFromMain, clear) {
      var best = null, bs = -1;
      for (var i = 0; i < 24; i++) {
        var p = w.randFloor(), d = w.main ? Math.hypot(p[0] - w.main.x, p[1] - w.main.z) : 9;
        if (w.sdWorld(p[0], p[1], 0) < clear) continue;
        if (d > minFromMain) return p;
        if (d > bs) { bs = d; best = p; }
      }
      return best || w.randFloor();
    }
    function walkTo(w, p) {
      K.target = p; K.path = w.navPath([K.x, K.z], p, NAV_R); K.stuck = 0;
      if (!K.path || !K.path.length) K.path = [p];
      say('walk');
    }
    function stop(wait) { K.path = null; K.wait = wait; K.u = 0; say('stand'); }

    function place(w) {
      var p = farSpot(w, 2.2, 0.75);
      K.x = p[0]; K.z = p[1]; K.yaw = Math.atan2(-p[0], 2 - p[1]); K.placed = true; stop(2.5);
    }

    /* đẩy bé ra khỏi đồ đạc theo đường viền thật của da (đầu, chân, đuôi) */
    function pushOut(w) {
      var pts = C.skinPoints(skinC, K.r, Math.max(1, Math.floor(data.skin.P.length / 3 / 300)));
      var px = 0, pz = 0, nx = 0, nz = 0;
      for (var i = 0; i < pts.length; i++) {
        var p = pts[i], y = Math.max(0, p[1]), d = w.sdWorld(p[0], p[2], y);
        if (d < SKIN_GAP) {
          var g = w.sdGrad(p[0], p[2], y), a = g[0] * (SKIN_GAP - d), b = g[1] * (SKIN_GAP - d);
          if (a > px) px = a; if (a < nx) nx = a; if (b > pz) pz = b; if (b < nz) nz = b;
        }
      }
      K.x += px + nx; K.z += pz + nz;
      return Math.hypot(px + nx, pz + nz);
    }

    function think(dt, t, w) {
      var me = spheres(K.x, K.z, K.yaw, BODY, 1), near = null;
      if (w.main && w.main.y < 0.5) near = gapTo(me, spheres(w.main.x, w.main.z, w.main.yaw, MAIN_BODY, w.main.S));
      if (near && near.gap < 0.02) {           /* chạm thân: trượt ra ngay, không bao giờ lồng vào nhau */
        var push = 0.02 - near.gap;
        K.x += near.dx * push; K.z += near.dz * push;
      }
      var crowded = near && near.gap < 0.28;

      if (K.state === 'walk') {
        var wp = K.path[0], dx = wp[0] - K.x, dz = wp[1] - K.z, dist = Math.hypot(dx, dz);
        if (dist < (K.path.length > 1 ? 0.22 : 0.1)) { K.path.shift(); if (!K.path.length) stop(1.5 + Math.random() * 3.5); return; }
        var cl = data.clips.walk, want = Math.atan2(dx, dz), diff = Math.atan2(Math.sin(want - K.yaw), Math.cos(want - K.yaw));
        var turn = Math.max(-3.2 * dt, Math.min(3.2 * dt, diff));
        K.yaw += turn;
        var facing = Math.max(0, Math.cos(diff)), v = cl.dist / cl.sec * facing * facing;
        var step = Math.min(dist, v * dt);
        K.x += Math.sin(K.yaw) * step; K.z += Math.cos(K.yaw) * step;
        /* chân bước theo đúng quãng đã đi (kể cả khi xoay tại chỗ) nên không trượt */
        K.u += (step + Math.abs(turn) * 0.22) / cl.dist;
        if (crowded && Math.sin(K.yaw) * -near.dx + Math.cos(K.yaw) * -near.dz > 0.3) walkTo(w, farSpot(w, 2.4, 0.6));
        return;
      }
      if (K.state === 'stand') {
        K.u += dt / data.clips.stand.sec; K.wait -= dt;
        if (crowded) { walkTo(w, farSpot(w, 2.4, 0.6)); return; }
        if (K.wait <= 0) {
          var roomy = w.sdWorld(K.x, K.z, 0) > 0.7 && (!near || near.gap > 0.8);
          if (roomy && Math.random() < 0.45) { K.k = 0; say('sitdown'); } else walkTo(w, farSpot(w, 1.6, 0.6));
        }
        return;
      }
      if (K.state === 'sitdown') {
        K.k += dt / data.clips.sitdown.sec;
        if (K.k >= 1) { K.u = 0; K.wait = 5 + Math.random() * 8; say('sit'); }
        return;
      }
      if (K.state === 'sit') {
        K.u += dt / data.clips.sit.sec; K.wait -= dt;
        if (K.wait <= 0 || crowded) { K.k = 1; say('standup'); }
        return;
      }
      if (K.state === 'standup') {
        K.k -= dt / data.clips.sitdown.sec * (crowded ? 2 : 1);
        if (K.k <= 0) { if (crowded) walkTo(w, farSpot(w, 2.4, 0.6)); else stop(1 + Math.random() * 2); }
      }
    }

    /* lớp chuyển động sống chồng lên clip nướng sẵn: thở, đuôi trễ khi xoay người + chóp đuôi vẫy, tai xoay và giật */
    var BI = {}; meta.bones.forEach(function (n, i) { BI[n] = i; });
    var TAILB = []; for (var ti = 0; ti < 12; ti++) if (BI['tail.' + (ti < 10 ? '0' : '') + ti] !== undefined) TAILB.push(BI['tail.' + (ti < 10 ? '0' : '') + ti]);
    var L = { ph: 0, lag: 0, lagV: 0, yawP: null, tipA: 0, tipPh: 0, ear: [{ sw: 0, swT: 0, tw: 0, twPh: 0 }, { sw: 0, swT: 0, tw: 0, twPh: 0 }], earNext: 1 };
    function life(dt) {
      if (dt <= 0) return;
      var walking = K.state === 'walk', sitting = K.state === 'sit';
      L.ph = (L.ph + dt * (walking ? 0.62 : sitting ? 0.42 : 0.5)) % 1;
      var w = L.ph < 0.4 ? sm(0, 0.4, L.ph) : 1 - sm(0.4, 1, L.ph);
      K.breath = (w - 0.35) * 0.011 * 0.8;
      var yr = L.yawP === null ? 0 : Math.atan2(Math.sin(K.yaw - L.yawP), Math.cos(K.yaw - L.yawP)) / dt; L.yawP = K.yaw;
      var lagT = Math.max(-0.9, Math.min(0.9, -yr * 0.35));
      L.lagV += ((lagT - L.lag) * 38 - L.lagV * 7) * dt; L.lag += L.lagV * dt;
      if (Math.random() < dt * 0.15) { L.tipA = (0.5 + Math.random() * 0.5) * (Math.random() < 0.5 ? -1 : 1); L.tipPh = 0; }
      L.tipPh += dt * 13; L.tipA *= Math.pow(0.06, dt);
      var tip = L.tipA * Math.sin(L.tipPh), up = [0, 1, 0];
      TAILB.forEach(function (b, i) {
        var a = L.lag * (0.035 + 0.012 * i) + (i >= 6 ? tip * 0.09 * (i - 5) : 0);
        if (Math.abs(a) > 1e-4) turnBones(mixed, TAILB.slice(i), posed(mixed, b, TAIL_HEADS[i]), qaxis(up, a));
      });
      /* tai: mỗi tai tự xoay hướng về tiếng động, thỉnh thoảng giật ra sau */
      L.earNext -= dt;
      if (L.earNext <= 0) {
        L.earNext = 1.2 + Math.random() * 3.5;
        var ei = Math.random() < 0.5 ? 0 : 1;
        if (Math.random() < 0.45) { L.ear[ei].tw = 1; L.ear[ei].twPh = 0; } else L.ear[ei].swT = Math.random() < 0.6 ? 0.25 + Math.random() * 0.5 : -0.25 + Math.random() * 0.35;
      }
      var hb = meta.headBone, ho = hb * 7, qh = [mixed[ho], mixed[ho + 1], mixed[ho + 2], mixed[ho + 3]];
      ['ear.L', 'ear.R'].forEach(function (n, i) {
        var e = L.ear[i], b = BI[n]; if (b === undefined) return;
        e.swT *= Math.pow(0.82, dt); e.sw += (e.swT - e.sw) * (1 - Math.pow(0.004, dt));
        e.twPh += dt * 26; e.tw *= Math.pow(0.002, dt);
        var sg = i ? -1 : 1, root = posed(mixed, b, EAR_ROOT[n]);
        turnBones(mixed, [b], root, qmul(qaxis(qrot(qh, [0, 1, 0]), sg * e.sw * 0.7), qaxis(qrot(qh, [1, 0, 0]), -e.tw * Math.sin(e.twPh) * 0.35)));
      });
    }
    function pose(dt) {
      var s = K.state, cl = data.clips[s === 'standup' ? 'sitdown' : s];
      sampleClip(cl, nb, s === 'sitdown' || s === 'standup' ? K.k : K.u, cur);
      if (K.fade > 0) {
        K.fade = Math.max(0, K.fade - dt / 0.35);
        var f = K.fade * K.fade * (3 - 2 * K.fade);
        for (var b = 0; b < nb; b++) blendBone(cur, b * 7, prevPose, b * 7, f, mixed, b * 7);
      } else mixed.set(cur);
      life(dt);
      var R0 = M(T(K.x, 0, K.z), RY(K.yaw));
      var head = M(R0, boneMatrix(mixed, meta.headBone));
      K.r = { dq: toDQ(mixed, nb, dqArr), R0: R0, head: head, headPos: xf(head, meta.headPos) };
    }

    K.update = function (dt, t, w) {
      if (!K.placed) place(w);
      if (dt > 0) think(Math.min(dt, 0.1), t, w);
      pose(Math.min(dt, 0.1));
      if (pushOut(w) > 0.0005) {
        if (K.state === 'walk') { K.stuck += dt; if (K.stuck > 1.2) walkTo(w, farSpot(w, 1.6, 0.7)); }
        pose(0);
      }
      /* mắt: liếc từng nhịp ngắn, chớp, thỉnh thoảng chớp chậm */
      K.sacT -= dt;
      if (K.sacT <= 0) { K.sacT = 0.7 + Math.random() * 2.4; K.gazeT = Math.random() < 0.45 ? [0, 0] : [(Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.18]; }
      var a = 1 - Math.pow(0.0001, dt);
      K.gaze[0] += (K.gazeT[0] - K.gaze[0]) * a; K.gaze[1] += (K.gazeT[1] - K.gaze[1]) * a;
      var shut = 1 - C.blinkAt(t, 1.9), sl = t - K.slowT;
      if (sl >= 0 && sl < 1.4) shut = Math.max(shut, Math.sin(Math.PI * sl / 1.4));
      if (K.state === 'sit' && Math.random() < dt * 0.12 && sl > 3) K.slowT = t;
      K.lid = Math.max(0, Math.min(1, shut));
      /* đồng tử theo ánh sáng; vừa được chạm thì mở to */
      K.excite = Math.max(0, K.excite - dt);
      var light = w.light === undefined ? 0.6 : w.light, pupT = K.excite > 0 ? 1.04 : 1 - 0.7 * sm(0.3, 0.95, light);
      K.pup += (pupT - K.pup) * (1 - Math.pow(0.03, dt));
      /* tiếng kêu: miệng mở nhanh, giữ, khép chậm */
      var ma = t - K.meowAt;
      K.mouth = ma >= 0 && ma < 0.6 ? 0.9 * sm(0, 0.1, ma) * (1 - sm(0.34, 0.6, ma)) : 0;
    };

    function parts() {
      var H = K.r.head;
      return {
        eyes: meta.eyeInfo.map(function (e) { var c = e.c; return M(H, T(c[0], c[1], c[2]), RY(K.gaze[0]), RX(-K.gaze[1]), T(-c[0], -c[1], -c[2])); }),
        lids: meta.eyeInfo.map(function (e) { var c = e.c; return M(H, T(c[0], c[1], c[2]), RX(K.lid * meta.lidClose), T(-c[0], -c[1], -c[2])); })
      };
    }
    K.draw = function () {
      if (!K.r) return;
      var f = meta.fur, p = parts();
      E.floorY = 0; E.breath = K.breath || 0;
      E.drawSkin(gpu.skin, K.r.dq, K.r.R0, [1, 1, 1], { n: Math.max(3, Math.round(f.n * C.getFurQ())), len: f.len, den: f.den });
      E.breath = 0;
      E.draw(gpu.face, K.r.head);
      shapePupils(K.pup);
      for (var i = 0; i < 2; i++) { E.draw(gpu.eyes[i], p.eyes[i]); E.draw(gpu.pupils[i], p.eyes[i]); E.draw(gpu.lids[i], p.lids[i]); }
      if (K.mouth > 0.03) { shapeMouth(K.mouth); E.draw(gpu.mouth, K.r.head); }
    };
    K.drawShadow = function () {
      if (!K.r) return;
      var p = parts();
      E.floorY = 0;
      E.drawSkinD(gpu.skin, K.r.dq, K.r.R0);
      E.drawD(gpu.face, K.r.head);
      for (var i = 0; i < 2; i++) E.drawD(gpu.lids[i], p.lids[i]);
    };
    K.points = function (step) { return C.skinPoints(skinC, K.r, step || 1); };
    K.spheres = function () { return spheres(K.x, K.z, K.yaw, BODY, 1); };
    /* khe hở tới bé mèo chính (âm = đang lồng vào nhau) và hướng đẩy bé chính ra */
    K.gapMain = function (main) {
      var g = gapTo(spheres(main.x, main.z, main.yaw, MAIN_BODY, main.S), K.spheres());
      return g;
    };
    /* chạm vào bé: quay mặt lại, chớp chậm */
    K.touched = function (t) { K.meowAt = t; K.excite = 2.5; K.slowT = t + 0.9; K.gazeT = [0, 0]; K.sacT = 2; if (K.state === 'walk') stop(2.5); else K.wait = Math.max(K.wait, 2.5); };
    K.force = function (what, w) {
      if (what === 'walk') walkTo(w, w.to || farSpot(w, 1.6, 0.6));
      else if (what === 'sit') { K.k = 0; say('sitdown'); }
      else stop(9);
    };
    return K;
  }

  function load(E, url) {
    return fetch(url).then(function (r) { if (!r.ok) throw new Error(url + ' ' + r.status); return r.arrayBuffer(); })
      .then(function (b) { return create(E, parse(b)); });
  }
  G.BlenderCat = { load: load, parse: parse };
})(window);
