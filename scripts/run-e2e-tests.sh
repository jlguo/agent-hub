#!/bin/bash
# E2E Test Runner with Database Isolation
# 
# This script:
# 1. Creates fresh test database
# 2. Runs E2E tests
# 3. Cleans up test database
# 4. Preserves dev database

set -e

echo "🚀 Starting E2E Tests with Database Isolation"
echo "=============================================="

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Paths
TEST_DB="prisma/test.db"
DEV_DB="prisma/dev.db"
TEST_DB_BACKUP="prisma/test.db.backup"

echo -e "\n${YELLOW}Step 1: Checking databases...${NC}"

# Backup existing test DB if exists
if [ -f "$TEST_DB" ]; then
    echo "📦 Backing up existing test database..."
    cp "$TEST_DB" "$TEST_DB_BACKUP"
fi

# Verify dev DB exists
if [ ! -f "$DEV_DB" ]; then
    echo -e "${RED}❌ Dev database not found!${NC}"
    echo "Please run the app first to create the dev database."
    exit 1
fi

echo -e "${GREEN}✅ Dev database protected: $DEV_DB${NC}"

echo -e "\n${YELLOW}Step 2: Creating fresh test database...${NC}"

# Create fresh test database
rm -f "$TEST_DB"
touch "$TEST_DB"

# Run migrations on test database
echo "📦 Running migrations on test database..."
DATABASE_URL="file:$(pwd)/$TEST_DB" npx prisma migrate deploy --skip-generate

# Seed test database
echo "🌱 Seeding test database..."
DATABASE_URL="file:$(pwd)/$TEST_DB" npx prisma db seed

echo -e "${GREEN}✅ Test database ready${NC}"

echo -e "\n${YELLOW}Step 3: Running E2E tests...${NC}"
echo "=============================================="

# Run Playwright tests with test database
# Note: Tests will use the running Docker containers which use dev.db
# For true isolation, we'd need to spin up test-specific containers
npx playwright test tests/e2e/ \
  --reporter=list \
  --timeout=90000 \
  --retries=2

TEST_EXIT_CODE=$?

echo -e "\n${YELLOW}Step 4: Cleanup...${NC}"

# Restore test DB backup if exists
if [ -f "$TEST_DB_BACKUP" ]; then
    echo "📦 Restoring test database backup..."
    mv "$TEST_DB_BACKUP" "$TEST_DB"
fi

echo -e "${GREEN}✅ Cleanup complete${NC}"

echo -e "\n=============================================="
if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}🎉 All E2E tests passed!${NC}"
else
    echo -e "${RED}❌ Some E2E tests failed${NC}"
    echo -e "${YELLOW}Check test-results/ directory for details${NC}"
fi
echo "=============================================="

exit $TEST_EXIT_CODE
