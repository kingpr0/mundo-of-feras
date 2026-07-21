// CENA — Three.js: luz, cenário dos mapas (montados a partir de mapas.json),
// arena de batalha, partículas e as duas câmeras (exploração e lock-on).
import * as THREE from 'three';
import { alturaTerreno } from '../sim/mundo.js';
import { criarNPC } from './modelos.js';

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
    oclusores: [],
    oclusoresArena: [],
  };
  arenaG.traverse((o) => { if (o.isMesh && o.userData.oclusor) estado.oclusoresArena.push(o); });
  const resize = () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  };
  addEventListener('resize', resize); resize();
  return estado;
}

function montaChao(scene, tam = 70, tipo = 'grama') {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const x = c.getContext('2d');
  const terra = tipo === 'terra';
  // gerador determinístico (a textura repete sem costura)
  let semente = { grama: 31, terra: 77, vila: 51, penhasco: 93 }[tipo] || 31;
  const rnd = () => (semente = (semente * 1103515245 + 12345) % 2147483648) / 2147483648;
  // base orgânica: manchas suaves em vez de xadrez
  const PALETAS = {
    grama:    { base: '#5fa848', tons: ['#67b34f', '#58a041', '#6fbd58', '#61ad4a'] },
    terra:    { base: '#a67f50', tons: ['#b08a5a', '#9c7449', '#ad8355', '#a17a4d'] },
    vila:     { base: '#b39064', tons: ['#a67f50', '#bc9668', '#8faf5f', '#ab8558'] },
    penhasco: { base: '#9c5242', tons: ['#a85a4a', '#8f4a3c', '#b06552', '#96503f'] },
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
  const ch = new THREE.Mesh(new THREE.PlaneGeometry(tam, tam),
    new THREE.MeshLambertMaterial({ map: t }));
  ch.rotation.x = -Math.PI / 2; ch.receiveShadow = true; scene.add(ch);
}

/* casinha estilo Pokémon: corpo claro, telhado piramidal colorido, porta e janelas */
const COR_TELHADO = { vermelho: 0xd1462f, azul: 0x3a6bc9, verde: 0x2f8a4a };
function casa(g, x, z, corNome) {
  const grupo = new THREE.Group();
  const lamb = (cor) => new THREE.MeshLambertMaterial({ color: cor });
  const corpo = new THREE.Mesh(new THREE.BoxGeometry(3.6, 2.2, 3.2), lamb(0xf2e2c4));
  corpo.position.y = 1.1; corpo.castShadow = true; corpo.userData.oclusor = true; grupo.add(corpo);
  const telhado = new THREE.Mesh(new THREE.ConeGeometry(2.9, 1.6, 4),
    lamb(COR_TELHADO[corNome] || COR_TELHADO.vermelho));
  telhado.position.y = 3.0; telhado.rotation.y = Math.PI / 4; telhado.castShadow = true;
  telhado.userData.oclusor = true;
  grupo.add(telhado);
  const porta = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.2, 0.1), lamb(0x6b4a2f));
  porta.position.set(0, 0.6, 1.62); grupo.add(porta);
  for (const lado of [-1, 1]) {
    const jan = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, 0.1), lamb(0xbfe3ff));
    jan.position.set(lado * 1.1, 1.4, 1.62); grupo.add(jan);
  }
  grupo.position.set(x, 0, z);
  g.add(grupo);
}

