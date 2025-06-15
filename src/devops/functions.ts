import { TeamContext } from "azure-devops-node-api/interfaces/CoreInterfaces";
import { HarvestTimeEntry } from "../services/responseTypes";
import { LocalStorage } from "@raycast/api";
import { AdoLocalStorageKeys, AdoWorkItemFields, WorkItemFieldUpdate } from "./types";
import { adoApiInstance, adoConnection } from "./AzureDevOps";

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

type WorkItemType = "bug" | "task" | "user story" | "feature";

type GroupedWorkItems = {
  [key in WorkItemType]?: any[];
};

// Utils
export function sortWorkItems(workItems: any[]): GroupedWorkItems[] {
  const grouped: GroupedWorkItems = workItems.reduce<GroupedWorkItems>((acc, workItem) => {
    const key = workItem.fields["System.WorkItemType"]?.toLowerCase() as WorkItemType;
    if (!key) {
      return acc;
    }

    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(workItem);
    return acc;
  }, {});

  const { bug, task } = grouped;
  const userStory = grouped["user story"];
  const tickets = [...(bug ?? []), ...(task ?? [])];

  const tasksByParent = tickets?.length
    ? tickets.reduce((acc: any, task: any) => {
        const parentId = task.fields["System.Parent"];
        const transformedTask = {
          id: task.id,
          title: task.fields["System.Title"],
          type: task.fields["System.WorkItemType"]?.toLowerCase() as WorkItemType,
        };

        const parentGroup = acc.find((group: any) => group.id === parentId);

        if (parentGroup) {
          parentGroup.tasks.push(transformedTask);
        } else {
          const parent = userStory?.find((story: any) => story.id === parentId);
          acc.push({ id: parentId, title: parent?.fields["System.Title"], tasks: [transformedTask] });
        }
        return acc;
      }, [] as any[])
    : [];

  return tasksByParent;
}

export async function stopAdoWorkItemTimer(harvestEntry: HarvestTimeEntry) {
  console.log("Checking for running ado timer", harvestEntry);
  const runningAdoTimer = await LocalStorage.getItem(AdoLocalStorageKeys.RunningAdoTimer);
  if (runningAdoTimer) {
    console.log("runningAdoTimer", runningAdoTimer);
    const { harvestEntryId, adoProjectId, adoTeamId, adoWorkItemId } = JSON.parse(runningAdoTimer as string);
    if (harvestEntryId === harvestEntry.id) {
      console.log("harvestEntryId matches", harvestEntryId, harvestEntry.id);
      // get work item's Completed Work value
      const workItemFields = [
        AdoWorkItemFields.Id,
        AdoWorkItemFields.CompletedWork,
        AdoWorkItemFields.RemainingWork,
        AdoWorkItemFields.OriginalEstimate,
      ];

      const workItem = await adoApiInstance.getWorkItem(adoWorkItemId, workItemFields);

      const completedWork = workItem.fields?.[AdoWorkItemFields.CompletedWork];
      const remainingWork = workItem.fields?.[AdoWorkItemFields.RemainingWork];
      const originalEstimate = workItem.fields?.[AdoWorkItemFields.OriginalEstimate];

      // get entry's duration
      const entryDuration = harvestEntry.hours;

      // update work item's Completed Work value
      if (completedWork && entryDuration) {
        const updatedCompletedWork = (Number(completedWork) + Number(entryDuration)).toFixed(2);
        const updatedRemainingWork = (Number(remainingWork) - Number(entryDuration)).toFixed(2);

        const updates: WorkItemFieldUpdate[] = [
          { field: AdoWorkItemFields.CompletedWork, value: updatedCompletedWork },
          {
            field: AdoWorkItemFields.RemainingWork,
            value: Number(updatedRemainingWork) < 0 ? 0 : updatedRemainingWork,
          },
        ];

        await adoApiInstance.updateWorkItemFields(adoWorkItemId, updates);
        console.log("work item updated");
      }
      // remove runningAdoTimer
    } else {
      console.log("harvestEntryId", harvestEntryId, "does not match", harvestEntry.id);
      // await LocalStorage.removeItem(AdoLocalStorageKeys.RunningAdoTimer);
    }
  } else {
    console.log("No running ado timer");
  }
}
