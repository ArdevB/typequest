import { ACHIEVEMENTS, type AchievementCategory } from "@/achievements/catalog";

const ICONS: Record<AchievementCategory, string> = {
  speed: "⚡",
  accuracy: "🎯",
  combo: "🔗",
  learn: "🎓",
  dedication: "🔥",
  challenge: "🏆",
  fun: "✨",
};

/** All achievements; unlocked ones lit, hidden locked ones shown as "???". */
export function AchievementGrid({ owned }: { owned: ReadonlyMap<string, string> }) {
  const count = ACHIEVEMENTS.filter((a) => owned.has(a.id)).length;
  return (
    <section aria-labelledby="ach-title">
      <h2 id="ach-title" className="mb-3 font-display text-lg font-bold text-text">
        Achievements <span className="font-mono text-sm text-sub">{count}/{ACHIEVEMENTS.length}</span>
      </h2>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {ACHIEVEMENTS.map((a) => {
          const at = owned.get(a.id);
          const secret = a.hidden && !at;
          return (
            <li key={a.id} className="tq-ach" data-owned={Boolean(at)}>
              <span className="tq-ach-icon" aria-hidden="true">
                {secret ? "?" : ICONS[a.category]}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-text">{secret ? "???" : a.name}</p>
                <p className="text-xs text-sub">{secret ? "Hidden achievement" : a.description}</p>
                <p className="mt-0.5 text-[11px] text-sub">
                  {at ? `Unlocked ${new Date(at).toLocaleDateString()}` : `+${a.xp} XP`}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
