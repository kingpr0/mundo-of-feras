// SIMULAÇÃO DA BATALHA — o coração do jogo. Regras puras, sem THREE, sem DOM.
// Eventos são emitidos via callback para a camada visual reagir (sons, partículas, HUD).
// Cada lutador chega com SLOTS de golpes resolvidos (ver sim/equipe.js): até 4
// botões, cada um podendo ter uma versão forte acionada por combo de direções.
import { vec, copia, soma, sub, escala, normXZ, perpXZ, distXZ } from './vec.js';
import { fatorNivel, vidaMaxima, NIVEL_INICIAL } from './progressao.js';

const ARENA = { raio: 9.4 }; // ringue circular — ninguém atravessa a cerca
const GRAVIDADE = 22;

// lutador = { chave, nivel, slots: [{id, def, forte}], usos: {id: n}, hp }
function novoLutador(l, esp, pos) {
  const nivel = l.nivel || NIVEL_INICIAL;
  const vida = vidaMaxima(esp.vida, nivel);
  return {
    chave: l.chave, esp, nivel,
    slots: l.slots || [], usos: l.usos || {},
    forca: esp.ataque * fatorNivel(nivel),
    pos: copia(pos), vy: 0,
    hp: l.hp != null ? Math.max(1, Math.min(l.hp, vida)) : vida,
    max: vida,
    estado: 'idle', t: 0, golpe: null, acertou: false, tiros: 0,
    invuln: 0, flash: 0, kb: vec(),
    // energia estilo "ki" (economia tipo elixir): começa na METADE, pinga
    // devagar, carrega parado (vulnerável!) e golpe físico certeiro gera
    energia: 50, espinhoT: 0, carregando: false, pulosAr: 0, giroAr: 0,
    piruetando: false, dashDir: { x: 0, y: 0, z: 1 },
  };
}

// extras = { tipos (tabela de vantagens), bioma (perigos da arena),
//            treinador (duelo sem captura) }
export function criarBatalha(especies, jogador, selvagem, posDomador, posSelvagem, extras = {}) {
  const dirE = normXZ(sub(posSelvagem, posDomador));
  const posBra = soma(posDomador, escala(dirE, 1.4));
  return {
    p: novoLutador(jogador, especies[jogador.chave], posBra),
    e: novoLutador(selvagem, especies[selvagem.chave], posSelvagem),
    aiT: 0.7, iaMov: null,
    fim: false, resultado: null,
    captura: null,
    projeteis: [], projId: 0,
    domadorAlvo: soma(posDomador, escala(perpXZ(dirE), 3.5)),
    fimT: 0,
    tipos: extras.tipos || null,
    bioma: extras.bioma || null,
    treinador: !!extras.treinador, // duelo de treinador: captura proibida
    catalogo: extras.golpes || null, // p/ encadear COMBOS (golpe.proximo)
  };
}

// duelo de treinador: caiu uma fera dele, entra a próxima
export function proximaFeraTreinador(b, selvagem, especies, pos) {
  b.e = novoLutador(selvagem, especies[selvagem.chave], copia(pos));
  b.e.invuln = 1.2;
  b.fim = false; b.resultado = null; b.fimT = 0;
}

// vantagem elemental: golpe do tipo forte contra o alvo = mais dano;
// golpe "na contramão" (alvo é forte contra o elemento) = menos dano
function eficacia(tipos, tipoGolpe, tipoAlvo) {
  if (!tipos || !tipoGolpe || !tipoAlvo) return { m: 1, ef: null };
  if ((tipos.vantagens[tipoGolpe] || []).includes(tipoAlvo))
    return { m: tipos.bonus || 1.5, ef: 'super' };
  if ((tipos.vantagens[tipoAlvo] || []).includes(tipoGolpe))
    return { m: tipos.penalidade || 0.75, ef: 'fraco' };
  return { m: 1, ef: null };
}
// custo de energia: físico simples é grátis; especial gasta 10; VERSÃO
// FORTE (tem "base" no catálogo) gasta 60
export const custoEnergia = (g) =>
  g.base ? 60 : (g.projetil || g.rajada || g.feixe) ? 10 : 0;
