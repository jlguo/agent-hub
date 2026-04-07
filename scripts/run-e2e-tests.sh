#!/bin/bash
# E2E Test Runner with Isolated Docker Containers
# 
# This script:
# 1. Starts isolated test containers (backend-test + frontend-test)
# 2. Waits for containers to be healthy
# 3. Runs E2E tests against test environment
# 4. Cleans up test containers
# 5. Preserves dev database and containers

set -e

echo "🚀 Starting E2E Tests with Isolated Containers"
echo "=============================================="

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
TEST_COMPOSE="docker-compose.test.yml"
TEST_TIMEOUT=90000
TEST_RETRIES=2

# Trap to ensure cleanup on exit
cleanup() {
    echo -e "\n${YELLOW}Cleaning up test containers...${NC}"
    docker-compose -f "$TEST_COMPOSE" down --remove-orphans 2>/dev/null || true
    echo -e "${GREEN}✅ Cleanup complete${NC}"
}

trap cleanup EXIT

echo -e "\n${BLUE}Step 1: Stopping any existing test containers...${NC}"
docker-compose -f "$TEST_COMPOSE" down --remove-orphans 2>/dev/null || true

echo -e "\n${YELLOW}Step 2: Building test containers...${NC}"
echo "This may take a few minutes on first run..."
docker-compose -f "$TEST_COMPOSE" build

echo -e "\n${YELLOW}Step 3: Starting test containers...${NC}"
docker-compose -f "$TEST_COMPOSE" up -d

echo -e "\n${YELLOW}Step 4: Waiting for containers to be healthy...${NC}"
echo "Backend (port 4001):"
MAX_ATTEMPTS=30
ATTEMPT=0

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    if docker-compose -f "$TEST_COMPOSE" ps | grep -q "backend-test.*healthy"; then
        echo -e "${GREEN}✅ Backend is healthy${NC}"
        break
    fi
    echo -n "."
    sleep 2
    ATTEMPT=$((ATTEMPT + 1))
done

if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
    echo -e "\n${RED}❌ Backend failed to become healthy${NC}"
    echo -e "${YELLOW}Checking logs...${NC}"
    docker-compose -f "$TEST_COMPOSE" logs backend-test
    exit 1
fi

echo -e "\n${BLUE}Backend: Waiting for frontend...${NC}"
ATTEMPT=0
while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    if docker-compose -f "$TEST_COMPOSE" ps | grep -q "frontend-test.*healthy"; then
        echo -e "${GREEN}✅ Frontend is healthy${NC}"
        break
    fi
    echo -n "."
    sleep 2
    ATTEMPT=$((ATTEMPT + 1))
done

if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
    echo -e "\n${RED}❌ Frontend failed to become healthy${NC}"
    echo -e "${YELLOW}Checking logs...${NC}"
    docker-compose -f "$TEST_COMPOSE" logs frontend-test
    exit 1
fi

echo -e "\n${GREEN}✅ Test environment ready${NC}"
echo -e "${BLUE}Backend: http://localhost:4001${NC}"
echo -e "${BLUE}Frontend: http://localhost:3001${NC}"

echo -e "\n${YELLOW}Step 5: Running E2E tests...${NC}"
echo "=============================================="

# Set test environment variables
export PLAYWRIGHT_TEST_BASE_URL="http://localhost:3001"

# Run Playwright tests
npx playwright test tests/e2e/ \
  --reporter=list \
  --timeout=$TEST_TIMEOUT \
  --retries=$TEST_RETRIES

TEST_EXIT_CODE=$?

echo -e "\n=============================================="
if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}🎉 All E2E tests passed!${NC}"
else
    echo -e "${RED}❌ Some E2E tests failed${NC}"
    echo -e "${YELLOW}Check test-results/ directory for details${NC}"
    echo -e "${YELLOW}Test containers are still running for debugging${NC}"
    echo -e "${YELLOW}To view logs: docker-compose -f $TEST_COMPOSE logs${NC}"
    echo -e "${YELLOW}To stop: docker-compose -f $TEST_COMPOSE down${NC}"
fi
echo "=============================================="

# Cleanup is handled by trap
exit $TEST_EXIT_CODE
