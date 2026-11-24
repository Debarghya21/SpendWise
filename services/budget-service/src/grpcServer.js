const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
const service = require('./services/budgetService');
const config = require('./config');

// In Docker: /app/proto/budget.proto; locally (dev): ../../proto/budget.proto
const PROTO_PATH = path.resolve(__dirname, '..', 'proto', 'budget.proto');

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: false,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const proto = grpc.loadPackageDefinition(packageDefinition).spendwise.budget;

/**
 * gRPC implementation of BudgetService.ReserveBudget.
 * Reuses the same business logic as the REST controller.
 */
async function reserveBudget(call, callback) {
  try {
    const { department, poId, amount } = call.request;
    if (!department || !poId || !amount) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'department, po_id and amount are required',
      });
    }

    const body = { poId, amount: Number(amount) };
    const result = await service.reserve(department, body, 'grpc-caller');

    callback(null, {
      outcome: 'RESERVED',
      reservationId: result.reservationId || 0,
      availableAmount: result.availableAmount != null ? String(result.availableAmount) : '0',
      message: 'Budget reserved',
    });
  } catch (err) {
    // Business rejections (HttpError with 4xx) are NOT gRPC transport errors —
    // return them as a normal response with REJECTED outcome so the caller
    // can distinguish "insufficient funds" from "service down".
    if (err.status && err.status >= 400 && err.status < 500) {
      return callback(null, {
        outcome: 'REJECTED',
        reservationId: 0,
        availableAmount: err.details?.availableAmount != null ? String(err.details.availableAmount) : '0',
        message: err.message || 'Budget reservation refused',
      });
    }

    console.error('gRPC ReserveBudget error:', err);
    callback({
      code: grpc.status.INTERNAL,
      message: err.message || 'Internal error',
    });
  }
}

function createGrpcServer() {
  const server = new grpc.Server();
  server.addService(proto.BudgetService.service, {
    reserveBudget,
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
        console.log(`budget-service gRPC server listening on :${boundPort}`);
        resolve(server);
      },
    );
  });
}

module.exports = { createGrpcServer, startGrpcServer };
