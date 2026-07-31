// Kit de cirurgia GLB: ler/escrever, enxugar texturas, copiar animações
// entre arquivos do mesmo rig e GERAR animações procedurais por keyframes.
// Usado pelos scripts processa-treinadores.mjs e processa-feras.mjs.
import { readFileSync, writeFileSync } from 'node:fs';
import * as THREE from 'three';
import Jimp from 'jimp';

/* ---------- leitura / escrita ---------- */
export function leGlb(caminho) {
  const b = readFileSync(caminho);
  if (b.readUInt32LE(0) !== 0x46546c67) throw new Error('não é glb');
  const tamJson = b.readUInt32LE(12);
  const json = JSON.parse(b.subarray(20, 20 + tamJson).toString());
  const inicioBin = 20 + tamJson + 8;
  const tamBin = b.readUInt32LE(20 + tamJson);
  const bin = b.subarray(inicioBin, inicioBin + tamBin);
  return { json, bin };
}

export function escreveGlb(caminho, json, bin) {
  let jsonBuf = Buffer.from(JSON.stringify(json));
  while (jsonBuf.length % 4) jsonBuf = Buffer.concat([jsonBuf, Buffer.from(' ')]);
  let binBuf = bin;
  while (binBuf.length % 4) binBuf = Buffer.concat([binBuf, Buffer.alloc(1)]);
  const total = 12 + 8 + jsonBuf.length + 8 + binBuf.length;
  const cab = Buffer.alloc(12 + 8);
  cab.writeUInt32LE(0x46546c67, 0); cab.writeUInt32LE(2, 4); cab.writeUInt32LE(total, 8);
  cab.writeUInt32LE(jsonBuf.length, 12); cab.writeUInt32LE(0x4e4f534a, 16);
  const cabBin = Buffer.alloc(8);
  cabBin.writeUInt32LE(binBuf.length, 0); cabBin.writeUInt32LE(0x004e4942, 4);
  writeFileSync(caminho, Buffer.concat([cab, jsonBuf, cabBin, binBuf]));
}

export function dadosBufferView(glb, ibv) {
  const bv = glb.json.bufferViews[ibv];
  return glb.bin.subarray(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength);
}

