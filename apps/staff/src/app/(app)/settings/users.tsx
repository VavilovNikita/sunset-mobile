import { useState } from "react";
import { View } from "react-native";
import { call } from "@sunset/api-client";
import type { Schemas } from "@sunset/api-client/staff";
import { Badge, Body, Button, Card, Choice, ErrorText, Field, Label, Loading, Row, Screen, Toggle, colors } from "@sunset/ui";
import { RequireCapability } from "../../../components/Guard";
import { ask } from "../../../lib/ask";
import { validateNewUser, validatePassword } from "../../../lib/settings";
import { useAction, useLoad } from "../../../lib/hooks";
import { useSignedIn } from "../../../lib/session";

type User = Schemas["User"];
const ROLES: { value: Schemas["Role"]; label: string }[] = [
  { value: "WAITER", label: "Waiter" },
  { value: "CASHIER", label: "Cashier" },
  { value: "MANAGER", label: "Manager" },
  { value: "ADMIN", label: "Admin" },
];
const FUNCTIONS: Schemas["JobFunction"][] = ["ENGINEER", "HOUSEKEEPER", "THERAPIST"];

export default function Users() {
  return (
    <RequireCapability capability="settings.admin">
      <UsersBody />
    </RequireCapability>
  );
}

/**
 * ADMIN only, like /users/** on the server. A role change, a password reset or disabling an account
 * signs that person out everywhere on their next request (token versions) - said in each confirm.
 */
function UserCard({ u, me, onSaved }: { u: User; me: string; onSaved: (u: User) => void }) {
  const { api } = useSignedIn();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const write = useAction();
  const self = u.id === me;

  async function run<T>(fn: () => Promise<{ ok: true; data: T } | { ok: false; error: string; status: number }>, pick: (t: T) => User, warning?: (t: T) => string | null | undefined) {
    setNote(null);
    const r = await write.run(fn as never);
    if (r.ok) {
      onSaved(pick(r.data as T));
      setNote(warning?.(r.data as T) ?? null);
    }
  }

  return (
    <Card accent={u.active ? undefined : colors.ink3}>
      <Row style={{ justifyContent: "space-between" }}>
        <Body style={{ flex: 1 }}>{u.name}</Body>
        <Badge text={u.role.toLowerCase()} color={colors.slate} />
      </Row>
      <Body muted>{u.email ?? "No login"}</Body>
      {u.functions.length ? <Body muted>{u.functions.map((f) => f.toLowerCase()).join(", ")}</Body> : null}
      <Button title={open ? "Close" : "Manage"} variant="secondary" onPress={() => setOpen(!open)} />
      {open ? (
        <View style={{ gap: 8 }}>
          <Choice
            label="Role"
            options={ROLES}
            value={u.role}
            onChange={(role) =>
              role !== u.role &&
              ask("Change role", `Make ${u.name} ${role.toLowerCase()}? They are signed out and sign in again with the new role.`, [
                { text: "Cancel", style: "cancel" },
                { text: "Change", onPress: () => void run(() => call(api.PATCH("/users/{id}", { params: { path: { id: u.id } }, body: { role } }), "Could not change the role."), (x) => x) },
              ])
            }
          />
          <Label>Job functions</Label>
          {FUNCTIONS.map((f) => (
            <Toggle
              key={f}
              label={f.toLowerCase()}
              value={u.functions.includes(f)}
              disabled={write.busy}
              onChange={(on) => {
                const functions = on ? [...u.functions, f] : u.functions.filter((x) => x !== f);
                void run(() => call(api.PATCH("/users/{id}/functions", { params: { path: { id: u.id } }, body: { functions } }), "Could not save job functions."), (x) => x.user, (x) => x.warning);
              }}
            />
          ))}
          <Toggle
            label={u.active ? "Active" : "Disabled"}
            value={u.active}
            disabled={write.busy || self}
            onChange={(active) =>
              ask(active ? "Enable account" : "Disable account", active ? `Let ${u.name} sign in again?` : `Disable ${u.name}? They are signed out immediately, on every device.`, [
                { text: "Cancel", style: "cancel" },
                { text: active ? "Enable" : "Disable", onPress: () => void run(() => call(api.PATCH("/users/{id}/active", { params: { path: { id: u.id } }, body: { active } }), "Could not change the account."), (x) => x.user, (x) => x.warning) },
              ])
            }
          />
          {self ? <Body muted>You can't disable your own account.</Body> : null}
          {u.email ? (
            <>
              <Field label="New password (8+ characters)" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" />
              <Button
                title="Reset password"
                variant="secondary"
                disabled={!!validatePassword(password) || write.busy}
                onPress={() =>
                  ask("Reset password", `Set a new password for ${u.name}? They are signed out everywhere.`, [
                    { text: "Cancel", style: "cancel" },
                    { text: "Reset", onPress: () => void run(() => call(api.PATCH("/users/{id}/password", { params: { path: { id: u.id } }, body: { newPassword: password } }), "Could not reset the password."), (x) => { setPassword(""); return x; }) },
                  ])
                }
              />
            </>
          ) : null}
          {note ? <Body>{note}</Body> : null}
          <ErrorText>{write.error}</ErrorText>
        </View>
      ) : null}
    </Card>
  );
}

function UsersBody() {
  const { api, user: me } = useSignedIn();
  const users = useLoad(() => call(api.GET("/users"), "Could not load users."), [api]);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Schemas["Role"]>("WAITER");
  const create = useAction();
  const error = validateNewUser(name, email, password);
  const [showActive, setShowActive] = useState<"ACTIVE" | "ALL">("ACTIVE");

  async function add() {
    const r = await create.run(() =>
      call(api.POST("/users", { body: { name: name.trim(), email: email.trim() || undefined, password: password || undefined, role } }), "Could not create the user."),
    );
    if (r.ok && users.data) {
      users.apply([...users.data, r.data]);
      setAdding(false);
      setName("");
      setEmail("");
      setPassword("");
    }
  }

  const list = (users.data ?? []).filter((u) => showActive === "ALL" || u.active).sort((a, b) => a.name.localeCompare(b.name));
  return (
    <Screen>
      <ErrorText>{users.error}</ErrorText>
      {users.loading && !users.data ? <Loading /> : null}
      {adding ? (
        <Card>
          <Label>New user</Label>
          <Field label="Name" value={name} onChangeText={setName} />
          <Field label="Email (leave blank for staff who don't sign in)" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
          <Field label="Password (8+ characters)" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" />
          <Choice label="Role" options={ROLES} value={role} onChange={setRole} />
          <ErrorText>{name || email || password ? error : null}</ErrorText>
          <Row>
            <Button title="Create user" busy={create.busy} disabled={!!error} onPress={() => void add()} />
            <Button title="Close" variant="secondary" onPress={() => setAdding(false)} />
          </Row>
          <ErrorText>{create.error}</ErrorText>
        </Card>
      ) : (
        <Button title="Add user" onPress={() => setAdding(true)} />
      )}
      <Choice
        options={[
          { value: "ACTIVE", label: "Active" },
          { value: "ALL", label: "Everyone" },
        ]}
        value={showActive}
        onChange={setShowActive}
      />
      {list.map((u) => (
        <UserCard key={u.id} u={u} me={me.id} onSaved={(next) => users.data && users.apply(users.data.map((x) => (x.id === next.id ? next : x)))} />
      ))}
    </Screen>
  );
}
