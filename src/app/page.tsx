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
  Clock,
  LayoutDashboard,
  Menu,
  Moon,
  Pencil,
  Search,
  Settings,
  Shield,
  Sun,
  Trash2,
  Users,
  Wallet,
  X,
} from "lucide-react";

import { api, AttendanceRecord, CommunityPost, Employee, SalaryRow, Summary } from "@/lib/api";

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "employees", label: "Employees", icon: Users },
  { id: "attendance", label: "Attendance", icon: CalendarCheck },
  { id: "salary", label: "Salary", icon: Wallet },
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

export default function AdminPanel() {
  const [active, setActive] = useState<(typeof navItems)[number]["id"]>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [dark, setDark] = useState(false);
  const [query, setQuery] = useState("");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [salary, setSalary] = useState<SalaryRow[]>([]);
  const [community, setCommunity] = useState<CommunityPost[]>([]);
  const [employeeDraft, setEmployeeDraft] = useState<Partial<Employee> | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>("all");
  const [success, setSuccess] = useState("");
  const [postDraft, setPostDraft] = useState({ type: "notice" as CommunityPost["type"], title: "", body: "", audience: "All Teams", isPublished: true });
  const [message, setMessage] = useState("Loading backend data...");

  const loadAll = async () => {
    try {
      setMessage("Loading backend data...");
      const [nextSummary, nextEmployees, nextAttendance, nextSalary, nextCommunity] = await Promise.all([
        api.summary(),
        api.employees(),
        api.attendance(30),
        api.salary(30),
        api.community(),
      ]);
      setSummary(nextSummary);
      setEmployees(nextEmployees);
      setAttendance(nextAttendance);
      setSalary(nextSalary);
      setCommunity(nextCommunity);
      setMessage("Synced with SRV backend");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unable to connect to backend");
    }
  };

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    const moveGlow = (event: MouseEvent) => {
      document.querySelectorAll<HTMLElement>(".card").forEach((card) => {
        const rect = card.getBoundingClientRect();
        card.style.setProperty("--mx", `${event.clientX - rect.left}px`);
        card.style.setProperty("--my", `${event.clientY - rect.top}px`);
      });
    };
    window.addEventListener("mousemove", moveGlow);
    return () => window.removeEventListener("mousemove", moveGlow);
  }, []);

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

  return (
    <div className="app-shell">
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
              <div style={{ color: "#e8eeff", fontWeight: 800, fontSize: 12 }}>Admin User</div>
              <div className="brand-sub">admin@srv.local</div>
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
        </header>

        <section className="content">
          {active === "dashboard" && (
            <div className="grid">
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
                    <thead><tr><th>Employee</th><th>Role</th><th>Phone</th><th>Basic Pay</th><th>Per Day</th><th>Per Hour</th><th>Action</th></tr></thead>
                    <tbody>
                      {filteredEmployees.map((e) => (
                        <tr key={e.id}>
                          <td><div className="employee-cell"><div className="avatar">{e.avatarColorSeed}</div><div><strong>{e.name}</strong><div className="muted">{e.employeeCode}</div></div></div></td>
                          <td>{roleLabels[e.role]}</td>
                          <td>{e.phone}</td>
                          <td>{money(e.monthlySalary)}</td>
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
                  <thead><tr><th>Employee</th><th>Attendance</th><th>Present</th><th>Half</th><th>Earned</th><th>Overtime</th><th>Net Payable</th></tr></thead>
                  <tbody>
                    {salary.map(({ employee, salary: s }) => (
                      <tr key={employee.id}>
                        <td><div className="employee-cell"><div className="avatar">{employee.avatarColorSeed}</div>{employee.name}</div></td>
                        <td>{s.attendancePercent}%</td>
                        <td>{s.presentDays}</td>
                        <td>{s.halfDays}</td>
                        <td>{money(s.earnedBasic)}</td>
                        <td>{money(s.overtimeBonus)}</td>
                        <td><strong>{money(s.netPayable)}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
          )}
        </section>
      </main>
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
            </div>
            <div className="salary-preview">
              <span>Per day: <strong>{money(Math.round(Number(employeeDraft.monthlySalary ?? 0) / 30))}</strong></span>
              <span>Per hour: <strong>{money(Math.round(Number(employeeDraft.monthlySalary ?? 0) / 30 / 9))}</strong></span>
            </div>
            <button className="btn" onClick={saveEmployee}>Update Employee</button>
          </div>
        </div>
      )}
      {success && <div className="success-toast">{success}</div>}
    </div>
  );
}
