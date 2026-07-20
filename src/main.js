// MAIN — o maestro: carrega os dados, liga a simulação (sim/) à apresentação
// (render/) e roda o loop. A simulação decide; o main traduz eventos em
// som, partículas e HUD. Nenhuma regra de jogo vive aqui.
import * as THREE from 'three';
import { criarMundo, passoMundo, daImunidade, entradaDoMapa } from './sim/mundo.js';
import { criarBatalha, passoBatalha, podeCapturar, fugirBatalha, trocaFera } from './sim/batalha.js';
import { guardaDirecao, sequenciaCompleta } from './sim/comandos.js';
import { ganhaXp, xpParaSubir, xpPorVitoria, nivelSelvagem, NIVEL_INICIAL } from './sim/progressao.js';
import { criarCena, poof, passoParticulas, passoCamera, mostraArena, montaMapa, passoOclusores } from './render/cena.js';
import * as MD from './render/modelos.js';
import { criarHUD } from './render/hud.js';
import { audioInit, sfx } from './render/audio.js';

const especies = await (await fetch('./src/dados/especies.json')).json();
const dadosMapas = await (await fetch('./src/dados/mapas.json')).json();

const cv = document.getElementById('cv');
const cena = criarCena(cv);
const hud = criarHUD();

// modelos 3D: um conjunto para a fera do jogador e outro para a selvagem
// (assim a mesma espécie pode aparecer dos dois lados do ringue)
const domador = MD.criarDomador(cena.scene);
const modelosJog = {}, modelosIni = {};
for (const k of Object.keys(especies)) {
  modelosJog[k] = MD.criarFera(cena.scene, k); MD.mostra(modelosJog[k], false);
  modelosIni[k] = MD.criarFera(cena.scene, k); MD.mostra(modelosIni[k], false);
}
const cristal = MD.criarCristal(cena.scene); MD.mostra(cristal, false);

// posições de largada no ringue (a arena visual é centrada na origem)
const RINGUE = { dom: { x: -5, y: 0, z: 0 }, fera: { x: 3.5, y: 0, z: 0 } };
const DICA_EXPLORAR = 'Setas: andar (2 toques = correr) · M abre o menu';
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
hud.localAtual(mundo.mapa.nome);

let equipe = [{ especie: 'brasinha', nivel: NIVEL_INICIAL, xp: 0 }];
let ativa = 0; // índice da fera ativa na equipe
hud.nomeJogador(especies.brasinha.nome, equipe[0].nivel);
hud.mapaRegiao(dadosMapas, chaveMapa);
let batalha = null;
let playerM = null;   // modelo da fera do jogador em batalha
let feraAtual = null; // modelo da fera selvagem em cena (encontro/batalha)
let escolha = 0;      // menu do encontro: 0 = lutar, 1 = fugir
let menu = null;      // menu aberto: { tipo, sel } | null
let retornoPorta = null; // para onde voltar ao sair de um interior
let hitstop = 0, tempo = 0;

/* ---------- entrada (padrão: setas + Z/X/C; WASD e J/K seguem como extras) */
const keys = {};
let jE = false, kE = false, cE = false, spE = false, pJ = false, pK = false, pC = false, pS = false;
let cimaE = false, baixoE = false, pCima = false, pBaixo = false;
let mE = false, escE = false, pM = false, pEsc = false;
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
  const M = keys.KeyM, ESC = keys.Escape;
  mE = M && !pM; escE = ESC && !pEsc;
  pM = M; pEsc = ESC;
}
const eixo = (neg, pos) => (keys[pos[0]] || keys[pos[1]] ? 1 : 0) - (keys[neg[0]] || keys[neg[1]] ? 1 : 0);

/* corrida: dois toques rápidos na mesma direção e segurar o segundo
   (vale na exploração e dentro da arena) */
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

/* ---------- golpes de comando: buffer de sequências direcionais ---------- */
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
      poof(cena, evt.pos, CORES_TIPO[evt.elemento] || 0xffffff, 12, 3.2); break;
    case 'cristalVoa': sfx.cristalVoa(); MD.mostra(cristal, true); break;
    case 'cristalSuga': poof(cena, evt.pos, 0x59e0d0, 14, 4); break;
    case 'cristalTreme': sfx.cristalTreme(); break;
    case 'capturado': sfx.capturado(); hitstop = 0.15;
      hud.toast(`${batalha.e.esp.nome} foi capturado! ${premiaXp()}`); break;
    case 'escapou': MD.mostra(cristal, false);
      hud.toast(`Ah, quase! O ${batalha.e.esp.nome} escapou do cristal!`); break;
    case 'vitoria': sfx.vitoria(); hitstop = 0.22;
      hud.toast(`${batalha.e.esp.nome} desmaiou! ${premiaXp()}`); break;
    case 'derrota': sfx.derrota(); hitstop = 0.22;
      hud.toast(`${batalha.p.esp.nome} desmaiou... Você correu de volta.`); break;
  }
}

