# Personal Website

A personal website built with [Eleventy](https://www.11ty.dev/) and hosted on Cloudflare Pages.

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

## Project Structure

```
src/
├── _includes/          # Layout templates
├── _data/             # Global data files
├── assets/            # Static assets
├── index.md           # Homepage
└── about.md           # About page
```