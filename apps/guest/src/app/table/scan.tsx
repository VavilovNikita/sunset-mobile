import { useRef, useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Body, Button, ErrorText, Screen } from "@sunset/ui";
import { SITE_ORIGIN } from "../../lib/config";
import { parseOrderQr } from "../../lib/orderQr";
import { saveTableOrder } from "../../lib/qrSession";

export default function ScanTable() {
  const [permission, requestPermission] = useCameraPermissions();
  const [error, setError] = useState<string | null>(null);
  const handled = useRef(false);

  if (!permission) return <Screen><Body muted>Checking camera access…</Body></Screen>;
  if (!permission.granted) {
    return (
      <Screen>
        <Body>The camera is needed to read the QR code on your table.</Body>
        <Button title="Allow camera" onPress={() => void requestPermission()} />
        {!permission.canAskAgain ? <ErrorText>Camera access is off for this app - turn it on in Settings.</ErrorText> : null}
      </Screen>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={async ({ data }) => {
          if (handled.current) return;
          const parsed = parseOrderQr(data, SITE_ORIGIN ? [SITE_ORIGIN] : []);
          if (!parsed.ok) {
            setError(parsed.reason);
            return;
          }
          handled.current = true;
          await saveTableOrder(parsed.qr);
          router.replace("/table/order");
        }}
      />
      <View style={{ position: "absolute", bottom: 32, left: 16, right: 16 }}>
        <ErrorText>{error}</ErrorText>
      </View>
    </View>
  );
}
