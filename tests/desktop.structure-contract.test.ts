import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser } from '@playwright/test';
import { inspectCodexStructureScript, parseStructureObservation } from '../packages/adapter-codex/src/structure-contracts.ts';

let browser: Browser;
beforeAll(async () => {
  browser = await chromium.launch({ headless: true });
});
afterAll(async () => {
  await browser?.close();
});

const editor = '<div contenteditable="true" role="textbox"><p><br></p></div>';
const fixtures = {
  'legacy-shell-v1': `<div><aside class="app-shell-left-panel"><nav></nav></aside><div>${editor}</div></div>`,
  'semantic-shell-v1': `<div><aside class="app-shell-left-panel"><nav data-app-navigation-rail></nav><nav></nav></aside><main data-app-shell-main-surface>${editor}</main></div>`,
  'workspace-shell-v1': `<div data-app-shell-workspace-row><aside class="app-shell-left-panel"><nav data-app-navigation-rail></nav><nav></nav></aside><section data-app-shell-header-placement><header data-app-shell-titlebar>Thread tools</header><main data-app-shell-main-surface>${editor}</main></section></div>`,
  'active-page-shell-v1': `<div data-app-shell-workspace-row><div aria-hidden="true" style="position:absolute;pointer-events:none"></div><aside class="app-shell-left-panel"><nav data-app-navigation-rail></nav><nav></nav></aside><div data-app-shell-active-page style="display:contents"><div data-app-shell-header-placement style="display:contents"><header data-app-shell-titlebar style="position:fixed">Thread tools</header><main data-app-shell-main-surface>${editor}</main></div></div></div>`,
};

// Observed on the isolated 26.1021 host after opening an existing conversation:
// retained pages are direct workspace siblings; only their inner placement is
// display:none. The outer display:contents node itself has no layout rectangle.
const activePage = (active: boolean, draft = '') =>
  `<div data-app-shell-active-page="${active}" style="display:contents"><div data-app-shell-header-placement style="display:${active ? 'contents' : 'none'}"><header data-app-shell-titlebar>Thread tools</header><main data-app-shell-main-surface><div contenteditable="true" role="textbox"><p>${draft || '<br>'}</p></div></main></div></div>`;
const cachedFixture = (cachedDraft = '') =>
  `<div data-app-shell-workspace-row><div aria-hidden="true" style="position:absolute;pointer-events:none"></div><aside class="app-shell-left-panel"><nav data-app-navigation-rail></nav><nav></nav></aside>${activePage(false, cachedDraft)}${activePage(true)}</div>`;

