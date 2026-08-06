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
    vencidos: new Set(), // treinadores já derrotados neste mapa
  };
}

// altura do terreno: platôs têm paredão SECO (não dá para escalar) — a única
// subida é pela rampa das ESCADAS. O passoMundo bloqueia degraus > 0.45.
// MORROS são colinas suaves (cosseno) que qualquer um sobe andando.
const DV_ESCADA = { norte: [0, -1], sul: [0, 1], leste: [1, 0], oeste: [-1, 0] };
const COMP_ESCADA = 1.7;
// só a parte suave do relevo (morros) — o render desloca o chão com isso
export function alturaMorros(mapa, pos) {
  let h = 0;
  for (const mo of mapa.morros || []) {
    const d = Math.hypot(pos.x - mo.x, pos.z - mo.z);
    if (d < mo.r) h += mo.h * 0.5 * (1 + Math.cos((d / mo.r) * Math.PI));
  }
  return h;
}
// a grama alta vive sobre uma PLATAFORMA verde baixa (canteiro): sobe-se
// andando (rampa suave na borda)
export function alturaGrama(mapa, pos) {
  if (mapa.tipo === 'interior') return 0; // dentro de caverna o chão é plano
  let h = 0;
  for (const G of zonasGrama(mapa)) {
    const m = 1.2; // a plataforma se estende além da grama (moldura)
    const dx = Math.min(pos.x - (G.x0 - m), (G.x1 + m) - pos.x);
    const dz = Math.min(pos.z - (G.z0 - m), (G.z1 + m) - pos.z);
    const dentro = Math.min(dx, dz);
    if (dentro > 0) h = Math.max(h, 0.26 * Math.min(1, dentro / 0.8));
  }
  return h;
}
// PLATÔS: morrotes de topo plano com SAIA suave nas bordas — elevação de
// terreno de verdade (sobe-se andando por qualquer lado); as escadas nos
// dados viram só decoração/atalho visual
export function alturaPlatos(mapa, pos) {
  let h = 0;
  for (const p of mapa.platos || []) {
    const m = 1.6; // alcance da saia além do retângulo do topo
    const dx = Math.min(pos.x - (p.x0 - m), (p.x1 + m) - pos.x);
    const dz = Math.min(pos.z - (p.z0 - m), (p.z1 + m) - pos.z);
    const dentro = Math.min(dx, dz);
    if (dentro > 0) {
      const t = Math.min(1, dentro / (m + 0.9));
      h = Math.max(h, p.h * t * t * (3 - 2 * t)); // suavizado (smoothstep)
    }
  }
  return h;
}
// DEGRAUS: linhas de cota que cortam o mapa INTEIRO (terraços). Cada
// degrau eleva todo um lado do mapa; vários degraus empilham (carta
// topográfica). { eixo:'z'|'x', em: coordenada, alto: lado, h, rampa? }
// A subida é uma RAMPA de largura `rampa` (padrão 2.2) — atravessável em
// QUALQUER ponto da linha; rampa 0 = paredão seco (falésia, exige escada).
export function alturaDegraus(mapa, pos) {
  let h = 0;
  for (const dg of mapa.degraus || []) {
    const v = dg.eixo === 'x' ? pos.x : pos.z;
    const altoMaior = dg.alto === (dg.eixo === 'x' ? 'leste' : 'sul');
    const rampa = dg.rampa !== undefined ? dg.rampa : 2.2;
    const d = altoMaior ? v - dg.em : dg.em - v; // avanço rumo ao lado alto
    if (rampa === 0) { if (d > 0) h += dg.h; }
    else h += dg.h * Math.max(0, Math.min(1, d / rampa + 0.5));
  }
  return h;
}
// DESFILADEIRO: cânion cavado no próprio chão (banda em z que corta o
// mapa inteiro). O fundo fica -prof abaixo da cota do rim; as paredes
// nascem DENTRO da banda (1.8 de encosta), então a beirada é firme.
export function fundoDesfiladeiro(mapa, pos) {
  let h = 0;
  for (const df of mapa.desfiladeiros || []) {
    if (pos.z > df.z0 && pos.z < df.z1) {
      const dz = Math.min(pos.z - df.z0, df.z1 - pos.z);
      const t = Math.min(1, dz / 2.6);
      h -= df.prof * t * t;
    }
  }
  return h;
}
// PONTE PÊNSIL sobre o desfiladeiro: tabuleiro em cota fixa com uma leve
// flecha (barriga) no meio — devolve a altura ABSOLUTA do deck ou null
export function alturaPonte(mapa, pos) {
  for (const pt of mapa.pontes || []) {
    if (Math.abs(pos.x - pt.x) > (pt.largura || 2.8) / 2) continue;
    for (const df of mapa.desfiladeiros || []) {
      if (pos.z > df.z0 - 0.8 && pos.z < df.z1 + 0.8) {
        const t = Math.max(0, Math.min(1, (pos.z - df.z0) / (df.z1 - df.z0)));
        return pt.y - 0.28 * Math.sin(Math.PI * t);
      }
    }
  }
  return null;
}
// o "solo" (degraus + relevo suave - cânions) — o render desloca o chão com
// isso; espelha o que a sim considera chão para o pé nunca flutuar/afundar
export function alturaSolo(mapa, pos) {
  const base = alturaDegraus(mapa, pos);
  let h = base + Math.max(alturaMorros(mapa, pos), alturaGrama(mapa, pos));
  h = Math.max(h, base + alturaPlatos(mapa, pos));
  return h + fundoDesfiladeiro(mapa, pos);
}
export function alturaTerreno(mapa, pos) {
  const deck = alturaPonte(mapa, pos);
  if (deck !== null) return deck;
  const base = alturaDegraus(mapa, pos);
  let h = base + Math.max(alturaMorros(mapa, pos), alturaGrama(mapa, pos));
  // platô = morrote de saia suave: sobe-se andando por qualquer lado
  h = Math.max(h, base + alturaPlatos(mapa, pos));
  for (const e of mapa.escadas || []) {
    const dv = DV_ESCADA[e.dir];
    const dx = pos.x - e.x, dz = pos.z - e.z;
    const along = -(dx * dv[0] + dz * dv[1]);       // descendo a escada
    const perp = Math.abs(dx * dv[1] - dz * dv[0]); // desvio lateral
    if (along >= -0.2 && along <= COMP_ESCADA && perp <= e.w / 2) {
      // a rampa nasce na COTA do pé da escada (lado de baixo) — em altura
      // ABSOLUTA, para emendar sem soma dupla com o degrau do lado alto
      const cotaPe = alturaDegraus(mapa,
        { x: e.x - dv[0] * 1.2, z: e.z - dv[1] * 1.2 });
      h = Math.max(h, cotaPe + e.h * (1 - Math.max(0, along) / COMP_ESCADA));
    }
  }
  return h;
}

