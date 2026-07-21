// MAIN — o maestro: carrega os dados, liga a simulação (sim/) à apresentação
// (render/) e roda o loop. A simulação decide; o main traduz eventos em
// som, partículas e HUD. Nenhuma regra de jogo vive aqui.
import * as THREE from 'three';
import { criarMundo, passoMundo, daImunidade, entradaDoMapa } from './sim/mundo.js';
import { criarBatalha, passoBatalha, podeCapturar, fugirBatalha, trocaFera, continuaComOutraFera } from './sim/batalha.js';
import { ganhaXp, xpParaSubir, xpPorVitoria, nivelSelvagem, vidaMaxima, NIVEL_INICIAL } from './sim/progressao.js';
import { criarFera, aprendeGolpe, lembraGolpe, montaSlots, aprendizadosDoNivel, curaTotal, bonusNivel, paraBatalha } from './sim/equipe.js';
import { criarCena, poof, jato, passoParticulas, passoAmbiente, passoCamera, mostraArena, montaMapa, passoOclusores } from './render/cena.js';
import { criarEfeitos } from './render/efeitos.js';
import * as MD from './render/modelos.js';
import { criarHUD } from './render/hud.js';
import { audioInit, sfx, musica } from './render/audio.js';

const especies = await (await fetch('./src/dados/especies.json')).json();
const dadosMapas = await (await fetch('./src/dados/mapas.json')).json();
const golpesCat = await (await fetch('./src/dados/golpes.json')).json();

const cv = document.getElementById('cv');
const cena = criarCena(cv);
const fx = criarEfeitos(cena.scene); // golpes elementais em sprites 2.5D
const hud = criarHUD();

// modelos 3D: um conjunto para a fera do jogador e outro para a selvagem
// (criarFera é assíncrono — espécies com "modelo3d" carregam arquivos glTF)
const domador = MD.criarDomador(cena.scene);
const modelosJog = {}, modelosIni = {};
for (const k of Object.keys(especies)) {
  modelosJog[k] = await MD.criarFera(cena.scene, k, especies[k]); MD.mostra(modelosJog[k], false);
  modelosIni[k] = await MD.criarFera(cena.scene, k, especies[k]); MD.mostra(modelosIni[k], false);
}
const cristal = MD.criarCristal(cena.scene); MD.mostra(cristal, false);
const discoHolo = MD.criarDiscoHolo(cena.scene); MD.mostra(discoHolo, false);
let holoM = null; // fera projetada no menu de status/compêndio

const RINGUE = { dom: { x: -5, y: 0, z: 0 }, fera: { x: 3.5, y: 0, z: 0 } };
const DICA_EXPLORAR = 'Setas: andar (2 toques = correr) · M abre o menu';
const CORES_TIPO = { fogo: 0xff8a3d, eletrico: 0xffe94d, agua: 0x4da3ff, planta: 0x5fd35a, comum: 0xcbd0d8 };
const SIMBOLO = { baixo: '↓', frente: '→' };
const TECLAS_GOLPE = ['Z', 'X', 'C', 'V'];
const projMeshes = new Map();

/* ---------- estado ---------- */
let modo = 'titulo'; // titulo | explorar | encontro | batalha
const chavesSelvagens = Object.keys(especies).filter((k) => especies[k].selvagem);
let chaveMapa = dadosMapas.inicial;
function novoMundo(chave) {
  const mapa = dadosMapas.mapas[chave];
  return criarMundo(mapa, mapa.selvagens || chavesSelvagens);
}
let mundo = novoMundo(chaveMapa);
montaMapa(cena, mundo.mapa);
hud.localAtual(mundo.mapa.nome);
hud.mapaRegiao(dadosMapas, chaveMapa);

// fera inicial em modo de teste: todos os golpes da tabela já liberados
let equipe = [criarFera(especies, golpesCat, 'brasinha', NIVEL_INICIAL, true)];
let ativa = 0;
const nomeDe = (f) => f.apelido || especies[f.especie].nome;
function atualizaPainel() {
  const f = equipe[ativa];
  hud.nomeJogador(nomeDe(f), f.nivel);
  hud.painelVida(f.hpAtual, vidaMaxima(especies[f.especie].vida, f.nivel));
  hud.equipe(equipe.length);
  if (modo === 'explorar') renderMenu();
}
atualizaPainel();

