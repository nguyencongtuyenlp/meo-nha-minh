/* Chạy trọn từng hành vi chạm đồ vật; báo: có chạy hết các bước không, mèo bị trượt bao xa trong lúc
   đang làm động tác tại chỗ (lớp đẩy không được kéo mèo khỏi bát ăn, trụ cào...), có NaN không.
   Chạy:  eval(await (await fetch('tools/chay-hanh-vi.js')).text()); await chayHanhVi() */
(function () {
  window.chayHanhVi = async function (list) {
    var m = window.__meo, k = m.cat;
    if (!window.__frame) eval(await (await fetch('tools/do-xuyen.js?' + Date.now(), { cache: 'reload' })).text());
    list = list || ['eat', 'scratch', 'rub', 'litter', 'box', 'window', 'cup', 'groom', 'sleep', 'zoom', 'att'];
    window.__fixedDt = 1 / 20; window.__noAdapt = true;
    if (m.STUDIO.on) document.querySelector('#studio') && (m.STUDIO.on = false);
    var res = {};
    for (var name of list) {
      m.STUDIO.on = false;
      k.x = -0.4; k.z = 0.9; k.y = 0; k.v = 0; k.sleeping = false; k.poseObj = null; m.SV.food = 3; m.SV.dirty = 0;
      m.setScript('kiem-' + name, m.B[name](), 99);
      var tong = k.script.steps.length, buoc = 0, truot = 0, nan = false, last = null, i;
      for (i = 0; i < 20 * 45; i++) {
        await window.__frame();
        if (!k.script || k.script.name !== 'kiem-' + name) break;
        var s = k.script.steps[k.script.i]; buoc = k.script.i;
        if (s && !s.go && !s.jump && !s.face && s.dur) {
          if (last && last.i === k.script.i) truot = Math.max(truot, Math.hypot(k.x - last.x, k.z - last.z));
          else last = { i: k.script.i, x: k.x, z: k.z };
        }
        if (!isFinite(k.x + k.z + k.y)) { nan = true; break; }
        if (name === 'sleep' && i > 20 * 18) break;
      }
      var xong = !k.script || k.script.name !== 'kiem-' + name;
      res[name] = { xong: xong, buoc: (xong ? tong : buoc) + '/' + tong, truotKhiDungYen: +truot.toFixed(2), giay: Math.round(i / 20), nan: nan,
        cuoi: [+k.x.toFixed(1), +k.y.toFixed(1), +k.z.toFixed(1)] };
    }
    window.__fixedDt = 0; window.__vt = null;
    return res;
  };
})();
