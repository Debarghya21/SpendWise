# ---------- Build React assets
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# ---------- Serve with NGINX (proxies /api to the API Gateway)
FROM nginx:1.27-alpine
ENV NGINX_RESOLVER=127.0.0.11 \
    GATEWAY_UPSTREAM=api-gateway:8080
RUN rm -f /etc/nginx/conf.d/default.conf
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
