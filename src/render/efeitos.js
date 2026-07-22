// EFEITOS 2.5D — golpes elementais como sprites animados (billboards):
// folhas de quadros desenhadas por código num canvas 2D, tocadas como
// flipbook em planos que sempre encaram a câmera, com blending aditivo
// (fogo/raio/água BRILHAM em vez de tapar o fundo). Camada 100% visual:
// a simulação não sabe que isso existe.
import * as THREE from 'three';

const QUADROS = 8, TAM = 96, POOL_MAX = 24;

/* ---------- pintura das folhas (1 função por elemento) ---------- */
// cada quadro recebe k = fração do ciclo (0..1) e pinta em TAM x TAM

function pintaFogo(ctx, k, s) {
  // labareda: bolas de luz empilhadas da base à ponta, dançando com o quadro
  ctx.globalCompositeOperation = 'lighter';
  const cx = s / 2, n = 7;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1); // 0 = base, 1 = ponta
    const y = s * 0.8 - t * s * 0.6;
    const x = cx + Math.sin(k * 12.6 + i * 1.7) * s * 0.07 * (0.3 + t);
    const r = s * 0.28 * (1 - t * 0.72) * (0.85 + 0.25 * Math.sin(k * 6.3 + i * 2.1));
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,235,0.95)');
    g.addColorStop(0.3, 'rgba(255,214,80,0.85)');
    g.addColorStop(0.65, 'rgba(255,110,30,0.55)');
    g.addColorStop(1, 'rgba(190,30,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 6.284); ctx.fill();
  }
}

function pintaEletrico(ctx, k, s) {
  // núcleo brilhante + raios serrilhados que mudam de lugar a cada quadro
  ctx.globalCompositeOperation = 'lighter';
  const cx = s / 2, cy = s / 2;
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, s * 0.3);
  g.addColorStop(0, 'rgba(255,255,220,0.9)');
  g.addColorStop(0.5, 'rgba(255,230,90,0.4)');
  g.addColorStop(1, 'rgba(255,220,60,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
  for (let i = 0; i < 5; i++) {
    let x = cx, y = cy, a = (i / 5) * 6.284 + k * 6.284;
    const pts = [[x, y]];
    for (let seg = 0; seg < 4; seg++) {
      a += Math.sin(k * 31 + i * 7 + seg * 13) * 0.9;
      x += Math.cos(a) * s * 0.11; y += Math.sin(a) * s * 0.11;
      pts.push([x, y]);
    }
    // halo largo por baixo, fio branco por cima
    for (const [lw, cor] of [[5, 'rgba(255,235,120,0.35)'], [2, 'rgba(255,255,255,0.95)']]) {
      ctx.lineWidth = lw; ctx.strokeStyle = cor; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
      for (let p = 1; p < pts.length; p++) ctx.lineTo(pts[p][0], pts[p][1]);
      ctx.stroke();
    }
  }
}

function pintaAgua(ctx, k, s) {
  // respingo luminoso + bolhas com brilho que orbitam e escapam
  ctx.globalCompositeOperation = 'lighter';
  const cx = s / 2, cy = s / 2;
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, s * 0.34);
  g.addColorStop(0, 'rgba(210,240,255,0.9)');
  g.addColorStop(0.5, 'rgba(90,170,255,0.5)');
  g.addColorStop(1, 'rgba(30,80,200,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
  for (let i = 0; i < 6; i++) {
    const fase = (k + i * 0.17) % 1;
    const a = i * 1.05 + k * 6.284, rr = s * (0.12 + 0.26 * fase);
    const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
    const rb = s * 0.05 * (1.2 - fase * 0.7);
    ctx.strokeStyle = 'rgba(210,240,255,0.85)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, rb, 0, 6.284); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath(); ctx.arc(x - rb * 0.35, y - rb * 0.35, rb * 0.22, 0, 6.284); ctx.fill();
  }
}

