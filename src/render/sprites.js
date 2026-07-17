// SPRITES — pixel art vira textura; billboards com sombra recortada.
// Domador em proporção chibi (cabeça grande, corpo pequeno): leitura clara
// de longe com a câmera afastada e mais carisma, mantendo o pixel art HD-2D.
import * as THREE from 'three';

const PAL = {
  pS: { c:'#3fc5ba',C:'#2a8f88',h:'#6b4a2f',s:'#ffd9b0',e:'#26202e',w:'#ffffff',t:'#ffcf4d',b:'#e05a41',p:'#4a68e0',k:'#33313d' },
  bra:{ o:'#ff8a3d',d:'#d1462f',y:'#ffd93b',w:'#fff3da',k:'#26202e' },
  cas:{ g:'#9aa3ad',G:'#6e7680',r:'#8a6a50',k:'#26202e',w:'#f4efe6' },
  vol:{ y:'#ffd93b',Y:'#e8a91d',o:'#ff8a3d',k:'#26202e',w:'#fff3da',z:'#7fe3ff' },
  orb:{ a:'#59e0d0',A:'#1f9b8e',w:'#ffffff' },
};

// Domador de lado (andando para a direita) — 20x20 (corpo 15 + pernas 5)
const CORPO_LADO = [
"....................",
"......cccccc........",
".....cccccccc.......",
"....cccccccccc......",
"....CCCCCCCCCCC.....",
"....hhssssssss......",
"....hhssssswes......",
"....hhssssswes......",
"....hhssssssss......",
".....hsssssss.......",
"......ssssss........",
".......bbbb.........",
"......tttttts.......",
"......tttttts.......",
".......tttt.........",
];
const PERNAS = {
  parado:[
".......pppp.........",
".......p..p.........",
".......p..p.........",
"......kk..kk........",
"....................",
  ],
  a1:[
".......pppp.........",
".......p...p........",
"......p.....p.......",
".....kk......kk.....",
"....................",
  ],
  a2:[
".......pppp.........",
"........pp..........",
"........pp..........",
".......kkk..........",
"....................",
  ],
  a3:[
".......pppp.........",
".......p...p........",
"......p....p........",
".....kk.....kk......",
"....................",
  ],
};
// Domador de frente — 20x20
const MAPA_PF = [
"....................",
"......cccccccc......",
".....cccccccccc.....",
"....CCCCCCCCCCCC....",
"....ssssssssssss....",
"....sswesssswess....",
"....sswesssswess....",
"....ssssssssssss....",
".....ssssssssss.....",
"......ssssssss......",
".....bbbbbbbbbb.....",
"....stttttttttts....",
"....stttttttttts....",
".....tttttttttt.....",
"......pppppppp......",
"......ppp..ppp......",
"......ppp..ppp......",
".....kkk....kkk.....",
"....................",
"....................",
];
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
// Voltim, o pintinho-faísca (GDD §7): frágil e velocíssimo — 16x16
const MAPA_VOL = [
"................",
".....y..y.......",
".....yyyy.......",
"...yyyyyyyyy..z.",
"..yyyyyyyyyyy...",
"..ykyyyyykyyy...",
"..yyyyooyyyyy...",
"..Yyyyyyyyyyy...",
"..Yyywwwwyyy....",
"...yywwwwyy..z..",
"....yyyyyy......",
".....o..o.......",
"....oo..oo......",
"................",
"................",
"................"];
const MAPA_ORB = [
"..AAAA..",".AaaaaA.","AaawwaaA","AaaaaaaA","AaaaaaaA",".AaaaaA.","..AAAA..","........"];
const LINHA_VAZIA = "....................";

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
  pParado: texDoMapa(CORPO_LADO.concat(PERNAS.parado), PAL.pS),
  pA1: texDoMapa(CORPO_LADO.concat(PERNAS.a1), PAL.pS),
  pA2: texDoMapa(CORPO_LADO.slice(1).concat(PERNAS.a2, [LINHA_VAZIA]), PAL.pS),
  pA3: texDoMapa(CORPO_LADO.concat(PERNAS.a3), PAL.pS),
  pFrente: texDoMapa(MAPA_PF, PAL.pS),
  brasinha: texDoMapa(MAPA_BRA, PAL.bra),
  cascorro: texDoMapa(MAPA_CAS, PAL.cas),
  voltim: texDoMapa(MAPA_VOL, PAL.vol),
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