/* centro de curas: prédio branco de telhado vermelho com cruz na fachada */
function centroCura(g, ct) {
  const lamb = (cor) => new THREE.MeshLambertMaterial({ color: cor });
  const grupo = new THREE.Group();
  const corpo = new THREE.Mesh(new THREE.BoxGeometry(5.2, 2.6, 3.8), lamb(0xf7f3ea));
  corpo.position.y = 1.3; corpo.castShadow = true; corpo.userData.oclusor = true; grupo.add(corpo);
  const telhado = new THREE.Mesh(new THREE.ConeGeometry(4.0, 1.7, 4), lamb(0xd1462f));
  telhado.position.y = 3.4; telhado.rotation.y = Math.PI / 4; telhado.castShadow = true;
  telhado.userData.oclusor = true;
  grupo.add(telhado);
  const porta = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.4, 0.1), lamb(0x9ad4e8));
  porta.position.set(0, 0.7, 1.92); grupo.add(porta);
  // cruz branca sobre a porta
  const cr1 = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.08), lamb(0xffffff));
  cr1.position.set(0, 2.1, 1.94); grupo.add(cr1);
  const cr2 = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.7, 0.08), lamb(0xffffff));
  cr2.position.set(0, 2.1, 1.94); grupo.add(cr2);
  for (const lado of [-1, 1]) {
    const jan = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 0.1), lamb(0xbfe3ff));
    jan.position.set(lado * 1.7, 1.5, 1.92); grupo.add(jan);
  }
  grupo.position.set(ct.x, 0, ct.z);
  g.add(grupo);
}

/* decorações de vila (fogueira, poço, banca de feira) e escadas */
function fogueira(g, x, z, y = 0) {
  const lamb = (cor) => new THREE.MeshLambertMaterial({ color: cor });
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
  const ch1 = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.5, 8),
    new THREE.MeshLambertMaterial({ color: 0xff8a3d, emissive: 0x993300 }));
  ch1.position.set(x, y + 0.4, z); g.add(ch1);
  const ch2 = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.3, 8),
    new THREE.MeshLambertMaterial({ color: 0xffe066, emissive: 0x996600 }));
  ch2.position.set(x, y + 0.5, z); g.add(ch2);
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
const DECOR = { fogueira, poco, banca };

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
  const planta = (x, z, i) => {
    if (bloqueada(x, z)) return;
    if (mapa.borda === 'montanha') {
      // muralha de rochas em vez de mata
      const r = 1.3 + (i % 3) * 0.5;
      const pedra = new THREE.Mesh(new THREE.DodecahedronGeometry(r),
        new THREE.MeshLambertMaterial({ color: (i % 2) ? 0x7d838c : 0x6e7680 }));
      pedra.position.set(x + (Math.random() - 0.5), r * 0.7, z + (Math.random() - 0.5));
      pedra.castShadow = true; pedra.userData.oclusor = true; g.add(pedra);
      return;
    }
    arvore(g, x + (Math.random() - 0.5), z + (Math.random() - 0.5), i % 2);
  };
  const passo = 2.4;
  let i = 0;
  for (let x = -L.x - 1.5; x <= L.x + 1.5; x += passo, i++) {
    planta(x, -L.z - 1.5, i); planta(x, L.z + 1.5, i);
    planta(x + 1.2, -L.z - 3.4, i + 1); planta(x + 1.2, L.z + 3.4, i + 1);
  }
  for (let z = -L.z - 1.5; z <= L.z + 1.5; z += passo, i++) {
    planta(-L.x - 1.5, z, i); planta(L.x + 1.5, z, i);
    planta(-L.x - 3.4, z + 1.2, i + 1); planta(L.x + 3.4, z + 1.2, i + 1);
  }
  // cortina sólida atrás da muralha (nada do "mundo cru" aparece por trás),
  // com VÃOS abertos exatamente nas passagens
  const corCortina = mapa.borda === 'montanha' ? 0x5a6068 : 0x24491f;
  const segCortina = (horizontal, fixo, a0, a1) => {
    if (a1 - a0 < 1) return;
    const w = horizontal ? a1 - a0 : 2.5;
    const d = horizontal ? 2.5 : a1 - a0;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 8, d),
      new THREE.MeshLambertMaterial({ color: corCortina }));
    m.position.set(horizontal ? (a0 + a1) / 2 : fixo, 3.5, horizontal ? fixo : (a0 + a1) / 2);
    m.userData.oclusor = true;
    g.add(m);
  };
  const lados = [
    { borda: 'norte', horizontal: true, fixo: -L.z - 5.6, ini: -L.x - 11, fim: L.x + 11 },
    { borda: 'sul', horizontal: true, fixo: L.z + 5.6, ini: -L.x - 11, fim: L.x + 11 },
    { borda: 'oeste', horizontal: false, fixo: -L.x - 5.6, ini: -L.z - 11, fim: L.z + 11 },
    { borda: 'leste', horizontal: false, fixo: L.x + 5.6, ini: -L.z - 11, fim: L.z + 11 },
  ];
  for (const lado of lados) {
    const vaos = saidas.filter((s) => s.borda === lado.borda)
      .map((s) => [s.de - 2.5, s.ate + 2.5])
      .sort((a, b) => a[0] - b[0]);
    let cursor = lado.ini;
    for (const [v0, v1] of vaos) { segCortina(lado.horizontal, lado.fixo, cursor, v0); cursor = v1; }
    segCortina(lado.horizontal, lado.fixo, cursor, lado.fim);
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
  const base = new THREE.Mesh(
    new THREE.PlaneGeometry(G.x1 - G.x0 + 1, G.z1 - G.z0 + 1),
    new THREE.MeshLambertMaterial({ color: 0x357a2e }));
  base.rotation.x = -Math.PI / 2;
  base.position.set((G.x0 + G.x1) / 2, 0.012, (G.z0 + G.z1) / 2);
  base.receiveShadow = true; scene.add(base);
  const geo = new THREE.SphereGeometry(0.78, 10, 7);
  const passo = 1.05;
  let i = 0;
  for (let px = G.x0 + 0.6; px <= G.x1 - 0.3; px += passo) {
    for (let pz = G.z0 + 0.6; pz <= G.z1 - 0.3; pz += passo, i++) {
      const m = new THREE.Mesh(geo, mats[(i * 7) % mats.length]);
      const esc = 0.9 + ((i * 13) % 10) / 45;
      m.scale.set(esc, 0.62 * esc, esc);
      m.position.set(px + (((i * 31) % 7) - 3) * 0.06, 0.34,
                     pz + (((i * 17) % 7) - 3) * 0.06);
      m.castShadow = true;
      scene.add(m);
    }
  }
}

