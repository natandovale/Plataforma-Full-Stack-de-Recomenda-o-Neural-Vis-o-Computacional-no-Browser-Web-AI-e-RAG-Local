import * as tf from '@tensorflow/tfjs';
import { describe, expect, it, vi } from 'vitest';
import {
  preprocessPixelTensorForYolo,
  runYoloInferenceAndBuildAction,
  type YoloGraphModelLike
} from '../../packages/frontend/src/modules/visual-agent/services/yolo-inference-engine.js';

describe('Increment 4.1 — YOLO Visual Agent TensorFlow.js Preprocessing (tf.tidy 640x640) & executeAsync Action', () => {
  it('RN05: preprocesses image frame inside tf.tidy using resizeBilinear([640, 640]) -> div(255) -> expandDims(0) without leaking intermediate tensors', () => {
    const numTensorsBefore = tf.memory().numTensors;
    const rawPixels = tf.tensor3d(new Array(10 * 10 * 3).fill(255), [10, 10, 3], 'int32');

    const preprocessed = preprocessPixelTensorForYolo(rawPixels);
    rawPixels.dispose();

    expect(preprocessed.shape).toEqual([1, 640, 640, 3]);

    const sampleTensor = preprocessed.slice([0, 0, 0, 0], [1, 1, 1, 1]);
    const sampleVal = sampleTensor.dataSync()[0] ?? 0;
    sampleTensor.dispose();
    expect(sampleVal).toBeCloseTo(1.0, 5);

    preprocessed.dispose();
    const numTensorsAfter = tf.memory().numTensors;
    expect(numTensorsAfter).toBe(numTensorsBefore);
  });

  it('RN05: runs executeAsync on YOLO GraphModel, filters by classThreshold >= 0.40, computes centerX and triggers automated action', async () => {
    const fakeModel: YoloGraphModelLike = {
      executeAsync: vi.fn().mockImplementation(async () => [
        // boxes [x1, y1, x2, y2]
        tf.tensor2d([
          [100, 50, 300, 250],
          [400, 100, 500, 200]
        ]),
        // scores
        tf.tensor1d([0.82, 0.35]),
        // classes
        tf.tensor1d([0, 1], 'int32')
      ])
    };

    const inputTensor = tf.zeros([1, 640, 640, 3]) as tf.Tensor4D;
    const result = await runYoloInferenceAndBuildAction({
      inputTensor,
      model: fakeModel,
      classLabels: ['camera', 'laptop'],
      classThreshold: 0.4
    });

    inputTensor.dispose();

    expect(fakeModel.executeAsync).toHaveBeenCalledTimes(1);
    expect(result.detections).toHaveLength(1);
    expect(result.detections[0]?.label).toBe('camera');
    expect(result.detections[0]?.score).toBeCloseTo(0.82, 4);
    expect(result.detections[0]?.centerX).toBe(200);
    expect(result.automatedAction).toEqual({
      type: 'MOVE_AGENT_AND_INSPECT',
      targetLabel: 'camera',
      targetCenterX: 200,
      confidence: 0.82
    });
  });
});
