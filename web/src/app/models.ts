// TypeScript mirrors of the backend DTOs (src/TaskOTron.Api/Dtos/Dtos.cs).

export type DateKind = 'due' | 'transaction';

export interface Todo {
  id: number;
  title: string;
  done: boolean;
  due: string | null; // ISO yyyy-MM-dd
  amount: number | null; // null = no amount
  dateKind: DateKind;
  mainId: string; // required single main category
  catIds: string[]; // subcategories; may belong to other mains
  bankAccountId: string | null;
  note: string | null; // free-text note; null = no note
}

export interface TodoWrite {
  title: string;
  due: string | null;
  amount: number | null;
  dateKind: DateKind;
  mainId: string; // required single main category
  catIds: string[];
  bankAccountId: string | null;
  note: string | null;
}

export interface Main {
  id: string;
  name: string;
}

export interface Sub {
  id: string;
  mainId: string;
  name: string;
  taskCount: number;
}

export interface Categories {
  mains: Main[];
  subs: Sub[];
}

export interface BankAccount {
  id: string;
  name: string;
  taskCount: number;
}

export interface TitleDefault {
  normalizedTitle: string;
  catIds: string[];
  mainId: string | null; // remembered required main category (null if not remembered)
}

export type QueryDateKind = 'any' | 'due' | 'transaction';
export type QueryAmountKind = 'any' | 'has' | 'none' | 'income' | 'spend';

// Composable task-query criteria. Every field is "ignore when empty/any" — see task-query.ts.
export interface TaskQuery {
  text: string; // case-insensitive substring on title; blank = ignore
  catIds: string[]; // match ANY of these sub ids; empty = ignore
  dueFrom: string | null; // inclusive ISO yyyy-MM-dd
  dueTo: string | null; // inclusive ISO yyyy-MM-dd
  dateKind: QueryDateKind;
  amountKind: QueryAmountKind;
  amountMin: number | null; // bound on absolute amount
  amountMax: number | null; // bound on absolute amount
  bankAccountId: string | null; // specific id, '__none__' (no account), or null = ignore
}

export interface SavedQuery {
  id: string;
  name: string;
  query: TaskQuery;
}

export interface ImportRow {
  key: number;
  title: string;
  date: string | null;
  amount: number | null;
  ok: boolean;
  mainId: string | null; // required main category; null until defaulted client-side
  catIds: string[];
  note: string; // per-row note, entered client-side; '' = none
}

export interface ImportCommitRow {
  title: string;
  date: string | null;
  amount: number | null;
  mainId: string; // required single main category for imported tasks
  catIds: string[];
  bankAccountId: string | null;
  note: string | null;
}

export interface ReportBucket {
  label: string;
  net: number;
  parts: number[]; // per-category net, aligned to Report.categoryBreakdown order
}

export interface ReportCategory {
  name: string;
  net: number;
}

export interface Report {
  moneyIn: number;
  moneyOut: number;
  net: number;
  granularity: 'day' | 'week' | 'month'; // describes `buckets` (the bar chart series)
  buckets: ReportBucket[];
  dailyBuckets: ReportBucket[]; // always daily; drives the line / balance chart
  categoryBreakdown: ReportCategory[];
}
