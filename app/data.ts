export type Role = "admin" | "scheduler";

export type User = {
  id: string;
  username: string;
  displayName: string;
  password: string;
  role: Role;
};

export type Soldier = {
  id: string;
  name: string;
  isTrainee: boolean;
};

export type ShiftBackup = {
  soldierId: string;
  soldierName: string;
  type: "צל" | "גיבוי";
};

export type Shift = {
  id: string;
  date: string; // YYYY-MM-DD
  startHour: number; // 0-23
  soldierId: string;
  soldierName: string;
  backups: ShiftBackup[];
  isPast: boolean;
  createdAt: number;
};

export type SpecialDate = {
  id: string;
  date: string; // YYYY-MM-DD
  label: string;
};

export type AppSettings = {
  periodStart: string; // YYYY-MM-DD
  periodEnd: string;   // YYYY-MM-DD
  specialDates: SpecialDate[];
};

export const defaultUsers: User[] = [
  {
    id: "user-shmuel",
    username: "שמואל",
    displayName: "שמואל",
    password: "1234",
    role: "admin",
  },
  {
    id: "user-drori",
    username: "דרורי",
    displayName: "דרורי",
    password: "1234",
    role: "scheduler",
  },
  {
    id: "user-ravivo",
    username: "רביבו",
    displayName: "רביבו",
    password: "1234",
    role: "scheduler",
  },
];

export const defaultSoldiers: Soldier[] = [
  { id: "sol-shmuel", name: "שמואל", isTrainee: false },
  { id: "sol-drori", name: "דרורי", isTrainee: false },
  { id: "sol-ravivo", name: "רביבו", isTrainee: false },
];

export const defaultSettings: AppSettings = {
  periodStart: "2026-07-01",
  periodEnd: "2026-10-01",
  specialDates: [],
};
