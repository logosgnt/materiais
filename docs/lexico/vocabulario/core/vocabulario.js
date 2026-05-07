(() => {
// -----------------------------
// Configuración (desde HTML)
// -----------------------------
const config = window.VOCABULARIO_CONFIG || {};
const MODE = config.mode || window.MODE || "greek";
const DATA_URL = config.dataUrl || window.DATA_URL || "vocabulario_grego.json";
const TITLE = config.title || "";

// -----------------------------
let data = [];
let currentLetter = "Todo";
let currentQuery = "";

const GREEK_ALPHABET = [
  "Α","Β","Γ","Δ","Ε","Ζ","Η","Θ",
  "Ι","Κ","Λ","Μ","Ν","Ξ","Ο","Π",
  "Ρ","Σ","Τ","Υ","Φ","Χ","Ψ","Ω"
];

const results = document.getElementById("results");
const search = document.getElementById("search");
const lettersDiv = document.getElementById("letters");
const count = document.getElementById("count");

// -----------------------------
// Cargar JSON
// -----------------------------
if (!results || !lettersDiv) {
  throw new Error("Faltan os contedores #results ou #letters para renderizar o vocabulario.");
}

fetch(DATA_URL)
  .then(res => {
    if (!res.ok) {
      throw new Error(`Non se puido cargar ${DATA_URL} (${res.status})`);
    }
    return res.json();
  })
  .then(json => {
    data = json.map(e => ({
      ...e,
      initial: getInitial(e.voz)
    }));

    data.sort((a, b) =>
      normalize(a.voz).localeCompare(
        normalize(b.voz),
        MODE === "greek" ? "el" : "es"
      )
    );

    createLetters();
    applyFilters();
  })
  .catch(err => {
    console.error("Erro cargando JSON:", err);
    showMessage(`Non se puido cargar o vocabulario${TITLE ? ` de ${TITLE}` : ""}. Revisa que exista o ficheiro JSON configurado.`);
  });

// -----------------------------
// Busca
// -----------------------------
if (search) {
  search.addEventListener("input", () => {
    currentQuery = search.value.trim();
    applyFilters();
  });
}

// -----------------------------
// Filtros
// -----------------------------
function applyFilters() {
  const q = normalize(currentQuery);

  const qLatin = MODE === "greek"
    ? normalize(latinToGreek(currentQuery))
    : null;

  const filtered = data.filter(e => {
    const voz = normalize(e.voz);
    const sig = normalize(e.significado);

    const matchesQuery =
      currentQuery === "" ||
      sig.includes(q) ||
      voz.startsWith(q) ||
      (MODE === "greek" && qLatin && voz.startsWith(qLatin));

    const matchesLetter =
      currentLetter === "Todo" || e.initial === currentLetter;

    return matchesQuery && matchesLetter;
  });

  render(filtered);
}

// -----------------------------
// Render
// -----------------------------
function render(list) {
  results.innerHTML = "";
  updateCount(list.length);

  if (list.length === 0) {
    showMessage("Non hai resultados para esa busca.");
    return;
  }

  list.forEach(e => {
    const { main, subs } = parseMeaning(e.significado);

    const div = document.createElement("div");
    div.className = "entry";

    const headword = document.createElement("span");
    headword.className = `headword ${MODE === "greek" ? "greek" : "latin"}`;
    headword.textContent = e.voz;
    div.appendChild(headword);
    div.append(": ");

    const meaning = document.createElement("span");
    meaning.className = "meaning";
    meaning.textContent = main;
    div.appendChild(meaning);

    if (subs.length > 0) {
      const ul = document.createElement("ul");
      ul.className = "subs";

      subs.forEach(s => {
        const li = document.createElement("li");
        appendStructuredSubentry(li, s);

        ul.appendChild(li);
      });

      div.appendChild(ul);
    }

    results.appendChild(div);
  });
}

function showMessage(text) {
  results.innerHTML = "";
  updateCount(0);

  const p = document.createElement("p");
  p.className = "empty";
  p.textContent = text;
  results.appendChild(p);
}

function updateCount(total) {
  if (!count) return;

  const label = total === 1 ? "entrada" : "entradas";
  count.textContent = `${total} ${label}`;
}

// -----------------------------
// Parse significado
// -----------------------------
function parseMeaning(text) {
  const lines = text.split("\n");

  const main = [];
  const subs = [];
  let currentSub = null;

  lines.forEach(l => {
    const line = l.trim();
    if (!line) return;

    if (/^\d+\./.test(line)) {
      currentSub = line.replace(/^\d+\.\s*/, "");
      subs.push(currentSub);
    } else {
      if (currentSub) {
        subs[subs.length - 1] += `\n${line}`;
      } else {
        main.push(line);
      }
    }
  });

  return {
    main: main.join(" "),
    subs
  };
}

function appendStructuredSubentry(container, text) {
  const lines = text.split("\n").map(line => line.trim()).filter(Boolean);
  if (lines.length === 0) return;

  appendSubLine(container, lines[0], true);

  lines.slice(1).forEach(line => {
    const extra = document.createElement("div");
    extra.className = "sub-note";
    appendSubLine(extra, line, false);
    container.appendChild(extra);
  });
}

function appendSubLine(container, text, highlightTerm) {
  const separator = text.indexOf(":");

  if (separator > -1 && highlightTerm) {
    const subterm = document.createElement("span");
    subterm.className = `subterm ${MODE === "greek" ? "greek" : "latin"}`;
    subterm.textContent = text.slice(0, separator);
    container.appendChild(subterm);
    container.append(`:${text.slice(separator + 1)}`);
    return;
  }

  container.append(text);
}

// -----------------------------
// Letras
// -----------------------------
function createLetters() {
  lettersDiv.innerHTML = "";

  const all = createBtn("Todo");
  lettersDiv.appendChild(all);

  const alphabet = MODE === "greek"
    ? GREEK_ALPHABET
    : "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

  alphabet.forEach(l => {
    const btn = createBtn(l);
    lettersDiv.appendChild(btn);
  });

  updateActive();
}

function createBtn(letter) {
  const btn = document.createElement("button");
  btn.textContent = letter;
  btn.className = "letter-chip";

  btn.onclick = () => {
    currentLetter = letter;
    updateActive();
    applyFilters();
  };

  return btn;
}

function updateActive() {
  document.querySelectorAll(".letter-chip").forEach(b => {
    b.classList.toggle("active", b.textContent === currentLetter);
  });
}

// -----------------------------
// Normalización
// -----------------------------
function normalize(str) {
  if (MODE === "greek") return normalizeGreek(str);
  return normalizeText(str);
}

function normalizeGreek(str) {
  return (str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ς/g, "σ")
    .replace(/\s+/g, "");
}

function normalizeText(str) {
  return (str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "");
}

// -----------------------------
// Inicial
// -----------------------------
function getInitial(voz) {
  if (MODE === "greek") return getGreekInitial(voz);
  const clean = normalizeText(voz);
  return clean?.[0]?.toUpperCase() || "#";
}

function getGreekInitial(voz) {
  const clean = voz
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  for (let c of clean) {
    const u = c.toUpperCase();
    if (GREEK_ALPHABET.includes(u)) return u;
  }

  return "#";
}

// -----------------------------
// Latín → grego (básico)
// -----------------------------
function latinToGreek(str) {
  return (str || "")
    .toLowerCase()
    .replace(/ph/g,"φ")
    .replace(/f/g,"φ")
    .replace(/th/g,"θ")
    .replace(/ch/g,"χ")
    .replace(/ps/g,"ψ")
    .replace(/ks/g,"ξ")
    .replace(/3/g,"ξ")
    .replace(/8/g,"θ")
    .replace(/a/g,"α")
    .replace(/b/g,"β")
    .replace(/g/g,"γ")
    .replace(/d/g,"δ")
    .replace(/e/g,"ε")
    .replace(/z/g,"ζ")
    .replace(/h/g,"η")
    .replace(/i/g,"ι")
    .replace(/k/g,"κ")
    .replace(/l/g,"λ")
    .replace(/m/g,"μ")
    .replace(/n/g,"ν")
    .replace(/x/g,"χ")
    .replace(/o/g,"ο")
    .replace(/p/g,"π")
    .replace(/r/g,"ρ")
    .replace(/s/g,"σ")
    .replace(/t/g,"τ")
    .replace(/u/g,"υ")
    .replace(/y/g,"υ")
    .replace(/w/g,"ω");
}
})();
