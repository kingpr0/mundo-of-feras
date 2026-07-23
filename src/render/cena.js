// CENA — Three.js: luz, cenário dos mapas (montados a partir de mapas.json),
// arena de batalha, partículas e as duas câmeras (exploração e lock-on).
import * as THREE from 'three';
import { alturaTerreno, alturaMorros } from '../sim/mundo.js';
import { criarNPC } from './modelos.js';
import { texturaChamaAnimada } from './efeitos.js';

export function criarCena(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9fd0ff);
  scene.fog = new THREE.Fog(0xf0dcc0, 30, 70);
  const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 200);

  const sol = new THREE.DirectionalLight(0xffd9a0, 1.25);
  sol.position.set(14, 13, 7); sol.castShadow = true;
  sol.shadow.mapSize.set(2048, 2048);
  sol.shadow.camera.left = -30; sol.shadow.camera.right = 30;
  sol.shadow.camera.top = 30; sol.shadow.camera.bottom = -30;
  scene.add(sol);
  scene.add(new THREE.HemisphereLight(0xbcd9ff, 0x3a5a34, 0.55));

  // mundo e arena são grupos alternáveis: a batalha acontece num ringue
  // separado, estilizado pelo bioma (floresta, por enquanto). O cenário do
  // mapa é montado depois, via montaMapa (dados de mapas.json).
  const mundoG = new THREE.Group(); scene.add(mundoG);
  const arenaG = montaArena(scene);

  const estado = {
    renderer, scene, camera, mundoG, arenaG,
    camPos: new THREE.Vector3(0, 12, 15),
    camAlvo: new THREE.Vector3(),
    shake: 0,
    parts: [],
    partPool: [],
    oclusores: [],
    oclusoresArena: [],
    anims: [], // animações de ambiente do mapa atual (fogueira, água...)
  };
  // POOL de partículas: malhas recicladas — criar/destruir objetos toda hora
  // acorda o coletor de lixo e causa micro-travamentos
  for (let i = 0; i < 240; i++) {
    const m = new THREE.Mesh(geoP, new THREE.MeshBasicMaterial({ transparent: true }));
    m.visible = false;
    scene.add(m);
    estado.partPool.push(m);
  }
  arenaG.traverse((o) => { if (o.isMesh && o.userData.oclusor) estado.oclusoresArena.push(o); });
  const resize = () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  };
  addEventListener('resize', resize); resize();
  return estado;
}

function montaChao(scene, tam = 70, tipo = 'grama', mapa = null) {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const x = c.getContext('2d');
  const terra = tipo === 'terra';
  // gerador determinístico (a textura repete sem costura)
  let semente = { grama: 31, terra: 77, vila: 51, penhasco: 93, deserto: 63 }[tipo] || 31;
  const rnd = () => (semente = (semente * 1103515245 + 12345) % 2147483648) / 2147483648;
  // base orgânica: manchas suaves em vez de xadrez
  const PALETAS = {
    grama:    { base: '#5fa848', tons: ['#67b34f', '#58a041', '#6fbd58', '#61ad4a'] },
    terra:    { base: '#a67f50', tons: ['#b08a5a', '#9c7449', '#ad8355', '#a17a4d'] },
    vila:     { base: '#b39064', tons: ['#a67f50', '#bc9668', '#8faf5f', '#ab8558'] },
    penhasco: { base: '#9c5242', tons: ['#a85a4a', '#8f4a3c', '#b06552', '#96503f'] },
    deserto:  { base: '#dcc084', tons: ['#e3c98f', '#d4b678', '#e8d09a', '#d0ad6c'] },
  };
  const pal = PALETAS[tipo] || PALETAS.grama;
  x.fillStyle = pal.base;
  x.fillRect(0, 0, 512, 512);
  const tons = pal.tons;
  for (let i = 0; i < 170; i++) {
    x.fillStyle = tons[i % tons.length];
    const px = rnd() * 512, py = rnd() * 512, r = 12 + rnd() * 26;
    x.beginPath(); x.ellipse(px, py, r, r * (0.6 + rnd() * 0.5), rnd() * 3, 0, Math.PI * 2); x.fill();
    // repete nas bordas para a textura emendar
    if (px < 40) { x.beginPath(); x.ellipse(px + 512, py, r, r * 0.8, 0, 0, Math.PI * 2); x.fill(); }
    if (py < 40) { x.beginPath(); x.ellipse(px, py + 512, r, r * 0.8, 0, 0, Math.PI * 2); x.fill(); }
  }
  // detalhes finos (pequenos!): tufos, flores, pedrinhas
  for (let i = 0; i < 110; i++) {
    const px = 8 + rnd() * 496, py = 8 + rnd() * 496;
    if (terra || tipo === 'penhasco') {
      x.fillStyle = i % 3 ? '#8d939c' : (tipo === 'penhasco' ? '#7a4438' : '#c49a68');
      x.fillRect(px, py, 3 + rnd() * 3, 2 + rnd() * 2);
    } else if (tipo === 'vila') {
      x.fillStyle = i % 4 === 0 ? '#8faf5f' : i % 4 === 1 ? '#96744e' : '#c9a06a';
      x.fillRect(px, py, 3 + rnd() * 2, 2 + rnd() * 2);
    } else if (tipo === 'deserto') {
      // pedrinhas claras e sombras de vento na areia
      if (i % 3 === 0) { x.fillStyle = '#bfa26a'; x.fillRect(px, py, 3 + rnd() * 3, 2); }
      else { x.fillStyle = i % 3 === 1 ? '#efdcae' : '#c7ab72'; x.fillRect(px, py, 5 + rnd() * 6, 1.5); }
    } else {
      const k = i % 7;
      if (k < 3) { x.fillStyle = '#8fd977'; x.fillRect(px, py, 2, 4); x.fillRect(px + 2, py + 1, 2, 3); }
      else if (k === 3) { x.fillStyle = '#ffd6e8'; x.fillRect(px, py, 3, 3); x.fillStyle = '#ffe9b0'; x.fillRect(px + 1, py - 1, 1.5, 1.5); }
      else if (k === 4) { x.fillStyle = '#f4e07a'; x.fillRect(px, py, 2.5, 2.5); }
      else if (k === 5) { x.fillStyle = '#9aa3ad'; x.fillRect(px, py, 3, 2); }
      else { x.fillStyle = '#4e9a3f'; x.fillRect(px, py, 4, 3); }
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(tam / 22, tam / 22);
  // chão com RELEVO: a malha é deslocada pelos morros suaves da sim
  const temMorros = mapa && mapa.morros && mapa.morros.length;
  const geo = new THREE.PlaneGeometry(tam, tam, temMorros ? 96 : 1, temMorros ? 96 : 1);
  geo.rotateX(-Math.PI / 2);
  if (temMorros) {
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++)
      p.setY(i, alturaMorros(mapa, { x: p.getX(i), z: p.getZ(i) }));
    geo.computeVertexNormals();
  }
  const ch = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: t }));
  ch.receiveShadow = true; scene.add(ch);
}

