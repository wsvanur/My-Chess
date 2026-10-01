/* engine.js — skákreglur, leitarvél og námskerfi (án utanaðkomandi safna) */
(function (root) {
'use strict';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const FILES = 'abcdefgh';
const P = 1, N = 2, B = 3, R = 4, Q = 5, K = 6;
const MATE = 20000, INF = 30000, MAXPLY = 100;
const VAL = [0, 100, 320, 330, 500, 900, 0];
const NF = 14;
// Upphafsvægi matsþátta (cp). Námið stillir margfaldara (mult) á þessi gildi.
const W0 = [100, 320, 330, 500, 900, 30, 1, 1, -12, -10, 4, 20, 10, 12];
const LEARN_BONUS = 70;           // hámarksbónus/refsing (cp) úr reynslu af leik
const MULT_MIN = 0.7, MULT_MAX = 1.4;

// ---------- töflur ----------
const DF = [0, 0, 1, -1, 1, -1, 1, -1], DR = [1, -1, 0, 0, 1, 1, -1, -1];
const rays = [], knightT = [], kingT = [];
for (let sq = 0; sq < 64; sq++) {
  const f = sq & 7, r = sq >> 3, rs = [];
  for (let d = 0; d < 8; d++) {
    const a = []; let ff = f + DF[d], rr = r + DR[d];
    while (ff >= 0 && ff < 8 && rr >= 0 && rr < 8) { a.push(rr * 8 + ff); ff += DF[d]; rr += DR[d]; }
    rs.push(Int8Array.from(a));
  }
  rays.push(rs);
  const kn = [], kg = [];
  for (const [a, b] of [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]]) {
    const ff = f + a, rr = r + b; if (ff >= 0 && ff < 8 && rr >= 0 && rr < 8) kn.push(rr * 8 + ff);
  }
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
    if (!a && !b) continue; const ff = f + a, rr = r + b;
    if (ff >= 0 && ff < 8 && rr >= 0 && rr < 8) kg.push(rr * 8 + ff);
  }
  knightT.push(Int8Array.from(kn)); kingT.push(Int8Array.from(kg));
}
const CM = new Int8Array(64).fill(15);
CM[0] = 13; CM[7] = 14; CM[4] = 12; CM[56] = 7; CM[63] = 11; CM[60] = 3;

// Zobrist (fast fræ => sömu gildi í hvert skipti)
let seed = 0x9E3779B9 | 0;
function rnd() { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return seed | 0; }
const ZP1 = new Int32Array(13 * 64), ZP2 = new Int32Array(13 * 64);
const ZC1 = new Int32Array(16), ZC2 = new Int32Array(16), ZE1 = new Int32Array(8), ZE2 = new Int32Array(8);
for (let i = 0; i < ZP1.length; i++) { ZP1[i] = rnd(); ZP2[i] = rnd(); }
for (let i = 0; i < 16; i++) { ZC1[i] = rnd(); ZC2[i] = rnd(); }
for (let i = 0; i < 8; i++) { ZE1[i] = rnd(); ZE2[i] = rnd(); }
const ZS1 = rnd(), ZS2 = rnd();

// Staðsetningartöflur (Simplified Evaluation Function), hvítur séður ofan frá (8. reitaröð fyrst)
const PST = [
  [0,0,0,0,0,0,0,0, 50,50,50,50,50,50,50,50, 10,10,20,30,30,20,10,10, 5,5,10,25,25,10,5,5, 0,0,0,20,20,0,0,0, 5,-5,-10,0,0,-10,-5,5, 5,10,10,-20,-20,10,10,5, 0,0,0,0,0,0,0,0],
  [-50,-40,-30,-30,-30,-30,-40,-50, -40,-20,0,0,0,0,-20,-40, -30,0,10,15,15,10,0,-30, -30,5,15,20,20,15,5,-30, -30,0,15,20,20,15,0,-30, -30,5,10,15,15,10,5,-30, -40,-20,0,5,5,0,-20,-40, -50,-40,-30,-30,-30,-30,-40,-50],
  [-20,-10,-10,-10,-10,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,10,10,5,0,-10, -10,5,5,10,10,5,5,-10, -10,0,10,10,10,10,0,-10, -10,10,10,10,10,10,10,-10, -10,5,0,0,0,0,5,-10, -20,-10,-10,-10,-10,-10,-10,-20],
  [0,0,0,0,0,0,0,0, 5,10,10,10,10,10,10,5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, 0,0,0,5,5,0,0,0],
  [-20,-10,-10,-5,-5,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,5,5,5,0,-10, -5,0,5,5,5,5,0,-5, 0,0,5,5,5,5,0,-5, -10,5,5,5,5,5,0,-10, -10,0,5,0,0,0,0,-10, -20,-10,-10,-5,-5,-10,-10,-20]
];
const KM = [-30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -20,-30,-30,-40,-40,-30,-30,-20, -10,-20,-20,-20,-20,-20,-20,-10, 20,20,0,0,0,0,20,20, 20,30,10,0,0,10,30,20];
const KE = [-50,-40,-30,-20,-20,-30,-40,-50, -30,-20,-10,0,0,-10,-20,-30, -30,-10,20,30,30,20,-10,-30, -30,-10,30,40,40,30,-10,-30, -30,-10,30,40,40,30,-10,-30, -30,-10,20,30,30,20,-10,-30, -30,-30,0,0,0,0,-30,-30, -50,-30,-30,-30,-30,-30,-30,-50];

