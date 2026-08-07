// MODELOS — personagens e feras em 3D low-poly chibi, construídos por código,
// OU carregados de arquivos glTF com esqueleto e animações profissionais
// (espécies com "modelo3d" nos dados). Render puro.
import * as THREE from 'three';
import { GLTFLoader } from '../vendor/GLTFLoader.js';

// o mesmo arquivo é carregado 2x (fera do jogador + selvagem) e o jogo agora
// tem dezenas de modelos: o cache evita baixar cada .glb de novo
THREE.Cache.enabled = true;

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
  return { g, materiais: [], pernas: [], bracos: [], cabeca: null, cauda: null,
           boca: null, giro: 0, altura };
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
function grupoEm(M, x, y, z) {
  const g2 = new THREE.Group();
  g2.position.set(x, y, z);
  M.g.add(g2);
  return g2;
}
function marcaBoca(M, pai, x, y, z) {
  const b = new THREE.Object3D();
  b.position.set(x, y, z);
  pai.add(b);
  M.boca = b;
}

/* ---------- humanos (domador e NPCs da vila) ---------- */
function criarHumano(scene, o) {
  const M = novoModelo(scene, 1.6);
  const g = M.g;
  parte(M, g, new THREE.SphereGeometry(0.42, 18, 14), o.pele, 0, 1.08, 0);
  parte(M, g, new THREE.SphereGeometry(0.055, 8, 8), COR.olho, -0.15, 1.1, 0.37);
  parte(M, g, new THREE.SphereGeometry(0.055, 8, 8), COR.olho, 0.15, 1.1, 0.37);
  if (o.chapeu === 'bone') {
    parte(M, g, new THREE.SphereGeometry(0.44, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.52), o.corChapeu, 0, 1.14, 0);
    parte(M, g, new THREE.CylinderGeometry(0.445, 0.445, 0.08, 18), o.corChapeuEscuro, 0, 1.32, 0);
    const aba = parte(M, g, new THREE.CylinderGeometry(0.3, 0.34, 0.06, 12), o.corChapeuEscuro, 0, 1.33, 0.32);
    aba.scale.z = 0.75;
  } else if (o.chapeu === 'maga') {
    parte(M, g, new THREE.CylinderGeometry(0.52, 0.52, 0.06, 14), o.corChapeu, 0, 1.36, 0); // aba larga
    const cone = parte(M, g, new THREE.ConeGeometry(0.3, 0.65, 12), o.corChapeu, 0, 1.68, 0);
    cone.rotation.z = 0.12;
  } else {
    // cabelo
    const cab = parte(M, g, new THREE.SphereGeometry(0.43, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), o.corCabelo, 0, 1.14, 0);
    cab.rotation.x = -0.15;
  }
  parte(M, g, new THREE.CylinderGeometry(0.24, 0.3, 0.5, 14), o.tunica, 0, 0.5, 0);
  if (o.cachecol) {
    const cach = parte(M, g, new THREE.TorusGeometry(0.21, 0.08, 8, 14), o.cachecol, 0, 0.74, 0);
    cach.rotation.x = Math.PI / 2;
  }
  for (const lado of [-1, 1]) {
    const ombro = new THREE.Group();
    ombro.position.set(lado * 0.3, 0.7, 0); g.add(ombro);
    parte(M, ombro, new THREE.CylinderGeometry(0.07, 0.06, 0.34, 8), o.tunica, 0, -0.15, 0);
    parte(M, ombro, new THREE.SphereGeometry(0.07, 8, 8), o.pele, 0, -0.34, 0);
    M.bracos.push(ombro);
  }
  for (const lado of [-1, 1]) {
    const quadril = new THREE.Group();
    quadril.position.set(lado * 0.12, 0.3, 0); g.add(quadril);
    parte(M, quadril, new THREE.CylinderGeometry(0.085, 0.075, 0.26, 8), o.calca, 0, -0.11, 0);
    parte(M, quadril, new THREE.BoxGeometry(0.16, 0.09, 0.26), o.sapato, 0, -0.26, 0.04);
    M.pernas.push(quadril);
  }
  return M;
}

export function criarDomador(scene) {
  return criarHumano(scene, {
    pele: COR.pele, chapeu: 'bone', corChapeu: COR.bone, corChapeuEscuro: COR.boneEscuro,
    tunica: COR.tunica, cachecol: COR.cachecol, calca: COR.calca, sapato: COR.sapato,
  });
}

const NPCS = {
  maga:     { pele: 0xffd9b0, chapeu: 'maga', corChapeu: 0x6a4a9c, tunica: 0x7a5ab0, calca: 0x4a3a70, sapato: 0x33313d },
  aldeao:   { pele: 0xffd9b0, corCabelo: 0x6b4a2f, tunica: 0x5f8a4a, calca: 0x8a6a50, sapato: 0x33313d },
  aldea:    { pele: 0xf2c096, corCabelo: 0xc98a3f, tunica: 0xd97a6a, calca: 0x8a6a50, sapato: 0x33313d },
  mercador: { pele: 0xffd9b0, corCabelo: 0x3a3547, tunica: 0xc9563f, calca: 0x4a4a58, sapato: 0x33313d, cachecol: 0xffd93b },
  enfermeira: { pele: 0xffd9b0, corCabelo: 0xe07a9a, tunica: 0xf7f3ea, calca: 0xf0d9e2, sapato: 0x33313d },
  senhor: { pele: 0xffd9b0, corCabelo: 0xd8d8d8, tunica: 0x2e4a66, calca: 0x1e3247, sapato: 0x33313d, cachecol: 0x59e0d0 },
};
export function criarNPC(scene, tipo) {
  return criarHumano(scene, NPCS[tipo] || NPCS.aldeao);
}

/* ---------- Feras 2.0 ---------- */
function criarBrasinha(scene) {
  const M = novoModelo(scene, 1.2);
  const g = M.g;
  // corpo + peito fofo
  const corpo = parte(M, g, new THREE.SphereGeometry(0.32, 16, 12), COR.laranja, 0, 0.42, -0.08);
  corpo.scale.set(0.95, 0.88, 1.2);
  M.corpo = corpo; corpo.userData.s0 = corpo.scale.clone();
  const peito = parte(M, g, new THREE.SphereGeometry(0.22, 12, 10), COR.creme, 0, 0.42, 0.16);
  peito.scale.set(0.95, 1.05, 0.7);
  // CABEÇA articulada: crânio, focinho pontudo, nariz, bochechas, orelhas 2 tons
  const cab = grupoEm(M, 0, 0.85, 0.18);
  M.cabeca = cab;
  parte(M, cab, new THREE.SphereGeometry(0.28, 16, 12), COR.laranja, 0, 0, 0);
  const foc = parte(M, cab, new THREE.ConeGeometry(0.13, 0.34, 10), COR.creme, 0, -0.06, 0.3);
  foc.rotation.x = Math.PI / 2;
  parte(M, cab, new THREE.SphereGeometry(0.045, 8, 6), COR.olho, 0, -0.02, 0.45);
  parte(M, cab, new THREE.SphereGeometry(0.05, 8, 6), COR.olho, -0.13, 0.08, 0.22);
  parte(M, cab, new THREE.SphereGeometry(0.05, 8, 6), COR.olho, 0.13, 0.08, 0.22);
  for (const lado of [-1, 1]) {
    const bochecha = parte(M, cab, new THREE.SphereGeometry(0.09, 8, 8), COR.creme, lado * 0.2, -0.08, 0.14);
    bochecha.scale.set(0.8, 0.9, 0.7);
    const orelha = parte(M, cab, new THREE.ConeGeometry(0.1, 0.3, 8), COR.vermelhoEscuro, lado * 0.15, 0.3, -0.04);
    orelha.rotation.z = -lado * 0.32;
    const dentro = parte(M, cab, new THREE.ConeGeometry(0.05, 0.16, 8), COR.creme, lado * 0.15, 0.28, 0.0);
    dentro.rotation.z = -lado * 0.32;
  }
  parte(M, cab, new THREE.ConeGeometry(0.07, 0.2, 8), COR.amarelo, 0, 0.33, 0.06); // crista de chama
  marcaBoca(M, cab, 0, -0.08, 0.42);
  // CAUDA articulada: volumosa, ponta de chama
  const cauda = grupoEm(M, 0, 0.5, -0.4);
  M.cauda = cauda;
  parte(M, cauda, new THREE.SphereGeometry(0.14, 10, 8), COR.laranja, 0, 0.02, -0.12);
  parte(M, cauda, new THREE.SphereGeometry(0.12, 10, 8), COR.laranja, 0, 0.14, -0.3);
  parte(M, cauda, new THREE.SphereGeometry(0.1, 10, 8), COR.vermelhoEscuro, 0, 0.26, -0.44);
  const ponta = parte(M, cauda, new THREE.ConeGeometry(0.09, 0.22, 8), COR.amarelo, 0, 0.4, -0.5);
  ponta.material.emissive.setHex(0x664400);
  M.materiais.pop(); // a chama da cauda não pisca com dano
  // patas ARTICULADAS com "meias" escuras e patinha redonda na ponta
  for (const [x, z] of [[-0.16, 0.16], [0.16, 0.16], [-0.16, -0.28], [0.16, -0.28]]) {
    const quadril = grupoEm(M, x, 0.26, z);
    parte(M, quadril, new THREE.SphereGeometry(0.075, 8, 8), COR.laranja, 0, 0, 0);
    parte(M, quadril, new THREE.CylinderGeometry(0.06, 0.06, 0.16, 8), COR.laranja, 0, -0.1, 0);
    const pata = parte(M, quadril, new THREE.SphereGeometry(0.075, 8, 8), COR.vermelhoEscuro, 0, -0.2, 0.01);
    pata.scale.set(1, 0.7, 1.15);
    M.pernas.push(quadril);
  }
  return M;
}

