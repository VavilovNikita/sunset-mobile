import { call } from "@sunset/api-client";
import { formatTimestamp } from "@sunset/core";
import { Body, Button, Card, ErrorText, Loading, Screen, colors } from "@sunset/ui";
import { RequireCapability } from "../../../components/Guard";
import { ask } from "../../../lib/ask";
import { useAction, useLoad } from "../../../lib/hooks";
import { useSignedIn } from "../../../lib/session";

export default function Devices() {
  return (
    <RequireCapability capability="settings.manage">
      <DevicesBody />
    </RequireCapability>
  );
}

/** Fingerprint terminals: when each was last polled, and a full re-read after its clock jumped back. */
function DevicesBody() {
  const { api } = useSignedIn();
  const devices = useLoad(() => call(api.GET("/attendance/devices"), "Could not load terminals."), [api], { pollMs: 60_000 });
  const write = useAction();
  async function resync(id: string) {
    const r = await write.run(() => call(api.POST("/attendance/devices/{id}/resync", { params: { path: { id } } }), "Could not resync."));
    if (r.ok && devices.data) devices.apply(devices.data.map((d) => (d.id === r.data.id ? r.data : d)));
  }
  return (
    <Screen>
      <ErrorText>{devices.error}</ErrorText>
      <ErrorText>{write.error}</ErrorText>
      {devices.loading && !devices.data ? <Loading /> : null}
      {devices.data?.length === 0 ? <Body muted>No terminals are set up.</Body> : null}
      {devices.data?.map((d) => (
        <Card key={d.id} accent={d.active ? colors.sea : colors.ink3}>
          <Body>{d.name}</Body>
          <Body muted>{`${d.address}:${d.port} · ${d.active ? "polled" : "switched off"}`}</Body>
          <Body muted>{`Last read: ${d.lastSeenAt ? formatTimestamp(d.lastSeenAt) : "never"}`}</Body>
          <Button
            title="Re-read everything"
            variant="secondary"
            disabled={write.busy || !d.active}
            onPress={() => ask("Resync terminal", `Read ${d.name}'s whole punch log again? Use it after the terminal's clock was reset. Punches already recorded aren't duplicated.`, [{ text: "Cancel", style: "cancel" }, { text: "Resync", onPress: () => void resync(d.id) }])}
          />
        </Card>
      ))}
    </Screen>
  );
}
