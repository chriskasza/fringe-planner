// Playwright viewport pass for the PageHeader/CardBrowser/GridPlanner merge
// (see CLAUDE.md "Testing front-end changes" - jsdom does no layout, so this
// is how CSS-only responsive behavior actually gets verified). Boots a dev
// server on a fixed port, renders the real app at representative widths, and
// hit-tests the live DOM/computed styles rather than reading CSS and
// reasoning about it.
//
// Run with: node e2e/viewport-check.mjs

import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const PORT = 5183;
const BASE_URL = `http://localhost:${PORT}`;
const OUTPUT_DIR = fileURLToPath(new URL('output', import.meta.url));
const failures = [];

async function screenshot(page, name) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  await page.screenshot({ path: `${OUTPUT_DIR}/${name}.png` });
}

function check(label, condition, detail) {
  if (!condition) {
    failures.push(`${label}${detail ? ` — ${detail}` : ''}`);
    console.error(`FAIL: ${label}${detail ? ` — ${detail}` : ''}`);
  } else {
    console.log(`ok:   ${label}`);
  }
}

async function waitForServer(url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Dev server did not respond at ${url} within ${timeoutMs}ms`);
}

async function computed(page, selector, prop) {
  return page.$eval(
    selector,
    (el, p) => getComputedStyle(el).getPropertyValue(p),
    prop,
  );
}

// Chromium supports both the standard `line-clamp` and legacy
// `-webkit-line-clamp` - check whichever one actually resolved.
async function lineClamp(page, selector) {
  return page.$eval(selector, (el) => {
    const cs = getComputedStyle(el);
    const std = cs.getPropertyValue('line-clamp').trim();
    const webkit = cs.getPropertyValue('-webkit-line-clamp').trim();
    return std && std !== 'none' ? std : webkit;
  });
}

async function isVisible(page, selector) {
  const el = await page.$(selector);
  if (!el) return false;
  return el.isVisible();
}

async function main() {
  const server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], {
    cwd: new URL('..', import.meta.url).pathname,
    stdio: 'pipe',
  });
  server.stderr.on('data', (d) => process.stderr.write(`[vite] ${d}`));

  try {
    await waitForServer(BASE_URL);

    const browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();

    // --- Desktop width (1440px): wordmark, ON NOW badge, label width, venue
    // address, no line-clamp, no max-width cap on either view. ---
    await page.setViewportSize({ width: 1440, height: 900 });

    // Mock the clock into a real on-now window (show 284247's Sep 3
    // 14:00-15:00 performance at Grafton Street Dinner Theatre, ADT/UTC-3)
    // so the ON NOW badge actually renders - today's real date has no
    // festival show running, so this is the only way to exercise it.
    await page.clock.install({ time: new Date('2026-09-03T17:15:00Z') });

    await page.goto(BASE_URL);
    await page.waitForSelector('[data-testid="topbar-wordmark"]');

    const wordmarkText1440 = await page.$eval('[data-testid="topbar-wordmark"]', (el) => el.innerText.trim());
    check('1440px: wordmark reads "Halifax Fringe Planner"', wordmarkText1440 === 'Halifax Fringe Planner', wordmarkText1440);

    check('1440px: ON NOW badge visible', await isVisible(page, '[data-testid="topbar"] >> text=ON NOW'));

    const labelWidth1440 = await computed(page, '[data-testid="time-header"]', '--grid-label-width');
    check('1440px: --grid-label-width resolves to 176px', labelWidth1440.trim() === '176px', labelWidth1440);

    check('1440px: venue-row-address visible', await isVisible(page, '[data-testid="venue-row-address"]'));

    const nameClamp1440 = await lineClamp(page, '[data-testid="venue-row-label"] span');
    check(
      '1440px: venue-row__name has no line clamp',
      nameClamp1440 === 'none' || nameClamp1440 === '',
      nameClamp1440,
    );

    const gridPlannerWidth1440 = await page.$eval('[data-testid="grid-planner"]', (el) => el.getBoundingClientRect().width);
    check('1440px: Grid view is not capped (fills viewport, no max-width)', gridPlannerWidth1440 > 1400, `${gridPlannerWidth1440}px`);

    await screenshot(page, '1440-grid');

    // --- Dropdown focus trap (Venue filter): jsdom can't verify this at all
    // (tabbable, focus-trap's tabbable-element lookup, treats everything as
    // hidden under jsdom - see Dropdown.test.tsx), so this is the only place
    // Tab/Shift+Tab wraparound and Escape-to-close actually get exercised. ---
    await page.getByRole('button', { name: /^Venue/ }).click();
    const dialog = page.getByRole('dialog', { name: 'Venue' });
    await dialog.waitFor();

    const focusableInDialog = dialog.locator('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    const firstFocusable = focusableInDialog.first();
    const lastFocusable = focusableInDialog.last();

    await lastFocusable.focus();
    await page.keyboard.press('Tab');
    check(
      'Dropdown: Tab from the last focusable element wraps to the first',
      await firstFocusable.evaluate((el) => el === document.activeElement),
    );

    await firstFocusable.focus();
    await page.keyboard.press('Shift+Tab');
    check(
      'Dropdown: Shift+Tab from the first focusable element wraps to the last',
      await lastFocusable.evaluate((el) => el === document.activeElement),
    );

    await page.keyboard.press('Escape');
    check('Dropdown: Escape closes the panel', !(await dialog.isVisible()));

    // Switch to Cards view and pick a show to exercise CardGrid + MyFringeRail.
    await page.getByRole('button', { name: 'Grid', exact: true }).click();
    await page.waitForSelector('[data-testid="card-browser"]');

    const cardBrowserWidth1440 = await page.$eval('[data-testid="card-browser"]', (el) => el.getBoundingClientRect().width);
    check('1440px: Cards view is not capped (fills viewport, no max-width)', cardBrowserWidth1440 > 1400, `${cardBrowserWidth1440}px`);

    // Regression check #1 (CLAUDE.md): no card overlaps the one below it.
    const cardRects = await page.$$eval('[data-testid="show-card"]', (els) =>
      els.map((el) => el.getBoundingClientRect()).map((r) => ({ left: r.left, right: r.right, top: r.top, bottom: r.bottom })),
    );
    let overlapFound = false;
    for (let i = 0; i < cardRects.length && !overlapFound; i++) {
      for (let j = i + 1; j < cardRects.length; j++) {
        const a = cardRects[i];
        const b = cardRects[j];
        const horizontallyAligned = a.left < b.right && b.left < a.right;
        const verticallyOverlapping = a.top < b.bottom && b.top < a.bottom;
        if (horizontallyAligned && verticallyOverlapping) {
          overlapFound = true;
          break;
        }
      }
    }
    check('1440px: no card in the grid overlaps another', !overlapFound);

    // Pick every performance of the first show. Picking only pops the My
    // Fringe badge now (see state.ts TOGGLE_SHOW_STAR and TopBar.tsx) - it
    // no longer force-opens the panel, so open it explicitly to exercise
    // CardGrid + MyFringePanel together.
    const starButtons = await page.$$('[data-testid="show-card"] button[aria-label^="Add all of"]');
    if (starButtons.length > 0) {
      await starButtons[0].click();
    }
    await page.getByRole('button', { name: /^My Fringe/ }).click();
    await page.waitForSelector('[data-testid="my-fringe-panel"]');

    // Regression check #2 (CLAUDE.md): the panel footer doesn't paint over
    // the picks list.
    const panelBodyRect = await page.$eval('[data-testid="my-fringe-panel"] > div:nth-child(2)', (el) => el.getBoundingClientRect());
    const panelFooterRect = await page.$eval('[data-testid="my-fringe-panel"] > div:last-child', (el) => el.getBoundingClientRect());
    check(
      '1440px: My Fringe panel footer does not paint over the picks list',
      panelBodyRect.bottom <= panelFooterRect.top + 1,
      `body bottom=${panelBodyRect.bottom}, footer top=${panelFooterRect.top}`,
    );

    await screenshot(page, '1440-cards');

    // --- 1000px: the panel used to hide here with no way to reopen it
    // before 700px (see docs/my-fringe-panel-notes.md) - now it's a fixed
    // overlay mounted at the App level, reachable at every width, so it
    // should still be visible after the pick made above. ---
    await page.setViewportSize({ width: 1000, height: 900 });
    check('1000px: My Fringe panel still visible (reachable at every width)', await isVisible(page, '[data-testid="my-fringe-panel"]'));
    await screenshot(page, '1000-cards');

    // Close it via its own X before continuing - narrower widths below turn
    // it into a full-screen overlay that would otherwise intercept clicks on
    // the view toggle.
    await page.getByRole('button', { name: 'Close My Fringe' }).click();
    check('1000px: My Fringe panel closes via its own X', !(await isVisible(page, '[data-testid="my-fringe-panel"]')));

    // --- 620px: between the 700px and 520px thresholds - "Halifax " is
    // dropped but "Planner" still fits. ---
    await page.setViewportSize({ width: 620, height: 900 });
    const wordmarkText620 = await page.$eval('[data-testid="topbar-wordmark"]', (el) => el.innerText.trim());
    check('620px: wordmark reads "Fringe Planner" (only Halifax dropped)', wordmarkText620 === 'Fringe Planner', wordmarkText620);
    await screenshot(page, '620-cards');

    // --- 520px: legend and "Planner" hidden (also out of scope, spot-check only). ---
    await page.setViewportSize({ width: 520, height: 900 });
    await page.getByRole('button', { name: 'Cards', exact: true }).click();
    await page.waitForSelector('[data-testid="grid-planner"]');
    check('520px: grid legend hidden', !(await isVisible(page, '.grid-body__legend, [class*="grid-body__legend"]')));
    await screenshot(page, '520-grid');

    // --- 390px (mobile): wordmark, ON NOW hidden, narrower label, no address,
    // 3-line clamp. ---
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForSelector('[data-testid="topbar-wordmark"]');

    // 390px is under both the 700px ("Halifax " drops) and 520px ("Planner"
    // drops) thresholds, so only the bare "Fringe" survives - matches the
    // old mobile tree's behavior at this width (compact wordmark "Fringe",
    // plus the pre-existing 520px rule dropping "Planner").
    const wordmarkText390 = await page.$eval('[data-testid="topbar-wordmark"]', (el) => el.innerText.trim());
    check('390px: wordmark reads "Fringe" (Halifax and Planner both dropped)', wordmarkText390 === 'Fringe', wordmarkText390);

    check('390px: ON NOW badge hidden despite onNow>0', !(await isVisible(page, '[data-testid="topbar"] >> text=ON NOW')));

    const labelWidth390 = await computed(page, '[data-testid="time-header"]', '--grid-label-width');
    check('390px: --grid-label-width resolves to 112px', labelWidth390.trim() === '112px', labelWidth390);

    check('390px: venue-row-address hidden', !(await isVisible(page, '[data-testid="venue-row-address"]')));

    const nameClamp390 = await lineClamp(page, '[data-testid="venue-row-label"] span');
    check('390px: venue-row__name computed line-clamp is 3', nameClamp390 === '3', nameClamp390);

    await screenshot(page, '390-grid');

    // --- My Fringe panel reachable from Grid view too, as a full-screen
    // overlay under the 700px breakpoint (same treatment as DetailPanel). ---
    await page.getByRole('button', { name: /^My Fringe/ }).click();
    await page.waitForSelector('[data-testid="my-fringe-panel"]');
    const panelRect390 = await page.$eval('[data-testid="my-fringe-panel"]', (el) => el.getBoundingClientRect());
    check(
      '390px: My Fringe panel is a full-width overlay from Grid view',
      panelRect390.width >= 389,
      `${panelRect390.width}px`,
    );
    await screenshot(page, '390-my-fringe-panel');

    await browser.close();
  } finally {
    server.kill();
  }

  console.log('');
  if (failures.length > 0) {
    console.error(`${failures.length} check(s) failed:`);
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  } else {
    console.log('All viewport checks passed.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
