import type { SVGProps } from 'react';
import './brand.css';

/** Original relay-card mark. Name the containing control when used as an action. */
export function TaskboardMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" focusable="false" {...props}>
      <path
        d="M6 4h13a3 3 0 0 1 3 3v3h-4V8H7v14h4v4H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3Z"
        fill="currentColor"
      />
      <path
        d="M13 6v4h12v14H14v-3h-4v4a3 3 0 0 0 3 3h13a3 3 0 0 0 3-3V9a3 3 0 0 0-3-3H13Z"
        fill="currentColor"
      />
      <path d="m12 13 7 3-7 3v-6Z" fill="currentColor" />
    </svg>
  );
}

export function TaskboardBrand({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`taskboard-brand${compact ? ' taskboard-brand--compact' : ''}`}>
      <TaskboardMark className="taskboard-brand__mark" />
      <span className="taskboard-brand__name">Codex Taskboard</span>
    </span>
  );
}
