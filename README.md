# Personal Website

A personal website built with [Eleventy](https://www.11ty.dev/) and hosted on Cloudflare Pages.

## Security Hardening

The project ships with a `_headers` file that applies a strict set of HTTP security headers (CSP, HSTS, Permissions Policy and more) when deployed to Cloudflare Pages. Local development continues to work without additional configuration.

Secrets and local Wrangler artefacts are excluded from the repository via `.gitignore` to prevent accidental leaks.

### Telemetry retention

- Honeypot telemetry is stored in Cloudflare D1 for 14 days by default.
- Set the `PRUNE_SECRET` environment variable and (optionally) `RETENTION_DAYS`.
- Invoke the retention endpoint manually or via a cron Worker:
  ```bash
  curl -X POST "https://contact.turczynski.pl/api/inbound/prune?secret=<PRUNE_SECRET>"
  ```
- Each run records its metadata in the `retention_log` table for auditing.

### Operator dashboard

- Visit `https://contact.turczynski.pl/api/inbound/dashboard?secret=<DIGEST_SECRET>&hours=24` to view live stats (protected by `DIGEST_SECRET`).
- Data is queried directly from D1 (no caching) so it reflects the latest events, top IPs, and per-form activity.
- Use Cloudflare Access to protect the route in production; the `secret` query param is primarily for CLI testing.
- On the current Zero Trust free tier, Access cannot inject headers automatically, so add `X-Digest-Secret: <value>` via a browser extension (for interactive use) or via curl headers / Access service tokens for automation.

## Development

```bash
# Install dependencies
npm install

# Start development server
npm start

# Build for production
npm run build
```

## Cloudflare Pages Setup

1. Go to [Cloudflare Pages](https://pages.cloudflare.com/)
2. Connect your GitHub account
3. Select this repository (`personal`)
4. Use these build settings:
   - **Build command**: `npm run build`
   - **Build output directory**: `_site`
   - **Node.js version**: 18 or later
5. The build script automatically copies `_headers` (security headers) and `.well-known` assets into `_site`, so Cloudflare Pages will pick them up without extra configuration.

## Project Structure

```
src/
├── _includes/          # Layout templates
├── _data/             # Global data files
├── assets/            # Static assets
├── index.md           # Homepage
└── about.md           # About page
```

## Structured Data

Structured data is handled centrally through `src/_data/structuredData.js`, which returns the default JSON-LD graph (Person, WebSite, WebPage). Each page can optionally supply additional schema objects via the `schema` key in its front matter. All schema objects are automatically merged and output as JSON-LD in the base layout using the `jsonify` filter.

Example front matter snippet:

```yaml
---
title: Speaking
schema:
  - '@context': https://schema.org
    '@type': Event
    name: My Talk
    startDate: 2025-04-01
    location:
      '@type': VirtualLocation
      url: https://example.com
---
```

The default schema pulls values from `src/_data/site.js`. Update that file to change shared metadata (titles, author profile, social links, etc.).
