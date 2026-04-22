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

// -----------------------------
// Cargar JSON
// -----------------------------
fetch("vocabulario_grego.json")
  .then(res => res.json())
  .then(json => {
    data = json.map(e => ({
      ...e,
      initial: getGreekInitial(e.voz)
    }));

    data.sort((a, b) =>
      normalizeGreek(a.voz).localeCompare(normalizeGreek(b.voz), "el")
    );

    createLetters();
    applyFilters();
  });

// -----------------------------
// Busca
// -----------------------------
search.addEventListener("input", () => {
  currentQuery = search.value.trim();
  applyFilters();
});

// -----------------------------
// Filtros
// -----------------------------
function applyFilters() {
  const q = normalizeGreek(currentQuery);
  const qLatin = normalizeGreek(latinToGreek(currentQuery));

  const filtered = data.filter(e => {
    const voz = normalizeGreek(e.voz);
    const sig = normalizeGreek(e.significado);

    const matchesQuery =
      currentQuery === "" ||
      voz.includes(q) ||
      sig.includes(q) ||
      voz.includes(qLatin);

    const matchesLetter =
      currentLetter === "Todo" || e.initial === currentLetter;

    return matchesQuery && matchesLetter;
  });

  render(filtered);
}

// -----------------------------
// Render con subentradas
// -----------------------------
function render(list) {
  results.innerHTML = "";

  list.forEach(e => {
    const { main, subs } = parseMeaning(e.significado);

    const div = document.createElement("div");
    div.className = "entry";

    let html = `
      <span class="greek">${e.voz}</span>: 
      <span class="meaning">${main}</span>
    `;

    if (subs.length > 0) {
      html += `<ul class="subs">`;

      subs.forEach(s => {
        const parts = s.split(":");
        if (parts.length > 1) {
          html += `<li><span class="greek">${parts[0]}</span>: ${parts.slice(1).join(":")}</li>`;
        } else {
          html += `<li>${s}</li>`;
        }
      });

      html += `</ul>`;
    }

    div.innerHTML = html;
    results.appendChild(div);
  });
}

// -----------------------------
// Parse significado
// -----------------------------
function parseMeaning(text) {
  const lines = text.split("\n");

  const main = [];
  const subs = [];

  lines.forEach(l => {
    const line = l.trim();

    if (/^\d+\./.test(line)) {
      subs.push(line.replace(/^\d+\.\s*/, ""));
    } else {
      main.push(line);
    }
  });

  return {
    main: main.join(" "),
    subs
  };
}

// -----------------------------
// Letras
// -----------------------------
function createLetters() {
  lettersDiv.innerHTML = "";

  const all = createBtn("Todo");
  lettersDiv.appendChild(all);

  GREEK_ALPHABET.forEach(l => {
    const btn = createBtn(l);
    lettersDiv.appendChild(btn);
  });
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
function normalizeGreek(str) {
  return (str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ς/g, "σ")
    .replace(/\s+/g, "");
}

// -----------------------------
// Inicial grega
// -----------------------------
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
  return str
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