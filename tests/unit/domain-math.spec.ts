import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FEATURE_WEIGHTS,
  buildProductFeatureVector,
  computeUserProfileVector,
  normalizeMinMax,
  oneHotWeighted
} from '../../packages/shared/src/domain/feature-engineering.js';
import {
  DEFAULT_YOLO_CLASS_THRESHOLD,
  calculateBoundingBoxCenterX,
  filterAndComputeDetections
} from '../../packages/shared/src/domain/yolo-geometry.js';

describe('Increment 1.1 — Feature Engineering & YOLO Geometry Domain Math', () => {
  describe('RN01: normalizeMinMax', () => {
    it('normalizes continuous values (age, price) into [0, 1] using (value - min) / (max - min)', () => {
      expect(normalizeMinMax(50, 0, 100)).toBeCloseTo(0.5, 5);
      expect(normalizeMinMax(18, 18, 68)).toBeCloseTo(0, 5);
      expect(normalizeMinMax(68, 18, 68)).toBeCloseTo(1, 5);
      expect(normalizeMinMax(250, 100, 500)).toBeCloseTo(0.375, 5);
    });

    it('returns 0 when max === min to avoid division by zero', () => {
      expect(normalizeMinMax(42, 42, 42)).toBe(0);
    });

    it('clamps out-of-range values into [0, 1]', () => {
      expect(normalizeMinMax(5, 10, 20)).toBe(0);
      expect(normalizeMinMax(25, 10, 20)).toBe(1);
    });
  });

  describe('RN02: oneHotWeighted & buildProductFeatureVector', () => {
    it('defines default weights following strict importance order: category > color > price > avgBuyerAge', () => {
      expect(DEFAULT_FEATURE_WEIGHTS.category).toBe(0.4);
      expect(DEFAULT_FEATURE_WEIGHTS.color).toBe(0.25);
      expect(DEFAULT_FEATURE_WEIGHTS.price).toBe(0.2);
      expect(DEFAULT_FEATURE_WEIGHTS.avgBuyerAge).toBe(0.15);

      expect(DEFAULT_FEATURE_WEIGHTS.category).toBeGreaterThan(DEFAULT_FEATURE_WEIGHTS.color);
      expect(DEFAULT_FEATURE_WEIGHTS.color).toBeGreaterThan(DEFAULT_FEATURE_WEIGHTS.price);
      expect(DEFAULT_FEATURE_WEIGHTS.price).toBeGreaterThan(DEFAULT_FEATURE_WEIGHTS.avgBuyerAge);
    });

    it('creates a weighted one-hot vector for categorical variables', () => {
      expect(oneHotWeighted(1, 3, 0.4)).toEqual([0, 0.4, 0]);
      expect(oneHotWeighted(0, 2, 0.25)).toEqual([0.25, 0]);
    });

    it('builds complete product feature vector combining category, color, price and avgBuyerAge', () => {
      const vector = buildProductFeatureVector({
        categoryIndex: 0,
        numCategories: 2,
        colorIndex: 1,
        numColors: 2,
        price: 150,
        minPrice: 50,
        maxPrice: 250,
        avgBuyerAge: 30,
        minAge: 20,
        maxAge: 60
      });

      // Category [0.4, 0] + Color [0, 0.25] + Price (0.5 * 0.2 = 0.1) + Age (0.25 * 0.15 = 0.0375)
      expect(vector).toHaveLength(6);
      expect(vector[0]).toBeCloseTo(0.4, 5);
      expect(vector[1]).toBeCloseTo(0, 5);
      expect(vector[2]).toBeCloseTo(0, 5);
      expect(vector[3]).toBeCloseTo(0.25, 5);
      expect(vector[4]).toBeCloseTo(0.1, 5);
      expect(vector[5]).toBeCloseTo(0.0375, 5);
    });
  });

  describe('RN03: computeUserProfileVector (Purchase History Stack Mean & Cold Start Fallback)', () => {
    it('computes element-wise mean across purchased product vectors when user has purchase history', () => {
      const purchasedVectors = [
        [0.4, 0, 0.25, 0, 0.1, 0.06],
        [0, 0.4, 0.25, 0, 0.2, 0.12]
      ];

      const profile = computeUserProfileVector({
        purchasedProductVectors: purchasedVectors,
        userAge: 28,
        minAge: 18,
        maxAge: 68,
        numCategories: 2,
        numColors: 2
      });

      expect(profile).toHaveLength(6);
      expect(profile[0]).toBeCloseTo(0.2, 5);
      expect(profile[1]).toBeCloseTo(0.2, 5);
      expect(profile[2]).toBeCloseTo(0.25, 5);
      expect(profile[3]).toBeCloseTo(0, 5);
      expect(profile[4]).toBeCloseTo(0.15, 5);
      expect(profile[5]).toBeCloseTo(0.09, 5);
    });

    it('falls back to normalized user age vector for cold-start users without purchase history', () => {
      const profile = computeUserProfileVector({
        purchasedProductVectors: [],
        userAge: 43,
        minAge: 18,
        maxAge: 68,
        numCategories: 2,
        numColors: 2
      });

      // normalizedAge = (43 - 18) / (68 - 18) = 0.5 -> weighted by 0.15 = 0.075
      expect(profile).toHaveLength(6);
      expect(profile.slice(0, 5)).toEqual([0, 0, 0, 0, 0]);
      expect(profile[5]).toBeCloseTo(0.075, 5);
    });
  });

  describe('RN05: YOLO Bounding Box CenterX & Class Threshold Filtering', () => {
    it('sets default YOLO class threshold to 0.40 (40%)', () => {
      expect(DEFAULT_YOLO_CLASS_THRESHOLD).toBe(0.4);
    });

    it('calculates horizontal center of bounding box using centerX = x1 + (x2 - x1) / 2', () => {
      expect(calculateBoundingBoxCenterX(100, 300)).toBe(200);
      expect(calculateBoundingBoxCenterX(50, 125)).toBe(87.5);
    });

    it('filters out detections below 40% confidence and enriches valid detections with centerX', () => {
      const rawDetections = [
        { classId: 0, label: 'laptop', score: 0.85, bbox: { x1: 120, y1: 80, x2: 320, y2: 260 } },
        { classId: 1, label: 'mouse', score: 0.39, bbox: { x1: 400, y1: 200, x2: 450, y2: 240 } },
        { classId: 2, label: 'keyboard', score: 0.4, bbox: { x1: 150, y1: 300, x2: 350, y2: 380 } }
      ];

      const valid = filterAndComputeDetections(rawDetections);

      expect(valid).toHaveLength(2);
      expect(valid[0]?.label).toBe('laptop');
      expect(valid[0]?.centerX).toBe(220);
      expect(valid[1]?.label).toBe('keyboard');
      expect(valid[1]?.centerX).toBe(250);
    });
  });
});

