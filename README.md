# Akylla Store — Landing Page

Landing page responsiva de uma loja de eletrônicos e acessórios de informática, com catálogo de 22 produtos, sacola local e checkout PIX estático (QR Code + copia e cola).

**Repositório:** <https://github.com/Tanattos18/Akylla_Store>

**Branch principal:** `main`

![Prévia da landing page da Akylla Store](assets/img/og-cover.jpg)

**Stack:** HTML5 · CSS3 · JavaScript (ES5+) · sem build · sem backend

**Site publicado:** <https://tanattos18.github.io/Akylla_Store/>

---

## Visão geral

O projeto é 100% estático — HTML, CSS e JavaScript, sem build, sem servidor e sem dependências de framework. Ele foi pensado para ser publicado no GitHub Pages, Netlify, Vercel ou qualquer hospedagem de arquivos estáticos.

### O que está implementado

- Hero section com banner da vitrine, cards flutuantes e CTAs.
- Catálogo com 22 produtos extraídos do cupom fiscal de 19/10/2026.
- Fotos dos produtos, ficha técnica e modal de detalhes com resumo, especificações e adição à sacola.
- Busca por nome, modelo, marca, código ou especificação.
- Filtros por categoria e ordenação por preço/nome.
- Paginação progressiva ("Ver mais produtos").
- Sacola persistida em `localStorage`, com quantidade, remoção e total.
- Estado vazio do catálogo com opção de **limpar busca e filtros**.
- Checkout PIX com:
  - QR Code gerado no navegador;
  - payload EMV/PIX com valor exato do pedido e CRC16 válido;
  - chave PIX e código copia e cola;
  - download do QR em PNG (fallback SVG);
  - resumo do pedido e link para envio do comprovante no WhatsApp.
- Seções de sobre, como funciona, garantia, entrega, pagamento, privacidade, FAQ e contato.
- Páginas de **Política de Privacidade** e **Termos de Uso**, alinhadas ao funcionamento real (LGPD e CDC).
- `robots.txt` e `sitemap.xml` para indexação.
- Menu mobile, drawer de carrinho e modal de checkout com `<dialog>` nativo.
- Foco visível, contraste WCAG AA, suporte a `prefers-reduced-motion` e navegação por teclado.
- Layout responsivo testado de 320px a 1440px.

### Limitações importantes

- **Não há backend.** O checkout não confirma pagamentos automaticamente e não baixa estoque.
- A confirmação do pedido é **manual**, após o envio do comprovante no WhatsApp.
- A sacola fica apenas no navegador do cliente (`localStorage`).
- Para confirmação automática, painel administrativo, controle de estoque ou emissão de pedidos, será necessário integrar um backend e um PSP (Mercado Pago, Efí, Asaas, PagSeguro etc.).
- As fotos dos produtos são **imagens de referência** de fabricantes, distribuidores e lojas parceiras. Itens sem foto exata do modelo/versão usam uma imagem representativa da mesma linha e recebem o selo **“Imagem ilustrativa”** no card e no modal. Cores, versões e disponibilidade devem ser confirmadas pelo WhatsApp antes da compra.

---

## Estrutura de arquivos

```
Akylla_Store/
├── index.html
├── privacidade.html   # Política de privacidade (LGPD)
├── termos.html        # Termos de uso (CDC)
├── robots.txt
├── sitemap.xml
├── assets/
│   ├── css/
│   │   └── styles.css
│   ├── img/
│   │   ├── favicon.svg
│   │   ├── hero-loja.jpg
│   │   ├── og-cover.jpg
│   │   └── products/      # 22 fotos WebP 700×700 (produtos)
│   ├── js/
│   │   ├── app.js       # catálogo, sacola, filtros, checkout e diálogos
│   │   ├── config.js    # WhatsApp, PIX, textos institucionais e ano
│   │   ├── pix.js       # gerador de BR Code PIX + CRC16
│   │   └── products.js  # catálogo (22 produtos, preços em centavos)
│   └── vendor/
│       └── qrcode.js    # qrcode-generator 2.0.4 (MIT)
├── docs/
│   └── PLANO_MELHORIAS_AKYLLA_STORE.md   # auditoria, testes e pendências
├── CHECKLIST_MELHORIAS_AKYLLA_STORE.md
├── .gitattributes
├── .gitignore
└── README.md
```

Arquivos de referência que **não devem ser publicados** (contêm dados pessoais) ficam fora do versionamento:

- `Cupon_Fiscal_Itens.pdf`
- `Chave PIX.txt`
- `WhatsApp Image ... .jpeg`

Eles continuam na pasta local para consulta, mas estão listados no `.gitignore`.

---

## Como visualizar localmente

### Opção 1 — abrir direto

Abra `index.html` no navegador. O site funciona via `file://`, inclusive a geração do QR Code.

### Opção 2 — servidor local (recomendado)

```bash
cd Akylla_Store
python -m http.server 8000
```

