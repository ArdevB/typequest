import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SkillChallengeView } from "@/components/challenges/SkillChallengeView";
import { SKILLS, getSkill } from "@/challenges/skills";

interface Params {
  params: Promise<{ skillId: string }>;
}

export const dynamicParams = false;

export function generateStaticParams() {
  return SKILLS.map((s) => ({ skillId: s.id }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const skill = getSkill((await params).skillId);
  return skill ? { title: `${skill.name} challenge`, description: skill.tagline } : {};
}

export default async function SkillPage({ params }: Params) {
  const { skillId } = await params;
  const skill = getSkill(skillId);
  if (!skill) notFound();
  return (
    <div className="flex flex-1 flex-col justify-center py-6">
      <SkillChallengeView key={skill.id} skillId={skill.id} />
    </div>
  );
}
