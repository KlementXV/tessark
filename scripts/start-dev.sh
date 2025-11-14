#!/bin/bash

# Script to start the tessark development environment
# This starts both the backend (Rust) and frontend (Next.js)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$PROJECT_ROOT/app/backend"
FRONTEND_DIR="$PROJECT_ROOT/app/frontend"

echo "Starting tessark development environment..."
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if backend is already running
echo "Checking if backend is already running on port 8080..."
if lsof -i :8080 >/dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Backend is already running on port 8080${NC}"
else
    echo -e "${GREEN}✓ Starting backend on port 8080...${NC}"
    cd "$BACKEND_DIR"
    cargo run &
    BACKEND_PID=$!
    echo "Backend PID: $BACKEND_PID"
    # Wait for backend to be ready
    echo "Waiting for backend to be ready..."
    for i in {1..10}; do
        if curl -s http://localhost:8080/health >/dev/null 2>&1; then
            echo -e "${GREEN}✓ Backend is ready${NC}"
            break
        fi
        if [ $i -eq 10 ]; then
            echo -e "${RED}✗ Backend failed to start${NC}"
            exit 1
        fi
        sleep 1
    done
fi

echo ""

# Check if frontend is already running
echo "Checking if frontend is already running on port 3000..."
if lsof -i :3000 >/dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Frontend is already running on port 3000${NC}"
else
    echo -e "${GREEN}✓ Starting frontend on port 3000...${NC}"
    cd "$FRONTEND_DIR"
    npm run dev &
    FRONTEND_PID=$!
    echo "Frontend PID: $FRONTEND_PID"
fi

echo ""
echo -e "${GREEN}✓ tessark development environment is ready!${NC}"
echo ""
echo "Services:"
echo "  Backend:  http://localhost:8080"
echo "  Frontend: http://localhost:3000"
echo "  API:      http://localhost:3000/api"
echo ""
echo "Press Ctrl+C to stop services"

# Keep script running
wait
