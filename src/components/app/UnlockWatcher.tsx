"use client";

import { useEffect } from "react";
import { useUnlocked } from "@/hooks/useUnlocks";
import { UNLOCKABLES } from "@/unlocks/catalog";
import { useHydrated } from "@/stores/hydration";
import { useSettings } from "@/stores/settingsStore";
import { toast } from "@/stores/toastStore";

/** Announces newly unlocked themes and mascot outfits, once each. */
export function UnlockWatcher() {
  const ready = useHydrated((s) => s.ready);
  const unlocked = useUnlocked();

  useEffect(() => {
    if (!ready) return;
    const { seenUnlocks, set } = useSettings.getState();
    const fresh = UNLOCKABLES.filter((u) => unlocked.has(u.id) && !seenUnlocks.includes(u.id));
    if (fresh.length === 0) return;
    set("seenUnlocks", [...seenUnlocks, ...fresh.map((u) => u.id)]);
    for (const u of fresh) {
      toast({ title: `Unlocked: ${u.name}`, body: u.kind === "theme" ? "Pick it in Settings → Theme." : "Dress Keeby up in Settings.", tone: "level" }, 6000);
    }
  }, [ready, unlocked]);

  return null;
}
