import { expect, test } from '@playwright/test';
// @ts-ignore: a plain ESM module beside the specs
import { exportData, pageData, serialise, FILES, LAB, labHref } from './export-data.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// The lab's data export (data/products.json, data/capabilities.json): wickedagile.com reads both at build time for its
// Work cards (wickedagile src/lib/sources.mjs). These checks hold the export to the page and to the shape rules
// wickedagile applies, so a stale or malformed export is caught here rather than dropped silently there.

const ROOT = fileURLToPath(new URL('..', import.meta.url));

// wickedagile's shape checks (src/lib/sources.mjs VALID.labProducts / labCapabilities), with its lab-link rule: a
// product's url is the lab's own view of it, LAB + '#/' + id
const isStr = (s: unknown) => typeof s === 'string' && s.trim().length > 0;
const isId = (s: unknown) => typeof s === 'string' && /^[a-z0-9][a-z0-9-]{0,79}$/.test(s);
const isUrl = (s: unknown) => { if (typeof s !== 'string' || !/^https:\/\/[^/]/.test(s) || /["'<>\s`\\]/.test(s)) return false; try { return new URL(s).protocol === 'https:'; } catch { return false; } };
const rows = (a: unknown, ok: (x: any) => boolean) => Array.isArray(a) && a.every((x) => x && typeof x === 'object' && ok(x));

test('the committed export is exactly what the page generates (run node tests/export-data.mjs after editing the page)', () => {
  const out = exportData();
  for (const [k, f] of Object.entries(FILES) as [keyof typeof out, string][]) {
    expect(readFileSync(ROOT + f, 'utf8'), f).toBe(serialise(out[k]));
  }
});

test('data/products.json passes wickedagile\'s shape checks, and every product links its own lab view', async ({ request }) => {
  const r = await request.get('/data/products.json');
  expect(r.status()).toBe(200);
  const d = await r.json();
  expect(isStr(d.platformBadge)).toBe(true);
  expect(Array.isArray(d.products) && d.products.length > 0).toBe(true);
  expect(rows(d.products, (c) => isId(c.id) && isStr(c.name) && (c.tier === 'featured' || c.tier === 'component')
    && (c.experiment ? (c.eyebrow == null || isStr(c.eyebrow)) : isStr(c.ver) && isStr(c.release) && isStr(c.headline) && isUrl(c.url) && isStr(c.tag)))).toBe(true);
  expect(rows(d.underTheHood, (u) => isId(u.id) && isStr(u.name) && isStr(u.line))).toBe(true);
  expect(isStr(d.getStarted?.cmd) && isStr(d.getStarted?.line)).toBe(true);
  expect(rows(d.relations, (x) => isId(x.a) && isId(x.b) && isStr(x.sentence))).toBe(true);
  // wickedagile's graph build: the Platform placeholder carries only these keys, and has no edges
  const platform = d.products.find((c: any) => c.experiment);
  expect(Object.keys(platform).sort()).toEqual(['experiment', 'eyebrow', 'id', 'name', 'tier']);
  const ids = new Set(d.products.filter((c: any) => !c.experiment).map((c: any) => c.id));
  for (const x of d.relations) expect(ids.has(x.a) && ids.has(x.b), `${x.a}-${x.b}`).toBe(true);
  // the links: the lab routes by hash, so a product's view is #/<id>, never a path (GitHub Pages' 404)
  for (const c of d.products.filter((p: any) => !p.experiment)) expect(c.url).toBe(labHref(c.id));
  expect(LAB).toBe('https://wickedlabs.ai/');
});

test('each product\'s link opens its own page on the lab, at the version the export names', async ({ page, request }) => {
  const d = await (await request.get('/data/products.json')).json();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  for (const c of d.products.filter((p: any) => !p.experiment)) {
    await page.goto('/' + new URL(c.url).hash, { waitUntil: 'networkidle' });
    await expect(page.locator('main h1')).toHaveText(c.headline);
    await expect(page.locator('.cpage .meta dd').nth(1)).toContainText(c.ver);
  }
  expect(errors).toEqual([]);
});

test('data/capabilities.json lists every part on the page, released or coming soon', async ({ request }) => {
  const r = await request.get('/data/capabilities.json');
  expect(r.status()).toBe(200);
  const d = await r.json();
  expect(rows(d.capabilities, (c) => isStr(c.id) && (c.status == null || isStr(c.status)))).toBe(true);
  const { ROWS } = pageData();
  expect(d.capabilities.map((c: any) => c.id)).toEqual(ROWS.map((x: any) => x[0]));
  expect(new Set(d.capabilities.map((c: any) => c.id)).size).toBe(ROWS.length);
  for (const c of d.capabilities) expect(['released', 'soon']).toContain(c.status);
  // nothing the release leaves out is shown as released (DES-CATALOG-002, Report figures as a source, PM-2)
  const released = d.capabilities.filter((c: any) => c.status === 'released').map((c: any) => c.line).join(' ');
  expect(released).not.toMatch(/GitLab|Azure DevOps|SQL Server|Oracle|Snowflake|BigQuery|Report’s own figures/);
});

test('release claims keep their qualifiers (release-1104 review): the Agents box, app writes, data use, the Apps page', () => {
  const { COMP, ROWS } = pageData();
  const lines: string[] = [...ROWS.map((r: any) => r[2])];
  for (const c of COMP) for (const k of ['lead', 'news', 'newsShort', 'benefits']) {
    const v = c[k];
    if (typeof v === 'string') lines.push(v);
    else if (Array.isArray(v)) for (const x of v) lines.push(Array.isArray(x) ? x.join(' ') : x);
  }
  const say = (re: RegExp) => lines.filter((l) => re.test(l));
  // the Agents box is on saved SQL sources, and agents query rows only on Postgres
  for (const l of say(/Agents box on/)) { expect(l, l).toMatch(/saved SQL source/); expect(l, l).toMatch(/Postgres/); }
  // an app's writes: database rows go to Postgres only; API actions exist too, and every action waits for a person
  for (const l of say(/writes? (database )?rows?|row writes/)) expect(l, l).toMatch(/Postgres/);
  for (const l of say(/\bwrites? (only )?to Postgres/)) expect(l, l).toMatch(/database rows?|row writes/);
  // which data a job read: crew says so, or says it is not known; never a guessed history
  for (const l of say(/which data/)) expect(l, l).toMatch(/not known/);
  // the Apps page draws no numbers until an app is opened
  for (const l of say(/Apps page/)) expect(l, l).not.toMatch(/headline numbers|live numbers/);
});
