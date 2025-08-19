// src/server.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ErrorCode, ListToolsRequestSchema, McpError, } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { makeADO } from "./ado.js";
const ADO_ORG = process.env.ADO_ORG; // required
const ADO_PROJECT = process.env.ADO_PROJECT; // optional (query across projects if omitted)
const ADO_PAT = process.env.ADO_PAT; // required
if (!ADO_ORG || !ADO_PAT) {
    console.error("Missing ADO_ORG or ADO_PAT environment variables.");
    process.exit(1);
}
const ado = makeADO({
    org: ADO_ORG,
    project: ADO_PROJECT || undefined,
    pat: ADO_PAT
});
const server = new Server({ name: "mcp-azure-devops", version: "0.1.0" }, { capabilities: { tools: {}, resources: {} } });
// Tool definitions
const TOOLS = [
    {
        name: "list_projects",
        description: "List all projects in the Azure DevOps organization",
        inputSchema: {
            type: "object",
            properties: {},
        },
    },
    {
        name: "list_pipelines",
        description: "List all pipelines in the Azure DevOps project",
        inputSchema: {
            type: "object",
            properties: {},
        },
    },
    {
        name: "list_builds",
        description: "List builds with optional filters",
        inputSchema: {
            type: "object",
            properties: {
                definitions: {
                    type: "array",
                    items: { type: "number" },
                    description: "Pipeline definition IDs to filter by",
                },
                branchName: {
                    type: "string",
                    description: "Branch name to filter builds",
                },
                top: {
                    type: "number",
                    minimum: 1,
                    maximum: 200,
                    description: "Maximum number of builds to return",
                },
                continuationToken: {
                    type: "string",
                    description: "Token for pagination",
                },
            },
        },
    },
    {
        name: "wiql_query_team",
        description: "Run WIQL query against a team",
        inputSchema: {
            type: "object",
            properties: {
                team: { type: "string", description: "Team name" },
                wiql: { type: "string", minLength: 5, description: "WIQL query string" },
            },
            required: ["team", "wiql"],
        },
    },
    {
        name: "work_item_get",
        description: "Get a single work item by ID",
        inputSchema: {
            type: "object",
            properties: {
                id: { type: "number", description: "Work item ID" },
            },
            required: ["id"],
        },
    },
    {
        name: "work_items_get",
        description: "Get multiple work items by IDs",
        inputSchema: {
            type: "object",
            properties: {
                ids: {
                    type: "array",
                    items: { type: "number" },
                    description: "Work item IDs",
                },
                fields: {
                    type: "array",
                    items: { type: "string" },
                    description: "Specific fields to retrieve",
                },
            },
            required: ["ids"],
        },
    },
    {
        name: "work_item_create",
        description: "Create a new work item",
        inputSchema: {
            type: "object",
            properties: {
                type: { type: "string", description: "Work item type (Bug, Task, User Story, etc.)" },
                title: { type: "string", description: "Work item title" },
                areaPath: { type: "string", description: "Area path" },
                iterationPath: { type: "string", description: "Iteration path" },
                description: { type: "string", description: "Work item description" },
            },
            required: ["type", "title"],
        },
    },
    {
        name: "work_item_update",
        description: "Update an existing work item",
        inputSchema: {
            type: "object",
            properties: {
                id: { type: "number", description: "Work item ID" },
                state: { type: "string", description: "New state" },
                iterationPath: { type: "string", description: "New iteration path" },
                fields: {
                    type: "object",
                    description: "Additional fields to update",
                    additionalProperties: { type: "string" },
                },
            },
            required: ["id"],
        },
    },
    {
        name: "work_item_comment_add",
        description: "Add a comment to a work item",
        inputSchema: {
            type: "object",
            properties: {
                id: { type: "number", description: "Work item ID" },
                text: { type: "string", minLength: 1, description: "Comment text" },
            },
            required: ["id", "text"],
        },
    },
    {
        name: "boards_list_columns",
        description: "List board columns for a team",
        inputSchema: {
            type: "object",
            properties: {
                team: { type: "string", description: "Team name (optional)" },
            },
        },
    },
    {
        name: "iterations_list",
        description: "List team iterations/sprints",
        inputSchema: {
            type: "object",
            properties: {
                team: { type: "string", description: "Team name" },
                timeframe: {
                    type: "string",
                    enum: ["past", "current", "future"],
                    description: "Timeframe filter",
                },
            },
            required: ["team"],
        },
    },
    {
        name: "iteration_work_items",
        description: "Get work items in a specific iteration",
        inputSchema: {
            type: "object",
            properties: {
                team: { type: "string", description: "Team name" },
                iterationId: { type: "string", description: "Iteration ID" },
            },
            required: ["team", "iterationId"],
        },
    },
    {
        name: "board_move",
        description: "Move a work item to a different state/sprint",
        inputSchema: {
            type: "object",
            properties: {
                id: { type: "number", description: "Work item ID" },
                stateName: { type: "string", description: "New state name" },
                iterationPath: { type: "string", description: "New iteration path" },
            },
            required: ["id"],
        },
    },
];
// List tools handler
server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS,
}));
// Call tool handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
        switch (name) {
            case "list_projects":
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(await ado.listProjects(), null, 2),
                        },
                    ],
                };
            case "list_pipelines":
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(await ado.listPipelines(), null, 2),
                        },
                    ],
                };
            case "list_builds": {
                const buildArgs = args;
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(await ado.listBuilds(buildArgs), null, 2),
                        },
                    ],
                };
            }
            case "wiql_query_team": {
                const { team, wiql } = args;
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(await ado.wiqlTeam(team, wiql), null, 2),
                        },
                    ],
                };
            }
            case "work_item_get": {
                const { id } = args;
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(await ado.getWorkItem(id), null, 2),
                        },
                    ],
                };
            }
            case "work_items_get": {
                const { ids, fields } = args;
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(await ado.getWorkItems(ids, fields), null, 2),
                        },
                    ],
                };
            }
            case "work_item_create": {
                const { type, title, areaPath, iterationPath, description } = args;
                const ops = [
                    { op: "add", path: "/fields/System.Title", value: title },
                    ...(areaPath ? [{ op: "add", path: "/fields/System.AreaPath", value: areaPath }] : []),
                    ...(iterationPath ? [{ op: "add", path: "/fields/System.IterationPath", value: iterationPath }] : []),
                    ...(description ? [{ op: "add", path: "/fields/System.Description", value: description }] : []),
                ];
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(await ado.createWorkItem(type, ops), null, 2),
                        },
                    ],
                };
            }
            case "work_item_update": {
                const { id, state, iterationPath, fields } = args;
                const ops = [];
                if (state)
                    ops.push({ op: "add", path: "/fields/System.State", value: state });
                if (iterationPath)
                    ops.push({ op: "add", path: "/fields/System.IterationPath", value: iterationPath });
                if (fields) {
                    for (const [k, v] of Object.entries(fields)) {
                        ops.push({ op: "add", path: `/fields/${k}`, value: v });
                    }
                }
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(await ado.updateWorkItem(id, ops), null, 2),
                        },
                    ],
                };
            }
            case "work_item_comment_add": {
                const { id, text } = args;
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(await ado.addComment(id, text), null, 2),
                        },
                    ],
                };
            }
            case "boards_list_columns": {
                const { team } = args;
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(await ado.listBoardColumns(team), null, 2),
                        },
                    ],
                };
            }
            case "iterations_list": {
                const { team, timeframe } = args;
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(await ado.listTeamIterations(team, timeframe), null, 2),
                        },
                    ],
                };
            }
            case "iteration_work_items": {
                const { team, iterationId } = args;
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(await ado.getIterationWorkItems(team, iterationId), null, 2),
                        },
                    ],
                };
            }
            case "board_move": {
                const { id, stateName, iterationPath } = args;
                const fields = {};
                if (stateName)
                    fields["System.State"] = stateName;
                if (iterationPath)
                    fields["System.IterationPath"] = iterationPath;
                const ops = Object.entries(fields).map(([k, v]) => ({
                    op: "add",
                    path: `/fields/${k}`,
                    value: v,
                }));
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(await ado.updateWorkItem(id, ops), null, 2),
                        },
                    ],
                };
            }
            default:
                throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
        }
    }
    catch (error) {
        throw new McpError(ErrorCode.InternalError, `Error executing tool ${name}: ${error instanceof Error ? error.message : String(error)}`);
    }
});
const transport = new StdioServerTransport();
server.connect(transport);
//# sourceMappingURL=server.js.map