const ganhaKi = (f, n) => { f.energia = Math.min(100, f.energia + n); };

// a fera caiu mas a equipe tem outra: o duelo continua contra o mesmo inimigo
export function continuaComOutraFera(b, jogador, especies) {
  const pos = copia(b.p.pos);
  b.p = novoLutador(jogador, especies[jogador.chave], pos);
  b.p.invuln = 1.5;
  b.fim = false; b.resultado = null; b.fimT = 0;
}

// recuar da batalha (menu): encerra sem vitória nem derrota
export function fugirBatalha(b) {
  if (!b.fim) { b.fim = true; b.fimT = 0.5; b.resultado = 'fuga'; }
}

// troca voluntária de fera no meio do duelo
export function trocaFera(b, jogador, especies) {
  const pos = copia(b.p.pos);
  b.p = novoLutador(jogador, especies[jogador.chave], pos);
}

// captura: o cristal pode ser lançado em fera selvagem A QUALQUER momento —
// mas acima de metade da vida a chance é pequena. De 50% para baixo cresce
// de 50% até 100% (a 25% de vida); a raridade corta o teto (muito rara
// captura no máximo 25% das vezes).
const FATOR_RARIDADE = { comum: 1, rara: 0.6, muito_rara: 0.25 };
export function podeCapturar(b) {
  return !b.fim && !b.captura && !b.treinador && b.e.estado !== 'ko';
}
export function chanceCaptura(b) {
  const hpr = b.e.hp / b.e.max;
  const base = hpr <= 0.25 ? 1
    : hpr <= 0.5 ? 0.5 + ((0.5 - hpr) / 0.25) * 0.5
      : 0.35 * (1 - hpr); // vida cheia = quase impossível, mas o arremesso vale
  return base * (FATOR_RARIDADE[b.e.esp.raridade] || 1);
}

function aplicaDano(b, vitima, dano, dirKb, empurrao, forte, emitir, invulnT = 0.5, eficaz = null) {
  // DEFESA da espécie: casca grossa (>1) apara o golpe, pele fina (<1) sofre
  dano = Math.max(1, Math.round(dano / (vitima.esp.defesa || 1)));
  // pego CARREGANDO ki: interrompe e ainda dói 25% a mais (punição real)
  if (vitima.carregando) dano = Math.round(dano * 1.25);
  vitima.hp = Math.max(0, vitima.hp - dano);
  vitima.estado = 'hurt'; vitima.t = 0;
  vitima.invuln = invulnT; vitima.flash = 1;
  vitima.kb = escala(dirKb, empurrao);
  emitir({ tipo: forte ? 'hitForte' : 'hit', pos: copia(vitima.pos), dano, forte, eficaz });
  if (vitima.hp <= 0) {
    vitima.estado = 'ko'; vitima.t = 0;
    b.fim = true; b.fimT = 1.4;
    b.resultado = (vitima === b.e) ? 'vitoria' : 'derrota';
    emitir({ tipo: b.resultado });
  }
}
function acerta(b, vitima, atacante, g, emitir) {
  const { m, ef } = eficacia(b.tipos, g.tipo || atacante.esp.tipo, vitima.esp.tipo);
  aplicaDano(b, vitima, Math.round(g.dano * atacante.forca * m),
    normXZ(sub(vitima.pos, atacante.pos)), g.empurrao, g.forte, emitir, 0.5, ef);
  // estilo Hollow Knight: golpe FÍSICO certeiro reabastece o ki
  if (g.fisico) ganhaKi(atacante, 12);
}

/* projéteis: golpes elementais voam até o alvo — inclusive disparados do
   ar, mirando na altura de quem recebe; pular na hora certa ainda esquiva */
