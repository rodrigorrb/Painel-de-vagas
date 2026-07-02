// app.js — versao estatica: le docs/vagas.json direto, sem precisar de servidor.
// Toda a filtragem acontece no navegador.

const listaEl = document.getElementById("lista-vagas");
const estadoVazioEl = document.getElementById("estado-vazio");
const contadorEl = document.getElementById("contador-total");
const atualizacaoEl = document.getElementById("ultima-atualizacao");
const selectEmpresa = document.getElementById("filtro-empresa");

const inputs = {
  busca: document.getElementById("filtro-busca"),
  local: document.getElementById("filtro-local"),
  empresa: selectEmpresa,
  fonte: document.getElementById("filtro-fonte"),
};

let TODAS_VAGAS = [];
let debounceTimer;

function agendarFiltro() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(aplicarFiltros, 200);
}

Object.values(inputs).forEach((el) => {
  el.addEventListener(el.tagName === "SELECT" ? "change" : "input", agendarFiltro);
});

async function carregarVagas() {
  try {
    // cache-busting simples pra nao pegar versao antiga em cache do navegador/CDN do Pages
    const resp = await fetch(`vagas.json?t=${Date.now()}`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    TODAS_VAGAS = await resp.json();
  } catch (err) {
    TODAS_VAGAS = [];
    console.error("Nao foi possivel carregar vagas.json:", err);
  }

  popularEmpresas();
  aplicarFiltros();
}

function popularEmpresas() {
  const empresas = [...new Set(TODAS_VAGAS.map((v) => v.empresa))].sort();
  for (const nome of empresas) {
    const opt = document.createElement("option");
    opt.value = nome;
    opt.textContent = nome;
    selectEmpresa.appendChild(opt);
  }
}

function aplicarFiltros() {
  const busca = inputs.busca.value.trim().toLowerCase();
  const local = inputs.local.value.trim().toLowerCase();
  const empresa = inputs.empresa.value;
  const fonte = inputs.fonte.value;

  const resultado = TODAS_VAGAS.filter((v) => {
    if (busca && !`${v.titulo} ${v.departamento || ""}`.toLowerCase().includes(busca)) return false;
    if (local && !(v.local || "").toLowerCase().includes(local)) return false;
    if (empresa && v.empresa !== empresa) return false;
    if (fonte && v.fonte !== fonte) return false;
    return true;
  });

  renderizar(resultado);
  contadorEl.textContent = `${resultado.length} vaga(s) encontradas`;

  const maisRecente = TODAS_VAGAS[0]?.atualizada_em;
  atualizacaoEl.textContent = maisRecente
    ? `Atualizado em ${formatarData(maisRecente)}`
    : "Base ainda nao coletada";
}

function formatarData(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function renderizar(vagas) {
  listaEl.innerHTML = "";

  if (vagas.length === 0) {
    estadoVazioEl.hidden = false;
    return;
  }
  estadoVazioEl.hidden = true;

  const frag = document.createDocumentFragment();
  vagas.forEach((vaga, i) => {
    const linha = document.createElement("div");
    linha.className = "linha-vaga";
    linha.innerHTML = `
      <span class="col col--num">${String(i + 1).padStart(3, "0")}</span>
      <span class="col col--titulo">
        ${escapeHtml(vaga.titulo)}
        <small>${escapeHtml(vaga.departamento || "")}</small>
      </span>
      <span class="col col--empresa">${escapeHtml(vaga.empresa)}</span>
      <span class="col col--local">${escapeHtml(vaga.local)}</span>
      <span class="col col--fonte"><span class="tag-fonte">${vaga.fonte}</span></span>
      <span class="col col--acao"><a href="${vaga.link}" target="_blank" rel="noopener">Ver vaga →</a></span>
    `;
    frag.appendChild(linha);
  });
  listaEl.appendChild(frag);
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

carregarVagas();
