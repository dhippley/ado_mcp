# Azure DevOps MCP Server for Cursor

A Model Context Protocol (MCP) server that exposes Azure DevOps (Builds, Pipelines, and Boards/Work Items) as callable tools so you can drive DevOps tasks from **Cursor** chat.

## Features

- **Tools** you can call from Cursor: list projects, list pipelines/builds, run WIQL queries, get/create/update work items, add comments, list sprints/iterations, list board columns, and list sprint backlog items
- **Secure auth** via Azure DevOps Personal Access Token (PAT) using environment variables (no tokens in code)
- Built with **TypeScript** for type safety and extensibility

## Architecture

```
Cursor (chat) ──MCP (stdio JSON-RPC)──> mcp-azure-devops (TypeScript)
                                            │
                                            └── Azure DevOps REST API (Builds, WIT/Boards, Iterations)
```

- MCP server runs locally; Cursor launches it and calls "tools"
- The server makes REST calls to Azure DevOps with your PAT

## Prerequisites

- **Node.js 20+** (`node -v`)
- **Cursor** installed
- Access to an **Azure DevOps** organization and project

## Setup

### Automated Setup (Recommended)

**1. Create a Personal Access Token (PAT) in Azure DevOps:**
- Go to **User Settings → Personal access tokens → New Token**
- Required permissions: **Work Items: Read & Write**, **Build: Read**, **Project and Team: Read**

**2. Run the setup script:**

**macOS/Linux:**
```bash
git clone <repository-url>
cd ado_mcp
npm install
./setup-mcp.sh
```

**Windows PowerShell:**
```powershell
git clone <repository-url>
cd ado_mcp
npm install
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser  # if needed
.\setup-mcp.ps1
```

**3. Follow the prompts to enter:**
- Azure DevOps Organization (e.g., "mycompany")
- Azure DevOps Project (optional)
- Personal Access Token

**4. Restart Cursor completely** and test with: *"List my Azure DevOps projects"*

The setup script will automatically:
- Build the TypeScript project
- Find your Node.js installation
- Create/update your Cursor MCP configuration (`~/.cursor/mcp.json`)
- Back up any existing configurations

---

### Manual Setup

**If the automated setup doesn't work, you can configure manually:**

### Step 1: Create a Personal Access Token (PAT)

