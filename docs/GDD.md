# DUELO DE FERAS — Documento de Game Design (GDD)

**Versão 0.1 — documento vivo** | Título provisório | Plataforma-alvo: PC (Steam) | Engine: Unreal Engine 5.8

Este documento descreve o jogo do zero, para qualquer pessoa que vá construí-lo. Decisões já tomadas pelo criador aparecem como fatos; sugestões minhas ainda não aprovadas estão marcadas como **(proposta)**; e tudo que ainda precisa de decisão está listado nas Questões em Aberto ao final.

---

## 1. Visão geral

Duelo de Feras é um RPG de captura de monstros no estilo estrutural de Pokémon clássico — explorar, capturar, treinar, desafiar — com um diferencial central: **as batalhas não são por turnos; são lutas de ação em tempo real, no estilo dos jogos de luta**. O jogador controla sua fera diretamente na arena: movimenta, pula, ataca, desvia e executa golpes especiais com comandos de direção, como em Mortal Kombat.

Os três pilares do design, em ordem de prioridade: primeiro, **a luta precisa ser gostosa** — impacto, leitura do adversário e habilidade importam mais que números; segundo, **colecionar precisa dar orgulho** — 30 feras originais com identidade forte, raridade e evolução; terceiro, **o mundo convida a explorar** — visual HD-2D marcante e estrutura clássica de vilarejos e rotas.

## 2. Mundo e fantasia do jogador

O jogo se passa nas **Ilhas de Vento Verde**, um arquipélago onde humanos e feras vivem em harmonia. O jogador é um **Domador** — os únicos humanos que ousam duelar lado a lado com as feras. O tom é aventura leve e acolhedora, com espaço para mistério nas áreas das feras muito raras. Os Domadores **não lutam**: comandam. Quem entra na arena é sempre a fera.

## 3. Direção de arte

O estilo visual é **3D estilizado em diorama** (decidido, substituindo o pixel art da versão anterior deste documento): personagens e feras em **low-poly chibi** — formas arredondadas, cores chapadas, cabeças grandes — vivendo em cenários 3D com iluminação moderna, sombras longas e luz quente de fim de tarde. Referências principais: **World of ClaudeCraft** (personagens e proporção), Octopath Traveler II (clima e paleta do mundo), Pokkén Tournament (leitura de batalha).

**Treinadores** (protagonista e NPCs): modelos 3D chibi — cabeça ~metade da altura, carismáticos e legíveis de longe — com figurinos inspirados nos aventureiros estilizados de **Farever** (Shiro Games), e **sempre desarmados**, reforçando visualmente que quem luta são as feras. Animações de caminhada por direção (de costas ao subir, perfil aos lados).

**Feras**: modelos 3D low-poly originais, 100% autorais (exigência legal e de identidade). Cada espécie precisa de silhueta reconhecível a distância e paleta que comunique seu tipo.

## 4. Câmeras

**Exploração — câmera estilo League of Legends:** ângulo fixo olhando de cima em diagonal (pitch na faixa de 50–60°, a calibrar), **bem afastada do personagem** (enquadramento amplo, como no LoL), sem rotação pelo jogador, seguindo o personagem com suavização (camera lag). O jogador nunca controla a câmera no mundo; ela é parte da identidade visual, como no LoL e nos HD-2D.

**Batalha — câmera lock-on orbital (estilo Pokkén Tournament, fase de campo):** a câmera fica atrás da fera do jogador, sempre apontada para o adversário. Mover para frente aproxima, para trás afasta, e para os lados **orbita** ao redor do oponente. O adversário é o ponto de referência do movimento, não o mapa. Consequência de arte: a fera do jogador é vista de costas e a adversária de frente (sprites billboard encarando a câmera).

## 5. Loop principal

