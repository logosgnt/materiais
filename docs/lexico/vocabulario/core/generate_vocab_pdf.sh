#!/bin/zsh
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Uso: $0 grego|latin" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
TARGET="$1"

case "$TARGET" in
  grego)
    swift "$SCRIPT_DIR/generate_vocab_pdf.swift" \
      "$ROOT_DIR/grego/vocabulario_grego.json" \
      "$ROOT_DIR/grego/vocabulario_grego.pdf" \
      "Vocabulario de Grego" \
      "el"
    ;;
  latin)
    swift "$SCRIPT_DIR/generate_vocab_pdf.swift" \
      "$ROOT_DIR/latin/vocabulario_latin.json" \
      "$ROOT_DIR/latin/vocabulario_latin.pdf" \
      "Vocabulario de Latín" \
      "la"
    ;;
  *)
    echo "Valor non soportado: $TARGET" >&2
    exit 1
    ;;
esac
