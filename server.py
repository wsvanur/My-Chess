#!/usr/bin/env python3
"""Lítill staðbundinn vefþjónn fyrir skákforritið.

Þjónar chess.html og engine.js og vistar allt í undirmöppunni data/:
  data/brain.json    - það sem tölvan hefur lært (matsvægi, reynsla, Elo-áætlun)
  data/results.json  - allir leikir og úrslit (vél-læsilegt)
  data/results.csv   - sama í töflu (opnast í Excel/Numbers)
  data/games.pgn     - allar skákir á PGN-sniði
Ræsa: python3 server.py   (eða tvísmella á start.command)
"""
import csv
import json
import os
import threading
import urllib.request
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

BASE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(BASE, 'data')
os.makedirs(DATA, exist_ok=True)
LOCK = threading.Lock()
PORTS = range(8765, 8776)
STATIC = {
    '/': ('chess.html', 'text/html; charset=utf-8'),
    '/chess.html': ('chess.html', 'text/html; charset=utf-8'),
    '/engine.js': ('engine.js', 'application/javascript; charset=utf-8'),
}
RES_TXT = {'win': 'sigur', 'draw': 'jafntefli', 'loss': 'tap'}
COLOR_TXT = {'w': 'hvitur', 'b': 'svartur'}


def read_json(name, default):
    try:
        with open(os.path.join(DATA, name), 'r', encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return default


def write_json(name, obj):
    path = os.path.join(DATA, name)
    tmp = path + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(obj, f, ensure_ascii=False)
    os.replace(tmp, path)


def write_csv(results):
    path = os.path.join(DATA, 'results.csv')
    tmp = path + '.tmp'
    with open(tmp, 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.writer(f, delimiter=';')
        w.writerow(['nr', 'dagsetning', 'litur_notanda', 'urslit_notanda', 'astaeda', 'leikir',
                    'elo_tolvu_fyrir', 'elo_tolvu_eftir', 'elo_notanda'])
        for r in results:
            w.writerow([r.get('n'), r.get('date'), COLOR_TXT.get(r.get('color'), r.get('color')),
                        RES_TXT.get(r.get('result'), r.get('result')), r.get('reason'), r.get('plies'),
                        r.get('eloBefore'), r.get('eloAfter'), r.get('userElo')])
    os.replace(tmp, path)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def _send(self, code, body, ctype='application/json; charset=utf-8'):
        if isinstance(body, (dict, list)):
            body = json.dumps(body, ensure_ascii=False).encode('utf-8')
        elif isinstance(body, str):
            body = body.encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = self.path.split('?')[0]
        if path == '/api/ping':
            return self._send(200, {'ok': True, 'app': 'chess'})
        if path == '/api/state':
            with LOCK:
                return self._send(200, {'brain': read_json('brain.json', None), 'results': read_json('results.json', [])})
        if path in STATIC:
            name, ctype = STATIC[path]
            try:
                with open(os.path.join(BASE, name), 'rb') as f:
                    return self._send(200, f.read(), ctype)
            except OSError:
                return self._send(404, {'error': 'not found'})
        self._send(404, {'error': 'not found'})

    def do_POST(self):
        if self.path.split('?')[0] != '/api/save':
            return self._send(404, {'error': 'not found'})
        try:
            n = int(self.headers.get('Content-Length', '0'))
            if n <= 0 or n > 80 * 1024 * 1024:
                raise ValueError('bad size')
            body = json.loads(self.rfile.read(n).decode('utf-8'))
            brain, results, pgn = body.get('brain'), body.get('results'), body.get('pgn')
            if not isinstance(brain, dict) or not isinstance(results, list):
                raise ValueError('bad shape')
        except (ValueError, UnicodeDecodeError) as e:
            return self._send(400, {'error': str(e)})
        with LOCK:
            os.makedirs(DATA, exist_ok=True)  # ef data/ var eytt á meðan forritið var í gangi
            old = os.path.join(DATA, 'brain.json')
            if os.path.exists(old):
                try:
                    os.replace(old, os.path.join(DATA, 'brain.prev.json'))
                except OSError:
                    pass
            write_json('brain.json', brain)
            write_json('results.json', results)
            write_csv(results)
            if isinstance(pgn, str) and pgn.strip():
                with open(os.path.join(DATA, 'games.pgn'), 'a', encoding='utf-8') as f:
                    f.write(pgn.rstrip() + '\n\n')
        self._send(200, {'ok': True})


def is_ours(port):
    try:
        with urllib.request.urlopen('http://127.0.0.1:%d/api/ping' % port, timeout=1) as r:
            return b'"chess"' in r.read()
    except Exception:
        return False


def main():
    for port in PORTS:
        try:
            srv = ThreadingHTTPServer(('127.0.0.1', port), Handler)
        except OSError:
            if is_ours(port):
                print('Skákforritið er þegar í gangi á http://127.0.0.1:%d' % port)
                webbrowser.open('http://127.0.0.1:%d/' % port)
                return
            continue
        url = 'http://127.0.0.1:%d/' % port
        print('Skákforritið er í gangi á ' + url)
        print('Gögn eru vistuð í: ' + DATA)
        print('Ýttu á Ctrl+C (eða lokaðu glugganum) til að hætta.')
        threading.Timer(0.6, lambda: webbrowser.open(url)).start()
        try:
            srv.serve_forever()
        except KeyboardInterrupt:
            pass
        return
    print('Fann ekkert laust port (8765-8775).')


if __name__ == '__main__':
    main()
