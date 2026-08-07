// MAIN — o maestro: carrega os dados, liga a simulação (sim/) à apresentação
// (render/) e roda o loop. A simulação decide; o main traduz eventos em
// som, partículas e HUD. Nenhuma regra de jogo vive aqui.
import * as THREE from 'three';
import { criarMundo, passoMundo, daImunidade, entradaDoMapa, interacaoPerto } from './sim/mundo.js';
import { criarBatalha, passoBatalha, podeCapturar, fugirBatalha, trocaFera, continuaComOutraFera, proximaFeraTreinador, custoEnergia } from './sim/batalha.js';
import { ganhaXp, xpParaSubir, xpPorVitoria, nivelSelvagem, vidaMaxima, NIVEL_INICIAL } from './sim/progressao.js';
import { criarFera, aprendeGolpe, lembraGolpe, montaSlots, aprendizadosDoNivel, curaTotal, bonusNivel, paraBatalha, evoluiFera, verificaEvolucao } from './sim/equipe.js';
import { empacotaSave, validaSave } from './sim/save.js';
import { criarCena, poof, jato, passoParticulas, passoAmbiente, passoCamera, mostraArena, temaArena, montaMapa, passoOclusores, renderiza, marcaHeroi } from './render/cena.js';
import { criarEfeitos } from './render/efeitos.js';
import * as MD from './render/modelos.js';
import { criarHUD } from './render/hud.js';
import { audioInit, sfx, musica, alternaSom, somLigado } from './render/audio.js';

const especies = await (await fetch('./src/dados/especies.json')).json();
const dadosMapas = await (await fetch('./src/dados/mapas.json')).json();
const golpesCat = await (await fetch('./src/dados/golpes.json')).json();
const tipos = await (await fetch('./src/dados/tipos.json')).json();

const cv = document.getElementById('cv');
const cena = criarCena(cv);
const fx = criarEfeitos(cena.scene); // golpes elementais em sprites 2.5D
const hud = criarHUD();

// modelos 3D: um conjunto para a fera do jogador e outro para a selvagem
// (criarFera é assíncrono — espécies com "modelo3d" carregam arquivos glTF)
// o HERÓI é o treinador 1 (modelo do Domador); se o arquivo faltar,
// o boneco procedural clássico assume
const domador = await MD.criarPersonagem(cena.scene, './assets/treinadores/t1.glb', 1.72)
  .catch(() => MD.criarDomador(cena.scene));
// o herói vive na CAMADA 1: no mundo sem-cor ele é o único colorido
marcaHeroi(domador.g);
const modelosJog = {}, modelosIni = {};
for (const k of Object.keys(especies)) {
  modelosJog[k] = await MD.criarFera(cena.scene, k, especies[k]); MD.mostra(modelosJog[k], false);
  modelosIni[k] = await MD.criarFera(cena.scene, k, especies[k]); MD.mostra(modelosIni[k], false);
}
const cristal = MD.criarCristal(cena.scene); MD.mostra(cristal, false);
const discoHolo = MD.criarDiscoHolo(cena.scene); MD.mostra(discoHolo, false);
let holoM = null; // fera projetada no menu de status/compêndio

const RINGUE = { dom: { x: -5, y: 0, z: 0 }, fera: { x: 3.5, y: 0, z: 0 } };
// o tablado da arena tem topo em y ≈ 0.12 — os lutadores sobem junto
const ARENA_Y = 0.12;
const sobreTablado = (pos) => ({ x: pos.x, y: pos.y + ARENA_Y, z: pos.z });
const DICA_EXPLORAR = 'Setas: andar (2 toques = correr) · Q abre o menu';
// retratos-emoji dos moradores nas conversas (até termos rostos desenhados)
const ROSTO_PAPEL = { senhor: '🧓', enfermeira: '👩‍⚕️', maga: '🧙', aldeao: '🧑‍🌾',
                      aldea: '👩‍🌾', mercador: '🧑‍💼' };
const CORES_TIPO = { fogo: 0xff8a3d, eletrico: 0xffe94d, agua: 0x4da3ff, planta: 0x5fd35a,
                     gelo: 0xa8e2f5, pedra: 0xb59a6a, terra: 0xd8a45b, dragao: 0xb06ae8, comum: 0xcbd0d8 };
const SIMBOLO = { baixo: '↓', frente: '→' };
const TECLAS_GOLPE = ['Z', 'X', 'C', 'V'];
const projMeshes = new Map();

/* ---------- estado ---------- */
let modo = 'titulo'; // titulo | intro | explorar | encontro | batalha
// abertura: o jogador lê a história antes de ganhar o controle
const INTRO_FALAS = [
  'Ferândia desperta. Ao sul, o vulcão fumega sem erupção; no Mar do Meio, as ondas andam inquietas sem tempestade...',
  'Na Vila Primordial, porém, hoje é um dia de festa: o dia do SEU Ritual da Escolha.',
  'Guardiã: "Sinto cheiro de cinza e sal no vento. Os tempos pedem novos domadores..."',
  'Guardiã: "Venha até a FOGUEIRA ETERNA, no coração da vila. Três companheiras esperam por você."',
  'Ande com as SETAS até a fogueira e aperte Z para falar com ela. Boa jornada, domador!',
];
let falaIntro = 0;
let jaEscolheu = false; // o primeiro Ritual tem fala própria da Guardiã
const chavesSelvagens = Object.keys(especies).filter((k) => especies[k].selvagem);
let chaveMapa = dadosMapas.inicial;
// SAVE LOCAL: a jornada continua de onde parou. O pacote é validado pela
// sim (save.js); aqui só se fala com o localStorage do navegador.
const CHAVE_SAVE = 'feras-save-v1';
let saveCarregado = null;
try {
  saveCarregado = validaSave(JSON.parse(localStorage.getItem(CHAVE_SAVE)),
    especies, dadosMapas.mapas, dadosMapas.inicial);
} catch { saveCarregado = null; }
if (saveCarregado) chaveMapa = saveCarregado.chaveMapa;
// treinadores derrotados valem para a sessão inteira (não voltam ao trocar de mapa)
const vencidosGlobais = new Set();
// baús já abertos, para sempre (chaves "mapa:idx" — vão para o save)
const bausAbertos = new Set();
function novoMundo(chave) {
  const mapa = dadosMapas.mapas[chave];
  const m = criarMundo(mapa, mapa.selvagens || chavesSelvagens);
  m.vencidos = vencidosGlobais;
  // visão VIVA dos baús abertos deste mapa (sim e render consultam na hora)
  const vista = { has: (i) => bausAbertos.has(`${chave}:${i}`) };
  m.bausAbertos = vista;
  cena.bausAbertosMapa = vista;
  return m;
}
let mundo = novoMundo(chaveMapa);
montaMapa(cena, mundo.mapa);
hud.localAtual(mundo.mapa.nome);
hud.mapaRegiao(dadosMapas, chaveMapa);

// a jornada começa SEM fera: o Ritual da Escolha na Fogueira Eterna
// oferece as três iniciais (planta, fogo e água) — ver docs/HISTORIA.md
const INICIAIS = ['folhito', 'brasinha', 'gotim'];
let equipe = [];
// ITENS: cristais são consumíveis — cada arremesso gasta um; a enfermeira
// reabastece (caixas misteriosas e mercados virão depois)
// a jornada começa de mãos VAZIAS: o Ancião entrega as 5 primeiras
// EsFeras na conversa, e o resto vem de baús e do mercado (sem teto)
const itens = { cristal: 0 };
let ativa = 0;
// SQUAD de até 5 feras; o excedente capturado vai para o BOX (regra do
// Domador — no online o squad será de 3, variável no futuro)
const SQUAD_MAX = 5;
let box = [];
// FERADEX: espécies já avistadas — só elas aparecem reveladas na tabela
const vistas = new Set();
const marcaVista = (k) => { if (k && especies[k]) vistas.add(k); };
// restaura a jornada salva (equipe, itens, ritual e posição no mapa)
if (saveCarregado) {
  equipe = saveCarregado.equipe;
  ativa = saveCarregado.ativa;
  itens.cristal = saveCarregado.itens.cristal;
  jaEscolheu = saveCarregado.jaEscolheu;
  for (const v of saveCarregado.vencidos) vencidosGlobais.add(v);
  for (const v of saveCarregado.vistas || []) vistas.add(v);
  box = saveCarregado.box || [];
  for (const f of [...equipe, ...box]) marcaVista(f.especie); // quem é seu, você já viu
  for (const b of saveCarregado.baus || []) bausAbertos.add(b);
  if (saveCarregado.pos) {
    mundo.domador.pos.x = saveCarregado.pos.x;
    mundo.domador.pos.z = saveCarregado.pos.z;
  }
}
function salvaJogo() {
  if (!equipe.length && !jaEscolheu) return; // ainda não há jornada
  try {
    localStorage.setItem(CHAVE_SAVE, JSON.stringify(empacotaSave({
      equipe, ativa, itens, jaEscolheu, chaveMapa,
      pos: mundo.domador.pos, vencidos: [...vencidosGlobais], vistas: [...vistas], box,
      baus: [...bausAbertos],
    })));
  } catch { /* navegador sem armazenamento (anônimo): joga sem salvar */ }
}
addEventListener('beforeunload', salvaJogo);
setInterval(salvaJogo, 15000); // rede de segurança além dos eventos-chave
let confirmaReset = 0; // duplo toque do "Recomeçar jornada"
const nomeDe = (f) => f.apelido || especies[f.especie].nome;
// raridade da planilha (1-4) em palavra para as fichas; aceita os textos antigos
const raridadeTxt = (r) => ({ 1: 'comum', 2: 'incomum', 3: 'rara', 4: 'muito rara' })[r]
  || String(r || 'comum').replace('_', ' ');
function atualizaPainel() {
  // o contador de EsFeras vale mesmo SEM fera (o Ancião dá 5 antes da 1ª)
  hud.esferas(itens.cristal);
  if (!equipe.length) { // elo apagado: o Caminho da Cinza
    hud.nomeJogador('sem elo', 0);
    hud.painelVida(0, 0);
    hud.equipe([]);
    if (modo === 'explorar') renderMenu();
    return;
  }
  const f = equipe[ativa];
  hud.nomeJogador(nomeDe(f), f.nivel);
  hud.painelVida(f.hpAtual, vidaMaxima(especies[f.especie].vida, f.nivel));
  // a lista do squad: ativa em destaque, desmaiada apagada; nome/nível/HP
  // aparecem AO LADO de cada cabecinha (pedido do Domador)
  hud.equipe(equipe.map((fe, i) => ({
    especie: fe.especie, nome: nomeDe(fe), ativa: i === ativa, viva: fe.hpAtual > 0,
    nivel: fe.nivel, hp: Math.max(0, Math.round(fe.hpAtual)),
    max: vidaMaxima(especies[fe.especie].vida, fe.nivel),
  })));
  hud.esferas(itens.cristal);
  if (modo === 'explorar') renderMenu();
}
atualizaPainel();

