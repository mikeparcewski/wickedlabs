import { expect, test, type Page } from '@playwright/test';

// Smoke for wickedlabs.ai: the approved lab design (DES-SITES-V2 rev 10.2-final) served as the page, with the
// operator's 2026-11-03 fixes (the lab's background art, no section links in the header, the family footer) and
// the production settings. Mirrors wickedagile's tests/e2e/v3.spec.ts.

const VIEWPORTS = [
  { width: 1440, height: 700 },
  { width: 1280, height: 660 },
  { width: 390, height: 844 },
];

// the release the page describes (release-1104: studio 0.15.0, crew 0.17.0, garden 12.64.0, estate 0.32.0), as it
// must show them; OLD are the releases before it, which must be gone from the page
const CURRENT = [
  { repo: 'wicked-studio', ver: '0.15.0', tag: 'v0.15.0' },
  { repo: 'wicked-crew', ver: '0.17.0', tag: 'v0.17.0' },
  { repo: 'wicked-garden', ver: '12.64.0', tag: 'v12.64.0' },
  { repo: 'wicked-estate', ver: '0.32.0', tag: 'v0.32.0' },
];
const OLD = ['0.14.1', '0.16.13', '12.63.0', '0.31.0', '0.15.21', '30 standard MCP tools'];

function watch(page: Page, baseURL: string) {
  const errors: string[] = [];
  const remote: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (u.protocol.startsWith('http') && u.origin !== new URL(baseURL).origin) remote.push(r.url());
  });
  return { errors, remote };
}

for (const vp of VIEWPORTS) {
  test(`renders at ${vp.width}x${vp.height}: hero, follow a job, components, releases; no errors, sideways scroll or remote requests`, async ({ page, baseURL }) => {
    const w = watch(page, baseURL!);
    await page.setViewportSize(vp);
    await page.goto('/', { waitUntil: 'networkidle' });

    await expect(page.locator('h1').first()).toHaveText('Your coding agents do the work. A different agent checks it against your rules. You get the evidence.');
    await expect(page.locator('#follow .slide')).toHaveCount(6);
    await expect(page.locator('#chooseH')).toHaveText('Follow one job');
    await expect(page.locator('#components h2')).toHaveText('The components and their parts');
    await expect(page.locator('#changes h2')).toHaveText('The latest releases');
    // the follow-a-job controls are the page's own navigation and stay
    await expect(page.locator('.hero a[href="#step-1"]')).toHaveCount(1);
    await expect(page.locator('[data-case]')).toHaveCount(3);

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    expect(w.errors).toEqual([]);
    expect(w.remote).toEqual([]);
  });
}