function disparaProjetil(b, f, outro, g, cfg, emitir, desvio = null) {
  const dir = normXZ(sub(outro.pos, f.pos));
  const pos = soma(copia(f.pos), vec(dir.x * 0.7, f.pos.y + 0.9, dir.z * 0.7));
  // desvio de formação (ex.: Pentachama): desloca no plano perpendicular ao
  // voo e mira num alvo igualmente deslocado — os tiros viajam em paralelo
  if (desvio) {
    pos.x += -dir.z * desvio.lat; pos.z += dir.x * desvio.lat;
    pos.y += desvio.alt;
  }
  const vel = escala(dir, cfg.vel);
  const tVoo = Math.max(0.15, distXZ(pos, outro.pos) / cfg.vel);
  vel.y = ((outro.pos.y + 0.6 + (desvio ? desvio.alt * 0.4 : 0)) - pos.y) / tVoo;
  b.projeteis.push({
    id: b.projId++, dono: f, alvo: outro,
    pos, vel,
    dano: g.dano, empurrao: g.empurrao, raio: cfg.raio,
    // tiros de rajada dão invulnerabilidade curtinha: a sequência inteira conecta
    rajada: !!g.rajada,
    vida: 1.8, tipo: g.tipo || f.esp.tipo,
    visual: g.visual || null,
  });
  emitir({ tipo: 'projetil', pos: copia(pos), elemento: g.tipo || f.esp.tipo });
}
function passoProjeteis(b, dt, emitir) {
  for (let i = b.projeteis.length - 1; i >= 0; i--) {
    const pr = b.projeteis[i];
    pr.pos = soma(pr.pos, escala(pr.vel, dt));
    pr.vida -= dt;
    const alvo = pr.alvo;
    const centroY = alvo.pos.y + 0.6;
    if (alvo.estado !== 'ko' && alvo.invuln <= 0 &&
        distXZ(pr.pos, alvo.pos) < pr.raio && Math.abs(pr.pos.y - centroY) < 0.8) {
      const { m, ef } = eficacia(b.tipos, pr.tipo, alvo.esp.tipo);
      aplicaDano(b, alvo, Math.round(pr.dano * pr.dono.forca * m),
        normXZ(pr.vel), pr.empurrao, true, emitir, pr.rajada ? 0.08 : 0.5, ef);
      b.projeteis.splice(i, 1);
    } else if (pr.vida <= 0 || Math.hypot(pr.pos.x, pr.pos.z) > ARENA.raio + 4) {
      b.projeteis.splice(i, 1);
    }
  }
}

// tenta iniciar o golpe do slot pedido (forte = via combo de direções).
// Golpes com usos limitados gastam 1 por acionamento; sem usos, nega.
function tentaGolpe(f, inp, emitir) {
  const s = f.slots[inp.golpe];
  if (!s || !s.def) return;
  const escolhido = (inp.forte && s.forte) ? s.forte : s;
  const g = escolhido.def;
  const podeNoAr = !!(g.projetil || g.rajada || g.feixe);
  if (f.pos.y > 0.01 && !podeNoAr) return;
  const custo = custoEnergia(g);
  if (f.energia < custo) { emitir({ tipo: 'semEnergia', nome: g.nome }); return; }
  // usos: a versão FORTE bebe do mesmo pote da base, gastando 2 (a simples
  // gasta 1). Golpes físicos não têm pote (infinitos).
  const pote = g.base || escolhido.id;
  const custoUsos = g.base ? 2 : 1;
  if (f.usos[pote] !== undefined) {
    if (f.usos[pote] < custoUsos) { emitir({ tipo: 'semUsos', nome: g.nome }); return; }
    f.usos[pote] -= custoUsos;
  }
  f.energia -= custo;
  f.estado = 'atk'; f.golpe = g; f.t = 0; f.acertou = false; f.tiros = 0;
  f.talhou = false; f.comboQ = false;
  if (inp.forte && s.forte) emitir({ tipo: 'comando', nome: g.nome, pos: copia(f.pos) });
  else if (podeNoAr) emitir({ tipo: 'especial' });
  else emitir({ tipo: 'swing' });
  emitir({ tipo: 'golpeUsado' });
}

