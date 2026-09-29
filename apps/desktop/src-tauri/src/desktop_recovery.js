(() => {
  if (location.hostname !== 'tauri.localhost' || document.readyState !== 'complete') return;
  const marker = 'tb:desktop-shell-reload:__TASKBOARD_BOOT_NONCE__';
  const root = document.getElementById('root');
  if (root && root.childElementCount > 0) {
    sessionStorage.removeItem(marker);
    return;
  }
  if (sessionStorage.getItem(marker) === '1') return;
  sessionStorage.setItem(marker, '1');
  location.reload();
})();
