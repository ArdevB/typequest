import Link from "next/link";

/** Shown on account-backed pages when no Supabase project is connected. */
export function NotConfigured({ what }: { what: string }) {
  return (
    <div className="tq-card mx-auto my-16 max-w-md text-center">
      <h1 className="font-display text-2xl font-bold text-text">{what} need accounts</h1>
      <p className="mt-3 text-sm text-sub">
        This copy of TypeQuest isn&apos;t connected to a Supabase project yet, so it runs in guest mode.
      </p>
      <p className="mt-2 text-xs text-sub">
        Setup: copy <code>.env.example</code> to <code>.env.local</code>, add your keys, run the SQL in{" "}
        <code>supabase/migrations</code>, and restart.
      </p>
      <Link href="/test" className="tq-btn tq-btn-primary mt-5">
        Keep typing
      </Link>
    </div>
  );
}
