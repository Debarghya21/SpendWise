# SpendWise Project - Complete Setup & Monitoring Guide

## 🎉 Project Running!

Your SpendWise application is currently starting up with Docker Compose.

**Status:** Pulling Docker images and initializing services  
**Process:** Running in background  
**Log Location:** `spendwise-startup.log`

---

## 📊 Current Status & Logs

### View Real-time Logs

Open a **new terminal** and run:

```bash
cd /Users/i578394/Desktop/SpendWise

# Option 1: Watch the startup log file
tail -f spendwise-startup.log

# Option 2: Use docker-compose (once services start)
docker-compose logs -f

# Option 3: Use interactive monitoring script
./monitor-logs.sh
```

### Expected Startup Timeline

| Phase | Duration | Activity |
|-------|----------|----------|
| **Image Download** | 2-3 min | Pulling Docker images (MySQL, PostgreSQL, MongoDB, Node, Java, Python, etc.) |
| **Container Init** | 1-2 min | Creating containers for all 11 services |
| **Database Start** | 2-5 min | PostgreSQL, MySQL, MongoDB initializing and health checks |
| **RabbitMQ Start** | 1-2 min | Message queue initialization |
| **Service Deploy** | 2-5 min | Node.js, Java, Python services connecting to databases |
| **Frontend Build** | 2-3 min | Vite building React frontend |
| **System Ready** | - | **Total: 12-20 minutes** |

---

## 🔗 Access Your Services (Once Ready)

### Web Interfaces

```
Frontend Dashboard:    http://localhost:3000
API Gateway:           http://localhost/api
RabbitMQ Console:      http://localhost:15672
```

### API Endpoints

```bash
# Test API Gateway
curl http://localhost/api

# Supplier Service
curl http://localhost/api/suppliers

# Budget Service
curl http://localhost/api/budgets

# Purchase Orders
curl http://localhost/api/purchase-orders

# Analytics
curl http://localhost/api/analytics

# Health Check
curl http://localhost/api/health
```

### Credentials

```
RabbitMQ Username:  spendwise
RabbitMQ Password:  spendwise_pass
```

---

## 🔍 Services Overview

### Databases (Port 5432, 3306, 27017)
| Database | Type | Username | Password |
|----------|------|----------|----------|
| supplier-db | PostgreSQL 16 | supplier_user | supplier_pass |
| budget-db | PostgreSQL 16 | budget_user | budget_pass |
| purchase-order-db | MySQL 8.4 | po_user | po_pass |
| analytics-db | MongoDB 7 | analytics_user | analytics_pass |

### Microservices (Ports 3001, 3002, 5000, 8080)
| Service | Framework | Port | Purpose |
|---------|-----------|------|---------|
| supplier-service | Node.js | 3001 | Supplier management |
| budget-service | Node.js | 3002 | Budget allocation & tracking |
| purchase-order-service | Java/Spring Boot | 8080 | Purchase order processing |
| spend-analytics-service | Python/FastAPI | 5000 | Spend analysis |

### Frontend & Infrastructure (Ports 3000, 80, 5672)
| Service | Framework | Port | Purpose |
|---------|-----------|------|---------|
| frontend | React/Vite | 3000 | Web UI Dashboard |
| gateway | Nginx | 80, 443 | API Gateway & Load Balancer |
| rabbitmq | Message Queue | 5672, 15672 | Event messaging |

---

## 📋 Docker Compose Commands

### Monitor Services

```bash
# Check all running containers
docker-compose ps

# Check specific service status
docker-compose ps supplier-service

# View detailed container info
docker-compose ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# View real-time logs
docker-compose logs -f

# View logs for specific service
docker-compose logs -f supplier-service
docker-compose logs -f budget-service
docker-compose logs -f purchase-order-service
docker-compose logs -f spend-analytics-service
docker-compose logs -f frontend
docker-compose logs -f gateway
docker-compose logs -f rabbitmq
```

### Manage Services

