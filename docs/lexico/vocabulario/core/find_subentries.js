const fs = require("fs");
const path = require("path");

const input = path.join(__dirname, "../latin/fonte.md");

const raw = fs.readFileSync(input, "utf8");
const lines = raw.split(/\r?\n/);

let currentEntry = null;
let hasSubentry = false;

const results = [];

function isEntry(line) {
  return /^\s*-\s+/.test(line);
}

function isSubentry(line) {
  return /^\s+\d+\.\s+/.test(line);
}

function cleanEntry(line) {
  return line.replace(/^\s*-\s+/, "").trim();
}

function pushIfNeeded() {
  if (currentEntry && hasSubentry) {
    results.push(currentEntry);
  }
}

for (const line of lines) {
  if (isEntry(line)) {
    pushIfNeeded();

    currentEntry = cleanEntry(line);
    hasSubentry = false;
    continue;
  }

  if (isSubentry(line)) {
    hasSubentry = true;
  }
}

// último bloque
pushIfNeeded();

// saída
console.log(`Total con subentradas: ${results.length}\n`);

for (const entry of results) {
  console.log("- " + entry);
}