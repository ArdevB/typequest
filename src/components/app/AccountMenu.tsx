"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LevelBadge } from "@/components/progress/RankBadge";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { useAuth } from "@/stores/authStore";

/** Header account control: "Sign in", or the player's level + name with a small menu. */
export function AccountMenu() {
  const status = useAuth((s) => s.status);
  const profile = useAuth((s) => s.profile);
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", esc);
    };
  }, [open]);

  useEffect(() => setOpen(false), [pathname]);

  if (status === "disabled") return null;
  if (status === "loading") return <span className="inline-block h-9 w-20" aria-hidden="true" />;
  if (status === "signedOut") {
    if (pathname === "/auth") return null;
    return (
      <Link href={`/auth?next=${encodeURIComponent(pathname)}`} className="tq-btn px-3 py-1.5 text-sm">
        Sign in
      </Link>
    );
  }

  const signOut = async () => {
    await getBrowserSupabase()?.auth.signOut();
    setOpen(false);
    router.refresh();
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm text-text transition hover:bg-bg-alt"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((o) => !o)}
      >
        <LevelBadge level={profile?.level ?? 1} size={26} />
        <span className="max-w-28 truncate">{profile?.username ?? "Account"}</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.14 }}
            className="absolute right-0 top-11 z-40 w-44 overflow-hidden rounded-xl border border-border bg-surface py-1 shadow-2xl"
          >
            {profile && (
              <Link role="menuitem" href={`/profile/${profile.username}`} className="block px-4 py-2 text-sm text-text hover:bg-bg-alt">
                Profile
              </Link>
            )}
            <Link role="menuitem" href="/leaderboard" className="block px-4 py-2 text-sm text-text hover:bg-bg-alt">
              Leaderboard
            </Link>
            <Link role="menuitem" href="/settings" className="block px-4 py-2 text-sm text-text hover:bg-bg-alt">
              Settings
            </Link>
            <button role="menuitem" type="button" onClick={signOut} className="block w-full px-4 py-2 text-left text-sm text-sub hover:bg-bg-alt hover:text-text">
              Sign out
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
