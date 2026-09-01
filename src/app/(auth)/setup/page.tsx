import { redirect } from "next/navigation";
import { Notice } from "@/components/ui";
import { hasAnyUser } from "@/lib/auth";
import { setupAction } from "../actions";

export const metadata = { title: "Set up your shop" };
export const dynamic = "force-dynamic";

// First run. This page disappears the moment an account exists.

export default async function SetupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await hasAnyUser()) redirect("/login");
  const { error } = await searchParams;

  return (
    <div className="wrap wrap-narrow" style={{ paddingTop: "3rem" }}>
      <h1>Set up your shop</h1>
      <p className="muted">
        This is the only account that can invite other sellers, so make it
        yours.
      </p>

      {error ? (
        <Notice kind="bad">
          {error === "missing"
            ? "I need a name and an email."
            : decodeURIComponent(error)}
        </Notice>
      ) : null}

      <div className="card" style={{ marginTop: "1rem" }}>
        <form action={setupAction}>
          <div className="field">
            <label htmlFor="name">Your name</label>
            <input id="name" type="text" name="name" required autoFocus />
          </div>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              name="email"
              required
              autoComplete="email"
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              name="password"
              required
              minLength={8}
              autoComplete="new-password"
            />
            <div className="hint">At least 8 characters.</div>
          </div>
          <button className="btn btn-primary btn-block" type="submit">
            Create my shop
          </button>
        </form>
      </div>

      <p className="tiny" style={{ marginTop: "1rem" }}>
        Nothing is sent anywhere. This account lives in the SQLite file next to
        the app.
      </p>
    </div>
  );
}