function pintaPlanta(ctx, k, s) {
  // redemoinho de folhas: elipses verdes girando em volta de um brilho suave
  ctx.globalCompositeOperation = 'lighter';
  const cx = s / 2, cy = s / 2;
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, s * 0.3);
  g.addColorStop(0, 'rgba(210,255,190,0.75)');
  g.addColorStop(0.6, 'rgba(110,220,90,0.35)');
  g.addColorStop(1, 'rgba(40,140,40,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
  const cores = ['rgba(120,220,80,0.95)', 'rgba(80,180,60,0.9)', 'rgba(170,240,120,0.9)'];
  for (let i = 0; i < 7; i++) {
    const a = i * 0.9 + k * 6.284;               // órbita gira com o quadro
    const rr = s * (0.1 + 0.22 * ((k + i * 0.14) % 1));
    const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
    ctx.fillStyle = cores[i % cores.length];
    ctx.save(); ctx.translate(x, y); ctx.rotate(a + k * 9 + i);
    ctx.beginPath(); // folha = elipse com ponta
    ctx.ellipse(0, 0, s * 0.075, s * 0.03, 0, 0, 6.284);
    ctx.fill();
    ctx.restore();
  }
}

function pintaImpacto(ctx, k, s) {
  // estouro estilo jogo de luta: clarão, anel que expande e lascas em estrela
  // (aqui k é a LINHA DO TEMPO do efeito: quadro 0 = nasce, último = some)
  ctx.globalCompositeOperation = 'lighter';
  const cx = s / 2, cy = s / 2, vida = 1 - k;
  if (k < 0.4) {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, s * 0.28);
    g.addColorStop(0, `rgba(255,255,255,${0.9 * (0.4 - k) / 0.4})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
  }
  ctx.strokeStyle = `rgba(255,245,210,${0.9 * vida})`;
  ctx.lineWidth = Math.max(1, vida * 7);
  ctx.beginPath(); ctx.arc(cx, cy, s * (0.1 + 0.36 * k), 0, 6.284); ctx.stroke();
  for (let i = 0; i < 8; i++) {
    const L = s * (0.16 + 0.3 * k), W = s * 0.035 * vida;
    ctx.fillStyle = `rgba(255,230,140,${0.85 * vida})`;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate((i / 8) * 6.284 + 0.4);
    ctx.beginPath(); ctx.moveTo(s * 0.06, 0); ctx.lineTo(L, -W);
    ctx.lineTo(L * 1.15, 0); ctx.lineTo(L, W); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}

/* ---------- montagem das folhas e texturas ---------- */

function desenhaSheet(pinta) {
  const cv = document.createElement('canvas');
  cv.width = TAM * QUADROS; cv.height = TAM;
  const ctx = cv.getContext('2d');
  for (let f = 0; f < QUADROS; f++) {
    ctx.save();
    ctx.beginPath(); ctx.rect(f * TAM, 0, TAM, TAM); ctx.clip();
    ctx.translate(f * TAM, 0);
    pinta(ctx, f / QUADROS, TAM);
    ctx.restore();
  }
  return cv;
}

function fazTex(cv) {
  const t = new THREE.CanvasTexture(cv);
  t.repeat.set(1 / QUADROS, 1);
  return t;
}

const FOLHA_DO_TIPO = { fogo: 'fogo', eletrico: 'eletrico', agua: 'agua', planta: 'planta' };

// folha de chamas para uso do cenário (fogueira da vila, tochas...)
export function texturaChamaAnimada() {
  return { tex: fazTex(desenhaSheet(pintaFogo)), quadros: QUADROS };
}

export function criarEfeitos(scene) {
  const canvases = {
    fogo: desenhaSheet(pintaFogo),
    eletrico: desenhaSheet(pintaEletrico),
    agua: desenhaSheet(pintaAgua),
    planta: desenhaSheet(pintaPlanta),
    impacto: desenhaSheet(pintaImpacto),
  };
  // POOL de efeitos inteiros (sprite+material+textura): reciclar em vez de
  // criar/destruir evita picos de coletor de lixo e uploads à GPU
  const pools = {};
  for (const nome of Object.keys(canvases)) pools[nome] = [];
  function pegaEfeito(nome) {
    const usado = pools[nome].pop();
    if (usado) return usado;
    const tex = fazTex(canvases[nome]);
    const mat = new THREE.SpriteMaterial({
      map: tex, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const sp = new THREE.Sprite(mat);
    scene.add(sp);
    return { nome, tex, mat, sp };
  }

  let ativos = [];
  function novo(nome, o) {
    const e = pegaEfeito(nome);
    e.mat.rotation = o.rot || 0;
    e.mat.opacity = o.op == null ? 1 : o.op;
    e.sp.scale.set(o.escala, o.escala, 1);
    e.sp.visible = true;
    e.morto = false;
    e.t = 0; e.fps = o.fps || 16; e.dur = o.dur; e.loop = !!o.loop;
    e.vel = o.vel; e.cresce = o.cresce || 0; e.gira = o.gira || 0;
    e.op0 = o.op == null ? 1 : o.op; e.escala0 = o.escala;
    ativos.push(e);
    return e;
  }
  function mata(e) {
    if (e.morto) return;
    e.morto = true;
    e.sp.visible = false;
    if (pools[e.nome].length < POOL_MAX) pools[e.nome].push(e);
    else { scene.remove(e.sp); e.mat.dispose(); e.tex.dispose(); }
  }

  return {
    // bola elemental em loop; quem chama posiciona a cada frame e remove no
    // fim — o tamanho acompanha o raio do golpe (supremos são enormes)
    projetil(tipo, rajada, raio = 0.85) {
      return novo(FOLHA_DO_TIPO[tipo] || 'fogo', {
        escala: rajada ? 1.25 : raio * 2, fps: 18, loop: true,
        rot: Math.random() * 6.284, gira: rajada ? 0 : 2.2,
      });
    },
    posiciona(e, pos) { e.sp.position.set(pos.x, pos.y, pos.z); },
    removeProjetil(e) { mata(e); },

    // estouro de acerto (anel + lascas), maior no golpe forte
    impacto(pos, forte) {
      const e = novo('impacto', {
        escala: forte ? 2.6 : 1.6, dur: forte ? 0.3 : 0.22,
        rot: Math.random() * 6.284,
      });
      e.sp.position.set(pos.x, pos.y + 0.9, pos.z);
    },

    // língua de chama/raio/água que voa da boca na direção do alvo
    sopro(origem, dir, tipo, vel = 10) {
      const v = vel * (0.75 + Math.random() * 0.5);
      const e = novo(FOLHA_DO_TIPO[tipo] || 'fogo', {
        escala: 0.8 + Math.random() * 0.5, dur: 0.32, fps: 20,
        rot: Math.random() * 6.284, cresce: 2.4,
        vel: { x: dir.x * v, y: dir.y * v, z: dir.z * v },
      });
      e.sp.position.set(origem.x, origem.y, origem.z);
    },

    passo(dt) {
      let sujo = false;
      for (const e of ativos) {
        if (e.morto) { sujo = true; continue; }
        e.t += dt;
        // loop = flipbook cíclico; efeito único = a vida percorre a folha
        const q = e.loop
          ? Math.floor(e.t * e.fps) % QUADROS
          : Math.min(QUADROS - 1, Math.floor((e.t / e.dur) * QUADROS));
        e.tex.offset.x = q / QUADROS;
        if (e.vel) {
          e.sp.position.x += e.vel.x * dt;
          e.sp.position.y += e.vel.y * dt;
          e.sp.position.z += e.vel.z * dt;
        }
        if (e.gira) e.mat.rotation += e.gira * dt;
        let s = e.escala0 + e.cresce * e.t;
        if (e.loop) s *= 0.92 + Math.random() * 0.16; // tremeluz
        e.sp.scale.set(s, s, 1);
        if (!e.loop) {
          const k = e.t / e.dur;
          e.mat.opacity = e.op0 * (1 - k * k);
          if (k >= 1) { mata(e); sujo = true; }
        }
      }
      if (sujo) ativos = ativos.filter((e) => !e.morto);
    },
  };
}