1. In Azure DevOps, go to **User Settings → Personal access tokens → New Token**
2. Choose a short **Expiration** (e.g., 30–90 days)
3. **Scopes** (start minimal; add more only when needed):
   - **Build: Read** (for pipelines/builds)
   - **Work Items / Work: Read**; add **Read & Write** if you want to create/update items, change states, add comments, or move to sprints
   - *(Optional)* **Code: Read** (if you'll surface PRs/commits later)
4. Copy the token and store it securely

### Step 2: Install Dependencies

The project is already set up with all required dependencies. If you need to reinstall:

```bash
npm install
```

### Step 3: Environment Variables

Set up your environment variables. You can either:

**Option A: Export in your shell**
```bash
export ADO_ORG="your-org-name"
export ADO_PROJECT="YourProject"       # optional
export ADO_PAT="your-pat-token-here"
```

**Option B: Create a `.env` file** (add to `.gitignore`)
```bash
ADO_ORG=your-org-name
ADO_PROJECT=YourProject
ADO_PAT=your-pat-token-here
```

### Step 4: Test the Server

Test that the server runs without errors:

```bash
npm start
# It will run and wait for MCP stdio. Ctrl+C to stop.
```

### Step 5: Register with Cursor

Create or edit `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "azure-devops": {
      "command": "npx",
      "args": ["ts-node", "src/server.ts"],
      "env": {
        "ADO_ORG": "your-org",
        "ADO_PROJECT": "YourProject",
        "ADO_PAT": "env:CURSOR_SECRET_ADO_PAT"
      },
      "cwd": "/absolute/path/to/ado_mcp"
    }
  }
}
```

Then set `CURSOR_SECRET_ADO_PAT` as an environment variable or Cursor secret.

## Available Tools

### Organization/Project Tools

- `list_projects` - List all projects in the Azure DevOps organization

### Pipeline/Build Tools

- `list_pipelines` - List all pipelines in the project
- `list_builds` - List builds with optional filters (definitions, branch, top N, pagination)

### Work Item Tools

- `wiql_query_team` - Run WIQL queries against a team
- `work_item_get` - Get a single work item by ID
- `work_items_get` - Get multiple work items by IDs with optional field filtering
- `work_item_create` - Create a new work item
- `work_item_update` - Update an existing work item
- `work_item_comment_add` - Add a comment to a work item

### Board/Sprint Tools

- `boards_list_columns` - List board columns for a team
- `iterations_list` - List team iterations/sprints (past, current, future)
- `iteration_work_items` - Get work items in a specific iteration
- `board_move` - Move a work item to a different state/sprint

## Usage Examples

### List Projects
```
Run list_projects
```

### List Pipelines
```
Run list_pipelines
```

### Get Latest Builds
```
list_builds { "definitions":[42], "top": 25 }
```

### Find Work Items in Current Sprint
1. Get current sprint:
   ```
   iterations_list { "team": "MyTeam", "timeframe": "current" }
   ```
2. Get work items in sprint:
   ```
   iteration_work_items { "team": "MyTeam", "iterationId": "<sprint-guid>" }
   ```

### Query Work Items with WIQL
```
wiql_query_team {
  "team": "MyTeam",
  "wiql": "SELECT [System.Id],[System.Title],[System.State] FROM WorkItems WHERE [System.TeamProject]=@project AND [Board Column]='In Progress' AND [System.WorkItemType] IN ('User Story','Bug','Task') ORDER BY [System.ChangedDate] DESC"
}
```

### Move Work Item to Sprint and Start Work
```
board_move { 
  "id": 12345, 
  "iterationPath": "YourProject\\2025\\Sprint 32", 
  "stateName": "In Progress" 
}

work_item_comment_add { 
  "id": 12345, 
  "text": "Pulled into Sprint 32; starting work." 
}
```

### Create a Bug
```
work_item_create {
  "type": "Bug",
  "title": "[iOS] Crash on startup when offline",
  "iterationPath": "YourProject\\2025\\Sprint 32",
  "description": "Steps to reproduce:\n1. Turn off wifi\n2. Open app\n3. App crashes\n\nExpected: App should show offline message\nActual: App crashes"
}
```

## Troubleshooting

### Setup Issues
- **"Node.js not found"**: Install Node.js from [nodejs.org](https://nodejs.org/)
- **"Permission denied" (macOS/Linux)**: Run `chmod +x setup-mcp.sh`
- **"Execution policy" error (Windows)**: Run `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`
- **"No tools found" in Cursor**: Restart Cursor completely and check MCP config file was created

### Runtime Issues
- **401/403 errors**: Token wrong, expired, or missing required scopes
- **404 errors**: Wrong org/project/team name or insufficient access
- **Board column changes don't work**: Set `System.State` mapped to that column (not the column field itself)
- **Current sprint empty**: Team's iteration path may differ from project default—check team name and iteration settings

### Manual Configuration
If automated setup fails, manually edit your MCP config file:

**Location**: `~/.cursor/mcp.json` (macOS/Linux) or `%USERPROFILE%\.cursor\mcp.json` (Windows)

```json
{
  "mcpServers": {
    "azure-devops": {
      "command": "/path/to/node",
      "args": ["/path/to/ado_mcp/dist/server.js"],
      "env": {
        "ADO_ORG": "your-org",
        "ADO_PROJECT": "your-project",
        "ADO_PAT": "your-pat"
      },
      "cwd": "/path/to/ado_mcp"
    }
  }
}
```

## Common Field Names

- `System.Title`
- `System.State` (controls board column via mapping)
- `System.IterationPath` (sprint)
- `System.AreaPath`
- `System.Description`
- `Microsoft.VSTS.Scheduling.StoryPoints`
- `Microsoft.VSTS.Common.Priority`

## Development

### Build
```bash
npm run build
```

### Development Mode
```bash
npm run dev
```

## Security

- Keep PATs scoped to minimum required permissions
- Use short-lived tokens (30-90 days)
- Never commit tokens to code
- Use environment variables or secure secrets management

## License

MIT