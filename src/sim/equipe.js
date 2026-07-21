// EQUIPE — regras puras do INDIVÍDUO: a fera que o jogador possui, com
// nível, XP, HP persistente, golpes equipados (4 slots), golpes conhecidos
// e usos restantes (golpes não-físicos são limitados; físicos são infinitos).
// É o que viaja no save e, no futuro, pela rede (GDD §13).
import { vidaMaxima, NIVEL_INICIAL } from './progressao.js';

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
  if (def.usos != null) fera.usos[id] = def.usos;
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
    fera.usos[id] = catalogo[id].usos;
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

// centro de curas: vida e usos de volta ao máximo
export function curaTotal(fera, especies, catalogo) {
  fera.hpAtual = vidaMaxima(especies[fera.especie].vida, fera.nivel);
  for (const id of Object.keys(fera.usos)) fera.usos[id] = catalogo[id].usos;
}

// bônus de subir de nível: recupera 20% da vida e 20% dos usos
export function bonusNivel(fera, especies, catalogo) {
  const max = vidaMaxima(especies[fera.especie].vida, fera.nivel);
  fera.hpAtual = Math.min(max, Math.round(fera.hpAtual + max * 0.2));
  for (const id of Object.keys(fera.usos)) {
    const m = catalogo[id].usos;
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
