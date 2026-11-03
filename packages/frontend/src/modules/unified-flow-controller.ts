import type { AutomatedVisualAction } from './visual-agent/services/yolo-inference-engine.js';

export interface UnifiedFlowOptions {
  readonly initialAgentX: number;
  readonly canvasWidth: number;
}

export interface UnifiedFlowStepResult {
  readonly agentX: number;
  readonly inspectedYoloLabel: string | null;
  readonly suggestedRagQuestion: string;
}

export function createUnifiedFlowStateController(options: UnifiedFlowOptions) {
  let agentX = options.initialAgentX;
  let inspectedYoloLabel: string | null = null;

  return {
    applyYoloAction(action: AutomatedVisualAction): UnifiedFlowStepResult {
      if (action.type === 'MOVE_AGENT_AND_INSPECT' && action.targetCenterX !== null) {
        agentX = Math.max(0, Math.min(options.canvasWidth, action.targetCenterX));
        inspectedYoloLabel = action.targetLabel;
      }

      const labelText = inspectedYoloLabel ?? 'produto';
      return {
        agentX,
        inspectedYoloLabel,
        suggestedRagQuestion: `Quais as especificações técnicas e detalhes do item detectado (${labelText}) nos manuais e vídeos?`
      };
    }
  };
}