const POP = new Uint8Array(256); for (let i = 1; i < 256; i++) POP[i] = POP[i >> 1] + (i & 1);

// ---------- mat (eiginleikar hvítur − svartur) ----------
const wpm = new Int32Array(10), bpm = new Int32Array(10);
const rkSq = new Int8Array(20), rkSide = new Int8Array(20);
function features(pos, f) {
  f.fill(0); wpm.fill(0); bpm.fill(0);
  const b = pos.board; let phase = 0, wb = 0, bb = 0, nr = 0;
  for (let sq = 0; sq < 64; sq++) {
    const p = b[sq]; if (p === 0) continue;
    const side = p > 0 ? 1 : -1, a = p * side, r = sq >> 3, fl = sq & 7;
    const idx = side > 0 ? (7 - r) * 8 + fl : r * 8 + fl;
    switch (a) {
      case P: f[0] += side; if (side > 0) wpm[fl + 1] |= (1 << r); else bpm[fl + 1] |= (1 << r); f[6] += side * PST[0][idx]; break;
      case N: f[1] += side; f[6] += side * PST[1][idx]; phase += 1; break;
      case B: f[2] += side; f[6] += side * PST[2][idx]; phase += 1; if (side > 0) wb++; else bb++; break;
      case R: f[3] += side; f[6] += side * PST[3][idx]; phase += 2; rkSq[nr] = sq; rkSide[nr] = side; nr++; break;
      case Q: f[4] += side; f[6] += side * PST[4][idx]; phase += 4; break;
    }
  }
  const ph = Math.min(phase, 24) / 24;
  const wk = pos.kingSq[0], bk = pos.kingSq[1];
  const iw = (7 - (wk >> 3)) * 8 + (wk & 7), ib = (bk >> 3) * 8 + (bk & 7);
  f[7] = ph * (KM[iw] - KM[ib]) + (1 - ph) * (KE[iw] - KE[ib]);
  f[5] = (wb >= 2 ? 1 : 0) - (bb >= 2 ? 1 : 0);
  for (let fl = 0; fl < 8; fl++) {
    const w = wpm[fl + 1], k = bpm[fl + 1], cw = POP[w], cb = POP[k];
    if (cw > 1) f[8] += cw - 1; if (cb > 1) f[8] -= cb - 1;
    if (cw && !(wpm[fl] | wpm[fl + 2])) f[9] += cw;
    if (cb && !(bpm[fl] | bpm[fl + 2])) f[9] -= cb;
    for (let r = 1; r < 7; r++) {
      if (w & (1 << r)) { if (((bpm[fl] | bpm[fl + 1] | bpm[fl + 2]) >> (r + 1)) === 0) { const s = r - 1; f[10] += s * s; } }
      if (k & (1 << r)) { if (((wpm[fl] | wpm[fl + 1] | wpm[fl + 2]) & ((1 << r) - 1)) === 0) { const s = 6 - r; f[10] -= s * s; } }
    }
  }
  for (let i = 0; i < nr; i++) {
    const fl = rkSq[i] & 7, side = rkSide[i];
    const own = side > 0 ? wpm[fl + 1] : bpm[fl + 1], opp = side > 0 ? bpm[fl + 1] : wpm[fl + 1];
    if (!own) { if (!opp) f[11] += side; else f[12] += side; }
  }
  const wr = wk >> 3, wf = wk & 7;
  if (wr <= 1) { let c = 0; for (let ff = wf - 1; ff <= wf + 1; ff++) if (ff >= 0 && ff < 8 && (wpm[ff + 1] & (1 << (wr + 1)))) c++; f[13] += c * ph; }
  const br = bk >> 3, bf = bk & 7;
  if (br >= 6) { let c = 0; for (let ff = bf - 1; ff <= bf + 1; ff++) if (ff >= 0 && ff < 8 && (bpm[ff + 1] & (1 << (br - 1)))) c++; f[13] -= c * ph; }
}

// ---------- umferðartafla (deild) ----------
const TTBITS = 18, TTSIZE = 1 << TTBITS, TTMASK = TTSIZE - 1;
const ttH2 = new Int32Array(TTSIZE), ttMove = new Int32Array(TTSIZE), ttScore = new Int16Array(TTSIZE);
const ttDepth = new Int8Array(TTSIZE), ttFlag = new Int8Array(TTSIZE);
function ttClear() { ttDepth.fill(-1); }

