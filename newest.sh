#!/usr/bin/env bash
# check_mta_sts.sh — quick health check for MTA-STS + DNSSEC
# Usage: ./check_mta_sts.sh turczynski.pl
# Requires: dig, curl, awk, sed, grep

set -euo pipefail

DOMAIN="${1:-turczynski.pl}"
MTA_STS_HOST="mta-sts.$DOMAIN"
POLICY_URL="https://$MTA_STS_HOST/.well-known/mta-sts.txt"

failures=0

log()   { printf "%s\n" "$*"; }
ok()    { printf "✅ %s\n" "$*"; }
warn()  { printf "⚠️  %s\n" "$*"; }
bad()   { printf "❌ %s\n" "$*"; failures=$((failures+1)); }

hr()    { printf -- "---------------------------------------------\n"; }

hr
log "MTA-STS check for: $DOMAIN"
hr

# 1) _mta-sts TXT record (version + id)
TXT=$(dig TXT "_mta-sts.$DOMAIN" @1.1.1.1 +short | sed -e 's/^"//' -e 's/"$//')
if [[ -z "${TXT}" ]]; then
  bad "No TXT at _mta-sts.$DOMAIN"
else
  log "_mta-sts TXT: $TXT"
  if ! grep -qi 'v=STSv1' <<<"$TXT"; then bad "TXT missing v=STSv1"; else ok "TXT has v=STSv1"; fi
  if ! grep -qi 'id=' <<<"$TXT"; then warn "TXT missing id= (senders may not re-fetch promptly)"; else ok "TXT has id=…"; fi
fi

hr

# 2) Fetch policy file
HTTP_HEADERS=$(curl -sS -I --max-time 10 "$POLICY_URL" || true)
HTTP_CODE=$(printf "%s" "$HTTP_HEADERS" | awk 'tolower($1) ~ /^http/ {print $2; exit}')
if [[ "$HTTP_CODE" != "200" ]]; then
  bad "Policy fetch returned HTTP $HTTP_CODE (expect 200) → $POLICY_URL"
else
  ok "Policy fetch OK (HTTP 200)"
fi

POLICY=$(curl -sS --max-time 10 "$POLICY_URL" || true)
if [[ -z "$POLICY" ]]; then
  bad "Policy body empty"
else
  printf "%s\n" "$POLICY" | sed 's/^/    /'
fi

# Parse policy fields
MODE=$(printf "%s" "$POLICY" | awk -F': *' 'tolower($1)=="mode"{print tolower($2)}' | tr -d '\r')
MAX_AGE=$(printf "%s" "$POLICY" | awk -F': *' 'tolower($1)=="max_age"{print $2}' | tr -d '\r')
readarray -t POLICY_MX < <(printf "%s" "$POLICY" | awk -F': *' 'tolower($1)=="mx"{print tolower($2)}' | tr -d '\r')

if [[ -z "${MODE:-}" ]]; then bad "Policy missing mode:"; else ok "mode: $MODE"; fi
if [[ -z "${MAX_AGE:-}" ]]; then warn "Policy missing max_age:"; else ok "max_age: $MAX_AGE"; fi
if [[ ${#POLICY_MX[@]} -eq 0 ]]; then bad "Policy has no mx: lines"; else ok "Policy lists ${#POLICY_MX[@]} mx host(s)"; fi

# 3) Compare DNS MX vs policy MX (allow wildcards in policy)
readarray -t DNS_MX < <(dig MX "$DOMAIN" +short | awk '{print tolower($2)}' | sed 's/\.$//')
if [[ ${#DNS_MX[@]} -eq 0 ]]; then
  bad "No MX records found in DNS"
else
  ok "DNS has ${#DNS_MX[@]} MX host(s)"
  for mx in "${DNS_MX[@]}"; do
    match="no"
    for pmx in "${POLICY_MX[@]}"; do
      pmx="${pmx%.}"                # strip trailing dot if present
      if [[ "$pmx" == "$mx" ]]; then match="yes"; break; fi
      # wildcard support: "*.google.com" etc.
      if [[ "$pmx" == \*.* ]]; then
        suf="${pmx#*.}"
        [[ "$mx" == *".$suf" ]] && match="yes" && break
      fi
    done
    if [[ "$match" == "yes" ]]; then
      ok "MX covered by policy: $mx"
    else
      bad "MX NOT covered by policy: $mx (add exact mx: line or wildcard)"
    fi
  done
fi

hr

# 4) TLSRPT (optional but recommended)
TLSRPT=$(dig TXT "_smtp._tls.$DOMAIN" +short | sed -e 's/^"//' -e 's/"$//')
if [[ -z "$TLSRPT" ]]; then
  warn "No TLSRPT record at _smtp._tls.$DOMAIN (optional, but useful)"
else
  ok "TLSRPT present: $TLSRPT"
fi

# 5) Lightweight DNSSEC sanity (AD flag from a validating resolver)
DNSSEC_OUT=$(dig +dnssec "$DOMAIN" @1.1.1.1 | awk 'tolower($1)==";;" && $2=="flags:" {print}')
if grep -q ' ad[;, ]' <<<"$DNSSEC_OUT"; then
  ok "DNSSEC validated (resolver set AD flag)"
else
  warn "DNSSEC not validated (no AD flag). If DNSViz shows errors, fix DS/DNSKEY."
fi

hr
if (( failures > 0 )); then
  bad "Finished with $failures problem(s)."
  exit 1
else
  ok "All checks passed."
fi