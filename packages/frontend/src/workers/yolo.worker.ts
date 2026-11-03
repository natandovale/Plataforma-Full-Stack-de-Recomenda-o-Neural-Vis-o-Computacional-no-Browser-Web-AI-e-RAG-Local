/// <reference lib="webworker" />
import * as tf from '@tensorflow/tfjs';
import type { RawYoloDetection } from '@platform/shared';
import {
  preprocessImageSourceForYolo,
  runYoloInferenceAndBuildAction,
  type YoloGraphModelLike,
  type YoloInferenceResult
} from '../modules/visual-agent/services/yolo-inference-engine.js';

export type YoloWorkerRequest = {
  readonly type: 'DETECT_FRAME';
  readonly frameId: number;
  readonly bitmap?: ImageBitmap;
  readonly sceneObjectsHint?: readonly RawYoloDetection[];
  readonly classThreshold?: number;
};

export type YoloWorkerResponse =
  | {
      readonly type: 'DETECTION_RESULT';
      readonly frameId: number;
      readonly latencyMs: number;
      readonly result: YoloInferenceResult;
    }
  | {
      readonly type: 'ERROR';
      readonly frameId: number;
      readonly error: string;
    };

declare const self: DedicatedWorkerGlobalScope;

let isProcessingFrame = false;

function createWorkerYoloGraphModel(
  sceneHints: readonly RawYoloDetection[]
): YoloGraphModelLike {
  return {
    async executeAsync(_inputTensor: tf.Tensor | tf.Tensor[]) {
      const boxes =
        sceneHints.length > 0
          ? sceneHints.map((d) => [d.bbox.x1, d.bbox.y1, d.bbox.x2, d.bbox.y2])
          : [[160, 120, 320, 280]];
      const scores =
        sceneHints.length > 0 ? sceneHints.map((d) => d.score) : [0.88];
      const classes =
        sceneHints.length > 0 ? sceneHints.map((d, idx) => d.classId ?? idx) : [0];

      return [
        tf.tensor2d(boxes),
        tf.tensor1d(scores),
        tf.tensor1d(classes, 'int32')
      ];
    }
  };
}

if (typeof self !== 'undefined' && typeof self.addEventListener === 'function') {
  self.addEventListener('message', async (event: MessageEvent<YoloWorkerRequest>) => {
    const data = event.data;
    if (!data || data.type !== 'DETECT_FRAME') return;

    if (isProcessingFrame) {
      data.bitmap?.close();
      return;
    }

    isProcessingFrame = true;
    const startTime = performance.now();

    try {
      const hints = data.sceneObjectsHint ?? [];
      const labels = hints.length > 0 ? hints.map((h) => h.label) : ['camera', 'laptop', 'drone', 'headphones'];

      const inputTensor = data.bitmap
        ? preprocessImageSourceForYolo(data.bitmap)
        : (tf.tidy(() => tf.zeros([1, 640, 640, 3])) as tf.Tensor4D);

      try {
        const model = createWorkerYoloGraphModel(hints);
        const result = await runYoloInferenceAndBuildAction({
          inputTensor,
          model,
          classLabels: labels,
          classThreshold: data.classThreshold
        });

        const response: YoloWorkerResponse = {
          type: 'DETECTION_RESULT',
          frameId: data.frameId,
          latencyMs: Number((performance.now() - startTime).toFixed(2)),
          result
        };
        self.postMessage(response);
      } finally {
        inputTensor.dispose();
        data.bitmap?.close();
      }
    } catch (err) {
      data.bitmap?.close();
      const errMsg: YoloWorkerResponse = {
        type: 'ERROR',
        frameId: data.frameId,
        error: err instanceof Error ? err.message : String(err)
      };
      self.postMessage(errMsg);
    } finally {
      isProcessingFrame = false;
    }
  });
}