function criarCascorro(scene) {
  const M = novoModelo(scene, 1.1);
  const g = M.g;
  const corpoCas = parte(M, g, new THREE.BoxGeometry(0.75, 0.5, 0.95), COR.cinza, 0, 0.44, -0.05);
  M.corpo = corpoCas; corpoCas.userData.s0 = corpoCas.scale.clone();
  // placas rochosas no lombo
  for (const [x, z, r] of [[-0.15, -0.3, 0.16], [0.12, -0.05, 0.19], [-0.08, 0.2, 0.14]]) {
    const placa = parte(M, g, new THREE.DodecahedronGeometry(r), COR.cinzaEscuro, x, 0.72, z);
    placa.scale.y = 0.7;
  }
  // CABEÇA: bloco com testa pesada, focinho, dentes de baixo (underbite)
  const cab = grupoEm(M, 0, 0.72, 0.5);
  M.cabeca = cab;
  parte(M, cab, new THREE.BoxGeometry(0.6, 0.5, 0.55), COR.cinza, 0, 0, 0);
  parte(M, cab, new THREE.BoxGeometry(0.64, 0.14, 0.22), COR.cinzaEscuro, 0, 0.22, -0.06);
  for (const lado of [-1, 1]) {
    parte(M, cab, new THREE.BoxGeometry(0.11, 0.13, 0.03), COR.creme, lado * 0.16, 0.04, 0.28);
    parte(M, cab, new THREE.BoxGeometry(0.05, 0.07, 0.02), COR.olho, lado * 0.16, 0.03, 0.3);
    // orelhinhas de pedra
    parte(M, cab, new THREE.BoxGeometry(0.1, 0.14, 0.08), COR.cinzaEscuro, lado * 0.26, 0.3, -0.12);
    // dentes para cima (mandíbula forte)
    parte(M, cab, new THREE.BoxGeometry(0.06, 0.09, 0.04), 0xffffff, lado * 0.14, -0.24, 0.29);
  }
  parte(M, cab, new THREE.BoxGeometry(0.26, 0.16, 0.12), COR.marrom, 0, -0.14, 0.3);
  marcaBoca(M, cab, 0, -0.18, 0.34);
  // patas ARTICULADAS e CAUDA
  for (const [x, z] of [[-0.24, 0.28], [0.24, 0.28], [-0.24, -0.34], [0.24, -0.34]]) {
    const quadril = grupoEm(M, x, 0.38, z);
    parte(M, quadril, new THREE.BoxGeometry(0.18, 0.36, 0.2), COR.cinzaEscuro, 0, -0.2, 0);
    M.pernas.push(quadril);
  }
  const cauda = grupoEm(M, 0, 0.5, -0.55);
  M.cauda = cauda;
  parte(M, cauda, new THREE.BoxGeometry(0.14, 0.14, 0.24), COR.cinza, 0, 0.02, -0.1);
  parte(M, cauda, new THREE.DodecahedronGeometry(0.09), COR.cinzaEscuro, 0, 0.05, -0.24);
  return M;
}

function criarVoltim(scene) {
  const M = novoModelo(scene, 0.9);
  const g = M.g;
  const corpo = parte(M, g, new THREE.SphereGeometry(0.34, 16, 12), COR.amarelo, 0, 0.4, 0);
  corpo.scale.set(1, 1.06, 0.95);
  M.corpo = corpo; corpo.userData.s0 = corpo.scale.clone();
  const peito = parte(M, g, new THREE.SphereGeometry(0.2, 12, 10), COR.creme, 0, 0.32, 0.2);
  peito.scale.set(1.2, 1, 0.55);
  // topete em raio + bico + olhos (a "cabeça" é o próprio corpo)
  for (const [x, h, incl] of [[-0.1, 0.16, 0.4], [0, 0.24, 0], [0.1, 0.16, -0.4]]) {
    const t = parte(M, g, new THREE.ConeGeometry(0.05, h, 6), COR.amareloEscuro, x, 0.8, 0);
    t.rotation.z = incl;
  }
  const bico = parte(M, g, new THREE.ConeGeometry(0.07, 0.18, 8), COR.laranja, 0, 0.5, 0.36);
  bico.rotation.x = Math.PI / 2;
  parte(M, g, new THREE.SphereGeometry(0.05, 8, 6), COR.olho, -0.14, 0.56, 0.27);
  parte(M, g, new THREE.SphereGeometry(0.05, 8, 6), COR.olho, 0.14, 0.56, 0.27);
  marcaBoca(M, g, 0, 0.5, 0.46);
  // ASINHAS articuladas (batem!) e pés
  for (const lado of [-1, 1]) {
    const asa = new THREE.Group();
    asa.position.set(lado * 0.28, 0.46, 0);
    g.add(asa);
    const pena = parte(M, asa, new THREE.SphereGeometry(0.14, 10, 8), COR.amareloEscuro, lado * 0.05, -0.04, 0);
    pena.scale.set(0.4, 1, 0.8);
    M.bracos.push(asa);
    const pe = grupoEm(M, lado * 0.11, 0.12, 0.03);
    parte(M, pe, new THREE.BoxGeometry(0.11, 0.06, 0.17), COR.laranja, 0, -0.09, 0);
    M.pernas.push(pe);
  }
  // CAUDA em raio (zigue-zague elétrico)
  const cauda = grupoEm(M, 0, 0.42, -0.3);
  M.cauda = cauda;
  const z1 = parte(M, cauda, new THREE.BoxGeometry(0.16, 0.05, 0.2), COR.amarelo, 0, 0.02, -0.08);
  z1.rotation.y = 0.6;
  const z2 = parte(M, cauda, new THREE.BoxGeometry(0.14, 0.05, 0.18), COR.amarelo, -0.06, 0.08, -0.22);
  z2.rotation.y = -0.6;
  const z3 = parte(M, cauda, new THREE.BoxGeometry(0.1, 0.04, 0.14), COR.ciano, 0.02, 0.14, -0.34);
  z3.rotation.y = 0.5;
  parte(M, g, new THREE.OctahedronGeometry(0.06), COR.ciano, 0.3, 0.78, 0.1);
  return M;
}

function criarGotim(scene) {
  const M = novoModelo(scene, 0.95);
  const g = M.g;
  const azul = 0x4da3ff, azulEscuro = 0x2f6fc9;
  const corpo = parte(M, g, new THREE.SphereGeometry(0.34, 16, 12), azul, 0, 0.42, 0);
  corpo.scale.set(1, 1.08, 0.95);
  M.corpo = corpo; corpo.userData.s0 = corpo.scale.clone();
  // brilho "molhado"
  const brilho = parte(M, g, new THREE.SphereGeometry(0.09, 8, 8), 0xbfe3ff, -0.14, 0.62, 0.2);
  brilho.scale.set(1, 0.6, 0.5);
  const topo = parte(M, g, new THREE.ConeGeometry(0.16, 0.34, 10), azul, 0, 0.9, 0);
  const barriga = parte(M, g, new THREE.SphereGeometry(0.2, 12, 10), COR.creme, 0, 0.32, 0.2);
  barriga.scale.set(1.2, 1, 0.55);
  parte(M, g, new THREE.SphereGeometry(0.05, 8, 6), COR.olho, -0.13, 0.55, 0.28);
  parte(M, g, new THREE.SphereGeometry(0.05, 8, 6), COR.olho, 0.13, 0.55, 0.28);
  marcaBoca(M, g, 0, 0.46, 0.34);
  for (const lado of [-1, 1]) {
    parte(M, g, new THREE.SphereGeometry(0.05, 8, 6), 0x7fc4ff, lado * 0.22, 0.46, 0.24);
    const nad = new THREE.Group();
    nad.position.set(lado * 0.3, 0.4, -0.02);
    g.add(nad);
    const n = parte(M, nad, new THREE.SphereGeometry(0.14, 10, 8), azulEscuro, lado * 0.03, 0, -0.03);
    n.scale.set(0.35, 0.9, 0.9);
    M.bracos.push(nad); // nadadeiras remam ao andar
  }
  const cauda = grupoEm(M, 0, 0.42, -0.32);
  M.cauda = cauda;
  const c = parte(M, cauda, new THREE.ConeGeometry(0.12, 0.3, 8), azulEscuro, 0, 0, -0.1);
  c.rotation.x = Math.PI / 2;
  for (const lado of [-1, 1]) {
    const pe = grupoEm(M, lado * 0.12, 0.12, 0.03);
    parte(M, pe, new THREE.BoxGeometry(0.12, 0.06, 0.18), azulEscuro, 0, -0.09, 0);
    M.pernas.push(pe);
  }
  return M;
}