let batalha = null;
let playerM = null;
let feraAtual = null;
let escolha = 0;
// menu lateral: SEMPRE visível na exploração; "ativo" = navegando nele
let menu = { tipo: 'exploracao', sel: 0, fera: 0, especie: null, ativo: false };
let retornoPorta = null;
let hitstop = 0, tempo = 0;

/* ---------- entrada (setas + Z/X/C/V golpes, F captura, M/ESC menu) ---- */
const keys = {};
let jE = false, kE = false, cE = false, vE = false, fE = false, spE = false;
let pJ = false, pK = false, pC = false, pV = false, pF = false, pS = false;
let cimaE = false, baixoE = false, pCima = false, pBaixo = false;
let mE = false, escE = false, pM = false, pEsc = false;
addEventListener('keydown', (e) => {
  audioInit(); keys[e.code] = true;
  if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.code === 'Enter' && modo === 'titulo') {
    hud.escondeTitulo(); modo = 'explorar'; cv.focus();
    musica('explorar');
    renderMenu();
    hud.toast('Explore a grama alta... e cuide das suas feras: quem desmaia não volta!');
    hud.dica(DICA_EXPLORAR);
  }
});
addEventListener('keyup', (e) => keys[e.code] = false);
cv.addEventListener('pointerdown', () => { audioInit(); cv.focus(); });
function edges() {
  const Z = keys.KeyZ || keys.KeyJ, X = keys.KeyX || keys.KeyK,
        C = keys.KeyC, V = keys.KeyV, F = keys.KeyF, S = keys.Space;
  jE = Z && !pJ; kE = X && !pK; cE = C && !pC; vE = V && !pV; fE = F && !pF; spE = S && !pS;
  pJ = Z; pK = X; pC = C; pV = V; pF = F; pS = S;
  const CIMA = keys.ArrowUp || keys.KeyW, BAIXO = keys.ArrowDown || keys.KeyS;
  cimaE = CIMA && !pCima; baixoE = BAIXO && !pBaixo;
  pCima = CIMA; pBaixo = BAIXO;
  const M = keys.KeyM, ESC = keys.Escape;
  mE = M && !pM; escE = ESC && !pEsc;
  pM = M; pEsc = ESC;
}
const eixo = (neg, pos) => (keys[pos[0]] || keys[pos[1]] ? 1 : 0) - (keys[neg[0]] || keys[neg[1]] ? 1 : 0);

