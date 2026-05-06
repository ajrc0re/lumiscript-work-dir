const startedAt = Date.now();
const startedAtLabel = new Date(startedAt).toLocaleTimeString();

const tab = api.ui.registerDrawerTab({
  id:          'ls-persist-test',
  title:       'Persistence Test',
  shortName:   'Persist',
  description: 'Should survive browser refresh',
  keywords:    ['persist', 'refresh', 'test'],
  headerTitle: 'Refresh Persistence Test',
  iconSvg: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 12a9 9 0 1 1-3-6.7"/>
      <path d="M21 3v6h-6"/>
    </svg>
  `,
});

tab.setBadge('LIVE');

let activations = 0;
tab.onActivate(() => {
  activations++;
  console.log(`[persist-test] tab activated (${activations})`);
  tab.setBadge(String(activations));
});

function render() {
  const uptimeSec = Math.floor((Date.now() - startedAt) / 1000);
  tab.root.update(`
    <div style="padding: 16px; font-family: var(--lumiverse-font-mono, ui-monospace, monospace); color: var(--lumiverse-text); line-height: 1.6;">
      <h2 style="margin: 0 0 12px 0; font-size: 14px; letter-spacing: 0.05em; text-transform: uppercase; opacity: 0.7;">
        Drawer Tab Persistence
      </h2>
      <p style="margin: 4px 0;"><strong>Worker started:</strong> ${startedAtLabel}</p>
      <p style="margin: 4px 0;"><strong>Worker uptime:</strong> ${uptimeSec}s</p>
      <p style="margin: 4px 0;"><strong>Activations:</strong> ${activations}</p>
      <hr style="margin: 16px 0; border: none; border-top: 1px solid var(--lumiverse-border);">
      <p style="font-size: 12px; opacity: 0.75; margin: 0;">
        The <strong>uptime</strong> above keeps growing across a refresh.
        If you see a large number right after F5, the backend worker survived
        and replay restored this tab's body from the registry's lastHtml.
      </p>
      <p style="font-size: 12px; opacity: 0.75; margin: 8px 0 0 0;">
        Click the tab away and back to bump the activation counter —
        the counter, title, shortName, and icon should all persist across refresh.
      </p>
    </div>
  `);
}

render();
setInterval(render, 1000);
console.log('[persist-test] registered drawer tab "Persistence Test"');
