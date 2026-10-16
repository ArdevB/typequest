import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LessonRunner } from "@/components/learn/LessonRunner";
import { LESSONS, getLesson, getUnit } from "@/lessons/catalog";

interface Params {
  params: Promise<{ lessonId: string }>;
}

export const dynamicParams = false;

export function generateStaticParams() {
  return LESSONS.map((l) => ({ lessonId: l.id }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const lesson = getLesson((await params).lessonId);
  if (!lesson) return {};
  return {
    title: `${lesson.title} · ${getUnit(lesson.unit).title} lesson`,
    description: lesson.intro,
  };
}

export default async function LessonPage({ params }: Params) {
  const { lessonId } = await params;
  if (!getLesson(lessonId)) notFound();
  // key: a fresh runner (intro screen) for every lesson, even on client-side navigation.
  return <LessonRunner key={lessonId} lessonId={lessonId} />;
}
