// Vetores simples {x,y,z} — a simulação NÃO usa THREE de propósito:
// o mesmo código precisa rodar no servidor (Node) no futuro online.
export const vec = (x = 0, y = 0, z = 0) => ({ x, y, z });
export const copia = (a) => ({ x: a.x, y: a.y, z: a.z });
export const soma = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const escala = (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s });
export const distXZ = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export function normXZ(a) {
  const d = Math.hypot(a.x, a.z) || 1;
  return { x: a.x / d, y: 0, z: a.z / d };
}
// perpendicular no plano do chão (para orbitar o adversário)
export const perpXZ = (a) => ({ x: -a.z, y: 0, z: a.x });
