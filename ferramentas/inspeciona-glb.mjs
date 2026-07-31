// Inspeciona .glb: triângulos, texturas (formato/resolução/peso), animações, ossos
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

function dimensoesImg(buf) {
  // PNG: IHDR nos bytes 16..24
  if (buf[0] === 0x89 && buf[1] === 0x50) {
    return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
  }
  // JPEG: procura marcador SOF0..SOF2
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i < buf.length - 9) {
      if (buf[i] !== 0xff) { i++; continue; }
      const m = buf[i + 1];
      if (m >= 0xc0 && m <= 0xc2) return [buf.readUInt16BE(i + 7), buf.readUInt16BE(i + 5)];
      i += 2 + buf.readUInt16BE(i + 2);
    }
  }
  return [0, 0];
}

function inspeciona(caminho, nome) {
  const b = readFileSync(caminho);
  const tamJson = b.readUInt32LE(12);
  const json = JSON.parse(b.subarray(20, 20 + tamJson).toString());
  const inicioBin = 20 + tamJson + 8;

  // triângulos
  let tris = 0;
  for (const m of json.meshes || []) {
    for (const p of m.primitives || []) {
      const acc = json.accessors[p.indices !== undefined ? p.indices : p.attributes.POSITION];
      tris += Math.floor(acc.count / 3);
    }
  }

  // texturas
  let pesoImgs = 0;
  const imgs = (json.images || []).map((img) => {
    const bv = json.bufferViews[img.bufferView];
    pesoImgs += bv.byteLength;
    const dados = b.subarray(inicioBin + (bv.byteOffset || 0), inicioBin + (bv.byteOffset || 0) + Math.min(bv.byteLength, 65536));
    const [w, h] = dimensoesImg(dados);
    return `${w}x${h} ${(bv.byteLength / 1048576).toFixed(2)}MB ${(img.mimeType || '').replace('image/', '')}`;
  });

  const anims = (json.animations || []).map((a) => a.name || '?');
  const ossos = (json.skins || []).reduce((s, sk) => s + sk.joints.length, 0);
  const total = b.length / 1048576;

  console.log(`\n== ${nome} — ${total.toFixed(2)} MB ==`);
  console.log(`  tris: ${tris} | ossos: ${ossos} | malhas: ${(json.meshes || []).length}`);
  console.log(`  imagens (${imgs.length}, ${(pesoImgs / 1048576).toFixed(2)}MB): ${imgs.join(' | ')}`);
  console.log(`  animações (${anims.length}): ${anims.join(', ')}`);
}

const pasta = process.argv[2];
for (const f of readdirSync(pasta).filter((f) => f.endsWith('.glb')).sort()) {
  try { inspeciona(join(pasta, f), f); } catch (e) { console.log(`\n== ${f} == ERRO: ${e.message}`); }
}
