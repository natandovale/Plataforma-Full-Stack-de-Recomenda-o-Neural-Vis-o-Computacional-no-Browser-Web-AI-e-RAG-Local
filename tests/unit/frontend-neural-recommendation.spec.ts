import { describe, expect, it } from 'vitest';
import {
  computeUserProfileTensorStack,
  createSequentialRecommendationModel,
  trainAndRankRecommendations,
  type EpochTelemetry
} from '../../packages/frontend/src/modules/recommendation/services/neural-recommendation-engine.js';

describe('Increment 3.1 — TensorFlow.js Sequential Recommendation Engine (tf.stack, 128-64-32-1, adam 0.01)', () => {
  it('RN03: computes user profile vector using tf.stack mean for users with purchase history and age fallback for cold start', () => {
    const historyProfile = computeUserProfileTensorStack({
      purchasedProductVectors: [
        [0.4, 0, 0.25, 0, 0.1, 0.06],
        [0, 0.4, 0.25, 0, 0.2, 0.12]
      ],
      userAge: 32,
      minAge: 18,
      maxAge: 68,
      numCategories: 2,
      numColors: 2
    });

    expect(historyProfile).toHaveLength(6);
    expect(historyProfile[0]).toBeCloseTo(0.2, 5);
    expect(historyProfile[1]).toBeCloseTo(0.2, 5);
    expect(historyProfile[4]).toBeCloseTo(0.15, 5);

    const coldStartProfile = computeUserProfileTensorStack({
      purchasedProductVectors: [],
      userAge: 43,
      minAge: 18,
      maxAge: 68,
      numCategories: 2,
      numColors: 2
    });

    expect(coldStartProfile).toHaveLength(6);
    expect(coldStartProfile.slice(0, 5)).toEqual([0, 0, 0, 0, 0]);
    expect(coldStartProfile[5]).toBeCloseTo(0.075, 5);
  });

  it('RN04: creates a tf.sequential neural network with dense layers 128 (relu) -> 64 (relu) -> 32 (relu) -> 1 (sigmoid)', () => {
    const model = createSequentialRecommendationModel(12);

    expect(model.layers).toHaveLength(4);
    expect(model.layers[0]?.getConfig().units).toBe(128);
    expect(model.layers[0]?.getConfig().activation).toBe('relu');
    expect(model.layers[1]?.getConfig().units).toBe(64);
    expect(model.layers[1]?.getConfig().activation).toBe('relu');
    expect(model.layers[2]?.getConfig().units).toBe(32);
    expect(model.layers[2]?.getConfig().activation).toBe('relu');
    expect(model.layers[3]?.getConfig().units).toBe(1);
    expect(model.layers[3]?.getConfig().activation).toBe('sigmoid');

    model.dispose();
  });

  it('RN04: trains the sequential model emitting epoch telemetry (loss, accuracy) and ranks catalog products', async () => {
    const epochsRecorded: EpochTelemetry[] = [];

    const result = await trainAndRankRecommendations({
      categories: ['Cameras', 'Laptops', 'Drones'],
      colors: ['Black', 'Silver'],
      products: [
        { id: 'p1', name: 'Camera 4K', category: 'Cameras', color: 'Black', price: 3000, avgBuyerAge: 30 },
        { id: 'p2', name: 'Laptop AI', category: 'Laptops', color: 'Silver', price: 4500, avgBuyerAge: 28 },
        { id: 'p3', name: 'Drone 8K', category: 'Drones', color: 'Black', price: 2800, avgBuyerAge: 33 }
      ],
      user: {
        id: 'u1',
        name: 'Ana',
        age: 31,
        purchasedProductIds: ['p1']
      },
      epochs: 4,
      onEpochEnd: (telemetry) => epochsRecorded.push(telemetry)
    });

    expect(epochsRecorded).toHaveLength(4);
    expect(epochsRecorded[0]?.epoch).toBe(1);
    expect(typeof epochsRecorded[0]?.loss).toBe('number');
    expect(typeof epochsRecorded[0]?.accuracy).toBe('number');
    expect(result.rankedProducts).toHaveLength(3);
    expect(result.rankedProducts[0]?.score).toBeGreaterThanOrEqual(result.rankedProducts[1]?.score ?? 0);
  });
});

