# SocialWox — Website

A static, single-page website. No build step, no framework, no dependencies.

## Files
- `index.html` — page structure and copy
- `style.css` — design tokens (colors, type) and all styling
- `script.js` — nav toggle, scroll reveals, hero entrance animation
- `assets/` — the four Art Deco reference images, used as textures/backgrounds
- `assets/fonts/` — where to drop licensed Rules Gothic Condensed font files

## About the display font — Rules Gothic Condensed
Rules Gothic Condensed is a premium commercial typeface from the Blaze Type
foundry (blazetype.eu) — it isn't available on free font CDNs, so it can't
be linked to directly.

The site is wired to use it if you own a license:
1. Purchase/export the webfont files (woff2/woff) for these weights:
   Regular (400), Medium (500), SemiBold (600), Bold (700), Black (900).
2. Drop them into `assets/fonts/` using the filenames listed in
   `assets/fonts/README.txt` (or edit the `@font-face` block at the top
   of `style.css` to match whatever filenames you export).
3. That's it — no other change needed. The site will pick it up
   automatically.

Until then, the site falls back to **Barlow Condensed** (free, Google
Fonts), which shares the same clean, squared, Swiss-neo-grotesque
character, so the design still reads as intended without the licensed
font installed.

## Run locally
Just open `index.html` in a browser, or serve the folder:
```
npx serve .
```

## Deploy to Vercel
```
npm i -g vercel
vercel
```
It's a static site — Vercel will detect it automatically, no configuration needed.

## Replacing project content in "Selected Work"
Each project is one `<article class="project">` block in `index.html`. Replace:
- the number, industry, name, description
- the `<div class="project__placeholder">` with a real `<img>` (add to `assets/`)
- the `href="#"` on `.project__link` with the live project URL

## Customizing color
All colors are CSS variables at the top of `style.css` under `:root` — change `--navy-700`, `--red-700`, etc. to retune the palette without touching layout code.
