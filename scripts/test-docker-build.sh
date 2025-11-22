#!/bin/bash
# Docker Build Test Script for NCRelay

set -e

echo "=== NCRelay Docker Build Test ==="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} Docker is installed"

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}Warning: .env file not found. Creating from .env.example...${NC}"
    if [ -f .env.example ]; then
        cp .env.example .env
        echo -e "${GREEN}✓${NC} Created .env from .env.example"
    else
        echo -e "${RED}Error: .env.example not found${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✓${NC} .env file exists"
fi

# Clean up any previous test builds
echo ""
echo "Cleaning up previous test builds..."
docker rmi ncrelay:test 2>/dev/null || true
echo -e "${GREEN}✓${NC} Cleanup complete"

# Build the Docker image
echo ""
echo "Building Docker image..."
echo "This may take several minutes..."
if docker build \
    --build-arg VERSION="test-$(date +%Y%m%d-%H%M%S)" \
    --build-arg BUILD_DATE="$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    --build-arg VCS_REF="$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')" \
    -t ncrelay:test \
    -f Dockerfile \
    .; then
    echo -e "${GREEN}✓${NC} Docker image built successfully"
else
    echo -e "${RED}✗${NC} Docker build failed"
    exit 1
fi

# Test the image
echo ""
echo "Testing the Docker image..."
if docker run --rm ncrelay:test node --version; then
    echo -e "${GREEN}✓${NC} Docker image is functional"
else
    echo -e "${RED}✗${NC} Docker image test failed"
    exit 1
fi

echo ""
echo -e "${GREEN}=== Docker Build Test Complete ===${NC}"
echo ""
echo "To run the container:"
echo "  docker-compose up -d"
echo ""
echo "To view logs:"
echo "  docker-compose logs -f"
echo ""
echo "To stop the container:"
echo "  docker-compose down"
