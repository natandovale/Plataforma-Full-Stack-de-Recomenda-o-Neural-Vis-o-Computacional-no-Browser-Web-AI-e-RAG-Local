/// <reference lib="webworker" />
import {
  TransformersJsBrowserProvider,
  type WebAIExecuteRequest,
  type WebAIProviderOutput
} from '../modules/web-ai/services/web-ai-chain.js';

export type WebAiWorkerRequest = {
  readonly type: 'EXECUTE_WEBAI_TASK';
  readonly payload: Omit<WebAIExecuteRequest, 'onStreamChunk'>;
};

export type WebAiWorkerResponse =
  | { readonly type: 'STREAM_CHUNK'; readonly chunk: string }
  | { readonly type: 'COMPLETE'; readonly output: WebAIProviderOutput }
  | { readonly type: 'ERROR'; readonly error: string };

declare const self: DedicatedWorkerGlobalScope;

const provider = new TransformersJsBrowserProvider();

if (typeof self !== 'undefined' && typeof self.addEventListener === 'function') {
  self.addEventListener('message', async (event: MessageEvent<WebAiWorkerRequest>) => {
    const data = event.data;
    if (!data || data.type !== 'EXECUTE_WEBAI_TASK') return;

    try {
      const output = await provider.run({
        ...data.payload,
        onStreamChunk: (chunk) => {
          const msg: WebAiWorkerResponse = { type: 'STREAM_CHUNK', chunk };
          self.postMessage(msg);
        }
      });

      const done: WebAiWorkerResponse = { type: 'COMPLETE', output };
      self.postMessage(done);
    } catch (err) {
      const errorMsg: WebAiWorkerResponse = {
        type: 'ERROR',
        error: err instanceof Error ? err.message : String(err)
      };
      self.postMessage(errorMsg);
    }
  });
}

