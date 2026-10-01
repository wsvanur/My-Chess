#!/bin/bash
# Tvísmelltu á þessa skrá til að ræsa skákforritið.
cd "$(dirname "$0")"
if command -v python3 >/dev/null 2>&1; then
  python3 server.py
else
  echo "python3 fannst ekki. Opna forritið beint (vistar þá aðeins í vafranum)."
  open chess.html
fi
