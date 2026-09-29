export function watchDesktopParent(
  pidText: string | undefined,
  onExit: () => void,
  intervalMs = 1000,
) {
  const pid = Number(pidText);
  if (process.platform !== 'win32' || !Number.isSafeInteger(pid) || pid <= 0) return;
  // A launcher crash bypasses Tauri's normal shutdown callback. The packaged
  // companion must release its loopback port even when that callback never runs.
  const timer = setInterval(() => {
    try {
      process.kill(pid, 0);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ESRCH') return;
      clearInterval(timer);
      onExit();
    }
  }, intervalMs);
  timer.unref();
}
