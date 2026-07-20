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
  };
}

export function criarBatalha(especies, jogador, selvagem, posDomador, posSelvagem) {
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
  };
}

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

export function podeCapturar(b) {
  return !b.fim && !b.captura && b.e.estado !== 'ko' && b.e.hp / b.e.max <= 0.35;
}

function aplicaDano(b, vitima, dano, dirKb, empurrao, forte, emitir) {
  vitima.hp = Math.max(0, vitima.hp - dano);
  vitima.estado = 'hurt'; vitima.t = 0;
  vitima.invuln = 0.5; vitima.flash = 1;
  vitima.kb = escala(dirKb, empurrao);
  emitir({ tipo: forte ? 'hitForte' : 'hit', pos: copia(vitima.pos), dano, forte });
  if (vitima.hp <= 0) {
    vitima.estado = 'ko'; vitima.t = 0;
    b.fim = true; b.fimT = 1.4;
    b.resultado = (vitima === b.e) ? 'vitoria' : 'derrota';
    emitir({ tipo: b.resultado });
  }
}
function acerta(b, vitima, atacante, g, emitir) {
  aplicaDano(b, vitima, Math.round(g.dano * atacante.forca),
    normXZ(sub(vitima.pos, atacante.pos)), g.empurrao, g.forte, emitir);
}

/* projéteis: golpes elementais voam até o alvo — inclusive disparados do
   ar, mirando na altura de quem recebe; pular na hora certa ainda esquiva */
