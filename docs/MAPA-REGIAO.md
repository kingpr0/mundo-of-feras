# Região Ferândia — esboço do mapa-múndi (v1)

Visão estilo Kanto: um continente com o mar a leste, geleiras ao norte,
vulcão a nordeste, deserto ao sul e a jornada dos ginásios costurando tudo.
**11 áreas já são jogáveis**; 12 são planejadas. A malha usa o mesmo sistema
de dados de `mapas.json` (`regiao {x,y}` + `saidas`) — criar área nova é
criar conteúdo, não código.

## As áreas

| Área | Bioma | Status | Destaque |
|------|-------|--------|----------|
| Vila Clareira | vila verde | ✅ jogável | Início da jornada; fogueira-marco |
| Cidade Verdejante | cidade | ✅ jogável | **Ginásio de planta** (futuro) |
| Trilha dos Pinheiros | campo | ✅ jogável | Treinador Rui |
| Beira do Lago | lago | ✅ jogável | Água viva; pesca (futuro) |
| Campo Norte | campo | ✅ jogável | Treinador Beto; morros |
| Rota das Lajes | campo | ✅ jogável | Treinadora Vilma |
| Colinas Rochosas | terra | ✅ jogável | **Caverna Sombria** (interior pronto) |
| Encosta do Lago | campo | ✅ jogável | Platôs e escadas |
| Penhasco do Vento | penhasco | ✅ jogável | Feras muito raras |
| Dunas Escaldantes | deserto | ✅ jogável | Arena com cactos-armadilha; oásis |
| Caverna Sombria (interior) | caverna | ✅ jogável | Cristais; covil de Diabrim |
| Porto Maresia | cidade costeira | 🔲 planejada | **Ginásio de água**; barco p/ ilha |
| Monte Fervura | vulcão | 🔲 planejada | Túnel de lava; feras de fogo |
| Cidade Forja | cidade | 🔲 planejada | **Ginásio de fogo**; ferreiro |
| Vila Nevada | vila de neve | 🔲 planejada | **Ginásio de gelo** |
| Trilha Nevada | rota alpina | 🔲 planejada | Nevasca; tipo gelo (proposta) |
| Gruta Gelada | caverna de gelo | 🔲 planejada | Auroram é avistada aqui? |
| Monte Alvorada | montanha | 🔲 planejada | **Liga das Feras** (topo da região) |
| Pântano Bruma | pântano | 🔲 planejada | Névoa; feras sombra (proposta) |
| Rota do Rio | rio | 🔲 planejada | Correnteza que empurra; deságua no mar |
| Oásis Solar | cidade no deserto | 🔲 planejada | **Ginásio de pedra** (proposta) |
| Vale Bravo | badlands | 🔲 planejada | Feras raras de alto nível |
| Ilha do Auroram | ilhota | 🔲 planejada | **Lendária #30**; só de barco |

## A jornada (ordem sugerida dos ginásios)

1. **Verdejante (planta)** — a poucos passos do início; o tutorial de ginásio.
2. **Porto Maresia (água)** — leste, depois de cruzar o lago.
3. **Oásis Solar (pedra)** — sul, atravessando as Dunas.
4. **Cidade Forja (fogo)** — nordeste, contornando o vulcão.
5. **Vila Nevada (gelo)** — norte gelado, o teste final.
6. **Liga das Feras** — Monte Alvorada, só com as 5 insígnias.

A lendária Auroram: rumores na Gruta Gelada, encontro real na Ilha
(pós-Liga). Ginásios são também os pontos de **batalha online** planejados.

## Regras de coerência do mundo

- Biomas encostam com transição: campo → terra → deserto; campo → neve
  passa por rota alpina; vulcão cercado de penhasco/terra.
- Cavernas conectam lados da região por baixo (atalhos destraváveis).
- Água é barreira até existir travessia (barco no Porto — futuro).
- Cada área nova nasce com: espécies do catálogo compatíveis com o bioma,
  1 treinador NPC pelo menos, 1 placa, e um marco visual próprio (como a
  fogueira da Clareira).
