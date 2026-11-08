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
  // an app's writes: database rows go to Postgres only, with Allow writes on; API actions exist too; every action
  // waits for a person. Any line that pairs writing with Postgres must say rows (whatever its case or wording) ...
  for (const l of say(/Postgres/)) if (/writ/i.test(l)) { expect(l, l).toMatch(/database rows?|row writes/i); expect(l, l).toMatch(/Allow writes/); }
  // ... and the lines that describe app actions name both kinds and the person's confirmation
  const crew = COMP.find((c: any) => c.id === 'crew'), studio = COMP.find((c: any) => c.id === 'studio'), garden = COMP.find((c: any) => c.id === 'garden');
  const row = (id: string) => (ROWS.find((r: any) => r[0] === id) || [])[2] as string;
  for (const l of [row('D5')]) {
    expect(l, 'an app action line').toMatch(/call an API or write (one|a) database row/);
    expect(l, l).toMatch(/only when a person confirms/);
  }
  expect(row('K3')).toMatch(/writes database rows only to Postgres, with Allow writes on/);
  // the data gate is the path to a database; an API or MCP server's tools reach agents as MCP tools, not through it
  for (const l of say(/through one gate|data gate for every/)) if (/[Aa]gents? read|agent read/.test(l)) expect(l, l).toMatch(/database/);
  expect(row('D1')).toMatch(/an API or MCP server’s tools reach them as MCP tools/);
  // tracker actions (a comment, a status change) wait for a person, wherever they are described
  for (const l of say(/comment on the issue/)) expect(l, l).toMatch(/only when a person confirms/);
  // Ask is for SQL sources only (GraphQL keeps Test call)
  for (const l of say(/Ask a question/)) if (l.length > 90) expect(l, l).toMatch(/SQL source/);
  // which data a job read: crew says so, or says it is not known; never a guessed history
  for (const l of say(/which data/)) expect(l, l).toMatch(/not known/);
  // release-1108. Each guard must match something, so renaming the copy cannot skip it.
  const some = (re: RegExp, min = 1) => { const ls = say(re).filter((l) => l.length > 90); expect(ls.length, String(re)).toBeGreaterThanOrEqual(min); return ls; };
  // publishing: consent before the build, and nothing pushed or deployed
  for (const l of some(/[Pp]ublish(ing)? an app/, 2)) expect(l, l).toMatch(/consent/);
  expect(crew.news[5]).toMatch(/Nothing is pushed, and wicked deploys nothing/);
  expect(crew.news[5]).toMatch(/public only when every query is public and the app has no action/);
  // the embed snippet is only for a public app whose every query is public and that has no actions
  for (const l of some(/embed snippet/)) { expect(l, l).toMatch(/every query public/); expect(l, l).toMatch(/no actions/); }
  // review-change: judged off the authors AND nothing posted, both, on every full line and the D8 row
  for (const l of [...some(/review-change|[Rr]eview a change/, 3), row('D8')]) {
    expect(l, l).toMatch(/wrote none of/);
    expect(l, l).toMatch(/[Nn]othing is posted/);
  }
  // the source pick narrows the registered data sources only
  for (const l of some(/source pick|sources you picked|picked data sources/, 3)) { expect(l, l).not.toMatch(/read only the|every source/); expect(l, l).toMatch(/quer/); }
  expect(studio.news[2]).toMatch(/its agents query only the sources you picked, and your repository keeps its usual access/);
  expect(studio.news[2]).toMatch(/A source whose “Agents can query” switch is off cannot be picked\./);
  // documents: a PDF with no readable text is set aside with the reason on the document path (and Start waits)
  for (const l of [studio.news[1], crew.news[1], row('K9')]) expect(l, l).toMatch(/PDF with no readable text( \(a scan\))? is set aside,? with the reason/);
  expect(crew.news[1]).toBe('Documents as a job input: the files a person attached or picked are staged read-only for the job. On Respond and Rework a PDF with no readable text is set aside with the reason and Start waits, and both end in a fidelity check that a failed draft never skips.');
  // the pick narrows registered data sources only; the repository and crew's own services keep their access
  expect(crew.news[2]).toBe('The web source: research reads the public web through crew’s data gate. A job with a source pick records it, and its agents query only the picked data sources, at every step and every re-plan; the repository and crew’s own services keep their usual access.');
  expect(garden.news[2]).toBe('editor-scaffold also scaffolds a run plugin: a section in every studio job’s details, drawn from the job’s events, reading only the topics you approve when you install it.');
  // a demo with its data out of model context is reviewed by the person
  for (const l of [studio.news[8], row('K13')]) expect(l, l).toMatch(/stays out of model context is reviewed by you/);
  // the patch lines name exactly what the 0.16.1 and 0.18.1 changelogs say
  expect(studio.news[0]).toBe('0.16.1 fixes: a repository folder that does not exist says so on the banner, the sidebar marks one current page, and a job that started nothing says so.');
  expect(crew.news[0]).toBe('0.18.1: after a crew-only upgrade, crew says when your skills come from a wicked-garden older than the minimum it needs, and gives the command that fixes it. It bundles studio 0.16.1.');
  // phase plugins observe a job's events on consented topics: the reviewed lines, word for word
  expect(studio.news[6]).toBe('Phase plugins: /plugin phase builds a plugin that adds a section to every job’s details, drawn from the job’s events. Installing it asks you to approve each event topic it reads; Plugins lists it, with off and Remove.');
  expect(crew.news[7]).toBe('Phase plugins: a pack can install a run plugin that reads a job’s events on the topics its install consent grants.');
  expect(row('K12')).toBe('Phase plugins add a section to every job’s details, drawn from the job’s events; Plugins lists each one, with off and Remove.');
  expect(row('G10')).toBe('editor-scaffold scaffolds a run plugin, a section in every studio job’s details that reads only the event topics you approve.');
  for (const l of say(/[Pp]hase plugins?|run plugin/)) expect(l, l).not.toMatch(/intercept|adds? an? (step|check|review|gate|approval)|any (event )?topic|without (your )?consent/);
  // the Apps page draws no numbers until an app is opened
  for (const l of say(/Apps page/)) expect(l, l).not.toMatch(/headline numbers|live numbers/);
});
