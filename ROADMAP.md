# turczynski.pl Future Enhancements and Ideas (Updated November 2025)

This version reflects verified DNS, header, and caching configuration data from your latest checker output.

---

## ✅ Confirmed Complete

| Area | Status | Notes |
|------|---------|-------|
| **SPF / DKIM / DMARC** | ✅ Configured (`reject` policy, strict alignment). |
| **MTA-STS policy file** | ✅ Present and valid. |
| **TLS-RPT (_smtp._tls)** | ✅ Active and functional. |
| **CAA records** | ✅ Present and include SXG support (`cansignhttpexchanges=yes`). |
| **SSL certificate** | ✅ Valid, modern Google Trust Services cert (expires Jan 2026). |
| **Security headers** | ✅ Excellent — strong CSP, HSTS, Permissions-Policy, COOP/COEP. |
| **CORS configuration** | ✅ None exposed — correct. |
| **HTML cache-control** | ✅ Using `public, max-age=0, must-revalidate`. |
| **Favicons & manifest caching** | ✅ Long-term immutable caching configured. |
| **Honeypot telemetry operations** | ✅ D1 retention endpoint + Access-protected dashboard live. |

---

## ⚠️ Needs Improvement or Follow-Up

| Area | Issue | Next Step |
|------|--------|-----------|
| **Legacy CAA issuers** | Comodo / SSL.com still listed. | Remove if not in use. Keep `digicert`, `letsencrypt`, `pki.goog`. |
| **MTA-STS mode** | `testing` mode still active. | Switch to `enforce` and update `_mta-sts` TXT `id=` value. |
| **Expect-CT header** | Deprecated. | Remove entirely. |
| **X-XSS-Protection** | Legacy header. | Remove; CSP provides coverage. |
| **Asset cache TTL** | 4h (`max-age=14400`). | Adjust to `31536000, immutable`. Likely Cloudflare override. |
| **DNSSEC** | Disabled. | Expected; monitor AZ.pl for DNSSEC UI availability. |

---

## 💡 Future Ideas (Still Relevant)

### 🧩 Easy Additions
- **CSP Reporting (Report-Only)** — implement `/csp` collector with `Report-To` endpoint.
- **Server-Timing breadcrumbs** — expose build ID + edge processing time.
- **RUM beacon** — gather Core Web Vitals → visualize weekly trends.
- **Image proxy route** (`/i/*`) — Cloudflare Image Resizing with auto format negotiation.
- **KV feature flags** — small experiment toggles without redeploys.
- **Cache Rules** — for future `/assets/*` or media directories.

### 🔒 Security & Observability
- **NEL + Report-To endpoint** — collect browser-side network errors.
- **TLS-RPT + DMARC dashboard** — automated parsing and visualization.
- **security.txt / trust.json** — standardized transparency and contact metadata.

### 🎨 Experimental / Showcase
- **Diagnostics page** — shows active headers, CSP compliance, deploy info.
- **WebAuthn demo** — passkey / Turnstile hybrid experiment.
- **Easter-egg error pages** — dynamic 404/410 with internal search hints.

---

_This document supersedes previous versions of `future_ideas.md` and represents the verified baseline as of November 2025._
