# Ferramentas do pipeline de modelos (rodar com Node)

Requisitos (uma vez): `npm i three@0.128.0 jimp@0.22.12` nesta pasta.

- **glb-kit.mjs** — cirurgia de .glb: ler/escrever, enxugar texturas
  (só a cor, 1024px), copiar animações entre arquivos do mesmo rig e
  GERAR clipes por keyframes (análise de esqueleto).
- **processa-feras6.mjs** — reconstrói `assets/feras/*.glb`. Fontes:
  1. `Feras/animações/extraidos/Meshy_AI_<nome>_biped*/` — animações
     RICAS casadas por NOME de arquivo (ver MAPA_NOMES: Walking→andar,
     Charged_Upward_Slash→combo1, Charged_Slash→combo2, Left_Hook→combo3,
     Ground_Slam→forte, Skill_01→arremesso (boca),
     mage_spell_cast→kame (mãos), Hit_Reaction→dano, Backflip→mortal...)
  2. `Feras/novas animações/` — Walking/Running clássicos
  3. `Feras/modelos 3d animados/` — modelo cru (tudo gerado)
  O gerador só cobre clipes que FALTAM.
- **processa-treinadores.mjs** — t1–t9 de `Treinadores/extraidos`.
- **inspeciona-glb.mjs \<pasta\>** — raio-X: tris, texturas, animações.

Fluxo com o Domador: baixar o pacote de animações da fera no Meshy →
extrair o zip em `Feras/animações/extraidos/` → rodar
`node processa-feras6.mjs` → conferir no jogo.
