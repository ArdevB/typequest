import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth/AuthForm";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in or create a TypeQuest account to save runs, earn XP and join the leaderboard.",
  robots: { index: false },
};

export default function AuthPage() {
  return (
    <div className="flex flex-1 items-center justify-center py-10">
      <Suspense>
        <AuthForm />
      </Suspense>
    </div>
  );
}
