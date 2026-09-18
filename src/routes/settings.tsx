import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { format } from "date-fns";
import { Button, FieldLabel, Input, Switch } from "@/components/ui";
import { downloadExcel } from "@/lib/export-report";
import { parseBackup, persistBackup, serializeBackup, shareBackup, tryNativeRestore } from "@/lib/backup";
import { testGeminiKey } from "@/lib/assistant";
import { ensureNotificationPermission, playGentleTone, readNativeHealth, sendTestPopup } from "@/lib/notifications";
import { selectStats, useApp } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { REMINDER_OFFSET_PRESETS, type Locale, type MoneyCatKind, type NotifyTone, type ReminderInterval, type ThemeMode } from "@/lib/types";
import { moneyCatLabel } from "@/lib/money";
import { taskCatLabel } from "@/lib/types";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/brand-mark";
import { HeaderActions } from "@/components/header-actions";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

const INTERVALS: { id: ReminderInterval; label: string }[] = [
  { id: "off", label: "Off" },
  { id: 15, label: "15 min" },
  { id: 30, label: "30 min" },
  { id: 60, label: "1 hour" },
  { id: 120, label: "2 hours" },
  { id: 1440, label: "Once daily" },
];

export function SettingsPage() {
  const { t } = useT();
  const settings = useApp((s) => s.settings);
  const categories = useApp((s) => s.categories);
  const moneyCategories = useApp((s) => s.moneyCategories);
  const patchSettings = useApp((s) => s.patchSettings);
  const addCategory = useApp((s) => s.addCategory);
  const deleteCategory = useApp((s) => s.deleteCategory);
  const addMoneyCategory = useApp((s) => s.addMoneyCategory);
  const renameMoneyCategory = useApp((s) => s.renameMoneyCategory);
  const setMoneyCatKind = useApp((s) => s.setMoneyCatKind);
  const deleteMoneyCategory = useApp((s) => s.deleteMoneyCategory);
  const importAll = useApp((s) => s.importAll);
  const resetDemo = useApp((s) => s.resetDemo);
  const clearDemo = useApp((s) => s.clearDemo);
  const restoreTask = useApp((s) => s.restoreTask);
  const restoreTx = useApp((s) => s.restoreTx);
  const restoreNote = useApp((s) => s.restoreNote);
  const restorePlan = useApp((s) => s.restorePlan);
  const trashTasks = useApp((s) => s.trashTasks);
  const trashTx = useApp((s) => s.trashTx);
  const trashNotes = useApp((s) => s.trashNotes);
  const trashPlans = useApp((s) => s.trashPlans);
  const fileRef = useRef<HTMLInputElement>(null);
  const [catName, setCatName] = useState("");
  const [paisaName, setPaisaName] = useState("");
  const [paisaKind, setPaisaKind] = useState<MoneyCatKind>("out");
  const [editPaisaId, setEditPaisaId] = useState<string | null>(null);
  const [editPaisaName, setEditPaisaName] = useState("");
  const [health, setHealth] = useState(() => readNativeHealth());
  const [countdown, setCountdown] = useState<number | null>(null);
  const [geminiCheck, setGeminiCheck] = useState("");
  const [geminiBusy, setGeminiBusy] = useState(false);

  useEffect(() => {
    const refresh = () => setHealth(readNativeHealth());
    refresh();
    window.addEventListener("sandeshdo:native-resume", refresh);
    window.addEventListener("focus", refresh);
    const pick = () => fileRef.current?.click();
    const fromNative = (ev: Event) => {
      const detail = (ev as CustomEvent<string>).detail;
      const raw = typeof detail === "string" && detail.length > 8 ? detail : null;
      try {
        const data = raw ? parseBackup(raw) : tryNativeRestore();
        if (!data) {
          toast(t("backup.bad"));
          return;
        }
        importAll(data);
        toast(t("backup.restored"));
      } catch (err) {
        toast(err instanceof Error ? err.message : t("backup.bad"));
      }
    };
    window.addEventListener("sandeshdo:pick-restore", pick);
    window.addEventListener("sandeshdo:restore-json", fromNative);
    window.addEventListener("sandeshdo:restore-native", fromNative);
    return () => {
      window.removeEventListener("sandeshdo:native-resume", refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("sandeshdo:pick-restore", pick);
      window.removeEventListener("sandeshdo:restore-json", fromNative);
      window.removeEventListener("sandeshdo:restore-native", fromNative);
    };
  }, []);

  useEffect(() => {
    if (countdown == null || countdown <= 0) return;
    const timer = window.setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [countdown]);

  const savePhone = () => {
    const json = serializeBackup(useApp.getState());
    const where = persistBackup(json);
    patchSettings({ lastBackupDay: new Date().toISOString().slice(0, 10), lastBackupAt: Date.now() });
    toast(where === "native" ? t("backup.saved") : t("backup.saved"));
  };

  return (
    <main className="overflow-x-hidden px-5 pt-5 pb-8">
      <header className="mb-4 flex items-center justify-between gap-3">
        <BrandMark compact />
        <HeaderActions />
      </header>
      <h1 className="font-display text-title font-medium tracking-tight">{t("settings.title")}</h1>
      <p className="mt-2 text-sm text-muted">{t("settings.tag")}</p>
      <p className="mt-1 text-micro font-semibold tracking-[0.16em] text-subtle uppercase">{t("guide.loop")}</p>

      <Section title={t("guide.mapTitle")}>
        <ol className="space-y-2.5 text-sm">
          {[
            "guide.mapToday",
            "guide.mapDiary",
            "guide.mapPaisa",
            "guide.mapReport",
            "guide.mapAlert",
            "guide.mapAi",
            "guide.mapBackup",
          ].map((key, i) => (
            <li key={key} className="flex gap-3">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-fg text-[10px] font-semibold text-bg">
                {i + 1}
              </span>
              <span>{t(key)}</span>
            </li>
          ))}
        </ol>
      </Section>

      {typeof window !== "undefined" && !window.SandeshDoHost ? (
        <a
          href="https://github.com/SandeshL702/sandeshdo/releases/latest/download/SandeshDo.apk"
          className="mt-5 flex items-center justify-between gap-3 rounded-[1.5rem] bg-fg px-5 py-4 text-bg shadow-[var(--sd-card-shadow)] active:scale-[0.99]"
        >
          <span>
            <span className="block text-[10px] font-semibold tracking-[0.16em] uppercase opacity-70">Android</span>
            <span className="mt-1 block font-display text-xl font-medium leading-tight">{t("settings.apk")}</span>
            <span className="mt-1 block text-xs opacity-75">{t("settings.apkHint")}</span>
          </span>
          <span className="shrink-0 rounded-full bg-bg px-3 py-2 text-xs font-semibold text-fg">{t("settings.apkGet")}</span>
        </a>
      ) : null}

      <Section title={t("settings.thisWeek")}>
        <WeekRecap />
        <Link
          to="/stats"
          className="mt-4 flex h-11 items-center justify-center rounded-2xl bg-bg text-sm font-semibold"
        >
          {t("report.title")}
        </Link>
      </Section>

      <Section title={t("ai.settings")}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">{t("settings.voice")}</p>
            <p className="mt-0.5 text-xs text-muted">{t("settings.voiceHint")}</p>
          </div>
          <Switch
            checked={settings.voiceEnabled !== false}
            onCheckedChange={(on) => patchSettings({ voiceEnabled: on })}
          />
        </div>
        <p className="mb-3 text-sm text-muted">{t("ai.settingsHint")}</p>
        <FieldLabel>{t("ai.key")}</FieldLabel>
        <Input
          type="password"
          autoComplete="off"
          value={settings.geminiApiKey ?? ""}
          onChange={(e) => {
            patchSettings({ geminiApiKey: e.target.value.replace(/\s+/g, "") });
            setGeminiCheck("");
          }}
          placeholder="AIza…  AQ.  gsk_  sk-or-  sk-"
          className="mt-1"
        />
        <p className="mt-2 text-xs text-subtle">
          {(settings.geminiApiKey ?? "").length > 10 ? t("ai.keySaved") : t("ai.hintLocal")}
        </p>
        <Button
          className="mt-3 w-full"
          variant="secondary"
          disabled={geminiBusy}
          onClick={() => {
            setGeminiBusy(true);
            setGeminiCheck(t("ai.testing"));
            void testGeminiKey(settings.geminiApiKey ?? "").then((result) => {
              setGeminiBusy(false);
              setGeminiCheck(result.ok ? `${t("ai.testOk")} · ${result.message}` : result.message);
              toast[result.ok ? "success" : "error"](result.message);
            });
          }}
        >
          {geminiBusy ? t("ai.testing") : t("ai.test")}
        </Button>
        {geminiCheck ? <p className="mt-2 text-xs text-muted">{geminiCheck}</p> : null}
        {(settings.geminiApiKey ?? "").length > 0 && (
          <Button className="mt-2" variant="ghost" onClick={() => patchSettings({ geminiApiKey: "" })}>
            {t("ai.keyClear")}
          </Button>
        )}
        <a
          href="https://aistudio.google.com/apikey"
          target="_blank"
          rel="noreferrer"
          className="mt-3 block text-sm font-semibold text-primary"
        >
          {t("ai.studio")}
        </a>
        <div className="mt-1 flex flex-wrap gap-3 text-xs font-semibold text-primary">
          <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer">
            Groq
          </a>
          <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer">
            OpenRouter
          </a>
        </div>
        <Button
          className="mt-3 w-full"
          variant="secondary"
          onClick={() => window.dispatchEvent(new Event("sandeshdo:assistant"))}
        >
          {t("ai.title")}
        </Button>
      </Section>

      <Section title={t("settings.language")}>
        <div className="grid grid-cols-2 gap-2">
          {([
            { id: "en" as Locale, label: t("settings.english") },
            { id: "hi" as Locale, label: t("settings.hinglish") },
          ]).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => patchSettings({ locale: opt.id, localeRev: 19 })}
              className={cn(
                "h-12 rounded-2xl text-sm font-semibold",
                (settings.locale ?? "en") === opt.id ? "bg-fg text-bg" : "bg-bg text-muted",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </Section>

      <Section title={t("settings.alerts")}>
        <div className="mb-4 overflow-hidden rounded-2xl bg-fg px-4 py-4 text-bg">
          <div className="flex items-center justify-between text-[10px] font-semibold tracking-[0.16em] uppercase opacity-70">
            <span>SandeshDo</span>
            <span>heads-up</span>
          </div>
          <div className="mt-2 font-display text-xl font-medium leading-tight">Due now · Call client</div>
          <p className="mt-1 text-xs opacity-75">
            Full-screen popup even if SandeshDo is closed. Done / Snooze on the lock screen. Soft chime.
          </p>
        </div>
        <div className="mb-3 space-y-2 text-sm">
          <HealthRow
            ok={health.native ? health.notifications : typeof Notification !== "undefined" && Notification.permission === "granted"}
            label="Notifications"
            ready={t("alert.ready")}
            needs={t("alert.needs")}
            onFix={async () => {
              const ok = await ensureNotificationPermission();
              patchSettings({ notificationsEnabled: ok || true });
              window.SandeshDoHost?.openNotificationSettings?.();
              window.SandeshDoHost?.seedNotification?.();
              setHealth(readNativeHealth());
            }}
          />
          {health.native && (
            <>
              <HealthRow
                ok={health.exactAlarms}
                label="Exact alarms"
                ready={t("alert.ready")}
                needs={t("alert.needs")}
                onFix={() => window.SandeshDoHost?.openExactAlarmSettings()}
              />
              <HealthRow
                ok={health.fullScreen}
                label="Lock-screen popup"
                ready={t("alert.ready")}
                needs={t("alert.needs")}
                onFix={() => window.SandeshDoHost?.openFullScreenSettings?.()}
              />
              <HealthRow
                ok={health.battery}
                label="Ignore battery saving"
                ready={t("alert.ready")}
                needs={t("alert.needs")}
                onFix={() => window.SandeshDoHost?.openBatterySettings?.()}
              />
              {health.needsOem && (
                <HealthRow
                  ok={false}
                  label={`${health.manufacturer || "Phone"} autostart`}
                  ready={t("alert.ready")}
                  needs={t("alert.needs")}
                  onFix={() => window.SandeshDoHost?.openOemAutostart?.()}
                />
              )}
            </>
          )}
        </div>
        <Row label="Phone popups" hint="Full-screen popup when a task is due, even with the app closed.">
          <Switch
            checked={settings.notificationsEnabled}
            onCheckedChange={async (next) => {
              if (next) {
                const ok = await ensureNotificationPermission();
                patchSettings({ notificationsEnabled: ok || Boolean(window.SandeshDoHost) });
                window.SandeshDoHost?.seedNotification?.();
                if (!ok && !window.SandeshDoHost) toast("Alerts were not granted.");
              } else patchSettings({ notificationsEnabled: false });
            }}
          />
        </Row>
        <Row label="Vibrate" hint="Light pulse. No loud buzz.">
          <Switch checked={settings.notifyVibrate} onCheckedChange={(v) => patchSettings({ notifyVibrate: v })} />
        </Row>
        <Row label={t("settings.ringtone")} hint={t("settings.ringtoneHint")}>
          <Switch
            checked={settings.notifyTone === "gentle"}
            onCheckedChange={(v) => {
              patchSettings({ notifyTone: (v ? "gentle" : "off") as NotifyTone });
              if (v) playGentleTone();
            }}
          />
        </Row>
        <Button
          className="mt-3 w-full"
          variant="secondary"
          onClick={() => window.SandeshDoHost?.openNotificationSettings?.()}
        >
          {t("settings.notifyOpen")}
        </Button>
        <Button
          className="mt-2 w-full"
          variant="soft"
          onClick={async () => {
            const host = window.SandeshDoHost;
            if (host && host.canExactAlarms && !host.canExactAlarms()) {
              host.openExactAlarmSettings();
              toast("Allow exact alarms, then tap again.");
              return;
            }
            const ok = await sendTestPopup(settings, "lock");
            if (ok) {
              patchSettings({ notificationsEnabled: true });
              setCountdown(10);
              toast("Close the app now. Popup in 10 seconds.");
            } else toast("Allow notifications first.");
            setHealth(readNativeHealth());
          }}
        >
          {countdown && countdown > 0 ? `Close the app · ${countdown}s` : "Fire a test popup"}
        </Button>
        <Button
          className="mt-2 w-full"
          variant="secondary"
          onClick={async () => {
            await sendTestPopup(settings, "now");
            useApp.getState().previewReminder();
          }}
        >
          Preview popup
        </Button>
      </Section>

      <Section title={t("settings.you")}>
        <FieldLabel>{t("settings.name")}</FieldLabel>
        <Input value={settings.userName} onChange={(e) => patchSettings({ userName: e.target.value })} />
        <div className="mt-4">
          <FieldLabel>{t("settings.theme")}</FieldLabel>
          <div className="grid grid-cols-3 gap-2">
            {(["system", "light", "dark"] as ThemeMode[]).map((mode) => (
              <Button
                key={mode}
                size="sm"
                variant={settings.theme === mode ? "soft" : "secondary"}
                onClick={() => patchSettings({ theme: mode })}
              >
                {t(`settings.theme.${mode}`)}
              </Button>
            ))}
          </div>
        </div>
      </Section>

      <Section title={t("settings.google")}>
        <GoogleBackupCard />
      </Section>

      <Section title={t("settings.reminders")}>
        <div>
          <FieldLabel>Still-pending frequency</FieldLabel>
          <div className="grid grid-cols-3 gap-2">
            {INTERVALS.map((i) => (
              <Button
                key={String(i.id)}
                size="sm"
                variant={settings.reminderInterval === i.id ? "soft" : "secondary"}
                onClick={() => patchSettings({ reminderInterval: i.id })}
              >
                {i.label}
              </Button>
            ))}
          </div>
        </div>
        <div className="mt-4">
          <FieldLabel>Maximum reminders per task per day</FieldLabel>
          <Input
            inputMode="numeric"
            value={settings.maxRemindersPerDay}
            onChange={(e) => patchSettings({ maxRemindersPerDay: Math.max(1, Number(e.target.value) || 1) })}
          />
        </div>
        <Row label="Quiet hours" hint={`${settings.quietHoursStart} – ${settings.quietHoursEnd}`}>
          <Switch
            checked={settings.quietHoursEnabled}
            onCheckedChange={(v) => patchSettings({ quietHoursEnabled: v })}
          />
        </Row>
        {settings.quietHoursEnabled && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Input type="time" value={settings.quietHoursStart} onChange={(e) => patchSettings({ quietHoursStart: e.target.value })} />
            <Input type="time" value={settings.quietHoursEnd} onChange={(e) => patchSettings({ quietHoursEnd: e.target.value })} />
          </div>
        )}
        <Row label="Aggressive reminders" hint="Stronger heads-up for high and urgent work.">
          <Switch
            checked={settings.aggressiveReminders}
            onCheckedChange={(v) => patchSettings({ aggressiveReminders: v })}
          />
        </Row>
        <Row label="Smart snooze" hint="Offer the duration you usually pick.">
          <Switch checked={settings.smartSnooze} onCheckedChange={(v) => patchSettings({ smartSnooze: v })} />
        </Row>
        <div className="mt-4">
          <FieldLabel>Default reminders</FieldLabel>
          <div className="flex flex-wrap gap-2">
            {REMINDER_OFFSET_PRESETS.map((p) => {
              const on = settings.defaultReminderOffsets.includes(p.minutes);
              return (
                <Button
                  key={p.minutes}
                  size="sm"
                  variant={on ? "soft" : "secondary"}
                  onClick={() => {
                    const current = settings.defaultReminderOffsets;
                    const next = current.includes(p.minutes)
                      ? current.filter((m) => m !== p.minutes)
                      : [...current, p.minutes].sort((a, b) => a - b);
                    patchSettings({ defaultReminderOffsets: next.length ? next : [0] });
                  }}
                >
                  {p.label}
                </Button>
              );
            })}
          </div>
        </div>
        <Row label={t("settings.paisaNudge")} hint={t("settings.paisaNudgeHint")}>
          <Switch
            checked={settings.paisaNudgeEnabled !== false}
            onCheckedChange={(v) => patchSettings({ paisaNudgeEnabled: v })}
          />
        </Row>
        {settings.paisaNudgeEnabled !== false && (
          <Input
            type="time"
            className="mt-2"
            value={settings.paisaNudgeTime ?? "20:00"}
            onChange={(e) => patchSettings({ paisaNudgeTime: e.target.value })}
          />
        )}
      </Section>

      <Section title={t("settings.summaries")}>
        <Row label="Morning summary">
          <Switch checked={settings.dailySummary} onCheckedChange={(v) => patchSettings({ dailySummary: v })} />
        </Row>
        {settings.dailySummary && (
          <Input
            type="time"
            className="mt-2"
            value={settings.dailySummaryTime}
            onChange={(e) => patchSettings({ dailySummaryTime: e.target.value })}
          />
        )}
        <Row label="End of day">
          <Switch checked={settings.endOfDaySummary} onCheckedChange={(v) => patchSettings({ endOfDaySummary: v })} />
        </Row>
        {settings.endOfDaySummary && (
          <Input
            type="time"
            className="mt-2"
            value={settings.endOfDaySummaryTime}
            onChange={(e) => patchSettings({ endOfDaySummaryTime: e.target.value })}
          />
        )}
      </Section>

      <Section title={t("settings.tasks")}>
        <Row label="Complete when all steps are done">
          <Switch
            checked={settings.autoCompleteOnSubtasks}
            onCheckedChange={(v) => patchSettings({ autoCompleteOnSubtasks: v })}
          />
        </Row>
        <div className="mt-4">
          <FieldLabel>Categories</FieldLabel>
          <div className="space-y-1.5">
            {categories.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-xl bg-bg px-3 py-2 text-sm">
                <span>{taskCatLabel(categories, c.id, t)}</span>
                <button type="button" className="text-xs text-muted" onClick={() => deleteCategory(c.id)}>
                  Remove
                </button>
              </div>
            ))}
          </div>
          <form
            className="mt-2 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              addCategory(catName);
              setCatName("");
            }}
          >
            <Input value={catName} onChange={(e) => setCatName(e.target.value)} placeholder="New category" />
            <Button type="submit" variant="secondary">
              Add
            </Button>
          </form>
        </div>
      </Section>

      <Section title={t("settings.paisa")}>
        <p className="mb-3 text-sm text-muted">{t("settings.paisaHint")}</p>
        {(["in", "out"] as const).map((group) => (
          <div key={group} className="mb-4">
            <p className="mb-2 text-[11px] font-semibold tracking-[0.14em] text-muted uppercase">
              {group === "in" ? t("settings.paisaInList") : t("settings.paisaOutList")}
            </p>
            <div className="space-y-1.5">
              {moneyCategories
                .filter((c) => c.kind === group || c.kind === "both")
                .map((c) => (
                  <div key={`${group}-${c.id}`} className="flex items-center justify-between gap-2 rounded-xl bg-bg px-3 py-2">
                    {editPaisaId === `${group}-${c.id}` ? (
                      <form
                        className="flex min-w-0 flex-1 gap-2"
                        onSubmit={(e) => {
                          e.preventDefault();
                          renameMoneyCategory(c.id, editPaisaName);
                          setEditPaisaId(null);
                        }}
                      >
                        <Input
                          value={editPaisaName}
                          onChange={(e) => setEditPaisaName(e.target.value)}
                          className="h-10"
                          autoFocus
                        />
                        <Button type="submit" size="sm" variant="secondary">
                          {t("money.set")}
                        </Button>
                      </form>
                    ) : (
                      <button
                        type="button"
                        className="min-w-0 flex-1 truncate text-left text-sm font-medium"
                        onClick={() => {
                          setEditPaisaId(`${group}-${c.id}`);
                          setEditPaisaName(c.name);
                        }}
                      >
                        {moneyCatLabel(moneyCategories, c.id, t)}
                      </button>
                    )}
                    <button
                      type="button"
                      className="h-10 shrink-0 px-1 text-xs text-muted"
                      onClick={() => setMoneyCatKind(c.id, group === "in" ? "out" : "in")}
                    >
                      {group === "in" ? t("settings.paisaOut") : t("settings.paisaIn")}
                    </button>
                    <button
                      type="button"
                      className="h-10 shrink-0 px-1 text-xs text-muted"
                      onClick={() => deleteMoneyCategory(c.id)}
                      disabled={moneyCategories.length <= 1}
                    >
                      {t("settings.remove")}
                    </button>
                  </div>
                ))}
            </div>
          </div>
        ))}
        <form
          className="mt-3 space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            addMoneyCategory(paisaName, paisaKind);
            setPaisaName("");
          }}
        >
          <Input
            value={paisaName}
            onChange={(e) => setPaisaName(e.target.value)}
            placeholder={t("settings.paisaName")}
          />
          <div className="flex gap-1.5">
            {(["in", "out", "both"] as MoneyCatKind[]).map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => setPaisaKind(kind)}
                className={cn(
                  "h-9 flex-1 rounded-full text-xs font-semibold",
                  paisaKind === kind ? "bg-fg text-bg" : "bg-bg text-muted",
                )}
              >
                {kind === "in" ? t("settings.paisaIn") : kind === "out" ? t("settings.paisaOut") : t("settings.paisaBoth")}
              </button>
            ))}
          </div>
          <Button type="submit" variant="secondary" className="w-full">
            {t("settings.add")}
          </Button>
        </form>
      </Section>

      <Section title={t("settings.data")}>
        <p className="mb-3 text-sm text-muted">{t("settings.dataHint")}</p>
        <p className="mb-3 text-xs text-subtle">
          {settings.lastBackupAt
            ? t("settings.lastBackup", { when: format(settings.lastBackupAt, "d MMM, h:mm a") })
            : t("settings.neverBackup")}
        </p>
        <div className="grid grid-cols-1 gap-2">
          <Button onClick={savePhone}>{t("settings.savePhone")}</Button>
          <Button
            variant="secondary"
            onClick={async () => {
              const json = serializeBackup(useApp.getState());
              const how = await shareBackup(json);
              patchSettings({ lastBackupDay: new Date().toISOString().slice(0, 10), lastBackupAt: Date.now() });
              toast(how === "download" ? t("backup.saved") : t("backup.shared"));
            }}
          >
            {t("settings.share")}
          </Button>
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>
            {t("settings.import")}
          </Button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".json,.txt,application/json,text/plain,*/*"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            try {
              const data = parseBackup(await file.text());
              importAll(data);
              toast(t("backup.restored"));
            } catch (err) {
              toast(err instanceof Error ? err.message : t("backup.bad"));
            }
            e.target.value = "";
          }}
        />
        <Button
          className="mt-2 w-full"
          variant="secondary"
          onClick={() => {
            downloadExcel(useApp.getState());
            toast(t("settings.excelOk"));
          }}
        >
          {t("settings.excel")}
        </Button>
        <Link
          to="/export"
          className="mt-2 flex h-11 w-full items-center justify-center rounded-2xl bg-bg text-sm font-semibold"
        >
          {t("settings.pdf")}
        </Link>
        <Button
          className="mt-2 w-full"
          variant="ghost"
          onClick={() => {
            clearDemo();
            toast(t("settings.clearDemoOk"));
          }}
        >
          {t("settings.clearDemo")}
        </Button>
        <Button className="mt-2 w-full" variant="ghost" onClick={resetDemo}>
          {t("settings.demo")}
        </Button>
      </Section>

      {(trashTasks.length > 0 || trashTx.length > 0 || trashNotes.length > 0 || trashPlans.length > 0) && (
        <Section title={t("settings.trash")}>
          <p className="mb-3 text-sm text-muted">{t("settings.trashHint")}</p>
          <div className="space-y-2">
            {trashTasks.map((row) => (
              <div key={row.id} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm">{row.title}</span>
                <Button size="sm" variant="secondary" onClick={() => restoreTask(row.id)}>
                  {t("settings.putBack")}
                </Button>
              </div>
            ))}
            {trashTx.map((row) => (
              <div key={row.id} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm">
                  ₹{Math.round(row.amount)} · {row.note}
                </span>
                <Button size="sm" variant="secondary" onClick={() => restoreTx(row.id)}>
                  {t("settings.putBack")}
                </Button>
              </div>
            ))}
            {trashNotes.map((row) => (
              <div key={row.id} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm">{row.title}</span>
                <Button size="sm" variant="secondary" onClick={() => restoreNote(row.id)}>
                  {t("settings.putBack")}
                </Button>
              </div>
            ))}
            {trashPlans.map((row) => (
              <div key={row.id} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm">{row.title}</span>
                <Button size="sm" variant="secondary" onClick={() => restorePlan(row.id)}>
                  {t("settings.putBack")}
                </Button>
              </div>
            ))}
          </div>
        </Section>
      )}

      <div className="mt-10 pb-4 text-center">
        <div className="text-sm font-semibold tracking-tight">SandeshDo</div>
        <div className="mt-1 text-xs text-muted">{t("settings.tag")}</div>
        <div className="mt-3 text-xs text-subtle">Made by Sandesh</div>
      </div>
    </main>
  );
}