function montaAgua(g, ag) {
  const areia = new THREE.Mesh(
    new THREE.PlaneGeometry(ag.x1 - ag.x0 + 1.6, ag.z1 - ag.z0 + 1.6),
    new THREE.MeshLambertMaterial({ color: 0xe8d9a8 }));
  areia.rotation.x = -Math.PI / 2;
  areia.position.set((ag.x0 + ag.x1) / 2, 0.02, (ag.z0 + ag.z1) / 2);
  areia.receiveShadow = true; g.add(areia);
  const agua = new THREE.Mesh(
    new THREE.PlaneGeometry(ag.x1 - ag.x0, ag.z1 - ag.z0),
    new THREE.MeshLambertMaterial({ color: 0x3f8fd4, transparent: true, opacity: 0.9 }));
  agua.rotation.x = -Math.PI / 2;
  agua.position.set((ag.x0 + ag.x1) / 2, 0.04, (ag.z0 + ag.z1) / 2);
  g.add(agua);
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
  if (mapa.tipo === 'interior') { montaInterior(g, mapa); return; }
  montaChao(g, Math.max(mapa.limite.x, mapa.limite.z) * 2 + 24, mapa.chao || 'grama');
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
  for (const G of mapa.gramas || (mapa.grama ? [mapa.grama] : [])) montaGrama(g, G);
  if (mapa.agua) montaAgua(g, mapa.agua);
  if (mapa.caverna) bocaCaverna(g, mapa.caverna);
  montaBorda(g, mapa);
  // lista de oclusores para o efeito "vidro" quando algo tapa o personagem
  cena.oclusores = [];
  g.traverse((o) => { if (o.isMesh && o.userData.oclusor) cena.oclusores.push(o); });
}

/* arena de batalha — ringue de floresta centrado na origem (a sim luta em
   torno de 0,0, então basta esconder o mundo e mostrar a arena) */