/* ---------- reconstrução: só o que é usado sobrevive ---------- */
// Remove texturas que não sejam baseColor, re-encoda a baseColor (máx 1024),
// e reempacota o BIN mantendo apenas bufferViews referenciados.
export async function enxuga(glb, { ladoMax = 1024, qualidade = 78 } = {}) {
  const { json } = glb;
  // 1. materiais: só baseColor (e some com o resto)
  for (const mt of json.materials || []) {
    delete mt.normalTexture; delete mt.occlusionTexture; delete mt.emissiveTexture;
    if (mt.pbrMetallicRoughness) {
      delete mt.pbrMetallicRoughness.metallicRoughnessTexture;
      mt.pbrMetallicRoughness.metallicFactor = 0;
      mt.pbrMetallicRoughness.roughnessFactor = 1;
    }
  }
  // 2. texturas usadas
  const texUsadas = new Set();
  for (const mt of json.materials || []) {
    const bct = mt.pbrMetallicRoughness && mt.pbrMetallicRoughness.baseColorTexture;
    if (bct) texUsadas.add(bct.index);
  }
  const novoTex = [], novoImg = [], mapaTex = new Map();
  for (const it of texUsadas) {
    const tex = json.textures[it];
    const img = json.images[tex.source];
    let dados = Buffer.from(dadosBufferView(glb, img.bufferView));
    const j = await Jimp.read(dados);
    if (j.getWidth() > ladoMax || j.getHeight() > ladoMax) j.resize(ladoMax, Jimp.AUTO);
    dados = await j.quality(qualidade).getBufferAsync(Jimp.MIME_JPEG);
    mapaTex.set(it, novoTex.length);
    novoTex.push({ sampler: tex.sampler, source: novoImg.length });
    novoImg.push({ mimeType: 'image/jpeg', _dados: dados });
  }
  for (const mt of json.materials || []) {
    const bct = mt.pbrMetallicRoughness && mt.pbrMetallicRoughness.baseColorTexture;
    if (bct) bct.index = mapaTex.get(bct.index);
  }
  json.textures = novoTex; json.images = novoImg;

  // 3. reempacota o BIN: acessores + imagens novas
  const pedacos = []; let off = 0;
  const novoBVs = [];
  const alinha = () => { while (off % 4) { pedacos.push(Buffer.alloc(1)); off += 1; } };
  const bvDe = (buf, extras = {}) => {
    alinha();
    pedacos.push(buf); const idx = novoBVs.length;
    novoBVs.push({ buffer: 0, byteOffset: off, byteLength: buf.length, ...extras });
    off += buf.length; return idx;
  };
  const mapaBV = new Map();
  for (const acc of json.accessors || []) {
    if (acc.bufferView === undefined) continue;
    if (!mapaBV.has(acc.bufferView)) {
      const bvVelho = json.bufferViews[acc.bufferView];
      const extras = {};
      if (bvVelho.byteStride) extras.byteStride = bvVelho.byteStride;
      if (bvVelho.target) extras.target = bvVelho.target;
      mapaBV.set(acc.bufferView, bvDe(Buffer.from(dadosBufferView(glb, acc.bufferView)), extras));
    }
    acc.bufferView = mapaBV.get(acc.bufferView);
  }
  for (const img of json.images) {
    img.bufferView = bvDe(img._dados);
    delete img._dados;
  }
  json.bufferViews = novoBVs;
  json.buffers = [{ byteLength: off }];
  glb.bin = Buffer.concat(pedacos);
  return glb;
}

/* ---------- animação: infraestrutura de acessores ---------- */
export function poeAcessor(glb, floats, tipo) {
  const buf = Buffer.from(new Float32Array(floats).buffer);
  let off = glb.bin.length;
  while (off % 4) { glb.bin = Buffer.concat([glb.bin, Buffer.alloc(1)]); off++; }
  glb.bin = Buffer.concat([glb.bin, buf]);
  const comp = { SCALAR: 1, VEC3: 3, VEC4: 4 }[tipo];
  glb.json.bufferViews.push({ buffer: 0, byteOffset: off, byteLength: buf.length });
  const acc = {
    bufferView: glb.json.bufferViews.length - 1,
    componentType: 5126, count: floats.length / comp, type: tipo,
  };
  if (tipo === 'SCALAR') { acc.min = [Math.min(...floats)]; acc.max = [Math.max(...floats)]; }
  glb.json.accessors.push(acc);
  glb.json.buffers[0].byteLength = glb.bin.length;
  return glb.json.accessors.length - 1;
}

// monta um clipe a partir de faixas {no, path, tempos, valores(flat), tipo}
export function poeClipe(glb, nome, faixas) {
  const anim = { name: nome, channels: [], samplers: [] };
  for (const f of faixas) {
    const accT = poeAcessor(glb, f.tempos, 'SCALAR');
    const accV = poeAcessor(glb, f.valores, f.path === 'rotation' ? 'VEC4' : 'VEC3');
    anim.samplers.push({ input: accT, output: accV, interpolation: 'LINEAR' });
    anim.channels.push({ sampler: anim.samplers.length - 1, target: { node: f.no, path: f.path } });
  }
  glb.json.animations = glb.json.animations || [];
  glb.json.animations.push(anim);
}

