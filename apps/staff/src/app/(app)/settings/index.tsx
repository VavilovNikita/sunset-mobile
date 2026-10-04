import { router } from "expo-router";
import { Body, Card, Screen } from "@sunset/ui";
import { RequireCapability } from "../../../components/Guard";
import { can } from "../../../lib/access";
import { useSignedIn } from "../../../lib/session";

const PAGES = [
  { href: "/settings/menu", label: "Menu & treatments", hint: "Prices, availability, new items", admin: false },
  { href: "/settings/tables", label: "Tables", hint: "Restaurant, bar, pool and spa tables", admin: false },
  { href: "/settings/rooms", label: "Rooms", hint: "Room types, physical rooms, out-of-order blocks", admin: false },
  { href: "/settings/rates", label: "Rates", hint: "Nightly prices by room type", admin: false },
  { href: "/settings/roster", label: "Roster", hint: "Who works which shift, day by day", admin: false },
  { href: "/settings/printers", label: "Printers", hint: "Status and test prints", admin: false },
  { href: "/settings/devices", label: "Fingerprint terminals", hint: "Status and resync", admin: false },
  { href: "/settings/users", label: "Users", hint: "Accounts, roles, passwords", admin: true },
  { href: "/settings/emails", label: "Guest emails", hint: "Pre-arrival, post-stay and win-back emails", admin: true },
];

/**
 * MANAGER+ (ADMIN for users and guest emails, like /users/** and /settings/** on the server).
 * Excel imports/exports, map placement and photo uploads stay on the web admin - they need a desk.
 */
export default function Settings() {
  const { user } = useSignedIn();
  return (
    <RequireCapability capability="settings.manage">
      <Screen>
        {PAGES.filter((p) => !p.admin || can(user, "settings.admin")).map((p) => (
          <Card key={p.href} onPress={() => router.push(p.href as never)}>
            <Body>{p.label}</Body>
            <Body muted>{p.hint}</Body>
          </Card>
        ))}
        <Body muted>Schedule imports, map placement and room photos are on the web admin.</Body>
      </Screen>
    </RequireCapability>
  );
}
