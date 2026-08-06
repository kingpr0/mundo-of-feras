// POSES de golpe por fera: modelos estáticos das pastas Modelos 3d/Feras/NN
// viram assets/poses/<slug>.glb enxutos. O render troca o corpo pela pose
// durante o golpe (quadro congelado, estilo anime) — piloto: Folhito.
import { mkdirSync, statSync, readdirSync } from 'node:fs';
import { leGlb, escreveGlb, enxuga } from './glb-kit.mjs';

const RAIZ = 'C:/Projetos/mundo-of-feras';
const ORIGEM = `${RAIZ}/Modelos 3d/Feras`;

// slug -> [pasta, prefixo do arquivo]
const CATALOGO = {
  'folhito-rolar': ['01 Folhito', 'Meshy_AI_Spinning_Turtle'],
  'folhito-poder': ['01 Folhito', 'Meshy_AI_Emerald_Breath'],
  'folhito-soco': ['01 Folhito', 'Meshy_AI_Emerald_Fist'],
};

mkdirSync(`${RAIZ}/assets/poses`, { recursive: true });
let falhas = 0;
for (const [slug, [pasta, prefixo]] of Object.entries(CATALOGO)) {
  try {
    const arq = readdirSync(`${ORIGEM}/${pasta}`).find((f) => f.startsWith(prefixo) && f.endsWith('.glb'));
    if (!arq) throw new Error(`nenhum glb começa com ${prefixo}`);
    const glb = leGlb(`${ORIGEM}/${pasta}/${arq}`);
    await enxuga(glb, { ladoMax: 512, qualidade: 76 });
    const saida = `${RAIZ}/assets/poses/${slug}.glb`;
    escreveGlb(saida, glb.json, glb.bin);
    console.log(`${slug}.glb  ${(statSync(saida).size / 1048576).toFixed(2)} MB`);
  } catch (e) { console.log(`${slug}: ERRO ${e.message}`); falhas++; }
}
if (falhas) process.exit(1);
