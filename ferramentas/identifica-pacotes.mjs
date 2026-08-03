// descobre de QUAL fera é um pacote de animações órfão: compara a contagem
// de vértices (accessor POSITION da 1ª primitiva) com os modelos originais
import { readdirSync } from 'node:fs';
import { leGlb } from './glb-kit.mjs';

const RAIZ = 'C:/Projetos/mundo-of-feras';
const RICAS = `${RAIZ}/Feras/animações/extraidos`;
const ORIG = `${RAIZ}/Feras/modelos 3d animados`;

function assinatura(caminho) {
  const glb = leGlb(caminho);
  const m = glb.json.meshes || [];
  const contas = m.flatMap((me) => me.primitives.map(
    (p) => glb.json.accessors[p.attributes.POSITION].count));
  return contas.join('+');
}

const orfaos = ['Meshy_AI_Cubic_Clay_Bot_biped', 'Meshy_AI_Emerald_Brute_biped',
                'Meshy_AI_Flora_the_Hedgehog_biped'];
const assOrfao = {};
for (const o of orfaos) {
  const arq = readdirSync(`${RICAS}/${o}`).find((f) => f.endsWith('.glb'));
  assOrfao[o] = assinatura(`${RICAS}/${o}/${arq}`);
  console.log('ÓRFÃO', o, assOrfao[o]);
}
for (const f of readdirSync(ORIG).filter((f) => f.endsWith('.glb'))) {
  const a = assinatura(`${ORIG}/${f}`);
  for (const [o, ao] of Object.entries(assOrfao))
    if (a === ao) console.log('CASOU:', o, '=>', f);
}
