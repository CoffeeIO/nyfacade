---
name: capture-screenshots
description: Capture real, honest desktop + mobile screenshots of a lead's live site (or of a Claude Design redesign canvas) for use in a nyfacade case page. Use when the user says "screenshot <company>", "capture the before/after for <lead>", or a case page needs real images instead of hand-drawn mockups. Sister skill to site-redesign's capture-screenshots, but this one is specific to nyfacade's case-page needs (full device height preserved, no cropping to content).
---

# Capture real screenshots (nyfacade)

Real screenshots only — never hand-recreate a page in CSS/HTML when the actual thing can be
captured. This skill exists because that mistake happened twice in one session: once for the
"before" desktop/mobile mockups (rebuilt by hand from a design-audit doc instead of using the
real screenshots), and once for the initial mobile capture (resized the browser's viewport
without real device emulation, which gave a misleadingly-cropped, non-authentic result).

## Tooling: prefer chrome-devtools MCP, fall back to local Playwright

`ToolSearch` for `mcp__chrome-devtools__*` first (see the sibling skill at
`../../../site-redesign/.claude/skills/capture-screenshots/SKILL.md` for that path). If it
isn't available in this session, install Playwright locally — this is what actually worked here:

```bash
mkdir -p <scratchpad>/pw && cd <scratchpad>/pw
npm init -y && npm install playwright
npx playwright install chromium   # ~180MB download, takes a couple minutes
```

**Do not** use `playwriter` (the browser-extension bridge) for the actual capture. It only
supports `page.setViewportSize()` on the user's already-open desktop Chrome tab — it cannot set
`isMobile`, touch emulation, or a mobile user-agent, and `browserContext.newCDPSession()` fails
outright over that bridge ("No tab found for Target.attachToBrowserTarget"). A viewport resize
alone does not reproduce how a real phone renders a non-responsive site. Use playwriter only for
quick visual QA of a page you've already built (see `build-case-page` skill), not for capturing
source screenshots.

## Desktop capture

Plain and reliable:
```js
const { chromium } = require('playwright');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(url, { waitUntil: 'load' });
await page.screenshot({ path: out, fullPage: true });
```

## Mobile capture — use a real device profile, not a resized viewport

```js
const { chromium, devices } = require('playwright');
const browser = await chromium.launch();
const context = await browser.newContext({ ...devices['iPhone 13'] });
const page = await context.newPage();
await page.goto(url, { waitUntil: 'load' });
await page.screenshot({ path: out, fullPage: true });
```

`devices['iPhone 13']` sets the real viewport (390×844), `deviceScaleFactor: 3`, `isMobile:
true`, `hasTouch: true`, and a real mobile Safari UA. This is what actually changes how a
non-responsive site renders — plain viewport resizing does not.

### The "no viewport meta tag" trap

Most of these lead sites have no `<meta name="viewport">`. Under real mobile emulation this means
the page still lays out at a fixed ~980px width (`document.documentElement.scrollWidth`) rather
than the device's 390px — this is standard fallback behavior, not a bug in the capture. Verify
with:
```js
await page.evaluate(() => ({ w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight, scale: window.visualViewport?.scale }));
```
A `scale` around 0.4 confirms the "zoomed out to fit" default. Playwright's screenshot doesn't
apply that optical zoom itself — it rasterizes the full ~980px-wide layout at native resolution.
That's fine: resize the raw capture down to device-pixel width afterward (see below) and it
reproduces the same "zoomed to fit" look the real phone shows.

### Preserve the full device screen height — don't crop to content

The real content is often much shorter than the page's reported `scrollHeight` (a lot of blank
space below the fold on old sites). **Do not** crop the image down to just the visible content —
that produces a short, wide image that reads as "rotated" or "wrong," not as a phone screenshot.
Instead composite onto a canvas at the device's actual physical resolution:

```python
from PIL import Image
DEVICE_W, DEVICE_H = 1170, 2532  # iPhone 13: 390×844pt × 3x
im = Image.open(raw_capture).convert('RGB')
scale = DEVICE_W / im.width
resized = im.resize((DEVICE_W, round(im.height * scale)), Image.LANCZOS)
bg = resized.getpixel((DEVICE_W - 5, resized.height - 5))  # sample the page's own background
canvas = Image.new('RGB', (DEVICE_W, DEVICE_H), bg)
canvas.paste(resized.crop((0, 0, DEVICE_W, min(resized.height, DEVICE_H))), (0, 0))
canvas.save(out)
```
Content sits at the top, genuine blank page background fills the rest — exactly what a real
screenshot taken on the phone would show. This is the fix that resolved the "not full iPhone
height" complaint.

## Capturing a Claude Design redesign canvas instead of a live site

When the "after" design lives in a Claude Design `.dc.html` project file rather than a live URL:

1. `mcp__claude-design__render_preview` with the project id and the `.dc.html` path → gives a
   `serve_url` (a short-lived `claudeusercontent.com` link). **Never persist this URL anywhere**
   — it's project-scoped and expires in ~1hr. Use it only as a one-off navigation target.
2. Navigate a real browser there and crop the specific option's card element directly, e.g.:
   ```js
   await page.goto(serve_url, { waitUntil: 'load' });
   await page.setViewportSize({ width: 1600, height: 1200 });
   const locator = page.locator('[id="1a"] .dv-card').nth(1); // desktop=0, mobile=1
   await locator.scrollIntoViewIfNeeded();
   await locator.screenshot({ path: out });
   ```
   (CSS ids starting with a digit, like `1a`, need the attribute-selector form —
   `#1a` is an invalid selector and throws.)
3. Same technique works for standalone assets (`hero-01.png`, `logo-mark.png`, …): render_preview
   the asset path, navigate to its `serve_url`, screenshot the rendered `<img>` at its natural
   size (`img.naturalWidth/naturalHeight` via `page.evaluate`).

## Playwriter's floating widget artifact

If a capture accidentally goes through the playwriter-controlled browser (or the extension is
active in whatever browser you use), a small cursor+✕ icon overlay can bleed into the corner of a
screenshot. It's positioned fixed to the viewport, not the page, so it only shows up when the
captured region happens to overlap it — inconsistent, easy to miss. Check every capture at full
size before using it. Fix by inpainting: crop a clean patch from elsewhere in the same image
(same size, no icon) and paste it over the icon's bounding box — cheaper and more reliable than
trying to hide the widget via CSS (it can re-render after a `display:none`).

## Output convention
`assets/img/trekroner/<before|after>-<page>-<desktop|mobile>.{png,jpg}` — adapt the
company-slug prefix per lead. Keep desktop as PNG (crisp UI screenshots); JPEG at quality
85-92 is fine for photo-heavy hero images to keep file size down.

## Report back
Terse: which pages captured, real vs reconstructed content confirmed, any artifact patched,
final file sizes if notably large.
