# Mesada 🦊

Sistema de mesada por tarefas para Cesar e Arthur, com aprovação do Ericky.
O front é estático (GitHub Pages) e o backend é Google Apps Script com Google Sheets.

| Link | Quem | Cor |
|---|---|---|
| `https://SEU_USUARIO.github.io/REPO/#/cesar` | Cesar | azul |
| `https://SEU_USUARIO.github.io/REPO/#/arthur` | Arthur | verde |
| `https://SEU_USUARIO.github.io/REPO/#/ericky` | Ericky (painel) | branco |

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

## Como funciona

- **Relato:** foto (câmera ou galeria, comprimida para ~1000px JPEG) e áudio (até 3 min, Opus a ~24 kbps).
- **Mídia em base64 dividida em partes:** cada arquivo é quebrado em partes de 45.000 caracteres (o limite da célula é 50.000). Cada parte vira uma linha na aba `Midia` (`midia_id`, `parte`, `total`). Na leitura, as partes são juntadas na ordem. Um áudio de 1min30 tem umas 6 a 8 partes.
- **Avaliação:** nota de 1 a 10 ⭐ e valor livre de R$ 0,01 a R$ 10,00, ou **Refazer** com um áudio de resposta opcional. A criança refaz pelo mesmo card, e o relato volta para a fila.
- **Saldo** é sempre a soma da aba `Movimentos` (relato +, resgate −, estorno +). Não edite saldo à mão; para corrigir, adicione uma linha em `Movimentos`. Valores em **centavos**.
- **Loja:** o Ericky cadastra os itens (emoji e/ou imagem). O pedido de resgate reserva o saldo na hora. O Ericky marca como entregue, ou cancela, e aí o valor é estornado.
- **Ranking:** saldo, ganhos da semana (a partir de segunda) e do mês, e 8 medalhas.

## Abas da planilha
`Usuarios` · `Relatos` · `Midia` · `Loja` · `Resgates` · `Movimentos`
