

## ۴. جدول API

| Method | Path | هدف | پیش‌نیاز State | Request Body/Params | موفق | خطاها |
|---|---|---|---|---|---|---|
| POST | `/reserve/start` | شروع رزرو جدید | — | `{ userId }` | **201** `{ reservationId, status: 'started' }` | **400** ورودی نامعتبر (نبود userId) |
| POST | `/reserve/select` | انتخاب آیتم | رزرو فعال (started/selecting) | `{ reservationId, itemId }` | **200** `{ reservationId, items, status }` | **404** not found، **409** state conflict، **400** invalid itemId |
| POST | `/reserve/confirm` | تأیید رزرو | started/selecting با حداقل یک آیتم | `{ reservationId }` | **200** `{ reservationId, status: 'confirmed', summary }` | **404** not found، **409** no items / state conflict |
| POST | `/reserve/cancel` | لغو رزرو | started/selecting | `{ reservationId }` | **200** `{ reservationId, status: 'cancelled' }` | **404** not found، **409** confirmed/cancelled |
| GET | `/reserve/status` | استعلام وضعیت | — | `?reservationId=` | **200** وضعیت فعلی | **404** not found |

### نمونه JSON

```json
// POST /reserve/start → 201
{ "userId": "u1" }
→ { "reservationId": "a1b2c3d4e5f6a7b8", "status": "started" }

// POST /reserve/select → 200
{ "reservationId": "a1b2c3d4e5f6a7b8", "itemId": "i2" }
→ { "reservationId": "a1b2c3d4e5f6a7b8", "items": ["i2"], "status": "selecting" }

// POST /reserve/confirm → 200
{ "reservationId": "a1b2c3d4e5f6a7b8" }
→ { "reservationId": "a1b2c3d4e5f6a7b8", "status": "confirmed",
    "summary": { "userId": "u1", "items": ["i2"], "confirmedAt": 1712345678901 } }

// POST /reserve/cancel → 200
{ "reservationId": "a1b2c3d4e5f6a7b8" }
→ { "reservationId": "a1b2c3d4e5f6a7b8", "status": "cancelled" }

// GET /reserve/status?reservationId=... → 200
→ { "reservationId": "a1b2c3d4e5f6a7b8", "status": "confirmed", "items": ["i2"] }

// نمونه خطاها
→ 400 { "error": "userId required" }
→ 404 { "error": "reservation not found" }
→ 409 { "error": "cannot select item in current state" }
→ 409 { "error": "no items selected" }
→ 400 { "error": "invalid itemId" }
```

---

## ۵. سناریوهای موفق و ناموفق

**موفق:**
1. start (201) → select یک یا چند آیتم از `{i1..i4}` (200) → confirm (200) → status (200) برابر `confirmed`.
2. start (201) → cancel (200) → status (200) برابر `cancelled`.
3. select مجدد همان آیتم (بدون تکرار در `items`) → 200.

**ناموفق:**
1. start بدون `userId` → **400**.
2. select/confirm/cancel با `reservationId` ناموجود → **404**.
3. select یا confirm روی رزرو `confirmed`/`cancelled` → **409**.
4. select با `itemId` خارج از `{i1..i4}` → **400**.
5. confirm بدون هیچ آیتم انتخابی → **409** (`no items selected`).
6. cancel روی رزرو `confirmed` یا `cancelled` → **409**.
7. status با شناسه ناموجود → **404**.

---

## ۶. طرح Performance (۱۰ / ۲۵ / ۵۰ / ۱۰۰ کاربر هم‌زمان)

- **Thread Group پلکانی:** ۱۰ → ۲۵ → ۵۰ → ۱۰۰ کاربر؛ Ramp-up ۶۰ ثانیه؛ Loop Count متناسب با حجم هدف هر پله (مجموعاً ۱۵۰۰ / ۳۷۵۰ / ۷۵۰۰ / ۱۵۰۰۰ درخواست).
- **توالی وابسته به State:** هر Thread اجرای کامل `start → select (یک یا چند آیتم) → confirm → status` را با استخراج `reservationId` از پاسخ JSON (JSON Extractor / Regular Expression Extractor) انجام می‌دهد.
- **مسیرهای منفی:** درصدي از اجراها شامل select نامعتبر (400)، confirm بدون آیتم (409) و status با شناسه غلط (404) برای پوشش خطاهای معنادار.
- **شاخص‌های ثبت‌شده:** Average، p95، p99، Throughput، Error Rate، تعداد HTTP 500.

## ۷. طرح Stress (۱۰۰۰ درخواست)

- **Thread Group:** اجرای ۲۵۰ جریان کامل (هر جریان شامل start → select → confirm → status؛ در مجموع ۱۰۰۰ درخواست API) با Ramp-up ۳۰ ثانیه؛ در صورت نیاز از Throughput Shaping برای کنترل نرخ استفاده شود.
- **هدف:** بررسی عدم بروز خطای **HTTP 500**، نبود نشانه‌های **Memory Leak** (پایش `process.memoryUsage()` و RSS فرآیند Node)، و پایداری latency در طول زمان.
- **کنترل‌ها:** خطاهای 4xx مورد انتظار در مسیرهای منفی جداگانه از خطاهای غیرمنتظره تفکیک شوند؛ تعداد HTTP 500 باید صفر باشد. مقایسه p95/p99 ابتدا و انتهای اجرا برای کشف افت تدریجی انجام شود.

---

## ۸. جدول نتایج

> ⚠️ **داده‌های نمونه/شبیه‌سازی‌شده؛ اجرای واقعی JMeter انجام نشده است.**

| کاربران | درخواست‌ها | Average ms | p95 ms | p99 ms | Throughput req/s | Error Rate | HTTP 500 | وضعیت |
|---|---|---|---|---|---|---|---|---|
| 10  | 1500  | 18 | 31  | 45  | 52.6  | 0%    | 0 | قبول |
| 25  | 3750  | 24 | 44  | 61  | 96.8  | 0.03% | 0 | قبول |
| 50  | 7500  | 39 | 78  | 115 | 121.4 | 0.12% | 0 | قبول |
| 100 | 15000 | 82 | 165 | 248 | 138.7 | 0.45% | 0 | نیازمند بررسی |
| Stress (1000) | 1000 | 96 | 210 | 330 | 135.2 | 0.8% | 0 | قابل قبول مشروط |


