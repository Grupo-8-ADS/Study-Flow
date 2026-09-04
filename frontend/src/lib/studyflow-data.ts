import { supabase } from "@/lib/supabase";

export type StudyFlowSession = {
  email: string;
  nome: string;
  pendingEmailConfirmation?: boolean;
  username: string;
};

export type StudyDistribution = {
  color: string;
  hours: number;
  max: number;
  name: string;
};

const distributionColors = ["bg-[#29645e]", "bg-[#348e83]", "bg-[#e5a93b]", "bg-red-400", "bg-gray-300"];

export function getStoredSession(): StudyFlowSession | null {
  const storedSession = localStorage.getItem("studyflow_session");
  if (!storedSession) return null;

  return JSON.parse(storedSession) as StudyFlowSession;
}

export async function getCurrentSupabaseUserId(session?: StudyFlowSession) {
  void session;
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export function getLocalStudyMinutes(email: string) {
  const storedActivity = localStorage.getItem(`studyflow_activity_${email}`);
  if (!storedActivity) return 0;

  const parsedActivity = JSON.parse(storedActivity) as Array<{ type?: string }>;
  return parsedActivity.filter((activity) => activity.type === "foco").length * 25;
}

export function calculateStreak(dates: string[]) {
  const uniqueDays = new Set(dates.filter(Boolean).map((date) => date.slice(0, 10)));
  if (uniqueDays.size === 0) return 0;

  let streak = 0;
  const cursor = new Date();

  while (true) {
    const key = cursor.toISOString().slice(0, 10);
    if (!uniqueDays.has(key)) break;

    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

export function buildDistribution(rows: Array<{ disciplina?: string | null; minutes: number }>) {
  const totals = new Map<string, number>();

  rows.forEach((row) => {
    if (!row.disciplina) return;
    totals.set(row.disciplina, (totals.get(row.disciplina) ?? 0) + row.minutes);
  });

  return Array.from(totals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, minutes], index): StudyDistribution => {
      const hours = Number((minutes / 60).toFixed(1));

      return {
        color: distributionColors[index] ?? "bg-gray-300",
        hours,
        max: Math.max(1, Math.ceil(hours / 2) * 2),
        name,
      };
    });
}
