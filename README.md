# SandeshDo

**Remember it. Do it. Finish it.**

Private, offline-first tasks + KhataBook-style money. Made by [Sandesh](https://github.com/SandeshL702).

SandeshDo is a phone app for capturing work, remembering it with lock-screen alarms (even when the app is closed), finishing it, and keeping paisa honest.

## What’s in the app

- **Tasks** — today, overdue, inbox, calendar (Google Calendar–style month), search, categories
- **Paisa** — Got / Spent cashbook, budgets, freelance + client income categories, add your own
- **Report** — week chart, month in/out, category analysis
- **Alerts** — Android `AlarmClock` + full-screen popup, soft chime, light vibrate. Works with the app closed once permissions are allowed
- **Ask SandeshDo** — type or speak. Optional Google Gemini API key in Settings. Local commands work without a key
- **Backup** — JSON file on the phone. Uninstall and restore
- **English / Hinglish** — default English

No accounts. Data stays on the device.

## Android APK

Package: `com.sandesh.sandeshdo`

Install the APK, then **Allow the 4 alert permissions** (notifications, exact alarms, full-screen popup, ignore battery). On Xiaomi / Vivo / Oppo also turn **Autostart** on.

Updating: install the new APK over the same package. Your data stays.

## Ask SandeshDo (optional Gemini)

1. Open [Google AI Studio](https://aistudio.google.com/apikey) and create a Gemini API key
2. SandeshDo → Settings → Google AI → paste the key
3. Tap the sparkles icon (or Ask SandeshDo) — type or hold the mic

Without a key you can still say things like:

- `Call Rahul tomorrow 5pm`
- `got 500 freelance`
- `spent 80 chai`
- `what’s pending`

The key is stored only on the phone. Shared backups strip it.

## Develop

```bash
npm install
npm run dev
```

Android wrapper lives in `android/`. Release signing uses the project keystore so updates overlay the same package.

## Privacy

- No sign-in
- Zustand persist (`sandeshdo-v2`) + optional native backup
- Gemini is called from the device with *your* key only if you paste one
