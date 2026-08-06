// Processa o CENÁRIO do Domador (Modelos 3d/*) em assets/cenario/*.glb:
// árvores, arbustos, pedras, construções, baús e esferas — estáticos,
// texturas enxutas a 512px (cenário não precisa de mais).
import { mkdirSync, statSync, existsSync, readdirSync } from 'node:fs';
import { leGlb, escreveGlb, enxuga } from './glb-kit.mjs';

const RAIZ = 'C:/Projetos/mundo-of-feras';
const M3D = `${RAIZ}/Modelos 3d`;

// slug do jogo -> prefixo do arquivo Meshy (basta o começo do nome)
const CATALOGO = {
  // --- árvores e arbustos ---
  'arvore-outono': ['Árvores e arbustos', 'Meshy_AI_Autumn_Ember_Tree'],
  'arvore-cristal': ['Árvores e arbustos', 'Meshy_AI_Azure_Crystal_Tree'],
  'arvore-petala': ['Árvores e arbustos', 'Meshy_AI_Azure_Petal_Cloud'],
  'arvore-bolha': ['Árvores e arbustos', 'Meshy_AI_Bubble_Tree'],
  'arvore-nuvem': ['Árvores e arbustos', 'Meshy_AI_Emerald_Cloud_Tree_0803230059'],
  'arvore-nuvem-2': ['Árvores e arbustos', 'Meshy_AI_Emerald_Cloud_Tree_0803230121'],
  'arvore-verdejante': ['Árvores e arbustos', 'Meshy_AI_Verdant_Cloud_Tree'],
  'arvore-vulcanica': ['Árvores e arbustos', 'Meshy_AI_Volcanic_Brain_Tree'],
  'arbusto-amendoa': ['Árvores e arbustos', 'Meshy_AI_Almond_Petal_Hill'],
  'arbusto-outono': ['Árvores e arbustos', 'Meshy_AI_Autumn_Leaves_Mound'],
  'arbusto-orbe': ['Árvores e arbustos', 'Meshy_AI_Emerald_Orb'],
  'colina-flores': ['Árvores e arbustos', 'Meshy_AI_Hill_of_Flowers'],
  'massa-lava': ['Árvores e arbustos', 'Meshy_AI_Molten_Ember_Mass'],
  'arbusto-samambaia': ['Árvores e arbustos', 'Meshy_AI_Purple_Fern_Slime'],
  'arbusto-verdejante': ['Árvores e arbustos', 'Meshy_AI_Verdant_Mound_0803225922_texture.glb'],
  // --- construções ---
  'casa-adobe': ['Construções', 'Meshy_AI_Adobe_Cube_House'],
  'casa-bambu': ['Construções', 'Meshy_AI_Bamboo_Haven'],
  'cabana-tronco': ['Construções', 'Meshy_AI_Cozy_Log_Cabin'],
  'bazar-deserto': ['Construções', 'Meshy_AI_Desert_Bazaar'],
  'santuario-floresta': ['Construções', 'Meshy_AI_Forest_Sanctuary_Cott'],
  'centro-cura': ['Construções', 'Meshy_AI_Pastel_Healing_Center'],
  'centro-cura-toy': ['Construções', 'Meshy_AI_Healing_Center_Toy_Cl'],
  'cidadela-raio': ['Construções', 'Meshy_AI_Lightning_Citadel'],
  'casinha-aconchego': ['Construções', 'Meshy_AI_Miniature_Cozy_Cottag'],
  'iglu': ['Construções', 'Meshy_AI_Miniature_Igloo'],
  'montanha-lava': ['Construções', 'Meshy_AI_Molten_Mountain'],
  'cabana-neve': ['Construções', 'Meshy_AI_Snowbound_Log_Cabin'],
  'mercado-madeira': ['Construções', 'Meshy_AI_Timber_Market'],
  // --- baús e esferas ---
  'esfera-azul': ['Esferas e diversos', 'Meshy_AI_Blue_Split_Sphere'],
  'esfera-esmeralda': ['Esferas e diversos', 'Meshy_AI_Emerald_Lightning_Sph'],
  'bau-encantado': ['Esferas e diversos', 'Meshy_AI_Enchanted_Question_Cu'],
  'orbe-coracao': ['Esferas e diversos', 'Meshy_AI_Heartlight_Orb'],
  'bau-bloco': ['Esferas e diversos', 'Meshy_AI_Question_Block'],
  'esfera-captura': ['Esferas e diversos', 'Meshy_AI_Split_Sphere'],
  // --- diversos (pedras, muros, monólitos) ---
  'monolito-prisma': ['modelos 3d diversos', 'Meshy_AI_Azure_Prism_Monolith'],
  'arbusto-oval': ['modelos 3d diversos', 'Meshy_AI_Bush_A_dense_oblong'],
  'arbusto-redondo': ['modelos 3d diversos', 'Meshy_AI_Bush_A_dense_rounde'],
  'pedra-lisa': ['modelos 3d diversos', 'Meshy_AI_Rock_Game_Assets_'],
  'pedra-medieval': ['modelos 3d diversos', 'Meshy_AI_Rock_in_medieval_era'],
  'muro-pedra': ['modelos 3d diversos', 'Meshy_AI_Rock_stone_thick_Wall'],
  'pedra-estilizada': ['modelos 3d diversos', 'Meshy_AI_Stylized_rock'],
  'torre-madeira': ['modelos 3d diversos', 'Meshy_AI_Timberstone_Tower_Hou'],
  'castelo-fantasia': ['modelos 3d diversos', 'Meshy_AI_ultra_detailed_fantas'],
  // FORA por malha pesada demais (>5MB mesmo enxutos) — regerar no Meshy
  // em low-poly antes de entrar: toca-minotauro (45MB), portal-santuario
  // (34MB), torre-vigia (28MB), templo (19MB), espiral-cristal (18MB),
  // vila-fantasia (6MB)
};

mkdirSync(`${RAIZ}/assets/cenario`, { recursive: true });
let falhas = 0;
for (const [slug, [pasta, prefixo]] of Object.entries(CATALOGO)) {
  try {
    const dir = `${M3D}/${pasta}`;
    const arq = readdirSync(dir).find((f) => f.startsWith(prefixo) && f.endsWith('.glb'));
    if (!arq) throw new Error(`nenhum glb começa com ${prefixo}`);
    const glb = leGlb(`${dir}/${arq}`);
    await enxuga(glb, { ladoMax: 512, qualidade: 74 });
    const saida = `${RAIZ}/assets/cenario/${slug}.glb`;
    escreveGlb(saida, glb.json, glb.bin);
    console.log(`${slug}.glb  ${(statSync(saida).size / 1048576).toFixed(2)} MB`);
  } catch (e) { console.log(`${slug}: ERRO ${e.message}`); falhas++; }
}
if (falhas) { console.log(`\n${falhas} falha(s)`); process.exit(1); }
