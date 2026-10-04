# چالش تست ترکیبی: یکپارچگی API Stateful و UI/E2E (مستندات فارسی)

## مروری بر هدف
این پروژه یک چالش تست در سطح Mid-Level است که شامل دو بخش اصلی می‌شود:
1. Integration Testing با Postman: ارزیابی یک API واقعی و stateful، بررسی جریان داده بین Endpointها و تحلیل رفتار در مسیرهای مختلف و شرایط شکست.
2. UI / E2E Testing با Playwright: اجرای سناریوی کسب‌و‌کاری واقعی روی یک رابط کاربری (files in frontend/) که مستقیماً به API متصل است و حفظ State در طول جریان.

زمان پیشنهادی: حدود 90 دقیقه

پورت‌ها:
- API (app.js): 3000
- Frontend (static files): 3001 (در Readme توضیح داده شده که start.bat اجرا شود تا هر دو سرویس بالا بیایند)

نکته: برای اجرای تمرین فرض شده است که یک فایل start.bat تعبیه شده و آن را اجرا کنید تا Node.js و Frontend استارت شوند. (فایل start.bat در بسته وجود ندارد اما توضیحات اجرایی در ادامه آمده است.)

--------------------------------------------------------------------------------

فهرست فایل‌ها و ساختار مورد انتظار تست‌ها (خروجی که باید تولید کنید):

