import { useState } from "react";
import { router } from "expo-router";
import { call } from "@sunset/api-client";
import type { Schemas } from "@sunset/api-client/staff";
import { Body, Button, Choice, ErrorText, Field, Loading, Screen } from "@sunset/ui";
import { RequireCapability } from "../../../components/Guard";
import { BookingRow } from "../../../components/BookingRow";
import { useLoad } from "../../../lib/hooks";
import { useSignedIn } from "../../../lib/session";

export default function Bookings() {
  return (
    <RequireCapability capability="frontdesk">
      <BookingsBody />
    </RequireCapability>
  );
}

type StatusFilter = "ALL" | Schemas["BookingStatus"];
const PAGE_SIZE = 25;

/** Search by guest, email, phone or reference (GET /bookings/search), newest arrivals first. */
function BookingsBody() {
  const { api } = useSignedIn();
  const [typed, setTyped] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [pages, setPages] = useState(1);
  const list = useLoad(
    () =>
      call(
        api.GET("/bookings/search", {
          params: { query: { q: q || undefined, status: status === "ALL" ? undefined : status, sort: "CHECK_IN", direction: "DESC", page: 0, pageSize: Math.min(PAGE_SIZE * pages, 200) } },
        }),
        "Could not search bookings.",
      ),
    [api, q, status, pages],
  );
  const search = () => {
    setPages(1);
    setQ(typed.trim());
  };
  return (
    <Screen>
      <Button title="New booking" onPress={() => router.push("/bookings/new")} />
      <Field label="Guest, email, phone or reference" value={typed} onChangeText={setTyped} onSubmitEditing={search} returnKeyType="search" autoCapitalize="none" />
      <Button title="Search" variant="secondary" onPress={search} />
      <Choice
        options={[
          { value: "ALL", label: "All" },
          { value: "NEW", label: "New" },
          { value: "CONFIRMED", label: "Confirmed" },
          { value: "PAID", label: "Paid" },
          { value: "CANCELLED", label: "Cancelled" },
        ]}
        value={status}
        onChange={(v) => {
          setPages(1);
          setStatus(v);
        }}
      />
      <ErrorText>{list.error}</ErrorText>
      {list.loading && !list.data ? <Loading /> : null}
      {list.data?.items.length === 0 ? <Body muted>No bookings match.</Body> : null}
      {list.data?.items.map((b) => <BookingRow key={b.id} booking={b} />)}
      {list.data && list.data.items.length < list.data.totalCount && list.data.items.length < 200 ? (
        <Button title={`Show more (${list.data.items.length} of ${list.data.totalCount})`} variant="secondary" busy={list.loading} onPress={() => setPages((p) => p + 1)} />
      ) : null}
    </Screen>
  );
}
