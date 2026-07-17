// MAIN — o maestro: carrega os dados, liga a simulação (sim/) à apresentação
// (render/) e roda o loop. A simulação decide; o main traduz eventos em
// som, partículas e HUD. Nenhuma regra de jogo vive aqui.
import * as THREE from 'three';
import { criarMundo, passoMundo, daImunidade, entradaDoMapa } from './sim/mundo.js';
import { criarBatalha, passoBatalha, podeCapturar } from './sim/batalha.js';
import { guardaDirecao, sequenciaCompleta } from './sim/comandos.js';
import { criarCena, poof, passoParticulas, passoCamera, mostraArena, montaMapa } from './render/cena.js';
import * as MD from './render/modelos.js';
import { criarHUD } from './render/hud.js';
import { audioInit, sfx } from './render/audio.js';

const especies = await (await fetch('./src/dados/especies.json')).json();
const dadosMapas = await (await fetch('./src/dados/mapas.json')).json();

const cv = document.getElementById('cv');
const cena = criarCena(cv);
const hud = criarHUD();

// modelos 3D (low-poly chibi)
const domador = MD.criarDomador(cena.scene);
const brasinha = MD.criarFera(cena.scene, 'brasinha'); MD.mostra(brasinha, false);
const feras = {};
for (const k of Object.keys(especies))
  if (especies[k].selvagem) { feras[k] = MD.criarFera(cena.scene, k); MD.mostra(feras[k], false); }
const cristal = MD.criarCristal(cena.scene); MD.mostra(cristal, false);

// posições de largada no ringue (a arena visual é centrada na origem)
const RINGUE = { dom: { x: -5, y: 0, z: 0 }, fera: { x: 3.5, y: 0, z: 0 } };
const DICA_EXPLORAR = 'Setas: andar (2 toques = correr) · explore a grama alta';
// cor dos efeitos elementais por tipo de fera
const CORES_TIPO = { fogo: 0xff8a3d, eletrico: 0xffe94d, agua: 0x4da3ff, planta: 0x5fd35a, comum: 0xcbd0d8 };
const projMeshes = new Map(); // id do projétil (sim) -> modelo 3D

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
let batalha = null;
let feraAtual = null; // modelo da fera selvagem em cena (encontro/batalha)
let escolha = 0;      // menu do encontro: 0 = lutar, 1 = fugir
let hitstop = 0, tempo = 0, capturadas = 1;

/* ---------- entrada (padrão: setas + Z/X/C; WASD e J/K seguem como extras) */
const keys = {};
let jE = false, kE = false, cE = false, spE = false, pJ = false, pK = false, pC = false, pS = false;
let cimaE = false, baixoE = false, pCima = false, pBaixo = false;
addEventListener('keydown', (e) => {
  audioInit(); keys[e.code] = true;
  if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.code === 'Enter' && modo === 'titulo') {
    hud.escondeTitulo(); modo = 'explorar'; cv.focus();
    hud.toast('Explore a grama alta... dizem que feras selvagens vivem escondidas nela!');
    hud.dica(DICA_EXPLORAR);
  }
});
addEventListener('keyup', (e) => keys[e.code] = false);
cv.addEventListener('pointerdown', () => { audioInit(); cv.focus(); });
function edges() {
  const J = keys.KeyZ || keys.KeyJ, K = keys.KeyX || keys.KeyK,
        C = keys.KeyC || keys.KeyL, S = keys.Space;
  jE = J && !pJ; kE = K && !pK; cE = C && !pC; spE = S && !pS;
  pJ = J; pK = K; pC = C; pS = S;
  const CIMA = keys.ArrowUp || keys.KeyW, BAIXO = keys.ArrowDown || keys.KeyS;
  cimaE = CIMA && !pCima; baixoE = BAIXO && !pBaixo;
  pCima = CIMA; pBaixo = BAIXO;
}
const eixo = (neg, pos) => (keys[pos[0]] || keys[pos[1]] ? 1 : 0) - (keys[neg[0]] || keys[neg[1]] ? 1 : 0);

/* corrida: dois toques rápidos na mesma direção e segurar o segundo */
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