/* ---------- copiar animação de outro glb (mesmo rig, casando por NOME) --- */
export function copiaAnimacao(destino, origem, idxAnim, novoNome) {
  const anim = origem.json.animations[idxAnim];
  const nomePorNo = origem.json.nodes.map((n) => n.name);
  const noPorNome = new Map(destino.json.nodes.map((n, i) => [n.name, i]));
  const faixas = [];
  for (let c = 0; c < anim.channels.length; c++) {
    const ch = anim.channels[c];
    const alvo = noPorNome.get(nomePorNo[ch.target.node]);
    if (alvo === undefined) continue;
    const smp = anim.samplers[ch.sampler];
    const lerAcc = (ia) => {
      const acc = origem.json.accessors[ia];
      const dados = dadosBufferView(origem, acc.bufferView);
      const comp = { SCALAR: 1, VEC3: 3, VEC4: 4 }[acc.type];
      const off = acc.byteOffset || 0;
      return Array.from(new Float32Array(dados.buffer, dados.byteOffset + off, acc.count * comp));
    };
    faixas.push({ no: alvo, path: ch.target.path, tempos: lerAcc(smp.input),
      valores: lerAcc(smp.output), tipo: origem.json.accessors[smp.output].type });
  }
  poeClipe(destino, novoNome, faixas);
}

/* ---------- esqueleto: mundo, cadeias e classificação ---------- */
export function analisaEsqueleto(glb) {
  const { json } = glb;
  const nos = json.nodes;
  const pai = new Array(nos.length).fill(-1);
  nos.forEach((n, i) => (n.children || []).forEach((c) => { pai[c] = i; }));
  const joints = new Set((json.skins || []).flatMap((s) => s.joints));

  const local = nos.map((n) => {
    const m = new THREE.Matrix4();
    if (n.matrix) m.fromArray(n.matrix);
    else m.compose(
      new THREE.Vector3(...(n.translation || [0, 0, 0])),
      new THREE.Quaternion(...(n.rotation || [0, 0, 0, 1])),
      new THREE.Vector3(...(n.scale || [1, 1, 1])),
    );
    return m;
  });
  const mundo = new Array(nos.length);
  const calcMundo = (i) => {
    if (mundo[i]) return mundo[i];
    mundo[i] = pai[i] >= 0
      ? new THREE.Matrix4().multiplyMatrices(calcMundo(pai[i]), local[i])
      : local[i].clone();
    return mundo[i];
  };
  nos.forEach((_, i) => calcMundo(i));
  const posM = (i) => new THREE.Vector3().setFromMatrixPosition(mundo[i]);

  // raiz do esqueleto: joint cujo pai não é joint
  const raiz = [...joints].find((j) => !joints.has(pai[j]));
  // caixa do esqueleto (mundo)
  const caixa = new THREE.Box3();
  for (const j of joints) caixa.expandByPoint(posM(j));
  const altura = Math.max(0.001, caixa.max.y - caixa.min.y);

  return { nos, pai, joints, local, mundo, posM, raiz, caixa, altura };
}

// classifica as cadeias-filhas do tronco: perna / cauda / pescoço / lateral
export function classificaCadeias(sk) {
  const { nos, joints, posM, raiz, altura } = sk;
  const filhosJ = (i) => (nos[i].children || []).filter((c) => joints.has(c));
  // tronco = raiz + descendentes "centrais" (|x| pequeno) próximos da raiz
  const tronco = [raiz];
  let atual = raiz;
  for (let k = 0; k < 3; k++) {
    const fs = filhosJ(atual).filter((c) => Math.abs(posM(c).x - posM(raiz).x) < altura * 0.18);
    if (!fs.length) break;
    atual = fs[0]; tronco.push(atual);
  }
  const pontaCadeia = (ini) => { // ponto mais fundo da subárvore
    let melhor = posM(ini), maisFundo = 0;
    const anda = (i, prof) => {
      if (prof > maisFundo) { maisFundo = prof; melhor = posM(i); }
      for (const c of filhosJ(i)) anda(c, prof + 1);
    };
    anda(ini, 0);
    return melhor;
  };
  const cadeias = [];
  for (const t of tronco) {
    for (const c of filhosJ(t)) {
      if (tronco.includes(c)) continue;
      const a = posM(c), b = pontaCadeia(c);
      const d = new THREE.Vector3().subVectors(b, a);
      let tipoC;
      if (d.y < -altura * 0.18) tipoC = 'perna';
      else if (d.y > altura * 0.22) tipoC = 'pescoco';
      else if (Math.abs(d.x) > Math.abs(d.z)) tipoC = 'lateral';
      else tipoC = 'cauda';
      cadeias.push({ no: c, tipo: tipoC, ladoX: Math.sign(posM(c).x - posM(raiz).x) || 1, dir: d });
    }
  }
  // frente do bicho: oposta à cauda; se não há cauda, direção do pescoço
  const cauda = cadeias.find((c) => c.tipo === 'cauda');
  const pesc = cadeias.find((c) => c.tipo === 'pescoco');
  let frenteZ = 1;
  if (cauda) frenteZ = -Math.sign(cauda.dir.z || -1);
  else if (pesc && Math.abs(pesc.dir.z) > 0.05) frenteZ = Math.sign(pesc.dir.z);
  return { tronco, cadeias, frenteZ };
}

