# Akylla Store

Loja online da **Akylla Store** (eletrônicos e acessórios, Goiânia/GO): catálogo com fotos, estoque e promoções, sacola, checkout por **PIX** (QR Code + copia e cola) e confirmação pelo WhatsApp. Inclui um **painel administrativo** para gerir tudo pelo celular, sem servidor.

![Prévia da Akylla Store](assets/img/og-cover.jpg)

---

## 1. Endereços

| O quê | Endereço atual | Endereço antigo |
|---|---|---|
| **Loja** | **<https://akyllashop.com/>** | `https://tanattos18.github.io/Akylla_Store/` (redireciona para o atual) |
| **Painel admin** | **<https://akyllashop.com/admin/>** | `https://tanattos18.github.io/Akylla_Store/admin/` (redireciona) |
| Política de privacidade | <https://akyllashop.com/privacidade.html> | — |
| Termos de uso | <https://akyllashop.com/termos.html> | — |
| Repositório (código) | <https://github.com/Tanattos18/Akylla_Store> | — |

- **Branch publicada:** `main` (pasta raiz `/`).
- **Hospedagem:** GitHub Pages (grátis). **Domínio:** `akyllashop.com`, registrado na **Hostinger** (`akyllastore.com` já tinha dono).
- O link antigo continua funcionando: o GitHub redireciona tudo para `akyllashop.com`.
- **Stack:** HTML + CSS + JavaScript puro — sem build, sem framework, sem backend.

---

## 2. Como atualizar a página

Há três caminhos. Todos terminam num commit na `main`; o GitHub Pages publica sozinho em **~1 minuto**.

### 2.1 Pelo painel (dia a dia — recomendado)

Abra <https://akyllashop.com/admin/>, faça as alterações e clique em **Publicar**. Serve para estoque, preços, produtos, fotos, promoções, WhatsApp, PIX e foto da vitrine. Detalhes na [seção 3](#3-painel-administrativo-admin).

### 2.2 Pelo computador (código, textos fixos, layout)

Primeira vez num computador novo:

```bash
git clone https://github.com/Tanattos18/Akylla_Store.git
cd Akylla_Store
git config user.name "Joás Santana"
git config user.email "joas.s.nk1@gmail.com"
```

Toda vez que for mexer:

```bash
git pull                                  # 1) SEMPRE primeiro: traz o que foi publicado pelo painel ou por outra máquina
python -m http.server 8000                # 2) (opcional) ver localmente em http://localhost:8000
node --test "tests/*.test.js"             # 3) testes automáticos (precisa do Node 18+)
git add -A
git commit -m "descreva a alteração"      # 4) registrar
git push                                  # 5) publicar (site atualiza em ~1 min)
```

> **Importante:** como o painel também publica, rode `git pull` antes de editar qualquer arquivo à mão. Se esquecer e o `git push` for recusado, rode `git pull` e depois `git push` de novo.

> **Cache dos celulares:** CSS e JS são chamados com `?v=AAAAMMDD-N` em `index.html`, `privacidade.html` e `termos.html` (e no `admin/index.html`). Ao alterar `styles.css` ou algum `.js`, aumente esse número para os clientes receberem a versão nova na hora.

### 2.3 Em outra estação (casa × notebook da empresa)

