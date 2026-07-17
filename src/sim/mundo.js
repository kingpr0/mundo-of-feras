// SIMULAÇÃO DA EXPLORAÇÃO — regras puras, sem THREE, sem DOM.
// O layout do mapa é DADO (src/dados/mapas.json); o render lê para desenhar.
import { vec, copia, soma, escala, normXZ, distXZ } from './vec.js';

const RAIO_ARVORE = 0.75;
const BORDA_SAIDA = 0.4; // distância da borda que dispara a passagem

// mapa = uma entrada de mapas.json; selvagens = chaves das espécies da grama
export function criarMundo(mapa, selvagens = ['cascorro'], rnd = Math.random) {
  const G = mapa.grama;
  return {
    mapa,
    domador: {
      pos: vec(mapa.spawn.x, 0, mapa.spawn.z),
      dir: 1, andando: false, correndo: false, animT: 0,
    },
    selvagem: {
      especie: sorteiaEspecie(selvagens, rnd), vivo: true,
      pos: vec((G.x0 + G.x1) / 2, 0, (G.z0 + G.z1) / 2), dir: 1,
      wanderT: 0, wanderDir: vec(),
    },
    selvagens,
    respawnT: 0,
    imunidade: 0, // segundos sem novos encontros (após fugir/batalhar/trocar de mapa)
  };
}

function sorteiaEspecie(lista, rnd) {
  return lista[Math.floor(rnd() * lista.length)];
}

// impede novos encontros por alguns segundos (ex.: logo após fugir)
export function daImunidade(m, segundos = 2) {
  m.imunidade = segundos;
}

function colide(mapa, pos) {
  for (const a of mapa.arvores) {
    const dx = pos.x - a[0], dz = pos.z - a[1];
    if (dx * dx + dz * dz < RAIO_ARVORE * RAIO_ARVORE) return true;
  }
  const ag = mapa.agua;
  if (ag && pos.x > ag.x0 && pos.x < ag.x1 && pos.z > ag.z0 && pos.z < ag.z1) return true;
  return false;
}

function prende(mapa, pos) {
  const L = mapa.limite;
  pos.x = Math.max(-L.x, Math.min(L.x, pos.x));
  pos.z = Math.max(-L.z, Math.min(L.z, pos.z));
}

// o domador pisou numa passagem de borda?
function verificaSaida(mapa, pos) {
  const L = mapa.limite;
  for (const s of mapa.saidas || []) {
    const faixaZ = pos.z >= s.de && pos.z <= s.ate;
    const faixaX = pos.x >= s.de && pos.x <= s.ate;
    if (s.borda === 'leste' && faixaZ && pos.x > L.x - BORDA_SAIDA) return s;
    if (s.borda === 'oeste' && faixaZ && pos.x < -L.x + BORDA_SAIDA) return s;
    if (s.borda === 'sul' && faixaX && pos.z > L.z - BORDA_SAIDA) return s;
    if (s.borda === 'norte' && faixaX && pos.z < -L.z + BORDA_SAIDA) return s;
  }
  return null;
}

// posição de chegada ao entrar em `mapa` vindo do mapa `origem`
export function entradaDoMapa(mapa, origem) {
  const L = mapa.limite;
  const s = (mapa.saidas || []).find((x) => x.destino === origem);
  if (!s) return vec(mapa.spawn.x, 0, mapa.spawn.z);
  const meio = (s.de + s.ate) / 2;
  if (s.borda === 'leste') return vec(L.x - 1.4, 0, meio);
  if (s.borda === 'oeste') return vec(-L.x + 1.4, 0, meio);
  if (s.borda === 'sul') return vec(meio, 0, L.z - 1.4);
  return vec(meio, 0, -L.z + 1.4);
}

// inp = { mov: {x,z} (-1..1), correr }
// retorna: 'encontro' | 'respawn' | { tipo:'saida', saida } | null
export function passoMundo(m, inp, dt, rnd = Math.random) {
  if (m.imunidade > 0) m.imunidade -= dt;
  const d = m.domador;
  d.andando = inp.mov.x !== 0 || inp.mov.z !== 0;
  d.correndo = d.andando && !!inp.correr;
  if (d.andando) {
    const mov = normXZ(vec(inp.mov.x, 0, inp.mov.z));
    const novo = soma(d.pos, escala(mov, (d.correndo ? 4.2 * 1.5 : 4.2) * dt));
    if (!colide(m.mapa, novo)) d.pos = novo;
    const saida = verificaSaida(m.mapa, d.pos);
    if (saida) return { tipo: 'saida', saida };
    prende(m.mapa, d.pos);
    if (mov.x !== 0) d.dir = mov.x > 0 ? 1 : -1;
    d.animT += dt;
  } else { d.animT = 0; }

  const s = m.selvagem;
  if (s.vivo) {
    s.wanderT -= dt;
    if (s.wanderT <= 0) {
      s.wanderT = 0.9 + rnd() * 1.6;
      const a = rnd() * Math.PI * 2;
      s.wanderDir = rnd() < 0.3 ? vec() : vec(Math.cos(a), 0, Math.sin(a));
    }
    s.pos = soma(s.pos, escala(s.wanderDir, 1.3 * dt));
    const G = m.mapa.grama;
    s.pos.x = Math.max(G.x0, Math.min(G.x1, s.pos.x));
    s.pos.z = Math.max(G.z0, Math.min(G.z1, s.pos.z));
    if (s.wanderDir.x !== 0) s.dir = s.wanderDir.x > 0 ? 1 : -1;
    if (m.imunidade <= 0 && distXZ(s.pos, d.pos) < 1.25) return 'encontro';
  } else {
    m.respawnT -= dt;
    if (m.respawnT <= 0) {
      const G = m.mapa.grama;
      s.vivo = true;
      s.especie = sorteiaEspecie(m.selvagens, rnd);
      s.pos = vec(G.x0 + rnd() * (G.x1 - G.x0), 0, G.z0 + rnd() * (G.z1 - G.z0));
      return 'respawn';
    }
  }
  return null;
}