function sqName(sq) { return FILES[sq & 7] + ((sq >> 3) + 1); }
function uci(m) { const pr = (m >> 12) & 7; return sqName(m & 63) + sqName((m >> 6) & 63) + (pr ? 'nbrq'[pr - 2] : ''); }

// ---------- staða ----------
class Position {
  constructor(fen) {
    this.board = new Int8Array(64); this.kingSq = [4, 60];
    const M = 4096;
    this.uMove = new Int32Array(M); this.uCap = new Int8Array(M); this.uCast = new Int8Array(M);
    this.uEp = new Int8Array(M); this.uHalf = new Int16Array(M);
    this.uH1 = new Int32Array(M); this.uH2 = new Int32Array(M);
    this.hk1 = new Int32Array(M + 1); this.hk2 = new Int32Array(M + 1);
    this.bufs = Array.from({ length: 128 }, () => new Int32Array(256));
    this.scs = Array.from({ length: 128 }, () => new Int32Array(256));
    this.killers = new Int32Array(256); this.hist = new Int32Array(4096);
    this.F = new Float64Array(NF); this.W = new Float64Array(W0);
    this.setFen(fen || START);
  }
  setFen(fen) {
    const parts = fen.trim().split(/\s+/); this.board.fill(0);
    const rows = parts[0].split('/');
    for (let i = 0; i < 8; i++) {
      let f = 0; const r = 7 - i;
      for (const ch of rows[i]) {
        if (ch >= '1' && ch <= '8') f += +ch;
        else {
          const lo = ch.toLowerCase(), t = 'pnbrqk'.indexOf(lo) + 1, sq = r * 8 + f;
          this.board[sq] = ch === lo ? -t : t;
          if (t === K) this.kingSq[ch === lo ? 1 : 0] = sq; f++;
        }
      }
    }
    this.turn = parts[1] === 'b' ? -1 : 1;
    let c = 0; const cs = parts[2] || '-';
    if (cs.includes('K')) c |= 1; if (cs.includes('Q')) c |= 2; if (cs.includes('k')) c |= 4; if (cs.includes('q')) c |= 8;
    this.castle = c;
    this.ep = parts[3] && parts[3] !== '-' ? (parts[3].charCodeAt(0) - 97) + (parts[3].charCodeAt(1) - 49) * 8 : -1;
    this.half = +parts[4] || 0; this.full = +parts[5] || 1; this.ply = 0;
    let h1 = 0, h2 = 0;
    for (let sq = 0; sq < 64; sq++) { const p = this.board[sq]; if (p) { h1 ^= ZP1[(p + 6) * 64 + sq]; h2 ^= ZP2[(p + 6) * 64 + sq]; } }
    h1 ^= ZC1[this.castle]; h2 ^= ZC2[this.castle];
    if (this.ep >= 0) { h1 ^= ZE1[this.ep & 7]; h2 ^= ZE2[this.ep & 7]; }
    if (this.turn < 0) { h1 ^= ZS1; h2 ^= ZS2; }
    this.h1 = h1; this.h2 = h2; this.hk1[0] = h1; this.hk2[0] = h2;
  }
  fen() {
    let s = '';
    for (let r = 7; r >= 0; r--) {
      let e = 0;
      for (let f = 0; f < 8; f++) {
        const p = this.board[r * 8 + f];
        if (!p) { e++; continue; }
        if (e) { s += e; e = 0; }
        const ch = 'pnbrqk'[Math.abs(p) - 1]; s += p > 0 ? ch.toUpperCase() : ch;
      }
      if (e) s += e; if (r) s += '/';
    }
    const c = (this.castle & 1 ? 'K' : '') + (this.castle & 2 ? 'Q' : '') + (this.castle & 4 ? 'k' : '') + (this.castle & 8 ? 'q' : '');
    return s + ' ' + (this.turn > 0 ? 'w' : 'b') + ' ' + (c || '-') + ' ' + (this.ep >= 0 ? sqName(this.ep) : '-') + ' ' + this.half + ' ' + this.full;
  }
  key() { return this.fen().split(' ').slice(0, 4).join(' '); }

  attacked(sq, by) {
    const b = this.board, f = sq & 7, r = sq >> 3;
    if (by > 0) { if (r > 0) { if (f > 0 && b[sq - 9] === P) return true; if (f < 7 && b[sq - 7] === P) return true; } }
    else { if (r < 7) { if (f > 0 && b[sq + 7] === -P) return true; if (f < 7 && b[sq + 9] === -P) return true; } }
    const kn = knightT[sq], bn = by * N; for (let i = 0; i < kn.length; i++) if (b[kn[i]] === bn) return true;
    const kg = kingT[sq], bkk = by * K; for (let i = 0; i < kg.length; i++) if (b[kg[i]] === bkk) return true;
    const rs = rays[sq], br = by * R, bq = by * Q, bb = by * B;
    for (let d = 0; d < 4; d++) { const ray = rs[d]; for (let j = 0; j < ray.length; j++) { const q = b[ray[j]]; if (q) { if (q === br || q === bq) return true; break; } } }
    for (let d = 4; d < 8; d++) { const ray = rs[d]; for (let j = 0; j < ray.length; j++) { const q = b[ray[j]]; if (q) { if (q === bb || q === bq) return true; break; } } }
    return false;
  }
  inCheck() { return this.attacked(this.kingSq[this.turn > 0 ? 0 : 1], -this.turn); }

