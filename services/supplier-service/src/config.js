module.exports = {
  port: parseInt(process.env.PORT || '3001', 10),
  grpcPort: parseInt(process.env.GRPC_PORT || '50051', 10),
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'supplier_db',
    user: process.env.DB_USER || 'supplier_user',
    password: process.env.DB_PASSWORD || 'supplier_pass',
    max: 10,
    connectionTimeoutMillis: 5000,
  },
};