function montaArena(scene) {
  const g = new THREE.Group(); g.visible = false; scene.add(g);
  const lamb = (cor) => new THREE.MeshLambertMaterial({ color: cor });
  // clareira de grama + platô de terra batida
  const base = new THREE.Mesh(new THREE.CircleGeometry(34, 24), lamb(0x578f43));
  base.rotation.x = -Math.PI / 2; base.position.y = 0.004; base.receiveShadow = true; g.add(base);
  const terra = new THREE.Mesh(new THREE.CircleGeometry(10.5, 28), lamb(0xb08a5a));
  terra.rotation.x = -Math.PI / 2; terra.position.y = 0.01; terra.receiveShadow = true; g.add(terra);
  const borda = new THREE.Mesh(new THREE.TorusGeometry(10.5, 0.22, 8, 28), lamb(0x8a6a50));
  borda.rotation.x = -Math.PI / 2; borda.position.y = 0.05; g.add(borda);
  // cerca de troncos: postes + travessão
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2;
    const poste = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 0.95, 6), lamb(0x7a5233));
    poste.position.set(Math.cos(a) * 11.8, 0.47, Math.sin(a) * 11.8);
    poste.castShadow = true; g.add(poste);
  }
  const trave = new THREE.Mesh(new THREE.TorusGeometry(11.8, 0.07, 6, 28), lamb(0x9a7243));
  trave.rotation.x = -Math.PI / 2; trave.position.y = 0.8; g.add(trave);
  // mata fechando a arena (fora da cerca) e pedras decorando a beirada
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2 + 0.17;
    const r = 15 + (i % 3) * 2.2;
    arvore(g, Math.cos(a) * r, Math.sin(a) * r, i % 2 === 0 ? 1 : 0);
  }
  [[8.6, 2.6], [-7.9, -4.4], [1.8, -9.3]].forEach(([x, z], i) => {
    const pedra = new THREE.Mesh(new THREE.DodecahedronGeometry(0.4 + i * 0.12), lamb(0x8d939c));
    pedra.position.set(x, 0.3, z); pedra.castShadow = true; g.add(pedra);
  });
  return g;
}

// alterna entre o mapa de exploração e o ringue de batalha
export function mostraArena(cena, ligar) {
  cena.arenaG.visible = ligar;
  cena.mundoG.visible = !ligar;
}

/* jato direcionado: fagulhas que voam da boca da fera até o alvo (sopros) */
export function jato(cena, pos, dir, cor, n = 4, vel = 8) {
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(geoP, new THREE.MeshBasicMaterial({ color: cor, transparent: true }));
    m.position.set(pos.x, pos.y, pos.z);
    m.scale.setScalar(0.6 + Math.random() * 0.9);
    cena.scene.add(m);
    cena.parts.push({ m,
      vx: dir.x * vel + (Math.random() - 0.5) * 2.4,
      vy: dir.y * vel + (Math.random() - 0.5) * 1.8 + 0.6,
      vz: dir.z * vel + (Math.random() - 0.5) * 2.4,
      vida: 0.16 + Math.random() * 0.16 });
  }
}

/* partículas (pequenas, com variação de tamanho) */
const geoP = new THREE.PlaneGeometry(0.085, 0.085);
export function poof(cena, pos, cor, n = 10, vel = 3) {
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(geoP, new THREE.MeshBasicMaterial({ color: cor, transparent: true }));
    m.position.set(pos.x, pos.y, pos.z);
    m.scale.setScalar(0.5 + Math.random() * 0.9);
    cena.scene.add(m);
    cena.parts.push({ m, vx: (Math.random()-.5)*vel, vy: Math.random()*vel,
      vz: (Math.random()-.5)*vel, vida: 0.5 + Math.random() * 0.3 });
  }
}
export function passoParticulas(cena, dt) {
  for (let i = cena.parts.length - 1; i >= 0; i--) {
    const p = cena.parts[i];
    p.vida -= dt;
    p.m.position.x += p.vx * dt; p.m.position.y += p.vy * dt; p.m.position.z += p.vz * dt;
    p.vy -= 6 * dt;
    p.m.material.opacity = Math.max(0, p.vida * 2);
    p.m.lookAt(cena.camera.position);
    if (p.vida <= 0) { cena.scene.remove(p.m); cena.parts.splice(i, 1); }
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