/* ---------- golpes de comando: buffer de sequências direcionais ----------
   O main só CAPTURA as teclas e envia o input abstrato c1; o matching é da
   lógica pura em sim/comandos.js e a execução é da batalha. Direções
   relativas ao lock-on: frente = ↑ (aproximar), baixo = ↓ — notação de
   fighting game: ↓→ = seta baixo, seta cima. */
const SIMBOLO = { baixo: '↓', frente: '→' };
let seqBuf = [];
function guardaDirecoes() {
  if (baixoE) guardaDirecao(seqBuf, 'baixo', tempo);
  if (cimaE) guardaDirecao(seqBuf, 'frente', tempo);
}

/* ---------- eventos da simulação -> apresentação ---------- */
function aoEvento(evt) {
  switch (evt.tipo) {
    case 'hit': sfx.hit(); cena.shake = 0.28; hitstop = 0.05;
      poof(cena, { ...evt.pos, y: evt.pos.y + 1 }, 0xffd23f, 12, 4.5);
      hud.dano(evt.pos, evt.dano, false); break;
    case 'hitForte': sfx.hitForte(); cena.shake = 0.5; hitstop = 0.09;
      poof(cena, { ...evt.pos, y: evt.pos.y + 1 }, 0xff6b4a, 12, 4.5);
      hud.dano(evt.pos, evt.dano, true); break;
    case 'rastroFogo': if (Math.random() < 0.5)
      poof(cena, evt.pos, Math.random() < 0.5 ? 0xff8a3d : 0xffd93b, 2, 2.5); break;
    case 'pulo': sfx.pulo(); break;
    case 'swing': sfx.swing(); break;
    case 'especial': sfx.especial(); break;
    case 'comando': sfx.especial(); cena.shake = 0.22;
      poof(cena, { ...evt.pos, y: 1 }, 0xffffff, 8, 3.5);
      hud.toast(`${evt.nome}!`, 900); break;
    case 'projetil': sfx.swing();
      poof(cena, evt.pos, CORES_TIPO[evt.elemento] || 0xffffff, 8, 3); break;
    case 'cristalVoa': sfx.cristalVoa(); MD.mostra(cristal, true); break;
    case 'cristalSuga': poof(cena, evt.pos, 0x59e0d0, 14, 4); break;
    case 'cristalTreme': sfx.cristalTreme(); break;
    case 'capturado': sfx.capturado(); hitstop = 0.15;
      hud.toast(`${batalha.e.esp.nome} foi capturado! Entrou para a sua equipe!`); break;
    case 'escapou': MD.mostra(cristal, false);
      hud.toast(`Ah, quase! O ${batalha.e.esp.nome} escapou do cristal!`); break;
    case 'vitoria': sfx.vitoria(); hitstop = 0.22;
      hud.toast(`${batalha.e.esp.nome} selvagem desmaiou! Você venceu!`); break;
    case 'derrota': sfx.derrota(); hitstop = 0.22;
      hud.toast('Brasinha desmaiou... Você correu de volta.'); break;
  }
}

