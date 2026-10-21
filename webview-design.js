'use strict';

const ICONS={
  activity:'<path d="M3 12h4l2-6 4 12 2-6h6"/>',
  bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
  bot:'<rect x="4" y="6" width="16" height="13" rx="2"/><path d="M9 10h.01M15 10h.01M9 15h6M12 2v4"/>',
  chart:'<path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  copy:'<rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
  dashboard:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  down:'<path d="m6 9 6 6 6-6"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  settings:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/>',
  sparkles:'<path d="m12 3 1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2ZM5 14l.8 2.2L8 17l-2.2.8L5 20l-.8-2.2L2 17l2.2-.8ZM19 13l.8 2.2L22 16l-2.2.8L19 19l-.8-2.2L16 16l2.2-.8Z"/>',
  stop:'<rect x="6" y="6" width="12" height="12" rx="2"/>'
};
function icon(name,label=''){const body=ICONS[name]||ICONS.activity;return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>${label?`<span>${label}</span>`:''}`;}

const baseCss=`
:root{color-scheme:light dark;--ap-space-1:4px;--ap-space-2:8px;--ap-space-3:12px;--ap-space-4:16px;--ap-space-5:24px;--ap-radius-sm:5px;--ap-radius:8px;--ap-radius-lg:12px;--ap-border:var(--vscode-panel-border,rgba(127,127,127,.28));--ap-surface:var(--vscode-sideBar-background,var(--vscode-editor-background));--ap-surface-raised:var(--vscode-editorWidget-background,var(--ap-surface));--ap-muted:var(--vscode-descriptionForeground);--ap-accent:var(--vscode-focusBorder,var(--vscode-textLink-foreground));--ap-good:var(--vscode-testing-iconPassed,#2ea043);--ap-warn:var(--vscode-editorWarning-foreground,#d29922);--ap-bad:var(--vscode-testing-iconFailed,#f85149);--ap-shadow:0 4px 18px rgba(0,0,0,.12)}
*{box-sizing:border-box}body{font-family:var(--vscode-font-family);font-size:var(--vscode-font-size);color:var(--vscode-foreground);background:var(--vscode-editor-background);margin:0}button,input,textarea,select{font:inherit}button{cursor:pointer}button:focus-visible,input:focus-visible,textarea:focus-visible,select:focus-visible,[tabindex]:focus-visible{outline:2px solid var(--vscode-focusBorder);outline-offset:2px}.icon{width:16px;height:16px;display:inline-block;flex:0 0 auto}.muted{color:var(--ap-muted)}.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}.pill{display:inline-flex;align-items:center;gap:5px;padding:2px 7px;border:1px solid var(--ap-border);border-radius:999px;background:var(--vscode-badge-background);color:var(--vscode-badge-foreground);font-size:11px}.status-dot{width:7px;height:7px;border-radius:50%;background:var(--ap-muted)}.status-dot.completed,.status-dot.sent,.status-dot.ready{background:var(--ap-good)}.status-dot.running,.status-dot.waiting,.status-dot.pending,.status-dot.sending{background:var(--ap-warn)}.status-dot.failed,.status-dot.uncertain{background:var(--ap-bad)}
@media(prefers-reduced-motion:reduce){*,*::before,*::after{scroll-behavior:auto!important;animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}}
@media(forced-colors:active){.pill,.card,.panel{border:1px solid CanvasText}.status-dot{forced-color-adjust:none}}
`;

module.exports={baseCss,icon};
