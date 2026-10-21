# Mesada 🦊

Sistema de mesada por tarefas para Cesar e Arthur, com aprovação do Ericky.
O front é estático (GitHub Pages) e o backend é Google Apps Script com Google Sheets.

| Link | Quem | Cor |
|---|---|---|
| `https://SEU_USUARIO.github.io/REPO/#/cesar` | Cesar | azul |
| `https://SEU_USUARIO.github.io/REPO/#/arthur` | Arthur | verde |
| `https://SEU_USUARIO.github.io/REPO/#/ericky` | Ericky (painel) | branco |
| `https://SEU_USUARIO.github.io/REPO/#/tv` | Painel da TV | preto e vermelho |

Cada um abre o próprio link no celular e usa **Compartilhar → Adicionar à tela de início**.

## Deploy

### 1. Planilha e Apps Script
1. Crie uma Google Sheet nova (ex.: "Mesada").
2. Abra **Extensões → Apps Script**.
3. Cole o conteúdo de `apps-script/Code.gs` no `Código.gs`.
4. Em **Configurações do projeto**, marque "Mostrar arquivo appsscript.json" e cole o conteúdo de `apps-script/appsscript.json`.
5. Selecione a função `setup` e clique em **Executar**. Autorize o acesso; isso cria as abas e os 3 usuários.
6. Clique em **Implantar → Nova implantação → App da Web**:
   - Executar como: **Eu**
   - Quem pode acessar: **Qualquer pessoa**
7. Copie a URL que termina em `/exec`.

> Toda vez que mudar o `Code.gs`, use **Implantar → Gerenciar implantações → Editar → Nova versão**. Assim a URL continua a mesma.

### 2. Front no GitHub Pages
1. Cole a URL `/exec` em `config.js`.
2. Suba a pasta para um repositório no GitHub (a pasta `apps-script/` pode ir junto, só como referência).
3. Em **Settings → Pages**, escolha Branch `main` e pasta `/ (root)`.

## Onde fica cada coisa

**Crianças — 4 abas**
| Aba | O que tem |
|---|---|
| Início | Tarefas de hoje, missões, ofensiva e os 3 últimos relatos |
| Carteira | Três partes: **Saldo** (Pix, meta, últimas movimentações), **Cofrinho** (gerador, guardar/tirar, projeção) e **Ranking** |
| Loja | O que está na mochila, leilão, mercadinho e prêmios |
| Chat | Conversa da família |

O saldo aparece no topo do Início e da Loja; tocar nele abre a Carteira. O botão **📸 Relatar** fica no meio da barra de baixo, em todas as abas.

**Ericky — 5 abas + ＋ Criar**
| Aba | O que tem |
|---|---|
| Pendências | Tudo que espera você: relatos para avaliar e compras para entregar |
| Missões | Missões avulsas e tarefas fixas |
| Loja | Mercadinho, prêmios e leilões |
| Chat | Conversa da família |
| Resumo | Cartões dos filhos, ranking, gráfico, relatos avaliados, multas e entregas |

**＋ Criar** (topo do painel) reúne tudo que se cria: missão, tarefa fixa, mercadinho, prêmio, leilão, presente e multa.

## Painel da TV (`#/tv`)

Abra `…/#/tv` no navegador da Smart TV (ele leva para `tv.html`). A tela se ajusta sozinha a qualquer TV e não precisa de toque.

- **O que mostra:** os dois lado a lado (saldo, semana, mês, cofrinho rendendo ao vivo, ofensiva com patente e bichinho, meta com anel de progresso, se já relatou hoje), linha do tempo com o que cada um fez, ganhos das 8 semanas, últimas compras com foto, leilão ou missões abertas (ou o placar da semana) e um letreiro com recordes e metas.
- **Atualiza sozinho** a cada 1 min. Quando alguém ganha dinheiro, o card dele brilha e caem moedas; quando sobe de patente, a TV comemora.
- **Visual:** vídeo de fundo do hub do Kitsune (`video/`), cards de vidro, aurora vermelha e brasas. Em TV mais fraca, use `…/tv.html?leve` (sem desfoque nem brasas).
- **Som:** na primeira vez, aperte **OK** no controle da TV (o navegador só libera som depois de um toque). Isso também põe em tela cheia.
- **Noite (22h–7h):** fica mais escura, pausa o vídeo e consulta o servidor menos vezes.

**📺 Controle da TV** (botão no topo do painel do Ericky):
| Botão | Na TV |
|---|---|
| 🎤 Falar | O que você fala vira legenda gigante ao vivo (reconhecimento de voz do celular) |
| 🗣️ Recado de voz | Grava e a TV toca |
| ✍️ Escrever | Recado, parabéns, alerta ou letreiro no rodapé; a TV pode ler em voz alta |
| 😀 Emojis | Chuva do emoji tocado |
| 🎉 Comemorar | Holofote no filho, confete e palmas |
| 📸 Foto na TV | Foto em tela cheia com legenda |
| ⏱️ Contagem | Relógio regressivo grande, com alarme no fim |
| 🔊 Sons | Rufar, palmas, vitória, buzina, sirene, fracasso, alarme |
| 🃏 Pegadinhas | Zerar a carteira, multa gigante ou presente milionário — **só na TV**, o saldo de verdade não muda; "Revelar" mostra "É BRINCADEIRA!" (revela sozinho em 30 s) |
| 🧹 Limpar tela | Tira tudo da TV |

