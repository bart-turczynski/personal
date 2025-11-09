---
layout: base.njk
title: Security Policy & Honeypot Disclosures
description: Responsible disclosure instructions, honeypot telemetry notice, and retention policy for turczynski.pl.
schema:
  '@context': https://schema.org
  '@type': WebPage
  name: Security Policy
  url: https://turczynski.pl/security-policy/
---

# Security Policy & Honeypot Disclosures

Thank you for helping keep `turczynski.pl` resilient. This page outlines how to report security issues, what the experimental honeypot collects, and how long telemetry is retained.

## 1. Responsible Disclosure

- Email **security@turczynski.pl** (PGP available on request) and include a short proof-of-concept.
- Provide enough detail for reproduction. Automated scanner dumps without a clear finding may be deprioritised.
- Please allow 5 business days for acknowledgement and refrain from public disclosure until the issue is fixed or 30 days have elapsed.

## 2. Honeypot Scope

- The `/honeypot/` endpoints are decoy forms intentionally left for automated bots.
- Submissions may be logged together with IP, user agent, headers, and the content submitted (malicious payloads included).
- Data is only used for abuse research and to improve filtering heuristics. It is **never** used to profile legitimate visitors.

## 3. Data Retention

- Raw SMTP or web-form payloads: **14 days** (rotated sooner if volume spikes).
- Parsed indicators (IP addresses, URLs, attachment hashes): **up to 36 months**.
- Aggregated metrics (counts / scoring): may be kept indefinitely for trend analysis.
- To request removal of specific telemetry, mail `security@turczynski.pl` with the approximate timestamp and IP.

## 4. Safe Harbor

Test systems responsibly:

- No social engineering, destructive testing, or privacy violations.
- Limit automated traffic to a reasonable rate.
- Do not access other visitors’ data.

Good-faith security research that complies with these rules will be viewed as authorised.

## 5. Status & Contact

- Contact: `security@turczynski.pl`
- Backup contact: `bartek@turczynski.pl`
- Updates: documented in `honeypot_implementation_plan.md` (private repo) and the site changelog.

You can reference the signed policy at `/.well-known/security.txt`.
