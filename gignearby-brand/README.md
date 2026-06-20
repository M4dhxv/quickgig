# GigNearby Brand Kit

Everything to produce on-brand GigNearby work — in Claude/GPT, Figma, with a designer, or in code.
**Tagline:** The closest jobs, first. · **Domain:** gignearby.com
Built with the build-a-brand methodology. **Deliberately distinct from GigGrab** (employer app = emerald). GigNearby owns **Signal Orange**.

## What's in here

```
gignearby-brand/
├── brand.md                  # the full spec — paste into any AI tool
├── brand-guidelines.html     # 10-page visual guidelines — open in a browser, print to PDF
├── README.md                 # this file
├── logo/
│   ├── symbol.svg            # map pin + cobalt ping (primary)
│   ├── symbol-favicon.svg    # pin only (legible at 16px)
│   └── symbol-app-icon.svg   # navy rounded-square app icon
├── icons/                    # 12 UI icons (2px, 24px grid) as SVG
├── tokens/
│   ├── tokens.css            # CSS custom properties — paste into :root
│   ├── tokens.json           # same, for AI tools / CI
│   └── tailwind.config.snippet.js
└── prompts/
    ├── system-prompt.md      # brand voice + palette — paste at top of any AI thread
    ├── photography.md        # 9 ready-to-run image prompts (needs Pika credits)
    └── tweet.md / landing-hero.md / error-message.md
```

## How to use it

- **On-brand copy:** paste `prompts/system-prompt.md` (or all of `brand.md`) into a Claude/GPT thread, then ask.
- **See / share the guidelines:** open `brand-guidelines.html` in a browser → **Cmd-P → Save as PDF**. Self-contained; fonts load from Google Fonts.
- **Build in code:** import `tokens/tokens.css` (or the Tailwind snippet).
- **Favicon / app icon:** `logo/symbol-favicon.svg` (favicon) and `logo/symbol-app-icon.svg` (app icon).
- **Fonts:** Archivo (display), Hanken Grotesk (body), Space Mono (stats) — Google Fonts URLs in `brand.md`.

## To finish photography + an official rendered PDF (needs Pika credits)

Built without AI photos because the Pika account hit 0 credits.
1. Top up at **pika.me/billing** (~100 credits).
2. Run the 9 prompts in `prompts/photography.md` (gpt-image-2, medium).
3. Drop the images into the photo slots in `brand-guidelines.html`.

## Quick reference

| | |
|---|---|
| Signal Orange (primary) | `#FF5A1F` |
| Cobalt (secondary) | `#2E5BFF` |
| Ink Navy (text/dark) | `#0E1633` |
| Display / Body / Stats | Archivo / Hanken Grotesk / Space Mono |
| Voice | plain-spoken, fast, warm, confident, respectful |
| **Never** | green/emerald (that's GigGrab) |