/* ---------- deltas em espaço de MUNDO viram keyframes locais ---------- */
// prepara um "animador" para um nó: gira/move no mundo, grava local
export function animadorDoNo(sk, i) {
  const { pai, local, mundo } = sk;
  const restL = { t: new THREE.Vector3(), r: new THREE.Quaternion(), s: new THREE.Vector3() };
  local[i].decompose(restL.t, restL.r, restL.s);
  const rotPaiM = new THREE.Quaternion();
  if (pai[i] >= 0) mundo[pai[i]].decompose(new THREE.Vector3(), rotPaiM, new THREE.Vector3());
  const invPai = rotPaiM.clone().invert();
  return {
    rest: restL,
    // rotação delta no espaço do MUNDO -> quaternion local absoluto
    rot: (qMundo) => new THREE.Quaternion().copy(invPai).multiply(qMundo).multiply(rotPaiM).multiply(restL.r),
    // deslocamento delta no espaço do MUNDO -> translação local absoluta
    mov: (vMundo) => restL.t.clone().add(vMundo.clone().applyQuaternion(invPai)),
    esc: (fator) => restL.s.clone().multiplyScalar(fator),
  };
}

export const eixoX = new THREE.Vector3(1, 0, 0);
export const eixoY = new THREE.Vector3(0, 1, 0);
export const eixoZ = new THREE.Vector3(0, 0, 1);
export const giro = (eixo, ang) => new THREE.Quaternion().setFromAxisAngle(eixo, ang);

// amostra uma função de tempo -> {rot?/mov?/esc?} em N quadros e vira faixas
export function amostraFaixas(sk, no, dur, quadros, fn) {
  const an = animadorDoNo(sk, no);
  const tempos = [], rots = [], movs = [], escs = [];
  let temR = false, temM = false, temE = false;
  for (let q = 0; q <= quadros; q++) {
    const t = (q / quadros) * dur;
    tempos.push(t);
    const st = fn(t / dur, t) || {};
    if (st.rot) { temR = true; const r = an.rot(st.rot); rots.push(r.x, r.y, r.z, r.w); }
    else rots.push(an.rest.r.x, an.rest.r.y, an.rest.r.z, an.rest.r.w);
    if (st.mov) { temM = true; const m = an.mov(st.mov); movs.push(m.x, m.y, m.z); }
    else movs.push(an.rest.t.x, an.rest.t.y, an.rest.t.z);
    if (st.esc !== undefined) { temE = true; const e = an.esc(st.esc); escs.push(e.x, e.y, e.z); }
  }
  const faixas = [];
  if (temR) faixas.push({ no, path: 'rotation', tempos, valores: rots });
  if (temM) faixas.push({ no, path: 'translation', tempos, valores: movs });
  if (temE) faixas.push({ no, path: 'scale', tempos, valores: escs });
  return faixas;
}
