#!/bin/bash

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

SWIFT_PORT=8080
GO_PORT=8081

print_header() {
    echo ""
    echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
    echo ""
}

check_dependencies() {
    print_header "Checking Dependencies"

    if ! command -v k6 &> /dev/null; then
        echo -e "${RED}k6 not found. Install with: brew install k6${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ k6 installed${NC}"

    if ! command -v go &> /dev/null; then
        echo -e "${RED}go not found${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ go installed${NC}"

    if ! command -v swift &> /dev/null; then
        echo -e "${RED}swift not found${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ swift installed${NC}"
}

check_services() {
    print_header "Checking Docker Services"

    if ! docker ps --format '{{.Names}}' | grep -q 'todos-postgres'; then
        echo -e "${YELLOW}⚠ PostgreSQL container not running${NC}"
        echo "  Start with: docker compose up -d postgres"
    else
        echo -e "${GREEN}✓ PostgreSQL container running${NC}"
    fi

    if ! docker ps --format '{{.Names}}' | grep -q 'todos-redis'; then
        echo -e "${YELLOW}⚠ Redis container not running${NC}"
        echo "  Start with: docker compose up -d redis"
    else
        echo -e "${GREEN}✓ Redis container running${NC}"
    fi
}

increase_limits() {
    print_header "Increasing System Limits"
    ulimit -n 10000 2>/dev/null || echo -e "${YELLOW}⚠ Could not increase file descriptor limit${NC}"
    echo -e "${GREEN}✓ File descriptor limit: $(ulimit -n)${NC}"
}

start_stats_collection() {
    local containers=$1
    STATS_FILE="$SCRIPT_DIR/stats.csv"

    # Add header only if file doesn't exist
    if [[ ! -f "$STATS_FILE" ]]; then
        echo "timestamp,container,cpu,mem_usage,mem_pct,net_io,block_io" > "$STATS_FILE"
    fi

    (
        while true; do
            docker stats --no-stream --format "$(date +%s),{{.Name}},{{.CPUPerc}},{{.MemUsage}},{{.MemPerc}},{{.NetIO}},{{.BlockIO}}" $containers >> "$STATS_FILE" 2>/dev/null
            sleep 1
        done
    ) &
    STATS_PID=$!

    echo -e "${GREEN}✓ Stats collection started (PID: $STATS_PID)${NC}"
    echo -e "  Output: $STATS_FILE"
}

stop_stats_collection() {
    if [[ -n "$STATS_PID" ]]; then
        kill $STATS_PID 2>/dev/null && echo -e "${GREEN}✓ Stats collection stopped${NC}" || true
    fi
}

build_apis() {
    print_header "Building APIs"

    echo "Building Go API..."
    cd "$PROJECT_DIR/go-api"
    go build -o api ./cmd/api
    echo -e "${GREEN}✓ Go API built${NC}"

    echo "Building Swift API..."
    cd "$PROJECT_DIR/swift-api"
    swift build -c release 2>/dev/null
    echo -e "${GREEN}✓ Swift API built${NC}"
}

run_benchmark() {
    local api_name=$1
    local api_url=$2
    local scale=$3
    local output_file="$SCRIPT_DIR/results-${api_name}-$(date +%Y%m%d-%H%M%S).json"

    # Calculate peak VUs and duration for display
    local peak_vus=$((1000 * scale))
    local duration_mult=$(echo "scale=1; 1 + ($scale - 1) * 0.5" | bc)

    print_header "Benchmarking $api_name API"
    echo "URL: $api_url"
    echo "Scale: $scale (Peak: ${peak_vus} VUs, Duration: ${duration_mult}x)"
    echo "Output: $output_file"
    echo ""

    k6 run \
        --env API_URL="$api_url" \
        --env SCALE="$scale" \
        --out json="$output_file" \
        --summary-trend-stats="avg,min,med,max,p(90),p(95),p(99)" \
        "$SCRIPT_DIR/benchmark.js"

    echo ""
    echo -e "${GREEN}✓ Results saved to: $output_file${NC}"
}

cleanup() {
    print_header "Cleaning Up"

    stop_stats_collection

    if [[ -n "$GO_PID" ]]; then
        kill $GO_PID 2>/dev/null && echo "Stopped Go API" || true
    fi
    if [[ -n "$SWIFT_PID" ]]; then
        kill $SWIFT_PID 2>/dev/null && echo "Stopped Swift API" || true
    fi

    if [[ -n "$STATS_FILE" ]] && [[ -f "$STATS_FILE" ]]; then
        echo -e "${GREEN}✓ Stats saved to: $STATS_FILE${NC}"
    fi
}

trap cleanup EXIT

main() {
    local target=${1:-both}
    local scale=${2:-1}

    # Validate scale
    if ! [[ "$scale" =~ ^[0-9]+$ ]] || [[ "$scale" -lt 1 ]]; then
        echo -e "${RED}Scale must be a positive integer (1 = 1000 VUs, 2 = 1500 VUs, 3 = 2000 VUs, etc.)${NC}"
        exit 1
    fi

    check_dependencies
    check_services
    increase_limits

    case $target in
        go)
            start_stats_collection "todos-go-api"
            run_benchmark "go" "http://localhost:$GO_PORT" "$scale"
            ;;
        swift)
            start_stats_collection "todos-swift-api"
            run_benchmark "swift" "http://localhost:$SWIFT_PORT" "$scale"
            ;;
        both)
            start_stats_collection "todos-swift-api todos-go-api"
            run_benchmark "go" "http://localhost:$GO_PORT" "$scale"
            sleep 5
            run_benchmark "swift" "http://localhost:$SWIFT_PORT" "$scale"
            ;;
        *)
            echo "Usage: $0 [go|swift|both] [scale]"
            echo ""
            echo "Scale: 1 = 1k VUs @ 1x duration (default)"
            echo "       2 = 2k VUs @ 1.5x duration"
            echo "       3 = 3k VUs @ 2x duration"
            echo "       4 = 4k VUs @ 2.5x duration, etc."
            exit 1
            ;;
    esac

    print_header "Benchmark Complete"
}

main "$@"
