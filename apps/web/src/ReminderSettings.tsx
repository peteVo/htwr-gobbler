import { useText } from "./text";
/* Hallmark · component critique: P4 H4 E4 S5 R5 V4 · existing settings controls */
import { useEffect, useState } from "react";
import type { Preferences } from "../../../packages/core/index";
import { showNotification } from "./reminders";

const permission = () =>
  "Notification" in window ? Notification.permission : "unsupported";

export function ReminderSettings({
  email,
  prefs,
  busy,
  needAccount,
  save,
}: {
  email: string;
  prefs: Preferences;
  busy: boolean;
  needAccount: () => boolean;
  save: (prefs: Preferences) => Promise<void>;
}) {
  const tx = useText();
  const [allowed, setAllowed] = useState(permission),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [testing, setTesting] = useState(false);
  useEffect(() => {
    const refresh = () => setAllowed(permission());
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);
  return (
    <section aria-label={tx("Reminder settings")}>
      <h2>{tx("Reminders")}</h2>
      <p className="muted">
        {tx(
          "Keep Gobbler open for reminders. Approaching alerts cover open, confirmed assignments with a known time. Date-only deadlines stay visible in Tasks. Click an alert to open its item.",
        )}
      </p>
      <p className="small muted" role="status">
        {allowed === "unsupported"
          ? tx("This browser does not support notifications.")
          : allowed === "denied"
            ? tx(
                "Notifications are blocked in this browser. Allow them in site settings to receive alerts.",
              )
            : allowed === "granted"
              ? tx(
                  "Browser permission granted. Reminders {0}.",
                  tx(prefs.reminders ? "enabled" : "disabled"),
                )
              : tx("Browser permission has not been granted yet.")}
      </p>
      {error && (
        <p className="alert error" role="alert">
          {tx(error)}
        </p>
      )}
      {notice && (
        <p className="small muted" role="status">
          {tx(notice)}
        </p>
      )}
      <button
        className="secondary"
        disabled={
          busy || testing || (!prefs.reminders && allowed === "unsupported")
        }
        onClick={async () => {
          if (needAccount()) return;
          setError("");
          setNotice("");
          try {
            if (!prefs.reminders) {
              if (!("Notification" in window))
                throw new Error("This browser does not support notifications.");
              const next = await Notification.requestPermission();
              setAllowed(next);
              if (next !== "granted")
                throw new Error(
                  "Notification permission was not granted. Your deadlines remain visible in Tasks.",
                );
              localStorage.setItem(
                "reminder-changes-since:" + email,
                String(Date.now()),
              );
            }
            await save({ ...prefs, reminders: !prefs.reminders });
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        {prefs.reminders
          ? tx("Disable reminders")
          : tx("Enable foreground reminders")}
      </button>
      <label>
        {tx("Remind me before a deadline")}
        <select
          value={prefs.reminder_hours ?? 24}
          disabled={busy || testing}
          onChange={(e) => {
            if (!needAccount())
              void save({ ...prefs, reminder_hours: Number(e.target.value) });
          }}
        >
          <option value={1}>{tx("1 hour")}</option>
          <option value={6}>{tx("6 hours")}</option>
          <option value={24}>{tx("1 day")}</option>
          <option value={48}>{tx("2 days")}</option>
          <option value={168}>{tx("1 week")}</option>
        </select>
      </label>
      <label>
        {tx("Deadline-change alerts")}
        <select
          value={String(prefs.deadline_changes ?? true)}
          disabled={busy || testing}
          onChange={(e) => {
            if (!needAccount())
              void save({
                ...prefs,
                deadline_changes: e.target.value === "true",
              });
          }}
        >
          <option value="true">{tx("Notify when a deadline moves")}</option>
          <option value="false">{tx("Off")}</option>
        </select>
      </label>
      <p className="small muted">
        {tx(
          "Changes since reminders were enabled in this browser are eligible for seven days. Alerts show old and new dates, including review warnings. Quiet hours delay alerts; missed or completed deadlines do not trigger approaching reminders.",
        )}
      </p>
      <div className="field-row">
        {(
          [
            ["quiet_start", tx("Quiet from (Berlin)")],
            ["quiet_end", tx("Until (Berlin)")],
          ] as const
        ).map(([key, label]) => (
          <label key={key}>
            {label}
            <select
              value={prefs[key]}
              disabled={busy || testing}
              onChange={(e) => {
                if (!needAccount())
                  void save({ ...prefs, [key]: Number(e.target.value) });
              }}
            >
              {Array.from({ length: 24 }, (_, hour) => (
                <option key={hour} value={hour}>
                  {String(hour).padStart(2, "0")}:00
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <p className="small muted">
        {tx(
          "Equal quiet-hour times pause all automatic alerts. Choices are saved to your account; browser permission and duplicate suppression are specific to this browser.",
        )}
      </p>
      <button
        className="secondary"
        disabled={busy || testing || allowed !== "granted"}
        onClick={async () => {
          if (needAccount()) return;
          setTesting(true);
          setError("");
          setNotice("");
          try {
            await showNotification(
              tx("htwr-gobbler · Test notification"),
              tx(
                "Your browser accepted this test. Automatic reminders require Gobbler to stay open.",
              ),
              "gobbler-test",
            );
            setNotice(
              "Test accepted by the browser. Check your device's notification area and Do Not Disturb settings.",
            );
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setTesting(false);
          }
        }}
      >
        {testing ? tx("Sending…") : tx("Send test notification")}
      </button>
      <p className="small muted">
        {tx(
          "Tests are sent immediately, including during quiet hours. Device settings can silence or hide browser notifications. Closing Gobbler stops automatic reminders; scheduled source checks alone do not send alerts.",
        )}
      </p>
    </section>
  );
}
