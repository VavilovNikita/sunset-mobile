import type { ReactNode } from "react";
import { Body, Screen, Title } from "@sunset/ui";
import { can, type Capability } from "../lib/access";
import { useSignedIn } from "../lib/session";

/**
 * Guards the screen itself, not just the link to it - a hidden link is not access control
 * (sunset-beach CLAUDE.md). The server enforces the same rule regardless.
 */
export function RequireCapability({ capability, children }: { capability: Capability; children: ReactNode }) {
  const { user } = useSignedIn();
  if (!can(user, capability)) {
    return (
      <Screen>
        <Title>Not available</Title>
        <Body muted>Your role ({user.role}) can't open this screen. Ask a manager if you need it.</Body>
      </Screen>
    );
  }
  return <>{children}</>;
}
