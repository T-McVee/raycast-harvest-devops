import * as azdev from "azure-devops-node-api";
import {
  CategorizedWebApiTeams,
  TeamContext,
  TeamProjectReference,
  WebApiTeam,
} from "azure-devops-node-api/interfaces/CoreInterfaces";
import { ADO_ORGANIZATION_URL, ADO_PAT } from "./preferences";
import { useEffect, useState } from "react";
import { LocalStorage } from "@raycast/api";
import { PagedList } from "azure-devops-node-api/interfaces/common/VSSInterfaces";
import { WorkItem } from "azure-devops-node-api/interfaces/TestPlanInterfaces";
import { sortWorkItems } from "./functions";

const authHandler = azdev.getPersonalAccessTokenHandler(ADO_PAT);
export const adoConnection = new azdev.WebApi(ADO_ORGANIZATION_URL, authHandler);

export class AzureDevOps {
  constructor(private readonly _connection: azdev.WebApi) {}

  async connect() {
    const result = await this._connection.connect();
    console.log("ado connection", result);
    return result;
  }

  async getProjects() {
    try {
      const api = await this._connection.getCoreApi();
      const result = await api.getProjects();

      console.log("logging projects", result);
      result.forEach((project, i) => {
        console.log("project", i, project);
      });

      return result;
    } catch (error) {
      console.log("error:", error);
      throw error;
    }
  }

  async getProject(projectId: string) {
    try {
      const api = await this._connection.getCoreApi();
      const result = await api.getProject(projectId);

      console.log("logging project", result);
      return result;
    } catch (error) {
      console.log("error:", error);
      throw error;
    }
  }

  async getProjectTeams(projectId: string) {
    try {
      const api = await this._connection.getCoreApi();
      const result: CategorizedWebApiTeams = await api.getProjectTeamsByCategory(projectId);

      console.log("logging project teams", result);
      result.myTeams?.forEach((team, i) => {
        console.log("team", i, team);
      });

      return result;
    } catch (error) {
      console.log("error:", error);
      throw error;
    }
  }

  async getTeams(projectId: string, onlyMyTeams = false) {
    try {
      const api = await this._connection.getCoreApi();
      const result = await api.getTeams(projectId, onlyMyTeams);

      console.log("logging teams", result);
      result.forEach((team, i) => {
        console.log("team", i, team);
      });

      return result;
    } catch (error) {
      console.log("error:", error);
      throw error;
    }
  }

  async getTeam(projectId: string, teamId: string) {
    try {
      const api = await this._connection.getCoreApi();
      const result = await api.getTeam(projectId, teamId);

      console.log("logging team", result);
      return result as TeamContext;
    } catch (error) {
      console.log("error:", error);
      throw error;
    }
  }

