export interface CatalogProduct {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly color: string;
  readonly price: number;
  readonly avgBuyerAge: number;
  readonly yoloLabel: string;
  readonly description: string;
}

export interface SampleUserProfile {
  readonly id: string;
  readonly name: string;
  readonly age: number;
  readonly purchasedProductIds: readonly string[];
}

export const CATALOG_CATEGORIES = ['Cameras', 'Laptops', 'Drones', 'Audio'] as const;
export const CATALOG_COLORS = ['Black', 'Silver', 'Blue', 'Graphite'] as const;

export const INITIAL_CATALOG_PRODUCTS: readonly CatalogProduct[] = [
  {
    id: 'prod-cam-4k',
    name: 'Camera Pro 4K Hybrid AF',
    category: 'Cameras',
    color: 'Black',
    price: 3200,
    avgBuyerAge: 31,
    yoloLabel: 'camera',
    description: 'Câmera mirrorless 4K 120fps com autofoco ocular em tempo real e estabilização de 5 eixos.'
  },
  {
    id: 'prod-laptop-ai',
    name: 'Workstation NeuralBook 16',
    category: 'Laptops',
    color: 'Silver',
    price: 4500,
    avgBuyerAge: 29,
    yoloLabel: 'laptop',
    description: 'Notebook com NPU dedicada para execução local de LLMs e WebGPU TensorFlow.js.'
  },
  {
    id: 'prod-drone-8k',
    name: 'Drone Vision 8K Autonomous',
    category: 'Drones',
    color: 'Graphite',
    price: 2800,
    avgBuyerAge: 34,
    yoloLabel: 'drone',
    description: 'Drone autônomo com sensores omnidirecionais e rastreamento visual YOLOv8 embarcado.'
  },
  {
    id: 'prod-audio-anc',
    name: 'Studio Headphones Spatial ANC',
    category: 'Audio',
    color: 'Blue',
    price: 950,
    avgBuyerAge: 24,
    yoloLabel: 'headphones',
    description: 'Headphones com cancelamento ativo de ruído neural e transcrição de voz integrada.'
  },
  {
    id: 'prod-cam-cinema',
    name: 'Cinema Line 6K Full-Frame',
    category: 'Cameras',
    color: 'Black',
    price: 4900,
    avgBuyerAge: 36,
    yoloLabel: 'camera',
    description: 'Câmera de cinema digital 6K com 15 stops de faixa dinâmica e saída RAW.'
  }
];

export const INITIAL_SAMPLE_USERS: readonly SampleUserProfile[] = [
  {
    id: 'user-history-1',
    name: 'Ana (Criadora Audiovisual — Com Histórico)',
    age: 32,
    purchasedProductIds: ['prod-cam-4k', 'prod-drone-8k']
  },
  {
    id: 'user-coldstart-1',
    name: 'Carlos (Novo Utilizador — Cold Start Sem Histórico)',
    age: 25,
    purchasedProductIds: []
  }
];

export const INITIAL_KNOWLEDGE_DOCUMENTS = [
  {
    documentId: 'doc-manual-cam-4k',
    title: 'Manual Técnico Camera Pro 4K Hybrid AF',
    content: [
      '## [02:15] Autofoco Híbrido e Detecção Ocular',
      'A Camera Pro 4K Hybrid AF opera com 759 pontos de detecção de fase e rastreamento ocular a 60fps.',
      '## [05:40] Estabilização Óptica IBIS',
      'O sensor estabilizado em 5 eixos garante compensação de 5.5 stops em vídeos noturnos e telefoto.'
    ].join('\n')
  },
  {
    documentId: 'doc-manual-neuralbook',
    title: 'Guia de Arquitetura Workstation NeuralBook 16',
    content: [
      '## [01:30] Processamento WebGPU e NPU',
      'O NeuralBook 16 acelera matrizes em WebGL/WebGPU e suporta inferência local de modelos ONNX e TensorFlow.js.',
      '## [08:10] Autonomia e Refrigeração',
      'A bateria de 99Wh entrega até 18 horas de uso contínuo com câmara de vapor silenciosa.'
    ].join('\n')
  }
];