  // gervi-löglegir leikir; m = from | to<<6 | promo<<12 | flags<<16 (1 ep, 2 hrókering, 4 tvöfalt peð, 8 taka)
  gen(buf, caps) {
    let n = 0; const b = this.board, t = this.turn;
    for (let sq = 0; sq < 64; sq++) {
      const p = b[sq]; if (p * t <= 0) continue; const a = p * t;
      if (a === P) {
        const f = sq & 7, r = sq >> 3, fwd = sq + 8 * t, promoR = t > 0 ? 6 : 1, startR = t > 0 ? 1 : 6;
        if (b[fwd] === 0) {
          if (r === promoR) { for (let pr = 5; pr >= 2; pr--) buf[n++] = sq | (fwd << 6) | (pr << 12); }
          else if (!caps) { buf[n++] = sq | (fwd << 6); if (r === startR && b[fwd + 8 * t] === 0) buf[n++] = sq | ((fwd + 8 * t) << 6) | (4 << 16); }
        }
        for (let df = -1; df <= 1; df += 2) {
          const ff = f + df; if (ff < 0 || ff > 7) continue;
          const to = fwd + df, tg = b[to];
          if (tg * t < 0) {
            if (r === promoR) { for (let pr = 5; pr >= 2; pr--) buf[n++] = sq | (to << 6) | (pr << 12) | (8 << 16); }
            else buf[n++] = sq | (to << 6) | (8 << 16);
          } else if (tg === 0 && to === this.ep) buf[n++] = sq | (to << 6) | (9 << 16);
        }
      } else if (a === N || a === K) {
        const tb = a === N ? knightT[sq] : kingT[sq];
        for (let i = 0; i < tb.length; i++) {
          const to = tb[i], tg = b[to]; if (tg * t > 0) continue;
          if (tg === 0) { if (!caps) buf[n++] = sq | (to << 6); } else buf[n++] = sq | (to << 6) | (8 << 16);
        }
        if (a === K && !caps) {
          if (t > 0 && sq === 4) {
            if ((this.castle & 1) && b[5] === 0 && b[6] === 0 && !this.attacked(4, -1) && !this.attacked(5, -1) && !this.attacked(6, -1)) buf[n++] = 4 | (6 << 6) | (2 << 16);
            if ((this.castle & 2) && b[3] === 0 && b[2] === 0 && b[1] === 0 && !this.attacked(4, -1) && !this.attacked(3, -1) && !this.attacked(2, -1)) buf[n++] = 4 | (2 << 6) | (2 << 16);
          } else if (t < 0 && sq === 60) {
            if ((this.castle & 4) && b[61] === 0 && b[62] === 0 && !this.attacked(60, 1) && !this.attacked(61, 1) && !this.attacked(62, 1)) buf[n++] = 60 | (62 << 6) | (2 << 16);
            if ((this.castle & 8) && b[59] === 0 && b[58] === 0 && b[57] === 0 && !this.attacked(60, 1) && !this.attacked(59, 1) && !this.attacked(58, 1)) buf[n++] = 60 | (58 << 6) | (2 << 16);
          }
        }
      } else {
        const d0 = a === B ? 4 : 0, d1 = a === R ? 4 : 8, rs = rays[sq];
        for (let d = d0; d < d1; d++) {
          const ray = rs[d];
          for (let j = 0; j < ray.length; j++) {
            const to = ray[j], tg = b[to];
            if (tg === 0) { if (!caps) buf[n++] = sq | (to << 6); }
            else { if (tg * t < 0) buf[n++] = sq | (to << 6) | (8 << 16); break; }
          }
        }
      }
    }
    return n;
  }