```bash
# Restart a service
docker-compose restart supplier-service

# Stop a service
docker-compose stop supplier-service

# Start a stopped service
docker-compose start supplier-service

# View service logs (last 100 lines)
docker-compose logs --tail=100 supplier-service

# View logs with timestamps
docker-compose logs --timestamps supplier-service

# Save logs to file
docker-compose logs > my-logs.txt

# Stop all services
docker-compose down

# Stop and remove data
docker-compose down -v

# Stop and remove all data/images/orphans
docker-compose down -v --remove-orphans
```

---

## 🛠️ Debugging & Troubleshooting

### Check Service Health

```bash
# View health status of all containers
docker-compose ps

# Check specific container's health
docker inspect spendwise-supplier-service | grep -A 10 "Health"

# View container resource usage
docker stats

# Check if ports are open
lsof -i :3000
lsof -i :8080
lsof -i :5000
```

### View Service Logs

```bash
# All logs (follow mode)
docker-compose logs -f

# Errors only
docker-compose logs | grep -i error

# Warnings and errors
docker-compose logs | grep -i "warn\|error"

# Last 50 lines
docker-compose logs --tail=50

# Logs from last 5 minutes
docker-compose logs --since 5m
```

### Database Access

```bash
# PostgreSQL (Supplier/Budget DBs)
docker-compose exec supplier-db psql -U supplier_user -d supplier_db

# MySQL (Purchase Order DB)
docker-compose exec purchase-order-db mysql -u po_user -p purchase_order_db
# Password: po_pass

# MongoDB (Analytics DB)
docker-compose exec analytics-db mongosh -u analytics_user -p analytics_pass

# Redis (if applicable)
docker-compose exec redis redis-cli
```

### Network & Connectivity

```bash
# Check Docker network
docker network ls
docker network inspect spendwise-net

# Test service connectivity
docker-compose exec supplier-service curl http://budget-service:3002/api/health

# Check DNS resolution
docker-compose exec supplier-service nslookup budget-service
```

---

## 📊 Monitoring & Performance

### Real-time Resource Monitoring

```bash
# Watch container stats
docker stats

# Memory usage
docker stats --format "table {{.Container}}\t{{.MemUsage}}\t{{.MemPerc}}"

# CPU usage
docker stats --format "table {{.Container}}\t{{.CPUPerc}}"

# Network I/O
docker stats --format "table {{.Container}}\t{{.NetIO}}"
```

### Check Disk Space

```bash
# Docker system disk usage
docker system df

# Total disk usage
df -h

# Remove unused images/volumes
docker system prune -a

# Clean up old logs
rm spendwise-startup.log
```

---

## 🚨 Common Issues & Solutions

### Services Not Starting

**Problem:** Container is running but service isn't ready

**Solution:**
```bash
# Check service logs for errors
docker-compose logs purchase-order-service

# Wait for database to be healthy first
docker-compose logs purchase-order-db | grep "ready"

# Check if ports are available
lsof -i :8080
```

### Port Already in Use

**Problem:** `Error: port 3000 already in use`

**Solution:**
```bash
# Find process using the port
lsof -i :3000

# Kill the process
kill -9 <PID>

# Or use a different port in docker-compose.yml
```

### Database Connection Errors

**Problem:** Services can't connect to databases

**Solution:**
```bash
# Check if database is running
docker-compose ps | grep db

# Check database logs
docker-compose logs purchase-order-db

# Verify network connectivity
docker network inspect spendwise-net

# Check credentials in docker-compose.yml
```

### Out of Memory

**Problem:** Services crashing with OOM errors

**Solution:**
```bash
# Check current resource usage
docker stats

# Increase Docker memory limit (in Docker Desktop settings)
# Then restart:
docker-compose restart

# Or rebuild with fresh images:
docker system prune -a
docker-compose up --build
```

---

## 📝 Log Collection & Analysis

### Save All Logs

