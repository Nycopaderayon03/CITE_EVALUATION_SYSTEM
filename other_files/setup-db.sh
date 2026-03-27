#!/bin/bash
# Database Setup Script for CITE-ES
# This script initializes the MySQL database for the CITE-ES system

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}CITE-ES Database Setup${NC}\n"

# Check if MySQL is available
if ! command -v mysql &> /dev/null; then
    echo -e "${RED}MySQL is not installed or not in PATH${NC}"
    echo "Please install MySQL or add it to your PATH"
    exit 1
fi

# Database configuration
DB_HOST=${1:-localhost}
DB_USER=${2:-root}
DB_PASSWORD=${3:-}
DB_NAME="cite_es"

echo "Using database configuration:"
echo "  Host: $DB_HOST"
echo "  User: $DB_USER"
echo "  Database: $DB_NAME"
echo ""

# Create database
echo -e "${YELLOW}Creating database...${NC}"
if [[ -z "$DB_PASSWORD" ]]; then
    mysql -h $DB_HOST -u $DB_USER < database/schema.sql
else
    mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD < database/schema.sql
fi

if [[ $? -eq 0 ]]; then
    echo -e "${GREEN}✓ Database created successfully${NC}"
else
    echo -e "${RED}✗ Failed to create database${NC}"
    exit 1
fi

# Verify database was created
echo -e "${YELLOW}Verifying database...${NC}"
if [[ -z "$DB_PASSWORD" ]]; then
    mysql -h $DB_HOST -u $DB_USER -e "USE $DB_NAME; SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema='$DB_NAME';"
else
    mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD -e "USE $DB_NAME; SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema='$DB_NAME';"
fi

if [[ $? -eq 0 ]]; then
    echo -e "${GREEN}✓ Database verification successful${NC}"
    echo -e "\n${GREEN}Setup complete!${NC}"
    echo -e "\nNext steps:"
    echo "1. Update .env.local with your database credentials"
    echo "2. Run: npm install"
    echo "3. Run: npm run dev"
else
    echo -e "${RED}✗ Database verification failed${NC}"
    exit 1
fi