Os comandos chegam em 2–4 s (a TV pergunta a cada 1,5 s enquanto o controle está aberto e a cada 12 s no resto do tempo). Ficam só no cache do Apps Script; fotos e áudios mandados para a TV vão para a aba Midia e só os 6 últimos ficam guardados.

## Como funciona

- **Relato:** foto (câmera ou galeria, comprimida para ~1000px JPEG) e áudio (até 3 min, Opus a ~24 kbps).
- **Mídia em base64 dividida em partes:** cada arquivo é quebrado em partes de 45.000 caracteres (o limite da célula é 50.000). Cada parte vira uma linha na aba `Midia` (`midia_id`, `parte`, `total`). Na leitura, as partes são juntadas na ordem. Um áudio de 1min30 tem umas 6 a 8 partes.
- **Avaliação:** nota de 1 a 10 ⭐ e valor livre de R$ 0,01 a R$ 10,00, ou **Refazer** com um áudio de resposta opcional. A criança refaz pelo mesmo card, e o relato volta para a fila.
- **Saldo** é sempre a soma da aba `Movimentos` (relato +, resgate −, estorno +). Não edite saldo à mão; para corrigir, adicione uma linha em `Movimentos`. Valores em **centavos**.
- **Loja:** dois tipos de item. **Prêmios** (nome, emoji e/ou imagem) e **Mercadinho** (só foto + preço). Em *Loja → 🏪 Adicionar do mercadinho* o Ericky tira foto atrás de foto (ou escolhe várias da galeria), digita o preço de cada uma e manda todas de uma vez; a fila fica salva no aparelho até ir para a loja. A compra reserva o saldo na hora e o item vai para a mochila.
- **Entregar:** aba do painel com a mochila de cada filho (foto grande). *Entregar* tira o item da mochila; *Entregar tudo* faz de uma vez; *✕* cancela e devolve o valor.
- **Ranking:** saldo, ganhos da semana (a partir de segunda) e do mês, e 8 medalhas.
- **Missões avulsas:** o Ericky tira uma foto de algo para fazer (ex.: cama desarrumada) e põe um preço (até R$ 100,00). A missão aparece no Início dos dois; o primeiro que mandar o relato pega a missão (o outro vê "🔒 fulano"). Na fila, o relato vem marcado com a missão e o valor já preenchido. Aprovou: a missão vai para "Concluídas" e sai um aviso no chat. Se o relato for apagado antes da aprovação, a missão volta para o catálogo.
- **Cofrinho:** saldo separado que rende por dia, com juros compostos, a **metade do CDI** (≈ metade de um CDB 100% do CDI). O CDI vem do Banco Central (série 12 do SGS) uma vez por dia; se a consulta falhar, usa o último valor conhecido. O rendimento do dia é creditado na primeira abertura do app no dia seguinte, e a tela anima o pedaço do dia em curso. Os valores da aba `Cofre` ficam em centavos **com casas decimais** (o rendimento é fração de centavo); só centavos inteiros voltam para o saldo.
- **Meta:** cada irmão escolhe um prêmio da loja; o progresso soma saldo + cofrinho.
- **Missão em dupla:** na criação, "Em dupla" em vez de "o primeiro que pegar". Um relato vale pelos dois; na aprovação o valor é dividido (o centavo ímpar fica com quem mandou). A parte do outro entra como `missao_dupla` em `Movimentos`.
- **Tarefas fixas:** nome, emoji, valor (até R$ 10,00), dias da semana e para quem. Aparecem em "Tarefas de hoje" no Início; cada irmão manda uma vez por dia e o valor vem preenchido na avaliação.
- **Presente do pai:** botão 🎁 no painel. Pix surpresa com mensagem, para um ou para os dois (valor para cada um). Na criança abre uma caixa de presente na próxima vez que ela entra (marcado como visto no próprio aparelho).
- **Multas:** botão ⚠️ no painel. Motivo, valor (até R$ 10,00) e foto opcional; sai do saldo na hora (o saldo pode ficar negativo) e aparece no chat. Dá para perdoar depois: o valor volta.
- **Leilão:** na aba Loja do painel. Os dois dão lances com o saldo; o lance fica reservado e volta na hora para quem for coberto. Lance nos 2 minutos finais prorroga o fim. Quando termina, o lance do vencedor vira um pedido na mochila (marque **Atendi** como nos outros).
- **Gráficos:** ganhos por semana (8 semanas, os dois) no Ranking; projeção de 12 meses do cofrinho, comparando "só o que tem" com "guardando R$ X por semana".

## Abas da planilha
`Usuarios` · `Relatos` · `Midia` · `Loja` · `Resgates` · `Movimentos` · `Mensagens` · `Missoes` · `Cofre` · `Tarefas` · `Multas` · `Leiloes`

As abas novas nascem sozinhas. Depois de atualizar o `Code.gs`, rode `setup` uma vez pelo editor: isso grava os cabeçalhos das colunas novas (`meta_item`, `missao_id`, `tarefa_id`, `tipo` da missão) e pede a autorização para acessar a internet (consulta do CDI no Banco Central). Depois, **Nova versão** na implantação.
