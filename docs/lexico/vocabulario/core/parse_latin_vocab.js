const fs = require("fs");
const path = require("path");

const input = path.join(__dirname, "../latin/fonte.md");
const output = path.join(__dirname, "../latin/vocabulario_latin.json");

const lines = fs.readFileSync(input, "utf8").split(/\r?\n/);
const entries = [];

let current = null;

function isHeading(line) {
  return /^\s*#{1,6}\s+/.test(line);
}

function isEntry(line) {
  return /^\s*-\s+/.test(line);
}

function stripEntryMarker(line) {
  return line.replace(/^\s*-\s+/, "").trim();
}

function pushCurrent() {
  if (!current) return;

  current.voz = clean(current.voz);
  current.significado = current.significado
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

  if (current.voz && current.significado) {
    entries.push(current);
  }

  current = null;
}

function clean(text) {
  return (text || "")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}

for (const line of lines) {
  const trimmed = line.trim();

  if (!trimmed) continue;

  if (isHeading(line)) {
    pushCurrent();
    continue;
  }

  if (isEntry(line)) {
    pushCurrent();

    const content = stripEntryMarker(line);
    const colon = content.indexOf(":");

    current = colon === -1
      ? { voz: content, significado: "" }
      : {
          voz: content.slice(0, colon),
          significado: content.slice(colon + 1).trim()
        };

    continue;
  }

  if (current) {
    current.significado += `\n${trimmed}`;
  }
}

pushCurrent();

fs.writeFileSync(output, `${JSON.stringify(entries, null, 2)}\n`, "utf8");

console.log(`Convertidas ${entries.length} entradas en ${output}`);
