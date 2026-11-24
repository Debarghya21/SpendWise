const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
const service = require('./services/supplierService');
const config = require('./config');

// In Docker: /app/proto/supplier.proto; locally (dev): ../../proto/supplier.proto
const PROTO_PATH = path.resolve(__dirname, '..', 'proto', 'supplier.proto');

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: false,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const proto = grpc.loadPackageDefinition(packageDefinition).spendwise.supplier;

/**
 * gRPC implementation of SupplierService.ValidateSupplier.
 * Reuses the same business logic as the REST controller.
 */
async function validateSupplier(call, callback) {
  try {
    const { supplierId } = call.request;
    if (!supplierId) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'supplier_id is required',
      });
    }
    const result = await service.validateEligibility(supplierId);
    callback(null, {
      supplierId: result.supplierId || '',
      name: result.name || '',
      category: result.category || '',
      status: result.status || '',
      eligible: !!result.eligible,
      reason: result.reason || '',
    });
  } catch (err) {
    console.error('gRPC ValidateSupplier error:', err);
    callback({
      code: grpc.status.INTERNAL,
      message: err.message || 'Internal error',
    });
  }
}

function createGrpcServer() {
  const server = new grpc.Server();
  server.addService(proto.SupplierService.service, {
    validateSupplier,
  });
  return server;
}

function startGrpcServer() {
  const server = createGrpcServer();
  const port = config.grpcPort;
  return new Promise((resolve, reject) => {
    server.bindAsync(
      `0.0.0.0:${port}`,
      grpc.ServerCredentials.createInsecure(),
      (err, boundPort) => {
        if (err) return reject(err);
        console.log(`supplier-service gRPC server listening on :${boundPort}`);
        resolve(server);
      },
    );
  });
}

module.exports = { createGrpcServer, startGrpcServer };
