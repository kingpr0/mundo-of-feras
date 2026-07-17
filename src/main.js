// MAIN — o maestro: carrega os dados, liga a simulação (sim/) à apresentação
// (render/) e roda o loop. A simulação decide; o main traduz eventos em
// som, partículas e HUD. Nenhuma regra de jogo vive aqui.
import * as THREE from 'three';
import { criarMundo, passoMundo, MUNDO_LAYOUT } from './sim/mundo.js';
import { criarBatalha, passoBatalha, podeCapturar } from './sim/batalha.js';
import { criarCena, poof, passoParticulas, passoCamera } from './render/cena.js';
import { TEX, QUADROS_ANDAR, fazSprite, trocaTex, billboard, setPos } from './render/sprites.js';
import { criarHUD } from './render/hud.js';
import { audioInit, sfx } from './render/audio.js';

const especies = await (await fetch('./src/dados/especies.json')).json();

const cv = document.getElementById('cv');
const cena = criarCena(cv);
const hud = criarHUD();

const domador = fazSprite(cena.scene, TEX.pParado, 1.5);
const brasinha = fazSprite(cena.scene, TEX.brasinha, 1.7); brasinha.g.visible = false;
const selvagem = fazSprite(cena.scene, TEX.cascorro, 1.8);
selvagem.g.visible = false; // feras selvagens só aparecem quando a luta começa (suspense)
const cristal = fazSprite(cena.scene, TEX.cristal, 0.55, false); cristal.g.visible = false;

/* ---------- estado ---------- */
let modo = 'titulo'; // titulo | explorar | batalha
const chavesSelvagens = Object.keys(especies).filter((k) => especies[k].selvagem);
let mundo = criarMundo(chavesSelvagens);
let batalha = null;
let hitstop = 0, tempo = 0, capturadas = 1;

/* ---------- entrada ---------- */
const keys = {};
let jE = false, kE = false, cE = false, spE = false, pJ = false, pK = false, pC = false, pS = false;
addEventListener('keydown', (e) => {
  audioInit(); keys[e.code] = true;
  if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.code === 'Enter' && modo === 'titulo') {
    hud.escondeTitulo(); modo = 'explorar'; cv.focus();
    hud.toast('Explore a grama alta... dizem que feras selvagens vivem escondidas nela!');
  }
});
addEventListener('keyup', (e) => keys[e.code] = false);
cv.addEventListener('pointerdown', () => { audioInit(); cv.focus(); });
function edges() {
  const J = keys.KeyJ || keys.KeyZ, K = keys.KeyK || keys.KeyX,
        C = keys.KeyC || keys.KeyL, S = keys.Space;
  jE = J && !pJ; kE = K && !pK; cE = C && !pC; spE = S && !pS;
  pJ = J; pK = K; pC = C; pS = S;
}
const eixo = (neg, pos) => (keys[pos[0]] || keys[pos[1]] ? 1 : 0) - (keys[neg[0]] || keys[neg[1]] ? 1 : 0);

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
    case 'cristalVoa': sfx.cristalVoa(); cristal.g.visible = true; break;
    case 'cristalSuga': poof(cena, evt.pos, 0x59e0d0, 14, 4); break;
    case 'cristalTreme': sfx.cristalTreme(); break;
    case 'capturado': sfx.capturado(); hitstop = 0.15;
      hud.toast(`${batalha.e.esp.nome} foi capturado! Entrou para a sua equipe!`); break;
    case 'escapou': cristal.g.visible = false;
      hud.toast(`Ah, quase! O ${batalha.e.esp.nome} escapou do cristal!`); break;
    case 'vitoria': sfx.vitoria(); hitstop = 0.22;
      hud.toast(`${batalha.e.esp.nome} selvagem desmaiou! Você venceu!`); break;
    case 'derrota': sfx.derrota(); hitstop = 0.22;
      hud.toast('Brasinha desmaiou... Você correu de volta.'); break;
  }
}

/* ---------- transições ---------- */
function iniciaBatalha() {
  sfx.encontro(); hud.flash();
  const chave = mundo.selvagem.especie;
  batalha = criarBatalha(especies, chave, mundo.domador.pos, mundo.selvagem.pos);
  modo = 'batalha';
  brasinha.g.visible = true; brasinha.mat.opacity = 1; brasinha.mat.transparent = true;
  trocaTex(selvagem, TEX[chave]);
  selvagem.g.visible = true; selvagem.mat.opacity = 1; selvagem.g.scale.setScalar(1);
  poof(cena, { ...batalha.p.pos, y: 0.9 }, 0xffd23f, 14, 4);
  poof(cena, { ...batalha.e.pos, y: 0.9 }, 0xffffff, 14, 4); // a fera se revela
  hud.nomeInimigo(especies[chave].nome.toUpperCase());
  hud.batalhaVisivel(true); hud.atualizaHP(batalha);
  hud.toast(`Um ${especies[chave].nome} selvagem apareceu! Brasinha, eu escolho você!`);
}
function encerraBatalha() {
  hud.flash();
  brasinha.g.visible = false;
  cristal.g.visible = false;
  hud.batalhaVisivel(false);
  if (batalha.resultado === 'vitoria' || batalha.resultado === 'captura') {
    mundo.selvagem.vivo = false; mundo.respawnT = 10;
    if (batalha.resultado === 'captura') { capturadas++; hud.equipe(capturadas); }
  } else {
    mundo.domador.pos = { ...MUNDO_LAYOUT.spawnDomador };
  }
  selvagem.g.visible = false; // volta a ficar escondida na exploração
  batalha = null; modo = 'explorar';
}