/* corrida: dois toques rápidos na mesma direção, segurando o segundo */
const TECLAS_DIR = ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyA','KeyS','KeyD'];
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
  ArrowUp: { x: 0, z: -1 }, KeyW: { x: 0, z: -1 },
  ArrowDown: { x: 0, z: 1 }, KeyS: { x: 0, z: 1 },
  ArrowLeft: { x: -1, z: 0 }, KeyA: { x: -1, z: 0 },
  ArrowRight: { x: 1, z: 0 }, KeyD: { x: 1, z: 0 },
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
      hud.dano(evt.pos, evt.dano, false); break;
    case 'hitForte': sfx.hitForte(); cena.shake = 0.5; hitstop = 0.09;
      fx.impacto(evt.pos, true);
      poof(cena, { ...evt.pos, y: evt.pos.y + 1 }, 0xff6b4a, 8, 4.5);
      hud.dano(evt.pos, evt.dano, true); break;
    case 'rastroFogo': if (Math.random() < 0.5)
      poof(cena, evt.pos, Math.random() < 0.5 ? 0xff8a3d : 0xffd93b, 2, 2.5); break;
    case 'pulo': sfx.pulo(); break;
    case 'dash': sfx.pulo();
      if (batalha) poof(cena, { ...batalha.p.pos, y: 0.3 }, 0xcbd0d8, 6, 2.5); break;
    case 'swing': sfx.swing(); break;
    case 'especial': sfx.especial(); break;
    case 'comando': sfx.especial(); cena.shake = 0.22;
      poof(cena, { ...evt.pos, y: 1 }, 0xffffff, 8, 3.5);
      hud.toast(`${evt.nome}!`, 900); break;
    case 'projetil': sfx.swing();
      poof(cena, evt.pos, CORES_TIPO[evt.elemento] || 0xffffff, 12, 3.2); break;
    case 'semUsos': hud.toast(`Sem usos de ${evt.nome}! Descanse no Centro de Curas.`, 1600); break;
    case 'golpeUsado': hud.golpesPainel(linhasGolpes()); break;
    case 'cristalVoa': sfx.cristalVoa(); MD.mostra(cristal, true); break;
    case 'cristalSuga': poof(cena, evt.pos, 0x59e0d0, 14, 4); break;
    case 'cristalTreme': sfx.cristalTreme(); break;
    case 'capturado': sfx.capturado(); hitstop = 0.15;
      hud.toast(`${batalha.e.esp.nome} foi capturado! ${premiaXp()}`); break;
    case 'escapou': MD.mostra(cristal, false);
      hud.toast(`Ah, quase! O ${batalha.e.esp.nome} escapou do cristal!`); break;
    case 'vitoria': sfx.vitoria(); hitstop = 0.22;
      hud.toast(`${batalha.e.esp.nome} desmaiou! ${premiaXp()}`); break;
    case 'derrota': sfx.derrota(); hitstop = 0.22; break;
  }
}

/* ---------- golpes no HUD da luta ---------- */
function linhasGolpes() {
  if (!batalha) return [];
  const f = batalha.p;
  const usosTxt = (id, def) => def.usos == null ? '∞' : `${f.usos[id] || 0}/${def.usos}`;
  const linhas = [];
  f.slots.forEach((s, i) => {
    linhas.push({ tecla: TECLAS_GOLPE[i], nome: s.def.nome, usos: usosTxt(s.id, s.def) });
    if (s.forte)
      linhas.push({ tecla: `Shift+${TECLAS_GOLPE[i]}`, nome: s.forte.def.nome, usos: usosTxt(s.forte.id, s.forte.def) });
  });
  return linhas;
}

/* ---------- XP, nível e aprendizado ---------- */
function premiaXp() {
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
    let atraso = 1500;
    setTimeout(() => { sfx.vitoria(); hud.toast(`⬆ ${nomeDe(fera)} subiu para o nível ${fera.nivel}!`, 2100); }, atraso);
    for (const av of avisos) {
      atraso += 2200;
      const nomeG = golpesCat[av.id].nome;
      const msg = av.tipo === 'substituiu'
        ? `${nomeDe(fera)} esqueceu ${golpesCat[av.trocado].nome} e aprendeu ${nomeG}!`
        : `${nomeDe(fera)} aprendeu ${nomeG}!`;
      setTimeout(() => { sfx.capturado(); hud.toast(`✨ ${msg}`, 2100); }, atraso);
    }
  }
  atualizaPainel();
  return `+${ganho} XP`;
}

