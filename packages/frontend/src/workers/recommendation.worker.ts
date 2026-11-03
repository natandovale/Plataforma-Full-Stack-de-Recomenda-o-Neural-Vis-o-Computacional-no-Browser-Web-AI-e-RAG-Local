/// <reference lib="webworker" />
import {
  trainAndRankRecommendations,
  type EpochTelemetry,
  type TrainAndRankInput,
  type TrainAndRankResult
} from '../modules/recommendation/services/neural-recommendation-engine.js';

export type RecommendationWorkerRequest = {
  readonly type: 'TRAIN_AND_RANK';
  readonly payload: Omit<TrainAndRankInput, 'onEpochEnd'>;
};

export type RecommendationWorkerResponse =
  | { readonly type: 'EPOCH_END'; readonly payload: EpochTelemetry }
  | { readonly type: 'TRAIN_COMPLETE'; readonly payload: TrainAndRankResult }
  | { readonly type: 'ERROR'; readonly error: string };

declare const self: DedicatedWorkerGlobalScope;

if (typeof self !== 'undefined' && typeof self.addEventListener === 'function') {
  self.addEventListener('message', async (event: MessageEvent<RecommendationWorkerRequest>) => {
    const data = event.data;
    if (!data || data.type !== 'TRAIN_AND_RANK') return;

    try {
      const result = await trainAndRankRecommendations({
        ...data.payload,
        onEpochEnd: (telemetry) => {
          const msg: RecommendationWorkerResponse = {
            type: 'EPOCH_END',
            payload: telemetry
          };
          self.postMessage(msg);
        }
      });

      const doneMsg: RecommendationWorkerResponse = {
        type: 'TRAIN_COMPLETE',
        payload: result
      };
      self.postMessage(doneMsg);
    } catch (err) {
      const errorMsg: RecommendationWorkerResponse = {
        type: 'ERROR',
        error: err instanceof Error ? err.message : String(err)
      };
      self.postMessage(errorMsg);
    }
  });
}

