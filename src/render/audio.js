// ÁUDIO — sintetizado via WebAudio, sem arquivos. Mapeia eventos da simulação em sons.
let AC = null;
export function audioInit() {
  if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
  if (AC && AC.state === 'suspended') AC.resume();
}
function beep(f, d, t = 'square', v = 0.11, s = 0) {
  if (!AC) return;
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = t; o.frequency.setValueAtTime(f, AC.currentTime);
  if (s) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + s), AC.currentTime + d);
  g.gain.setValueAtTime(v, AC.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, AC.currentTime + d);
  o.connect(g); g.connect(AC.destination); o.start(); o.stop(AC.currentTime + d);
}
/* ---------- música de fundo: chiptune sintetizado em loop ---------- */
let musTimer = null, musPasso = 0, musTrilha = null;
const NOTA = (n) => 440 * Math.pow(2, (n - 69) / 12); // MIDI -> Hz

// 16 semicolcheias por compasso; 0 = pausa
const TRILHAS = {
  explorar: { // calma, maior, passeio
    bpm: 96, ondaB: 'triangle', ondaM: 'square', volB: 0.05, volM: 0.045,
    baixo:   [48, 0, 0, 0, 43, 0, 0, 0, 45, 0, 0, 0, 47, 0, 0, 0],
    melodia: [72, 0, 76, 0, 79, 0, 76, 0, 74, 0, 77, 0, 76, 74, 72, 0],
  },
  batalha: { // menor, rápida, tensa
    bpm: 152, ondaB: 'sawtooth', ondaM: 'square', volB: 0.055, volM: 0.05,
    baixo:   [45, 45, 0, 45, 45, 45, 0, 45, 44, 44, 0, 44, 43, 43, 0, 43],
    melodia: [69, 0, 72, 74, 75, 74, 72, 0, 69, 0, 72, 74, 76, 75, 74, 72],
  },
};

// troca (ou para, com nome null) a trilha de fundo
export function musica(nome) {
  if (musTrilha === nome) return;
  musTrilha = nome;
  if (musTimer) { clearInterval(musTimer); musTimer = null; }
  if (!nome) return;
  musPasso = 0;
  const t = TRILHAS[nome];
  const intervalo = 60000 / t.bpm / 4;
  musTimer = setInterval(() => {
    if (!AC) return;
    const i = musPasso % 16;
    if (t.baixo[i]) beep(NOTA(t.baixo[i]), intervalo / 1000 * 1.8, t.ondaB, t.volB);
    if (t.melodia[i]) beep(NOTA(t.melodia[i]), intervalo / 1000 * 1.5, t.ondaM, t.volM);
    musPasso++;
  }, intervalo);
}

export const sfx = {
  hit: () => beep(160, .09, 'sawtooth', .15, -80),
  hitForte: () => { beep(90, .18, 'sawtooth', .2, -50); beep(50, .22, 'square', .13); },
  pulo: () => beep(240, .12, 'square', .07, 260),
  swing: () => beep(520, .05, 'triangle', .06, -200),
  encontro: () => { beep(440, .1, 'square', .1, -120); setTimeout(() => beep(330, .14, 'square', .1, -100), 110); },
  especial: () => beep(120, .3, 'sawtooth', .12, 220),
  cristalVoa: () => beep(600, .1, 'triangle', .1, 300),
  cristalTreme: () => beep(300, .08, 'triangle', .09, -60),
  capturado: () => [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => beep(f, .14, 'square', .1), i * 110)),
  vitoria: () => [392, 523, 659, 784].forEach((f, i) => setTimeout(() => beep(f, .13, 'triangle', .1), i * 100)),
  derrota: () => [330, 262, 196].forEach((f, i) => setTimeout(() => beep(f, .2, 'triangle', .1), i * 160)),
};
