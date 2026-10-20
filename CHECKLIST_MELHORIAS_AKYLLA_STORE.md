# Akylla Store — Checklist de melhorias e prompt de execução

**Repositório:** https://github.com/Tanattos18/Akylla_Store  
**Site:** https://tanattos18.github.io/Akylla_Store/

## Diagnóstico inicial dos links

O README descreve uma loja estática em HTML, CSS e JavaScript, sem backend ou etapa de build. A estrutura documentada inclui `index.html`, `assets/css/styles.css`, `assets/js/app.js`, `config.js`, `pix.js`, `products.js`, imagens e biblioteca de QR Code.

Funcionalidades documentadas: catálogo de 22 produtos, busca/filtros/ordenação, modal de detalhes, sacola em `localStorage`, checkout PIX com QR Code e código copia e cola, confirmação manual pelo WhatsApp, FAQ, informações comerciais e layout responsivo.

**Verificações importantes:**
- Na leitura do site publicado apareceu o estado “Nada encontrado por aqui”. Isso pode ser limitação da leitura do JavaScript pela ferramenta; verificar em navegador real se os 22 produtos carregam.
- O README informa que o site não confirma pagamentos automaticamente, não baixa estoque e não registra pedidos em backend.
- A sacola fica somente no navegador do cliente.
- O repositório contém configurações comerciais no JavaScript público. Confirmar os dados e lembrar que arquivos do front-end são visíveis a visitantes.
- As fotos podem ser ilustrativas. Manter o aviso quando não forem do modelo exato.
- Não adicionar promessas como “entrega rápida”, “compra segura” ou “suporte especializado” sem confirmar que a operação realmente oferece isso.

---

## 1. Prompt completo para o agente de programação

Copie o texto abaixo para OpenCode, Claude Code ou outro agente com acesso ao repositório. Execute a partir da raiz do projeto.