function criarSalamandro(scene) {
  // lagartinho de fogo colado na referência: silhueta CONTÍNUA em pêra
  // (esferas emendadas), barrigão creme, boca larga aberta com presinhas,
  // olhos verde-água, braços abertos e a chama em gota NA PONTA da cauda
  const M = novoModelo(scene, 1.2);
  const g = M.g;
  const laranja = 0xf08030, creme = 0xffe9c4;
  // corpo-pêra contínuo: quadril -> tronco -> pescoço se sobrepõem
  const corpo = parte(M, g, new THREE.SphereGeometry(0.34, 18, 14), laranja, 0, 0.42, 0);
  corpo.scale.set(1.08, 1, 1);
  M.corpo = corpo; corpo.userData.s0 = corpo.scale.clone();
  parte(M, g, new THREE.SphereGeometry(0.27, 16, 12), laranja, 0, 0.68, 0.01);
  parte(M, g, new THREE.SphereGeometry(0.21, 14, 10), laranja, 0, 0.9, 0.02);
  // barrigão creme do peito à barriga
  const barriga = parte(M, g, new THREE.SphereGeometry(0.28, 14, 12), creme, 0, 0.46, 0.15);
  barriga.scale.set(0.95, 1.15, 0.55);
  // CABEÇA articulada: crânio largo + focinho + BOCA ABERTA com presas
  const cab = grupoEm(M, 0, 1.14, 0.03);
  M.cabeca = cab;
  const cranio = parte(M, cab, new THREE.SphereGeometry(0.3, 18, 14), laranja, 0, 0.02, -0.02);
  cranio.scale.set(1.05, 0.95, 1);
  const focinho = parte(M, cab, new THREE.SphereGeometry(0.2, 14, 10), laranja, 0, -0.08, 0.2);
  focinho.scale.set(1.1, 0.7, 1.15);
  // boca aberta (interior escuro) com duas presinhas brancas
  const bocaAberta = parte(M, cab, new THREE.SphereGeometry(0.13, 10, 8), 0x7a3328, 0, -0.16, 0.28);
  bocaAberta.scale.set(1.25, 0.5, 0.7);
  for (const lado of [-1, 1]) {
    const presa = parte(M, cab, new THREE.ConeGeometry(0.025, 0.07, 5), 0xffffff, lado * 0.1, -0.13, 0.36);
    presa.rotation.x = Math.PI; // pontinha para baixo
  }
  parte(M, cab, new THREE.SphereGeometry(0.02, 6, 6), COR.olho, -0.06, 0.0, 0.34);
  parte(M, cab, new THREE.SphereGeometry(0.02, 6, 6), COR.olho, 0.06, 0.0, 0.34);
  // olhos grandes com íris verde-água (como na referência)
  for (const lado of [-1, 1]) {
    const olhoB = parte(M, cab, new THREE.SphereGeometry(0.085, 10, 8), 0xffffff, lado * 0.14, 0.12, 0.19);
    olhoB.scale.set(0.9, 1.15, 0.6);
    parte(M, cab, new THREE.SphereGeometry(0.05, 8, 8), 0x1f8a8a, lado * 0.14, 0.12, 0.25);
    parte(M, cab, new THREE.SphereGeometry(0.026, 6, 6), COR.olho, lado * 0.14, 0.12, 0.29);
  }
  marcaBoca(M, cab, 0, -0.16, 0.38);
  // braços ABERTOS para os lados, com garrinhas brancas
  for (const lado of [-1, 1]) {
    const ombro = grupoEm(M, lado * 0.3, 0.74, 0.04);
    const braco = parte(M, ombro, new THREE.CylinderGeometry(0.065, 0.06, 0.3, 8), laranja, lado * 0.1, -0.05, 0.03);
    braco.rotation.z = lado * 1.1;
    parte(M, ombro, new THREE.SphereGeometry(0.07, 8, 8), laranja, lado * 0.24, -0.1, 0.05);
    for (const dg of [-0.03, 0.03]) {
      const garra = parte(M, ombro, new THREE.ConeGeometry(0.022, 0.06, 5), 0xffffff, lado * 0.29 + dg, -0.12, 0.06);
      garra.rotation.z = lado * 1.4;
    }
    M.bracos.push(ombro);
  }
  // pernas grossas com pés e garras
  for (const lado of [-1, 1]) {
    const quadril = grupoEm(M, lado * 0.18, 0.28, 0);
    parte(M, quadril, new THREE.SphereGeometry(0.15, 10, 8), laranja, 0, -0.06, 0);
    const peS = parte(M, quadril, new THREE.SphereGeometry(0.13, 10, 8), laranja, 0, -0.22, 0.07);
    peS.scale.set(0.9, 0.5, 1.3);
    for (const dg of [-0.06, 0, 0.06]) {
      const garra = parte(M, quadril, new THREE.ConeGeometry(0.028, 0.09, 6), 0xffffff, dg, -0.24, 0.24);
      garra.rotation.x = Math.PI / 2;
    }
    M.pernas.push(quadril);
  }
  // CAUDA grossa em curva (esferas emendadas) com a CHAMA na ponta
  const cauda = grupoEm(M, 0, 0.38, -0.26);
  M.cauda = cauda;
  parte(M, cauda, new THREE.SphereGeometry(0.16, 12, 10), laranja, 0, 0.02, -0.12);
  parte(M, cauda, new THREE.SphereGeometry(0.13, 12, 10), laranja, 0, 0.1, -0.3);
  parte(M, cauda, new THREE.SphereGeometry(0.1, 10, 8), laranja, 0, 0.24, -0.44);
  parte(M, cauda, new THREE.SphereGeometry(0.075, 10, 8), laranja, 0, 0.4, -0.5);
  // chama em GOTA: base esférica vermelha + línguas laranja e amarela
  const chama = new THREE.Group();
  chama.position.set(0, 0.55, -0.5);
  cauda.add(chama);
  M.chama = chama;
  const fBase = parte(M, chama, new THREE.SphereGeometry(0.12, 10, 8), 0xff4422, 0, 0, 0);
  const fMeio = parte(M, chama, new THREE.ConeGeometry(0.11, 0.3, 8), 0xff8a3d, 0, 0.14, 0);
  const fPonta = parte(M, chama, new THREE.ConeGeometry(0.055, 0.2, 8), 0xffe066, 0, 0.26, 0);
  fBase.material.emissive.setHex(0x992200);
  fMeio.material.emissive.setHex(0x994400);
  fPonta.material.emissive.setHex(0x997700);
  M.materiais.splice(-3, 3); // a chama não pisca com dano
  return M;
}

/* ---------- novatas do Compêndio (aguardando aprovação do Domador) ---------- */
function criarFolhito(scene) {
  // quadrúpede de planta com bulbo-folha nas costas
  const M = novoModelo(scene, 1.1);
  const g = M.g;
  const verde = 0x54b98a, escuro = 0x2f8a4a;
  const corpo = parte(M, g, new THREE.SphereGeometry(0.32, 16, 12), verde, 0, 0.42, -0.02);
  corpo.scale.set(1.05, 0.9, 1.15);
  M.corpo = corpo; corpo.userData.s0 = corpo.scale.clone();
  // manchas
  for (const [x, y2, z] of [[-0.2, 0.5, 0.18], [0.22, 0.42, -0.1], [-0.1, 0.36, -0.26]]) {
    const m = parte(M, g, new THREE.SphereGeometry(0.07, 8, 6), escuro, x, y2, z);
    m.scale.set(1, 0.4, 1);
  }
  // bulbo com folha
  parte(M, g, new THREE.SphereGeometry(0.2, 12, 10), escuro, 0, 0.72, -0.16);
  const broto = parte(M, g, new THREE.ConeGeometry(0.09, 0.3, 8), 0x3fae5a, 0, 0.98, -0.16);
  for (const lado of [-1, 1]) {
    const folha = parte(M, g, new THREE.SphereGeometry(0.14, 8, 6), 0x3fae5a, lado * 0.2, 0.84, -0.16);
    folha.scale.set(1.3, 0.25, 0.7);
    folha.rotation.z = lado * 0.5;
  }
  const cab = grupoEm(M, 0, 0.66, 0.32);
  M.cabeca = cab;
  parte(M, cab, new THREE.SphereGeometry(0.24, 16, 12), verde, 0, 0, 0);
  const foc = parte(M, cab, new THREE.SphereGeometry(0.14, 10, 8), verde, 0, -0.07, 0.16);
  foc.scale.set(1.2, 0.7, 1);
  for (const lado of [-1, 1]) {
    parte(M, cab, new THREE.SphereGeometry(0.06, 8, 8), 0xffffff, lado * 0.12, 0.06, 0.17);
    parte(M, cab, new THREE.SphereGeometry(0.035, 8, 6), 0x8a2f2f, lado * 0.12, 0.06, 0.22);
    const orelha = parte(M, cab, new THREE.ConeGeometry(0.06, 0.14, 6), verde, lado * 0.13, 0.24, -0.04);
    orelha.rotation.z = -lado * 0.3;
  }
  marcaBoca(M, cab, 0, -0.1, 0.26);
  for (const [x, z] of [[-0.18, 0.16], [0.18, 0.16], [-0.18, -0.24], [0.18, -0.24]]) {
    const quadril = grupoEm(M, x, 0.24, z);
    parte(M, quadril, new THREE.CylinderGeometry(0.065, 0.06, 0.16, 8), verde, 0, -0.09, 0);
    const pata = parte(M, quadril, new THREE.SphereGeometry(0.07, 8, 8), escuro, 0, -0.18, 0.01);
    pata.scale.set(1, 0.7, 1.1);
    M.pernas.push(quadril);
  }
  return M;
}

