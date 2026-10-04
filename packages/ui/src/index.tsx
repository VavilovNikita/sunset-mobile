import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { colors, space, TOUCH } from "./theme";

export { colors, space, TOUCH };

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  if (!scroll) return <View style={styles.screen}>{children}</View>;
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  );
}

export function Title({ children }: { children: ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function Label({ children }: { children: ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

export function Body({ children, muted, style }: { children: ReactNode; muted?: boolean; style?: object }) {
  return <Text style={[styles.body, muted && styles.muted, style]}>{children}</Text>;
}

/** A failure, shown next to the control that caused it - never swallowed into an empty state. */
export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <Text accessibilityRole="alert" style={styles.error}>
      {children}
    </Text>
  );
}

export function Card({ children, style, onPress, accent }: { children: ReactNode; style?: ViewStyle; onPress?: () => void; accent?: string }) {
  const content = <View style={[styles.card, accent ? { borderLeftColor: accent, borderLeftWidth: 4 } : null, style]}>{children}</View>;
  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} role="button" style={({ pressed }) => (pressed ? { opacity: 0.7 } : null)}>
      {content}
    </Pressable>
  );
}

export function Row({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.row, style]}>{children}</View>;
}

type ButtonProps = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  variant?: "primary" | "secondary" | "danger";
};

/** Stays in place, disabled, while busy - a vanishing button lets the next one slide under a double tap. */
export function Button({ title, onPress, disabled, busy, variant = "primary" }: ButtonProps) {
  const inactive = disabled || busy;
  return (
    <Pressable
      role="button"
      accessibilityState={{ disabled: !!inactive, busy: !!busy }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === "primary" && { backgroundColor: colors.coral },
        variant === "secondary" && { backgroundColor: colors.ink3 },
        variant === "danger" && { backgroundColor: colors.coralDeep },
        inactive && { opacity: 0.5 },
        pressed && { opacity: 0.8 },
      ]}
    >
      {busy ? <ActivityIndicator color={colors.cream} /> : <Text style={styles.buttonText}>{title}</Text>}
    </Pressable>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={{ gap: space.xs }}>
      <Label>{label}</Label>
      <TextInput aria-label={label} placeholderTextColor={colors.creamMuted} style={styles.input} {...props} />
    </View>
  );
}

/** Light fills (amber = attention, sand = not cleaned) need dark text to stay readable. */
const LIGHT_BADGES = new Set<string>([colors.amber, colors.sand, colors.sand2]);

/** A labelled on/off switch, one row, full-width touch target. */
export function Toggle({ label, value, onChange, disabled }: { label: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: TOUCH }}>
      <Text style={{ color: colors.cream, fontSize: 16, flex: 1 }}>{label}</Text>
      <Switch aria-label={label} value={value} onValueChange={onChange} disabled={disabled} trackColor={{ true: colors.sea, false: colors.ink3 }} />
    </View>
  );
}

export function Badge({ text, color }: { text: string; color: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: color }]}>
      <Text style={[styles.badgeText, LIGHT_BADGES.has(color) ? { color: colors.ink } : null]}>{text}</Text>
    </View>
  );
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <View style={{ padding: space.xl, alignItems: "center", gap: space.sm }}>
      <ActivityIndicator color={colors.cream} />
      <Body muted>{label}</Body>
    </View>
  );
}

/** Pick one of a few options - chips rather than a native picker, so it reads the same on both platforms. */
export function Choice<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string; disabled?: boolean; hint?: string }[];
  value: T | null;
  onChange: (value: T) => void;
  label?: string;
}) {
  return (
    <View style={{ gap: space.xs }}>
      {label ? <Label>{label}</Label> : null}
      <View style={styles.chips}>
        {options.map((o) => (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ selected: o.value === value, disabled: !!o.disabled }}
            disabled={o.disabled}
            onPress={() => onChange(o.value)}
            style={[styles.chip, o.value === value && { backgroundColor: colors.sea, borderColor: colors.sea }, o.disabled && { opacity: 0.4 }]}
          >
            <Text style={styles.chipText}>{o.label}</Text>
            {o.hint ? <Text style={[styles.chipText, styles.muted, { fontSize: 11 }]}>{o.hint}</Text> : null}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  content: { padding: space.lg, gap: space.md, paddingBottom: 48 },
  title: { color: colors.cream, fontSize: 22, fontWeight: "600" },
  label: { color: colors.creamMuted, fontSize: 12, textTransform: "uppercase", letterSpacing: 1 },
  body: { color: colors.cream, fontSize: 15 },
  muted: { color: colors.creamMuted },
  error: { color: colors.coral, fontSize: 14 },
  card: { backgroundColor: colors.ink2, borderRadius: 12, padding: space.md, gap: space.xs, borderColor: colors.creamFaint, borderWidth: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm },
  button: { minHeight: TOUCH, borderRadius: 24, paddingHorizontal: space.lg, alignItems: "center", justifyContent: "center" },
  buttonText: { color: colors.cream, fontSize: 16, fontWeight: "600" },
  input: {
    minHeight: TOUCH,
    borderWidth: 1,
    borderColor: colors.creamFaint,
    borderRadius: 10,
    paddingHorizontal: space.md,
    color: colors.cream,
    backgroundColor: colors.ink2,
    fontSize: 16,
  },
  badge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, alignSelf: "flex-start" },
  badgeText: { color: colors.cream, fontSize: 12, fontWeight: "600" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: { minHeight: 40, borderRadius: 20, borderWidth: 1, borderColor: colors.creamFaint, paddingHorizontal: space.md, justifyContent: "center" },
  chipText: { color: colors.cream, fontSize: 14 },
});