Explorar vilarejos e rotas → encontrar feras selvagens na grama alta → transição para a arena → **luta em tempo real** → enfraquecer a fera (vida baixa) → capturar com o Cristal de Captura ou nocautear → ganhar XP → subir de level, aprender golpes, evoluir → enfrentar Domadores NPC e áreas mais difíceis → repetir, com equipe e habilidade do jogador crescendo juntas.

## 6. Exploração e estrutura de mundo

A estrutura dos mapas iniciais segue o modelo consagrado de **Pokémon Red/Blue**: um vilarejo inicial pequeno, rotas conectando assentamentos, grama alta como zona de encontro, obstáculos naturais controlando o ritmo de progressão. **O mundo é uma malha de mapas conectados por passagens nas bordas** (estilo clássico de telas ligadas): cada mapa é definido por dados (`mapas.json` — limites, árvores, grama, água, espécies selvagens e saídas), então criar áreas novas é criar conteúdo, não código. Movimento: andar; **corrida a 1,5x** com toque duplo na direção, segurando o segundo toque (decidido) — tudo reinterpretado com a estilização HD-2D moderna (vegetação 3D, iluminação de fim de tarde, água animada). **As feras selvagens são invisíveis durante a exploração**: o jogador só descobre qual fera encontrou quando a batalha começa — decisão tomada para criar suspense no encontro. Feras muito raras não aparecem em grama comum: habitam locais especiais e escondidos do mapa **(proposta)**.

## 7. Sistema de Feras

### 7.1 Números e tipos

**30 espécies no total**, divididas em **5 tipos**: Fogo, Água, Planta, Elétrico e Comum.

Tabela de vantagens **(proposta, multiplicadores 1.5x vantagem / 0.75x desvantagem)**: Água vence Fogo; Fogo vence Planta; Planta vence Água; Elétrico vence Água; Planta resiste a Elétrico (fecha o ciclo); Comum não tem vantagens nem fraquezas — é o tipo neutro e versátil.

### 7.2 Raridades

Três raridades, com três efeitos definidos: **probabilidade de encontro**, **poder dos golpes especiais** e **dificuldade de execução dos comandos especiais**.

| Raridade | Evolução | Taxa de encontro (proposta) | Especiais |
|---|---|---|---|
| Comum | Evolui 1 vez (linha de 2 estágios, ex.: Rattata→Raticate) | ~70% | Mais fracos, comandos fáceis |
| Rara | Evolui 2 vezes (linha de 3, ex.: Charmander→Charmeleon→Charizard) | ~27% | Fortes, comandos médios |
| Muito Rara | Não evolui | ~3% (locais especiais) | Muito fortes, comandos difíceis |

### 7.3 A matriz das 30 espécies (proposta de distribuição)

A conta fecha com elegância se cada tipo tiver: **1 linha comum (2 espécies) + 1 linha rara (3 espécies) + 1 fera muito rara (1 espécie) = 6 espécies por tipo × 5 tipos = 30**. Isso dá a cada tipo um "bicho de entrada", uma "linha estrela" e uma "lenda".

As feras já criadas no protótipo se encaixam assim **(proposta)**: **Brasinha** = Fogo, linha rara (a inicial do jogador, 3 estágios); **Cascorro** = tipo Comum, linha comum; **Voltim** = Elétrico; **Folhito** = Planta; **Gotim** = Água, linha comum (o pinguinzinho-gota, frágil e equilibrado); **Salamandro** = Fogo, linha comum (lagartinho ereto com chama na cauda, das Colinas Rochosas). **Aguardando aprovação no Compêndio (proposta)**: **Folhito** = Planta, linha rara (quadrúpede com bulbo-folha nas costas); **Assombrim** = Muito Rara (bola de sombra sorridente com espetos); **Raiozim** = Elétrico, linha rara (ratinho de orelhas compridas, bochechas vermelhas e cauda-raio). Faltam as demais espécies.

### 7.4 Atributos (stats)

Cada fera tem **(base do protótipo + proposta)**: Vida, Ataque, Defesa, Velocidade (movimento na arena) e Impulso (altura do pulo). Stats base variam por espécie e crescem com o level.