function criarAssombrim(scene) {
  // bola de sombra sorridente com espetos de "cabelo"
  const M = novoModelo(scene, 1.05);
  const g = M.g;
  const roxo = 0x5a3f8a, roxoEscuro = 0x43306b;
  const corpo = parte(M, g, new THREE.SphereGeometry(0.38, 18, 14), roxo, 0, 0.55, 0);
  corpo.scale.set(1.05, 1, 1);
  M.corpo = corpo; corpo.userData.s0 = corpo.scale.clone();
  // espetos nas costas e topo
  for (const [x, y2, z, rz] of [[-0.2, 0.9, -0.1, 0.5], [0, 0.98, -0.15, 0], [0.2, 0.9, -0.1, -0.5],
                                 [-0.32, 0.72, -0.2, 0.9], [0.32, 0.72, -0.2, -0.9]]) {
    const esp = parte(M, g, new THREE.ConeGeometry(0.09, 0.28, 6), roxoEscuro, x, y2, z);
    esp.rotation.z = rz;
  }
  // olhos grandes malandros + sorriso de dentes
  for (const lado of [-1, 1]) {
    const olho = parte(M, g, new THREE.SphereGeometry(0.09, 10, 8), 0xffffff, lado * 0.15, 0.66, 0.3);
    olho.scale.set(1, 1.2, 0.5);
    parte(M, g, new THREE.SphereGeometry(0.045, 8, 6), 0x8a2f2f, lado * 0.14, 0.66, 0.36);
  }
  for (let i = -2; i <= 2; i++) {
    const dente = parte(M, g, new THREE.ConeGeometry(0.035, 0.09, 4), 0xffffff, i * 0.08, 0.42 - Math.abs(i) * 0.02, 0.34);
    dente.rotation.x = Math.PI;
  }
  marcaBoca(M, g, 0, 0.44, 0.38);
  // bracinhos e perninhas de sombra
  for (const lado of [-1, 1]) {
    const braco = grupoEm(M, lado * 0.36, 0.5, 0.06);
    const b = parte(M, braco, new THREE.SphereGeometry(0.1, 8, 8), roxo, lado * 0.06, -0.08, 0.04);
    b.scale.set(0.7, 1.2, 0.7);
    M.bracos.push(braco);
    const perna = grupoEm(M, lado * 0.15, 0.2, 0);
    const p2 = parte(M, perna, new THREE.SphereGeometry(0.1, 8, 8), roxoEscuro, 0, -0.08, 0.02);
    p2.scale.set(0.9, 0.7, 1.1);
    M.pernas.push(perna);
  }
  return M;
}

function criarRaiozim(scene) {
  // ratinho elétrico de orelhas compridas e cauda-raio
  const M = novoModelo(scene, 1.05);
  const g = M.g;
  const amarelo = 0xffd93b, marromP = 0x8a6a50;
  const corpo = parte(M, g, new THREE.SphereGeometry(0.28, 16, 12), amarelo, 0, 0.38, 0);
  corpo.scale.set(1, 1.12, 0.95);
  M.corpo = corpo; corpo.userData.s0 = corpo.scale.clone();
  const cab = grupoEm(M, 0, 0.82, 0.04);
  M.cabeca = cab;
  parte(M, cab, new THREE.SphereGeometry(0.24, 16, 12), amarelo, 0, 0, 0);
  // orelhas compridas de ponta escura
  for (const lado of [-1, 1]) {
    const orelha = parte(M, cab, new THREE.ConeGeometry(0.07, 0.42, 8), amarelo, lado * 0.14, 0.34, -0.04);
    orelha.rotation.z = -lado * 0.35;
    const ponta = parte(M, cab, new THREE.ConeGeometry(0.05, 0.14, 8), 0x33313d, lado * 0.2, 0.5, -0.04);
    ponta.rotation.z = -lado * 0.35;
  }
  // bochechas VERMELHAS de eletricidade
  for (const lado of [-1, 1])
    parte(M, cab, new THREE.SphereGeometry(0.07, 8, 8), 0xe05a41, lado * 0.18, -0.06, 0.14);
  parte(M, cab, new THREE.SphereGeometry(0.045, 8, 6), COR.olho, -0.09, 0.04, 0.21);
  parte(M, cab, new THREE.SphereGeometry(0.045, 8, 6), COR.olho, 0.09, 0.04, 0.21);
  parte(M, cab, new THREE.SphereGeometry(0.025, 6, 6), COR.olho, 0, -0.04, 0.235);
  marcaBoca(M, cab, 0, -0.08, 0.24);
  // bracinhos, pernas e a cauda-raio grande
  for (const lado of [-1, 1]) {
    const braco = grupoEm(M, lado * 0.26, 0.48, 0.08);
    parte(M, braco, new THREE.SphereGeometry(0.07, 8, 8), amarelo, lado * 0.03, -0.06, 0.03);
    M.bracos.push(braco);
    const perna = grupoEm(M, lado * 0.13, 0.16, 0);
    const pe = parte(M, perna, new THREE.SphereGeometry(0.09, 8, 8), amarelo, 0, -0.06, 0.03);
    pe.scale.set(0.8, 0.6, 1.3);
    M.pernas.push(perna);
  }
  const cauda = grupoEm(M, 0, 0.4, -0.24);
  M.cauda = cauda;
  parte(M, cauda, new THREE.BoxGeometry(0.07, 0.16, 0.1), marromP, 0, -0.02, -0.05);
  const r1 = parte(M, cauda, new THREE.BoxGeometry(0.2, 0.06, 0.26), amarelo, -0.06, 0.12, -0.16);
  r1.rotation.y = 0.5;
  const r2 = parte(M, cauda, new THREE.BoxGeometry(0.24, 0.06, 0.3), amarelo, 0.06, 0.3, -0.28);
  r2.rotation.y = -0.5;
  const r3 = parte(M, cauda, new THREE.BoxGeometry(0.3, 0.06, 0.2), amarelo, -0.02, 0.46, -0.36);
  r3.rotation.y = 0.4;
  return M;
}

/* Dragolim — dragãozinho chibi coral: barriga creme, orelhas-nadadeira,
   crista de chamas nas costas (tremula!), cauda com espinho claro */
function criarDragolim(scene) {
  const M = novoModelo(scene, 1.25);
  const g = M.g;
  const CORAL = 0xd96a52, CREME = 0xf5e6c0, CHIFRE = 0xbfe8dd;
  const corpo = parte(M, g, new THREE.SphereGeometry(0.34, 16, 12), CORAL, 0, 0.46, -0.02);
  corpo.scale.set(0.95, 1.05, 0.9);
  M.corpo = corpo; corpo.userData.s0 = corpo.scale.clone();
  const barriga = parte(M, g, new THREE.SphereGeometry(0.26, 12, 10), CREME, 0, 0.42, 0.16);
  barriga.scale.set(0.85, 0.95, 0.55);
  // cabeça grande com focinho, olhos verde-água e chifrinhos
  const cab = grupoEm(M, 0, 0.98, 0.1);
  M.cabeca = cab;
  parte(M, cab, new THREE.SphereGeometry(0.3, 16, 12), CORAL, 0, 0, 0);
  const foc = parte(M, cab, new THREE.SphereGeometry(0.16, 10, 8), CORAL, 0, -0.08, 0.24);
  foc.scale.set(1.1, 0.7, 1);
  for (const lado of [-1, 1]) {
    parte(M, cab, new THREE.SphereGeometry(0.06, 8, 6), 0x2e8f96, lado * 0.14, 0.06, 0.24);
    // orelhas-NADADEIRA (cones achatados, marca do dragolim)
    const asa = parte(M, cab, new THREE.ConeGeometry(0.13, 0.42, 6), 0xc9553f, lado * 0.24, 0.2, -0.06);
    asa.rotation.z = lado * -0.9; asa.scale.z = 0.3;
    parte(M, cab, new THREE.ConeGeometry(0.035, 0.1, 6), CHIFRE, lado * 0.07, 0.29, 0.06);
  }
  marcaBoca(M, cab, 0, -0.1, 0.38);
  // CRISTA de chamas nas costas (usa o tremeluzir da "chama" do idle)
  const crista = grupoEm(M, 0, 0.62, -0.28);
  M.chama = crista;
  parte(M, crista, new THREE.ConeGeometry(0.11, 0.34, 6), 0xff8a3d, 0, 0.1, 0);
  parte(M, crista, new THREE.ConeGeometry(0.08, 0.26, 6), 0xffd93b, -0.09, 0.02, 0.02).rotation.z = 0.5;
  parte(M, crista, new THREE.ConeGeometry(0.08, 0.26, 6), 0xff6b3d, 0.09, 0.02, 0.02).rotation.z = -0.5;
  M.materiais.splice(-3, 3); // a crista não pisca no flash de dano
  // bracinhos com garras + pernas
  for (const lado of [-1, 1]) {
    const braco = grupoEm(M, lado * 0.3, 0.52, 0.06);
    parte(M, braco, new THREE.SphereGeometry(0.09, 8, 6), CORAL, lado * 0.04, -0.06, 0.02).scale.set(0.7, 1.1, 0.7);
    parte(M, braco, new THREE.ConeGeometry(0.025, 0.07, 5), CHIFRE, lado * 0.05, -0.16, 0.05);
    M.bracos.push(braco);
    const perna = grupoEm(M, lado * 0.16, 0.22, 0);
    parte(M, perna, new THREE.SphereGeometry(0.12, 8, 6), CORAL, 0, -0.06, 0).scale.set(0.9, 1, 1);
    parte(M, perna, new THREE.BoxGeometry(0.14, 0.06, 0.2), 0xc9553f, 0, -0.16, 0.05);
    M.pernas.push(perna);
  }
  // cauda com espinho claro na ponta
  const cauda = grupoEm(M, 0, 0.4, -0.28);
  M.cauda = cauda;
  parte(M, cauda, new THREE.SphereGeometry(0.11, 8, 6), CORAL, 0, -0.02, -0.14);
  parte(M, cauda, new THREE.SphereGeometry(0.08, 8, 6), CORAL, 0, 0.02, -0.28);
  const esp = parte(M, cauda, new THREE.ConeGeometry(0.06, 0.18, 6), CHIFRE, 0, 0.08, -0.4);
  esp.rotation.x = -0.7;
  return M;
}

/* Faiscat — felino elétrico: pelagem noturna, juba de picos, orelhas
   grandes de miolo amarelo, cauda fina com estrela na ponta */
