/* The patcher's Worker. Reads the ROM and the patch only through slices, so memory stays near one patch window. Nothing here leaves the device. */
importScripts('vcdiff_stream.js', 'xz_persist.js', 'sha1.umd.min.js', 'crc32.umd.min.js');
var FR = new FileReaderSync();

function slice(b, off, len) { return new Uint8Array(FR.readAsArrayBuffer(b.slice(off, off + len))); }

async function crc(base) {
  var h = await hashwasm.createCRC32(), CH = 1 << 20;
  h.init();
  for (var o = 0; o < base.size; o += CH) {
    h.update(slice(base, o, CH));
    if (o % (16 << 20) === 0) postMessage({ progress: o / base.size });
  }
  postMessage({ crc: h.digest().toUpperCase() });
}

async function openSink(sink, handle, name) {
  if (sink === 'handle') {
    var wr = await handle.createWritable();
    return { write: function (u, off) { return wr.write({ type: 'write', position: off, data: u }); }, finish: async function () { await wr.close(); return { saved: true }; } };
  }
  if (sink === 'opfs') {
    try {
      var root = await navigator.storage.getDirectory();
      var fh = await root.getFileHandle(name, { create: true });
      var ah = await fh.createSyncAccessHandle();
      ah.truncate(0);
      return { write: function (u, off) { ah.write(u, { at: off }); }, finish: async function () { ah.flush(); ah.close(); return { file: await fh.getFile() }; } };
    } catch (e) { postMessage({ fallback: true }); }   /* private windows refuse it */
  }
  var parts = [];
  return { write: function (u) { parts.push(new Blob([u])); }, finish: async function () { return { file: new Blob(parts) }; } };
}

async function patch(m) {
  var decs = null;
  var sha = await hashwasm.createSHA1();
  sha.init();
  var out = await openSink(m.sink, m.handle, m.opfsName);
  await VcdiffStream.apply({
    patchSize: m.patch.size,
    readPatch: async function (o, l) { return slice(m.patch, o, l); },
    readSource: async function (o, l) { return slice(m.base, o, l); },
    readSourceInto: async function (o, l, dst) {
      var C = 1 << 20;
      for (var i = 0; i < l; i += C) dst.set(slice(m.base, o + i, Math.min(C, l - i)), i);
    },
    xz: async function (u, n, f) {
      if (!decs) {   /* only a patch with secondary compression needs it */
        var wasm = await (await fetch('xz.wasm')).arrayBuffer();
        decs = { 1: await XzPersist.make(wasm), 2: await XzPersist.make(wasm), 4: await XzPersist.make(wasm) };
      }
      return decs[f].next(u, n);
    },
    write: async function (u, off) { sha.update(u); await out.write(u, off); },
    onWindow: function (i) { postMessage({ progress: i.pos / m.patch.size }); }
  });
  var r = await out.finish();
  r.sha1 = sha.digest();
  postMessage(r);
}

onmessage = function (ev) {
  var m = ev.data;
  (m.cmd === 'crc' ? crc(m.base) : patch(m)).catch(function (e) {
    postMessage({ error: true, code: /checksum mismatch/.test(String(e)) ? 'base' : 'other' });
  });
};
