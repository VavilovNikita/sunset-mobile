import { useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { call, type ApiResult } from "@sunset/api-client";
import type { Schemas } from "@sunset/api-client/guest";
import { addDays, formatBaht, formatDate, formatDateRange, hotelDateKey } from "@sunset/core";
import { Body, Button, Card, ErrorText, Field, Label, Loading, Row, Screen, Title, colors } from "@sunset/ui";
import { useAction, useLoad } from "../../lib/hooks";
import { useApi, useSession } from "../../lib/session";
import { MAX_STAY_NIGHTS, validateGuestDetails, validateStay } from "../../lib/stay";

type Quote = Schemas["BookingScheduleQuote"];

export default function RoomDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const api = useApi();
  const { account } = useSession();
  const today = hotelDateKey(new Date());
  const room = useLoad(() => call(api.GET("/public/rooms/{id}", { params: { path: { id } } }), "Could not load the room."), [api, id]);

  const [checkIn, setCheckIn] = useState(addDays(today, 1));
  const [nights, setNights] = useState(2);
  const checkOut = addDays(checkIn, nights);
  const stayProblem = validateStay(checkIn, checkOut, today);

  // The price comes only from the server (GET /public/rooms/{id}/quote) - never a sum of nightly
  // prices worked out here (audit finding M14).
  const [quote, setQuote] = useState<ApiResult<Quote> | null>(null);
  useEffect(() => {
    if (stayProblem) return;
    let current = true;
    setQuote(null);
    const timer = setTimeout(async () => {
      const r = await call(api.GET("/public/rooms/{id}/quote", { params: { path: { id }, query: { checkIn, checkOut } } }), "Could not get a price.");
      if (current) setQuote(r);
    }, 300);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [api, id, checkIn, checkOut, stayProblem]);

  const [name, setName] = useState(account?.name ?? "");
  const [email, setEmail] = useState(account?.email ?? "");
  const [phone, setPhone] = useState("");
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);
  const [booked, setBooked] = useState<Schemas["Booking"] | null>(null);
  const book = useAction();

  if (room.loading && !room.data) return <Loading />;
  if (!room.data) return <Screen><ErrorText>{room.error ?? "Room not found."}</ErrorText></Screen>;
  const r = room.data;

  if (booked) {
    return (
      <Screen>
        <Title>Request sent</Title>
        <Body>{`${r.name}, ${formatDateRange(booked.checkIn, booked.checkOut)}`}</Body>
        <Body>{`Total: ${formatBaht(booked.totalPrice)}`}</Body>
        <Body muted>The hotel will confirm by email. Unconfirmed requests are released after two business days.</Body>
        <Button title="Done" onPress={() => router.replace("/")} />
      </Screen>
    );
  }

  const available = quote?.ok && quote.data.available;
  return (
    <Screen>
      <Title>{r.name}</Title>
      <Body muted>{r.description}</Body>
      <Card>
        <Label>Check-in</Label>
        <Row style={{ justifyContent: "space-between" }}>
          <Button title="‹" variant="secondary" onPress={() => setCheckIn(addDays(checkIn, -1))} disabled={checkIn <= today} />
          <Body>{formatDate(checkIn)}</Body>
          <Button title="›" variant="secondary" onPress={() => setCheckIn(addDays(checkIn, 1))} />
        </Row>
        <Label>Nights</Label>
        <Row style={{ justifyContent: "space-between" }}>
          <Button title="−" variant="secondary" onPress={() => setNights(nights - 1)} disabled={nights <= 1} />
          <Body>{`${nights} · out ${formatDate(checkOut)}`}</Body>
          <Button title="+" variant="secondary" onPress={() => setNights(nights + 1)} disabled={nights >= MAX_STAY_NIGHTS} />
        </Row>
      </Card>
      <ErrorText>{stayProblem}</ErrorText>
      {!stayProblem && !quote ? <Loading label="Getting the price…" /> : null}
      {quote && !quote.ok ? <ErrorText>{quote.error}</ErrorText> : null}
      {quote?.ok ? (
        <Card accent={quote.data.available ? colors.sea : colors.coral}>
          <Body>{`${formatBaht(quote.data.totalPrice)} for ${quote.data.nights} night${quote.data.nights === 1 ? "" : "s"}`}</Body>
          {!quote.data.available ? <ErrorText>{quote.data.reason ?? "Not available for these dates."}</ErrorText> : null}
        </Card>
      ) : null}

      {available ? (
        <>
          <Field label="Name" value={name} onChangeText={setName} autoComplete="name" />
          <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
          <Field label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" />
          <Row style={{ justifyContent: "space-between" }}>
            <Body>{`Adults: ${adults}`}</Body>
            <Row>
              <Button title="−" variant="secondary" onPress={() => setAdults(adults - 1)} disabled={adults <= 1} />
              <Button title="+" variant="secondary" onPress={() => setAdults(adults + 1)} disabled={adults + children >= r.capacity} />
            </Row>
          </Row>
          <Row style={{ justifyContent: "space-between" }}>
            <Body>{`Children: ${children}`}</Body>
            <Row>
              <Button title="−" variant="secondary" onPress={() => setChildren(children - 1)} disabled={children <= 0} />
              <Button title="+" variant="secondary" onPress={() => setChildren(children + 1)} disabled={adults + children >= r.capacity} />
            </Row>
          </Row>
          <Button
            title="Request booking"
            busy={book.busy}
            onPress={async () => {
              const problem = validateGuestDetails({ name, email, phone, adults, children }, r.capacity);
              setFormError(problem);
              if (problem) return;
              const res = await book.run(() =>
                call(
                  api.POST("/bookings", {
                    body: { roomId: r.id, guestName: name.trim(), guestEmail: email.trim(), guestPhone: phone.trim(), checkIn, checkOut, adults, children },
                  }),
                  "Could not send the booking.",
                ),
              );
              if (res.ok) setBooked(res.data);
            }}
          />
          <ErrorText>{formError ?? book.error}</ErrorText>
        </>
      ) : null}
    </Screen>
  );
}
