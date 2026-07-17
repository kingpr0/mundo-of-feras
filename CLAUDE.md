# CLAUDE.md — Mundo of Feras (Duelo de Feras)

Este arquivo é a base para qualquer modelo trabalhando neste repositório. Leia-o por completo antes de qualquer tarefa e obedeça todas as regras.

## O que é este projeto

**Duelo de Feras** (título provisório): um RPG de captura de monstros em HD-2D onde as batalhas são lutas de ação em tempo real, estilo jogo de luta. Jogo web nativo. A fonte da verdade do design é **`docs/GDD.md`** — em dúvida sobre qualquer regra de jogo, consulte-o. Itens marcados **(proposta)** no GDD ainda não foram decididos: trate como abertos e pergunte.

## Quem decide

O dono do projeto é **o Domador** (o usuário). Ele é o diretor de design, está aprendendo programação, e prefere explicações claras em **português brasileiro**. Sempre responda em PT-BR. Mensagens de commit em português.

## Arquitetura sagrada (inegociável)

```
src/sim/     -> REGRAS PURAS. Proibido: importar 'three', tocar DOM/window,
                acessar qualquer coisa de navegador. Aleatoriedade sempre
                via parâmetro rnd injetável (padrão Math.random).
                Razão: este código rodará no servidor Node no futuro online.
src/render/  -> Apresentação (Three.js, DOM, áudio). Lê o estado da sim,
                desenha e sonoriza. NUNCA contém regra de jogo.
src/main.js  -> A cola: entrada do jogador -> sim; eventos da sim -> render.
src/dados/   -> Data Tables em JSON (espécies, golpes). Conteúdo novo
                (feras, golpes, balanceamento) entra por DADOS, não por código.
docs/        -> GDD e documentos de design.
prototipo/   -> Fatia vertical original em arquivo único (referência histórica).
```

Se uma tarefa te tentar a violar essa separação, pare e proponha alternativa.

## Como rodar e validar

- `npm run dev` → abre servidor local em `http://localhost:3000`
- Antes de qualquer commit: rodar o jogo, abrir o console do navegador e confirmar zero erros; testar o fluxo tocado pela mudança (explorar → duelo → captura/vitória → voltar)
- Não existe suíte de testes ainda; criá-la para `src/sim/` está no backlog

## Git

- Commits pequenos e frequentes, um assunto por commit
- Mensagens no padrão `tipo: descrição` em português — ex.: `feat: adiciona espécie Voltim`, `fix: corrige knockback no ar`, `docs: atualiza GDD §9`
- Nunca commitar `node_modules/` (o .gitignore já cobre)
- Mudanças grandes (3+ arquivos ou refatoração): apresentar plano e aguardar aprovação antes de executar

## Estilo de código

JavaScript ES modules (migração para TypeScript está no backlog — manter a arquitetura ao migrar). Sem frameworks. Nomes em português (`passoBatalha`, `lancaCristal`). Funções pequenas. Comentários explicam o *porquê*, não o óbvio. Números mágicos de gameplay devem tender aos JSONs de dados.

## Backlog inicial (ordem sugerida)

1. **Validação do kit**: `npm run dev`, jogar o loop completo, corrigir qualquer erro de console (o kit foi escrito sem execução local — pode haver ajustes finos)
2. **Voltim**: adicionar a 2ª espécie selvagem via `especies.json` + sprite em `sprites.js`, provando o pipeline de dados (GDD §7)
3. **Golpes de comando**: protótipo do sistema de sequências direcionais (↓→ + botão) do GDD §9.2 — detecção de input em `main.js`, dados do golpe no JSON, execução na sim
4. **Save local**: persistir equipe e capturas em `localStorage`
5. **Level e XP**: progressão básica conforme GDD §8 (fórmulas simples primeiro)
6. **Migração TypeScript + Vite**: preservando a separação sim/render
7. **Atualizar Three.js** para versão recente (validar sombras e intensidade de luzes)
8. **Testes automatizados de `src/sim/`** (a sim é pura — é testável sem navegador)

## Conduta

Passos pequenos e verificáveis. Não inventar features fora do GDD sem confirmar. Ao encontrar bug de design (regra ambígua), perguntar em vez de decidir sozinho. O objetivo é um jogo comercial: qualidade > velocidade.
