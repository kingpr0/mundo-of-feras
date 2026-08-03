// exporta a 1ª textura de cor de cada pacote órfão como PNG/JPG para olhar
import { readdirSync, writeFileSync } from 'node:fs';
import { leGlb } from './glb-kit.mjs';

const RICAS = 'C:/Projetos/mundo-of-feras/Feras/animações/extraidos';
const SAIDA = process.argv[2] || '.';
const orfaos = ['Meshy_AI_Cubic_Clay_Bot_biped', 'Meshy_AI_Emerald_Brute_biped',
                'Meshy_AI_Flora_the_Hedgehog_biped'];
for (const o of orfaos) {
  const arq = readdirSync(`${RICAS}/${o}`).find((f) => f.endsWith('.glb'));
  const glb = leGlb(`${RICAS}/${o}/${arq}`);
  const img = (glb.json.images || [])[0];
  if (!img) { console.log(o, 'sem imagem'); continue; }
  const bv = glb.json.bufferViews[img.bufferView];
  const dados = glb.bin.subarray(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength);
  const ext = (img.mimeType || 'image/png').includes('jpeg') ? 'jpg' : 'png';
  writeFileSync(`${SAIDA}/${o}.${ext}`, dados);
  console.log(o, '->', `${o}.${ext}`, dados.length);
}
