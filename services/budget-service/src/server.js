const { createApp } = require('./app');
const { init, pool } = require('./db');
const messaging = require('./messaging/rabbit');
const { handlePurchaseOrderEvent } = require('./services/budgetService');
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
  messaging.connect(handlePurchaseOrderEvent); // reconnects in background

  // Start gRPC server for internal service-to-service communication
  const grpcServer = await startGrpcServer();

  // Start REST/HTTP server for external (gateway) traffic
  const httpServer = createApp().listen(config.port, () => {
    console.log(`budget-service REST listening on :${config.port}`);
  });

  const shutdown = () => {
    grpcServer.tryShutdown(async () => {
      httpServer.close(async () => {
        await messaging.close();
        await pool.end();
        process.exit(0);
      });
    });
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
