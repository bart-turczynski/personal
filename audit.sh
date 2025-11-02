#!/bin/bash
# =====================================================
#  🔍  TURCZYNSKI.PL — FULL SECURITY + POLICY AUDIT
# =====================================================

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'

timestamp=$(date +"%Y-%m-%d_%H-%M-%S")
logfile="audit-${timestamp}.txt"

# Helper for pretty section headers
section() { echo -e "\n${CYAN}=== 🔹 $1 ===${NC}" | tee -a "$logfile"; }

section "DNS OVERVIEW"
dig +noall +answer turczynski.pl soa ns a aaaa mx | tee -a "$logfile"

section "TXT RECORDS (SPF, DKIM, DMARC, MTA-STS, TLS-RPT)"
{
  dig +noall +answer turczynski.pl txt
  dig +noall +answer _dmarc.turczynski.pl txt
  dig +noall +answer google._domainkey.turczynski.pl txt
  dig +noall +answer _mta-sts.turczynski.pl txt
  dig +noall +answer _smtp._tls.turczynski.pl txt
} | tee -a "$logfile"

section "CAA RECORDS"
CAA_CF=$(dig +noall +answer turczynski.pl caa @andronicus.ns.cloudflare.com)
echo "$CAA_CF" | tee -a "$logfile"
if echo "$CAA_CF" | grep -Eiq "comodoca|digicert|ssl\.com"; then
  echo -e "${RED}⚠️  Legacy issuers still present${NC}" | tee -a "$logfile"
else
  echo -e "${GREEN}✅  Only Let's Encrypt + pki.goog + iodef${NC}" | tee -a "$logfile"
fi

section "DNSSEC STATUS"
DS=$(dig +noall +answer turczynski.pl ds)
if [ -z "$DS" ]; then
  echo -e "${YELLOW}⚠️  DNSSEC disabled (expected)${NC}" | tee -a "$logfile"
else
  echo -e "${GREEN}✅  DNSSEC enabled${NC}" | tee -a "$logfile"
  echo "$DS" | tee -a "$logfile"
fi

# -----------------------------------------------------
# FILE EXISTENCE + CONTENT CHECKS
# -----------------------------------------------------
section "MTA-STS POLICY FILE CONTENT"
STS_URL="https://mta-sts.turczynski.pl/.well-known/mta-sts.txt"
STS_CONTENT=$(curl -s "$STS_URL")
if [ -z "$STS_CONTENT" ]; then
  echo -e "${RED}❌  Missing or unreachable: $STS_URL${NC}" | tee -a "$logfile"
else
  echo -e "${GREEN}✅  Found $STS_URL${NC}" | tee -a "$logfile"
  echo "$STS_CONTENT" | tee -a "$logfile"
  if echo "$STS_CONTENT" | grep -qE "^v=STSv1" && echo "$STS_CONTENT" | grep -q "mode=enforce"; then
    echo -e "${GREEN}✅  Valid MTA-STS syntax${NC}" | tee -a "$logfile"
  else
    echo -e "${YELLOW}⚠️  Check MTA-STS mode or syntax${NC}" | tee -a "$logfile"
  fi
fi


if echo "$STS_CONTENT" | grep -q "mode=testing"; then
  echo -e "${YELLOW}⚠️  MTA-STS in testing mode — switch to enforce when ready${NC}" | tee -a "$logfile"
elif echo "$STS_CONTENT" | grep -q "mode=enforce"; then
  echo -e "${GREEN}✅  MTA-STS enforce mode active${NC}" | tee -a "$logfile"
fi

# Optional extra checks (uncomment if you have them)
# section "SECURITY.TXT"
# curl -fsSL https://turczynski.pl/.well-known/security.txt -o - | tee -a "$logfile" || echo -e "${YELLOW}⚠️  security.txt not found${NC}"

# section "ROBOTS.TXT"
# curl -fsSL https://turczynski.pl/robots.txt -o - | tee -a "$logfile" || echo -e "${YELLOW}⚠️  robots.txt not found${NC}"

# -----------------------------------------------------
section "SSL CERTIFICATE"
openssl s_client -connect turczynski.pl:443 -servername turczynski.pl 2>/dev/null | \
openssl x509 -noout -issuer -subject -dates -ext subjectAltName | tee -a "$logfile"

section "HEADERS (Security + CSP + CORS)"
HEADERS=$(curl -s -I https://turczynski.pl/)
echo "$HEADERS" | egrep -i 'access-control-|content-security-policy|frame-ancestors|x-frame-options|referrer-policy|permissions-policy|cross-origin-(opener|resource)|strict-transport-security|x-xss|expect-ct' | tee -a "$logfile"

if echo "$HEADERS" | grep -qi "access-control-allow-origin"; then
  echo -e "${RED}⚠️  ACAO present${NC}" | tee -a "$logfile"
else
  echo -e "${GREEN}✅  No Access-Control-Allow-Origin${NC}" | tee -a "$logfile"
fi

section "ASSET HEADERS (favicon)"
curl -s -I https://turczynski.pl/favicon.ico | egrep -i 'cache-control|content-type|cross-origin-(opener|resource)' | tee -a "$logfile"

section "SUMMARY"
echo -e "Audit complete → log saved to ${CYAN}$logfile${NC}"