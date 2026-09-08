import Link from "next/link";
import type { ReactNode } from "react";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { logoutAction } from "../(auth)/actions";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireUser();
  const settings = await getSettings();

  return (
    <>
      <div className="topbar">
        <div className="topbar-inner">
          <Link href="/app" className="brand">
            {settings.shopName}
          </Link>
          <nav>
            <Link href="/app/price">Price a pair</Link>
            <Link href="/app/inventory">Inventory</Link>
            <Link href="/app/orders">Orders</Link>
            <Link href="/app/leads">Leads</Link>
            <Link href="/app/drops">Drops</Link>
            <Link href="/app/network">Network</Link>
            <Link href="/app/playbook">Playbook</Link>
            <Link href="/app/settings">Settings</Link>
            {user.role === "ADMIN" ? (
              <Link href="/app/sellers">Sellers</Link>
            ) : null}
            <Link href="/" target="_blank">
              View shop
            </Link>
            <form action={logoutAction} style={{ display: "inline" }}>
              <button
                type="submit"
                style={{
                  background: "none",
                  border: 0,
                  color: "inherit",
                  font: "inherit",
                  fontSize: "0.9rem",
                  cursor: "pointer",
                  padding: 0,
                  textDecoration: "underline",
                }}
              >
                Sign out
              </button>
            </form>
          </nav>
        </div>
      </div>
      <div className="wrap">{children}</div>
    </>
  );
}
