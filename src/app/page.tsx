import Link from "next/link";
import { Mascot } from "@/components/mascot/Mascot";

const PATH = [
  { step: "01", title: "Learn", body: "Home row first. A color-coded keyboard and animated hands show which finger goes where.", href: "/learn" },
  { step: "02", title: "Practice", body: "Drills built from your weakest keys, with a heatmap of where the mistakes happen.", href: "/practice" },
  { step: "03", title: "Speed test", body: "15 to 120 seconds or 10 to 100 words. Live WPM, a consistency graph and an S–C grade.", href: "/test" },
  { step: "04", title: "Play", body: "Blast falling words, fight a boss, race your own ghost, or win a stick-figure fight scene.", href: "/play" },
  { step: "05", title: "Challenges", body: "A daily text everyone types, skill trials with three tiers, and a streak to protect.", href: "/challenges" },
] as const;

const EXTRAS = [
  { title: "Weekly Boss", body: "One boss, one set of words for everyone, a new twist every Monday. Beat it for the Inferno theme.", href: "/play/weekly-boss" },
  { title: "Chaos", body: "Mirror text, fog, backwards words, sudden death. Stack them up and multiply your score.", href: "/chaos" },
  { title: "Race a friend", body: "Finish a race and send the link: your friend races your ghost on the exact same words.", href: "/play/racing" },
] as const;

export default function Home() {
  return (
    <div className="mx-auto w-full max-w-5xl">
      <section className="flex flex-col items-center py-14 text-center sm:py-20">
        <div className="mb-6">
          <Mascot engine={null} mood="idle" size={84} tip="Hi, I'm Keeby! I'll be watching your keys." />
        </div>
        <p className="mb-5 font-mono text-sm text-sub">
          from <span className="text-text">asdf jkl;</span> to <span className="text-main">120 wpm</span>
        </p>
        <h1 className="font-display text-4xl font-black leading-tight tracking-wide text-text sm:text-6xl">
          Type like it&apos;s a <span className="tq-glow text-main">game.</span>
        </h1>
        <p className="mt-5 max-w-xl text-lg text-sub">
          TypeQuest takes you from learning hand placement to high-speed tests, with combos, sounds and challenges that make
          practice something you&apos;ll come back to.
        </p>
        <div className="tq-demo mt-10 font-mono text-xl sm:text-2xl" aria-hidden="true">
          <span className="tq-demo-typed">the quick brown fox</span>
          <span className="tq-demo-rest"> jumps over the lazy dog</span>
        </div>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link href="/learn" className="tq-btn tq-btn-primary text-lg">
            Learn from scratch →
          </Link>
          <Link href="/test" className="tq-btn text-lg">
            Take a speed test
          </Link>
          <Link href="/play" className="tq-btn text-lg">
            Play a game
          </Link>
        </div>
        <p className="mt-3 text-sm text-sub">No account needed. Your records save in this browser.</p>
      </section>

      <section aria-labelledby="path-title" className="pb-10">
        <h2 id="path-title" className="mb-6 font-display text-sm uppercase tracking-[0.25em] text-sub">
          Your path
        </h2>
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {PATH.map((p) => (
            <li key={p.step}>
              <Link href={p.href} className="tq-card tq-path-card group block h-full">
                <span className="mb-3 block font-mono text-sm text-main">{p.step}</span>
                <h3 className="mb-1 font-display text-lg font-bold text-text group-hover:text-main">{p.title}</h3>
                <p className="text-sm leading-relaxed text-sub">{p.body}</p>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="extras-title" className="pb-14">
        <h2 id="extras-title" className="mb-6 font-display text-sm uppercase tracking-[0.25em] text-sub">
          When you want a fight
        </h2>
        <ul className="grid gap-4 sm:grid-cols-3">
          {EXTRAS.map((x) => (
            <li key={x.title}>
              <Link href={x.href} className="tq-card tq-path-card group block h-full">
                <h3 className="mb-1 font-display text-lg font-bold text-text group-hover:text-main">{x.title}</h3>
                <p className="text-sm leading-relaxed text-sub">{x.body}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