function criarFaiscat(scene) {
  const M = novoModelo(scene, 1.05);
  const g = M.g;
  const NOITE = 0x2e2a3d, AMARELO = 0xffc93d;
  const corpo = parte(M, g, new THREE.SphereGeometry(0.3, 14, 10), NOITE, 0, 0.44, -0.08);
  corpo.scale.set(0.9, 0.9, 1.35);
  M.corpo = corpo; corpo.userData.s0 = corpo.scale.clone();
  // cabeça com juba de picos (estilo tempestade)
  const cab = grupoEm(M, 0, 0.72, 0.3);
  M.cabeca = cab;
  parte(M, cab, new THREE.SphereGeometry(0.22, 14, 10), NOITE, 0, 0, 0);
  const focinho = parte(M, cab, new THREE.SphereGeometry(0.1, 8, 6), 0x3d3852, 0, -0.06, 0.16);
  focinho.scale.set(1.1, 0.8, 0.9);
  parte(M, cab, new THREE.SphereGeometry(0.035, 6, 5), 0xd94a3d, 0, -0.02, 0.26);
  for (const [x, y, rz] of [[-0.14, 0.16, 0.8], [0, 0.2, 0], [0.14, 0.16, -0.8], [-0.2, 0.02, 1.3], [0.2, 0.02, -1.3]]) {
    const pico = parte(M, cab, new THREE.ConeGeometry(0.06, 0.22, 5), NOITE, x, y, -0.08);
    pico.rotation.z = rz; pico.rotation.x = -0.4;
  }
  for (const lado of [-1, 1]) {
    // orelhões redondos com miolo amarelo
    parte(M, cab, new THREE.SphereGeometry(0.09, 8, 6), NOITE, lado * 0.18, 0.18, -0.02).scale.set(1, 1.1, 0.4);
    parte(M, cab, new THREE.SphereGeometry(0.06, 8, 6), AMARELO, lado * 0.18, 0.18, 0.01).scale.set(0.9, 1, 0.3);
    parte(M, cab, new THREE.SphereGeometry(0.045, 8, 6), AMARELO, lado * 0.1, 0.05, 0.19);
  }
  marcaBoca(M, cab, 0, -0.08, 0.24);
  // quatro patas com "meias" amarelas
  for (const [lx, lz] of [[-0.16, 0.22], [0.16, 0.22], [-0.16, -0.24], [0.16, -0.24]]) {
    const p = grupoEm(M, lx, 0.3, lz);
    parte(M, p, new THREE.CylinderGeometry(0.06, 0.07, 0.26, 8), NOITE, 0, -0.12, 0);
    parte(M, p, new THREE.SphereGeometry(0.065, 8, 6), AMARELO, 0, -0.25, 0.01);
    M.pernas.push(p);
  }
  // cauda fina com ESTRELA
  const cauda = grupoEm(M, 0, 0.52, -0.42);
  M.cauda = cauda;
  parte(M, cauda, new THREE.CylinderGeometry(0.03, 0.035, 0.4, 6), NOITE, 0, 0.12, -0.1).rotation.x = 0.9;
  parte(M, cauda, new THREE.OctahedronGeometry(0.09), AMARELO, 0, 0.28, -0.28).scale.set(1, 1, 0.45);
  return M;
}

/* Fofim — roedor rechonchudo laranja de orelhas-chama azul-marinho,
   bracinhos erguidos e topete arrepiado */
function criarFofim(scene) {
  const M = novoModelo(scene, 0.95);
  const g = M.g;
  const LARANJA = 0xf08030, MARINHO = 0x2b3050;
  // corpo-pêra rechonchudo (cabeça e corpo são um só, estilo do print)
  const corpo = parte(M, g, new THREE.SphereGeometry(0.36, 16, 12), LARANJA, 0, 0.44, 0);
  corpo.scale.set(1, 1.15, 0.92);
  M.corpo = corpo; corpo.userData.s0 = corpo.scale.clone();
  const peito = parte(M, g, new THREE.SphereGeometry(0.24, 12, 10), MARINHO, 0, 0.34, 0.18);
  peito.scale.set(0.8, 0.9, 0.5);
  const cab = grupoEm(M, 0, 0.82, 0.06);
  M.cabeca = cab;
  parte(M, cab, new THREE.SphereGeometry(0.24, 14, 10), LARANJA, 0, 0, 0.02);
  for (const lado of [-1, 1]) {
    parte(M, cab, new THREE.SphereGeometry(0.055, 8, 6), 0x4a3220, lado * 0.1, 0.04, 0.2);
    // orelhas-CHAMA marinho (dois gomos inclinados)
    const o1 = parte(M, cab, new THREE.ConeGeometry(0.1, 0.3, 6), MARINHO, lado * 0.17, 0.24, -0.02);
    o1.rotation.z = lado * -0.55; o1.scale.z = 0.5;
    const o2 = parte(M, cab, new THREE.ConeGeometry(0.06, 0.2, 6), LARANJA, lado * 0.24, 0.16, -0.02);
    o2.rotation.z = lado * -0.9; o2.scale.z = 0.5;
  }
  // topete arrepiado marinho
  const topete = parte(M, cab, new THREE.ConeGeometry(0.07, 0.24, 6), MARINHO, 0, 0.26, 0.04);
  topete.rotation.z = 0.3;
  // boquinha aberta de espanto
  parte(M, cab, new THREE.SphereGeometry(0.045, 8, 6), 0x5a2a1a, 0, -0.08, 0.22);
  marcaBoca(M, cab, 0, -0.08, 0.26);
  // bracinhos erguidos + pezinhos
  for (const lado of [-1, 1]) {
    const braco = grupoEm(M, lado * 0.3, 0.56, 0.1);
    parte(M, braco, new THREE.SphereGeometry(0.08, 8, 6), LARANJA, lado * 0.03, 0.04, 0.02).scale.set(0.7, 1.1, 0.7);
    braco.rotation.z = lado * 0.7;
    M.bracos.push(braco);
    const pe = grupoEm(M, lado * 0.13, 0.14, 0.02);
    parte(M, pe, new THREE.SphereGeometry(0.09, 8, 6), LARANJA, 0, -0.05, 0.02).scale.set(0.9, 0.6, 1.2);
    M.pernas.push(pe);
  }
  // cauda-tufo marinho
  const cauda = grupoEm(M, 0, 0.34, -0.3);
  M.cauda = cauda;
  const t1 = parte(M, cauda, new THREE.ConeGeometry(0.09, 0.3, 6), MARINHO, 0, 0.08, -0.1);
  t1.rotation.x = -1.1; t1.scale.z = 0.55;
  const t2 = parte(M, cauda, new THREE.ConeGeometry(0.06, 0.22, 6), MARINHO, 0.07, 0.02, -0.16);
  t2.rotation.x = -1.3; t2.scale.z = 0.55;
  return M;
}

const FABRICAS = { brasinha: criarBrasinha, cascorro: criarCascorro, voltim: criarVoltim, gotim: criarGotim, salamandro: criarSalamandro, folhito: criarFolhito, assombrim: criarAssombrim, raiozim: criarRaiozim, dragolim: criarDragolim, faiscat: criarFaiscat, fofim: criarFofim };

/* pipeline glTF: carrega modelo com esqueleto/animações, normaliza a escala
   pela altura desejada e apoia os pés no chão. Clipes viram ações nomeadas. */
let _loader = null;
// mede o tamanho REAL de um modelo com esqueleto: amostra os vértices já
// "skinnados" (boneTransform). O Box3 da geometria mente nos exports do
// Meshy (escala 0.01 no armature) e a nuvem de ossos superestima em rigs
// com ossos espalhados — só os vértices dizem a verdade, e assim o
// altura3d dos dados vale igualzinho para toda fera
function caixaReal(obj) {
  obj.updateMatrixWorld(true);
  const cx = new THREE.Box3();
  const p = new THREE.Vector3();
  let temSkin = false;
  try {
    obj.traverse((o) => {
      if (o.isSkinnedMesh && o.geometry.attributes.position) {
        temSkin = true;
        if (o.skeleton && o.skeleton.update) o.skeleton.update();
        const n = o.geometry.attributes.position.count;
        const passo = Math.max(1, Math.floor(n / 240));
        for (let i = 0; i < n; i += passo) {
          o.boneTransform(i, p);
          cx.expandByPoint(p.applyMatrix4(o.matrixWorld));
        }
      }
    });
  } catch (e) { temSkin = false; }
  if (!temSkin || cx.isEmpty()) return new THREE.Box3().setFromObject(obj);
  return cx;
}