/* casinha caprichada: paredes de reboco com VIGAS de madeira (enxaimel),
   telhado com fileiras de telhas, chaminé e fundação de pedra */
const COR_TELHADO = { vermelho: 0xd1462f, azul: 0x3a6bc9, verde: 0x2f8a4a };
function texturaParede(base = '#f2e2c4', vigas = true) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = base; ctx.fillRect(0, 0, 128, 128);
  // manchinhas do reboco
  let sem = 41;
  const rnd = () => (sem = (sem * 1103515245 + 12345) % 2147483648) / 2147483648;
  ctx.fillStyle = 'rgba(180,150,110,0.22)';
  for (let i = 0; i < 26; i++) ctx.fillRect(rnd() * 124, rnd() * 124, 3 + rnd() * 4, 2 + rnd() * 3);
  if (vigas) {
    // vigas de madeira: moldura + prumos + uma diagonal
    ctx.fillStyle = '#8a6a50';
    ctx.fillRect(0, 0, 128, 9); ctx.fillRect(0, 119, 128, 9);
    ctx.fillRect(0, 0, 8, 128); ctx.fillRect(120, 0, 8, 128);
    ctx.fillRect(42, 0, 7, 128); ctx.fillRect(84, 0, 7, 128);
    ctx.save(); ctx.translate(64, 64); ctx.rotate(0.6);
    ctx.fillRect(-64, -4, 86, 8); ctx.restore();
  } else {
    // rodapé discreto (estilo do Centro de Curas)
    ctx.fillStyle = 'rgba(140,120,110,0.5)';
    ctx.fillRect(0, 119, 128, 9);
  }
  return new THREE.CanvasTexture(c);
}
// beiral: aba grossa na base do telhado piramidal (dá peso ao canto)
function beiral(grupo, raio, y, corHex) {
  const cor = new THREE.Color(corHex).multiplyScalar(0.78);
  const aba = new THREE.Mesh(new THREE.ConeGeometry(raio, 0.5, 4),
    new THREE.MeshLambertMaterial({ color: cor }));
  aba.position.y = y; aba.rotation.y = Math.PI / 4;
  aba.castShadow = true; aba.userData.oclusor = true;
  grupo.add(aba);
}
function texturaTelhado(corCss) {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = corCss; ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  for (let yy = 6; yy < 64; yy += 10) {
    ctx.fillRect(0, yy, 64, 2.4);
    // meias-juntas alternadas dão o desenho de telha
    const off = (yy / 10) % 2 ? 0 : 8;
    for (let xx = off; xx < 64; xx += 16) ctx.fillRect(xx, yy - 8, 2, 8);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 2);
  return t;
}
function casa(g, x, z, corNome) {
  const grupo = new THREE.Group();
  const lamb = (cor) => new THREE.MeshLambertMaterial({ color: cor });
  const corHex = COR_TELHADO[corNome] || COR_TELHADO.vermelho;
  // fundação de pedra
  const fund = new THREE.Mesh(new THREE.BoxGeometry(3.85, 0.35, 3.45), lamb(0x8d939c));
  fund.position.y = 0.17; fund.receiveShadow = true; grupo.add(fund);
  const corpo = new THREE.Mesh(new THREE.BoxGeometry(3.6, 2.2, 3.2),
    new THREE.MeshLambertMaterial({ map: texturaParede() }));
  corpo.position.y = 1.35; corpo.castShadow = true; corpo.userData.oclusor = true; grupo.add(corpo);
  const telhado = new THREE.Mesh(new THREE.ConeGeometry(2.9, 1.6, 4),
    new THREE.MeshLambertMaterial({
      map: texturaTelhado('#' + corHex.toString(16).padStart(6, '0')) }));
  telhado.position.y = 3.28; telhado.rotation.y = Math.PI / 4; telhado.castShadow = true;
  telhado.userData.oclusor = true;
  grupo.add(telhado);
  beiral(grupo, 3.15, 2.62, corHex);
  // chaminé de pedra com boca escura
  const cham = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.1, 0.42), lamb(0x8d939c));
  cham.position.set(1.05, 3.35, -0.7); cham.castShadow = true; grupo.add(cham);
  const boca = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.14, 0.48), lamb(0x4a4a52));
  boca.position.set(1.05, 3.95, -0.7); grupo.add(boca);
  const porta = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.2, 0.1), lamb(0x6b4a2f));
  porta.position.set(0, 0.85, 1.62); grupo.add(porta);
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.12, 0.14), lamb(0x8a6a50));
  lintel.position.set(0, 1.5, 1.63); grupo.add(lintel);
  for (const lado of [-1, 1]) {
    const jan = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, 0.1), lamb(0xbfe3ff));
    jan.position.set(lado * 1.1, 1.62, 1.62); grupo.add(jan);
    const moldura = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.08, 0.12), lamb(0x8a6a50));
    moldura.position.set(lado * 1.1, 1.28, 1.63); grupo.add(moldura);
  }
  grupo.position.set(x, 0, z);
  g.add(grupo);
}

/* centro de curas: prédio branco de telhado vermelho com cruz na fachada —
   no mesmo capricho das casas (fundação, textura, telhas e beiral) */
function centroCura(g, ct) {
  const lamb = (cor) => new THREE.MeshLambertMaterial({ color: cor });
  const grupo = new THREE.Group();
  const fund = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.35, 4.1), lamb(0x8d939c));
  fund.position.y = 0.17; fund.receiveShadow = true; grupo.add(fund);
  const corpo = new THREE.Mesh(new THREE.BoxGeometry(5.2, 2.6, 3.8),
    new THREE.MeshLambertMaterial({ map: texturaParede('#f7f3ea', false) }));
  corpo.position.y = 1.55; corpo.castShadow = true; corpo.userData.oclusor = true; grupo.add(corpo);
  const telhado = new THREE.Mesh(new THREE.ConeGeometry(4.0, 1.7, 4),
    new THREE.MeshLambertMaterial({ map: texturaTelhado('#d1462f') }));
  telhado.position.y = 3.7; telhado.rotation.y = Math.PI / 4; telhado.castShadow = true;
  telhado.userData.oclusor = true;
  grupo.add(telhado);
  beiral(grupo, 4.3, 3.0, 0xd1462f);
  const porta = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.4, 0.1), lamb(0x9ad4e8));
  porta.position.set(0, 0.95, 1.92); grupo.add(porta);
  // cruz branca sobre a porta
  const cr1 = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.08), lamb(0xffffff));
  cr1.position.set(0, 2.35, 1.94); grupo.add(cr1);
  const cr2 = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.7, 0.08), lamb(0xffffff));
  cr2.position.set(0, 2.35, 1.94); grupo.add(cr2);
  for (const lado of [-1, 1]) {
    const jan = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 0.1), lamb(0xbfe3ff));
    jan.position.set(lado * 1.7, 1.75, 1.92); grupo.add(jan);
  }
  grupo.position.set(ct.x, 0, ct.z);
  g.add(grupo);
}

