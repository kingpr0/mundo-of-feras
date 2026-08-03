// v5: animações RICAS por fera (pasta Feras/animações) casadas por NOME —
// jogue um zip do Meshy lá e os clipes certos entram sozinhos; o gerador
// cobre só o que faltar. Investida virou dash de corpo FIRME.
import { mkdirSync, statSync, readdirSync, existsSync } from 'node:fs';
import * as THREE from 'three';
import { leGlb, escreveGlb, enxuga, poeClipe, copiaAnimacao, analisaEsqueleto, classificaCadeias, amostraFaixas, eixoX, eixoY, eixoZ, giro } from './glb-kit.mjs';

const RAIZ = 'C:/Projetos/mundo-of-feras';
const ORIG = `${RAIZ}/Feras/modelos 3d animados`;
const NOVAS = `${RAIZ}/Feras/novas animações`;
const RICAS = `${RAIZ}/Feras/animações/extraidos`;
const EX = `${NOVAS}/extraidos`;

const ANIMADAS = {
  gotim: 'Azure_Dragonling', gotorrente: 'Azure_Wyrm', gotao: 'Coralwing_Dragon',
  vulpim: 'Crimson_Emberling', vulpiro: 'Crimson_Fangwyrm', rochedo: 'Crystal_Golem',
  brasurio: 'Ember', dragobrasa: 'Emberwing_Dragon', cascorao: 'Emerald_Horned_Beetle',
  nevim: 'Frosty_Cub', nevurso: 'Icebound_Guardian', gravetim: 'Little_Wooden_Treant',
  brasinha: 'Peachy_Hatchling', espinharal: 'Petalbound_Dragon', cogumim: 'Smiling_Mushroom',
  raiozim: 'Sunny_Fluff_Bunny', florasto: 'Emerald_Brute', cogumal: 'Whimsy_Shroom',
  raiotron: 'Zigzag_Thunderclaw',
  // identificados pela TEXTURA (o Meshy rebatiza no rig): robô de argila
  // cúbico = rochim, brutamontes esmeralda = florasto, ouriço-flor = espinhim
  rochim: 'Cubic_Clay_Bot', espinhim: 'Flora_the_Hedgehog',
};
// clipes por FERA que vencem o MAPA_NOMES: o dragobrasa anda devagar e
// imponente (pedido do Domador — a Slow Orc Walk vira o andar dele)
const EXTRA_FERA = { dragobrasa: [[/Slow_Orc_Walk/i, 'andar']] };
const AVULSAS = {
  voltouro: 'Meshy_AI_model_Animation_Walking_withSkin.glb',
  furim: 'Meshy_AI_model_Animation_Walking_withSkin (1).glb',
  folhito: 'Meshy_AI_model_Animation_Walking_withSkin (2).glb',
  pratim: 'Meshy_AI_model_Animation_Walking_withSkin (3).glb',
  dunim: 'Meshy_AI_model_Animation_Walking_withSkin (4).glb',
  brasouro: 'Meshy_AI_model_Animation_Walking_withSkin (5).glb',
};
const GERADAS = {
  folhardo: 'grama 2', gelavim: 'ave gelo 1',
  gelavor: 'ave gelo 2', pratagor: 'dragão prateado 2',
  pedrusco: 'pedregulho',
};
const BRACO_FECHADO = { raiotron: 0.42 };
const VOADORAS = new Set(['gelavim', 'gelavor', 'dragobrasa', 'pratagor']);

// nome do arquivo Meshy -> clipe do jogo (primeiro padrão que casar vence)
const MAPA_NOMES = [
  [/_Walking_/i, 'andar'],
  [/_Running_/i, 'correr'],
  [/Idle/i, 'parado'],
  // combo físico do Z (3 estágios), na ordem do Domador
  [/Charged_Upward_Slash|Uppercut/i, 'combo1'],
  [/Charged_Slash|Claw|Scratch/i, 'combo2'],
  [/Left_Hook|Punch_Combo|Punch/i, 'combo3'],
  [/Ground_Slam|Charged_Ground/i, 'forte'],
  // boca (Skill 01) vs mãos (Mage Spell Cast = kamehameha)
  [/Skill_01/i, 'arremesso'],
  [/soell_cast|mage_spell|Spell_Cast_3/i, 'kame'],
  [/Charged_Spell_Cast/i, 'conjuracao'],
  [/Hit_Reaction|HitReact/i, 'dano'],
  [/Death|Die/i, 'ko'],
  [/360_Power_Spin/i, 'forte'],
  [/Backflip/i, 'mortal'],
  [/Roll_Dodge/i, 'esquiva'],
];
function clipeDoArquivo(arq) {
  for (const [re, clipe] of MAPA_NOMES) if (re.test(arq)) return clipe;
  return null;
}

