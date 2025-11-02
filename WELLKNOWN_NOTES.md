# .well-known Files and Discovery Endpoints

## Overview
The `.well-known/` directory is a standardized location (RFC 8615) for protocol discovery, ownership proofs, and machine-readable metadata about a website or service.  
This document summarizes official, semi-official, and experimental `.well-known` files worth considering for **turczynski.pl**.

---

## Officially Registered (IANA) Files

| Path | Purpose | Notes |
|------|----------|-------|
| **/.well-known/security.txt** | Responsible disclosure contact | RFC 9116. Provides contact info and policies for security researchers. |
| **/.well-known/change-password** | Password change URL | Used by browsers to redirect users to a password-reset page. |
| **/.well-known/mta-sts.txt** | Mail TLS policy | Defines your SMTP MTA-STS enforcement. (Already implemented.) |
| **/.well-known/openid-configuration** | OIDC discovery document | Used if the site acts as an OAuth/OpenID Connect provider. |
| **/.well-known/assetlinks.json** | Android App Links verification | Required for deep linking between Android apps and sites. |
| **/.well-known/apple-app-site-association** | iOS Universal Links verification | JSON file for Apple app/site association. |
| **/.well-known/webfinger** | Identity discovery (federated protocols) | Used by Mastodon, Matrix, ActivityPub, etc. |
| **/.well-known/host-meta** | General discovery metadata | Provides endpoints for WebFinger and other protocols. |
| **/.well-known/gpc.json** | Global Privacy Control (GPC) | States whether your site honors browser “do not sell/share” signals. |
| **/.well-known/did.json** | Decentralized Identifier document | For use in self-sovereign identity systems. |
| **/.well-known/atproto-did** | Bluesky/AT Protocol identity mapping | Connects domain to DID in the AT network. |
| **/.well-known/keybase.txt** | Legacy Keybase ownership proof | Optional for cryptographic identity proofs. |

---

## Custom / Experimental Files

These are **non-standard but valuable** transparency and introspection endpoints.

| Path | Purpose | Description |
|------|----------|-------------|
| **/.well-known/trust.json** | Trust & security manifest | JSON describing site’s security headers, DNS records, CA policy, and contact. Not standardized but used in security research circles. |
| **/.well-known/policies.json** | Legal or ethical policy summary | Machine-readable privacy and data handling summary. |
| **/.well-known/headers.json** | Static dump of active HTTP headers | Useful for CI/CD diffing and security regression detection. |
| **/.well-known/build.json** | Build metadata | Contains build date, commit hash, Eleventy/Cloudflare versions, and deployment metadata. |
| **/.well-known/services.json** | API or service registry | Lists active API endpoints or backend integrations. |
| **/.well-known/health** | Lightweight uptime probe | Returns 200 OK with status and build version for uptime monitors. |
| **/.well-known/diagnostics** | Debug endpoint | Returns internal health and config data (intended for trusted use). |
| **/.well-known/backups.json** | Backup transparency metadata | Optionally discloses backup cadence and encryption policy. |
| **/.well-known/acknowledgements.json** | Attribution for open source dependencies | Human-readable license/credit information. |

---

## Recommended Minimal Set for turczynski.pl

| File | Priority | Notes |
|------|-----------|-------|
| **security.txt** | ✅ High | Core trust indicator, simple to host. |
| **trust.json** | 🔄 Medium | Adds transparency for your domain’s security config. |
| **build.json** | 🔄 Medium | Low-cost automation via Eleventy build metadata. |
| **policies.json** | 🧭 Optional | Adds machine-readable privacy transparency. |
| **health** | 🩺 Optional | Useful for uptime verification tools. |

---

## Implementation Notes

- All files live under `src/.well-known/` so Eleventy copies them into `_site/.well-known/`.
- For JSON files, ensure correct `Content-Type: application/json`.
- For text files, use UTF-8 encoding and ensure no extra trailing spaces or newlines.
- Verify via:
  ```bash
  curl -I https://turczynski.pl/.well-known/security.txt
  curl -I https://turczynski.pl/.well-known/trust.json
  ```

---

## Future Possibilities

- Automatically **generate trust.json** from headers and DNS records during build.
- Expose **diagnostics and version metadata** for CI/CD auditing.
- Implement **webfinger or did.json** if you later add decentralized identity.
- Integrate with **Report-To / CSP reporting endpoint** for machine-readable feedback loops.

---

_These notes summarize candidate `.well-known` files for later implementation._