/* ---------- transições ---------- */
// encontro: corta para a arena, mostra a fera e pergunta Lutar/Fugir
function iniciaEncontro() {
  sfx.encontro(); hud.flash();
  modo = 'encontro'; escolha = 0;
  mostraArena(cena, true);
  MD.mostra(domador, false);
  feraAtual = feras[mundo.selvagem.especie];
  MD.setOpacidade(feraAtual, 1); MD.setEscala(feraAtual, 1);
  MD.setPos(feraAtual, RINGUE.fera);
  MD.encara(feraAtual, RINGUE.dom.x, RINGUE.dom.z);
  feraAtual.g.rotation.y = feraAtual.giro;
  MD.mostra(feraAtual, true);
  poof(cena, { ...RINGUE.fera, y: 0.9 }, 0xffffff, 14, 4);
  hud.nomeInimigo(especies[mundo.selvagem.especie].nome.toUpperCase());
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
  const chave = mundo.selvagem.especie;
  batalha = criarBatalha(especies, chave, RINGUE.dom, RINGUE.fera);
  modo = 'batalha';
  MD.mostra(brasinha, true); MD.setOpacidade(brasinha, 1);
  MD.setPos(brasinha, batalha.p.pos);
  poof(cena, { ...batalha.p.pos, y: 0.9 }, 0xffd23f, 14, 4);
  hud.batalhaVisivel(true); hud.atualizaHP(batalha);
  seqBuf = [];
  const c1 = batalha.p.esp.golpes.comando1;
  const seqTxt = c1 ? ` · ${c1.sequencia.map((d) => SIMBOLO[d]).join('')}+Z ${c1.nome}` : '';
  hud.dica(`↑/↓ aproxima-afasta · ←/→ orbita · ESPAÇO pula · Z golpe · X especial${seqTxt} · C captura`);
  hud.toast('Brasinha, eu escolho você!');
}
// passagem entre mapas: recria a sim no destino e remonta o cenário
function trocaMapa(destino) {
  hud.flash();
  const origem = chaveMapa;
  chaveMapa = destino;
  mundo = novoMundo(destino);
  mundo.domador.pos = entradaDoMapa(mundo.mapa, origem);
  daImunidade(mundo, 1.2);
  montaMapa(cena, mundo.mapa);
  // câmera corta seco para o novo mapa (sem voar pelo cenário antigo)
  const pp = mundo.domador.pos;
  cena.camPos.set(pp.x, pp.y + 17, pp.z + 12);
  cena.camAlvo.set(pp.x, 0.8, pp.z);
  hud.toast(`— ${mundo.mapa.nome} —`, 1800);
}
function fugir() {
  hud.flash();
  mostraArena(cena, false);
  MD.mostra(feraAtual, false); feraAtual = null;
  MD.mostra(domador, true);
  daImunidade(mundo);
  modo = 'explorar';
  hud.dica(DICA_EXPLORAR);
  hud.toast('Você fugiu em segurança!');
}
function encerraBatalha() {
  hud.flash();
  mostraArena(cena, false);
  limpaProjeteis();
  MD.mostra(brasinha, false); MD.mostra(cristal, false);
  if (feraAtual) { MD.mostra(feraAtual, false); feraAtual = null; }
  MD.mostra(domador, true);
  hud.batalhaVisivel(false);
  if (batalha.resultado === 'vitoria' || batalha.resultado === 'captura') {
    mundo.selvagem.vivo = false; mundo.respawnT = 10;
    if (batalha.resultado === 'captura') { capturadas++; hud.equipe(capturadas); }
  } else {
    mundo.domador.pos = { x: mundo.mapa.spawn.x, y: 0, z: mundo.mapa.spawn.z };
  }
  daImunidade(mundo);
  hud.dica(DICA_EXPLORAR);
  batalha = null; modo = 'explorar';
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
    // respiração da fera enquanto o jogador decide
    MD.setPos(feraAtual, RINGUE.fera);
    feraAtual.g.position.y = Math.abs(Math.sin(tempo * 3)) * 0.05;
  }
  if (modo === 'batalha' && batalha) {
    MD.setPos(brasinha, batalha.p.pos);
    MD.encara(brasinha, batalha.e.pos.x, batalha.e.pos.z);
    MD.passoGiro(brasinha, dt);
    if (batalha.p.estado === 'ko') MD.setOpacidade(brasinha, Math.max(0, 1 - batalha.p.t * 1.1));
    aplicaFlash(brasinha, batalha.p);

    MD.setPos(feraAtual, batalha.e.pos);
    MD.encara(feraAtual, batalha.p.pos.x, batalha.p.pos.z);
    MD.passoGiro(feraAtual, dt);
    if (batalha.e.estado === 'ko') MD.setOpacidade(feraAtual, Math.max(0, 1 - batalha.e.t * 1.1));
    if (batalha.captura && batalha.captura.escalaFera !== undefined)
      MD.setEscala(feraAtual, batalha.captura.escalaFera);
    aplicaFlash(feraAtual, batalha.e);

    if (batalha.captura) { MD.setPos(cristal, batalha.captura.pos); cristal.g.rotation.y += dt * 5; }

    // projéteis: cria/move/remove os modelos conforme a sim
    const vivos = new Set();
    for (const pr of batalha.projeteis) {
      vivos.add(pr.id);
      let M = projMeshes.get(pr.id);
      if (!M) { M = MD.criarProjetil(cena.scene, CORES_TIPO[pr.tipo] || 0xffffff); projMeshes.set(pr.id, M); }
      MD.setPos(M, pr.pos);
      M.g.rotation.y += dt * 9;
      if (Math.random() < 0.45) poof(cena, pr.pos, CORES_TIPO[pr.tipo] || 0xffffff, 1, 1.4);
    }
    for (const [id, M] of projMeshes)
      if (!vivos.has(id)) { cena.scene.remove(M.g); projMeshes.delete(id); }
  }
}
function limpaProjeteis() {
  for (const [, M] of projMeshes) cena.scene.remove(M.g);
  projMeshes.clear();
}
function aplicaFlash(M, f) {
  if (f.flash > 0) MD.flashCor(M, f.flash > 0.5 ? 0xffffff : 0xff5533);
  else if (f.estado === 'atk' && f.golpe && f.golpe.forte && f.t < f.golpe.prep)
    MD.flashCor(M, Math.sin(tempo * 40) > 0 ? 0xffffff : 0xff5533);
  else MD.flashCor(M, 0);
}

