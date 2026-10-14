export type HomeworkDueEntry = { homeworkId: string; title: string; dueAt: string };

export type ShownHomework = HomeworkDueEntry & { overdue: boolean };

// Which piece of homework a course card should surface: the most recently missed one,
// since that needs attention now; otherwise the next one due.
export function pickHomeworkToShow(
  entries: HomeworkDueEntry[],
  submitted: Set<string>,
  now: Date,
): ShownHomework | null {
  const byMostRecent = (a: HomeworkDueEntry, b: HomeworkDueEntry) => b.dueAt.localeCompare(a.dueAt);

  const overdue = entries
    .filter((e) => !submitted.has(e.homeworkId) && new Date(e.dueAt) < now)
    .sort(byMostRecent)[0];
  if (overdue) return { ...overdue, overdue: true };

  const bySoonest = (a: HomeworkDueEntry, b: HomeworkDueEntry) => a.dueAt.localeCompare(b.dueAt);
  const upcoming = entries.filter((e) => new Date(e.dueAt) >= now).sort(bySoonest)[0];
  return upcoming ? { ...upcoming, overdue: false } : null;
}
