# SpendWise Project - Startup & Logging Instructions

## 🚀 Project Status

**Current Status:** Docker Compose is starting up in background  
**Log File:** `spendwise-startup.log`  
**Command Running:** `docker-compose up --build`

---

## 📊 Real-time Monitoring Commands

### Follow the Startup Process

```bash
# Watch startup logs in real-time
tail -f /Users/i578394/Desktop/SpendWise/spendwise-startup.log

# Or use docker-compose directly
cd /Users/i578394/Desktop/SpendWise
docker-compose logs -f

# Watch specific service startup
docker-compose logs -f purchase-order-db
```

### Check Current Status

```bash
# See all running containers
docker-compose ps

# Get detailed status
docker-compose ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Check container health
docker ps --format "table {{.Names}}\t{{.State}}\t{{.Status}}"
```

---

## 🔍 Service Startup Timeline

The services start in this order:

1. **Databases** (PostgreSQL, MySQL, MongoDB)
   - Supplier DB: PostgreSQL 16
   - Budget DB: PostgreSQL 16
   - Purchase Order DB: MySQL 8.4
   - Analytics DB: MongoDB 7
   - **Status:** Waiting for health checks (5-30 seconds each)

2. **Message Queue** (RabbitMQ)
   - **Status:** Waits for database readiness
   - **Port:** 5672 (AMQP), 15672 (Management UI)

3. **Microservices** (depends on databases)
   - Supplier Service (Node.js)
   - Budget Service (Node.js)
   - Purchase Order Service (Java/Spring Boot)
   - Spend Analytics Service (Python/FastAPI)

4. **Frontend & Gateway**
   - Frontend (React)
   - Nginx Gateway
   - **Estimated Total Time:** 5-15 minutes

---

## 📱 Real-time Log Monitoring

### In a New Terminal Tab

```bash
cd /Users/i578394/Desktop/SpendWise

# Option 1: Watch all logs
docker-compose logs -f

# Option 2: Watch specific service
docker-compose logs -f supplier-service
docker-compose logs -f budget-service
docker-compose logs -f purchase-order-service
docker-compose logs -f spend-analytics-service
docker-compose logs -f frontend

# Option 3: Filter for errors only
docker-compose logs | grep -i error

# Option 4: Get last 50 lines for each service
docker-compose logs --tail=50
```

### Using the Monitoring Script

```bash
# Make sure it's executable
chmod +x /Users/i578394/Desktop/SpendWise/monitor-logs.sh

# Run the interactive monitoring menu
./monitor-logs.sh
```

---

## 🎯 What to Look For During Startup

### ✅ Successful Startup Signs

```
Database Logs:
✅ "ready to accept connections"
✅ "mysql ready" or similar

RabbitMQ Logs:
✅ "Starting RabbitMQ"
✅ "Successfully started RabbitMQ"

Service Logs:
✅ "listening on port 3000" (Node.js)
✅ "Started PurchaseOrderApplication" (Java)
✅ "Application startup complete" (FastAPI)

Frontend:
✅ "ready in XXX ms"
✅ "VITE v... ready in ... ms"
```

### ⚠️ Warning Signs to Watch

```
❌ Port already in use (3000, 3001, 3002, 5000, 8080, etc.)
❌ Connection refused (check if services are running)
❌ Database connection errors (check DB credentials)
❌ RabbitMQ connection errors
❌ Memory/disk space issues
```

---

## 🔗 Access Your Services Once Running

### Web Interfaces

| Service | URL | Username | Password |
|---------|-----|----------|----------|
| **Frontend Dashboard** | http://localhost:3000 | - | - |
| **API Gateway** | http://localhost/api | - | - |
| **RabbitMQ Console** | http://localhost:15672 | spendwise | spendwise_pass |

### API Endpoints

```bash
# Test API Gateway
curl http://localhost/api

# Test individual services
curl http://localhost/api/suppliers
curl http://localhost/api/budgets
curl http://localhost/api/purchase-orders
curl http://localhost/api/analytics
```

### Database Connections

```bash
# PostgreSQL (Supplier/Budget DBs)
psql -h localhost -U supplier_user -d supplier_db
psql -h localhost -U budget_user -d budget_db

# MySQL (Purchase Order DB)
mysql -h localhost -u po_user -p po_pass purchase_order_db

# MongoDB (Analytics DB)
mongosh "mongodb://analytics_user:analytics_pass@localhost:27017/analytics_db"
```

---

## 📋 Useful Docker Commands

### View Logs

```bash
# All logs (follow mode)
docker-compose logs -f

# Specific service with timestamps
docker-compose logs --timestamps supplier-service

# Last N lines
docker-compose logs --tail=100

# Save to file
docker-compose logs > my-logs.txt
```

### Manage Services