function WeekRecap() {
  const { t } = useT();
  const tasks = useApp((s) => s.tasks);
  const completions = useApp((s) => s.completions);
  const stats = selectStats(tasks, completions, Date.now());
  const items = [
    { label: t("stats.finishedToday"), value: stats.completedToday },
    { label: t("stats.thisWeek"), value: stats.completedWeek },
    { label: t("stats.overdue"), value: stats.overdue },
    { label: t("stats.streak"), value: `${stats.streak}d` },
  ];
  return (
    <div className="grid grid-cols-2 gap-3">
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <div className="text-2xl font-semibold tracking-tight tabular-nums">{item.value}</div>
          <div className="mt-0.5 truncate text-xs text-muted">{item.label}</div>
        </div>
      ))}
    </div>
  );
}

function GoogleBackupCard() {
  const { t } = useT();
  const importAll = useApp((s) => s.importAll);
  const patchSettings = useApp((s) => s.patchSettings);
  const native = typeof window !== "undefined" && Boolean(window.SandeshDoHost);

  return (
    <>
      <p className="mb-3 text-sm text-muted">{t("settings.googleHint")}</p>
      {native ? <p className="mb-3 text-sm text-muted">{t("settings.googlePhone")}</p> : null}
      <Button
        className="w-full"
        onClick={async () => {
          const json = serializeBackup(useApp.getState());
          const host = window.SandeshDoHost;
          if (host?.saveToDrive) {
            host.saveToDrive(json);
            patchSettings({ lastBackupDay: new Date().toISOString().slice(0, 10), lastBackupAt: Date.now() });
            toast(t("backup.shared"));
            return;
          }
          const how = await shareBackup(json);
          patchSettings({ lastBackupDay: new Date().toISOString().slice(0, 10), lastBackupAt: Date.now() });
          toast(how === "download" ? t("backup.saved") : t("backup.shared"));
        }}
      >
        {t("settings.googleSave")}
      </Button>
      <Button
        className="mt-2 w-full"
        variant="secondary"
        onClick={() => {
          const host = window.SandeshDoHost;
          if (host?.pickRestore) {
            host.pickRestore();
            return;
          }
          const nativeFile = tryNativeRestore();
          if (nativeFile) {
            importAll(nativeFile);
            toast(t("backup.restored"));
            return;
          }
          window.dispatchEvent(new Event("sandeshdo:pick-restore"));
        }}
      >
        {t("settings.googleRestore")}
      </Button>
      <p className="mt-3 text-xs text-subtle">{t("settings.vaultSecure")}</p>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-[11px] font-semibold tracking-[0.16em] text-muted uppercase">{title}</h2>
      <div className="sd-card rounded-3xl p-4">{children}</div>
    </section>
  );
}

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div>
        <div className="text-sm font-medium">{label}</div>
        {hint && <div className="text-xs text-muted">{hint}</div>}
      </div>
      {children}
    </div>
  );
}

function HealthRow({
  ok,
  label,
  onFix,
  ready,
  needs,
}: {
  ok: boolean;
  label: string;
  onFix: () => void;
  ready: string;
  needs: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={ok ? "text-fg" : "text-overdue"}>
        {ok ? ready : needs} · {label}
      </span>
      {!ok && (
        <button type="button" className="text-xs font-semibold text-primary" onClick={onFix}>
          Allow
        </button>
      )}
    </div>
  );
}
