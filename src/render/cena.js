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
// beiral: LAJE sólida sob a base do telhado — preenche o vão entre a
// parede e a aba do telhado, engrossando o canto
function beiral(grupo, lado, y, corHex) {
  const cor = new THREE.Color(corHex).multiplyScalar(0.72);
  const aba = new THREE.Mesh(new THREE.BoxGeometry(lado, 0.26, lado),
    new THREE.MeshLambertMaterial({ color: cor }));
  aba.position.y = y;
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
function casa(g, x, z, corNome, y = 0) {
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
  beiral(grupo, 4.25, 2.52, corHex);
  // chaminé de pedra com boca escura
  const cham = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.1, 0.42), lamb(0x8d939c));
  cham.position.set(1.05, 3.35, -0.7); cham.castShadow = true; grupo.add(cham);
  const boca = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.14, 0.48), lamb(0x4a4a52));
  boca.position.set(1.05, 3.95, -0.7); grupo.add(boca);
  // porta PRETA = "dá para entrar" (linguagem visual das construções)
  const porta = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.2, 0.1), lamb(0x16121c));
  porta.position.set(0, 0.85, 1.62); grupo.add(porta);
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.12, 0.14), lamb(0x8a6a50));
  lintel.position.set(0, 1.5, 1.63); grupo.add(lintel);
  for (const lado of [-1, 1]) {
    const jan = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, 0.1), lamb(0xbfe3ff));
    jan.position.set(lado * 1.1, 1.62, 1.62); grupo.add(jan);
    const moldura = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.08, 0.12), lamb(0x8a6a50));
    moldura.position.set(lado * 1.1, 1.28, 1.63); grupo.add(moldura);
  }
  grupo.position.set(x, y, z);
  g.add(grupo);
}

/* centro de curas: prédio branco de telhado vermelho com cruz na fachada —
   no mesmo capricho das casas (fundação, textura, telhas e beiral) */
