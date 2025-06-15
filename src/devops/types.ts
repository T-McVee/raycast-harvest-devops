export enum AdoWorkItemFields {
  AcceptanceCriteria = "Microsoft.VSTS.Common.AcceptanceCriteria",
  AssignedTo = "System.AssignedTo",
  CompletedWork = "Microsoft.VSTS.Scheduling.CompletedWork",
  Id = "System.Id",
  IterationPath = "System.IterationPath",
  OriginalEstimate = "Microsoft.VSTS.Scheduling.OriginalEstimate",
  Parent = "System.Parent",
  RemainingWork = "Microsoft.VSTS.Scheduling.RemainingWork",
  State = "System.State",
  Title = "System.Title",
  WorkItemType = "System.WorkItemType",
}

// Local Storage keys
export enum AdoLocalStorageKeys {
  RunningAdoTimer = "runningAdoTimer",
  AdoProjects = "ado_projects",
  AdoTeams = "ado_teams", // followed by '_${projectId}'
  AdoCurrentIterationWorkItems = "ado_current_iteration_work_items", // followed by '_${projectId}_${teamId}'
}

export type WorkItemFieldUpdate = {
  field: AdoWorkItemFields;
  value: string | number;
};
