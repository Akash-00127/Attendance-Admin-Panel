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
  accountant: "Account Team",
  sales_field: "Sales Field",
  factory_worker: "Factory Team",
  it_team: "IT Team",
};

const chartColors = ["#6366F1", "#22D3EE", "#34D399", "#F59E0B"];
const roleCards = [
  { role: "accountant", label: "Account Team", color: "#6366F1" },
  { role: "it_team", label: "IT Team", color: "#22D3EE" },
  { role: "factory_worker", label: "Factory Team", color: "#34D399" },
  { role: "sales_field", label: "Sales / Field Team", color: "#F59E0B" },
] as const;

function formatHours(minutes?: number | null) {
  if (minutes == null) return "-";
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
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
  const saveEmployee = async () => {
    if (!employeeDraft?.id) return;
    await api.updateEmployee(employeeDraft.id, employeeDraft);
    setEmployeeDraft(null);
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
          <img src="/srv-logo-white.png" alt="SRV" className="brand-logo" />
          {sidebarOpen && (
            <div>
              <div className="brand-title">SRV Admin</div>
            </div>
          )}
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
                    <span className="role-pill">{filteredEmployees.length} shown</span>
                  </div>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Employee</th><th>Role</th><th>Phone</th><th>Basic Pay</th><th>Advance</th><th>Hour Deduction</th><th>Per Day</th><th>Per Hour</th><th>Action</th></tr></thead>
                    <tbody>
                      {filteredEmployees.map((e) => (
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
                              <button className="icon-action" onClick={() => setEmployeeDraft(e)} title="Edit employee"><Pencil size={15} /></button>
                              <button className="icon-action danger-btn" onClick={() => deleteEmployee(e)} title="Delete employee"><Trash2 size={15} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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
                  <div className="section-head"><h2 className="card-title">Sales / Field Team</h2><span className="role-pill">{fieldLocations.length} employees</span></div>
                  <div className="field-location-list">
                    {fieldLocations.map((location) => (
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
                </div>
              </div>
            </div>
          )}
          {active === "attendance" && (
            <div className="card">
              <div className="card-pad section-head"><h2 className="card-title">Attendance Control</h2><span className="role-pill">Last 30 days</span></div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Date</th><th>Employee</th><th>Status</th><th>In</th><th>Out</th><th>Total Hours</th></tr></thead>
                  <tbody>
                    {attendance.map((r) => (
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
            </div>
          )}

          {active === "salary" && (
            <div className="card">
              <div className="card-pad section-head"><h2 className="card-title">Salary Report</h2><span className="role-pill">{money(totalPayroll)} total</span></div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Employee</th><th>Attendance</th><th>Present</th><th>Earned</th><th>Overtime</th><th>Advance</th><th>Hour Deduction</th><th>Gross</th><th>Net Payable</th></tr></thead>
                  <tbody>
                    {salary.map(({ employee, salary: s }) => (
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
                    <span className="role-pill">{filteredLeaves.length} requests</span>
                  </div>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Employee</th><th>Role</th><th>Leave Date</th><th>Requested On</th><th>Message</th><th>Status</th><th>Response</th></tr></thead>
                    <tbody>
                      {filteredLeaves.map((request) => (
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
                <div className="section-head"><h2 className="card-title">Community Feed</h2><span className="role-pill">{community.length} posts</span></div>
                <div className="community-list">
                  {community.map((post) => (
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
        <div className="modal-overlay" onClick={() => setEmployeeDraft(null)}>
          <div className="edit-modal card card-pad" onClick={(event) => event.stopPropagation()}>
            <div className="section-head">
              <h2 className="card-title">Edit Employee</h2>
              <button className="icon-btn" onClick={() => setEmployeeDraft(null)}><X size={16} /></button>
            </div>
            <div className="grid form-grid">
              <input className="input" value={employeeDraft.name ?? ""} onChange={(e) => setEmployeeDraft({ ...employeeDraft, name: e.target.value })} placeholder="Employee name" />
              <input className="input" value={employeeDraft.phone ?? ""} onChange={(e) => setEmployeeDraft({ ...employeeDraft, phone: e.target.value.replace(/\D/g, "").slice(0, 10) })} placeholder="Mobile number" />
              <input className="input" value={employeeDraft.email ?? ""} onChange={(e) => setEmployeeDraft({ ...employeeDraft, email: e.target.value })} placeholder="Email optional" />
              <input className="input" type="number" value={employeeDraft.monthlySalary ?? 0} onChange={(e) => setEmployeeDraft({ ...employeeDraft, monthlySalary: Number(e.target.value) })} placeholder="Basic pay" />
              <input className="input" type="number" min="0" value={employeeDraft.advanceMoney ?? 0} onChange={(e) => setEmployeeDraft({ ...employeeDraft, advanceMoney: Math.max(0, Number(e.target.value) || 0) })} placeholder="Advance money / borrowing" />
                          <input className="input" type="number" min="0" step="0.25" value={Number(employeeDraft.workingHourDeductionMinutes ?? 0) / 60} onChange={(e) => setEmployeeDraft({ ...employeeDraft, workingHourDeductionMinutes: Math.max(0, Math.round((Number(e.target.value) || 0) * 60)) })} placeholder="Deduct working hours" />
              <textarea className="textarea wide-field" value={employeeDraft.workingHourDeductionReason ?? ""} onChange={(e) => setEmployeeDraft({ ...employeeDraft, workingHourDeductionReason: e.target.value })} placeholder="Reason for working hour deduction" />
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
