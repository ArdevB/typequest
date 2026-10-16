import type { Metadata } from "next";
import { ChaosView } from "@/components/chaos/ChaosView";

export const metadata: Metadata = {
  title: "Chaos",
  description: "Stack chaos modifiers — mirror, fog, backwards words, sudden death — and see how high your score multiplier can go.",
};

export default function ChaosPage() {
  return <ChaosView />;
}