function centroCura(g, ct, y = 0) {
  const lamb = (cor) => new THREE.MeshLambertMaterial({ color: cor });
  const grupo = new THREE.Group();
  grupo.position.y = y;
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
  beiral(grupo, 5.8, 2.92, 0xd1462f);
  const porta = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.4, 0.1), lamb(0x16121c));
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
/* farol listrado com lanterna e FEIXE de luz girando (marco da Ilha Farol) */
function farol(g, x, z, y = 0) {
  const lamb = (cor) => new THREE.MeshLambertMaterial({ color: cor });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.4, 0.6, 12), lamb(0x8d939c));
  base.position.set(x, y + 0.3, z); base.castShadow = true;
  base.userData.oclusor = true; g.add(base);
  const cores = [0xf7f3ea, 0xd1462f, 0xf7f3ea, 0xd1462f];
  let alt = y + 0.6;
  for (let i = 0; i < 4; i++) {
    const secao = new THREE.Mesh(
      new THREE.CylinderGeometry(1.0 - i * 0.12, 1.08 - i * 0.12, 1.1, 12), lamb(cores[i]));
    secao.position.set(x, alt + 0.55, z); secao.castShadow = true;
    secao.userData.oclusor = true; g.add(secao);
    alt += 1.1;
  }
  const galeria = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.14, 12), lamb(0x4a4a52));
  galeria.position.set(x, alt + 0.07, z); g.add(galeria);
  const lanterna = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.7, 10),
    new THREE.MeshLambertMaterial({ color: 0x9ad4e8, emissive: 0x2a7a8a }));
  lanterna.position.set(x, alt + 0.5, z); g.add(lanterna);
  const topo = new THREE.Mesh(new THREE.ConeGeometry(0.6, 0.5, 10), lamb(0xd1462f));
  topo.position.set(x, alt + 1.1, z); topo.castShadow = true; g.add(topo);
  // o feixe: um plano comprido aditivo preso num pivô que gira
  const pivo = new THREE.Group();
  pivo.position.set(x, alt + 0.5, z);
  g.add(pivo);
  const feixe = new THREE.Mesh(new THREE.PlaneGeometry(7, 0.5),
    new THREE.MeshBasicMaterial({ color: 0xbfe8dd, transparent: true, opacity: 0.35,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  feixe.position.x = 3.8;
  pivo.add(feixe);
  (g.userData.anims || []).push((t) => { pivo.rotation.y = t * 0.9; });
}
const DECOR = { fogueira, poco, banca, placa, farol };

/* píer de madeira + barco da balsa (que balança nas ondas) */
function montaBalsa(g, b, anims) {
  const lamb = (cor) => new THREE.MeshLambertMaterial({ color: cor });
  const s = b.dir === 'norte' ? -1 : 1; // o píer avança para o mar
  for (let i = 0; i < 6; i++) {
    const prancha = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.09, 0.55), lamb(0x8a6a50));
    prancha.position.set(b.x, 0.2, b.z + s * (0.35 + i * 0.62));
    prancha.castShadow = true; g.add(prancha);
    if (i % 2 === 0) for (const lado of [-1, 1]) {
      const poste = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.7, 6), lamb(0x6b4a2f));
      poste.position.set(b.x + lado * 0.85, 0.05, b.z + s * (0.35 + i * 0.62));
      g.add(poste);
    }
  }
  // o barco, atracado ao lado do píer
  const barco = new THREE.Group();
  barco.position.set(b.x + 2.2, 0.12, b.z + s * 2.2);
  g.add(barco);
  const casco = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 3), lamb(0x7a5233));
  casco.position.y = 0.25; casco.castShadow = true; barco.add(casco);
  const proa = new THREE.Mesh(new THREE.ConeGeometry(0.75, 1.1, 4), lamb(0x7a5233));
  proa.rotation.x = s > 0 ? Math.PI / 2 : -Math.PI / 2;
  proa.rotation.y = Math.PI / 4;
  proa.position.set(0, 0.25, s * 2.0);
  barco.add(proa);
  const beirada = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.12, 3.2), lamb(0x9a7243));
  beirada.position.y = 0.55; barco.add(beirada);
  const mastro = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 2.4, 6), lamb(0x6b4a2f));
  mastro.position.y = 1.7; barco.add(mastro);
  const vela = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.4),
    new THREE.MeshLambertMaterial({ color: 0xfff6df, side: THREE.DoubleSide }));
  vela.position.set(0.02, 1.9, -s * 0.4);
  vela.rotation.y = Math.PI / 2;
  barco.add(vela);
  const flamula = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.25),
    new THREE.MeshLambertMaterial({ color: 0x59e0d0, side: THREE.DoubleSide }));
  flamula.position.set(0.3, 2.8, 0);
  barco.add(flamula);
  if (anims) anims.push((t) => {
    barco.position.y = 0.12 + Math.sin(t * 1.6) * 0.05;
    barco.rotation.z = Math.sin(t * 1.3) * 0.04;
    barco.rotation.x = Math.sin(t * 1.9) * 0.03;
    flamula.rotation.y = Math.sin(t * 4) * 0.5;
  });
}

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
  const aguas = mapa.aguas || (mapa.agua ? [mapa.agua] : []);
  // borda "mar": ilha em mar aberto — sem moldura de árvores; o horizonte
  // é água a perder de vista (quatro planos azuis cobrindo o avental)
  // borda "mar": ilha em mar aberto — nada de moldura de árvores; as
  // próprias faixas de água (estendidas nos dados) fazem o horizonte
  if (mapa.borda === 'mar') return;
  const bloqueada = (x, z) => {
    for (const s of saidas) {
      const folga = 3;
      if (s.borda === 'leste' && x > L.x && z > s.de - folga && z < s.ate + folga) return true;
      if (s.borda === 'oeste' && x < -L.x && z > s.de - folga && z < s.ate + folga) return true;
      if (s.borda === 'sul' && z > L.z && x > s.de - folga && x < s.ate + folga) return true;
      if (s.borda === 'norte' && z < -L.z && x > s.de - folga && x < s.ate + folga) return true;
    }
    for (const ag of aguas)
      if (x > ag.x0 - 1 && x < ag.x1 + 1 && z > ag.z0 - 1 && z < ag.z1 + 1) return true;
    return false;
  };
  // sem muros artificiais: a moldura é feita de árvores/rochas GRANDES em
  // filas escalonadas — cada fila mais funda é maior, tapando o horizonte
  // de forma natural, com vãos nas passagens
  const planta = (x, z, i, esc = 1) => {
    if (bloqueada(x, z)) return;
    if (mapa.borda === 'montanha') {
      // fila da frente com rochas MENORES: nada invade a área jogável
      const r = esc === 1 ? 1.0 + (i % 3) * 0.25 : (1.3 + (i % 3) * 0.5) * esc;
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
  for (let x = -L.x - 2.4; x <= L.x + 12; x += passo, i++) {
    planta(x, -L.z - 2.4, i); planta(x, L.z + 2.4, i);
    planta(x + 1.2, -L.z - 4.3, i + 1, 1.35); planta(x + 1.2, L.z + 4.3, i + 1, 1.35);
    planta(x + 0.5, -L.z - 6.5, i + 2, 1.7); planta(x + 0.5, L.z + 6.5, i + 2, 1.7);
    // duas fileiras EXTRAS, cada vez mais altas: o horizonte vira floresta
    planta(x + 1.6, -L.z - 9, i + 3, 2.15); planta(x + 1.6, L.z + 9, i + 3, 2.15);
    planta(x + 0.4, -L.z - 11.7, i + 4, 2.6); planta(x + 0.4, L.z + 11.7, i + 4, 2.6);
  }
  for (let z = -L.z - 2.4; z <= L.z + 12; z += passo, i++) {
    planta(-L.x - 2.4, z, i); planta(L.x + 2.4, z, i);
    planta(-L.x - 4.3, z + 1.2, i + 1, 1.35); planta(L.x + 4.3, z + 1.2, i + 1, 1.35);
    planta(-L.x - 6.5, z + 0.5, i + 2, 1.7); planta(L.x + 6.5, z + 0.5, i + 2, 1.7);
    planta(-L.x - 9, z + 1.6, i + 3, 2.15); planta(L.x + 9, z + 1.6, i + 3, 2.15);
    planta(-L.x - 11.7, z + 0.4, i + 4, 2.6); planta(L.x + 11.7, z + 0.4, i + 4, 2.6);
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
  // PLATAFORMA verde contínua (canteiro elevado de cantos redondos, com
  // laterais em degradê) — os arbustos ficam plantados EM CIMA dela
  const wG = G.x1 - G.x0 + 2.4, dG = G.z1 - G.z0 + 2.4;
  const cxG = (G.x0 + G.x1) / 2, czG = (G.z0 + G.z1) / 2;
  const c0 = new THREE.Color(0x7d5f3e), c1 = new THREE.Color(0xbc9668);
  for (let i = 0; i < 2; i++) {
    const folga = (1 - i) * 0.4;
    const geo = new THREE.ExtrudeGeometry(
      formaArredondada(wG + folga, dG + folga, 1.3),
      { depth: 0.11, bevelEnabled: false });
    const m = new THREE.Mesh(geo,
      new THREE.MeshLambertMaterial({ color: c0.clone().lerp(c1, i) }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(cxG, i * 0.11, czG);
    m.castShadow = m.receiveShadow = true;
    scene.add(m);
  }
  // topo verde CONTÍNUO cobrindo a plataforma inteira
  const cap = new THREE.Mesh(
    new THREE.ExtrudeGeometry(formaArredondada(wG - 0.12, dG - 0.12, 1.3),
      { depth: 0.05, bevelEnabled: false }),
    new THREE.MeshLambertMaterial({ color: 0x57a441 }));
  cap.rotation.x = -Math.PI / 2;
  cap.position.set(cxG, 0.22, czG);
  cap.receiveShadow = true;
  scene.add(cap);
  const TOPO = 0.27; // altura do topo (a sim sobe junto: alturaGrama)
  const geoArb = new THREE.SphereGeometry(0.78, 10, 7);
  const passo = 1.05;
  let i = 0;
  // os arbustos vão ATÉ a borda da plataforma, sem faixa verde sobrando
  for (let px = G.x0 - 0.3; px <= G.x1 + 0.3; px += passo) {
    for (let pz = G.z0 - 0.3; pz <= G.z1 + 0.3; pz += passo, i++) {
      const m = new THREE.Mesh(geoArb, mats[(i * 7) % mats.length]);
      const esc = 0.9 + ((i * 13) % 10) / 45;
      m.scale.set(esc, 0.62 * esc, esc);
      m.position.set(px + (((i * 31) % 7) - 3) * 0.06, TOPO + 0.34,
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

/* CASTELO VENTANIA — muralhas com ameias, torres nos cantos, torreão
   central com bandeira ao vento e portão ao sul (colisão em sim/mundo.js) */
function montaCastelo(g, c, anims, mapa = null) {
  const lamb = (cor) => new THREE.MeshLambertMaterial({ color: cor });
  const PEDRA = 0x8d939c, ESCURA = 0x6e7680, TELHA = 0x3a6bc9;
  const grupo = new THREE.Group();
  // o castelo assenta na COTA do terreno (fica no alto do platô)
  grupo.position.set(c.x, mapa ? alturaTerreno(mapa, c) : 0, c.z);
  g.add(grupo);
  const muro = (w, d, x, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 3.2, d), lamb(PEDRA));
    m.position.set(x, 1.6, z);
    m.castShadow = m.receiveShadow = true;
    m.userData.oclusor = true;
    grupo.add(m);
    // ameias no topo
    const aoLongoX = w > d;
    const comp = aoLongoX ? w : d;
    for (let t = -comp / 2 + 0.5; t <= comp / 2 - 0.5; t += 1.1) {
      const dente = new THREE.Mesh(new THREE.BoxGeometry(
        aoLongoX ? 0.55 : d + 0.1, 0.5, aoLongoX ? w * 0 + d + 0.1 : 0.55), lamb(ESCURA));
      dente.position.set(aoLongoX ? x + t : x, 3.45, aoLongoX ? z : z + t);
      grupo.add(dente);
    }
  };
  muro(16, 1.2, 0, -6);        // norte
  muro(1.2, 12, -8, 0);        // oeste
  muro(1.2, 12, 8, 0);         // leste
  muro(6, 1.2, -5, 6);         // sul (esquerda do portão)
  muro(6, 1.2, 5, 6);          // sul (direita do portão)
  // torres dos cantos
  for (const [tx, tz] of [[-8, -6], [8, -6], [-8, 6], [8, 6]]) {
    const torre = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.5, 4.6, 10), lamb(PEDRA));
    torre.position.set(tx, 2.3, tz);
    torre.castShadow = true; torre.userData.oclusor = true;
    grupo.add(torre);
    const chapeu = new THREE.Mesh(new THREE.ConeGeometry(1.6, 1.4, 10), lamb(TELHA));
    chapeu.position.set(tx, 5.3, tz); chapeu.castShadow = true;
    chapeu.userData.oclusor = true;
    grupo.add(chapeu);
  }
  // torreão central com bandeira dos Senhores do Vento
  const torreao = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.5, 6.2, 12), lamb(PEDRA));
  torreao.position.set(0, 3.1, -2);
  torreao.castShadow = true; torreao.userData.oclusor = true;
  grupo.add(torreao);
  const coroa = new THREE.Mesh(new THREE.ConeGeometry(2.6, 2, 12), lamb(TELHA));
  coroa.position.set(0, 7.2, -2); coroa.castShadow = true;
  coroa.userData.oclusor = true;
  grupo.add(coroa);
  const porta = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.8, 0.2), lamb(0x16121c));
  porta.position.set(0, 0.9, 0.45); grupo.add(porta);
  const mastro = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 6), lamb(0x6b4a2f));
  mastro.position.set(0, 9.2, -2); grupo.add(mastro);
  const bandeira = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.8),
    new THREE.MeshLambertMaterial({ color: 0x59e0d0, side: THREE.DoubleSide }));
  bandeira.position.set(0.8, 9.6, -2);
  grupo.add(bandeira);
  // a bandeira tremula ao vento do fiorde
  if (anims) anims.push((t) => {
    bandeira.rotation.y = Math.sin(t * 3.2) * 0.35;
    bandeira.position.x = 0.8 + Math.sin(t * 3.2) * 0.06;
  });
  // portão: batentes de pedra
  for (const lado of [-1, 1]) {
    const batente = new THREE.Mesh(new THREE.BoxGeometry(0.6, 3.8, 1.4), lamb(ESCURA));
    batente.position.set(lado * 2.2, 1.9, 6);
    batente.castShadow = true; batente.userData.oclusor = true;
    grupo.add(batente);
  }
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
// piso xadrez creme do Centro (estilo clássico)
function texturaXadrez() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#efe3c0'; ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = '#e0d0a4';
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++)
    if ((i + j) % 2) ctx.fillRect(i * 16, j * 16, 16, 16);
  ctx.strokeStyle = 'rgba(160,140,100,0.5)'; ctx.lineWidth = 1;
  for (let k = 0; k <= 64; k += 16) {
    ctx.beginPath(); ctx.moveTo(k, 0); ctx.lineTo(k, 64); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, k); ctx.lineTo(64, k); ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