Depois acesse <http://localhost:8000>.

Também é possível usar `npx serve .` ou a extensão Live Server do VS Code.

---

## Como editar

### Produtos e preços

Arquivo: `assets/js/products.js`

Cada produto segue este formato:

```js
{
  id: 'w31-pro-max',
  name: 'Relógio Inteligente W31 Pro Max Basike',
  shortName: 'W31 Pro Max',
  brand: 'Basike',
  model: 'W31 Pro Max',
  code: '9997',
  category: 'smartwatches',
  visual: 'watch',
  price: 13190, // centavos = R$ 131,90
  description: '...'
}
```

- `price` está em **centavos** para evitar erros de arredondamento.
- `visual` deve ser um dos ícones disponíveis: `watch`, `headphones`, `earbuds`, `drone`, `cable`, `charger`, `powerbank`, `mic`.
- `category` deve existir em `window.AKYLLA_CATEGORIES`.
- Para adicionar um produto, copie um bloco e use um `id` único.

### Configurações da loja

Arquivo: `assets/js/config.js`

```js
window.AKYLLA_CONFIG = {
  storeName: 'Akylla Store',
  whatsapp: '5562991657619',
  whatsappDisplay: '(62) 99165-7619',
  pixKey: '7dda9a3c-400d-45de-906b-f22b2615f1d5',
  pixHolder: 'Joás Santana Nascimento',
  pixMerchantName: 'JOAS SANTANA NASCIMENTO',
  pixCity: 'GOIANIA',
  // ...
};
```

- `whatsapp` deve conter DDI + DDD + número, apenas dígitos.
- `pixMerchantName` e `pixCity` entram no BR Code; use no máximo 25 e 15 caracteres, respectivamente.
- A chave PIX é pública por natureza. **Nunca** coloque segredos, tokens de API ou senhas no frontend.
- O nome do recebedor exibido na tela é `pixHolder`. Confirme se ele aparece exatamente como no banco.

### Textos institucionais

Os textos de garantia, entrega e pagamento estão no `index.html` (seções `#garantia`, `#faq` e rodapé) e em `config.js`. Revise-os antes de publicar.

### Fotos e informações dos produtos

As fotos ficam em `assets/img/products/` e foram padronizadas em **WebP 700×700**, com fundo claro e recorte para o produto. As fontes são páginas de fabricantes, distribuidores e lojas brasileiras (Basike, Inova, Inovar, Mercado Livre e parceiros).

- `image`: caminho da foto exibida no card.
- `imageAlt`: descrição textual da foto para acessibilidade.
- `illustrative: true`: marca o produto com o aviso **“Imagem ilustrativa”** no card e no modal. Use quando a foto não for exatamente do modelo/versão vendida.
- `summary`: texto curto do card.
- `description`: texto completo do modal.
- `specs`: lista de especificações exibida no modal.

> Os cards flutuantes do hero (`index.html`) citam preços fixos de produtos em destaque. Se alterar `price` no `products.js`, atualize também esses valores para manter a consistência.

Para substituir uma foto, gere um WebP quadrado (recomendado: 700×700) e mantenha o mesmo nome de arquivo, ou atualize o campo `image` do produto. Se a foto for exata, remova `illustrative: true`. Se for representativa, mantenha o aviso.

> As imagens são usadas como referência comercial. Marcas, modelos e direitos das fotos pertencem aos respectivos titulares. Se alguma imagem não puder ser utilizada, substitua o arquivo ou entre em contato com o responsável pela loja.

---

## PIX: como funciona

O arquivo `assets/js/pix.js` monta o **BR Code estático** no padrão EMV® QRCPS-MPM:

1. Campo `00` — payload format indicator (`01`).
2. Campo `26` — merchant account information:
   - `00` = `BR.GOV.BCB.PIX`
   - `01` = chave PIX
   - `02` = descrição do pedido (opcional)
3. Campo `52` — merchant category code (`0000`).
4. Campo `53` — moeda (`986` = BRL).
5. Campo `54` — valor do pedido em reais (ex.: `131.90`).
6. Campo `58` — país (`BR`).
7. Campo `59` — nome do recebedor.
8. Campo `60` — cidade do recebedor.
9. Campo `62` — txid alfanumérico do pedido.
10. Campo `63` — CRC16-CCITT (polinômio `0x1021`).

O valor é recalculado a cada novo checkout, a partir do total da sacola. O QR é gerado com `qrcode-generator` (MIT) e o usuário pode baixá-lo em PNG.

### Teste do payload

O console do navegador expõe o validador:

```js
const payload = document.getElementById('pixPayloadPreview').textContent;
window.AkyllaPix.validatePixPayload(payload);
// { valid: true, fields: {...} }
```

Também é possível testar no Node:

```bash
node -e "global.window=global; require('./assets/js/pix.js'); console.log(window.AkyllaPix.crc16('123456789'))"
# 29B1
```

