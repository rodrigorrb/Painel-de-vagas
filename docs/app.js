// app.js — versao estatica.
// Fonte 1 (sempre ativa): docs/vagas.json, gerado pelo collector.js (Greenhouse/Lever).
// Fonte 2 (opcional): API publica da Adzuna, busca em tempo real por qualquer
// empresa/segmento no Brasil. So ativa se o usuario configurar App ID/Key.

const listaEl = document.getElementById("lista-vagas");
const estadoVazioEl = document.getElementById("estado-vazio");
const contadorEl = document.getElementById("contador-total");
const atualizacaoEl = document.getElementById("ultima-atualizacao");
const selectEmpresa = document.getElementById("filtro-empresa");
const botaoBuscar = document.getElementById("botao-buscar");
const adzunaIdInput = document.getElementById("adzuna-app-id");
const adzunaKeyInput = document.getElementById("adzuna-app-key");
const adzunaStatusEl = document.getElementById("adzuna-status");
const salvarAdzunaBtn = document.getElementById("salvar-adzuna");

const inputs = {
  busca: document.getElementById("filtro-busca"),
  local: document.getElementById("filtro-local"),
  segmento: document.getElementById("filtro-segmento"),
  empresa: selectEmpresa,
  fonte: document.getElementById("filtro-fonte"),
};

let VAGAS_LOCAIS = [];   // vindas do vagas.json (Greenhouse/Lever)
let VAGAS_ADZUNA = [];   // vindas da busca ampliada (Adzuna), atualizadas a cada clique em "Buscar"

// ---------- Config da Adzuna (salva no localStorage do navegador) ----------

function carregarConfigAdzuna() {
  const appId = localStorage.getItem("adzuna_app_id") || "";
  const appKey = localStorage.getItem("adzuna_app_key") || "";
  adzunaIdInput.value = appId;
  adzunaKeyInput.value = appKey;
  atualizarStatusAdzuna();
}

function atualizarStatusAdzuna() {
  const configurado = localStorage.getItem("adzuna_app_id") && localStorage.getItem("adzuna_app_key");
  adzunaStatusEl.textContent = configurado
    ? "Busca ampliada ativa."
    : "Busca ampliada desativada (preencha as chaves acima para ativar).";
}

salvarAdzunaBtn.addEventListener("click", () => {
  localStorage.setItem("adzuna_app_id", adzunaIdInput.value.trim());
  localStorage.setItem("adzuna_app_key", adzunaKeyInput.value.trim());
  atualizarStatusAdzuna();
});

// ---------- Fonte 1: vagas.json local ----------

async function carregarVagasLocais() {
  try {
    const resp = await fetch(`vagas.json?t=${Date.now()}`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    VAGAS_LOCAIS = await resp.json();
  } catch (err) {
    VAGAS_LOCAIS = [];
    console.error("Nao foi possivel carregar vagas.json:", err);
  }
  popularEmpresas(VAGAS_LOCAIS);
}

function popularEmpresas(vagas) {
  const existentes = new Set(Array.from(selectEmpresa.options).map((o) => o.value));
  const empresas = [...new Set(vagas.map((v) => v.empresa))].sort();
  for (const nome of empresas) {
    if (existentes.has(nome)) continue;
    const opt = document.createElement("option");
    opt.value = nome;
    opt.textContent = nome;
    selectEmpresa.appendChild(opt);
  }
}

// ---------- Fonte 2: busca ampliada via Adzuna ----------

async function buscarNaAdzuna() {
  const appId = localStorage.getItem("adzuna_app_id");
  const appKey = localStorage.getItem("adzuna_app_key");
  if (!appId || !appKey) {
    VAGAS_ADZUNA = [];
    return;
  }

  const termo = inputs.busca.value.trim();
  const local = inputs.local.value.trim();
  const categoria = inputs.segmento.value;

  const params = new URLSearchParams({
    app_id: appId,
    app_key: appKey,
    results_per_page: "30",
    "content-type": "application/json",
  });
  if (termo) params.set("what", termo);
  if (local) params.set("where", local);
  if (categoria) params.set("category", categoria);

  const url = `https://api.adzuna.com/v1/api/jobs/br/search/1?${params.toString()}`;

  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const dados = await resp.json();
    VAGAS_ADZUNA = (dados.results || []).map((job) => ({
      id: `adzuna:${job.id}`,
      titulo: job.title?.replace(/<[^>]+>/g, "") || "(sem titulo)",
      empresa: job.company?.display_name || "Nao informado",
      local: job.location?.display_name || "Nao informado",
      link: job.redirect_url,
      publicada_em: job.created || null,
      fonte: "adzuna",
      departamento: job.category?.label || null,
    }));
    adzunaStatusEl.textContent = `Busca ampliada: ${VAGAS_ADZUNA.length} vaga(s) encontradas agora.`;
  } catch (err) {
    VAGAS_ADZUNA = [];
    adzunaStatusEl.textContent = "Erro ao consultar a busca ampliada. Confira as chaves.";
    console.error("Erro Adzuna:", err);
  }

  popularEmpresas(VAGAS_ADZUNA);
}

// ---------- Filtro + render ----------

function formatarData(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return "";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function aplicarFiltros() {
  const busca = inputs.busca.value.trim().toLowerCase();
  const local = inputs.local.value.trim().toLowerCase();
  const empresa = inputs.empresa.value;
  const fonte = inputs.fonte.value;

  const todasVagas = [...VAGAS_LOCAIS, ...VAGAS_ADZUNA];

  const resultado = todasVagas.filter((v) => {
    if (busca && !`${v.titulo} ${v.departamento || ""}`.toLowerCase().includes(busca)) return false;
    if (local && !(v.local || "").toLowerCase().includes(local)) return false;
    if (empresa && v.empresa !== empresa) return false;
    if (fonte && v.fonte !== fonte) return false;
    return true;
  });

  resultado.sort((a, b) => new Date(b.publicada_em || 0) - new Date(a.publicada_em || 0));

  renderizar(resultado);
  contadorEl.textContent = `${resultado.length} vaga(s) encontradas`;

  const maisRecente = VAGAS_LOCAIS[0]?.atualizada_em;
  atualizacaoEl.textContent = maisRecente
    ? `Base local atualizada em ${formatarData(maisRecente)}`
    : "Base local ainda nao coletada";
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

// ---------- Acao do botao "Buscar vagas" ----------

async function executarBusca() {
  botaoBuscar.classList.add("carregando");
  botaoBuscar.disabled = true;
  try {
    await buscarNaAdzuna();
    aplicarFiltros();
  } finally {
    botaoBuscar.classList.remove("carregando");
    botaoBuscar.disabled = false;
  }
}

botaoBuscar.addEventListener("click", executarBusca);

// Enter em qualquer campo de texto tambem dispara a busca
[inputs.busca, inputs.local].forEach((el) => {
  el.addEventListener("keydown", (e) => {
    if (e.key === "Enter") executarBusca();
  });
});

// Trocar empresa/fonte/segmento reaplica o filtro na hora (sem precisar de rede)
[inputs.empresa, inputs.fonte, inputs.segmento].forEach((el) => {
  el.addEventListener("change", aplicarFiltros);
});

// ---------- Inicializacao ----------

async function iniciar() {
  carregarConfigAdzuna();
  await carregarVagasLocais();
  aplicarFiltros();
}

iniciar();