/* ---------- XP e nível (regras em sim/progressao.js) ---------- */
function premiaXp() {
  const fera = equipe[ativa];
  const ganho = xpPorVitoria(batalha.e.nivel);
  const subiu = ganhaXp(fera, ganho);
  hud.xp(fera.xp / xpParaSubir(fera.nivel));
  hud.nomeJogador(especies[fera.especie].nome, fera.nivel);
  if (subiu > 0) {
    setTimeout(() => {
      sfx.vitoria();
      hud.toast(`⬆ ${especies[fera.especie].nome} subiu para o nível ${fera.nivel}!`, 2600);
    }, 1500);
  }
  return `+${ganho} XP`;
}

/* ---------- menus (exploração e batalha) ---------- */
const TITULO_MENU = { exploracao: 'MENU', batalha: 'BATALHA', equipeExp: 'EQUIPE', equipeBat: 'TROCAR FERA' };
function itensMenu() {
  if (menu.tipo === 'exploracao') return ['Equipe', 'Itens', 'Carteira', 'Insígnias', 'Fechar'];
  if (menu.tipo === 'batalha') return ['Continuar', 'Trocar Fera', 'Itens', 'Fugir'];
  return equipe.map((f, i) => especies[f.especie].nome + (i === ativa ? ' ◆' : ''));
}
function abreMenu(tipo) {
  menu = { tipo, sel: 0 };
  hud.menu(true, TITULO_MENU[tipo], itensMenu(), 0);
}
function fechaMenu() { menu = null; hud.menu(false); }
function navegaMenu() {
  const itens = itensMenu();
  if (baixoE || cimaE) {
    menu.sel = (menu.sel + (baixoE ? 1 : -1) + itens.length) % itens.length;
    sfx.swing();
    hud.menu(true, TITULO_MENU[menu.tipo], itens, menu.sel);
  }
  if (kE || escE) {
    if (menu.tipo === 'equipeExp') abreMenu('exploracao');
    else if (menu.tipo === 'equipeBat') abreMenu('batalha');
    else fechaMenu();
    return;
  }
  if (!jE) return;
  const s = menu.sel;
  if (menu.tipo === 'exploracao') {
    if (s === 0) abreMenu('equipeExp');
    else if (s === 1) hud.toast('Itens: em breve!');
    else if (s === 2) hud.toast('Carteira: 0 moedas (economia em breve)');
    else if (s === 3) hud.toast('Insígnias: nenhuma ainda');
    else fechaMenu();
  } else if (menu.tipo === 'batalha') {
    if (s === 0) fechaMenu();
    else if (s === 1) abreMenu('equipeBat');
    else if (s === 2) hud.toast('Itens: em breve!');
    else { fechaMenu(); fugirBatalha(batalha); }
  } else if (menu.tipo === 'equipeExp') {
    ativa = s;
    hud.nomeJogador(especies[equipe[s].especie].nome, equipe[s].nivel);
    hud.toast(`${especies[equipe[s].especie].nome} agora é a fera ativa!`);
    abreMenu('exploracao');
  } else if (menu.tipo === 'equipeBat') {
    if (s === ativa) { hud.toast('Essa fera já está na arena!'); return; }
    ativa = s;
    const chave = equipe[s].especie;
    trocaFera(batalha, chave, equipe[s].nivel, especies);
    MD.mostra(playerM, false);
    playerM = modelosJog[chave];
    MD.setOpacidade(playerM, 1); MD.setEscala(playerM, 1);
    MD.setPos(playerM, batalha.p.pos); MD.mostra(playerM, true);
    poof(cena, { ...batalha.p.pos, y: 0.9 }, 0xffd23f, 14, 4);
    hud.nomeJogador(especies[chave].nome, equipe[s].nivel);
    hud.xp(equipe[s].xp / xpParaSubir(equipe[s].nivel));
    hud.atualizaHP(batalha);
    hud.toast(`Vai, ${especies[chave].nome}!`);
    fechaMenu();
  }
}