/* decorações de vila (fogueira, poço, banca de feira) e escadas */
function fogueira(g, x, z, y = 0) {
  const lamb = (cor) => new THREE.MeshLambertMaterial({ color: cor });
  // plataforma circular de pedra em degradê: a fogueira é um MARCO da vila
  let topo = y;
  for (const [r, h, cor] of [[1.7, 0.12, 0x6e7680], [1.45, 0.12, 0x8d939c], [1.22, 0.1, 0xa8adb5]]) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r + 0.14, h, 22), lamb(cor));
    c.position.set(x, topo + h / 2, z);
    c.castShadow = c.receiveShadow = true;
    g.add(c);
    topo += h;
  }
  y = topo; // tudo daqui para baixo assenta sobre a plataforma
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const pedra = new THREE.Mesh(new THREE.DodecahedronGeometry(0.14), lamb(0x8d939c));
    pedra.position.set(x + Math.cos(a) * 0.5, y + 0.1, z + Math.sin(a) * 0.5);
    pedra.castShadow = true; g.add(pedra);
  }
  for (const rot of [0.5, 2.1]) {
    const tronco = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.7, 6), lamb(0x6b4a2f));
    tronco.rotation.z = Math.PI / 2; tronco.rotation.y = rot;
    tronco.position.set(x, y + 0.1, z); g.add(tronco);
  }
  // brasas incandescentes + chama 2.5D (flipbook) + luz quente tremulando
  const brasa = new THREE.Mesh(new THREE.DodecahedronGeometry(0.16),
    new THREE.MeshLambertMaterial({ color: 0x4a2a1a, emissive: 0xa33000 }));
  brasa.position.set(x, y + 0.18, z); g.add(brasa);
  const folha = texturaChamaAnimada();
  const chama = new THREE.Sprite(new THREE.SpriteMaterial({
    map: folha.tex, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending,
  }));
  chama.position.set(x, y + 0.85, z);
  g.add(chama);
  const luz = new THREE.PointLight(0xff9a4d, 1.2, 9);
  luz.position.set(x, y + 1.1, z); g.add(luz);
  (g.userData.anims || []).push((t) => {
    folha.tex.offset.x = (Math.floor(t * 14) % folha.quadros) / folha.quadros;
    const s = 1.15 + Math.sin(t * 11) * 0.1 + Math.sin(t * 23.7) * 0.05;
    chama.scale.set(s, s * 1.2, 1);
    luz.intensity = 1.1 + Math.sin(t * 13.7) * 0.2 + Math.sin(t * 31.3) * 0.12;
  });
}
function poco(g, x, z, y = 0) {
  const lamb = (cor) => new THREE.MeshLambertMaterial({ color: cor });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.7, 0.6, 10), lamb(0x7d838c));
  base.position.set(x, y + 0.3, z); base.castShadow = true; base.userData.oclusor = true; g.add(base);
  for (const lado of [-1, 1]) {
    const poste = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.0, 0.09), lamb(0x6b4a2f));
    poste.position.set(x + lado * 0.55, y + 1.0, z); poste.castShadow = true; g.add(poste);
  }
  const telhado = new THREE.Mesh(new THREE.ConeGeometry(0.85, 0.5, 4), lamb(0xd1462f));
  telhado.position.set(x, y + 1.7, z); telhado.rotation.y = Math.PI / 4;
  telhado.castShadow = true; telhado.userData.oclusor = true; g.add(telhado);
  const eixo = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.2, 6), lamb(0x8a6a50));
  eixo.rotation.z = Math.PI / 2; eixo.position.set(x, y + 1.15, z); g.add(eixo);
}
function banca(g, x, z, y = 0) {
  const lamb = (cor) => new THREE.MeshLambertMaterial({ color: cor });
  const balcao = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.8, 0.9), lamb(0x8a6a50));
  balcao.position.set(x, y + 0.4, z); balcao.castShadow = true; balcao.userData.oclusor = true; g.add(balcao);
  for (const lado of [-1, 1]) {
    const poste = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.9, 0.09), lamb(0x6b4a2f));
    poste.position.set(x + lado * 1.0, y + 0.95, z - 0.3); poste.castShadow = true; g.add(poste);
  }
  // toldo listrado
  const c = document.createElement('canvas'); c.width = 64; c.height = 16;
  const cx2 = c.getContext('2d');
  for (let i = 0; i < 8; i++) { cx2.fillStyle = i % 2 ? '#fff6df' : '#d1462f'; cx2.fillRect(i * 8, 0, 8, 16); }
  const tex = new THREE.CanvasTexture(c);
  const toldo = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.08, 1.4),
    new THREE.MeshLambertMaterial({ map: tex }));
  toldo.position.set(x, y + 1.95, z - 0.1); toldo.rotation.x = -0.22;
  toldo.castShadow = true; toldo.userData.oclusor = true; g.add(toldo);
}
function placa(g, x, z, y = 0) {
  const lamb = (cor) => new THREE.MeshLambertMaterial({ color: cor });
  const poste = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.9, 6), lamb(0x6b4a2f));
  poste.position.set(x, y + 0.45, z); poste.castShadow = true; g.add(poste);
  const tabua = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.55, 0.08), lamb(0x8a6a50));
  tabua.position.set(x, y + 0.95, z); tabua.rotation.y = 0.06;
  tabua.castShadow = true; g.add(tabua);
  // "linhas de texto" sugeridas
  for (const [ly, lw] of [[0.08, 0.7], [-0.04, 0.55]]) {
    const linha = new THREE.Mesh(new THREE.BoxGeometry(lw, 0.06, 0.02), lamb(0xf2e2c4));
    linha.position.set(x, y + 0.98 + ly, z + 0.05); linha.rotation.y = 0.06;
    g.add(linha);
  }
}
const DECOR = { fogueira, poco, banca, placa };

/* escada de degraus subindo a um platô (o "dir" é a direção da subida) */
function escada(g, e, mapa) {
  const lamb = (cor) => new THREE.MeshLambertMaterial({ color: cor });
  const cor = mapa.chao === 'penhasco' ? 0xa25e4e : 0xb08a5a;
  const n = Math.max(3, Math.ceil(e.h / 0.2));
  const L = 1.7, passo = L / n;
  const dv = { norte: [0, -1], sul: [0, 1], leste: [1, 0], oeste: [-1, 0] }[e.dir];
  for (let k = 0; k < n; k++) {
    const alt = e.h * (k + 1) / n;
    const cx3 = e.x - dv[0] * (L - passo * (k + 0.5));
    const cz3 = e.z - dv[1] * (L - passo * (k + 0.5));
    const m = new THREE.Mesh(new THREE.BoxGeometry(
      dv[0] !== 0 ? passo : e.w, alt, dv[0] !== 0 ? e.w : passo), lamb(cor));
    m.position.set(cx3, alt / 2, cz3);
    m.castShadow = m.receiveShadow = true;
    g.add(m);
  }
}