let batalha = null;
let playerM = null;
let feraAtual = null;
let escolha = 0;
let desafio = null; // duelo de treinador em andamento: { nome, equipe, idx }
// ARENA DE TREINO (modo de testes): { p: espécie sua, e: oponente }
// — luta de mentira: sem captura, sem XP e sem risco de perder a equipe
let treino = null;
const NIVEL_TREINO = 20;
// menu lateral: SEMPRE visível na exploração; "ativo" = navegando nele
let menu = { tipo: 'exploracao', sel: 0, fera: 0, especie: null, ativo: false };
// PILHA de retornos de porta: entrar em salas aninhadas (castelo!) empilha,
// sair pela porta sul desempilha — andar por andar
let retornoPorta = [];
let hitstop = 0, tempo = 0;
// CERIMÔNIA DE EVOLUÇÃO (estilo Pokémon): roda sozinha após a batalha
let evolucaoPendente = null; // fera que cruzou o nível da cadeia
let cerimonia = null;        // { fera, t, trocou, de }
// trava curta do "falar": o Z que fecha uma batalha não pode, no mesmo
// sopro, puxar conversa com quem estiver por perto (ex.: o Mestre da Arena)
let falarTrava = 0;

/* ---------- entrada (setas + Z/X/C/V golpes, F captura, M/ESC menu) ---- */
const keys = {};
let jE = false, kE = false, cE = false, vE = false, fE = false, spE = false;
let pJ = false, pK = false, pC = false, pV = false, pF = false, pS = false;
let cimaE = false, baixoE = false, pCima = false, pBaixo = false;
let esqE = false, dirE = false, pEsq = false, pDir = false;
let mE = false, escE = false, pM = false, pEsc = false;
addEventListener('keydown', (e) => {
  audioInit(); keys[e.code] = true;
  if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.code === 'Enter' && modo === 'titulo') {
    hud.escondeTitulo(); cv.focus();
    musica('explorar');
    if (jaEscolheu || equipe.length) {
      // jornada salva: sem reprise da abertura — direto para o mundo
      modo = 'explorar';
      hud.dica(DICA_EXPLORAR);
      hud.toast('— A jornada continua —', 2200);
      renderMenu();
    } else {
      // a abertura: textos primeiro, controle depois
      modo = 'intro';
      falaIntro = 0;
      hud.dica('Z avança o texto');
      hud.toast(`${INTRO_FALAS[0]}  ▸`, 600000);
    }
  }
});
addEventListener('keyup', (e) => keys[e.code] = false);
cv.addEventListener('pointerdown', () => { audioInit(); cv.focus(); });
function edges() {
  const Z = keys.KeyZ || keys.KeyJ, X = keys.KeyX || keys.KeyK,
        C = keys.KeyC, V = keys.KeyV, F = keys.KeyF, S = keys.Space;
  jE = Z && !pJ; kE = X && !pK; cE = C && !pC; vE = V && !pV; fE = F && !pF; spE = S && !pS;
  pJ = Z; pK = X; pC = C; pV = V; pF = F; pS = S;
  const CIMA = keys.ArrowUp, BAIXO = keys.ArrowDown;
  cimaE = CIMA && !pCima; baixoE = BAIXO && !pBaixo;
  pCima = CIMA; pBaixo = BAIXO;
  const ESQ = keys.ArrowLeft, DIR = keys.ArrowRight;
  esqE = ESQ && !pEsq; dirE = DIR && !pDir;
  pEsq = ESQ; pDir = DIR;
  const M = keys.KeyQ || keys.KeyM, ESC = keys.Escape; // Q é o menu (M ainda vale)
  mE = M && !pM; escE = ESC && !pEsc;
  pM = M; pEsc = ESC;
}
const eixo = (neg, pos) => (keys[pos[0]] || keys[pos[1]] ? 1 : 0) - (keys[neg[0]] || keys[neg[1]] ? 1 : 0);

/* corrida: dois toques rápidos na mesma direção, segurando o segundo
   (movimento é SÓ nas setas — A e S agora são botões de luta) */
const TECLAS_DIR = ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'];
const ultToque = {}, prevDir = {};
let correndo = false;
function detectaCorrida() {
  for (const k of TECLAS_DIR) {
    const seg = !!keys[k];
    if (seg && !prevDir[k]) {
      if (tempo - (ultToque[k] || -9) < 0.3) correndo = true;
      ultToque[k] = tempo;
    }
    prevDir[k] = seg;
  }
  if (!TECLAS_DIR.some((k) => keys[k])) correndo = false;
}

/* na LUTA, dois toques rápidos numa direção = cambalhota (salto-esquiva) */
const DIR_REL = {
  ArrowUp: { x: 0, z: -1 },
  ArrowDown: { x: 0, z: 1 },
  ArrowLeft: { x: -1, z: 0 },
  ArrowRight: { x: 1, z: 0 },
};
function detectaDashLuta() {
  let dash = null;
  for (const k of TECLAS_DIR) {
    const seg = !!keys[k];
    if (seg && !prevDir[k]) {
      if (tempo - (ultToque[k] || -9) < 0.3) { dash = DIR_REL[k]; ultToque[k] = -9; }
      else ultToque[k] = tempo;
    }
    prevDir[k] = seg;
  }
  return dash;
}

/* golpe forte: SHIFT segurado junto do botão do golpe */
const shiftSegurado = () => !!(keys.ShiftLeft || keys.ShiftRight);

/* ---------- eventos da simulação -> apresentação ---------- */
function aoEvento(evt) {
  switch (evt.tipo) {
    case 'hit': sfx.hit(); cena.shake = 0.28; hitstop = 0.05;
      fx.impacto(evt.pos, false);
      poof(cena, { ...evt.pos, y: evt.pos.y + 1 }, 0xffd23f, 8, 4.5);
      hud.dano(evt.pos, evt.dano, false, evt.eficaz);
      avisaEficacia(evt.eficaz); break;
    case 'hitForte': sfx.hitForte(); cena.shake = 0.5; hitstop = 0.09;
      fx.impacto(evt.pos, true);
      poof(cena, { ...evt.pos, y: evt.pos.y + 1 }, 0xff6b4a, 8, 4.5);
      hud.dano(evt.pos, evt.dano, true, evt.eficaz);
      avisaEficacia(evt.eficaz); break;
    case 'espinho': sfx.hit(); cena.shake = 0.2;
      poof(cena, { ...evt.pos, y: 0.5 }, 0x5fd35a, 6, 3);
      hud.dano(evt.pos, evt.dano, false); break;
    case 'rastroFogo': if (Math.random() < 0.5)
      poof(cena, evt.pos, Math.random() < 0.5 ? 0xff8a3d : 0xffd93b, 2, 2.5); break;
    case 'pulo': sfx.pulo(); break;
    case 'dash': sfx.pulo();
      if (batalha) poof(cena, { ...batalha.p.pos, y: 0.3 }, 0xcbd0d8, 6, 2.5); break;
    case 'swing': sfx.swing(); break;
    case 'talho': { // rasgo branco do golpe, com o LADO do braço que bate
      const ESTILO = {
        combo1: { ang: -1.15 },              // corte ascendente (direita, subindo)
        combo2: { ang: -0.45 },              // corte diagonal (direita)
        combo3: { ang: 0.35, esp: true },    // gancho de ESQUERDA: espelhado
        garra: { ang: -0.75 },
        soco: { ang: 0.05 },
        forte: { ang: 1.35 },
      };
      const et = ESTILO[evt.clipe] || { ang: 0.15 };
      fx.talho({ x: evt.pos.x, y: evt.pos.y + ARENA_Y + 1.0, z: evt.pos.z },
        et.ang + (Math.random() - 0.5) * 0.12, evt.forte, !!et.esp);
      break;
    }
    case 'combo': sfx.especial(); cena.shake = 0.18;
      poof(cena, { ...evt.pos, y: evt.pos.y + 1 }, 0xffffff, 6, 3);
      hud.toast(`▶ Combo: ${evt.nome}!`, 800); break;
    case 'especial': sfx.especial(); break;
    case 'comando': sfx.especial(); cena.shake = 0.22;
      poof(cena, { ...evt.pos, y: 1 }, 0xffffff, 8, 3.5);
      hud.toast(`${evt.nome}!`, 900); break;
    case 'projetil': sfx.swing();
      poof(cena, evt.pos, CORES_TIPO[evt.elemento] || 0xffffff, 12, 3.2); break;
    case 'semUsos': hud.toast(`Sem usos de ${evt.nome}! Descanse no Centro de Curas.`, 1600); break;
    case 'semEnergia': hud.toast(`Sem energia para ${evt.nome}! Segure A para carregar.`, 1600); break;
    case 'feixe': sfx.especial(); cena.shake = 0.35;
      fx.raio(evt.de, evt.para, evt.elemento, evt.visual); break;
    case 'golpeUsado': hud.golpesPainel(linhasGolpes()); break;
    case 'cristalVoa': sfx.cristalVoa(); MD.mostra(cristal, true);
      itens.cristal--; hud.toast(`Cristal lançado! Restam ${itens.cristal}.`, 1300); break;
    case 'cristalSuga': poof(cena, evt.pos, 0x59e0d0, 14, 4); break;
    case 'cristalTreme': sfx.cristalTreme(); break;
    case 'capturado': sfx.capturado(); hitstop = 0.15;
      hud.toast(`${batalha.e.esp.nome} foi capturado! ${premiaXp()}`); break;
    case 'escapou': MD.mostra(cristal, false);
      // a fera tinha sido "sugada" (escala 0) — volta ao tamanho normal
      MD.setEscala(feraAtual, 1);
      poof(cena, { ...batalha.e.pos, y: 0.9 }, 0x59e0d0, 10, 3.5);
      hud.toast(`Ah, quase! O ${batalha.e.esp.nome} escapou do cristal!`); break;
    case 'vitoria': sfx.vitoria(); hitstop = 0.22;
      hud.toast(`${batalha.e.esp.nome} desmaiou! ${premiaXp()}`); break;
    case 'derrota': sfx.derrota(); hitstop = 0.22; break;
  }
}

// aviso de vantagem de tipo (com trégua para não virar spam)
let eficaciaT = 0;
function avisaEficacia(ef) {
  if (!ef || tempo - eficaciaT < 1.6) return;
  eficaciaT = tempo;
  hud.toast(ef === 'super' ? '⚡ Super efetivo!' : 'Pouco efetivo...', 900);
}

/* ---------- golpes no HUD da luta ---------- */
function linhasGolpes() {
  if (!batalha) return [];
  const f = batalha.p;
  const custoTxt = (def) => { const c = custoEnergia(def); return c ? ` · ${c}⚡` : ''; };
  // a versão forte gasta 2 usos do MESMO pote da base
  const maxPote = (id) => golpesCat[id].usos == null
    ? null : golpesCat[id].usos + Math.max(0, f.nivel - 10);
  const usosTxt = (id, def) => {
    const pote = def.base || id;
    const m = maxPote(pote);
    const base = m == null ? '∞' : `${f.usos[pote] || 0}/${m}${def.base ? ' (x2)' : ''}`;
    return base + custoTxt(def);
  };
  const linhas = [];
  f.slots.forEach((s, i) => {
    linhas.push({ tecla: TECLAS_GOLPE[i], nome: s.def.nome, usos: usosTxt(s.id, s.def) });
    if (s.forte)
      linhas.push({ tecla: `Shift+${TECLAS_GOLPE[i]}`, nome: s.forte.def.nome, usos: usosTxt(s.forte.id, s.forte.def) });
  });
  linhas.push({ tecla: 'A', nome: 'Carregar energia', usos: 'segure' });
  return linhas;
}

