// MODELOS — personagens e feras em 3D low-poly chibi, construídos por código.
// Feras 2.0: cada modelo tem CABEÇA e CAUDA articuladas (grupos próprios) e um
// marcador de BOCA — de onde saem os sopros elementais. Render puro.
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
  // patas ARTICULADAS com "meias" escuras (pivô no quadril, para trotar)
  for (const [x, z] of [[-0.16, 0.16], [0.16, 0.16], [-0.16, -0.28], [0.16, -0.28]]) {
    const quadril = grupoEm(M, x, 0.26, z);
    parte(M, quadril, new THREE.CylinderGeometry(0.06, 0.06, 0.16, 8), COR.laranja, 0, -0.1, 0);
    parte(M, quadril, new THREE.CylinderGeometry(0.065, 0.07, 0.08, 8), COR.vermelhoEscuro, 0, -0.21, 0);
    M.pernas.push(quadril);
  }
  return M;
}

function criarCascorro(scene) {
  const M = novoModelo(scene, 1.1);
  const g = M.g;
  parte(M, g, new THREE.BoxGeometry(0.75, 0.5, 0.95), COR.cinza, 0, 0.44, -0.05);
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
  const M = novoModelo(scene, 1.2);
  const g = M.g;
  const laranja = 0xf08030, creme = 0xffe9c4;
  const corpo = parte(M, g, new THREE.SphereGeometry(0.32, 18, 14), laranja, 0, 0.52, 0);
  corpo.scale.set(1, 1.18, 0.95);
  const barriga = parte(M, g, new THREE.SphereGeometry(0.25, 14, 12), creme, 0, 0.48, 0.15);
  barriga.scale.set(1.0, 1.25, 0.55);
  // CABEÇA articulada
  const cab = grupoEm(M, 0, 1.12, 0.03);
  M.cabeca = cab;
  parte(M, cab, new THREE.SphereGeometry(0.29, 18, 14), laranja, 0, 0, 0);
  const focinho = parte(M, cab, new THREE.SphereGeometry(0.18, 14, 10), laranja, 0, -0.1, 0.23);
  focinho.scale.set(1.15, 0.72, 1.1);
  parte(M, cab, new THREE.SphereGeometry(0.022, 6, 6), COR.olho, -0.06, -0.03, 0.39);
  parte(M, cab, new THREE.SphereGeometry(0.022, 6, 6), COR.olho, 0.06, -0.03, 0.39);
  for (const lado of [-1, 1]) {
    parte(M, cab, new THREE.SphereGeometry(0.08, 10, 8), 0xffffff, lado * 0.13, 0.1, 0.17);
    parte(M, cab, new THREE.SphereGeometry(0.042, 8, 6), COR.olho, lado * 0.13, 0.1, 0.24);
  }
  marcaBoca(M, cab, 0, -0.16, 0.38);
  // braços e pernas ARTICULADOS (ombro e quadril como pivôs)
  for (const lado of [-1, 1]) {
    const ombro = grupoEm(M, lado * 0.28, 0.7, 0.06);
    const braco = parte(M, ombro, new THREE.CylinderGeometry(0.06, 0.055, 0.26, 8), laranja, lado * 0.03, -0.08, 0.05);
    braco.rotation.z = lado * 0.7; braco.rotation.x = -0.4;
    parte(M, ombro, new THREE.SphereGeometry(0.065, 8, 8), laranja, lado * 0.12, -0.15, 0.12);
    M.bracos.push(ombro);
    const quadril = grupoEm(M, lado * 0.17, 0.28, 0);
    parte(M, quadril, new THREE.SphereGeometry(0.14, 10, 8), laranja, 0, -0.08, 0);
    parte(M, quadril, new THREE.BoxGeometry(0.2, 0.1, 0.3), laranja, 0, -0.23, 0.08);
    for (const dg of [-0.06, 0, 0.06]) {
      const garra = parte(M, quadril, new THREE.ConeGeometry(0.028, 0.09, 6), 0xfff6df, dg, -0.23, 0.25);
      garra.rotation.x = Math.PI / 2;
    }
    M.pernas.push(quadril);
  }
  // CAUDA articulada com a chama em três camadas
  const cauda = grupoEm(M, 0, 0.44, -0.3);
  M.cauda = cauda;
  const c1 = parte(M, cauda, new THREE.ConeGeometry(0.15, 0.5, 10), laranja, 0, 0, -0.1);
  c1.rotation.x = -2.3;
  parte(M, cauda, new THREE.SphereGeometry(0.1, 10, 8), laranja, 0, 0.24, -0.32);
  const c2 = parte(M, cauda, new THREE.CylinderGeometry(0.07, 0.1, 0.3, 8), laranja, 0, 0.41, -0.36);
  c2.rotation.x = 0.3;
  const chamaExt = parte(M, cauda, new THREE.ConeGeometry(0.16, 0.42, 10), 0xff5a2a, 0, 0.76, -0.4);
  const chamaMeio = parte(M, cauda, new THREE.ConeGeometry(0.11, 0.3, 8), 0xff9a3d, 0, 0.8, -0.4);
  const chamaMiolo = parte(M, cauda, new THREE.ConeGeometry(0.055, 0.18, 8), 0xffe066, 0, 0.84, -0.4);
  chamaExt.material.emissive.setHex(0x882200);
  chamaMeio.material.emissive.setHex(0x883300);
  chamaMiolo.material.emissive.setHex(0x886600);
  M.materiais.splice(-3, 3);
  return M;
}

