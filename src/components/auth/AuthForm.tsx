"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { GOOGLE_AUTH_ENABLED } from "@/lib/supabase/env";
import { useAuth } from "@/stores/authStore";

type Mode = "signin" | "signup";
type NameState = "idle" | "checking" | "free" | "taken" | "invalid";

const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;

/** Only allow same-site relative redirects after sign-in. */
function safeNext(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export function AuthForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const status = useAuth((s) => s.status);
  const supabase = getBrowserSupabase();

  const [mode, setMode] = useState<Mode>(params.get("mode") === "signup" ? "signup" : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [nameState, setNameState] = useState<NameState>("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(params.get("error"));
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (status === "signedIn") router.replace(next);
  }, [status, next, router]);

  // Live username availability check (debounced).
  useEffect(() => {
    if (mode !== "signup" || !supabase) return;
    if (!username) {
      setNameState("idle");
      return;
    }
    if (!USERNAME_RE.test(username)) {
      setNameState("invalid");
      return;
    }
    setNameState("checking");
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc("username_available", { p_username: username });
      setNameState(data === true ? "free" : "taken");
    }, 350);
    return () => clearTimeout(t);
  }, [username, mode, supabase]);

  if (!supabase) {
    return (
      <div className="tq-card mx-auto max-w-md text-center">
        <h1 className="font-display text-2xl font-bold text-text">Accounts aren&apos;t set up yet</h1>
        <p className="mt-3 text-sm text-sub">
          This copy of TypeQuest has no Supabase project connected, so it runs in guest mode. Your runs and lessons are still
          saved in this browser and will upload when accounts are switched on.
        </p>
        <p className="mt-3 text-xs text-sub">
          Setup: copy <code>.env.example</code> to <code>.env.local</code>, add your Supabase keys and restart.
        </p>
        <Link href="/test" className="tq-btn tq-btn-primary mt-5">
          Keep typing
        </Link>
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
        router.replace(next);
        router.refresh();
      } else {
        if (nameState !== "free") throw new Error("Pick an available username first.");
        const { data, error: err } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { username },
            emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
          },
        });
        if (err) throw err;
        if (data.session) {
          router.replace(next);
          router.refresh();
        } else {
          setNotice(`Almost done! We sent a confirmation link to ${email}. Open it to finish signing up.`);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setError(null);
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (err) setError(err.message);
  };

  const nameHint: Record<NameState, string> = {
    idle: "3–20 letters, numbers or _",
    checking: "Checking…",
    free: "Available!",
    taken: "Already taken",
    invalid: "3–20 letters, numbers or _",
  };

  return (
    <div className="mx-auto w-full max-w-sm">
      <h1 className="text-center font-display text-3xl font-bold text-text">
        {mode === "signin" ? "Welcome back" : "Create your account"}
      </h1>
      <p className="mt-2 text-center text-sm text-sub">
        Save every run, earn XP and levels, and get on the leaderboard. Progress you made as a guest comes with you.
      </p>

      <div className="mt-6 grid grid-cols-2 rounded-lg bg-bg-alt p-1 text-sm" role="tablist">
        {(["signin", "signup"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => {
              setMode(m);
              setError(null);
              setNotice(null);
            }}
            className="rounded-md py-1.5 text-sub transition aria-selected:bg-surface aria-selected:text-text"
          >
            {m === "signin" ? "Sign in" : "Sign up"}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="mt-5 space-y-3">
        {mode === "signup" && (
          <label className="block">
            <span className="text-sm text-text">Username</span>
            <input
              className="tq-input-field"
              value={username}
              onChange={(e) => setUsername(e.target.value.trim())}
              autoComplete="username"
              maxLength={20}
              required
              aria-describedby="username-hint"
            />
            <span id="username-hint" className="tq-hint mt-1 block text-xs" data-state={nameState}>
              {nameHint[nameState]}
            </span>
          </label>
        )}
        <label className="block">
          <span className="text-sm text-text">Email</span>
          <input className="tq-input-field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        </label>
        <label className="block">
          <span className="text-sm text-text">Password</span>
          <input
            className="tq-input-field"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            minLength={8}
            required
          />
          {mode === "signup" && <span className="mt-1 block text-xs text-sub">At least 8 characters</span>}
        </label>

        {error && (
          <p className="rounded-lg border border-error/50 px-3 py-2 text-sm text-error" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="rounded-lg border border-main/50 px-3 py-2 text-sm text-text" role="status">
            {notice}
          </p>
        )}

        <button type="submit" className="tq-btn tq-btn-primary w-full justify-center" disabled={busy}>
          {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
        </button>
      </form>

      {GOOGLE_AUTH_ENABLED && (
        <>
          <div className="my-4 flex items-center gap-3 text-xs text-sub">
            <span className="h-px flex-1 bg-border" />
            or
            <span className="h-px flex-1 bg-border" />
          </div>
          <button type="button" className="tq-btn w-full justify-center" onClick={google}>
            Continue with Google
          </button>
        </>
      )}

      <p className="mt-6 text-center text-xs text-sub">
        Just want to type? <Link href="/test" className="text-main hover:underline">Play as a guest</Link>
      </p>
    </div>
  );
}
