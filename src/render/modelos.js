// MODELOS — personagens e feras em 3D low-poly chibi, construídos por código
// (esferas, cilindros, caixas). Direção de arte: formas arredondadas, cabeça
// grande, cores chapadas (referência: World of ClaudeCraft). Render puro:
// nenhuma regra de jogo vive aqui.
import * as THREE from 'three';

const COR = {
  pele: 0xffd9b0, bone: 0x3fc5ba, boneEscuro: 0x2a8f88, olho: 0x26202e,
  tunica: 0xffcf4d, cachecol: 0xe05a41, calca: 0x4a68e0, sapato: 0x33313d,
  laranja: 0xff8a3d, vermelhoEscuro: 0xd1462f, amarelo: 0xffd93b, creme: 0xfff3da,
  cinza: 0x9aa3ad, cinzaEscuro: 0x6e7680, marrom: 0x8a6a50,
  amareloEscuro: 0xe8a91d, ciano: 0x7fe3ff, cristal: 0x59e0d0,
};

function novoModelo(scene, altura) {
  const g = new THREE.Group();
  scene.add(g);
  return { g, materiais: [], pernas: [], bracos: [], giro: 0, altura };
}

function parte(M, pai, geo, cor, x, y, z) {
  const mat = new THREE.MeshLambertMaterial({ color: cor });
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  M.materiais.push(mat);
  pai.add(m);
  return m;
}

/* ---------- Domador (chibi: cabeça ~metade da altura) ---------- */
export function criarDomador(scene) {
  const M = novoModelo(scene, 1.6);
  const g = M.g;
  // cabeça e rosto (frente do modelo = +z)
  parte(M, g, new THREE.SphereGeometry(0.42, 18, 14), COR.pele, 0, 1.08, 0);
  parte(M, g, new THREE.SphereGeometry(0.055, 8, 8), COR.olho, -0.15, 1.1, 0.37);
  parte(M, g, new THREE.SphereGeometry(0.055, 8, 8), COR.olho, 0.15, 1.1, 0.37);
  // boné: casquete, faixa e aba
  parte(M, g, new THREE.SphereGeometry(0.44, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.52), COR.bone, 0, 1.14, 0);
  parte(M, g, new THREE.CylinderGeometry(0.445, 0.445, 0.08, 18), COR.boneEscuro, 0, 1.32, 0);
  const aba = parte(M, g, new THREE.CylinderGeometry(0.3, 0.34, 0.06, 12), COR.boneEscuro, 0, 1.33, 0.32);
  aba.scale.z = 0.75;
  // tronco (túnica) e cachecol
  parte(M, g, new THREE.CylinderGeometry(0.24, 0.3, 0.5, 14), COR.tunica, 0, 0.5, 0);
  const cach = parte(M, g, new THREE.TorusGeometry(0.21, 0.08, 8, 14), COR.cachecol, 0, 0.74, 0);
  cach.rotation.x = Math.PI / 2;
  // braços (grupos no ombro, para balançar ao andar)
  for (const lado of [-1, 1]) {
    const ombro = new THREE.Group();
    ombro.position.set(lado * 0.3, 0.7, 0); g.add(ombro);
    parte(M, ombro, new THREE.CylinderGeometry(0.07, 0.06, 0.34, 8), COR.tunica, 0, -0.15, 0);
    parte(M, ombro, new THREE.SphereGeometry(0.07, 8, 8), COR.pele, 0, -0.34, 0);
    M.bracos.push(ombro);
  }
  // pernas (grupos no quadril)
  for (const lado of [-1, 1]) {
    const quadril = new THREE.Group();
    quadril.position.set(lado * 0.12, 0.3, 0); g.add(quadril);
    parte(M, quadril, new THREE.CylinderGeometry(0.085, 0.075, 0.26, 8), COR.calca, 0, -0.11, 0);
    parte(M, quadril, new THREE.BoxGeometry(0.16, 0.09, 0.26), COR.sapato, 0, -0.26, 0.04);
    M.pernas.push(quadril);
  }
  return M;
}