/* ---------- XP, nível e aprendizado ---------- */
function premiaXp() {
  if (treino) return ''; // treino não dá XP — é só exercício
  const fera = equipe[ativa];
  const ganho = xpPorVitoria(batalha.e.nivel);
  const antes = fera.nivel;
  const subiu = ganhaXp(fera, ganho);
  hud.xp(fera.xp / xpParaSubir(fera.nivel));
  if (subiu > 0) {
    const avisos = [];
    for (let nv = antes + 1; nv <= fera.nivel; nv++) {
      bonusNivel(fera, especies, golpesCat);
      for (const gid of aprendizadosDoNivel(especies[fera.especie], nv)) {
        const res = aprendeGolpe(fera, golpesCat, gid);
        if (res) avisos.push(res);
      }
    }
    if (batalha) { batalha.p.slots = montaSlots(fera, golpesCat); hud.golpesPainel(linhasGolpes()); }
    // nomes congelados JÁ: se a fera evoluir logo abaixo, os avisos
    // anteriores devem falar do nome antigo (ordem natural da história)
    const nomeAntes = nomeDe(fera), nivelNovo = fera.nivel;
    let atraso = 1500;
    setTimeout(() => { sfx.vitoria(); hud.toast(`⬆ ${nomeAntes} subiu para o nível ${nivelNovo}!`, 2100); }, atraso);
    for (const av of avisos) {
      atraso += 2200;
      const nomeG = golpesCat[av.id].nome;
      const msg = av.tipo === 'substituiu'
        ? `${nomeAntes} esqueceu ${golpesCat[av.trocado].nome} e aprendeu ${nomeG}!`
        : `${nomeAntes} aprendeu ${nomeG}!`;
      setTimeout(() => { sfx.capturado(); hud.toast(`✨ ${msg}`, 2100); }, atraso);
    }
    // EVOLUÇÃO: cruzou o nível da cadeia? Fica PENDENTE — a cerimônia
    // acontece depois que a batalha fechar (estilo Pokémon)
    if (verificaEvolucao(especies, fera)) evolucaoPendente = fera;
  }
  atualizaPainel();
  return `+${ganho} XP`;
}

/* ---------- menus ---------- */
function tituloMenu() {
  const t = menu.tipo;
  if (t === 'inicial') return 'RITUAL DA ESCOLHA';
  if (t === 'statusFera' || t === 'lembrar') {
    const f = equipe[menu.fera];
    return `${nomeDe(f).toUpperCase()} · Lv.${f.nivel}`;
  }
  if (t === 'compendioFera')
    return vistas.has(menu.especie) ? especies[menu.especie].nome.toUpperCase() : '???';
  if (t === 'exploracao' && !menu.ativo) return 'MENU · aperte Q';
  return { exploracao: 'MENU', batalha: 'BATALHA', equipeExp: 'EQUIPE',
           equipeBat: 'TROCAR FERA', statusLista: 'STATUS', catalogo: 'CATÁLOGO DE GOLPES',
           compendio: 'FERADEX', itens: 'ITENS', box: 'BOX DE FERAS',
           treinoP: 'TREINO · SUA FERA', treinoE: 'TREINO · OPONENTE',
           posRound: 'A PRÓXIMA VEM AÍ — TROCAR?' }[t]
    || (t === 'treinoG' ? `TREINO · PODERES ${treino ? treino.golpes.length : 0}/3 (o físico do Z é o da fera)` : 'MENU');
}
function itensDoMenu() {
  const t = menu.tipo;
  const nada = () => {};
  if (t === 'inicial') return INICIAIS.map((k) => ({
    txt: `${especies[k].nome} · ${especies[k].tipo}`,
    acao: () => escolheInicial(k),
  }));
  // Arena de Treino: qualquer espécie contra qualquer espécie
  if (t === 'treinoP' || t === 'treinoE') return Object.keys(especies).map((k) => ({
    txt: `${especies[k].nome} · ${especies[k].tipo}`,
    acao: () => {
      if (t === 'treinoP') { treino = { p: k, golpes: [] }; abreMenu('treinoG'); }
      else { treino.e = k; iniciaTreino(); }
    },
  }));
  // ...e os 3 PODERES que a SUA fera leva (X/C/V) — o físico do Z é o
  // dela por direito, seguindo a diretriz "um físico por fera"
  if (t === 'treinoG') return Object.entries(golpesCat)
    .filter(([, g]) => !g.fisico)
    .map(([id, g]) => ({
      txt: `${treino.golpes.includes(id) ? '✓ ' : ''}${g.nome} · ${g.tipo}${g.base ? ' · forte (60⚡)' : ''}`,
      acao: () => {
        const i = treino.golpes.indexOf(id);
        if (i >= 0) treino.golpes.splice(i, 1);
        else if (treino.golpes.length < 3) treino.golpes.push(id);
        if (treino.golpes.length === 3) { abreMenu('treinoE'); return; }
        renderMenu();
      },
    }));
  if (t === 'exploracao') return [
    { txt: 'Equipe', acao: () => abreMenu('equipeExp') },
    { txt: `Box (${box.length})`, acao: () => abreMenu('box') },
    { txt: 'Status', acao: () => abreMenu('statusLista') },
    { txt: 'Feradex', acao: () => abreMenu('compendio') },
    { txt: 'Catálogo', acao: () => abreMenu('catalogo') },
    { txt: 'Itens', acao: () => abreMenu('itens') },
    { txt: 'Carteira', acao: () => hud.toast('Carteira: 0 moedas (economia em breve)') },
    { txt: 'Troféus', acao: () => hud.toast('Troféus: nenhum ainda — vença um ginásio!') },
    { txt: 'Recomeçar jornada', acao: () => {
      // apagar o save é para sempre: exige DOIS toques em 3 segundos
      if (tempo < confirmaReset) {
        removeEventListener('beforeunload', salvaJogo);
        try { localStorage.removeItem(CHAVE_SAVE); } catch {}
        location.reload();
      } else {
        confirmaReset = tempo + 3;
        hud.toast('⚠ Isso APAGA a jornada salva. Aperte de novo para confirmar.', 2800);
      }
    } },
    { txt: `Som: ${somLigado() ? 'ligado' : 'mudo'}`, acao: () => {
      alternaSom();
      hud.toast(somLigado() ? '🔊 Som ligado' : '🔇 Som desligado', 1400);
      renderMenu();
    } },
    { txt: 'Fechar', acao: fechaMenu },
  ];
  if (t === 'batalha') return treino ? [
    // no treino não há equipe em jogo: só continuar ou encerrar
    { txt: 'Continuar', acao: fechaMenu },
    { txt: 'Encerrar treino', acao: () => { fechaMenu(); fugirBatalha(batalha); } },
  ] : [
    { txt: 'Continuar', acao: fechaMenu },
    { txt: 'Trocar Fera', acao: () => abreMenu('equipeBat') },
    { txt: 'Itens', acao: () => hud.toast('Itens: em breve!') },
    { txt: 'Fugir', acao: () => {
      fechaMenu();
      if (!fugirBatalha(batalha))
        hud.toast('⏱ Tarde demais para fugir — a luta vai até o fim!', 2200);
    } },
  ];
  if (t === 'equipeExp' || t === 'equipeBat') return equipe.map((f, i) => ({
    txt: `${nomeDe(f)} Lv.${f.nivel}${i === ativa ? ' ◆' : ''}${f.hpAtual <= 0 ? ' ✖' : ''}`,
    acao: () => selecionaFera(i),
  }));
  // entre as feras de um treinador: seguir com a atual ou trocar
  if (t === 'posRound') return [
    { txt: `Seguir com ${equipe[ativa] ? nomeDe(equipe[ativa]) : 'a fera'}`, acao: () => fechaMenu() },
    { txt: 'Trocar de fera', acao: () => abreMenu('equipeBat') },
  ];
  if (t === 'statusLista') return [
    ...equipe.map((f, i) => ({
      txt: `${nomeDe(f)} Lv.${f.nivel}${f.hpAtual <= 0 ? ' ✖' : ''}`,
      acao: () => { menu.fera = i; abreMenu('statusFera'); },
    })),
    { txt: 'Voltar', acao: () => abreMenu('exploracao') },
  ];
  // BOX: capturas guardadas — escolher uma puxa para o squad (se couber)
  if (t === 'box') return [
    ...box.map((f, i) => ({
      txt: `${nomeDe(f)} Lv.${f.nivel}`,
      acao: () => {
        if (equipe.length >= SQUAD_MAX) {
          hud.toast(`Squad cheio (${SQUAD_MAX})! Mande alguém para o Box primeiro.`, 2400);
          return;
        }
        equipe.push(box.splice(i, 1)[0]);
        sfx.capturado();
        hud.toast(`${nomeDe(equipe[equipe.length - 1])} entrou no squad!`, 2200);
        atualizaPainel(); salvaJogo(); abreMenu('box');
      },
    })),
    ...(box.length ? [] : [{ txt: '(vazio)', acao: () => {} }]),
    { txt: 'Voltar', acao: () => abreMenu('exploracao') },
  ];
  if (t === 'statusFera') {
    // os dados da fera vivem na FICHA grande ao lado do holograma;
    // aqui ficam só as ações
    const f = equipe[menu.fera];
    return [
      { txt: 'Renomear', acao: () => {
        const n = prompt('Novo nome da fera:', nomeDe(f));
        if (n && n.trim()) { f.apelido = n.trim().slice(0, 12); atualizaPainel(); abreMenu('statusFera'); }
      } },
      { txt: 'Lembrar golpe', acao: () => abreMenu('lembrar') },
      ...(equipe.length > 1 ? [{ txt: 'Mandar para o Box', acao: () => {
        const [saiu] = equipe.splice(menu.fera, 1);
        box.push(saiu);
        if (ativa >= equipe.length) ativa = 0;
        hud.toast(`📦 ${nomeDe(saiu)} foi descansar no Box.`, 2200);
        atualizaPainel(); salvaJogo(); abreMenu('statusLista');
      } }] : []),
      { txt: 'Voltar', acao: () => abreMenu('statusLista') },
    ];
  }
  if (t === 'lembrar') {
    const f = equipe[menu.fera];
    const cands = f.conhecidos.filter((id) => !golpesCat[id].base && !f.golpes.includes(id));
    const itens = cands.length
      ? cands.map((id) => ({ txt: golpesCat[id].nome, acao: () => {
          lembraGolpe(f, golpesCat, id);
          hud.toast(`${nomeDe(f)} relembrou ${golpesCat[id].nome}!`);
          abreMenu('statusFera');
        } }))
      : [{ txt: '(nenhum golpe para lembrar)', acao: nada }];
    itens.push({ txt: 'Voltar', acao: () => abreMenu('statusFera') });
    return itens;
  }
  if (t === 'itens') return [
    { txt: `Cristal de Captura × ${itens.cristal}`, acao: () =>
      hud.toast('Arremesse com F durante a luta — ache mais em baús e no mercado.', 2200) },
    { txt: '(caixas misteriosas e mercados: em breve)', acao: nada },
    { txt: 'Voltar', acao: () => abreMenu('exploracao') },
  ];
  if (t === 'catalogo') return [
    ...Object.values(golpesCat).map((g) => ({
      txt: `${g.nome} · ${g.tipo}${g.base ? ' · forte' : ''} · ${g.usos == null ? '∞' : g.usos} usos`,
      acao: nada,
    })),
    { txt: 'Voltar', acao: () => abreMenu('exploracao') },
  ];
  // 'compendio' não usa a lista lateral: vira TABELA própria (navegaMenu)
  return [];
}