```text
Você é um engenheiro de software sênior, especialista em e-commerce estático, UX/UI, acessibilidade, segurança front-end e conversão.

PROJETO
- Akylla Store
- Repositório: https://github.com/Tanattos18/Akylla_Store
- Site: https://tanattos18.github.io/Akylla_Store/
- Stack documentada: HTML5, CSS3 e JavaScript, sem framework, build ou backend.
- Arquivos documentados: index.html, assets/css/styles.css, assets/js/app.js, config.js, pix.js, products.js, assets/img/ e assets/vendor/qrcode.js.

OBJETIVO
Auditar e melhorar a loja em etapas pequenas, profissionais e testáveis. Preserve a identidade visual preta, branca/cinza e laranja. Mantenha as funcionalidades existentes e não reescreva tudo sem necessidade.

REGRAS
1. Antes de editar, inspecione o repositório, leia o README e registre branch, commit e estado do Git.
2. Não presuma que algo está quebrado sem reproduzir o problema.
3. Não remova produtos, preços, configurações ou funções sem justificativa e autorização.
4. Não invente estoque, avaliações, depoimentos, descontos, frete grátis, prazo de entrega, CNPJ, endereço, redes sociais ou formas de pagamento.
5. Não altere chave PIX, titular, WhatsApp ou preços sem confirmação explícita.
6. Não afirme que o PIX é confirmado automaticamente: a confirmação atual é manual pelo WhatsApp.
7. Não publique documentos pessoais, cupons fiscais, tokens, senhas, credenciais ou arquivos privados.
8. Preserve caminhos relativos para funcionar em GitHub Pages no subdiretório /Akylla_Store/.
9. Evite dependências novas e serviços pagos sem necessidade.
10. Não marque tarefas como concluídas sem executar os testes.
11. Não faça push/publicação sem autorização explícita.
12. Ao fim de cada etapa, informe arquivos alterados, motivos, testes, resultados e pendências.
13. Quando uma alteração depender de dado comercial não confirmado, não invente: registre como pendência.
14. Comece apenas pela Etapa 0. Não avance sem minha autorização.

ETAPA 0 — AUDITORIA
- Registre branch, commit e working tree; preserve alterações locais.
- Leia index.html, styles.css e os arquivos JS do catálogo, carrinho e PIX.
- Confirme a estrutura real e os caminhos dos assets.
- Abra o site localmente e verifique erros no console, se houver navegador disponível.
- Teste o catálogo: a leitura da página publicada exibiu “Nada encontrado por aqui”; confirme se os 22 produtos aparecem em navegador real.
- Registre problemas reproduzíveis e crie/atualize docs/PLANO_MELHORIAS_AKYLLA_STORE.md.
- Não refatore nesta etapa.

ETAPA 1 — IDENTIDADE VISUAL
- Padronize cores, espaçamentos, tipografia, bordas, sombras e botões com variáveis CSS.
- Aplique a logo e o banner aprovados pelo responsável. Se os arquivos não estiverem no repositório, não invente caminhos; solicite os arquivos ou deixe a pendência documentada.
- Não distorça a logo; mantenha o banner responsivo e o texto principal legível.
- Não dependa de texto embutido na imagem para comunicar informação essencial.
- Evite excesso de brilho, animações e elementos que prejudiquem leitura.

ETAPA 2 — NAVEGAÇÃO E MOBILE
- Teste 320, 375, 768, 1024 e 1440 px.
- Corrija overflow horizontal, texto cortado, botões fora da tela e modais que não fecham.
- Garanta foco visível, navegação por teclado, áreas de toque adequadas e nomes acessíveis nos botões de ícone.
- Respeite prefers-reduced-motion.

ETAPA 3 — CATÁLOGO
- Confirme os 22 produtos, IDs únicos, preços em centavos e categorias válidas.
- Teste busca, filtros, ordenação e “Ver mais produtos”.
- Faça a busca tolerar maiúsculas/minúsculas e acentos quando viável.
- Garanta estados vazios compreensíveis e opção para limpar filtros.
- Mantenha nome, preço e aviso de imagem ilustrativa consistentes entre card e modal.
- Não invente estoque; use “Consulte disponibilidade pelo WhatsApp” se não houver controle real.
- Corrija apenas problemas reproduzidos.

ETAPA 4 — SACOLA E PIX
- Teste adicionar, alterar quantidade, remover, total e persistência após recarregar.
- Impessa quantidades inválidas e totais incorretos.
- Confira consistência dos preços entre catálogo, modal, sacola e checkout.
- Valide payload PIX, valor, titular, cidade, CRC16 e correspondência entre QR e código copia e cola.
- Leia o QR no aplicativo bancário para conferir recebedor e valor, sem concluir pagamento.
- Teste download do QR e alternativa em caso de falha.
- Confira a codificação da mensagem do WhatsApp e inclua resumo útil do pedido.
- Explique que o pagamento só é considerado confirmado após conferência manual.
- Não simule backend, baixa de estoque ou confirmação automática.

ETAPA 5 — CONFIANÇA E PRIVACIDADE
- Confirme com o responsável WhatsApp, chave PIX, nome do recebedor, cidade, preços e disponibilidade.
- Revise entrega/retirada, frete, prazos, garantia, troca e arrependimento; não invente condições.
- Só inclua CNPJ/endereço fornecidos e confirmados. Não use dados de fornecedor de nota fiscal como se fossem da loja.
- Revise política de privacidade e termos conforme os dados realmente tratados.
- Verifique se arquivos pessoais, cupons, tokens ou credenciais foram publicados.
- Não adicione analytics, pixels ou cookies sem avaliar privacidade e transparência.
- Não guarde segredos no front-end: arquivos JS públicos podem ser lidos por visitantes.

ETAPA 6 — SEO E COMPARTILHAMENTO
- Revise title, meta description, favicon e Open Graph/Twitter Card.
- Confira que a imagem social tem URL absoluta acessível.
- Preserve caminhos compatíveis com /Akylla_Store/.
- Use HTML semântico e headings em ordem lógica.
- Só adicione dados estruturados com informações verificadas; não invente avaliações, estoque, endereço ou preço.

ETAPA 7 — PERFORMANCE
- Otimize imagens grandes mantendo qualidade.
- Defina dimensões de imagens quando apropriado e use lazy loading abaixo da dobra.
- Não atrase desnecessariamente o banner principal.
- Evite bibliotecas e scripts desnecessários.
- Verifique erros de console, links quebrados e assets ausentes.
- Documente as limitações da arquitetura estática.

ETAPA 8 — ACESSIBILIDADE
- Verifique contraste, foco visível, labels, textos alternativos e navegação por teclado.
- Garanta que modais tenham título acessível, foco gerenciado e fechamento previsível.
- Forneça mensagens acessíveis para busca, cópia do PIX e mudanças na sacola.
- Teste zoom de 200% e prefers-reduced-motion.

ETAPA 9 — REGRESSÃO E ENTREGA
- Teste catálogo, busca, filtros, modal, sacola, persistência, checkout, QR, WhatsApp e responsividade.
- Revise o diff e procure alterações não relacionadas.
- Atualize o README com funções e limitações reais.
- Entregue relatório com arquivos alterados, testes e resultados, pendências e instruções de publicação.
- Não faça push sem autorização.

CRITÉRIOS DE ACEITAÇÃO
- Catálogo carrega corretamente.
- Busca, filtros, ordenação, modal e “Ver mais” funcionam.
- Preços são consistentes.
- Sacola permite alterar/remover itens e persiste no navegador.
- QR/payload PIX é validado e conferido em app bancário sem pagamento real.
- Confirmação manual é explicada claramente.
- WhatsApp abre com mensagem válida.
- Site funciona em celular, teclado e zoom 200%.
- Não há erros críticos, links internos quebrados ou assets ausentes.
- Nenhum dado privado é adicionado ao repositório.
- Alterações e testes são documentados.

COMECE PELA ETAPA 0. Apresente o diagnóstico com evidências e o plano priorizado. Aguarde minha autorização antes de implementar a Etapa 1.
```

