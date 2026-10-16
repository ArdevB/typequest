import type { Metadata } from "next";
import { PracticeView } from "@/components/practice/PracticeView";

export const metadata: Metadata = {
  title: "Practice",
  description: "Find your weakest keys on a heatmap and drill them with words built from your own mistakes.",
};

export default function PracticePage() {
  return <PracticeView />;
}
