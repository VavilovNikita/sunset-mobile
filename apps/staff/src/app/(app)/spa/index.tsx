import { useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { call } from "@sunset/api-client";
import type { Schemas } from "@sunset/api-client/staff";
import { formatClock, hotelDateKey } from "@sunset/core";
import { Body, Button, ErrorText, Field, Label, Loading, Screen, Title, colors } from "@sunset/ui";
import { DateStepper } from "../../../components/DateStepper";
import { RequireCapability } from "../../../components/Guard";
import { useAction, useLoad } from "../../../lib/hooks";
import { appointmentAt, fromMinutes, slotStarts, toMinutes } from "../../../lib/spa";
import { useSignedIn } from "../../../lib/session";

type Appointment = Schemas["SpaAppointment"];

export default function SpaSchedule() {
  return (
    <RequireCapability capability="spa.use">
      <SpaBody />
    </RequireCapability>
  );
}

const CELL_W = 112;
const CELL_H = 44;

function SpaBody() {
  const { api } = useSignedIn();
  const params = useLocalSearchParams<{ date?: string }>();
  const [date, setDate] = useState(params.date ?? hotelDateKey(new Date()));
  const schedule = useLoad(() => call(api.GET("/spa-appointments", { params: { query: { date } } }), "Could not load the spa schedule."), [api, date], {
    pollMs: 30_000,
  });
  const [selected, setSelected] = useState<Appointment | null>(null);
  const data = schedule.data?.date === date ? schedule.data : null;

  return (
    <Screen>
      <DateStepper value={date} onChange={setDate} />
      <ErrorText>{schedule.error}</ErrorText>
      {!data && schedule.loading ? <Loading /> : null}
      {data && data.tables.length === 0 ? <Body muted>No spa tables are set up.</Body> : null}
      {data && data.tables.length > 0 ? (
        <ScrollView horizontal>
          <View>
            <View style={{ flexDirection: "row" }}>
              <View style={{ width: 56 }} />
              {data.tables.map((t) => (
                <View key={t.id} style={{ width: CELL_W, padding: 4 }}>
                  <Label>{t.label}</Label>
                </View>
              ))}
            </View>
            {slotStarts(data).map((slot) => (
              <View key={slot} style={{ flexDirection: "row" }}>
                <View style={{ width: 56, height: CELL_H, justifyContent: "center" }}>
                  <Text style={{ color: colors.creamMuted, fontSize: 12 }}>{slot}</Text>
                </View>
                {data.tables.map((t) => {
                  const appt = appointmentAt(data.appointments, t.id, slot);
                  const starts = appt && formatClock(appt.startTime) === slot;
                  return (
                    <Pressable
                      key={t.id}
                      role="button"
                      aria-label={appt ? `${appt.guestName} at ${formatClock(appt.startTime)} on ${t.label}` : `Book ${t.label} at ${slot}`}
                      onPress={() =>
                        appt ? setSelected(appt) : router.push({ pathname: "/spa/book", params: { date, tableId: t.id, startTime: slot } })
                      }
                      style={{
                        width: CELL_W,
                        height: CELL_H,
                        borderWidth: 0.5,
                        borderColor: colors.creamFaint,
                        backgroundColor: appt ? (appt.status === "COMPLETED" ? colors.ink3 : colors.slate) : colors.ink,
                        padding: 4,
                      }}
                    >
                      {starts ? (
                        <Text numberOfLines={2} style={{ color: colors.cream, fontSize: 12 }}>
                          {`${appt.missingTreatmentNames.length > 0 ? "⚠ " : ""}${appt.guestName} · ${appt.therapistName}`}
                        </Text>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
        </ScrollView>
      ) : null}
      {data ? <Body muted>{`Open ${formatClock(data.openingTime)}–${formatClock(data.closingTime)}. Tap a free cell to book, a booking to change it.`}</Body> : null}
      {selected ? <AppointmentSheet appointment={selected} onClose={() => setSelected(null)} onChanged={() => void schedule.reload()} /> : null}
    </Screen>
  );
}

function AppointmentSheet({ appointment, onClose, onChanged }: { appointment: Appointment; onClose: () => void; onChanged: () => void }) {
  const { api } = useSignedIn();
  const action = useAction();
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");
  const end = fromMinutes(toMinutes(appointment.startTime) + appointment.durationMinutes);

  async function setStatus(status: Schemas["SpaAppointmentStatus"], cancelReason?: string) {
    const r = await action.run(() =>
      call(
        api.PATCH("/spa-appointments/{id}/status", { params: { path: { id: appointment.id } }, body: { status, ...(cancelReason ? { cancelReason } : {}) } }),
        "Could not update the appointment.",
      ),
    );
    if (r.ok) {
      onChanged();
      onClose();
    }
  }

  // The billing door: one POS order explicitly linked to this appointment (spaAppointmentId), on the
  // guest's booking, with one line per treatment priced live by the server - created in a single
  // request, so the link can never exist without the lines (the web does it in two calls).
  async function bill() {
    const r = await action.run(() =>
      call(
        api.POST("/orders", {
          body: {
            spaAppointmentId: appointment.id,
            bookingId: appointment.bookingId,
            guestName: appointment.guestName,
            items: appointment.treatments.map((t) => ({ menuItemId: t.treatmentMenuItemId, quantity: 1 })),
          },
        }),
        "Could not open a bill for this appointment.",
      ),
    );
    if (r.ok) {
      onChanged();
      onClose();
      router.push(`/pos/order/${r.data.id}`);
    }
  }

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" }}>
        <View style={{ backgroundColor: colors.ink2, padding: 16, gap: 10, borderTopLeftRadius: 16, borderTopRightRadius: 16 }}>
          <Title>{appointment.guestName}</Title>
          <Body>{`${formatClock(appointment.startTime)}–${end} · ${appointment.tableLabel} · ${appointment.therapistName}`}</Body>
          <Body muted>{appointment.treatments.map((t) => t.treatmentName).join(", ")}</Body>
          <Label>{appointment.status}</Label>
          {appointment.missingTreatmentNames.length > 0 ? (
            <ErrorText>{`Not billed yet: ${appointment.missingTreatmentNames.join(", ")}`}</ErrorText>
          ) : null}
          {appointment.status === "BOOKED" && !cancelling ? (
            <>
              <Button title="Completed" busy={action.busy} onPress={() => void setStatus("COMPLETED")} />
              <Button title="No-show" variant="secondary" disabled={action.busy} onPress={() => void setStatus("NO_SHOW")} />
              <Button title="Cancel booking" variant="danger" disabled={action.busy} onPress={() => setCancelling(true)} />
            </>
          ) : null}
          {cancelling ? (
            <>
              <Field label="Why is it cancelled?" value={reason} onChangeText={setReason} maxLength={500} />
              <Button title="Cancel booking" variant="danger" busy={action.busy} disabled={reason.trim().length < 3} onPress={() => void setStatus("CANCELLED", reason.trim())} />
            </>
          ) : null}
          {appointment.orderId ? (
            <Button
              title="Open bill"
              variant="secondary"
              onPress={() => {
                onClose();
                router.push(`/pos/order/${appointment.orderId}`);
              }}
            />
          ) : appointment.status === "BOOKED" || appointment.status === "COMPLETED" ? (
            <Button title="Bill treatments" variant="secondary" busy={action.busy} onPress={() => void bill()} />
          ) : null}
          <ErrorText>{action.error}</ErrorText>
          <Button title="Close" variant="secondary" onPress={onClose} disabled={action.busy} />
        </View>
      </View>
    </Modal>
  );
}
