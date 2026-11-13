/* The Jugar section (src/jugar.py): marks the row of the visitor's own platform. Only copied into site/ while
   src/downloads.json has "enabled": true. ?os=switch|mac|pc overrides the guess, for screenshots. */
(function () {
  var q = (location.search.match(/[?&]os=(\w+)/) || [])[1], os = q || '';
  var ua = navigator.userAgent || '', p = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '';
  if (!os) {
    if (/Nintendo Switch/i.test(ua)) os = 'switch';
    else if (/Android|iPhone|iPod/i.test(ua) || (/Mac/i.test(p) && navigator.maxTouchPoints > 1)) os = '';
    else if (/Mac/i.test(p) || /Mac OS X/.test(ua)) os = 'mac';
    else if (/Win/i.test(p) || /Windows/.test(ua)) os = 'pc';
  }
  function run() {
    var rows = document.querySelectorAll('.dl-row[data-plat]');
    for (var i = 0; i < rows.length; i++) rows[i].classList.toggle('mine', rows[i].getAttribute('data-plat') === os && !rows[i].classList.contains('soon'));
  }
  if (document.readyState !== 'loading') run(); else document.addEventListener('DOMContentLoaded', run);
})();
