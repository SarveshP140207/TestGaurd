import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";

export const metadata: Metadata = {
  title: "TestGuard | Intelligent Test Prioritization",
  description: "Identify and prioritize test cases based on codebase changes.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className="layout-container">
          <Sidebar />
          <div className="main-content">
            <Topbar />
            <main className="page-container">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
