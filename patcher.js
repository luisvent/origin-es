/* The patcher: everything happens on the visitor's device. Reads patch/version.json, checks the ROM, decodes in a Worker, verifies the result.
   The steps above it show the live state, one status box says what's happening, and focus never falls back to the top of the page. */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var OPFS_NAME = 'origin-heartgold-es-salida.nds';
  var status = $('pt-status'), prog = $('pt-prog'), bar0 = $('pt-bar'), progT = $('pt-prog-t'), input = $('pt-file');
  var pick = $('pt-pick'), go = $('pt-go'), steps = $('pt-steps') ? $('pt-steps').children : [];
  var info = null, rom = null, url = null, worker = null, mb = null;

  function say(t) { status.textContent = t; }
  /* p: 0 to 1, or null to hide. While downloading, the megabytes too. */
  function bar(p, got) {
    if (p === null) { prog.hidden = true; return; }
    prog.hidden = false;
    var pc = Math.round(p * 100);
    bar0.style.setProperty('--p', p.toFixed(3));
    bar0.setAttribute('aria-valuenow', pc);
    progT.textContent = pc + ' %' + (got !== undefined && mb ? ' · ' + Math.round(got / 1048576) + ' de ' + mb + ' MB' : '');
    bar0.setAttribute('aria-valuetext', progT.textContent);
  }
  /* Hiding the control in use would drop focus to the page's top: the status box takes it instead. */
  function show(id, on) {
    var el = $(id);
    if (!on && !el.hidden && el.contains(document.activeElement)) status.focus({ preventScroll: true });
    el.hidden = !on;
  }
  /* The steps: the one in progress is heavy, finished ones say "listo". */
  function step(n) {
    for (var i = 0; i < steps.length; i++) {
      steps[i].classList.toggle('now', i + 1 === n);
      steps[i].classList.toggle('done', i + 1 < n);
      if (i + 1 === n) steps[i].setAttribute('aria-current', 'step'); else steps[i].removeAttribute('aria-current');
    }
  }
  /* After a correct ROM the next step comes first and is the primary button; picking another file becomes the small one. */
  function pickAs(primary) {
    pick.className = primary ? 'btn' : 'btn s';
    pick.textContent = primary ? 'Elegir mi ROM' : 'Elegir otro archivo';
  }
  function offerPatch() {
    if (!info) return;
    $('pt-alt-link').href = info.patch.release_url || ('patch/' + info.patch.file);
    show('pt-alt', true);
  }
  function hex(buf) { return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); }

  /* A ROM left in browser storage is 300 MB of someone's disk: it never outlives the visit. */
  function clearStorage() {
    if (!navigator.storage || !navigator.storage.getDirectory) return;
    navigator.storage.getDirectory().then(function (d) { return d.removeEntry(OPFS_NAME); }).catch(function () {});
  }
  clearStorage();
  addEventListener('pagehide', clearStorage);

  if (!window.Worker || !Blob.prototype.slice || !window.fetch) {
    say('Este navegador no puede parchear aquí. Usa uno más reciente, o un parcheador de escritorio.');
    show('pt-pick-w', false);
    fetchInfo(offerPatch);
    return;
  }
  fetchInfo();

  function fetchInfo(then) {
    fetch('patch/version.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }).then(function (j) {
      info = j;
      if (!info) {
        say('El parche todavía no está disponible en este sitio.');
        pick.disabled = true;
      } else {
        mb = Math.round(info.patch.size / 1048576);
        $('pt-size').textContent = 'Al parchear se descargan ' + mb + ' MB. ';
        pick.disabled = false;
      }
      if (then) then();
    });
  }

  pick.addEventListener('click', function () { input.value = ''; input.click(); });
  input.addEventListener('change', function () { if (input.files[0]) check(input.files[0]); });

  function refuse(t) { say(t); bar(null); pickAs(true); show('pt-pick-w', true); show('pt-go-w', false); rom = null; step(1); status.focus({ preventScroll: true }); }

  /* Step one: the first bytes, for a clear message before anything else. */
  function check(file) {
    if (!info) return;
    show('pt-go-w', false); show('pt-get-w', false); show('pt-alt', false); show('pt-end', false); bar(null);
    $('pt-wrap').classList.remove('fin');
    file.slice(0, 16).arrayBuffer().then(function (b) {
      var u = new Uint8Array(b), code = String.fromCharCode(u[12], u[13], u[14], u[15]);
      if ((u[0] === 0x50 && u[1] === 0x4B) || (u[0] === 0x37 && u[1] === 0x7A) || (u[0] === 0x52 && u[1] === 0x61 && u[2] === 0x72)) return refuse('Ese archivo está comprimido: descomprímelo primero y elige la ROM que viene adentro.');
      if (code.slice(0, 3) === 'IPK' && file.size > info.base.size) return refuse('Esa ROM ya tiene un parche: necesitas la ROM limpia, sin parches.');
      if (code.slice(0, 3) === 'IPG') return refuse('Esa ROM es SoulSilver. Este parche es para HeartGold (USA).');
      if (code.slice(0, 3) === 'IPK' && code !== info.base.code) return refuse('Esa ROM es HeartGold de otra región. Este parche es para la versión USA.');
      if (code !== info.base.code) return refuse('Ese archivo no es Pokémon HeartGold (USA).');
      crc(file);
    }).catch(function () { refuse('No se pudo leer ese archivo.'); });
  }

  function newWorker() {
    if (worker) worker.terminate();
    worker = new Worker('patcher/worker.js');
    worker.onerror = function () { fail('El navegador detuvo el parcheo.'); };
    return worker;
  }

  /* Step two: the whole ROM's checksum. */
  function crc(file) {
    step(2);
    say('Revisando tu ROM...'); bar(0); show('pt-pick-w', false);
    var w = newWorker();
    w.onmessage = function (e) {
      var m = e.data;
      if (m.progress !== undefined) return bar(m.progress);
      if (m.error) return refuse('No se pudo leer ese archivo.');
      if (m.crc !== info.base.crc32.toUpperCase()) return refuse('Tu copia es distinta (recortada o modificada). Necesitas la ROM limpia de HeartGold (USA).');
      rom = file;
      bar(null);
      step(3);
      say('Tu ROM es la correcta. Sigue en tu dispositivo: no se sube nada.');
      pickAs(false);
      show('pt-go-w', true); show('pt-pick-w', true);
      go.focus({ preventScroll: true });
    };
    w.postMessage({ cmd: 'crc', base: file });
  }

  /* Where the output goes, best first; the save dialog needs this click. */
  go.addEventListener('click', function () {
    if (!rom) return;
    show('pt-go-w', false); show('pt-pick-w', false);
    if (window.showSaveFilePicker) {
      window.showSaveFilePicker({ suggestedName: info.target.name }).then(function (h) { getPatch('handle', h); }, function (err) {
        if (err && err.name === 'AbortError') { show('pt-go-w', true); show('pt-pick-w', true); go.focus({ preventScroll: true }); return; }
        getPatch('opfs', null);
      });
    } else getPatch(navigator.storage && navigator.storage.getDirectory ? 'opfs' : 'blob', null);
  });

  /* Step three: the patch, from this same site, checked before it is used. */
  function getPatch(sink, handle) {
    say('Descargando el parche...'); bar(0, 0);
    fetch('patch/' + info.patch.file).then(function (r) {
      if (!r.ok || !r.body) throw new Error('fetch');
      var reader = r.body.getReader(), parts = [], got = 0;
      return (function pump() {
        return reader.read().then(function (x) {
          if (x.done) return new Blob(parts);
          parts.push(x.value); got += x.value.length;
          bar(got / info.patch.size, got);
          return pump();
        });
      })();
    }).then(function (blob) {
      if (blob.size !== info.patch.size) throw new Error('size');
      say('Revisando el parche...');
      return blob.arrayBuffer().then(function (buf) { return crypto.subtle.digest('SHA-256', buf); }).then(function (d) {
        if (hex(d) !== info.patch.sha256.toLowerCase()) throw new Error('hash');
        decode(blob, sink, handle);
      });
    }).catch(function () { fail('No se pudo descargar el parche. Revisa tu conexión e inténtalo otra vez.'); });
  }

  /* Step four: decode, window by window, and verify the whole result. */
  function decode(patch, sink, handle) {
    say('Parcheando...'); bar(0);
    var w = newWorker();
    w.onmessage = function (e) {
      var m = e.data;
      if (m.progress !== undefined) return bar(m.progress);
      if (m.fallback) { say('Parcheando en la memoria del navegador...'); return; }
      if (m.error) {
        clearStorage();
        return fail(m.code === 'base' ? 'Tu copia es distinta (recortada o modificada). Necesitas la ROM limpia de HeartGold (USA).' : 'No se pudo parchear en este dispositivo.');
      }
      if (m.sha1 !== info.target.sha1.toLowerCase()) { clearStorage(); return fail('El resultado no coincide con el nuestro, así que no lo guardamos.'); }
      bar(null);
      if (m.saved) {
        step(5);
        say('ROM verificada. Ya está guardada donde elegiste. Solo falta cargarla en tu emulador.');
        pickAs(false); show('pt-pick-w', true);
        finish();
        return;
      }
      url && URL.revokeObjectURL(url);
      url = URL.createObjectURL(m.file);
      var a = $('pt-get');
      a.href = url; a.download = info.target.name;
      step(4);
      say('ROM verificada. Guárdala en tu dispositivo: al cerrar esta página, el navegador borra su copia.');
      show('pt-get-w', true);
      finish();
      a.focus({ preventScroll: true });
    };
    w.postMessage({ cmd: 'patch', base: rom, patch: patch, sink: sink, handle: handle, opfsName: OPFS_NAME });
  }

  /* The ending: the status and the save button rise, and the title screen from the top of the page plays beside them, loaded only now. */
  function finish() {
    $('pt-wrap').classList.add('fin');
    show('pt-end', true);
    if (!status.contains(document.activeElement) && document.activeElement === document.body) status.focus({ preventScroll: true });
  }

  function fail(t) { say(t); bar(null); step(1); pickAs(true); show('pt-pick-w', true); offerPatch(); status.focus({ preventScroll: true }); }
})();
