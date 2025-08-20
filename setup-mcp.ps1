# Setup script for Azure DevOps MCP with Cursor (Windows PowerShell)
param(
    [string]$AdoOrg = "",
    [string]$AdoProject = "",
    [string]$AdoPat = ""
)

# Enable strict mode
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Write-Host "🚀 Azure DevOps MCP Setup for Cursor" -ForegroundColor Blue
Write-Host "======================================" -ForegroundColor Blue

function Write-Status {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
}

function Write-Error-Custom {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

# Check if we're in the correct directory
if (-not (Test-Path "package.json") -or -not (Test-Path "src\server.ts")) {
    Write-Error-Custom "This script must be run from the ado_mcp project root directory"
    exit 1
}

# Get the absolute path to the project
$ProjectDir = (Get-Location).Path
Write-Status "Project directory: $ProjectDir"

# Check if Node.js is installed
try {
    $NodePath = (Get-Command node).Path
    Write-Status "Node.js found at: $NodePath"
} catch {
    Write-Error-Custom "Node.js is not installed. Please install Node.js first."
    exit 1
}

# Build the project
Write-Status "Building the project..."
try {
    npm run build
    Write-Success "Project built successfully"
} catch {
    Write-Error-Custom "Failed to build project"
    exit 1
}

# Determine Cursor MCP config path
$McpConfig = "$env:USERPROFILE\.cursor\mcp.json"
Write-Status "Using config path: $McpConfig"

# Create .cursor directory if it doesn't exist
$CursorDir = Split-Path $McpConfig -Parent
if (-not (Test-Path $CursorDir)) {
    New-Item -ItemType Directory -Path $CursorDir -Force | Out-Null
}

# Prompt for configuration if not provided as parameters
if ([string]::IsNullOrEmpty($AdoOrg)) {
    Write-Host ""
    Write-Status "Please provide your Azure DevOps configuration:"
    
    do {
        $AdoOrg = Read-Host "Azure DevOps Organization (e.g., 'myorg')"
    } while ([string]::IsNullOrEmpty($AdoOrg))
}

if ([string]::IsNullOrEmpty($AdoProject)) {
    $AdoProject = Read-Host "Azure DevOps Project (optional, press Enter to skip)"
}

if ([string]::IsNullOrEmpty($AdoPat)) {
    Write-Host ""
    Write-Warning "Your Personal Access Token (PAT) needs the following permissions:"
    Write-Host "  • Work Items: Read & Write" -ForegroundColor Gray
    Write-Host "  • Build: Read" -ForegroundColor Gray
    Write-Host "  • Project and Team: Read" -ForegroundColor Gray
    Write-Host ""
    
    $SecurePat = Read-Host "Azure DevOps Personal Access Token" -AsSecureString
    $AdoPat = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto([System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecurePat))
    
    if ([string]::IsNullOrEmpty($AdoPat)) {
        Write-Error-Custom "Personal Access Token is required"
        exit 1
    }
}

# Create or update MCP configuration
Write-Status "Configuring Cursor MCP..."

# Create the configuration object
$McpServerConfig = @{
    "azure-devops" = @{
        "command" = $NodePath
        "args" = @("$ProjectDir\dist\server.js")
        "env" = @{
            "ADO_ORG" = $AdoOrg
            "ADO_PAT" = $AdoPat
        }
        "cwd" = $ProjectDir
    }
}

# Add project if provided
if (-not [string]::IsNullOrEmpty($AdoProject)) {
    $McpServerConfig["azure-devops"]["env"]["ADO_PROJECT"] = $AdoProject
}

$McpConfig_Object = @{
    "mcpServers" = $McpServerConfig
}

# Handle existing config
if (Test-Path $McpConfig) {
    Write-Warning "Existing MCP configuration found. Creating backup..."
    $BackupPath = "$McpConfig.backup.$(Get-Date -Format 'yyyyMMdd_HHmmss')"
    Copy-Item $McpConfig $BackupPath
    Write-Status "Backup created: $BackupPath"
    
    try {
        # Try to merge with existing config
        $ExistingConfig = Get-Content $McpConfig -Raw | ConvertFrom-Json
        if ($ExistingConfig.mcpServers) {
            $ExistingConfig.mcpServers."azure-devops" = $McpServerConfig["azure-devops"]
            $McpConfig_Object = $ExistingConfig
        }
    } catch {
        Write-Warning "Could not parse existing config - replacing entire file"
    }
}

# Write the configuration
try {
    $McpConfig_Object | ConvertTo-Json -Depth 10 | Set-Content $McpConfig -Encoding UTF8
    Write-Success "MCP configuration written to: $McpConfig"
} catch {
    Write-Error-Custom "Failed to write configuration file: $_"
    exit 1
}

# Validate JSON
try {
    Get-Content $McpConfig -Raw | ConvertFrom-Json | Out-Null
    Write-Success "Configuration JSON is valid"
} catch {
    Write-Error-Custom "Generated JSON is invalid: $_"
    exit 1
}

Write-Host ""
Write-Success "✅ Azure DevOps MCP setup complete!"
Write-Host ""
Write-Status "Next steps:"
Write-Host "1. Restart Cursor completely" -ForegroundColor Gray
Write-Host "2. Open a new chat and you should see the Azure DevOps tools available" -ForegroundColor Gray
Write-Host "3. Test with a command like: 'List my Azure DevOps projects'" -ForegroundColor Gray
Write-Host ""
Write-Status "Available tools will include:"
Write-Host "  • list_projects, list_pipelines, list_builds" -ForegroundColor Gray
Write-Host "  • work_item_get, work_item_create, work_item_update" -ForegroundColor Gray
Write-Host "  • wiql_query_team, iterations_list" -ForegroundColor Gray
Write-Host "  • And more..." -ForegroundColor Gray
Write-Host ""
Write-Warning "Remember: Keep your Personal Access Token secure and don't commit it to version control!"

# Clean up sensitive variables
$AdoPat = $null
$SecurePat = $null
[System.GC]::Collect()