/* ---------- Feras ---------- */
function criarBrasinha(scene) {
  const M = novoModelo(scene, 1.2);
  const g = M.g;
  const corpo = parte(M, g, new THREE.SphereGeometry(0.34, 16, 12), COR.laranja, 0, 0.4, -0.08);
  corpo.scale.set(0.95, 0.85, 1.2);
  parte(M, g, new THREE.SphereGeometry(0.3, 16, 12), COR.laranja, 0, 0.82, 0.2);
  const foc = parte(M, g, new THREE.SphereGeometry(0.13, 10, 8), COR.creme, 0, 0.74, 0.45);
  foc.scale.set(1, 0.8, 1);
  parte(M, g, new THREE.SphereGeometry(0.05, 8, 6), COR.olho, 0, 0.78, 0.56);
  parte(M, g, new THREE.SphereGeometry(0.05, 8, 6), COR.olho, -0.13, 0.9, 0.44);
  parte(M, g, new THREE.SphereGeometry(0.05, 8, 6), COR.olho, 0.13, 0.9, 0.44);
  // orelhas e crista de chama
  for (const lado of [-1, 1]) {
    const o = parte(M, g, new THREE.ConeGeometry(0.1, 0.28, 8), COR.vermelhoEscuro, lado * 0.15, 1.1, 0.12);
    o.rotation.z = -lado * 0.3;
  }
  parte(M, g, new THREE.ConeGeometry(0.07, 0.2, 8), COR.amarelo, 0, 1.16, 0.24);
  // cauda com ponta amarela
  const cauda = parte(M, g, new THREE.ConeGeometry(0.13, 0.55, 8), COR.laranja, 0, 0.6, -0.52);
  cauda.rotation.x = -2.3;
  parte(M, g, new THREE.SphereGeometry(0.1, 8, 8), COR.amarelo, 0, 0.78, -0.68);
  // patas
  for (const [x, z] of [[-0.16, 0.16], [0.16, 0.16], [-0.16, -0.28], [0.16, -0.28]])
    parte(M, g, new THREE.CylinderGeometry(0.06, 0.06, 0.18, 8), COR.vermelhoEscuro, x, 0.1, z);
  return M;
}

function criarCascorro(scene) {
  const M = novoModelo(scene, 1.1);
  const g = M.g;
  parte(M, g, new THREE.BoxGeometry(0.75, 0.5, 0.95), COR.cinza, 0, 0.44, -0.05);
  parte(M, g, new THREE.BoxGeometry(0.5, 0.14, 0.6), COR.cinzaEscuro, 0, 0.74, -0.1);
  parte(M, g, new THREE.BoxGeometry(0.6, 0.5, 0.55), COR.cinza, 0, 0.72, 0.5);
  parte(M, g, new THREE.BoxGeometry(0.64, 0.14, 0.22), COR.cinzaEscuro, 0, 0.94, 0.44);
  // olhos e focinho
  for (const lado of [-1, 1]) {
    parte(M, g, new THREE.BoxGeometry(0.11, 0.13, 0.03), COR.creme, lado * 0.16, 0.76, 0.78);
    parte(M, g, new THREE.BoxGeometry(0.05, 0.07, 0.02), COR.olho, lado * 0.16, 0.75, 0.8);
  }
  parte(M, g, new THREE.BoxGeometry(0.26, 0.16, 0.12), COR.marrom, 0, 0.58, 0.8);
  // patas e cauda
  for (const [x, z] of [[-0.24, 0.28], [0.24, 0.28], [-0.24, -0.34], [0.24, -0.34]])
    parte(M, g, new THREE.BoxGeometry(0.18, 0.36, 0.2), COR.cinzaEscuro, x, 0.18, z);
  parte(M, g, new THREE.BoxGeometry(0.14, 0.14, 0.28), COR.cinza, 0, 0.5, -0.62);
  return M;
}

