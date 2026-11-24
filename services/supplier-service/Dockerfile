FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY supplier-service/package*.json ./
RUN npm install --omit=dev && npm cache clean --force

COPY supplier-service/src ./src

# Copy shared proto definitions for gRPC
COPY proto ./proto

USER node
EXPOSE 3001 50051
CMD ["node", "src/server.js"]
