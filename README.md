# SandeshDo

**Remember it. Do it. Finish it.**

Private, offline-first tasks + KhataBook-style money. Made by [Sandesh](https://github.com/SandeshL702).

SandeshDo is a phone app for capturing work, remembering it with heads-up banners (even when the app is closed), finishing it, and keeping paisa honest.

## What’s in the app

- **Tasks** — today, overdue, inbox, calendar (Google Calendar–style month), search, categories
- **Paisa** — Got / Spent cashbook, budgets, per-day spend graph, freelance + client income categories
- **Notes / Plans / Vault** — Keep-style notes, long-term plans, PIN-gated passwords. Separate pages, not crammed into Tasks
- **Sandy** — talks Hinglish, adds tasks with deadlines, logs paisa, notes, plans. Optional Gemini key
- **Report** — week chart, month in/out, daily spend, category analysis
- **Alerts** — Android alarm clock + small heads-up banner, soft chime. Works with the app closed
- **Backup** — JSON on the phone. Share to Drive. Uninstall and restore. PIN locks the app
- **English / Hinglish** — default English

No accounts. Data stays on the device.

## Android APK

Package: `com.sandesh.sandeshdo` · **2.0.0**

Install the APK, then **Allow notifications** and **exact alarms**. On Xiaomi / Vivo / Oppo also turn **Autostart** on.

Updating: install the new APK over the same package. Your data stays.

## Sandy (optional Gemini)

1. Open [Google AI Studio](https://aistudio.google.com/apikey) and create a Gemini API key
2. SandeshDo → Settings → Sandy · Google AI → paste the key
3. Tap the sparkles — type or hold the mic. Try `kal 5 baje dentist`

Without a key you can still say:

- `kal 5 baje Rahul ko call`
- `got 500 freelance`
- `gaya 80 chai`
- `note laptop bill`
- `plan Mahakumbh`

The key is stored only on the phone. The APK calls Gemini natively (no CORS). Shared backups strip it.

## Privacy

- No sign-in
- Zustand persist (`sandeshdo-v2`) + optional native backup
- Gemini is called from the device with *your* key only if you paste one
- Vault secrets never leave the phone
