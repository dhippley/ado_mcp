// src/ado.ts
import { setTimeout as sleep } from "timers/promises";
import { request } from "undici";
const baseUrl = (org) => `https://${encodeURIComponent(org)}.visualstudio.com`;
const authHeader = (pat) => "Basic " + Buffer.from(":" + pat).toString("base64");
async function adoGet(url, pat) {
    for (let i = 0; i < 3; i++) {
        const res = await request(url, {
            method: "GET",
            headers: { Authorization: authHeader(pat) }
        });
        if (res.statusCode >= 200 && res.statusCode < 300) {
            return await res.body.json();
        }
        if (res.statusCode === 429 || res.statusCode >= 500)
            await sleep(250 * (i + 1));
        else
            throw new Error(`${res.statusCode} GET ${url}`);
    }
    throw new Error(`Retries exceeded: GET ${url}`);
}
async function adoPost(url, pat, body, contentType = "application/json") {
    const res = await request(url, {
        method: "POST",
        headers: {
            Authorization: authHeader(pat),
            "Content-Type": contentType
        },
        body: JSON.stringify(body)
    });
    if (res.statusCode < 200 || res.statusCode >= 300)
        throw new Error(`${res.statusCode} POST ${url}`);
    return await res.body.json();
}
async function adoPatch(url, pat, body, contentType = "application/json-patch+json") {
    const res = await request(url, {
        method: "PATCH",
        headers: {
            Authorization: authHeader(pat),
            "Content-Type": contentType
        },
        body: JSON.stringify(body)
    });
    if (res.statusCode < 200 || res.statusCode >= 300)
        throw new Error(`${res.statusCode} PATCH ${url}`);
    return await res.body.json();
}
export function makeADO({ org, project, pat }) {
    const orgBase = `${baseUrl(org)}/${project ? encodeURIComponent(project) : ""}`.replace(/\/$/, "");
    return {
        // Organization & Projects
        async listProjects() {
            const url = `${baseUrl(org)}/_apis/projects?api-version=6.0`;
            return adoGet(url, pat);
        },
        // Pipelines
        async listPipelines() {
            const url = `${orgBase}/_apis/pipelines?api-version=6.0-preview.1`;
            return adoGet(url, pat);
        },
        async listBuilds(opts) {
            const q = new URLSearchParams({ "api-version": "6.0" });
            if (opts.top)
                q.set("$top", String(opts.top));
            if (opts.branchName)
                q.set("branchName", opts.branchName);
            if (opts.definitions?.length)
                q.set("definitions", opts.definitions.join(","));
            if (opts.continuationToken)
                q.set("continuationToken", opts.continuationToken);
            const url = `${orgBase}/_apis/build/builds?${q}`;
            return adoGet(url, pat);
        },
        // Work Items & Boards
        async wiqlTeam(team, wiql) {
            const url = `${orgBase}/${encodeURIComponent(team)}/_apis/wit/wiql?api-version=6.0`;
            return adoPost(url, pat, { query: wiql });
        },
        async getWorkItem(id) {
            const url = `${orgBase}/_apis/wit/workitems/${id}?api-version=6.0`;
            return adoGet(url, pat);
        },
        async getWorkItems(ids, fields) {
            const url = `${orgBase}/_apis/wit/workitemsbatch?api-version=6.0`;
            return adoPost(url, pat, { ids, fields });
        },
        async createWorkItem(type, ops) {
            const url = `${orgBase}/_apis/wit/workitems/$${encodeURIComponent(type)}?api-version=6.0`;
            return adoPatch(url, pat, ops, "application/json-patch+json");
        },
        async updateWorkItem(id, ops) {
            const url = `${orgBase}/_apis/wit/workitems/${id}?api-version=6.0`;
            return adoPatch(url, pat, ops, "application/json-patch+json");
        },
        async addComment(id, text) {
            const url = `${orgBase}/_apis/wit/workItems/${id}/comments?api-version=6.0-preview.4`;
            return adoPost(url, pat, { text });
        },
        // Boards metadata
        async listBoardColumns(team) {
            const url = team
                ? `${orgBase}/${encodeURIComponent(team)}/_apis/work/boardcolumns?api-version=6.0`
                : `${orgBase}/_apis/work/boardcolumns?api-version=6.0`;
            return adoGet(url, pat);
        },
        // Iterations (Sprints)
        async listTeamIterations(team, timeframe) {
            const q = new URLSearchParams({ "api-version": "6.0" });
            if (timeframe)
                q.set("$timeframe", timeframe);
            const url = `${orgBase}/${encodeURIComponent(team)}/_apis/work/teamsettings/iterations?${q}`;
            return adoGet(url, pat);
        },
        async getIterationWorkItems(team, iterationId) {
            const url = `${orgBase}/${encodeURIComponent(team)}/_apis/work/teamsettings/iterations/${iterationId}/workitems?api-version=6.0`;
            return adoGet(url, pat);
        }
    };
}
//# sourceMappingURL=ado.js.map