function montaInterior(g, mapa) {
  const lamb = (cor) => new THREE.MeshLambertMaterial({ color: cor });
  const L = mapa.limite;
  const caverna = mapa.estilo === 'caverna';
  const centro = mapa.estilo === 'centro';
  let matPiso;
  if (centro) {
    const tx = texturaXadrez();
    tx.repeat.set(L.x, L.z);
    matPiso = new THREE.MeshLambertMaterial({ map: tx });
  } else matPiso = lamb(caverna ? 0x474254 : 0xa8734a);
  const piso = new THREE.Mesh(new THREE.BoxGeometry(L.x * 2 + 0.8, 0.1, L.z * 2 + 0.8), matPiso);
  piso.position.y = -0.05; piso.receiveShadow = true; g.add(piso);
  const corParede = caverna ? 0x555068 : 0xe8d3b0;
  const parede = (w, d, x, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 2.6, d), lamb(corParede));
    m.position.set(x, 1.3, z); m.castShadow = true; g.add(m);
  };
  parede(L.x * 2 + 0.8, 0.4, 0, -L.z - 0.2);           // fundo
  parede(0.4, L.z * 2 + 0.8, -L.x - 0.2, 0);           // esquerda
  parede(0.4, L.z * 2 + 0.8, L.x + 0.2, 0);            // direita
  const seg = L.x - 1;                                  // frente com vão da porta
  parede(seg, 0.4, -(1 + seg / 2), L.z + 0.2);
  parede(seg, 0.4, 1 + seg / 2, L.z + 0.2);
  if (caverna) {
    // CAVERNA: estalagmites, pedras e cristais que brilham no escuro
    for (const [x, z, esc] of [[-7, 4, 1.2], [6, -4, 1.5], [8, 3, 1.0], [3, -5.5, 0.8], [-4, 5.2, 0.9]]) {
      const est = new THREE.Mesh(new THREE.ConeGeometry(0.35 * esc, 1.4 * esc, 7), lamb(0x605a75));
      est.position.set(x, 0.7 * esc, z); est.castShadow = true; est.userData.oclusor = true; g.add(est);
    }
    for (const [x, z] of [[-8.5, -6], [1, 1.5], [8.5, -6], [-1.5, -6]]) {
      const pedra = new THREE.Mesh(new THREE.DodecahedronGeometry(0.5), lamb(0x4d4860));
      pedra.position.set(x, 0.3, z); pedra.castShadow = true; g.add(pedra);
    }
    // cristais luminosos — um aglomerado marca o covil das feras (a "grama")
    const cristal = (x, z, esc, cor) => {
      const cr = new THREE.Mesh(new THREE.OctahedronGeometry(0.3 * esc),
        new THREE.MeshLambertMaterial({ color: cor, emissive: 0x1f9b8e }));
      cr.position.set(x, 0.3 * esc, z);
      cr.rotation.y = x * 2.1; g.add(cr);
    };
    const G = mapa.grama;
    if (G) for (let i = 0; i < 8; i++) {
      const gx = G.x0 + ((i * 37) % 10) / 10 * (G.x1 - G.x0);
      const gz = G.z0 + ((i * 53) % 10) / 10 * (G.z1 - G.z0);
      cristal(gx, gz, 0.8 + (i % 3) * 0.35, i % 2 ? 0x59e0d0 : 0x7a6fd0);
    }
    cristal(7, 5, 1.4, 0x59e0d0);
    cristal(-9, -2, 1.1, 0x7a6fd0);
    return;
  }
  if (centro) {
    // CENTRO estilo clássico: balcão vermelho, máquina de cura, TV,
    // estante de produtos, vasos de flores e tapetes
    const balcao = new THREE.Mesh(new THREE.BoxGeometry(L.x * 1.2, 1.0, 0.9), lamb(0xe0685a));
    balcao.position.set(0, 0.5, -L.z + 1.3); balcao.castShadow = true; g.add(balcao);
    const tampo = new THREE.Mesh(new THREE.BoxGeometry(L.x * 1.2 + 0.2, 0.12, 1.1), lamb(0xfff3da));
    tampo.position.set(0, 1.06, -L.z + 1.3); g.add(tampo);
    // máquina de cura sobre o balcão: base branca, painel verde e luzes
    const maq = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.45, 0.9), lamb(0xf7f3ea));
    maq.position.set(-1.6, 1.35, -L.z + 1.25); maq.castShadow = true; g.add(maq);
    const painel = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.1, 0.55),
      new THREE.MeshLambertMaterial({ color: 0x5fd35a, emissive: 0x1a4a1a }));
    painel.position.set(-1.6, 1.63, -L.z + 1.25); g.add(painel);
    for (let i = 0; i < 3; i++) {
      const luz = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5),
        new THREE.MeshLambertMaterial({ color: 0xffd23f, emissive: 0x996600 }));
      luz.position.set(-2.1 + i * 0.5, 1.62, -L.z + 1.62); g.add(luz);
    }
    // TV na parede do fundo + cruz vermelha
    const tv = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 0.1), lamb(0x2b2836));
    tv.position.set(2.6, 1.9, -L.z + 0.06); g.add(tv);
    const tela = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.7, 0.06),
      new THREE.MeshLambertMaterial({ color: 0x9ad4e8, emissive: 0x123a4a }));
    tela.position.set(2.6, 1.9, -L.z + 0.12); g.add(tela);
    const cr1 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.06), lamb(0xd1462f));
    cr1.position.set(-2.6, 2.0, -L.z + 0.06); g.add(cr1);
    const cr2 = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.5, 0.06), lamb(0xd1462f));
    cr2.position.set(-2.6, 2.0, -L.z + 0.06); g.add(cr2);
    // estante de produtos na parede esquerda
    const estante = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.7, 2.4), lamb(0x8a6a50));
    estante.position.set(-L.x + 0.55, 0.85, -0.6); estante.castShadow = true; g.add(estante);
    for (let p = 0; p < 3; p++) for (let q = 0; q < 3; q++) {
      const prod = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.22, 0.5),
        lamb([0xd1462f, 0x3a6bc9, 0xffd23f][(p + q) % 3]));
      prod.position.set(-L.x + 0.62, 0.5 + p * 0.5, -1.4 + q * 0.8); g.add(prod);
    }
    // vasos de flores nos cantos
    for (const [vx, vz] of [[L.x - 0.9, -L.z + 0.9], [L.x - 0.9, L.z - 0.9], [-L.x + 0.9, L.z - 0.9]]) {
      const vaso = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.18, 0.4, 8), lamb(0xc9563f));
      vaso.position.set(vx, 0.2, vz); vaso.castShadow = true; g.add(vaso);
      const folha = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), lamb(0x4e9a3f));
      folha.position.set(vx, 0.62, vz); g.add(folha);
      const flor = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 5), lamb(0xff7fa8));
      flor.position.set(vx + 0.12, 0.82, vz); g.add(flor);
    }
    // tapetes: o azul central e o vermelho da entrada
    const tapete = new THREE.Mesh(new THREE.CircleGeometry(1.3, 16), lamb(0x9ad4e8));
    tapete.rotation.x = -Math.PI / 2; tapete.position.y = 0.02; tapete.position.z = 0.4; g.add(tapete);
    const capacho = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.03, 1.0), lamb(0xd1462f));
    capacho.position.set(0, 0.02, L.z - 0.6); g.add(capacho);
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
/* ---------- vegetação 2.5D: folhas de sprite em planos cruzados ---------- */
const _texFlores = {};
function texturaFlor(cor) {
  if (_texFlores[cor]) return _texFlores[cor];
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d');
  x.strokeStyle = '#3f7a35'; x.lineWidth = 3;
  x.beginPath(); x.moveTo(32, 64); x.quadraticCurveTo(29, 44, 32, 26); x.stroke();
  x.fillStyle = '#4e9a3f';
  x.beginPath(); x.ellipse(25, 46, 7, 3.5, -0.6, 0, 6.284); x.fill();
  x.fillStyle = cor;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * 6.284;
    x.beginPath();
    x.ellipse(32 + Math.cos(a) * 8, 22 + Math.sin(a) * 8, 6.5, 4.5, a, 0, 6.284);
    x.fill();
  }
  x.fillStyle = '#ffd23f';
  x.beginPath(); x.arc(32, 22, 4.5, 0, 6.284); x.fill();
  _texFlores[cor] = new THREE.CanvasTexture(c);
  return _texFlores[cor];
}
// malha ÚNICA de "cruzetas" (2 planos em X) para muitos sprites — 1 draw call
function malhaCruzetas(posicoes, tex, larg, alt, tinta = null) {
  const pos = [], nrm = [], uv = [], idx = [];
  let vi = 0;
  for (const p of posicoes) {
    const esc = 0.8 + ((Math.abs(p.x * 13 + p.z * 7) | 0) % 10) / 25;
    const rot = Math.abs(p.x * 31 + p.z * 17) % 3.14;
    for (const a of [rot, rot + 1.57]) {
      const dx = Math.cos(a) * larg * esc, dz = Math.sin(a) * larg * esc;
      const h = alt * esc;
      pos.push(p.x - dx, p.y, p.z - dz, p.x + dx, p.y, p.z + dz,
               p.x + dx, p.y + h, p.z + dz, p.x - dx, p.y + h, p.z - dz);
      for (let k = 0; k < 4; k++) nrm.push(0, 1, 0);
      uv.push(0, 0, 1, 0, 1, 1, 0, 1);
      idx.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3);
      vi += 4;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  const mat = new THREE.MeshLambertMaterial({
    map: tex, alphaTest: 0.55, side: THREE.DoubleSide });
  if (tinta) mat.color.setHex(tinta);
  return new THREE.Mesh(geo, mat);
}

// terra batida dos caminhos rurais (a vila usa lajes de pedra)
let _texTerraCam = null;
function texturaCaminhoTerra() {
  if (_texTerraCam) return _texTerraCam;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#b08a5a'; x.fillRect(0, 0, 128, 128);
  let sem = 23;
  const rnd = () => (sem = (sem * 1103515245 + 12345) % 2147483648) / 2147483648;
  const tons = ['#a67f50', '#bc9668', '#96744e', '#c49a68'];
  for (let i = 0; i < 46; i++) {
    x.fillStyle = tons[i % tons.length];
    x.beginPath();
    x.ellipse(rnd() * 128, rnd() * 128, 6 + rnd() * 14, 4 + rnd() * 8, rnd() * 3, 0, 6.284);
    x.fill();
  }
  for (let i = 0; i < 34; i++) {
    x.fillStyle = i % 3 ? '#8a6a50' : '#c9c2b4';
    x.fillRect(rnd() * 126, rnd() * 126, 2 + rnd() * 2.5, 1.5 + rnd() * 2);
  }
  _texTerraCam = new THREE.CanvasTexture(c);
  _texTerraCam.wrapS = _texTerraCam.wrapT = THREE.RepeatWrapping;
  return _texTerraCam;
}

/* caminhos v2: LAJE elevada de cantos redondos, textura alinhada ao mundo
   (cruzamentos sem briga) e meio-fio de pedra na vila */
function montaCaminhos(g, mapa) {
  const vila = (mapa.chao || 'grama') === 'vila';
  const ESC = 4.5;
  const lamb = (cor) => new THREE.MeshLambertMaterial({ color: cor });
  (mapa.caminhos || []).forEach((c, i) => {
    const w = c.x1 - c.x0, d = c.z1 - c.z0;
    const cx = (c.x0 + c.x1) / 2, cz = (c.z0 + c.z1) / 2;
    const tex = (vila ? texturaLajes() : texturaCaminhoTerra()).clone();
    tex.needsUpdate = true;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1 / ESC, 1 / ESC);
    tex.offset.set(((cx / ESC) % 1 + 1) % 1, ((cz / ESC) % 1 + 1) % 1);
    const r = Math.min(1.1, Math.min(w, d) * 0.28);
    const geo = new THREE.ExtrudeGeometry(formaArredondada(w, d, r),
      { depth: 0.05, bevelEnabled: false });
    const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: tex }));
    m.rotation.x = -Math.PI / 2;
    // assenta na cota do terreno; cada caminho um fiapo acima do anterior
    m.position.set(cx,
      alturaTerreno(mapa, { x: cx, z: cz }) + 0.008 + i * 0.012, cz);
    m.receiveShadow = true;
    g.add(m);
    // meio-fio de pedra nas beiradas (só na vila; no campo a laje basta)
    if (!vila) return;
    const horizontal = w >= d;
    const passoB = 2.6;
    const ini = horizontal ? c.x0 + 1 : c.z0 + 1;
    const fim = horizontal ? c.x1 - 1 : c.z1 - 1;
    for (let t = ini; t <= fim; t += passoB) {
      for (const lado of [-1, 1]) {
        const px = horizontal ? t : cx + lado * (w / 2 + 0.22);
        const pz = horizontal ? cz + lado * (d / 2 + 0.22) : t;
        const jx = px + (((t * 13) % 5) - 2) * 0.07, jz = pz + (((t * 7) % 5) - 2) * 0.07;
        const guia = new THREE.Mesh(new THREE.BoxGeometry(
          horizontal ? 0.5 : 0.2, 0.14, horizontal ? 0.2 : 0.5), lamb(0x9aa0a8));
        guia.position.set(jx, alturaTerreno(mapa, { x: jx, z: jz }) + 0.07, jz);
        guia.receiveShadow = true;
        g.add(guia);
      }
    }
  });
}