function colideDecor(mapa, pos) {
  for (const d of mapa.decor || []) {
    const r = d[0] === 'banca' ? 1.3 : d[0] === 'fogueira' ? 1.8 : d[0] === 'farol' ? 1.7 : 0.95;
    const dx = pos.x - d[1], dz = pos.z - d[2];
    if (dx * dx + dz * dz < r * r) return true;
  }
  for (const n of mapa.npcs || []) {
    // raio folgado: o domador no máximo ENCOSTA no morador, nunca o invade
    const dx = pos.x - n[0], dz = pos.z - n[1];
    if (dx * dx + dz * dz < 0.72 * 0.72) return true;
  }
  if (mapa.arenaTreino) { // o Mestre da arena (fica 1.4 ao sul do centro dela)
    const dx = pos.x - mapa.arenaTreino.x, dz = pos.z - (mapa.arenaTreino.z - 1.4);
    if (dx * dx + dz * dz < 0.8 * 0.8) return true;
  }
  return false;
}

function sorteiaEspecie(lista, rnd) {
  return lista[Math.floor(rnd() * lista.length)];
}

// impede novos encontros por alguns segundos (ex.: logo após fugir)
export function daImunidade(m, segundos = 2) {
  m.imunidade = segundos;
}

// há algo interativo por perto? (a interface mostra a dica "Z — ...")
export function interacaoPerto(m) {
  const d = m.domador.pos;
  const perto = (x, z, r) => Math.hypot(d.x - x, d.z - z) < r;
  for (const t of m.mapa.treinadores || [])
    if (!m.vencidos.has(t.nome) && perto(t.x, t.z, 1.9)) return `desafiar ${t.nome}`;
  const cura = m.mapa.cura;
  if (cura && perto(cura.x, cura.z, 1.9)) return 'falar com a enfermeira';
  const at = m.mapa.arenaTreino;
  if (at && perto(at.x, at.z, 2.4)) return 'Arena de Treino';
  const bal = m.mapa.balsa;
  if (bal && perto(bal.x, bal.z, 2.6)) return 'pegar a balsa';
  for (const n of m.mapa.npcs || [])
    if (n[4] && perto(n[0], n[1], 1.7)) return 'conversar';
  for (const dc of m.mapa.decor || []) {
    if (dc[0] === 'placa' && dc[3] && perto(dc[1], dc[2], 1.7)) return 'ler a placa';
    if (dc[0] === 'fogueira' && perto(dc[1], dc[2], 2.4)) return 'a Fogueira Eterna';
  }
  return null;
}

