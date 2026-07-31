"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BarChart3,
  Bell,
  CalendarCheck,
  CheckCircle,
  ClipboardCheck,
  MapPin,
  Clock,
  Download,
  Eye,
  EyeOff,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Navigation,
  Pencil,
  Search,
  RefreshCw,
  Settings,
  Shield,
  Sun,
  Trash2,
  User,
  Users,
  Wallet,
  X,
} from "lucide-react";

import { api, AdminUser, AttendanceRecord, CommunityPost, Employee, FieldLocation, LeaveRequest, SalaryRow, Summary } from "@/lib/api";

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "employees", label: "Employees", icon: Users },
  { id: "attendance", label: "Attendance", icon: CalendarCheck },
  { id: "fieldTracking", label: "Field Tracking", icon: MapPin },
  { id: "salary", label: "Salary", icon: Wallet },
  { id: "leave", label: "Leave Requests", icon: ClipboardCheck },
  { id: "community", label: "Community", icon: Bell },
  { id: "settings", label: "Settings", icon: Settings },
] as const;

const roleLabels: Record<string, string> = {
  sales_man: "Sales Men",
  srv_driver: "SRV Driver",
};

const chartColors = ["#6366F1", "#22D3EE", "#34D399", "#F59E0B"];
const roleCards = [
  { role: "srv_driver", label: "SRV Driver", color: "#34D399" },
  { role: "sales_man", label: "Sales Men", color: "#F59E0B" },
] as const;

const EMPLOYEE_PAGE_SIZE = 30;
const TABLE_PAGE_SIZE = 30;
const CARD_PAGE_SIZE = 10;

type ExportRow = Record<string, string | number | boolean | null | undefined>;
type ExportFormat = "excel" | "zip" | "pdf" | "csv";

