# Fretboard Lab

A guitar learning tool built with React, TypeScript, Vite, Tailwind CSS and [shadcn/ui](https://ui.shadcn.com).

- **Explorer** – pick a key, scale and chord to see scale positions, arpeggios, triads and sweep shapes, with picking directions.
- **Song analysis** – upload a Guitar Pro file (.gp, .gp3–.gp5, .gpx, e.g. downloaded from Songsterr), pick a track and a bar range, and see the notes on the fretboard, the likely key, the scale position they sit in, and the tab with rhythm.

Files are parsed in the browser with [alphaTab](https://alphatab.net); nothing is uploaded to a server.

## Requirements

Node.js 20.19+ or 22.12+ (check with `node -v`).

## Run locally

```bash
npm install
npm run dev        # http://localhost:5173
```

`npm run build` type-checks and builds to `dist/`.

## Deploy to Vercel

No repo needed:

```bash
npx vercel         # first run: log in, accept the defaults (Vite is detected)
npx vercel --prod  # promote to your production URL
```

Or push this folder to GitHub and use **Add New → Project** in the Vercel dashboard. The defaults work: build command `npm run build`, output `dist`.

## Project layout

```
src/
  lib/theory.ts          scales, chords, positions, sweep/triad finders, key detection
  lib/song.ts            song model, example riff, Guitar Pro import, bar ranges
  lib/utils.ts           cn() class helper (shadcn)
  components/ui/         shadcn/ui components (button, card, select, tabs, toggle-group, tooltip …)
  components/ui.tsx      app building blocks made from them: Panel, Field, Choice, NoteChip, LegendDot
  components/theme.tsx   ThemeProvider + light/dark/system menu
  components/            Fretboard, TabStaff (with rhythm), SeqStaff, BarGrid
  views/Explorer.tsx     Explorer tab
  views/Analysis.tsx     Song analysis tab
  index.css              Tailwind + shadcn theme tokens, music colors, SVG styles
```

## shadcn/ui

`components.json` is set up, so you can add more components the normal way:

```bash
npx shadcn@latest add dialog sheet
```

They land in `src/components/ui/` and use the same theme.

**Theme tokens** live in `src/index.css`: the standard shadcn variables (`--background`, `--foreground`, `--card`, `--primary`, `--muted-foreground`, `--border` …) under `:root` and `.dark`, plus the app's music colors (`--c-r`, `--c-3`, `--c-5`, `--c-7` for root/3rd/5th/7th, and `--board`, `--fret`, `--string` for the neck). To match another site's look, change those variables; every component and drawing follows.

Dark mode uses the `.dark` class on `<html>`, set by `ThemeProvider` (light, dark, or follow the system), with a small script in `index.html` that applies it before first paint.

## Reusing pieces on another site

- `src/lib/theory.ts` and `src/lib/song.ts` are plain TypeScript with no React, so they drop into any project.
- `Fretboard`, `TabStaff`, `SeqStaff` and `BarGrid` only need React, Tailwind, the CSS variables above, and the SVG rules at the bottom of `index.css`.
- If the other site already uses shadcn/ui, copy the music variables and SVG rules into its stylesheet and the components will pick up its existing `--primary`, `--border` and so on.
