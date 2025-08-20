// src/server.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, ErrorCode, McpError, } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { makeADO } from "./ado.js";
// Env validation
const envSchema = z.object({
    ADO_ORG: z.string().min(1, "ADO_ORG is required"),
    ADO_PAT: z.string().min(1, "ADO_PAT is required"),
    ADO_PROJECT: z.string().optional(),
});
// Parse env
const env = envSchema.parse(process.env);
const ado = makeADO({
    org: env.ADO_ORG,
    project: env.ADO_PROJECT,
    pat: env.ADO_PAT,
});
// Tool argument schemas
const ListBuildsSchema = z.object({
    definitions: z.array(z.number()).optional(),
    branchName: z.string().optional(),
    top: z.number().min(1).max(200).optional(),
    continuationToken: z.string().optional(),
});
const WiqlQueryTeamSchema = z.object({
    team: z.string().min(1),
    wiql: z.string().min(5),
});
const WorkItemGetSchema = z.object({
    id: z.number(),
});
const WorkItemsGetSchema = z.object({
    ids: z.array(z.number()),
    fields: z.array(z.string()).optional(),
});
const WorkItemCreateSchema = z.object({
    type: z.string(),
    title: z.string(),
    description: z.string().optional(),
    iterationPath: z.string().optional(),
    areaPath: z.string().optional(),
});
const WorkItemUpdateSchema = z.object({
    id: z.number(),
    state: z.string().optional(),
    iterationPath: z.string().optional(),
    fields: z.record(z.string()).optional(),
});
const WorkItemCommentAddSchema = z.object({
    id: z.number(),
    text: z.string().min(1),
});
const BoardsListColumnsSchema = z.object({
    team: z.string().optional(),
});
const IterationsListSchema = z.object({
    team: z.string(),
    timeframe: z.enum(["past", "current", "future"]).optional(),
});
const IterationWorkItemsSchema = z.object({
    team: z.string(),
    iterationId: z.string(),
});
const BoardMoveSchema = z.object({
    id: z.number(),
    stateName: z.string().optional(),
    iterationPath: z.string().optional(),
});
const EmptySchema = z.object({});
// Server setup
const server = new Server({
    name: "azure-devops-mcp",
    version: "1.0.0",
}, {
    capabilities: {
        tools: {},
    },
});
// Helper function to convert Zod schemas to JSON Schema
function zodToMcpSchema(zodSchema) {
    return zodToJsonSchema(zodSchema);
}
// List tools handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            // Organization/Project tools
            {
                name: "list_projects",
                description: "List all projects in the Azure DevOps organization",
                inputSchema: zodToMcpSchema(EmptySchema),
            },
            // Pipeline/Build tools
            {
                name: "list_pipelines",
                description: "List all pipelines in the Azure DevOps project",
                inputSchema: zodToMcpSchema(EmptySchema),
            },
            {
                name: "list_builds",
                description: "List builds with optional filters",
                inputSchema: zodToMcpSchema(ListBuildsSchema),
            },
            // Work Item tools
            {
                name: "wiql_query_team",
                description: "Run WIQL query against a team",
                inputSchema: zodToMcpSchema(WiqlQueryTeamSchema),
            },
            {
                name: "work_item_get",
                description: "Get a single work item by ID",
                inputSchema: zodToMcpSchema(WorkItemGetSchema),
            },
            {
                name: "work_items_get",
                description: "Get multiple work items by IDs",
                inputSchema: zodToMcpSchema(WorkItemsGetSchema),
            },
            {
                name: "work_item_create",
                description: "Create a new work item",
                inputSchema: zodToMcpSchema(WorkItemCreateSchema),
            },
            {
                name: "work_item_update",
                description: "Update an existing work item",
                inputSchema: zodToMcpSchema(WorkItemUpdateSchema),
            },
            {
                name: "work_item_comment_add",
                description: "Add a comment to a work item",
                inputSchema: zodToMcpSchema(WorkItemCommentAddSchema),
            },
            // Board/Sprint tools
            {
                name: "boards_list_columns",
                description: "List board columns for a team",
                inputSchema: zodToMcpSchema(BoardsListColumnsSchema),
            },
            {
                name: "iterations_list",
                description: "List team iterations/sprints",
                inputSchema: zodToMcpSchema(IterationsListSchema),
            },
            {
                name: "iteration_work_items",
                description: "Get work items in a specific iteration",
                inputSchema: zodToMcpSchema(IterationWorkItemsSchema),
            },
            {
                name: "board_move",
                description: "Move a work item to a different state/sprint",
                inputSchema: zodToMcpSchema(BoardMoveSchema),
            },
        ],
    };
});
// Call tool handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
        switch (name) {
            // Organization/Project tools
            case "list_projects": {
                const result = await ado.listProjects();
                return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
            }
            // Pipeline/Build tools
            case "list_pipelines": {
                const result = await ado.listPipelines();
                return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
            }
            case "list_builds": {
                const parsed = ListBuildsSchema.parse(args);
                const result = await ado.listBuilds(parsed);
                return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
            }
            // Work Item tools
            case "wiql_query_team": {
                const parsed = WiqlQueryTeamSchema.parse(args);
                const result = await ado.wiqlTeam(parsed.team, parsed.wiql);
                return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
            }
            case "work_item_get": {
                const parsed = WorkItemGetSchema.parse(args);
                const result = await ado.getWorkItem(parsed.id);
                return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
            }
            case "work_items_get": {
                const parsed = WorkItemsGetSchema.parse(args);
                const result = await ado.getWorkItems(parsed.ids, parsed.fields);
                return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
            }
            case "work_item_create": {
                const parsed = WorkItemCreateSchema.parse(args);
                const ops = [
                    { op: "add", path: "/fields/System.Title", value: parsed.title },
                ];
                if (parsed.description) {
                    ops.push({ op: "add", path: "/fields/System.Description", value: parsed.description });
                }
                if (parsed.iterationPath) {
                    ops.push({ op: "add", path: "/fields/System.IterationPath", value: parsed.iterationPath });
                }
                if (parsed.areaPath) {
                    ops.push({ op: "add", path: "/fields/System.AreaPath", value: parsed.areaPath });
                }
                const result = await ado.createWorkItem(parsed.type, ops);
                return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
            }
            case "work_item_update": {
                const parsed = WorkItemUpdateSchema.parse(args);
                const ops = [];
                if (parsed.state) {
                    ops.push({ op: "add", path: "/fields/System.State", value: parsed.state });
                }
                if (parsed.iterationPath) {
                    ops.push({ op: "add", path: "/fields/System.IterationPath", value: parsed.iterationPath });
                }
                if (parsed.fields) {
                    for (const [field, value] of Object.entries(parsed.fields)) {
                        ops.push({ op: "add", path: `/fields/${field}`, value });
                    }
                }
                const result = await ado.updateWorkItem(parsed.id, ops);
                return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
            }
            case "work_item_comment_add": {
                const parsed = WorkItemCommentAddSchema.parse(args);
                const result = await ado.addComment(parsed.id, parsed.text);
                return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
            }
            // Board/Sprint tools
            case "boards_list_columns": {
                const parsed = BoardsListColumnsSchema.parse(args);
                const result = await ado.listBoardColumns(parsed.team);
                return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
            }
            case "iterations_list": {
                const parsed = IterationsListSchema.parse(args);
                const result = await ado.listTeamIterations(parsed.team, parsed.timeframe);
                return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
            }
            case "iteration_work_items": {
                const parsed = IterationWorkItemsSchema.parse(args);
                const result = await ado.getIterationWorkItems(parsed.team, parsed.iterationId);
                return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
            }
            case "board_move": {
                const parsed = BoardMoveSchema.parse(args);
                const ops = [];
                if (parsed.stateName) {
                    ops.push({ op: "add", path: "/fields/System.State", value: parsed.stateName });
                }
                if (parsed.iterationPath) {
                    ops.push({ op: "add", path: "/fields/System.IterationPath", value: parsed.iterationPath });
                }
                const result = await ado.updateWorkItem(parsed.id, ops);
                return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
            }
            default:
                throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
        }
    }
    catch (error) {
        if (error instanceof z.ZodError) {
            throw new McpError(ErrorCode.InvalidParams, `Invalid arguments: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`);
        }
        throw new McpError(ErrorCode.InternalError, `Tool execution failed: ${error}`);
    }
});
// Start server
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Azure DevOps MCP Server running on stdio");
}
main().catch(console.error);
//# sourceMappingURL=server.js.map