> **Atenção:** o QR contém o valor do pedido e a chave real. Antes de divulgar, faça um teste de leitura no app do seu banco e confirme o recebedor e o valor. Não é necessário concluir o pagamento para conferir os dados.

---

## Privacidade e dados pessoais

- O site não coleta dados de cartão, não processa pagamentos e não envia dados para servidores próprios.
- A sacola é salva somente no `localStorage` do navegador.
- O contato, o comprovante e eventuais dados do pedido são tratados pelo WhatsApp.
- O cupom fiscal usado como referência contém CPF, endereço e telefone de cliente. Por isso, o PDF, o TXT da chave PIX e a imagem original estão no `.gitignore` e **não devem ser commitados**.
- Se você adicionar analytics, pixels, formulários ou um PSP, será necessário criar uma política de privacidade adequada à LGPD.

---

## Antes de publicar — checklist

- [ ] Confirmar o telefone/WhatsApp da loja em `config.js` (o número usado veio do cupom).
- [ ] Confirmar a chave PIX, o nome do recebedor e a cidade.
- [ ] Revisar os 22 preços e a disponibilidade dos produtos.
- [ ] Revisar as fotos marcadas como **ilustrativas** e, se possível, substituir pelas fotos reais do estoque.
- [ ] Revisar garantia, entrega, trocas e condições de pagamento.
- [ ] Adicionar **CNPJ/CPF e endereço da Akylla Store** no rodapé. O CNPJ e o endereço que aparecem no topo do cupom são do **emitente/fornecedor**, não da Akylla; por isso não foram publicados.
- [ ] Adicionar links de redes sociais, se existirem (não foram inventados).
- [ ] Configurar domínio próprio e atualizar `og:image` para uma URL absoluta.
- [ ] Testar o QR PIX em um app bancário (sem concluir o pagamento).
- [ ] Verificar o site no celular real e em navegadores diferentes.
- [ ] Se o repositório for público, conferir se nenhum documento pessoal foi commitado.
- [x] Considerar uma política de privacidade e termos de uso separados. — Criados `privacidade.html` e `termos.html` (revisar se a operação mudar).

### Qualidade e testes

- A auditoria completa, os testes executados (47 asserções em DOM real + validação PIX no Node) e as pendências estão em [`docs/PLANO_MELHORIAS_AKYLLA_STORE.md`](docs/PLANO_MELHORIAS_AKYLLA_STORE.md).
- Validação rápida do gerador PIX no Node:

```bash
node -e "global.window=global; require('./assets/js/pix.js'); const v=window.AkyllaPix.validatePixPayload(window.AkyllaPix.buildPixPayload({key:'SUA_CHAVE',merchantName:'NOME',city:'GOIANIA',amountCents:9590,txid:'AKTESTE',description:'Pedido teste'})); console.log(v.valid, v.fields['54'])"
```

> As informações jurídicas da página são referências gerais ao CDC (garantia legal de 90 dias para bens duráveis e direito de arrependimento de 7 dias em compras fora do estabelecimento). Elas não substituem a orientação de um advogado ou contador.

---

## Publicação

O código já está versionado e publicado no branch `main` do repositório. Para atualizar o site, basta commitar e enviar:

```bash
git add .
git commit -m "descreva a alteração"
git push
```

### GitHub Pages

O site já está publicado em:

```text
https://tanattos18.github.io/Akylla_Store/
```

O deploy é feito a partir da branch `main`, pasta `/ (root)`. Cada `git push` na `main` atualiza o site em 1–2 minutos.

Configuração usada: **Settings → Pages → Deploy from a branch → main / (root)**.

Como todos os caminhos são relativos, o site funciona tanto no GitHub Pages quanto em domínio próprio. O `og:image` já aponta para a URL absoluta da capa em `index.html`.

### Outras opções

- **Netlify/Vercel:** arraste a pasta ou conecte o repositório; não há comando de build.
- **Cloudflare Pages:** publique o diretório raiz como site estático.

---

## Créditos e licenças

- **Foto da vitrine:** imagem fornecida pela loja.
- **Fotos dos produtos:** imagens de referência de fabricantes, distribuidores e lojas parceiras (Basike, Inova, Inovar, Mercado Livre e outros). Direitos reservados aos respectivos titulares; itens sem foto exata estão sinalizados como **“Imagem ilustrativa”**.
- **Ícones e fallback de produto:** SVGs originais criados para este projeto.
- **QR Code:** [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) de Kazuhiko Arase, licença MIT (cabeçalho original preservado em `assets/vendor/qrcode.js`).
- **Fontes:** Sora e DM Sans, via Google Fonts (carregadas por CDN; há fallback para fontes do sistema).
- **Ícones da interface:** SVGs originais no sprite inline do `index.html`.

---

## Suporte

Dúvidas sobre o código ou ajustes: fale com a Akylla Store pelo WhatsApp **(62) 99165-7619**.
