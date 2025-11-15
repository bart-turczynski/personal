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
| **Legacy CAA issuers** | Comodo / SSL.com still listed. | Cloudflare Universal SSL injects these automatically on Free plan; acceptable unless upgrading or self-managing edge certs. |
| **Expect-CT header** | Deprecated. | Remove entirely. |
| **X-XSS-Protection** | Legacy header. | Remove; CSP provides coverage. |
| **DNSSEC** | Disabled. | Cloudflare Registrar lacks `.pl` support; keep AZ.pl, point DNS to Cloudflare, then publish Cloudflare’s DS record at AZ. |

---

## 🛡️ DNSSEC Rollout (AZ.pl Registrar + Cloudflare DNS)

**Reality check:** `.pl` domains are not supported by Cloudflare Registrar, so keep AZ.pl as registrar but move DNS hosting to Cloudflare and publish Cloudflare’s DS data manually at AZ.

### Phase 0 – Prep (T-7 days)
- Lower TTLs on all critical records (A/AAAA, MX, TXT incl. SPF/DMARC, `_mta-sts`, `_smtp._tls`, `CAA`) to 300 seconds for fast rollback.
- Export the full zone file from AZ.pl and diff against Cloudflare’s DNS view to confirm parity.
- Confirm with AZ.pl support/UI that DNSSEC DS entries are allowed for `.pl` domains (Panel → Domain → Advanced → DNSSEC).

### Phase 1 – Stage Cloudflare DNS (T-3 days)
- Add/import the zone into Cloudflare (if not already) and recreate every record, including SXG-supporting `CAA` entries.
- Use `dig @<cloudflare-ns> turczynski.pl <type>` to verify Cloudflare responds identically to the current production zone.
- Update AZ.pl nameservers to Cloudflare’s pair if that is not already the case, then wait for `dig ns turczynski.pl +trace` to show Cloudflare.

### Phase 2 – Enable DNSSEC in Cloudflare (T-0)
- Cloudflare Dashboard → DNS → **DNSSEC** → Enable. Copy the DS metadata values (Key Tag, Algorithm, Digest Type, Digest).
- Enter the DS values inside AZ.pl’s DNSSEC form (Panel → Domains → turczynski.pl → DNSSEC). Save and confirm the registry update.
- Keep telemetry and TLS-RPT monitors running during propagation (expect ~15 minutes because of the lowered TTLs).

### Phase 3 – Validate + Harden (T+1 day)
- Run:
  ```bash
  dig turczynski.pl DS +dnssec
  dig turczynski.pl A +dnssec | grep flags
  ```
  Expect to see the DS record and an `ad` flag on lookups.
- Revert TTLs to their normal values (e.g., 3600), relock the domain at AZ.pl, and document the enablement date in this repo.
- Optional: if AZ.pl becomes a bottleneck, consider a registrar that supports `.pl` plus manual DS entries (OVH, Gandi) while still keeping Cloudflare as DNS host.

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