describe('read-only Codex structure contracts', () => {
  it.each([
    ['single explicit active page', cachedFixture().replace(activePage(false), ''), false],
    ['retained inactive page', cachedFixture(), false],
    ['retained unsent draft', cachedFixture('private retained draft'), true],
    ['retained rich draft without text', cachedFixture('<img alt="">'), true],
    ['retained whitespace draft', cachedFixture(' '), true],
  ])('recognizes %s and protects all cached drafts', async (_name, html, hasDraft) => {
    const page = await browser.newPage();
    try {
      await page.setContent(html);
      const before = await page.content();
      const result = await page.evaluate(inspectCodexStructureScript('about:blank'));
      expect(result).toMatchObject({
        status: 'matched', contracts: ['active-page-cache-shell-v1'], hasDraft,
      });
      expect(JSON.stringify(result)).not.toContain('private retained draft');
      expect(await page.content()).toBe(before);
    } finally { await page.close(); }
  });

  it('reports only the observed empty active editor as loading, without granting readiness', async () => {
    const page = await browser.newPage();
    try {
      const html = cachedFixture().replace(activePage(true), activePage(true).replace(/<div contenteditable[\s\S]*?<\/div>/, ''));
      await page.setContent(html);
      expect(await page.evaluate(inspectCodexStructureScript('about:blank'))).toMatchObject({
        status: 'loading', contracts: ['active-page-cache-shell-v1'], hasDraft: false,
      });
      await page.locator('[data-app-shell-workspace-row]').evaluate(root => root.append(document.createElement('section')));
      expect(await page.evaluate(inspectCodexStructureScript('about:blank'))).not.toMatchObject({ status: 'loading' });
    } finally { await page.close(); }
  });

  it('rejects a loading report for a contract without a verified loading state', () => {
    expect(() => parseStructureObservation({ status: 'loading', contracts: ['legacy-shell-v1'],
      documentId: 1, hasDraft: false, modal: false })).toThrow();
  });

  it.each([
    ['two active pages', cachedFixture().replace('active-page="false"', 'active-page="true"')],
    ['unmarked inactive page', cachedFixture().replace('active-page="false"', 'active-page="unknown"')],
    ['visible cached placement', cachedFixture().replace('display:none', 'display:contents')],
    ['nested unknown page content', cachedFixture().replace('display:contents"><div', 'display:contents"><section></section><div')],
    ['editor outside pages', cachedFixture() + editor],
    ['duplicate current editor', cachedFixture().replace(activePage(true), activePage(true).replace('</main>', editor + '</main>'))],
    ['missing cached editor', cachedFixture().replace(activePage(false), activePage(false).replace(/<div contenteditable[\s\S]*?<\/div>/, ''))],
    ['cached view outside workspace', cachedFixture() + activePage(false)],
    ['unknown workspace sibling', cachedFixture().replace('</aside>', '</aside><section></section>')],
  ])('refuses unsafe cached layout: %s', async (_name, html) => {
    const page = await browser.newPage();
    try {
      await page.setContent(html);
      expect(await page.evaluate(inspectCodexStructureScript('about:blank'))).not.toMatchObject({ status: 'matched' });
    } finally { await page.close(); }
  });

  it.each(Object.entries(fixtures))(
    'uniquely recognizes %s without reading or changing drafts',
    async (id, html) => {
      const page = await browser.newPage();
      try {
        await page.setContent(html.replace('<p><br></p>', '<p>private unsent draft</p>'));
        const before = await page.content();
        const result = await page.evaluate(inspectCodexStructureScript('about:blank'));
        expect(result).toMatchObject({
          status: 'matched',
          contracts: [id],
          hasDraft: true,
          modal: false,
        });
        expect(JSON.stringify(result)).not.toContain('private unsent draft');
        expect(await page.content()).toBe(before);
      } finally {
        await page.close();
      }
    },
  );

  it.each([
    ['missing editor', fixtures['workspace-shell-v1'].replace(editor, '')],
    [
      'toolbar outside boundary',
      fixtures['semantic-shell-v1'].replace(
        '<main ',
        '<header data-app-shell-titlebar></header><main ',
      ),
    ],
    [
      'unknown sibling',
      fixtures['legacy-shell-v1'].replace('</aside>', '</aside><section>unknown overlay</section>'),
    ],
    [
      'sidebar inside workspace',
      `<div data-app-shell-workspace-row><section data-app-shell-header-placement><aside class="app-shell-left-panel"><nav data-app-navigation-rail></nav><nav></nav></aside><main data-app-shell-main-surface>${editor}</main></section></div>`,
    ],
    [
      'wrong workspace parent',
      `<div>${fixtures['workspace-shell-v1'].replace('data-app-shell-workspace-row', '')}</div>`,
    ],
    [
      'interactive backdrop',
      fixtures['active-page-shell-v1'].replace('pointer-events:none', 'pointer-events:auto'),
    ],
    [
      'unknown active-page sibling',
      fixtures['active-page-shell-v1'].replace(
        '<div data-app-shell-header-placement',
        '<section></section><div data-app-shell-header-placement',
      ),
    ],
    [
      'visible status overlay',
      fixtures['legacy-shell-v1'].replace(
        '</aside>',
        '</aside><section role="status" style="position:fixed;width:200px;height:200px"></section>',
      ),
    ],
  ])('refuses %s', async (_name, html) => {
    const page = await browser.newPage();
    try {
      await page.setContent(html);
      expect(await page.evaluate(inspectCodexStructureScript('about:blank'))).toMatchObject({
        status: 'missing',
      });
    } finally {
      await page.close();
    }
  });

  it('refuses duplicate shells and never guesses between them', async () => {
    const page = await browser.newPage();
    try {
      await page.setContent(fixtures['legacy-shell-v1'].repeat(2));
      expect(await page.evaluate(inspectCodexStructureScript('about:blank'))).toMatchObject({
        status: 'ambiguous',
      });
      expect(await page.evaluate(inspectCodexStructureScript('app://-/index.html'))).toMatchObject({
        status: 'target-mismatch',
      });
    } finally {
      await page.close();
    }
  });
});
