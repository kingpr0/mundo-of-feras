// SPRITES — pixel art vira textura; billboards com sombra recortada.
import * as THREE from 'three';

const PAL = {
  pS: { c:'#2ea6a6',C:'#1d7a7a',h:'#6b4a2f',s:'#f2c096',e:'#26202e',t:'#ffd23f',b:'#d9553f',p:'#3a5bd9',k:'#33313d' },
  pF: { c:'#2ea6a6',C:'#1d7a7a',s:'#f2c096',e:'#26202e',t:'#ffd23f',p:'#3a5bd9',k:'#33313d' },
  bra:{ o:'#ff8a3d',d:'#d1462f',y:'#ffd93b',w:'#fff3da',k:'#26202e' },
  cas:{ g:'#9aa3ad',G:'#6e7680',r:'#8a6a50',k:'#26202e',w:'#f4efe6' },
  orb:{ a:'#59e0d0',A:'#1f9b8e',w:'#ffffff' },
};
const CORPO_PS = [
"................","......cccc......",".....cccccc.....",".....CCCCCCC....",
".....hssse......",".....ssssss.....","......ssss......","....bttttt......",
"...bbtttttts....","...bbtttttts....","....bttttt......"];
const PERNAS = {
  parado:[".....pppp.......",".....p..p.......",".....p..p.......","....kk..kk......","................"],
  a1:[".....pppp.......",".....p...p......","....p.....p.....","...kk......kk...","................"],
  a2:[".....pppp.......","......pp........","......pp........",".....kkk........","................"],
  a3:[".....pppp.......",".....p...p......","....p....p......","...kk.....kk....","................"],
};
const MAPA_PF = [
"................",".....cccccc.....","....cccccccc....","....CCCCCCCC....",
"....ssssssss....","....sesssses....","....ssssssss....",".....ssss.......",
"....tttttttt....","...stttttttts...","...stttttttts...","....tttttttt....",
"....pppppppp....","....ppp..ppp....","...kkk....kkk...","................"];
const MAPA_BRA = [
"................","......d...d.....","......dd.dd.....",".yy...ooooo.....",
"yyy..ooooooo....",".dy..ookoooo....","..d..ooooooww...","..dd.ooooooww...",
"...ddooooooo....","....dooowwoo....",".....ooowwoo....",".....oooooo.....",
"......o..oo.....","......d...d.....","................","................"];
const MAPA_CAS = [
"................","....GG..GG......","...GGGGGGGG.....","..GgggggggG.....",
"..Ggggkgggg.....","..GgggggggggG...",".GGgggggggwww...",".GgggggggggG....",
".Gggggggggg.....","..Grrrrrrrg.....","..grrrrrrrr.....","..gg.gg.gg......",
"..GG.GG.GG......","................","................","................"];
const MAPA_ORB = [
"..AAAA..",".AaaaaA.","AaawwaaA","AaaaaaaA","AaaaaaaA",".AaaaaA.","..AAAA..","........"];
const LINHA_VAZIA = "................";

export function texDoMapa(mapa, pal) {
  const w = mapa[0].length, h = mapa.length;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d');
  for (let r = 0; r < h; r++) for (let q = 0; q < w; q++) {
    const ch = mapa[r][q]; if (ch === '.') continue;
    x.fillStyle = pal[ch] || '#f0f'; x.fillRect(q, r, 1, 1);
  }
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
  return t;
}

export const TEX = {
  pParado: texDoMapa(CORPO_PS.concat(PERNAS.parado), PAL.pS),
  pA1: texDoMapa(CORPO_PS.concat(PERNAS.a1), PAL.pS),
  pA2: texDoMapa(CORPO_PS.slice(1).concat(PERNAS.a2, [LINHA_VAZIA]), PAL.pS),
  pA3: texDoMapa(CORPO_PS.concat(PERNAS.a3), PAL.pS),
  pFrente: texDoMapa(MAPA_PF, PAL.pF),
  brasinha: texDoMapa(MAPA_BRA, PAL.bra),
  cascorro: texDoMapa(MAPA_CAS, PAL.cas),
  cristal: texDoMapa(MAPA_ORB, PAL.orb),
};
export const QUADROS_ANDAR = [TEX.pA1, TEX.pA2, TEX.pA3, TEX.pA2];

export function fazSprite(scene, tex, altura, sombra = true) {
  const mat = new THREE.MeshLambertMaterial({
    map: tex, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(altura, altura), mat);
  m.castShadow = sombra;
  m.customDepthMaterial = new THREE.MeshDepthMaterial({
    depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: 0.5 });
  m.position.y = altura / 2;
  const g = new THREE.Group(); g.add(m); scene.add(g);
  return { g, m, mat, altura };
}

export function trocaTex(spr, tex) {
  if (spr.mat.map === tex) return;
  spr.mat.map = tex; spr.mat.needsUpdate = true;
  spr.m.customDepthMaterial.map = tex;
  spr.m.customDepthMaterial.needsUpdate = true;
}

export function billboard(spr, camera, flip = false) {
  const m = spr.g;
  m.rotation.y = Math.atan2(camera.position.x - m.position.x, camera.position.z - m.position.z);
  spr.m.scale.x = flip ? -1 : 1;
}

export function setPos(spr, pos) { spr.g.position.set(pos.x, pos.y, pos.z); }
