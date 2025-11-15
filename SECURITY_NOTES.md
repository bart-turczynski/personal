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
| MTA-STS | ✅ | Mode: enforce (policy + `_mta-sts` TXT `id` rolled Nov 2025) |
| TLS-RPT | ✅ | `rua=mailto:dmarc-reports@turczynski.pl` |
| DNSSEC | ⏳ | Enable via Cloudflare DNS + DS entry at AZ.pl |
| CAA | ✅ | Cloudflare Universal SSL injects Digicert/Let’s Encrypt/pki.goog + fallback issuers (Comodo/SSL.com) on Free plan; upgrade or custom certs required to prune. |

---

## DNSSEC Playbook (AZ.pl Registrar + Cloudflare DNS)

Cloudflare Registrar does **not** support `.pl`, but you can still host DNS at Cloudflare and push its DS record to AZ.pl.

### 1. Pre-flight (T-7 to T-2 days)
- **TTL tuning:** set A/AAAA, MX, `_mta-sts`, `_smtp._tls`, `_dmarc`, `_imap._tcp`, and `CAA` records to `300`.
- **Inventory:** export the zone from AZ.pl (Panel → Domains → Zone Export) including honeypot entries; store alongside this repo.
- **Nameserver readiness:** confirm AZ.pl already points to Cloudflare’s nameservers; if not, schedule that change first.
- **DNSSEC capability check:** inside AZ.pl, ensure the DNSSEC view allows custom DS data for `.pl`. If not visible, request enablement via support.

### 2. Stage/validate Cloudflare DNS (T-2 days)
- Recreate/import every record from the exported zone and verify special records (CAA with `cansignhttpexchanges=yes`, `_mta-sts`, `_smtp._tls`) exist.
- Use:
  ```bash
  dig @<cloudflare-ns> turczynski.pl TXT +noall +answer
  dig @<cloudflare-ns> turczynski.pl caa
  ```
  to check Cloudflare’s view before switching anything else.

### 3. Enable DNSSEC in Cloudflare (T-0)
- Cloudflare Dashboard → DNS → **DNSSEC** → Enable. Copy Key Tag, Algorithm, Digest Type, and Digest (SHA-256).
- In AZ.pl: Domain → DNSSEC → Add DS record → paste the four values → save. AZ.pl pushes the DS to the `.pl` registry.

### 4. Validation (same day)
- Run:
  ```bash
  dig turczynski.pl DS +dnssec
  dig turczynski.pl A +dnssec | grep flags
  whois turczynski.pl | grep -i dnssec
  ```
- Expect the DS record and `ad` flag on lookups. Monitor DMARC/TLS-RPT for any anomalies during the first 24h.

### 5. Post-checks & rollback
- Restore TTLs to normal (e.g., 3600), relock the domain at AZ.pl, and re-enable privacy.
- If you must roll back, first **disable DNSSEC inside Cloudflare** (removes DS data it publishes), then delete the DS at AZ.pl before any nameserver or registrar changes.
- Optionally evaluate alternative registrars that support `.pl` transfers plus DS management (OVH, Gandi, Porkbun) if AZ.pl tooling becomes limiting.

> **CAA limitation:** With Universal SSL enabled on the Free plan, Cloudflare’s nameservers always publish the full list of issuers they may use (Let’s Encrypt, Digicert, Sectigo/Comodo, SSL.com, etc.). The custom CAA rows you add appear under DNS → Records, but the extra issuers persist until you either upgrade to Advanced Certificate Manager (and restrict the CA list there) or disable Universal SSL and supply your own edge certificates. Hence the roadmap item is “complete” once the UI list reflects only the desired issuers and you’ve documented this limitation.

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

- Pages Function `functions/api/inbound.js` can send email alerts for high-score or honeypot events.
- Supported providers: `RESEND`, `SENDGRID`, or `MAILCHANNELS` (set via env).
- Configure in Cloudflare Pages → Project → Settings → Variables & Secrets, then redeploy:
  - `MAIL_PROVIDER` = `RESEND` or `SENDGRID` or `MAILCHANNELS`
  - `MAIL_API_KEY` = provider API key (not required for `MAILCHANNELS`)
  - `ALERTS_TO` = `alerts@turczynski.pl`

