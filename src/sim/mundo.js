// SIMULAÇÃO DA EXPLORAÇÃO — regras puras, sem THREE, sem DOM.
import { vec, copia, soma, escala, normXZ, distXZ } from './vec.js';

// O mundo é DADO da simulação; o render lê isto para desenhar.
export const MUNDO_LAYOUT = {
  limite: { x: 16, z: 14 },
  arvores: [ // [x, z, pinheiro?]
    [-9,-7,0],[-11,-3,1],[-8,3,0],[-12,8,1],[9,-9,1],[12,-4,0],[11,3,1],[8,9,0],
    [-3,-12,0],[4,-11,1],[-4,12,1],[3,13,0],[14,10,0],[-14,-10,1],
  ],
  raioArvore: 0.75,
  grama: { x0: 3, z0: -4, x1: 13, z1: 5 },
  spawnDomador: vec(-4, 0, 6),
};

export function criarMundo() {
  return {
    domador: { pos: copia(MUNDO_LAYOUT.spawnDomador), dir: 1, andando: false, frente: false, animT: 0 },
    selvagem: {
      especie: 'cascorro', vivo: true,
      pos: vec(8, 0, 0), dir: 1,
      wanderT: 0, wanderDir: vec(),
    },
    respawnT: 0,
  };
}

function colideArvore(pos) {
  const r = MUNDO_LAYOUT.raioArvore;
  for (const a of MUNDO_LAYOUT.arvores) {
    const dx = pos.x - a[0], dz = pos.z - a[1];
    if (dx * dx + dz * dz < r * r) return true;
  }
  return false;
}

function prende(pos) {
  const L = MUNDO_LAYOUT.limite;
  pos.x = Math.max(-L.x, Math.min(L.x, pos.x));
  pos.z = Math.max(-L.z, Math.min(L.z, pos.z));
}

// inp = { mov: {x,z} (-1..1) } | retorna 'encontro' quando o duelo deve começar
export function passoMundo(m, inp, dt, rnd = Math.random) {
  const d = m.domador;
  d.andando = inp.mov.x !== 0 || inp.mov.z !== 0;
  if (d.andando) {
    const mov = normXZ(vec(inp.mov.x, 0, inp.mov.z));
    const novo = soma(d.pos, escala(mov, 4.2 * dt));
    if (!colideArvore(novo)) d.pos = novo;
    prende(d.pos);
    if (mov.x !== 0) d.dir = mov.x > 0 ? 1 : -1;
    d.frente = mov.x === 0 && mov.z !== 0;
    d.animT += dt;
  } else { d.animT = 0; d.frente = false; }

  const s = m.selvagem;
  if (s.vivo) {
    s.wanderT -= dt;
    if (s.wanderT <= 0) {
      s.wanderT = 0.9 + rnd() * 1.6;
      const a = rnd() * Math.PI * 2;
      s.wanderDir = rnd() < 0.3 ? vec() : vec(Math.cos(a), 0, Math.sin(a));
    }
    s.pos = soma(s.pos, escala(s.wanderDir, 1.3 * dt));
    const G = MUNDO_LAYOUT.grama;
    s.pos.x = Math.max(G.x0, Math.min(G.x1, s.pos.x));
    s.pos.z = Math.max(G.z0, Math.min(G.z1, s.pos.z));
    if (s.wanderDir.x !== 0) s.dir = s.wanderDir.x > 0 ? 1 : -1;
    if (distXZ(s.pos, d.pos) < 1.25) return 'encontro';
  } else {
    m.respawnT -= dt;
    if (m.respawnT <= 0) {
      const G = MUNDO_LAYOUT.grama;
      s.vivo = true;
      s.pos = vec(G.x0 + rnd() * (G.x1 - G.x0), 0, G.z0 + rnd() * (G.z1 - G.z0));
      return 'respawn';
    }
  }
  return null;
}