/* ---------- loop ---------- */
// câmera do encontro: mesmo enquadramento da batalha, com posições fixas
const camEncontro = { p: { pos: RINGUE.dom }, e: { pos: RINGUE.fera } };
let ultimo = performance.now();
function loop(agora) {
  requestAnimationFrame(loop);
  let dt = (agora - ultimo) / 1000; ultimo = agora;
  if (dt > 0.05) dt = 0.05;
  tempo += dt; edges();

  if (hitstop > 0) { hitstop -= dt; cena.renderer.render(cena.scene, cena.camera); return; }

  passoParticulas(cena, dt);
  hud.passoDanos(cena.camera, dt, THREE);

  if (modo === 'explorar') {
    detectaCorrida();
    const inp = { mov: { x: eixo(['ArrowLeft','KeyA'], ['ArrowRight','KeyD']),
                         z: eixo(['ArrowUp','KeyW'], ['ArrowDown','KeyS']) },
                  correr: correndo };
    MD.giraDirecao(domador, inp.mov.x, inp.mov.z);
    const evt = passoMundo(mundo, inp, dt);
    if (mundo.domador.correndo && Math.random() < 0.25)
      poof(cena, { ...mundo.domador.pos, y: 0.15 }, 0xcbb28a, 1, 1.2);
    if (evt === 'encontro') iniciaEncontro();
    else if (evt === 'respawn') hud.toast('Algo farfalha na grama alta...');
    else if (evt && evt.tipo === 'saida') trocaMapa(evt.saida.destino);
  } else if (modo === 'encontro') {
    if (cimaE || baixoE) { escolha = 1 - escolha; hud.escolha(true, escolha); sfx.swing(); }
    if (jE) confirmaEscolha();
  } else if (modo === 'batalha' && batalha) {
    guardaDirecoes();
    const seqC1 = batalha.p.esp.golpes.comando1 && batalha.p.esp.golpes.comando1.sequencia;
    let c1 = false;
    if (jE && sequenciaCompleta(seqBuf, seqC1, tempo)) {
      c1 = true; seqBuf = [];
    }
    const inpP = {
      mov: { x: eixo(['ArrowLeft','KeyA'], ['ArrowRight','KeyD']),
             z: eixo(['ArrowUp','KeyW'], ['ArrowDown','KeyS']) },
      pulo: spE, a: jE && !c1, f: kE, c1, capturar: cE,
    };
    const fim = passoBatalha(batalha, inpP, dt, aoEvento);
    hud.atualizaHP(batalha);
    hud.capDisponivel(podeCapturar(batalha));
    if (fim === 'encerrar') encerraBatalha();
  }

  sincronizaVisual(dt);
  passoCamera(cena, modo === 'encontro' ? 'batalha' : modo, mundo,
              modo === 'encontro' ? camEncontro : batalha, dt);
  cena.renderer.render(cena.scene, cena.camera);
}
cv.focus(); setTimeout(() => cv.focus(), 300);
requestAnimationFrame(loop);