  make(m) {
    const b = this.board, from = m & 63, to = (m >> 6) & 63, promo = (m >> 12) & 7, fl = m >> 16, t = this.turn;
    const p = b[from]; let cap = b[to]; const i = this.ply;
    this.uMove[i] = m; this.uCast[i] = this.castle; this.uEp[i] = this.ep; this.uHalf[i] = this.half; this.uH1[i] = this.h1; this.uH2[i] = this.h2;
    let h1 = this.h1, h2 = this.h2;
    if (this.ep >= 0) { h1 ^= ZE1[this.ep & 7]; h2 ^= ZE2[this.ep & 7]; }
    h1 ^= ZC1[this.castle]; h2 ^= ZC2[this.castle];
    const pi = (p + 6) * 64; h1 ^= ZP1[pi + from]; h2 ^= ZP2[pi + from]; b[from] = 0;
    if (fl & 1) { const cs = to - 8 * t; cap = b[cs]; b[cs] = 0; h1 ^= ZP1[(cap + 6) * 64 + cs]; h2 ^= ZP2[(cap + 6) * 64 + cs]; }
    else if (cap) { h1 ^= ZP1[(cap + 6) * 64 + to]; h2 ^= ZP2[(cap + 6) * 64 + to]; }
    this.uCap[i] = cap;
    const np = promo ? t * promo : p; b[to] = np; h1 ^= ZP1[(np + 6) * 64 + to]; h2 ^= ZP2[(np + 6) * 64 + to];
    if (fl & 2) {
      let rf, rt; if (to === 6) { rf = 7; rt = 5; } else if (to === 2) { rf = 0; rt = 3; } else if (to === 62) { rf = 63; rt = 61; } else { rf = 56; rt = 59; }
      const rk = b[rf]; b[rf] = 0; b[rt] = rk;
      h1 ^= ZP1[(rk + 6) * 64 + rf] ^ ZP1[(rk + 6) * 64 + rt]; h2 ^= ZP2[(rk + 6) * 64 + rf] ^ ZP2[(rk + 6) * 64 + rt];
    }
    if (p === K * t) this.kingSq[t > 0 ? 0 : 1] = to;
    this.castle &= CM[from] & CM[to];
    this.ep = (fl & 4) ? from + 8 * t : -1;
    h1 ^= ZC1[this.castle]; h2 ^= ZC2[this.castle];
    if (this.ep >= 0) { h1 ^= ZE1[this.ep & 7]; h2 ^= ZE2[this.ep & 7]; }
    this.half = (p === P || p === -P || cap) ? 0 : this.half + 1;
    if (t < 0) this.full++;
    this.turn = -t; h1 ^= ZS1; h2 ^= ZS2;
    this.h1 = h1; this.h2 = h2; this.ply++; this.hk1[this.ply] = h1; this.hk2[this.ply] = h2;
  }
  unmake() {
    this.ply--; const i = this.ply, m = this.uMove[i];
    const from = m & 63, to = (m >> 6) & 63, promo = (m >> 12) & 7, fl = m >> 16, b = this.board, t = -this.turn, cap = this.uCap[i];
    const moved = promo ? t * P : b[to];
    b[from] = moved;
    if (fl & 1) { b[to] = 0; b[to - 8 * t] = cap; } else b[to] = cap;
    if (fl & 2) {
      let rf, rt; if (to === 6) { rf = 7; rt = 5; } else if (to === 2) { rf = 0; rt = 3; } else if (to === 62) { rf = 63; rt = 61; } else { rf = 56; rt = 59; }
      b[rf] = b[rt]; b[rt] = 0;
    }
    if (moved === K * t) this.kingSq[t > 0 ? 0 : 1] = from;
    this.castle = this.uCast[i]; this.ep = this.uEp[i]; this.half = this.uHalf[i]; this.h1 = this.uH1[i]; this.h2 = this.uH2[i];
    this.turn = t; if (t < 0) this.full--;
  }
  makeNull() {
    const i = this.ply; this.uMove[i] = 0; this.uCast[i] = this.castle; this.uEp[i] = this.ep; this.uHalf[i] = this.half; this.uH1[i] = this.h1; this.uH2[i] = this.h2;
    if (this.ep >= 0) { this.h1 ^= ZE1[this.ep & 7]; this.h2 ^= ZE2[this.ep & 7]; }
    this.ep = -1; this.turn = -this.turn; this.h1 ^= ZS1; this.h2 ^= ZS2; this.half++;
    this.ply++; this.hk1[this.ply] = this.h1; this.hk2[this.ply] = this.h2;
  }
  unmakeNull() {
    this.ply--; const i = this.ply; this.ep = this.uEp[i]; this.half = this.uHalf[i]; this.h1 = this.uH1[i]; this.h2 = this.uH2[i]; this.turn = -this.turn;
  }
  legalMoves() {
    const buf = new Int32Array(256), n = this.gen(buf, false), out = [], k = this.turn > 0 ? 0 : 1;
    for (let i = 0; i < n; i++) { const m = buf[i]; this.make(m); const ok = !this.attacked(this.kingSq[k], this.turn); this.unmake(); if (ok) out.push(m); }
    return out;
  }
  perft(d) {
    if (d === 0) return 1; const ms = this.legalMoves(); if (d === 1) return ms.length;
    let n = 0; for (const m of ms) { this.make(m); n += this.perft(d - 1); this.unmake(); } return n;
  }
  san(m) {
    const from = m & 63, to = (m >> 6) & 63, promo = (m >> 12) & 7, fl = m >> 16, a = Math.abs(this.board[from]); let s;
    if (fl & 2) s = to % 8 === 6 ? 'O-O' : 'O-O-O';
    else if (a === P) { s = (fl & 8) ? FILES[from & 7] + 'x' : ''; s += sqName(to); if (promo) s += '=' + 'NBRQ'[promo - 2]; }
    else {
      s = 'PNBRQK'[a - 1];
      let sameFile = false, sameRank = false, other = false;
      for (const o of this.legalMoves()) {
        if (o === m) continue; const of = o & 63;
        if (((o >> 6) & 63) === to && Math.abs(this.board[of]) === a) { other = true; if ((of & 7) === (from & 7)) sameFile = true; if ((of >> 3) === (from >> 3)) sameRank = true; }
      }
      if (other) { if (!sameFile) s += FILES[from & 7]; else if (!sameRank) s += (from >> 3) + 1; else s += sqName(from); }
      if (fl & 8) s += 'x'; s += sqName(to);
    }
    this.make(m);
    if (this.inCheck()) s += this.legalMoves().length ? '+' : '#';
    this.unmake(); return s;
  }
  isRep() {
    const lim = Math.max(0, this.ply - this.half);
    for (let i = this.ply - 2; i >= lim; i -= 2) if (this.hk1[i] === this.h1 && this.hk2[i] === this.h2) return true;
    return false;
  }
  hasPieces(t) {
    const b = this.board; for (let sq = 0; sq < 64; sq++) { const p = b[sq] * t; if (p > 1 && p < 6) return true; } return false;
  }

