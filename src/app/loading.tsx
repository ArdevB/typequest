/** Shown instantly while a page that needs server data (leaderboards, profiles, challenges) loads. */
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-5xl py-10" role="status" aria-label="Loading">
      <div className="tq-loading-bar" aria-hidden="true" />
      <div className="mt-8 space-y-4" aria-hidden="true">
        <div className="tq-skel h-9 w-56" />
        <div className="tq-skel h-4 w-80 max-w-full" />
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="tq-skel h-28" />
          <div className="tq-skel h-28" />
          <div className="tq-skel h-28" />
          <div className="tq-skel h-28" />
        </div>
      </div>
    </div>
  );
}
