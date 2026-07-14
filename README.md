# 🐾 Duelo de Feras

**Um RPG de captura de monstros onde as batalhas não são por turnos — são lutas de ação em tempo real, no estilo dos jogos de luta.**

> Repositório: `mundo-of-feras` · Status: **protótipo em desenvolvimento** · Título comercial provisório

---

## O que é

Imagine a estrutura clássica de Pokémon — explorar um mundo, capturar criaturas, treinar uma equipe — mas, quando a batalha começa, você **controla a sua fera diretamente**: movimenta, orbita o adversário, pula, desvia e acerta golpes com comandos de direção, como num jogo de luta. Errar não é RNG, é habilidade.

O visual é **HD-2D**: feras e personagens em pixel art vivendo num mundo 3D com iluminação real, sombras dinâmicas e clima de diorama (referências: Octopath Traveler II e Star Ocean: The Second Story R).

O mundo são as **Ilhas de Vento Verde**, onde Domadores duelam lado a lado com suas feras — 30 espécies originais, 5 tipos, 3 raridades, evolução e progressão por level. A visão de longo prazo: **Ginásios com duelos 1v1 online** entre jogadores.

## Stack

Jogo web nativo: **TypeScript + Three.js** no cliente, **Node.js** no servidor (fase online), dados de feras e golpes em **JSON**. Simulação separada da renderização desde o primeiro commit — o mesmo núcleo de jogo roda no navegador hoje e no servidor autoritativo amanhã.

## Como rodar

Por enquanto, a fatia vertical é um arquivo único: abra `prototipo/duelo-de-feras-hd2d-web.html` num navegador (requer internet para carregar o Three.js via CDN). A estrutura modular com build chega nos próximos commits — instruções serão atualizadas aqui.

## Roadmap

1. **Single-player no navegador** — mundo, feras, captura, XP e save local
2. **Demo pública por link** — feedback de jogadores reais o quanto antes
3. **Contas e servidor** — progresso persistente
4. **Ginásios online** — duelos 1v1 entre jogadores

## Documentação

O design completo vive em `docs/`: o GDD (Game Design Document) com todos os sistemas, e o resumo de apresentação do projeto.

## Assets e créditos

Arte final das feras e personagens será 100% original. Durante o desenvolvimento, placeholders com licenças permissivas: pixel art do pacote **Ninja Adventure** (CC0, pixel-boy) e cenários 3D **KayKit** (CC0, Kay Lousberg) quando aplicável.

## Licença

Todos os direitos reservados. Este é um projeto comercial em desenvolvimento; o código não está licenciado para uso de terceiros.

---

*Feito por um Domador e seu Claude.* ⚔️🔥
