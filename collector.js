// collector.js
// Busca vagas nas APIs publicas de ATS (Greenhouse e Lever) para a lista de
// empresas em config/empresas.json, normaliza os dados e salva em data/vagas.json
//
// Uso:
//   node collector.js
//
// Agende com cron (ex: a cada 6 horas) para manter a base atualizada:
//   0 */6 * * * cd /caminho/do/projeto && node collector.js >> collector.log 2>&1

import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";

const EMPRESAS_PATH = new URL("./config/empresas.json", import.meta.url);
// Salva direto em docs/, que e a pasta servida pelo GitHub Pages.
const DATA_DIR = new URL("./docs/", import.meta.url);
const OUTPUT_PATH = new URL("./docs/vagas.json", import.meta.url);

// ---------- Coletores por fonte ----------

async function coletarGreenhouse(empresa) {
  const url = `https://boards-api.greenhouse.io/v1/boards/${empresa.slug}/jobs?content=true`;
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`Greenhouse (${empresa.slug}): HTTP ${resp.status}`);
  }
  const data = await resp.json();
  return (data.jobs || []).map((job) => ({
    id: `greenhouse:${empresa.slug}:${job.id}`,
    titulo: job.title,
    empresa: empresa.nome,
    local: job.location?.name || "Nao informado",
    link: job.absolute_url,
    publicada_em: job.updated_at || null,
    fonte: "greenhouse",
    departamento: job.departments?.[0]?.name || null,
  }));
}

async function coletarLever(empresa) {
  const url = `https://api.lever.co/v0/postings/${empresa.slug}?mode=json`;
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`Lever (${empresa.slug}): HTTP ${resp.status}`);
  }
  const data = await resp.json();
  return (data || []).map((job) => ({
    id: `lever:${empresa.slug}:${job.id}`,
    titulo: job.text,
    empresa: empresa.nome,
    local: job.categories?.location || "Nao informado",
    link: job.hostedUrl,
    publicada_em: job.createdAt ? new Date(job.createdAt).toISOString() : null,
    fonte: "lever",
    departamento: job.categories?.team || null,
  }));
}

const COLETORES = {
  greenhouse: coletarGreenhouse,
  lever: coletarLever,
};

// ---------- Filtro simples de palavras-chave (opcional) ----------
// Ajuste PALAVRAS_CHAVE para focar em vagas relevantes (ex: cargo, stack, "remote").
// Deixe a lista vazia [] para trazer TODAS as vagas de cada empresa.
const PALAVRAS_CHAVE = [
  "service delivery",
  "service desk",
  "incident",
  "itsm",
  "it support",
  "support analyst",
  "operations analyst",
  "salesforce",
  "help desk",
];

function passaNoFiltro(vaga) {
  if (PALAVRAS_CHAVE.length === 0) return true;
  const alvo = `${vaga.titulo} ${vaga.departamento || ""}`.toLowerCase();
  return PALAVRAS_CHAVE.some((palavra) => alvo.includes(palavra.toLowerCase()));
}

// ---------- Execucao principal ----------

async function main() {
  if (!existsSync(DATA_DIR)) {
    await mkdir(DATA_DIR, { recursive: true });
  }

  const configRaw = await readFile(EMPRESAS_PATH, "utf-8");
  const { empresas } = JSON.parse(configRaw);

  let vagasExistentes = [];
  if (existsSync(OUTPUT_PATH)) {
    try {
      vagasExistentes = JSON.parse(await readFile(OUTPUT_PATH, "utf-8"));
    } catch {
      vagasExistentes = [];
    }
  }
  const mapaExistentes = new Map(vagasExistentes.map((v) => [v.id, v]));

  const todasVagas = [];
  const erros = [];

  for (const empresa of empresas) {
    const coletor = COLETORES[empresa.fonte];
    if (!coletor) {
      erros.push(`Fonte desconhecida "${empresa.fonte}" para ${empresa.nome}`);
      continue;
    }
    try {
      const vagas = await coletor(empresa);
      const filtradas = vagas.filter(passaNoFiltro);
      todasVagas.push(...filtradas);
      console.log(`OK  ${empresa.nome.padEnd(20)} -> ${filtradas.length} vaga(s)`);
    } catch (err) {
      erros.push(`${empresa.nome}: ${err.message}`);
      console.log(`ERRO ${empresa.nome.padEnd(20)} -> ${err.message}`);
    }
  }

  // Dedup por id + preserva "primeira_vez_vista_em" se a vaga ja existia
  const agora = new Date().toISOString();
  const vagasFinais = [];
  const vistos = new Set();

  for (const vaga of todasVagas) {
    if (vistos.has(vaga.id)) continue;
    vistos.add(vaga.id);
    const existente = mapaExistentes.get(vaga.id);
    vagasFinais.push({
      ...vaga,
      primeira_vez_vista_em: existente?.primeira_vez_vista_em || agora,
      atualizada_em: agora,
    });
  }

  vagasFinais.sort((a, b) => new Date(b.publicada_em || 0) - new Date(a.publicada_em || 0));

  await writeFile(OUTPUT_PATH, JSON.stringify(vagasFinais, null, 2), "utf-8");

  console.log(`\nTotal: ${vagasFinais.length} vaga(s) salvas em docs/vagas.json`);
  if (erros.length) {
    console.log(`\n${erros.length} erro(s):`);
    erros.forEach((e) => console.log(`  - ${e}`));
  }
}

main().catch((err) => {
  console.error("Falha ao rodar o coletor:", err);
  process.exit(1);
});
