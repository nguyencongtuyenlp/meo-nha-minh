/* Đổi giống mèo ngay trong trang rồi chụp: dùng localStorage + tải lại.
   Chạy:  eval(await (await fetch('tools/chup-giong.js')).text()); await doiGiong('kem')   (trang tự tải lại) */
(function () {
  window.doiGiong = async function (k) {
    for (var f of ['cat3d.js?v=28', 'game.js?v=29', 'coats.js?v=28', 'worker.js?v=28', 'blendercat.js?v=2', 'engine3.js?v=3']) await fetch(f, { cache: 'reload' });
    window.__meo.SV.coat = k;
    setTimeout(function () { location.reload(); }, 50);
    return k;
  };
})();