tests/
  ─ postman/
     ─ collection.json
     ─ environment.json
     ─ newman-report.json (یا .html)

  ─ jmeter/
     ─ test-plan.jmx
     ─ results.jtl

  ─ playwright/
     ─ package.json
     ─ playwright.config.js
     ─ tests/*.spec.js

  ─ selenium/
     ─ source E2E (کدهای نمونه)

  ─ robotframework/
     ─ source E2E (کدهای نمونه)

  ─ Report.md

--------------------------------------------------------------------------------

الزامات کلی (مهم):
- از ابزارهای مشخص‌شده استفاده شود (Postman/Newman برای Integration، Playwright یا Selenium یا Robot Framework برای UI/E2E).
- تستر نباید منطق API را تغییر دهد یا سرویس جدید ایجاد کند. فقط از app.js ارائه‌شده استفاده شود.
- API باید به‌صورت stateful واقعی باشد. فراخوانی Endpointها خارج از توالی معتبر باید منجر به خطای معنادار (4xx/5xx) شود.
- UI ارائه‌شده در پوشه frontend باید بدون تغییر اجرا شود و تست‌ها باید مستقیماً روی DOM واقعی اجرا شوند.
- در طول تست‌ها باید داده‌ها از پاسخ‌های قبلی به‌صورت پویا استخراج و در مراحل بعدی استفاده شوند؛ استفاده از داده‌های ثابت یا شبیه‌سازی جریان قبلی قابل قبول نیست.

--------------------------------------------------------------------------------

چالش‌ها (به ازای هر کدام فقط یک چالش تعریف شده است):

1) Integration Testing – ارزیابی ارتباط بین سرویس‌ها (data flow) – Postman
- شرح: شرکت‌کننده باید با استفاده از Postman یک Collection بسازد که توالی واقعی درخواست‌ها را اجرا کند: ایجاد session -> افزودن آیتم‌ها -> checkout -> (در صورت نیاز) verification -> pay -> در صورت نیاز 3DS confirmation. در این فرایند مقادیر sessionId، paymentToken، verificationToken و سه‌توکن 3DS باید از پاسخ‌ها استخراج و در درخواست‌های بعدی مورد استفاده قرار گیرند.
- موارد ارزیابی:
  - آیا فراخوانی‌های پشت سر هم مطابق توالی لازم اجرا شده‌اند؟
  - آیا خروجی‌های مرحله به‌طور پویا در مراحل بعدی مورد استفاده قرار گرفته‌اند؟
  - آیا توالی‌های نامعتبر (مثلاً پرداخت بدون token یا checkout در state نامناسب) با خطاهای معنادار مواجه می‌شوند؟
  - آیا مسیرهای غیرخطی (manual_review، verification_required، 3ds_required) شناسایی و قابل بازتولید هستند؟
- خروجی لازم: Collection.json (با استفاده از متغیرها و تست‌ها برای extract کردن مقادیر)، environment.json، و خروجی اجرای Newman (newman-report.json یا html).

2) UI / E2E Testing – اجرای سناریوی کسب‌و‌کاری با Playwright
- شرح: یک مجموعهٔ تست Playwright ایجاد کنید که یک سناریوی E2E کامل را روی UI واقعی اجرا کند: ایجاد session، افزودن آیتم، رفتن به صفحهٔ Checkout، اجرای checkout، مدیریت مسیرهای verification/3DS، و تأیید تغییرات DOM و پیام‌های موفق/خطا. تست‌ها باید بدون تغییر در فایل‌های frontend اجرا شوند.
- الزامات UI در این چالش:
  1. UI واقعی و قابل اجرا در پوشه frontend قرار دارد.
  2. همه فایل‌های Frontend در پوشه frontend قرار گرفته‌اند (HTML/CSS/JS).
  3. UI به app.js متصل است و داده‌ها را از API مصرف می‌کند.
  4. اجرای Playwright نباید نیاز به تغییر در UI داشته باشد.
  5. تستر فقط مجاز به نوشتن تست است و اجازهٔ اصلاح UI یا منطق آن را ندارد.
- موارد ارزیابی:
  - بررسی دقیق تغییرات DOM پس از هر مرحله (نمایش پیام موفق/خطا، تغییر وضعیت، نمایش صفحهٔ verification یا 3DS).
  - سناریوهای شکست: payment_token_expired، verification_failed، 3ds_failed که برخی از آنها فقط از طریق رفتار UI قابل مشاهده‌اند.
  - گزارش تحلیلی شامل وضعیت هر مرحله، زمان پاسخ و تحلیل State.

--------------------------------------------------------------------------------

کاتالوگ سرویس‌ها (API Contract)

توضیحات کلی: این API یک «جلسهٔ خرید» (session) مدیریت می‌کند که شامل چند State است. توالیٔ کلی معتبر: browsing -> items_added -> checkout_pending (یا verification_required/manual_review) -> (checkout_pending -> maybe 3ds_required -> paid) یا expired/payment_failed.

Endpoints:

1) POST /sessions
- هدف: ایجاد یک session جدید
- پیش‌نیاز State/Sequence: ندارد (شروع کار)
- Request: Headers: Content-Type: application/json ; Body: none
- Possible Responses:
  - 201 { sessionId, state }
- خطاهای معنادار: none (در حالت عادی)
- نمونه: درخواست خالی -> پاسخ شامل sessionId و state

2) POST /sessions/:id/items
- هدف: افزودن آیتم به سبد
- پیش‌نیاز: session موجود؛ state باید یکی از ['browsing','items_added'] باشد
- Request: Headers: Content-Type: application/json ; Body: { name: string, price: number }
- Responses:
  - 200 { sessionId, state, total, items }
- خطاها:
  - 404 session_not_found
  - 409 invalid_state_for_adding_items
  - 400 invalid_item
- نمونه: ارسال {name,price} -> دریافت total به‌روزرسانی شده

3) POST /sessions/:id/checkout
- هدف: شروع فرآیند Checkout؛ بر اساس total مسیر متفاوت انتخاب می‌شود
- پیش‌نیاز: state باید 'items_added'
- Request: Headers: Content-Type: application/json ; Body: none
- Possible Responses:
  - 200 { paymentToken, state, expiresInSec } // مسیر معمولی
  - 200 { action: 'additional_verification', verificationToken, state } // total > 100
  - 200 { action: 'manual_review_required', verificationToken, state } // total > 200
- خطاها:
  - 404 session_not_found
  - 409 invalid_state_for_checkout
- نمونه: اجرای checkout برای سبد با جمع 120 ممکن است action: additional_verification بدهد

4) POST /sessions/:id/pay
- هدف: انجام پرداخت؛ رفتاری وابسته به state
- پیش‌نیاز: state باید 'checkout_pending' یا 'verification_required' (در حالت verification_required باید verificationCode ارائه شود) یا 'manual_review' با کد خاص
- Request Body: { paymentToken?, verificationCode? }
- Responses:
  - 200 { message: 'payment_success', state: 'paid' }
  - 200 { action: '3ds_required', threeDSToken, state } // مسیر غیرخطی برای برخی مبالغ
  - 200 { message: 'verification_ok', paymentToken, state } // زمانی که verificationCode پذیرفته شود
- خطاها:
  - 404 session_not_found
  - 409 invalid_state_for_pay
  - 400 invalid_payment_token
  - 410 payment_token_expired (و state -> expired)
  - 400 verification_failed
  - 423 manual_review_locked
- نمونه: ارسال { paymentToken } -> یا خطا یا action:3ds_required یا success

5) POST /sessions/:id/3ds/confirm
- هدف: تأیید 3DS
- پیش‌نیاز: state باید '3ds_required'
- Request Body: { threeDSToken, result: 'success'|'fail' }
- Responses:
  - 200 success -> state: paid
  - 402 3ds_failed -> state: payment_failed
  - 400 invalid_3ds_token

6) POST /sessions/:id/expire
- هدف: منقضی کردن جلسه یا توکن برای شبیه‌سازی خطا
- پیش‌نیاز: session موجود
- Request: none
- Response: 200 { message: 'session_expired', state: 'expired' }

7) GET /sessions/:id/status
- هدف: مشاهده state فعلی و اطلاعات جلس
- Request: none
- Response: 200 { id, state, items, total, tokenValid }


--------------------------------------------------------------------------------

نحوهٔ اجرای تست‌ها (راهنمای شروع سریع)

1) اجرای سرویس
- طبق قرارداد، اجرای start.bat باید سرویس Node (app.js) را روی پورت 3000 و سروِر استاتیک frontend را روی 3001 راه‌اندازی کند.
- در محیط‌های محلی: ابتدا نصب وابستگی‌ها `npm install express body-parser cors` سپس `node app.js` و برای frontend می‌توانید یک static file server بر روی 3001 راه‌اندازی کنید (مثلاً serve یا simple-http-server). اما در مسابقه فرض بر وجود start.bat است.

2) Integration (Postman/Newman)
- مجموعهٔ Postman در tests/postman/collection.json قرار دارد و از متغیر‌های sessionId/paymentToken/... استفاده می‌کند.
- محیط نمونه در tests/postman/environment.json قرار دارد.
- اجرای Newman روی collection و environment خروجی در tests/postman/newman-report.json تولید می‌کند.

3) UI/E2E (Playwright)
- پوشه tests/playwright شامل package.json و تنظیمات Playwright و تست‌های E2E است.
- اجرای تست‌ها: پس از نصب وابستگی‌ها (`npm install`) با دستور `npx playwright test` اجرا کنید. تست‌ها صفحه‌ها را باز کرده، فرم‌ها را کامل می‌کنند و تغییرات DOM و پیام‌ها را بررسی می‌کنند.

4) JMeter
- یک Test Plan نمونه در tests/jmeter/test-plan.jmx قرار دارد که سناریوی اضافه کردن آیتم و checkout را شبیه‌سازی می‌کند و فایل خروجی در results.jtl ذخیره می‌شود.

5) Selenium / Robot Framework
- نمونه‌های اولیهٔ سورس تست‌ها در فولدرهای مربوطه قرار دارند (برای مرجع و توسعهٔ بیشتر).

6) گزارش نهایی
- یک فایل خلاصه tests/Report.md باید تولید شود که شامل توصیف جریان‌ها، نتایج اجرای Newman و Playwright و تحلیل Stateها و نقاط ضعف احتمالی است.

--------------------------------------------------------------------------------

نکات مهم برای تستر

- از بازپخش پاسخ‌ها یا داده‌های ثابت استفاده نکنید؛ داده‌ها باید پویا از پاسخ‌ها استخراج شوند.
- مسیرهای غیرخطی (manual_review، verification_required، 3ds_required) را شناسایی کنید و برای هر مسیر تست بنویسید.
- سناریوهای شکست (token منقضی، verification غیرمعتبر، فراخوانی در state نادرست) را هم تست و مستندسازی کنید.
- در گزارش نهایی، توصیف جریان داده‌ها، وابستگی‌های State، و ارزیابی انسجام سرویس‌ها ضروری است.

--------------------------------------------------------------------------------

Hints (راهنمای کلی - بدون اشارهٔ مستقیم به راه‌حل)
- دنبال extraction و correlation متغیرهای sessionId و tokenها در جریان باشید.
- توجه کنید برخی مسیرها فقط با ورودی‌های خاص یا مقدار total مشخص فعال می‌شوند.
- رفتار UI ممکن است اطلاعات بیشتری نسبت به API خام نشان دهد (مثلاً صفحهٔ تأیید یا پیام 3DS).

--------------------------------------------------------------------------------

ردهٔ سطح (سطح مسأله)
- این چالش در سطح Mid-Level طراحی شده است؛ نیازمند تحلیل توالی‌ها، استخراج داده و پوشش مسیرهای مختلف است.

