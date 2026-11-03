export interface FeatureWeights {
  readonly category: number;
  readonly color: number;
  readonly price: number;
  readonly avgBuyerAge: number;
}

/**
 * Approved RN02 feature importance hierarchy:
 * category (0.40) > color (0.25) > price (0.20) > avgBuyerAge (0.15)
 */
export const DEFAULT_FEATURE_WEIGHTS: FeatureWeights = Object.freeze({
  category: 0.4,
  color: 0.25,
  price: 0.2,
  avgBuyerAge: 0.15
});

export interface ProductFeatureInput {
  readonly categoryIndex: number;
  readonly numCategories: number;
  readonly colorIndex: number;
  readonly numColors: number;
  readonly price: number;
  readonly minPrice: number;
  readonly maxPrice: number;
  readonly avgBuyerAge: number;
  readonly minAge: number;
  readonly maxAge: number;
  readonly weights?: FeatureWeights;
}

export interface UserProfileInput {
  readonly purchasedProductVectors: readonly (readonly number[])[];
  readonly userAge: number;
  readonly minAge: number;
  readonly maxAge: number;
  readonly numCategories: number;
  readonly numColors: number;
  readonly weights?: FeatureWeights;
}

/**
 * RN01: Normalizes continuous variables (age, price) into [0, 1] via (value - min) / (max - min).
 * Returns 0 when max <= min and clamps out-of-range inputs to [0, 1].
 */
export function normalizeMinMax(value: number, min: number, max: number): number {
  if (max <= min) {
    return 0;
  }
  const normalized = (value - min) / (max - min);
  if (normalized < 0) return 0;
  if (normalized > 1) return 1;
  return normalized;
}

/**
 * RN02: Generates a weighted one-hot encoded array of length `numClasses`.
 */
export function oneHotWeighted(index: number, numClasses: number, weight: number): number[] {
  if (numClasses <= 0) {
    return [];
  }
  const vector = new Array<number>(numClasses).fill(0);
  if (index >= 0 && index < numClasses) {
    vector[index] = weight;
  }
  return vector;
}

/**
 * RN02: Builds the complete weighted feature vector for a product:
 * [ ...categoryOneHotWeighted, ...colorOneHotWeighted, normalizedPrice * priceWeight, normalizedAge * avgBuyerAgeWeight ]
 */
export function buildProductFeatureVector(input: ProductFeatureInput): number[] {
  const weights = input.weights ?? DEFAULT_FEATURE_WEIGHTS;

  const categoryPart = oneHotWeighted(input.categoryIndex, input.numCategories, weights.category);
  const colorPart = oneHotWeighted(input.colorIndex, input.numColors, weights.color);
  const pricePart = normalizeMinMax(input.price, input.minPrice, input.maxPrice) * weights.price;
  const agePart = normalizeMinMax(input.avgBuyerAge, input.minAge, input.maxAge) * weights.avgBuyerAge;

  return [...categoryPart, ...colorPart, pricePart, agePart];
}

/**
 * RN03: Computes the user profile vector from the element-wise mean of stacked purchased product vectors,
 * or falls back to the user's normalized age vector for cold-start users without purchase history.
 */
export function computeUserProfileVector(input: UserProfileInput): number[] {
  const weights = input.weights ?? DEFAULT_FEATURE_WEIGHTS;
  const totalDimensions = input.numCategories + input.numColors + 2;

  if (input.purchasedProductVectors.length === 0) {
    const fallbackVector = new Array<number>(totalDimensions).fill(0);
    const normalizedUserAge = normalizeMinMax(input.userAge, input.minAge, input.maxAge);
    fallbackVector[totalDimensions - 1] = normalizedUserAge * weights.avgBuyerAge;
    return fallbackVector;
  }

  const count = input.purchasedProductVectors.length;
  const meanVector = new Array<number>(totalDimensions).fill(0);

  for (const productVector of input.purchasedProductVectors) {
    for (let i = 0; i < totalDimensions; i++) {
      meanVector[i] = (meanVector[i] ?? 0) + (productVector[i] ?? 0);
    }
  }

  return meanVector.map((sum) => sum / count);
}