function passoLutador(b, f, inp, outro, dt, emitir) {
  const p = f.pos;
  f.carregando = false; // só o ramo "idle" pode reativar neste frame
  if (f.estado === 'ko') { f.t += dt; return; }
  if (f.estado === 'hurt') {
    f.t += dt;
    f.pos = soma(p, escala(f.kb, dt));
    f.kb = escala(f.kb, 1 - 3 * dt);
    if (f.t > 0.26) f.estado = 'idle';
  } else if (f.estado === 'dash') {
    // salto-esquiva (dois toques na direção): rápido, com invulnerabilidade
    f.t += dt;
    f.pos = soma(p, escala(f.dashDir, f.esp.velocidade * 2.6 * dt));
    // GIRO NO AR: pular durante a cambalhota lança o giro para o alto,
    // continuando a deslizar na direção da esquiva (1x por cambalhota —
    // o pulinho dela mesma deixa y > 0, então não dá para exigir chão)
    if (inp.pulo && f.giroAr <= 0) {
      f.vy = f.esp.impulso * 0.95;
      f.giroAr = 0.4;
      f.piruetando = true; // a pirueta visual dura o voo INTEIRO
      emitir({ tipo: 'pulo' });
    }
    if (f.t > 0.28) f.estado = 'idle';
  } else if (f.estado === 'atk') {
    f.t += dt;
    const g = f.golpe;
    if (g.feixe) {
      // FEIXE instantâneo (trovão/energia): telegrafa na preparação e crava
      if (!f.acertou && f.t >= g.prep) {
        f.acertou = true;
        const de = { x: f.pos.x, y: f.pos.y + 1.1, z: f.pos.z };
        const para = { x: outro.pos.x, y: outro.pos.y + 0.7, z: outro.pos.z };
        emitir({ tipo: 'feixe', de, para, elemento: g.tipo || f.esp.tipo, visual: g.visual || null });
        if (outro.estado !== 'ko' && outro.invuln <= 0 &&
            distXZ(f.pos, outro.pos) <= (g.feixe.alcance || 8)) {
          const { m, ef } = eficacia(b.tipos, g.tipo || f.esp.tipo, outro.esp.tipo);
          aplicaDano(b, outro, Math.round(g.dano * f.forca * m),
            normXZ(sub(outro.pos, f.pos)), g.empurrao, true, emitir, 0.5, ef);
        }
      }
    } else if (g.rajada) {
      if (f.tiros < g.rajada.tiros && f.t >= g.prep + f.tiros * g.rajada.intervalo) {
        f.tiros++;
        disparaProjetil(b, f, outro, g, g.rajada, emitir);
      }
    } else if (g.projetil) {
      if (!f.acertou && f.t >= g.prep) {
        f.acertou = true;
        if (g.formacao) {
          // salva de projéteis em FORMAÇÃO (Pentachama: 5 pontas, uma p/ cima)
          const n = g.formacao.lados || 5, R = g.formacao.raio || 0.85;
          for (let i = 0; i < n; i++) {
            const a = Math.PI / 2 + i * (Math.PI * 2 / n);
            disparaProjetil(b, f, outro, g, g.projetil, emitir,
              { lat: Math.cos(a) * R, alt: Math.sin(a) * R });
          }
        } else disparaProjetil(b, f, outro, g, g.projetil, emitir);
      }
    } else if (f.t >= g.prep && f.t <= g.prep + g.ativo) {
      const frente = normXZ(sub(outro.pos, p));
      // o TALHO branco nasce no instante em que o golpe corta o ar
      if (!f.talhou && g.fisico) {
        f.talhou = true;
        emitir({ tipo: 'talho', pos: soma(copia(f.pos), escala(frente, 1.0)),
                 clipe: g.clipe || null, forte: !!g.forte });
      }
      // "avanco" nos dados: a Investida dispara o corpo firme para a frente
      f.pos = soma(p, escala(frente, (g.avanco || (g.forte ? 3 : 4.5)) * dt));
      if (g.forte) emitir({ tipo: 'rastroFogo', pos: soma(copia(f.pos), escala(frente, 1.1)) });
      if (!f.acertou && distXZ(f.pos, outro.pos) < g.alcance &&
          outro.invuln <= 0 && outro.estado !== 'ko') {
        f.acertou = true;
        acerta(b, outro, f, g, emitir);
      }
    }
    // COMBO: apertar golpe de novo durante um físico ENCAIXA o próximo da
    // cadeia (golpe.proximo), cancelando parte da recuperação — o aperto
    // vale em QUALQUER momento do golpe (buffer, como em jogo de luta)
    if (inp.golpe != null && g.fisico && g.proximo) f.comboQ = true;
    const encaixa = f.comboQ && g.proximo && b.catalogo && b.catalogo[g.proximo];
    if (encaixa && f.t >= g.prep + g.ativo + g.recup * 0.4) {
      f.golpe = b.catalogo[g.proximo];
      f.t = 0; f.acertou = false; f.talhou = false; f.comboQ = false; f.tiros = 0;
      emitir({ tipo: 'combo', nome: f.golpe.nome, pos: copia(f.pos) });
    } else if (f.t >= g.prep + g.ativo + g.recup) { f.estado = 'idle'; f.golpe = null; }
  } else {
    // CARREGAR ki: parado no chão, segurando o botão — lento e vulnerável.
    // Depois de 45s de luta, a "fúria do crepúsculo" dobra a carga.
    f.carregando = !!inp.carregar && f.pos.y <= 0.01 && f.energia < 100;
    if (f.carregando) {
      const crepusculo = (b.tempo || 0) > 45 ? 2 : 1;
      ganhaKi(f, 16 * crepusculo * dt);
      f.movendo = false;
    } else {
      f.movendo = inp.mov.x !== 0 || inp.mov.z !== 0;
      if (f.movendo) {
        const mag = Math.min(1, Math.hypot(inp.mov.x, inp.mov.z));
        f.pos = soma(p, escala(normXZ(vec(inp.mov.x, 0, inp.mov.z)), f.esp.velocidade * mag * dt));
      }
      if (inp.dash && f.pos.y <= 0.01) {
        f.estado = 'dash'; f.t = 0;
        f.dashDir = normXZ(vec(inp.dash.x, 0, inp.dash.z));
        f.dashRel = inp.dashRel || null; // direção relativa (para a animação)
        f.invuln = Math.max(f.invuln, 0.3);
        f.giroAr = 0; // cada cambalhota dá direito a UM giro no ar
        f.vy = 3.5; // pulinho da cambalhota
        emitir({ tipo: 'dash' });
      }
      else if (inp.pulo) {
        if (f.pos.y <= 0.01) { f.vy = f.esp.impulso; f.pulosAr = 0; emitir({ tipo: 'pulo' }); }
        // feras VOADORAS batem asas: até dois pulos extras no ar
        else if (f.esp.voa && f.pulosAr < 2) {
          f.pulosAr++;
          f.vy = f.esp.impulso * 0.85;
          emitir({ tipo: 'pulo' });
        }
      }
      else if (inp.golpe != null) tentaGolpe(f, inp, emitir);
    }
  }
  ganhaKi(f, 2 * dt); // o ki pinga sozinho, como elixir
  // giro no ar: o impulso da cambalhota continua deslizando lá em cima
  if (f.giroAr > 0) {
    if (f.pos.y > 0.01) f.pos = soma(f.pos, escala(f.dashDir, f.esp.velocidade * 1.9 * dt));
    f.giroAr -= dt;
  }
  f.vy -= GRAVIDADE * dt;
  f.pos.y = Math.max(0, f.pos.y + f.vy * dt);
  if (f.pos.y === 0) { f.vy = Math.max(0, f.vy); f.pulosAr = 0; f.piruetando = false; }
  const r = Math.hypot(f.pos.x, f.pos.z);
  if (r > ARENA.raio) {
    f.pos.x *= ARENA.raio / r; f.pos.z *= ARENA.raio / r;
    // perigo da arena: no deserto, a beirada tem cactos que espetam
    if (b.bioma === 'deserto' && f.estado !== 'ko' && f.espinhoT <= 0) {
      f.espinhoT = 0.7;
      f.hp = Math.max(0, f.hp - 2);
      f.estado = 'hurt'; f.t = 0; f.flash = 1;
      f.kb = escala(normXZ(vec(-f.pos.x, 0, -f.pos.z)), 5);
      emitir({ tipo: 'espinho', pos: copia(f.pos), dano: 2 });
      if (f.hp <= 0) {
        f.estado = 'ko'; f.t = 0;
        b.fim = true; b.fimT = 1.4;
        b.resultado = (f === b.e) ? 'vitoria' : 'derrota';
        emitir({ tipo: b.resultado });
      }
    }
  }
  if (f.espinhoT > 0) f.espinhoT -= dt;
  if (f.invuln > 0) f.invuln -= dt;
  if (f.flash > 0) f.flash -= dt * 4;
}

