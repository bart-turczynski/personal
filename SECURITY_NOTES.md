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

