import { useState } from "react";
import { call } from "@sunset/api-client";
import type { Schemas } from "@sunset/api-client/staff";
import { Badge, Body, Button, Card, Choice, ErrorText, Loading, Row, Screen, colors } from "@sunset/ui";
import { RequireCapability } from "../../components/Guard";
import { can } from "../../lib/access";
import { useAction, useLoad } from "../../lib/hooks";
import { useSignedIn } from "../../lib/session";

type Unit = Schemas["RoomUnit"];

export default function Housekeeping() {
  return (
    <RequireCapability capability="housekeeping.view">
      <HousekeepingBody />
    </RequireCapability>
  );
}

function HousekeepingBody() {
  const { api, user } = useSignedIn();
  const units = useLoad(() => call(api.GET("/room-units"), "Could not load rooms."), [api], { pollMs: 30_000 });
  const [show, setShow] = useState<"DIRTY" | "ALL">("DIRTY");
  const change = useAction();
  const [changing, setChanging] = useState<string | null>(null);
  const mayChange = can(user, "housekeeping.change");

  async function setStatus(unit: Unit, housekeepingStatus: Schemas["HousekeepingStatus"]) {
    setChanging(unit.id);
    const r = await change.run(() =>
      call(api.PATCH("/room-units/{id}/housekeeping", { params: { path: { id: unit.id } }, body: { housekeepingStatus } }), "Could not update the room."),
    );
    setChanging(null);
    if (r.ok && units.data) units.apply(units.data.map((u) => (u.id === r.data.id ? r.data : u)));
  }

  const list = (units.data ?? []).filter((u) => u.isActive && (show === "ALL" || u.housekeepingStatus === "DIRTY"));
  return (
    <Screen>
      <Choice
        options={[
          { value: "DIRTY", label: "To clean" },
          { value: "ALL", label: "All rooms" },
        ]}
        value={show}
        onChange={setShow}
      />
      {!mayChange ? <Body muted>You can see the board; a cashier or above marks rooms clean.</Body> : null}
      <ErrorText>{units.error}</ErrorText>
      <ErrorText>{change.error}</ErrorText>
      {units.loading && !units.data ? <Loading /> : null}
      {units.data && list.length === 0 ? <Body muted>{show === "DIRTY" ? "Every room is clean." : "No rooms."}</Body> : null}
      {list.map((unit) => (
        <Card key={unit.id} accent={unit.housekeepingStatus === "DIRTY" ? colors.sand : colors.sea}>
          <Row style={{ justifyContent: "space-between" }}>
            <Body>{`Room ${unit.label}`}</Body>
            <Badge text={unit.housekeepingStatus === "DIRTY" ? "Not cleaned" : "Clean"} color={unit.housekeepingStatus === "DIRTY" ? colors.coralDeep : colors.sea} />
          </Row>
          {mayChange ? (
            <Button
              title={unit.housekeepingStatus === "DIRTY" ? "Mark clean" : "Mark not cleaned"}
              variant="secondary"
              busy={changing === unit.id}
              disabled={change.busy}
              onPress={() => void setStatus(unit, unit.housekeepingStatus === "DIRTY" ? "CLEAN" : "DIRTY")}
            />
          ) : null}
        </Card>
      ))}
    </Screen>
  );
}