/* ---------- transições ---------- */
function iniciaEncontro() {
  sfx.encontro(); hud.flash();
  modo = 'encontro'; escolha = 0;
  hud.exploracaoVisivel(false);
  mostraArena(cena, true);
  MD.mostra(domador, false);
  feraAtual = modelosIni[mundo.selvagem.especie];
  // zera qualquer resíduo da última luta (flash branco, pose, escala)
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
  const chaveJog = fera.especie;
  const chave = mundo.selvagem.especie;
  batalha = criarBatalha(especies,
    { chave: chaveJog, nivel: fera.nivel },
    { chave, nivel: mundo.selvagem.nivel || NIVEL_INICIAL },
    RINGUE.dom, RINGUE.fera);
  modo = 'batalha';
  playerM = modelosJog[chaveJog];
  MD.setOpacidade(playerM, 1); MD.setEscala(playerM, 1);
  MD.flashCor(playerM, 0); playerM.g.rotation.x = 0;
  MD.setPos(playerM, batalha.p.pos); MD.mostra(playerM, true);
  poof(cena, { ...batalha.p.pos, y: 0.9 }, 0xffd23f, 14, 4);
  hud.nomeJogador(especies[chaveJog].nome, fera.nivel);
  hud.xp(fera.xp / xpParaSubir(fera.nivel));
  hud.batalhaVisivel(true); hud.atualizaHP(batalha);
  seqBuf = [];
  const c1 = batalha.p.esp.golpes.comando1;
  const seqTxt = c1 ? ` · ${c1.sequencia.map((d) => SIMBOLO[d]).join('')}+Z ${c1.nome}` : '';
  const esp = batalha.p.esp.golpes.especial;
  hud.dica(`Setas movem (2 toques corre) · ESPAÇO pula · Z golpe · X ${esp.nome || 'especial'}${seqTxt} · C captura · ESC menu`);
  hud.toast(`${especies[chaveJog].nome}, eu escolho você!`);
}
function fugir() {
  hud.flash();
  mostraArena(cena, false);
  MD.mostra(feraAtual, false); feraAtual = null;
  MD.mostra(domador, true);
  daImunidade(mundo);
  modo = 'explorar';
  hud.exploracaoVisivel(true);
  hud.dica(DICA_EXPLORAR);
  hud.toast('Você fugiu em segurança!');
}
function encerraBatalha() {
  hud.flash();
  fechaMenu();
  mostraArena(cena, false);
  limpaProjeteis();
  if (playerM) { MD.mostra(playerM, false); playerM = null; }
  MD.mostra(cristal, false);
  if (feraAtual) { MD.mostra(feraAtual, false); feraAtual = null; }
  MD.mostra(domador, true);
  hud.batalhaVisivel(false);
  if (batalha.resultado === 'captura') {
    equipe.push({ especie: batalha.e.chave, nivel: batalha.e.nivel, xp: 0 });
    hud.equipe(equipe.length);
  }
  if (batalha.resultado === 'derrota')
    mundo.domador.pos = { x: mundo.mapa.spawn.x, y: 0, z: mundo.mapa.spawn.z };
  if (batalha.resultado === 'fuga') hud.toast('Você recuou da batalha!');
  daImunidade(mundo);
  hud.exploracaoVisivel(true);
  hud.dica(DICA_EXPLORAR);
  batalha = null; modo = 'explorar';
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
  // câmera corta seco para o novo mapa (sem voar pelo cenário antigo)
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
  }
  if (modo === 'batalha' && batalha && playerM) {
    MD.setPos(playerM, batalha.p.pos);
    MD.encara(playerM, batalha.e.pos.x, batalha.e.pos.z);
    MD.passoGiro(playerM, dt);
    MD.animaLuta(playerM, batalha.p);
    if (batalha.p.estado === 'ko') MD.setOpacidade(playerM, Math.max(0, 1 - batalha.p.t * 1.1));
    aplicaFlash(playerM, batalha.p);

    MD.setPos(feraAtual, batalha.e.pos);
    MD.encara(feraAtual, batalha.p.pos.x, batalha.p.pos.z);
    MD.passoGiro(feraAtual, dt);
    MD.animaLuta(feraAtual, batalha.e);
    if (batalha.e.estado === 'ko') MD.setOpacidade(feraAtual, Math.max(0, 1 - batalha.e.t * 1.1));
    if (batalha.captura && batalha.captura.escalaFera !== undefined)
      MD.setEscala(feraAtual, batalha.captura.escalaFera);
    // durante a captura a fera fica "congelada": sem flash de carga
    if (batalha.captura) MD.flashCor(feraAtual, 0);
    else aplicaFlash(feraAtual, batalha.e);

    if (batalha.captura) { MD.setPos(cristal, batalha.captura.pos); cristal.g.rotation.y += dt * 5; }

    // projéteis: cria/move/remove os modelos conforme a sim
    const vivos = new Set();
    for (const pr of batalha.projeteis) {
      vivos.add(pr.id);
      let M = projMeshes.get(pr.id);
      if (!M) { M = MD.criarProjetil(cena.scene, CORES_TIPO[pr.tipo] || 0xffffff); projMeshes.set(pr.id, M); }
      MD.setPos(M, pr.pos);
      M.g.rotation.y += dt * 9;
      if (Math.random() < 0.8) poof(cena, pr.pos, CORES_TIPO[pr.tipo] || 0xffffff, 1, 1.6);
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
    if (menu) navegaMenu();
    else if (mE || escE) abreMenu('exploracao');
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
        hud.toast('❤ Enfermeira: suas feras estão renovadas! Volte sempre!', 2800);
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
    if (menu) navegaMenu();
    else if (escE || mE) abreMenu('batalha');
    else {
      detectaCorrida();
      guardaDirecoes();
      const seqC1 = batalha.p.esp.golpes.comando1 && batalha.p.esp.golpes.comando1.sequencia;
      let c1 = false;
      if (jE && sequenciaCompleta(seqBuf, seqC1, tempo)) {
        c1 = true; seqBuf = [];
      }
      const inpP = {
        mov: { x: eixo(['ArrowLeft','KeyA'], ['ArrowRight','KeyD']),
               z: eixo(['ArrowUp','KeyW'], ['ArrowDown','KeyS']) },
        pulo: spE, a: jE && !c1, f: kE, c1, correr: correndo, capturar: cE,
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
  // o que tapar o personagem (ou as feras na arena) vira "vidro"
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
