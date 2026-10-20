/*
 * Catálogo Akylla Store
 * Dados extraídos do cupom fiscal (19/10/2026) e conferidos com a foto do estoque.
 * Preços em centavos para evitar erros de arredondamento.
 *
 * PREÇOS: calculados pela Planilha_Precificacao_Produtos.xlsx (arquivo local, não publicado):
 *   preço = custo unitário do cupom / (1 - margem)   [margem padrão: 30%]
 *   arredondado para cima no múltiplo de R$ 0,10
 * Para reprecificar, ajuste a margem na planilha (célula B4) e aplique os resultados aqui.
 *
 * Fotos: imagens de referência dos fabricantes/distribuidores (Inova, Basike e parceiros).
 * Produtos marcados com `illustrative: true` usam uma foto representativa da mesma linha.
 * Recomenda-se substituir pelas fotos reais do estoque quando disponíveis.
 *
 * Para editar um produto, altere o objeto correspondente. Para adicionar,
 * copie um bloco e informe um id único.
 */
window.AKYLLA_CATEGORIES = [
  { id: 'todos', label: 'Todos' },
  { id: 'smartwatches', label: 'Smartwatches' },
  { id: 'audio', label: 'Áudio' },
  { id: 'drones', label: 'Drones' },
  { id: 'carregadores', label: 'Carregadores' },
  { id: 'cabos', label: 'Cabos' },
  { id: 'acessorios', label: 'Acessórios' }
];