---

## 2. Checklist de correção

### A. Antes de editar
- [ ] Confirmar branch `main`.
- [ ] Registrar commit inicial e estado do working tree.
- [ ] Ler README e confirmar estrutura real dos arquivos.
- [ ] Executar localmente e verificar console.
- [ ] Confirmar se os 22 produtos carregam em navegador real.
- [ ] Registrar erros reproduzíveis antes de corrigir.
- [ ] Criar commit/cópia de segurança antes de mudanças significativas.

### B. Logo e vitrine
- [ ] Adicionar a logo aprovada ao repositório.
- [ ] Ajustar logo do cabeçalho sem distorcer proporção.
- [ ] Atualizar favicon se houver arquivo apropriado.
- [ ] Substituir banner temporário pela arte aprovada.
- [ ] Verificar recorte do banner em desktop e celular.
- [ ] Padronizar preto, grafite, branco/cinza e laranja.
- [ ] Melhorar tipografia, espaçamento, botões e cards.
- [ ] Confirmar legibilidade dos textos sobre o banner.
- [ ] Não adicionar promessas comerciais não confirmadas.

### C. Catálogo
- [ ] Os produtos carregam sem erros.
- [ ] Busca funciona por nome/modelo/código quando disponível.
- [ ] Busca lida com maiúsculas/minúsculas e acentos.
- [ ] Filtros de categoria funcionam.
- [ ] Ordenação por preço e nome funciona.
- [ ] “Ver mais produtos” não duplica nem perde itens.
- [ ] Estado sem resultados permite limpar filtros.
- [ ] IDs dos produtos são únicos.
- [ ] Preços batem entre card, modal, sacola e checkout.
- [ ] Imagens ilustrativas estão identificadas.
- [ ] Não há promessa de estoque não controlado pelo sistema.

### D. Sacola e checkout
- [ ] Adicionar produto funciona.
- [ ] Aumentar/diminuir quantidades funciona.
- [ ] Remover produto funciona.
- [ ] Total recalcula corretamente.
- [ ] Sacola persiste após recarregar.
- [ ] Quantidades/valores inválidos são tratados.
- [ ] Modal de checkout abre e fecha corretamente.
- [ ] QR PIX usa o valor correto.
- [ ] Código copia e cola corresponde ao QR.
- [ ] Payload e CRC16 passam no validador.
- [ ] App bancário mostra recebedor e valor esperados, sem pagar.
- [ ] Download do QR funciona ou apresenta alternativa.
- [ ] WhatsApp abre com mensagem válida e resumo correto.
- [ ] Confirmação manual do pagamento está explícita.
- [ ] O site não alega confirmação automática.

