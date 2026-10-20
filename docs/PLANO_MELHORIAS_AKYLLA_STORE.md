# Plano de melhorias — Akylla Store

Registro da auditoria e das melhorias aplicadas conforme o
`CHECKLIST_MELHORIAS_AKYLLA_STORE.md`. Site: <https://tanattos18.github.io/Akylla_Store/>

**Data da execução:** 20/10/2026 · **Branch:** `main` · **Commit base:** `1b76b6d`

---

## 1. Diagnóstico inicial (Etapa 0)

### Estado do repositório

- Branch `main`, working tree limpa (apenas arte-fonte do banner e o checklist, ambos tratados no primeiro commit `d256cb1`).
- Estrutura real confere com o README: `index.html`, `assets/css/styles.css`, `assets/js/{app,config,pix,products}.js`, `assets/vendor/qrcode.js`, 22 fotos WebP.
- **Histórico do Git limpo:** verificado com `git log --all --diff-filter=A` — cupom fiscal, chave PIX em TXT, planilha e imagem pessoal **nunca** foram commitados.
- JS sem erros de sintaxe; CRC16 do PIX confere com o vetor oficial (`crc16('123456789') === '29B1'`).
- 30 referências de assets no HTML/JS, **nenhum arquivo quebrado**; 22 produtos com IDs únicos, preços inteiros em centavos, categorias e ícones válidos.

### Observação sobre "Nada encontrado por aqui"

A tela vazia vista na leitura da página publicada é o **estado vazio nativo** do catálogo (`#catalogEmpty`), que só aparece quando a busca/filtro não retorna itens. O catálogo é renderizado por JavaScript e **foi confirmado funcionando**: smoke test em DOM real (jsdom) executando `index.html` + os 5 scripts reais do projeto carrega os 22 produtos e todo o fluxo de compra (47 asserções, todas verdes — detalhe na seção 4).

### Problemas reproduzíveis encontrados e corrigidos

| # | Severidade | Problema | Evidência | Correção |
|---|---|---|---|---|
| 1 | **Alta** | Cards flutuantes do hero exibiam preços errados: W31 Pro Max "R$ 131,90" (real: R$ 95,90) e drone "R$ 92,90" (real: R$ 299,00) — divergência direta com o catálogo, risco de pagamento errado | `index.html` vs `products.js` (`price: 9590` e `29900`) | Preços corrigidos para os valores do catálogo |
| 2 | **Alta** | Download do QR em PNG podia sair em branco: o SVG é gerado com `scalable: true` (sem `width`/`height`) e o `drawImage` de SVG sem dimensões intrínsecas falha em parte dos navegadores | `app.js` `renderQrCode` + `downloadQrCode` | O download agora clona o SVG e grava `width`/`height` a partir do `viewBox` antes de rasterizar |
| 3 | Média | Estado vazio não oferecia como limpar busca/filtros | `#catalogEmpty` sem ação de limpeza | Novo botão "Limpar busca e filtros" (`clearFilters()` restaura busca, ordenação e categoria) |
| 4 | Média | Contagens "22 produtos" fixas em 4 lugares (lead, estatística, menu mobile) — desatualizariam com qualquer mudança de catálogo | `index.html` × `products.js` | Preenchidas por JS via `[data-catalog-count]` |
| 5 | Média | Rolagem suave ignorava `prefers-reduced-motion` em 3 pontos do JS | `scrollIntoView({behavior:'smooth'})` | Helper `scrollToSection()` respeitando a preferência |
| 6 | Baixa | Controle de quantidade sem papel ARIA | `<div class="qty-control" aria-label>` | Adicionado `role="group"` |
| 7 | Baixa | Checkout podia montar pedido com total zerado (estado teórico) | `openCheckout` | Guarda de total > 0 |
| 8 | Baixa | Ausência de `robots.txt`, `sitemap.xml`, política de privacidade e termos de uso | Itens do checklist E/G | Criados `robots.txt`, `sitemap.xml`, `privacidade.html` e `termos.html` |
| 9 | Baixa | Scripts bloqueavam parsing no final do body | `<script>` sem defer | `defer` nos 5 scripts (ordem preservada) |
| 10 | Baixa | Disponibilidade não explicitada no ponto da sacola | Textos do checkout | Aviso "Consulte a disponibilidade do item antes de finalizar" adicionado à sacola |

### Itens que exigem decisão do responsável (não alterados)

Registrar e confirmar antes da próxima publicação — nada foi inventado:

1. **Logo oficial em arquivo** (SVG/PNG sem fundo) para cabeçalho e favicon: o checklist pede "logo aprovada"; só existe dentro do banner. Pendência registrada, não criado caminho inventado.
2. **Confirmação comercial:** telefone/WhatsApp, chave PIX, nome do recebedor, cidade, preços e disponibilidade seguem exatamente como já estavam; precisam de confirmação formal.
3. **CNPJ/CPF, endereço e redes sociais da Akylla:** não adicionados por não estarem confirmados (o endereço do cupom é do fornecedor, não da loja).
4. **Prazos de entrega, frete e retirada:** mantidos como "combinado pelo WhatsApp"; não prometidos prazos.
5. **Leitura bancária do QR:** necessário teste no app do banco pelo responsável (sem concluir pagamento), validando recebedor e valor.
6. `json-ld` mantém telefone e `priceRange` já publicados; revisar se a loja mudar de número.