// meia-largura/profundidade da base das casas e do centro (para colisão)
export const CASA_MEIA = { x: 2.0, z: 1.8 };
export const CENTRO_MEIA = { x: 2.8, z: 2.1 };

// zonas de grama alta (aceita "grama" única ou lista "gramas")
export function zonasGrama(mapa) {
  return mapa.gramas || (mapa.grama ? [mapa.grama] : []);
}
// mapas podem ter várias águas (a Ilha Farol é cercada por 4 faixas de mar)
export function zonasAgua(mapa) {
  return mapa.aguas || (mapa.agua ? [mapa.agua] : []);
}

// muralhas, torres e torreão do castelo (o portão fica aberto ao sul)
function colideCastelo(c, pos) {
  const dx = pos.x - c.x, dz = pos.z - c.z;
  if (Math.hypot(dx, dz + 2) < 2.9) return true;                    // torreão
  for (const [tx, tz] of [[-8, -6], [8, -6], [-8, 6], [8, 6]])
    if (Math.hypot(dx - tx, dz - tz) < 1.8) return true;            // torres
  if (Math.abs(dx) < 8 && dz > -6.9 && dz < -5.1) return true;      // muro norte
  if (Math.abs(dz) < 6 && Math.abs(dx) > 7.1 && Math.abs(dx) < 8.9) return true; // laterais
  if (dz > 5.1 && dz < 6.9 && Math.abs(dx) > 2 && Math.abs(dx) < 8) return true; // sul c/ portão
  return false;
}

