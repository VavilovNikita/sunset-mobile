import { Alert, type AlertButton } from "react-native";

/** A native confirm/choice dialog. Every confirmation in the app goes through here (see ask.web.ts). */
export function ask(title: string, message: string, buttons: AlertButton[]): void {
  Alert.alert(title, message, buttons);
}