/* ---------- ficha grande (ao lado do holograma) ---------- */
const corCss = (tipo) => '#' + (CORES_TIPO[tipo] || 0xcbd0d8).toString(16).padStart(6, '0');
function fichaFera(f) {
  const esp = especies[f.especie];
  const max = vidaMaxima(esp.vida, f.nivel);
  const usosTxt = (id) => {
    const pote = golpesCat[id].base || id;
    const m = golpesCat[pote].usos == null
      ? null : golpesCat[pote].usos + Math.max(0, f.nivel - 10);
    return m == null ? '∞' : `${f.usos[pote] || 0}/${m}${golpesCat[id].base ? ' (x2)' : ''}`;
  };
  const golpes = f.golpes.map((id) => `${golpesCat[id].nome} <span>${usosTxt(id)}</span>`);
  for (const id of f.conhecidos)
    if (golpesCat[id].base && f.golpes.includes(golpesCat[id].base))
      golpes.push(`forte: ${golpesCat[id].nome} <span>${usosTxt(id)}</span>`);
  return {
    nome: nomeDe(f), sub: `${esp.nome} · Nível ${f.nivel}`,
    tipo: esp.tipo, raridade: raridadeTxt(esp.raridade), corTipo: corCss(esp.tipo),
    linhas: [`<b>HP</b> ${f.hpAtual}/${max}`, `<b>XP</b> ${f.xp}/${xpParaSubir(f.nivel)}`],
    golpes,
  };
}
function fichaEspecie(k) {
  const e2 = especies[k];
  const numero = Object.keys(especies).indexOf(k) + 1;
  // FERADEX: espécie nunca avistada = mistério — silhueta, xxx e nada mais
  if (!vistas.has(k)) {
    return {
      nome: `#${String(numero).padStart(2, '0')} xxx`, sub: 'Feradex',
      tipo: '?', raridade: '?', corTipo: '#555a66',
      linhas: ['<b>Fera ainda não avistada.</b>',
               'Encontre-a pelo mundo para revelar seus segredos.'],
      golpes: [],
    };
  }
  const locais = Object.values(dadosMapas.mapas)
    .filter((mp) => (mp.selvagens || []).includes(k)).map((mp) => mp.nome);
  const alt = e2.altura3d || 1.1;
  const tamanho = alt < 1.15 ? `Pequeno (${alt.toFixed(1)}m)`
    : alt < 1.75 ? `Médio (${alt.toFixed(1)}m)` : `Grande (${alt.toFixed(1)}m)`;
  const stat = (v) => Math.round((v || 1) * 100);
  return {
    nome: `#${String(numero).padStart(2, '0')} ${e2.nome}`, sub: 'Feradex',
    tipo: e2.tipo, raridade: raridadeTxt(e2.raridade), corTipo: corCss(e2.tipo),
    linhas: [
      `<b>Tamanho</b> ${tamanho}${e2.voa ? ' · voadora' : ''}`,
      `<b>Vida</b> ${e2.vida} · <b>Força</b> ${stat(e2.ataque)} · <b>Defesa</b> ${stat(e2.defesa)}`,
      `<b>Velocidade</b> ${e2.velocidade}`,
      `<b>Habitat:</b> ${locais.length ? locais.join(', ') : 'desconhecido'}`,
    ],
    golpes: (e2.aprendizado || []).map((a) => `Lv.${a.nivel}: ${golpesCat[a.golpe].nome}`),
  };
}
/* holograma: a fera aparece girando no centro da tela. No compêndio
   ("compacto") toda fera é projetada do MESMO tamanho — o porte real
   é coisa de batalha (o "holofote" que escurece o resto é CSS puro) */
let holoAltoExtra = 0; // no compêndio a fera sobe: ficha embaixo, fera em cima
// silhueta da Feradex: barro escuro girando — a forma aparece, a cor não
// (malha com esqueleto precisa da variante com skinning, senão vira estátua)
const MAT_SILHUETA = new THREE.MeshLambertMaterial({ color: 0x394050 });
const MAT_SILHUETA_SKIN = new THREE.MeshLambertMaterial({ color: 0x394050 });
MAT_SILHUETA_SKIN.skinning = true;
function mostraHoloEspecie(chave, compacto = false, silhueta = false) {
  escondeHolo();
  holoM = modelosIni[chave];
  // o domador dá lugar à projeção — o holograma fica no centro da tela
  MD.mostra(domador, false);
  if (silhueta) holoM.g.traverse((o) => {
    if (o.isMesh) {
      o.userData._matReal = o.material;
      o.material = o.isSkinnedMesh ? MAT_SILHUETA_SKIN : MAT_SILHUETA;
    }
  });
  holoAltoExtra = compacto ? 1.7 : 0;
  const base = { x: mundo.domador.pos.x, y: mundo.domador.pos.y + 0.1 + holoAltoExtra, z: mundo.domador.pos.z };
  MD.setPos(holoM, base);
  MD.setEscala(holoM, compacto ? 2.6 / (especies[chave].altura3d || 1.1) : 4.5);
  // sólido e com tinta azulada BEM sutil: as cores reais da fera aparecem
  MD.setOpacidade(holoM, 1);
  MD.flashCor(holoM, 0x06222a);
  holoM.g.rotation.x = 0;
  // projeção de luz não faz sombra
  holoM.g.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  MD.mostra(holoM, true);
  MD.setPos(discoHolo, base);
  MD.setEscala(discoHolo, 3.6);
  MD.mostra(discoHolo, !compacto); // no compêndio a bolinha azul some
}
function escondeHolo() {
  hud.ficha(null);
  hud.compendio(null);
  if (!holoM) return;
  holoM.g.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      if (o.userData._matReal) { o.material = o.userData._matReal; delete o.userData._matReal; }
    }
  });
  MD.setOpacidade(holoM, 1);
  MD.flashCor(holoM, 0);
  MD.setEscala(holoM, 1);
  MD.mostra(holoM, false);
  MD.mostra(discoHolo, false);
  MD.mostra(domador, true);
  holoM = null;
}

// desenha o menu lateral (com destaque só quando está ativo);
// o compêndio tem interface própria — a lista lateral não aparece nele
function renderMenu() {
  if (menu.tipo === 'compendio') return;
  hud.menu(true, tituloMenu(), itensDoMenu().map((i) => i.txt), menu.ativo ? menu.sel : -1);
}
// cada lista lembra onde o cursor estava (voltar da ficha não recomeça do topo)
const selLembrado = {};
const COLS_COMPENDIO = 4;
// COMPÊNDIO em tabela: nada de lista lateral — grade + ficha + holograma
function mostraCompendio() {
  const ks = Object.keys(especies);
  const k = ks[menu.sel];
  mostraHoloEspecie(k, true, !vistas.has(k));
  hud.menu(false);
  hud.ficha(null);
  hud.compendio({
    ficha: fichaEspecie(k),
    nomes: ks.map((kk) => vistas.has(kk) ? especies[kk].nome : 'xxx'),
    sel: menu.sel,
  });
}
function abreMenu(tipo) {
  if (tipo === 'compendio') {
    menu = { tipo, sel: Math.min(selLembrado.compendio || 0, Object.keys(especies).length - 1),
             fera: menu.fera, especie: menu.especie, ativo: true };
    mostraCompendio();
    return;
  }
  menu = { tipo, sel: selLembrado[tipo] || 0, fera: menu.fera, especie: menu.especie, ativo: true };
  menu.sel = Math.min(menu.sel, Math.max(0, itensDoMenu().length - 1));
  renderMenu();
  if (tipo === 'statusFera' || tipo === 'lembrar') {
    mostraHoloEspecie(equipe[menu.fera].especie);
    hud.ficha(fichaFera(equipe[menu.fera]));
  } else if (tipo === 'compendioFera') {
    mostraHoloEspecie(menu.especie, false, !vistas.has(menu.especie));
    hud.ficha(fichaEspecie(menu.especie));
  } else if (tipo === 'inicial') {
    menu.sel = 0;
    mostraHoloEspecie(INICIAIS[0]);
    hud.ficha(fichaEspecie(INICIAIS[0]));
  } else if (tipo === 'treinoP' || tipo === 'treinoE') {
    const ks = Object.keys(especies);
    mostraHoloEspecie(ks[menu.sel]);
    hud.ficha(fichaEspecie(ks[menu.sel]));
  } else if (tipo === 'treinoG') {
    // escolhendo golpes: a sua fera fica projetada de referência
    mostraHoloEspecie(treino.p);
    hud.ficha(fichaEspecie(treino.p));
  } else escondeHolo();
}
// "fechar": na exploração o menu continua na lateral, só desativa a navegação
function fechaMenu() {
  if (menu.tipo === 'inicial' && !equipe.length) return; // sem fera, sem saída
  escondeHolo();
  menu = { tipo: 'exploracao', sel: 0, fera: menu.fera, especie: menu.especie, ativo: false };
  if (modo === 'batalha' || modo === 'encontro') hud.menu(false);
  else renderMenu();
}
function voltaMenu() {
  const t = menu.tipo;
  if (t === 'inicial' && !equipe.length) return; // o Ritual não se recusa

  if (t === 'equipeExp' || t === 'statusLista' || t === 'catalogo' || t === 'compendio' || t === 'itens' || t === 'box') abreMenu('exploracao');
  else if (t === 'equipeBat' || t === 'batalha') fechaMenu();
  else if (t === 'statusFera') abreMenu('statusLista');
  else if (t === 'lembrar') abreMenu('statusFera');
  else if (t === 'compendioFera') abreMenu('compendio');
  else if (t === 'treinoE') abreMenu('treinoG');
  else if (t === 'treinoG') abreMenu('treinoP');
  else fechaMenu();
}
function navegaMenu() {
  // COMPÊNDIO: navegação em TABELA (4 sentidos), só olhar — X/ESC fecha
  if (menu.tipo === 'compendio') {
    const total = Object.keys(especies).length;
    let novoSel = menu.sel;
    if (dirE) novoSel = (menu.sel + 1) % total;
    else if (esqE) novoSel = (menu.sel - 1 + total) % total;
    else if (baixoE) novoSel = Math.min(total - 1, menu.sel + COLS_COMPENDIO);
    else if (cimaE) novoSel = Math.max(0, menu.sel - COLS_COMPENDIO);
    if (novoSel !== menu.sel) {
      menu.sel = novoSel;
      selLembrado.compendio = novoSel;
      sfx.swing();
      mostraCompendio();
    }
    if (kE || escE || jE) voltaMenu();
    return;
  }
  const itens = itensDoMenu();
  if (!itens.length) { if (kE || escE) voltaMenu(); return; }
  if (baixoE || cimaE) {
    menu.sel = (menu.sel + (baixoE ? 1 : -1) + itens.length) % itens.length;
    selLembrado[menu.tipo] = menu.sel;
    sfx.swing();
    renderMenu();
    // no Ritual e na Arena de Treino, o holograma e a ficha acompanham
    // a fera destacada — sem precisar confirmar
    const ksHolo = menu.tipo === 'inicial' ? INICIAIS
      : (menu.tipo === 'treinoP' || menu.tipo === 'treinoE') ? Object.keys(especies) : null;
    if (ksHolo && ksHolo[menu.sel]) {
      mostraHoloEspecie(ksHolo[menu.sel]);
      hud.ficha(fichaEspecie(ksHolo[menu.sel]));
    }
  }
  if (kE || escE) { voltaMenu(); return; }
  if (jE) { selLembrado[menu.tipo] = menu.sel; itens[menu.sel].acao(); }
}

