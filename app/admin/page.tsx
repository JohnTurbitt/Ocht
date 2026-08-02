import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdminFromCookies } from "@/lib/apiAuth";
import { AdminDashboard } from "@/components/AdminDashboard";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const admin = await requireAdminFromCookies();

  if (!admin) {
    notFound();
  }

  return <AdminDashboard />;
}
