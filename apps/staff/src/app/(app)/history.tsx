import { useState } from "react";
import { call } from "@sunset/api-client";
import { formatTimestamp } from "@sunset/core";
import { Body, Button, Card, ErrorText, Field, Loading, Screen } from "@sunset/ui";
import { RequireCapability } from "../../components/Guard";
import { actorLabel } from "../../lib/reports";
import { useLoad } from "../../lib/hooks";
import { useSignedIn } from "../../lib/session";

export default function History() {
  return (
    <RequireCapability capability="reports">
      <HistoryBody />
    </RequireCapability>
  );
}

const PAGE = 30;

/** The audit log, newest first (GET /audit-log), optionally for one person. */
function HistoryBody() {
  const { api } = useSignedIn();
  const [typed, setTyped] = useState("");
  const [actor, setActor] = useState("");
  const [pages, setPages] = useState(1);
  const log = useLoad(
    () => call(api.GET("/audit-log", { params: { query: { actorEmail: actor || undefined, page: 0, pageSize: Math.min(PAGE * pages, 200) } } }), "Could not load the history."),
    [api, actor, pages],
  );
  return (
    <Screen>
      <Field label="Staff email (optional)" value={typed} onChangeText={setTyped} autoCapitalize="none" keyboardType="email-address" onSubmitEditing={() => { setPages(1); setActor(typed.trim()); }} />
      <Button title="Filter" variant="secondary" onPress={() => { setPages(1); setActor(typed.trim()); }} />
      <ErrorText>{log.error}</ErrorText>
      {log.loading && !log.data ? <Loading /> : null}
      {log.data?.items.length === 0 ? <Body muted>Nothing recorded.</Body> : null}
      {log.data?.items.map((e) => (
        <Card key={e.id}>
          <Body>{e.summary}</Body>
          <Body muted>{`${formatTimestamp(e.createdAt)} · ${actorLabel(e.actorEmail, e.actorRole)}`}</Body>
        </Card>
      ))}
      {log.data && log.data.items.length < log.data.totalCount && log.data.items.length < 200 ? (
        <Button title={`Show more (${log.data.items.length} of ${log.data.totalCount})`} variant="secondary" busy={log.loading} onPress={() => setPages((p) => p + 1)} />
      ) : null}
    </Screen>
  );
}
