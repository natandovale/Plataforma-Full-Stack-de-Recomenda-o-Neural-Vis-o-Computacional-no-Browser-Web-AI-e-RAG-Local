#!/usr/bin/env bash
set -e

# Start Ollama server in the background
/bin/ollama serve &
OLLAMA_PID=$!

echo "[Ollama CPU Bootstrap] Waiting for Ollama daemon to start..."
until ollama list >/dev/null 2>&1; do
  sleep 1
done

TEXT_MODEL="${OLLAMA_TEXT_MODEL:-qwen2.5:1.5b}"
VISION_MODEL="${OLLAMA_VISION_MODEL:-moondream}"

if ! ollama list | grep -q "$TEXT_MODEL"; then
  echo "[Ollama CPU Bootstrap] Pulling text model: $TEXT_MODEL"
  ollama pull "$TEXT_MODEL"
fi

if ! ollama list | grep -q "$VISION_MODEL"; then
  echo "[Ollama CPU Bootstrap] Pulling vision model: $VISION_MODEL"
  ollama pull "$VISION_MODEL"
fi

echo "[Ollama CPU Bootstrap] Models ready ($TEXT_MODEL, $VISION_MODEL). Serving..."
wait $OLLAMA_PID

