"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SettingsForm } from "@/components/ui/SettingsPanel";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { useAuth } from "@/stores/authStore";
import { toast } from "@/stores/toastStore";

const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;

export function SettingsPage() {
  return (
    <div className="mx-auto w-full max-w-xl space-y-6 py-4">
      <h1 className="font-display text-3xl font-bold text-text">Settings</h1>
      <AccountSection />
      <section className="tq-card" aria-labelledby="prefs-title">
        <h2 id="prefs-title" className="mb-4 font-display text-lg font-bold text-text">Preferences</h2>
        <SettingsForm />
      </section>
    </div>
  );
}

function AccountSection() {
  const { status, profile, email, set } = useAuth();
  const router = useRouter();
  const [name, setName] = useState(profile?.username ?? "");
  const [busy, setBusy] = useState(false);

  useEffect(() => setName(profile?.username ?? ""), [profile?.username]);

  if (status === "disabled" || status === "loading") return null;
  if (status === "signedOut") {
    return (
      <section className="tq-card flex items-center justify-between gap-3">
        <p className="text-sm text-sub">Sign in to save your progress across devices.</p>
        <Link href="/auth?next=/settings" className="tq-btn tq-btn-primary py-1.5 text-sm">
          Sign in
        </Link>
      </section>
    );
  }

  const supabase = getBrowserSupabase();
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !profile) return;
    if (!USERNAME_RE.test(name)) {
      toast({ title: "Usernames are 3–20 letters, numbers or _", tone: "error" });
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("profiles").update({ username: name }).eq("id", profile.id);
    setBusy(false);
    if (error) {
      toast({ title: error.code === "23505" ? "That username is taken" : "Couldn't change your username", body: error.code === "23505" ? undefined : error.message, tone: "error" });
      return;
    }
    set({ profile: { ...profile, username: name } });
    toast({ title: "Username updated", tone: "success" });
    router.refresh();
  };

  const signOut = async () => {
    await supabase?.auth.signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <section className="tq-card space-y-4" aria-labelledby="account-title">
      <h2 id="account-title" className="font-display text-lg font-bold text-text">Account</h2>
      <form onSubmit={save} className="flex items-end gap-2">
        <label className="flex-1">
          <span className="text-sm text-text">Username</span>
          <input className="tq-input-field" value={name} onChange={(e) => setName(e.target.value.trim())} maxLength={20} />
        </label>
        <button type="submit" className="tq-btn tq-btn-primary py-2 text-sm" disabled={busy || name === profile?.username}>
          Save
        </button>
      </form>
      <div className="flex items-center justify-between text-sm">
        <span className="text-sub">{email}</span>
        <button type="button" className="tq-btn py-1.5 text-sm" onClick={signOut}>
          Sign out
        </button>
      </div>
    </section>
  );
}
