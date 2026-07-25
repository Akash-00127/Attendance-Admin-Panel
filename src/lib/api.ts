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

export interface LeaveRequest {
  id: string;
  employeeId: string;
  employee?: Employee;
  role: Role;
  leaveDate: string;
  message: string;
  status: "pending" | "approved" | "rejected";
  adminResponse?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  createdAt?: string;
}

export interface AdminLoginResponse {
  accessToken: string;
  user: AdminUser;
}

function getAdminToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("srv-admin-token");
}

async function request<T>(path: string, options: RequestInit = {}) {
  const token = getAdminToken();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text();
    try {
      const parsed = JSON.parse(body) as { message?: string | string[]; error?: string };
      const message = Array.isArray(parsed.message) ? parsed.message.join(", ") : parsed.message;
      throw new Error(message || parsed.error || body);
    } catch (error) {
      if (error instanceof Error && error.message !== body) throw error;
      throw new Error(body || "Request failed");
    }
  }
  return res.json() as Promise<T>;
}

export const api = {
  adminSetupStatus: () => request<{ hasAdmin: boolean }>("/admin-auth/setup-status"),
  adminLogin: (body: { identifier: string; password: string }) => request<AdminLoginResponse>("/admin-auth/login", { method: "POST", body: JSON.stringify(body) }),
  createAdmin: (body: { username: string; email: string; password: string }) => request<AdminUser>("/admin-auth/create-admin", { method: "POST", body: JSON.stringify(body) }),
  summary: () => request<Summary>("/admin/summary"),
  employees: () => request<Employee[]>("/admin/employees"),
  updateEmployee: (id: string, body: Partial<Employee>) => request<Employee>(`/admin/employees/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteEmployee: (id: string) => request<{ deleted: boolean }>(`/admin/employees/${id}`, { method: "DELETE" }),
  attendance: (days = 30) => request<AttendanceRecord[]>(`/admin/attendance?days=${days}`),
  updateAttendance: (id: string, body: Partial<AttendanceRecord>) => request<AttendanceRecord>(`/admin/attendance/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  salary: (days = 30) => request<SalaryRow[]>(`/admin/salary?days=${days}`),
  leaveRequests: (role?: Role) => request<LeaveRequest[]>(`/admin/leave-requests${role ? `?role=${role}` : ""}`),
  updateLeaveRequest: (id: string, body: { status: LeaveRequest["status"]; adminResponse?: string }) =>
    request<LeaveRequest>(`/admin/leave-requests/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  community: () => request<CommunityPost[]>("/admin/community"),
  createCommunity: (body: Pick<CommunityPost, "type" | "title" | "body" | "audience" | "isPublished">) =>
    request<CommunityPost>("/admin/community", { method: "POST", body: JSON.stringify(body) }),
  updateCommunity: (id: string, body: Partial<CommunityPost>) => request<CommunityPost>(`/admin/community/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteCommunity: (id: string) => request<{ deleted: boolean }>(`/admin/community/${id}`, { method: "DELETE" }),
};
