import * as tf from '@tensorflow/tfjs';
import {
  buildProductFeatureVector,
  computeUserProfileVector,
  type UserProfileInput
} from '@platform/shared';

export interface RecommendationProductItem {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly color: string;
  readonly price: number;
  readonly avgBuyerAge: number;
}

export interface RecommendationUserItem {
  readonly id: string;
  readonly name: string;
  readonly age: number;
  readonly purchasedProductIds: readonly string[];
}

export interface EpochTelemetry {
  readonly epoch: number;
  readonly loss: number;
  readonly accuracy: number;
}

export interface RankedProductRecommendation {
  readonly product: RecommendationProductItem;
  readonly score: number;
  readonly featureVector: readonly number[];
}

export interface TrainAndRankInput {
  readonly categories: readonly string[];
  readonly colors: readonly string[];
  readonly products: readonly RecommendationProductItem[];
  readonly user: RecommendationUserItem;
  readonly epochs?: number;
  readonly onEpochEnd?: (telemetry: EpochTelemetry) => void;
}

export interface TrainAndRankResult {
  readonly userProfileVector: readonly number[];
  readonly isColdStart: boolean;
  readonly epochHistory: readonly EpochTelemetry[];
  readonly rankedProducts: readonly RankedProductRecommendation[];
}

/**
 * RN03: Computes the user profile vector using tf.stack + tf.mean over purchased product tensors,
 * or falls back to the normalized user age vector for cold-start users without purchase history.
 */
export function computeUserProfileTensorStack(input: UserProfileInput): number[] {
  if (input.purchasedProductVectors.length === 0) {
    return computeUserProfileVector(input);
  }

  return tf.tidy(() => {
    const productTensors = input.purchasedProductVectors.map((vec) => tf.tensor1d([...vec]));
    const stacked = tf.stack(productTensors);
    const meanTensor = tf.mean(stacked, 0);
    return Array.from(meanTensor.dataSync());
  });
}

/**
 * RN04: Builds the sequential neural network with dense layers 128 (relu) -> 64 (relu) -> 32 (relu) -> 1 (sigmoid),
 * compiled with Adam (0.01) and binaryCrossentropy.
 */
export function createSequentialRecommendationModel(inputDimension: number): tf.Sequential {
  const model = tf.sequential();

  model.add(
    tf.layers.dense({
      inputShape: [inputDimension],
      units: 128,
      activation: 'relu'
    })
  );
  model.add(
    tf.layers.dense({
      units: 64,
      activation: 'relu'
    })
  );
  model.add(
    tf.layers.dense({
      units: 32,
      activation: 'relu'
    })
  );
  model.add(
    tf.layers.dense({
      units: 1,
      activation: 'sigmoid'
    })
  );

  model.compile({
    optimizer: tf.train.adam(0.01),
    loss: 'binaryCrossentropy',
    metrics: ['accuracy']
  });

  return model;
}

function cosineAffinity(vecA: readonly number[], vecB: readonly number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  const len = Math.min(vecA.length, vecB.length);
  for (let i = 0; i < len; i++) {
    const a = vecA[i] ?? 0;
    const b = vecB[i] ?? 0;
    dot += a * b;
    normA += a * a;
    normB += b * b;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0.5 : dot / denom;
}

/**
 * RN01, RN02, RN03 & RN04: Full pipeline that encodes product features, computes user profile via tf.stack,
 * trains the tf.sequential model emitting real-time loss/accuracy per epoch, and ranks products.
 */
export async function trainAndRankRecommendations(
  input: TrainAndRankInput
): Promise<TrainAndRankResult> {
  const prices = input.products.map((p) => p.price);
  const ages = input.products.map((p) => p.avgBuyerAge).concat(input.user.age);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const minAge = Math.min(...ages, 18);
  const maxAge = Math.max(...ages, 68);

  const productVectorsMap = new Map<string, number[]>();
  for (const product of input.products) {
    const categoryIndex = Math.max(0, input.categories.indexOf(product.category));
    const colorIndex = Math.max(0, input.colors.indexOf(product.color));

    const vector = buildProductFeatureVector({
      categoryIndex,
      numCategories: input.categories.length,
      colorIndex,
      numColors: input.colors.length,
      price: product.price,
      minPrice,
      maxPrice,
      avgBuyerAge: product.avgBuyerAge,
      minAge,
      maxAge
    });
    productVectorsMap.set(product.id, vector);
  }

  const purchasedVectors = input.user.purchasedProductIds
    .map((id) => productVectorsMap.get(id))
    .filter((v): v is number[] => Array.isArray(v));

  const userProfileVector = computeUserProfileTensorStack({
    purchasedProductVectors: purchasedVectors,
    userAge: input.user.age,
    minAge,
    maxAge,
    numCategories: input.categories.length,
    numColors: input.colors.length
  });

  const singleDim = userProfileVector.length;
  const combinedInputDim = singleDim * 2;

  const xRows: number[][] = [];
  const yLabels: number[] = [];

  for (const product of input.products) {
    const pVec = productVectorsMap.get(product.id) ?? new Array<number>(singleDim).fill(0);
    const pairInput = [...userProfileVector, ...pVec];
    const purchased = input.user.purchasedProductIds.includes(product.id);
    const affinity = cosineAffinity(userProfileVector, pVec);
    const label = purchased || affinity >= 0.65 ? 1 : 0;

    xRows.push(pairInput);
    yLabels.push(label);
  }

  const model = createSequentialRecommendationModel(combinedInputDim);
  const xs = tf.tensor2d(xRows, [xRows.length, combinedInputDim]);
  const ys = tf.tensor2d(yLabels, [yLabels.length, 1]);
  const epochHistory: EpochTelemetry[] = [];
  const totalEpochs = input.epochs ?? 15;

  try {
    await model.fit(xs, ys, {
      epochs: totalEpochs,
      batchSize: Math.max(1, xRows.length),
      shuffle: true,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          const telemetry: EpochTelemetry = {
            epoch: epoch + 1,
            loss: Number((logs?.loss ?? 0).toFixed(4)),
            accuracy: Number(((logs?.acc ?? logs?.accuracy ?? 0) as number).toFixed(4))
          };
          epochHistory.push(telemetry);
          input.onEpochEnd?.(telemetry);
        }
      }
    });

    const predictions = tf.tidy(() => {
      const predTensor = model.predict(xs) as tf.Tensor;
      return Array.from(predTensor.dataSync());
    });

    const rankedProducts: RankedProductRecommendation[] = input.products
      .map((product, idx) => ({
        product,
        score: Number((predictions[idx] ?? 0).toFixed(4)),
        featureVector: productVectorsMap.get(product.id) ?? []
      }))
      .sort((a, b) => b.score - a.score);

    return {
      userProfileVector,
      isColdStart: purchasedVectors.length === 0,
      epochHistory,
      rankedProducts
    };
  } finally {
    xs.dispose();
    ys.dispose();
    model.dispose();
  }
}