  setWeights(mult) { for (let i = 0; i < NF; i++) this.W[i] = W0[i] * (mult ? mult[i] : 1); }
  evaluate() {
    features(this, this.F); let s = 0; for (let i = 0; i < NF; i++) s += this.W[i] * this.F[i]; return s;
  }

  scoreMoves(buf, n, sc, ply, hm) {
    const b = this.board;
    for (let i = 0; i < n; i++) {
      const m = buf[i], to = (m >> 6) & 63, from = m & 63, fl = m >> 16, promo = (m >> 12) & 7; let s;
      if (m === hm) s = 1000000;
      else if (fl & 8) { const v = (fl & 1) ? P : Math.abs(b[to]); s = 100000 + VAL[v] * 10 - Math.abs(b[from]) + (promo ? VAL[promo] * 10 : 0); }
      else if (promo) s = 95000 + promo;
      else if (m === this.killers[ply * 2]) s = 90000;
      else if (m === this.killers[ply * 2 + 1]) s = 80000;
      else s = this.hist[from * 64 + to];
      sc[i] = s;
    }
  }
  tick() { if ((++this.nodes & 1023) === 0 && this.canStop && Date.now() > this.deadline) this.stopped = true; }

  quiesce(alpha, beta, ply) {
    this.tick(); if (this.stopped) return 0;
    const t = this.turn; let stand = t * this.evaluate();
    if (ply >= MAXPLY) return stand;
    if (stand >= beta) return stand; if (stand > alpha) alpha = stand;
    const buf = this.bufs[ply], sc = this.scs[ply], n = this.gen(buf, true), k = t > 0 ? 0 : 1;
    this.scoreMoves(buf, n, sc, ply, 0);
    for (let i = 0; i < n; i++) {
      let bi = i, bs = sc[i]; for (let j = i + 1; j < n; j++) if (sc[j] > bs) { bs = sc[j]; bi = j; }
      const tm = buf[i]; buf[i] = buf[bi]; buf[bi] = tm; const ts = sc[i]; sc[i] = sc[bi]; sc[bi] = ts;
      this.make(buf[i]);
      if (this.attacked(this.kingSq[k], this.turn)) { this.unmake(); continue; }
      const s = -this.quiesce(-beta, -alpha, ply + 1); this.unmake();
      if (this.stopped) return 0;
      if (s > stand) { stand = s; if (s > alpha) { alpha = s; if (alpha >= beta) break; } }
    }
    return stand;
  }

