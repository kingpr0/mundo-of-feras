// Processa os 9 treinadores: base = Walking, copia Running, gera "parado",
// enxuga texturas e salva em assets/treinadores/tN.glb
import { mkdirSync, statSync } from 'node:fs';
import * as THREE from 'three';
import { leGlb, escreveGlb, enxuga, copiaAnimacao, poeClipe, analisaEsqueleto, amostraFaixas, eixoX, eixoZ, giro } from './glb-kit.mjs';

const RAIZ = 'C:/Projetos/mundo-of-feras';
const EX = `${RAIZ}/Treinadores/extraidos`;
const TREINADORES = [
  [1, 'Meshy_AI_Rising_Adventurer_biped'],
  [2, 'Meshy_AI_The_Grumpy_Hiker_biped'],
  [4, 'Meshy_AI_Little_Wanderer_biped'],
  [5, 'Meshy_AI_Forest_Druid_Apprenti_biped'],
  [6, 'Meshy_AI_Little_Forest_Explore_biped'],
  [7, 'Meshy_AI_Celestial_Witch_biped'],
  [8, 'Meshy_AI_Aviator_Adventurer_biped'],
  [9, 'Meshy_AI_Junior_Trailblazer_biped'],
];

mkdirSync(`${RAIZ}/assets/treinadores`, { recursive: true });

// idle de bípede: BRAÇOS ABAIXADOS (a pose de descanso é T aberta — feio
// parado), respiração no peito e balanço sutil dos quadris e da cabeça
function geraParadoBipede(glb) {
  const sk = analisaEsqueleto(glb);
  const nomeIdx = new Map(glb.json.nodes.map((n, i) => [n.name, i]));
  const h = sk.altura;
  const faixas = [];
  const DUR = 3.2, Q = 24;
  const s2 = (x, f = 1, fase = 0) => Math.sin(x * Math.PI * 2 * f + fase);
  const add = (nome, fn) => {
    const i = nomeIdx.get(nome);
    if (i !== undefined) faixas.push(...amostraFaixas(sk, i, DUR, Q, fn));
  };
  add('Hips', (u) => ({ mov: new THREE.Vector3(0, -h * 0.008 * (1 - Math.cos(u * Math.PI * 4)) / 2, 0) }));
  add('Spine01', (u) => ({ rot: giro(eixoX, 0.025 * s2(u, 2)) }));
  add('Spine', (u) => ({ rot: giro(eixoX, 0.03 * s2(u, 2, 0.5)), esc: 1 + 0.008 * s2(u, 2) }));
  add('Head', (u) => ({ rot: giro(eixoX, 0.03 * s2(u, 1, 1.2)) }));
  // braço esquerdo aponta +x, direito -x: abaixar é girar em Z para lados opostos
  add('LeftArm', (u) => ({ rot: giro(eixoZ, -0.7 + 0.04 * s2(u, 2, 0.3)) }));
  add('RightArm', (u) => ({ rot: giro(eixoZ, 0.7 - 0.04 * s2(u, 2, 0.3)) }));
  add('LeftForeArm', () => ({ rot: giro(eixoZ, -0.1) }));
  add('RightForeArm', () => ({ rot: giro(eixoZ, 0.1) }));
  poeClipe(glb, 'parado', faixas);
}

for (const [n, pasta] of TREINADORES) {
  const base = leGlb(`${EX}/${pasta}/${pasta}_Animation_Walking_withSkin.glb`);
  const corre = leGlb(`${EX}/${pasta}/${pasta}_Animation_Running_withSkin.glb`);
  base.json.animations[0].name = 'andar';
  copiaAnimacao(base, corre, 0, 'correr');
  geraParadoBipede(base);
  await enxuga(base);
  const saida = `${RAIZ}/assets/treinadores/t${n}.glb`;
  escreveGlb(saida, base.json, base.bin);
  console.log(`t${n}.glb  ${(statSync(saida).size / 1048576).toFixed(2)} MB  anims: ${base.json.animations.map((a) => a.name).join(',')}`);
}

// treinador 3: sem animações — só idle genérico (rig UniRig) + enxugada
{
  const t3 = leGlb(`${RAIZ}/Treinadores/treinador 3.glb`);
  const sk = analisaEsqueleto(t3);
  const h = sk.altura;
  const faixas = [];
  if (sk.raiz !== undefined) {
    faixas.push(...amostraFaixas(sk, sk.raiz, 3.2, 24, (u) => ({
      mov: new THREE.Vector3(0, -h * 0.008 * (1 - Math.cos(u * Math.PI * 4)) / 2, 0),
      esc: 1 + 0.008 * Math.sin(u * Math.PI * 4),
    })));
    poeClipe(t3, 'parado', faixas);
  }
  await enxuga(t3);
  const saida = `${RAIZ}/assets/treinadores/t3.glb`;
  escreveGlb(saida, t3.json, t3.bin);
  console.log(`t3.glb  ${(statSync(saida).size / 1048576).toFixed(2)} MB  anims: ${(t3.json.animations || []).map((a) => a.name).join(',') || 'nenhuma'}`);
}
