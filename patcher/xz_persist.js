// xdelta3's LZMA sections are one continuing xz stream per section kind (data, inst, addr), flushed at each window's end.
// This keeps three decoders alive across windows, on the wasm XZ Embedded build of xz-decompress.
(function (g) { 'use strict';
class Dec { constructor(inst) { const e = this.e = inst.exports; this.m = e.memory; this.ptr = e.create_context(); this.r();
    this.bufSize = this.m32[0]; this.inStart = this.m32[1] - this.ptr; this.outStart = this.m32[4] - this.ptr; }
  r() { if (this.m.buffer !== (this.m8 && this.m8.buffer)) { this.m8 = new Uint8Array(this.m.buffer, this.ptr); this.m32 = new Uint32Array(this.m.buffer, this.ptr); } }
  decode(u8, n) { const out = new Uint8Array(n); let op = 0, ip = 0;
    const need = () => this.m32[2] === this.m32[3];
    while (ip < u8.length || !need()) {
      if (need()) { const k = Math.min(this.bufSize, u8.length - ip); this.r(); this.m8.set(u8.subarray(ip, ip + k), this.inStart); this.e.supply_input(this.ptr, k); this.r(); ip += k; }
      const res = this.e.get_next_output(this.ptr); this.r();
      if (res !== 0 && res !== 1) throw new Error('xz error ' + res);
      const len = this.m32[5]; if (op + len > n) throw new Error('xz overflow'); out.set(this.m8.subarray(this.outStart, this.outStart + len), op); op += len; this.m32[5] = 0;
    }
    if (op !== n) throw new Error('xz short ' + op + ' of ' + n); return out; } }
g.XzPersist = { async make(wasmBytes) { const d = new Dec((await WebAssembly.instantiate(wasmBytes, {})).instance); return { next(u8, n) { return d.decode(u8, n); } }; } };
})(typeof globalThis !== 'undefined' ? globalThis : this);