export function criarFeraGltf(scene, url, alturaAlvo = 1.1, giroGraus = 0) {
  if (!_loader) _loader = new GLTFLoader();
  return new Promise((resolve, reject) => {
    _loader.load(url, (gltf) => {
      const M = novoModelo(scene, alturaAlvo);
      M.gltf = true;
      const interno = new THREE.Group();
      interno.add(gltf.scene);
      M.g.add(interno);
      // giro3d dos dados corrige modelos que "olham" para outro eixo
      // (nossa convenção: fera parada encara +z)
      if (giroGraus) interno.rotation.y = giroGraus * Math.PI / 180;
      const box = caixaReal(gltf.scene);
      let alt = box.max.y - box.min.y || 1;
      // asas e galhadas NÃO contam como altura: se o rig tem osso 'Head',
      // o altura3d vale até o topo do crânio (dragões de asas altas ficam
      // do tamanho imponente que merecem)
      let cabeca = null;
      gltf.scene.traverse((o) => { if (!cabeca && o.isBone && o.name === 'Head') cabeca = o; });
      if (cabeca) {
        const topoCranio = (new THREE.Vector3().setFromMatrixPosition(cabeca.matrixWorld).y
          - box.min.y) * 1.22;
        if (topoCranio > alt * 0.35) alt = Math.min(alt, topoCranio);
      }
      interno.scale.setScalar(alturaAlvo / alt);
      const box2 = caixaReal(interno);
      interno.position.y = -box2.min.y;
      marcaBoca(M, M.g, 0, alturaAlvo * 0.72, alturaAlvo * 0.55);
      gltf.scene.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true;
          // alguns modelos (a raposa!) vêm SEM normais — o Lambert precisa
          // delas para iluminar; sem isso a malha some/fica preta
          if (!o.geometry.attributes.normal) o.geometry.computeVertexNormals();
          // troca o material PBR (escuro sob nossa luz estilizada) por
          // Lambert, o mesmo das outras feras — cores vivas e flash ok
          const troca = (mt) => {
            // texturas glTF vêm marcadas como sRGB; sem correção de gama no
            // renderer isso ESCURECE tudo (feras quase pretas). Tratamos a
            // textura como linear: as cores aparecem como foram pintadas.
            if (mt.map) mt.map.encoding = THREE.LinearEncoding;
            const novo = new THREE.MeshLambertMaterial({
              // com textura, a cor deve ser branca (senão multiplica e escurece)
              color: mt.map ? 0xffffff : (mt.color ? mt.color.clone() : 0xffffff),
              map: mt.map || null,
            });
            novo.skinning = o.isSkinnedMesh === true;
            if (mt.vertexColors) novo.vertexColors = mt.vertexColors;
            return novo;
          };
          if (Array.isArray(o.material)) o.material = o.material.map(troca);
          else o.material = troca(o.material);
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          for (const mt of mats) M.materiais.push(mt);
          // malha com esqueleto se move além da caixa da geometria — sem
          // isso a câmera "corta" o modelo achando que saiu da tela
          if (o.isSkinnedMesh) o.frustumCulled = false;
        }
      });
      M.mixer = new THREE.AnimationMixer(gltf.scene);
      M.clips = {};
      for (const clip of gltf.animations) M.clips[clip.name] = M.mixer.clipAction(clip);
      M.clipAtual = null;
      resolve(M);
    }, undefined, reject);
  });
}
// humano glTF (jogador e treinadores do Meshy): mesmo pipeline das feras,
// com os clipes padronizados parado/andar/correr embutidos no arquivo
export function criarPersonagem(scene, url, alturaAlvo = 1.7) {
  return criarFeraGltf(scene, url, alturaAlvo, 0).then((M) => {
    M.clipes = { parado: 'parado', andar: 'andar', correr: 'correr' };
    tocaClip(M, 'parado', 0);
    return M;
  });
}

// troca de animação com transição suave; "once" toca o clipe uma única vez
// e congela no último quadro (golpes, dano, KO) — "restart" força recomeço
// mesmo se já for o clipe atual (dois golpes seguidos)
export function tocaClip(M, nome, fade = 0.2, opts = {}) {
  if (!M.mixer) return;
  if (M.clipAtual === nome && !opts.restart) return;
  const acao = M.clips[nome];
  if (!acao) return;
  if (M.clipAtual && M.clips[M.clipAtual] && M.clipAtual !== nome)
    M.clips[M.clipAtual].fadeOut(fade);
  if (opts.once) {
    acao.setLoop(THREE.LoopOnce, 1);
    acao.clampWhenFinished = true;
  } else acao.setLoop(THREE.LoopRepeat, Infinity);
  acao.reset().fadeIn(fade).play();
  // clipe LONGO do Meshy num golpe curto: os clipes "charged" têm segundos
  // de preparação — pulamos direto para o MIOLO (a ação de verdade) e
  // ajustamos a velocidade para caber na janela do golpe
  const clip = acao.getClip ? acao.getClip() : acao._clip;
  if (opts.once && opts.dur && clip && clip.duration > opts.dur * 1.5) {
    acao.time = clip.duration * 0.22;
    acao.timeScale = (clip.duration * 0.62) / opts.dur;
  } else acao.timeScale = 1;
  M.clipAtual = nome;
}
export function passoMixer(M, dt) { if (M && M.mixer) M.mixer.update(dt); }

// espécies com "modelo3d" nos dados usam glTF; as demais, as fábricas.
// Sempre devolve uma Promise (o chamador usa await).
// POSES de golpe (quadros congelados, estilo anime): modelos estáticos que
// substituem o corpo por um instante durante o golpe. Dados da espécie:
// "poses": { fisico: slug, poder: slug } -> assets/poses/<slug>.glb
function carregaPoses(M, esp) {
  if (!esp.poses) return;
  M.poses = {};
  for (const [cat, slug] of Object.entries(esp.poses)) {
    new GLTFLoader().load(`./assets/poses/${slug}.glb`, (g) => {
      g.scene.traverse((o) => {
        if (!o.isMesh) return;
        if (!o.geometry.attributes.normal) o.geometry.computeVertexNormals();
        const troca = (mt) => {
          if (mt.map) mt.map.encoding = THREE.LinearEncoding;
          return new THREE.MeshLambertMaterial({ color: 0xffffff, map: mt.map || null });
        };
        o.material = Array.isArray(o.material) ? o.material.map(troca) : troca(o.material);
        o.castShadow = true;
      });
      const caixa = new THREE.Box3().setFromObject(g.scene);
      const alvo = esp.altura3d || 1.1;
      const esc = alvo / Math.max(0.01, caixa.max.y - caixa.min.y);
      const grupo = new THREE.Group();
      g.scene.scale.setScalar(esc);
      g.scene.position.set(
        -(caixa.min.x + caixa.max.x) / 2 * esc,
        -caixa.min.y * esc,
        -(caixa.min.z + caixa.max.z) / 2 * esc);
      grupo.add(g.scene);
      grupo.visible = false;
      M.g.add(grupo);
      M.poses[cat] = grupo;
    }, undefined, () => {});
  }
}
export function criarFera(scene, chave, esp) {
  if (esp && esp.modelo3d)
    return criarFeraGltf(scene, esp.modelo3d, esp.altura3d || 1.1, esp.giro3d || 0)
      .then((M) => { M.clipes = esp.clipes || {}; carregaPoses(M, esp); return M; })
      .catch((e) => {
        // arquivo ausente/corrompido não derruba o jogo: cai no procedural
        console.warn(`modelo3d de "${chave}" falhou; usando modelo procedural`, e);
        return (FABRICAS[chave] || criarCascorro)(scene);
      });
  const fabrica = FABRICAS[chave];
  return Promise.resolve((fabrica || criarCascorro)(scene));
}

// projétil elemental. Bola única = esfera de fogo com CAUDA de chamas;
// tiro de rajada = labareda pequena e tremeluzente (nada de "bola")
export function criarProjetil(scene, corHex, rajada = false) {
  const M = novoModelo(scene, 0.5);
  const basico = (cor, op) => new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: op });
  if (rajada) {
    // língua de fogo: cones sobrepostos apontando na direção do voo (+z)
    for (const [r, l, cor, op] of [[0.16, 0.55, corHex, 0.9], [0.1, 0.38, 0xffe066, 0.9], [0.2, 0.3, corHex, 0.35]]) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(r, l, 7), basico(cor, op));
      cone.rotation.x = -Math.PI / 2;
      M.g.add(cone);
    }
  } else {
    const mat = new THREE.MeshLambertMaterial({
      color: corHex, emissive: corHex, emissiveIntensity: 0.7 });
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 10), mat);
    m.castShadow = true; M.materiais.push(mat); M.g.add(m);
    // cauda de chamas atrás (-z)
    const c1 = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.7, 8), basico(corHex, 0.55));
    c1.rotation.x = Math.PI / 2; c1.position.z = -0.5; M.g.add(c1);
    const c2 = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.5, 8), basico(0xffe066, 0.7));
    c2.rotation.x = Math.PI / 2; c2.position.z = -0.42; M.g.add(c2);
  }
  return M;
}

export function criarCristal(scene) {
  const M = novoModelo(scene, 0.55);
  const mat = new THREE.MeshLambertMaterial({
    color: COR.cristal, emissive: 0x1f9b8e, transparent: true, opacity: 0.95 });
  // esfera lisa (era um icosaedro "poligonal" demais) com um aro equatorial
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.27, 18, 14), mat);
  m.castShadow = true; M.materiais.push(mat); M.g.add(m);
  const aroMat = new THREE.MeshLambertMaterial({ color: 0xfff6df, emissive: 0x445555 });
  const aro = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.035, 8, 24), aroMat);
  aro.rotation.x = Math.PI / 2;
  M.materiais.push(aroMat); M.g.add(aro);
  // a EsFera de VERDADE (modelo do Domador): quando o arquivo chega, troca
  // a esfera provisória — centralizada no pivô para girar/voar redondinha
  new GLTFLoader().load('./assets/cenario/esfera-captura.glb', (g) => {
    g.scene.traverse((o) => {
      if (!o.isMesh) return;
      if (!o.geometry.attributes.normal) o.geometry.computeVertexNormals();
      const troca = (mt) => {
        if (mt.map) mt.map.encoding = THREE.LinearEncoding;
        return new THREE.MeshLambertMaterial({ color: 0xffffff, map: mt.map || null });
      };
      o.material = Array.isArray(o.material) ? o.material.map(troca) : troca(o.material);
      o.castShadow = true;
    });
    const caixa = new THREE.Box3().setFromObject(g.scene);
    const esc = 0.62 / Math.max(0.01, caixa.max.y - caixa.min.y);
    g.scene.scale.setScalar(esc);
    g.scene.position.sub(caixa.getCenter(new THREE.Vector3()).multiplyScalar(esc));
    while (M.g.children.length) M.g.remove(M.g.children[0]);
    M.g.add(g.scene);
  }, undefined, () => {});
  return M;
}

// disco de projeção para o "holograma" da fera no menu de status
export function criarDiscoHolo(scene) {
  const M = novoModelo(scene, 0.1);
  const disco = new THREE.Mesh(new THREE.CircleGeometry(1.1, 24),
    new THREE.MeshBasicMaterial({ color: 0x59e0d0, transparent: true, opacity: 0.3 }));
  disco.rotation.x = -Math.PI / 2; disco.position.y = 0.03;
  M.g.add(disco);
  const anel = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.04, 8, 24),
    new THREE.MeshBasicMaterial({ color: 0x7fe3ff, transparent: true, opacity: 0.7 }));
  anel.rotation.x = -Math.PI / 2; anel.position.y = 0.04;
  M.g.add(anel);
  return M;
}

