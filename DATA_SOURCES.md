# 📊 All Data Sources & Live Sheet Links

This file contains every Google Sheets link, CSV export endpoint, Metabase query URL, and data file used by the **Daily Sales & Revenue Report** project.

---

## 1. 📑 Google Sheets (Sales & Refunds)

| Source / Purpose | Spreadsheet ID | Direct Google Sheets View / Edit Link | Direct CSV Export URL |
| :--- | :--- | :--- | :--- |
| **Primary Sales / Revenue Sheet** (`Sales/Rev (Auto)`) | `1AMJ0DLL2JV9gl58h5yRPgTZyBzwSOL1cyrhpyA5Qz9c` | [Open Google Sheet](https://docs.google.com/spreadsheets/d/1AMJ0DLL2JV9gl58h5yRPgTZyBzwSOL1cyrhpyA5Qz9c/edit) | [Download CSV](https://docs.google.com/spreadsheets/d/1AMJ0DLL2JV9gl58h5yRPgTZyBzwSOL1cyrhpyA5Qz9c/gviz/tq?tqx=out:csv&sheet=Sales%2FRev%20(Auto)) |
| **Secondary Sales Sheet** | `10j9ilpBqcVAyatDryXl5_33pducazaNOVOm-RYI9yV8` | [Open Google Sheet](https://docs.google.com/spreadsheets/d/10j9ilpBqcVAyatDryXl5_33pducazaNOVOm-RYI9yV8/edit) | [Download CSV](https://docs.google.com/spreadsheets/d/10j9ilpBqcVAyatDryXl5_33pducazaNOVOm-RYI9yV8/gviz/tq?tqx=out:csv&sheet=Sales%2FRev%20(Auto)) |
| **Refunds Sheet** (`Refunds`) | `1Q_IX-4CJK8_xr_7qicmhRQMOjIlLxHe0MBCS9bT-xnE` | [Open Google Sheet](https://docs.google.com/spreadsheets/d/1Q_IX-4CJK8_xr_7qicmhRQMOjIlLxHe0MBCS9bT-xnE/edit) | [Download CSV](https://docs.google.com/spreadsheets/d/1Q_IX-4CJK8_xr_7qicmhRQMOjIlLxHe0MBCS9bT-xnE/gviz/tq?tqx=out:csv&sheet=Refunds) |

---

## 2. ⚡ Metabase Live CSV Endpoints (theelefant.ai)

These endpoints provide live, real-time query results exported automatically in CSV format:

### A. Funnel, Delivery & Direct Sales
| Metric / Table | Metabase Question URL |
| :--- | :--- |
| **User Signups, OTP Verified & Serviceability Funnel** | [https://metabase-bkp.theelefant.ai/public/question/a7ec6872-1841-408d-8f63-7d16e959b67c.csv](https://metabase-bkp.theelefant.ai/public/question/a7ec6872-1841-408d-8f63-7d16e959b67c.csv) |
| **Delivery Fees (Orders & Amount)** | [https://metabase-bkp.theelefant.ai/public/question/93b699f2-7f1c-47a8-bf39-f3261a9e92da.csv](https://metabase-bkp.theelefant.ai/public/question/93b699f2-7f1c-47a8-bf39-f3261a9e92da.csv) |
| **Direct Sales (Self Subscriptions)** | [https://metabase-bkp.theelefant.ai/public/question/37fddfd6-fc66-4c2b-91f6-70e47192334d.csv](https://metabase-bkp.theelefant.ai/public/question/37fddfd6-fc66-4c2b-91f6-70e47192334d.csv) |
| **Leads Missed (>8 hrs, no activity)** | [https://metabase-bkp.theelefant.ai/public/question/a2dc3828-0492-4009-85d1-ce6647dda724.csv](https://metabase-bkp.theelefant.ai/public/question/a2dc3828-0492-4009-85d1-ce6647dda724.csv) |

---

### B. Subscriptions & Lead Journey Statistics
| Metric | Metabase Question URL |
| :--- | :--- |
| **App Downloads (Daily)** | [https://metabase-bkp.theelefant.ai/public/question/739c97ae-ef79-4088-ac33-67c4b37ba6fd.csv](https://metabase-bkp.theelefant.ai/public/question/739c97ae-ef79-4088-ac33-67c4b37ba6fd.csv) |
| **Total Active Subscriptions as on date** | [https://metabase-bkp.theelefant.ai/public/question/ef5cfe31-4213-43e8-8c8d-cbd876733e57.csv](https://metabase-bkp.theelefant.ai/public/question/ef5cfe31-4213-43e8-8c8d-cbd876733e57.csv) |
| **New Subscriber in last 7 days** | [https://metabase-bkp.theelefant.ai/public/question/a0d790ad-d435-4424-b18d-603881c72f26.csv](https://metabase-bkp.theelefant.ai/public/question/a0d790ad-d435-4424-b18d-603881c72f26.csv) |
| **New user in last 7 days (app downloads)** | [https://metabase-bkp.theelefant.ai/public/question/40be1f89-570d-42b8-ab51-243e57425142.csv](https://metabase-bkp.theelefant.ai/public/question/40be1f89-570d-42b8-ab51-243e57425142.csv) |
| **New user yesterday (app downloads)** | [https://metabase-bkp.theelefant.ai/public/question/2a2bb684-0dd7-4b90-91d1-9e3de228e1b4.csv](https://metabase-bkp.theelefant.ai/public/question/2a2bb684-0dd7-4b90-91d1-9e3de228e1b4.csv) |
| **Total TeleCRM Leads Generated yesterday** | [https://metabase-bkp.theelefant.ai/public/question/30989a6b-c8d3-4e44-abc8-a03dbda8f55b.csv](https://metabase-bkp.theelefant.ai/public/question/30989a6b-c8d3-4e44-abc8-a03dbda8f55b.csv) |

---

### C. Subscription Details & Retention
| Metric | Metabase Question URL |
| :--- | :--- |
| **Subscription ending in next 5 days** | [https://metabase-bkp.theelefant.ai/public/question/51b44f84-76a4-4940-b075-f8362e426e01.csv](https://metabase-bkp.theelefant.ai/public/question/51b44f84-76a4-4940-b075-f8362e426e01.csv) |
| **Subscription expired / cancelled in last 7 days** | [https://metabase-bkp.theelefant.ai/public/question/09dc0478-de41-4af1-982a-cfbb3a5c9cde.csv](https://metabase-bkp.theelefant.ai/public/question/09dc0478-de41-4af1-982a-cfbb3a5c9cde.csv) |
| **Subscription expiring today** | [https://metabase-bkp.theelefant.ai/public/question/2597639d-fdb9-41b4-a6c4-d3e458f92e2b.csv](https://metabase-bkp.theelefant.ai/public/question/2597639d-fdb9-41b4-a6c4-d3e458f92e2b.csv) |

---

### D. Ordering Details & Activation
| Metric | Metabase Question URL |
| :--- | :--- |
| **Plan expiring and not placed a single order** | [https://metabase-bkp.theelefant.ai/public/question/03c0f1ba-e346-4d1d-aaf8-02efdf36d12c.csv](https://metabase-bkp.theelefant.ai/public/question/03c0f1ba-e346-4d1d-aaf8-02efdf36d12c.csv) |
| **Plan expired and not a single order placed** | [https://metabase-bkp.theelefant.ai/public/question/3a786b1a-8b6e-4856-9f18-60949bc19d58.csv](https://metabase-bkp.theelefant.ai/public/question/3a786b1a-8b6e-4856-9f18-60949bc19d58.csv) |
| **Active subscriber & no orders placed yet** | [https://metabase-bkp.theelefant.ai/public/question/fb796af2-6ed7-4c79-b39f-94f48aca3966.csv](https://metabase-bkp.theelefant.ai/public/question/fb796af2-6ed7-4c79-b39f-94f48aca3966.csv) |

---

### E. Delivery & Fulfillment Status
| Metric / Table | Metabase Question URL |
| :--- | :--- |
| **New Users Delivery Status** | [https://metabase-bkp.theelefant.ai/public/question/0b3450ef-d477-4a21-9038-73776a3904f4.csv](https://metabase-bkp.theelefant.ai/public/question/0b3450ef-d477-4a21-9038-73776a3904f4.csv) |
| **User Order and Delivery Status of All New Users** | [https://metabase-bkp.theelefant.ai/public/question/d88a76c5-bbde-4300-9421-8d86f9180a0d.csv](https://metabase-bkp.theelefant.ai/public/question/d88a76c5-bbde-4300-9421-8d86f9180a0d.csv) |

---

## 3. 💾 Local Data Files in Project

These files are located in the `data/` directory of the project:

- `data/data.json` — Aggregated master database generated by `scripts/sync_sheets.js`. This is the single source of truth consumed by `public/index.html` and `scripts/build_report.js`.
- `data/delivery_fees.csv` — Cached delivery fee records.
- `data/app_downloads.csv` — Cached app downloads records.
- `data/daily_lead_journey.csv` — Cached lead journey and subscription statistics.

---

## 4. 🔄 How Syncing Works

The script that fetches and compiles all these sources into `data/data.json` is located at:
`scripts/sync_sheets.js`

To run a manual sync at any time:
```bash
node scripts/sync_sheets.js
```
