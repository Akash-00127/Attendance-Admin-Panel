import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SRV Attendance Admin",
  description: "Admin panel for SRV attendance, payroll, employees, and community updates.",
  icons: {
    icon: "/favicon.png",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
