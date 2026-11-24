FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY budget-service/package*.json ./
RUN npm install --omit=dev && npm cache clean --force

COPY budget-service/src ./src

# Copy shared proto definitions for gRPC
COPY proto ./proto

USER node
EXPOSE 3004 50052
CMD ["node", "src/server.js"]
