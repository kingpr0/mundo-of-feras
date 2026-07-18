// CENA — Three.js: luz, cenário dos mapas (montados a partir de mapas.json),
// arena de batalha, partículas e as duas câmeras (exploração e lock-on).
import * as THREE from 'three';

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
  };
  const resize = () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  };
  addEventListener('resize', resize); resize();
  return estado;
}

function montaChao(scene, tam = 70) {
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
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(tam / 14, tam / 14);
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
  corpo.position.y = 1.1; corpo.castShadow = true; grupo.add(corpo);
  const telhado = new THREE.Mesh(new THREE.ConeGeometry(2.9, 1.6, 4),
    lamb(COR_TELHADO[corNome] || COR_TELHADO.vermelho));
  telhado.position.y = 3.0; telhado.rotation.y = Math.PI / 4; telhado.castShadow = true;
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
      pedra.castShadow = true; g.add(pedra);
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

/* grama alta 3D: moitas volumétricas low-poly (cones finos agrupados, no
   mesmo estilo das árvores) — o domador some no meio do mato de verdade */
function montaGrama(scene, G) {
  const mats = [0x2f7a2c, 0x3f8f38, 0x4da043, 0x5fb54a]
    .map((c) => new THREE.MeshLambertMaterial({ color: c }));
  // tapete escuro marcando a zona de encontro
  const base = new THREE.Mesh(
    new THREE.PlaneGeometry(G.x1 - G.x0 + 1, G.z1 - G.z0 + 1),
    new THREE.MeshLambertMaterial({ color: 0x4e9a3f }));
  base.rotation.x = -Math.PI / 2;
  base.position.set((G.x0 + G.x1) / 2, 0.012, (G.z0 + G.z1) / 2);
  base.receiveShadow = true; scene.add(base);
  const geo = new THREE.ConeGeometry(0.3, 1.2, 5);
  const n = Math.round((G.x1 - G.x0) * (G.z1 - G.z0) * 0.5);
  for (let i = 0; i < n; i++) {
    const px = G.x0 + 0.6 + Math.random() * (G.x1 - G.x0 - 1.2);
    const pz = G.z0 + 0.6 + Math.random() * (G.z1 - G.z0 - 1.2);
    // cada moita: 3 lâminas cônicas inclinadas para fora
    for (let k = 0; k < 3; k++) {
      const m = new THREE.Mesh(geo, mats[(i + k) % mats.length]);
      const esc = 0.75 + Math.random() * 0.5;
      m.scale.set(esc, esc, esc);
      m.position.set(px + (Math.random() - 0.5) * 0.55, 0.6 * esc,
                     pz + (Math.random() - 0.5) * 0.55);
      m.rotation.set((Math.random() - 0.5) * 0.35, Math.random() * Math.PI,
                     (Math.random() - 0.5) * 0.35);
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
function plato(g, p) {
  const lamb = (cor) => new THREE.MeshLambertMaterial({ color: cor });
  const w = p.x1 - p.x0, d = p.z1 - p.z0;
  const cx = (p.x0 + p.x1) / 2, cz = (p.z0 + p.z1) / 2;
  const baseM = new THREE.Mesh(new THREE.BoxGeometry(w + 2.4, p.h * 0.55, d + 2.4), lamb(0x9c7a4e));
  baseM.position.set(cx, p.h * 0.275, cz); baseM.castShadow = baseM.receiveShadow = true;
  g.add(baseM);
  const topoM = new THREE.Mesh(new THREE.BoxGeometry(w, p.h, d), lamb(0xb08a5a));
  topoM.position.set(cx, p.h / 2, cz); topoM.castShadow = topoM.receiveShadow = true;
  g.add(topoM);
  const gramaM = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, d), lamb(0x67b34f));
  gramaM.position.set(cx, p.h + 0.05, cz); gramaM.receiveShadow = true;
  g.add(gramaM);
}

/* boca de caverna nas rochas (o interior vem no futuro) */
function bocaCaverna(g, c) {
  const lamb = (cor) => new THREE.MeshLambertMaterial({ color: cor });
  const rocha = new THREE.Mesh(new THREE.DodecahedronGeometry(3.2), lamb(0x6e7680));
  rocha.position.set(c.x, 1.6, c.z - 1.2); rocha.scale.set(1.4, 1, 1);
  rocha.castShadow = true; g.add(rocha);
  for (const [dx, r] of [[-3.4, 1.4], [3.4, 1.6]]) {
    const p = new THREE.Mesh(new THREE.DodecahedronGeometry(r), lamb(0x7d838c));
    p.position.set(c.x + dx, r * 0.7, c.z - 0.6); p.castShadow = true; g.add(p);
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
  montaChao(g, Math.max(mapa.limite.x, mapa.limite.z) * 2 + 24);
  (mapa.arvores || []).forEach(([x, z, p]) => arvore(g, x, z, p));
  (mapa.casas || []).forEach(([x, z, cor]) => casa(g, x, z, cor));
  (mapa.platos || []).forEach((p) => plato(g, p));
  if (mapa.grama) montaGrama(g, mapa.grama);
  if (mapa.agua) montaAgua(g, mapa.agua);
  if (mapa.caverna) bocaCaverna(g, mapa.caverna);
  montaBorda(g, mapa);
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
