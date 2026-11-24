#!/bin/bash

# SpendWise Project - Log Viewer & Monitor
# Real-time service monitoring and log display

set -e

PROJECT_ROOT="/Users/i578394/Desktop/SpendWise"
cd "$PROJECT_ROOT"

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Functions
show_menu() {
    clear
    echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║   SpendWise Project - Monitoring & Logging Console    ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}\n"
    
    echo -e "${CYAN}📊 Services Status:${NC}"
    docker-compose ps --format "table {{.Names}}\t{{.Status}}" 2>/dev/null || echo "Services not started yet"
    
    echo -e "\n${CYAN}📋 Available Commands:${NC}\n"
    echo -e "${GREEN}1${NC}  - View all logs (follow mode)"
    echo -e "${GREEN}2${NC}  - View supplier-service logs"
    echo -e "${GREEN}3${NC}  - View budget-service logs"
    echo -e "${GREEN}4${NC}  - View purchase-order-service logs"
    echo -e "${GREEN}5${NC}  - View spend-analytics-service logs"
    echo -e "${GREEN}6${NC}  - View frontend logs"
    echo -e "${GREEN}7${NC}  - View gateway (Nginx) logs"
    echo -e "${GREEN}8${NC}  - View database logs (supplier-db)"
    echo -e "${GREEN}9${NC}  - View RabbitMQ logs"
    echo -e "${GREEN}10${NC} - Check service health status"
    echo -e "${GREEN}11${NC} - View container resource usage"
    echo -e "${GREEN}12${NC} - Save all logs to file"
    echo -e "${GREEN}0${NC}  - Exit\n"
    echo -e "${YELLOW}Enter choice (0-12):${NC} "
}

view_all_logs() {
    clear
    echo -e "${YELLOW}📖 Following all container logs (Ctrl+C to exit)${NC}\n"
    docker-compose logs -f
}

view_service_logs() {
    local service=$1
    clear
    echo -e "${YELLOW}📖 Following logs for: $service (Ctrl+C to exit)${NC}\n"
    docker-compose logs -f "$service"
}

check_health() {
    clear
    echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║   Service Health Status                               ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}\n"
    
    docker-compose ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    
    echo -e "\n${CYAN}🔍 Health Check Details:${NC}\n"
    
    # Check services
    for service in supplier-service budget-service purchase-order-service spend-analytics-service; do
        if docker-compose ps "$service" 2>/dev/null | grep -q "healthy"; then
            echo -e "${GREEN}✅${NC} $service - Healthy"
        elif docker-compose ps "$service" 2>/dev/null | grep -q "starting"; then
            echo -e "${YELLOW}⏳${NC} $service - Starting"
        elif docker-compose ps "$service" 2>/dev/null | grep -q "Up"; then
            echo -e "${CYAN}🔄${NC} $service - Running (checking health...)"
        else
            echo -e "${RED}❌${NC} $service - Not running"
        fi
    done
    
    echo -e "\n${CYAN}🌐 Testing API Endpoints:${NC}\n"
    
    # Test endpoints
    echo -n "Gateway (http://localhost/api): "
    if curl -s http://localhost/api > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Responding${NC}"
    else
        echo -e "${YELLOW}⏳ Not ready${NC}"
    fi
    
    echo -n "Frontend (http://localhost:3000): "
    if curl -s http://localhost:3000 > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Responding${NC}"
    else
        echo -e "${YELLOW}⏳ Not ready${NC}"
    fi
    
    echo -n "RabbitMQ (http://localhost:15672): "
    if curl -s http://localhost:15672 > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Responding${NC}"
    else
        echo -e "${YELLOW}⏳ Not ready${NC}"
    fi
    
    echo -e "\n${CYAN}Press Enter to return to menu...${NC}"
    read -r
}

view_resources() {
    clear
    echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║   Container Resource Usage                            ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}\n"
    
    docker stats --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}"
}

save_logs() {
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local logfile="spendwise_logs_${timestamp}.txt"
    
    clear
    echo -e "${YELLOW}💾 Saving logs to: $logfile${NC}\n"
    
    {
        echo "SpendWise Project - Log Dump"
        echo "Generated: $(date)"
        echo "================================"
        echo ""
        echo "=== Docker Compose Status ==="
        docker-compose ps
        echo ""
        echo "=== Container Logs ==="
        docker-compose logs --timestamps
    } > "$logfile"
    
    echo -e "${GREEN}✅ Logs saved to: $logfile${NC}"
    echo -e "${CYAN}File size: $(du -h "$logfile" | cut -f1)${NC}"
    echo -e "\n${CYAN}Press Enter to return to menu...${NC}"
    read -r
}

# Main loop
while true; do
    show_menu
    read -r choice
    
    case $choice in
        1)
            view_all_logs
            ;;
        2)
            view_service_logs "supplier-service"
            ;;
        3)
            view_service_logs "budget-service"
            ;;
        4)
            view_service_logs "purchase-order-service"
            ;;
        5)
            view_service_logs "spend-analytics-service"
            ;;
        6)
            view_service_logs "frontend"
            ;;
        7)
            view_service_logs "gateway"
            ;;
        8)
            view_service_logs "supplier-db"
            ;;
        9)
            view_service_logs "rabbitmq"
            ;;
        10)
            check_health
            ;;
        11)
            view_resources
            ;;
        12)
            save_logs
            ;;
        0)
            echo -e "${CYAN}Goodbye!${NC}"
            exit 0
            ;;
        *)
            echo -e "${RED}Invalid choice. Press Enter to try again...${NC}"
            read -r
            ;;
    esac
done
