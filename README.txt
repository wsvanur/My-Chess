SKÁK – LÆRANDI TÖLVA
====================
Ræsa:   tvísmelltu á start.command  (opnar vafrann sjálfkrafa)
        eða: python3 server.py  og opnaðu http://127.0.0.1:8765
Hætta:  lokaðu Terminal-glugganum.

Skrár (allt í þessari möppu):
  chess.html, engine.js, server.py, start.command   forritið sjálft
  data/brain.json     það sem tölvan hefur lært + Elo-áætlun
  data/results.csv    árangur: hver leikur, úrslit, Elo (opnast í Excel/Numbers)
  data/results.json   sama, vél-læsilegt
  data/games.pgn      allar skákir (hægt að skoða á lichess/chess.com)
  tests/              sjálfvirk próf (node tests/test_engine.js)

Hvernig tölvan lærir:
  1. Hún man hvaða leikir unnu/töpuðu/jafntefli í hverri stöðu (fyrstu 30 leikjum) – líka þína leiki.
  2. Hún stillir vægi matsþátta (efni, peðabygging, kóngsöryggi o.fl.) eftir úrslitum.
  3. „Láta tölvuna æfa sig sjálfa“ spilar hraða leiki við sjálfa sig.
Elo-talan er ÁÆTLUN út frá úrslitum gegn þér og því Elo sem þú gefur upp.
Elo breytist aðeins af leikjum gegn þér, ekki sjálfsþjálfun.
Skákir styttri en 3 leikir sem er gefist upp í teljast ekki með.
Ef þú opnar chess.html beint (án start.command) vistast allt aðeins í vafranum.
