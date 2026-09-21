export type IeltsCategory = "reading" | "listening" | "writing" | "speaking";

export interface IeltsScores { reading: number; listening: number; writing: number; speaking: number }
export interface IeltsGoal extends IeltsScores { updatedAt: string }

export interface IeltsWork {
  recordId: string;
  name: string;
  category: IeltsCategory;
  dueAt: string | null;
  expectedMinutes: number | null;
  completedAt: string | null;
  actualMinutes: number | null;
  score: number | null;
  readingCorrect: number[] | null;
  readingTotals: number[] | null;
  listeningCorrect: number[] | null;
  listeningTotals: number[] | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IeltsMock extends IeltsScores {
  recordId: string;
  examAt: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface IeltsCourseInput {
  name: string;
  startAt: string;
  endAt: string;
  teacher: string;
  classroom: string;
  color: string;
  notes: string;
}

export interface IeltsCourse extends IeltsCourseInput {
  recordId: string;
  createdAt: string;
  updatedAt: string;
}

export interface IeltsData { goal: IeltsGoal | null; works: IeltsWork[]; mocks: IeltsMock[]; courses: IeltsCourse[]; readWarnings: string[] }

export interface IeltsCompletionInput {
  actualMinutes: number;
  score: number | null;
  readingCorrect: number[] | null;
  readingTotals: number[] | null;
  listeningCorrect: number[] | null;
  listeningTotals: number[] | null;
}
