/** Finite, version-independent DOM contracts. Changing these requires new
 * fixtures and isolated host evidence; a version number never selects one. */
export const CODEX_CONTRACT_REVISION = 1;
export const CODEX_STRUCTURE_CONTRACTS = [
  {
    id: 'legacy-shell-v1',
    shellMarker: 'div:has(>aside.app-shell-left-panel)',
    sidebarMarker: '.app-shell-left-panel nav',
    contentMarker: '.app-shell-left-panel + div',
  },
  {
    id: 'semantic-shell-v1',
    shellMarker: 'div:has(>aside.app-shell-left-panel)',
    sidebarMarker: '.app-shell-left-panel nav:not([data-app-navigation-rail])',
    contentMarker: 'main[data-app-shell-main-surface]',
  },
  {
    id: 'workspace-shell-v1',
    shellMarker: 'div[data-app-shell-workspace-row]:has(>aside.app-shell-left-panel)',
    sidebarMarker: '.app-shell-left-panel nav:not([data-app-navigation-rail])',
    contentMarker: 'main[data-app-shell-main-surface]',
    workspaceMarker: '[data-app-shell-workspace-row] > [data-app-shell-header-placement]',
  },
  {
    id: 'active-page-shell-v1',
    shellMarker: 'div[data-app-shell-workspace-row]:has(>aside.app-shell-left-panel)',
    sidebarMarker: '.app-shell-left-panel nav:not([data-app-navigation-rail])',
    contentMarker: 'main[data-app-shell-main-surface]',
    workspaceMarker: '[data-app-shell-workspace-row] > [data-app-shell-active-page]',
  },
] as const;

export type CodexStructureContract = (typeof CODEX_STRUCTURE_CONTRACTS)[number];
export interface StructureObservation {
  status: 'matched' | 'missing' | 'ambiguous' | 'target-mismatch';
  contracts: string[];
  documentId: number;
  hasDraft: boolean;
  modal: boolean;
}

/** This expression only returns structural facts and boolean draft/dialog
 * guards. Never return content, project names, or arbitrary page metadata. */
export function inspectCodexStructureScript(exactPageUrl: string): string {
  return `(() => {
    const result = { status: 'missing', contracts: [], documentId: performance.timeOrigin,
      hasDraft: false, modal: Boolean(document.querySelector('[role="dialog"],[aria-modal="true"]')) };
    if (location.href !== ${JSON.stringify(exactPageUrl)}) return { ...result, status: 'target-mismatch' };
    const roots = document.querySelectorAll('div:has(>aside.app-shell-left-panel)');
    const editors = document.querySelectorAll('[contenteditable="true"][role="textbox"]');
    if (roots.length > 1 || editors.length > 1) return { ...result, status: 'ambiguous' };
    if (roots.length !== 1 || editors.length !== 1) return result;
    result.hasDraft = Boolean((editors[0].textContent ?? '').trim());
    const one = selector => { const nodes = document.querySelectorAll(selector); return nodes.length === 1 ? nodes[0] : null; };
    for (const spec of ${JSON.stringify(CODEX_STRUCTURE_CONTRACTS)}) {
      const root = one(spec.shellMarker), sidebar = one(spec.sidebarMarker), content = one(spec.contentMarker);
      const workspace = spec.workspaceMarker ? one(spec.workspaceMarker) : content;
      const aside = root && root.querySelector(':scope > aside.app-shell-left-panel');
      if (!root || !aside || !sidebar || !content || !workspace || !aside.contains(sidebar)
        || sidebar === aside || workspace === root || workspace.parentElement !== root
        || !workspace.contains(content) || !workspace.contains(editors[0]) || workspace.contains(aside)) continue;
      // Never interpret a new wrapper/titlebar as an older, partial view.
      if (!spec.workspaceMarker && document.querySelector('[data-app-shell-workspace-row],[data-app-shell-header-placement]')) continue;
      if (spec.id === 'legacy-shell-v1' && document.querySelector('[data-app-shell-main-surface]')) continue;
      if (spec.id === 'active-page-shell-v1') {
        const placement = one('[data-app-shell-active-page] > [data-app-shell-header-placement]');
        if (!placement || workspace.children.length !== 1 || placement.parentElement !== workspace) continue;
      }
      if ([...root.querySelectorAll('header,[data-app-shell-titlebar]')].some(node => !workspace.contains(node) && !aside.contains(node))) continue;
      // Only the observed accessibility status sibling and our own nodes may
      // sit outside the complete native view and global navigation.
      const permittedSibling = node => {
        if (node.matches('[data-taskboard-owned],[data-taskboard-style]')) return true;
        // Observed active-page shell has one empty, noninteractive decorative
        // background outside the two views. Never accept an arbitrary overlay.
        if (spec.id === 'active-page-shell-v1' && node.matches('div[aria-hidden="true"]')
          && node.childNodes.length === 0 && !node.hasAttribute('tabindex')) {
          const style = getComputedStyle(node);
          return style.position === 'absolute' && style.pointerEvents === 'none';
        }
        if (!node.matches('[role="status"]')) return false;
        const rect = node.getBoundingClientRect(), style = getComputedStyle(node);
        return rect.width <= 1 && rect.height <= 1 && ['absolute','fixed'].includes(style.position);
      };
      if ([...root.children].some(node => node !== aside && node !== workspace && !permittedSibling(node))) continue;
      // More than the explicitly observed rail and project navigation is ambiguous.
      if (aside.querySelectorAll('nav').length !== (spec.id === 'legacy-shell-v1' ? 1 : 2)
        || (spec.id !== 'legacy-shell-v1' && aside.querySelectorAll('nav[data-app-navigation-rail]').length !== 1)) continue;
      result.contracts.push(spec.id);
    }
    result.status = result.contracts.length === 1 ? 'matched' : result.contracts.length > 1 ? 'ambiguous' : 'missing';
    return result;
  })()`;
}

export function parseStructureObservation(value: unknown): StructureObservation {
  if (!value || typeof value !== 'object') throw new Error('Invalid Codex structure observation');
  const item = value as Record<string, unknown>;
  if (
    !['matched', 'missing', 'ambiguous', 'target-mismatch'].includes(String(item.status)) ||
    !Array.isArray(item.contracts) ||
    !item.contracts.every((id) => CODEX_STRUCTURE_CONTRACTS.some((spec) => spec.id === id)) ||
    typeof item.documentId !== 'number' ||
    !Number.isFinite(item.documentId) ||
    typeof item.hasDraft !== 'boolean' ||
    typeof item.modal !== 'boolean' ||
    (item.status === 'matched' && item.contracts.length !== 1)
  )
    throw new Error('Invalid Codex structure observation');
  return item as unknown as StructureObservation;
}
