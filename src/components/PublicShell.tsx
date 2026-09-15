import Link from "next/link";
import type { ReactNode } from "react";
import { getSettings } from "@/lib/settings";

export default async function PublicShell({
  children,
}: {
  children: ReactNode;
}) {
  const settings = await getSettings();

  return (
    <>
      <div className="topbar">
        <div className="topbar-inner">
          <Link href="/" className="brand">
            {settings.shopName}
          </Link>
          <nav>
            <Link href="/">Shop</Link>
            <Link href="/trade">Sell or trade</Link>
            <Link href="/restoration">Restore my pair</Link>
            <Link href="/login">Seller login</Link>
          </nav>
        </div>
      </div>
      <div className="wrap">{children}</div>
      <div className="wrap" style={{ paddingTop: 0 }}>
        <div className="footer">
          {settings.contactLine}
          <br />
          {settings.shopName}
        </div>
      </div>
    </>
  );
}