  search(depth, alpha, beta, ply) {
    this.tick(); if (this.stopped) return 0;
    if (this.half >= 100 || this.isRep()) return 0;
    const t = this.turn, k = t > 0 ? 0 : 1;
    const inCheck = this.attacked(this.kingSq[k], -t);
    if (inCheck && ply < 60) depth++;
    if (depth <= 0 || ply >= MAXPLY) return this.quiesce(alpha, beta, ply);
    const idx = this.h1 & TTMASK; let hm = 0;
    if (ttDepth[idx] >= 0 && ttH2[idx] === this.h2) {
      hm = ttMove[idx];
      if (ttDepth[idx] >= depth) {
        const f = ttFlag[idx], s = ttScore[idx];
        if (f === 0) return s; if (f === 1 && s >= beta) return s; if (f === 2 && s <= alpha) return s;
      }
    }
    if (!inCheck && depth >= 3 && beta < MATE - 500 && this.hasPieces(t)) {
      this.makeNull(); const s = -this.search(depth - 3, -beta, -beta + 1, ply + 1); this.unmakeNull();
      if (this.stopped) return 0; if (s >= beta) return beta;
    }
    const buf = this.bufs[ply], sc = this.scs[ply], n = this.gen(buf, false);
    this.scoreMoves(buf, n, sc, ply, hm);
    let best = -INF, bestMove = 0, legal = 0; const origAlpha = alpha;
    for (let i = 0; i < n; i++) {
      let bi = i, bs = sc[i]; for (let j = i + 1; j < n; j++) if (sc[j] > bs) { bs = sc[j]; bi = j; }
      const tm = buf[i]; buf[i] = buf[bi]; buf[bi] = tm; const ts = sc[i]; sc[i] = sc[bi]; sc[bi] = ts;
      const m = buf[i];
      this.make(m);
      if (this.attacked(this.kingSq[k], this.turn)) { this.unmake(); continue; }
      legal++;
      let s;
      if (legal > 4 && depth >= 3 && !inCheck && !(m >> 16 & 8) && !((m >> 12) & 7)) {
        s = -this.search(depth - 2, -alpha - 1, -alpha, ply + 1);
        if (s > alpha) s = -this.search(depth - 1, -beta, -alpha, ply + 1);
      } else s = -this.search(depth - 1, -beta, -alpha, ply + 1);
      this.unmake();
      if (this.stopped) return 0;
      if (s > best) {
        best = s; bestMove = m;
        if (s > alpha) {
          alpha = s;
          if (alpha >= beta) {
            if (!(m >> 16 & 8) && !((m >> 12) & 7)) {
              if (this.killers[ply * 2] !== m) { this.killers[ply * 2 + 1] = this.killers[ply * 2]; this.killers[ply * 2] = m; }
              this.hist[(m & 63) * 64 + ((m >> 6) & 63)] += depth * depth;
            }
            break;
          }
        }
      }
    }
    if (legal === 0) return inCheck ? -MATE + ply : 0;
    if (Math.abs(best) < MATE - 1000) {
      ttH2[idx] = this.h2; ttDepth[idx] = depth; ttScore[idx] = best; ttMove[idx] = bestMove;
      ttFlag[idx] = best <= origAlpha ? 2 : (best >= beta ? 1 : 0);
    }
    return best;
  }

  // Velur leik. brain gefur matsvægi og reynslu; opts: {ms, maxDepth, noise}
  think(brain, opts) {
    opts = opts || {};
    const ms = opts.ms || 700, maxDepth = opts.maxDepth || 6, noise = opts.noise || 0;
    this.setWeights(brain && brain.mult);
    ttClear(); this.hist.fill(0); this.killers.fill(0);
    this.nodes = 0; this.stopped = false; this.canStop = false;
    const t0 = Date.now(); this.deadline = t0 + ms;
    const moves = this.legalMoves(); if (!moves.length) return null;
    if (moves.length === 1) return { move: moves[0], score: 0, depth: 0, nodes: 0, ms: 0 };
    const st = brain && brain.stats ? brain.stats[this.key()] : null;
    const bonus = moves.map(m => {
      let bn = 0;
      const s = st && st[uci(m)];
      if (s) { const c = s[0] + s[1] + s[2]; if (c > 0) bn = ((s[0] + 0.5 * s[1]) / c - 0.5) * 2 * LEARN_BONUS * (c / (c + 2)); }
      if (noise) bn += (Math.random() * 2 - 1) * noise;
      return bn;
    });
    let best = moves[0], bestScore = 0, done = 0; const order = moves.map((_, i) => i);
    for (let d = 1; d <= maxDepth; d++) {
      this.canStop = d > 2;
      let alpha = -INF, bi = -1;
      for (let kk = 0; kk < order.length; kk++) {
        const i = order[kk];
        this.make(moves[i]);
        const s = -this.search(d - 1, -INF, -(alpha - bonus[i]), 1);
        this.unmake();
        if (this.stopped) break;
        const tot = s + bonus[i];
        if (tot > alpha) { alpha = tot; bi = i; }
      }
      if (this.stopped || bi < 0) break;
      best = moves[bi]; bestScore = alpha; done = d;
      order.splice(order.indexOf(bi), 1); order.unshift(bi);
      if (Math.abs(alpha) > MATE - 100) break;
      if (Date.now() - t0 > ms * 0.45) break;
    }
    return { move: best, score: bestScore, depth: done, nodes: this.nodes, ms: Date.now() - t0 };
  }
}

