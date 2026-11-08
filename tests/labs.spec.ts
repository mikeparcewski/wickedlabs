import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { pageData } from './export-data.mjs';

// Smoke for wickedlabs.ai: the approved lab design (DES-SITES-V2 rev 10.2-final) served as the page, with the
// operator's 2026-11-03 fixes (the lab's background art, no section links in the header, the family footer) and
// the production settings. Mirrors wickedagile's tests/e2e/v3.spec.ts.

const VIEWPORTS = [
  { width: 1440, height: 700 },
  { width: 1280, height: 660 },
  { width: 390, height: 844 },
];

// the release the page describes (release-1108: studio 0.16.0, crew 0.18.0, garden 12.66.1, estate 0.32.1), as it
// must show them; OLD are the releases before it, which must be gone from the page
const CURRENT = [
  { repo: 'wicked-studio', ver: '0.16.0', tag: 'v0.16.0' },
  { repo: 'wicked-crew', ver: '0.18.0', tag: 'v0.18.0' },
  { repo: 'wicked-garden', ver: '12.66.1', tag: 'v12.66.1' },
  { repo: 'wicked-estate', ver: '0.32.1', tag: 'v0.32.1' },
];
const OLD = ['0.14.1', '0.15.0', '0.16.13', '0.17.0', '12.63.0', '12.64.0', '12.66.0', '0.31.0', '0.32.0', '0.15.21', '0.15.24', '0.15.28', '0.15.32', '30 standard MCP tools'];

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
  test(`renders at ${vp.width}x${vp.height}: hero, follow a job, components, bits, workflows, start; no errors, sideways scroll or remote requests`, async ({ page, baseURL }) => {
    const w = watch(page, baseURL!);
    await page.setViewportSize(vp);
    await page.goto('/', { waitUntil: 'networkidle' });

    await expect(page.locator('h1').first()).toHaveText('Your coding agents do the work. A different agent checks it against your rules. You get the evidence.');
    await expect(page.locator('#follow .slide')).toHaveCount(6);
    await expect(page.locator('#chooseH')).toHaveText('Follow one job');
    await expect(page.locator('#components h2')).toHaveText('The components and their parts');
    await expect(page.locator('#bits h2')).toHaveText('Bits');
    await expect(page.locator('#workflows h2')).toHaveText('The workflows');
    await expect(page.locator('#start h2')).toHaveText('Start on your machine');
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

test('the components show today\'s releases', async ({ page, request }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  for (const c of CURRENT) {
    await expect(page.locator(`#components a.pcard2[href="#/${c.repo.replace('wicked-', '')}"] .ver`)).toHaveText(c.ver);
  }
  // nothing is labelled by a future release (operator rule, 2026-11-05)
  expect((await page.content()).toLowerCase()).not.toContain('coming soon');
  // under the hood, in the parts view: core-ts and interactive at today's tags
  await page.goto('/#parts', { waitUntil: 'networkidle' });
  await expect(page.locator('#pc-core > span:last-child')).toHaveText('core-ts 0.15.34');
  await expect(page.locator('#pc-interactive > span:last-child')).toHaveText('0.16.0');
  const html = await (await request.get('/')).text();
  for (const old of OLD) expect(html.includes(old), old).toBe(false);
  // the install flow is the installer, then wicked-crew serve, then the local URL (never npx wicked-crew serve alone)
  expect(html).not.toContain('npx wicked-crew serve');
  // the no-JavaScript fallback carries the whole flow
  expect(html).toContain('<code>npx wicked-installer</code>, then <code>wicked-crew serve</code>, then open http://127.0.0.1:7701</li>');
  // the installer's visible version, not only its tag
  expect(pageData().COMP.find((c: any) => c.id === 'installer').ver).toBe('0.9.0');
  // studio's and crew's own install lines: the installer, then serve, then the local URL
  for (const id of ['studio', 'crew']) {
    const c = pageData().COMP.find((x: any) => x.id === id);
    expect(c.install, id).toBe('npx wicked-installer');
    expect(c.installNote, id).toMatch(/^then wicked-crew serve, and open http:\/\/127\.0\.0\.1:7701/);
  }
  // phase plugins observe a job's events; the catalog never says a plugin adds a step (CS8, catalog-data-v2)
  expect(html).not.toMatch(/new kind of step|adds? an? (step|check|review) to/);
  expect(html).toContain("A section in every job's details, drawn from its events.");
  // the release links name the same tags: each component's tree in the no-JavaScript fallback and every release note
  for (const c of CURRENT) {
    expect(html, `${c.repo} tree`).toContain(`github.com/mikeparcewski/${c.repo}/tree/${c.tag}"`);
    expect(html, `${c.repo} notes`).toContain(`github.com/mikeparcewski/${c.repo}/blob/${c.tag}/CHANGELOG.md`);
  }
  expect(html).toContain('github.com/mikeparcewski/wicked-core/blob/core-ts-v0.15.34/CHANGELOG.md');
  // the product pages build their links from COMP's tags: pin them, and the rendered links on a product page
  const tags: Record<string, string> = Object.fromEntries(pageData().COMP.map((c: any) => [c.id, c.tag]));
  for (const c of CURRENT) expect(tags[c.repo.replace('wicked-', '')], c.repo).toBe(c.tag);
  expect(tags.core).toBe('core-ts-v0.15.34');
  expect(tags.interactive).toBe('v0.16.0');
  // the installer stamps its npm latest (0.9.0), visible in the parts view and in the export's get-started line
  expect(tags.installer).toBe('v0.9.0');
  await page.goto('/#/studio', { waitUntil: 'networkidle' });
  const hrefs = await page.locator('a[href*="github.com/mikeparcewski/wicked-studio/"]').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
  expect(hrefs.filter((h) => /\/tree\//.test(h!)).length, 'a GitHub tree link').toBeGreaterThan(0);
  expect(hrefs.filter((h) => /\/blob\/[^/]+\/CHANGELOG\.md/.test(h!)).length, 'a release-notes link').toBeGreaterThan(0);
  for (const h of hrefs) if (/\/(tree|blob)\//.test(h!)) expect(h).toMatch(/\/(tree|blob)\/v0\.16\.0(\/|$)/);
  expect(html).toContain('github.com/mikeparcewski/wicked-interactive/blob/v0.16.0/CHANGELOG.md');
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

// rev 11 (the operator, 2026-11-05): "break out bits into its own section", "remove the releases component and replace
// with a workflows component", "the start on your machine can be added below"; then: every workflow, no release labels,
// an interactive section.
type Card = { verb: string; id: string; title: string; command: string; delivers: string; gate: string[]; options: { title: string; command: string }[] };
const CATALOG: { verbs: { id: string; title: string }[]; cards: Card[] } = JSON.parse(readFileSync(new URL('./fixtures/catalog-v2.json', import.meta.url), 'utf8'));
const RELEASE_WORDS = /coming soon|coming in|not yet|\b1\.[012]\b|deferred|in progress|\bsoon\b/i;

test('bits is its own section, after the components; the components section carries no bits card', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(page.locator('#components .bitc, #components a[href*="bits.wickedagile.com"]')).toHaveCount(0);
  const card = page.locator('#bits a.pcard2.bitc');
  await expect(card).toHaveCount(1);
  await expect(card).toHaveAttribute('href', 'https://bits.wickedagile.com/the-work-factory/');
  await expect(card.locator('.nm')).toHaveText('The Work: the one-shift factory');
  await expect(page.locator('#bits a.bitsall')).toHaveAttribute('href', 'https://bits.wickedagile.com/');
  const order = await page.evaluate(() => [...document.querySelectorAll('main > section')].map((x) => x.id).filter((id) => ['components', 'bits', 'workflows', 'start'].includes(id)));
  expect(order).toEqual(['components', 'bits', 'workflows', 'start']);
});

test('the workflows: every verb, workflow and option of the catalog, with its command, and no release labels', async ({ page }) => {
  // the expected list is the catalog's (tests/fixtures/catalog-v2.json), not the page's own data
  const GET: Record<string, string> = { pr: 'A pull request', report: 'A report', document: 'A document in studio', video: 'A video', proposals: 'Proposals you approve' };
  const GATE: Record<string, string> = { 'qe-acceptance': 'QE acceptance', parity: 'Parity', 'cited-findings': 'Cited findings', 'fidelity-to-source': 'Fidelity to source',
    'evidence-floor': 'Evidence floor', 'proposal-only': 'Proposal only', 'draft-floor': 'Draft floor', walkthrough: 'Walkthrough review',
    'traces-to-requirements': 'Traces to requirements', pick: 'Your pick' };
  expect(CATALOG.cards.length).toBe(39);
  expect(CATALOG.cards.filter((c) => c.options.length).length).toBeGreaterThan(10);
  await page.goto('/', { waitUntil: 'networkidle' });
  const tabs = page.locator('#workflows [role="tablist"] [role="tab"]');
  expect((await tabs.allTextContents()).map((t) => t.replace(/\d+$/, ''))).toEqual(CATALOG.verbs.map((v) => v.title));
  // it opens on Build
  await expect(page.locator('#wft-build')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#releases, #changes .tli, .soon2')).toHaveCount(0);
  for (const v of CATALOG.verbs) {
    const want = CATALOG.cards.filter((c) => c.verb === v.id);
    await page.locator(`#wft-${v.id}`).click();
    await expect(page.locator(`#wft-${v.id}`)).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator(`#wft-${v.id} .n`)).toHaveText(String(want.length));
    await expect(page.locator('#wfPanel')).toHaveAttribute('aria-labelledby', `wft-${v.id}`);
    const cards = page.locator('#wfPanel [data-wfcard]');
    expect(await cards.evaluateAll((bs) => bs.map((b) => [b.querySelector('span')!.textContent, b.querySelector('code')!.textContent])))
      .toEqual(want.map((c) => [c.title, c.command]));
    for (const c of want) {
      await page.locator(`[data-wfcard="${c.id}"]`).click();
      await expect(page.locator(`[data-wfcard="${c.id}"]`)).toHaveAttribute('aria-expanded', 'true');
      const d = page.locator('#wfDetail');
      await expect(d.locator('h3')).toHaveText(c.title);
      await expect(d.locator('.wfcmd')).toHaveText(c.command);
      await expect(d.locator('dt').first()).toHaveText('You get');
      await expect(d.locator('dd').first()).toHaveText(GET[c.delivers]);
      expect(await d.locator('dd ul b').allTextContents(), `${c.title}: its checks`).toEqual(c.gate.map((g) => GATE[g]));
      expect(await d.locator('.wfopts li .t').allTextContents(), `${c.title}: its options`).toEqual(c.options.map((o) => o.title));
      expect(await d.locator('.wfopts li code').allTextContents(), `${c.title}: each option's command`).toEqual(c.options.map((o) => o.command));
      expect(await d.innerText(), `${c.title}: no release label`).not.toMatch(RELEASE_WORDS);
    }
  }
  expect(await page.locator('#workflows').innerText()).not.toMatch(RELEASE_WORDS);
});

test('an option that starts from something else, or is checked differently, says so', async ({ page }) => {
  await page.goto('/#workflows', { waitUntil: 'networkidle' });
  await page.locator('#wft-create').click();
  await page.locator('[data-wfcard="document"]').click();
  const repo = page.locator('#wfDetail .wfopts li', { hasText: 'Docs in the repo' });
  await expect(repo.locator('.s.x')).toHaveText('You get a pull request · starts from a repository · checked by fidelity to source · a different agent from the one that did the work checks it');
  await page.locator('#wft-analyze').click();
  await page.locator('[data-wfcard="analyze-codebase"]').click();
  await expect(page.locator('#wfDetail .wfopts li', { hasText: 'Domain' }).locator('.s.x')).toHaveText('starts from a repository, a project');
});

test('the verb tabs work from the keyboard: arrows, Home and End move the selection and the focus; a workflow opens with Enter', async ({ page }) => {
  await page.goto('/#workflows', { waitUntil: 'networkidle' });
  await page.locator('#wft-build').focus();
  const sel = () => page.locator('#workflows [role="tab"][aria-selected="true"]').getAttribute('id');
  const foc = () => page.evaluate(() => document.activeElement!.id);
  await page.keyboard.press('ArrowRight');
  expect([await sel(), await foc()]).toEqual(['wft-test', 'wft-test']);
  await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowLeft');
  expect([await sel(), await foc()]).toEqual(['wft-plan', 'wft-plan']);
  await page.keyboard.press('ArrowLeft');
  expect(await sel()).toBe('wft-improve');
  await page.keyboard.press('Home');
  expect(await sel()).toBe('wft-plan');
  await page.keyboard.press('End');
  expect(await sel()).toBe('wft-improve');
  // one tab stop for the tablist (roving tabindex)
  expect(await page.locator('#workflows [role="tab"][tabindex="0"]').count()).toBe(1);
  // Tab leaves the tablist for the workflows; Enter on one opens it and keeps the focus there
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => document.activeElement!.getAttribute('data-wfcard'))).toBe('review-recent-work');
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-wfcard="review-recent-work"]')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#wfDetail h3')).toHaveText('Review recent work');
  expect(await page.evaluate(() => document.activeElement!.getAttribute('data-wfcard'))).toBe('review-recent-work');
});

test('the detail sits beside the list on a laptop and opens under the picked workflow on a phone', async ({ page }) => {
  for (const vp of [{ width: 1440, height: 700 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(vp);
    await page.goto('/#workflows', { waitUntil: 'networkidle' });
    await page.locator('[data-wfcard="migrate"]').click();
    const where = await page.evaluate(() => { const d = document.getElementById('wfDetail')!; return { inList: !!d.closest('.wflist'), prev: d.previousElementSibling?.getAttribute('data-wfcard') ?? null }; });
    if (vp.width === 390) expect(where).toEqual({ inList: true, prev: 'migrate' });
    else expect(where.inList).toBe(false);
    const b = await page.locator('[data-wfcard="migrate"]').boundingBox();
    const d = await page.locator('#wfDetail').boundingBox();
    if (vp.width === 390) expect(d!.y).toBeGreaterThanOrEqual(b!.y + b!.height);
    else expect(d!.x).toBeGreaterThan(b!.x + b!.width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  }
});

test('inbound links keep working: #changes lands on the workflows, #start on the start command, below the workflows', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 700 });
  for (const [hash, id] of [['#changes', 'workflows'], ['#workflows', 'workflows'], ['#start', 'start'], ['#bits', 'bits']]) {
    await page.goto('/' + hash, { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
    const top = await page.locator('#' + id).evaluate((el) => el.getBoundingClientRect().top);
    expect(Math.abs(top), `${hash} lands on #${id}`).toBeLessThan(120);
  }
  const wf = await page.locator('#workflows').boundingBox();
  const st = await page.locator('#start').boundingBox();
  expect(st!.y).toBeGreaterThanOrEqual(wf!.y + wf!.height - 1);
  await expect(page.locator('#start code')).toHaveText(['npx wicked-installer', 'wicked-crew serve']);
  await expect(page.locator('#start')).toContainText('Then open http://127.0.0.1:7701 and start any workflow above from a studio chat.');
});

test('each start command has its own Copy button', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/#start', { waitUntil: 'networkidle' });
  for (const [k, cmd] of [['1', 'npx wicked-installer'], ['2', 'wicked-crew serve']]) {
    await expect(page.locator(`[data-copy="${k}"]`)).toHaveAccessibleName(`Copy ${cmd}`);
    await page.locator(`[data-copy="${k}"]`).click();
    await expect(page.locator(`#labCopyMsg${k}`)).toHaveText(`Copied ${cmd} to the clipboard.`);
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(cmd);
  }
});

test('the footer\'s "wicked good." is bigger: 60 px on a laptop, 40 px on a phone (the operator, 2026-11-05)', async ({ page }) => {
  for (const [vp, px] of [[{ width: 1440, height: 700 }, '60px'], [{ width: 390, height: 844 }, '40px']] as const) {
    await page.setViewportSize(vp);
    await page.goto('/', { waitUntil: 'networkidle' });
    expect(await page.locator('.fam-ft .footer-title').evaluate((el) => getComputedStyle(el).fontSize)).toBe(px);
  }
});
