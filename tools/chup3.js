/* Chụp cùng một góc để so engine cũ / three.js. Chạy trong trang game:
     (0,eval)(await (await fetch('tools/chup3.js')).text()); await goc('phong')
   goc: 'phong' (toàn phòng), 'meo' (cận bé chính), 'meo2' (cận bé Blender), 'cuaso' (góc cửa sổ).
   gio: giờ trong ngày (vd 8, 13, 17.5, 21). tune: ghi đè hệ số ánh sáng của engine3. */
(function () {
  var GOC = {
    phong: { t: [0, 1.1, 0.6], yaw: 0.5, pitch: 0.42, dist: 11 },
    cuaso: { t: [0, 1.6, -2.5], yaw: 0.15, pitch: 0.18, dist: 7 }
  };
  window.goc = async function (ten, o) {
    o = o || {};
    var m = window.__meo;
    if (!window.__frame) (0, eval)(await (await fetch('tools/do-xuyen.js?' + Date.now(), { cache: 'reload' })).text());
    if (o.tune && m.E.tune) for (var k in o.tune) m.E.tune[k] = o.tune[k];
    if (o.gio !== undefined) { var s = document.getElementById('tSlider'); if (s) { s.value = o.gio; s.dispatchEvent(new Event('input')); } }
    window.__fixedDt = 1 / 30; window.__noAdapt = true;
    document.querySelectorAll('.toast,#hint,#loading').forEach(function (e) { e.style.display = 'none'; });
    for (var i = 0; i < (o.frames || 20); i++) {
      var f = GOC[ten];
      if (ten === 'meo') f = { t: [m.cat.x, 0.35, m.cat.z], yaw: m.cat.yaw + 0.5, pitch: 0.15, dist: 2.2 };
      if (ten === 'meo2' && m.cat2) f = { t: [m.cat2.x, 0.4, m.cat2.z], yaw: m.cat2.yaw + 0.5, pitch: 0.15, dist: 2.2 };
      m.cam.focus = f;
      await window.__frame();
    }
    window.__fixedDt = 0;
    return m.E.three ? m.E.dbg() : 'engine cu';
  };
})();
