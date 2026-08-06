// Retratos (cabeças) das feras: Modelos 3d/Feras/NN Nome/cabeça*.png ->
// assets/retratos/<id>.png em 128px, círculo recortado para o HUD.
import { readdirSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const Jimp = require('jimp');

const RAIZ = 'C:/Projetos/mundo-of-feras';
const ORIGEM = `${RAIZ}/Modelos 3d/Feras`;
// ordem das pastas 01..33 = ordem de evolução do especies.json
const IDS = ['folhito', 'folhardo', 'florasto', 'brasinha', 'brasurio', 'dragobrasa',
  'gotim', 'gotao', 'gotorrente', 'raiozim', 'raiotron', 'espinhim', 'espinharal',
  'cogumim', 'cogumal', 'nevim', 'nevurso', 'gelavim', 'gelavor', 'pratim', 'pratagor',
  'vulpim', 'vulpiro', 'rochim', 'rochedo', 'dunim', 'furim', 'gravetim', 'pedrusco',
  'cascorao', 'voltouro', 'brasouro', 'draguim'];

mkdirSync(`${RAIZ}/assets/retratos`, { recursive: true });
const pastas = readdirSync(ORIGEM).sort();
for (let i = 0; i < IDS.length; i++) {
  const pasta = pastas.find((p) => p.startsWith(String(i + 1).padStart(2, '0')));
  if (!pasta) { console.log(IDS[i], 'SEM PASTA'); continue; }
  const arq = readdirSync(`${ORIGEM}/${pasta}`).find((f) => /cabe|head/i.test(f) && /png|jpg/i.test(f));
  if (!arq) { console.log(IDS[i], 'sem cabeça (placeholder no jogo)'); continue; }
  const img = await Jimp.read(`${ORIGEM}/${pasta}/${arq}`);
  img.cover(128, 128);
  // recorte circular com borda suave: fica redondinho no painel
  const R = 64;
  img.scan(0, 0, 128, 128, function (x, y, idx) {
    const d = Math.hypot(x - 63.5, y - 63.5);
    if (d > R - 1) this.bitmap.data[idx + 3] = Math.max(0, Math.round(255 * (R - d)));
  });
  await img.writeAsync(`${RAIZ}/assets/retratos/${IDS[i]}.png`);
  console.log(IDS[i], '<-', pasta + '/' + arq);
}