function iaSelvagem(b, dt, rnd) {
  const e = b.e, p = b.p;
  const inp = { mov: vec(), pulo: false, golpe: null, forte: false, dash: null };
  if (e.estado !== 'idle') return inp;
  b.aiT -= dt;
  const dist = distXZ(e.pos, p.pos);
  const dir = normXZ(sub(p.pos, e.pos));
  // sem ki e longe do perigo: a IA para e CARREGA, como um jogador faria
  // (a carga é lenta — ela desiste cedo se o perigo se aproximar)
  if (b.iaCarrega) {
    if (e.energia >= 60 || dist < 3.6) b.iaCarrega = false;
    else { inp.carregar = true; return inp; }
  }
  // fúria: quanto mais machucada, mais rápida e agressiva a fera fica
  const furia = 1 - e.hp / e.max;
  if (b.aiT <= 0) {
    if (e.energia < 15 && dist > 5 && rnd() < 0.6) { b.iaCarrega = true; return inp; }
    b.aiT = (0.55 + rnd() * 0.5) * (1 - 0.45 * furia);
    if (dist > 4.5) b.iaMov = rnd() < 0.55 + 0.3 * furia ? escala(dir, 0.65 + 0.3 * furia) : null;
    else if (dist > 2.2) b.iaMov = rnd() < 0.75 ? escala(dir, 0.8) : null;
    else {
      // a IA gera os mesmos inputs abstratos que um jogador (GDD §9.6/§12)
      const r = rnd();
      const livres = e.slots
        .map((s, i) => i)
        .filter((i) => {
          const s = e.slots[i];
          return s.def.usos == null || (e.usos[s.id] || 0) >= 1;
        });
      if (r < 0.6 + 0.25 * furia && livres.length) {
        inp.golpe = livres[Math.floor(rnd() * livres.length)];
        const s = e.slots[inp.golpe];
        // a forte gasta 2 do pote da base — a IA só arrisca se tiver
        if (s.forte && rnd() < 0.25 + 0.3 * furia &&
            (s.def.usos == null || (e.usos[s.id] || 0) >= 2)) inp.forte = true;
        b.iaMov = null;
      }
      else if (r < 0.85) b.iaMov = escala(dir, -0.8);
      else { inp.pulo = true; b.iaMov = dir; }
    }
    // esquiva: rola de lado (cambalhota) ou pula quando o jogador ataca forte
    if (p.estado === 'atk' && p.golpe && p.golpe.forte && dist < 4.5 &&
        rnd() < 0.35 + 0.35 * furia) {
      if (rnd() < 0.6) {
        const lado = rnd() < 0.5 ? 1 : -1;
        inp.dash = escala(perpXZ(dir), lado);
        inp.dashRel = { x: lado, z: 0 };
        b.iaMov = null;
      } else inp.pulo = true;
    }
  }
  if (b.iaMov) inp.mov = b.iaMov;
  return inp;
}