/* ---------- o Ritual da Escolha (Fogueira Eterna) ---------- */
function iniciaRitual(renascer) {
  hud.toast(renascer
    ? '🔥 Guardiã: "O elo pode renascer. Escolha quem caminhará com você."'
    : '🔥 Guardiã: "Diante da Fogueira Eterna, escolha sua companheira de jornada."', 3600);
  abreMenu('inicial');
}
function escolheInicial(k) {
  // regra do Domador: toda fera NASCE só com o golpe físico — os
  // especiais chegam pelo nível (iniciais: elemental nv7, especial nv10)
  equipe = [criarFera(especies, golpesCat, k, NIVEL_INICIAL)];
  INICIAIS.forEach(marcaVista); // o Ritual revela as três na Feradex
  ativa = 0;
  jaEscolheu = true;
  sfx.capturado();
  hud.flash();
  poof(cena, { ...mundo.domador.pos, y: 1 }, 0xffd23f, 16, 4);
  atualizaPainel();
  salvaJogo();
  fechaMenu();
  hud.toast(`✨ O elo está aceso! ${especies[k].nome} agora caminha com você.`, 3400);
}
function selecionaFera(i) {
  const f = equipe[i];
  if (f.hpAtual <= 0) {
    hud.toast(`${nomeDe(f)} está desmaiada! Cure no Centro de Curas.`);
    return;
  }
  if (menu.tipo === 'equipeExp') {
    ativa = i;
    atualizaPainel();
    hud.toast(`${nomeDe(f)} agora é a fera ativa!`);
    abreMenu('exploracao');
    return;
  }
  // troca em batalha
  if (i === ativa) { hud.toast('Essa fera já está na arena!'); return; }
  equipe[ativa].hpAtual = Math.max(1, batalha.p.hp); // guarda o estado da que sai
  ativa = i;
  trocaFera(batalha, paraBatalha(f, especies, golpesCat), especies);
  trocaModeloJogador(f);
  hud.toast(`Vai, ${nomeDe(f)}!`);
  fechaMenu();
}
// no duelo de treinador, a fera derrotada dá lugar à próxima da equipe dele
function trocaModeloInimigo(chave) {
  if (feraAtual) MD.mostra(feraAtual, false);
  feraAtual = modelosIni[chave];
  MD.setOpacidade(feraAtual, 1); MD.setEscala(feraAtual, 1);
  MD.flashCor(feraAtual, 0); feraAtual.g.rotation.x = 0;
  MD.setPos(feraAtual, sobreTablado(batalha.e.pos));
  MD.mostra(feraAtual, true);
  poof(cena, { ...batalha.e.pos, y: 0.9 }, 0xffffff, 14, 4);
}
function trocaModeloJogador(f) {
  if (playerM) MD.mostra(playerM, false);
  playerM = modelosJog[f.especie];
  MD.setOpacidade(playerM, 1); MD.setEscala(playerM, 1);
  MD.flashCor(playerM, 0); playerM.g.rotation.x = 0;
  MD.setPos(playerM, sobreTablado(batalha.p.pos)); MD.mostra(playerM, true);
  poof(cena, { ...batalha.p.pos, y: 0.9 }, 0xffd23f, 14, 4);
  hud.nomeJogador(nomeDe(f), f.nivel);
  hud.xp(f.xp / xpParaSubir(f.nivel));
  hud.golpesPainel(linhasGolpes());
  hud.atualizaHP(batalha);
}

/* ---------- transições ---------- */
function iniciaEncontro() {
  sfx.encontro(); hud.flash();
  musica('batalha');
  modo = 'encontro'; escolha = 0;
  menu.ativo = false; escondeHolo(); hud.menu(false);
  hud.exploracaoVisivel(false);
  temaArena(cena, mundo.mapa.chao || 'grama'); // ringue com a cara do bioma
  mostraArena(cena, true);
  MD.mostra(domador, false);
  // duelo de treinador usa a equipe DELE; selvagem usa o sorteio + nível
  if (desafio) {
    const f0 = desafio.equipe[desafio.idx];
    mundo.selvagem.especie = f0.especie;
    mundo.selvagem.nivel = f0.nivel;
  } else mundo.selvagem.nivel = nivelSelvagem(equipe[ativa].nivel);
  feraAtual = modelosIni[mundo.selvagem.especie];
  MD.setOpacidade(feraAtual, 1); MD.setEscala(feraAtual, 1);
  MD.flashCor(feraAtual, 0); feraAtual.g.rotation.x = 0;
  MD.setPos(feraAtual, sobreTablado(RINGUE.fera));
  MD.encara(feraAtual, RINGUE.dom.x, RINGUE.dom.z);
  feraAtual.g.rotation.y = feraAtual.giro;
  MD.mostra(feraAtual, true);
  poof(cena, { ...RINGUE.fera, y: 0.9 }, 0xffffff, 14, 4);
  hud.nomeInimigo(especies[mundo.selvagem.especie].nome.toUpperCase(), mundo.selvagem.nivel);
  hud.escolha(true, escolha);
  hud.dica('↑/↓ escolhe · Z confirma');
  hud.toast(desafio
    ? `⚔ ${desafio.nome} manda ${especies[mundo.selvagem.especie].nome}!`
    : `Um ${especies[mundo.selvagem.especie].nome} selvagem apareceu!`);
}
function confirmaEscolha() {
  hud.escolha(false);
  if (escolha === 0) iniciaBatalha();
  else fugir();
}
function iniciaBatalha() {
  marcaVista(mundo.selvagem.especie); // viu de perto: entra na Feradex
  const fera = equipe[ativa];
  const inimigo = criarFera(especies, golpesCat, mundo.selvagem.especie, mundo.selvagem.nivel || NIVEL_INICIAL);
  batalha = criarBatalha(especies,
    paraBatalha(fera, especies, golpesCat),
    paraBatalha(inimigo, especies, golpesCat),
    RINGUE.dom, RINGUE.fera,
    { tipos, bioma: mundo.mapa.chao || 'grama', treinador: !!desafio, golpes: golpesCat });
  modo = 'batalha';
  trocaModeloJogador(fera);
  hud.batalhaVisivel(true); hud.atualizaHP(batalha);
  hud.golpesPainel(linhasGolpes());
  hud.dica('Z/X/C/V golpe · SHIFT+botão = forte · segure A = carregar ki · 2 toques = cambalhota · ESPAÇO pula · F captura · Q PAUSA');
  hud.toast(`${nomeDe(fera)}, eu escolho você!`);
}
// ARENA DE TREINO: pula a fase de "encontro" e cai direto na luta, com
// feras temporárias — a equipe de verdade nem entra em campo
function iniciaTreino() {
  sfx.encontro(); hud.flash();
  musica('batalha');
  escondeHolo(); hud.menu(false);
  hud.exploracaoVisivel(false);
  temaArena(cena, mundo.mapa.chao || 'grama');
  mostraArena(cena, true);
  MD.mostra(domador, false);
  const feraP = criarFera(especies, golpesCat, treino.p, NIVEL_TREINO);
  // slot Z = o FÍSICO da própria fera (diretriz: um físico por fera);
  // X/C/V = os 3 poderes escolhidos (fortes das bases vêm via SHIFT)
  if (treino.golpes && treino.golpes.length) {
    const fisico = feraP.golpes.find((id) => golpesCat[id] && golpesCat[id].fisico) || 'garra';
    feraP.golpes = [fisico, ...treino.golpes];
    feraP.conhecidos = [...feraP.golpes];
    for (const [gid, def] of Object.entries(golpesCat))
      if (def.base && feraP.golpes.includes(def.base)) feraP.conhecidos.push(gid);
    feraP.usos = {};
    for (const gid of feraP.conhecidos)
      if (golpesCat[gid].usos != null)
        feraP.usos[gid] = golpesCat[gid].usos + Math.max(0, NIVEL_TREINO - 10);
  }
  const feraE = criarFera(especies, golpesCat, treino.e, NIVEL_TREINO);
  batalha = criarBatalha(especies,
    paraBatalha(feraP, especies, golpesCat),
    paraBatalha(feraE, especies, golpesCat),
    RINGUE.dom, RINGUE.fera,
    { tipos, bioma: mundo.mapa.chao || 'grama', treinador: true, golpes: golpesCat }); // sem captura
  // arena de TESTE: ki cheio dos dois lados — os golpes caros saem na hora
  batalha.p.energia = 100;
  batalha.e.energia = 100;
  modo = 'batalha';
  menu = { tipo: 'exploracao', sel: 0, fera: menu.fera, especie: menu.especie, ativo: false };
  feraAtual = modelosIni[treino.e];
  MD.setOpacidade(feraAtual, 1); MD.setEscala(feraAtual, 1);
  MD.flashCor(feraAtual, 0); feraAtual.g.rotation.x = 0;
  MD.setPos(feraAtual, sobreTablado(RINGUE.fera));
  MD.encara(feraAtual, RINGUE.dom.x, RINGUE.dom.z);
  feraAtual.g.rotation.y = feraAtual.giro;
  MD.mostra(feraAtual, true);
  poof(cena, { ...RINGUE.fera, y: 0.9 }, 0xffffff, 14, 4);
  trocaModeloJogador(feraP);
  hud.nomeInimigo(especies[treino.e].nome.toUpperCase(), NIVEL_TREINO);
  hud.batalhaVisivel(true); hud.atualizaHP(batalha);
  hud.golpesPainel(linhasGolpes());
  hud.dica('TREINO · Z/X/C/V golpe · SHIFT+botão = forte · A carrega ki · ESC menu');
  hud.toast(`🥊 Treino: ${especies[treino.p].nome} contra ${especies[treino.e].nome}!`, 2600);
}

