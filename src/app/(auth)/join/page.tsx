import Link from "next/link";
import { Notice } from "@/components/ui";
import { prisma } from "@/lib/db";
import { acceptInviteAction } from "../actions";

export const metadata = { title: "Accept your invite" };
export const dynamic = "force-dynamic";

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; error?: string }>;
}) {
  const { code, error } = await searchParams;

  const invite = code
    ? await prisma.invite.findUnique({ where: { code } })
    : null;
  const valid = invite && !invite.usedAt;

  return (
    <div className="wrap wrap-narrow" style={{ paddingTop: "3rem" }}>
      <h1>Accept your invite</h1>

      {error === "badcode" ? (
        <Notice kind="bad">
          That code isn't valid, or it's already been used. Ask for a new one.
        </Notice>
      ) : error ? (
        <Notice kind="bad">{decodeURIComponent(error)}</Notice>
      ) : null}

      {valid ? (
        <>
          <p className="muted">
            Setting up an account for <strong>{invite.name}</strong> (
            {invite.email}). Pick a password and you're in.
          </p>
          <div className="card">
            <form action={acceptInviteAction}>
              <input type="hidden" name="code" value={invite.code} />
              <div className="field">
                <label htmlFor="password">Choose a password</label>
                <input
                  id="password"
                  type="password"
                  name="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  autoFocus
                />
                <div className="hint">At least 8 characters.</div>
              </div>
              <button className="btn btn-primary btn-block" type="submit">
                Create my account
              </button>
            </form>
          </div>
        </>
      ) : (
        <div className="card">
          <form method="get">
            <div className="field">
              <label htmlFor="code">Invite code</label>
              <input
                id="code"
                type="text"
                name="code"
                required
                defaultValue={code ?? ""}
                placeholder="Paste the code you were sent"
                autoFocus
              />
            </div>
            <button className="btn btn-primary btn-block" type="submit">
              Continue
            </button>
          </form>
        </div>
      )}

      <p className="small" style={{ marginTop: "1rem" }}>
        <Link href="/login">Already have an account? Sign in</Link>
      </p>
    </div>
  );
}