const FABRICAS = { brasinha: criarBrasinha, cascorro: criarCascorro, voltim: criarVoltim, gotim: criarGotim, salamandro: criarSalamandro };
export function criarFera(scene, chave) {
  const fabrica = FABRICAS[chave];
  return fabrica ? fabrica(scene) : criarCascorro(scene);
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
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.26), mat);
  m.castShadow = true; M.materiais.push(mat); M.g.add(m);
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

// vida em repouso: cauda abana, cabeça observa, asas se ajeitam
export function animaIdle(M, t) {
  if (M.cauda) M.cauda.rotation.y = Math.sin(t * 3.2) * 0.28;
  if (M.cabeca) {
    M.cabeca.rotation.x = Math.sin(t * 1.6) * 0.05;
    M.cabeca.rotation.y = Math.sin(t * 0.9) * 0.1;
  }
}

// caminhada das feras — como o domador, mas por tipo de corpo:
// quadrúpedes TROTAM (pares diagonais alternando), bípedes dão passadas
// (pernas e braços em oposição), asas/nadadeiras batem junto
export function animaAndarFera(M, t, movendo) {
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
export function animaLuta(M, f) {
  if (f.estado !== 'dash' && M.g.userData._emDash) {
    M.g.scale.setScalar(1);
    M.g.userData._emDash = false;
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
      if (Math.abs(rel.x) > Math.abs(rel.z)) rz = rel.x > 0 ? -giro : giro;
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
    const g = f.golpe;
    const cab = M.cabeca;
    if (g.rajada) {
      if (f.t < g.prep) {
        rx = -0.3 * (f.t / g.prep);
        if (cab) cab.rotation.x = -0.55 * (f.t / g.prep); // inspira fundo
      } else {
        rx = -0.12;
        if (cab) cab.rotation.x = 0.35 + Math.sin(f.t * 50) * 0.06; // cospe tremendo
        M.g.rotation.z = Math.sin(f.t * 45) * 0.08;
      }
    } else if (g.projetil) {
      if (f.t < g.prep) {
        rx = -0.45 * (f.t / g.prep);
        if (cab) cab.rotation.x = -0.5 * (f.t / g.prep);
      } else if (f.t < g.prep + g.ativo + 0.12) {
        rx = 0.3;
        if (cab) cab.rotation.x = 0.45; // chicote da cabeça no disparo
      } else if (cab) cab.rotation.x = 0;
    } else {
      if (f.t < g.prep) rx = -0.4 * (f.t / g.prep);
      else if (f.t < g.prep + g.ativo) { rx = g.forte ? 0.7 : 0.5; if (cab) cab.rotation.x = 0.25; }
      else { rx = 0.5 * (1 - Math.min(1, (f.t - g.prep - g.ativo) / g.recup)); if (cab) cab.rotation.x = 0; }
    }
  } else if (f.estado === 'hurt') {
    rx = -0.55 * (1 - Math.min(1, f.t / 0.26));
    if (M.cabeca) M.cabeca.rotation.x = -0.3;
  }
  M.g.rotation.x = rx;
}

export function flashCor(M, hex) {
  for (const mat of M.materiais) mat.emissive.setHex(hex || 0x000000);
}
export function setOpacidade(M, o) {
  for (const mat of M.materiais) { mat.transparent = o < 1; mat.opacity = o; }
}
