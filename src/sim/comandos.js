// COMANDOS — lógica pura de sequências direcionais (golpes de comando).
// Quem captura teclas é o main; quem executa o golpe é a batalha. Este módulo
// só responde: "esta sequência foi completada a tempo?" — assim a mesma regra
// vale para teclado, IA e, no futuro, rede.

export const JANELA_SEQ = 0.5; // segundos máximos entre passos da sequência

// guarda uma direção no buffer (mutação controlada, buffer curto)
export function guardaDirecao(buf, dir, t, maxTam = 8) {
  buf.push({ dir, t });
  if (buf.length > maxTam) buf.shift();
}

// a sequência (ex.: ['baixo','frente']) foi completada dentro da janela,
// terminando perto do instante t?
export function sequenciaCompleta(buf, seq, t, janela = JANELA_SEQ) {
  if (!seq || buf.length < seq.length) return false;
  const ult = buf.slice(-seq.length);
  for (let i = 0; i < seq.length; i++) if (ult[i].dir !== seq[i]) return false;
  for (let i = 1; i < ult.length; i++) if (ult[i].t - ult[i - 1].t > janela) return false;
  return t - ult[ult.length - 1].t <= janela;
}