### E. Confiança e privacidade
- [ ] Confirmar WhatsApp oficial.
- [ ] Confirmar chave PIX, titular e cidade.
- [ ] Confirmar preços e disponibilidade.
- [ ] Confirmar entrega/retirada, frete e prazos.
- [ ] Revisar textos sobre garantia e arrependimento.
- [ ] Adicionar CNPJ/endereço somente se confirmados.
- [ ] Não usar dados do fornecedor como dados da loja.
- [ ] Revisar privacidade e termos conforme o funcionamento real.
- [ ] Verificar documentos pessoais, cupons, tokens e credenciais no repositório/histórico.
- [ ] Não publicar dados de clientes.

### F. Mobile e acessibilidade
- [ ] Testar 320 px.
- [ ] Testar 375 px.
- [ ] Testar 768 px.
- [ ] Testar 1024 px.
- [ ] Testar 1440 px.
- [ ] Não há rolagem horizontal indevida.
- [ ] Menu, sacola, filtros e checkout funcionam por toque.
- [ ] Controles podem ser usados por teclado.
- [ ] Foco visível está presente.
- [ ] Modais fecham de forma previsível.
- [ ] Imagens têm texto alternativo adequado.
- [ ] Contraste é suficiente.
- [ ] Zoom de 200% continua funcional.
- [ ] `prefers-reduced-motion` é respeitado.

### G. SEO e desempenho
- [ ] Title e meta description estão corretos.
- [ ] Imagem Open Graph tem URL absoluta válida.
- [ ] Favicon carrega no GitHub Pages.
- [ ] Caminhos relativos funcionam em `/Akylla_Store/`.
- [ ] Não há links ou imagens 404.
- [ ] Imagens têm dimensões definidas quando apropriado.
- [ ] Imagens abaixo da dobra usam lazy loading quando adequado.
- [ ] Banner principal não é atrasado desnecessariamente.
- [ ] Não foram adicionadas dependências sem necessidade.
- [ ] Analytics/pixels só foram considerados após avaliar privacidade.

### H. Teste e publicação
- [ ] Repetir testes funcionais após as mudanças.
- [ ] Revisar diff antes do commit.
- [ ] Confirmar que nenhuma função foi removida sem autorização.
- [ ] Atualizar README e documentação.
- [ ] Registrar testes e resultados.
- [ ] Registrar pendências que exigem decisão do responsável.
- [ ] Criar commit com mensagem descritiva.
- [ ] Pedir autorização antes do push.
- [ ] Após publicar, testar a URL pública em celular e desktop.

---

## 3. Ordem recomendada

| Prioridade | Trabalho | Motivo |
|---|---|---|
| **P0 — Crítica** | Catálogo, preços, PIX e WhatsApp | Evitar falhas de compra e divergência de pagamento |
| **P1 — Alta** | Logo/banner, mobile e hierarquia visual | Fortalecer a marca e a primeira impressão |
| **P1 — Alta** | Transparência de checkout e condições comerciais | Evitar expectativas incorretas |
| **P2 — Média** | Busca, estados vazios, acessibilidade e SEO | Facilitar encontrar e comprar produtos |
| **P3 — Futuro** | Backend, estoque e confirmação automática | Automatizar a operação com infraestrutura apropriada |

## 4. Limitações atuais e evolução futura

Pelo README, o site é estático e não tem backend. Alterar somente HTML/CSS/JS não cria controle confiável e centralizado de estoque, registro de pedidos no servidor ou confirmação automática de PIX.

Fase futura, caso desejada:
- [ ] API/backend para registrar pedidos.
- [ ] Banco de dados e controle de estoque.
- [ ] Provedor de pagamento com confirmação por webhook.
- [ ] Painel administrativo com autenticação e permissões.
- [ ] Logs e monitoramento sem dados pessoais desnecessários.
- [ ] Privacidade e segurança alinhadas às integrações adotadas.

## 5. Registro de execução

Execução única e contínua em 20/10/2026 (branch `main`, commit base `1b76b6d`), autorizada pelo responsável para todas as etapas, incluindo push.

