# Akylla Shop

Loja online da **Akylla Shop** (eletrônicos e acessórios, Goiânia/GO). O projeto tem:

- catálogo com fotos, estoque e promoções;
- sacola e checkout por **PIX** (automático pelo Mercado Pago ou manual) e **cartão de crédito em até 12x** (página segura do Mercado Pago), com retirada ou entrega e frete calculado pelo CEP;
- página **Acompanhar pedido** para o cliente (situação, etapas e itens) e o site lembrando nome e WhatsApp;
- **reserva automática de estoque** quando o cliente envia o comprovante;
- **painel administrativo** que roda no celular ou no PC: estoque, produtos, fotos, promoções, frete, pedidos (com etapas de entrega), **clientes** e dashboard de vendas;
- **avisos de pedido novo** com som e notificação no celular e no PC;
- gerador de **anúncios 9:16** para Instagram e Facebook.

Custo mensal: **zero**. GitHub Pages e Cloudflare Workers são grátis nesse volume. O único gasto é o domínio, cerca de R$ 40 a R$ 60 por ano.

![Prévia da Akylla Shop](assets/img/og-cover.jpg)

> **Vai montar a sua própria loja a partir desta?** Siga o [**Guia: criar uma loja nova a partir deste projeto**](#3-guia-criar-uma-loja-nova-a-partir-deste-projeto). Ele vai do zero até a primeira venda.

---

## Comece aqui (explicação em 1 minuto)

Pense na loja como **três peças** que conversam entre si:

| Peça | O que é, em palavras simples | Onde fica |
|---|---|---|
| **A vitrine** | O site que o cliente vê: produtos, sacola, checkout e "Meus pedidos". | GitHub Pages (grátis) |
| **O caixa** | Um pequeno servidor que confere preço e estoque, gera o PIX ou o link do cartão, guarda os pedidos e te avisa no celular. | Cloudflare Worker (grátis) |
| **O escritório** | O painel `/admin/`, onde você cuida de tudo: pedidos, estoque, preços, promoções, frete, clientes e artes para as redes. | No próprio site, protegido por uma chave |

**Regra de ouro:** tudo o que você muda no painel só vai para o site quando você clica em **Publicar** (cerca de 1 minuto depois aparece para o cliente).

### O dia a dia da loja (passo a passo)

| Quero… | Faço assim |
|---|---|
| Saber quando chega pedido | Painel → **Pedidos** → *Avisos de pedido* → **Ativar** (uma vez em cada aparelho). Toca som e chega notificação. |
| Confirmar um PIX manual | Confira o dinheiro no banco → painel → **Pedidos** → **✓ Confirmar pagamento**. |
| Avisar o cliente que está pronto | **Pedidos** → filtro **Para entregar** → botão da etapa (*Pronto*, *Saiu para entrega*, *Entregue*) → botão **WhatsApp** (a mensagem já vem pronta). |
| Repor estoque | **Estoque** → **+1 (repus)** ou digite a quantidade → **Publicar**. |
| Colocar produto novo | **Produtos** → **+ Novo produto** → preencha, envie as fotos e salve → **Publicar**. Para conferir antes de mostrar ao cliente, deixe o produto **fora da loja** e depois use **✓ Colocar na loja**. |
| Fazer promoção | **Promo** → ligue a promoção, escolha o % e a data final → **Publicar**. |
| Fazer arte para Instagram/TikTok/WhatsApp | **Artes** → escolha o produto, o estilo (⭐ *Anúncio* é o padrão) e os formatos → **Gerar artes** → **Baixar** ou **Compartilhar** e copie a legenda pronta. |
| Ver quanto vendi | **Início** (dashboard) → escolha o período. |

### O que o sistema faz sozinho (para você não se preocupar)

- **Reserva o estoque** assim que o cliente gera o pedido, para dois clientes não comprarem a mesma última unidade.
- **Devolve o estoque** de pedido não pago: PIX automático em 30 min, cartão em 1 h, PIX manual em 48 h.
- **Vende além do estoque de casa** até o limite de reposição (padrão +10) e marca no pedido quantos você precisa comprar no fornecedor.
- **Junta as suas edições com as vendas.** Se uma venda acontecer enquanto o painel está aberto, o **Publicar** mantém o que você editou e respeita o estoque novo, sem conflito.
- **Cartão aprovado depois de cancelado** (o cliente pagou numa aba esquecida): o pedido vai para **Conferir pagamento** e você é avisado, para entregar ou devolver o valor.
- **O cliente nunca fica preso:** no pedido em aberto ele pode **concluir o cartão**, **trocar para PIX** ou **cancelar**. A seta "voltar" do celular fecha janelas sem sair do site, e voltar da página do Mercado Pago cai no pedido dele.

---

## Índice

0. [Comece aqui (explicação em 1 minuto)](#comece-aqui-explicação-em-1-minuto)
1. [Endereços](#1-endereços)
2. [Como tudo funciona (visão geral)](#2-como-tudo-funciona-visão-geral)
3. [Guia: criar uma loja nova a partir deste projeto](#3-guia-criar-uma-loja-nova-a-partir-deste-projeto)
4. [Como a compra funciona (cliente e loja)](#4-como-a-compra-funciona-cliente-e-loja)
5. [Painel administrativo](#5-painel-administrativo-admin)
6. [Preços, promoções, estoque e frete](#6-preços-promoções-estoque-e-frete)
7. [Servidor (Cloudflare Worker)](#7-servidor-cloudflare-worker)
8. [Domínio, DNS e HTTPS](#8-domínio-dns-e-https)
9. [Como atualizar o site](#9-como-atualizar-o-site)
10. [Anúncios 9:16 para Instagram/Facebook](#10-anúncios-916-para-instagramfacebook)
11. [Estrutura de arquivos](#11-estrutura-de-arquivos)
12. [Formato dos dados](#12-formato-dos-dados)
13. [PIX](#13-pix)
14. [Testes automáticos](#14-testes-automáticos)
15. [Segurança, chaves e privacidade](#15-segurança-chaves-e-privacidade)
16. [Problemas comuns e soluções](#16-problemas-comuns-e-soluções)
17. [Pendências](#17-pendências)
18. [Histórico](#18-histórico)
19. [Créditos e licenças](#19-créditos-e-licenças)

---

## 1. Endereços

| O quê | Endereço |
|---|---|
| **Loja** | <https://akyllashop.com/> |
| **Painel admin** | <https://akyllashop.com/admin/> |
| **Servidor (API)** | <https://akylla-shop-api.akyllashop.workers.dev> (teste: `/api/health`) |
| Política de privacidade | <https://akyllashop.com/privacidade.html> |
| Termos de uso | <https://akyllashop.com/termos.html> |
| Repositório (código) | <https://github.com/Tanattos18/Akylla_Store> |
| Endereço antigo | `https://tanattos18.github.io/Akylla_Store/` (redireciona para o atual) |

- **Branch publicada:** `main`, pasta raiz `/`. Cada commit na `main` publica o site em cerca de 1 minuto.
- **Domínio** registrado na **Hostinger**.
- **Tecnologia:** HTML, CSS e JavaScript puros, sem build e sem framework. O servidor é um Cloudflare Worker (JavaScript).

---

## 2. Como tudo funciona (visão geral)

```
┌──────────────────────────┐        ┌──────────────────────────────┐
│  Cliente (navegador)     │        │  Você (painel /admin/)       │
│  akyllashop.com          │        │  celular ou PC               │
└───────┬──────────┬───────┘        └──────┬──────────────┬────────┘
        │ lê o site│ envia o pedido        │ edita e      │ pedidos, confirmar/cancelar,
        │          │ (PIX manual)          │ publica      │ dashboard, avisos push
        ▼          ▼                       ▼              ▼
┌──────────────┐ ┌───────────────────────────┐   ┌──────────────────────┐
│ GitHub Pages │ │ Cloudflare Worker (API)   │──▶│ GitHub (repositório) │
│ (site grátis)│ │ recalcula preço e frete,  │   │ products.js/config.js│
└──────▲───────┘ │ reserva/devolve o estoque,│   │ = "banco de dados"   │
       │         │ guarda pedidos (KV),      │   └──────────▲───────────┘
       │         │ manda notificação push    │              │
       │         └───────────────────────────┘              │
       └──────────── o GitHub Pages publica cada commit ─────┘
```

- **O "banco de dados" do catálogo é o próprio repositório.** O arquivo `assets/js/products.js` guarda produtos, preços, estoque e fotos, e o `assets/js/config.js` guarda WhatsApp, PIX, promoção e frete. O painel e o servidor alteram esses arquivos por commits na API do GitHub, e o GitHub Pages publica o resultado.
- **Os pedidos** ficam no **Cloudflare KV**, um banco simples do Worker. Pedidos confirmados ficam guardados para sempre. Os demais expiram em 120 dias.
- **Os preços são sempre recalculados no servidor.** O navegador do cliente não decide valores.

---

## 3. Guia: criar uma loja nova a partir deste projeto

Este guia cria uma loja **igual a esta**, com a sua marca, seus produtos e suas contas. Siga na ordem. Nenhuma senha passa por este documento: cada pessoa cria as suas próprias chaves.

### 3.1 O que você vai precisar

| Item | Para quê | Custo |
|---|---|---|
| Conta no **GitHub** (github.com) | guardar o código e hospedar o site (GitHub Pages) | grátis |
| Conta na **Cloudflare** (dash.cloudflare.com) | servidor de pedidos (Worker + KV) | grátis |
| **Domínio** (ex.: Hostinger, Registro.br) | endereço próprio, ex.: `minhaloja.com` | ~R$ 40–60/ano (opcional) |
| **Chave PIX** da loja | receber os pagamentos | grátis |
| **WhatsApp** da loja | atendimento e comprovantes | — |
| No computador: **Git**, **Node.js 18+** (nodejs.org), **Python 3** + `pip install pillow` (só para os anúncios), **VS Code** (opcional) | editar e publicar | grátis |
| Logo e fotos dos produtos | identidade visual | — |

### 3.2 Copiar o projeto para a sua conta

1. No GitHub, crie um repositório **novo e vazio**, por exemplo `Minha_Loja`. Ele precisa ser **Public** para usar o GitHub Pages grátis. Não marque README nem .gitignore.
2. No computador (PowerShell no Windows):

```bash
git clone https://github.com/Tanattos18/Akylla_Store.git Minha_Loja
cd Minha_Loja
```

```powershell
Remove-Item -Recurse -Force .git        # começa um histórico novo, só seu
```

```bash
git init -b main
git config user.name "Seu Nome"
git config user.email "seu-email@exemplo.com"
git add -A
git commit -m "primeira versão da minha loja"
git remote add origin https://github.com/SEU_USUARIO/Minha_Loja.git
git push -u origin main
```

### 3.3 Trocar a identidade da loja (o que editar e onde)

Abra a pasta no VS Code e use **Localizar em arquivos** (`Ctrl+Shift+F`) para achar cada valor. Esta tabela lista **tudo** o que é específico da Akylla Shop:

| O que trocar | Onde | Exemplo atual → seu valor |
|---|---|---|
| **Dono e nome do repositório** (o painel usa para publicar) | `admin/admin.js` → `var OWNER` e `var REPO` | `Tanattos18` / `Akylla_Store` → `SEU_USUARIO` / `Minha_Loja` |
| **Domínio** | `CNAME`, `robots.txt`, `sitemap.xml`, `index.html`, `privacidade.html`, `termos.html` (links `canonical`, `og:url`, `og:image`, dados JSON-LD) | `akyllashop.com` → `minhaloja.com` |
| **Nome da loja, textos e chamadas** | `index.html` (topo, sobre, como funciona, FAQ, rodapé), `<title>` e `description` das 3 páginas | "Akylla Shop", "Curadoria tech em Goiânia"… |
| **Identificação do vendedor** (exigida pelo Decreto 7.962/2013) | rodapé de `index.html`, `privacidade.html` e `termos.html` (procure "Vendedor responsável") e o JSON-LD no topo do `index.html` | nome, **CPF ou CNPJ**, endereço e CEP |
| **Recebedor do PIX mostrado no checkout** | `index.html` (procure `pix-holder`) e painel → Loja | nome do titular da chave |
| **Telefone e WhatsApp fixos no HTML** | `index.html`, `privacidade.html`, `termos.html` (procure `wa.me/` e o número formatado) | `556281517002` / `(62) 8151-7002` |
| **Logo, ícones e capa** | `assets/img/logo-mark.jpg` (ícone quadrado), `assets/img/favicon.png`, `assets/img/vitrine.jpg` (1000×1000) e `vitrine-640.jpg`, `assets/img/og-cover.jpg` (1200×630, aparece ao compartilhar o link), `admin/icon-192.png`, `admin/icon-512.png`, `admin/apple-touch-icon.png` | arte da sua marca |
| **Cores** | `assets/css/styles.css` e `admin/admin.css` (variáveis `--brand` e afins no início do arquivo) | laranja `#ff8a00` |
| **Nome do painel instalado como app** | `admin/manifest.webmanifest` e `admin/index.html` (`apple-mobile-web-app-title`) | "Painel Akylla" |
| **Servidor (Worker)** | `worker/wrangler.toml` → `name`, `GITHUB_REPO`, `ALLOWED_ORIGINS`, `STORE_WHATSAPP` e o `id` do KV (passo 3.6); `worker/package.json` → `name`; `worker/definir-chaves.ps1` (endereço do `/api/health` no fim) | `akylla-shop-api` → `minhaloja-api` |
| **Assinatura das notificações** | `worker/src/index.js` → `PUSH_SUBJECT` | `https://akyllashop.com` → `https://minhaloja.com` |
| **Frete padrão** (vale só até você salvar a aba Frete do painel) | `assets/js/frete.js` → `DEFAULTS` (origem, cidades) e o `User-Agent` | endereço e coordenadas da loja |
| **Catálogo** | `assets/js/products.js` (produtos e categorias) e as fotos em `assets/img/products/` | apague os produtos da Akylla e cadastre os seus **pelo painel** (passo 3.5) |
| **Configuração da loja** | `assets/js/config.js` | edite **pelo painel → Loja / Frete / Promoção** (passo 3.5) |
| **Testes** | `tests/worker.test.js` usa ids de produtos da Akylla (`w34-plus`, `w69-ultra`, `hw8-pro-max`, `w31-pro-max`) | troque por ids do seu catálogo (passo 3.9) |
| **Documentos da Akylla** | `README.md`, `CHECKLIST_MELHORIAS_AKYLLA_SHOP.md`, `docs/` | reescreva ou apague |
| **Anúncios** | `ferramentas/anuncios/anuncios.js` (textos por produto) | seus produtos (seção 10) |

Para ver o site no seu computador, rode `python -m http.server 8000` e abra <http://localhost:8000>. Depois publique:

```bash
git add -A
git commit -m "identidade da minha loja"
git push
```

### 3.4 Ligar o site (GitHub Pages) e o domínio

1. No repositório: **Settings → Pages → Build and deployment → Deploy from a branch** → `main` / `(root)` → **Save**.
2. Sem domínio, o site fica em `https://SEU_USUARIO.github.io/Minha_Loja/`. Nesse caso **apague o arquivo `CNAME`**.
3. Com domínio:
   - no seu registrador, crie os registros DNS da [seção 8](#8-domínio-dns-e-https), trocando `tanattos18.github.io` por `SEU_USUARIO.github.io`;
   - em Settings → Pages → **Custom domain**, coloque `minhaloja.com` e salve;
   - quando o certificado sair (de minutos até cerca de 1 hora), marque **Enforce HTTPS**.

### 3.5 Entrar no painel e cadastrar a loja

1. Crie a **chave do painel** no GitHub:
   - abra **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**;
   - em *Repository access*, escolha **Only select repositories** → `Minha_Loja`;
   - em *Permissions → Repository permissions*, dê **Contents: Read and write**. Mais nada;
   - copie a chave (começa com `github_pat_`). **Não mande essa chave para ninguém.**
2. Abra `https://minhaloja.com/admin/`, cole a chave e entre.
3. Na aba **Loja**, preencha:
   - nome, cidade, WhatsApp (só dígitos, com 55 e DDD), mensagem inicial;
   - **chave PIX**, recebedor, nome e cidade do QR (sem acento, até 25 e 15 letras);
   - textos de entrega, garantia, trocas e pagamento;
   - foto da vitrine.
4. Na aba **Frete**, configure o endereço da loja (latitude e longitude: no Google Maps, clique com o botão direito no local e copie), as faixas de distância, as cidades, a retirada e a transportadora. Use o simulador de CEP.
5. Na aba **Produtos**, apague os produtos da Akylla e cadastre os seus com fotos. O painel converte as fotos para o tamanho certo. Use a calculadora de preço (custo e margem).
6. Na aba **Promoção**, ligue ou desligue o desconto.
7. Clique em **Publicar**. O site atualiza em cerca de 1 minuto.
8. **Teste o PIX:** compre algo barato no próprio site e pague com o app do banco. O QR precisa abrir com o valor certo e o nome do recebedor.

### 3.6 Publicar o servidor de pedidos (Cloudflare Worker)

Sem o servidor, a loja funciona, mas o pedido só chega pelo WhatsApp e o estoque é baixado à mão. Com o servidor, há reserva automática de estoque, aba Pedidos, dashboard e avisos.

No computador, dentro da pasta do projeto:

```bash
cd worker
npx wrangler@3 login                         # abre o navegador: autorize a sua conta Cloudflare
npx wrangler@3 kv namespace create ORDERS    # mostra um "id": copie
```

1. Cole o `id` em `worker/wrangler.toml`, no campo `[[kv_namespaces]] → id`, no lugar do id atual.
2. Confira o resto do `wrangler.toml`:
   - `name`: nome do servidor, vira o endereço `https://NOME.SUBDOMINIO.workers.dev`;
   - `GITHUB_REPO = "SEU_USUARIO/Minha_Loja"`;
   - `ALLOWED_ORIGINS`: os endereços do seu site, separados por vírgula, por exemplo `https://minhaloja.com,https://www.minhaloja.com`. Sem domínio, use `https://SEU_USUARIO.github.io`;
   - `STORE_WHATSAPP`: WhatsApp da loja, só dígitos.
3. Publique:

```bash
npx wrangler@3 deploy                        # mostra o endereço do servidor
```

   Na primeira vez, a Cloudflare pede para escolher o **subdomínio workers.dev** da conta. Escolha um nome, por exemplo `minhaloja`.
4. Crie a **chave do servidor** no GitHub:
   - é uma chave fine-grained igual à do painel (Contents: Read and write, só no repositório da loja);
   - dê um nome diferente, por exemplo "Servidor", e validade de 1 ano;
   - **anote a data** para renovar.
5. Cadastre essa chave como **segredo** no servidor. O comando pede para colar a chave e ela não aparece na tela:

```powershell
& .\definir-chaves.ps1
```

   Sem PowerShell, use `npx wrangler@3 secret put GITHUB_TOKEN`.
6. Abra `https://SEU-SERVIDOR.workers.dev/api/health`. Deve mostrar `"configured": true`.
7. No painel → **Loja** → *Endereço do servidor*, cole `https://SEU-SERVIDOR.workers.dev`. Em *Forma de pagamento*, deixe **PIX manual** e clique em **Publicar**.
8. **Teste completo:**
   - faça um pedido no site e toque em *Enviar comprovante*;
   - o estoque do produto deve cair (aparece um commit "reserva: pedido …");
   - o pedido aparece no painel → **Pedidos**;
   - cancele o pedido: o estoque deve voltar.

### 3.7 Ativar os avisos de pedido (celular e PC)

No painel → **Pedidos** → **Ativar avisos neste aparelho** → permita as notificações → **Enviar aviso de teste**. Repita em cada aparelho.

- **iPhone:** antes de ativar, instale o painel. No Safari, toque em Compartilhar → **Adicionar à Tela de Início** e abra pelo ícone.
- Não há chave para configurar: o servidor cria as próprias chaves das notificações.

### 3.8 Opcionais

- **Aviso de venda no WhatsApp da loja (CallMeBot):** o robô gratuito às vezes fica sem vagas. Siga o site callmebot.com e cadastre a chave com `definir-chaves.ps1` (segundo item).
- **PIX automático pelo Mercado Pago:** veja a [seção 7.4](#74-mercado-pago-pix-automático).
- **Anúncios 9:16:** veja a [seção 10](#10-anúncios-916-para-instagramfacebook).

### 3.9 Ajustar os testes ao seu catálogo

```bash
node --test "tests/*.test.js"
```

- Se aparecer falha citando `w34-plus` ou outro id, abra `tests/worker.test.js` e troque esses ids por ids de produtos **seus** (veja na aba Produtos ou em `products.js`).
- O teste de identificação procura `CPF 000.000.000-00` e `CEP 00000-000` no rodapé. Com **CNPJ**, ajuste a expressão em `tests/site.test.js` (procure "identificam o vendedor").
- Os testes rodam sozinhos no GitHub a cada `git push` (aba **Actions**).

### 3.10 Checklist final antes de divulgar

- [ ] Nome, CPF/CNPJ e endereço corretos no rodapé, na privacidade e nos termos.
- [ ] QR do PIX testado num app de banco, com valor e recebedor certos.
- [ ] WhatsApp do botão abre a conversa certa.
- [ ] Frete testado com 2 ou 3 CEPs conhecidos.
- [ ] Pedido de teste: reserva → aparece no painel → confirmar ou cancelar → estoque correto.
- [ ] Aviso de teste recebido no celular e no PC.
- [ ] HTTPS ativo (cadeado no navegador).
- [ ] Ao compartilhar o link no WhatsApp, a capa (`og-cover.jpg`) e o nome aparecem certos. O WhatsApp guarda a prévia em cache: teste com `?v=2` no fim do link.

---

## 4. Como a compra funciona (cliente e loja)

**Modo atual da Akylla Shop: PIX automático pelo Mercado Pago** (seção 7.4) + **cartão em até 12x** (seção 4.1), com o PIX manual abaixo como alternativa (painel → Loja → *Forma de pagamento*). Fluxo do PIX manual com reserva de estoque:

1. O cliente monta a sacola. No celular, uma **barra fixa** mostra os itens, o total e o botão **Finalizar**.
2. No checkout, escolhe **retirar na loja** (grátis) ou **entregar**. Para entrega, informa CEP e número, e o frete é calculado na hora ([6.4](#64-frete-e-entrega)).
3. Aparecem o **QR do PIX** e o código copia e cola com o valor exato (produtos com desconto mais frete).
4. O cliente paga, informa **nome** e **WhatsApp** e toca em **Enviar comprovante**.
5. O site manda o pedido ao servidor (`POST /api/manual-orders`), que:
   - **recalcula** preço, promoção e frete com o catálogo publicado;
   - confere o estoque e **reserva**, ou seja, já baixa no `products.js`. Aparece um commit "reserva: pedido AK-… aguardando confirmação do PIX" e o item sai da vitrine;
   - guarda o pedido como *Aguardando confirmação do PIX*;
   - manda **notificação push** para os aparelhos da loja (e o aviso no WhatsApp, se o CallMeBot estiver ativo).
6. Abre o **WhatsApp da loja** com o pedido completo (número, data, cliente, itens com código, entrega e total), e o cliente envia o comprovante nessa conversa.
7. Você confere o PIX no banco e, no painel → **Pedidos**:
   - **✓ Confirmar pagamento**: a venda fica confirmada, entra no dashboard e o item continua fora do estoque;
   - **Cancelar e devolver ao estoque**: o item volta para a vitrine (commit "estoque devolvido: …").
8. **Sem confirmação em 48 h**, o servidor cancela sozinho e devolve o estoque. Ele verifica de hora em hora.

Proteções:
- no máximo **5 pedidos por hora por aparelho**;
- se acabou o estoque, o pedido é recusado e o cliente é avisado;
- se o servidor estiver fora do ar, o pedido segue só pelo WhatsApp, sem reserva. Nesse caso, ajuste o estoque no painel.

---

## 4.1 Cartão de crédito (até 12x)

- **Como liga:** painel → **Loja** → *Cartão de crédito*: marque **Aceitar cartão**, escolha **parcelar em até** (1x a 12x) e informe a **taxa por venda do Mercado Pago** (a do simulador do app, meio de cobrança **Checkout**, na opção de recebimento que você escolheu — ex.: 4,98%) → **Publicar**.
- **Preço no cartão:** preço do PIX ÷ (1 − taxa). Com 4,98%, o cartão fica 5,24% acima do PIX (R$ 130,00 → R$ 136,82) e você recebe o mesmo valor do PIX. A diferença aparece clara para o cliente no checkout (a lei permite preço diferente por forma de pagamento, desde que informado).
- **Juros das parcelas:** o Mercado Pago cobra do cliente e mostra antes de ele confirmar. Você recebe o valor sem desconto de parcelas.
- **Fluxo:** no checkout, bloco **"Prefere cartão de crédito?"** → o servidor recalcula tudo, **reserva o estoque por 1 h** e abre a página do Mercado Pago (o cartão é digitado só lá; PIX e boleto ficam fora dessa página) → aprovado, o Mercado Pago avisa o servidor (webhook *Pagamentos*), o estoque baixa (uma vez só), chega a notificação "✅ Venda paga" e o cliente volta para a página **Acompanhar pedido**, que confirma sozinha e esvazia a sacola.
- **Cartão recusado:** o cliente pode tentar outro cartão na mesma página. Sem pagamento em 1 h, a reserva cai e o pedido é encerrado (verificação de hora em hora).
- **Prazo para receber:** é configurado na sua conta do Mercado Pago (*Seu negócio → Custos*). Quanto mais rápido, maior a taxa — use essa taxa no painel.
- No Mercado Pago, a aplicação precisa ter o webhook com os eventos **Order** (PIX) **e Pagamentos** (cartão), mesma URL e mesma assinatura.

## 4.2 Acompanhar pedido e etapas

- **Cliente:** <https://akyllashop.com/pedido.html> (link no rodapé, no menu e nas mensagens do WhatsApp). Digita o número do pedido e o WhatsApp da compra e vê: situação do pagamento, etapas (Recebido → Pago → Separando → Pronto para retirada / Saiu para entrega → Entregue), itens, total e forma de pagamento. Não mostra endereço nem telefone. O aparelho lembra os pedidos feitos nele.
- **Loja:** painel → **Pedidos** → filtro **Para entregar** → em cada pedido pago, botões de **Etapa**. Depois de mudar a etapa, o botão **WhatsApp** já traz a mensagem certa ("pronto para retirada", "saiu para entrega"…) com o link de acompanhamento.
- **Meus pedidos** no topo do site leva à página de acompanhamento.
- **Pagamento no cartão não concluído** (o cliente voltou do Mercado Pago sem pagar): a página principal e a página do pedido mostram três botões:
  - **Concluir pagamento no cartão:** volta para a mesma página do Mercado Pago;
  - **Prefiro pagar no PIX:** cancela o pedido no cartão (devolve a reserva), mantém os produtos na sacola e abre o checkout para pagar no PIX, que sai mais barato;
  - **Cancelar pedido:** devolve a reserva na hora.

  Se o cliente iniciar outro pagamento no cartão, o anterior é cancelado sozinho. Sem ação, a reserva vence em 1 h.
- **Voltar sem se perder:**
  - a página do Mercado Pago não tem botão "voltar para a loja" (é do Mercado Pago, não dá para mudar). Por isso o site abre o cartão a partir da página do pedido: a **seta voltar** do navegador cai direto no pedido, com os três botões acima;
  - no celular, a seta **voltar** fecha a janela aberta (produto, sacola, checkout, menu) em vez de sair do site;
  - todas as páginas têm **← Voltar para a loja** e o logo leva à página inicial.
- O site também **lembra nome, WhatsApp e e-mail** do cliente no próprio aparelho para a próxima compra.

## 5. Painel administrativo (`/admin/`)

O painel edita os arquivos do site e publica **num único commit** pela API do GitHub. Funciona no celular, pode ser **instalado como app** e não aparece nos buscadores (`noindex`).

### 5.1 Abas

- **Dashboard (abre primeiro):** mostra só as vendas **confirmadas**, com filtro de período (Hoje, 7 dias, 30 dias, Este mês, Tudo).
  - Números: faturamento (produtos e frete), pedidos, ticket médio, itens vendidos, pedidos aguardando confirmação (com o valor reservado) e cancelados.
  - Gráfico de faturamento por dia e **total vendido por categoria**.
  - Tabela de **produtos vendidos**: quantidade, receita e estoque atual. O botão **"Marcar os 3 mais vendidos com selo"** aplica o selo *Mais vendido* no site (depois clique em Publicar).
  - Retirada × entrega e a situação da loja agora: produtos ativos, unidades e valor em estoque, esgotados, última unidade, promoção e forma de pagamento.
- **Estoque:** botões −1 (vendi) e +1 (repus), quantidade e preço de cada produto numa lista só.
- **Clientes:** lista montada a partir dos pedidos (mesmo WhatsApp = mesmo cliente): total gasto, pedidos pagos, última compra, cliente desde, selo **Cliente fiel** (2+ compras), histórico de pedidos, botão WhatsApp, busca, ordenar (recentes / mais gastaram / mais pedidos) e **Exportar planilha** (CSV que abre no Excel).
- **Pedidos:** filtros Todos / Aguardando / **Para entregar** / Pagos / Cancelados, forma de pagamento em cada pedido (PIX manual, PIX Mercado Pago, Cartão Nx), **etapas** dos pedidos pagos e cartão **Avisos de pedido** ([5.2](#52-avisos-de-pedido-som-e-notificação)) e lista de pedidos com status, cliente, itens, entrega e total. Nos pedidos aguardando, há os botões **Confirmar pagamento** e **Cancelar e devolver ao estoque**.
- **Promoção:** promoção geral (liga/desliga, texto da faixa, % e data final, margem da planilha). Cada produto pode **seguir a geral**, ter **promoção própria** ou ficar **fora**. Mostra o lucro estimado e avisa se o desconto vender abaixo do custo.
- **Produtos:** criar, editar, duplicar e excluir. Filtros **Todos / Na loja / Fora da loja**. Produto **fora da loja** (rascunho) aparece só no painel: confira estoque, preço e fotos e use **✓ Colocar na loja** (avisa se o estoque estiver 0) ou **Tirar da loja** → **Publicar**. O Início lembra dos produtos fora da loja. Produtos novos podem entrar já fora da loja até a conferência.
  - Campos: nome, nome curto, código, marca, modelo, categoria, ícone, preço, estoque, resumo, descrição, especificações, aviso de foto ilustrativa e selo **Mais vendido**.
  - **Fotos:** enviar, escolher a principal, ordenar e remover. Viram WebP 700×700 com fundo branco, convertidas no próprio navegador.
  - **Calculadora de preço:** custo ÷ (1 − margem). O custo **não é salvo**, porque o repositório é público.
- **Artes:** estúdio de artes para Instagram, Facebook, TikTok e WhatsApp ([10.1](#101-estúdio-de-artes-no-painel-aba-artes)).
- **Frete:** faixas por distância, cidades com valor fixo ou "a combinar", transportadora (com o % da taxa), retirada, ponto de partida e simulador de CEP. Inclui uma calculadora de transportadora com a mensagem pronta para o cliente.
- **Loja:** nome, cidade, WhatsApp, mensagem inicial, **chave PIX** (trocar pede confirmação), recebedor, nome e cidade do QR, textos, foto da vitrine, **forma de pagamento** (PIX manual ou Mercado Pago) e **endereço do servidor**.

### 5.2 Avisos de pedido (som e notificação)

- **Painel aberto:**
  - a cada 20 segundos o painel pergunta ao servidor se algo mudou (uma consulta leve, que não gasta o limite grátis);
  - quando chega pedido novo, **toca um som**, o celular **vibra**, aparece o aviso na tela e o número no sino 🔔 e na aba **Pedidos**;
  - o título da aba vira "(1) 🛒 Novo pedido";
  - o som só toca depois de você tocar ou clicar uma vez no painel (regra dos navegadores). O botão **Ouvir o som** testa o som.
- **Painel fechado (notificação push):**
  - aba Pedidos → **Ativar avisos neste aparelho**. Faça isso no celular **e** no PC;
  - **Enviar aviso de teste** confere se está funcionando;
  - tocar na notificação abre o painel na aba Pedidos.
- **iPhone:** só recebe com o painel instalado. No Safari, toque em Compartilhar → **Adicionar à Tela de Início**, abra pelo ícone e ative lá. Precisa do iOS 16.4 ou mais novo.
- **Android:** no Chrome, menu ⋮ → **Instalar app** (opcional, mas deixa o painel como um app).
- **Windows:** com "Não perturbe" ou "Assistente de foco" ligado, a notificação chega sem som.
- **Técnica:** padrão Web Push (VAPID + aes128gcm). As chaves são criadas pelo próprio servidor e guardadas no KV. Cada aparelho fica cadastrado por 1 ano e o cadastro é renovado sempre que você abre o painel. Aparelhos desinstalados são removidos sozinhos.

### 5.3 Acesso (chave do GitHub)

1. Abra <https://github.com/settings/personal-access-tokens/new> → **Fine-grained token**.
2. Nome: *Painel*. Validade: 90 dias.
3. **Repository access:** *Only select repositories* → o repositório da loja.
4. **Permissions → Repository permissions → Contents: Read and write**. Mais nada.
5. Copie a chave (`github_pat_…`) e cole na tela de entrada do painel.

Para saber:
- A chave fica **só no navegador**: na aba aberta, ou no aparelho se você marcar **"Lembrar neste aparelho"**. Use essa opção só em aparelho pessoal.
- Venceu ou perdeu a chave? Apague em <https://github.com/settings/personal-access-tokens> e gere outra.
- O servidor só aceita ações do painel (pedidos, avisos) de quem tem essa chave com permissão de escrita no repositório.

### 5.4 Proteções do painel

- **Venda durante a edição:** se o site mudar por outro lugar (o servidor baixando estoque numa venda, ou um `git push` do PC) enquanto o painel está aberto, o **Publicar junta as duas coisas**: o campo que você mexeu fica com o seu valor; o estoque que você mexeu recebe a sua diferença (ex.: +1) sobre o estoque atual; o resto fica como está no site. Se uma venda cair bem no meio da publicação, ele tenta de novo sozinho uma vez.
- Aviso ao sair com alterações não publicadas. Há o botão **Descartar**.
- Política de segurança (CSP) restrita: o painel só conversa com o GitHub, com o servidor e com os serviços de mapa do frete.

---

## 6. Preços, promoções, estoque e frete

### 6.1 Preços

- O **painel manda** no preço e no estoque (`price` e `stock` em `assets/js/products.js`). Os preços ficam em **centavos**: `10580` = R$ 105,80.
- A planilha local `Planilha_Precificacao_Produtos.xlsx` calcula o preço. Ela **não vai para o GitHub**, porque tem custos.
  - Fórmula: **(custo + custo extra) ÷ (1 − margem − taxas)**, arredondado para cima em R$ 0,10. A margem fica na célula **B4**.
  - A planilha usa referências absolutas, então pode ordenar e filtrar sem quebrar.
- A margem atual é **50%** (preço = custo × 2).
- Relatório que compara o site com a planilha (não altera nada):

```bash
node scripts/atualizar-precos.js
```

### 6.2 Promoções

- O desconto é **real**: sai do preço cadastrado, que aparece **riscado** no cartão. O cliente paga o valor com desconto em tudo: cartão, detalhes, sacola, checkout, **QR do PIX** e mensagem do WhatsApp.
- O preço com desconto é arredondado **para baixo** em R$ 0,10, a favor do cliente.
- Vale até o fim do dia da data final. No dia seguinte, o site volta sozinho ao preço normal.
- Com margem de 50%, **28,5% de desconto** leva o preço ao equivalente a uma margem de cerca de 30%.
- A faixa da promoção aparece no topo do site e some quando não há promoção ativa.
- **Atenção legal:** o preço riscado precisa ser um preço realmente praticado antes. Um "De" inventado é propaganda enganosa (CDC art. 37).
- O cálculo fica em `assets/js/promo.js` e é usado pelo site, pelo painel, pelo servidor e pelos testes.

### 6.3 Estoque

- O site limita a quantidade na sacola ao estoque e bloqueia itens esgotados.
- Os cartões mostram só **Última unidade**, **Esgotado** e o selo **Mais vendido**. Os detalhes do produto mostram o estoque completo.
- Com o servidor ligado, o estoque **baixa sozinho** quando o cliente envia o comprovante (reserva) e **volta** se o pedido for cancelado. Vendas feitas fora do site (no balcão, por exemplo) você ajusta com **−1** na aba Estoque.

### 6.3.1 Venda com reposição pelo fornecedor

- Painel → **Estoque** → *Venda com reposição pelo fornecedor*: ligar, **quantos a mais por produto** (padrão +10) e **prazo extra** para o cliente (padrão 2 dias úteis). Por produto, o editor tem o campo **Reposição** (vazio = padrão; 0 = vende só o que tem em casa; ex.: drone +2).
- O site vende até **estoque físico + reposição** e mostra só “Em estoque” (sem “Última unidade”). Se o pedido passar do físico, o checkout avisa: “… é enviado em até 2 dias úteis (reposição do fornecedor)”.
- O estoque físico pode ficar **negativo**: −3 = 3 unidades vendidas para comprar no fornecedor (selo “Comprar 3 no fornecedor” no Estoque). Cada pedido mostra “X de casa + Y do fornecedor”, o commit do estoque diz “COMPRAR NO FORNECEDOR” e a notificação avisa.
- Ao receber do fornecedor, ajuste o estoque físico para o que sobrou em casa. Cancelamentos devolvem as unidades normalmente.
- Use só em produtos que o fornecedor sempre tem; se faltar, cancele e devolva o valor ao cliente.

### 6.4 Frete e entrega

- No checkout, o cliente escolhe **Retirar na loja** (grátis) ou **Entregar**. O QR do PIX só aparece depois dessa escolha.
- **Entrega na cidade da loja:**
  - o cliente digita **CEP e número**;
  - o site busca o endereço (ViaCEP), as coordenadas (OpenStreetMap/Nominatim) e a distância da **rota de ida** a partir da loja (OSRM). São serviços gratuitos e sem chave;
  - o valor sai das **faixas de distância** configuradas na aba Frete. Acima da última faixa, cobra um valor extra a cada X km.
- **Outras cidades:** valor fixo ou **a combinar**, conforme a lista da aba Frete. Com "a combinar", o PIX cobre só os produtos.
- **Interior e outras regiões:** envio por **transportadora**. O PIX cobre os produtos. Você cota o frete e cobra **frete + taxa administrativa** (hoje 30%). Exemplo: R$ 40,00 + 30% = **R$ 52,00**.
- **Frete promocional:** na aba Frete, cada faixa tem o campo **promo** e há a data **Frete promocional válido até**. Até essa data (dia de Brasília) vale o valor promo; no dia seguinte volta sozinho ao valor normal, no site, no painel e no servidor. Ex.: até 15 km R$ 15,00 até 31/10, depois R$ 25,00. A tabela do site mostra os dois valores.
- O frete entra no **total e no QR do PIX**. O pedido mostra endereço, km e precisão ("aproximado pelo bairro" quando a rua não está no mapa). Confira no Google Maps se a distância estiver perto do limite de uma faixa.
- A **tabela de frete** do site é gerada da configuração e aparece recolhida na seção *Transparência* ("Tabela de frete por distância e cidade").
- O cálculo fica em `assets/js/frete.js` (usado pelo site, pelo painel e pelo servidor).

---

## 7. Servidor (Cloudflare Worker)

Pasta `worker/`. Ele recalcula valores, reserva e devolve o estoque (por commits no GitHub), guarda os pedidos e envia os avisos.

### 7.1 Rotas

| Rota | Quem usa | O que faz |
|---|---|---|
| `GET /api/health` | qualquer um | teste rápido (`configured: true` = chave do GitHub cadastrada) |
| `POST /api/manual-orders` | site | registra o pedido do PIX manual e **reserva** o estoque |
| `GET /api/admin/orders` (`?all=1`) | painel | lista de pedidos (60 mais recentes, ou todos para o dashboard) |
| `GET /api/admin/orders/changes` | painel | última mudança nos pedidos (consulta leve a cada 20 s) |
| `POST /api/admin/orders/:id/confirm` · `/cancel` | painel | confirma o pagamento ou cancela e devolve o estoque |
| `GET /api/push/key` | painel | chave pública das notificações |
| `POST /api/admin/push/subscribe` · `/unsubscribe` · `/test` | painel | cadastra ou remove o aparelho e envia aviso de teste |
| `POST /api/card-orders` | site | pedido no cartão: reserva 1 h e devolve o link da página do Mercado Pago |
| `GET /api/track?id=…&phone=…` | página Acompanhar pedido | situação, etapas, itens e total (confere o WhatsApp) |
| `POST /api/admin/orders/:id/stage` | painel | etapa do pedido pago (separando, pronto, enviado, entregue) |
| `POST /api/orders`, `GET /api/orders/:id`, `POST /api/orders/:id/cancel`, `POST /api/webhook` | site / Mercado Pago | PIX automático (opcional, [7.4](#74-mercado-pago-pix-automático)) |
| tarefa agendada (minuto 17 de cada hora) | Cloudflare | cancela pedidos sem confirmação há 48 h e devolve o estoque |

As rotas `/api/admin/*` exigem a chave do GitHub do painel com permissão de escrita no repositório.

### 7.2 Configuração (`worker/wrangler.toml`)

| Variável | Valor atual | Para quê |
|---|---|---|
| `GITHUB_REPO` | `Tanattos18/Akylla_Store` | repositório onde o estoque é baixado |
| `GITHUB_BRANCH` | `main` | branch publicada |
| `ALLOWED_ORIGINS` | `https://akyllashop.com,https://www.akyllashop.com,…` | sites que podem chamar o servidor (CORS) |
| `AUTO_CANCEL_HOURS` | `48` | prazo para confirmar o PIX manual |
| `MANUAL_ORDERS_PER_HOUR` | `5` | limite de pedidos por aparelho (IP) por hora |
| `STORE_WHATSAPP` | WhatsApp da loja | destino do aviso do CallMeBot |
| `PAYMENT_MINUTES`, `MP_API` | `30`, `orders` | só para o Mercado Pago |
| `[[kv_namespaces]] ORDERS` | id do KV | banco de pedidos, reservas e avisos |
| `[triggers] crons` | `17 * * * *` | cancelamento automático |

**Segredos.** São cadastrados na Cloudflare, **nunca** no código. A tabela mostra só os nomes:

| Nome | Obrigatório? | Como conseguir |
|---|---|---|
| `GITHUB_TOKEN` | **sim** | chave fine-grained do GitHub, separada da do painel: **Contents: Read and write**, só no repositório da loja, validade de 1 ano (anote para renovar) |
| `CALLMEBOT_APIKEY` | não | aviso de venda no WhatsApp pelo robô do callmebot.com |
| `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET` | não | só para o PIX automático do Mercado Pago |

Para cadastrar ou trocar um segredo, use `cd worker` → `& .\definir-chaves.ps1` (PowerShell) ou `npx wrangler@3 secret put NOME`. Também dá pelo site da Cloudflare: *Workers & Pages → (seu worker) → Settings → Variables and Secrets → Add → **Type: Secret***. Se cadastrar como *Text*, a chave fica visível.

### 7.3 Publicar ou atualizar o servidor

```bash
cd worker
npx wrangler@3 login      # só na primeira vez em cada computador
npx wrangler@3 deploy     # publica a versão nova (cerca de 10 s)
```

Depois de mudar qualquer arquivo em `worker/src/` ou em `assets/js/promo.js`, `frete.js` ou `admin/formato.js` (o servidor também usa esses arquivos), rode os testes e faça o `deploy`.

**Limites do plano grátis da Cloudflare** (sobram muito para este volume):
- 100 mil requisições por dia;
- KV: 100 mil leituras, 1.000 gravações e 1.000 listagens por dia.

O painel foi feito para gastar pouco: consulta leve a cada 20 s e a lista completa só quando muda algo.

### 7.4 Mercado Pago (PIX automático)

**Ligado na Akylla Shop desde 21/10/2026.** Com ele, o servidor gera o PIX no Mercado Pago, e a confirmação e a baixa do estoque ficam automáticas (webhook). Para ligar:

1. Em developers.mercadopago.com → **Criar aplicação** → *Checkout Transparente* → **API de Orders** → copie o **Access Token de produção** (`APP_USR-…`).
2. Na aplicação → **Webhooks**: URL `https://SEU-SERVIDOR/api/webhook`, eventos **Order** e **Pagamentos** (este para o cartão), modo produção. Copie a **assinatura secreta**.
3. Cadastre os segredos `MP_ACCESS_TOKEN` e `MP_WEBHOOK_SECRET` (seção 7.2).
4. No painel → Loja → *Forma de pagamento*: **Mercado Pago automático** → Publicar. Faça uma compra real barata para testar e depois estorne.

Para voltar ao PIX manual: painel → Loja → *PIX manual* → Publicar.

---

## 8. Domínio, DNS e HTTPS

**Registros DNS** (Hostinger → Domínios → akyllashop.com → DNS):

| Tipo | Nome | Valor |
|---|---|---|
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |
| CNAME | www | tanattos18.github.io |

- Não apague registros **MX/TXT** se for usar e-mail com o domínio.
- **GitHub → Settings → Pages:** *Deploy from a branch* `main` / `(root)` · *Custom domain* `akyllashop.com` · **Enforce HTTPS** marcado.
- O arquivo **`CNAME`** na raiz liga o domínio. **Não apague.**
- Os endereços fixos que dependem do domínio estão em `index.html`, `privacidade.html` e `termos.html` (`canonical`, `og:url`, `og:image`, JSON-LD), `sitemap.xml`, `robots.txt` e `worker/wrangler.toml` (`ALLOWED_ORIGINS`).

**Se o site sair do ar:**
1. `nslookup akyllashop.com 8.8.8.8` deve mostrar os 4 IPs `185.199.10x.153`.
2. O arquivo `CNAME` precisa existir no repositório.
3. Em Settings → Pages, remova e salve de novo o *Custom domain* para forçar uma nova verificação.

---

## 9. Como atualizar o site

São três caminhos, e todos terminam num commit na `main`. O GitHub Pages publica em cerca de 1 minuto.

### 9.1 Pelo painel (dia a dia)

Estoque, preços, produtos, fotos, promoções, frete, WhatsApp, PIX e vitrine: faça as alterações e clique em **Publicar**.

### 9.2 Pelo computador (código, textos fixos, layout)

```bash
git pull                                  # 1) SEMPRE primeiro: o painel e o servidor também fazem commits
python -m http.server 8000                # 2) (opcional) ver em http://localhost:8000
node --test "tests/*.test.js"             # 3) testes
git add -A
git commit -m "descreva a alteração"
git push                                  # 4) publica
```

- Se o `git push` for recusado, rode `git pull` e depois `git push` de novo. Acontece porque o painel ou o servidor publicaram algo nesse meio-tempo.
- **Cache dos celulares:** CSS e JS são chamados com `?v=AAAAMMDD-N` em `index.html`, `privacidade.html`, `termos.html` e `admin/index.html`. Também em `pedido.html`. Ao alterar um `.css` ou `.js`, aumente esse número para todo mundo receber a versão nova na hora.
- Mudou algo em `worker/`? Faça também o `deploy` ([7.3](#73-publicar-ou-atualizar-o-servidor)).

### 9.3 Em mais de um computador

Antes de começar: `git pull`. Ao terminar: `git push`. Os arquivos privados (planilha, comprovantes, artes, anúncios, chaves) **não vão para o GitHub**. Copie à mão se precisar deles em outra máquina.

---

## 10. Anúncios 9:16 para Instagram/Facebook

A pasta `ferramentas/anuncios/` gera um anúncio **1080×1920 (PNG)** por produto, no padrão da marca: logo, título, foto recortada, ficha técnica com ícones, preço com promoção, chamada "Compre agora" e site/WhatsApp.

```bash
node ferramentas/anuncios/gerar.js           # todos
node ferramentas/anuncios/gerar.js 03 07     # só os números escolhidos
```

- **Precisa de:** Node 18+, Python 3 com Pillow (`pip install pillow`) e Microsoft Edge ou Google Chrome.
- **Saída:** pasta `Banner_Itens_Loja/` na raiz, com arquivos `01 -Anuncio_….png`, `02 -…`. Essa pasta fica **fora do GitHub**.
- **Textos:** ficam em `ferramentas/anuncios/anuncios.js`, um bloco por anúncio:
  - título, subtítulo, frase em letra de mão, 4 a 6 especificações (ícone + texto), destaque, 4 selos e 2 vantagens;
  - `hero` e `combo.img` escolhem as fotos (0 = principal, 1 em diante = galeria);
  - `card: true` mostra a foto num cartão branco. Use para produtos brancos ou fotos com medidas desenhadas;
  - `holes: true` tira os brancos internos de produtos escuros.
- **Visual:** cores e posições em `estilo.css.txt`. Os ícones disponíveis estão na lista `I` de `modelo.js`.
- **Preço e promoção** vêm do catálogo. **Gere de novo** quando o preço mudar ou a promoção acabar (o anúncio mostra "Oferta válida até DD/MM").
- **Regra:** escreva só o que está na ficha do produto. Não invente característica.
- **Stories e Reels:** o Instagram cobre o topo e o rodapé com a interface (perfil, botão de link). Confira se nada importante ficou escondido. Para o feed, o formato que mais aparece é 4:5 (1080×1350).

### 10.1 Estúdio de artes no painel (aba Artes)

Gera as artes **no próprio navegador**, sem custo e sem instalar nada, com o preço e a promoção atuais do catálogo.

1. **Pré-definido** (opcional): um clique preenche tudo, por exemplo "Promoção — Instagram completo" ou "Oferta relâmpago — Status/Stories".
2. **Campanha:** Promoção, Novidade, Mais vendido, Últimas unidades (com produto) ou Inauguração, Cartão em 12x, Frete (sem produto, com colagem de vários itens).
3. **Estilo:** **⭐ Anúncio** (padrão: o mesmo visual dos anúncios 9:16, com produto recortado, ficha com ícones e faixa de preço), Laranja forte, Neon escuro, Clean claro, Foto em destaque ou Surpresa.
   - O estilo Anúncio usa os textos de `ferramentas/anuncios/anuncios.js` (os mesmos do gerador). Produto sem anúncio cadastrado é montado com a ficha técnica dele.
4. **Composição:** Produto grande, Preço gigante, Dividido ou Surpresa.
5. **Formatos:** ligue/desligue um por um:

| Formato | Tamanho | Onde usar |
|---|---|---|
| 1:1 | 1080×1080 | feed, carrossel, WhatsApp |
| 4:5 | 1080×1350 | feed do Instagram (ocupa mais tela) |
| 9:16 | 1080×1920 | Stories, Reels, TikTok, Status |
| 16:9 | 1920×1080 | Facebook, YouTube, capa de vídeo |

6. **Gerar artes** → **Baixar** / **Compartilhar** (no celular abre direto o Instagram/WhatsApp) ou **Baixar todas**.
7. **Legendas prontas** para Instagram, Facebook e TikTok, com emojis e hashtags, e botão **Copiar**.

- **Salvar como pré-definido** guarda as escolhas atuais com um nome. Clique em **Publicar** para ficar salvo em todos os aparelhos.
- **Kit de abertura das redes:** foto de perfil (redonda), capa do Facebook, 4 capas de destaque e bios prontas.
- O código fica em `admin/estudio.js`.

---

## 11. Estrutura de arquivos

```
├── index.html              # loja (catálogo, sacola, checkout PIX)
├── privacidade.html        # Política de Privacidade (LGPD)
├── termos.html             # Termos de Uso (CDC)
├── CNAME                   # domínio do GitHub Pages
├── robots.txt · sitemap.xml
├── admin/                  # painel administrativo (instalável como app)
│   ├── index.html · admin.css · admin.js
│   ├── estudio.js          # aba Artes: gera as artes das redes no navegador (Canvas)
│   ├── formato.js          # lê/escreve products.js e config.js (usado também pelo servidor e pelos testes)
│   ├── sw.js               # service worker: recebe as notificações push
│   └── manifest.webmanifest · icon-192.png · icon-512.png · apple-touch-icon.png
├── assets/
│   ├── css/styles.css
│   ├── fonts/              # DM Sans e Sora (woff2 locais, licença OFL)
│   ├── img/                # logo-mark.jpg, favicon.png, vitrine*.jpg, og-cover.jpg, products/ (WebP 700×700)
│   ├── js/
│   │   ├── app.js          # catálogo, filtros, sacola, checkout, envio do pedido
│   │   ├── config.js       # WhatsApp, PIX, textos, promoção, frete, servidor  (editado pelo painel)
│   │   ├── products.js     # catálogo, preços, estoque, fotos                  (painel e servidor)
│   │   ├── promo.js        # cálculo das promoções
│   │   ├── frete.js        # cálculo do frete (CEP → endereço → rota → tabela)
│   │   └── pix.js          # gerador do BR Code PIX + CRC16
│   └── vendor/qrcode.js    # qrcode-generator 2.0.4 (MIT)
├── worker/                 # servidor (Cloudflare Worker)
│   ├── wrangler.toml · package.json · definir-chaves.ps1
│   └── src/index.js (rotas) · src/logic.js (regras de pedido) · src/push.js (notificações)
├── ferramentas/anuncios/   # gerador de anúncios 9:16 (anuncios.js e icones.js também são usados pela aba Artes)
├── scripts/atualizar-precos.js   # relatório site × planilha
├── tests/site.test.js · tests/worker.test.js
├── .github/workflows/testes.yml  # roda os testes a cada push
└── docs/ · CHECKLIST_MELHORIAS_AKYLLA_SHOP.md   # planejamento original
```

---

## 12. Formato dos dados

`assets/js/products.js` e `assets/js/config.js` são **JSON atribuído a `window.*`**. O site carrega com `<script>`, e o painel e o servidor leem com `JSON.parse`, sem executar código.

### Produto

```json
{
  "id": "w31-pro-max",
  "name": "Relógio W31 Pro Max Bazik",
  "shortName": "W31 Pro Max",
  "brand": "Bazik",
  "model": "W31 Pro Max",
  "code": "9997",
  "category": "smartwatches",
  "visual": "watch",
  "price": 26380,
  "stock": 3,
  "summary": "Texto curto do cartão",
  "description": "Texto completo dos detalhes",
  "image": "assets/img/products/w31-pro-max-5.webp",
  "imageAlt": "Descrição da foto",
  "gallery": ["assets/img/products/w31-pro-max-1.webp"],
  "illustrative": true,
  "hidden": true,
  "bestseller": true,
  "promo": { "percent": 15, "until": "2026-11-15" },
  "specs": [{ "label": "Tela", "value": "Alta definição" }]
}
```

- `code`: código do fornecedor.
- `category`: um dos ids de `AKYLLA_CATEGORIES` (`smartwatches`, `audio`, `drones`, `carregadores`, `cabos`, `acessorios`).
- `visual`: ícone usado quando não há foto (`watch`, `earbuds`, `headphones`, `drone`, `cable`, `charger`, `powerbank`, `mic`).
- Opcionais:
  - `gallery`: fotos extras;
  - `illustrative`: mostra o aviso "Imagem ilustrativa";
  - `hidden`: tira o produto do site;
  - `bestseller`: selo "Mais vendido";
  - `promo`: sem o campo, segue a promoção geral. `{ "percent": 0 }` deixa o produto fora da promoção.

### Configuração (`window.AKYLLA_CONFIG`)

- **Identidade e contato:** `storeName`, `tagline`, `city`, `whatsapp` (só dígitos, com 55 e DDD), `whatsappDisplay`, `whatsappMessage`.
- **PIX:** `pixKey`, `pixHolder`, `pixMerchantName` (até 25 letras), `pixCity` (até 15).
- **Textos:** `deliveryNote`, `warrantyNote`, `returnNote`, `paymentNote`, `year`.
- **Preços:** `marginPercent` (margem da planilha) e `promo` (`active`, `text`, `percent`, `until`).
- **Frete:** `shipping`: `enabled`, `pickup`, `pickupNote`, `originLabel`, `origin` {lat, lon}, `bands` [{upToKm, price}], `extraStepKm`, `extraStepPrice`, `homeCity`, `cities` [{name, price ou null}], `carrier` {enabled, feePercent}.
- **Pagamento:** `paymentProvider` (`manual` ou `mercadopago`) e `paymentApiUrl` (endereço do servidor).

Nome, CPF e endereço do **rodapé e das páginas legais** ficam fixos no HTML e não mudam pelo painel.

---

## 13. PIX

`assets/js/pix.js` monta o **BR Code estático** (padrão EMV do Banco Central), com:
- chave;
- valor exato do pedido (já com desconto e frete);
- nome e cidade do recebedor;
- número do pedido (txid);
- CRC16.

O QR é gerado no navegador e pode ser baixado em PNG. A confirmação é **manual**: confira o valor recebido no banco antes de confirmar no painel.

Para validar um código no console do navegador:

```js
window.AkyllaPix.validatePixPayload(document.getElementById('pixPayloadPreview').textContent);
```

---

## 14. Testes automáticos

```bash
node --test "tests/*.test.js"
```

Rodam também no GitHub a cada push (aba **Actions**). Cobrem:

- **site:** catálogo (ids e códigos únicos, fotos existentes, estoque válido), formato dos arquivos do painel, PIX (CRC e valor com desconto), promoções, frete (tabela e cotação simulada), checkout, identificação do vendedor, fontes locais e segurança do painel;
- **servidor**, com GitHub, Mercado Pago, CallMeBot e KV simulados: compra completa, reserva, confirmação e cancelamento, cancelamento automático em 48 h, limite por hora, e **notificação push**. Neste último, um "navegador" de teste descriptografa o aviso e confere a assinatura.

---

## 15. Segurança, chaves e privacidade

- **O repositório é público.** Nunca coloque senhas, tokens ou chaves de API em arquivos do projeto, no README, em print ou em conversa. A chave PIX e o WhatsApp aparecem no site de propósito, porque o cliente precisa deles.
- **Onde guardar as chaves:** num gerenciador de senhas e/ou no arquivo local `CHAVES_PRIVADAS.md`. Esse arquivo fica só no computador (está no `.gitignore`) e tem os passos para trocar cada chave.
- **Chaves em uso** (só os nomes):

| Chave | Onde fica | Validade |
|---|---|---|
| Chave do **painel** (GitHub fine-grained, Contents RW) | só no navegador de quem usa o painel | 90 dias |
| Chave do **servidor** (`GITHUB_TOKEN`, outra chave fine-grained) | segredo na Cloudflare | 1 ano |
| `CALLMEBOT_APIKEY`, `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET` (opcionais) | segredos na Cloudflare | até trocar |
| Chaves das notificações (VAPID) | geradas e guardadas pelo próprio servidor (KV) | — |

- **Vazou uma chave** (foi colada em chat, print ou e-mail)? Apague no site de origem (GitHub → Settings → Personal access tokens; Mercado Pago → Credenciais → renovar), gere outra e cadastre de novo (`definir-chaves.ps1` ou o painel).
- **Arquivos que não vão para o GitHub** (`.gitignore`):

| Arquivo | Por quê |
|---|---|
| `*.xlsx` (planilha de precificação) | custos e margens |
| `*.pdf` (cupons e comprovantes) | CPF, endereço e dados do fornecedor |
| `Chave*PIX.txt`, `WhatsApp Image*.jpeg` | dados pessoais de referência |
| `Logo_Vitrine*.png`, `Banner vitrine da loja.png` | artes-fonte (as versões otimizadas estão em `assets/img/`) |
| `Banner_Itens_Loja/`, `ferramentas/anuncios/.trabalho/` | anúncios gerados e arquivos de trabalho |
| `CHAVES_PRIVADAS*`, `.env*`, `worker/.dev.vars` | chaves |
| `fotos-candidatas/`, `worker/node_modules/`, `worker/.wrangler/` | temporários |

- **Proteções do site e do servidor:**
  - preços, frete e estoque são sempre **recalculados no servidor** (o navegador não decide valores);
  - limite de pedidos por aparelho: PIX manual 5/hora, PIX automático 20/hora, cartão 20/hora. Impede alguém de "prender" o estoque gerando pedidos em série;
  - **número do pedido aleatório** (6 caracteres sorteados), impossível de adivinhar. Para acompanhar ou cancelar pelo site, também é preciso o WhatsApp da compra;
  - **CSP** (política de segurança) em todas as páginas do site e do painel: o navegador só carrega código do próprio site e só conversa com o servidor e os serviços de mapa/CEP;
  - todo texto vindo do catálogo é "escapado" antes de aparecer na tela (proteção contra código injetado);
  - avisos do Mercado Pago (webhook) são conferidos com a assinatura secreta e consultados de volta no Mercado Pago antes de valer;
  - o painel só funciona com uma chave do GitHub com permissão de escrita no repositório.
- O site não coleta dados de cartão. A sacola fica no navegador do cliente (`localStorage`). Nome e WhatsApp do pedido ficam no servidor (KV) para a loja atender.
- O rodapé e as páginas legais identificam o vendedor, como exige o Decreto 7.962/2013.

---

## 16. Problemas comuns e soluções

| Aconteceu… | O que fazer |
|---|---|
| Pedido em **Conferir pagamento** | O Mercado Pago aprovou um valor diferente, ou um cartão foi aprovado depois de o pedido ser cancelado. Veja o motivo no pedido, confira no app do Mercado Pago e entregue ou devolva o valor por lá. |
| Cliente diz que pagou, mas o pedido segue "aguardando" | Abra a página **Acompanhar pedido** desse pedido (ela consulta o Mercado Pago de novo e confirma sozinha). Se continuar aguardando, confira no app do Mercado Pago. |
| Mudança no painel não aparece no site | Clicou em **Publicar**? Espere 1 a 2 minutos e recarregue a página (no celular, puxe para baixo). |
| Arte do estúdio sem a promoção | A arte usa o preço publicado: publique a promoção antes de gerar. |

| Sintoma | O que fazer |
|---|---|
| O site não mudou depois de publicar | Espere 1 a 2 minutos e recarregue com `Ctrl+F5`. No celular, feche e abra a aba. Mudou CSS ou JS? Aumente o `?v=` ([9.2](#92-pelo-computador-código-textos-fixos-layout)). |
| Painel: "Chave inválida ou vencida" | Gere outra chave fine-grained ([5.3](#53-acesso-chave-do-github)). |
| Painel: "A chave não tem permissão de escrita" | Na chave, confira *Only select repositories* → o repositório certo, e **Contents: Read and write**. |
| Painel: "O site mudou enquanto você editava" | O servidor ou outro aparelho publicou algo. Recarregue o painel e refaça a alteração. |
| `/api/health` mostra `"configured": false` | Falta o segredo `GITHUB_TOKEN` no servidor ([7.2](#72-configuração-workerwranglertoml)). |
| Pedido não reserva o estoque ("erro no servidor") | A chave do servidor venceu ou não tem permissão. Gere outra e rode `definir-chaves.ps1`. |
| Pedidos não aparecem no painel | Confira o *Endereço do servidor* no painel → Loja, e se `ALLOWED_ORIGINS` no `wrangler.toml` tem o endereço do site. |
| Aviso de teste não chega | Confira se as notificações do site estão permitidas (cadeado → Notificações) e se o "Não perturbe" está desligado. No iPhone, o painel precisa estar instalado na Tela de Início. Desative e ative de novo no aparelho. |
| Som não toca com o painel aberto | Toque ou clique uma vez no painel (o navegador exige) e confira "Som com o painel aberto". Teste com **Ouvir o som**. |
| QR do PIX recusado pelo banco | Confira a chave PIX e o nome/cidade do QR (sem acento, dentro do limite de letras) no painel → Loja. |
| Frete estranho para um CEP | Use o simulador na aba Frete e confira a distância no Google Maps. Coordenadas exatas da loja melhoram o cálculo. |
| Site fora do ar | Veja a [seção 8](#8-domínio-dns-e-https). |

---

## 17. Pendências

- [ ] Renomear o repositório para **Akylla_Shop** (Settings → General → Repository name). O painel e o servidor se ajustam ao redirecionamento. Depois, em cada computador: `git remote set-url origin https://github.com/Tanattos18/Akylla_Shop.git`, e atualize `GITHUB_REPO` no `wrangler.toml` e `REPO` no `admin/admin.js`.
- [ ] Trocar as chaves que já foram expostas em conversa (GitHub, Mercado Pago) e cadastrar de novo.
- [ ] CallMeBot: cadastrar a apikey quando o robô liberar vaga (opcional, porque os avisos push já cobrem isso).
- [ ] Criar o Instagram e o Facebook da loja e colocar os links no topo e no rodapé do site.
- [ ] Fotos reais dos produtos que só têm foto ilustrativa ou com medidas desenhadas (W96, cabos, carregadores).
- [ ] Logo oficial em SVG/PNG transparente.
- [ ] Revisar garantia, entrega e trocas com contador ou advogado.
- [x] Domínio `akyllashop.com` e HTTPS.
- [x] PIX manual com reserva de estoque e confirmação no painel.
- [x] Dashboard, avisos de pedido e anúncios 9:16.

---

## 18. Histórico

| Data | O que mudou |
|---|---|
| 19/10/2026 | Primeira versão: landing page, catálogo de 22 produtos, sacola e checkout PIX. |
| 20/10/2026 | Códigos reais do fornecedor, identificação do vendedor, fontes locais, testes automáticos. |
| 20/10/2026 | Nova arte da vitrine, paleta laranja, ícone da logo, estoque nos produtos, galerias de fotos. |
| 20/10/2026 | Painel administrativo; promoções com desconto real; preços com margem de 50%. |
| 20/10/2026 | Domínio `akyllashop.com`; marca renomeada de Akylla Store para **Akylla Shop**. |
| 20/10/2026 | Frete no checkout (distância, cidades, transportadora, retirada) e aba Frete. |
| 20/10/2026 | Servidor de pagamentos (Cloudflare Worker) com Mercado Pago (deixado desligado). |
| 21/10/2026 | PIX manual com reserva de estoque, confirmar/cancelar no painel, cancelamento automático em 48 h. |
| 21/10/2026 | Dashboard de vendas no painel. |
| 21/10/2026 | Anúncios 9:16 dos 22 produtos (gerador em `ferramentas/anuncios/`). |
| 21/10/2026 | Layout: 2 produtos por linha no celular, barra fixa da sacola, 12 por página, tabela de frete recolhível, selo "Mais vendido", faixa de categorias clicável. |
| 21/10/2026 | Avisos de pedido: som, vibração, contador e notificação push no celular e no PC; painel instalável como app. |
| 21/10/2026 | Cartão de crédito em até 12x (Checkout Pro, juros com o cliente, taxa repassada), página Acompanhar pedido, etapas de entrega e aba Clientes no painel; correção da baixa dupla de estoque no PIX automático. |
| 21/10/2026 | Power banks fora da loja até conferência; venda com reposição pelo fornecedor (+10 por padrão). |
| 21/10/2026 | Estúdio de artes no painel (formatos 1:1, 4:5, 9:16 e 16:9, estilos, pré-definidos, legendas e kit de abertura). |
| 21/10/2026 | Pedido no cartão em aberto pode virar PIX; voltar do Mercado Pago cai no pedido; seta voltar do celular fecha janelas. |
| 21/10/2026 | Estúdio: estilo ⭐ Anúncio (mesmo visual dos anúncios 9:16) nos 4 formatos, com produto recortado. |
| 21/10/2026 | Auditoria: limite de PIX por aparelho, número de pedido mais forte, CSP no site, Publicar sem conflito com vendas, cartão aprovado depois de cancelado vai para conferência. |
| 21/10/2026 | README reescrito com o guia para criar uma loja nova a partir deste projeto. |

O histórico completo está nos commits: `git log --oneline`.

---

## 19. Créditos e licenças

- **Foto da vitrine e logo:** arte da loja. Em 20/10/2026 o texto "STORE" da arte virou "SHOP".
- **Fotos dos produtos:** referências de fabricantes e distribuidores (Basike, Inova e outros). Os direitos são dos respectivos titulares. Itens sem foto exata têm o aviso "Imagem ilustrativa". Se alguém pedir a remoção de uma foto, troque pelo painel.
- **QR Code:** [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator), de Kazuhiko Arase (MIT).
- **Fontes:** Sora e DM Sans (SIL Open Font License), servidas localmente. O anúncio usa também a Kalam (Google Fonts, OFL).
- **Mapas e endereços:** ViaCEP, OpenStreetMap/Nominatim e OSRM (serviços públicos gratuitos).
- **Ícones:** SVGs originais do projeto.

> As informações jurídicas do site são referências gerais ao CDC e à LGPD e não substituem a orientação de um advogado ou contador.

**Akylla Shop**: WhatsApp (62) 8151-7002 · <https://akyllashop.com/>