/* ---------- controle comum ---------- */
export function setPos(M, pos) { M.g.position.set(pos.x, pos.y, pos.z); }
export function mostra(M, v) { M.g.visible = v; }
export function setEscala(M, s) { M.g.scale.setScalar(s); }

// posição da boca no mundo (origem dos sopros elementais)
const _vBoca = new THREE.Vector3();
export function posBoca(M) {
  (M.boca || M.g).getWorldPosition(_vBoca);
  return _vBoca;
}

export function giraDirecao(M, x, z) { if (x !== 0 || z !== 0) M.giro = Math.atan2(x, z); }
export function encara(M, alvoX, alvoZ) {
  giraDirecao(M, alvoX - M.g.position.x, alvoZ - M.g.position.z);
}
export function passoGiro(M, dt) {
  let d = M.giro - M.g.rotation.y;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  M.g.rotation.y += d * Math.min(1, 14 * dt);
}

// vida em repouso: o corpo RESPIRA (infla e desinfla), a cauda abana,
// a cabeça observa e as asas se ajeitam
export function animaIdle(M, t) {
  if (M.gltf) return; // o esqueleto do glTF já respira sozinho (clipes)
  if (M.corpo && M.corpo.userData.s0) {
    const s0 = M.corpo.userData.s0;
    const r = 1 + Math.sin(t * 2.4) * 0.04;
    M.corpo.scale.set(s0.x * (2 - r), s0.y * r, s0.z * (2 - r) * 0.5 + s0.z * 0.5);
  }
  if (M.cauda) {
    M.cauda.rotation.y = Math.sin(t * 3.2) * 0.28;
    M.cauda.rotation.x *= 0.85; // desfaz posições de golpe aos poucos
  }
  if (M.cabeca) {
    M.cabeca.rotation.x = Math.sin(t * 1.6) * 0.05;
    M.cabeca.rotation.y = Math.sin(t * 0.9) * 0.1;
  }
  // chama da cauda tremeluz sempre
  if (M.chama) {
    M.chama.scale.setScalar(0.85 + Math.abs(Math.sin(t * 9)) * 0.3);
    M.chama.rotation.y = t * 2.5;
  }
}

// caminhada das feras — como o domador, mas por tipo de corpo:
// quadrúpedes TROTAM (pares diagonais alternando), bípedes dão passadas
// (pernas e braços em oposição), asas/nadadeiras batem junto
export function animaAndarFera(M, t, movendo) {
  if (M.gltf) { M.g.userData._leanAndar = 0; return; } // clipes Walk/Run cuidam disso
  const a = movendo ? Math.sin(t * 11) * 0.6 : 0;
  if (M.pernas.length === 4) {
    // trote: diagonais juntas (frente-esq + trás-dir vs frente-dir + trás-esq)
    M.pernas[0].rotation.x = a;  M.pernas[3].rotation.x = a;
    M.pernas[1].rotation.x = -a; M.pernas[2].rotation.x = -a;
  } else if (M.pernas.length === 2) {
    M.pernas[0].rotation.x = a;
    M.pernas[1].rotation.x = -a;
  }
  if (movendo) {
    M.g.position.y += Math.abs(Math.sin(t * 11)) * 0.06;
    M.g.userData._leanAndar = 0.12;
    if (M.bracos.length === 2) {
      // braços em oposição às pernas; asas/nadadeiras batem (eixo z)
      M.bracos[0].rotation.x = -a * 0.7;
      M.bracos[1].rotation.x = a * 0.7;
      M.bracos[0].rotation.z = Math.sin(t * 13) * 0.45;
      M.bracos[1].rotation.z = -Math.sin(t * 13) * 0.45;
    }
  } else {
    M.g.userData._leanAndar = 0;
    if (M.bracos.length === 2) {
      M.bracos[0].rotation.x = 0;
      M.bracos[1].rotation.x = 0;
      M.bracos[0].rotation.z = Math.sin(t * 2.4) * 0.12;
      M.bracos[1].rotation.z = -Math.sin(t * 2.4) * 0.12;
    }
  }
}
// balanço de pernas/braços do humano + pulinho
export function animaAndar(M, t, andando) {
  const a = andando ? Math.sin(t * 9) * 0.55 : 0;
  if (M.pernas.length === 2) { M.pernas[0].rotation.x = a; M.pernas[1].rotation.x = -a; }
  if (M.bracos.length === 2) { M.bracos[0].rotation.x = -a * 0.8; M.bracos[1].rotation.x = a * 0.8; }
  if (andando) M.g.position.y += Math.abs(Math.sin(t * 9)) * 0.05;
}

// pose de luta com cabeça viva: rajada/projétil = cabeça recua carregando e
// CUSPINDO para a frente; físico = corpo lançado; cambalhota em 3 fases
// listras da bola-esquiva: meridianos claros para o giro APARECER
// (esfera lisa girando parece parada)
let _texBola = null;
function texturaBola() {
  if (_texBola) return _texBola;
  const c = document.createElement('canvas'); c.width = 64; c.height = 32;
  const x = c.getContext('2d');
  x.fillStyle = '#cfd6de'; x.fillRect(0, 0, 64, 32);
  x.fillStyle = '#ffffff';
  for (let i = 0; i < 4; i++) x.fillRect(i * 16, 0, 7, 32);
  _texBola = new THREE.CanvasTexture(c);
  _texBola.wrapS = THREE.RepeatWrapping;
  return _texBola;
}
const COR_BOLA = { fogo: 0xff8a50, agua: 0x5fb2e8, planta: 0x6fc45f,
                   eletrico: 0xf2d84a, gelo: 0xa8dcef, pedra: 0xb0a284,
                   terra: 0xc2a26a, comum: 0xd8cdb8 };