/* tapete de VIDA do mapa: tufos, flores, pedrinhas e cogumelos espalhados
   (2.5D em malha única; nada disso colide — é pura cenografia) */
function montaDetalhes(g, mapa) {
  const L = mapa.limite;
  let sem = ((L.x * 131 + L.z * 57) | 0) + 9;
  const rnd = () => (sem = (sem * 1103515245 + 12345) % 2147483648) / 2147483648;
  const gramas = mapa.gramas || (mapa.grama ? [mapa.grama] : []);
  const perto = (x, z, px, pz, r) => Math.hypot(x - px, z - pz) < r;
  const livre = (x, z) => {
    for (const ag of mapa.aguas || (mapa.agua ? [mapa.agua] : []))
      if (x > ag.x0 - 1 && x < ag.x1 + 1 && z > ag.z0 - 1 && z < ag.z1 + 1) return false;
    for (const c of mapa.caminhos || [])
      if (x > c.x0 - 0.9 && x < c.x1 + 0.9 && z > c.z0 - 0.9 && z < c.z1 + 0.9) return false;
    for (const G of gramas)
      if (x > G.x0 - 1.7 && x < G.x1 + 1.7 && z > G.z0 - 1.7 && z < G.z1 + 1.7) return false;
    for (const [px, pz] of mapa.casas || []) if (perto(x, z, px, pz, 3.4)) return false;
    if (mapa.centro && perto(x, z, mapa.centro.x, mapa.centro.z, 3.8)) return false;
    for (const dd of mapa.decor || []) if (perto(x, z, dd[1], dd[2], 2.5)) return false;
    for (const a of mapa.arvores || []) if (perto(x, z, a[0], a[1], 1.7)) return false;
    for (const p of mapa.pedras || []) if (perto(x, z, p[0], p[1], 1.7)) return false;
    if (mapa.caverna && perto(x, z, mapa.caverna.x, mapa.caverna.z, 3.2)) return false;
    for (const t of mapa.treinadores || []) if (perto(x, z, t.x, t.z, 1.8)) return false;
    for (const n of mapa.npcs || []) if (perto(x, z, n[0], n[1], 1.7)) return false;
    return true;
  };
  const chao = mapa.chao || 'grama';
  const deserto = chao === 'deserto';
  // flores e cogumelos só onde o chão é VERDE; terra/penhasco ganham pedras
  const verde = chao === 'grama' || chao === 'vila';
  const lamb = (cor) => new THREE.MeshLambertMaterial({ color: cor });
  const florB = [], florR = [];
  let pedrinhas = 0, cactinhos = 0, cogumelos = 0;
  for (let i = 0; i < 150; i++) {
    const x = (rnd() * 2 - 1) * (L.x - 1.5), z = (rnd() * 2 - 1) * (L.z - 1.5);
    if (!livre(x, z)) continue;
    const y = alturaTerreno(mapa, { x, z });
    const r = rnd();
    const pedrinha = () => {
      if (pedrinhas++ > 22) return;
      const p = new THREE.Mesh(new THREE.DodecahedronGeometry(0.09 + rnd() * 0.09),
        lamb(deserto ? 0xbfa26a : 0x8d939c));
      p.position.set(x, y + 0.07, z); p.rotation.y = rnd() * 3;
      g.add(p);
    };
    if (deserto) {
      if (r < 0.55) pedrinha();
      else if (cactinhos++ < 12) cacto(g, x, z, 0.32 + rnd() * 0.2);
    } else if (!verde) {
      if (r < 0.4) pedrinha();
    } else {
      if (r < 0.4) florB.push({ x, y, z });
      else if (r < 0.66) florR.push({ x, y, z });
      else if (r < 0.85) pedrinha();
      else if (cogumelos++ < 8) {
        const pe = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.14, 6), lamb(0xf2e2c4));
        pe.position.set(x, y + 0.07, z); g.add(pe);
        const chapeu = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), lamb(0xd1462f));
        chapeu.scale.y = 0.6; chapeu.position.set(x, y + 0.16, z); g.add(chapeu);
      }
    }
  }
  if (florB.length) g.add(malhaCruzetas(florB, texturaFlor('#fff6df'), 0.34, 0.6));
  if (florR.length) g.add(malhaCruzetas(florR, texturaFlor('#ff8ab0'), 0.34, 0.6));
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
  // chão bem maior que o mapa: os cantos da câmera nunca mostram o vazio
  montaChao(g, Math.max(mapa.limite.x, mapa.limite.z) * 2 + 64, mapa.chao || 'grama', mapa);
  montaCaminhos(g, mapa);
  montaPedras(g, mapa);
  montaDetalhes(g, mapa);
  (mapa.arvores || []).forEach(([x, z, p]) => {
    const grupoArv = arvore(g, x, z, p);
    if (grupoArv) grupoArv.position.y = alturaTerreno(mapa, { x, z });
  });
  (mapa.casas || []).forEach(([x, z, cor]) =>
    casa(g, x, z, cor, alturaTerreno(mapa, { x, z })));
  if (mapa.centro)
    centroCura(g, mapa.centro, alturaTerreno(mapa, mapa.centro));
  if (mapa.castelo) montaCastelo(g, mapa.castelo, cena.anims, mapa);
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
  for (const ag of mapa.aguas || (mapa.agua ? [mapa.agua] : [])) montaAgua(g, ag);
  if (mapa.balsa) montaBalsa(g, mapa.balsa, cena.anims);
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
