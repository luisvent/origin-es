/* Runs in the head, before the first paint. All motion CSS sits behind class motion, so without it everything is simply visible.
   It also sizes the opening's title screen and battle loop now, so the first paint doesn't jump. */
(function () {
  var r = document.documentElement;
  r.classList.add('js');
  var motion = !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  if (motion) r.classList.add('motion');
  /* Sizes the opening's stage before the first paint (design/components/Hero); page.js calls it again on resize with the real wrap width.
     Every picture is a whole or half multiple of its art on the device's pixels (design/media.md). Sets --hl (the battle loop's width),
     --ht (the title screen's), and on a wide screen --tw (the name's column, from the stage's inner left edge) and --vs/--ve (where the
     veil over the loop is solid and where it has faded, from the loop's left edge). The loop sits at the stage's right; its art is
     256 wide and Dragonite starts 28 game pixels from its left, so the loop takes the largest size that leaves the name's column,
     the solid veil and a short fade to the left of Dragonite. */
  window.OHG_size = function (wrapW) {
    var d = window.devicePixelRatio || 1, w = innerWidth, h = innerHeight;
    var W = wrapW || Math.min(w - 40, 1280), F, T, set = function (n, x) { r.style.setProperty(n, x + 'px'); };
    var q = function (x) { return Math.max(Math.floor(x * d / 128) * 128 / d, 128 / d); };
    if (w < 900) {                                  /* one column, the game first */
      F = q(W - 6); T = q((W - 6) * .62);
      set('--hl', F); set('--ht', T);
      return;
    }
    var I = W - 6, fs = Math.min(96, Math.max(46, w * .064)), name = 32 + fs * 5.3;   /* "en español", the name's widest line */
    for (F = q(Math.min(I, (h - 96) / .5625)); F > 256; F = q(F - 1 / d)) {
      if (I - F + F * 28 / 256 - 40 >= name) break;
    }
    var left = I - F, drag = left + F * 28 / 256, tw = drag - 40;
    T = Math.max(q(F * .5), q(256));
    set('--hl', F); set('--ht', T); set('--tw', tw);
    set('--vs', Math.max(0, tw + 8 - left)); set('--ve', drag - 4 - left);
  };
  try { window.OHG_size(); } catch (e) {}
  /* The title writes itself once its font is there, or after 300ms, whichever comes first. */
  if (motion) {
    var done = false, on = function () { if (!done) { done = true; r.classList.add('on'); } };
    setTimeout(on, 300);
    try { document.fonts.load('500 46px "Pixelify Sans"').then(on, on); } catch (e) { on(); }
  }
})();