function fugir() {
  if (desafio) { hud.toast(`${desafio.nome}: "Volte quando tiver coragem!"`); desafio = null; }
  hud.flash();
  musica('explorar');
  mostraArena(cena, false);
  MD.mostra(feraAtual, false); feraAtual = null;
  MD.mostra(domador, true);
  daImunidade(mundo);
  falarTrava = tempo + 0.6;
  modo = 'explorar';
  hud.exploracaoVisivel(true);
  menu = { tipo: 'exploracao', sel: 0, fera: menu.fera, especie: menu.especie, ativo: false };
  renderMenu();
  hud.dica(DICA_EXPLORAR);
  hud.toast('Você fugiu em segurança!');
}
function encerraBatalha() {
  // TREINO: acabou, não aconteceu nada — sem XP, sem captura, sem permadeath
  if (treino) {
    const resultado = batalha.resultado;
    hud.flash();
    musica('explorar');
    fechaMenu();
    mostraArena(cena, false);
    limpaProjeteis();
    if (playerM) { MD.mostra(playerM, false); playerM = null; }
    MD.mostra(cristal, false);
    if (feraAtual) { MD.mostra(feraAtual, false); feraAtual = null; }
    MD.mostra(domador, true);
    hud.batalhaVisivel(false);
    daImunidade(mundo);
    falarTrava = tempo + 0.6;
    hud.exploracaoVisivel(true);
    hud.dica(DICA_EXPLORAR);
    batalha = null; modo = 'explorar'; treino = null;
    menu = { tipo: 'exploracao', sel: 0, fera: menu.fera, especie: menu.especie, ativo: false };
    renderMenu();
    hud.toast(resultado === 'vitoria'
      ? '🥊 Mestre: "Bela luta! O treino forja campeões."'
      : resultado === 'derrota'
        ? '🥊 Mestre: "Caiu? Levanta! Aqui nada se perde — é só treino."'
        : '🥊 Treino encerrado.', 3000);
    atualizaPainel();
    return;
  }
  // duelo de treinador: caiu uma fera dele mas ainda tem outra? continua!
  if (batalha.resultado === 'vitoria' && desafio && desafio.idx < desafio.equipe.length - 1) {
    desafio.idx++;
    const prox = desafio.equipe[desafio.idx];
    const inim = criarFera(especies, golpesCat, prox.especie, prox.nivel);
    marcaVista(prox.especie);
    proximaFeraTreinador(batalha, paraBatalha(inim, especies, golpesCat), especies, RINGUE.fera);
    trocaModeloInimigo(prox.especie);
    hud.nomeInimigo(especies[prox.especie].nome.toUpperCase(), prox.nivel);
    hud.atualizaHP(batalha);
    hud.toast(`${desafio.nome}: "Vai, ${especies[prox.especie].nome}!"`, 2000);
    // regra do Domador: entre as feras do oponente, você escolhe se segue
    // com a sua ou troca (o menu pausa a batalha enquanto decide)
    if (equipe.filter((f) => f.hpAtual > 0).length > 1) abreMenu('posRound');
    return;
  }
  const resultado = batalha.resultado;
  const fera = equipe[ativa];
  if (fera && resultado !== 'derrota') fera.hpAtual = Math.max(1, batalha.p.hp);

  // PERMADEATH (regra do Domador): fera que desmaia é PERDIDA — para
  // sempre. Vale contra selvagens e treinadores locais; GINÁSIOS são
  // isentos (a fera só desmaia) e a arena de treino nem chega aqui.
  if (resultado === 'derrota') {
    const caida = equipe[ativa];
    const salvaguarda = !!mundo.mapa.ginasio;
    if (salvaguarda) {
      caida.hpAtual = 0;
      hud.toast(`${nomeDe(caida)} desmaiou! No Ginásio nada se perde — mas a luta aperta!`, 2600);
    } else {
      equipe.splice(ativa, 1);
      hud.toast(`💔 ${nomeDe(caida)} caiu... e o elo se desfez para sempre.`, 3000);
    }
    const proxIdx = equipe.findIndex((f) => f.hpAtual > 0);
    if (proxIdx >= 0) {
      ativa = proxIdx;
      const prox = equipe[proxIdx];
      continuaComOutraFera(batalha, paraBatalha(prox, especies, golpesCat), especies);
      trocaModeloJogador(prox);
      setTimeout(() => hud.toast(`Vai, ${nomeDe(prox)}! Cuidado!`, 1800), 1700);
      atualizaPainel();
      return; // a batalha segue!
    }
    if (!equipe.length)
      hud.toast('💀 Todas as suas feras se foram... e o mundo perdeu a cor.', 3600);
    ativa = 0;
  }

  hud.flash();
  musica('explorar');
  fechaMenu();
  mostraArena(cena, false);
  limpaProjeteis();
  if (playerM) { MD.mostra(playerM, false); playerM = null; }
  MD.mostra(cristal, false);
  if (feraAtual) { MD.mostra(feraAtual, false); feraAtual = null; }
  MD.mostra(domador, true);
  hud.batalhaVisivel(false);
  if (resultado === 'captura') {
    const nova = criarFera(especies, golpesCat, batalha.e.chave, batalha.e.nivel);
    nova.hpAtual = Math.max(1, batalha.e.hp);
    // squad cheio (5): a captura vai direto para o BOX
    if (equipe.length >= SQUAD_MAX) {
      box.push(nova);
      setTimeout(() => hud.toast(`📦 ${nomeDe(nova)} foi para o Box — squad cheio (${SQUAD_MAX}).`, 2800), 1200);
    } else equipe.push(nova);
  }
  if (resultado === 'fuga') hud.toast('Você recuou da batalha!');
  // fecha o duelo de treinador: vitória sobre a última fera dele = troféu
  if (desafio) {
    if (resultado === 'vitoria') {
      vencidosGlobais.add(desafio.nome);
      const nome = desafio.nome;
      setTimeout(() => hud.toast(`🏆 Você venceu ${nome}!`, 3200), 1500);
    }
    desafio = null;
  }
  daImunidade(mundo);
  falarTrava = tempo + 0.6;
  hud.exploracaoVisivel(true);
  hud.dica(DICA_EXPLORAR);
  batalha = null; modo = 'explorar';
  menu = { tipo: 'exploracao', sel: 0, fera: menu.fera, especie: menu.especie, ativo: false };
  renderMenu();
  if (resultado === 'derrota' && equipe.length === 0) {
    // o CAMINHO DA CINZA: sem teleporte — o herói volta A PÉ até a
    // Fogueira Eterna da Vila Clareira; sem elo, feras selvagens o ignoram
    setTimeout(() => hud.toast(
      '🚶 Sem elo, as feras o ignoram. Volte a pé até uma Chama e reacenda o vínculo.', 4500), 1800);
  }
  atualizaPainel();
  salvaJogo(); // toda batalha real muda a jornada: XP, HP, capturas, cristais
  // fera esperando para evoluir? A cerimônia começa assim que o pé
  // toca o chão do mundo
  if (evolucaoPendente) setTimeout(() => iniciaCerimonia(), 900);
}
// CERIMÔNIA DE EVOLUÇÃO: a fera antiga é projetada girando, a luz pulsa
// cada vez mais rápido, e no clarão final a forma NOVA se revela
function iniciaCerimonia() {
  if (!evolucaoPendente || modo !== 'explorar') return;
  const fera = evolucaoPendente;
  evolucaoPendente = null;
  if (!verificaEvolucao(especies, fera)) return;
  modo = 'evolucao';
  fechaMenu(); hud.menu(false);
  hud.exploracaoVisivel(false);
  musica('batalha');
  cerimonia = { fera, t: 0, trocou: false, de: fera.especie, flashes: 0 };
  mostraHoloEspecie(fera.especie);
  hud.toast(`✨ O quê?! ${nomeDe(fera)} está envolto em luz...`, 3000);
}
function passoCerimonia(dt) {
  const c = cerimonia;
  c.t += dt;
  // pulsos de luz acelerando até o clarão da troca
  const ritmo = c.t < 1.2 ? 0.6 : c.t < 2.4 ? 0.3 : 0.15;
  if (!c.trocou && c.t > 0.8 && c.t - (c.ultimoFlash || 0) > ritmo) {
    c.ultimoFlash = c.t;
    hud.flash(); sfx.swing();
  }
  if (!c.trocou && c.t >= 3.2) {
    c.trocou = true;
    const ev = evoluiFera(c.fera, especies, golpesCat);
    if (ev) {
      marcaVista(ev.para);
      hud.flash();
      sfx.vitoria();
      poof(cena, { ...mundo.domador.pos, y: 1.2 }, 0xffd23f, 22, 5);
      mostraHoloEspecie(c.fera.especie); // a forma NOVA assume a projeção
      hud.toast(`🌟 Parabéns! ${especies[ev.de].nome} evoluiu para ${especies[ev.para].nome.toUpperCase()}!`, 3600);
    }
  }
  if (c.t >= 6.2) {
    escondeHolo();
    MD.mostra(domador, true);
    cerimonia = null;
    modo = 'explorar';
    musica('explorar');
    hud.exploracaoVisivel(true);
    atualizaPainel();
    salvaJogo();
    // cadeia dupla (salto de nível cruzou dois limiares): emenda outra
    if (verificaEvolucao(especies, c.fera)) { evolucaoPendente = c.fera; setTimeout(() => iniciaCerimonia(), 700); }
  }
}
// passagem entre mapas: recria a sim no destino e remonta o cenário
function trocaMapa(destino, entrada) {
  hud.flash();
  const origem = chaveMapa;
  chaveMapa = destino;
  mundo = novoMundo(destino);
  mundo.domador.pos = entrada || entradaDoMapa(mundo.mapa, origem);
  daImunidade(mundo, 1.2);
  montaMapa(cena, mundo.mapa);
  const pp = mundo.domador.pos;
  cena.camPos.set(pp.x, pp.y + 17, pp.z + 12);
  cena.camAlvo.set(pp.x, 0.8, pp.z);
  hud.localAtual(mundo.mapa.nome);
  if (mundo.mapa.regiao) hud.mapaRegiao(dadosMapas, destino);
  hud.toast(`— ${mundo.mapa.nome} —`, 1800);
  salvaJogo();
}

