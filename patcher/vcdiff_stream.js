// Streaming VCDIFF decoder (RFC 3284 + xdelta3's Adler-32 and LZMA secondary sections).
// Keeps one target window in memory, and reads only the source ranges a window really copies.
(function (g) {
'use strict';
function codeTable() { // type: 0 NOOP, 1 ADD, 2 RUN, 3 COPY
  const t = []; t.push([2,0,0,0,0,0]);
  for (let s = 0; s <= 17; s++) t.push([1,s,0,0,0,0]);
  for (let m = 0; m < 9; m++) { t.push([3,0,m,0,0,0]); for (let s = 4; s <= 18; s++) t.push([3,s,m,0,0,0]); }
  for (let m = 0; m < 6; m++) for (let a = 1; a <= 4; a++) for (let c = 4; c <= 6; c++) t.push([1,a,0,3,c,m]);
  for (let m = 6; m < 9; m++) for (let a = 1; a <= 4; a++) t.push([1,a,0,3,4,m]);
  for (let m = 0; m < 9; m++) t.push([3,4,m,1,1,0]);
  if (t.length !== 256) throw new Error('code table'); return t;
}
const TABLE = codeTable();
function adler32(b) {
  let a = 1, c = 0, i = 0, n = b.length;
  while (n > 0) { let k = n < 5552 ? n : 5552; n -= k; while (k--) { a += b[i++]; c += a; } a %= 65521; c %= 65521; }
  return ((c << 16) | a) >>> 0;
}
class Cur { constructor(b, p) { this.b = b; this.p = p || 0; }
  byte() { if (this.p >= this.b.length) throw new RangeError('eof'); return this.b[this.p++]; }
  vint() { let v = 0, x; do { x = this.byte(); v = v * 128 + (x & 127); } while (x & 128); return v; } }

// Walks a window's instructions. op(type, size, addr) gets addr only for COPY.
function walk(inst, addr, copyLen, op) {
  const near = [0,0,0,0], same = new Float64Array(768); let next = 0, here = 0;
  const ic = new Cur(inst), ac = new Cur(addr);
  const one = (type, size, mode) => {
    if (type === 0) return;
    if (size === 0) size = ic.vint();
    let a = 0;
    if (type === 3) {
      const h = copyLen + here;
      if (mode === 0) a = ac.vint();
      else if (mode === 1) a = h - ac.vint();
      else if (mode < 6) a = near[mode - 2] + ac.vint();
      else a = same[(mode - 6) * 256 + ac.byte()];
      near[next] = a; next = (next + 1) & 3; same[a % 768] = a;
    }
    op(type, size, a); here += size;
  };
  while (ic.p < inst.length) { const e = TABLE[ic.byte()]; one(e[0], e[1], e[2]); one(e[3], e[4], e[5]); }
}

async function apply(o) {
  // o: patchSize, readPatch(off,len), readSource(off,len), write(u8,off), xz(u8,decSize), onWindow(info)
  let pos = 0, out = 0, stats = { windows: 0, maxCopyWin: 0, maxTouched: 0, totalTouched: 0, maxTarget: 0, secondary: null, appHeader: '' };
  const HEAD = 4096;
  let c = new Cur(await o.readPatch(0, Math.min(HEAD * 4, o.patchSize)));
  if (c.byte() !== 0xD6 || c.byte() !== 0xC3 || c.byte() !== 0xC4 || c.byte() !== 0) throw new Error('not a VCDIFF file');
  const hi = c.byte();
  if (hi & 1) stats.secondary = c.byte();
  if (hi & 2) throw new Error('custom code table');
  if (hi & 4) { const n = c.vint(); stats.appHeader = new TextDecoder().decode(c.b.subarray(c.p, c.p + n)); c.p += n; }
  pos = c.p;
  while (pos < o.patchSize) {
    c = new Cur(await o.readPatch(pos, Math.min(HEAD, o.patchSize - pos)));
    const wi = c.byte();
    if (wi & 2) throw new Error('VCD_TARGET window: not supported');
    let copyLen = 0, copyOff = 0;
    if (wi & 1) { copyLen = c.vint(); copyOff = c.vint(); }
    c.vint(); // delta length
    const tlen = c.vint(), di = c.byte(), dl = c.vint(), il = c.vint(), al = c.vint();
    let adler = null;
    if (wi & 4) { const b = c.b, p = c.p; adler = ((b[p]*16777216) + (b[p+1]<<16) + (b[p+2]<<8) + b[p+3]) >>> 0; c.p += 4; }
    const bodyOff = pos + c.p, bodyLen = dl + il + al;
    const body = await o.readPatch(bodyOff, bodyLen);
    pos = bodyOff + bodyLen;
    const sect = async (start, len, flag) => {
      const s = body.subarray(start, start + len);
      if (!(di & flag)) return s;
      const q = new Cur(s), n = q.vint();
      return o.xz(s.subarray(q.p), n, flag);
    };
    const data = await sect(0, dl, 1), inst = await sect(dl, il, 2), addr = await sect(dl + il, al, 4);
    // Pass 1: which source pages does this window copy?
    const PAGE = 65536; const pages = new Set();
    walk(inst, addr, copyLen, (t, size, a) => {
      if (t !== 3 || a >= copyLen) return;
      const e = Math.min(a + size, copyLen);
      for (let p = Math.floor(a / PAGE); p <= Math.floor((e - 1) / PAGE); p++) pages.add(p);
    });
    const sorted = [...pages].sort((x, y) => x - y), ranges = [];
    for (const p of sorted) {
      const l = ranges[ranges.length - 1];
      if (l && l.end === p * PAGE) l.end += PAGE; else ranges.push({ start: p * PAGE, end: (p + 1) * PAGE });
    }
    let touched = 0;
    let arenaPos = 0;
    for (const r of ranges) { r.end = Math.min(r.end, copyLen); const n = r.end - r.start;
      if (o.readSourceInto) { if (!o._arena || o._arena.length < arenaPos + n) { const na = new Uint8Array(Math.max(arenaPos + n, 48 << 20)); if (o._arena) na.set(o._arena.subarray(0, arenaPos)); for (const q of ranges) if (q.bytes) q.bytes = na.subarray(q.bytes.byteOffset, q.bytes.byteOffset + q.bytes.length); o._arena = na; }
        r.bytes = o._arena.subarray(arenaPos, arenaPos + n); await o.readSourceInto(copyOff + r.start, n, r.bytes); arenaPos += n; }
      else r.bytes = await o.readSource(copyOff + r.start, n);
      touched += n; }
    // Pass 2: build the target window.
    if (!o._tgt || o._tgt.length !== tlen) o._tgt = new Uint8Array(tlen); const tgt = o._tgt; let tp = 0, dp = 0, ri = 0;
    const findRange = (a) => { let r = ranges[ri]; if (r && a >= r.start && a < r.end) return r;
      let lo = 0, hi = ranges.length - 1; while (lo <= hi) { const m = (lo + hi) >> 1; r = ranges[m]; if (a < r.start) hi = m - 1; else if (a >= r.end) lo = m + 1; else { ri = m; return r; } } throw new Error('range'); };
    walk(inst, addr, copyLen, (t, size, a) => {
      if (t === 1) { tgt.set(data.subarray(dp, dp + size), tp); dp += size; tp += size; }
      else if (t === 2) { tgt.fill(data[dp++], tp, tp + size); tp += size; }
      else {
        let left = size;
        while (left > 0 && a < copyLen) { const r = findRange(a), n = Math.min(left, r.end - a), s = a - r.start;
          tgt.set(r.bytes.subarray(s, s + n), tp); tp += n; a += n; left -= n; }
        if (left > 0) { const from = a - copyLen;
          if (from + left <= tp) { tgt.copyWithin(tp, from, from + left); tp += left; }
          else { for (let i = 0; i < left; i++) tgt[tp + i] = tgt[from + i]; tp += left; } }
      }
    });
    if (tp !== tlen) throw new Error('window ' + stats.windows + ': built ' + tp + ' of ' + tlen);
    if (adler !== null && adler32(tgt) !== adler) { const e = new Error('window ' + stats.windows + ': checksum mismatch (wrong base ROM or a damaged patch)'); e.code = 'ADLER'; throw e; }
    await o.write(tgt, out); out += tlen;
    stats.windows++; stats.maxCopyWin = Math.max(stats.maxCopyWin, copyLen); stats.maxTouched = Math.max(stats.maxTouched, touched); stats.totalTouched += touched; stats.maxTarget = Math.max(stats.maxTarget, tlen);
    if (o.yieldEach) await new Promise(r => setTimeout(r, o.yieldEach));
    if (o.onWindow) o.onWindow({ w: stats.windows, out, pos, touched, copyLen });
  }
  stats.outSize = out; return stats;
}
g.VcdiffStream = { apply, adler32 };
})(typeof globalThis !== 'undefined' ? globalThis : this);
