(function () {
  try {
    var m = document.cookie.match(/(?:^|; )forma_theme=(light|dark)(?:;|$)/);
    var t = (m && m[1]) || localStorage.getItem('forma_theme');
    if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
  } catch (e) {}
})();
