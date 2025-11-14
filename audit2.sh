#!/bin/bash
# Domain security + DNS + content verification script for turczynski.pl
# Usage: bash check_turczynski_security.sh > results_$(date +%Y%m%d).txt

DOMAIN="turczynski.pl"
MTA_STS_URL="https://mta-sts.${DOMAIN}/.well-known/mta-sts.txt"
SITE_DIR="_site"  # Adjust if your Jekyll output dir differs

echo "===== DNS CHECKS ====="
echo "--- A/AAAA ---"
dig +short A $DOMAIN
dig +short AAAA $DOMAIN

echo "--- MX ---"
dig +short MX $DOMAIN

echo "--- TXT/SPF ---"
dig +short TXT $DOMAIN | grep -i spf

echo "--- DKIM ---"
dig +short TXT default._domainkey.$DOMAIN

echo "--- DMARC ---"
dig +short TXT _dmarc.$DOMAIN

echo "--- MTA-STS DNS ---"
dig +short TXT _mta-sts.$DOMAIN

echo "--- CNAME (optional subdomains) ---"
for SUB in www mail mta-sts; do
  echo "$SUB.$DOMAIN:"
  dig +short CNAME $SUB.$DOMAIN
done

echo
echo "===== HTTPS & CERTIFICATE CHECK ====="
echo | openssl s_client -connect ${DOMAIN}:443 -servername ${DOMAIN} 2>/dev/null | openssl x509 -noout -subject -issuer -dates

echo
echo "===== MTA-STS POLICY FILE ====="
curl -s -I "$MTA_STS_URL" | grep -i "HTTP\|content-type\|cache-control"
echo
curl -s "$MTA_STS_URL" | tee /tmp/mta_sts.txt
echo
echo "--- Policy Content Validation ---"
grep -E 'version:|mode:|mx:' /tmp/mta_sts.txt || echo "MTA-STS policy missing key fields!"

echo
echo "===== INLINE STYLE / SECURITY SCAN ====="
if [ -d "$SITE_DIR" ]; then
  echo "Scanning built site directory: $SITE_DIR"
  grep -R --line-number -E 'style=|<style' "$SITE_DIR" || echo "✅ No inline style or <style> tags found."
else
  echo "⚠️ Directory $SITE_DIR not found!"
fi

echo
echo "===== CONTENT SECURITY POLICY (CSP) HEADER ====="
curl -s -I "https://${DOMAIN}" | grep -i "content-security-policy"

echo
echo "===== END OF REPORT ====="
date