/* muralha natural: floresta densa fechando as bordas do mapa, com clareiras
   apenas nas passagens; onde há água, o próprio lago faz o papel */
function montaBorda(g, mapa) {
  const L = mapa.limite;
  const saidas = mapa.saidas || [];
  const ag = mapa.agua;
  const bloqueada = (x, z) => {
    for (const s of saidas) {
      const folga = 3;
      if (s.borda === 'leste' && x > L.x && z > s.de - folga && z < s.ate + folga) return true;
      if (s.borda === 'oeste' && x < -L.x && z > s.de - folga && z < s.ate + folga) return true;
      if (s.borda === 'sul' && z > L.z && x > s.de - folga && x < s.ate + folga) return true;
      if (s.borda === 'norte' && z < -L.z && x > s.de - folga && x < s.ate + folga) return true;
    }
    if (ag && x > ag.x0 - 1 && x < ag.x1 + 1 && z > ag.z0 - 1 && z < ag.z1 + 1) return true;
    return false;
  };
  // sem muros artificiais: a moldura é feita de árvores/rochas GRANDES em
  // filas escalonadas — cada fila mais funda é maior, tapando o horizonte
  // de forma natural, com vãos nas passagens
  const planta = (x, z, i, esc = 1) => {
    if (bloqueada(x, z)) return;
    if (mapa.borda === 'montanha') {
      const r = (1.3 + (i % 3) * 0.5) * esc;
      const pedra = new THREE.Mesh(new THREE.DodecahedronGeometry(r),
        new THREE.MeshLambertMaterial({ color: (i % 2) ? 0x7d838c : 0x6e7680 }));
      pedra.position.set(x + (Math.random() - 0.5), r * 0.7, z + (Math.random() - 0.5));
      pedra.castShadow = esc === 1; // só a fila da frente projeta sombra
      pedra.userData.oclusor = true; g.add(pedra);
      return;
    }
    const arv = arvore(g, x + (Math.random() - 0.5), z + (Math.random() - 0.5), i % 2);
    if (arv && esc !== 1) {
      arv.scale.setScalar(esc);
      // filas de trás são cenário distante: sem sombra (alivia a GPU)
      arv.traverse((o) => { if (o.isMesh) o.castShadow = false; });
    }
  };
  const passo = 2.4;
  let i = 0;
  for (let x = -L.x - 1.5; x <= L.x + 5; x += passo, i++) {
    planta(x, -L.z - 1.5, i); planta(x, L.z + 1.5, i);
    planta(x + 1.2, -L.z - 3.4, i + 1, 1.35); planta(x + 1.2, L.z + 3.4, i + 1, 1.35);
    planta(x + 0.5, -L.z - 5.6, i + 2, 1.7); planta(x + 0.5, L.z + 5.6, i + 2, 1.7);
  }
  for (let z = -L.z - 1.5; z <= L.z + 5; z += passo, i++) {
    planta(-L.x - 1.5, z, i); planta(L.x + 1.5, z, i);
    planta(-L.x - 3.4, z + 1.2, i + 1, 1.35); planta(L.x + 3.4, z + 1.2, i + 1, 1.35);
    planta(-L.x - 5.6, z + 0.5, i + 2, 1.7); planta(L.x + 5.6, z + 0.5, i + 2, 1.7);
  }
}

/* oclusores: o que ficar entre a câmera e o personagem vira "vidro" —
   ninguém some atrás de árvore, casa, platô ou muralha */
const _ray = new THREE.Raycaster();
const _dir = new THREE.Vector3();
const _alvoV = new THREE.Vector3();
const desvanecidos = new Set();
export function passoOclusores(cena, alvos, lista) {
  const agora = new Set();
  for (const alvo of alvos) {
    _alvoV.set(alvo.x, alvo.y + 0.9, alvo.z);
    _dir.copy(_alvoV).sub(cena.camera.position);
    const dist = _dir.length();
    _ray.set(cena.camera.position, _dir.normalize());
    _ray.far = dist - 0.4;
    for (const h of _ray.intersectObjects(lista || [], false)) agora.add(h.object);
  }
  for (const m of agora) {
    if (!desvanecidos.has(m)) {
      m.userData._transparente = m.material.transparent;
      m.material.transparent = true;
      desvanecidos.add(m);
    }
    m.material.opacity = 0.3;
  }
  for (const m of [...desvanecidos]) {
    if (!agora.has(m)) {
      m.material.opacity = 1;
      m.material.transparent = !!m.userData._transparente;
      desvanecidos.delete(m);
    }
  }
}

function arvore(scene, x, z, pinheiro) {
  const g = new THREE.Group();
  const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 1.1, 6),
    new THREE.MeshLambertMaterial({ color: 0x7a5233 }));
  tr.position.y = 0.55; tr.castShadow = true; tr.userData.oclusor = true; g.add(tr);
  if (pinheiro) {
    [[1.5, 1.2], [2.2, 0.9], [2.9, 0.6]].forEach(([y, r]) => {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(r, 1.2, 7),
        new THREE.MeshLambertMaterial({ color: 0x2a6e3e }));
      cone.position.y = y; cone.castShadow = true; cone.userData.oclusor = true; g.add(cone);
    });
  } else {
    [[1.6, 0.9, 0, 0], [2.3, 1.05, 0, 0], [1.9, 0.7, 0.7, 0.2], [1.9, 0.7, -0.7, -0.2]]
      .forEach(([y, r, dx, dz]) => {
        const s = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6),
          new THREE.MeshLambertMaterial({ color: 0x2f7a33 }));
        s.position.set(dx, y, dz); s.castShadow = true; s.userData.oclusor = true; g.add(s);
      });
  }
  g.position.set(x, 0, z); scene.add(g);
  return g;
}

/* grama alta: um mar CONTÍNUO de arbustos arredondados lado a lado (grade
   com leve variação) — quem entra some da cintura para baixo, estilo
   Pokémon/ClaudeCraft */
