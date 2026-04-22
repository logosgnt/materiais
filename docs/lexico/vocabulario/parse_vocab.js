const fs = require("fs");
const path = require("path");

const input = path.join(__dirname, "vocabulario_grego1.md");
const output = path.join(__dirname, "vocabulario_grego.json");

const raw = fs.readFileSync(input, "utf8");
const lines = raw.split(/\r?\n/);

const entries = [];
let current = null;

function isHeading(line) {
  return /^\s*#{1,6}\s+/.test(line);
}

function isNewEntry(line) {
  return /^\s*-\s+/.test(line);
}

function stripEntryMarker(line) {
  return line.replace(/^\s*-\s+/, "").trim();
}

function pushCurrent() {
  if (!current) return;

  current.voz = current.voz.trim();
  current.significado = current.significado
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

  if (current.voz) {
    entries.push(current);
  }

  current = null;
}

for (const line of lines) {
  const trimmed = line.trim();

  if (!trimmed) {
    continue;
  }

  // Ignorar cabeceiras tipo #, ## Α, ## Β...
  if (isHeading(line)) {
    pushCurrent();
    continue;
  }

  // Nova entrada
  if (isNewEntry(line)) {
    pushCurrent();

    const content = stripEntryMarker(line);
    const colonIndex = content.indexOf(":");

    if (colonIndex === -1) {
      current = {
        voz: content,
        significado: ""
      };
    } else {
      current = {
        voz: content.slice(0, colonIndex).trim(),
        significado: content.slice(colonIndex + 1).trim()
      };
    }

    continue;
  }

  // Liña de continuación: só se hai entrada activa
  if (current) {
    current.significado += "\n" + trimmed;
  }
}

pushCurrent();

fs.writeFileSync(output, JSON.stringify(entries, null, 2), "utf8");

console.log(`Convertidas ${entries.length} entradas en ${output}`);