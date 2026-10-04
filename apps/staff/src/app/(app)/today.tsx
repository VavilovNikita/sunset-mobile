import { View } from "react-native";
import { call } from "@sunset/api-client";
import { formatDate, hotelDateKey } from "@sunset/core";
import type { Schemas } from "@sunset/api-client/staff";
import { Body, ErrorText, Label, Loading, Screen, Title } from "@sunset/ui";
import { RequireCapability } from "../../components/Guard";
import { BookingRow } from "../../components/BookingRow";
import { useLoad } from "../../lib/hooks";
import { useSignedIn } from "../../lib/session";

export default function Today() {
  return (
    <RequireCapability capability="frontdesk">
      <TodayBody />
    </RequireCapability>
  );
}

function Section({ title, empty, rows, showDirty }: { title: string; empty: string; rows: Schemas["TodayBoardEntry"][]; showDirty?: boolean }) {
  return (
    <View style={{ gap: 8 }}>
      <Label>{`${title} (${rows.length})`}</Label>
      {rows.length === 0 ? <Body muted>{empty}</Body> : null}
      {rows.map((row) => (
        <BookingRow key={row.booking.id} booking={row.booking} outstandingBalance={row.outstandingBalance} overdueDays={row.overdueDays} showDirty={showDirty} />
      ))}
    </View>
  );
}

/** The front desk's day (GET /bookings/today): who arrives, who leaves, who is in the house. */
function TodayBody() {
  const { api } = useSignedIn();
  const board = useLoad(() => call(api.GET("/bookings/today"), "Could not load today's board."), [api], { pollMs: 30_000 });
  return (
    <Screen>
      <Title>{`Today · ${formatDate(hotelDateKey(new Date()))}`}</Title>
      <ErrorText>{board.error}</ErrorText>
      {board.loading && !board.data ? <Loading /> : null}
      {board.data ? (
        <>
          <Section title="Arriving" empty="No arrivals today." rows={board.data.arrivingToday} showDirty />
          <Section title="Departing" empty="No departures today." rows={board.data.departingToday} />
          <Section title="In house" empty="Nobody is in the house." rows={board.data.inHouse} />
        </>
      ) : null}
    </Screen>
  );
}
