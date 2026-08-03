// SAVE — empacota e valida a jornada do Domador. REGRAS PURAS: nada de
// localStorage aqui (o main faz a leitura/escrita no navegador); assim o
// mesmo formato viaja depois para o servidor do modo online (GDD §13).
export const VERSAO_SAVE = 1;

// estado vivo -> pacote serializável (só o que importa, nada de objetos 3D)
export function empacotaSave({ equipe, ativa, itens, jaEscolheu, chaveMapa, pos, vencidos }) {
  return {
    v: VERSAO_SAVE,
    equipe,
    ativa,
    itens: { cristal: itens.cristal },
    jaEscolheu: !!jaEscolheu,
    chaveMapa,
    pos: { x: Math.round(pos.x * 10) / 10, z: Math.round(pos.z * 10) / 10 },
    vencidos,
  };
}

// pacote (possivelmente velho/corrompido) -> estado saneado, ou null.
// Feras de espécies que não existem mais somem; mapa desconhecido volta
// ao inicial; campos ausentes ganham padrões seguros.
export function validaSave(s, especies, mapas, mapaInicial) {
  if (!s || s.v !== VERSAO_SAVE || !Array.isArray(s.equipe)) return null;
  const equipe = s.equipe
    .filter((f) => f && especies[f.especie])
    .map((f) => ({
      especie: f.especie,
      nivel: Math.max(1, f.nivel | 0),
      xp: Math.max(0, f.xp | 0),
      apelido: f.apelido || null,
      conhecidos: Array.isArray(f.conhecidos) ? f.conhecidos : [],
      golpes: Array.isArray(f.golpes) ? f.golpes : [],
      usos: f.usos && typeof f.usos === 'object' ? f.usos : {},
      hpAtual: Math.max(0, f.hpAtual | 0),
    }));
  return {
    equipe,
    ativa: Math.min(Math.max(0, s.ativa | 0), Math.max(0, equipe.length - 1)),
    itens: { cristal: Math.max(0, (s.itens && s.itens.cristal) | 0) },
    jaEscolheu: !!s.jaEscolheu,
    chaveMapa: mapas[s.chaveMapa] ? s.chaveMapa : mapaInicial,
    pos: s.pos && isFinite(s.pos.x) && isFinite(s.pos.z)
      ? { x: s.pos.x, z: s.pos.z } : null,
    vencidos: Array.isArray(s.vencidos) ? s.vencidos : [],
  };
}
