import { showToast, Toast, showHUD } from "@raycast/api";
import { stopTimer } from "./services/harvest";
import { stopAdoWorkItemTimer } from "./devops/functions";

export default async function main() {
  const toast = await showToast({ style: Toast.Style.Animated, title: "Loading..." });
  await toast.show();
  await stopTimer(undefined, stopAdoWorkItemTimer).catch(async (error) => {
    console.error(error.response.data);
    await toast.hide();
    await showToast({
      style: Toast.Style.Failure,
      title: "API Error",
      message: "Could not stop your timer",
    });
    return;
  });
  await toast.hide();
  await showHUD("Timer stopped");
}
