import { Image } from "react-native";
import { router } from "expo-router";
import { call } from "@sunset/api-client";
import { formatBaht } from "@sunset/core";
import { Body, Card, ErrorText, Loading, Screen } from "@sunset/ui";
import { roomImageUrl } from "../../lib/config";
import { useLoad } from "../../lib/hooks";
import { useApi } from "../../lib/session";

export default function Rooms() {
  const api = useApi();
  const rooms = useLoad(() => call(api.GET("/public/rooms"), "Could not load rooms."), [api]);
  return (
    <Screen>
      <ErrorText>{rooms.error}</ErrorText>
      {rooms.loading && !rooms.data ? <Loading /> : null}
      {(rooms.data ?? []).map((room) => {
        const image = roomImageUrl(room.images[0]);
        return (
          <Card key={room.id} onPress={() => router.push(`/rooms/${room.id}`)}>
            {image ? <Image source={{ uri: image }} style={{ width: "100%", height: 160, borderRadius: 8 }} accessibilityLabel={room.name} /> : null}
            <Body>{room.name}</Body>
            {/* The listed base rate as the server stores it - the price for real dates comes from the quote. */}
            <Body muted>{`From ${formatBaht(room.basePrice)} a night · sleeps ${room.capacity}`}</Body>
          </Card>
        );
      })}
    </Screen>
  );
}