/* ---------- sincroniza modelos com a simulação ---------- */
function sincronizaVisual(dt) {
  const d = mundo.domador;
  if (modo === 'explorar' || modo === 'titulo' || modo === 'intro') {
    MD.setPos(domador, d.pos);
    MD.passoGiro(domador, dt);
    if (domador.gltf) { // herói glTF: clipes de esqueleto de verdade
      MD.tocaClip(domador, d.andando ? (d.correndo ? 'correr' : 'andar') : 'parado', 0.15);
      MD.passoMixer(domador, dt);
    } else MD.animaAndar(domador, d.animT * (d.correndo ? 1.45 : 1), d.andando);
  }
  if (modo === 'encontro' && feraAtual) {
    MD.setPos(feraAtual, sobreTablado(RINGUE.fera));
    feraAtual.g.position.y = ARENA_Y + Math.abs(Math.sin(tempo * 3)) * 0.05;
    MD.animaIdle(feraAtual, tempo);
    atualizaClips(feraAtual, null, dt);
  }
  if (holoM) { MD.animaIdle(holoM, tempo); atualizaClips(holoM, null, dt); }
  if (modo === 'batalha' && batalha && playerM) {
    MD.setPos(playerM, sobreTablado(batalha.p.pos));
    MD.encara(playerM, batalha.e.pos.x, batalha.e.pos.z);
    MD.passoGiro(playerM, dt);
    MD.animaIdle(playerM, tempo);
    MD.animaAndarFera(playerM, tempo, batalha.p.movendo && batalha.p.estado === 'idle');
    MD.animaLuta(playerM, batalha.p);
    atualizaClips(playerM, batalha.p, dt);
    efeitoSopro(playerM, batalha.p, batalha.e.pos);
    if (batalha.p.estado === 'ko') MD.setOpacidade(playerM, Math.max(0, 1 - batalha.p.t * 1.1));
    aplicaFlash(playerM, batalha.p);

    MD.setPos(feraAtual, sobreTablado(batalha.e.pos));
    MD.encara(feraAtual, batalha.p.pos.x, batalha.p.pos.z);
    MD.passoGiro(feraAtual, dt);
    MD.animaIdle(feraAtual, tempo);
    MD.animaAndarFera(feraAtual, tempo, batalha.e.movendo && batalha.e.estado === 'idle');
    MD.animaLuta(feraAtual, batalha.e);
    atualizaClips(feraAtual, batalha.e, dt);
    efeitoSopro(feraAtual, batalha.e, batalha.p.pos);
    if (batalha.e.estado === 'ko') MD.setOpacidade(feraAtual, Math.max(0, 1 - batalha.e.t * 1.1));
    if (batalha.captura && batalha.captura.escalaFera !== undefined)
      MD.setEscala(feraAtual, batalha.captura.escalaFera);
    if (batalha.captura) MD.flashCor(feraAtual, 0);
    else aplicaFlash(feraAtual, batalha.e);

    if (batalha.captura) { MD.setPos(cristal, sobreTablado(batalha.captura.pos)); cristal.g.rotation.y += dt * 5; }

    // rastro de poeira da cambalhota
    if (batalha.p.estado === 'dash' && Math.random() < 0.7)
      poof(cena, { ...batalha.p.pos, y: 0.3 }, 0xcbd0d8, 2, 2);

    // aura de CARGA de energia (estilo ki): fagulhas douradas sobem
    for (const f of [batalha.p, batalha.e])
      if (f.carregando && Math.random() < 0.85)
        poof(cena, { x: f.pos.x + (Math.random() - 0.5) * 1.2, y: f.pos.y + 0.15,
                     z: f.pos.z + (Math.random() - 0.5) * 1.2 },
          Math.random() < 0.5 ? 0xffd23f : 0xfff6df, 2, 3);

    // projéteis em 2.5D: bola elemental animada + rastro de fagulhas; ao
    // sumir (acertou, caiu ou passou longe) estoura um impacto no lugar
    const vivos = new Set();
    for (const pr of batalha.projeteis) {
      vivos.add(pr.id);
      let e = projMeshes.get(pr.id);
      if (!e) {
        e = fx.projetil(pr.tipo, pr.rajada, pr.raio, pr.visual);
        projMeshes.set(pr.id, e);
      }
      fx.posiciona(e, pr.pos);
      e.ultPos = { ...pr.pos };
      if (Math.random() < 0.35)
        poof(cena, pr.pos, CORES_TIPO[pr.tipo] || 0xffffff, 1, 1.4);
    }
    for (const [id, e] of projMeshes)
      if (!vivos.has(id)) {
        if (e.ultPos) fx.impacto({ ...e.ultPos, y: e.ultPos.y - 0.9 }, false);
        fx.removeProjetil(e);
        projMeshes.delete(id);
      }
  }
}
function limpaProjeteis() {
  for (const [, e] of projMeshes) fx.removeProjetil(e);
  projMeshes.clear();
}
// SOPRO elemental (estilo Pokkén): enquanto carrega, fagulhas convergem na
// boca; na rajada, um jato contínuo sai da boca até o alvo
function efeitoSopro(M, f, alvoPos) {
  if (f.estado !== 'atk' || !f.golpe) return;
  const g = f.golpe;
  if (!g.rajada && !g.projetil && !g.feixe) return;
  const cor = CORES_TIPO[g.tipo || f.esp.tipo] || 0xffffff;
  const boca = MD.posBoca(M);
  if (g.feixe) {
    // trovão/energia: aura amarela-branca ENVOLVE a fera durante a carga
    if (f.t < g.prep && Math.random() < 0.9) {
      const a = Math.random() * 6.284;
      poof(cena, { x: f.pos.x + Math.cos(a) * 0.9,
                   y: f.pos.y + 0.2 + Math.random() * 1.3,
                   z: f.pos.z + Math.sin(a) * 0.9 },
        Math.random() < 0.45 ? 0xffffff : cor, 2, 1.4);
    }
    return;
  }
  if (f.t < g.prep) {
    if (Math.random() < 0.85)
      poof(cena, { x: boca.x, y: boca.y, z: boca.z }, cor, 2, 0.9);
  } else if (g.rajada) {
    // jato contínuo em 2.5D: línguas do elemento voam da boca ao alvo
    const dx = alvoPos.x - boca.x, dy = (alvoPos.y + 0.6) - boca.y, dz = alvoPos.z - boca.z;
    const L = Math.hypot(dx, dy, dz) || 1;
    const dir = { x: dx / L, y: dy / L, z: dz / L };
    if (Math.random() < 0.8) fx.sopro(boca, dir, g.tipo || f.esp.tipo, 11, g.visual);
    if (Math.random() < 0.35) jato(cena, boca, dir, cor, 2, 11);
  }
}
// modelos glTF: escolhe o clipe do esqueleto conforme a situação e avança o
// mixer. O mapa de clipes vem dos DADOS da espécie ("clipes" no JSON):
// parado / andar / correr / ataque / forte / dano / ko — com fallbacks para
// modelos que não têm todos (a raposa só tem parado/andar/correr).
function atualizaClips(M, f, dt) {
  if (!M || !M.gltf) return;
  const c = M.clipes || {};
  // só clipes que EXISTEM neste modelo contam (nem toda fera tem soco/forte)
  const tem = (nome) => (nome && M.clips && M.clips[nome]) ? nome : null;
  const parado = tem(c.parado) || 'Survey', andar = tem(c.andar) || 'Walk',
        correr = tem(c.correr) || andar;
  if (f && f.estado === 'atk') {
    // golpes podem pedir um clipe próprio ("clipe" no golpes.json — ex.: o
    // soco do Arranhão); senão forte/ataque; recomeça a cada ataque novo.
    // "dur" avisa a janela do golpe: clipes longos pulam a preparação
    const g = f.golpe;
    const ranged = !!(g && (g.projetil || g.rajada || g.feixe));
    // fallback por família: golpe de PODER sem clipe próprio cai na
    // conjuração (arremesso), nunca no "forte" físico (que pode ser um
    // giro 360 — ficava esquisito num feixe!)
    const nome = tem(g && g.clipe && c[g.clipe])
      || (ranged ? (tem(c.arremesso) || tem(c.ataque)) : null)
      || (g && g.forte && tem(c.forte)) || tem(c.ataque) || correr;
    const dur = g ? g.prep + g.ativo + g.recup : 0;
    MD.tocaClip(M, nome, 0.08, { once: nome !== correr, restart: f.t < dt * 2, dur });
  }
  // pirueta para TRÁS com clipe real (Backflip do Meshy), quando existir
  else if (f && f.piruetando && f.pos.y > 0.02 && f.dashRel && f.dashRel.z > 0.5 && tem(c.mortal))
    MD.tocaClip(M, c.mortal, 0.05, { once: true, dur: 1.1 });
  else if (f && f.estado === 'dash') MD.tocaClip(M, correr, 0.1);
  else if (f && f.estado === 'hurt') MD.tocaClip(M, tem(c.dano) || parado, 0.08, { once: !!tem(c.dano), dur: 0.45 });
  else if (f && f.estado === 'ko') MD.tocaClip(M, tem(c.ko) || tem(c.dano) || parado, 0.15, { once: !!(tem(c.ko) || tem(c.dano)), dur: 1.3 });
  else if (f && f.movendo && f.estado === 'idle') MD.tocaClip(M, andar);
  else MD.tocaClip(M, parado);
  MD.passoMixer(M, dt);
}
function aplicaFlash(M, f) {
  if (f.flash > 0) MD.flashCor(M, f.flash > 0.5 ? 0xffffff : 0xff5533);
  else if (f.estado === 'atk' && f.golpe && f.golpe.forte && f.t < f.golpe.prep)
    MD.flashCor(M, Math.sin(tempo * 40) > 0 ? 0xffffff : 0xff5533);
  else MD.flashCor(M, 0);
}