---

## 2. Melhorias aplicadas por etapa

| Etapa | O que foi feito | Arquivos |
|---|---|---|
| 1 — Identidade visual | Preços do hero corrigidos; banner/logo existentes preservados; estilos novos via variáveis existentes, sem quebrar a paleta preta/laranja | `index.html`, `styles.css` |
| 2 — Navegação/mobile | `defer` nos scripts, footer com coluna institucional, layout do estado vazio em flex responsivo, rolagem respeitando reduced-motion | `index.html`, `app.js`, `styles.css` |
| 3 — Catálogo | Contagens dinâmicas, limpar busca/filtros, testes de busca sem acento/caixa alta, ordenação e paginação | `index.html`, `app.js` |
| 4 — Sacola/PIX | Fix do download do QR, guarda de total, `role="group"`, payload validado (CRC16, campo 54, chave, titular) | `app.js` |
| 5 — Confiança/privacidade | `privacidade.html` e `termos.html` fiéis ao funcionamento real (sem backend, PIX manual, LGPD, CDC), links no rodapé e no card de privacidade | `privacidade.html`, `termos.html`, `index.html` |
| 6 — SEO | `robots.txt`, `sitemap.xml`, canonical/OG nas páginas novas, HTML semântico preservado, dados estruturados apenas com dados verificados | `robots.txt`, `sitemap.xml`, páginas novas |
| 7 — Performance | `defer`, download do QR robusto, sem novas dependências, imagens já otimizadas (hero 99 KB, produtos WebP) | `index.html`, `app.js` |
| 8 — Acessibilidade | `role="group"`, aria-pressed verificado em chips, alt de produto verificado, `prefers-reduced-motion` no JS, foco/labels já existentes conferidos | `app.js`, `styles.css` |
| 9 — Regressão/entrega | 47 asserções automatizadas em DOM real + validação PIX no Node + checagem de assets e XML | testes externos (ver seção 4) |

---

## 3. Riscos e limitações mantidas (por regra do checklist)

- Sem backend: confirmação de pagamento continua **manual** via WhatsApp; nada no texto do site sugere o contrário.
- Sem controle de estoque: disponibilidade confirmada no atendimento; aviso reforçado na sacola.
- Sacola apenas em `localStorage`; dados corrompidos ou itens removidos do catálogo são descartados com segurança (testado).
- Nenhum dado pessoal, token ou credencial foi adicionado; chave PIX permanece a mesma (é pública por natureza).

---

## 4. Testes executados e resultados

Ambiente: Node 22 + jsdom, carregando `index.html` e os 5 scripts **reais** do projeto (nenhuma dependência adicionada ao site).

| Grupo | Verificações | Resultado |
|---|---|---|
| Dados | 22 produtos, IDs únicos, preços inteiros, categorias/ícones válidos, fotos existem | 6/6 ✅ |
| Catálogo | 8 cards iniciais, contagens dinâmicas, "Ver mais" até 22 sem duplicar, selo ilustrativa | 6/6 ✅ |
| Busca/filtros | Caixa alta sem acento ("RELOGIO"), busca por marca ("carregador inova" → 3), estado vazio, limpar filtros, chips aria-pressed, ordenação por preço | 7/7 ✅ |
| Sacola | Adicionar, alterar quantidade, remover, total recalculado, persistência em nova sessão, storage corrompido, item inválido descartado | 7/7 ✅ |
| Checkout PIX | Diálogo abre, valor = total, payload válido (CRC16), campo 54 correto, chave e titular no payload, QR renderizado com dimensões para download, recebedor exibido | 8/8 ✅ |
| WhatsApp | Links com número correto, mensagem de comprovante com pedido/total, modal com código do produto | 3/3 ✅ |
| Acessibilidade/SEO | Skip link, alt das fotos, ano dinâmico | 3/3 ✅ |
| Node (isolado) | `crc16` vetor oficial 29B1, payload real com valor 95.90, `sitemap.xml` bem formado (3 URLs) | ✅ |

**Total: 47/47 asserções + validações Node.**

Testes manuais ainda pendentes (exigem dispositivo real — checklist H): leitura do QR no app bancário, zoom 200% e teclado em navegador físico, e conferência da URL pública pós-deploy em celular e desktop.

---

## 5. Pendências para o responsável

- [ ] Enviar a **logo oficial** em arquivo (SVG/PNG) para substituir o ícone genérico do cabeçalho/favicon.
- [ ] Confirmar WhatsApp, chave PIX, recebedor, cidade, preços e disponibilidade.
- [ ] Confirmar/ fornecer CNPJ, endereço e redes sociais (só então publicados).
- [ ] Testar o QR PIX no app do banco (sem pagar) e conferir recebedor/valor.
- [ ] Revisar textos de garantia/entrega com o contador ou advogado (referências ao CDC, não aconselhamento jurídico).
- [ ] Definir prazos de entrega/frete se a operação quiser sair do "combinado pelo WhatsApp".
