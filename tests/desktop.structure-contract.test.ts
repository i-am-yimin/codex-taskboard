import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser } from '@playwright/test';
import { inspectCodexStructureScript } from '../packages/adapter-codex/src/structure-contracts.ts';

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

describe('read-only Codex structure contracts', () => {
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