function formatHours(minutes?: number | null) {
  if (minutes == null) return "-";
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function minutesToDeductionInput(minutes?: number | null) {
  const safeMinutes = Math.max(0, Math.floor(Number(minutes ?? 0)));
  const hours = Math.floor(safeMinutes / 60);
  const mins = safeMinutes % 60;
  return safeMinutes ? `${hours}.${String(mins).padStart(2, "0")}` : "";
}

function parseDeductionInput(value: string) {
  const cleaned = value.replace(/[^0-9.:]/g, "");
  if (!cleaned) return 0;
  const [hoursPart, minutesPart] = cleaned.split(/[.:]/);
  const hours = Math.max(0, Number(hoursPart) || 0);
  const minutes = minutesPart == null || minutesPart === "" ? 0 : Math.min(59, Math.max(0, Number(minutesPart.padEnd(2, "0").slice(0, 2)) || 0));
  return Math.round(hours * 60 + minutes);
}

function formatTime(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}


function formatDateTime(value?: string | null) {
  if (!value) return "Not updated";
  return new Date(value).toLocaleString([], { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function locationFreshness(value?: string | null) {
  if (!value) return "Waiting for app update";
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return "Updated just now";
  if (minutes < 60) return `Updated ${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `Updated ${hours}h ${rest}m ago`;
}

function hasCoordinates(location?: FieldLocation | null) {
  return location?.latitude != null && location?.longitude != null;
}

function openStreetMapEmbed(location: FieldLocation) {
  const lat = Number(location.latitude);
  const lng = Number(location.longitude);
  const delta = 0.012;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${lng - delta}%2C${lat - delta}%2C${lng + delta}%2C${lat + delta}&layer=mapnik&marker=${lat}%2C${lng}`;
}

function externalMapLink(location: FieldLocation) {
  return `https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`;
}
function money(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}


function exportValue(value: ExportRow[string]) {
  if (value == null) return "";
  return String(value).replace(/\r?\n/g, " ").trim();
}

function rowsToCsv(rows: ExportRow[]) {
  if (!rows.length) return "No data\n";
  const headers = Object.keys(rows[0]);
  const escape = (value: ExportRow[string]) => '"' + exportValue(value).replace(/"/g, '""') + '"';
  return [headers.map(escape).join(","), ...rows.map((row) => headers.map((header) => escape(row[header])).join(","))].join("\n");
}

function rowsToHtmlTable(title: string, rows: ExportRow[]) {
  const headers = rows.length ? Object.keys(rows[0]) : ["No data"];
  const bodyRows = rows.length ? rows : [{ "No data": "No records found" }];
  return `<html><head><meta charset="utf-8" /><style>body{font-family:Arial,sans-serif}table{border-collapse:collapse;width:100%}th,td{border:1px solid #cbd5e1;padding:8px;text-align:left}th{background:#eef2ff}</style></head><body><h2>${title}</h2><table><thead><tr>${headers.map((header) => `<th>${header}</th>`).join("")}</tr></thead><tbody>${bodyRows.map((row) => `<tr>${headers.map((header) => `<td>${exportValue(row[header])}</td>`).join("")}</tr>`).join("")}</tbody></table></body></html>`;
}

function escapePdfText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function rowsToPdf(title: string, rows: ExportRow[]) {
  const csvLines = rowsToCsv(rows).split("\n").slice(0, 44).map((line) => line.replace(/"/g, ""));
  const lines = [title, `Generated: ${new Date().toLocaleString()}`, "", ...csvLines];
  const content = ["BT /F1 11 Tf 40 790 Td"];
  lines.forEach((line, index) => {
    if (index) content.push("0 -16 Td");
    content.push(`(${escapePdfText(line.slice(0, 115))}) Tj`);
  });
  content.push("ET");
  const stream = content.join("\n");
  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj",
    "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
    `5 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream endobj`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const object of objects) {
    offsets.push(pdf.length);
    pdf += object + "\n";
  }
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i++) pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return pdf;
}

function downloadBlob(fileName: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function crc32(input: string) {
  let crc = -1;
  for (let i = 0; i < input.length; i++) {
    crc ^= input.charCodeAt(i);
    for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ -1) >>> 0;
}

function writeUint(value: number, bytes: number) {
  return Array.from({ length: bytes }, (_, index) => String.fromCharCode((value >>> (index * 8)) & 255)).join("");
}

function makeSimpleZip(fileName: string, content: string) {
  const encodedName = unescape(encodeURIComponent(fileName));
  const encodedContent = unescape(encodeURIComponent(content));
  const checksum = crc32(encodedContent);
  const localHeader = "PK\x03\x04" + writeUint(20, 2) + writeUint(0, 2) + writeUint(0, 2) + writeUint(0, 2) + writeUint(0, 2) + writeUint(checksum, 4) + writeUint(encodedContent.length, 4) + writeUint(encodedContent.length, 4) + writeUint(encodedName.length, 2) + writeUint(0, 2) + encodedName;
  const centralHeader = "PK\x01\x02" + writeUint(20, 2) + writeUint(20, 2) + writeUint(0, 2) + writeUint(0, 2) + writeUint(0, 2) + writeUint(0, 2) + writeUint(checksum, 4) + writeUint(encodedContent.length, 4) + writeUint(encodedContent.length, 4) + writeUint(encodedName.length, 2) + writeUint(0, 2) + writeUint(0, 2) + writeUint(0, 2) + writeUint(0, 2) + writeUint(0, 4) + writeUint(0, 4) + encodedName;
  const end = "PK\x05\x06" + writeUint(0, 2) + writeUint(0, 2) + writeUint(1, 2) + writeUint(1, 2) + writeUint(centralHeader.length, 4) + writeUint(localHeader.length + encodedContent.length, 4) + writeUint(0, 2);
  return localHeader + encodedContent + centralHeader + end;
}

function exportRows(title: string, baseFileName: string, rows: ExportRow[], format: ExportFormat) {
  const safeName = baseFileName.replace(/[^a-z0-9-_]+/gi, "-").toLowerCase();
  const csv = rowsToCsv(rows);
  if (format === "csv") return downloadBlob(`${safeName}.csv`, new Blob([csv], { type: "text/csv;charset=utf-8" }));
  if (format === "excel") return downloadBlob(`${safeName}.xls`, new Blob([rowsToHtmlTable(title, rows)], { type: "application/vnd.ms-excel;charset=utf-8" }));
  if (format === "pdf") return downloadBlob(`${safeName}.pdf`, new Blob([rowsToPdf(title, rows)], { type: "application/pdf" }));
  return downloadBlob(`${safeName}.zip`, new Blob([makeSimpleZip(`${safeName}.csv`, csv)], { type: "application/zip" }));
}
function StatCard({ icon: Icon, label, value, sub, color }: { icon: any; label: string; value: string; sub: string; color: string }) {
  return (
    <div className="card stat-card">
      <div className="stat-icon" style={{ background: `${color}18`, color }}>
        <Icon size={21} />
      </div>
      <div className="stat-value">{value}</div>
      <div className="muted" style={{ fontWeight: 700 }}>{label}</div>
      <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{sub}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return <span className={`badge ${status}`}>{status.replace("_", " ")}</span>;
}

function PaginationBar({ total, page, pageCount, pageSize, onPage }: { total: number; page: number; pageCount: number; pageSize: number; onPage: (next: number) => void }) {
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  return (
    <div className="pagination-bar">
      <span className="muted">Showing {start}-{end} of {total}</span>
      <div className="controls">
        <button className="btn secondary" disabled={page <= 1} onClick={() => onPage(Math.max(1, page - 1))}>Previous</button>
        <span className="page-count">Page {page} / {pageCount}</span>
        <button className="btn secondary" disabled={page >= pageCount} onClick={() => onPage(Math.min(pageCount, page + 1))}>Next</button>
      </div>
    </div>
  );
}
function ExportMenu({ title, fileName, rows }: { title: string; fileName: string; rows: ExportRow[] }) {
  const [open, setOpen] = useState(false);
  const choose = (format: ExportFormat) => {
    setOpen(false);
    exportRows(title, fileName, rows, format);
  };
  return (
    <div className="export-menu">
      <button className="btn secondary" onClick={() => setOpen((next) => !next)}><Download size={15} /> Export</button>
      {open && (
        <div className="export-options">
          <button onClick={() => choose("excel")}>Excel</button>
          <button onClick={() => choose("zip")}>ZIP</button>
          <button onClick={() => choose("pdf")}>PDF</button>
          <button onClick={() => choose("csv")}>CSV</button>
        </div>
      )}
    </div>
  );
}
const emptyAdminForm = { username: "", email: "", password: "" };

function PasswordInput({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="password-wrap">
      <input
        className="input password-input"
        type={visible ? "text" : "password"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
      <button className="password-eye" type="button" onClick={() => setVisible((next) => !next)} aria-label={visible ? "Hide password" : "Show password"}>
        {visible ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </div>
  );
}

function LoginScreen({ onLogin, dark, onToggleTheme }: { onLogin: (token: string, user: AdminUser) => void; dark: boolean; onToggleTheme: () => void }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [hasAdmin, setHasAdmin] = useState(true);

  useEffect(() => {
    api.adminSetupStatus()
      .then((status) => {
        setHasAdmin(status.hasAdmin);
        if (!status.hasAdmin) setMessage("No admin account exists yet. Please create one from Settings after an authorized admin login.");
      })
      .catch(() => setMessage("Backend is not connected. Start backend on port 3001."));
  }, []);

  const submitLogin = async () => {
    if (!identifier.trim() || password.length < 8) {
      setMessage("Enter username/email and minimum 8 digit password.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const res = await api.adminLogin({ identifier: identifier.trim(), password });
      onLogin(res.accessToken, res.user);
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : "Unable to login admin";
      setMessage(nextMessage.includes("Invalid admin") ? "Invalid login. Use the admin username/email and password created from Settings." : nextMessage);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`auth-shell ${dark ? "dark" : "light"}`}>
      <button className="theme-toggle auth-theme-toggle" onClick={onToggleTheme} title={dark ? "Switch Light Mode" : "Switch Dark Mode"}>
        {dark ? <Sun size={18} /> : <Moon size={18} />}
      </button>
      <div className="auth-card card card-pad">
        <img src="/srv-logo.png" alt="SRV Electricals" className="auth-logo" />
        <div className="auth-kicker"><Shield size={16} /> Attendance Admin Panel</div>
        <h1>Admin Login</h1>
        <p className="muted">{hasAdmin ? "Login with your username or email and password." : "No admin account found. Create the first admin to continue."}</p>
        <div className="form-stack">
          <div className="input-icon"><User size={16} /><input className="input" value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder="Username or email" /></div>
          <PasswordInput value={password} onChange={setPassword} placeholder="Password" />
          <button className="btn" disabled={busy || !hasAdmin} onClick={submitLogin}>{busy ? "Please wait..." : "Login"}</button>
        </div>
        {message && <div className="auth-message">{message}</div>}
      </div>
    </div>
  );
}

export default function AdminPanel() {
  const [active, setActive] = useState<(typeof navItems)[number]["id"]>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [dark, setDark] = useState(true);
  const [query, setQuery] = useState("");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [salary, setSalary] = useState<SalaryRow[]>([]);
  const [community, setCommunity] = useState<CommunityPost[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [fieldLocations, setFieldLocations] = useState<FieldLocation[]>([]);
  const [employeeDraft, setEmployeeDraft] = useState<Partial<Employee> | null>(null);
  const [deductionInput, setDeductionInput] = useState("");
  const [employeePage, setEmployeePage] = useState(1);
  const [attendancePage, setAttendancePage] = useState(1);
  const [salaryPage, setSalaryPage] = useState(1);
  const [leavePage, setLeavePage] = useState(1);
  const [communityPage, setCommunityPage] = useState(1);
  const [fieldPage, setFieldPage] = useState(1);
  const [selectedRole, setSelectedRole] = useState<string>("all");
  const [selectedLeaveRole, setSelectedLeaveRole] = useState<string | null>(null);
  const [selectedLeaveMessage, setSelectedLeaveMessage] = useState<LeaveRequest | null>(null);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [success, setSuccess] = useState("");
  const [postDraft, setPostDraft] = useState({ type: "notice" as CommunityPost["type"], title: "", body: "", audience: "All Teams", isPublished: true });
  const [message, setMessage] = useState("Loading backend data...");
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [adminDraft, setAdminDraft] = useState(emptyAdminForm);
  const [adminPasswordVisible, setAdminPasswordVisible] = useState(false);

  const loadAll = async () => {
    if (!adminUser) return;
    try {
      setMessage("Loading backend data...");
      const [nextSummary, nextEmployees, nextAttendance, nextSalary, nextCommunity, nextLeaves, nextFieldLocations] = await Promise.all([
        api.summary(),
        api.employees(),
        api.attendance(30),
        api.salary(30),
        api.community(),
        api.leaveRequests(),
        api.fieldTracking(),
      ]);
      setSummary(nextSummary);
      setEmployees(nextEmployees);
      setAttendance(nextAttendance);
      setSalary(nextSalary);
      setCommunity(nextCommunity);
      setLeaveRequests(nextLeaves);
      setFieldLocations(nextFieldLocations);
      setMessage("Synced with SRV backend");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unable to connect to backend");
    }
  };

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  useEffect(() => {
    const storedToken = window.localStorage.getItem("srv-admin-token");
    const storedUser = window.localStorage.getItem("srv-admin-user");
    if (storedToken && storedUser) {
      try {
        setAdminUser(JSON.parse(storedUser) as AdminUser);
      } catch {
        window.localStorage.removeItem("srv-admin-token");
        window.localStorage.removeItem("srv-admin-user");
      }
    }
    setSessionReady(true);
  }, []);

  useEffect(() => {
    if (adminUser) loadAll();
  }, [adminUser]);

  useEffect(() => {
    if (!adminUser) return;
    const timer = window.setInterval(loadAll, 5000);
    return () => window.clearInterval(timer);
  }, [adminUser]);


  useEffect(() => {
    if (!success) return;
    const timer = window.setTimeout(() => setSuccess(""), 2200);
    return () => window.clearTimeout(timer);
  }, [success]);

  const filteredEmployees = useMemo(() => {
    const q = query.toLowerCase();
    return employees.filter((e) => {
      const matchesQuery = [e.name, e.employeeCode, e.department, e.phone, e.email ?? ""].join(" ").toLowerCase().includes(q);
      const matchesRole = selectedRole === "all" || e.role === selectedRole;
      return matchesQuery && matchesRole;
    });
  }, [employees, query, selectedRole]);

  useEffect(() => {
    setEmployeePage(1);
  }, [query, selectedRole]);

  const roleData = Object.entries(summary?.roleCounts ?? {}).map(([name, value]) => ({ name: roleLabels[name] ?? name, value }));
  const dailyData = attendance.slice(0, 14).reverse().map((r) => ({ date: r.dateKey.slice(5), present: r.status === "present" ? 1 : 0, half: r.status === "half_day" ? 1 : 0 }));
  const totalPayroll = salary.reduce((sum, row) => sum + row.salary.netPayable, 0);
  const leaveRoleCounts = roleCards.reduce<Record<string, number>>((acc, item) => {
    acc[item.role] = leaveRequests.filter((request) => request.role === item.role).length;
    return acc;
  }, {});
  const filteredLeaves = selectedLeaveRole ? leaveRequests.filter((request) => request.role === selectedLeaveRole) : leaveRequests;
  const locatedFieldLocations = fieldLocations.filter(hasCoordinates);
  const onDutyFieldLocations = fieldLocations.filter((location) => location.isOnDuty);
  const selectedFieldLocation =
    fieldLocations.find((location) => location.employee.id === selectedFieldId) ?? locatedFieldLocations[0] ?? fieldLocations[0] ?? null;

  useEffect(() => {
    setLeavePage(1);
  }, [selectedLeaveRole]);

  const employeePageCount = Math.max(1, Math.ceil(filteredEmployees.length / EMPLOYEE_PAGE_SIZE));
  const safeEmployeePage = Math.min(employeePage, employeePageCount);
  const paginatedEmployees = filteredEmployees.slice((safeEmployeePage - 1) * EMPLOYEE_PAGE_SIZE, safeEmployeePage * EMPLOYEE_PAGE_SIZE);
  const attendancePageCount = Math.max(1, Math.ceil(attendance.length / TABLE_PAGE_SIZE));
  const safeAttendancePage = Math.min(attendancePage, attendancePageCount);
  const paginatedAttendance = attendance.slice((safeAttendancePage - 1) * TABLE_PAGE_SIZE, safeAttendancePage * TABLE_PAGE_SIZE);
  const salaryPageCount = Math.max(1, Math.ceil(salary.length / TABLE_PAGE_SIZE));
  const safeSalaryPage = Math.min(salaryPage, salaryPageCount);
  const paginatedSalary = salary.slice((safeSalaryPage - 1) * TABLE_PAGE_SIZE, safeSalaryPage * TABLE_PAGE_SIZE);
  const leavePageCount = Math.max(1, Math.ceil(filteredLeaves.length / TABLE_PAGE_SIZE));
  const safeLeavePage = Math.min(leavePage, leavePageCount);
  const paginatedLeaves = filteredLeaves.slice((safeLeavePage - 1) * TABLE_PAGE_SIZE, safeLeavePage * TABLE_PAGE_SIZE);
  const communityPageCount = Math.max(1, Math.ceil(community.length / CARD_PAGE_SIZE));
  const safeCommunityPage = Math.min(communityPage, communityPageCount);
  const paginatedCommunity = community.slice((safeCommunityPage - 1) * CARD_PAGE_SIZE, safeCommunityPage * CARD_PAGE_SIZE);
  const fieldPageCount = Math.max(1, Math.ceil(fieldLocations.length / CARD_PAGE_SIZE));
  const safeFieldPage = Math.min(fieldPage, fieldPageCount);
  const paginatedFieldLocations = fieldLocations.slice((safeFieldPage - 1) * CARD_PAGE_SIZE, safeFieldPage * CARD_PAGE_SIZE);

  const employeeExportRows = filteredEmployees.map((e) => ({ Employee: e.name, Code: e.employeeCode, Role: roleLabels[e.role], Phone: e.phone, Department: e.department, BasicPay: e.monthlySalary, Advance: e.advanceMoney ?? 0, HourDeduction: formatHours(e.workingHourDeductionMinutes ?? 0), PerDay: e.perDaySalary, PerHour: Math.round(e.perDaySalary / 9), JoinedOn: e.joinedOn }));
  const attendanceExportRows = attendance.map((r) => ({ Date: r.dateKey, Employee: r.employee?.name ?? r.employeeId, Role: r.employee?.role ? roleLabels[r.employee.role] : "", Status: r.status, CheckIn: formatTime(r.checkInTime), CheckOut: formatTime(r.checkOutTime), TotalHours: formatHours(r.workedMinutes), CheckInAddress: r.checkInAddress ?? "", CheckOutAddress: r.checkOutAddress ?? "" }));
  const salaryExportRows = salary.map(({ employee, salary: s }) => ({ Employee: employee.name, Code: employee.employeeCode, Role: roleLabels[employee.role], Attendance: `${s.attendancePercent}%`, PresentDays: s.presentDays, Earned: s.earnedBasic, Overtime: s.overtimeBonus, Advance: s.advanceMoney ?? employee.advanceMoney ?? 0, HourDeduction: formatHours(s.workingHourDeductionMinutes ?? employee.workingHourDeductionMinutes ?? 0), DeductionReason: s.workingHourDeductionReason ?? employee.workingHourDeductionReason ?? "", Gross: s.grossPayable ?? s.earnedBasic + s.overtimeBonus, NetPayable: s.netPayable }));
  const leaveExportRows = filteredLeaves.map((request) => ({ Employee: request.employee?.name ?? request.employeeId, Code: request.employee?.employeeCode ?? "", Role: roleLabels[request.role], LeaveDate: request.leaveDate, RequestedOn: formatDateTime(request.createdAt), Message: request.message, Status: request.status, AdminResponse: request.adminResponse ?? "" }));
  const communityExportRows = community.map((post) => ({ Type: post.type, Title: post.title, Message: post.body, Audience: post.audience, Status: post.isPublished ? "Published" : "Draft", CreatedAt: formatDateTime(post.createdAt) }));
  const fieldExportRows = fieldLocations.map((location) => ({ Employee: location.employee.name, Code: location.employee.employeeCode, Phone: location.employee.phone, Status: location.isOnDuty ? "On duty" : "Off duty", Latitude: location.latitude ?? "", Longitude: location.longitude ?? "", Address: location.address ?? "Location not received", Updated: locationFreshness(location.locationUpdatedAt), CheckIn: formatTime(location.checkInTime) }));
  const openEmployeeEdit = (employee: Employee) => {
    setEmployeeDraft(employee);
    setDeductionInput(minutesToDeductionInput(employee.workingHourDeductionMinutes ?? 0));
  };

  const closeEmployeeEdit = () => {
    setEmployeeDraft(null);
    setDeductionInput("");
  };

  const saveEmployee = async () => {
    if (!employeeDraft?.id) return;
    await api.updateEmployee(employeeDraft.id, employeeDraft);
    closeEmployeeEdit();
    setSuccess("Employee updated successfully");
    await loadAll();
  };

  const deleteEmployee = async (employee: Employee) => {
    if (!window.confirm(`Delete ${employee.name}? This will remove their attendance records too.`)) return;
    await api.deleteEmployee(employee.id);
    if (employeeDraft?.id === employee.id) setEmployeeDraft(null);
    await loadAll();
  };

  const savePost = async () => {
    if (!postDraft.title.trim() || !postDraft.body.trim()) return;
    await api.createCommunity(postDraft);
    setPostDraft({ type: "notice", title: "", body: "", audience: "All Teams", isPublished: true });
    await loadAll();
  };

  const togglePost = async (post: CommunityPost) => {
    await api.updateCommunity(post.id, { isPublished: !post.isPublished });
    await loadAll();
  };

  const removePost = async (post: CommunityPost) => {
    await api.deleteCommunity(post.id);
    await loadAll();
  };


  const requestFieldLocation = async (location: FieldLocation) => {
    await api.requestFieldLocation(location.employee.id);
    setSuccess(`Location request sent to ${location.employee.name}`);
    await loadAll();
  };
  const respondLeave = async (request: LeaveRequest, status: LeaveRequest["status"]) => {
    const adminResponse = window.prompt(status === "approved" ? "Approval note optional" : "Reason for rejection optional", request.adminResponse ?? "") ?? undefined;
    await api.updateLeaveRequest(request.id, { status, adminResponse });
    setSuccess(`Leave ${status}`);
    await loadAll();
  };

  const handleLogin = (token: string, user: AdminUser) => {
    window.localStorage.setItem("srv-admin-token", token);
    window.localStorage.setItem("srv-admin-user", JSON.stringify(user));
    setAdminUser(user);
    setMessage("Synced with SRV backend");
  };

  const handleLogout = () => {
    window.localStorage.removeItem("srv-admin-token");
    window.localStorage.removeItem("srv-admin-user");
    setAdminUser(null);
    setSummary(null);
    setEmployees([]);
    setAttendance([]);
    setSalary([]);
    setCommunity([]);
    setLeaveRequests([]);
    setFieldLocations([]);
  };

  const createSettingsAdmin = async () => {
    if (!adminDraft.username.trim() || !adminDraft.email.trim() || adminDraft.password.length < 8) {
      setSuccess("Admin needs username, email, and minimum 8 digit password");
      return;
    }
    await api.createAdmin(adminDraft);
    setAdminDraft(emptyAdminForm);
    setSuccess("Admin created successfully");
  };

  if (!sessionReady) return null;
  if (!adminUser) return <LoginScreen onLogin={handleLogin} dark={dark} onToggleTheme={() => setDark((v) => !v)} />;

  return (
    <div className={`app-shell ${dark ? "dark" : "light"}`}>
      <aside className={`sidebar ${sidebarOpen ? "" : "collapsed"}`}>
        <div className="brand">
          <div className="brand-logo-plate"><img src="/srv-logo.png" alt="SRV" className="brand-logo" /></div>
          {sidebarOpen && <div className="brand-title">Attendance Admin</div>}
        </div>
        <nav className="nav">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`nav-item ${active === id && (id !== "employees" || selectedRole === "all") ? "active" : ""}`}
              onClick={() => {
                setActive(id);
                if (id === "employees") setSelectedRole("all");
                if (id === "leave") setSelectedLeaveRole(null);
              }}
            >
              <Icon size={18} />
              {sidebarOpen && <span>{label}</span>}
            </button>
          ))}
          {sidebarOpen && <div className="nav-group">Teams</div>}
          {roleCards.map((item) => (
            <button
              key={item.role}
              className={`nav-item ${active === "employees" && selectedRole === item.role ? "active" : ""}`}
              onClick={() => {
                setSelectedRole(item.role);
                setActive("employees");
              }}
            >
              <span className="role-dot" style={{ background: item.color }} />
              {sidebarOpen && <span>{item.label}</span>}
            </button>
          ))}
        </nav>
        <div className="brand" style={{ borderTop: "1px solid var(--border)", borderBottom: 0 }}>
          <div className="avatar">AD</div>
          {sidebarOpen && (
            <div>
              <div style={{ color: "#e8eeff", fontWeight: 800, fontSize: 12 }}>{adminUser.username}</div>
              <div className="brand-sub">{adminUser.email}</div>
            </div>
          )}
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <button className="icon-btn" onClick={() => setSidebarOpen((v) => !v)}>{sidebarOpen ? <X size={18} /> : <Menu size={18} />}</button>
          <div style={{ flex: 1 }}>
            <h1 className="page-title">{navItems.find((n) => n.id === active)?.label}</h1>
            <p className="page-sub">{new Date().toLocaleDateString(undefined, { weekday: "long", day: "2-digit", month: "long", year: "numeric" })} - {message}</p>
          </div>
          <div style={{ position: "relative" }}>
            <Search size={15} style={{ position: "absolute", left: 12, top: 13, color: "var(--muted-foreground)" }} />
            <input className="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search employees..." style={{ paddingLeft: 36 }} />
          </div>
          <button className="theme-toggle" onClick={() => setDark((v) => !v)}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button>
          <button className="icon-btn" onClick={handleLogout} title="Logout"><LogOut size={17} /></button>
        </header>

        <section className="content">
          {active === "dashboard" && (
            <div className="grid dashboard-page">
              <div className="grid stats-grid">
                <StatCard icon={Users} label="Total Employees" value={`${summary?.totalEmployees ?? 0}`} sub="All SRV roles" color="#6366F1" />
                <StatCard icon={CheckCircle} label="Present Today" value={`${summary?.presentToday ?? 0}`} sub="Checked or completed" color="#34D399" />
                <StatCard icon={Clock} label="On Duty Now" value={`${summary?.checkedInNow ?? 0}`} sub="Checked in, not out" color="#22D3EE" />
                <StatCard icon={Wallet} label="30 Day Payroll" value={money(totalPayroll)} sub="Calculated from attendance" color="#F59E0B" />
              </div>
              <div className="grid stats-grid">
                {roleCards.map((item) => (
                  <button
                    key={item.role}
                    className="card role-card"
                    onClick={() => {
                      setSelectedRole(item.role);
                      setActive("employees");
                    }}
                  >
                    <span className="role-card-icon" style={{ background: `${item.color}18`, color: item.color }}>
                      <Users size={20} />
                    </span>
                    <span className="role-card-value">{summary?.roleCounts?.[item.role] ?? 0}</span>
                    <span className="role-card-label">{item.label}</span>
                  </button>
                ))}
              </div>

              <div className="grid two-grid">
                <div className="card card-pad">
                  <div className="section-head">
                    <h2 className="card-title">Attendance Trend</h2>
                    <span className="role-pill">Last 14 records</span>
                  </div>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={dailyData}>
                      <CartesianGrid stroke="rgba(99,102,241,.12)" vertical={false} />
                      <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={12} />
                      <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                      <Tooltip />
                      <Bar dataKey="present" stackId="a" fill="#34D399" radius={[8, 8, 0, 0]} />
                      <Bar dataKey="half" stackId="a" fill="#F59E0B" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="card card-pad">
                  <div className="section-head">
                    <h2 className="card-title">Role Split</h2>
                  </div>
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={roleData} dataKey="value" nameKey="name" outerRadius={90}>
                        {roleData.map((_, i) => <Cell key={i} fill={chartColors[i % chartColors.length]} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {active === "employees" && (
            <div className="grid">
              <div className="card">
                <div className="card-pad section-head">
                  <h2 className="card-title">{selectedRole === "all" ? "Employees" : roleLabels[selectedRole]}</h2>
                  <div className="controls">
                    <button className={`btn secondary ${selectedRole === "all" ? "soft-active" : ""}`} onClick={() => setSelectedRole("all")}>All</button>
                    <ExportMenu title="Employees" fileName="employees" rows={employeeExportRows} />
                    <span className="role-pill">{filteredEmployees.length} shown</span>
                  </div>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Employee</th><th>Role</th><th>Phone</th><th>Basic Pay</th><th>Advance</th><th>Hour Deduction</th><th>Per Day</th><th>Per Hour</th><th>Action</th></tr></thead>
                    <tbody>
                      {paginatedEmployees.map((e) => (
                        <tr key={e.id}>
                          <td><div className="employee-cell"><div className="avatar">{e.avatarColorSeed}</div><div><strong>{e.name}</strong><div className="muted">{e.employeeCode}</div></div></div></td>
                          <td>{roleLabels[e.role]}</td>
                          <td>{e.phone}</td>
                          <td>{money(e.monthlySalary)}</td>
                          <td><span className={Number(e.advanceMoney ?? 0) > 0 ? "advance-money-text" : "muted"}>{money(Number(e.advanceMoney ?? 0))}</span></td>
                                                    <td><span className={Number(e.workingHourDeductionMinutes ?? 0) > 0 ? "deduction-text" : "muted"}>{formatHours(e.workingHourDeductionMinutes ?? 0)}</span></td>
                          <td>{money(e.perDaySalary)}</td>
                          <td>{money(Math.round(e.perDaySalary / 9))}</td>
                          <td>
                            <div className="controls">
                              <button className="icon-action" onClick={() => openEmployeeEdit(e)} title="Edit employee"><Pencil size={15} /></button>
                              <button className="icon-action danger-btn" onClick={() => deleteEmployee(e)} title="Delete employee"><Trash2 size={15} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <PaginationBar total={filteredEmployees.length} page={safeEmployeePage} pageCount={employeePageCount} pageSize={EMPLOYEE_PAGE_SIZE} onPage={setEmployeePage} />
              </div>
            </div>
          )}


          {active === "fieldTracking" && (
            <div className="grid field-tracking-grid">
              <div className="grid stats-grid">
                <StatCard icon={MapPin} label="Field Employees" value={`${fieldLocations.length}`} sub="Sales / Field Team only" color="#F59E0B" />
                <StatCard icon={Navigation} label="On Duty Now" value={`${onDutyFieldLocations.length}`} sub="Checked in and trackable" color="#22D3EE" />
                <StatCard icon={CheckCircle} label="Location Available" value={`${locatedFieldLocations.length}`} sub="GPS received by backend" color="#34D399" />
                <StatCard icon={RefreshCw} label="Auto Refresh" value="5 sec" sub="Admin map sync interval" color="#6366F1" />
              </div>

              <div className="field-map-layout">
                <div className="card card-pad field-map-card">
                  <div className="section-head">
                    <div>
                      <h2 className="card-title">Live Field Map</h2>
                      <p className="muted">Current location updates from checked-in Sales / Field employees.</p>
                    </div>
                    <button className="btn secondary" onClick={loadAll}><RefreshCw size={15} /> Refresh</button>
                  </div>
                  {selectedFieldLocation && hasCoordinates(selectedFieldLocation) ? (
                    <>
                      <iframe
                        className="field-map"
                        src={openStreetMapEmbed(selectedFieldLocation)}
                        loading="lazy"
                        title={`${selectedFieldLocation.employee.name} live location`}
                      />
                      <div className="map-focus-card">
                        <div className="employee-cell">
                          <div className="avatar">{selectedFieldLocation.employee.avatarColorSeed}</div>
                          <div>
                            <strong>{selectedFieldLocation.employee.name}</strong>
                            <div className="muted">{selectedFieldLocation.employee.employeeCode}</div>
                          </div>
                        </div>
                        <div className="controls">
                          <span className={`badge ${selectedFieldLocation.isOnDuty ? "present" : "pending"}`}>{selectedFieldLocation.isOnDuty ? "On duty" : "Off duty"}</span>
                          <a className="btn secondary map-link" href={externalMapLink(selectedFieldLocation)} target="_blank" rel="noreferrer">Open Map</a>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="empty-map-state">
                      <MapPin size={42} />
                      <h3>No live field location yet</h3>
                      <p className="muted">Ask a Sales / Field employee to login, check in, and keep location permission enabled.</p>
                    </div>
                  )}
                </div>

                <div className="card card-pad field-list-card">
                  <div className="section-head"><h2 className="card-title">Sales / Field Team</h2><div className="controls"><ExportMenu title="Field Tracking" fileName="field-tracking" rows={fieldExportRows} /><span className="role-pill">{fieldLocations.length} employees</span></div></div>
                  <div className="field-location-list">
                    {paginatedFieldLocations.map((location) => (
                      <button
                        key={location.employee.id}
                        className={`field-location-item ${selectedFieldLocation?.employee.id === location.employee.id ? "active" : ""}`}
                        onClick={() => setSelectedFieldId(location.employee.id)}
                      >
                        <div className="employee-cell">
                          <div className="avatar">{location.employee.avatarColorSeed}</div>
                          <div>
                            <strong>{location.employee.name}</strong>
                            <div className="muted">{location.employee.phone || location.employee.employeeCode}</div>
                          </div>
                        </div>
                        <span className={`badge ${location.isOnDuty ? "present" : "pending"}`}>{location.isOnDuty ? "On duty" : "Off duty"}</span>
                        <div className="field-address"><MapPin size={14} /> {location.address ?? "Location not received"}</div>
                        <div className="field-meta">{locationFreshness(location.locationUpdatedAt)}{location.checkInTime ? ` - In ${formatTime(location.checkInTime)}` : ""}</div>
                        <button className="btn secondary location-request-btn" onClick={(event) => { event.stopPropagation(); requestFieldLocation(location); }}><MapPin size={15} /> Turn On Location</button>
                      </button>
                    ))}
                    {fieldLocations.length === 0 && <div className="muted">No Sales / Field employees found.</div>}
                  </div>
                  <PaginationBar total={fieldLocations.length} page={safeFieldPage} pageCount={fieldPageCount} pageSize={CARD_PAGE_SIZE} onPage={setFieldPage} />
                </div>
              </div>
            </div>
          )}
          {active === "attendance" && (
            <div className="card">
              <div className="card-pad section-head"><h2 className="card-title">Attendance Control</h2><div className="controls"><ExportMenu title="Attendance Control" fileName="attendance" rows={attendanceExportRows} /><span className="role-pill">Last 30 days</span></div></div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Date</th><th>Employee</th><th>Status</th><th>In</th><th>Out</th><th>Total Hours</th></tr></thead>
                  <tbody>
                    {paginatedAttendance.map((r) => (
                      <tr key={r.id}>
                        <td>{r.dateKey}</td>
                        <td>{r.employee?.name ?? r.employeeId}</td>
                        <td><StatusBadge status={r.status} /></td>
                        <td>{formatTime(r.checkInTime)}</td>
                        <td>{formatTime(r.checkOutTime)}</td>
                        <td>{formatHours(r.workedMinutes)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <PaginationBar total={attendance.length} page={safeAttendancePage} pageCount={attendancePageCount} pageSize={TABLE_PAGE_SIZE} onPage={setAttendancePage} />
            </div>
          )}

          {active === "salary" && (
            <div className="card">
              <div className="card-pad section-head"><h2 className="card-title">Salary Report</h2><div className="controls"><ExportMenu title="Salary Report" fileName="salary" rows={salaryExportRows} /><span className="role-pill">{money(totalPayroll)} total</span></div></div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Employee</th><th>Attendance</th><th>Present</th><th>Earned</th><th>Overtime</th><th>Advance</th><th>Hour Deduction</th><th>Gross</th><th>Net Payable</th></tr></thead>
                  <tbody>
                    {paginatedSalary.map(({ employee, salary: s }) => (
                      <tr key={employee.id}>
                        <td><div className="employee-cell"><div className="avatar">{employee.avatarColorSeed}</div>{employee.name}</div></td>
                        <td>{s.attendancePercent}%</td>
                        <td>{s.presentDays}</td>
                        <td>{money(s.earnedBasic)}</td>
                        <td>{money(s.overtimeBonus)}</td>
                        <td><span className="advance-money-text">-{money(s.advanceMoney ?? employee.advanceMoney ?? 0)}</span></td>
                                                <td><span className={Number(s.workingHourDeductionMinutes ?? employee.workingHourDeductionMinutes ?? 0) > 0 ? "deduction-text" : "muted"} title={s.workingHourDeductionReason ?? employee.workingHourDeductionReason ?? ""}>{formatHours(s.workingHourDeductionMinutes ?? employee.workingHourDeductionMinutes ?? 0)}</span></td>
                        <td>{money(s.grossPayable ?? s.earnedBasic + s.overtimeBonus)}</td>
                        <td><strong>{money(s.netPayable)}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <PaginationBar total={salary.length} page={safeSalaryPage} pageCount={salaryPageCount} pageSize={TABLE_PAGE_SIZE} onPage={setSalaryPage} />
            </div>
          )}

          {active === "leave" && (
            <div className="grid">
              <div className="grid stats-grid">
                {roleCards.map((item) => (
                  <button
                    key={item.role}
                    className={`card role-card ${selectedLeaveRole === item.role ? "selected-role-card" : ""}`}
                    onClick={() => setSelectedLeaveRole(item.role)}
                  >
                    <span className="role-card-icon" style={{ background: `${item.color}18`, color: item.color }}>
                      <ClipboardCheck size={20} />
                    </span>
                    <span className="role-card-value">{leaveRoleCounts[item.role] ?? 0}</span>
                    <span className="role-card-label">{item.label}</span>
                  </button>
                ))}
              </div>
              <div className="card">
                <div className="card-pad section-head">
                  <h2 className="card-title">{selectedLeaveRole ? roleLabels[selectedLeaveRole] : "All Leave Requests"}</h2>
                  <div className="controls">
                    <button className={`btn secondary ${!selectedLeaveRole ? "soft-active" : ""}`} onClick={() => setSelectedLeaveRole(null)}>All</button>
                    <ExportMenu title="Leave Requests" fileName="leave-requests" rows={leaveExportRows} />
                    <span className="role-pill">{filteredLeaves.length} requests</span>
                  </div>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Employee</th><th>Role</th><th>Leave Date</th><th>Requested On</th><th>Message</th><th>Status</th><th>Response</th></tr></thead>
                    <tbody>
                      {paginatedLeaves.map((request) => (
                        <tr key={request.id}>
                          <td><div className="employee-cell"><div className="avatar">{request.employee?.avatarColorSeed ?? "SR"}</div><div><strong>{request.employee?.name ?? request.employeeId}</strong><div className="muted">{request.employee?.employeeCode ?? "Employee"}</div></div></div></td>
                          <td>{roleLabels[request.role]}</td>
                          <td>{request.leaveDate}</td>
                          <td>{new Date(request.createdAt).toLocaleString([], { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                          <td>
                            <button className="message-open-btn" onClick={() => setSelectedLeaveMessage(request)}>
                              <Eye size={15} /> Open Message
                            </button>
                          </td>
                          <td><StatusBadge status={request.status} /></td>
                          <td>
                            <div className="controls">
                              <button className="btn approve-btn" disabled={request.status === "approved"} onClick={() => respondLeave(request, "approved")}>Approve</button>
                              <button className="btn reject-btn" disabled={request.status === "rejected"} onClick={() => respondLeave(request, "rejected")}>Reject</button>
                            </div>
                            {request.adminResponse && <div className="muted" style={{ marginTop: 6 }}>{request.adminResponse}</div>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <PaginationBar total={filteredLeaves.length} page={safeLeavePage} pageCount={leavePageCount} pageSize={TABLE_PAGE_SIZE} onPage={setLeavePage} />
              </div>
            </div>
          )}

          {active === "community" && (
            <div className="grid two-grid">
              <div className="card card-pad">
                <h2 className="card-title">Send Company Update</h2>
                <div className="grid form-grid" style={{ marginTop: 14 }}>
                  <select className="select" value={postDraft.type} onChange={(e) => setPostDraft({ ...postDraft, type: e.target.value as CommunityPost["type"] })}>
                    <option value="notice">Notice</option>
                    <option value="task">Task</option>
                    <option value="info">Information</option>
                  </select>
                  <input className="input" value={postDraft.audience} onChange={(e) => setPostDraft({ ...postDraft, audience: e.target.value })} />
                </div>
                <input className="input" style={{ marginTop: 12 }} placeholder="Title" value={postDraft.title} onChange={(e) => setPostDraft({ ...postDraft, title: e.target.value })} />
                <textarea className="textarea" style={{ marginTop: 12 }} placeholder="Message for app community section" value={postDraft.body} onChange={(e) => setPostDraft({ ...postDraft, body: e.target.value })} />
                <div className="controls" style={{ marginTop: 12, alignItems: "center" }}>
                  <label><input type="checkbox" checked={postDraft.isPublished} onChange={(e) => setPostDraft({ ...postDraft, isPublished: e.target.checked })} /> Publish now</label>
                  <button className="btn" onClick={savePost}>Send to App</button>
                </div>
              </div>
              <div className="card card-pad">
                <div className="section-head"><h2 className="card-title">Community Feed</h2><div className="controls"><ExportMenu title="Community Feed" fileName="community-feed" rows={communityExportRows} /><span className="role-pill">{community.length} posts</span></div></div>
                <div className="community-list">
                  {paginatedCommunity.map((post) => (
                    <div className="community-item" key={post.id}>
                      <div className="section-head" style={{ marginBottom: 8 }}>
                        <span className={`badge ${post.type}`}>{post.type}</span>
                        <span className={`badge ${post.isPublished ? "published" : "draft"}`}>{post.isPublished ? "Published" : "Draft"}</span>
                      </div>
                      <strong>{post.title}</strong>
                      <p className="muted">{post.body}</p>
                      <div className="controls">
                        <button className="btn secondary" onClick={() => togglePost(post)}>{post.isPublished ? "Unpublish" : "Publish"}</button>
                        <button className="btn secondary" onClick={() => removePost(post)}>Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
                <PaginationBar total={community.length} page={safeCommunityPage} pageCount={communityPageCount} pageSize={CARD_PAGE_SIZE} onPage={setCommunityPage} />
              </div>
            </div>
          )}

          {active === "settings" && (
            <div className="settings-grid">
              <div className="card card-pad">
                <h2 className="card-title">App Management</h2>
                <p className="muted">Manage attendance rules, payroll behavior, employee sync, and app announcements.</p>
                <div className="controls">
                  <button className="btn" onClick={loadAll}>Refresh Data</button>
                  <button className="btn secondary" onClick={() => setDark((v) => !v)}>{dark ? "Switch Light Mode" : "Switch Dark Mode"}</button>
                </div>
                <div className="grid stats-grid" style={{ marginTop: 18 }}>
                  <StatCard icon={Shield} label="Employee Sync" value="5 sec" sub="Profile and attendance refresh automatically" color="#6366F1" />
                  <StatCard icon={BarChart3} label="Payroll Rule" value="30 Days" sub="Per-day pay updates from Basic Pay / 30" color="#22D3EE" />
                  <StatCard icon={Bell} label="Community Feed" value="Live" sub="Published notices appear in employee profiles" color="#34D399" />
                  <StatCard icon={Settings} label="Current Theme" value={dark ? "Dark" : "Light"} sub="Admin display preference" color="#F59E0B" />
                </div>
              </div>
              <div className="card card-pad">
                <div className="section-head"><h2 className="card-title">Create Admin</h2><span className="role-pill">Secure access</span></div>
                <p className="muted">Add another admin who can login with username or email.</p>
                <div className="grid form-grid" style={{ marginTop: 16 }}>
                  <input className="input" value={adminDraft.username} onChange={(e) => setAdminDraft({ ...adminDraft, username: e.target.value })} placeholder="Admin username" />
                  <input className="input" type="email" value={adminDraft.email} onChange={(e) => setAdminDraft({ ...adminDraft, email: e.target.value })} placeholder="Admin email" />
                  <div className="password-wrap wide-field">
                    <input className="input password-input" type={adminPasswordVisible ? "text" : "password"} value={adminDraft.password} onChange={(e) => setAdminDraft({ ...adminDraft, password: e.target.value })} placeholder="Password minimum 8 digits" />
                    <button className="password-eye" type="button" onClick={() => setAdminPasswordVisible((v) => !v)}>{adminPasswordVisible ? <EyeOff size={17} /> : <Eye size={17} />}</button>
                  </div>
                </div>
                <button className="btn" style={{ marginTop: 14 }} onClick={createSettingsAdmin}>Create Admin</button>
              </div>
            </div>
          )}
        </section>
      </main>

      {selectedLeaveMessage && (
        <div className="modal-overlay" onClick={() => setSelectedLeaveMessage(null)}>
          <div className="message-detail card card-pad" onClick={(event) => event.stopPropagation()}>
            <div className="section-head">
              <div>
                <h2 className="card-title">Leave Message</h2>
                <p className="muted">{selectedLeaveMessage.employee?.name ?? selectedLeaveMessage.employeeId} - {selectedLeaveMessage.leaveDate}</p>
              </div>
              <button className="icon-btn" onClick={() => setSelectedLeaveMessage(null)}><X size={16} /></button>
            </div>
            <div className="message-body-box">{selectedLeaveMessage.message}</div>
            {selectedLeaveMessage.adminResponse && <div className="message-response-box"><strong>Admin response:</strong> {selectedLeaveMessage.adminResponse}</div>}
            <div className="controls" style={{ marginTop: 16 }}>
              <button className="btn approve-btn" disabled={selectedLeaveMessage.status === "approved"} onClick={() => respondLeave(selectedLeaveMessage, "approved")}>Approve</button>
              <button className="btn reject-btn" disabled={selectedLeaveMessage.status === "rejected"} onClick={() => respondLeave(selectedLeaveMessage, "rejected")}>Reject</button>
            </div>
          </div>
        </div>
      )}
      {employeeDraft && (
        <div className="modal-overlay" onClick={closeEmployeeEdit}>
          <div className="edit-modal card card-pad" onClick={(event) => event.stopPropagation()}>
            <div className="section-head">
              <h2 className="card-title">Edit Employee</h2>
              <button className="icon-btn" onClick={closeEmployeeEdit}><X size={16} /></button>
            </div>
            <div className="grid form-grid">
              <label className="field-label">Employee name<input className="input" value={employeeDraft.name ?? ""} onChange={(e) => setEmployeeDraft({ ...employeeDraft, name: e.target.value })} placeholder="Enter employee full name" /></label>
              <label className="field-label">Mobile number<input className="input" value={employeeDraft.phone ?? ""} onChange={(e) => setEmployeeDraft({ ...employeeDraft, phone: e.target.value.replace(/\D/g, "").slice(0, 10) })} placeholder="Enter 10 digit mobile number" /></label>
              <label className="field-label">Email optional<input className="input" value={employeeDraft.email ?? ""} onChange={(e) => setEmployeeDraft({ ...employeeDraft, email: e.target.value })} placeholder="Enter email address" /></label>
              <label className="field-label">Basic pay<input className="input" type="number" value={employeeDraft.monthlySalary ?? ""} onChange={(e) => setEmployeeDraft({ ...employeeDraft, monthlySalary: Number(e.target.value) || 0 })} placeholder="Enter monthly basic pay" /></label>
              <label className="field-label">Advance money / borrowing<input className="input" type="number" min="0" value={employeeDraft.advanceMoney ?? ""} onChange={(e) => setEmployeeDraft({ ...employeeDraft, advanceMoney: Math.max(0, Number(e.target.value) || 0) })} placeholder="Example: 2000" /></label>
              <label className="field-label">Deduct working time<input className="input" inputMode="decimal" value={deductionInput} onChange={(e) => { const value = e.target.value.replace(/[^0-9.:]/g, ""); setDeductionInput(value); setEmployeeDraft({ ...employeeDraft, workingHourDeductionMinutes: parseDeductionInput(value) }); }} placeholder="Example: 2.37 means 2h 37m" /></label>
              <label className="field-label wide-field">Deduction reason<textarea className="textarea" value={employeeDraft.workingHourDeductionReason ?? ""} onChange={(e) => setEmployeeDraft({ ...employeeDraft, workingHourDeductionReason: e.target.value })} placeholder="Write reason for working hour deduction" /></label>
            </div>
            <div className="salary-preview">
              <span>Per day: <strong>{money(Math.round(Number(employeeDraft.monthlySalary ?? 0) / 30))}</strong></span>
              <span>Per hour: <strong>{money(Math.round(Number(employeeDraft.monthlySalary ?? 0) / 30 / 9))}</strong></span>
              <span>Advance: <strong className="advance-money-text">{money(Number(employeeDraft.advanceMoney ?? 0))}</strong></span>
                          <span>Hour deduction: <strong className="deduction-text">{formatHours(employeeDraft.workingHourDeductionMinutes ?? 0)}</strong></span>
            </div>
            <button className="btn" onClick={saveEmployee}>Update Employee</button>
          </div>
        </div>
      )}
      {success && <div className="success-toast">{success}</div>}
    </div>
  );
}
