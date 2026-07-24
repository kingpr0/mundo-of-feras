# Região Ferândia — mapa-múndi v2 ("o Mar do Meio")

Dois continentes partidos por um **mar que atravessa o meio da região**,
com uma ilha neutra no centro. Frio cresce para o NORTE (até a Muralha e
além), calor cresce para o SUL (até o vulcão e o deserto profundo).
**11 áreas jogáveis hoje** (o continente sul é o lar delas); o resto é
expansão planejada. Tudo entra pelo sistema de dados de `mapas.json`.

## A espinha dorsal (de sul a norte)

1. **Continente Sul (quente)** — o berço: Vila Clareira, Verdejante e as
   rotas atuais; ao sul, Dunas → Oásis Solar → Ruínas Douradas → Vale
   Bravo; a sudeste, o vulcão **Monte Fervura** e a **Cidade Forja**.
2. **Mar do Meio** — corta a região de leste a oeste. Travessia por
   **balsa**: Porto Maresia (sul) ⚓ → **Ilha Farol** (centro, cidade
   neutra com a Torre do Eremita) ⚓ → Porto Boreal (norte). A leste da
   ilha, a **Fossa Abissal** esconde a lendária das águas.
3. **Continente Norte (frio)** — Floresta Fechada e Campos Frios na costa;
   subindo, Trilha Nevada, Vila Nevada e as Minas Ecoantes; e então...
4. **A MURALHA DE GELO** — atravessa TODOS os mapas do extremo norte, de
   costa a costa. Um portão único (fechado no início) e uma **missão de
   escalada** para atravessá-la. Além dela: os Ermos Gelados, os Picos Sem
   Nome e o **Monte Alvorada com a Liga das Feras** — o final do jogo é
   literalmente além da Muralha.

## Referências assumidas (e o que roubamos de cada uma)

| Fonte | O que vira no jogo |
|-------|--------------------|
| **Game of Thrones** | A Muralha de gelo contínua no norte; missão de escalada; "Além da Muralha" como zona selvagem de alto nível |
| **Senhor dos Anéis** | Monte Fervura = a Montanha da Perdição (jornada ao coração do vulcão); **Minas Ecoantes** = Moria, travessia subterrânea sob a Muralha; a **Árvore Anciã** da Floresta Fechada (Fangorn) dá missão; balsa final = Portos Cinzentos |
| **One Piece** | O Mar do Meio é a nossa Grand Line: travessias de balsa, cada margem um mundo, a Ilha Farol como parada neutra |
| **Dragon Ball** | **Torre do Eremita** na Ilha Farol: treino de escalada + o mestre que ensina o **golpe supremo** (a mecânica removida volta como RECOMPENSA de missão!) |
| **Moby Dick** | Os pescadores do Porto Maresia juram ter visto "a sombra na Fossa" — a caçada à lendária das águas |
| **El Dorado** | Ruínas Douradas: cidade perdida no deserto profundo, quebra-cabeças e feras de pedra |
| **Avatar / Pokémon** | Ginásios elementais espalhados como as nações dos elementos; um por bioma |

## O canto noroeste: o Fiorde e o Castelo

A oeste do Penhasco do Vento, **montanhas contornam o mar** formando o
Fiorde Ventania: encostas escarpadas com casas de madeira penduradas
(estilo vila viking) subindo até o **Castelo Ventania**, a fortaleza dos
Senhores do Vento no ponto mais alto das falésias — de lá se enxerga o Mar
do Meio inteiro. Papel na história: convoca domadores com 3 insígnias e
concede o favor que (junto da 4ª insígnia) destrava a balsa
(ver `HISTORIA.md`).

## As DUAS lendárias (capa do jogo) — NOMES E TIPOS PROVISÓRIOS

- **#31 Fervorax** (fogo/dragão, proposta) — dorme no coração do Monte
  Fervura; o vulcão fumega quando ela sonha. Despertar = missão pós-4ª
  insígnia.
- **#32 Abissomar** (água/sombra, proposta) — a serpente da Fossa Abissal;
  só emerge numa noite de tempestade, atraída pela balsa.
- **#30 Auroram** (gelo, proposta) vira a **terceira secreta** estilo Mew:
  rumores nos Picos Sem Nome, além da Muralha, pós-Liga.

## A jornada (insígnias em ordem)

1. **Verdejante (planta)** — tutorial, a dois passos de casa.
2. **Oásis Solar (pedra)** — atravessando as Dunas.
3. **Cidade Forja (fogo)** — na sombra do vulcão. → *o Castelo Ventania convoca*
4. **Porto Maresia (água)** — com o favor do Castelo, destrava a BALSA. → *missão da lendária de fogo*
5. **Vila Nevada (gelo)** — do outro lado do mar. → *missão Abissomar disponível*
6. **A Muralha** — missão de escalada (ou as Minas Ecoantes, para os espertos).
7. **Liga das Feras** — Monte Alvorada, além da Muralha.

## Regras de coerência do mundo

- Biomas encostam com transição (campo → terra → deserto; costa → neve).
- Água é barreira até a balsa existir; a Muralha é barreira até a missão.
- Cavernas são atalhos destraváveis (Sombria já existe; Ecoantes e Gelada virão).
- Toda área nova nasce com: espécies do catálogo coerentes com o bioma,
  1+ treinador NPC, 1 placa e um marco visual próprio (padrão-fogueira).