/* ---------- sincroniza sprites com a simulação ---------- */
function sincronizaVisual(dt) {
  // domador
  const d = mundo.domador;
  if (modo === 'batalha' && batalha) {
    // caminha até o canto e assiste
    const dx = batalha.domadorAlvo.x - d.pos.x, dz = batalha.domadorAlvo.z - d.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 0.15) {
      d.pos.x += dx / dist * 3 * dt; d.pos.z += dz / dist * 3 * dt;
      d.animT += dt;
      trocaTex(domador, QUADROS_ANDAR[Math.floor(d.animT * 8) % 4]);
    } else trocaTex(domador, TEX.pFrente);
  } else if (d.andando) {
    trocaTex(domador, d.frente ? TEX.pFrente : QUADROS_ANDAR[Math.floor(d.animT * 8) % 4]);
  } else trocaTex(domador, TEX.pParado);
  setPos(domador, d.pos);
  billboard(domador, cena.camera, d.dir < 0 && !d.frente && modo !== 'batalha');

  // selvagem
  const s = mundo.selvagem;
  if (modo === 'batalha' && batalha) {
    setPos(selvagem, batalha.e.pos);
    if (batalha.e.estado === 'ko') {
      selvagem.mat.opacity = Math.max(0, 1 - batalha.e.t * 1.1);
    }
    if (batalha.captura && batalha.captura.escalaFera !== undefined)
      selvagem.g.scale.setScalar(batalha.captura.escalaFera);
    aplicaFlash(selvagem, batalha.e);
    setPos(cristal, batalha.captura ? batalha.captura.pos : { x: 0, y: -5, z: 0 });
    billboard(cristal, cena.camera);
  } else {
    // na exploração a fera existe na sim, mas não é desenhada (encontro surpresa)
    selvagem.g.visible = false;
  }
  billboard(selvagem, cena.camera, false);

  // brasinha
  if (modo === 'batalha' && batalha) {
    setPos(brasinha, batalha.p.pos);
    if (batalha.p.estado === 'ko')
      brasinha.mat.opacity = Math.max(0, 1 - batalha.p.t * 1.1);
    aplicaFlash(brasinha, batalha.p);
    billboard(brasinha, cena.camera);
  }
}
function aplicaFlash(spr, f) {
  if (f.flash > 0) spr.mat.color.setHex(f.flash > 0.5 ? 0xffffff : 0xff8888);
  else if (f.estado === 'atk' && f.golpe && f.golpe.forte && f.t < f.golpe.prep)
    spr.mat.color.setHex(Math.sin(tempo * 40) > 0 ? 0xffffff : 0xff5533);
  else spr.mat.color.setHex(0xffffff);
}

/* ---------- loop ---------- */
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
    const inp = { mov: { x: eixo(['KeyA','ArrowLeft'], ['KeyD','ArrowRight']),
                         z: eixo(['KeyW','ArrowUp'], ['KeyS','ArrowDown']) } };
    const evt = passoMundo(mundo, inp, dt);
    if (evt === 'encontro') iniciaBatalha();
    if (evt === 'respawn') hud.toast('Algo farfalha na grama alta...');
  } else if (modo === 'batalha' && batalha) {
    const inpP = {
      mov: { x: eixo(['KeyA','ArrowLeft'], ['KeyD','ArrowRight']),
             z: eixo(['KeyW','ArrowUp'], ['KeyS','ArrowDown']) },
      pulo: spE, a: jE, f: kE, capturar: cE,
    };
    const fim = passoBatalha(batalha, inpP, dt, aoEvento);
    hud.atualizaHP(batalha);
    hud.capDisponivel(podeCapturar(batalha));
    if (fim === 'encerrar') encerraBatalha();
  }

  sincronizaVisual(dt);
  passoCamera(cena, modo, mundo, batalha, dt);
  cena.renderer.render(cena.scene, cena.camera);
}
cv.focus(); setTimeout(() => cv.focus(), 300);
requestAnimationFrame(loop);
