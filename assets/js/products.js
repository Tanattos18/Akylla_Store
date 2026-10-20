/*
 * Catálogo Akylla Store
 * Dados extraídos do cupom fiscal (19/10/2026) e conferidos com a foto do estoque.
 * Preços em centavos para evitar erros de arredondamento.
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
    price: 5290,
    description: 'Smartwatch com pulseira confortável e recursos essenciais para acompanhar a rotina.'
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
    price: 11690,
    description: 'Modelo Ultra da linha Bazik Microwear, com design moderno para o dia a dia.'
  },
  {
    id: 'hw8-pro-max',
    name: 'Relógio Inteligente HW8 Pro Max Bazik Prime',
    shortName: 'HW8 Pro Max',
    brand: 'Bazik Prime',
    model: 'HW8 Pro Max',
    code: '7539',
    category: 'smartwatches',
    visual: 'watch',
    price: 5990,
    description: 'Smartwatch da linha Prime com pulseira e recursos práticos para a rotina.'
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
    price: 11099,
    description: 'Relógio inteligente com pulseiras extras para variar o estilo durante a semana.'
  },
  {
    id: 'w31-pro-max',
    name: 'Relógio Inteligente W31 Pro Max Basike',
    shortName: 'W31 Pro Max',
    brand: 'Basike',
    model: 'W31 Pro Max',
    code: '9997',
    category: 'smartwatches',
    visual: 'watch',
    price: 13190,
    description: 'Um dos modelos mais completos da linha, com tela e pulseira para uso diário.'
  },
  {
    id: 'w96-pro-max',
    name: 'Relógio Inteligente W96 Pro Max Basik',
    shortName: 'W96 Pro Max',
    brand: 'Basik',
    model: 'W96 Pro Max',
    code: '9512',
    category: 'smartwatches',
    visual: 'watch',
    price: 9190,
    description: 'Smartwatch com visual moderno e recursos para acompanhar seus hábitos.'
  },
  {
    id: 'cabo-tipo-c-60w',
    name: 'Cabo Tipo C 60W com Suporte',
    shortName: 'Cabo Tipo C 60W',
    brand: 'Basike',
    model: 'BA-CBO471',
    code: '10905',
    category: 'cabos',
    visual: 'cable',
    price: 720,
    description: 'Cabo de dados e carga Tipo C de 60W com suporte para manter tudo organizado.'
  },
  {
    id: 'cabo-lightning-12w',
    name: 'Cabo Lightning 12W com Suporte',
    shortName: 'Cabo Lightning 12W',
    brand: 'Basike',
    model: 'BA-CBO472',
    code: '10906',
    category: 'cabos',
    visual: 'cable',
    price: 720,
    description: 'Cabo de dados e carga Lightning de 12W com suporte para o uso diário.'
  },
  {
    id: 'power-bank-pocket',
    name: 'Power Bank Mini Pocket',
    shortName: 'Power Bank Mini Pocket',
    brand: 'Basike',
    model: 'BA-POW443',
    code: '10904',
    category: 'acessorios',
    visual: 'powerbank',
    price: 2430,
    description: 'Bateria portátil compacta para recarregar seus dispositivos onde você estiver.'
  },
  {
    id: 'microfone-lapela',
    name: 'Microfone de Lapela para iPhone',
    shortName: 'Microfone de Lapela',
    brand: 'Basike',
    model: 'BA-MIC0005',
    code: '9310',
    category: 'audio',
    visual: 'mic',
    price: 9180,
    description: 'Microfone de lapela para iPhone, ideal para gravações, aulas e chamadas.'
  },
  {
    id: 'fone-bluetooth-fon6694',
    name: 'Fone de Ouvido Bluetooth Basike BA-FON6694',
    shortName: 'Fone Bluetooth Basike',
    brand: 'Basike',
    model: 'BA-FON6694',
    code: '6626',
    category: 'audio',
    visual: 'headphones',
    price: 4490,
    description: 'Fone Bluetooth com uso confortável para música, estudos e chamadas.'
  },
  {
    id: 'fone-bluetooth-fon9856',
    name: 'Fone de Ouvido Bluetooth Basike FON-9856',
    shortName: 'Fone Bluetooth FON-9856',
    brand: 'Basike',
    model: 'FON-9856',
    code: '6625',
    category: 'audio',
    visual: 'earbuds',
    price: 4290,
    description: 'Fone TWS sem fio com estojo de recarga e uso confortável no dia a dia.'
  },
  {
    id: 'carregador-iphone-car3248a',
    name: 'Carregador Inova iPhone CAR-3248A',
    shortName: 'Carregador iPhone Inova',
    brand: 'Inova',
    model: 'CAR-3248A',
    code: '10558',
    category: 'carregadores',
    visual: 'charger',
    price: 1170,
    description: 'Carregador Inova para iPhone, compacto e prático para levar na mochila.'
  },
  {
    id: 'carregador-wall-35w',
    name: 'Carregador de Parede Inova 35W',
    shortName: 'Carregador Wall 35W',
    brand: 'Inova',
    model: 'BA-CAR272C',
    code: '10870',
    category: 'carregadores',
    visual: 'charger',
    price: 1560,
    description: 'Carregador de parede Inova de 35W para recarregar seus dispositivos.'
  },
  {
    id: 'carregador-inova-51a-iphone',
    name: 'Carregador Inova 5.1A iPhone',
    shortName: 'Carregador 5.1A iPhone',
    brand: 'Inova',
    model: 'CAR-12728A',
    code: '10416',
    category: 'carregadores',
    visual: 'charger',
    price: 1170,
    description: 'Carregador Inova 5.1A com conexão para iPhone.'
  },
  {
    id: 'carregador-inova-51a-tipo-c',
    name: 'Carregador Inova 5.1A Tipo C',
    shortName: 'Carregador 5.1A Tipo C',
    brand: 'Inova',
    model: 'CAR-12728C',
    code: '9146',
    category: 'carregadores',
    visual: 'charger',
    price: 1180,
    description: 'Carregador Inova 5.1A com conexão Tipo C para o dia a dia.'
  },
  {
    id: 'cabo-basike-tipo-c',
    name: 'Cabo Basike Tipo C-Tipo C 1m',
    shortName: 'Cabo Tipo C-Tipo C',
    brand: 'Basike',
    model: 'BA-CBO414',
    code: '10539',
    category: 'cabos',
    visual: 'cable',
    price: 560,
    description: 'Cabo Basike Tipo C-Tipo C de 1 metro para dados e recarga.'
  },
  {
    id: 'fonte-turbo-61a',
    name: 'Fonte Turbo 6.1A Eletro',
    shortName: 'Fonte Turbo 6.1A',
    brand: 'Eletro',
    model: 'EL-4051',
    code: '10915',
    category: 'carregadores',
    visual: 'charger',
    price: 699,
    description: 'Fonte turbo de 6.1A para carregamento rápido dos seus dispositivos.'
  },
  {
    id: 'cabo-lightning-1m',
    name: 'Cabo Lightning 1m 30207B',
    shortName: 'Cabo Lightning 1m',
    brand: 'FFLI',
    model: '30207B',
    code: '8331',
    category: 'cabos',
    visual: 'cable',
    price: 460,
    description: 'Cabo Tipo C para iPhone Lightning de 1 metro, prático para o dia a dia.'
  },
  {
    id: 'fone-kapbom-ka9068',
    name: 'Headset Bluetooth Kapbom KA-9068',
    shortName: 'Headset Kapbom KA-9068',
    brand: 'Kapbom',
    model: 'KA-9068',
    code: '10784',
    category: 'audio',
    visual: 'headphones',
    price: 3390,
    description: 'Headset Bluetooth com graves reforçados e design confortável para longas sessões.'
  },
  {
    id: 'drone-wrj12618',
    name: 'Drone Articulado 2.4GHz Inova',
    shortName: 'Drone Articulado Inova',
    brand: 'Inova',
    model: 'WRJ-12618',
    code: '9347',
    category: 'drones',
    visual: 'drone',
    price: 11290,
    description: 'Drone articulado com pás dobráveis e operação em 2.4 GHz.'
  },
  {
    id: 'drone-wrj12619',
    name: 'Drone Dobrável com Câmera Inova',
    shortName: 'Drone com Câmera Inova',
    brand: 'Inova',
    model: 'WRJ-12619',
    code: '9243',
    category: 'drones',
    visual: 'drone',
    price: 9290,
    description: 'Drone dobrável com câmera e estrutura collapsible para levar a qualquer lugar.'
  }
];
