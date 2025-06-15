import {
  Form,
  ActionPanel,
  showToast,
  Toast,
  showHUD,
  useNavigation,
  Action,
  Alert,
  confirmAlert,
  Icon,
  LocalStorage,
  getPreferenceValues,
} from "@raycast/api";
import { useEffect, useMemo, useState } from "react";
import { formatHours, isAxiosError, newTimeEntry, useCompany, useMyProjects } from "./services/harvest";
import { HarvestProjectAssignment, HarvestTimeEntry } from "./services/responseTypes";
import dayjs from "dayjs";
import isToday from "dayjs/plugin/isToday";
import { Dictionary, find, groupBy, isDate, isEmpty, omitBy, reduce } from "lodash";
import { useAdoCurrentIterationWorkItems, useAdoProjectTeams, useAdoProjects } from "./devops/AzureDevOps";
import { AdoLocalStorageKeys } from "./devops/types";
import { HarvestLocalStorageKeys } from "./services/types";
dayjs.extend(isToday);

export default function Command({
  onSave = async () => {
    return;
  },
  viewDate,
  entry,
}: {
  onSave: () => Promise<void>;
  entry?: HarvestTimeEntry;
  viewDate: Date | null;
}) {
  const { pop } = useNavigation();
  const { data: company, error } = useCompany();
  const { data: projects } = useMyProjects();
  const [projectId, setProjectId] = useState<string | null>(entry?.project.id.toString() ?? null);
  const [taskId, setTaskId] = useState<string | null>(entry?.task.id.toString() ?? null);
  const [notes, setNotes] = useState<string>(entry?.notes ?? "");
  const [hours, setHours] = useState<string>(formatHours(entry?.hours?.toFixed(2), company));
  const [startedTime, setStartedTime] = useState<string | null>(entry?.started_time ?? null);
  const [endedTime, setEndedTime] = useState<string | null>(entry?.ended_time ?? null);
  const [spentDate, setSpentDate] = useState<Date>(viewDate ?? new Date());

  const [isDevOpsProjectLinked, setIsDevOpsProjectLinked] = useState<boolean>(false);
  const [adoProjectId, setAdoProjectId] = useState<string>();
  const [adoTeamId, setAdoTeamId] = useState<string>();
  const [devopsWorkItemId, setDevopsWorkItemId] = useState<string | null>(null);

  const { projects: adoProjects } = useAdoProjects(isDevOpsProjectLinked);
  const { teams: adoTeams } = useAdoProjectTeams(adoProjectId);
  const { workItems } = useAdoCurrentIterationWorkItems({
    projectId: adoProjectId,
    teamId: adoTeamId,
  });

  const { harvestShowClient = false } = getPreferenceValues<{ harvestShowClient?: boolean }>();

  useEffect(() => {
    if (error) {
      if (isAxiosError(error) && error.response?.status === 401) {
        showToast({
          style: Toast.Style.Failure,
          title: "Invalid Token",
          message: "Your API token or Account ID is invalid. Go to Raycast Preferences to update it.",
        });
      } else {
        showToast({
          style: Toast.Style.Failure,
          title: "Unknown Error",
          message: "Could not get your company data",
        });
      }
    }
  }, [error]);

  const groupedProjects = useMemo(() => {
    // return an array of arrays thats grouped by client to easily group them via a map function
    return reduce<
      Dictionary<[HarvestProjectAssignment, ...HarvestProjectAssignment[]]>,
      Array<Array<HarvestProjectAssignment>>
    >(
      groupBy(projects, (o) => o.client.id),
      (result, value) => {
        result.push(value);
        return result;
      },
      []
    );
  }, [projects]);

  useEffect(() => {
    if (!entry) {
      // no entry was passed, recall last submitted project/task
      LocalStorage.getItem(HarvestLocalStorageKeys.LastProject).then((value) => {
        console.log("restoring last used entry...", { value });
        if (value) {
          const { projectId, taskId } = JSON.parse(value.toString());
          setProjectId(projectId);
          setTaskId(taskId);
          // setTaskAssignments(projectId);
        }
      });
    } else {
      // setTaskAssignments();
    }

    return () => {
      setProjectId(null);
    };
  }, [entry]);

  async function handleSubmit(values: Record<string, Form.Value>) {
    if (values.project_id === null) {
      showToast({
        style: Toast.Style.Failure,
        title: "No Project Selected",
      });
      return;
    }
    if (values.task_id === null) {
      showToast({
        style: Toast.Style.Failure,
        title: "No Task Selected",
      });
      return;
    }

    setTimeFormat(hours);
    const spentDate = isDate(values.spent_date) ? values.spent_date : viewDate;

    if (!company?.wants_timestamp_timers && !dayjs(spentDate).isToday() && !hours)
      if (
        !(await confirmAlert({
          icon: Icon.ExclamationMark,
          title: "Warning",
          message:
            "You are about to start a timer on a different day (not today). Maybe you meant to enter some time on that day instead?",
          primaryAction: { title: "Start Timer", style: Alert.ActionStyle.Destructive },
        }))
      ) {
        return; // user canceled
      }

    const toast = await showToast({ style: Toast.Style.Animated, title: "Loading..." });
    await toast.show();

    const data = omitBy(values, isEmpty);

    const timeEntry = await newTimeEntry(
      {
        ...data,
        project_id: parseInt(values.project_id.toString()),
        task_id: parseInt(values.task_id.toString()),
        spent_date: dayjs(spentDate).format("YYYY-MM-DD"),
      },
      entry?.id?.toString()
    ).catch(async (error) => {
      console.error(error.response.data);
      await showToast({
        style: Toast.Style.Failure,
        title: "Error",
        message: error.response.data.message,
      });
    });

    if (timeEntry?.is_running && isDevOpsProjectLinked) {
      console.log("Setting runningAdoTimer");
      const runningTimerDetails = {
        harvestEntryId: timeEntry.id,
        adoProjectId: adoProjectId,
        adoTeamId: adoTeamId,
        adoWorkItemId: devopsWorkItemId,
      };

      await LocalStorage.setItem(AdoLocalStorageKeys.RunningAdoTimer, JSON.stringify(runningTimerDetails));
      console.log("runningAdoTimer set");
    }

    await LocalStorage.setItem(
      HarvestLocalStorageKeys.LastProject,
      JSON.stringify({ projectId: values.project_id, taskId: values.task_id })
    );

    if (timeEntry) {
      toast.hide();
      await onSave();
      await showHUD(entry?.id ? "Time Entry Updated" : timeEntry.is_running ? "Timer Started" : "Time Entry Created");
      pop();
    }
  }

  const tasks = useMemo(() => {
    const project = find(projects, (o) => {
      return o.project.id === parseInt(projectId ?? "0");
    });
    return project ? project.task_assignments : [];
  }, [projects, projectId]);

  useEffect(() => {
    if (tasks.length === 0) setTaskId(null);
    if (tasks.some((o) => o.task.id.toString() === taskId)) return;
    const defaultTask = tasks[0];

    setTaskId(defaultTask ? defaultTask.task.id.toString() : null);
  }, [tasks, taskId]);

  function setTimeFormat(value?: string) {
    // This function can be called directly from the onBlur event to better match the Harvest app behavior when it exists
    if (!value) return;

    if (company?.time_format === "decimal") {
      if (value.includes(":")) {
        const parsed = value.split(":");
        const hour = parseInt(parsed[0]);
        const minute = parseInt(parsed[1]);
        if (!isNaN(hour)) {
          if (!isNaN(minute)) {
            value = parseFloat(`${hour}.${minute / 60}`)
              .toFixed(2)
              .toString();
          } else {
            value = hour.toString();
          }
        }
      }
    }
    if (company?.time_format === "hours_minutes") {
      if (!value.includes(":")) {
        const parsed = parseFloat(value);
        if (!isNaN(parsed)) {
          const hour = Math.floor(parsed);
          const minute = parseInt(((parsed - hour) * 60).toFixed(0));
          value = `${hour}:${minute < 10 ? "0" : ""}${minute}`;
        }
      }
    }
    return setHours(value);
  }

  function handleIsDevOpsProjectLinkedChange(newValue: boolean) {
    setIsDevOpsProjectLinked(newValue);
    setDevopsWorkItemId(null);
    setNotes("");
  }

  function handleDevOpsProjectChange(newValue: string) {
    setAdoProjectId(newValue);
  }

  function handleDevOpsTeamChange(newValue: string) {
    setAdoTeamId(newValue);
  }

  function handleDevOpsWorkItemChange(newValue: string) {
    setDevopsWorkItemId(newValue);

    const workItemsFlattened = workItems.flatMap((userStory: any) => userStory.tasks);
    const task = workItemsFlattened.find((task: any) => task.id.toString() === newValue);
    if (task) {
      setNotes(`#${task.id} - ${task.title}`);
    }
  }

  return (
    <Form
      navigationTitle={entry?.id ? "Edit Time Entry" : "New Time Entry"}
      actions={
        <ActionPanel>
          <Action.SubmitForm
            onSubmit={handleSubmit}
            title={entry?.id ? "Update Time Entry" : hours ? "Create Time Entry" : "Start Timer"}
          />
        </ActionPanel>
      }
    >
      {harvestShowClient && (
        <Form.Description
          text={projects.find((o) => o.project.id === parseInt(projectId ?? "0"))?.client.name ?? ""}
          title="Client"
        />
      )}
      <Form.Dropdown
        id="project_id"
        title="Project"
        key={`project-${entry?.id}`}
        value={projectId ?? ""}
        onChange={(newValue) => {
          setProjectId(newValue);
          // setTaskAssignments(newValue);
        }}
      >
        {groupedProjects?.map((groupedProject) => {
          const client = groupedProject[0].client;
          return (
            <Form.Dropdown.Section title={client.name} key={client.id}>
              {groupedProject.map((project) => {
                const code = project.project.code;
                return (
                  <Form.Dropdown.Item
                    keywords={[project.client.name.toLowerCase()]}
                    value={project.project.id.toString()}
                    title={`${code && code !== "" ? "[" + code + "] " : ""}${project.project.name}`}
                    key={project.id}
                  />
                );
              })}
            </Form.Dropdown.Section>
          );
        })}
      </Form.Dropdown>
      <Form.Dropdown id="task_id" title="Task" value={taskId ?? ""} onChange={setTaskId}>
        {tasks?.map((task) => {
          return <Form.Dropdown.Item value={task.task.id.toString()} title={task.task.name} key={task.id} />;
        })}
      </Form.Dropdown>
      <Form.Checkbox
        id="is_devops_project_linked"
        label="LinkDevOps task"
        value={isDevOpsProjectLinked}
        onChange={handleIsDevOpsProjectLinkedChange}
        info="Check to use a DevOps Project"
      />

      {isDevOpsProjectLinked && (
        <>
          <Form.Dropdown
            id="devops_project_id"
            title="DevOps project"
            value={adoProjectId ?? ""}
            isLoading={!adoProjects}
            onChange={handleDevOpsProjectChange}
          >
            {adoProjects?.map((project, i) => {
              return (
                <Form.Dropdown.Item value={project.id ?? ""} title={project.name ?? ""} key={`${project.id}-${i}`} />
              );
            })}
          </Form.Dropdown>
          <Form.Dropdown
            id="devops_team_id"
            title="DevOps team"
            value={adoTeamId ?? ""}
            isLoading={!adoTeams}
            onChange={handleDevOpsTeamChange}
          >
            {adoTeams?.map((team, i) => {
              return <Form.Dropdown.Item value={team.id ?? ""} title={team.name ?? ""} key={`${team.id}-${i}`} />;
            })}
          </Form.Dropdown>
          <Form.Dropdown
            id="devops_work_item_id"
            title="DevOps work item"
            value={devopsWorkItemId ?? ""}
            onChange={handleDevOpsWorkItemChange}
          >
            {workItems?.map((userStory: any, i: number) => {
              return (
                <Form.Dropdown.Section
                  title={`User Story: ${userStory.id} - ${userStory.title}`}
                  key={`${userStory.id}-${i}`}
                >
                  {userStory?.tasks?.map((task: any, i: number) => {
                    return (
                      <Form.Dropdown.Item
                        value={task.id.toString()}
                        title={`${task.id.toString()} - ${task.title}`}
                        key={`${task.id}-${i}`}
                        icon={task.type === "bug" ? Icon.Bug : Icon.Circle}
                      />
                    );
                  })}
                </Form.Dropdown.Section>
              );
            })}
          </Form.Dropdown>
        </>
      )}

      <Form.Separator />

      <Form.TextArea id="notes" title="Notes" value={notes} onChange={setNotes} />
      {company?.wants_timestamp_timers && (
        <>
          <Form.TextField
            id="started_time"
            title="Start Time"
            placeholder="Leave blank to default to now."
            value={startedTime ?? undefined}
            onChange={setStartedTime}
          />
          <Form.TextField
            id="ended_time"
            title="End Time"
            placeholder="Leave blank to start a new timer"
            value={endedTime ?? undefined}
            onChange={setEndedTime}
          />
        </>
      )}
      {!company?.wants_timestamp_timers && (
        <Form.TextField
          id="hours"
          title="Duration"
          placeholder="Enter numbers, or blank to start a new timer"
          value={hours}
          onChange={setHours}
        />
      )}
      <Form.DatePicker
        id="spent_date"
        title="Date"
        type={Form.DatePicker.Type.Date}
        value={spentDate}
        onChange={(newValue) => newValue && setSpentDate(newValue)}
      />
    </Form>
  );
}
