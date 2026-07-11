import { buildApp } from './app.js';
import { env } from './config/env.js';
import { startExpiryJob } from './jobs/expire-reservations.js';
import { initSentry } from './lib/sentry.js';

async function main(): Promise<void> {
  // Monitoreo de errores (no-op sin SENTRY_DSN).
  initSentry();

  const app = await buildApp();

  // Job en segundo plano: libera apartados vencidos.
  const stopJob = startExpiryJob();

  const shutdown = async (signal: string) => {
    app.log.info(`Recibido ${signal}, cerrando...`);
    stopJob();
    await app.close();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  try {
    await app.listen({ port: env.port, host: env.host });
    app.log.info(`Bismark API escuchando en http://${env.host}:${env.port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

void main();
