# PIXEL ADVENTURE — A Jornada Perdida

Jogo de plataforma 2D feito para a disciplina **Desenvolvimento Web II — Trabalho G2** (trabalho individual).
Desenvolvido com HTML5, CSS3 e JavaScript puro (Canvas), sem bibliotecas e sem servidor.

> Aluno(a): Lucas José Assis Franca · Matrícula: 1022691 · Professor(a):Jota Pê · Data: 18/11/2026

## Objetivo
Controle um aventureiro, atravesse o cenário, **colete moedas** e **sobreviva por 60 segundos**. A partida termina
quando o cronômetro chega a zero ou quando o personagem encosta em um cacto, em espinhos ou cai em um buraco.
Pontuação = moedas × 100 + distância percorrida / 10.

## Como jogar
- Corra para a direita, pule os perigos e pegue o máximo de moedas.
- Caixas e pedras são sólidas: dá para subir nelas. Plataformas flutuantes só pisam por cima.
- Cactos, espinhos e buracos encerram a partida na hora.
- Ao fim, clique em **JOGAR NOVAMENTE** (ou tecle Enter) para recomeçar do zero.

## Controles
| Ação | Teclado | Celular/tablet |
|---|---|---|
| Esquerda / direita | `A` `D` ou `←` `→` | botões na tela |
| Pular | `Espaço`, `W` ou `↑` (segure para pular mais alto) | botão de seta para cima |
| Som liga/desliga | `M` | — |

## Requisitos acadêmicos atendidos
Background (`background.svg`) · Solo (`ground.svg`) · Parallax (nuvens, montanhas distantes, montanhas próximas e árvores em velocidades diferentes) ·
Pulo · Obstáculos que encerram o jogo · Moedas com contador (`MOEDAS: 05`) · Timer regressivo de 60 s · Letreiro GAME OVER · Botão de reiniciar.

## Estrutura
```
PIXEL-ADVENTURE/
├── index.html      página única (SPA)
├── style.css       interface, HUD e telas
├── script.js       jogo (física, colisão, parallax, HUD, telas)
├── assets/images/  SVGs em pixel art (player, player-defeated, background, ground, coin, crate, cactus, obstacles + clouds, mountains-far, mountains-near, trees, platform, decor, clock)
├── assets/audio/   (vazio: os sons são sintetizados pelo navegador com Web Audio)
└── tools/gen_assets.py  script que gerou as imagens (opcional; python3 tools/gen_assets.py)
```

## Tecnologias
HTML5 Canvas · CSS3 (animações com `steps()`, sprites por `background-position`) · JavaScript ES6 · SVG · Web Audio API.

## Como executar localmente
Basta dar duplo clique em `index.html` (Chrome, Edge, Firefox ou Safari atuais). Não precisa de servidor.
Opcional: `python3 -m http.server 8000` e abrir `http://localhost:8000`.
- A fase é gerada aleatoriamente a cada partida a partir de padrões de obstáculos testados (sempre há como passar).
- `window.PixelAdventure` expõe `step()` e `getState()` apenas para testes automatizados.
