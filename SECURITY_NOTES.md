# SECURITY_NOTES.md

This document combines the previous *website_security_notes.md* and *website_security_notes2.md* files.
It serves as a self-contained implementation and reference guide for DNS, headers, CSP, and deployment validation.

---

## 🔧 Implementation Notes & Context

# Website Security and Optimization Notes

## Current State (as of November 2025)
- Domain: **turczynski.pl**
- Deployment: Eleventy → GitHub → Cloudflare Pages
- Grade: A+ (securityheaders.com)
- Outstanding items to consider later: DNSSEC, COEP (`require-corp`), advanced CSP refinements

---

## Content Security Policy (CSP) Optimization Plan

### 1. Current Policy
```
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline' https:;
img-src 'self' data: https:;
font-src 'self' data: https:;
connect-src 'self';
object-src 'none';
base-uri 'self';
frame-ancestors 'none';
form-action 'self';
upgrade-insecure-requests;
```

### 2. Improvements
- Remove `'unsafe-inline'` by using **nonces** or **hashes** for inline CSS.
- Introduce **`Content-Security-Policy-Report-Only`** for testing stricter policies safely.
- Add **`Report-To`** endpoint to collect violation reports (via Cloudflare Worker or Pages Function).
- Optionally define per-section CSP (e.g., stricter `/admin/*` rules).

### 3. Future Policy Example
```
default-src 'self';
script-src 'self' 'nonce-{RANDOM_NONCE}';
style-src 'self' 'nonce-{RANDOM_NONCE}' https:;
img-src 'self' data: https:;
font-src 'self' data: https:;
connect-src 'self';
object-src 'none';
base-uri 'self';
frame-ancestors 'none';
form-action 'self';
upgrade-insecure-requests;
report-to csp;
```

---

## DNS and Mail Security Enhancements

| Feature | Status | Notes |
|----------|---------|-------|
| SPF | ✅ | `v=spf1 include:_spf.google.com -all` |
| DKIM | ✅ | Selector: `google._domainkey` |
| DMARC | ✅ | Strict alignment (`p=reject; sp=reject; aspf=s; adkim=s`) |
| MTA-STS | ✅ | Mode: testing (enforce later) |
| TLS-RPT | ✅ | `rua=mailto:dmarc-reports@turczynski.pl` |
| DNSSEC | ⏳ | Enable later via AZ.pl |
| CAA | ✅ | Tight issuer control, SXG ready |

---

## Security Headers (Planned Adjustments)

| Header | Current | Planned |
|---------|----------|----------|
| Strict-Transport-Security | max-age=31536000; preload | Keep |
| X-Frame-Options | deny | Keep |
| X-Content-Type-Options | nosniff | Keep |
| Referrer-Policy | strict-origin-when-cross-origin | Keep |
| Permissions-Policy | strict (all APIs denied) | Keep |
| Cross-Origin-Opener-Policy | same-origin | Keep |
| Cross-Origin-Resource-Policy | same-origin | Keep |
| Cross-Origin-Embedder-Policy | *missing* | Add: `require-corp` later |
| X-XSS-Protection | present | Remove (deprecated) |
| Expect-CT | present | Remove (deprecated) |

---

## Implementation Notes

### A. Cloudflare Pages `_headers` file
```
/*
  Cross-Origin-Embedder-Policy: require-corp
  X-XSS-Protection:
  Expect-CT:
```
*(Empty value removes header in Cloudflare Pages)*

### B. Transform Rules Alternative
- Add header: `Cross-Origin-Embedder-Policy = require-corp`
- Remove: `X-XSS-Protection`, `Expect-CT`

---

## Testing Commands

```bash
curl -s -I https://turczynski.pl | grep -Ei "cross|content|policy|x-|strict|referrer"
dig +noall +answer _mta-sts.turczynski.pl txt
dig +noall +answer _smtp._tls.turczynski.pl txt
dig +noall +answer turczynski.pl caa
```

---

## Future Experiments & Ideas

- Deploy **CSP reporting endpoint** (Cloudflare Worker + R2/Queues).
- Implement **edge analytics** (Core Web Vitals via Worker beacon).
- Add **feature-flag routing** using Cloudflare KV (for A/B testing).
- Explore **Signed Exchanges (SXG)** — CAA already supports it.
- Enable **DNSSEC** and submit to preload once stable.
- Build a **security dashboard** (Eleventy data + DMARC/TLS-RPT parsing).

---

_These notes are meant as a roadmap for later security and performance hardening._


---

## 🧪 Deployment Validation Checklist



---

## ✅ Deployment Validation Checklist