## Retention Automation

- Raw telemetry older than **14 days** is purged via `functions/api/inbound/prune.js`.
- Configure:
  - `PRUNE_SECRET` (Secret): shared key required to invoke the endpoint.
  - `RETENTION_DAYS` (Optional, default `14`): number of days to keep. Values are capped at 365.
- Endpoint:
  ```bash
  curl -X POST "https://contact.turczynski.pl/api/inbound/prune?secret=<PRUNE_SECRET>"
  ```
  Response includes deleted row count, oldest/newest timestamps, and per-class breakdown. Results are also stored in the `retention_log` D1 table.
- Automation:
  - Create a Cloudflare Cron Trigger (Workers → Triggers → Add schedule).
  - Worker snippet:
    ```js
    export default {
      async scheduled(_event, env, ctx) {
        ctx.waitUntil(fetch("https://contact.turczynski.pl/api/inbound/prune", {
          method: "POST",
          headers: { "x-prune-secret": env.PRUNE_SECRET }
        }));
      }
    }
    ```
- Bind `PRUNE_SECRET` to that Worker so the fetch succeeds.

## DNS Hosting Migration & DNSSEC Plan

- **Objective:** move authoritative DNS from AZ.pl to Cloudflare and enable DNSSEC using the registrar-provided AuthInfo snippet.
- **Pre-migration checklist**
  - Export current zone file (MX, TXT, CAA, _mta-sts, etc.).
  - Copy AuthInfo code from AZ.pl (already stored securely) for the transfer.
  - Validate Cloudflare has equivalent records staged (use “Add site” wizard in paused mode if necessary).
- **Cut-over steps**
  1. Initiate domain transfer to Cloudflare Registrar using the AuthInfo code.
  2. Once Cloudflare becomes the registrar, verify Cloudflare DNS zone contains all records.
  3. Switch nameservers to the ones provided during onboarding (Cloudflare automates this after transfer).
- **Enable DNSSEC**
  1. In Cloudflare DNS → DNSSEC → Enable.
  2. Publish the DS record at the registrar (handled automatically once the transfer completes).
  3. Verify with `dig +dnssec turczynski.pl`.
- **Post-migration checks**
  - Re-run the email/DNS health scripts.
  - Update `ROADMAP.md` and these notes when DNSSEC shows as `✅`.

## Operator Dashboard

- Endpoint: `functions/api/inbound/dashboard.js`
  - GET `https://contact.turczynski.pl/api/inbound/dashboard?hours=24`
  - Auth: header `X-Digest-Secret: <DIGEST_SECRET>` or `?secret=...`
- Features:
  - Summary counts (total, honey, score ≥ threshold)
  - Top forms/paths, countries, source IPs
  - Detailed table of the latest 40 events
- Recommended protection:
  - Place the route behind Cloudflare Access and inject the shared secret via a service token header.
  - For local checks, supply `?secret=` manually.
- Note: the free Zero Trust tier does not expose header injection in the UI, so use a browser header extension (e.g., ModHeader) or include the header in CLI requests until upgraded.
- Troubleshooting:
  - HTTP 401 → secret missing or mismatched.
  - HTTP 500 → ensure the Pages project has the D1 binding `DB`.
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
- Optional shared secret: set `INBOUND_SECRET` (Secret) in Pages and append `?secret=<value>` to the SendGrid destination URL (or send it via `X-Inbound-Secret`). Requests without the secret return 401.

### WAF / Rate limits
- Cloudflare’s custom WAF and rate-limiting rules require a paid plan. On the current free tier, rely on:
  - `INBOUND_SECRET` for webhook auth.
  - Alert caps (`ALERT_HOURLY_CAP`, `ALERT_DEDUP_WINDOW_MIN`).
  - Logs via Workers tail (`wrangler pages functions tail ...`).
- If you upgrade later, add Log-mode WAF/rate limits for `/api/inbound` and `/api/sg-inbound` at that time.
