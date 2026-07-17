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
