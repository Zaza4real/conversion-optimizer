# Support page and contact (Pro 24/7 support)

The app has a **Support** page so merchants can reach you. The store landing and footer link to it, and the page highlights **Pro plan 24/7 support**.

---

## What’s in place

- **Backend:** `GET /support` serves a premium-styled support page with:
  - “Pro plan: 24/7 priority support” badge
  - Contact section (email if set, or link to app listing)
  - Short links to Privacy and Refund

- **Store landing:**
  - **Need help?** section with “Pro plan includes 24/7 support” and a **Contact support** link
  - Footer: **Privacy | Refund policy | Support**

---

## Show your support email on the page

Set this variable on your backend (e.g. Railway):

| Variable | Description |
|----------|-------------|
| **SUPPORT_EMAIL** | Your support email (e.g. `support@yourdomain.com` or your Gmail). Shown on `/support` as a clickable `mailto:` link. |

If **SUPPORT_EMAIL** is not set, the support page still works and tells visitors to use the contact from the app listing.

---

## URL

- **Support page:** `https://conversion-optimizer-api-production.up.railway.app/support`  
  (Replace with your own backend URL if different.)

The store landing uses this URL for the “Contact support” link and the footer **Support** link.
