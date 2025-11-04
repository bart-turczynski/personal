#!/bin/bash
# audit3.sh — TLS Cipher Suite & Security Audit for turczynski.pl
# Requires: nmap, grep, awk, sed

DOMAIN="turczynski.pl"
OUTPUT="cipher_check.txt"

echo "===== TLS CIPHER SUITE AUDIT ====="
echo "Scanning $DOMAIN ..."
echo

# Run nmap cipher enumeration
nmap --script ssl-enum-ciphers -p 443 "$DOMAIN" > "$OUTPUT" 2>/dev/null

if [[ ! -s "$OUTPUT" ]]; then
  echo "❌ nmap output is empty or nmap not installed."
  echo "Please install nmap and rerun."
  exit 1
fi

# Show TLS versions found
echo "--- Supported TLS versions ---"
grep -E "TLSv1" "$OUTPUT" | awk '{print $1}' | sort -u
echo

# Detect weak cipher patterns
echo "--- Weak Cipher Detection ---"
WEAK_PATTERNS="NULL|EXP|RC4|DES|3DES|MD5|CBC|RSA_WITH_"
grep -E "$WEAK_PATTERNS" "$OUTPUT" > /tmp/weak_ciphers.txt

if [[ -s /tmp/weak_ciphers.txt ]]; then
  echo "⚠️  Weak or legacy ciphers detected:"
  cat /tmp/weak_ciphers.txt | sed 's/^/   - /'
  echo
else
  echo "✅ No weak cipher suites found. TLS configuration appears strong."
  echo
fi

# Check for Forward Secrecy support (ECDHE)
echo "--- Forward Secrecy (ECDHE) ---"
if grep -q "ECDHE" "$OUTPUT"; then
  echo "✅ Forward secrecy supported (ECDHE ciphers detected)."
else
  echo "⚠️  No ECDHE ciphers found — forward secrecy not supported!"
fi
echo

# Check for TLS 1.0 / 1.1
echo "--- Deprecated TLS Versions ---"
if grep -q "TLSv1\.0" "$OUTPUT"; then
  echo "⚠️  TLS 1.0 still enabled — should be disabled."
else
  echo "✅ TLS 1.0 not offered."
fi
if grep -q "TLSv1\.1" "$OUTPUT"; then
  echo "⚠️  TLS 1.1 still enabled — should be disabled."
else
  echo "✅ TLS 1.1 not offered."
fi
echo

# Check for modern TLS 1.2/1.3
if grep -q "TLSv1\.3" "$OUTPUT"; then
  echo "✅ TLS 1.3 supported (modern and recommended)."
else
  echo "⚠️  TLS 1.3 not detected — enable it for best security."
fi
echo

echo "--- Summary ---"
if [[ -s /tmp/weak_ciphers.txt ]]; then
  echo "⚠️  Some weak ciphers are still supported."
else
  echo "✅ Cipher suite configuration is modern and secure."
fi

echo
echo "Full nmap results saved to: $OUTPUT"
echo "===== END OF AUDIT ====="