/* ---------- loop ---------- */
// mundo SEM COR enquanto não houver elo (início da jornada e Caminho da
// Cinza); batalhas nunca são cinzas (a arena de treino luta sem equipe)
const semCor = () => equipe.length === 0 && modo !== 'batalha' && modo !== 'encontro';
const camEncontro = { p: { pos: RINGUE.dom }, e: { pos: RINGUE.fera } };
let ultimo = performance.now();
function loop(agora) {
  requestAnimationFrame(loop);
  let dt = (agora - ultimo) / 1000; ultimo = agora;
  if (dt > 0.05) dt = 0.05;
  tempo += dt; edges();

  if (hitstop > 0) { hitstop -= dt; renderiza(cena, semCor()); return; }

  passoParticulas(cena, dt);
  fx.passo(dt);
  passoAmbiente(cena, tempo);
  hud.passoDanos(cena.camera, dt, THREE);

  if (modo === 'intro') {
    // abertura: Z (ou ESPAÇO) avança os textos; o controle vem depois
    if (jE || spE) {
      falaIntro++;
      if (falaIntro < INTRO_FALAS.length) {
        sfx.swing();
        hud.toast(`${INTRO_FALAS[falaIntro]}  ▸`, 600000);
      } else {
        modo = 'explorar';
        renderMenu();
        hud.dica(DICA_EXPLORAR);
        hud.toast('Suba a colina até a CHAMA PRIMORDIAL — o Ancião Bramo aponta o caminho.', 3200);
      }
    }
  } else if (modo === 'explorar') {
    // evolução esperando e nada no caminho? A cerimônia começa
    if (evolucaoPendente && !cerimonia && !menu.ativo) iniciaCerimonia();
    if (menu.ativo) {
      navegaMenu();
      if (holoM) { // holograma gira e flutua
        holoM.g.rotation.y += dt * 1.6;
        holoM.g.position.y = mundo.domador.pos.y + 0.15 + holoAltoExtra + Math.sin(tempo * 2) * 0.08;
      }
    }
    else if (mE) { menu.ativo = true; renderMenu(); }
    else {
      detectaCorrida();
      // elo apagado: nenhuma fera selvagem aparece no Caminho da Cinza
      if (!equipe.length) daImunidade(mundo, 0.5);
      const inp = { mov: { x: eixo(['ArrowLeft'], ['ArrowRight']),
                           z: eixo(['ArrowUp'], ['ArrowDown']) },
                    correr: correndo, falar: jE && tempo > falarTrava };
      MD.giraDirecao(domador, inp.mov.x, inp.mov.z);
      const evt = passoMundo(mundo, inp, dt);
      if (mundo.domador.correndo && Math.random() < 0.25)
        poof(cena, { ...mundo.domador.pos, y: mundo.domador.pos.y + 0.15 }, 0xcbb28a, 1, 1.2);
      if (evt === 'encontro') iniciaEncontro();
      else if (evt && evt.tipo === 'fogueira') {
        if (!equipe.length) {
          // só a fogueira da vila NATAL acende (ou reacende) o elo
          if (chaveMapa === dadosMapas.inicial) iniciaRitual(jaEscolheu);
          else hud.toast('Esta fogueira não reconhece você. A SUA chama arde na Vila Primordial.', 3000);
        }
        else hud.toast('🔥 A Fogueira Eterna crepita. O elo com suas feras se aquece.', 2800);
      }
      else if (evt && evt.tipo === 'treinador') {
        if (!equipe.length) { hud.toast('Sem elo não há duelo. Volte à Fogueira Eterna.', 2200); }
        else {
          // conversa primeiro — e o desafio não pode ser recusado!
          const t = evt.treinador;
          desafio = { nome: t.nome, equipe: t.equipe, idx: 0 };
          sfx.encontro();
          hud.fala(ROSTO_PAPEL[t.tipo] || '🥊', t.nome, t.fala || 'Vamos duelar!', 2400);
          setTimeout(() => { if (modo === 'explorar' && desafio) iniciaEncontro(); }, 2000);
        }
      }
      else if (evt && evt.tipo === 'bau') {
        const chaveBau = `${chaveMapa}:${evt.idx}`;
        if (!bausAbertos.has(chaveBau)) {
          bausAbertos.add(chaveBau);
          const [, bx, bz, item, qtd = 1] = evt.bau;
          if (item === 'cristal') itens.cristal += qtd; // soma SEM teto
          sfx.capturado(); hud.flash();
          poof(cena, { x: bx, y: 1, z: bz }, 0xffd23f, 14, 4);
          hud.toast(`🎁 Baú aberto! +${qtd} EsFera${qtd > 1 ? 's' : ''} de Captura`, 2600);
          // o baú some do cenário (a visão viva também o esconde no reload)
          cena.mundoG.traverse((o) => { if (o.userData.bau === evt.idx) o.visible = false; });
          atualizaPainel(); salvaJogo();
        }
      }
      else if (evt && evt.tipo === 'portalDev') {
        sfx.cristalVoa(); hud.flash();
        hud.toast('🛠 Portal do Desenvolvedor — atravessando...', 2400);
        // desembarca AO LADO do portal de volta do outro mundo
        trocaMapa(evt.destino, evt.chegada ? { x: evt.chegada.x, y: 0, z: evt.chegada.z } : undefined);
      }
      else if (evt && evt.tipo === 'arenaTreino') {
        sfx.swing();
        hud.toast('🥊 Mestre da Arena: "Escolha os dois lados do duelo — aqui é só treino, nada se perde."', 3000);
        treino = null;
        abreMenu('treinoP');
      }
      else if (evt && evt.tipo === 'balsa') {
        // a travessia do Mar do Meio: desembarca no píer do outro lado
        const bDest = dadosMapas.mapas[evt.destino].balsa;
        sfx.cristalVoa();
        hud.toast('🌊 A balsa corta o Mar do Meio...', 2600);
        trocaMapa(evt.destino, { x: bDest.x, y: 0,
          z: bDest.z + (bDest.dir === 'norte' ? 1.8 : -1.8) });
      }
      else if (evt && evt.tipo === 'fala') {
        sfx.swing();
        if (evt.placa) hud.fala('🪧', 'PLACA', evt.texto);
        else {
          hud.fala(ROSTO_PAPEL[evt.papel] || '💬', 'MORADOR', evt.texto);
          // o ANCIÃO entrega as 5 primeiras EsFeras (uma vez, fica no save)
          if (evt.papel === 'senhor' && chaveMapa === dadosMapas.inicial &&
              !bausAbertos.has('presente:anciao')) {
            bausAbertos.add('presente:anciao');
            itens.cristal += 5;
            sfx.capturado();
            setTimeout(() => hud.toast('🎁 O Ancião Bramo lhe entrega 5 EsFeras de Captura!', 3000), 1200);
            atualizaPainel(); salvaJogo();
          }
        }
      }
      else if (evt === 'cura') {
        // a cura NÃO repõe EsFeras (regra do Domador): elas vêm de baús e
        // do mercado — a enfermeira cuida só das feras
        sfx.capturado(); hud.flash();
        for (const f of equipe) curaTotal(f, especies, golpesCat);
        atualizaPainel();
        salvaJogo();
        hud.toast('❤ Enfermeira: suas feras foram restauradas!', 2600);
      }
      else if (evt && evt.tipo === 'porta') {
        if (evt.destino === 'retorno' && retornoPorta.length) {
          const r = retornoPorta.pop();
          trocaMapa(r.mapa, { x: r.pos.x, y: 0, z: r.pos.z });
        } else if (evt.destino !== 'retorno') {
          retornoPorta.push({ mapa: chaveMapa, pos: evt.retorno });
          trocaMapa(evt.destino);
          // CENTRO DE CURA: entrar já cura — piscada e pronto, sem conversa
          // (EsFeras NÃO: elas vêm de baús e do mercado)
          if (evt.destino === 'interior_centro' && equipe.length) {
            setTimeout(() => {
              hud.flash(); sfx.capturado();
              for (const f of equipe) curaTotal(f, especies, golpesCat);
              atualizaPainel();
              salvaJogo();
              hud.toast('❤ Suas feras descansaram e estão renovadas!', 2600);
            }, 600);
          }
        }
      }
      else if (evt && evt.tipo === 'saida') {
        // portais podem exigir MISSÃO cumprida (ex.: ter a fera inicial)
        if (evt.saida.requer === 'fera' && !equipe.length) {
          const b = evt.saida.borda; // empurra de volta pela borda do portal
          if (b === 'leste') mundo.domador.pos.x -= 1.5;
          else if (b === 'oeste') mundo.domador.pos.x += 1.5;
          else if (b === 'sul') mundo.domador.pos.z -= 1.5;
          else mundo.domador.pos.z += 1.5;
          hud.toast('🔥 O Ancião avisou: sem uma fera ao seu lado, o mundo lá fora o devoraria. Suba até a Chama!', 3200);
        } else trocaMapa(evt.saida.destino);
      }
      // dica de interação: mostra "Z — ..." quando há algo por perto
      hud.interacao(menu.ativo ? null : interacaoPerto(mundo));
    }
    hud.miniMapa(mundo);
  } else if (modo === 'evolucao' && cerimonia) {
    // a cerimônia toca sozinha; a projeção gira solene no centro
    if (holoM) holoM.g.rotation.y += dt * 2.2;
    passoCerimonia(dt);
  } else if (modo === 'encontro') {
    if (cimaE || baixoE) { escolha = 1 - escolha; hud.escolha(true, escolha); sfx.swing(); }
    if (jE) confirmaEscolha();
  } else if (modo === 'batalha' && batalha) {
    if (menu.ativo) navegaMenu();
    else if (escE || mE) { menu.tipo = 'batalha'; menu.sel = 0; menu.ativo = true; renderMenu(); }
    else {
      const dash = detectaDashLuta();
      // toque = golpe simples; SHIFT + botão = a versão forte na hora
      const press = jE ? 0 : kE ? 1 : cE ? 2 : vE ? 3 : null;
      const golpeIdx = press;
      const forte = press != null && shiftSegurado();
      if (fE && itens.cristal <= 0)
        hud.toast('Sem EsFeras! Procure baús pelo mundo ou o mercado.', 2000);
      const inpP = {
        mov: { x: eixo(['ArrowLeft'], ['ArrowRight']),
               z: eixo(['ArrowUp'], ['ArrowDown']) },
        pulo: spE, golpe: golpeIdx, forte, dash, capturar: fE && itens.cristal > 0,
        carregar: !!keys.KeyA, // segurar A = carregar energia (ki)
      };
      const fim = passoBatalha(batalha, inpP, dt, aoEvento);
      hud.atualizaHP(batalha);
      hud.capDisponivel(podeCapturar(batalha));
      if (fim === 'encerrar') encerraBatalha();
    }
  }

  sincronizaVisual(dt);
  passoCamera(cena, modo === 'encontro' ? 'batalha' : modo, mundo,
              modo === 'encontro' ? camEncontro : batalha, dt);
  if (modo === 'explorar' || modo === 'titulo' || modo === 'intro')
    passoOclusores(cena, [mundo.domador.pos], cena.oclusores);
  else if (modo === 'encontro')
    passoOclusores(cena, [RINGUE.fera], cena.oclusoresArena);
  else if (modo === 'batalha' && batalha)
    passoOclusores(cena, [batalha.p.pos, batalha.e.pos], cena.oclusoresArena);
  renderiza(cena, semCor());
}
cv.focus(); setTimeout(() => cv.focus(), 300);

// gancho de TESTES (console do navegador) — não é interface do jogo
window.DEV = {
  teleporta(x, z) { mundo.domador.pos.x = x; mundo.domador.pos.z = z; },
  vaiPara(destino) { trocaMapa(destino); },
  apagaSave() {
    removeEventListener('beforeunload', salvaJogo);
    localStorage.removeItem(CHAVE_SAVE);
    location.reload();
  },
  salva: () => { salvaJogo(); return localStorage.getItem(CHAVE_SAVE); },
  cena3d: () => cena, // sonda da cena Three.js (inspeção de materiais/oclusores)
  estado: () => ({ modo, mapa: chaveMapa, pos: { ...mundo.domador.pos },
                   equipe: equipe.length, menu: menu.tipo, menuAtivo: menu.ativo,
                   treino: treino ? { ...treino } : null, batalha: !!batalha }),
  enche: () => { if (batalha) batalha.p.energia = 100; },
  sofre: () => { if (batalha) batalha.p.hp = 1; }, // teste de permadeath
  vence: () => { if (batalha) batalha.e.hp = 1; }, // teste de vitória/evolução
  luta: () => batalha && {
    poseAtiva: !!(playerM && playerM.g.userData._poseAtiva),
    golpe: batalha.p.golpe ? batalha.p.golpe.nome : null,
    estado: batalha.p.estado, t: +batalha.p.t.toFixed(2),
    comboQ: !!batalha.p.comboQ, catalogo: !!batalha.catalogo,
    clip: playerM ? playerM.clipAtual : null,
    rotY: playerM ? +playerM.g.rotation.y.toFixed(2) : null,
    clips: playerM && playerM.clips ? Object.keys(playerM.clips) : null,
  },
};
requestAnimationFrame(loop);
