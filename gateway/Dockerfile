FROM nginx:1.27-alpine

# Defaults for Docker Compose; Kubernetes overrides them through the ConfigMap.
ENV NGINX_RESOLVER=127.0.0.11 \
    SUPPLIER_UPSTREAM=supplier-service:3001 \
    PURCHASE_ORDER_UPSTREAM=purchase-order-service:8082 \
    BUDGET_UPSTREAM=budget-service:3004 \
    ANALYTICS_UPSTREAM=spend-analytics-service:8000

RUN rm -f /etc/nginx/conf.d/default.conf
COPY default.conf.template /etc/nginx/templates/default.conf.template

EXPOSE 8080