  async getTeamIterations(teamContext: TeamContext) {
    // TODO: Can team context arg be removed. replaced with existing methods?
    try {
      const api = await this._connection.getWorkApi();
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

  async getIterationWorkItems(teamContext: TeamContext, iterationId: string) {
    // TODO: Can team context arg be removed. replaced with existing methods?
    try {
      const api = await this._connection.getWorkApi();
      const result = await api.getIterationWorkItems(teamContext, iterationId);

      console.log("logging iteration work items", result);
      return result;
    } catch (error) {
      console.log("error:", error);
    }
  }

  async getWorkItemsInCurrentIteration(teamContext: TeamContext) {
    // TODO: Can team context arg be removed. replaced with existing methods?
    try {
      const workApi = await this._connection.getWorkApi();

      if (!teamContext || !teamContext.projectId || !teamContext.teamId) {
        throw new Error("Team context not found");
      }

      const iterations = await workApi.getTeamIterations(teamContext, "current");

      if (!iterations || iterations.length === 0) {
        console.log("No current sprint found");
        return [];
      }

      const currentIteration = iterations[0];
      console.log(`Current sprint: ${currentIteration.name}`);

      const witApi = await this._connection.getWorkItemTrackingApi();

      const wiql = {
        query: `
                SELECT [System.Id]
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
}

export const adoApiInstance = new AzureDevOps(adoConnection);

interface CachedProjects {
  projects: PagedList<TeamProjectReference>;
  timestamp: number;
}

export function useAdoProjects(fetchProjects = true, staleAfterMs = 1000 * 60 * 60 * 24) {
  const [projects, setProjects] = useState<PagedList<TeamProjectReference>>();

  useEffect(() => {
    if (!fetchProjects) return;

    LocalStorage.getItem(`ado_projects`).then((storedProjects: LocalStorage.Value | undefined) => {
      if (storedProjects) {
        const cached: CachedProjects = JSON.parse(storedProjects as string);
        const now = Date.now();

        // Check if the cached data is still fresh
        if (now - cached.timestamp < staleAfterMs) {
          setProjects(cached.projects);
          return;
        }
      } else {
        adoApiInstance.getProjects().then((projects) => {
          const dataToCache: CachedProjects = {
            projects,
            timestamp: Date.now(),
          };

          LocalStorage.setItem(`ado_projects`, JSON.stringify(dataToCache)).catch((error) => {
            console.error("Failed to store projects in local storage:", error);
          });
          setProjects(projects);
        });
      }
    });
  }, [fetchProjects]);

  return {
    projects,
  };
}

interface CachedTeams {
  teams: WebApiTeam[];
  timestamp: number;
}

export function useAdoProjectTeams(projectId: string | undefined, staleAfterMs: number = 1000 * 60 * 60 * 24) {
  const [teams, setTeams] = useState<WebApiTeam[]>([]);

  useEffect(() => {
    if (!projectId) return;

    LocalStorage.getItem(`ado_teams_${projectId}`).then((storedTeams: LocalStorage.Value | undefined) => {
      if (storedTeams) {
        const cached: CachedTeams = JSON.parse(storedTeams as string);
        const now = Date.now();

        // Check if the cached data is still fresh
        if (now - cached.timestamp < staleAfterMs) {
          setTeams(cached.teams);
          return;
        }
      }
    });

    adoApiInstance.getTeams(projectId, true).then((teams) => {
      // Store teams in local storage for future use
      if (teams) {
        const dataToCache: CachedTeams = {
          teams,
          timestamp: Date.now(),
        };

        LocalStorage.setItem(`ado_teams_${projectId}`, JSON.stringify(dataToCache)).catch((error) => {
          console.error("Failed to store teams in local storage:", error);
        });
      }
      setTeams(teams);
    });
  }, [projectId]);

  return { teams };
}

interface CachedWorkItems {
  workItems: WorkItem[];
  timestamp: number;
}

/**
 * Get work items for the current iteration for a given team context
 * @param teamContext - The team context to get work items for
 * @param staleAfterMs - The time in milliseconds after which the cached work items are considered stale
 * @returns The work items for the current iteration for the given team context
 */
export function useAdoCurrentIterationWorkItems(teamContext?: TeamContext, staleAfterMs: number = 1000 * 60 * 60 * 24) {
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);

  useEffect(() => {
    if (!teamContext || !teamContext.projectId || !teamContext.teamId) {
      console.log("teamContext missing Ids", teamContext);
      setWorkItems([]);
      return;
    }

    const localStorageKey = `ado_current_iteration_work_items_${teamContext.projectId}_${teamContext.teamId}`;

    LocalStorage.getItem(localStorageKey).then((storedWorkItems: LocalStorage.Value | undefined) => {
      if (storedWorkItems) {
        console.log("cached work items found, checking if stale");
        const cached: CachedWorkItems = JSON.parse(storedWorkItems as string);
        const now = Date.now();

        if (now - cached.timestamp < staleAfterMs) {
          console.log("cached work items are fresh", cached.workItems.length);
          const workItems = cached.workItems;

          setWorkItems(workItems);
          return;
        }

        console.log("cached work items are stale");
      }

      console.log("no cached work items found, fetching from ADO");
      adoApiInstance.getWorkItemsInCurrentIteration(teamContext).then((workItems) => {
        console.log("fetched work items", workItems.length);

        const dataToCache: CachedWorkItems = {
          workItems,
          timestamp: Date.now(),
        };

        console.log("caching work items in local storage. key:", localStorageKey);
        LocalStorage.setItem(localStorageKey, JSON.stringify(dataToCache))
          .then(() => {
            console.log("Cache updated successfully.");
          })
          .catch((error) => {
            console.error("Failed to store work items in local storage:", error);
          });

        console.log("setting work items", workItems.length);
        setWorkItems(workItems);
      });
    });
  }, [teamContext?.projectId, teamContext?.teamId]);

  return { workItems: sortWorkItems(workItems) };
}