/* ---------- menus ---------- */
function tituloMenu() {
  const t = menu.tipo;
  if (t === 'statusFera' || t === 'lembrar') {
    const f = equipe[menu.fera];
    return `${nomeDe(f).toUpperCase()} · Lv.${f.nivel}`;
  }
  if (t === 'compendioFera') return especies[menu.especie].nome.toUpperCase();
  if (t === 'exploracao' && !menu.ativo) return 'MENU · aperte M';
  return { exploracao: 'MENU', batalha: 'BATALHA', equipeExp: 'EQUIPE',
           equipeBat: 'TROCAR FERA', statusLista: 'STATUS', catalogo: 'CATÁLOGO DE GOLPES',
           compendio: 'COMPÊNDIO DE FERAS' }[t] || 'MENU';
}
function itensDoMenu() {
  const t = menu.tipo;
  const nada = () => {};
  if (t === 'exploracao') return [
    { txt: 'Equipe', acao: () => abreMenu('equipeExp') },
    { txt: 'Status', acao: () => abreMenu('statusLista') },
    { txt: 'Compêndio', acao: () => abreMenu('compendio') },
    { txt: 'Catálogo', acao: () => abreMenu('catalogo') },
    { txt: 'Itens', acao: () => hud.toast('Itens: em breve!') },
    { txt: 'Carteira', acao: () => hud.toast('Carteira: 0 moedas (economia em breve)') },
    { txt: 'Insígnias', acao: () => hud.toast('Insígnias: nenhuma ainda') },
    { txt: 'Fechar', acao: fechaMenu },
  ];
  if (t === 'batalha') return [
    { txt: 'Continuar', acao: fechaMenu },
    { txt: 'Trocar Fera', acao: () => abreMenu('equipeBat') },
    { txt: 'Itens', acao: () => hud.toast('Itens: em breve!') },
    { txt: 'Fugir', acao: () => { fechaMenu(); fugirBatalha(batalha); } },
  ];
  if (t === 'equipeExp' || t === 'equipeBat') return equipe.map((f, i) => ({
    txt: `${nomeDe(f)} Lv.${f.nivel}${i === ativa ? ' ◆' : ''}${f.hpAtual <= 0 ? ' ✖' : ''}`,
    acao: () => selecionaFera(i),
  }));
  if (t === 'statusLista') return [
    ...equipe.map((f, i) => ({
      txt: `${nomeDe(f)} Lv.${f.nivel}${f.hpAtual <= 0 ? ' ✖' : ''}`,
      acao: () => { menu.fera = i; abreMenu('statusFera'); },
    })),
    { txt: 'Voltar', acao: () => abreMenu('exploracao') },
  ];
  if (t === 'statusFera') {
    const f = equipe[menu.fera];
    const max = vidaMaxima(especies[f.especie].vida, f.nivel);
    const usosTxt = (id) => golpesCat[id].usos == null ? '∞' : `${f.usos[id] || 0}/${golpesCat[id].usos}`;
    const linhas = [{ txt: `HP ${f.hpAtual}/${max} · XP ${f.xp}/${xpParaSubir(f.nivel)}`, acao: nada }];
    for (const id of f.golpes)
      linhas.push({ txt: `• ${golpesCat[id].nome} (${usosTxt(id)})`, acao: nada });
    for (const id of f.conhecidos)
      if (golpesCat[id].base && f.golpes.includes(golpesCat[id].base))
        linhas.push({ txt: `• combo: ${golpesCat[id].nome} (${usosTxt(id)})`, acao: nada });
    linhas.push({ txt: 'Renomear', acao: () => {
      const n = prompt('Novo nome da fera:', nomeDe(f));
      if (n && n.trim()) { f.apelido = n.trim().slice(0, 12); atualizaPainel(); abreMenu('statusFera'); }
    } });
    linhas.push({ txt: 'Lembrar golpe', acao: () => abreMenu('lembrar') });
    linhas.push({ txt: 'Voltar', acao: () => abreMenu('statusLista') });
    return linhas;
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
  if (t === 'catalogo') return [
    ...Object.values(golpesCat).map((g) => ({
      txt: `${g.nome} · ${g.tipo}${g.base ? ' · forte' : ''} · ${g.usos == null ? '∞' : g.usos} usos`,
      acao: nada,
    })),
    { txt: 'Voltar', acao: () => abreMenu('exploracao') },
  ];
  if (t === 'compendio') return [
    ...Object.keys(especies).map((k) => ({
      txt: especies[k].nome,
      acao: () => { menu.especie = k; abreMenu('compendioFera'); },
    })),
    { txt: 'Voltar', acao: () => abreMenu('exploracao') },
  ];
  if (t === 'compendioFera') {
    const k = menu.especie, e2 = especies[k];
    const locais = Object.values(dadosMapas.mapas)
      .filter((mp) => (mp.selvagens || []).includes(k))
      .map((mp) => mp.nome);
    return [
      { txt: `Tipo: ${e2.tipo} · ${e2.raridade.replace('_', ' ')}`, acao: nada },
      { txt: locais.length ? `Habitat: ${locais.join(', ')}` : 'Habitat: ainda não avistada', acao: nada },
      { txt: 'Voltar', acao: () => abreMenu('compendio') },
    ];
  }
  return [];
}
/* holograma GIGANTE: a fera aparece girando no centro da tela */
function mostraHoloEspecie(chave) {
  escondeHolo();
  holoM = modelosIni[chave];
  // o domador dá lugar à projeção — o holograma fica no centro da tela
  MD.mostra(domador, false);
  const base = { x: mundo.domador.pos.x, y: mundo.domador.pos.y + 0.1, z: mundo.domador.pos.z };
  MD.setPos(holoM, base);
  MD.setEscala(holoM, 4.5);
  // sólido e com tinta azulada BEM sutil: as cores reais da fera aparecem
  MD.setOpacidade(holoM, 1);
  MD.flashCor(holoM, 0x06222a);
  holoM.g.rotation.x = 0;
  MD.mostra(holoM, true);
  MD.setPos(discoHolo, base);
  MD.setEscala(discoHolo, 3.6);
  MD.mostra(discoHolo, true);
}
function escondeHolo() {
  if (!holoM) return;
  MD.setOpacidade(holoM, 1);
  MD.flashCor(holoM, 0);
  MD.setEscala(holoM, 1);
  MD.mostra(holoM, false);
  MD.mostra(discoHolo, false);
  MD.mostra(domador, true);
  holoM = null;
}

// desenha o menu lateral (com destaque só quando está ativo)
function renderMenu() {
  hud.menu(true, tituloMenu(), itensDoMenu().map((i) => i.txt), menu.ativo ? menu.sel : -1);
}
function abreMenu(tipo) {
  menu = { tipo, sel: 0, fera: menu.fera, especie: menu.especie, ativo: true };
  renderMenu();
  if (tipo === 'statusFera' || tipo === 'lembrar') mostraHoloEspecie(equipe[menu.fera].especie);
  else if (tipo === 'compendioFera') mostraHoloEspecie(menu.especie);
  else escondeHolo();
}
// "fechar": na exploração o menu continua na lateral, só desativa a navegação
function fechaMenu() {
  escondeHolo();
  menu = { tipo: 'exploracao', sel: 0, fera: menu.fera, especie: menu.especie, ativo: false };
  if (modo === 'batalha' || modo === 'encontro') hud.menu(false);
  else renderMenu();
}
function voltaMenu() {
  const t = menu.tipo;
  if (t === 'equipeExp' || t === 'statusLista' || t === 'catalogo' || t === 'compendio') abreMenu('exploracao');
  else if (t === 'equipeBat' || t === 'batalha') fechaMenu();
  else if (t === 'statusFera') abreMenu('statusLista');
  else if (t === 'lembrar') abreMenu('statusFera');
  else if (t === 'compendioFera') abreMenu('compendio');
  else fechaMenu();
}
function navegaMenu() {
  const itens = itensDoMenu();
  if (baixoE || cimaE) {
    menu.sel = (menu.sel + (baixoE ? 1 : -1) + itens.length) % itens.length;
    sfx.swing();
    renderMenu();
  }
  if (kE || escE) { voltaMenu(); return; }
  if (jE) itens[menu.sel].acao();
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
function trocaModeloJogador(f) {
  if (playerM) MD.mostra(playerM, false);
  playerM = modelosJog[f.especie];
  MD.setOpacidade(playerM, 1); MD.setEscala(playerM, 1);
  MD.flashCor(playerM, 0); playerM.g.rotation.x = 0;
  MD.setPos(playerM, batalha.p.pos); MD.mostra(playerM, true);
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
  mostraArena(cena, true);
  MD.mostra(domador, false);
  feraAtual = modelosIni[mundo.selvagem.especie];
  MD.setOpacidade(feraAtual, 1); MD.setEscala(feraAtual, 1);
  MD.flashCor(feraAtual, 0); feraAtual.g.rotation.x = 0;
  MD.setPos(feraAtual, RINGUE.fera);
  MD.encara(feraAtual, RINGUE.dom.x, RINGUE.dom.z);
  feraAtual.g.rotation.y = feraAtual.giro;
  MD.mostra(feraAtual, true);
  poof(cena, { ...RINGUE.fera, y: 0.9 }, 0xffffff, 14, 4);
  mundo.selvagem.nivel = nivelSelvagem(equipe[ativa].nivel);
  hud.nomeInimigo(especies[mundo.selvagem.especie].nome.toUpperCase(), mundo.selvagem.nivel);
  hud.escolha(true, escolha);
  hud.dica('↑/↓ escolhe · Z confirma');
  hud.toast(`Um ${especies[mundo.selvagem.especie].nome} selvagem apareceu!`);
}
function confirmaEscolha() {
  hud.escolha(false);
  if (escolha === 0) iniciaBatalha();
  else fugir();
}
function iniciaBatalha() {
  const fera = equipe[ativa];
  const inimigo = criarFera(especies, golpesCat, mundo.selvagem.especie, mundo.selvagem.nivel || NIVEL_INICIAL);
  batalha = criarBatalha(especies,
    paraBatalha(fera, especies, golpesCat),
    paraBatalha(inimigo, especies, golpesCat),
    RINGUE.dom, RINGUE.fera);
  modo = 'batalha';
  trocaModeloJogador(fera);
  hud.batalhaVisivel(true); hud.atualizaHP(batalha);
  hud.golpesPainel(linhasGolpes());
  hud.dica('Z/X/C/V = golpe · SHIFT + botão = golpe forte · 2 toques na direção = cambalhota · ESPAÇO pula · F captura · ESC menu');
  hud.toast(`${nomeDe(fera)}, eu escolho você!`);
}
function fugir() {
  hud.flash();
  musica('explorar');
  mostraArena(cena, false);
  MD.mostra(feraAtual, false); feraAtual = null;
  MD.mostra(domador, true);
  daImunidade(mundo);
  modo = 'explorar';
  hud.exploracaoVisivel(true);
  menu = { tipo: 'exploracao', sel: 0, fera: menu.fera, especie: menu.especie, ativo: false };
  renderMenu();
  hud.dica(DICA_EXPLORAR);
  hud.toast('Você fugiu em segurança!');
}
function encerraBatalha() {
  const resultado = batalha.resultado;
  const fera = equipe[ativa];
  if (fera && resultado !== 'derrota') fera.hpAtual = Math.max(1, batalha.p.hp);

  // PERMADEATH (regra: só se TODAS caírem). Fera que desmaia fica fora de
  // combate (HP 0) até ser curada; se a equipe inteira cair, perde-se tudo.
  if (resultado === 'derrota') {
    const caida = equipe[ativa];
    caida.hpAtual = 0;
    const proxIdx = equipe.findIndex((f) => f.hpAtual > 0);
    if (proxIdx >= 0) {
      hud.toast(`${nomeDe(caida)} desmaiou! Não deixe as outras caírem!`, 2400);
      ativa = proxIdx;
      const prox = equipe[proxIdx];
      continuaComOutraFera(batalha, paraBatalha(prox, especies, golpesCat), especies);
      trocaModeloJogador(prox);
      setTimeout(() => hud.toast(`Vai, ${nomeDe(prox)}! Cuidado!`, 1800), 1700);
      atualizaPainel();
      return; // a batalha segue!
    }
    hud.toast('💀 Todas as suas feras desmaiaram... e foram perdidas.', 3400);
    equipe = [];
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
    equipe.push(nova);
  }
  if (resultado === 'fuga') hud.toast('Você recuou da batalha!');
  daImunidade(mundo);
  hud.exploracaoVisivel(true);
  hud.dica(DICA_EXPLORAR);
  batalha = null; modo = 'explorar';
  menu = { tipo: 'exploracao', sel: 0, fera: menu.fera, especie: menu.especie, ativo: false };
  renderMenu();
  if (resultado === 'derrota') {
    // derrota total: acorda na vila inicial; sem feras, recebe uma nova inicial
    trocaMapa(dadosMapas.inicial);
    if (equipe.length === 0) {
      equipe = [criarFera(especies, golpesCat, 'brasinha', NIVEL_INICIAL, true)];
      ativa = 0;
      setTimeout(() => hud.toast('Você recebeu uma nova Brasinha. Cuide bem dela desta vez...', 3500), 1700);
    }
  }
  atualizaPainel();
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
}

/* ---------- sincroniza modelos com a simulação ---------- */
function sincronizaVisual(dt) {
  const d = mundo.domador;
  if (modo === 'explorar' || modo === 'titulo') {
    MD.setPos(domador, d.pos);
    MD.passoGiro(domador, dt);
    MD.animaAndar(domador, d.animT * (d.correndo ? 1.45 : 1), d.andando);
  }
  if (modo === 'encontro' && feraAtual) {
    MD.setPos(feraAtual, RINGUE.fera);
    feraAtual.g.position.y = Math.abs(Math.sin(tempo * 3)) * 0.05;
    MD.animaIdle(feraAtual, tempo);
    atualizaClips(feraAtual, null, dt);
  }
  if (holoM) { MD.animaIdle(holoM, tempo); atualizaClips(holoM, null, dt); }
  if (modo === 'batalha' && batalha && playerM) {
    MD.setPos(playerM, batalha.p.pos);
    MD.encara(playerM, batalha.e.pos.x, batalha.e.pos.z);
    MD.passoGiro(playerM, dt);
    MD.animaIdle(playerM, tempo);
    MD.animaAndarFera(playerM, tempo, batalha.p.movendo && batalha.p.estado === 'idle');
    MD.animaLuta(playerM, batalha.p);
    atualizaClips(playerM, batalha.p, dt);
    efeitoSopro(playerM, batalha.p, batalha.e.pos);
    if (batalha.p.estado === 'ko') MD.setOpacidade(playerM, Math.max(0, 1 - batalha.p.t * 1.1));
    aplicaFlash(playerM, batalha.p);

    MD.setPos(feraAtual, batalha.e.pos);
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

    if (batalha.captura) { MD.setPos(cristal, batalha.captura.pos); cristal.g.rotation.y += dt * 5; }

    // rastro de poeira da cambalhota
    if (batalha.p.estado === 'dash' && Math.random() < 0.7)
      poof(cena, { ...batalha.p.pos, y: 0.3 }, 0xcbd0d8, 2, 2);

    // projéteis em 2.5D: bola elemental animada + rastro de fagulhas; ao
    // sumir (acertou, caiu ou passou longe) estoura um impacto no lugar
    const vivos = new Set();
    for (const pr of batalha.projeteis) {
      vivos.add(pr.id);
      let e = projMeshes.get(pr.id);
      if (!e) {
        e = fx.projetil(pr.tipo, pr.rajada);
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
  if (!g.rajada && !g.projetil) return;
  const cor = CORES_TIPO[g.tipo || f.esp.tipo] || 0xffffff;
  const boca = MD.posBoca(M);
  if (f.t < g.prep) {
    if (Math.random() < 0.85)
      poof(cena, { x: boca.x, y: boca.y, z: boca.z }, cor, 2, 0.9);
  } else if (g.rajada) {
    // jato contínuo em 2.5D: línguas do elemento voam da boca ao alvo
    const dx = alvoPos.x - boca.x, dy = (alvoPos.y + 0.6) - boca.y, dz = alvoPos.z - boca.z;
    const L = Math.hypot(dx, dy, dz) || 1;
    const dir = { x: dx / L, y: dy / L, z: dz / L };
    if (Math.random() < 0.8) fx.sopro(boca, dir, g.tipo || f.esp.tipo, 11);
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
  const parado = c.parado || 'Survey', andar = c.andar || 'Walk',
        correr = c.correr || andar;
  if (f && f.estado === 'atk') {
    // recomeça o golpe a cada ataque novo (f.t zera quando o golpe inicia)
    const nome = (f.golpe && f.golpe.forte && c.forte) ? c.forte : (c.ataque || correr);
    MD.tocaClip(M, nome, 0.08, { once: !!(c.ataque || c.forte), restart: f.t < dt * 2 });
  }
  else if (f && f.estado === 'dash') MD.tocaClip(M, correr, 0.1);
  else if (f && f.estado === 'hurt') MD.tocaClip(M, c.dano || parado, 0.08, { once: !!c.dano });
  else if (f && f.estado === 'ko') MD.tocaClip(M, c.ko || c.dano || parado, 0.15, { once: !!(c.ko || c.dano) });
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
const camEncontro = { p: { pos: RINGUE.dom }, e: { pos: RINGUE.fera } };
let ultimo = performance.now();
function loop(agora) {
  requestAnimationFrame(loop);
  let dt = (agora - ultimo) / 1000; ultimo = agora;
  if (dt > 0.05) dt = 0.05;
  tempo += dt; edges();

  if (hitstop > 0) { hitstop -= dt; cena.renderer.render(cena.scene, cena.camera); return; }

  passoParticulas(cena, dt);
  fx.passo(dt);
  passoAmbiente(cena, tempo);
  hud.passoDanos(cena.camera, dt, THREE);

  if (modo === 'explorar') {
    if (menu.ativo) {
      navegaMenu();
      if (holoM) { // holograma gira e flutua
        holoM.g.rotation.y += dt * 1.6;
        holoM.g.position.y = mundo.domador.pos.y + 0.15 + Math.sin(tempo * 2) * 0.08;
      }
    }
    else if (mE) { menu.ativo = true; renderMenu(); }
    else {
      detectaCorrida();
      const inp = { mov: { x: eixo(['ArrowLeft','KeyA'], ['ArrowRight','KeyD']),
                           z: eixo(['ArrowUp','KeyW'], ['ArrowDown','KeyS']) },
                    correr: correndo };
      MD.giraDirecao(domador, inp.mov.x, inp.mov.z);
      const evt = passoMundo(mundo, inp, dt);
      if (mundo.domador.correndo && Math.random() < 0.25)
        poof(cena, { ...mundo.domador.pos, y: mundo.domador.pos.y + 0.15 }, 0xcbb28a, 1, 1.2);
      if (evt === 'encontro') iniciaEncontro();
      else if (evt === 'caverna')
        hud.toast('Uma caverna sombria... escura demais para entrar agora. (em breve!)', 3000);
      else if (evt === 'cura') {
        sfx.capturado(); hud.flash();
        for (const f of equipe) curaTotal(f, especies, golpesCat);
        atualizaPainel();
        hud.toast('❤ Enfermeira: vida e golpes de todas as feras restaurados!', 3000);
      }
      else if (evt && evt.tipo === 'porta') {
        if (evt.destino === 'retorno' && retornoPorta) {
          const r = retornoPorta; retornoPorta = null;
          trocaMapa(r.mapa, { x: r.pos.x, y: 0, z: r.pos.z });
        } else {
          retornoPorta = { mapa: chaveMapa, pos: evt.retorno };
          trocaMapa(evt.destino);
        }
      }
      else if (evt && evt.tipo === 'saida') trocaMapa(evt.saida.destino);
    }
    hud.miniMapa(mundo);
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
      const inpP = {
        mov: { x: eixo(['ArrowLeft','KeyA'], ['ArrowRight','KeyD']),
               z: eixo(['ArrowUp','KeyW'], ['ArrowDown','KeyS']) },
        pulo: spE, golpe: golpeIdx, forte, dash, capturar: fE,
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
  if (modo === 'explorar' || modo === 'titulo')
    passoOclusores(cena, [mundo.domador.pos], cena.oclusores);
  else if (modo === 'encontro')
    passoOclusores(cena, [RINGUE.fera], cena.oclusoresArena);
  else if (modo === 'batalha' && batalha)
    passoOclusores(cena, [batalha.p.pos, batalha.e.pos], cena.oclusoresArena);
  cena.renderer.render(cena.scene, cena.camera);
}
cv.focus(); setTimeout(() => cv.focus(), 300);
requestAnimationFrame(loop);
