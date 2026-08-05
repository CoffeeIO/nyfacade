---
name: build-case-page
description: Build a private, unlisted before/after case page on nyfacade.dk for one lead — a UUID-URL page comparing their current site to a redesign, for direct outreach (not linked from the main site nav). Use when the user says "build a case page for <company>", "make a preview page for <lead>", "put the Trekroner-style comparison together for <company>", or wants a lead's real screenshots turned into a shareable nyfacade.dk link. Requires the lead's redesign to already exist (a Claude Design project, or site-redesign's generated restyle HTML) and real screenshots — run capture-screenshots first if missing.
---

# Build a nyfacade case page

nyfacade.dk sells a "see it before you pay" redesign pitch (10.000 kr., 14 days). The homepage
shows one anonymous generic demo; a case page is the real, personalized version sent directly to
one specific lead — a private link, never linked from the site nav, `noindex`.

This was built once already for Trekroner Revision A/S at
`p/7b326b02-b984-45a4-92e3-ba983dac6767/index.html` — read that file first as the reference
implementation before starting a new one. Copy its structure and CSS rather than re-deriving it.

## Non-negotiable: real content only, never reconstruct

Every "before" and "after" image on the page must be an actual screenshot or a direct crop of the
real design — never a hand-drawn CSS approximation. This was corrected twice in the reference
build: the desktop before/after panels were initially rebuilt by hand from a design-audit
description (wrong — the real screenshots existed all along), and the mobile "before" captures
initially came from a viewport resize instead of real device emulation (wrong proportions). Run
the `capture-screenshots` skill for all image assets before writing any markup.

The one place hand-written HTML/Liquid is legitimate: the desktop "after" panel body text
(headings, paragraphs, address cards) can be typed out to match the real redesign's copy, because
it's rendered live in the page as real DOM (for text selection, accessibility, and so it reads
crisply at any zoom) — but the **hero photo and logo inside it must still be the real image
files**, not placeholder boxes. Wire them in via an `include.hero` / logo `<img>` param, not a
dashed "foto af teamet" gradient div.

## Steps

1. **Generate the UUID and scaffold the page.**
   ```bash
   uuidgen | tr '[:upper:]' '[:lower:]'
   mkdir -p p/<uuid>
   ```
   Jekyll auto-publishes `p/<uuid>/index.html` at `/p/<uuid>/` — no permalink config needed.
   Front matter: `layout: null`, a real `<title>`, and `<meta name="robots" content="noindex,
   nofollow">`. No link to this page from anywhere else on the site — the user shares the URL
   directly. Do not ask "should I link it from the homepage" — the answer is always no unless
   explicitly told otherwise.

2. **Gather real assets** (see `capture-screenshots` skill):
   - Before: desktop + mobile screenshots of the lead's actual live site (2-3 key pages).
   - After: cropped from the Claude Design `.dc.html` canvas (desktop card + mobile card per
     page), plus the real hero photos and logo mark as separate static image files.
   - Save everything under `assets/img/<company-slug>/`.

3. **Desktop comparisons** — one `<section>` per page, `.case-head` intro + `.case-row` with two
   `figure`s: `.shot-frame.plain` wrapping the real "before" screenshot `<img>`, and
   `.mockup-frame.gold` + `.mockup-scale` wrapping the hand-built "after" markup (960×640 fixed
   canvas, scaled responsively by `assets/js/main.js`'s `applyScale`). Reuse the `_includes/`
   partial pattern from the reference build for the "after" card shell (logo, hero photo, nav,
   heading, body slot) rather than inlining it three times.

4. **Mobile section** — real screenshots only, both sides, laid out as two rows of three (one row
   "before", one row "after"), each wrapped in the `.iphone-frame` device-frame component. Copy
   that CSS block verbatim from the reference page rather than redesigning it — a simple dark
   rounded-rectangle body with a small pill "notch" and a scrollable `.screen` inside. Keep it
   plain unless the user explicitly asks for a fancier frame (a more elaborate CSS-only iPhone
   mockup was tried and explicitly undone in favor of this simpler one — don't reintroduce that
   without being asked). One detail that matters regardless of which frame style is in use:
   `.screen` needs `overflow-y: auto` — mobile "after" captures are full page height (much taller
   than one device screen) and should scroll inside the frame; "before" captures are composited to
   the full device height already (see capture-screenshots skill) so they fill without scrolling.

5. **Personalize the copy.** Do not reuse the homepage's anonymous "demonstration, not a client
   case" framing — address the lead by name, reference their real page count/content, and close
   with a direct CTA (`mailto:` pre-filled subject + phone `tel:` link), not the homepage's
   generic contact form.

6. **Build and visually verify before calling it done.** This repo's Jekyll isn't preinstalled;
   set it up once per session:
   ```bash
   gem install jekyll jekyll-seo-tag jekyll-sitemap --no-document
   export PATH="$HOME/.local/share/gem/ruby/4.0.0/bin:$PATH"   # adjust ruby version
   ```
   Build from **outside** the repo directory (Jekyll's plugin manager auto-detects the repo's
   `Gemfile` and tries to `bundle exec` if you're inside it, which pulls in the much heavier
   `github-pages` gem and fails):
   ```bash
   cd <scratchpad> && jekyll build --source /path/to/nyfacade --destination /tmp/nyfacade-build
   grep -n '{%\|{{' /tmp/nyfacade-build/p/<uuid>/index.html   # must be empty — no unrendered Liquid
   ```
   Serve it and check with a real browser (Playwriter is fine here — this is visual QA of output
   you already built, not source capture) at both a wide desktop viewport and a narrow one
   (~390px) to confirm the mobile section stacks correctly. Also re-check the homepage itself if
   you touched shared `assets/css/style.css` or `assets/js/main.js` — confirm the existing
   compare-slider still works before considering the change safe.

7. **Only commit/push when explicitly asked.** Use a descriptive commit message naming the lead
   and what the page shows; never mention the lead's name in a way that would leak if the commit
   message itself were public (it will be, on GitHub) — company names are fine (the redesign is
   for them), but don't editorialize about their site being bad in the commit message itself.

## Report back
The page's live path (`/p/<uuid>/`), which sections got real vs hand-written content, and
confirmation the homepage wasn't regressed if shared files changed.
