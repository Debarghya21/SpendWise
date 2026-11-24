module.exports = {
  port: parseInt(process.env.PORT || '3004', 10),
  grpcPort: parseInt(process.env.GRPC_PORT || '50052', 10),
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'budget_db',
    user: process.env.DB_USER || 'budget_user',
    password: process.env.DB_PASSWORD || 'budget_pass',
    max: 10,
    connectionTimeoutMillis: 5000,
  },
  rabbitUrl: process.env.RABBITMQ_URL || 'amqp://spendwise:spendwise_pass@localhost:5672',
  maxRetries: parseInt(process.env.MESSAGE_MAX_RETRIES || '3', 10),
  retryBaseDelayMs: parseInt(process.env.MESSAGE_RETRY_BASE_MS || '2000', 10),
};
