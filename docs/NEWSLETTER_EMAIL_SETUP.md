# Newsletter signup — receive emails when someone subscribes

The store landing page includes a **Join our email list** form that posts to your app backend. Every signup is saved in the database. You can also receive an email notification for each new signup.

---

## What’s already working

- **Form:** The landing snippet (in Custom liquid) has a form that POSTs to  
  `https://conversion-optimizer-api-production.up.railway.app/api/landing/newsletter`
- **Storage:** Each signup is stored in the `newsletter_signups` table (after you run the migration).
- **Redirect:** After submit, the visitor is sent back to your store with `?newsletter=success` (or `newsletter=invalid` if the email was invalid). The snippet shows a short “Thanks for signing up!” message when that param is present.

---

## Run the migration

The `newsletter_signups` table is created by migration `1700000000003-NewsletterSignups`. Run it **after deploy** (e.g. on Railway, or locally with `DATABASE_URL` pointing at your DB):

```bash
cd apps/backend && npm run migration:run
```

On Railway you can run this once from your machine with `DATABASE_URL` set to the Railway Postgres URL, or add it to your deploy/release step.

---

## Receive an email for each signup

Set these **variables in Railway** (or your backend host) so the app sends you an email whenever someone subscribes:

| Variable | Required | Description |
|----------|----------|-------------|
| `NEWSLETTER_NOTIFY_EMAIL` | Yes (for email) | Your email address. All signup notifications are sent here. |
| `SMTP_HOST` | Yes (for email) | SMTP server, e.g. `smtp.gmail.com`, `smtp.sendgrid.net` |
| `SMTP_PORT` | No | Default `587` |
| `SMTP_SECURE` | No | Set to `true` for port 465 |
| `SMTP_USER` | Yes (for email) | SMTP username (often your email) |
| `SMTP_PASS` | Yes (for email) | SMTP password or app password |

If any of these are missing, signups are still saved in the database but no email is sent.

### Examples

**Gmail (use an App Password):**

- `SMTP_HOST=smtp.gmail.com`
- `SMTP_PORT=587`
- `SMTP_USER=your@gmail.com`
- `SMTP_PASS=your-app-password`
- `NEWSLETTER_NOTIFY_EMAIL=your@gmail.com`

**SendGrid:**

- `SMTP_HOST=smtp.sendgrid.net`
- `SMTP_PORT=587`
- `SMTP_USER=apikey`
- `SMTP_PASS=<your SendGrid API key>`
- `NEWSLETTER_NOTIFY_EMAIL=you@example.com`

---

## Theme “Join our email list” (footer)

If your theme (e.g. Horizon) has its own **Join our email list** block in the footer, that is separate from the form in the Conversion Optimizer landing snippet:

- **Theme block:** Usually connected to Shopify Email or the theme’s newsletter app. Configure it in **Theme → Customize → Footer** (or the section that contains it) and in **Settings → Customer accounts** / **Apps → Shopify Email** if you use Shopify’s built-in email.
- **Landing snippet form:** Handled entirely by your app backend (this doc). Signups are stored and optionally emailed to `NEWSLETTER_NOTIFY_EMAIL`.

To avoid two different forms, you can remove the theme’s newsletter block from the footer and keep only the one in the Conversion Optimizer landing section, or keep both if you want (e.g. one on the app landing, one site-wide).
