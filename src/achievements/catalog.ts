/**
 * Achievement definitions. The ids, names and XP are mirrored in the
 * `achievements` table (supabase/migrations/20261016020000_challenges.sql);
 * a unit test keeps the two in sync. Unlock rules live in ./check.ts.
 */

export type AchievementCategory = "speed" | "accuracy" | "combo" | "learn" | "dedication" | "challenge" | "fun";

export interface Achievement {
  id: string;
  name: string;
  description: string;
  category: AchievementCategory;
  /** Hidden achievements show as "???" until unlocked. */
  hidden: boolean;
  xp: number;
}

const a = (
  id: string,
  name: string,
  description: string,
  category: AchievementCategory,
  xp: number,
  hidden = false,
): Achievement => ({ id, name, description, category, xp, hidden });

export const ACHIEVEMENTS: readonly Achievement[] = [
  // Speed
  a("first-steps", "First Steps", "Finish your first speed test.", "speed", 10),
  a("wpm-40", "Getting Warm", "Reach 40 WPM in a speed test.", "speed", 20),
  a("wpm-60", "Quick Fingers", "Reach 60 WPM in a speed test.", "speed", 30),
  a("wpm-80", "Speedster", "Reach 80 WPM in a speed test.", "speed", 50),
  a("wpm-100", "Triple Digits", "Reach 100 WPM in a speed test.", "speed", 80),
  a("wpm-120", "Blur", "Reach 120 WPM in a speed test.", "speed", 120),
  // Accuracy
  a("flawless", "Flawless", "Finish a test of 25+ words with 100% accuracy.", "accuracy", 40),
  a("metronome", "Metronome", "Score 90%+ consistency in a test of 30 seconds or more.", "accuracy", 40),
  // Combo
  a("combo-50", "On a Roll", "Reach a 50-key combo.", "combo", 20),
  a("combo-100", "Unstoppable", "Reach a 100-key combo.", "combo", 40),
  a("combo-250", "In the Zone", "Reach a 250-key combo.", "combo", 80),
  // Learn
  a("home-row-hero", "Home Row Hero", "Pass every Home row lesson.", "learn", 30),
  a("alphabet", "The Whole Alphabet", "Pass every lesson up to the end of the Bottom row.", "learn", 50),
  a("graduate", "Graduate", "Pass all 32 lessons.", "learn", 100),
  a("star-collector", "Star Collector", "Earn 3 stars on 10 lessons.", "learn", 50),
  // Dedication
  a("tests-10", "Warming Up", "Finish 10 speed tests.", "dedication", 20),
  a("tests-100", "Regular", "Finish 100 speed tests.", "dedication", 60),
  a("tests-1000", "Keyboard Warrior", "Finish 1,000 speed tests.", "dedication", 200),
  a("streak-7", "One Week Strong", "Keep a 7-day streak.", "dedication", 50),
  a("streak-30", "Habit Formed", "Keep a 30-day streak.", "dedication", 150),
  a("streak-100", "Unbreakable", "Keep a 100-day streak.", "dedication", 400),
  // Challenges
  a("daily-1", "Daily Debut", "Complete a daily challenge.", "challenge", 20),
  a("daily-7", "Daily Devotee", "Complete 7 daily challenges.", "challenge", 60),
  a("skill-gold", "Gold Standard", "Clear any skill challenge on gold.", "challenge", 60),
  a("all-skills", "Jack of All Keys", "Clear every skill challenge on any tier.", "challenge", 80),
  // Fun / hidden
  a("night-owl", "Night Owl", "Finish a test between midnight and 4 AM.", "fun", 15, true),
  a("early-bird", "Early Bird", "Finish a test between 5 and 7 AM.", "fun", 15, true),
  a("the-answer", "The Answer", "Finish a test at exactly 42 WPM.", "fun", 42, true),
  a("photo-finish", "Photo Finish", "Beat your personal best by less than half a WPM.", "fun", 25, true),
  a("slow-and-steady", "Slow and Steady", "100% accuracy in a 60s+ test under 30 WPM.", "fun", 20, true),
  a("backspace-hero", "Backspace Hero", "Fix 30+ mistakes in one test and still finish at 95%+ accuracy.", "fun", 25, true),
];

export const ACHIEVEMENTS_BY_ID: ReadonlyMap<string, Achievement> = new Map(ACHIEVEMENTS.map((x) => [x.id, x]));