## 8. Progressão

Modelo Pokémon: feras ganham **XP por batalha** (vencida ou capturada), sobem de **level**, seus **stats crescem** e seus **golpes melhoram** com o nível. **Implementado no protótipo (fórmulas iniciais)**: XP para subir = 20 + nível×10; XP por vitória = 12 + nível do inimigo×4; vida e força crescem 5% por nível; feras selvagens aparecem no nível do jogador ±2. A barra de evolução e o nível aparecem junto à barra de vida, estilo Pokémon. Evolução por level **(proposta de marcos)**: linhas comuns evoluem por volta do nível 16; linhas raras nos níveis ~14 e ~32. A evolução troca o sprite, melhora stats e pode aprimorar os golpes de comando. Curva de XP, level máximo e fórmulas exatas: em aberto (partiremos das fórmulas públicas da série Pokémon como base testada, adaptando ao combate de ação).

## 9. Sistema de batalha (o coração do jogo)

### 9.1 Estrutura

Duelo **1v1 em tempo real** numa **arena dedicada** — um ringue cercado, separado do mapa de exploração e **estilizado pelo bioma** onde o encontro aconteceu (floresta, praia, caverna...). Câmera lock-on orbital, alta e afastada para leitura da arena inteira. O Domador não aparece no ringue: ele comanda de fora. Ao encontrar uma fera selvagem, o jogo corta para a arena e apresenta a fera com um menu **Lutar/Fugir** — a luta só começa se o jogador escolher lutar (fugir sempre funciona contra selvagens, por enquanto). O jogador controla a fera ativa da equipe; a adversária é uma fera selvagem (IA) ou a fera de um Domador NPC (IA, futuramente outro jogador).

### 9.2 Controles e golpes

**Catálogo de golpes data-driven** (`golpes.json`): todos os golpes do jogo, com dano, frames e **usos limitados** para golpes não-físicos (ex.: Bola de Fogo 70, Lança-Chamas 30); golpes físicos são infinitos. Feras **aprendem golpes por nível** (tabela de aprendizado por espécie), preenchendo até **4 slots** acionados por **Z / X / C / V** (slot 1 = golpe físico inicial, intocável). Ao aprender com os slots cheios, o novo substitui um antigo; golpes esquecidos podem ser **relembrados** no menu de status (fora de batalha). **Golpe forte por CARGA** (decidido, substituindo os combos de direção — que ficam para o futuro): toque no botão = golpe simples; **segurar o botão por 1,5s** faz um campo de energia crescer em volta da fera e ela solta a **versão forte** daquele slot (Investida→Investida Feroz, Bola de Fogo→Lança-Chamas, ~2x de dano total). **F** lança o Cristal de Captura. Golpes se restauram no Centro de Curas (tudo), ao subir de nível (20%) ou com itens (futuro).

Modelo anterior de slots fixos, mantido como referência histórica:

Toda fera tem exatamente **4 golpes**, em 4 slots de função fixa:

| Slot | Acionamento | Descrição |
|---|---|---|
| Golpe Normal | Botão A | Universal: soco, mordida ou investida conforme a anatomia da fera. Rápido, fraco, base do jogo neutro |
| Especial de Tipo | Botão B | Definido pelo tipo: lança-chamas, jato d'água, lâminas de folha, descarga elétrica. Feras do tipo Comum fazem algo mais simples, como uma investida veloz |
| Comando 1 | Sequência direcional + botão (estilo Mortal Kombat) | Golpe assinatura da espécie — nos tipos elementais, uma **rajada** do elemento (lança-chamas, rajada voltaica, rajada de bolhas) |
| Comando 2 | Sequência direcional mais longa + botão | O golpe mais forte da espécie |