function montaGrama(scene, G) {
  const mats = [0x3d8a35, 0x46983c, 0x51a746]
    .map((c) => new THREE.MeshLambertMaterial({ color: c }));
  // ANEL de canteiro elevado ABRAÇANDO os arbustos (sem vão entre eles),
  // com o tapete verde de volta por baixo da grama
  const wG = G.x1 - G.x0 + 2.4, dG = G.z1 - G.z0 + 2.4;
  const cxG = (G.x0 + G.x1) / 2, czG = (G.z0 + G.z1) / 2;
  const c0 = new THREE.Color(0x7d5f3e), c1 = new THREE.Color(0xbc9668);
  const LARG = 1.6; // espessura total do anel: interna encosta nos arbustos
  for (let i = 0; i < 2; i++) {
    const folga = (1 - i) * 0.4;
    const ext = formaArredondada(wG + folga, dG + folga, 1.3);
    ext.holes.push(formaArredondada(wG - LARG + folga, dG - LARG + folga, 0.9));
    const geo = new THREE.ExtrudeGeometry(ext, { depth: 0.11, bevelEnabled: false });
    const m = new THREE.Mesh(geo,
      new THREE.MeshLambertMaterial({ color: c0.clone().lerp(c1, i) }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(cxG, i * 0.11, czG);
    m.castShadow = m.receiveShadow = true;
    scene.add(m);
  }
  const tampa = formaArredondada(wG - 0.12, dG - 0.12, 1.3);
  tampa.holes.push(formaArredondada(wG - LARG + 0.12, dG - LARG + 0.12, 0.9));
  const cap = new THREE.Mesh(
    new THREE.ExtrudeGeometry(tampa, { depth: 0.05, bevelEnabled: false }),
    new THREE.MeshLambertMaterial({ color: 0x67b34f }));
  cap.rotation.x = -Math.PI / 2;
  cap.position.set(cxG, 0.22, czG);
  cap.receiveShadow = true;
  scene.add(cap);
  // tapete verde sob os arbustos, preenchendo o interior do anel
  const base = new THREE.Mesh(
    new THREE.PlaneGeometry(G.x1 - G.x0 + 1.2, G.z1 - G.z0 + 1.2),
    new THREE.MeshLambertMaterial({ color: 0x357a2e }));
  base.rotation.x = -Math.PI / 2;
  base.position.set(cxG, 0.014, czG);
  base.receiveShadow = true;
  scene.add(base);
  const geoArb = new THREE.SphereGeometry(0.78, 10, 7);
  const passo = 1.05;
  let i = 0;
  for (let px = G.x0 + 0.6; px <= G.x1 - 0.3; px += passo) {
    for (let pz = G.z0 + 0.6; pz <= G.z1 - 0.3; pz += passo, i++) {
      const m = new THREE.Mesh(geoArb, mats[(i * 7) % mats.length]);
      const esc = 0.9 + ((i * 13) % 10) / 45;
      m.scale.set(esc, 0.62 * esc, esc);
      m.position.set(px + (((i * 31) % 7) - 3) * 0.06, 0.34,
                     pz + (((i * 17) % 7) - 3) * 0.06);
      m.castShadow = true;
      scene.add(m);
    }
  }
}

// tile transparente de cristas de onda (senoides com período inteiro:
// a emenda horizontal fecha sem costura)
function texturaOndas() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  let sem = 19;
  const rnd = () => (sem = (sem * 1103515245 + 12345) % 2147483648) / 2147483648;
  x.lineCap = 'round';
  for (let i = 0; i < 5; i++) {
    const y0 = 14 + i * 22 + rnd() * 8;
    const amp = 3 + rnd() * 3, per = 1 + Math.floor(rnd() * 2);
    x.strokeStyle = `rgba(255,255,255,${0.25 + rnd() * 0.2})`;
    x.lineWidth = 2.5 + rnd() * 2;
    x.beginPath();
    for (let px = -4; px <= 132; px += 4) {
      const py = y0 + Math.sin((px / 128) * Math.PI * 2 * per + i * 1.7) * amp;
      if (px === -4) x.moveTo(px, py); else x.lineTo(px, py);
    }
    x.stroke();
  }
  return new THREE.CanvasTexture(c);
}
function montaAgua(g, ag) {
  const areia = new THREE.Mesh(
    new THREE.PlaneGeometry(ag.x1 - ag.x0 + 1.6, ag.z1 - ag.z0 + 1.6),
    new THREE.MeshLambertMaterial({ color: 0xe8d9a8 }));
  areia.rotation.x = -Math.PI / 2;
  areia.position.set((ag.x0 + ag.x1) / 2, 0.02, (ag.z0 + ag.z1) / 2);
  areia.receiveShadow = true; g.add(areia);
  const w = ag.x1 - ag.x0, d = ag.z1 - ag.z0;
  const agua = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshLambertMaterial({ color: 0x3f8fd4, transparent: true, opacity: 0.9 }));
  agua.rotation.x = -Math.PI / 2;
  agua.position.set((ag.x0 + ag.x1) / 2, 0.04, (ag.z0 + ag.z1) / 2);
  g.add(agua);
  // duas camadas de cristas deslizando em sentidos opostos = água viva
  const camadas = [];
  for (const [rep, op, alt] of [[4.2, 0.5, 0.055], [2.8, 0.32, 0.07]]) {
    const tex = texturaOndas();
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(w / rep, d / rep);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d),
      new THREE.MeshLambertMaterial({ map: tex, transparent: true, opacity: op, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    m.position.set((ag.x0 + ag.x1) / 2, alt, (ag.z0 + ag.z1) / 2);
    g.add(m);
    camadas.push(tex);
  }
  (g.userData.anims || []).push((t) => {
    camadas[0].offset.set(t * 0.018, Math.sin(t * 0.6) * 0.02);
    camadas[1].offset.set(-t * 0.012, t * 0.008);
  });
}

/* platô elevado: dois degraus (base larga + topo), combinando com a rampa
   suave da sim; o topo é gramado */
function formaArredondada(w, d, r) {
  const s = new THREE.Shape();
  const hw = w / 2, hd = d / 2;
  s.moveTo(-hw + r, -hd);
  s.lineTo(hw - r, -hd); s.absarc(hw - r, -hd + r, r, -Math.PI / 2, 0);
  s.lineTo(hw, hd - r);  s.absarc(hw - r, hd - r, r, 0, Math.PI / 2);
  s.lineTo(-hw + r, hd); s.absarc(-hw + r, hd - r, r, Math.PI / 2, Math.PI);
  s.lineTo(-hw, -hd + r); s.absarc(-hw + r, -hd + r, r, Math.PI, Math.PI * 1.5);
  return s;
}
function plato(g, p, mapa = {}) {
  // morro de CANTOS ARREDONDADOS em camadas que clareiam aos poucos
  // (base larga escura -> topo estreito claro), com o topo gramado
  const pen = mapa.chao === 'penhasco';
  const c0 = new THREE.Color(pen ? 0x6e3c32 : 0x7d5f3e);
  const c1 = new THREE.Color(pen ? 0xb06552 : 0xbc9668);
  const w = p.x1 - p.x0, d = p.z1 - p.z0;
  const cx = (p.x0 + p.x1) / 2, cz = (p.z0 + p.z1) / 2;
  const r = Math.min(1.6, Math.min(w, d) * 0.22);
  const camadas = 4;
  for (let i = 0; i < camadas; i++) {
    const cor = c0.clone().lerp(c1, i / (camadas - 1));
    const folga = (camadas - 1 - i) * 0.45;
    const shape = formaArredondada(w + folga, d + folga, r);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: p.h / camadas, bevelEnabled: false });
    const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: cor }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(cx, (i * p.h) / camadas, cz);
    m.castShadow = m.receiveShadow = true;
    m.userData.oclusor = true;
    g.add(m);
  }
  const topoGeo = new THREE.ExtrudeGeometry(formaArredondada(w - 0.15, d - 0.15, r), { depth: 0.09, bevelEnabled: false });
  const topo = new THREE.Mesh(topoGeo, new THREE.MeshLambertMaterial({ color: 0x67b34f }));
  topo.rotation.x = -Math.PI / 2;
  topo.position.set(cx, p.h, cz);
  topo.receiveShadow = true;
  g.add(topo);
}

