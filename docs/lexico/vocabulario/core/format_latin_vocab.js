const fs = require("fs");
const path = require("path");

const input = path.join(__dirname, "../latin/fonte_bruto.md");
const output = path.join(__dirname, "../latin/fonte.md");

const rawLines = fs.readFileSync(input, "utf8").split(/\r?\n/);
const flatEntries = [];
const GRAMMAR = new Set([
  "a", "ab", "ac", "ad", "adv", "abl", "f", "m", "n", "pl", "prep",
  "conx", "xen", "dat", "subx", "indic", "semidep", "dep"
]);

let current = null;
let pendingHeadword = "";
let currentSection = "";

function normalizeDefinitionLine(line) {
  return line
    .replace(/, - da,/g, ", -da,")
    .replace(/([.,)])-\s+/g, "$1 - ")
    .trim();
}

function splitDefinition(line) {
  const normalized = normalizeDefinitionLine(line);
  const spaced = normalized.match(/^(.*?)\s+-\s+(.*)$/);

  if (spaced) {
    return [spaced[1], spaced[2]];
  }

  const delimiter = normalized.lastIndexOf("-");
  if (delimiter > 0) {
    const left = normalized.slice(0, delimiter).trim();
    const right = normalized.slice(delimiter + 1).trim();
    const firstRightToken = right.split(/\s+/)[0] || "";

    if (right === "") {
      return [left, ""];
    }

    if (left && !firstRightToken.includes(",") && /\s/.test(right) && /^[a-záéíóúüñ¿¡(]/i.test(right)) {
      return [left, right];
    }
  }

  return null;
}

function splitReference(line) {
  const see = line.match(/^(.*?)\s+ver\s+(.+)$/i);
  if (see) return [see[1], `ver ${see[2]}`];

  const equals = line.match(/^(.*?)\s*=\s*(.+)$/);
  if (equals && equals[1].trim() && !equals[1].trim().startsWith("(")) {
    return [equals[1], `= ${equals[2]}`];
  }

  return null;
}

function isNoise(line) {
  return line === "" || /^\d+$/.test(line);
}

function isSection(line) {
  return /^[A-Z]$/.test(line);
}

function cleanText(text) {
  return (text || "")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}

function pushCurrent() {
  if (!current) return;

  current.voz = cleanText(current.voz);
  current.significado = cleanText(current.significado);

  if (current.voz && current.significado) {
    flatEntries.push(current);
  }

  current = null;
}

function startEntry(voz, significado) {
  pushCurrent();
  current = {
    voz: cleanText(voz),
    significado: cleanText(significado),
    section: currentSection
  };
}

function looksLikeSplitHeadword(line, nextLine) {
  if (!nextLine) return false;
  if (/^-\s+/.test(nextLine)) return true;
  if (!splitDefinition(nextLine)) return false;
  return /,$/.test(line);
}

for (let i = 0; i < rawLines.length; i += 1) {
  const line = rawLines[i].trim();

  if (isNoise(line)) continue;

  if (isSection(line)) {
    pushCurrent();
    currentSection = line;
    pendingHeadword = "";
    continue;
  }

  if (pendingHeadword) {
    const combined = `${pendingHeadword} ${line}`;
    const definition = splitDefinition(combined);

    if (definition) {
      startEntry(definition[0], definition[1]);
      pendingHeadword = "";
      continue;
    }

    pendingHeadword = combined;
    continue;
  }

  if (/^-\s+/.test(line)) {
    continue;
  }

  const definition = splitDefinition(line);
  if (definition) {
    startEntry(definition[0], definition[1]);
    continue;
  }

  const nextLine = rawLines[i + 1]?.trim();
  if (looksLikeSplitHeadword(line, nextLine)) {
    pushCurrent();
    pendingHeadword = line;
    continue;
  }

  const reference = splitReference(line);
  if (reference) {
    startEntry(reference[0], reference[1]);
    continue;
  }

  if (current) {
    current.significado = cleanText(`${current.significado} ${line}`);
  }
}

pushCurrent();

const grouped = [];
let activeMain = null;

for (const entry of flatEntries) {
  if (!isReference(entry) && activeMain && belongsTo(entry, activeMain)) {
    activeMain.subs.push(entry);
    continue;
  }

  entry.subs = [];
  grouped.push(entry);

  if (!isReference(entry)) {
    activeMain = entry;
  }
}

grouped.sort((a, b) => normalizeForSort(a.voz).localeCompare(normalizeForSort(b.voz), "gl"));

const lines = ["# Vocabulario latín", ""];
let section = "";

for (const entry of grouped) {
  const nextSection = sectionFor(entry.voz);
  if (nextSection !== section) {
    section = nextSection;
    lines.push(`## ${section}`, "");
  }

  lines.push(`- ${entry.voz}: ${entry.significado}`);

  entry.subs.forEach((sub, index) => {
    lines.push(`  ${index + 1}. ${sub.voz}: ${sub.significado}`);
  });

  lines.push("");
}

fs.writeFileSync(output, `${lines.join("\n").trimEnd()}\n`, "utf8");

console.log(`Formatadas ${grouped.length} entradas principais en ${output}`);

function isReference(entry) {
  return /^(ver|=)\s+/.test(entry.significado);
}

function belongsTo(entry, main) {
  if (entry.voz.trim().startsWith("-")) return false;

  const voice = normalizeLoose(entry.voz);
  const mainForms = formsFor(main.voz);
  const first = voice.split(" ")[0] || "";
  const isPhrase = /\s/.test((entry.voz.split(",")[0] || "").trim()) || /\.{2,}/.test(entry.voz);

  if (mainForms.includes(first)) return true;
  if (!isPhrase) return false;

  return mainForms.some(form => {
    if (form.length < 4) return false;
    return voice.includes(form) || stem(first) === stem(form);
  });
}

function formsFor(voz) {
  return voz
    .split(/[,/();]+|\s+/)
    .filter(part => !part.trim().startsWith("-"))
    .map(normalizeLoose)
    .filter(token => token.length >= 2 && !GRAMMAR.has(token));
}

function sectionFor(voz) {
  const clean = normalizeForSort(voz).replace(/^[^a-z]+/, "");
  return clean[0]?.toUpperCase() || "#";
}

function normalizeForSort(text) {
  return normalizeLoose(text).replace(/^[^a-z]+/, "");
}

function normalizeLoose(text) {
  return (text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stem(token) {
  return token.replace(/(us|um|is|ae|am|as|em|es|o|i|e|a)$/i, "");
}
