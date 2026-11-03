export const DEFAULT_YOLO_CLASS_THRESHOLD = 0.4;

export interface BoundingBox {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

export interface RawYoloDetection {
  readonly classId: number;
  readonly label: string;
  readonly score: number;
  readonly bbox: BoundingBox;
}

export interface EnrichedYoloDetection extends RawYoloDetection {
  readonly centerX: number;
}

/**
 * RN05: Calculates the horizontal center of a bounding box:
 * centerX = x1 + (x2 - x1) / 2
 */
export function calculateBoundingBoxCenterX(x1: number, x2: number): number {
  return x1 + (x2 - x1) / 2;
}

/**
 * RN05: Filters YOLO detections by classThreshold (>= 0.40 by default)
 * and enriches each valid detection with its horizontal center (centerX).
 */
export function filterAndComputeDetections(
  detections: readonly RawYoloDetection[],
  classThreshold: number = DEFAULT_YOLO_CLASS_THRESHOLD
): EnrichedYoloDetection[] {
  return detections
    .filter((detection) => detection.score >= classThreshold)
    .map((detection) => ({
      ...detection,
      centerX: calculateBoundingBoxCenterX(detection.bbox.x1, detection.bbox.x2)
    }));
}