window.AKYLLA_PRODUCTS = [
  {
    id: 'w34-plus',
    name: 'Relógio Inteligente W34+ Bazik Prime',
    shortName: 'W34+ Bazik Prime',
    brand: 'Bazik',
    model: 'W34+',
    code: '7547',
    category: 'smartwatches',
    visual: 'watch',
    price: 7560,
    summary: 'Tela de 1,75", chamadas Bluetooth e monitoramento cardíaco para acompanhar a rotina.',
    description: 'Smartwatch com tela HD de 1,75", chamadas via Bluetooth, monitoramento cardíaco e do sono, além de alertas de mensagens. Acompanha pulseira de silicone e é compatível com Android e iOS.',
    image: 'assets/img/products/w34-plus.webp',
    imageAlt: 'Relógio inteligente W34+ Bazik Prime com pulseira preta',
    illustrative: true,
    specs: [
      { label: 'Tela', value: '1,75" HD IPS (320 x 385 px)' },
      { label: 'Conexão', value: 'Bluetooth 5.0' },
      { label: 'Saúde', value: 'Batimentos cardíacos e sono' },
      { label: 'Compatibilidade', value: 'Android e iOS' },
      { label: 'Pulseira', value: 'Silicone' },
      { label: 'Carga', value: 'Cabo de carregamento incluso' }
    ]
  },
  {
    id: 'w69-ultra',
    name: 'Relógio W69 Ultra Bazik Microwear',
    shortName: 'W69 Ultra',
    brand: 'Bazik / Microwear',
    model: 'W69 Ultra',
    code: '10391',
    category: 'smartwatches',
    visual: 'watch',
    price: 16700,
    summary: 'Tela de 2,2", NFC, GPS via app e mais de 100 modos esportivos.',
    description: 'Smartwatch com tela ampla de 2,2", NFC para acesso rápido, GPS via aplicativo e mais de 100 modos esportivos. Monitora batimentos, sono e oferece controle remoto da câmera do celular.',
    image: 'assets/img/products/w69-ultra.webp',
    imageAlt: 'Relógio inteligente W69 Ultra com pulseira laranja',
    illustrative: true,
    specs: [
      { label: 'Tela', value: '2,2" (425 x 518 px)' },
      { label: 'Conexão', value: 'Bluetooth e NFC' },
      { label: 'GPS', value: 'Via aplicativo' },
      { label: 'Resistência', value: 'IP68' },
      { label: 'Esportes', value: 'Mais de 100 modos' },
      { label: 'Saúde', value: 'Batimentos, sono e ciclo menstrual' }
    ]
  },
  {
    id: 'hw8-pro-max',
    name: 'Relógio HW8 Pro Max Smartwatch',
    shortName: 'HW8 Pro Max',
    brand: 'Bazik',
    model: 'HW8 Pro Max',
    code: '7539',
    category: 'smartwatches',
    visual: 'watch',
    price: 8560,
    summary: 'Tela HD, NFC, IP68 e monitoramento completo de saúde e sono.',
    description: 'Smartwatch com tela HD de 1,75", Bluetooth 5.0, NFC e certificação IP68. Monitora frequência cardíaca, pressão arterial, oxigênio e sono, com comandos de voz e compatibilidade com Android e iOS.',
    image: 'assets/img/products/hw8-pro-max.webp',
    imageAlt: 'Relógios inteligentes HW8 Pro Max nas cores branco e preto',
    specs: [
      { label: 'Tela', value: '1,75" HD IPS (320 x 385 px)' },
      { label: 'Conexão', value: 'Bluetooth 5.0 e NFC' },
      { label: 'Resistência', value: 'IP68 (respingos, suor e poeira)' },
      { label: 'Saúde', value: 'Batimentos, pressão, oxigênio e ECG' },
      { label: 'Comandos', value: 'Alexa, Siri e Google' },
      { label: 'Caixa', value: 'Alumínio, 44 mm' }
    ]
  },
  {
    id: 'w65-pro-max',
    name: 'Relógio W65 Pro Max com Pulseiras',
    shortName: 'W65 Pro Max',
    brand: 'Bazik',
    model: 'W65 Pro Max',
    code: '9134',
    category: 'smartwatches',
    visual: 'watch',
    price: 15860,
    summary: 'Tela de 1,83", Bluetooth 5.3, até 7 dias de bateria e pulseiras extras.',
    description: 'Smartwatch com tela HD de 1,83", Bluetooth 5.3 e bateria para até 7 dias. Acompanha pulseiras intercambiáveis, carregamento magnético e recursos de saúde, chamadas e notificações.',
    image: 'assets/img/products/w65-pro-max.webp',
    imageAlt: 'Relógios W65 Pro Max com pulseiras intercambiáveis',
    specs: [
      { label: 'Tela', value: '1,83" HD touch (240 x 284 px)' },
      { label: 'Conexão', value: 'Bluetooth 5.3' },
      { label: 'Bateria', value: '200 mAh • até 7 dias' },
      { label: 'Resistência', value: 'IP67' },
      { label: 'Compatibilidade', value: 'Android 5.0+ e iOS 9.0+' },
      { label: 'Extras', value: 'Pulseiras intercambiáveis e carga magnética' }
    ]
  },
  {
    id: 'w31-pro-max',
    name: 'Relógio W31 Pro Max Bazik',
    shortName: 'W31 Pro Max',
    brand: 'Bazik',
    model: 'W31 Pro Max',
    code: '9997',
    category: 'smartwatches',
    visual: 'watch',
    price: 18850,
    summary: 'Monitoramento de saúde, modos esportivos e carregamento por indução.',
    description: 'Smartwatch com monitoramento cardíaco, pressão arterial e sono, modos esportivos e notificações. Acompanha pulseira e cabo de carregamento por indução; app RDFit para Android e iOS.',
    image: 'assets/img/products/w31-pro-max.webp',
    imageAlt: 'Embalagem do relógio inteligente W31 Pro Max Bazik',
    specs: [
      { label: 'Tela', value: 'Colorida de alta definição' },
      { label: 'Conexão', value: 'Bluetooth' },
      { label: 'Saúde', value: 'Batimentos, pressão e sono' },
      { label: 'Recursos', value: 'Modos esportivos, música e notificações' },
      { label: 'Aplicativo', value: 'RDFit' },
      { label: 'Carga', value: 'Carregamento por indução' }
    ]
  },
  {
    id: 'w96-pro-max',
    name: 'Relógio W96 Pro Max Smartwatch',
    shortName: 'W96 Pro Max',
    brand: 'Bazik',
    model: 'W96 Pro Max',
    code: '9512',
    category: 'smartwatches',
    visual: 'watch',
    price: 13130,
    summary: 'Tela de 2,01", IP68, chamadas e notificações com bateria de 200 mAh.',
    description: 'Smartwatch com tela de 2,01", resistência à água IP68 e bateria de 200 mAh. Recebe notificações e chamadas, monitora frequência cardíaca e sono e acompanha múltiplos esportes.',
    image: 'assets/img/products/w96-pro-max.webp',
    imageAlt: 'Relógio inteligente W96 Pro Max com pulseira laranja',
    specs: [
      { label: 'Tela', value: '2,01"' },
      { label: 'Resistência', value: 'IP68' },
      { label: 'Bateria', value: '200 mAh' },
      { label: 'Conexão', value: 'Bluetooth' },
      { label: 'Recursos', value: 'Chamadas, notificações e multi-esportes' },
      { label: 'Saúde', value: 'Batimentos e sono' }
    ]
  },
  {
    id: 'cabo-tipo-c-60w',
    name: 'Cabo USB-A para USB-C 1,5 m 60W',
    shortName: 'Cabo USB-C 60W',
    brand: 'Basike',
    model: 'BA-CBO471',
    code: '10905',
    category: 'cabos',
    visual: 'cable',
    price: 1030,
    summary: 'USB-A para USB-C, 1,5 m, 60W e suporte dobrável.',
    description: 'Cabo USB-A para USB-C de 1,5 m com suporte dobrável e carga rápida de até 60W. Revestimento em nylon trançado para maior durabilidade.',
    image: 'assets/img/products/cabo-tipo-c-60w.webp',
    imageAlt: 'Cabo USB-A para USB-C 60W com suporte dobrável',
    specs: [
      { label: 'Conexão', value: 'USB-A para USB-C' },
      { label: 'Comprimento', value: '1,5 m' },
      { label: 'Potência', value: '60W' },
      { label: 'Material', value: 'Nylon trançado' },
      { label: 'Extra', value: 'Suporte dobrável integrado' }
    ]
  },
  {
    id: 'cabo-lightning-12w',
    name: 'Cabo USB-A para Lightning 1,5 m 12W',
    shortName: 'Cabo Lightning 12W',
    brand: 'Basike',
    model: 'BA-CBO472',
    code: '10906',
    category: 'cabos',
    visual: 'cable',
    price: 1030,
    summary: 'USB-A para Lightning, 1,5 m, 12W e suporte dobrável.',
    description: 'Cabo USB-A para Lightning de 1,5 m com suporte dobrável e carga de até 12W. Ideal para iPhone e iPad, com revestimento em nylon trançado.',
    image: 'assets/img/products/cabo-lightning-12w.webp',
    imageAlt: 'Cabo USB-A para Lightning 12W com suporte dobrável',
    specs: [
      { label: 'Conexão', value: 'USB-A para Lightning' },
      { label: 'Comprimento', value: '1,5 m' },
      { label: 'Potência', value: '12W' },
      { label: 'Material', value: 'Nylon trançado' },
      { label: 'Extra', value: 'Suporte dobrável integrado' }
    ]
  },
  {
    id: 'power-bank-pocket',
    name: 'Power Bank Mini Pocket 4.000 mAh USB-C',
    shortName: 'Power Bank 4.000 mAh',
    brand: 'Basike',
    model: 'BA-POW443',
    code: '10904',
    category: 'acessorios',
    visual: 'powerbank',
    price: 3480,
    summary: '4.000 mAh, saída de 12W e conector USB-C integrado.',
    description: 'Power bank compacto de 4.000 mAh com conector USB-C integrado e saída de 12W. Cabe no bolso e garante carga extra para o dia a dia.',
    image: 'assets/img/products/power-bank-pocket.webp',
    imageAlt: 'Power bank compacto branco com conector USB-C',
    specs: [
      { label: 'Capacidade', value: '4.000 mAh' },
      { label: 'Saída', value: '12W' },
      { label: 'Conector', value: 'USB-C integrado' },
      { label: 'Dimensões', value: '81 x 39 x 26 mm' },
      { label: 'Extra', value: 'Chip inteligente de proteção' }
    ]
  },
  {
    id: 'microfone-lapela',
    name: 'Microfone de Lapela Sem Fio com Case',
    shortName: 'Microfone de Lapela',
    brand: 'Basike',
    model: 'BA-MIC0005',
    code: '9310',
    category: 'audio',
    visual: 'mic',
    price: 13120,
    summary: 'Receptores Lightning e USB-C, alcance de 20 m e case com display LED.',
    description: 'Microfone de lapela sem fio com receptores Lightning e USB-C, alcance de até 20 m e case de carregamento com display LED. Ideal para vídeos, lives e gravações, sem necessidade de aplicativo.',
    image: 'assets/img/products/microfone-lapela.webp',
    imageAlt: 'Microfone de lapela sem fio com case carregador e receptores',
    specs: [
      { label: 'Alcance', value: 'Até 20 m' },
      { label: 'Receptores', value: 'Lightning e USB-C' },
      { label: 'Case', value: 'Carregamento com display LED' },
      { label: 'Áudio', value: 'Redução de ruído' },
      { label: 'Uso', value: 'Sem aplicativo' },
      { label: 'Bateria', value: 'Recarregável' }
    ]
  },
  {
    id: 'fone-bluetooth-fon6694',
    name: 'Fone Bluetooth TWS FON-6694',
    shortName: 'Fone TWS FON-6694',
    brand: 'Basike',
    model: 'FON-6694',
    code: '6626',
    category: 'audio',
    visual: 'earbuds',
    price: 6420,
    summary: 'Bluetooth 5.3, até 4 horas de música e estojo de 300 mAh.',
    description: 'Fone TWS com Bluetooth 5.3, microfone integrado e até 4 horas de reprodução. Acompanha estojo de carregamento de 300 mAh para recarregar em qualquer lugar.',
    image: 'assets/img/products/fone-bluetooth-fon6694.webp',
    imageAlt: 'Fone Bluetooth TWS FON-6694 branco com estojo de carregamento',
    specs: [
      { label: 'Conexão', value: 'Bluetooth 5.3' },
      { label: 'Alcance', value: 'Até 10 m' },
      { label: 'Reprodução', value: '3 a 4 horas' },
      { label: 'Estojo', value: '300 mAh' },
      { label: 'Carga', value: '1 a 2 horas' },
      { label: 'Microfone', value: 'Integrado' }
    ]
  },
  {
    id: 'fone-bluetooth-fon9856',
    name: 'Fone Bluetooth TWS FON-9856',
    shortName: 'Fone TWS FON-9856',
    brand: 'Basike',
    model: 'FON-9856',
    code: '6625',
    category: 'audio',
    visual: 'earbuds',
    price: 6130,
    summary: 'Bluetooth 5.3, até 5 horas de música e estojo de recarga.',
    description: 'Fone TWS com Bluetooth 5.3, até 5 horas de reprodução e microfone para chamadas. Acompanha estojo de carregamento compacto.',
    image: 'assets/img/products/fone-bluetooth-fon9856.webp',
    imageAlt: 'Fone Bluetooth TWS FON-9856 branco com estojo de recarga',
    specs: [
      { label: 'Conexão', value: 'Bluetooth 5.3' },
      { label: 'Reprodução', value: '4 a 5 horas' },
      { label: 'Microfone', value: 'Integrado, para chamadas' },
      { label: 'Estojo', value: 'Recarregável' },
      { label: 'Uso', value: 'TWS (true wireless)' }
    ]
  },
  {
    id: 'carregador-iphone-car3248a',
    name: 'Carregador iPhone 5.1A com Cabo Lightning',
    shortName: 'Carregador iPhone 5.1A',
    brand: 'Inova',
    model: 'CAR-3248A',
    code: '10558',
    category: 'carregadores',
    visual: 'charger',
    price: 1680,
    summary: '3 portas USB, 5.1A e cabo Lightning de 1 m incluso.',
    description: 'Kit carregador Inova 5.1A com 3 portas USB e cabo Lightning de 1 m. Carrega vários dispositivos ao mesmo tempo com segurança.',
    image: 'assets/img/products/carregador-iphone-car3248a.webp',
    imageAlt: 'Carregador Inova 5.1A com 3 portas USB e cabo Lightning',
    illustrative: true,
    specs: [
      { label: 'Saída', value: '5.1A' },
      { label: 'Portas', value: '3 portas USB' },
      { label: 'Cabo', value: 'Lightning, 1 m' },
      { label: 'Voltagem', value: 'Bivolt 100-240V' }
    ]
  },
  {
    id: 'carregador-wall-35w',
    name: 'Carregador de Parede 35W GaN com Cabo USB-C',
    shortName: 'Carregador 35W GaN',
    brand: 'Basike',
    model: 'BA-CAR272C',
    code: '10870',
    category: 'carregadores',
    visual: 'charger',
    price: 2230,
    summary: 'GaN de até 35W, saídas USB-C e USB-A e cabo incluso.',
    description: 'Carregador de parede GaN com potência de até 35W, duas saídas (USB-C e USB-A) e cabo USB-C incluso. Compacto e compatível com celulares, tablets e notebooks.',
    image: 'assets/img/products/carregador-wall-35w.webp',
    imageAlt: 'Carregador de parede branco GaN com saídas USB-C e USB-A',
    illustrative: true,
    specs: [
      { label: 'Potência', value: 'Até 35W' },
      { label: 'Saídas', value: 'USB-C e USB-A' },
      { label: 'Tecnologia', value: 'GaN' },
      { label: 'Cabo', value: 'USB-C incluso' },
      { label: 'Voltagem', value: 'Bivolt 100-240V' }
    ]
  },
  {
    id: 'carregador-inova-51a-iphone',
    name: 'Carregador Inova 5.1A 3 USB com Cabo Lightning',
    shortName: 'Carregador Inova Lightning',
    brand: 'Inova',
    model: 'CAR-12728A',
    code: '10416',
    category: 'carregadores',
    visual: 'charger',
    price: 1680,
    summary: '3 portas USB, 5.1A e cabo Lightning de 1 m incluso.',
    description: 'Carregador de tomada 5.1A com 3 portas USB e cabo Lightning de 1 m. Carrega vários dispositivos ao mesmo tempo.',
    image: 'assets/img/products/carregador-inova-51a-iphone.webp',
    imageAlt: 'Carregador Inova 5.1A preto com 3 portas USB',
    illustrative: true,
    specs: [
      { label: 'Saída', value: '5.1A' },
      { label: 'Portas', value: '3 portas USB' },
      { label: 'Cabo', value: 'Lightning, 1 m' },
      { label: 'Voltagem', value: 'Bivolt' }
    ]
  },
  {
    id: 'carregador-inova-51a-tipo-c',
    name: 'Carregador Inova 5.1A 3 USB com Cabo USB-C',
    shortName: 'Carregador Inova USB-C',
    brand: 'Inova',
    model: 'CAR-12728C',
    code: '9146',
    category: 'carregadores',
    visual: 'charger',
    price: 1690,
    summary: '3 portas USB, 5.1A e cabo USB-C de 1 m incluso.',
    description: 'Carregador de tomada 5.1A com 3 portas USB e cabo USB-C de 1 m. Carrega vários dispositivos ao mesmo tempo.',
    image: 'assets/img/products/carregador-inova-51a-tipo-c.webp',
    imageAlt: 'Carregador Inova 5.1A preto com 3 portas USB',
    illustrative: true,
    specs: [
      { label: 'Saída', value: '5.1A' },
      { label: 'Portas', value: '3 portas USB' },
      { label: 'Cabo', value: 'USB-C, 1 m' },
      { label: 'Voltagem', value: 'Bivolt' }
    ]
  },
  {
    id: 'cabo-basike-tipo-c',
    name: 'Cabo USB-C para USB-C 1 m 60W',
    shortName: 'Cabo USB-C/USB-C 1 m',
    brand: 'Basike',
    model: 'BA-CBO414',
    code: '10539',
    category: 'cabos',
    visual: 'cable',
    price: 800,
    summary: 'USB-C para USB-C, 1 m, 60W e nylon trançado.',
    description: 'Cabo USB-C para USB-C de 1 m com carga de até 60W e revestimento em nylon trançado. Compatível com celulares, tablets e notebooks.',
    image: 'assets/img/products/cabo-basike-tipo-c.webp',
    imageAlt: 'Cabo USB-C para USB-C 60W com revestimento trançado',
    specs: [
      { label: 'Conexão', value: 'USB-C para USB-C' },
      { label: 'Comprimento', value: '1 m' },
      { label: 'Potência', value: '60W' },
      { label: 'Material', value: 'Nylon trançado' },
      { label: 'Uso', value: 'Carga e transferência de dados' }
    ]
  },
  {
    id: 'fonte-turbo-61a',
    name: 'Fonte Turbo 6.1A 30W',
    shortName: 'Fonte Turbo 6.1A',
    brand: 'Eletro',
    model: 'EL-4051',
    code: '10915',
    category: 'carregadores',
    visual: 'charger',
    price: 1000,
    summary: 'Saída de 6.1A e 30W para carregamento turbo.',
    description: 'Fonte de carregamento turbo com saída de 6.1A e 30W, para recarregar seu celular com mais velocidade. Compacta e fácil de levar.',
    image: 'assets/img/products/fonte-turbo-61a.webp',
    imageAlt: 'Fonte carregadora turbo branca com porta USB',
    illustrative: true,
    specs: [
      { label: 'Saída', value: '6.1A' },
      { label: 'Potência', value: '30W' },
      { label: 'Porta', value: 'USB-A' },
      { label: 'Voltagem', value: 'Bivolt' }
    ]
  },
  {
    id: 'cabo-lightning-1m',
    name: 'Cabo Lightning 1 m',
    shortName: 'Cabo Lightning 1 m',
    brand: 'FFLI',
    model: '30207B',
    code: '8331',
    category: 'cabos',
    visual: 'cable',
    price: 660,
    summary: 'USB-A para Lightning, 1 m, para carga e sincronização.',
    description: 'Cabo USB-A para Lightning de 1 m, ideal para carregar e sincronizar iPhones e iPads. Compacto e resistente para o dia a dia.',
    image: 'assets/img/products/cabo-lightning-1m.webp',
    imageAlt: 'Cabo USB-A para Lightning de 1 metro',
    illustrative: true,
    specs: [
      { label: 'Conexão', value: 'USB-A para Lightning' },
      { label: 'Comprimento', value: '1 m' },
      { label: 'Uso', value: 'Carga e sincronização' },
      { label: 'Compatibilidade', value: 'iPhone e iPad' }
    ]
  },
  {
    id: 'fone-kapbom-ka9068',
    name: 'Headset Bluetooth KA-9068 Kapbom',
    shortName: 'Headset KA-9068',
    brand: 'Kapbom',
    model: 'KA-9068',
    code: '10784',
    category: 'audio',
    visual: 'headphones',
    price: 4850,
    summary: 'Bluetooth 5.0, até 8 horas e microfone com cancelamento de ruído.',
    description: 'Headset Bluetooth 5.0 com som estéreo, microfone com cancelamento de ruído e até 8 horas de uso. Ideal para treinos, chamadas e uso diário.',
    image: 'assets/img/products/fone-kapbom-ka9068.webp',
    imageAlt: 'Headset Bluetooth Kapbom KA-9068',
    specs: [
      { label: 'Conexão', value: 'Bluetooth 5.0' },
      { label: 'Alcance', value: 'Até 10 m' },
      { label: 'Bateria', value: 'Até 8 horas' },
      { label: 'Microfone', value: 'Com cancelamento de ruído' },
      { label: 'Áudio', value: 'Estéreo' }
    ]
  },
  {
    id: 'drone-wrj12618',
    name: 'Drone Articulado 2.4GHz com Câmera HD',
    shortName: 'Drone WRJ-12618',
    brand: 'WRJ',
    model: 'WRJ-12618',
    code: '9347',
    category: 'drones',
    visual: 'drone',
    price: 16130,
    summary: 'Câmera HD, sensor de obstáculos e estrutura articulada.',
    description: 'Drone articulado com câmera HD, sensor de obstáculos e controle remoto em 2.4 GHz. Dobrável e fácil de transportar, ideal para primeiros voos e registros aéreos.',
    image: 'assets/img/products/drone-wrj12618.webp',
    imageAlt: 'Drone articulado WRJ-12618 com câmera HD e controle remoto',
    specs: [
      { label: 'Câmera', value: 'HD' },
      { label: 'Sensores', value: 'Obstáculos' },
      { label: 'Frequência', value: '2.4 GHz' },
      { label: 'Estrutura', value: 'Articulada e dobrável' },
      { label: 'Bateria', value: 'Recarregável via USB' },
      { label: 'Idade', value: 'A partir de 14 anos' }
    ]
  },
  {
    id: 'drone-wrj12619',
    name: 'Drone Dobrável 2.4GHz com Câmera',
    shortName: 'Drone WRJ-12619',
    brand: 'WRJ',
    model: 'WRJ-12619',
    code: '9243',
    category: 'drones',
    visual: 'drone',
    price: 13280,
    summary: 'Câmera integrada, sensor de obstáculos e estrutura dobrável.',
    description: 'Drone dobrável com câmera, sensor de obstáculos e estabilização em 2.4 GHz. Compacto, fácil de pilotar e indicado para uso recreativo a partir de 14 anos.',
    image: 'assets/img/products/drone-wrj12619.webp',
    imageAlt: 'Drone dobrável WRJ-12619 com câmera e controle remoto',
    specs: [
      { label: 'Câmera', value: 'Integrada' },
      { label: 'Sensores', value: 'Obstáculos' },
      { label: 'Frequência', value: '2.4 GHz' },
      { label: 'Estrutura', value: 'Dobrável' },
      { label: 'Bateria', value: 'Recarregável via USB' },
      { label: 'Idade', value: 'A partir de 14 anos' }
    ]
  }
];
