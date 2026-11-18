const amqp = require('amqplib');
const config = require('../config');

const EXCHANGE = 'spendwise.events';
const DLX = 'spendwise.dlx';
const QUEUE = 'budget.purchase-order-events';
const RETRY_QUEUE = `${QUEUE}.retry`;
const DLQ = `${QUEUE}.dlq`;
const BINDINGS = ['purchase-order.approved', 'purchase-order.rejected', 'purchase-order.cancelled'];

let connection = null;
let channel = null;
let handler = null;
const state = { connected: false, consumed: 0, retried: 0, deadLettered: 0, lastError: null };

async function setupTopology(ch) {
  await ch.assertExchange(EXCHANGE, 'topic', { durable: true });
  await ch.assertExchange(DLX, 'topic', { durable: true });
  await ch.assertQueue(QUEUE, {
    durable: true,
    arguments: { 'x-dead-letter-exchange': DLX, 'x-dead-letter-routing-key': DLQ },
  });
  for (const key of BINDINGS) await ch.bindQueue(QUEUE, EXCHANGE, key);
  await ch.assertQueue(DLQ, { durable: true });
  await ch.bindQueue(DLQ, DLX, DLQ);
  // Messages wait here (per-message TTL) then dead-letter back to the main queue.
  await ch.assertQueue(RETRY_QUEUE, {
    durable: true,
    arguments: { 'x-dead-letter-exchange': '', 'x-dead-letter-routing-key': QUEUE },
  });
}

async function onMessage(msg) {
  if (!msg) return;
  const headers = msg.properties.headers || {};
  const retries = Number(headers['x-retry-count'] || 0);
  try {
    const event = JSON.parse(msg.content.toString());
    const result = await handler(event);
    state.consumed += 1;
    console.log(`[rabbit] ${event.eventType} ${event.purchaseOrderId} -> ${result}`);
    channel.ack(msg);
  } catch (err) {
    state.lastError = err.message;
    if (err instanceof SyntaxError || retries >= config.maxRetries) {
      state.deadLettered += 1;
      console.error(`[rabbit] dead-lettering message after ${retries} retries: ${err.message}`);
      channel.nack(msg, false, false); // -> DLX -> DLQ
      return;
    }
    const delay = config.retryBaseDelayMs * 2 ** retries; // exponential backoff
    state.retried += 1;
    channel.sendToQueue(RETRY_QUEUE, msg.content, {
      persistent: true,
      contentType: 'application/json',
      messageId: msg.properties.messageId,
      expiration: String(delay),
      headers: { ...headers, 'x-retry-count': retries + 1 },
    });
    channel.ack(msg);
  }
}

async function connect(onEvent) {
  handler = onEvent;
  try {
    connection = await amqp.connect(config.rabbitUrl);
    connection.on('error', (e) => { state.lastError = e.message; });
    connection.on('close', () => {
      state.connected = false;
      channel = null;
      console.warn('[rabbit] connection closed, reconnecting in 5s');
      setTimeout(() => connect(handler), 5000);
    });
    channel = await connection.createConfirmChannel();
    await setupTopology(channel);
    await channel.prefetch(10);
    await channel.consume(QUEUE, onMessage, { noAck: false });
    state.connected = true;
    console.log('[rabbit] connected and consuming', QUEUE);
  } catch (err) {
    state.connected = false;
    state.lastError = err.message;
    console.warn(`[rabbit] connect failed (${err.message}), retrying in 5s`);
    setTimeout(() => connect(handler), 5000);
  }
}

/** Best-effort publish (alerts are also persisted in budget_alerts). */
function publish(routingKey, payload) {
  if (!channel) {
    console.warn(`[rabbit] not connected, skipped publish ${routingKey}`);
    return;
  }
  channel.publish(EXCHANGE, routingKey, Buffer.from(JSON.stringify(payload)), {
    persistent: true,
    contentType: 'application/json',
    messageId: payload.eventId,
    type: payload.eventType,
  });
}

async function close() {
  if (connection) {
    connection.removeAllListeners('close');
    await connection.close().catch(() => {});
  }
}

module.exports = { connect, publish, close, state };
