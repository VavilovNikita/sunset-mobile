import type { AlertButton } from "react-native";

// Web is a development/test target only. react-native-web's Alert.alert is a silent no-op, which
// would make every confirmation (payment, cancel, mark done) a dead button in the preview, so the
// browser's own dialogs stand in: one confirm() per choice, in order, until one is accepted.
export function ask(title: string, message: string, buttons: AlertButton[]): void {
  const choices = buttons.filter((b) => b.style !== "cancel");
  for (const choice of choices) {
    const prompt = choices.length === 1 ? `${title}\n\n${message}` : `${title}\n\n${message}\n\n${choice.text}?`;
    if (window.confirm(prompt)) {
      choice.onPress?.();
      return;
    }
  }
  buttons.find((b) => b.style === "cancel")?.onPress?.();
}