/* boca de caverna nas rochas (o interior vem no futuro) */
function bocaCaverna(g, c) {
  const lamb = (cor) => new THREE.MeshLambertMaterial({ color: cor });
  const rocha = new THREE.Mesh(new THREE.DodecahedronGeometry(3.2), lamb(0x6e7680));
  rocha.position.set(c.x, 1.6, c.z - 1.2); rocha.scale.set(1.4, 1, 1);
  rocha.castShadow = true; rocha.userData.oclusor = true; g.add(rocha);
  for (const [dx, r] of [[-3.4, 1.4], [3.4, 1.6]]) {
    const p = new THREE.Mesh(new THREE.DodecahedronGeometry(r), lamb(0x7d838c));
    p.position.set(c.x + dx, r * 0.7, c.z - 0.6); p.castShadow = true;
    p.userData.oclusor = true; g.add(p);
  }
  const buraco = new THREE.Mesh(new THREE.CircleGeometry(1.15, 16),
    new THREE.MeshBasicMaterial({ color: 0x0a0a12 }));
  buraco.position.set(c.x, 1.05, c.z + 1.1);
  g.add(buraco);
}

/* interior de casa: piso de madeira, paredes com porta ao sul e móveis */
function montaInterior(g, mapa) {
  const lamb = (cor) => new THREE.MeshLambertMaterial({ color: cor });
  const L = mapa.limite;
  const piso = new THREE.Mesh(new THREE.BoxGeometry(L.x * 2 + 0.8, 0.1, L.z * 2 + 0.8), lamb(0xa8734a));
  piso.position.y = -0.05; piso.receiveShadow = true; g.add(piso);
  const parede = (w, d, x, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 2.6, d), lamb(0xe8d3b0));
    m.position.set(x, 1.3, z); m.castShadow = true; g.add(m);
  };
  parede(L.x * 2 + 0.8, 0.4, 0, -L.z - 0.2);           // fundo
  parede(0.4, L.z * 2 + 0.8, -L.x - 0.2, 0);           // esquerda
  parede(0.4, L.z * 2 + 0.8, L.x + 0.2, 0);            // direita
  const seg = L.x - 1;                                  // frente com vão da porta
  parede(seg, 0.4, -(1 + seg / 2), L.z + 0.2);
  parede(seg, 0.4, 1 + seg / 2, L.z + 0.2);
  if (mapa.estilo === 'centro') {
    // balcão de atendimento, máquina de cura e tapete
    const balcao = new THREE.Mesh(new THREE.BoxGeometry(L.x * 1.2, 1.0, 0.9), lamb(0xe0685a));
    balcao.position.set(0, 0.5, -L.z + 1.3); balcao.castShadow = true; g.add(balcao);
    const tampo = new THREE.Mesh(new THREE.BoxGeometry(L.x * 1.2 + 0.2, 0.12, 1.1), lamb(0xfff3da));
    tampo.position.set(0, 1.06, -L.z + 1.3); g.add(tampo);
    const maquina = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 0.8), lamb(0x9ad4e8));
    maquina.position.set(1.8, 1.35, -L.z + 1.3); g.add(maquina);
    const tapete = new THREE.Mesh(new THREE.CircleGeometry(1.3, 16), lamb(0x9ad4e8));
    tapete.rotation.x = -Math.PI / 2; tapete.position.y = 0.02; tapete.position.z = 0.8; g.add(tapete);
  } else {
    // móveis: cama, travesseiro, mesa e tapete
    const cama = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 2.4), lamb(0xd9553f));
    cama.position.set(-L.x + 1.2, 0.25, -L.z + 1.5); cama.castShadow = true; g.add(cama);
    const trav = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.25, 0.7), lamb(0xfff3da));
    trav.position.set(-L.x + 1.2, 0.62, -L.z + 0.7); g.add(trav);
    const mesa = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.9, 1.1), lamb(0x8a6a50));
    mesa.position.set(L.x - 1.4, 0.45, -L.z + 1.3); mesa.castShadow = true; g.add(mesa);
    const tapete = new THREE.Mesh(new THREE.CircleGeometry(1.1, 16), lamb(0x5fa848));
    tapete.rotation.x = -Math.PI / 2; tapete.position.y = 0.02; g.add(tapete);
  }
}

/* lajes de pedra estilo Brilliant Diamond: placas irregulares marrons com
   frestas escuras — usadas nos CAMINHOS desenhados no próprio mapa */
let _texLajes = null;
function texturaLajes() {
  if (_texLajes) return _texLajes;
  // lajes ENCAIXADAS: malha de células com cantos deslocados — cada pedra é
  // um polígono que emenda perfeitamente na vizinha (e a textura repete)
  const T = 192, N = 5, S = T / N;
  const c = document.createElement('canvas'); c.width = c.height = T;
  const x = c.getContext('2d');
  x.fillStyle = '#5f4530'; x.fillRect(0, 0, T, T);
  const jit = (i, j, salt) => {
    const h = Math.abs(Math.sin((i % N) * 127.1 + (j % N) * 311.7 + salt) * 43758.5453) % 1;
    return (h - 0.5) * S * 0.55;
  };
  const canto = (i, j) => ({ x: i * S + jit(i, j, 1.3), y: j * S + jit(i, j, 7.7) });
  const tons = ['#b08a5a', '#a67f50', '#bc9668', '#96744e', '#c9a06a', '#a8825a'];
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const p = [canto(i, j), canto(i + 1, j), canto(i + 1, j + 1), canto(i, j + 1)];
    x.fillStyle = tons[(i * 3 + j * 5) % tons.length];
    x.strokeStyle = '#5f4530'; x.lineWidth = 3; x.lineJoin = 'round';
    // desenha em 9 posições (com wrap) para a emenda ficar perfeita
    for (const dx of [-T, 0, T]) for (const dy of [-T, 0, T]) {
      x.beginPath();
      x.moveTo(p[0].x + dx, p[0].y + dy);
      for (let k = 1; k < 4; k++) x.lineTo(p[k].x + dx, p[k].y + dy);
      x.closePath(); x.fill(); x.stroke();
    }
  }
  _texLajes = new THREE.CanvasTexture(c);
  _texLajes.wrapS = _texLajes.wrapT = THREE.RepeatWrapping;
  return _texLajes;
}
function montaCaminhos(g, mapa) {
  for (const c of mapa.caminhos || []) {
    const w = c.x1 - c.x0, d = c.z1 - c.z0;
    const tex = texturaLajes().clone();
    tex.needsUpdate = true;
    tex.repeat.set(w / 4.5, d / 4.5);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d),
      new THREE.MeshLambertMaterial({ map: tex }));
    m.rotation.x = -Math.PI / 2;
    m.position.set((c.x0 + c.x1) / 2, 0.016, (c.z0 + c.z1) / 2);
    m.receiveShadow = true;
    g.add(m);
  }
}

