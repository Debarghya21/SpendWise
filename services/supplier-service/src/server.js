const { createApp } = require('./app');
const { init, pool } = require('./db');
const { startGrpcServer } = require('./grpcServer');
const config = require('./config');

async function initWithRetry(attempts = 30) {
  for (let i = 1; i <= attempts; i += 1) {
    try {
      await init();
      return;
    } catch (err) {
      console.warn(`DB init attempt ${i}/${attempts} failed: ${err.message}`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw new Error('Could not initialise database');
}

async function main() {
  await initWithRetry();

  // Start gRPC server for internal service-to-service communication
  const grpcServer = await startGrpcServer();

  // Start REST/HTTP server for external (gateway) traffic
  const httpServer = createApp().listen(config.port, () => {
    console.log(`supplier-service REST listening on :${config.port}`);
  });

  const shutdown = () => {
    grpcServer.tryShutdown(() => {
      httpServer.close(() => pool.end().then(() => process.exit(0)));
    });
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
