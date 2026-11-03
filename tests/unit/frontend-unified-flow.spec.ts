import { describe, expect, it } from 'vitest';
import { createUnifiedFlowStateController } from '../../packages/frontend/src/modules/unified-flow-controller.js';

describe('Increment 5.2 — Unified Full-Stack Flow Controller (WebAI -> Recommendation -> YOLO Canvas -> 10-Block RAG)', () => {
  it('connects visual YOLO detection (centerX) to product inspection and pre-populates the 10-block RAG query', () => {
    const controller = createUnifiedFlowStateController({
      initialAgentX: 320,
      canvasWidth: 640
    });

    const stepResult = controller.applyYoloAction({
      type: 'MOVE_AGENT_AND_INSPECT',
      targetLabel: 'camera',
      targetCenterX: 180,
      confidence: 0.88
    });

    expect(stepResult.agentX).toBe(180);
    expect(stepResult.inspectedYoloLabel).toBe('camera');
    expect(stepResult.suggestedRagQuestion).toContain('camera');
  });
});

