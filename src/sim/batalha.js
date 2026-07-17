// SIMULAÇÃO DA BATALHA — o coração do jogo. Regras puras, sem THREE, sem DOM.
// Eventos são emitidos via callback para a camada visual reagir (sons, partículas, HUD).
import { vec, copia, soma, sub, escala, normXZ, perpXZ, distXZ } from './vec.js';

const ARENA = { x: 16, z: 14 };
const GRAVIDADE = 22;

function novoLutador(chave, esp, pos) {
  return {
    chave, esp,
    pos: copia(pos), vy: 0,
    hp: esp.vida, max: esp.vida,
    estado: 'idle', t: 0, golpe: null, acertou: false,
    invuln: 0, flash: 0, kb: vec(),
  };
}

export function criarBatalha(especies, chaveSelvagem, posDomador, posSelvagem) {
  const dirE = normXZ(sub(posSelvagem, posDomador));
  const posBra = soma(posDomador, escala(dirE, 1.4));
  return {
    p: novoLutador('brasinha', especies.brasinha, posBra),
    e: novoLutador(chaveSelvagem, especies[chaveSelvagem], posSelvagem),
    aiT: 0.7, iaMov: null,
    fim: false, resultado: null,
    captura: null,
    domadorAlvo: soma(posDomador, escala(perpXZ(dirE), 3.5)),
    fimT: 0,
  };
}

export function podeCapturar(b) {
  return !b.fim && !b.captura && b.e.estado !== 'ko' && b.e.hp / b.e.max <= 0.35;
}

function acerta(b, vitima, atacante, g, emitir) {
  const dano = Math.round(g.dano * atacante.esp.ataque);
  vitima.hp = Math.max(0, vitima.hp - dano);
  vitima.estado = 'hurt'; vitima.t = 0;
  vitima.invuln = 0.5; vitima.flash = 1;
  vitima.kb = escala(normXZ(sub(vitima.pos, atacante.pos)), g.empurrao);
  emitir({ tipo: g.forte ? 'hitForte' : 'hit', pos: copia(vitima.pos), dano, forte: g.forte });
  if (vitima.hp <= 0) {
    vitima.estado = 'ko'; vitima.t = 0;
    b.fim = true; b.fimT = 1.4;
    b.resultado = (vitima === b.e) ? 'vitoria' : 'derrota';
    emitir({ tipo: b.resultado });
  }
}

function passoLutador(b, f, inp, outro, dt, emitir) {
  const p = f.pos;
  if (f.estado === 'ko') { f.t += dt; return; }
  if (f.estado === 'hurt') {
    f.t += dt;
    f.pos = soma(p, escala(f.kb, dt));
    f.kb = escala(f.kb, 1 - 3 * dt);
    if (f.t > 0.26) f.estado = 'idle';
  } else if (f.estado === 'atk') {
    f.t += dt;
    const g = f.golpe;
    if (f.t >= g.prep && f.t <= g.prep + g.ativo) {
      const frente = normXZ(sub(outro.pos, p));
      f.pos = soma(p, escala(frente, (g.forte ? 3 : 4.5) * dt));
      if (g.forte) emitir({ tipo: 'rastroFogo', pos: soma(copia(f.pos), escala(frente, 1.1)) });
      if (!f.acertou && distXZ(f.pos, outro.pos) < g.alcance &&
          outro.invuln <= 0 && outro.estado !== 'ko') {
        f.acertou = true;
        acerta(b, outro, f, g, emitir);
      }
    }
    if (f.t >= g.prep + g.ativo + g.recup) { f.estado = 'idle'; f.golpe = null; }
  } else {
    if (inp.mov.x !== 0 || inp.mov.z !== 0)
      f.pos = soma(p, escala(normXZ(vec(inp.mov.x, 0, inp.mov.z)), f.esp.velocidade * dt));
    if (inp.pulo && f.pos.y <= 0.01) { f.vy = f.esp.impulso; emitir({ tipo: 'pulo' }); }
    if (inp.a) { f.estado = 'atk'; f.golpe = f.esp.golpes.normal; f.t = 0; f.acertou = false; emitir({ tipo: 'swing' }); }
    else if (inp.f && f.pos.y <= 0.01) { f.estado = 'atk'; f.golpe = f.esp.golpes.especial; f.t = 0; f.acertou = false; emitir({ tipo: 'especial' }); }
  }
  f.vy -= GRAVIDADE * dt;
  f.pos.y = Math.max(0, f.pos.y + f.vy * dt);
  if (f.pos.y === 0) f.vy = Math.max(0, f.vy);
  f.pos.x = Math.max(-ARENA.x, Math.min(ARENA.x, f.pos.x));
  f.pos.z = Math.max(-ARENA.z, Math.min(ARENA.z, f.pos.z));
  if (f.invuln > 0) f.invuln -= dt;
  if (f.flash > 0) f.flash -= dt * 4;
}

