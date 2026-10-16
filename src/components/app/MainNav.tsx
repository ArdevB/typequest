"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export const NAV = [
  { href: "/test", label: "test" },
  { href: "/learn", label: "learn" },
  { href: "/practice", label: "practice" },
  { href: "/challenges", label: "challenges" },
  { href: "/play", label: "play" },
  { href: "/chaos", label: "chaos" },
  { href: "/leaderboard", label: "leaderboard" },
] as const;

const isActive = (path: string, href: string) => path === href || path.startsWith(`${href}/`);

export function MainNav() {
  const path = usePathname();
  return (
    <nav className="hidden items-center gap-4 text-sm lg:flex" aria-label="Main">
      {NAV.map((n) => (
        <Link key={n.href} href={n.href} aria-current={isActive(path, n.href) ? "page" : undefined} className="tq-nav-link">
          {n.label}
        </Link>
      ))}
    </nav>
  );
}

/** Menu button for narrow screens. */
export function MobileNav() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative lg:hidden">
      <button
        type="button"
        className="grid h-9 w-9 place-items-center rounded-lg text-sub hover:text-text"
        aria-label="Menu"
        aria-expanded={open}
        aria-controls="mobile-nav"
        onClick={() => setOpen((o) => !o)}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
          <path d={open ? "M5 5 L15 15 M15 5 L5 15" : "M3 6 H17 M3 10 H17 M3 14 H17"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <nav id="mobile-nav" aria-label="Main" className="absolute right-0 top-11 z-40 flex w-48 flex-col rounded-xl border border-border bg-surface p-2 shadow-xl">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={isActive(path, n.href) ? "page" : undefined}
              className="rounded-md px-3 py-2 text-text hover:bg-main/10 aria-[current=page]:text-main"
            >
              {n.label}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
