export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001/api";

export type Role = "it_team" | "factory_worker" | "accountant" | "sales_field";
export type Status = "present" | "absent" | "half_day" | "leave" | "week_off" | "pending";

export interface Employee {
  id: string;
  name: string;
  role: Role;
  employeeCode: string;
  department: string;
  monthlySalary: number;
  perDaySalary: number;
  joinedOn: string;
  phone: string;
  email?: string | null;
  avatarColorSeed: string;
  profileImageUri?: string | null;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employee?: Employee;
  dateKey: string;
  status: Status;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  checkInAddress?: string | null;
  checkOutAddress?: string | null;
  workedMinutes?: number | null;
}

export interface Summary {
  totalEmployees: number;
  presentToday: number;
  absentToday: number;
  checkedInNow: number;
  roleCounts: Record<Role, number>;
}

export interface SalaryRow {
  employee: Employee;
  salary: {
    attendancePercent: number;
    presentDays: number;
    halfDays: number;
    leaveDays: number;
    totalWorkingDays: number;
    earnedBasic: number;
    overtimeBonus: number;
    netPayable: number;
  };
}

export interface CommunityPost {
  id: string;
  type: "notice" | "task" | "info";
  title: string;
  body: string;
  audience: string;
  isPublished: boolean;
  createdAt: string;
}

async function request<T>(path: string, options: RequestInit = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

export const api = {
  summary: () => request<Summary>("/admin/summary"),
  employees: () => request<Employee[]>("/admin/employees"),
  updateEmployee: (id: string, body: Partial<Employee>) => request<Employee>(`/admin/employees/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteEmployee: (id: string) => request<{ deleted: boolean }>(`/admin/employees/${id}`, { method: "DELETE" }),
  attendance: (days = 30) => request<AttendanceRecord[]>(`/admin/attendance?days=${days}`),
  updateAttendance: (id: string, body: Partial<AttendanceRecord>) => request<AttendanceRecord>(`/admin/attendance/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  salary: (days = 30) => request<SalaryRow[]>(`/admin/salary?days=${days}`),
  community: () => request<CommunityPost[]>("/admin/community"),
  createCommunity: (body: Pick<CommunityPost, "type" | "title" | "body" | "audience" | "isPublished">) =>
    request<CommunityPost>("/admin/community", { method: "POST", body: JSON.stringify(body) }),
  updateCommunity: (id: string, body: Partial<CommunityPost>) => request<CommunityPost>(`/admin/community/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteCommunity: (id: string) => request<{ deleted: boolean }>(`/admin/community/${id}`, { method: "DELETE" }),
};