/* pedrões marrons decorativos (com colisão na sim) */
function montaPedras(g, mapa) {
  for (const [x, z, esc = 1] of mapa.pedras || []) {
    const pedra = new THREE.Mesh(new THREE.DodecahedronGeometry(0.7 * esc),
      new THREE.MeshLambertMaterial({ color: 0x9c7a4e }));
    pedra.position.set(x, 0.5 * esc, z);
    pedra.scale.set(1.35, 0.95, 1.05);
    pedra.rotation.y = (x * 7 + z * 3) % 3;
    pedra.castShadow = true; pedra.userData.oclusor = true;
    g.add(pedra);
  }
}

function descarta(obj) {
  obj.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material)
      (Array.isArray(o.material) ? o.material : [o.material]).forEach((mt) => {
        if (mt.map) mt.map.dispose();
        mt.dispose();
      });
  });
}

// (re)monta o cenário de um mapa de mapas.json
export function montaMapa(cena, mapa) {
  descarta(cena.mundoG);
  cena.scene.remove(cena.mundoG);
  const g = new THREE.Group();
  g.visible = !cena.arenaG.visible;
  cena.scene.add(g);
  cena.mundoG = g;
  // as peças do cenário registram aqui suas animações (fogueira, água...)
  cena.anims = [];
  g.userData.anims = cena.anims;
  if (mapa.tipo === 'interior') {
    montaInterior(g, mapa);
    // interiores também têm moradores (a enfermeira do Centro, por ex.)
    (mapa.npcs || []).forEach(([x, z, tipo, rot]) => {
      const npc = criarNPC(g, tipo);
      npc.g.position.set(x, 0, z);
      npc.g.rotation.y = rot || 0;
    });
    return;
  }
  montaChao(g, Math.max(mapa.limite.x, mapa.limite.z) * 2 + 24, mapa.chao || 'grama', mapa);
  montaCaminhos(g, mapa);
  montaPedras(g, mapa);
  (mapa.arvores || []).forEach(([x, z, p]) => {
    const grupoArv = arvore(g, x, z, p);
    if (grupoArv) grupoArv.position.y = alturaTerreno(mapa, { x, z });
  });
  (mapa.casas || []).forEach(([x, z, cor]) => casa(g, x, z, cor));
  if (mapa.centro) centroCura(g, mapa.centro);
  (mapa.platos || []).forEach((p) => plato(g, p, mapa));
  (mapa.escadas || []).forEach((e) => escada(g, e, mapa));
  (mapa.decor || []).forEach(([tipo, x, z]) => {
    if (DECOR[tipo]) DECOR[tipo](g, x, z, alturaTerreno(mapa, { x, z }));
  });
  (mapa.npcs || []).forEach(([x, z, tipo, rot]) => {
    const npc = criarNPC(g, tipo);
    npc.g.position.set(x, alturaTerreno(mapa, { x, z }), z);
    npc.g.rotation.y = rot || 0;
  });
  // treinadores desafiantes (dados do mapa: x, z, tipo do visual, equipe)
  (mapa.treinadores || []).forEach((t) => {
    const npc = criarNPC(g, t.tipo || 'aldeao');
    npc.g.position.set(t.x, alturaTerreno(mapa, t), t.z);
    npc.g.rotation.y = t.rot || 0;
  });
  for (const G of mapa.gramas || (mapa.grama ? [mapa.grama] : [])) montaGrama(g, G);
  if (mapa.agua) montaAgua(g, mapa.agua);
  if (mapa.caverna) bocaCaverna(g, mapa.caverna);
  montaBorda(g, mapa);
  // lista de oclusores para o efeito "vidro" quando algo tapa o personagem
  cena.oclusores = [];
  g.traverse((o) => { if (o.isMesh && o.userData.oclusor) cena.oclusores.push(o); });
}

/* arena de batalha — ringue centrado na origem, TEMATIZADO pelo bioma do
   mapa onde o duelo começou (floresta, deserto com cactos, rochas...) */
