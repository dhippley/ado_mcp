#!/bin/bash
# Setup script for Azure DevOps MCP with Cursor (macOS/Linux)

set -e

echo "🚀 Azure DevOps MCP Setup for Cursor"
echo "======================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the correct directory
if [[ ! -f "package.json" ]] || [[ ! -f "src/server.ts" ]]; then
    print_error "This script must be run from the ado_mcp project root directory"
    exit 1
fi

# Get the absolute path to the project
PROJECT_DIR=$(pwd)
print_status "Project directory: $PROJECT_DIR"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js first."
    exit 1
fi

NODE_PATH=$(which node)
print_status "Node.js found at: $NODE_PATH"

# Build the project
print_status "Building the project..."
if npm run build; then
    print_success "Project built successfully"
else
    print_error "Failed to build project"
    exit 1
fi

# Determine Cursor MCP config path
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    MCP_CONFIG="$HOME/.cursor/mcp.json"
    print_status "Detected macOS - using config path: $MCP_CONFIG"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    MCP_CONFIG="$HOME/.cursor/mcp.json"
    print_status "Detected Linux - using config path: $MCP_CONFIG"
else
    print_error "Unsupported OS: $OSTYPE"
    exit 1
fi

# Create .cursor directory if it doesn't exist
mkdir -p "$(dirname "$MCP_CONFIG")"

# Prompt for configuration
echo ""
print_status "Please provide your Azure DevOps configuration:"

read -p "Azure DevOps Organization (e.g., 'myorg'): " ADO_ORG
if [[ -z "$ADO_ORG" ]]; then
    print_error "Organization is required"
    exit 1
fi

read -p "Azure DevOps Project (optional, press Enter to skip): " ADO_PROJECT

echo ""
print_warning "Your Personal Access Token (PAT) needs the following permissions:"
echo "  • Work Items: Read & Write"
echo "  • Build: Read"
echo "  • Project and Team: Read"
echo ""
read -s -p "Azure DevOps Personal Access Token: " ADO_PAT
echo ""

if [[ -z "$ADO_PAT" ]]; then
    print_error "Personal Access Token is required"
    exit 1
fi

# Create or update MCP configuration
print_status "Configuring Cursor MCP..."

# Create the JSON configuration
MCP_JSON='{
  "mcpServers": {
    "azure-devops": {
      "command": "'$NODE_PATH'",
      "args": ["'$PROJECT_DIR'/dist/server.js"],
      "env": {
        "ADO_ORG": "'$ADO_ORG'",
        "ADO_PAT": "'$ADO_PAT'"'

# Add project if provided
if [[ -n "$ADO_PROJECT" ]]; then
    MCP_JSON+=',
        "ADO_PROJECT": "'$ADO_PROJECT'"'
fi

MCP_JSON+='
      },
      "cwd": "'$PROJECT_DIR'"
    }
  }
}'

# Handle existing config
if [[ -f "$MCP_CONFIG" ]]; then
    print_warning "Existing MCP configuration found. Creating backup..."
    cp "$MCP_CONFIG" "$MCP_CONFIG.backup.$(date +%Y%m%d_%H%M%S)"
    print_status "Backup created: $MCP_CONFIG.backup.$(date +%Y%m%d_%H%M%S)"
    
    # Try to merge with existing config (basic approach - replace azure-devops entry)
    if command -v jq &> /dev/null; then
        print_status "Merging with existing configuration using jq..."
        TEMP_CONFIG=$(mktemp)
        echo "$MCP_JSON" | jq '.mcpServers."azure-devops"' > "$TEMP_CONFIG"
        jq --argjson newServer "$(cat "$TEMP_CONFIG")" '.mcpServers."azure-devops" = $newServer' "$MCP_CONFIG" > "$MCP_CONFIG.tmp" && mv "$MCP_CONFIG.tmp" "$MCP_CONFIG"
        rm "$TEMP_CONFIG"
    else
        print_warning "jq not found - replacing entire configuration file"
        echo "$MCP_JSON" > "$MCP_CONFIG"
    fi
else
    print_status "Creating new MCP configuration..."
    echo "$MCP_JSON" > "$MCP_CONFIG"
fi

print_success "MCP configuration written to: $MCP_CONFIG"

# Validate JSON
if command -v jq &> /dev/null; then
    if jq empty "$MCP_CONFIG" 2>/dev/null; then
        print_success "Configuration JSON is valid"
    else
        print_error "Generated JSON is invalid"
        exit 1
    fi
else
    print_warning "jq not installed - cannot validate JSON syntax"
fi

echo ""
print_success "✅ Azure DevOps MCP setup complete!"
echo ""
print_status "Next steps:"
echo "1. Restart Cursor completely"
echo "2. Open a new chat and you should see the Azure DevOps tools available"
echo "3. Test with a command like: 'List my Azure DevOps projects'"
echo ""
print_status "Available tools will include:"
echo "  • list_projects, list_pipelines, list_builds"
echo "  • work_item_get, work_item_create, work_item_update"
echo "  • wiql_query_team, iterations_list"
echo "  • And more..."
echo ""
print_warning "Remember: Keep your Personal Access Token secure and don't commit it to version control!"