function iaSelvagem(b, dt, rnd) {
  const e = b.e, p = b.p;
  const inp = { mov: vec(), pulo: false, a: false, f: false };
  if (e.estado !== 'idle') return inp;
  b.aiT -= dt;
  const dist = distXZ(e.pos, p.pos);
  const dir = normXZ(sub(p.pos, e.pos));
  if (b.aiT <= 0) {
    b.aiT = 0.3 + rnd() * 0.35;
    if (dist > 4.5) b.iaMov = rnd() < 0.85 ? dir : null;
    else if (dist > 2.2) b.iaMov = dir;
    else {
      const r = rnd();
      if (r < 0.5) { inp.a = true; b.iaMov = null; }
      else if (r < 0.68) { inp.f = true; b.iaMov = null; }
      else if (r < 0.86) b.iaMov = escala(dir, -1);
      else { inp.pulo = true; b.iaMov = dir; }
    }
    if (p.estado === 'atk' && p.golpe && p.golpe.forte && dist < 4 && rnd() < 0.35) inp.pulo = true;
  }
  if (b.iaMov) inp.mov = b.iaMov;
  return inp;
}

export function lancaCristal(b, emitir) {
  b.captura = { fase: 'voo', t: 0, wob: 0, pos: soma(copia(b.p.pos), vec(0, 1.2, 0)) };
  emitir({ tipo: 'cristalVoa' });
}

function passoCaptura(b, dt, emitir, rnd) {
  const c = b.captura;
  const alvo = soma(copia(b.e.pos), vec(0, 0.9, 0));
  c.t += dt;
  if (c.fase === 'voo') {
    const t = Math.min(1, c.t / 0.6);
    const ini = c.ini || (c.ini = copia(c.pos));
    c.pos = {
      x: ini.x + (alvo.x - ini.x) * t,
      y: ini.y + (alvo.y - ini.y) * t + Math.sin(t * Math.PI) * 2,
      z: ini.z + (alvo.z - ini.z) * t,
    };
    if (t >= 1) { c.fase = 'sugar'; c.t = 0; emitir({ tipo: 'cristalSuga', pos: alvo }); }
  } else if (c.fase === 'sugar') {
    c.escalaFera = Math.max(0.01, 1 - c.t * 2.4);
    if (c.t > 0.4) { c.fase = 'treme'; c.t = 0; emitir({ tipo: 'cristalTreme' }); }
  } else if (c.fase === 'treme') {
    c.pos.x = alvo.x + Math.sin(c.t * 16) * 0.15;
    if (c.t > (c.wob + 1) * 0.5) { c.wob++; if (c.wob < 3) emitir({ tipo: 'cristalTreme' }); }
    if (c.wob >= 3) {
      const chance = Math.min(0.88, (1 - b.e.hp / b.e.max) * 1.15);
      if (rnd() < chance) {
        b.fim = true; b.fimT = 1.4; b.resultado = 'captura';
        emitir({ tipo: 'capturado' });
      } else {
        b.e.invuln = 0.8; b.captura = null;
        emitir({ tipo: 'escapou' });
      }
    }
  }
}

// inpP = { mov:{x,z} relativo ao lock-on, pulo, a, f, capturar }
// Retorna 'encerrar' quando a batalha terminou de vez (após a pausa final).
export function passoBatalha(b, inpP, dt, emitir, rnd = Math.random) {
  if (b.fim) {
    passoLutador(b, b.p, { mov: vec(), pulo: false, a: false, f: false }, b.e, dt, emitir);
    passoLutador(b, b.e, { mov: vec(), pulo: false, a: false, f: false }, b.p, dt, emitir);
    b.fimT -= dt;
    return b.fimT <= 0 ? 'encerrar' : null;
  }
  if (b.captura) { passoCaptura(b, dt, emitir, rnd); return null; }

  // converte o input relativo (frente/trás/lados) em direção no mundo
  const fw = normXZ(sub(b.e.pos, b.p.pos));
  const rt = perpXZ(fw);
  const mov = soma(escala(fw, -inpP.mov.z), escala(rt, inpP.mov.x)); // W = aproximar
  passoLutador(b, b.p, { mov, pulo: inpP.pulo, a: inpP.a, f: inpP.f }, b.e, dt, emitir);
  passoLutador(b, b.e, iaSelvagem(b, dt, rnd), b.p, dt, emitir);
  if (inpP.capturar && podeCapturar(b)) lancaCristal(b, emitir);
  return null;
}
