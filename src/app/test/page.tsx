import type { Metadata } from "next";
import { SpeedTest } from "@/components/typing/SpeedTest";

export const metadata: Metadata = {
  title: "Typing speed test",
  description: "Timed (15–120s) and word-count typing tests with live WPM, accuracy, consistency graph and grades.",
};

export default function TestPage() {
  return (
    <>
      <h1 className="sr-only">Typing speed test</h1>
      <SpeedTest />
    </>
  );
}
