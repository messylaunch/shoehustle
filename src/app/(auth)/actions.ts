"use server";

import { redirect } from "next/navigation";
import {
  authenticate,
  createSession,
  createUser,
  destroySession,
  hasAnyUser,
  passwordProblem,
} from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const user = await authenticate(email, password);
  if (!user) redirect("/login?error=bad");

  await createSession(user.id);
  redirect("/app");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

/**
 * First-run account creation. Only works while there are no users, so this
 * can't be used to mint an admin later.
 */
export async function setupAction(formData: FormData) {
  if (await hasAnyUser()) redirect("/login");

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!name || !email) redirect("/setup?error=missing");

  const problem = passwordProblem(password);
  if (problem) redirect(`/setup?error=${encodeURIComponent(problem)}`);

  const user = await createUser({ email, password, name, role: "ADMIN" });
  await createSession(user.id);
  redirect("/app/guide");
}

/** Accepting an invite: the code is the proof, so no login is needed first. */
export async function acceptInviteAction(formData: FormData) {
  const code = String(formData.get("code") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const invite = await prisma.invite.findUnique({ where: { code } });
  if (!invite || invite.usedAt) redirect("/join?error=badcode");

  const problem = passwordProblem(password);
  if (problem) {
    redirect(`/join?code=${encodeURIComponent(code)}&error=${encodeURIComponent(problem)}`);
  }

  const existing = await prisma.user.findUnique({
    where: { email: invite.email.toLowerCase() },
  });
  if (existing) redirect("/login?error=exists");

  const user = await createUser({
    email: invite.email,
    password,
    name: invite.name,
    role: invite.role,
  });

  await prisma.invite.update({
    where: { id: invite.id },
    data: { usedAt: new Date() },
  });

  await createSession(user.id);
  redirect("/app/guide");
}
