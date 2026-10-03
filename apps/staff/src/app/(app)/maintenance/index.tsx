import { Image, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { call } from "@sunset/api-client";
import type { Schemas } from "@sunset/api-client/staff";
import { formatTimestamp } from "@sunset/core";
import { Badge, Body, Button, Card, ErrorText, Loading, Row, Screen, colors } from "@sunset/ui";
import { RequireCapability } from "../../../components/Guard";
import { can } from "../../../lib/access";
import { API_BASE_URL } from "../../../lib/config";
import { useAction, useLoad } from "../../../lib/hooks";
import { useSession, useSignedIn } from "../../../lib/session";
import { useState } from "react";
import { Alert } from "react-native";

type Task = Schemas["MaintenanceTask"];

const statusColor = { OPEN: colors.coral, IN_PROGRESS: colors.amber, DONE: colors.green } as const;

export default function Maintenance() {
  return (
    <RequireCapability capability="maintenance.view">
      <MaintenanceBody />
    </RequireCapability>
  );
}

function MaintenanceBody() {
  const { api, user } = useSignedIn();
  const tasks = useLoad(() => call(api.GET("/maintenance-tasks"), "Could not load maintenance tasks."), [api], { pollMs: 60_000 });
  const change = useAction();
  const [changing, setChanging] = useState<string | null>(null);
  const mayChange = can(user, "maintenance.changeStatus");

  async function setStatus(task: Task, status: Schemas["MaintenanceTaskStatus"]) {
    setChanging(task.id);
    const r = await change.run(() =>
      call(api.PATCH("/maintenance-tasks/{id}/status", { params: { path: { id: task.id } }, body: { status } }), "Could not update the task."),
    );
    setChanging(null);
    if (r.ok && tasks.data) tasks.apply(tasks.data.map((t) => (t.id === r.data.id ? r.data : t)));
  }

  const open = (tasks.data ?? []).filter((t) => t.status !== "DONE");
  return (
    <Screen>
      <Button title="Report a problem" onPress={() => router.push("/maintenance/new")} />
      <ErrorText>{tasks.error}</ErrorText>
      <ErrorText>{change.error}</ErrorText>
      {tasks.loading && !tasks.data ? <Loading /> : null}
      {tasks.data && open.length === 0 ? <Body muted>No open tasks.</Body> : null}
      {open.map((task) => (
        <Card key={task.id} accent={statusColor[task.status]}>
          <Row style={{ justifyContent: "space-between" }}>
            <Body>{`${task.roomName} · ${task.unitLabel}`}</Body>
            <Badge text={task.status.replace("_", " ")} color={statusColor[task.status]} />
          </Row>
          <Body>{task.description}</Body>
          <Body muted>{`${task.reportedByEmail} · ${formatTimestamp(task.createdAt)}`}</Body>
          {task.photos.length > 0 ? <Photos paths={task.photos} /> : null}
          {mayChange ? (
            <Row>
              {task.status === "OPEN" ? (
                <Button title="Start" variant="secondary" busy={changing === task.id} disabled={change.busy} onPress={() => void setStatus(task, "IN_PROGRESS")} />
              ) : null}
              <Button
                title="Mark done"
                busy={changing === task.id}
                disabled={change.busy}
                onPress={() =>
                  Alert.alert("Mark done", `${task.description} in ${task.unitLabel}?`, [
                    { text: "Cancel", style: "cancel" },
                    { text: "Done", onPress: () => void setStatus(task, "DONE") },
                  ])
                }
              />
            </Row>
          ) : null}
        </Card>
      ))}
    </Screen>
  );
}

/** Photos are staff-only (never /uploads/**), so each image request carries the session token. */
function Photos({ paths }: { paths: string[] }) {
  const { authHeaders } = useSession();
  return (
    <ScrollView horizontal contentContainerStyle={{ gap: 8 }}>
      {paths.map((path) => (
        <View key={path} style={{ width: 96, height: 96, borderRadius: 8, overflow: "hidden", backgroundColor: colors.ink3 }}>
          <Image source={{ uri: `${API_BASE_URL}${path}`, headers: authHeaders() }} style={{ width: 96, height: 96 }} accessibilityLabel="Task photo" />
        </View>
      ))}
    </ScrollView>
  );
}