```bash
# Create logs directory
mkdir -p logs

# Save dated logs
timestamp=$(date +%Y%m%d_%H%M%S)
docker-compose logs > logs/spendwise_$timestamp.txt

# Save with timestamps
docker-compose logs --timestamps > logs/spendwise_timestamped_$timestamp.txt

# Archive logs
tar -czf logs/spendwise_logs_$timestamp.tar.gz logs/
```

### Filter Logs

```bash
# Errors and warnings
docker-compose logs | grep -E "ERROR|WARN|Exception"

# Database errors
docker-compose logs | grep -i "database\|connection\|failed"

# Performance issues
docker-compose logs | grep -i "timeout\|slow\|performance"

# API errors
docker-compose logs | grep -E "4[0-9]{2}|5[0-9]{2}"

# Specific time range
docker-compose logs --since 2026-11-17T08:00:00 --until 2026-11-17T09:00:00
```

### Export Logs for Analysis

```bash
# JSON format
docker-compose logs --format json > logs.json

# CSV format
docker-compose logs | awk '{print NR, $0}' > logs.csv

# Parse and extract specific fields
docker-compose logs | grep "ERROR" | cut -d' ' -f1-10 > errors.log
```

---

## ✅ Post-Startup Verification

Once services are running, verify everything works:

```bash
#!/bin/bash
# Quick health check script

echo "🔍 Checking SpendWise services..."
echo ""

# Check all containers running
echo "📦 Checking containers:"
docker-compose ps --format "table {{.Names}}\t{{.Status}}"
echo ""

# Test API endpoints
echo "🌐 Testing API endpoints:"
for endpoint in "" "suppliers" "budgets" "purchase-orders" "analytics"; do
    echo -n "  /api/$endpoint: "
    if curl -s http://localhost/api/$endpoint > /dev/null 2>&1; then
        echo "✅ OK"
    else
        echo "❌ Failed"
    fi
done
echo ""

# Check frontend
echo -n "🎨 Frontend (http://localhost:3000): "
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo "✅ OK"
else
    echo "❌ Failed"
fi
echo ""

# Check RabbitMQ
echo -n "📮 RabbitMQ (http://localhost:15672): "
if curl -s -u spendwise:spendwise_pass http://localhost:15672/api/overview > /dev/null 2>&1; then
    echo "✅ OK"
else
    echo "❌ Failed"
fi

echo ""
echo "✅ Health check complete!"
```

---

## 🎯 Next Steps

1. **Wait for startup** (15-20 minutes)
   - Monitor with: `tail -f spendwise-startup.log`
   - Or: `docker-compose logs -f`

2. **Verify all services**
   - Run: `docker-compose ps`
   - Should show all services with status "Up"

3. **Access dashboard**
   - Open: http://localhost:3000
   - You should see the SpendWise dashboard

4. **Test APIs**
   - Use the curl commands provided above
   - Or import API collection into Postman

5. **Monitor logs**
   - Use `./monitor-logs.sh` for interactive monitoring
   - Or `docker-compose logs -f` for continuous logs

---

## 📞 Quick Reference Commands

```bash
# Start project (if not already running)
cd /Users/i578394/Desktop/SpendWise
docker-compose up --build

# View logs
docker-compose logs -f

# Check status
docker-compose ps

# Interactive monitoring
./monitor-logs.sh

# Stop project
docker-compose down

# Stop and remove data
docker-compose down -v
```

---

## 📖 Documentation Files

| File | Purpose |
|------|---------|
| `RUNNING_GUIDE.md` | Comprehensive running & logging guide |
| `STARTUP_LOG_GUIDE.md` | Startup process & log monitoring |
| `TESTING_GUIDE.md` | Running project tests |
| `TEST_REPORT.md` | Test execution results |
| `IMPLEMENTATION_SUMMARY.md` | Project features & implementation |
| `run-all-tests.sh` | Automated test runner |
| `monitor-logs.sh` | Interactive log monitoring tool |

---

**Last Updated:** November 17, 2026  
**Status:** Docker Compose starting up  
**Estimated Ready Time:** 15-20 minutes

