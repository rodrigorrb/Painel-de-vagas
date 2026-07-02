// server.js
// Servidor local só para pré-visualizar a pasta docs/ (o mesmo conteúdo que
// vai para o GitHub Pages) antes de dar commit/push. Não é necessário em
// produção — o GitHub Pages serve docs/ diretamente como site estático.
//
// Uso: npm start  →  http://localhost:3000

import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.static(path.join(__dirname, "docs")));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Preview local em http://localhost:${PORT}`);
  console.log('Se docs/vagas.json nao existir ainda, rode "npm run collect" primeiro.');
});
