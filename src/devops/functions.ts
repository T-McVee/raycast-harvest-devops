import * as azdev from "azure-devops-node-api";
import { ADO_ORGANIZATION_URL, ADO_PAT } from "./preferences";
import { TeamContext } from "azure-devops-node-api/interfaces/CoreInterfaces";

const authHandler = azdev.getPersonalAccessTokenHandler(ADO_PAT);
export const adoConnection = new azdev.WebApi(ADO_ORGANIZATION_URL, authHandler);

// Project functions

/**
 * Get all projects from the Azure DevOps organization
 * @returns TBD
 */
export async function getProjects() {
  try {
    await adoConnection.connect();
    const api = await adoConnection.getCoreApi();
    const result = await api.getProjects();

    console.log("logging projects", result);
    result.forEach((project, i) => {
      console.log("project", i, project);
    });

    return result;
  } catch (error) {
    console.log("error:", error);
  }
}

/**
 * Get a project by ID
 * @param projectId - The ID of the project
 * @returns TBD
 */
export async function getProject(projectId: string) {
  try {
    await adoConnection.connect();
    const api = await adoConnection.getCoreApi();
    const result = await api.getProject(projectId);

    console.log("logging project", result);
    return result;
  } catch (error) {
    console.log("error:", error);
  }
}

/**
 * Get all teams for a project
 * @param projectId - The ID of the project
 * @returns TBD
 */
export async function getProjectTeams(projectId: string) {
  try {
    await adoConnection.connect();
    const api = await adoConnection.getCoreApi();
    const result = await api.getProjectTeamsByCategory(projectId);

    console.log("logging project teams", result);
    result.myTeams?.forEach((team, i) => {
      console.log("team", i, team);
    });

    return result;
  } catch (error) {
    console.log("error:", error);
  }
}

// Team functions

/**
 * Get all teams for a project
 * @param projectId - The ID of the project
 * @returns TBD
 */
export async function getTeams(projectId: string) {
  try {
    await adoConnection.connect();
    const api = await adoConnection.getCoreApi();
    const result = await api.getTeams(projectId);

    console.log("logging teams", result);
    result.forEach((team, i) => {
      console.log("team", i, team);
    });

    return result;
  } catch (error) {
    console.log("error:", error);
  }
}

/**
 * Get a team by ID
 * @param projectId - The ID of the project
 * @param teamId - The ID of the team
 * @returns TBD
 */
export async function getTeam(projectId: string, teamId: string) {
  try {
    await adoConnection.connect();
    const api = await adoConnection.getCoreApi();
    const result = await api.getTeam(projectId, teamId);

    console.log("logging team", result);
    return result as TeamContext;
  } catch (error) {
    console.log("error:", error);
  }
}

/**
 * Get all iterations for a team
 * @param teamContext - The context of the team
 * @returns TBD
 */
export async function getTeamIterations(teamContext: TeamContext) {
  try {
    await adoConnection.connect();
    const api = await adoConnection.getWorkApi();
    const result = await api.getTeamIterations(teamContext);

    console.log("logging team iterations");
    result.forEach((iteration, i) => {
      console.log("iteration", i, iteration);
    });
    return result;
  } catch (error) {
    console.log("error:", error);
    throw error;
  }
}

/**
 * Get all work items for an iteration
 * @param teamContext - The context of the team
 * @param iterationId - The ID of the iteration
 * @returns TBD
 */
export async function getIterationWorkItems(teamContext: TeamContext, iterationId: string) {
  try {
    await adoConnection.connect();
    const api = await adoConnection.getWorkApi();
    const result = await api.getIterationWorkItems(teamContext, iterationId);

    console.log("logging iteration work items", result);
    return result;
  } catch (error) {
    console.log("error:", error);
  }
}

/**
 * Get all work items for the team's current iteration
 * @param teamContext - The context of the team
 * @returns TBD
 */
export async function getWorkItemsInCurrentIteration(teamContext: TeamContext) {
  try {
    const workApi = await adoConnection.getWorkApi();

    if (!teamContext) {
      throw new Error("Team context not found");
    }

    const iterations = await workApi.getTeamIterations(teamContext, "current");

    if (!iterations || iterations.length === 0) {
      console.log("No current sprint found");
      return [];
    }

    const currentIteration = iterations[0];
    console.log(`Current sprint: ${currentIteration.name}`);

    const witApi = await adoConnection.getWorkItemTrackingApi();

    const wiql = {
      query: `
                SELECT [System.Id], [System.Title], [System.State], [System.AssignedTo], [System.WorkItemType], [System.Parent] 
                FROM WorkItems 
                WHERE [System.TeamProject] = @project 
                AND [System.IterationPath] = '${currentIteration.path}'
                ORDER BY [System.WorkItemType], [System.Id]
            `,
    };

    const queryResult = await witApi.queryByWiql(wiql, teamContext);

    console.log("queryResult", queryResult.workItems?.length);

    if (!queryResult.workItems || queryResult.workItems.length === 0) {
      console.log("No work items found");
      return [];
    }

    const workItemIds = queryResult.workItems
      .map((workItem) => workItem.id)
      .filter((id): id is number => id !== undefined);

    const workItems = await witApi.getWorkItems(workItemIds, [
      "System.Id",
      "System.Title",
      "System.State",
      "System.AssignedTo",
      "System.WorkItemType",
      "System.IterationPath",
      "System.Parent",

      // "System.Description",
    ]);
    workItems.forEach((workItem, i) => {
      console.log("workItem", i, workItem);
    });

    return workItems;
  } catch (error) {
    console.log("error:", error);
    throw error;
  }
}

// Utils
export function sortWorkItems(workItems: any[]) {
  const grouped = workItems.reduce((acc, workItem) => {
    const key = workItem.fields["System.WorkItemType"].toLowerCase();
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(workItem);
    return acc;
  }, {});

  const { bug, task } = grouped;
  const userStory = grouped["user story"];

  const tasksByParent = task.reduce((acc: any, task: any) => {
    const parentId = task.fields["System.Parent"];
    const transformedTask = {
      id: task.id,
      title: task.fields["System.Title"],
    };

    const parentGroup = acc.find((group: any) => group.id === parentId);

    if (parentGroup) {
      parentGroup.tasks.push(transformedTask);
    } else {
      const parent = userStory.find((story: any) => story.id === parentId);
      acc.push({ id: parentId, title: parent?.fields["System.Title"], tasks: [transformedTask] });
    }
    return acc;
  }, [] as any[]);

  return tasksByParent;
}
