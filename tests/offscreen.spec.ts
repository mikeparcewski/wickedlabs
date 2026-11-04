import { test, expect } from '@playwright/test';
import { SIZES, place, watch, read, expectStill, setHidden } from './offscreen-kit';

/**
 * The family rule for anything that moves (operator, 2026-11-04: "when interactives are playing the
 * scroll is scrolling back to them ... stop an animation when it's offscreen"), on the lab page.
 *
 * Nothing here plays by itself: the follow-a-job panel changes only as the reader scrolls through
 * its steps. These cases keep it that way, at 1440x900, 1280x720 and 390x844:
 * - the page opts out of scroll anchoring (the panel swaps its content inside a box of fixed height,
 *   so there is nothing for anchoring to correct);
 * - off screen, and peeking in at an edge, nothing in the panel changes or animates for a while, the
 *   page holds still and nothing takes focus;
 * - on screen, held at each step, it does not change or move the page either; scrolling to the next
 *   step still moves it on.
 */

for (const size of SIZES) {
  test.describe(`${size.width}x${size.height}`, () => {
    test.use({ viewport: size });

    test('the page opts out of scroll anchoring', async ({ page }) => {
      await page.goto('/');
      expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflowAnchor)).toBe('none');
    });

    test('the follow-a-job panel never changes or moves the page by itself', async ({ page }) => {
      test.setTimeout(60_000);
      await page.goto('/');
      await page.locator('#follow .stage').waitFor();
      // off screen and peeking in, nothing in the panel plays on: a glide it started lands as it leaves
      await expectStill(page, '#follow', 1000, 'off', 'the panel', '#follow');
      await expectStill(page, '#follow', 1000, 'edge', 'the panel', '#follow');
      // on screen it moves only with the reader: once a step's glide (0.55 s) has landed, nothing changes by itself
      for (const k of [1, 3, 6]) {
        await place(page, `#step-${k}`, 'on');
        await page.waitForTimeout(700);
        await watch(page, '#follow');
        await page.waitForTimeout(1500);
        const s = await read(page, '#follow');
        expect(s.mutations, `step ${k}: the panel changed by itself`).toBe(0);
        expect(s.running + s.advanced, `step ${k}: something animates by itself`).toBe(0);
        expect(s.moved, `step ${k}: the page moved by itself`).toBeLessThanOrEqual(1);
        expect(s.focusMoved, `step ${k}: focus moved`).toBe(false);
      }
      // the reader scrolls on: the panel follows
      await watch(page, '#follow');
      await place(page, '#step-2', 'on');
      expect((await read(page, '#follow')).mutations, 'the panel follows the reader').toBeGreaterThan(0);
    });
  });

}

test.describe('a hidden tab', () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test("lands the panel's glide at once", async ({ page }) => {
    await page.goto('/');
    await page.locator('#follow .stage').waitFor();
    await place(page, '#step-2', 'on');
    await page.waitForTimeout(700);
    await watch(page, '#follow');
    // the reader moves on a step and the tab is hidden during the token's glide
    await page.evaluate(() => { const s = document.getElementById('step-3') as HTMLElement; window.scrollTo({ top: Math.round(s.getBoundingClientRect().top + window.scrollY), behavior: 'instant' as ScrollBehavior }); });
    await page.waitForTimeout(120);
    await setHidden(page, true);
    expect((await read(page, '#follow')).running, 'nothing glides on in a hidden tab').toBe(0);
  });
});
