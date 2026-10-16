import type { Metadata } from "next";
import { LessonPath } from "@/components/learn/LessonPath";

export const metadata: Metadata = {
  title: "Learn to type",
  description:
    "A step-by-step touch typing course: home row, top row, bottom row, numbers, symbols and full sentences, with a guide keyboard and animated hands.",
};

export default function LearnPage() {
  return <LessonPath />;
}
