/* Đổi giống mèo ngay trong trang rồi chụp: dùng localStorage + tải lại.
   Chạy:  eval(await (await fetch('tools/chup-giong.js')).text()); await doiGiong('kem')   (trang tự tải lại) */
(function () {
  window.doiGiong = async function (k) {
    for (var f of ['cat3d.js?v=29', 'game.js?v=30', 'coats.js?v=29', 'worker.js?v=29', 'blendercat.js?v=3', 'engine3.js?v=4']) await fetch(f, { cache: 'reload' });
    window.__meo.SV.coat = k;
    setTimeout(function () { location.reload(); }, 50);
    return k;
  };
})();