function disparaProjetil(b, f, outro, g, cfg, emitir) {
  const dir = normXZ(sub(outro.pos, f.pos));
  const pos = soma(copia(f.pos), vec(dir.x * 0.7, f.pos.y + 0.9, dir.z * 0.7));
  const vel = escala(dir, cfg.vel);
  const tVoo = Math.max(0.15, distXZ(pos, outro.pos) / cfg.vel);
  vel.y = ((outro.pos.y + 0.6) - pos.y) / tVoo;
  b.projeteis.push({
    id: b.projId++, dono: f, alvo: outro,
    pos, vel,
    dano: g.dano, empurrao: g.empurrao, raio: cfg.raio,
    vida: 1.8, tipo: g.tipo || f.esp.tipo,
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
      aplicaDano(b, alvo, Math.round(pr.dano * pr.dono.forca),
        normXZ(pr.vel), pr.empurrao, true, emitir);
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
  const podeNoAr = !!(g.projetil || g.rajada);
  if (f.pos.y > 0.01 && !podeNoAr) return;
  if (g.usos != null) {
    if ((f.usos[escolhido.id] || 0) <= 0) { emitir({ tipo: 'semUsos', nome: g.nome }); return; }
    f.usos[escolhido.id]--;
  }
  f.estado = 'atk'; f.golpe = g; f.t = 0; f.acertou = false; f.tiros = 0;
  if (inp.forte && s.forte) emitir({ tipo: 'comando', nome: g.nome, pos: copia(f.pos) });
  else if (podeNoAr) emitir({ tipo: 'especial' });
  else emitir({ tipo: 'swing' });
  emitir({ tipo: 'golpeUsado' });
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
    if (g.rajada) {
      if (f.tiros < g.rajada.tiros && f.t >= g.prep + f.tiros * g.rajada.intervalo) {
        f.tiros++;
        disparaProjetil(b, f, outro, g, g.rajada, emitir);
      }
    } else if (g.projetil) {
      if (!f.acertou && f.t >= g.prep) {
        f.acertou = true;
        disparaProjetil(b, f, outro, g, g.projetil, emitir);
      }
    } else if (f.t >= g.prep && f.t <= g.prep + g.ativo) {
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
    if (inp.mov.x !== 0 || inp.mov.z !== 0) {
      const mag = Math.min(1, Math.hypot(inp.mov.x, inp.mov.z));
      const vel = f.esp.velocidade * mag * (inp.correr ? 1.5 : 1);
      f.pos = soma(p, escala(normXZ(vec(inp.mov.x, 0, inp.mov.z)), vel * dt));
    }
    if (inp.pulo && f.pos.y <= 0.01) { f.vy = f.esp.impulso; emitir({ tipo: 'pulo' }); }
    if (inp.golpe != null) tentaGolpe(f, inp, emitir);
  }
  f.vy -= GRAVIDADE * dt;
  f.pos.y = Math.max(0, f.pos.y + f.vy * dt);
  if (f.pos.y === 0) f.vy = Math.max(0, f.vy);
  const r = Math.hypot(f.pos.x, f.pos.z);
  if (r > ARENA.raio) { f.pos.x *= ARENA.raio / r; f.pos.z *= ARENA.raio / r; }
  if (f.invuln > 0) f.invuln -= dt;
  if (f.flash > 0) f.flash -= dt * 4;
}

function iaSelvagem(b, dt, rnd) {
  const e = b.e, p = b.p;
  const inp = { mov: vec(), pulo: false, golpe: null, forte: false };
  if (e.estado !== 'idle') return inp;
  b.aiT -= dt;
  const dist = distXZ(e.pos, p.pos);
  const dir = normXZ(sub(p.pos, e.pos));
  if (b.aiT <= 0) {
    // ritmo calmo: decide com menos frequência e avança devagar
    b.aiT = 0.55 + rnd() * 0.5;
    if (dist > 4.5) b.iaMov = rnd() < 0.55 ? escala(dir, 0.65) : null;
    else if (dist > 2.2) b.iaMov = rnd() < 0.75 ? escala(dir, 0.8) : null;
    else {
      // a IA gera os mesmos inputs abstratos que um jogador (GDD §9.6/§12)
      const r = rnd();
      const livres = e.slots
        .map((s, i) => i)
        .filter((i) => {
          const s = e.slots[i];
          return s.def.usos == null || (e.usos[s.id] || 0) > 0;
        });
      if (r < 0.6 && livres.length) {
        inp.golpe = livres[Math.floor(rnd() * livres.length)];
        const s = e.slots[inp.golpe];
        if (s.forte && rnd() < 0.25) {
          const fd = s.forte.def;
          if (fd.usos == null || (e.usos[s.forte.id] || 0) > 0) inp.forte = true;
        }
        b.iaMov = null;
      }
      else if (r < 0.85) b.iaMov = escala(dir, -0.8);
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

const INPUT_NEUTRO = { mov: { x: 0, z: 0 }, pulo: false, golpe: null, forte: false };

// inpP = { mov:{x,z} relativo ao lock-on, pulo, golpe: 0-3|null, forte,
//          correr, capturar }
// Retorna 'encerrar' quando a batalha terminou de vez (após a pausa final).
export function passoBatalha(b, inpP, dt, emitir, rnd = Math.random) {
  if (b.fim) {
    passoLutador(b, b.p, INPUT_NEUTRO, b.e, dt, emitir);
    passoLutador(b, b.e, INPUT_NEUTRO, b.p, dt, emitir);
    passoProjeteis(b, dt, emitir);
    b.fimT -= dt;
    return b.fimT <= 0 ? 'encerrar' : null;
  }
  if (b.captura) { passoCaptura(b, dt, emitir, rnd); return null; }
  passoProjeteis(b, dt, emitir);

  // converte o input relativo (frente/trás/lados) em direção no mundo
  const fw = normXZ(sub(b.e.pos, b.p.pos));
  const rt = perpXZ(fw);
  const mov = soma(escala(fw, -inpP.mov.z), escala(rt, inpP.mov.x)); // ↑ = aproximar
  passoLutador(b, b.p, { mov, pulo: inpP.pulo, golpe: inpP.golpe, forte: inpP.forte, correr: inpP.correr }, b.e, dt, emitir);
  passoLutador(b, b.e, iaSelvagem(b, dt, rnd), b.p, dt, emitir);
  if (inpP.capturar && podeCapturar(b)) lancaCristal(b, emitir);
  return null;
}
