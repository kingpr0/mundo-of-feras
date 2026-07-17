// CENA — Three.js: luz HD-2D, chão, árvores (lidas do layout da simulação),
// partículas e as duas câmeras (exploração estilo LoL e batalha lock-on).
import * as THREE from 'three';
import { MUNDO_LAYOUT } from '../sim/mundo.js';

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
  // separado, estilizado pelo bioma (floresta, por enquanto)
  const mundoG = new THREE.Group(); scene.add(mundoG);
  montaChao(mundoG);
  MUNDO_LAYOUT.arvores.forEach(([x, z, p]) => arvore(mundoG, x, z, p));
  montaGrama(mundoG);
  const arenaG = montaArena(scene);

  const estado = {
    renderer, scene, camera, mundoG, arenaG,
    camPos: new THREE.Vector3(0, 12, 15),
    camAlvo: new THREE.Vector3(),
    shake: 0,
    parts: [],
  };
  const resize = () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  };
  addEventListener('resize', resize); resize();
  return estado;
}

function montaChao(scene) {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const x = c.getContext('2d');
  for (let ty = 0; ty < 16; ty++) for (let tx = 0; tx < 16; tx++) {
    x.fillStyle = ((tx + ty) % 2 === 0) ? '#67b34f' : '#5fa848';
    x.fillRect(tx * 32, ty * 32, 32, 32);
    if ((tx * 7 + ty * 13) % 11 === 0) { x.fillStyle = '#8fd977'; x.fillRect(tx*32+12, ty*32+14, 6, 6); }
    if ((tx * 5 + ty * 11) % 17 === 0) { x.fillStyle = '#ffd6e8'; x.fillRect(tx*32+20, ty*32+8, 5, 5);
      x.fillStyle = '#ffe9b0'; x.fillRect(tx*32+21, ty*32+6, 3, 3); }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(5, 5);
  const ch = new THREE.Mesh(new THREE.PlaneGeometry(70, 70),
    new THREE.MeshLambertMaterial({ map: t }));
  ch.rotation.x = -Math.PI / 2; ch.receiveShadow = true; scene.add(ch);
}

function arvore(scene, x, z, pinheiro) {
  const g = new THREE.Group();
  const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 1.1, 6),
    new THREE.MeshLambertMaterial({ color: 0x7a5233 }));
  tr.position.y = 0.55; tr.castShadow = true; g.add(tr);
  if (pinheiro) {
    [[1.5, 1.2], [2.2, 0.9], [2.9, 0.6]].forEach(([y, r]) => {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(r, 1.2, 7),
        new THREE.MeshLambertMaterial({ color: 0x2a6e3e }));
      cone.position.y = y; cone.castShadow = true; g.add(cone);
    });
  } else {
    [[1.6, 0.9, 0, 0], [2.3, 1.05, 0, 0], [1.9, 0.7, 0.7, 0.2], [1.9, 0.7, -0.7, -0.2]]
      .forEach(([y, r, dx, dz]) => {
        const s = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6),
          new THREE.MeshLambertMaterial({ color: 0x2f7a33 }));
        s.position.set(dx, y, dz); s.castShadow = true; g.add(s);
      });
  }
  g.position.set(x, 0, z); scene.add(g);
}

function montaGrama(scene) {
  const c = document.createElement('canvas'); c.width = c.height = 16;
  const x = c.getContext('2d');
  x.fillStyle = '#3f8f38'; for (let i = 0; i < 5; i++) x.fillRect(1 + i * 3, 6, 2, 10);
  x.fillStyle = '#4da043'; for (let i = 0; i < 4; i++) x.fillRect(3 + i * 3, 3, 2, 7);
  const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter;
  const mat = new THREE.MeshLambertMaterial({ map: t, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide });
  const G = MUNDO_LAYOUT.grama;
  for (let i = 0; i < 70; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), mat);
    m.position.set(G.x0 + Math.random() * (G.x1 - G.x0), 0.45,
                   G.z0 + Math.random() * (G.z1 - G.z0));
    m.rotation.y = Math.random() * Math.PI; scene.add(m);
  }
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

/* partículas */
const geoP = new THREE.PlaneGeometry(0.14, 0.14);
export function poof(cena, pos, cor, n = 10, vel = 3) {
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(geoP, new THREE.MeshBasicMaterial({ color: cor, transparent: true }));
    m.position.set(pos.x, pos.y, pos.z); cena.scene.add(m);
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
    // mais alta e mais afastada: leitura da arena inteira
    desejo = new THREE.Vector3(pp.x - fx * 7.4, pp.y + 4.8, pp.z - fz * 7.4);
    olhar = new THREE.Vector3(pp.x + (ee.x - pp.x) * .45, 1.0, pp.z + (ee.z - pp.z) * .45);
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
