---
layout: base.njk
title: Operations Intake
description: Internal intake surface for automated abuse telemetry.
noindex: true
excludeFromSitemap: true
schema:
  '@context': https://schema.org
  '@type': WebPage
  name: Operations Intake
  description: Decoy intake surface used to profile automated submissions.
---

# Operations Intake

This form is monitored and instrumented. Legitimate visitors should use the contact details on the [security policy](/security-policy/).

Any submission here may be logged together with metadata (IP, headers, payload). Automated traffic is automatically classified and reported.

## Vendor Access Request

<form class="decoy-form" method="POST" action="/api/trap" data-honeypot-form="vendor-intake">
  <input type="hidden" name="form_id" value="vendor-intake">

  <label for="vendor-name">Full name</label>
  <input id="vendor-name" name="full_name" autocomplete="name" required>

  <label for="vendor-mail">Work email</label>
  <input id="vendor-mail" name="email" type="email" autocomplete="email" required>

  <label for="vendor-system">System requesting access to</label>
  <input id="vendor-system" name="system_name" required>

  <label for="vendor-notes">Purpose / architecture overview</label>
  <textarea id="vendor-notes" name="notes" rows="4"></textarea>

  <div class="honey-field" aria-hidden="true">
    <label for="vendor-honey">Leave this field blank</label>
    <input id="vendor-honey" type="text" name="honey_token" tabindex="-1" autocomplete="off">
  </div>

  <button type="submit">Submit for review</button>
</form>

## Emergency Escalation Channel

<form class="decoy-form" method="POST" action="/api/trap" data-honeypot-form="escalation">
  <input type="hidden" name="form_id" value="emergency-escalation">

  <label for="esc-ticket">Existing ticket ID</label>
  <input id="esc-ticket" name="ticket_id" required>

  <label for="esc-severity">Severity</label>
  <select id="esc-severity" name="severity">
    <option value="sev0">SEV0 - Full outage</option>
    <option value="sev1">SEV1 - Critical impact</option>
    <option value="sev2">SEV2 - Degraded</option>
  </select>

  <label for="esc-ua">User agent fingerprint</label>
  <input id="esc-ua" name="ua_hint" value="captured automatically" readonly>

  <label for="esc-brief">Summary</label>
  <textarea id="esc-brief" name="summary" rows="3"></textarea>

  <div class="honey-field" aria-hidden="true">
    <label for="esc-honey">Leave this field blank</label>
    <input id="esc-honey" type="text" name="honey_token" tabindex="-1" autocomplete="off">
  </div>

  <button type="submit">Page on-call</button>
</form>