**A regra de ouro da raridade**: quanto mais rara a fera, mais fortes os golpes de comando — e mais difícil a execução **(proposta de escala)**: comuns usam direção + botão; raras usam quarto de círculo (↓↘→ + botão); muito raras exigem sequências longas ou timing apertado. Poder exige maestria: uma fera muito rara nas mãos de um iniciante rende menos que uma comum bem pilotada — essa troca é intencional e central ao design.

Movimentação: aproximar/afastar/orbitar (relativa ao adversário) + **pulo** + **cambalhota** (dois toques rápidos numa direção): salto-esquiva veloz com invulnerabilidade breve, em qualquer direção. Especiais de projétil podem ser disparados no ar (com mira vertical); golpes físicos exigem o chão.

**Controles padrão (teclado, decidido)**: setas movem; **Z** = golpe normal, **X** = especial de tipo, **C** = contextual (capturar/confirmar). Sequências de comando em notação de luta: ↓ = seta baixo, → = seta cima (avançar no oponente). Tela de remapeamento de botões: no backlog.

### 9.3 Propriedades dos golpes (a dupla identidade)

Cada golpe carrega dados de RPG e de fighting game ao mesmo tempo: **poder** (escala com Ataque e level), **tipo** (aplica vantagem/desvantagem), e frame data — **preparação** (startup, a janela de reação do oponente), **janela ativa** (quando a hitbox acerta), **recuperação** (punição se errar), **alcance** e **empurrão** (knockback). Golpes fortes são telegrafados visualmente (a fera "carrega" piscando antes de soltar).

### 9.4 Game feel (inegociáveis validados no protótipo)

**Hit-stop** (congelamento de ~0,05–0,1s no impacto), knockback proporcional, breve invulnerabilidade pós-acerto (anti-stunlock), tremor de tela, números de dano, faíscas de impacto e sons distintos por peso de golpe. Esses detalhes são o que separa "funcionar" de "ser gostoso" — tratados como requisito, não como polimento.

### 9.4b Permadeath (decidido — pilar de jogabilidade)

**As feras só são perdidas se a equipe INTEIRA cair.** Uma fera que desmaia fica fora de combate (HP 0) até ser curada no Centro — mas continua sua. Quando a ativa cai, a próxima viva entra no mesmo duelo (o inimigo mantém o HP). Se **todas** caírem, o jogador perde **todas** as feras, acorda na vila inicial e — apenas se estiver sem nenhuma — recebe uma nova inicial (no futuro: escolha entre 3 iniciais de tipos diferentes, parte da abertura da história). O **HP das feras persiste entre batalhas**; cura pelo Centro de Curas (tudo), por subir de nível (+20%) ou por itens (futuro).

### 9.5 Captura

Feras selvagens com vida abaixo de **~35%** podem ser capturadas: o jogador lança o **Cristal de Captura** (botão contextual). A chance cresce quanto menor a vida restante; raridades maiores resistem mais **(proposta)**. Falhou: a fera se enfurece e a luta continua. Capturou: entra na equipe (máx. 6 ativas).

### 9.6 IA adversária

Feras selvagens: comportamento simples por arquétipo (agressiva, cautelosa, territorial), com dificuldade crescendo por região. **Fúria (implementado)**: quanto mais ferida, mais rápida e agressiva a fera selvagem fica — decide mais rápido, ataca e usa golpes fortes com mais frequência, e esquiva com cambalhotas laterais. Feras de Domadores NPC: IA mais deliberada — telegrafa, pune erros do jogador, explora vantagem de tipo. A IA gera os mesmos inputs abstratos que um jogador humano geraria — decisão de arquitetura deliberada para o futuro online.

## 10. Treinadores e NPCs

O **protagonista** e os **Domadores NPC** compartilham a direção visual Farever-sem-armas. Vilarejos têm **moradores decorativos** (maga, aldeões, mercador) e vida de cenário — fogueira, poço, bancas de feira — para o mundo parecer habitado antes mesmo dos NPC de batalha existirem. Domadores NPC desafiam o jogador em batalhas sequenciais (a equipe deles, uma fera por vez). Vencer rende XP em dobro **(proposta)** e recompensas. Estrutura de líderes/insígnias da campanha: em aberto.

