# Alias Generation & Email Privacy Infrastructure  
**Specification & User Story (Draft)**  
**Version:** 1.0  
**Author:** ChatGPT (based on user requirements)  
**Date:** 2025-11-15  

---

## 1. Overview

This document describes the infrastructure for a **privacy‑preserving, per‑site email alias system**.  
The system gives the user a way to generate unique, non‑guessable email aliases for each service or website they interact with.  
Aliases help identify which site leaked or misused an email address and allow the user to disable (“kill”) the alias instantly.

The goal is **maximum privacy with minimum friction**, both on desktop and mobile.

---

## 2. Goals & Requirements

### 2.1 Primary Goals
- Provide users a fast, low‑friction method to generate email aliases.
- Automatically or semi‑automatically associate aliases with the service/domain where they are used.
- Store alias–label mappings securely so the user can inspect or attribute leaks later.
- Provide a mechanism to **disable/kill** individual aliases.
- Ensure system works across desktop and mobile environments.

### 2.2 Secondary Goals
- Provide a lightweight admin interface.
- Support optional header‑based “first email” auto‑learning when mappings don’t exist.
- Reject incoming email for dead aliases at SMTP/gateway level.

---

## 3. User Stories

### 3.1 Generating an Alias (Desktop)
- As a user, I want to generate a unique alias automatically when signing up for a service.
- Using a browser extension, I click a button or hotkey, and it:
  - Generates a UUID or ULID.
  - Sends it (with the current site’s domain) to the backend for storage.
  - Inserts the generated email alias into the signup form.

### 3.2 Generating an Alias (Mobile)
- As a user, I want to generate aliases on mobile where extensions are unavailable.
- I visit a secure "Alias Generator" web page.
- It generates a UUID/ULID client‑side.
- With one tap, I copy the alias to clipboard.
- (Optional) If authenticated, the alias‑to‑label mapping is saved automatically via the backend.

### 3.3 Auto‑Mapping on First Email (Lazy Mapping)
- As a user, I don’t want to manually maintain mappings.
- When an email arrives for an alias that has no mapping:
  - The system inspects the email headers.
  - It identifies the likely source domain.
  - It stores this mapping automatically.
  - The user can later correct or annotate the mapping in their admin UI.

### 3.4 Killing an Alias
- As a user, I want to stop receiving email sent to an alias.
- I navigate to the admin UI or call a kill endpoint.
- The alias is added to a denylist.
- Future email to that alias is rejected at SMTP (`550 user unknown`).

### 3.5 Inspecting Aliases
- As a user, I want to see all aliases and their labels.
- I open an admin UI dashboard showing:
  - Alias
  - Label (site)
  - Created timestamp
  - Last‑used timestamp (optional)
  - Kill/disable toggle

---

## 4. High‑Level System Architecture

### 4.1 Components
- **Alias Generator UI** (web page)
- **Browser extension** (optional but recommended)
- **Cloudflare Worker API**
- **Key‑Value store** (Cloudflare KV or D1)
- **Denylist store** (KV recommended)
- **Email inbound gateway**
  - Cloudflare Email Routing, Fastmail, Postfix, or any with webhook/SMTP integration

### 4.2 Data Flows
1. **Alias creation**
   - Frontend generates UUID/ULID.
   - Sends `alias + label` to Worker.
   - Worker stores mapping in KV.
   - Worker returns formatted email address.

2. **Email reception**
   - Gateway receives mail to `<alias>@mydomain.com`.
   - Gateway checks denylist.
   - If active:
     - Forwards mail.
     - Optionally triggers a Worker/Webhook.
       - Auto-learns label for unmapped alias.

3. **Kill flow**
   - User triggers “kill alias.”
   - Worker writes `dead:<alias>` to denylist KV.
   - Gateway rejects further attempts.

---

## 5. Storage Specification

### 5.1 KV namespaces

**`MAP`**  
- Key: `alias:<alias>`  
- Value:  
  ```json
  {
    "label": "example.com",
    "notes": "newsletter",
    "created_at": 1731326400000,
    "first_seen": 1731326500000
  }
  ```

