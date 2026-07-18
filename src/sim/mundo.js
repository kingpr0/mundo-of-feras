// SIMULAÇÃO DA EXPLORAÇÃO — regras puras, sem THREE, sem DOM.
// O layout do mapa é DADO (src/dados/mapas.json); o render lê para desenhar.
import { vec, copia, soma, escala, normXZ, distXZ } from './vec.js';

const RAIO_ARVORE = 0.75;
const BORDA_SAIDA = 0.4; // distância da borda que dispara a passagem

// chance média de encontro: ~1 a cada 1,8s andando na grama alta
const CHANCE_ENCONTRO = 0.55;

// mapa = uma entrada de mapas.json; selvagens = chaves das espécies da grama
export function criarMundo(mapa, selvagens = ['cascorro'], rnd = Math.random) {
  return {
    mapa,
    domador: {
      pos: vec(mapa.spawn.x, 0, mapa.spawn.z),
      dir: 1, andando: false, correndo: false, animT: 0,
    },
    // a próxima fera a aparecer (sorteada de novo a cada encontro)
    selvagem: { especie: sorteiaEspecie(selvagens, rnd) },
    selvagens,
    imunidade: 0, // segundos sem novos encontros (após fugir/batalhar/trocar de mapa)
    cavernaT: 0,  // intervalo entre avisos da caverna
  };
}

// altura do terreno: platôs elevam o domador com rampa suave nas beiradas
export function alturaTerreno(mapa, pos) {
  let h = 0;
  for (const p of mapa.platos || []) {
    const margem = 1.4;
    if (pos.x > p.x0 - margem && pos.x < p.x1 + margem &&
        pos.z > p.z0 - margem && pos.z < p.z1 + margem) {
      const dx = Math.min((pos.x - (p.x0 - margem)) / margem, ((p.x1 + margem) - pos.x) / margem, 1);
      const dz = Math.min((pos.z - (p.z0 - margem)) / margem, ((p.z1 + margem) - pos.z) / margem, 1);
      h = Math.max(h, p.h * Math.max(0, Math.min(dx, dz)));
    }
  }
  return h;
}

function sorteiaEspecie(lista, rnd) {
  return lista[Math.floor(rnd() * lista.length)];
}

// impede novos encontros por alguns segundos (ex.: logo após fugir)
export function daImunidade(m, segundos = 2) {
  m.imunidade = segundos;
}

// meia-largura/profundidade da base das casas e do centro (para colisão)
export const CASA_MEIA = { x: 2.0, z: 1.8 };
export const CENTRO_MEIA = { x: 2.8, z: 2.1 };

function colide(mapa, pos) {
  for (const a of mapa.arvores) {
    const dx = pos.x - a[0], dz = pos.z - a[1];
    if (dx * dx + dz * dz < RAIO_ARVORE * RAIO_ARVORE) return true;
  }
  for (const c of mapa.casas || []) {
    if (Math.abs(pos.x - c[0]) < CASA_MEIA.x && Math.abs(pos.z - c[1]) < CASA_MEIA.z) return true;
  }
  const ct = mapa.centro;
  if (ct && Math.abs(pos.x - ct.x) < CENTRO_MEIA.x && Math.abs(pos.z - ct.z) < CENTRO_MEIA.z) return true;
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
// retorna: 'encontro' | 'caverna' | { tipo:'saida', saida } |
//          { tipo:'porta', destino, retorno } | null
export function passoMundo(m, inp, dt, rnd = Math.random) {
  if (m.imunidade > 0) m.imunidade -= dt;
  if (m.cavernaT > 0) m.cavernaT -= dt;
  const d = m.domador;
  d.andando = inp.mov.x !== 0 || inp.mov.z !== 0;
  d.correndo = d.andando && !!inp.correr;
  if (d.andando) {
    const mov = normXZ(vec(inp.mov.x, 0, inp.mov.z));
    const novo = soma(d.pos, escala(mov, (d.correndo ? 4.2 * 1.5 : 4.2) * dt));
    if (!colide(m.mapa, novo)) { d.pos.x = novo.x; d.pos.z = novo.z; }
    const saida = verificaSaida(m.mapa, d.pos);
    if (saida) return { tipo: 'saida', saida };
    prende(m.mapa, d.pos);
    if (mov.x !== 0) d.dir = mov.x > 0 ? 1 : -1;
    d.animT += dt;

    // porta de casa (ou do centro): andar para o norte encostado na frente entra
    if (mov.z < 0) {
      for (const c of m.mapa.casas || []) {
        if (Math.abs(d.pos.x - c[0]) < 0.75 &&
            d.pos.z > c[1] + CASA_MEIA.z && d.pos.z < c[1] + CASA_MEIA.z + 0.8)
          return { tipo: 'porta', destino: 'interior_casa',
                   retorno: { x: c[0], z: c[1] + CASA_MEIA.z + 1.2 } };
      }
      const ct = m.mapa.centro;
      if (ct && Math.abs(d.pos.x - ct.x) < 0.85 &&
          d.pos.z > ct.z + CENTRO_MEIA.z && d.pos.z < ct.z + CENTRO_MEIA.z + 0.8)
        return { tipo: 'porta', destino: 'interior_centro',
                 retorno: { x: ct.x, z: ct.z + CENTRO_MEIA.z + 1.2 } };
    }
    // saindo de um interior: a porta fica no centro da parede sul
    if (m.mapa.tipo === 'interior' && mov.z > 0 &&
        d.pos.z > m.mapa.limite.z - 0.5 && Math.abs(d.pos.x) < 1.2)
      return { tipo: 'porta', destino: 'retorno' };

    // boca da caverna: chegar perto avisa (interior dela vem no futuro)
    const cav = m.mapa.caverna;
    if (cav && m.cavernaT <= 0 &&
        Math.hypot(d.pos.x - cav.x, d.pos.z - cav.z) < 2.6) {
      m.cavernaT = 4;
      return 'caverna';
    }
    // balcão do centro de curas: chegar perto cura a equipe
    const cura = m.mapa.cura;
    if (cura && m.cavernaT <= 0 &&
        Math.hypot(d.pos.x - cura.x, d.pos.z - cura.z) < 1.6) {
      m.cavernaT = 5;
      return 'cura';
    }

    // encontro à moda clássica: chance por tempo andado dentro da grama alta
    const G = m.mapa.grama;
    const naGrama = G && d.pos.x > G.x0 && d.pos.x < G.x1 &&
                    d.pos.z > G.z0 && d.pos.z < G.z1;
    if (naGrama && m.imunidade <= 0 && rnd() < dt * CHANCE_ENCONTRO) {
      m.selvagem.especie = sorteiaEspecie(m.selvagens, rnd);
      return 'encontro';
    }
  } else { d.animT = 0; }
  d.pos.y = alturaTerreno(m.mapa, d.pos);
  return null;
}