function criarVoltim(scene) {
  const M = novoModelo(scene, 0.9);
  const g = M.g;
  const corpo = parte(M, g, new THREE.SphereGeometry(0.34, 16, 12), COR.amarelo, 0, 0.4, 0);
  corpo.scale.set(1, 1.06, 0.95);
  const peito = parte(M, g, new THREE.SphereGeometry(0.2, 12, 10), COR.creme, 0, 0.32, 0.2);
  peito.scale.set(1.2, 1, 0.55);
  // topete, bico e olhos
  for (const [x, h] of [[-0.09, 0.14], [0, 0.2], [0.09, 0.14]])
    parte(M, g, new THREE.ConeGeometry(0.05, h, 8), COR.amareloEscuro, x, 0.78, 0);
  const bico = parte(M, g, new THREE.ConeGeometry(0.07, 0.18, 8), COR.laranja, 0, 0.5, 0.36);
  bico.rotation.x = Math.PI / 2;
  parte(M, g, new THREE.SphereGeometry(0.05, 8, 6), COR.olho, -0.14, 0.56, 0.27);
  parte(M, g, new THREE.SphereGeometry(0.05, 8, 6), COR.olho, 0.14, 0.56, 0.27);
  // asas, pés e faísca
  for (const lado of [-1, 1]) {
    const asa = parte(M, g, new THREE.SphereGeometry(0.14, 10, 8), COR.amareloEscuro, lado * 0.31, 0.42, 0);
    asa.scale.set(0.4, 1, 0.8);
    parte(M, g, new THREE.BoxGeometry(0.11, 0.06, 0.17), COR.laranja, lado * 0.11, 0.03, 0.03);
  }
  parte(M, g, new THREE.OctahedronGeometry(0.07), COR.ciano, 0.3, 0.78, 0.1);
  return M;
}

const FABRICAS = { brasinha: criarBrasinha, cascorro: criarCascorro, voltim: criarVoltim };
export function criarFera(scene, chave) {
  const fabrica = FABRICAS[chave];
  return fabrica ? fabrica(scene) : criarCascorro(scene);
}

// projétil elemental (bola de fogo, esfera voltaica...) — cor vem do tipo
export function criarProjetil(scene, corHex) {
  const M = novoModelo(scene, 0.5);
  const mat = new THREE.MeshLambertMaterial({
    color: corHex, emissive: corHex, emissiveIntensity: 0.65 });
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), mat);
  m.castShadow = true; M.materiais.push(mat); M.g.add(m);
  const halo = new THREE.Mesh(new THREE.OctahedronGeometry(0.42),
    new THREE.MeshBasicMaterial({ color: corHex, transparent: true, opacity: 0.35 }));
  M.g.add(halo);
  return M;
}

export function criarCristal(scene) {
  const M = novoModelo(scene, 0.55);
  const mat = new THREE.MeshLambertMaterial({
    color: COR.cristal, emissive: 0x1f9b8e, transparent: true, opacity: 0.95 });
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.26), mat);
  m.castShadow = true; M.materiais.push(mat); M.g.add(m);
  return M;
}

/* ---------- controle comum ---------- */
export function setPos(M, pos) { M.g.position.set(pos.x, pos.y, pos.z); }
export function mostra(M, v) { M.g.visible = v; }
export function setEscala(M, s) { M.g.scale.setScalar(s); }

// direção desejada de olhar (frente do modelo = +z)
export function giraDirecao(M, x, z) { if (x !== 0 || z !== 0) M.giro = Math.atan2(x, z); }
export function encara(M, alvoX, alvoZ) {
  giraDirecao(M, alvoX - M.g.position.x, alvoZ - M.g.position.z);
}
// aplica o giro com suavização, pelo caminho mais curto
export function passoGiro(M, dt) {
  let d = M.giro - M.g.rotation.y;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  M.g.rotation.y += d * Math.min(1, 14 * dt);
}

// balanço de pernas/braços + pulinho; chamar DEPOIS de setPos (soma no y)
export function animaAndar(M, t, andando) {
  const a = andando ? Math.sin(t * 9) * 0.55 : 0;
  if (M.pernas.length === 2) { M.pernas[0].rotation.x = a; M.pernas[1].rotation.x = -a; }
  if (M.bracos.length === 2) { M.bracos[0].rotation.x = -a * 0.8; M.bracos[1].rotation.x = a * 0.8; }
  if (andando) M.g.position.y += Math.abs(Math.sin(t * 9)) * 0.05;
}

export function flashCor(M, hex) {
  for (const mat of M.materiais) mat.emissive.setHex(hex || 0x000000);
}
export function setOpacidade(M, o) {
  for (const mat of M.materiais) { mat.transparent = o < 1; mat.opacity = o; }
}
