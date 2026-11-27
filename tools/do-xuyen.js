/* Bộ đo xuyên vật — chạy trong trang game (console):
     eval(await (await fetch('tools/do-xuyen.js')).text()); await doXuyen()
   Tính lại vị trí da mèo (skinning dual-quaternion giống shader) mỗi khung rồi đo độ lún:
     san  = lún dưới mặt đang đứng (sàn),  do = đâm vào đồ đạc (theo SDF mặt bằng + chiều cao).
   Đơn vị: đơn vị thế giới của game. Đo trên DA, không tính lông. */
(function () {
  var m = window.__meo;

  function skinned(step) {
    var c = m.CAT, r = m.cat.r, P = c.mesh.P, B = c.mesh.B, W = c.mesh.W, dq = r.dq, R = r.R0, out = [];
    for (var v = 0; v < P.length / 3; v += step) {
      var q = [0, 0, 0, 0], d = [0, 0, 0, 0], i0 = B[v * 4] * 8;
      for (var k = 0; k < 4; k++) {
        var o = B[v * 4 + k] * 8, w = W[v * 4 + k];
        if (k && dq[i0] * dq[o] + dq[i0 + 1] * dq[o + 1] + dq[i0 + 2] * dq[o + 2] + dq[i0 + 3] * dq[o + 3] < 0) w = -w;
        for (var j = 0; j < 4; j++) { q[j] += dq[o + j] * w; d[j] += dq[o + 4 + j] * w; }
      }
      var l = Math.hypot(q[0], q[1], q[2], q[3]);
      for (j = 0; j < 4; j++) { q[j] /= l; d[j] /= l; }
      var x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2];
      var ax = q[1] * z - q[2] * y + q[3] * x, ay = q[2] * x - q[0] * z + q[3] * y, az = q[0] * y - q[1] * x + q[3] * z;
      var px = x + 2 * (q[1] * az - q[2] * ay) + 2 * (q[3] * d[0] - d[3] * q[0] + q[1] * d[2] - q[2] * d[1]);
      var py = y + 2 * (q[2] * ax - q[0] * az) + 2 * (q[3] * d[1] - d[3] * q[1] + q[2] * d[0] - q[0] * d[2]);
      var pz = z + 2 * (q[0] * ay - q[1] * ax) + 2 * (q[3] * d[2] - d[3] * q[2] + q[0] * d[1] - q[1] * d[0]);
      var wy = R[1] * px + R[5] * py + R[9] * pz + R[13], raw = wy, fl = m.cat.st.floor;
      if (fl !== undefined && wy - fl < 0.025) wy = fl + 0.025 * Math.exp((wy - fl) / 0.025 - 1);   // giống shader
      var pt = [R[0] * px + R[4] * py + R[8] * pz + R[12], wy, R[2] * px + R[6] * py + R[10] * pz + R[14]];
      pt.ep = wy - raw;                                     // phần thịt bị ép bẹp (đo chất lượng dáng)
      out.push(pt);
    }
    return out;
  }

  /* tự đẩy khung: trình duyệt ẩn chỉ cho ~1 khung/giây, nên giữ callback của game trong hàng đợi rồi gọi tay */
  var hang = window.__hang || (window.__hang = []);
  window.requestAnimationFrame = function (cb) { hang.push(cb); return hang.length; };
  var nhuong = function () { return new Promise(function (r) { var c = new MessageChannel(); c.port1.onmessage = r; c.port2.postMessage(0); }); };
  var frame = window.__frame = async function () {
    while (!hang.length) await nhuong();
    await nhuong();
    hang.splice(0).forEach(function (cb) { cb(performance.now()); });
  };

  window.doXuyen = async function (list, seconds) {
    list = list || ['stand', 'sit', 'loaf', 'curl', 'side', 'groom', 'walk', 'run', 'stretch', 'knead', 'meow', 'tail', 'feather', 'belly', 'tilt', 'blep'];
    var res = {};
    window.__fixedDt = 1 / 30; window.__noAdapt = true;
    m.studioOpen();
    for (var a of list) {
      m.cat.x = m.STUDIO.c[0]; m.cat.z = m.STUDIO.c[2]; m.cat.y = 0; m.cat.v = 0;
      m.studioPlay(a);
      for (var i = 0; i < 20; i++) await frame();          // bỏ đoạn chuyển tư thế
      var ep = 0, san = 0, doVat = 0, khungSan = 0, n = Math.round((seconds || 4) * 30);
      for (i = 0; i < n; i++) {
        await frame();
        if (!m.cat.script) m.studioPlay(a);
        var base = m.cat.y, s = 0, o = 0;
        for (var p of skinned(3)) {
          if (base < 0.02) s = Math.max(s, -p[1]);          // chỉ tính khi đang ở trên sàn
          ep = Math.max(ep, p.ep);
          if (p[1] > 0.03) o = Math.max(o, -m.sdWorld(p[0], p[2], p[1]));
        }
        san = Math.max(san, s); doVat = Math.max(doVat, o);
        if (s > 0.01) khungSan++;
      }
      res[a] = { lunSan: +san.toFixed(3), khungLunSan: khungSan + '/' + n, epThitToiDa: +ep.toFixed(3),damDo: +doVat.toFixed(3) };
    }
    window.__fixedDt = 0; window.__vt = null;
    return res;
  };

  /* Ép mèo đi sát từng món đồ rồi đứng/nằm cạnh nó: chỗ dễ xuyên nhất. */
  window.doXuyenSatDo = async function () {
    var res = {}, spots = { litter: [4.85, -4.3], box: [4.3, 3.75], post: [5.85, 0.7], lamp: [-6.2, -0.6], plant: [6.2, 5.15], bed: [-4.6, -3.65], food: [-5.5, 2.4] };
    window.__fixedDt = 1 / 15; window.__noAdapt = true;
    m.studioOpen(); m.STUDIO.on = true;
    for (var name in spots) {
      var t = spots[name], worst = 0;
      for (var pose of ['stand', 'side']) {
        m.cat.x = 0; m.cat.z = 0.9; m.cat.y = 0; m.cat.v = 0; m.cat.yaw = Math.atan2(t[0], t[1] - 0.9);
        m.setScript('do', [{ go: t, tol: 0.1 }, { pose: pose, roll: pose === 'side' ? 1.3 : 0, dur: 3 }], 9);
        for (var i = 0; i < 165 && m.cat.script; i++) {
          await frame();
          if (i % 3) continue;
          for (var p of skinned(4)) if (p[1] > 0.03) worst = Math.max(worst, -m.sdWorld(p[0], p[2], p[1]));
        }
      }
      res[name] = +worst.toFixed(3);
    }
    window.__fixedDt = 0; window.__vt = null;
    return res;
  };
})();