// ---------- leikur (saga, staða, upptaka fyrir nám) ----------
class Game {
  constructor() { this.pos = new Position(START); this.sans = []; this.ucis = []; this.keys = []; this.samples = []; this.lastMove = null; }
  legal() { return this.pos.legalMoves(); }
  play(m) {
    const pos = this.pos;
    this.keys.push(pos.key()); this.ucis.push(uci(m)); this.sans.push(pos.san(m));
    pos.make(m); this.lastMove = { from: m & 63, to: (m >> 6) & 63 };
    if (this.ucis.length >= 8 && !(m >> 16 & 8) && !pos.inCheck()) { const f = new Float64Array(NF); features(pos, f); this.samples.push(f); }
  }
  insufficient() {
    const b = this.pos.board, ps = [];
    for (let sq = 0; sq < 64; sq++) { const a = Math.abs(b[sq]); if (a && a !== K) { if (a === P || a === R || a === Q) return false; ps.push({ a, sq }); } }
    if (ps.length <= 1) return true;
    if (ps.every(x => x.a === B)) { const c = ps[0] && (((ps[0].sq >> 3) + (ps[0].sq & 7)) & 1); return ps.every(x => (((x.sq >> 3) + (x.sq & 7)) & 1) === c); }
    return false;
  }
  status() {
    const pos = this.pos, ms = pos.legalMoves();
    if (!ms.length) return pos.inCheck() ? { result: pos.turn > 0 ? '0-1' : '1-0', reason: 'mate' } : { result: '1/2-1/2', reason: 'stalemate' };
    if (this.insufficient()) return { result: '1/2-1/2', reason: 'material' };
    if (pos.half >= 100) return { result: '1/2-1/2', reason: 'fifty' };
    let cnt = 1; const lim = Math.max(0, pos.ply - pos.half);
    for (let i = pos.ply - 2; i >= lim; i -= 2) if (pos.hk1[i] === pos.h1 && pos.hk2[i] === pos.h2) cnt++;
    if (cnt >= 3) return { result: '1/2-1/2', reason: 'repetition' };
    if (pos.ply >= 600) return { result: '1/2-1/2', reason: 'length' };
    return null;
  }
}

// ---------- nám ----------
function newBrain() {
  return { v: 1, mult: new Array(NF).fill(1), stats: {}, humanGames: 0, selfGames: 0, elo: 1000, rated: 0, userElo: 1200, eloHistory: [1000], created: new Date().toISOString() };
}
function sanitizeBrain(b) {
  const n = newBrain(); if (!b || typeof b !== 'object') return n;
  for (const k of Object.keys(n)) if (b[k] !== undefined && b[k] !== null) n[k] = b[k];
  if (!Array.isArray(n.mult) || n.mult.length !== NF) n.mult = new Array(NF).fill(1);
  if (typeof n.stats !== 'object') n.stats = {};
  if (!Array.isArray(n.eloHistory) || !n.eloHistory.length) n.eloHistory = [Math.round(n.elo)];
  return n;
}
// resultWhite: 1 / 0.5 / 0. weight: vægi gagna, eta: námshraði matsvægis
function learnFromGame(brain, game, resultWhite, weight, eta) {
  const n = Math.min(game.ucis.length, 30);
  for (let i = 0; i < n; i++) {
    const r = i % 2 === 0 ? resultWhite : 1 - resultWhite, ix = r === 1 ? 0 : (r === 0.5 ? 1 : 2);
    const st = brain.stats[game.keys[i]] || (brain.stats[game.keys[i]] = {});
    (st[game.ucis[i]] || (st[game.ucis[i]] = [0, 0, 0]))[ix] += weight;
  }
  const keys = Object.keys(brain.stats);
  if (keys.length > 50000) {
    for (const k of keys) { let c = 0; for (const mv in brain.stats[k]) { const s = brain.stats[k][mv]; c += s[0] + s[1] + s[2]; } if (c <= 1) delete brain.stats[k]; }
  }
  for (const f of game.samples) {
    let ev = 0; for (let i = 0; i < NF; i++) ev += W0[i] * brain.mult[i] * f[i];
    const p = 1 / (1 + Math.exp(-ev / 400));
    const g = (p - resultWhite) * p * (1 - p);
    for (let i = 0; i < NF; i++) {
      let m = brain.mult[i] - eta * g * W0[i] * f[i] / 100;
      brain.mult[i] = Math.max(MULT_MIN, Math.min(MULT_MAX, m));
    }
  }
}
// userScore: 1 notandi vann, 0.5 jafntefli, 0 tap. Skilar nýju mati á Elo tölvunnar.
function updateElo(brain, userScore) {
  const E = 1 / (1 + Math.pow(10, (brain.userElo - brain.elo) / 400)), S = 1 - userScore, K_ = brain.rated < 15 ? 40 : 24;
  brain.elo = Math.max(100, brain.elo + K_ * (S - E)); brain.rated++; brain.eloHistory.push(Math.round(brain.elo));
  return brain.elo;
}

const api = { Position, Game, newBrain, sanitizeBrain, learnFromGame, updateElo, START, uci, sqName, NF, W0, FILES };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Chess = api;
})(typeof window !== 'undefined' ? window : globalThis);
