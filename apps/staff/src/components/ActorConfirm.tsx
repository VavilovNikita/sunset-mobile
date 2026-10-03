import { Alert } from "react-native";

/**
 * The phone changes hands on the floor, so money actions name who they'll be recorded as before
 * they run - same idea as the web /pos "will be recorded as" check (sunset-beach PosAttributedConfirm).
 */
export function confirmAsActor(title: string, detail: string, actorName: string, onConfirm: () => void, confirmLabel = "Confirm") {
  Alert.alert(title, `${detail}\n\nWill be recorded as ${actorName}. Not you? Cancel and sign out first.`, [
    { text: "Cancel", style: "cancel" },
    { text: confirmLabel, style: "destructive", onPress: onConfirm },
  ]);
}
