<p align="center">
  <img src="docs/banner.jpg" alt="SandeshDo — Remember it. Do it. Finish it." width="920" />
</p>

<h1 align="center">SandeshDo</h1>

<p align="center"><strong>Remember it. Do it. Finish it.</strong></p>

<p align="center">
  Private Android app for people who think in Hinglish.<br/>
  Say the work once. It becomes a task with a real reminder — even if the app is closed.
</p>

<p align="center">
  <a href="https://github.com/SandeshL702/sandeshdo/releases"><img alt="Release" src="https://img.shields.io/github/v/release/SandeshL702/sandeshdo?style=flat-square&color=0f766e" /></a>
  <a href="LICENSE"><img alt="MIT" src="https://img.shields.io/badge/license-MIT-0f766e?style=flat-square" /></a>
  <img alt="Offline first" src="https://img.shields.io/badge/offline-first-111?style=flat-square" />
  <img alt="No account" src="https://img.shields.io/badge/no-account-111?style=flat-square" />
</p>

<p align="center">
  <img src="docs/today.png" width="250" alt="Today" />
  <img src="docs/calendar.png" width="250" alt="Calendar" />
  <img src="docs/sandy.png" width="250" alt="Sandy" />
</p>

## Say this. It happens.

| You say | SandeshDo does |
|---|---|
| `Yash ka video aaj sham ko khatam karna hai` | Task **Yash ka video** · today 6pm · reminder on |
| `kal 5 baje dentist` | Tomorrow 5pm. Heads-up banner when due |
| `got 500 freelance` | Paisa in |
| `gaya 80 chai` | Paisa out |
| `kya pehle karna chahiye` | Sandy reads your list and picks |

No feed. No streak theater. No “sign in to continue”.

## What’s inside

- **Today** — overdue, aaj, kal, inbox. Tick it. It’s done.
- **Calendar** — month view with dots. Tap a day, see the work.
- **Paisa** — Got / Spent cashbook. Budgets. Day graph. Freelance + client.
- **Notes · Plans · Vault** — Keep-style notes, long-term plans, AES-locked passwords.
- **Sandy** — talks Hinglish, adds deadlines, logs money, writes a report. Works without a key.
- **Alerts** — Android alarm + small heads-up banner. App can be closed.
- **Backup** — JSON on the phone. Share to Drive. Uninstall, restore.

English or Hinglish. Default English.

## Install (Android)

Package `com.sandesh.sandeshdo` · **2.1.0**

1. Download the APK from [Releases](https://github.com/SandeshL702/sandeshdo/releases)
2. Allow **notifications** and **exact alarms**
3. Xiaomi / Vivo / Oppo — turn **Autostart** on

Install the new APK over the same package. Your data stays.

## Run from source

```bash
npm i
npm run dev
```

Android APK:

```bash
./android/build-apk.sh
```

## Privacy, on purpose

- Data lives on the phone
- Vault is AES-GCM
- Optional AI key never goes into a shared backup
- No tracker, no ads, no account

## Stack

React · TanStack Start · Zustand · Android WebView + `AlarmManager`

## License

MIT. Made by [Sandesh](https://github.com/SandeshL702).

If this saves you one missed call, star it so the next person finds it.
