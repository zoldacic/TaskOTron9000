// TypeScript mirrors of the backend DTOs (src/TaskOTron.Api/Dtos/Dtos.cs).

export type DateKind = 'due' | 'transaction';

export interface Todo {
  id: number;
  title: string;
  done: boolean;
  due: string | null; // ISO yyyy-MM-dd
  amount: number | null; // null = no amount
  dateKind: DateKind;
  catIds: string[];
}

export interface TodoWrite {
  title: string;
  due: string | null;
  amount: number | null;
  dateKind: DateKind;
  catIds: string[];
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

export interface TitleDefault {
  normalizedTitle: string;
  catIds: string[];
}

export interface ImportRow {
  key: number;
  title: string;
  date: string | null;
  amount: number | null;
  ok: boolean;
  catIds: string[];
}

export interface ImportCommitRow {
  title: string;
  date: string | null;
  amount: number | null;
  catIds: string[];
}

export interface ReportBucket {
  label: string;
  net: number;
}

export interface ReportCategory {
  name: string;
  net: number;
}

export interface Report {
  moneyIn: number;
  moneyOut: number;
  net: number;
  granularity: 'day' | 'week' | 'month';
  buckets: ReportBucket[];
  categoryBreakdown: ReportCategory[];
}
