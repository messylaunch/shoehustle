import Link from "next/link";
import { redirect } from "next/navigation";
import { Notice } from "@/components/ui";
import { currentUser, hasAnyUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { loginAction } from "../actions";

export const metadata = { title: "Seller login" };
export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  // A fresh install has no accounts yet, so send the first visitor to setup.
  if (!(await hasAnyUser())) redirect("/setup");
  if (await currentUser()) redirect("/app");

  const { error } = await searchParams;
  const settings = await getSettings();

  return (
    <div className="wrap wrap-narrow" style={{ paddingTop: "3rem" }}>
      <h1>{settings.shopName}</h1>
      <p className="muted">Seller login</p>

      {error === "bad" ? (
        <Notice kind="bad">That email and password don't match.</Notice>
      ) : null}
      {error === "exists" ? (
        <Notice kind="warn">
          There's already an account on that email. Sign in instead.
        </Notice>
      ) : null}

      <div className="card" style={{ marginTop: "1rem" }}>
        <form action={loginAction}>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              name="email"
              required
              autoComplete="email"
              autoFocus
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              name="password"
              required
              autoComplete="current-password"
            />
          </div>
          <button className="btn btn-primary btn-block" type="submit">
            Sign in
          </button>
        </form>
      </div>

      <p className="small" style={{ marginTop: "1rem" }}>
        <Link href="/">← Back to the shop</Link>
        {" · "}
        <Link href="/join">I have an invite code</Link>
      </p>
    </div>
  );
}