test('the header carries no section links; the phone menu holds only the lab, bits, Medium and GitHub (operator, 2026-11-03)', async ({ page }) => {
  for (const vp of [{ width: 1440, height: 700 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(vp);
    await page.goto('/', { waitUntil: 'networkidle' });
    // in-page links: none outside the lockup (its "labs" crumb is this page's own top)
    await expect(page.locator('header #nav a[href^="#"]')).toHaveCount(0);
    await expect(page.locator('header a[href="#follow"], header a[href="#components"], header a[href="#changes"]')).toHaveCount(0);
    await expect(page.locator('header .sec, header .nsep')).toHaveCount(0);
    // the "Wicked Agile / labs" breadcrumb lockup stays
    await expect(page.locator('header nav.crumbs a.brand[href="https://wickedagile.com/"]')).toHaveCount(1);
    await expect(page.locator('header nav.crumbs li')).toHaveCount(2);
    if (vp.width === 390) {
      await page.locator('#menuBtn').click();
      await expect(page.locator('#nav.open')).toBeVisible();
      const rows = await page.locator('#nav.open a').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
      expect(rows).toEqual(['https://wickedlabs.ai/', 'https://bits.wickedagile.com/', 'https://medium.com/@mike.parcewski', 'https://github.com/mikeparcewski']);
    }
  }
});

test('the footer is the family footer bits carries (operator, 2026-11-03)', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  const f = page.locator('.fam-ft footer.footer');
  await expect(f).toHaveCount(1);
  await expect(page.locator('footer.byline, #notesBtn')).toHaveCount(0);
  for (const name of ['studio', 'crew', 'garden', 'estate', 'bits']) await expect(f.locator('.footer-links a', { hasText: name })).toHaveCount(1);
  for (const head of ['Experience', 'Control', 'Capability', 'Foundation', 'Media']) await expect(f.locator('.footer-col-head', { hasText: head })).toHaveCount(1);
  await expect(f.locator('.footer-cta a', { hasText: 'GitHub' })).toHaveAttribute('href', 'https://github.com/mikeparcewski/wickedlabs');
  await expect(f.locator('.footer-promo')).toHaveAttribute('href', 'https://bits.wickedagile.com/the-work-factory/');
  // it spans the page, as on the family sites, and follows the theme switch
  const box = await f.boundingBox();
  expect(box!.x).toBeLessThanOrEqual(1);
  for (const [theme, ink] of [['dark', 'rgb(237, 237, 234)'], ['light', 'rgb(24, 24, 26)']]) {
    await page.goto(`/?theme=${theme}`, { waitUntil: 'networkidle' });
    expect(await f.locator('.footer-title').evaluate((el) => getComputedStyle(el).color)).toBe(ink);
  }
});

test('the lab background art is one fixed layer behind a veil, 0.08 dark and 0.06 light, from this origin (no grid)', async ({ page, baseURL }) => {
  const art: number[] = [];
  page.on('response', (r) => { if (r.url().endsWith('/art/labs-bg.svg')) art.push(r.status()); });
  for (const [theme, opacity] of [['dark', '0.08'], ['light', '0.06']]) {
    await page.goto(`/?theme=${theme}`, { waitUntil: 'networkidle' });
    const s = await page.evaluate(() => {
      const b = getComputedStyle(document.body, '::before');
      const v = getComputedStyle(document.querySelector('.hero > div')!, '::before');
      return {
        position: b.position, z: b.zIndex, opacity: b.opacity, mask: b.maskImage || (b as any).webkitMaskImage,
        size: b.maskSize || (b as any).webkitMaskSize, veil: v.backgroundColor, veilZ: v.zIndex,
        grid: [getComputedStyle(document.documentElement).backgroundImage, getComputedStyle(document.body).backgroundImage],
      };
    });
    expect(s.position).toBe('fixed');
    expect(s.z).toBe('-2');
    expect(s.opacity).toBe(opacity);
    expect(s.mask).toContain(`${new URL(baseURL!).origin}/art/labs-bg.svg`);
    expect(s.size).toBe('cover');
    expect(s.veilZ).toBe('-1');
    expect(s.veil).not.toBe('rgba(0, 0, 0, 0)');
    expect(s.grid).toEqual(['none', 'none']);
  }
  expect(art.length).toBeGreaterThan(0);
  expect(art.every((st) => st === 200 || st === 304)).toBe(true);
});

test('the art is visible where no text is, in both themes (it draws, and nothing opaque covers it)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 700 });
  // the hero's right margin, outside the chooser card and every veil
  const clip = { x: 1340, y: 60, width: 100, height: 640 };
  for (const theme of ['dark', 'light']) {
    await page.goto(`/?theme=${theme}`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    const withArt = await page.screenshot({ clip });
    const off = await page.addStyleTag({ content: 'body::before{content:none!important}' });
    const without = await page.screenshot({ clip });
    await off.evaluate((el) => el.remove());
    expect(withArt.equals(without), `the art shows in the ${theme} theme`).toBe(false);
  }
});

test('without color-mix() the sticky header keeps a solid background (the mixed one is declared after it)', async ({ request }) => {
  const html = await (await request.get('/')).text();
  expect(html).toMatch(/\.hdr\{[^}]*background:var\(--surface-base\);background:color-mix\(in srgb,var\(--surface-base\) 88%,transparent\)/);
});

test('the components and releases show today\'s releases, each linked to its CHANGELOG at the tag', async ({ page, request }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  for (const c of CURRENT) {
    await expect(page.locator(`#components a.pcard2[href="#/${c.repo.replace('wicked-', '')}"] .ver`)).toHaveText(c.ver);
    const item = page.locator('#changes .tli', { has: page.locator(`h3 a[href="#/${c.repo.replace('wicked-', '')}"]`) });
    await expect(item.locator('.ver')).toHaveText(c.ver);
    await expect(item.locator('a.more')).toHaveAttribute('href', `https://github.com/mikeparcewski/${c.repo}/blob/${c.tag}/CHANGELOG.md`);
  }
  // studio 0.15.0 leads with Apps, its data sources and Report's dashboards (up to three lines per component)
  await expect(page.locator('#changes .tli', { hasText: 'wicked-studio' }).locator('li')).toHaveText([
    'Apps, under Work: build a live app or dashboard over your data in a chat',
    'Data sources: Test connection, Ask a question of the data, and the Agents box',
    'Report shows up to four of your apps as dashboards; trackers link to projects',
  ]);
  // the four components shipped together, on one day
  expect(await page.locator('#changes .tli .tld').allTextContents()).toEqual(['Nov 4', 'Nov 4', 'Nov 4', 'Nov 4']);
  // what is not built yet says so, and names nothing this release ships
  const soon = page.locator('#changes .soon2');
  await expect(soon).toHaveText('Coming soon: GitLab and Azure DevOps trackers, more databases (SQL Server, Oracle, Snowflake and BigQuery), and Report’s own figures as a data source for your apps.');
  // under the hood, in the parts view: core-ts and interactive at today's tags
  await page.goto('/#parts', { waitUntil: 'networkidle' });
  await expect(page.locator('#pc-core > span:last-child')).toHaveText('core-ts 0.15.24');
  await expect(page.locator('#pc-interactive > span:last-child')).toHaveText('0.15.0');
  const html = await (await request.get('/')).text();
  for (const old of OLD) expect(html.includes(old), old).toBe(false);
});

test('production settings: the title, no design notes or mockup wording, and media queries Safari before 16.4 understands', async ({ page, request }) => {
  await page.goto('/?notes=1', { waitUntil: 'networkidle' });
  await expect(page).toHaveTitle('Wicked Labs: the wicked products');
  expect(await page.locator('meta[name="description"]').getAttribute('content')).not.toMatch(/mockup|design/i);
  expect(await page.evaluate(() => document.body.classList.contains('notes'))).toBe(false);
  await expect(page.locator('.note, #notesBtn')).toHaveCount(0);
  const WORDING = /mockup|design notes|COPY rev|In production/i;
  expect(await page.evaluate(() => document.body.innerText)).not.toMatch(WORDING);
  // a component page and an open part's detail
  await page.goto('/#/crew', { waitUntil: 'networkidle' });
  await expect(page.locator('main h1')).toHaveText('The harness for the coding agents you already use.');
  expect(await page.evaluate(() => document.body.innerText)).not.toMatch(WORDING);
  await page.goto('/#parts?part=C1', { waitUntil: 'networkidle' });
  await expect(page.locator('.pdetail')).toHaveCount(1);
  expect(await page.locator('#parts').innerText()).not.toMatch(WORDING);
  const html = await (await request.get('/')).text();
  expect(html.match(/@media[^{]*\(\s*(width|height)\s*[<>]/g) ?? []).toEqual([]);
});