function colide(mapa, pos) {
  if (mapa.castelo && colideCastelo(mapa.castelo, pos)) return true;
  // modelos de cenário glTF: [slug, x, z, altura, rot, raio] — raio > 0 bloqueia
  for (const c of mapa.cenario || []) {
    const r = c[5] || 0;
    if (!r) continue;
    const dx = pos.x - c[1], dz = pos.z - c[2];
    if (dx * dx + dz * dz < r * r) return true;
  }
  for (const a of mapa.arvores || []) {
    const dx = pos.x - a[0], dz = pos.z - a[1];
    if (dx * dx + dz * dz < RAIO_ARVORE * RAIO_ARVORE) return true;
  }
  for (const pd of mapa.pedras || []) {
    const r = 0.9 * (pd[2] || 1);
    const dx = pos.x - pd[0], dz = pos.z - pd[1];
    if (dx * dx + dz * dz < r * r) return true;
  }
  for (const c of mapa.casas || []) {
    if (Math.abs(pos.x - c[0]) < CASA_MEIA.x && Math.abs(pos.z - c[1]) < CASA_MEIA.z) return true;
  }
  const ct = mapa.centro;
  if (ct && Math.abs(pos.x - ct.x) < CENTRO_MEIA.x && Math.abs(pos.z - ct.z) < CENTRO_MEIA.z) return true;
  for (const ag of zonasAgua(mapa))
    if (pos.x > ag.x0 && pos.x < ag.x1 && pos.z > ag.z0 && pos.z < ag.z1) return true;
  // DESFILADEIRO: ninguém desce o cânion — só a ponte pênsil atravessa
  for (const df of mapa.desfiladeiros || []) {
    if (pos.z > df.z0 && pos.z < df.z1 &&
        alturaPonte(mapa, pos) === null) return true;
  }
  if (colideDecor(mapa, pos)) return true;
  for (const t of mapa.treinadores || []) {
    const dx = pos.x - t.x, dz = pos.z - t.z;
    if (dx * dx + dz * dz < 0.8 * 0.8) return true;
  }
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

  // FALAR (Z): treinadores desafiam, a enfermeira cura, moradores e placas
  // conversam — tudo por interação, nada dispara sozinho
  if (inp.falar) {
    const perto = (x, z, r) => Math.hypot(d.pos.x - x, d.pos.z - z) < r;
    for (let ti = 0; ti < (m.mapa.treinadores || []).length; ti++) {
      const t = m.mapa.treinadores[ti];
      if (!m.vencidos.has(t.nome) && perto(t.x, t.z, 1.9))
        return { tipo: 'treinador', idx: ti, treinador: t };
    }
    const cura = m.mapa.cura;
    if (cura && perto(cura.x, cura.z, 1.9)) return 'cura';
    // Arena de Treino: o Mestre monta duelos de mentira (modo de testes)
    const at = m.mapa.arenaTreino;
    if (at && perto(at.x, at.z, 2.4)) return { tipo: 'arenaTreino' };
    // a balsa cruza o Mar do Meio (falar com o barco embarca)
    const bal = m.mapa.balsa;
    if (bal && perto(bal.x, bal.z, 2.6)) return { tipo: 'balsa', destino: bal.destino };
    for (const n of m.mapa.npcs || [])
      if (n[4] && perto(n[0], n[1], 1.7)) return { tipo: 'fala', texto: n[4], papel: n[2] };
    for (const dc of m.mapa.decor || []) {
      if (dc[0] === 'placa' && dc[3] && perto(dc[1], dc[2], 1.7))
        return { tipo: 'fala', texto: dc[3], placa: true };
      // a Fogueira Eterna: onde o elo com as feras nasce (e renasce)
      if (dc[0] === 'fogueira' && perto(dc[1], dc[2], 2.4))
        return { tipo: 'fogueira' };
    }
  }
  d.andando = inp.mov.x !== 0 || inp.mov.z !== 0;
  d.correndo = d.andando && !!inp.correr;
  if (d.andando) {
    const mov = normXZ(vec(inp.mov.x, 0, inp.mov.z));
    const novo = soma(d.pos, escala(mov, (d.correndo ? 4.2 * 1.5 : 4.2) * dt));
    if (!colide(m.mapa, novo)) {
      // paredões não se escalam: só passa se o desnível for de degrau.
      // A sonda avança a BORDA do corpo (0.3), não o centro — o domador
      // encosta no paredão sem afundar nele
      const sonda = soma(novo, escala(mov, 0.3));
      const dh = Math.abs(alturaTerreno(m.mapa, novo) - alturaTerreno(m.mapa, d.pos));
      const dhSonda = Math.abs(alturaTerreno(m.mapa, sonda) - alturaTerreno(m.mapa, d.pos));
      if (dh < 0.45 && dhSonda < 0.45) { d.pos.x = novo.x; d.pos.z = novo.z; }
    }
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

    // PORTAS genéricas (salas do castelo, andares...): chegar perto entra
    for (const pt of m.mapa.portas || [])
      if (Math.hypot(d.pos.x - pt.x, d.pos.z - pt.z) < 0.9)
        return { tipo: 'porta', destino: pt.destino, retorno: pt.retorno };

    // boca da caverna: entrar leva ao interior dela
    const cav = m.mapa.caverna;
    if (cav && m.cavernaT <= 0 &&
        Math.hypot(d.pos.x - cav.x, d.pos.z - cav.z) < 2.0) {
      m.cavernaT = 4;
      return { tipo: 'porta', destino: 'interior_caverna',
               retorno: { x: cav.x, z: cav.z + 3.0 } };
    }
    // encontro à moda clássica: chance por tempo andado dentro da grama alta
    const naGrama = zonasGrama(m.mapa).some((G) =>
      d.pos.x > G.x0 && d.pos.x < G.x1 && d.pos.z > G.z0 && d.pos.z < G.z1);
    if (naGrama && m.imunidade <= 0 && rnd() < dt * CHANCE_ENCONTRO) {
      m.selvagem.especie = sorteiaEspecie(m.selvagens, rnd);
      return 'encontro';
    }
  } else { d.animT = 0; }
  d.pos.y = alturaTerreno(m.mapa, d.pos);
  return null;
}