export function animaLuta(M, f) {
  // POSE DE GOLPE (quadro congelado): durante o ataque, feras COM pose
  // para a categoria trocam o corpo pelo modelo posado — físico gira
  // (investida rolando), poder fica cravado apontando o alvo
  const emAtk = f.estado === 'atk' && f.golpe;
  const catPose = emAtk
    ? (f.golpe.fisico ? 'fisico'
      : (f.golpe.projetil || f.golpe.rajada || f.golpe.feixe) ? 'poder' : null)
    : null;
  const pose = catPose && M.poses && M.poses[catPose];
  const ud0 = M.g.userData;
  if (pose) {
    if (ud0._poseAtiva !== pose) {
      if (ud0._poseAtiva) ud0._poseAtiva.visible = false;
      if (!ud0._corpoPose) {
        ud0._corpoPose = M.g.children.filter((c) =>
          c !== pose && !Object.values(M.poses).includes(c) && c.visible);
      }
      for (const c of ud0._corpoPose) c.visible = false;
      pose.visible = true;
      ud0._poseAtiva = pose;
    }
    // FÍSICO: nada de girar — a pose ATACA. Cada estágio do combo tem a
    // sua cara: 1º golpe reto, 2º espelhado, Final maior e inclinado.
    // E o corpo AVANÇA no tempo ativo (investida do soco)
    if (catPose === 'fisico') {
      const nome = f.golpe.nome || '';
      const estagio = /Final/.test(nome) ? 3 : /x2/.test(nome) ? 2 : 1;
      const escBase = estagio === 3 ? 1.18 : 1;
      pose.scale.set(estagio === 2 ? -escBase : escBase, escBase, escBase);
      pose.rotation.set(0, 0, estagio === 3 ? -0.18 : 0);
      // arco de avanço: cresce na preparação, crava no ativo, recua depois
      const g2 = f.golpe;
      const fase = Math.min(1, f.t / (g2.prep + g2.ativo));
      pose.position.z = Math.sin(fase * Math.PI) * (estagio === 3 ? 0.7 : 0.45);
    } else {
      pose.scale.set(1, 1, 1);
      pose.rotation.set(0, 0, 0);
      pose.position.z = 0;
    }
    return;
  }
  const vaiRolar = f.estado === 'dash' && M.poses && M.poses.rolar;
  if (ud0._poseAtiva && !vaiRolar) {
    ud0._poseAtiva.visible = false;
    for (const c of ud0._corpoPose || []) c.visible = true;
    ud0._poseAtiva = null;
    ud0._corpoPose = null;
  }
  // BOLA-ESQUIVA estilo Sonic: na cambalhota lateral o corpo VIRA uma
  // esfera girando do tamanho da fera; ao sair do dash, volta ao normal.
  // Fera com pose "rolar" (ex.: o casco do Folhito) usa o MODELO dela
  // rolando em vez da esfera genérica listrada
  if (f.estado === 'dash' && M.poses && M.poses.rolar) {
    const ud = M.g.userData;
    const rolar = M.poses.rolar;
    if (ud._poseAtiva !== rolar) {
      if (ud._poseAtiva) ud._poseAtiva.visible = false;
      if (!ud._corpoPose) {
        ud._corpoPose = M.g.children.filter((c) =>
          !Object.values(M.poses).includes(c) && c !== M.bolaEsq && c.visible);
      }
      for (const c of ud._corpoPose) c.visible = false;
      rolar.visible = true;
      ud._poseAtiva = rolar;
    }
    const rel = f.dashRel || { x: 1, z: 0 };
    const ang = f.t * 22;
    if (Math.abs(rel.x) >= Math.abs(rel.z)) rolar.rotation.set(0, 0, rel.x > 0 ? -ang : ang);
    else rolar.rotation.set(rel.z > 0 ? ang : -ang, 0, 0);
    return;
  }
  if (f.estado === 'dash') {
    const ud = M.g.userData;
    if (!M.bolaEsq) {
      const r = Math.max(0.32, (f.esp.altura3d || 1.2) * 0.42);
      M.bolaEsq = new THREE.Mesh(
        new THREE.SphereGeometry(r, 14, 10),
        new THREE.MeshLambertMaterial({ map: texturaBola(),
          color: COR_BOLA[f.esp.tipo] || 0xd8cdb8 }));
      M.bolaEsq.position.y = r * 1.05;
      M.bolaEsq.castShadow = true;
      M.bolaEsq.visible = false;
      M.g.add(M.bolaEsq);
    }
    if (!ud._emBola) {
      ud._corpoOculto = M.g.children.filter((c) => c !== M.bolaEsq && c.visible);
      for (const c of ud._corpoOculto) c.visible = false;
      M.bolaEsq.visible = true;
      ud._emBola = true;
    }
    // gira no eixo do rolamento (lateral = cartwheel, frente/trás = mortal)
    const rel = f.dashRel || { x: 1, z: 0 };
    const ang = f.t * 26;
    if (Math.abs(rel.x) >= Math.abs(rel.z)) {
      M.bolaEsq.rotation.set(0, 0, rel.x > 0 ? -ang : ang);
    } else {
      M.bolaEsq.rotation.set(rel.z > 0 ? ang : -ang, 0, 0);
    }
    M.g.scale.setScalar(1);
    return;
  }
  if (M.g.userData._emBola) {
    for (const c of M.g.userData._corpoOculto || []) c.visible = true;
    if (M.bolaEsq) M.bolaEsq.visible = false;
    M.g.userData._emBola = false;
  }
  if (f.estado !== 'dash' && M.g.userData._emDash) {
    M.g.scale.setScalar(1);
    M.g.userData._emDash = false;
  }
  // PIRUETA AÉREA (cambalhota + pulo): roda 360° acompanhando o VOO inteiro
  // — a fase vem da física (vy vai de +v0 a -v0), então casa com o arco
  if (f.piruetando && f.pos.y > 0.02) {
    const rel = f.dashRel || { x: 0, z: -1 };
    // pirueta para TRÁS com clipe "mortal" (Backflip): o esqueleto anima
    // sozinho — aqui só garantimos escala neutra
    if (rel.z > 0.5 && M.clips && M.clips.mortal) {
      M.g.scale.setScalar(1);
      M.g.rotation.x = 0; M.g.rotation.z = 0;
      M.g.userData._pirueta = true;
      return;
    }
    const v0 = (f.esp.impulso || 7) * 0.95;
    const fase = Math.min(1, Math.max(0, (v0 - f.vy) / (2 * v0)));
    const ang = fase * Math.PI * 2;
    M.g.scale.setScalar(0.82);
    if (Math.abs(rel.x) > Math.abs(rel.z)) {
      M.g.rotation.z = rel.x > 0 ? ang : -ang; M.g.rotation.x = 0;
    } else {
      M.g.rotation.x = rel.z > 0 ? -ang : ang; M.g.rotation.z = 0;
    }
    M.g.userData._pirueta = true;
    return;
  }
  if (M.g.userData._pirueta) {
    M.g.rotation.x = 0; M.g.rotation.z = 0;
    M.g.scale.setScalar(1);
    M.g.userData._pirueta = false;
  }
  // PULO comum: estica subindo, achata ao aterrissar (squash & stretch)
  if (f.estado === 'idle') {
    const noAr = f.pos.y > 0.02;
    const ud = M.g.userData;
    if (noAr) {
      const sy = 1 + 0.09 * Math.max(-0.6, Math.min(1, f.vy / 7));
      M.g.scale.set(1 / Math.sqrt(sy), sy, 1 / Math.sqrt(sy));
      ud._eraAr = true;
    } else {
      if (ud._eraAr) { ud._squash = 0.2; ud._eraAr = false; }
      if (ud._squash > 0.005) {
        M.g.scale.set(1 + ud._squash * 0.6, 1 - ud._squash, 1 + ud._squash * 0.6);
        ud._squash *= 0.8;
      } else if (ud._squash) { ud._squash = 0; M.g.scale.setScalar(1); }
    }
  }
  let rx = M.g.userData._leanAndar || 0;
  if (f.estado === 'dash') {
    M.g.userData._emDash = true;
    const t = Math.min(1, f.t / 0.28);
    const rel = f.dashRel || { x: 0, z: -1 };
    let rz = 0;
    rx = 0;
    if (t < 0.2) {
      const k = t / 0.2;
      M.g.scale.set(1 + 0.18 * k, 1 - 0.38 * k, 1 + 0.18 * k);
    } else if (t < 0.85) {
      M.g.scale.setScalar(0.72);
      const giro = ((t - 0.2) / 0.65) * Math.PI * 2;
      // cambalhota lateral roda ACOMPANHANDO o deslocamento (direita = roda
      // para a direita); frente/trás já estavam certos
      if (Math.abs(rel.x) > Math.abs(rel.z)) rz = rel.x > 0 ? giro : -giro;
      else rx = rel.z > 0 ? -giro : giro;
    } else {
      const k = (t - 0.85) / 0.15;
      M.g.scale.setScalar(0.72 + 0.28 * k);
    }
    M.g.rotation.x = rx;
    M.g.rotation.z = rz;
    return;
  }
  if (f.estado === 'atk' && f.golpe) {
    // modelo glTF com clipes: o GOLPE é atuado pelo esqueleto — nenhuma
    // pose procedural por cima (o "giro 360 do forte" virava pião durante
    // o kame do Raio Esmeralda!)
    if (M.gltf && M.clips && M.clipAtual) {
      M.g.rotation.x = 0;
      M.g.rotation.z = 0;
      return;
    }
    const g = f.golpe;
    const cab = M.cabeca;
    if (g.rajada) {
      // agacha plantando as patas, rabo empinado, e cospe tremendo
      if (f.t < g.prep) {
        rx = -0.3 * (f.t / g.prep);
        M.g.position.y -= 0.06 * (f.t / g.prep);
        if (cab) cab.rotation.x = -0.55 * (f.t / g.prep); // inspira fundo
        if (M.cauda) M.cauda.rotation.x = -0.6 * (f.t / g.prep);
      } else {
        rx = -0.12;
        M.g.position.y -= 0.06;
        if (cab) cab.rotation.x = 0.35 + Math.sin(f.t * 50) * 0.06; // cospe tremendo
        if (M.cauda) M.cauda.rotation.x = -0.6;
        M.g.rotation.z = Math.sin(f.t * 45) * 0.08;
      }
    } else if (g.projetil) {
      // carrega recuando e SALTA no disparo, com chicote de cabeça
      if (f.t < g.prep) {
        rx = -0.45 * (f.t / g.prep);
        if (cab) cab.rotation.x = -0.5 * (f.t / g.prep);
      } else if (f.t < g.prep + g.ativo + 0.12) {
        const k = (f.t - g.prep) / (g.ativo + 0.12);
        rx = 0.3;
        M.g.position.y += Math.sin(k * Math.PI) * 0.2; // pulinho do disparo
        if (cab) cab.rotation.x = 0.45;
      } else if (cab) cab.rotation.x = 0;
    } else if (g.forte && f.esp.velocidade >= 4.5) {
      // físico FORTE de fera RÁPIDA: giro completo de 360° durante o bote
      const total = g.prep + g.ativo;
      const k = Math.min(1, f.t / total);
      M.g.rotation.y += k * Math.PI * 2;
      if (f.t < g.prep) rx = -0.4 * (f.t / g.prep);
      else if (f.t < total) { rx = 0.7; if (cab) cab.rotation.x = 0.25; }
      else { rx = 0.5 * (1 - Math.min(1, (f.t - total) / g.recup)); if (cab) cab.rotation.x = 0; }
    } else if (g.forte) {
      // fera pesada: sem pirueta — bote troncudo, mergulhando com o corpo
      const total = g.prep + g.ativo;
      if (f.t < g.prep) rx = -0.55 * (f.t / g.prep);
      else if (f.t < total) { rx = 0.85; if (cab) cab.rotation.x = 0.35; }
      else { rx = 0.6 * (1 - Math.min(1, (f.t - total) / g.recup)); if (cab) cab.rotation.x = 0; }
    } else {
      // físico normal: bote com pulinho
      if (f.t < g.prep) rx = -0.4 * (f.t / g.prep);
      else if (f.t < g.prep + g.ativo) {
        const k = (f.t - g.prep) / g.ativo;
        rx = 0.5;
        M.g.position.y += Math.sin(k * Math.PI) * 0.22;
        if (cab) cab.rotation.x = 0.25;
      }
      else { rx = 0.5 * (1 - Math.min(1, (f.t - g.prep - g.ativo) / g.recup)); if (cab) cab.rotation.x = 0; }
    }
  } else if (f.estado === 'hurt') {
    rx = -0.55 * (1 - Math.min(1, f.t / 0.26));
    if (M.cabeca) M.cabeca.rotation.x = -0.3;
  } else if (f.pos.y > 0.05 && f.esp.velocidade >= 4.8) {
    // fera ágil dá um MORTAL no salto: a fração do voo vem da velocidade
    // vertical (decola +impulso, ápice 0, pousa -impulso)
    const imp = f.esp.impulso || 7;
    const frac = Math.max(0, Math.min(1, (imp - f.vy) / (2 * imp)));
    rx = -frac * Math.PI * 2;
  }
  M.g.rotation.x = rx;
}

export function flashCor(M, hex) {
  for (const mat of M.materiais) mat.emissive.setHex(hex || 0x000000);
}
export function setOpacidade(M, o) {
  for (const mat of M.materiais) { mat.transparent = o < 1; mat.opacity = o; }
}
