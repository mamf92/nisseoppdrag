// Sets the theme before first paint so there is no flash. Loaded as a classic script (the CSP
// allows no inline scripts). Keep in sync with src/themes/theme.ts.
(function () {
  var theme = null;
  try {
    var stored = window.localStorage.getItem('nisse-theme');
    if (stored === 'laaven' || stored === 'gaarden') theme = stored;
  } catch (e) {
    /* storage blocked: fall through to the device preference */
  }
  if (!theme) {
    var dark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    theme = dark ? 'laaven' : 'gaarden';
  }
  document.documentElement.setAttribute('data-nisse-theme', theme);
  try {
    var lang = window.localStorage.getItem('nisse-lang');
    if (lang === 'nb' || lang === 'en') document.documentElement.setAttribute('lang', lang);
  } catch (e) {
    /* ignore */
  }
})();
