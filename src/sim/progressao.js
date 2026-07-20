// PROGRESSÃO — nível e XP das feras (GDD §8). Regras puras, testáveis.
// Fórmulas simples de partida; curvas finais virão com o balanceamento.

export const NIVEL_INICIAL = 5;

// XP necessário para subir do nível atual
export function xpParaSubir(nivel) {
  return 20 + nivel * 10;
}

// aplica XP à fera ({ nivel, xp }); devolve quantos níveis subiu
export function ganhaXp(fera, qtd) {
  fera.xp += qtd;
  let subiu = 0;
  while (fera.xp >= xpParaSubir(fera.nivel)) {
    fera.xp -= xpParaSubir(fera.nivel);
    fera.nivel++;
    subiu++;
  }
  return subiu;
}

// XP ganho ao vencer/capturar uma fera do nível dado
export function xpPorVitoria(nivelInimigo) {
  return 12 + nivelInimigo * 4;
}

// nível da fera selvagem: perto do nível do jogador (±2, mínimo 2)
export function nivelSelvagem(nivelJogador, rnd = Math.random) {
  return Math.max(2, nivelJogador - 2 + Math.floor(rnd() * 5));
}

// multiplicador de stats por nível (vida e força crescem 5% por nível)
export function fatorNivel(nivel) {
  return 1 + (nivel - NIVEL_INICIAL) * 0.05;
}

// vida máxima de uma fera no nível dado
export function vidaMaxima(vidaBase, nivel) {
  return Math.round(vidaBase * fatorNivel(nivel));
}