mkdirSync(`${RAIZ}/assets/feras`, { recursive: true });

const s2 = (u, f = 1, fase = 0) => Math.sin(u * Math.PI * 2 * f + fase);
const pulso = (u, pico, lg) => Math.max(0, 1 - Math.abs(u - pico) / lg);
const suave = (x) => x * x * (3 - 2 * x);
const sobe = (u, a, b) => u <= a ? 0 : u >= b ? 1 : suave((u - a) / (b - a));

// gera SÓ os clipes que ainda faltam (ja = nomes já vindos do Meshy)
function geraClipes(glb, ja, anguloBraco, voa) {
  const sk = analisaEsqueleto(glb);
  if (sk.raiz === undefined) return false;
  sk.posMRaizY = sk.posM(sk.raiz).y;
  const { cadeias, tronco, frenteZ } = classificaCadeias(sk);
  const nomeIdx = new Map(glb.json.nodes.map((n, i) => [n.name, i]));
  const biped = nomeIdx.has('LeftArm') && nomeIdx.has('RightArm');
  const h = sk.altura;
  const raiz = sk.raiz;
  const espinha = tronco[1];
  const pernas = cadeias.filter((c) => c.tipo === 'perna');
  const caudas = cadeias.filter((c) => c.tipo === 'cauda');
  const pescocos = cadeias.filter((c) => c.tipo === 'pescoco');
  const laterais = cadeias.filter((c) => c.tipo === 'lateral');
  const F = frenteZ;

  const bracos = (dur, q, fnPorLado = null) => {
    if (!biped) return [];
    const fx = [];
    for (const [nome, sinal] of [['LeftArm', -1], ['RightArm', 1]]) {
      const i = nomeIdx.get(nome);
      fx.push(...amostraFaixas(sk, i, dur, q, (u) => {
        let rot = giro(eixoZ, sinal * anguloBraco);
        if (fnPorLado) {
          const extra = fnPorLado(u, sinal);
          if (extra) rot = extra.multiply(rot);
        }
        return { rot };
      }));
    }
    return fx;
  };

  const clipes = {};
  if (!ja.has('parado')) {
    const fx = [];
    fx.push(...amostraFaixas(sk, raiz, 3.0, 24, (u) => ({
      mov: new THREE.Vector3(0, h * 0.012 * s2(u, 2), 0),
      esc: 1 + 0.012 * s2(u, 2, 0.4),
    })));
    if (espinha !== undefined)
      fx.push(...amostraFaixas(sk, espinha, 3.0, 24, (u) => ({ rot: giro(eixoX, 0.04 * s2(u, 1)) })));
    for (const c of caudas)
      fx.push(...amostraFaixas(sk, c.no, 3.0, 24, (u) => ({ rot: giro(eixoY, 0.16 * s2(u, 1.5)) })));
    for (const c of pescocos)
      fx.push(...amostraFaixas(sk, c.no, 3.0, 24, (u) => ({ rot: giro(eixoX, 0.05 * s2(u, 1, 1.1)) })));
    if (!biped)
      for (const c of laterais)
        fx.push(...amostraFaixas(sk, c.no, 3.0, 24, (u) => ({
          rot: giro(eixoZ, c.ladoX * (voa ? 0.3 * s2(u, 2.4) : 0.06 * s2(u, 2, 0.6))),
        })));
    if (biped && voa) { // asas presas aos braços do rig: batidinha leve
      for (const [nome, sinal] of [['LeftArm', -1], ['RightArm', 1]])
        fx.push(...amostraFaixas(sk, nomeIdx.get(nome), 3.0, 24, (u) => ({
          rot: giro(eixoZ, sinal * (anguloBraco - 0.22 * s2(u, 2.4))),
        })));
    } else if (anguloBraco) fx.push(...bracos(3.0, 24));
    clipes.parado = fx;
  }
  if (!ja.has('andar')) { // trote gerado só sem Meshy
    const trote = (dur, ampPerna, ampQuica, lean) => {
      const fx = [];
      fx.push(...amostraFaixas(sk, raiz, dur, 20, (u) => ({
        mov: new THREE.Vector3(0, ampQuica * h * Math.abs(s2(u, 2)), 0),
        rot: giro(eixoX, -F * lean + 0.05 * s2(u, 2)),
      })));
      pernas.forEach((c, i) => {
        const fase = (i % 2 === 0 ? 0 : Math.PI) + (c.ladoX > 0 ? 0 : Math.PI);
        fx.push(...amostraFaixas(sk, c.no, dur, 20, (u) => ({ rot: giro(eixoX, ampPerna * s2(u, 2, fase)) })));
      });
      for (const c of caudas)
        fx.push(...amostraFaixas(sk, c.no, dur, 20, (u) => ({ rot: giro(eixoY, 0.25 * s2(u, 2)) })));
      if (!biped)
        for (const c of laterais)
          fx.push(...amostraFaixas(sk, c.no, dur, 20, (u) => ({ rot: giro(eixoZ, c.ladoX * 0.3 * s2(u, 2)) })));
      if (anguloBraco) fx.push(...bracos(dur, 20));
      return fx;
    };
    clipes.andar = trote(0.72, 0.4, 0.03, 0.05);
    if (!ja.has('correr')) clipes.correr = trote(0.46, 0.55, 0.05, 0.14);
  }
  if (!ja.has('ataque')) {
    // INVESTIDA: corpo FIRME inclinado, disparando em linha reta
    const fx = [];
    fx.push(...amostraFaixas(sk, raiz, 0.62, 24, (u) => {
      const firme = sobe(u, 0.02, 0.16) * (1 - sobe(u, 0.78, 1));
      return {
        rot: giro(eixoX, F * -0.32 * firme),
        mov: new THREE.Vector3(0, h * 0.02 * firme, F * h * 0.06 * firme),
        esc: 1 + 0.06 * firme,
      };
    }));
    if (anguloBraco || biped) fx.push(...bracos(0.62, 24, (u, sinal) => {
      const firme = sobe(u, 0.02, 0.16) * (1 - sobe(u, 0.78, 1));
      return giro(eixoZ, sinal * 0.5 * firme); // braços colados no corpo
    }));
    clipes.ataque = fx;
  }
  if ((biped || laterais.length)) {
    if (!ja.has('combo1')) {
      const fx = [];
      fx.push(...amostraFaixas(sk, raiz, 0.5, 22, (u) => ({
        rot: giro(eixoY, -F * 0.4 * pulso(u, 0.55, 0.35)).multiply(giro(eixoX, F * 0.15 * pulso(u, 0.55, 0.3))),
        mov: new THREE.Vector3(0, 0, F * h * 0.07 * pulso(u, 0.55, 0.3)),
      })));
      if (biped) {
        fx.push(...bracos(0.5, 22, (u, sinal) => {
          if (sinal !== 1) return null;
          const ergue = sobe(u, 0.05, 0.35) * (1 - sobe(u, 0.45, 0.7));
          const rasga = sobe(u, 0.4, 0.6);
          return giro(eixoX, -F * 1.8 * rasga).multiply(giro(eixoZ, -0.9 * ergue - 0.4 * rasga));
        }));
      } else {
        const braco = laterais[0];
        fx.push(...amostraFaixas(sk, braco.no, 0.5, 22, (u) => ({
          rot: giro(eixoX, -F * 1.6 * sobe(u, 0.4, 0.6) * (1 - sobe(u, 0.75, 1))).multiply(
            giro(eixoZ, -braco.ladoX * 0.8 * sobe(u, 0.05, 0.35) * (1 - sobe(u, 0.45, 0.7)))),
        })));
      }
      clipes.combo1 = fx;
    }
    if (!ja.has('combo2') || !ja.has('soco')) {
      const fx = [];
      fx.push(...amostraFaixas(sk, raiz, 0.42, 20, (u) => ({
        rot: giro(eixoY, -F * 0.6 * pulso(u, 0.45, 0.35)),
        mov: new THREE.Vector3(0, 0, F * h * 0.1 * pulso(u, 0.5, 0.3)),
      })));
      if (biped) {
        fx.push(...bracos(0.42, 20, (u, sinal) => sinal !== 1 ? null
          : giro(eixoY, -F * 2.1 * pulso(u, 0.45, 0.32)).multiply(giro(eixoZ, 0.7 * pulso(u, 0.45, 0.32)))));
      } else {
        const braco = laterais[0];
        fx.push(...amostraFaixas(sk, braco.no, 0.42, 20, (u) => ({
          rot: giro(eixoY, -braco.ladoX * 1.9 * pulso(u, 0.45, 0.3)),
        })));
      }
      if (!ja.has('combo2')) clipes.combo2 = fx;
      if (!ja.has('soco')) clipes.soco = fx;
    }
    if (!ja.has('combo3')) {
      const fx = [];
      fx.push(...amostraFaixas(sk, raiz, 0.55, 22, (u) => {
        const carga = pulso(u, 0.3, 0.3), up = sobe(u, 0.4, 0.6) * (1 - sobe(u, 0.8, 1));
        return {
          rot: giro(eixoX, F * (0.18 * carga - 0.3 * up)),
          mov: new THREE.Vector3(0, -h * 0.08 * carga + h * 0.14 * up, F * h * 0.08 * up),
        };
      }));
      if (biped) {
        fx.push(...bracos(0.55, 22, (u, sinal) => {
          if (sinal !== 1) return null;
          const carga = sobe(u, 0.05, 0.35), up = sobe(u, 0.4, 0.58);
          return giro(eixoX, F * (0.7 * carga - 2.2 * up)).multiply(giro(eixoY, -F * 0.7 * up));
        }));
      }
      clipes.combo3 = fx;
    }
  }
  if (biped && !ja.has('kame')) {
    // KAME gerado LIMPO: agacha puxando os braços para trás... e EMPURRA
    // as duas mãos à frente — sem nenhum giro de corpo (isso é do Meshy)
    const fx = [];
    fx.push(...amostraFaixas(sk, raiz, 1.25, 30, (u) => {
      const junta = sobe(u, 0.08, 0.5) * (1 - sobe(u, 0.56, 0.68));
      const solta = sobe(u, 0.56, 0.68);
      return {
        rot: giro(eixoX, F * (-0.12 * junta + 0.1 * solta)),
        mov: new THREE.Vector3(0, -h * 0.08 * junta, F * h * (0.1 * solta - 0.05 * junta)),
        esc: 1 - 0.05 * junta + 0.04 * solta,
      };
    }));
    fx.push(...bracos(1.25, 30, (u, sinal) => {
      const junta = sobe(u, 0.08, 0.5) * (1 - sobe(u, 0.58, 0.7));
      const solta = sobe(u, 0.58, 0.7);
      // braços descem colados ao corpo na carga; disparam juntos à FRENTE
      return giro(eixoY, -F * sinal * 1.45 * solta)
        .multiply(giro(eixoZ, sinal * (1.0 * junta - 0.35 * solta)));
    }));
    clipes.kame = fx;
  }
  if (!ja.has('dano')) {
    const fx = [];
    fx.push(...amostraFaixas(sk, raiz, 0.4, 16, (u) => ({
      rot: giro(eixoX, -F * 0.3 * pulso(u, 0.2, 0.5)),
      mov: new THREE.Vector3(0.02 * h * s2(u, 6) * pulso(u, 0.4, 0.6), 0, -F * h * 0.08 * pulso(u, 0.25, 0.4)),
    })));
    if (anguloBraco) fx.push(...bracos(0.4, 16));
    clipes.dano = fx;
  }
  if (!ja.has('ko')) {
    const fx = [];
    fx.push(...amostraFaixas(sk, raiz, 0.9, 18, (u) => {
      const q = suave(Math.min(1, u * 1.25));
      return {
        rot: giro(eixoZ, 1.45 * q),
        mov: new THREE.Vector3(0, -sk.posMRaizY * 0.75 * q + h * 0.06 * Math.sin(Math.min(1, u * 1.25) * Math.PI), 0),
      };
    }));
    if (anguloBraco) fx.push(...bracos(0.9, 18));
    clipes.ko = fx;
  }
  for (const [nome, fx] of Object.entries(clipes)) poeClipe(glb, nome, fx);
  return true;
}