## 11. Interface

Exploração: **minimapa** no canto superior direito (layout da área, grama, água, casas, platôs, passagens e a posição do jogador, com o nome do mapa) e **painel lateral do Domador** à esquerda (equipe, feras capturadas, local atual). **Menu do Domador** (tecla M/ESC): Equipe (troca a fera ativa), Status — que projeta a fera selecionada como um **holograma girando** diante do Domador —, Catálogo de golpes, Itens, Carteira e Insígnias (estrutura pronta, conteúdo futuro). **Menu de batalha** (ESC na luta, pausa o duelo): Continuar, Trocar Fera, Itens e Fugir. Casas têm interiores exploráveis (entrar pela porta). Interações contextuais. Batalha: barras de vida com nome e level nos cantos superiores, indicador de captura piscando quando disponível, e **lista de comandos da fera ativa acessível em pausa** (essencial: o jogador precisa poder consultar as sequências estilo MK da fera que está usando). Menus: equipe, ficha da fera (stats, golpes, XP) e **Compêndio de Feras** (a "dex" — nome a definir).

## 12. Multiplayer (visão de futuro)

**Ginásios**: locais no mundo onde jogadores desafiam outros jogadores em duelos 1v1 online usando as feras que capturaram e treinaram. Roadmap deliberado: **batalhas vs IA → versus local (2 jogadores, 1 PC) → versus online**. Decisões de arquitetura já em prática para viabilizar isso sem retrabalho: inputs abstratos separados de quem os gera (teclado, IA ou rede), dados de espécie separados dos dados do indivíduo, e lógica de dano pensada para autoridade de servidor.

## 13. Arquitetura técnica

Unreal Engine 5.8, desenvolvimento em **Blueprints** (C++ pontual quando necessário). Animação 2D: **Paper2D + PaperZD** (flipbooks + máquinas de estado de animação). Dados: **Data Tables** para espécies e golpes (editáveis em planilha externa), **Structs** para o indivíduo (level, XP, golpes atuais, apelido — o que viaja no save e, futuramente, pela rede). Assets placeholder: pacote Ninja Adventure (licença CC0) para mundo e dublês de feras durante o desenvolvimento; arte final original substituirá tudo. Fluxo de trabalho assistido por IA: Claude (design, arquitetura e ensino) + Claude Code conectado ao MCP oficial da UE 5.8 (automação de tarefas de editor, sempre com revisão humana).

## 14. Estado atual e roadmap

**Concluído**: protótipo jogável validando o loop completo (exploração → luta em tempo real → captura → equipe); na Unreal: exploração HD-2D com personagem animado (PaperZD), câmera de exploração e arena com câmera lock-on orbital funcionando.

**Fases**: ① Fundamentos ✅ ② Exploração ✅ ③ **Arena de luta** (em andamento: billboard → fera jogável → golpes e hitbox → dano e reação → IA) ④ Sistema de feras (Data Tables, captura, equipe, XP e evolução) ⑤ Costura (transições mundo↔batalha, save) ⑥ Conteúdo (30 feras, mapas, NPCs, campanha) ⑦ Versus local → online.

## 15. Questões em aberto (decisões pendentes do criador)

Nome definitivo do jogo; o jogador escolhe entre 3 iniciais raras (Fogo/Água/Planta, à la Pokémon) ou a Brasinha é fixa?; existe bloqueio/esquiva com botão dedicado na luta?; troca de fera durante a batalha é permitida?; itens de cura e de batalha existem?; economia (dinheiro, custo dos Cristais); estrutura da campanha (líderes de ginásio single-player? história principal?); nome do Compêndio; level máximo; e confirmação das propostas marcadas ao longo do documento.

---

*Documento gerado a partir das decisões de design do criador do projeto. Atualizar a cada sistema novo definido.*
