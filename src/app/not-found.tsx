import Link from "next/link";
import { Mascot } from "@/components/mascot/Mascot";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-lg flex-1 flex-col items-center justify-center py-16 text-center">
      <Mascot engine={null} mood="sad" size={110} />
      <p className="mt-6 font-mono text-sm text-sub">404</p>
      <h1 className="mt-1 font-display text-3xl font-black text-text">This page took a typo.</h1>
      <p className="mt-3 text-sub">Keeby looked everywhere. Whatever was here isn&apos;t anymore — or never was.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/" className="tq-btn tq-btn-primary">
          Home
        </Link>
        <Link href="/test" className="tq-btn">
          Take a speed test
        </Link>
      </div>
    </div>
  );
}
