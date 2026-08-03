// EQUIPE — regras puras do INDIVÍDUO: a fera que o jogador possui, com
// nível, XP, HP persistente, golpes equipados (4 slots), golpes conhecidos
// e usos restantes (golpes não-físicos são limitados; físicos são infinitos).
// É o que viaja no save e, no futuro, pela rede (GDD §13).
import { vidaMaxima, NIVEL_INICIAL } from './progressao.js';

// usos crescem com a fera: +1 uso por nível a partir do 11 (Lv.11 = 11 usos)
export const usosMaximos = (base, nivel) =>
  base == null ? null : base + Math.max(0, nivel - 10);

// cria uma fera nova no nível dado, já com os golpes do seu aprendizado.
// liberaTudo (modo de teste da inicial): aprende a tabela inteira de uma vez
export function criarFera(especies, catalogo, chave, nivel = NIVEL_INICIAL, liberaTudo = false) {
  const fera = {
    especie: chave, nivel, xp: 0, apelido: null,
    conhecidos: [], golpes: [], usos: {},
    hpAtual: vidaMaxima(especies[chave].vida, nivel),
  };
  for (const a of especies[chave].aprendizado || [])
    if (liberaTudo || a.nivel <= nivel) aprendeGolpe(fera, catalogo, a.golpe);
  return fera;
}

// aprende um golpe: bases ocupam um dos 4 slots (slot 0 = físico inicial,
// intocável); versões fortes (com "base") não ocupam slot — saem por combo.
// Devolve o que aconteceu para a interface narrar.
export function aprendeGolpe(fera, catalogo, id) {
  if (fera.conhecidos.includes(id)) return null;
  const def = catalogo[id];
  if (!def) return null;
  fera.conhecidos.push(id);
  if (def.usos != null) fera.usos[id] = usosMaximos(def.usos, fera.nivel);
  if (def.base) return { tipo: 'forte', id };
  if (fera.golpes.length < 4) { fera.golpes.push(id); return { tipo: 'slot', id }; }
  const trocado = fera.golpes[1]; // nunca troca o físico do slot 0
  fera.golpes.splice(1, 1);
  fera.golpes.push(id);
  return { tipo: 'substituiu', id, trocado };
}

// relembra um golpe base já conhecido (fora de batalha): entra no lugar
// do último slot se estiver cheio
export function lembraGolpe(fera, catalogo, id) {
  if (!fera.conhecidos.includes(id) || !catalogo[id] || catalogo[id].base) return false;
  if (fera.golpes.includes(id)) return false;
  if (fera.golpes.length >= 4) fera.golpes.pop();
  fera.golpes.push(id);
  if (catalogo[id].usos != null && fera.usos[id] === undefined)
    fera.usos[id] = usosMaximos(catalogo[id].usos, fera.nivel);
  return true;
}

// monta os slots resolvidos para a batalha: cada slot leva a definição do
// golpe e, se a fera conhecer, a versão forte correspondente (combo)
export function montaSlots(fera, catalogo) {
  return fera.golpes.map((id) => {
    const forteId = fera.conhecidos.find((c) => catalogo[c] && catalogo[c].base === id);
    return { id, def: catalogo[id], forte: forteId ? { id: forteId, def: catalogo[forteId] } : null };
  });
}

// golpes novos que a fera aprende exatamente neste nível
export function aprendizadosDoNivel(esp, nivel) {
  return (esp.aprendizado || []).filter((a) => a.nivel === nivel).map((a) => a.golpe);
}

// EVOLUÇÃO (regra do Domador): cadeias de 3 estágios evoluem nos níveis
// 20 e 40; cadeias de 2, no 25 (muito-raras futuras: 30). Os dados vivem em
// especies.json ("evolui": { para, nivel }) — aqui só se aplica a regra.
export function verificaEvolucao(especies, fera) {
  const ev = especies[fera.especie].evolui;
  return ev && fera.nivel >= ev.nivel ? ev.para : null;
}
// evolui a fera (uma etapa); devolve { de, para } ou null. O HP mantém a
// PROPORÇÃO (fera machucada evolui machucada) e a espécie nova ensina o
// que já ensinaria até este nível.
export function evoluiFera(fera, especies, catalogo) {
  const para = verificaEvolucao(especies, fera);
  if (!para) return null;
  const de = fera.especie;
  const propHp = fera.hpAtual / vidaMaxima(especies[de].vida, fera.nivel);
  fera.especie = para;
  fera.hpAtual = Math.max(1, Math.round(vidaMaxima(especies[para].vida, fera.nivel) * propHp));
  for (const a of especies[para].aprendizado || [])
    if (a.nivel <= fera.nivel) aprendeGolpe(fera, catalogo, a.golpe);
  return { de, para };
}

// centro de curas: vida e usos de volta ao máximo (do nível atual)
export function curaTotal(fera, especies, catalogo) {
  fera.hpAtual = vidaMaxima(especies[fera.especie].vida, fera.nivel);
  for (const id of Object.keys(fera.usos))
    fera.usos[id] = usosMaximos(catalogo[id].usos, fera.nivel);
}

// bônus de subir de nível: recupera 20% da vida e 20% dos usos
// (e o máximo de usos cresce sozinho a partir do nível 11)
export function bonusNivel(fera, especies, catalogo) {
  const max = vidaMaxima(especies[fera.especie].vida, fera.nivel);
  fera.hpAtual = Math.min(max, Math.round(fera.hpAtual + max * 0.2));
  for (const id of Object.keys(fera.usos)) {
    const m = usosMaximos(catalogo[id].usos, fera.nivel);
    if (m != null) fera.usos[id] = Math.min(m, fera.usos[id] + Math.ceil(m * 0.2));
  }
}

// pacote que a batalha consome (slots resolvidos + referências vivas de
// usos e HP — o que a luta gastar fica gasto na fera)
export function paraBatalha(fera, especies, catalogo) {
  return {
    chave: fera.especie, nivel: fera.nivel,
    slots: montaSlots(fera, catalogo),
    usos: fera.usos,
    hp: fera.hpAtual,
  };
}
