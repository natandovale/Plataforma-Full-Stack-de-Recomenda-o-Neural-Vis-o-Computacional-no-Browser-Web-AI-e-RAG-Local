import * as tf from '@tensorflow/tfjs';
import {
  DEFAULT_YOLO_CLASS_THRESHOLD,
  filterAndComputeDetections,
  type EnrichedYoloDetection,
  type RawYoloDetection
} from '@platform/shared';

export interface YoloGraphModelLike {
  executeAsync(inputs: tf.Tensor | tf.Tensor[]): Promise<tf.Tensor | tf.Tensor[]>;
}

export interface AutomatedVisualAction {
  readonly type: 'MOVE_AGENT_AND_INSPECT' | 'IDLE';
  readonly targetLabel: string | null;
  readonly targetCenterX: number | null;
  readonly confidence: number;
}

export interface YoloInferenceResult {
  readonly detections: readonly EnrichedYoloDetection[];
  readonly automatedAction: AutomatedVisualAction;
}

/**
 * RN05: Preprocesses an input 3D pixel tensor inside tf.tidy:
 * resizeBilinear([640, 640]) -> div(255) -> expandDims(0)
 * ensuring zero memory leaks of intermediate tensors.
 */
export function preprocessPixelTensorForYolo(pixelTensor: tf.Tensor3D): tf.Tensor4D {
  return tf.tidy(() => {
    const resized = tf.image.resizeBilinear(pixelTensor, [640, 640]);
    const normalized = resized.div(255);
    return normalized.expandDims(0) as tf.Tensor4D;
  });
}

/**
 * RN05: Captures pixels from an ImageBitmap/HTMLCanvasElement inside tf.tidy
 * and applies resizeBilinear([640, 640]) -> div(255) -> expandDims(0).
 */
export function preprocessImageSourceForYolo(
  source: ImageBitmap | HTMLCanvasElement | ImageData
): tf.Tensor4D {
  return tf.tidy(() => {
    const pixels = tf.browser.fromPixels(source);
    const resized = tf.image.resizeBilinear(pixels, [640, 640]);
    const normalized = resized.div(255);
    return normalized.expandDims(0) as tf.Tensor4D;
  });
}

export interface RunYoloInferenceInput {
  readonly inputTensor: tf.Tensor4D;
  readonly model: YoloGraphModelLike;
  readonly classLabels: readonly string[];
  readonly classThreshold?: number;
}

/**
 * RN05: Executes asynchronous YOLO inference via executeAsync,
 * filters detections by classThreshold >= 0.40 (40%), computes centerX = x1 + (x2 - x1)/2,
 * and triggers the automated action towards the highest-confidence target.
 */
export async function runYoloInferenceAndBuildAction(
  input: RunYoloInferenceInput
): Promise<YoloInferenceResult> {
  const threshold = input.classThreshold ?? DEFAULT_YOLO_CLASS_THRESHOLD;
  const outputs = await input.model.executeAsync(input.inputTensor);
  const tensorList = Array.isArray(outputs) ? outputs : [outputs];

  try {
    const boxesTensor = tensorList[0];
    const scoresTensor = tensorList[1];
    const classesTensor = tensorList[2];

    const rawDetections: RawYoloDetection[] = [];

    if (boxesTensor && scoresTensor && classesTensor) {
      const boxesData = boxesTensor.dataSync();
      const scoresData = scoresTensor.dataSync();
      const classesData = classesTensor.dataSync();

      const numBoxes = scoresData.length;
      for (let i = 0; i < numBoxes; i++) {
        const x1 = Number(boxesData[i * 4] ?? 0);
        const y1 = Number(boxesData[i * 4 + 1] ?? 0);
        const x2 = Number(boxesData[i * 4 + 2] ?? 0);
        const y2 = Number(boxesData[i * 4 + 3] ?? 0);
        const score = Number((scoresData[i] ?? 0).toFixed(4));
        const classId = Number(classesData[i] ?? 0);
        const label = input.classLabels[classId] ?? `class-${classId}`;

        rawDetections.push({
          classId,
          label,
          score,
          bbox: { x1, y1, x2, y2 }
        });
      }
    }

    const detections = filterAndComputeDetections(rawDetections, threshold).sort(
      (a, b) => b.score - a.score
    );

    const best = detections[0];
    const automatedAction: AutomatedVisualAction = best
      ? {
          type: 'MOVE_AGENT_AND_INSPECT',
          targetLabel: best.label,
          targetCenterX: best.centerX,
          confidence: best.score
        }
      : {
          type: 'IDLE',
          targetLabel: null,
          targetCenterX: null,
          confidence: 0
        };

    return {
      detections,
      automatedAction
    };
  } finally {
    for (const t of tensorList) {
      t.dispose();
    }
  }
}

