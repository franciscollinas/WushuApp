"use client";

import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const esLogin = pathname === "/login";

  if (esLogin) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen">
      <Sidebar />
      <main className="pb-16 pl-16 lg:pl-56">
        <div className="mx-auto max-w-7xl px-4 py-8 lg:px-8">{children}</div>
      </main>
    </div>
  );
}