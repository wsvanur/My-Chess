// Prófanir á skákvélinni: node tests/test_engine.js
const C = require('../engine.js');
let fail = 0;
function check(name, got, exp) { const ok = got === exp; if (!ok) fail++; console.log((ok ? 'OK   ' : 'FAIL ') + name + ' => ' + got + (ok ? '' : ' (vænst ' + exp + ')')); }

// perft: sannreynir allar reglur (hrókering, uppstig, en passant, mát o.s.frv.)
const perfts = [
  ['upphafsstaða d4', C.START, 4, 197281],
  ['Kiwipete d3', 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', 3, 97862],
  ['staða 3 d4', '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', 4, 43238],
  ['staða 4 d3', 'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1', 3, 9467],
  ['staða 5 d3', 'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8', 3, 62379],
];
for (const [n, fen, d, exp] of perfts) check('perft ' + n, new C.Position(fen).perft(d), exp);

// SAN
const g = new C.Game();
for (const u of ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5']) { const m = g.legal().find(x => C.uci(x) === u); g.play(m); }
check('SAN', g.sans.join(' '), 'e4 e5 Nf3 Nc6 Bb5');

// mát í 1: leitin finnur það
const mp = new C.Position('6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1');
const brain = C.newBrain();
const r = mp.think(brain, { ms: 500, maxDepth: 4 });
check('finnur mát í 1 (Ra8#)', C.uci(r.move), 'a1a8');

// hraði og dýpt í upphafsstöðu
const sp = new C.Position(C.START); const t0 = Date.now();
const r2 = sp.think(brain, { ms: 700 });
console.log('upphafsstaða: leikur', C.uci(r2.move), 'dýpt', r2.depth, 'hnútar', r2.nodes, 'ms', r2.ms);
check('hugsar innan við 1 sek', Date.now() - t0 < 1000, true);

// sjálfsleikur: allir leikir löglegir, leikur klárast og nám keyrir
const gm = new C.Game(); let st = null;
while (!(st = gm.status()) && gm.ucis.length < 200) {
  const res = gm.pos.think(brain, { ms: 30, maxDepth: 3, noise: 40 });
  const legal = gm.legal().map(C.uci); if (!legal.includes(C.uci(res.move))) { fail++; console.log('FAIL ólöglegur leikur', C.uci(res.move)); break; }
  gm.play(res.move);
}
console.log('sjálfsleikur:', gm.ucis.length, 'leikir,', st ? st.result + ' ' + st.reason : 'hætt við 200');
const before = brain.mult.slice();
C.learnFromGame(brain, gm, st && st.result === '1-0' ? 1 : st && st.result === '0-1' ? 0 : 0.5, 1, 0.1);
check('nám bætti stöðum í minni', Object.keys(brain.stats).length > 10, true);
check('matsvægi innan marka', brain.mult.every(x => x >= 0.7 && x <= 1.4), true);
const e0 = brain.elo; C.updateElo(brain, 0); check('Elo hækkar þegar tölva vinnur', brain.elo > e0, true);
const e1 = brain.elo; C.updateElo(brain, 1); check('Elo lækkar þegar tölva tapar', brain.elo < e1, true);

// þrítekning
const rp = new C.Game(); for (const u of ['g1f3', 'g8f6', 'f3g1', 'f6g8', 'g1f3', 'g8f6', 'f3g1', 'f6g8']) rp.play(rp.legal().find(x => C.uci(x) === u));
check('þrítekning greind', rp.status() && rp.status().reason, 'repetition');

console.log(fail ? '\n' + fail + ' PRÓF MISTÓKUST' : '\nÖll próf stóðust');
process.exit(fail ? 1 : 0);