```bash
# Restart a service
docker-compose restart supplier-service

# Stop everything
docker-compose down

# Stop and remove volumes
docker-compose down -v

# View service configuration
docker-compose config

# Validate docker-compose.yml
docker-compose validate
```

### Debug Services

```bash
# Execute command in running container
docker-compose exec supplier-service sh

# Check environment variables
docker-compose exec supplier-service env

# View container inspect details
docker inspect spendwise-supplier-service

# Check resource usage
docker stats
```

---

## 🚨 Troubleshooting Common Issues

### Services Not Starting

**Problem:** Services starting but not becoming healthy

**Solution:**
```bash
# Check logs for errors
docker-compose logs purchase-order-service

# Check if ports are available
lsof -i :3000
lsof -i :8080

# Check resource limits
docker stats
```

### Port Already in Use

**Problem:** `Port 3000 already in use`

**Solution:**
```bash
# Find process using port
lsof -i :3000

# Kill the process
kill -9 <PID>

# Or use different project name
docker-compose -p spendwise2 up --build
```

### Database Connection Errors

**Problem:** Services can't connect to databases

**Solution:**
```bash
# Check database logs
docker-compose logs purchase-order-db

# Verify database is healthy
docker-compose ps purchase-order-db

# Check database credentials
grep MYSQL_PASSWORD docker-compose.yml
grep POSTGRES_PASSWORD docker-compose.yml
```

### Out of Disk Space

**Problem:** Docker builds failing with "no space left"

**Solution:**
```bash
# Check Docker disk usage
docker system df

# Clean up unused images/volumes
docker system prune -a

# Remove old logs
docker-compose logs -f > logs-$(date +%s).txt
```

---

## 📝 Logging Best Practices

### Save Logs for Later Analysis

```bash
# Save timestamped logs
timestamp=$(date +%Y%m%d_%H%M%S)
docker-compose logs --timestamps > spendwise_logs_$timestamp.txt

# Save JSON logs (useful for parsing)
docker-compose logs > spendwise_logs.json

# Log specific time range
docker-compose logs --since 2026-11-17T08:00:00 > logs_morning.txt
```

### Monitor Specific Errors

```bash
# Watch for database errors
docker-compose logs -f | grep -i "error\|failed\|connection"

# Watch for performance issues
docker-compose logs -f | grep -i "timeout\|slow\|warn"

# Watch for startup issues
docker-compose logs -f | grep -i "port\|listening\|started"
```

### Check Service Readiness

```bash
#!/bin/bash
# Wait for services to be ready

echo "Checking service health..."

for service in supplier-service budget-service purchase-order-service; do
    echo -n "Waiting for $service..."
    while ! docker-compose logs "$service" | grep -q "ready\|started\|listening"; do
        sleep 2
        echo -n "."
    done
    echo " ✓"
done

echo "All services ready!"
```

---

## 🎨 Visual Log Monitoring

### Pretty-print logs with colors

```bash
# Using ccze (if installed)
docker-compose logs -f | ccze -A

# Using bat (if installed)
docker-compose logs | bat --file-name docker-compose.log

# Using less with color support
docker-compose logs | less -R
```

---

## 📊 Expected Startup Sequence

```
Timeline (minutes)  | Activity
0-1                | Pulling Docker images
1-2                | Starting databases
2-5                | Database health checks passing
5-7                | Starting RabbitMQ
7-10               | Services connecting to RabbitMQ
10-12              | Frontend & Gateway initialization
12-15              | All services healthy and ready

Expected Total Time: 12-15 minutes
```

---

## ✅ Post-Startup Checklist

Once services are running, verify:

```bash
# 1. Check all containers running
docker-compose ps

# 2. Test API connectivity
curl http://localhost/api

# 3. Access frontend
curl http://localhost:3000

# 4. Check RabbitMQ
curl -u spendwise:spendwise_pass http://localhost:15672/api/overview

# 5. Verify all services responding
for endpoint in suppliers budgets purchase-orders analytics; do
    echo "Testing /api/$endpoint..."
    curl -s http://localhost/api/$endpoint | head -c 100
    echo
done
```

---

## 📞 Quick Reference

```bash
# Start the project
cd /Users/i578394/Desktop/SpendWise
docker-compose up --build

# View logs in real-time
docker-compose logs -f

# Check status
docker-compose ps

# Stop the project
docker-compose down

# Full cleanup and restart
docker-compose down -v
docker-compose up --build
```

---

**Last Updated:** November 17, 2026  
**Status:** Starting up services...  
**Estimated Ready Time:** 12-15 minutes

## 🎯 Next Steps

1. **Wait for startup** (watch `docker-compose logs -f` in another terminal)
2. **Verify all services** running with `docker-compose ps`
3. **Access dashboard** at http://localhost:3000
4. **Test APIs** using provided curl commands
5. **Monitor logs** with provided monitoring tools