O projeto existe em mais de um computador. Antes de começar em qualquer um deles: `git pull`. Ao terminar: `git push`. Arquivos privados (planilha, comprovantes, artes) **não vão para o GitHub** — copie-os à mão se precisar deles na outra máquina (ver [seção 9](#9-privacidade-e-arquivos-que-não-vão-para-o-github)).

---

## 3. Painel administrativo (`/admin/`)

O painel edita os arquivos do site e publica **num único commit** pela API do GitHub. Não precisa de servidor. Funciona no celular. Não aparece no site nem nos buscadores (`robots.txt` + `noindex`).

### Abas

- **Estoque:** −1 (vendi) / +1 (repus), quantidade e preço de cada produto numa lista só. Mostra o preço da promoção quando houver.
- **Promoção:** promoção geral (liga/desliga, texto da faixa, desconto %, data final e **margem usada na planilha**) e, para cada produto, **“segue a geral”**, **“promoção própria”** (% e data dele) ou **“fora”**. Mostra o lucro estimado e avisa se o desconto vender abaixo do custo. Ações em massa: todos na geral / tirar todos.
- **Produtos:** criar, editar, duplicar, **ocultar** (rascunho, some do site sem apagar) e excluir. Campos: nome, nome curto, código, marca, modelo, categoria, ícone, preço, estoque, resumo, descrição, especificações, aviso de foto ilustrativa e **fotos** (enviar do celular/PC, escolher a principal, ordenar, remover). As fotos são convertidas no próprio navegador para **WebP 700×700 com fundo branco**; fotos removidas são apagadas do repositório ao publicar. **Calculadora de preço**: custo ÷ (1 − margem), arredondado para cima em R$ 0,10 — o **custo não é salvo** (o repositório é público).
- **Loja:** nome, cidade, WhatsApp, mensagem inicial, **chave PIX**, recebedor, nome/cidade do QR, textos de entrega/garantia/trocas/pagamento e **foto da vitrine** (gera 1000 e 640 px). Trocar a chave PIX pede confirmação.

### Acesso (chave do GitHub)

1. GitHub → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token** (<https://github.com/settings/personal-access-tokens/new>).
2. Nome: *Painel Akylla* · Validade: 90 dias.
3. **Repository access:** *Only select repositories* → **Akylla_Store**.
4. **Permissions → Repository permissions → Contents: Read and write** (nada mais).
5. Copie a chave (`github_pat_…`) e cole na tela de entrada do painel.

- A chave fica só no navegador (na aba aberta, ou no aparelho se marcar **“Lembrar neste aparelho”** — use só em aparelho pessoal).
- **Vencida ou perdida?** Apague em <https://github.com/settings/personal-access-tokens> e gere outra.
- Ao trocar de endereço (ex.: do antigo para `akyllashop.com`) o navegador pede a chave de novo — é a mesma chave.
- Use o painel sempre por **https://** (cadeado no navegador).

### Proteções

- **Conflito:** se o site for alterado por outro lugar (ex.: `git push` do PC) enquanto o painel está aberto, ele **não sobrescreve** — mantém suas alterações pendentes e pede para recarregar.
- Aviso ao sair com alterações não publicadas; botão **Descartar**.
- Política de segurança (CSP) restrita: o painel só conversa com `api.github.com`.

---

## 4. Preços, margem e promoções

### Preços

- O **painel manda** no preço e no estoque (`price` e `stock` em `assets/js/products.js`). Preços em **centavos** (`10580` = R$ 105,80).
- A planilha local `Planilha_Precificacao_Produtos.xlsx` (não vai para o GitHub — tem custos) calcula o preço: **(custo + custo extra) ÷ (1 − margem − taxas)**, arredondado para cima em R$ 0,10. Margem na célula **B4**.
- **Histórico:** em 20/10/2026 os preços foram aplicados com margem de **30%** (custo ÷ 0,7) e, no mesmo dia, passaram para margem de **50%** (custo × 2), que é a configuração atual.
- Relatório site × planilha (não altera nada):

```bash
node scripts/atualizar-precos.js
```

- A planilha usa referências absolutas (`$B$4`, `$B$5`…): pode ordenar e filtrar sem quebrar. Ela tem uma linha de conferência com o total do cupom (R$ 2.544,95, pedido 16511 de 19/10/2026).

### Promoções

- O desconto é **real**: sai do preço cadastrado, que aparece **riscado**. O cliente paga o valor com desconto em tudo — card, detalhes, sacola, checkout, **QR do PIX** e mensagem do WhatsApp (que mostra a economia).
- Preço com desconto arredondado **para baixo** em R$ 0,10 (a favor do cliente). Vale até o fim do dia da data final; no dia seguinte o site volta sozinho ao preço normal.
- Com margem de 50% na planilha, **28,5% de desconto** leva o preço de volta ao equivalente à margem de ~30%.
- Faixa da promoção no topo do site e no catálogo (somem quando não há promoção ativa).
- Cálculo único em `assets/js/promo.js` (usado pelo site, pelo painel e pelos testes).
- **Atenção legal:** preço riscado deve ser um preço realmente praticado antes. “De” inventado é propaganda enganosa (CDC art. 37) e pode gerar multa do Procon.

### Estoque

- Campo `stock` de cada produto. O site mostra **Em estoque / Restam N unidades / Última unidade / Esgotado**, limita a quantidade na sacola e bloqueia itens esgotados.
- O checkout **não baixa o estoque sozinho**: ao confirmar uma venda, use **−1** na aba Estoque do painel.

---

## 5. Domínio, DNS e HTTPS

### Registros DNS (Hostinger → Domínios → akyllashop.com → DNS / Nameservers)

| Tipo | Nome | Valor |
|---|---|---|
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |
| CNAME | www | tanattos18.github.io |

- Nameservers da Hostinger: `aurora.dns-parking.com` e `nebula.dns-parking.com`.
- Não apague registros **MX/TXT** se for usar e-mail `@akyllashop.com`.

### GitHub Pages

- **Settings → Pages:** *Deploy from a branch* → `main` / `(root)` · *Custom domain*: `akyllashop.com` · **Enforce HTTPS** marcado (o certificado é gerado pelo GitHub depois que o DNS aponta certo; pode levar até ~1 hora).
- O arquivo **`CNAME`** na raiz (conteúdo: `akyllashop.com`) liga o domínio. **Não apague.**
- Recomendado: verificar o domínio em **Settings da conta → Pages → Add a domain**, para ninguém usá-lo em outro repositório.
- `www.akyllashop.com` redireciona para `akyllashop.com`.

### Se o site sair do ar

1. Confira o DNS: `nslookup akyllashop.com 8.8.8.8` deve mostrar os 4 IPs `185.199.10x.153`.
2. Confira se o arquivo `CNAME` existe no repositório.
3. Em **Settings → Pages**, remova e salve de novo o *Custom domain* para forçar nova verificação.

### Endereços fixos que dependem do domínio

`index.html`, `privacidade.html` e `termos.html` (`canonical`, `og:url`, `og:image`, JSON-LD), `sitemap.xml` e `robots.txt` usam `https://akyllashop.com/`. Ao trocar de domínio, troque nesses arquivos e no `CNAME`.

---

## 6. Estrutura de arquivos

```
Akylla_Store/
├── index.html              # loja (catálogo, sacola, checkout PIX)
├── privacidade.html        # Política de Privacidade (LGPD)
├── termos.html             # Termos de Uso (CDC)
├── CNAME                   # domínio do GitHub Pages: akyllashop.com
├── robots.txt / sitemap.xml
├── admin/                  # painel administrativo
│   ├── index.html · admin.css · admin.js
│   └── formato.js          # lê/escreve products.js e config.js (usado também pelos testes)
├── assets/
│   ├── css/styles.css
│   ├── fonts/              # DM Sans e Sora (woff2 locais, licença OFL)
│   ├── img/
│   │   ├── favicon.png · logo-mark.jpg   # ícone da marca (o "A" da logo)
│   │   ├── vitrine.jpg · vitrine-640.jpg # foto da vitrine (topo)
│   │   ├── og-cover.jpg                  # capa de compartilhamento
│   │   └── products/                     # fotos WebP 700×700 (principal + galerias)
│   ├── js/
│   │   ├── app.js          # catálogo, filtros, sacola, checkout, diálogos
│   │   ├── config.js       # WhatsApp, PIX, textos, promoção, margem  (editado pelo painel)
│   │   ├── products.js     # catálogo, preços, estoque, fotos           (editado pelo painel)
│   │   ├── promo.js        # cálculo de promoções
│   │   └── pix.js          # gerador do BR Code PIX + CRC16
│   └── vendor/qrcode.js    # qrcode-generator 2.0.4 (MIT)
├── scripts/atualizar-precos.js   # relatório site × planilha (não altera nada)
├── tests/site.test.js            # testes automáticos
├── .github/workflows/testes.yml  # roda os testes a cada push
├── docs/PLANO_MELHORIAS_AKYLLA_STORE.md
└── CHECKLIST_MELHORIAS_AKYLLA_STORE.md
```

---

## 7. Formato dos dados

`assets/js/products.js` e `assets/js/config.js` são **JSON atribuído a `window.*`** (o site carrega com `<script>`; o painel lê com `JSON.parse`, sem executar código). Dá para editar à mão, mas o painel reescreve a formatação.

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
  "summary": "Texto curto do card",
  "description": "Texto completo dos detalhes",
  "image": "assets/img/products/w31-pro-max.webp",
  "imageAlt": "Descrição da foto",
  "gallery": ["assets/img/products/w31-pro-max-1.webp"],
  "illustrative": true,
  "hidden": true,
  "promo": { "percent": 15, "until": "2026-11-15" },
  "specs": [{ "label": "Tela", "value": "Alta definição" }]
}
```

- `code`: código do fornecedor (o mesmo do cupom e da planilha). `category`: `smartwatches`, `audio`, `drones`, `carregadores`, `cabos`, `acessorios`. `visual` (ícone sem foto): `watch`, `earbuds`, `headphones`, `drone`, `cable`, `charger`, `powerbank`, `mic`.
- Opcionais: `gallery` (fotos extras), `illustrative` (aviso “Imagem ilustrativa”), `hidden` (fora do site), `promo` (sem o campo = segue a promoção geral; `{ "percent": 0 }` = fora da promoção).

### Configuração (`window.AKYLLA_CONFIG`)

Campos principais: `storeName`, `city`, `whatsapp` (só dígitos, com 55 e DDD), `whatsappDisplay`, `whatsappMessage`, `pixKey`, `pixHolder`, `pixMerchantName` (máx. 25), `pixCity` (máx. 15), textos de atendimento, `year`, `marginPercent` (margem da planilha) e `promo`:

```json
"promo": { "active": true, "text": "Descontos de inauguração", "percent": 10, "until": "2026-10-31" }
```

> Telefone, endereço e CPF que aparecem **fixos** no rodapé e nas páginas legais ficam no HTML (não mudam pelo painel).

---

## 8. PIX

`assets/js/pix.js` monta o **BR Code estático** (EMV® QRCPS-MPM): chave, valor exato do pedido (já com desconto), nome e cidade do recebedor, txid do pedido e CRC16-CCITT. O QR é gerado no navegador e pode ser baixado em PNG. A confirmação é **manual**, pelo comprovante enviado no WhatsApp — confira o valor recebido no banco antes de liberar o pedido.

Validar um payload no console do navegador:

```js
window.AkyllaPix.validatePixPayload(document.getElementById('pixPayloadPreview').textContent);
```

---

## 9. Privacidade e arquivos que não vão para o GitHub

O repositório é **público**. O `.gitignore` bloqueia:

| Arquivo | Por quê |
|---|---|
| `Planilha_Precificacao_Produtos*.xlsx` / `*.xlsx` | custos e margens |
| `Comprovante_Cupom*.pdf` / `*.pdf` | cupom do fornecedor com CPF e endereço |
| `Chave*PIX.txt`, `WhatsApp Image*.jpeg` | dados pessoais de referência |
| `Logo_Vitrine.png`, `Banner vitrine da loja.png` | artes-fonte (as versões otimizadas estão em `assets/img/`) |
| `fotos-candidatas/` | fotos baixadas para validação |

- O site não coleta dados: a sacola fica no navegador do cliente (`localStorage`); contato e comprovante passam pelo WhatsApp.
- O rodapé e as páginas legais identificam o vendedor (nome, CPF e endereço), como exige o Decreto 7.962/2013.
- Nunca coloque senhas, tokens ou chaves de API em arquivos do site.

---

## 10. Testes

```bash
node --test "tests/*.test.js"
```

Rodam também no GitHub Actions a cada push. Cobrem: catálogo (ids/códigos únicos, fotos e galerias existentes, estoque válido), formato dos arquivos do painel, PIX (CRC e valor com desconto), promoções (desconto, data final, regras por produto), identificação do vendedor, fontes locais, arquivos referenciados e segurança do painel.

---

## 11. Pendências

- [ ] Confirmar o WhatsApp **(62) 8151-7002**: celulares costumam ter 9 dígitos — se precisar, usar `5562981517002` (aba Loja do painel).
- [ ] Marcar **Enforce HTTPS** em Settings → Pages assim que o certificado do `akyllashop.com` for emitido.
- [ ] Verificar o domínio na conta do GitHub (Pages → Add a domain).
- [ ] Fotos reais do estoque para os 4 produtos com foto ilustrativa (Carregador 35W, CAR-12728C, Fonte EL-4051, Cabo 30207B).
- [ ] Logo oficial em SVG/PNG transparente (o ícone atual foi recortado da arte da vitrine).
- [ ] Redes sociais e Perfil da Empresa no Google (links no rodapé).
- [ ] Revisar garantia, entrega e trocas com contador/advogado (referências gerais ao CDC).
- [x] Teste do QR PIX em app bancário — feito.
- [x] Identificação do vendedor (nome, CPF, endereço) — feito.
- [x] Domínio próprio `akyllashop.com` — feito em 20/10/2026.

---

## 12. Histórico resumido

| Data | O que mudou |
|---|---|
| 19/10/2026 | Primeira versão: landing page, catálogo de 22 produtos, sacola e checkout PIX. |
| 20/10/2026 | Códigos reais do fornecedor; identificação do vendedor; fontes locais; testes automáticos. |
| 20/10/2026 | Nova arte da vitrine, paleta laranja da marca, ícone da logo. |
| 20/10/2026 | Estoque nos produtos; planilha refeita a partir do cupom (fórmulas absolutas). |
| 20/10/2026 | Galerias de fotos (43 fotos extras em 12 produtos); correção do modal no celular. |
| 20/10/2026 | Painel administrativo (`/admin/`). |
| 20/10/2026 | Promoções com desconto real; preços com margem de 50%. |
| 20/10/2026 | WhatsApp trocado para (62) 8151-7002; domínio `akyllashop.com` (antes: `tanattos18.github.io/Akylla_Store`). |

O histórico completo está nos commits: `git log --oneline`.

---

## 13. Créditos e licenças

- **Foto da vitrine e logo:** arte fornecida pela loja.
- **Fotos dos produtos:** referências de fabricantes, distribuidores e lojas (Basike, Basike Inova, Inova e anúncios aprovados pelo responsável). Direitos dos respectivos titulares; itens sem foto exata têm o aviso “Imagem ilustrativa”. Se alguém pedir a remoção de uma foto, substitua pelo painel.
- **QR Code:** [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) de Kazuhiko Arase (MIT).
- **Fontes:** Sora e DM Sans (SIL Open Font License), servidas localmente.
- **Ícones:** SVGs originais do projeto.

> As informações jurídicas do site são referências gerais ao CDC e à LGPD e não substituem a orientação de um advogado ou contador.

## 14. Suporte

Akylla Store — WhatsApp **(62) 8151-7002** · <https://akyllashop.com/>
