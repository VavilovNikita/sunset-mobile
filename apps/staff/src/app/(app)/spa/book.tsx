import { useMemo, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { call } from "@sunset/api-client";
import { formatBaht, formatDate } from "@sunset/core";
import { Body, Button, Choice, ErrorText, Loading, Screen, Title } from "@sunset/ui";
import { RequireCapability } from "../../../components/Guard";
import { useAction, useLoad } from "../../../lib/hooks";
import { fitsOnTable, therapistBusy } from "../../../lib/spa";
import { useSignedIn } from "../../../lib/session";

export default function BookTreatment() {
  return (
    <RequireCapability capability="spa.use">
      <BookBody />
    </RequireCapability>
  );
}

function BookBody() {
  const { api } = useSignedIn();
  const { date, tableId, startTime } = useLocalSearchParams<{ date: string; tableId: string; startTime: string }>();
  const schedule = useLoad(() => call(api.GET("/spa-appointments", { params: { query: { date } } }), "Could not load the schedule."), [api, date]);
  const therapists = useLoad(() => call(api.GET("/spa-appointments/therapists"), "Could not load therapists."), [api]);
  const menu = useLoad(() => call(api.GET("/menu"), "Could not load treatments."), [api]);
  // Guests staying that night (in house on `date`); the server re-checks and warns if the date is outside the stay.
  const guests = useLoad(() => call(api.GET("/bookings", { params: { query: { from: date, to: date } } }), "Could not load guests."), [api, date]);

  const [bookingId, setBookingId] = useState<string | null>(null);
  const [treatmentId, setTreatmentId] = useState<string | null>(null);
  const [therapistId, setTherapistId] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const save = useAction();

  const treatments = useMemo(() => (menu.data ?? []).filter((m) => m.department === "SPA" && m.isAvailable && m.durationMinutes), [menu.data]);
  const treatment = treatments.find((t) => t.id === treatmentId) ?? null;
  const appointments = schedule.data?.appointments ?? [];
  const table = schedule.data?.tables.find((t) => t.id === tableId);
  const fits = treatment && schedule.data ? fitsOnTable(appointments, tableId, startTime, treatment.durationMinutes ?? 0, schedule.data.closingTime) : true;

  const loading = [schedule, therapists, menu, guests].some((l) => l.loading && !l.data);
  const error = schedule.error ?? therapists.error ?? menu.error ?? guests.error;

  return (
    <Screen>
      <Title>{`${table?.label ?? "Table"} · ${formatDate(date)} ${startTime}`}</Title>
      {loading ? <Loading /> : null}
      <ErrorText>{error}</ErrorText>
      <Choice
        label="Guest"
        options={(guests.data ?? []).filter((b) => b.status !== "CANCELLED").map((b) => ({ value: b.id, label: b.guestName, hint: b.roomUnit?.label ?? b.room.name }))}
        value={bookingId}
        onChange={setBookingId}
      />
      {guests.data?.length === 0 ? <Body muted>No guests are staying that night.</Body> : null}
      <Choice
        label="Treatment"
        options={treatments.map((t) => ({ value: t.id, label: t.name, hint: `${t.durationMinutes} min · ${formatBaht(t.price)}` }))}
        value={treatmentId}
        onChange={setTreatmentId}
      />
      {!fits ? <ErrorText>This treatment runs into the next booking on this table or past closing.</ErrorText> : null}
      <Choice
        label="Therapist"
        options={(therapists.data ?? []).map((t) => {
          const busy = treatment ? therapistBusy(appointments, t.id, startTime, treatment.durationMinutes ?? 0) : undefined;
          return { value: t.id, label: t.name, disabled: !!busy, hint: busy ? `busy with ${busy.guestName}` : undefined };
        })}
        value={therapistId}
        onChange={setTherapistId}
      />
      <Button
        title="Book"
        busy={save.busy}
        disabled={!bookingId || !treatmentId || !therapistId || !fits}
        onPress={async () => {
          if (!bookingId || !treatmentId || !therapistId) return;
          const r = await save.run(() =>
            call(
              api.POST("/spa-appointments", { body: { bookingId, tableId, therapistUserId: therapistId, treatmentMenuItemId: treatmentId, date, startTime } }),
              "Could not book the treatment.",
            ),
          );
          if (r.ok) {
            if (r.data.warning) setWarning(r.data.warning);
            else router.back();
          }
        }}
      />
      <ErrorText>{save.error}</ErrorText>
      {warning ? (
        <>
          <Body>{`Booked. Note: ${warning}`}</Body>
          <Button title="Back to the schedule" variant="secondary" onPress={() => router.back()} />
        </>
      ) : null}
    </Screen>
  );
}
