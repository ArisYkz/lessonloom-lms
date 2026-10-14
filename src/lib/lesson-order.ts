// Where a learner picks a course back up: the first lesson they haven't finished.
// When everything is finished, or nothing is, the course opens at its first lesson.
export function firstLessonToOpen<T extends { id: string }>(lessons: T[], done: Set<string>) {
  return lessons.find((lesson) => !done.has(lesson.id)) ?? lessons[0] ?? null;
}
