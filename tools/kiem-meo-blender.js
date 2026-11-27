/* Kiểm bé mèo Blender. Chạy trong trang game:
     (0,eval)(await (await fetch('tools/kiem-meo-blender.js')).text());
     await chup2('sit', {dist:1.7, yaw:0.5})     ảnh cận: 'stand' | 'sit' | 'walk'
     await do2(240)                              chạy 240 giây: lún sàn, đâm đồ, lồng vào mèo chính */
(function () {
  var m = window.__meo;
  async function khung() {
    if (!window.__frame) (0, eval)(await (await fetch('tools/do-xuyen.js?' + Date.now(), { cache: 'reload' })).text());
  }
  window.chup2 = async function (what, o) {
    await khung();
    o = o || {};
    var k = m.cat2, w = m.cat2World();
    window.__fixedDt = 1 / 30; window.__noAdapt = true;
    document.querySelectorAll('.toast,#hint').forEach(function (e) { e.style.display = 'none'; });
    if (!o.keep) {
      m.cat.x = -3; m.cat.z = -0.5;
      k.x = 0.2; k.z = 0.9; k.yaw = 0.3;
      w.main = null;
      if (what === 'walk') w.to = [2.4, 2.2];
      k.force(what, w);
    }
    var n = o.frames || (what === 'sit' ? 90 : 40);
    for (var i = 0; i < n; i++) {
      m.cam.focus = { t: [k.x, o.h === undefined ? 0.45 : o.h, k.z], yaw: k.yaw + (o.yaw || 0), pitch: o.pitch === undefined ? 0.12 : o.pitch, dist: o.dist || 2 };
      await window.__frame();
    }
    window.__fixedDt = 0;
    return k.state;
  };

  /* độ lún đo trên da (không tính lông), tính cả lớp ép bẹp của shader ở sàn */
  window.do2 = async function (giay) {
    await khung();
    var k = m.cat2, main = m.cat;
    m.cam.focus = null;
    window.__fixedDt = 1 / 20; window.__noAdapt = true;
    var res = {}, gapMin = 9, bad = 0, n = Math.round((giay || 120) * 20), nan = false;
    for (var i = 0; i < n; i++) {
      await window.__frame();
      if (!isFinite(k.x + k.z + k.yaw)) { nan = true; break; }
      var s = k.state, e = res[s] || (res[s] = { khung: 0, epSan: 0, damDo: 0 });
      e.khung++;
      if (i % 3) continue;
      var pts = k.points(7);
      for (var j = 0; j < pts.length; j++) {
        var p = pts[j];
        e.epSan = Math.max(e.epSan, -p[1]);
        var d = m.sdWorld(p[0], p[2], Math.max(0, p[1]));
        e.damDo = Math.max(e.damDo, -d);
      }
      if (main.y < 0.5) {
        var a = k.spheres(), f = [Math.sin(main.yaw), Math.cos(main.yaw)], S = m.CAT.S;
        var b = [[0.44, 0.17], [0.18, 0.19], [-0.05, 0.19], [-0.3, 0.19]].map(function (q) { return [main.x + f[0] * q[0] * S, main.z + f[1] * q[0] * S, q[1] * S]; });
        var g = 9;
        a.forEach(function (x) { b.forEach(function (y) { g = Math.min(g, Math.hypot(x[0] - y[0], x[1] - y[1]) - x[2] - y[2]); }); });
        gapMin = Math.min(gapMin, g); if (g < -0.05) bad++;
      }
    }
    for (var key in res) { res[key].epSan = +res[key].epSan.toFixed(3); res[key].damDo = +res[key].damDo.toFixed(3); res[key].giay = Math.round(res[key].khung / 20); delete res[key].khung; }
    window.__fixedDt = 0;
    return { trangThai: res, kheHoNhoNhat: +gapMin.toFixed(3), soMauChongNhau: bad, nan: nan };
  };
})();