**`DENY`**  
- Key: `dead:<alias>`  
- Value: `"1"`

### 5.2 Data retention
- Active mappings kept indefinitely (user can delete).
- Dead aliases kept permanently (for blacklist consistency) or rolled after N years if desired.

---

## 6. Alias Format

### 6.1 Preferred formats
- **UUIDv4**, hyphens removed: `32 hex chars`
- **ULID**, 26 Base32 chars (URL/email‑safe)

### 6.2 Local-part constraints
- Must not exceed 64 characters.
- Should be lowercase for email compatibility.

Format examples:
- `2f8b9a3e6d2a4f8f9c1e0b7c8d2f3a44@mydomain.com`
- `01j9te6s3v8z2m6tg0j7m2y3c5@mydomain.com`

---

## 7. API Specification (No code, conceptual only)

### 7.1 `POST /alias`
- **Purpose**: Store or update an alias mapping.
- **Payload**: `{ alias, label, notes? }`
- **Auth**: Required (Cloudflare Access or bearer token).
- **Side effects**: Writes to `MAP`.

### 7.2 `POST /kill`
- **Payload**: `{ alias }`
- **Action**: Add `dead:<alias>` to denylist.
- **Auth**: Required.

### 7.3 `GET /lookup/:alias`
- **Purpose**: Admin view of mapping.
- **Auth**: Required.

### 7.4 `POST /inbound` (optional)
- **Called by**: Email gateway when mail arrives.
- **Purpose**: Auto-learn mapping if missing.
- **Behavior**: Extract headers (`List-Id`, DKIM `d=`, `Return-Path`, etc.).

---

## 8. Security Considerations

### 8.1 Alias generation
- UUID/ULID generated client-side ensures even a compromised server cannot predict aliases.

### 8.2 Backend protection
- Require Cloudflare Access or token for `/alias`, `/kill`, `/lookup`.
- Rate-limit alias creation from UI.

### 8.3 Expected attack model
- Worst-case: attacker generates lots of aliases.
- Impact: minimal (user can kill unused ones; no personal data leaked).

### 8.4 Sensitive data
- Mappings (`alias → label`) should be considered private.
- KV should be scoped to Worker.
- No secret keys stored client-side.

---

## 9. User Interface Requirements

### 9.1 Alias Generator Page
- One‑tap alias generation.
- Copy-to-clipboard button.
- Optional label entry (auto-detect referrer).
- Mobile-friendly UI.

### 9.2 Admin Dashboard
- List all aliases.
- Display:
  - Alias  
  - Label  
  - Created date  
  - Notes  
  - “Kill” button  
- Sorting & search.

### 9.3 Extension UX
- Hotkey or toolbar button.
- Auto-insert alias into focused email field.
- Sync with backend to store mapping.

---

## 10. Deployment & Operations

### 10.1 Deployment targets
- Alias Generator UI: Cloudflare Pages or static hosting.
- API backend: Cloudflare Workers.
- Storage: Cloudflare KV (MAP + DENY).
- Email routing: user’s ESP + Worker or webhook.

### 10.2 Monitoring
- Optional: Logging alias creations.
- Count of kills per month.
- Alerts if inbound mapping fails (optional).

### 10.3 Backup / Export
- Ability to export alias mapping as JSON.
- Ability to wipe single alias or all aliases.

---

## 11. Roadmap / Future Enhancements

- Passkey or FIDO2 login for admin UI.
- Notes & tagging system for aliases.
- Alias lifetime/expiration settings.
- Integration with password managers.
- Multiple domain support.
- “Alias health” dashboard (leak detection analytics).

---

## 12. Summary

This infrastructure supports a simple but powerful privacy workflow:
- Unique alias per service.
- Mapping stored automatically or on demand.
- Easy kill switch.
- Minimal attack surface.
- Low friction across desktop and mobile.

The design prioritizes **privacy**, **portability**, **ease of use**, and **resilience**.

