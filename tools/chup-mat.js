/* Chụp cận mặt / toàn thân để so với ảnh tham khảo. Chạy trong trang game:
     eval(await (await fetch('tools/chup-mat.js')).text()); await chup('sit', {dist:1.4}) */
(function () {
  window.chup = async function (act, o) {
    o = o || {};
    var m = window.__meo, c = m.cam, k = m.cat;
    if (!window.__frame) eval(await (await fetch('tools/do-xuyen.js?' + Date.now(), { cache: 'reload' })).text());
    window.__fixedDt = 1 / 30; window.__noAdapt = true;
    m.studioOpen();
    document.getElementById('studio').hidden = true;
    document.querySelectorAll('.toast,#hint').forEach(function (e) { e.style.display = 'none'; });
    if (act) { k.x = m.STUDIO.c[0]; k.z = m.STUDIO.c[2]; k.y = 0; k.v = 0; m.studioPlay(act); }
    var n = o.frames || 75;
    for (var i = 0; i < n; i++) {
      c.distT = c.dist = o.dist || 1.6;
      c.yawT = c.yaw = k.yaw + (o.yaw === undefined ? 0.12 : o.yaw);
      c.pitchT = c.pitch = o.pitch === undefined ? 0.1 : o.pitch;
      if (o.look && k.script) k.lookP = c.eye;
      await window.__frame();
    }
    window.__fixedDt = 0;
    return 'ok';
  };
})();
