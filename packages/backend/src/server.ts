import { createBackendApp } from './app.js';
import { parseBackendEnv } from './config/env.js';

async function bootstrapServer() {
  const env = parseBackendEnv();
  const app = await createBackendApp();

  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    console.log(`[Backend Server] Listening on http://localhost:${env.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

bootstrapServer();
