/** Personal-best celebration. canvas-confetti is loaded only when needed. */
export async function celebrate(colors: readonly string[]): Promise<void> {
  const { default: confetti } = await import("canvas-confetti");
  const base = { colors: [...colors], disableForReducedMotion: true, ticks: 220, zIndex: 60 };
  void confetti({ ...base, particleCount: 70, angle: 60, spread: 65, origin: { x: 0, y: 0.75 } });
  void confetti({ ...base, particleCount: 70, angle: 120, spread: 65, origin: { x: 1, y: 0.75 } });
  setTimeout(() => {
    void confetti({ ...base, particleCount: 90, spread: 100, startVelocity: 35, origin: { x: 0.5, y: 0.35 } });
  }, 250);
}
