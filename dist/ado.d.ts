type ADOOpts = {
    org: string;
    project?: string | undefined;
    pat: string;
};
export declare function makeADO({ org, project, pat }: ADOOpts): {
    listProjects(): Promise<unknown>;
    listPipelines(): Promise<unknown>;
    listBuilds(opts: {
        definitions?: number[];
        branchName?: string;
        top?: number;
        continuationToken?: string;
    }): Promise<unknown>;
    wiqlTeam(team: string, wiql: string): Promise<unknown>;
    getWorkItem(id: number): Promise<unknown>;
    getWorkItems(ids: number[], fields?: string[]): Promise<unknown>;
    createWorkItem(type: string, ops: any[]): Promise<unknown>;
    updateWorkItem(id: number, ops: any[]): Promise<unknown>;
    addComment(id: number, text: string): Promise<unknown>;
    listBoardColumns(team?: string): Promise<unknown>;
    listTeamIterations(team: string, timeframe?: "past" | "current" | "future"): Promise<unknown>;
    getIterationWorkItems(team: string, iterationId: string): Promise<unknown>;
};
export {};
//# sourceMappingURL=ado.d.ts.map