| Etapa | Data | Commit | Testes | Resultado | Pendências |
|---|---|---|---|---|---|
| 0 — Diagnóstico | 20/10/2026 | `d256cb1` (segurança) | Git, assets, sintaxe, CRC | Estrutura confirmada; histórico sem dados pessoais; "Nada encontrado" é o estado vazio nativo | — |
| 1 — Identidade visual | 20/10/2026 | `feat: corrige preços do hero…` | Conferência de preços vs catálogo | Preços do hero corrigidos (W31 R$ 95,90 / drone R$ 299,00) | Logo oficial em arquivo |
| 2 — Navegação/mobile | 20/10/2026 | `feat: corrige preços do hero…` | jsdom + revisão de breakpoints | `defer`, footer institucional, reduced-motion no JS | Teste em dispositivo real |
| 3 — Catálogo | 20/10/2026 | `feat: corrige preços do hero…` | 22 produtos, busca sem acento/caixa alta, filtros, ordenação, "Ver mais", limpar filtros | 21/21 ✅ | — |
| 4 — Sacola/PIX | 20/10/2026 | `feat: corrige preços do hero…` | Sacola, persistência, storage corrompido, payload/CRC/campo 54, QR, WhatsApp | 18/18 ✅ (inclui fix do download do QR) | Leitura no app bancário |
| 5 — Confiança/privacidade | 20/10/2026 | `feat: adiciona privacidade, termos, robots e sitemap` | Revisão de textos vs funcionamento real | `privacidade.html` + `termos.html` criados; sem dados inventados | Confirmar WhatsApp/PIX/preços; CNPJ/endereço/redes sociais |
| 6 — SEO | 20/10/2026 | `feat: adiciona privacidade, termos, robots e sitemap` | XML do sitemap, canonical/OG, semântica | `robots.txt` + `sitemap.xml` (3 URLs) | — |
| 7 — Performance | 20/10/2026 | `feat: corrige preços do hero…` | Tamanhos de asset, scripts, lazy loading | Sem dependências novas; hero 99 KB; `defer` aplicado | — |
| 8 — Acessibilidade | 20/10/2026 | `feat: corrige preços do hero…` | aria-pressed, alt, role=group, foco, reduced-motion, contraste | Ajustes aplicados | Zoom 200% e teclado em navegador real |
| 9 — Regressão/entrega | 20/10/2026 | `docs: atualiza README e plano de melhorias` | Smoke test completo (jsdom) + Node | **47/47 ✅** | Testes manuais pós-deploy |

### Atualização — reprecificação pela planilha (20/10/2026, segunda execução)

Aplicados no `products.js` os 22 preços calculados pela `Planilha_Precificacao_Produtos.xlsx` com a própria fórmula da planilha (custo do cupom ÷ (1 − 30% de margem), ROUNDUP em R$ 0,10). Cards flutuantes do hero atualizados (W31 R$ 188,50 e drone R$ 161,30). Regressão completa reexecutada: **49/49 testes ✅**, incluindo asserção de que todos os preços batem com a fórmula da planilha.

Observações para o responsável:

- Alguns preços **caíram** em relação à versão anterior (cabos e carregadores), porque os preços antigos não seguiam a planilha; outros **subiram** (relógios e drones), pois estavam até abaixo do custo. Ver tabela no histórico do commit.
- A margem global é de 30%; se algum grupo de produtos exigir margem diferente, ajuste por produto após a planilha.
- **Códigos divergentes:** os códigos no `products.js` (sequenciais 7547–7568) não são os do cupom; a planilha traz os códigos reais (ex.: W31 = 9997, W69 = 10391). A troca **não foi feita** por depender de decisão do responsável — se confirmada, melhora a busca por código do cliente.

### Pendências que exigem decisão do responsável

1. Logo oficial em arquivo (SVG/PNG) para cabeçalho e favicon — hoje o ícone é genérico e o checklist proíbe inventar caminhos.
2. Confirmar a margem de 30% e os novos 22 preços aplicados (tabela no commit de reprecificação) e decidir sobre a troca dos códigos pelos códigos reais do cupom.
3. Confirmação formal de WhatsApp, chave PIX, nome do recebedor, cidade, preços e disponibilidade.
4. CNPJ/CPF, endereço e redes sociais da Akylla (o endereço do cupom é do fornecedor e **não** foi publicado).
5. Leitura do QR PIX no app do banco pelo responsável, sem concluir o pagamento.
6. Definição de prazos de entrega/frete, caso a operação queira sair do "combinado pelo WhatsApp".
7. Revisão jurídica eventual dos textos de garantia/entrega (as páginas legais refletem o funcionamento real e o CDC).
