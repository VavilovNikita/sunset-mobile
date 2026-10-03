import { useState } from "react";
import { Image, Pressable, View } from "react-native";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { call } from "@sunset/api-client";
import { Body, Button, Choice, ErrorText, Field, Loading, Row, Screen, colors } from "@sunset/ui";
import { RequireCapability } from "../../../components/Guard";
import { useAction, useLoad } from "../../../lib/hooks";
import { useSession, useSignedIn } from "../../../lib/session";
import { createMaintenanceTask, type PhotoFile } from "../../../lib/upload";

const MAX_PHOTOS = 4;

export default function NewTask() {
  return (
    <RequireCapability capability="maintenance.report">
      <NewTaskBody />
    </RequireCapability>
  );
}

function NewTaskBody() {
  const { api } = useSignedIn();
  const { authHeaders, signOut } = useSession();
  const units = useLoad(() => call(api.GET("/room-units"), "Could not load rooms."), [api]);
  const [unitId, setUnitId] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<PhotoFile[]>([]);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const submit = useAction();

  async function takePhoto() {
    setCameraError(null);
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setCameraError("Camera access is off for this app — allow it in Settings to add a photo.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.6, exif: false });
    const asset = result.canceled ? undefined : result.assets[0];
    if (!asset) return;
    setPhotos((list) => [
      ...list,
      { uri: asset.uri, name: asset.fileName ?? `photo-${Date.now()}.jpg`, type: asset.mimeType ?? "image/jpeg" },
    ]);
  }

  return (
    <Screen>
      {units.loading && !units.data ? <Loading /> : null}
      <ErrorText>{units.error}</ErrorText>
      <Choice
        label="Room"
        options={(units.data ?? []).filter((u) => u.isActive).map((u) => ({ value: u.id, label: u.label }))}
        value={unitId}
        onChange={setUnitId}
      />
      <Field label="What's wrong?" value={description} onChangeText={setDescription} multiline maxLength={1000} style={{ minHeight: 96 }} />
      <Row style={{ flexWrap: "wrap" }}>
        {photos.map((p, i) => (
          <Pressable key={p.uri} aria-label="Remove photo" onPress={() => setPhotos((list) => list.filter((_, j) => j !== i))}>
            <Image source={{ uri: p.uri }} style={{ width: 72, height: 72, borderRadius: 8 }} />
          </Pressable>
        ))}
      </Row>
      {photos.length > 0 ? <Body muted>Tap a photo to remove it.</Body> : null}
      <Button title="Take a photo" variant="secondary" onPress={() => void takePhoto()} disabled={photos.length >= MAX_PHOTOS} />
      <ErrorText>{cameraError}</ErrorText>
      <View style={{ height: 8, backgroundColor: colors.ink }} />
      <Button
        title="Report"
        busy={submit.busy}
        disabled={!unitId || !description.trim()}
        onPress={async () => {
          if (!unitId) return;
          const r = await submit.run(() =>
            createMaintenanceTask({ roomUnitId: unitId, description: description.trim(), photos }, authHeaders(), () => void signOut("Your session ended — please sign in again.")),
          );
          if (r.ok) router.back();
        }}
      />
      <ErrorText>{submit.error}</ErrorText>
    </Screen>
  );
}
