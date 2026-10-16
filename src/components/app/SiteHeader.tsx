import Link from "next/link";
import { SettingsPanel } from "@/components/ui/SettingsPanel";
import { AccountMenu } from "./AccountMenu";
import { MainNav, MobileNav } from "./MainNav";

export function SiteHeader() {
  return (
    <header className="tq-chrome mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-5 sm:px-6">
      <Link href="/" className="group flex items-center gap-2.5" aria-label="TypeQuest home">
        <Logo />
        <span className="font-display text-xl font-bold tracking-wide text-text">
          Type<span className="text-main">Quest</span>
        </span>
      </Link>
      <MainNav />
      <div className="flex items-center gap-1">
        <MobileNav />
        <SettingsPanel />
        <AccountMenu />
      </div>
    </header>
  );
}

function Logo() {
  return (
    <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true" className="transition-transform group-hover:-rotate-6">
      <rect x="2" y="6" width="28" height="20" rx="5" fill="none" stroke="var(--main)" strokeWidth="2.5" />
      <rect x="7" y="11" width="4" height="4" rx="1" fill="var(--sub)" />
      <rect x="14" y="11" width="4" height="4" rx="1" fill="var(--caret)" />
      <rect x="21" y="11" width="4" height="4" rx="1" fill="var(--sub)" />
      <rect x="9" y="18" width="14" height="3" rx="1.5" fill="var(--main)" />
    </svg>
  );
}