function cacto(g, x, z, esc = 1) {
  const lamb = (cor) => new THREE.MeshLambertMaterial({ color: cor });
  const grupo = new THREE.Group();
  const corpo = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 1.5, 8), lamb(0x3f8f3f));
  corpo.position.y = 0.75; corpo.castShadow = true; grupo.add(corpo);
  const topo = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), lamb(0x3f8f3f));
  topo.position.y = 1.5; grupo.add(topo);
  for (const lado of [-1, 1]) {
    const braco = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.6, 6), lamb(0x4a9c48));
    braco.position.set(lado * 0.45, 1.0, 0); braco.rotation.z = lado * 0.5; grupo.add(braco);
  }
  const flor = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 5), lamb(0xff7fa8));
  flor.position.y = 1.78; grupo.add(flor);
  grupo.position.set(x, 0, z); grupo.scale.setScalar(esc);
  g.add(grupo);
}
function montaArena(scene) {
  const g = new THREE.Group(); g.visible = false; scene.add(g);
  const lamb = (cor) => new THREE.MeshLambertMaterial({ color: cor });
  // tablado de AREIA elevado + cerca: fixos em qualquer bioma
  const areia = new THREE.Mesh(new THREE.CylinderGeometry(10.5, 11.3, 0.5, 28), lamb(0xd0b183));
  areia.position.y = -0.13; // topo em y ≈ 0.12
  areia.receiveShadow = true; g.add(areia);
  const borda = new THREE.Mesh(new THREE.TorusGeometry(10.6, 0.2, 8, 28), lamb(0x8a6a50));
  borda.rotation.x = -Math.PI / 2; borda.position.y = 0.14; g.add(borda);
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2;
    const poste = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 0.95, 6), lamb(0x7a5233));
    poste.position.set(Math.cos(a) * 11.8, 0.47, Math.sin(a) * 11.8);
    poste.castShadow = true; g.add(poste);
  }
  const trave = new THREE.Mesh(new THREE.TorusGeometry(11.8, 0.07, 6, 28), lamb(0x9a7243));
  trave.rotation.x = -Math.PI / 2; trave.position.y = 0.8; g.add(trave);
  g.tema = new THREE.Group(); g.add(g.tema);
  return g;
}
// (re)veste a arena com o bioma do mapa atual
export function temaArena(cena, bioma = 'grama') {
  const g = cena.arenaG;
  descarta(g.tema); g.remove(g.tema);
  const tema = new THREE.Group(); g.add(tema); g.tema = tema;
  const lamb = (cor) => new THREE.MeshLambertMaterial({ color: cor });
  const CORES = { grama: 0x578f43, vila: 0x578f43, terra: 0xa67f50,
                  penhasco: 0x9c5242, deserto: 0xdcc084 };
  const base = new THREE.Mesh(new THREE.CircleGeometry(34, 24), lamb(CORES[bioma] || 0x578f43));
  base.rotation.x = -Math.PI / 2; base.position.y = 0.004; base.receiveShadow = true; tema.add(base);
  // moldura externa do ringue conforme o bioma
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2 + 0.17;
    const r = 15 + (i % 3) * 2.2;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (bioma === 'deserto') cacto(tema, x, z, 1.1 + (i % 3) * 0.4);
    else if (bioma === 'penhasco' || bioma === 'terra') {
      const rr = 1.0 + (i % 3) * 0.6;
      const pedra = new THREE.Mesh(new THREE.DodecahedronGeometry(rr),
        lamb((i % 2) ? 0x7d838c : 0x6e7680));
      pedra.position.set(x, rr * 0.7, z);
      pedra.castShadow = true; pedra.userData.oclusor = true; tema.add(pedra);
    } else arvore(tema, x, z, i % 2 === 0 ? 1 : 0);
  }
  if (bioma === 'deserto') {
    // PERIGO: cactos pequenos na beirada interna — encostou, espetou (sim)
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + 0.3;
      cacto(tema, Math.cos(a) * 10.1, Math.sin(a) * 10.1, 0.5);
    }
  } else {
    [[8.6, 2.6], [-7.9, -4.4], [1.8, -9.3]].forEach(([x, z], i) => {
      const pedra = new THREE.Mesh(new THREE.DodecahedronGeometry(0.4 + i * 0.12), lamb(0x8d939c));
      pedra.position.set(x, 0.3, z); pedra.castShadow = true; tema.add(pedra);
    });
  }
  cena.oclusoresArena = [];
  g.traverse((o) => { if (o.isMesh && o.userData.oclusor) cena.oclusoresArena.push(o); });
}

// alterna entre o mapa de exploração e o ringue de batalha
export function mostraArena(cena, ligar) {
  cena.arenaG.visible = ligar;
  cena.mundoG.visible = !ligar;
}

/* partículas saem do POOL (sem alocação); esgotou, simplesmente não nasce */
const geoP = new THREE.PlaneGeometry(0.085, 0.085);
function nascePart(cena, pos, cor, escala) {
  const m = cena.partPool.pop();
  if (!m) return null;
  m.material.color.setHex(cor);
  m.material.opacity = 1;
  m.position.set(pos.x, pos.y, pos.z);
  m.scale.setScalar(escala);
  m.visible = true;
  return m;
}

/* jato direcionado: fagulhas que voam da boca da fera até o alvo (sopros) */
export function jato(cena, pos, dir, cor, n = 4, vel = 8) {
  for (let i = 0; i < n; i++) {
    const m = nascePart(cena, pos, cor, 0.6 + Math.random() * 0.9);
    if (!m) return;
    cena.parts.push({ m,
      vx: dir.x * vel + (Math.random() - 0.5) * 2.4,
      vy: dir.y * vel + (Math.random() - 0.5) * 1.8 + 0.6,
      vz: dir.z * vel + (Math.random() - 0.5) * 2.4,
      vida: 0.16 + Math.random() * 0.16 });
  }
}

export function poof(cena, pos, cor, n = 10, vel = 3) {
  for (let i = 0; i < n; i++) {
    const m = nascePart(cena, pos, cor, 0.5 + Math.random() * 0.9);
    if (!m) return;
    cena.parts.push({ m, vx: (Math.random()-.5)*vel, vy: Math.random()*vel,
      vz: (Math.random()-.5)*vel, vida: 0.5 + Math.random() * 0.3 });
  }
}
// animações de ambiente do mapa (fogueira, água...) — registradas na montagem
export function passoAmbiente(cena, t) {
  for (const f of cena.anims) f(t);
}

export function passoParticulas(cena, dt) {
  for (let i = cena.parts.length - 1; i >= 0; i--) {
    const p = cena.parts[i];
    p.vida -= dt;
    p.m.position.x += p.vx * dt; p.m.position.y += p.vy * dt; p.m.position.z += p.vz * dt;
    p.vy -= 6 * dt;
    p.m.material.opacity = Math.max(0, p.vida * 2);
    p.m.lookAt(cena.camera.position);
    if (p.vida <= 0) { // devolve ao pool em vez de destruir
      p.m.visible = false;
      cena.partPool.push(p.m);
      cena.parts.splice(i, 1);
    }
  }
}

/* câmera: exploração (LoL) ou batalha (lock-on) */
export function passoCamera(cena, modo, mundo, batalha, dt) {
  let desejo, olhar;
  if (modo === 'batalha' && batalha) {
    const pp = batalha.p.pos, ee = batalha.e.pos;
    const d = Math.hypot(ee.x - pp.x, ee.z - pp.z) || 1;
    const fx = (ee.x - pp.x) / d, fz = (ee.z - pp.z) / d;
    // bem alta e afastada, como a câmera de exploração: arena inteira em quadro
    desejo = new THREE.Vector3(pp.x - fx * 11, pp.y + 8.5, pp.z - fz * 11);
    olhar = new THREE.Vector3(pp.x + (ee.x - pp.x) * .48, 0.9, pp.z + (ee.z - pp.z) * .48);
  } else {
    const pp = mundo.domador.pos;
    desejo = new THREE.Vector3(pp.x, pp.y + 17, pp.z + 12);
    olhar = new THREE.Vector3(pp.x, 0.8, pp.z);
  }
  cena.camPos.lerp(desejo, Math.min(1, 8 * dt));
  cena.camAlvo.lerp(olhar, Math.min(1, 10 * dt));
  cena.camera.position.copy(cena.camPos);
  if (cena.shake > 0) {
    cena.shake -= dt * 2;
    cena.camera.position.x += (Math.random() - .5) * cena.shake * .5;
    cena.camera.position.y += (Math.random() - .5) * cena.shake * .5;
  }
  cena.camera.lookAt(cena.camAlvo);
}