Use these quick commands to confirm headers and caching behavior after any configuration change.

### 1. Verify cache-control on HTML
```bash
curl -I https://turczynski.pl | grep -i cache-control
```
Expected:
```
cache-control: public, max-age=0, must-revalidate
```

### 2. Verify cache-control on immutable assets
```bash
curl -I https://turczynski.pl/favicon.ico | grep -i cache-control
```
Expected:
```
cache-control: public, max-age=31536000, immutable
```

### 3. Confirm security headers are still intact
```bash
curl -s -I https://turczynski.pl | grep -Ei "strict|content|referrer|frame|cross|permissions|policy|x-|server|vary"
```
Check for:
- `Content-Security-Policy`
- `Strict-Transport-Security`
- `X-Content-Type-Options`
- `X-Frame-Options`
- `Permissions-Policy`

### 4. Confirm revalidation in browser
- Open DevTools → Network tab.
- Load the homepage twice.
- First request: **200 OK**
- Second request: **304 Not Modified**

This verifies conditional revalidation and cache health.

### 5. Optional: Validate MTA-STS, DKIM, DMARC
```bash
dig +noall +answer _mta-sts.turczynski.pl txt
dig +noall +answer _dmarc.turczynski.pl txt
dig +noall +answer default._domainkey.turczynski.pl txt
```
Ensure that DNS records and `.well-known/mta-sts.txt` respond correctly.

---

## Alerts Configuration (Email)

- Pages Function `functions/api/inbound.js` can send email alerts for high‑score or honeypot events.
- Supported providers: `RESEND`, `SENDGRID`, or `MAILCHANNELS` (set via env).
- Configure in Cloudflare Pages → Project → Settings → Variables & Secrets, then redeploy:
  - `MAIL_PROVIDER` = `RESEND` or `SENDGRID` or `MAILCHANNELS`
  - `MAIL_API_KEY` = provider API key (not required for `MAILCHANNELS`)
  - `ALERTS_TO` = `alerts@turczynski.pl`
  - `ALERTS_FROM` = `alerts@turczynski.pl` (or another verified sender)
  - Optional: `ALERT_THRESHOLD` = `60`

Validation:
```bash
curl -s -i -X POST https://contact.turczynski.pl/api/inbound \
  -F form_id=test -F honey_token=filled
```
Expect HTTP 202 and an email delivered to `alerts@turczynski.pl`.

MailChannels DNS note:
- Add to your SPF if sending via MailChannels to improve deliverability:
  `v=spf1 include:relay.mailchannels.net include:_spf.google.com -all`
  Keep DMARC/DKIM aligned with your primary provider (Google Workspace). For best results, consider a dedicated subdomain for alerts (e.g., `alerts@notify.turczynski.pl`) with its own SPF.
### Alert caps & digest

- Per‑hour cap: set `ALERT_HOURLY_CAP` (default 20). Alerts beyond this are suppressed.
- Dedup window: set `ALERT_DEDUP_WINDOW_MIN` (default 60) to suppress repeats from the same IP.
- Digest endpoint (manual or scheduled):
  - URL: `/api/inbound/stats?hours=24&send=1`
  - Auth: header `X-Digest-Secret: <value>` or `?secret=<value>` (set `DIGEST_SECRET` in variables)
  - Sends a text digest to `ALERTS_TO` summarising totals, top IPs, and recent hits.

---

## Inbound Email via SendGrid (no VM)

Goal: receive mail for `@email.turczynski.pl` and POST it to the site for parsing/telemetry.

Steps
- SendGrid Dashboard → Settings → Inbound Parse → Add Hostname
  - Hostname: `email.turczynski.pl`
  - Destination URL: `https://contact.turczynski.pl/api/sg-inbound`
  - Spam check: enabled (optional)
  - Send raw: disabled (optional; we only need fields)
  - Require TLS: enabled (recommended)
  - Save → follow DNS instructions below

- Cloudflare DNS (DNS only / grey cloud)
  - MX: Name `email`, Content `mx.sendgrid.net`, Priority `10`, TTL Auto
  - Remove any Pages custom domain mapping on `email.turczynski.pl` to avoid CNAME/MX conflict

Verification
- `dig +short MX email.turczynski.pl` should return `mx.sendgrid.net.`
- Send a test from another mailbox to `test@email.turczynski.pl`.
- The function `functions/api/sg-inbound.js` stores a row in D1 and optionally emails an alert based on `ALERT_THRESHOLD`.

Notes
- We store only metadata and a short preview; attachments are not persisted, only their names/types/sizes.
- Alert subject includes score, remote IP, and subject preview to help triage quickly.
