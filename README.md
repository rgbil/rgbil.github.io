# rgbil.com — Georgia Biliouli

Static site. No build step, no dependencies.

## Files

```
site/
├── index.html          all markup
├── css/style.css       all styles (colors/fonts as CSS variables at the top)
├── js/works.js         portfolio items — edit this to change the grid
├── js/main.js          hover animations, scroll zoom, cursor background
└── img/                logo + images
```

## Run locally

Open `index.html`, or serve it:

```
cd site
python3 -m http.server 8000
```

Then http://localhost:8000

## Things to edit

- **Behance links** — search `behance.net/rgbil` in `index.html` and `js/works.js`, replace with the real project URLs.
- **Email** — `hello@rgbil.com` in `index.html`.
- **Colors** — `:root` in `css/style.css` (`--accent: #dd3966`).
- **Images** — replace files in `img/` keeping the same names, or point to new ones.
- **Portfolio items** — `js/works.js`, one object per project.

Current images are placeholder graphics; swap them for real work.

## GitHub Pages

1. Push the contents of `site/` to the repo root (or keep `site/` and select it as the Pages folder).
2. Settings → Pages → Source: `main` branch, `/` (or `/site`).
3. For the custom domain: add `rgbil.com` in Settings → Pages, and create a `CNAME` file next to `index.html` containing `rgbil.com`.

`.nojekyll` is included so Pages serves all files as-is.