async function salva(glb, id) {
  await enxuga(glb);
  const saida = `${RAIZ}/assets/feras/${id}.glb`;
  escreveGlb(saida, glb.json, glb.bin);
  console.log(`${id}.glb  ${(statSync(saida).size / 1048576).toFixed(2)} MB  [${(glb.json.animations || []).map((a) => a.name).join(',')}]`);
}

// pasta RICA da fera (Feras/animações/extraidos/Meshy_AI_<nome>_biped*)
function pastaRica(meshyNome) {
  if (!existsSync(RICAS)) return null;
  const alvo = `Meshy_AI_${meshyNome}_biped`;
  const p = readdirSync(RICAS).find((d) => d === alvo || d.startsWith(alvo));
  return p ? `${RICAS}/${p}` : null;
}

let falhas = 0;
for (const [id, pasta] of Object.entries(ANIMADAS)) {
  try {
    const rica = pastaRica(pasta);
    let base = null;
    const ja = new Set();
    if (rica) {
      // TODOS os clipes do Meshy entram, casados por nome de arquivo
      const arqs = readdirSync(rica).filter((f) => f.endsWith('.glb'));
      // regras da fera primeiro (ex.: andar lento do dragobrasa), depois o mapa geral
      const clipeDe = (arq) => {
        for (const [re, c] of EXTRA_FERA[id] || []) if (re.test(arq)) return c;
        return clipeDoArquivo(arq);
      };
      // duas passadas: 1ª só regras da fera (para vencerem a ordem alfabética)
      const arqsOrd = [
        ...arqs.filter((a) => (EXTRA_FERA[id] || []).some(([re]) => re.test(a))),
        ...arqs.filter((a) => !(EXTRA_FERA[id] || []).some(([re]) => re.test(a))),
      ];
      for (const arq of arqsOrd) {
        const clipe = clipeDe(arq);
        if (!clipe || ja.has(clipe)) continue;
        const glb = leGlb(`${rica}/${arq}`);
        if (!base) { base = glb; base.json.animations[0].name = clipe; }
        else copiaAnimacao(base, glb, 0, clipe);
        ja.add(clipe);
      }
    }
    if (!base) { // sem pasta rica: Walking/Running clássicos
      const P = `${EX}/Meshy_AI_${pasta}_biped/Meshy_AI_${pasta}_biped_Animation_`;
      base = leGlb(`${P}Walking_withSkin.glb`);
      base.json.animations[0].name = 'andar';
      copiaAnimacao(base, leGlb(`${P}Running_withSkin.glb`), 0, 'correr');
      ja.add('andar'); ja.add('correr');
      if (pasta === 'Verdant_Sentinel') {
        copiaAnimacao(base, leGlb(`${P}360_Power_Spin_Jump_withSkin.glb`), 0, 'forte');
        ja.add('forte');
      }
    }
    geraClipes(base, ja, BRACO_FECHADO[id] || 0, VOADORAS.has(id));
    await salva(base, id);
  } catch (e) { console.log(`${id}: ERRO ${e.message}`); falhas++; }
}
for (const [id, arq] of Object.entries(AVULSAS)) {
  try {
    const base = leGlb(`${NOVAS}/${arq}`);
    base.json.animations[0].name = 'andar';
    copiaAnimacao(base, base, 0, 'correr');
    geraClipes(base, new Set(['andar', 'correr']), BRACO_FECHADO[id] || 0, VOADORAS.has(id));
    await salva(base, id);
  } catch (e) { console.log(`${id}: ERRO ${e.message}`); falhas++; }
}
for (const [id, arq] of Object.entries(GERADAS)) {
  try {
    const base = leGlb(`${ORIG}/${arq}.glb`);
    geraClipes(base, new Set(), BRACO_FECHADO[id] || 0, VOADORAS.has(id));
    await salva(base, id);
  } catch (e) { console.log(`${id}: ERRO ${e.message}`); falhas++; }
}
if (falhas) { console.log(`\n${falhas} falha(s)`); process.exit(1); }
