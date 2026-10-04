import { useEffect, useState } from "react";
import { call } from "@sunset/api-client";
import { formatTimestamp } from "@sunset/core";
import { Body, Button, Card, ErrorText, Field, Label, Loading, Screen, Toggle } from "@sunset/ui";
import { RequireCapability } from "../../../components/Guard";
import { parseWhole } from "../../../lib/settings";
import { useAction, useLoad } from "../../../lib/hooks";
import { useSignedIn } from "../../../lib/session";

export default function GuestEmails() {
  return (
    <RequireCapability capability="settings.admin">
      <EmailsBody />
    </RequireCapability>
  );
}

/**
 * The three automatic guest emails (ADMIN, /settings/**). They only ever go to verified guest
 * accounts that haven't opted out - widening that is a consent decision, not a setting here.
 */
function EmailsBody() {
  const { api } = useSignedIn();
  const settings = useLoad(() => call(api.GET("/settings/lifecycle-emails"), "Could not load the settings."), [api]);
  const s = settings.data;
  const [pre, setPre] = useState(false);
  const [preDays, setPreDays] = useState("");
  const [post, setPost] = useState(false);
  const [postDays, setPostDays] = useState("");
  const [review, setReview] = useState("");
  const [win, setWin] = useState(false);
  const [winMonths, setWinMonths] = useState("");
  const save = useAction();
  useEffect(() => {
    if (!s) return;
    setPre(s.preArrivalEnabled);
    setPreDays(String(s.preArrivalDaysBefore));
    setPost(s.postStayEnabled);
    setPostDays(String(s.postStayDaysAfter));
    setReview(s.postStayReviewUrl ?? "");
    setWin(s.winBackEnabled);
    setWinMonths(String(s.winBackMonthsSinceStay));
  }, [s]);

  const days = (v: string) => parseWhole(v, 1, 365);
  const ok = days(preDays) !== null && days(postDays) !== null && parseWhole(winMonths, 1, 120) !== null;
  async function submit() {
    const r = await save.run(() =>
      call(
        api.PUT("/settings/lifecycle-emails", {
          body: {
            preArrivalEnabled: pre,
            preArrivalDaysBefore: days(preDays) ?? 1,
            postStayEnabled: post,
            postStayDaysAfter: days(postDays) ?? 1,
            postStayReviewUrl: review.trim() || null,
            winBackEnabled: win,
            winBackMonthsSinceStay: parseWhole(winMonths, 1, 120) ?? 1,
          },
        }),
        "Could not save the settings.",
      ),
    );
    if (r.ok) settings.apply(r.data);
  }

  if (settings.loading && !s) return <Loading />;
  return (
    <Screen>
      <ErrorText>{settings.error}</ErrorText>
      <Body muted>Sent only to guests with a verified app account who haven't unsubscribed.</Body>
      <Card>
        <Label>Before arrival</Label>
        <Toggle label="Send" value={pre} onChange={setPre} />
        <Field label="Days before check-in" value={preDays} onChangeText={setPreDays} keyboardType="number-pad" />
      </Card>
      <Card>
        <Label>After the stay</Label>
        <Toggle label="Send" value={post} onChange={setPost} />
        <Field label="Days after check-out" value={postDays} onChangeText={setPostDays} keyboardType="number-pad" />
        <Field label="Review link (optional)" value={review} onChangeText={setReview} autoCapitalize="none" keyboardType="url" />
      </Card>
      <Card>
        <Label>Come back</Label>
        <Toggle label="Send" value={win} onChange={setWin} />
        <Field label="Months since the last stay" value={winMonths} onChangeText={setWinMonths} keyboardType="number-pad" />
      </Card>
      {!ok ? <ErrorText>Days must be 1 to 365, months 1 to 120.</ErrorText> : null}
      <Button title="Save" busy={save.busy} disabled={!ok} onPress={() => void submit()} />
      <ErrorText>{save.error}</ErrorText>
      {s ? <Body muted>{`Last changed ${formatTimestamp(s.updatedAt)}`}</Body> : null}
    </Screen>
  );
}
