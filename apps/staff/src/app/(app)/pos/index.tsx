import { useEffect, useState } from "react";
import { Alert, Image, Pressable, Text, View, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import { call } from "@sunset/api-client";
import type { Schemas } from "@sunset/api-client/staff";
import { Body, Button, Card, Choice, ErrorText, Label, Loading, Screen, colors } from "@sunset/ui";
import { RequireCapability } from "../../../components/Guard";
import { NotPrintedBanner } from "../../../components/NotPrintedBanner";
import { useLoad } from "../../../lib/hooks";
import { floorTables, tableAction, tableStateLabel } from "../../../lib/pos";
import { useSession, useSignedIn } from "../../../lib/session";
import { API_BASE_URL } from "../../../lib/config";

type MapTable = Schemas["RestaurantMapTable"];

function openTable(table: MapTable) {
  const action = tableAction(table);
  if (action.kind === "open") router.push(`/pos/order/${action.orderId}`);
  else if (action.kind === "start") router.push({ pathname: "/pos/order/[id]", params: { id: "new", tableId: table.tableId } });
  else if (action.kind === "pick") {
    Alert.alert(table.label, "This table has more than one open order.", [
      ...action.orderIds.map((id, i) => ({ text: `Order ${i + 1} (${id.slice(0, 8)})`, onPress: () => router.push(`/pos/order/${id}`) })),
      { text: "Cancel", style: "cancel" as const },
    ]);
  }
}

const fill = (t: MapTable) => (!t.isActive ? colors.ink3 : t.openOrderIds.length > 0 ? colors.ink3 : colors.sea);

export default function Floor() {
  return (
    <RequireCapability capability="pos.use">
      <FloorBody />
    </RequireCapability>
  );
}

function FloorBody() {
  const { api } = useSignedIn();
  const map = useLoad(() => call(api.GET("/restaurant-map"), "Could not load the floor."), [api], { pollMs: 10_000 });
  const [view, setView] = useState<"map" | "list">("list");
  const tables = map.data ? floorTables(map.data.tables) : [];
  const positioned = tables.filter((t) => t.positionX != null && t.positionY != null);
  const canMap = !!map.data?.imagePath && positioned.length > 0;

  return (
    <Screen>
      <NotPrintedBanner />
      <ErrorText>{map.error}</ErrorText>
      {map.loading && !map.data ? <Loading /> : null}
      {canMap ? (
        <Choice
          options={[
            { value: "list", label: "List" },
            { value: "map", label: "Floor plan" },
          ]}
          value={view}
          onChange={setView}
        />
      ) : null}
      {view === "map" && canMap && map.data ? <FloorPlan imageUpdatedAt={map.data.imageUpdatedAt} tables={positioned} /> : <TableList tables={tables} />}
      <Button
        title="New order without a table"
        variant="secondary"
        onPress={() => router.push({ pathname: "/pos/order/[id]", params: { id: "new" } })}
      />
    </Screen>
  );
}

function TableList({ tables }: { tables: MapTable[] }) {
  const zones = [...new Set(tables.map((t) => t.zone))];
  if (tables.length === 0) return <Body muted>No tables are set up for the restaurant floor.</Body>;
  return (
    <>
      {zones.map((zone) => (
        <View key={zone} style={{ gap: 8 }}>
          <Label>{zone.replace("_", " ")}</Label>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {tables
              .filter((t) => t.zone === zone)
              .map((t) => (
                <Pressable
                  key={t.tableId}
                  accessibilityRole="button"
                  accessibilityLabel={`${t.label}, ${tableStateLabel(t)}`}
                  onPress={() => openTable(t)}
                  style={{ width: 104, minHeight: 72, borderRadius: 12, padding: 10, backgroundColor: fill(t), opacity: t.isActive ? 1 : 0.5 }}
                >
                  <Text style={{ color: colors.cream, fontSize: 18, fontWeight: "600" }}>{t.label}</Text>
                  <Text style={{ color: colors.cream, fontSize: 12 }}>{tableStateLabel(t)}</Text>
                </Pressable>
              ))}
          </View>
        </View>
      ))}
    </>
  );
}

function FloorPlan({ tables, imageUpdatedAt }: { tables: MapTable[]; imageUpdatedAt: string | null }) {
  const { authHeaders } = useSession();
  const { width } = useWindowDimensions();
  const [ratio, setRatio] = useState(4 / 3);
  const uri = `${API_BASE_URL}/restaurant-map/image?v=${encodeURIComponent(imageUpdatedAt ?? "")}`;
  const planWidth = width - 32;

  useEffect(() => {
    Image.getSizeWithHeaders(uri, authHeaders(), (w, h) => h > 0 && setRatio(w / h), () => undefined);
  }, [uri, authHeaders]);

  return (
    <Card style={{ padding: 0, overflow: "hidden" }}>
      <View style={{ width: planWidth, height: planWidth / ratio }}>
        <Image source={{ uri, headers: authHeaders() }} style={{ width: "100%", height: "100%" }} resizeMode="stretch" />
        {tables.map((t) => (
          <Pressable
            key={t.tableId}
            accessibilityRole="button"
            accessibilityLabel={`${t.label}, ${tableStateLabel(t)}`}
            onPress={() => openTable(t)}
            hitSlop={8}
            style={{
              position: "absolute",
              left: (t.positionX ?? 0) * planWidth - 22,
              top: (t.positionY ?? 0) * (planWidth / ratio) - 22,
              width: 44,
              height: 44,
              borderRadius: t.shape === "ROUND" ? 22 : 8,
              backgroundColor: fill(t),
              borderWidth: 2,
              borderColor: colors.cream,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: colors.cream, fontWeight: "700", fontSize: 12 }}>{t.label}</Text>
          </Pressable>
        ))}
      </View>
    </Card>
  );
}