export function lancaCristal(b, emitir) {
  // o cristal sai de TRÁS da fera (do lado do treinador/câmera), não dela
  const dir = normXZ(sub(b.e.pos, b.p.pos));
  b.captura = { fase: 'voo', t: 0, wob: 0,
    pos: soma(copia(b.p.pos), vec(-dir.x * 1.8, 2.1, -dir.z * 1.8)) };
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
      const chance = chanceCaptura(b);
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

const INPUT_NEUTRO = { mov: { x: 0, z: 0 }, pulo: false, golpe: null, forte: false, dash: null };

// inpP = { mov:{x,z} relativo ao lock-on, pulo, golpe: 0-3|null, forte,
//          correr, capturar }
// Retorna 'encerrar' quando a batalha terminou de vez (após a pausa final).
export function passoBatalha(b, inpP, dt, emitir, rnd = Math.random) {
  b.tempo = (b.tempo || 0) + dt; // relógio da luta (fúria do crepúsculo)
  if (b.fim) {
    passoLutador(b, b.p, INPUT_NEUTRO, b.e, dt, emitir);
    passoLutador(b, b.e, INPUT_NEUTRO, b.p, dt, emitir);
    passoProjeteis(b, dt, emitir);
    b.fimT -= dt;
    return b.fimT <= 0 ? 'encerrar' : null;
  }
  if (b.captura) { passoCaptura(b, dt, emitir, rnd); return null; }
  passoProjeteis(b, dt, emitir);

  // converte o input relativo (frente/trás/lados) em direção no mundo;
  // orbitar perto do alvo fica mais lento (o giro angular ficava frenético)
  const fw = normXZ(sub(b.e.pos, b.p.pos));
  const rt = perpXZ(fw);
  const distPE = distXZ(b.p.pos, b.e.pos);
  const freioOrbita = Math.max(0.45, Math.min(1, distPE / 4.5));
  const mov = soma(escala(fw, -inpP.mov.z), escala(rt, inpP.mov.x * freioOrbita));
  const dash = inpP.dash
    ? soma(escala(fw, -inpP.dash.z), escala(rt, inpP.dash.x))
    : null;
  passoLutador(b, b.p, { mov, pulo: inpP.pulo, golpe: inpP.golpe, forte: inpP.forte,
    carregar: inpP.carregar, dash, dashRel: inpP.dash }, b.e, dt, emitir);
  passoLutador(b, b.e, iaSelvagem(b, dt, rnd), b.p, dt, emitir);
  separaCorpos(b);
  if (inpP.capturar && podeCapturar(b)) lancaCristal(b, emitir);
  return null;
}

// os corpos são SÓLIDOS: uma fera não atravessa a outra — cada uma cede
// metade do empurrão (pular por CIMA continua valendo)
function separaCorpos(b) {
  const p = b.p, e = b.e;
  if (p.estado === 'ko' || e.estado === 'ko') return;
  if (Math.abs(p.pos.y - e.pos.y) > 1.0) return;
  const d = distXZ(p.pos, e.pos), MIN = 1.15;
  if (d >= MIN || d < 0.001) return;
  const dir = normXZ(sub(e.pos, p.pos));
  const emp = (MIN - d) / 2;
  p.pos.x -= dir.x * emp; p.pos.z -= dir.z * emp;
  e.pos.x += dir.x * emp; e.pos.z += dir.z * emp;
}
