import React, { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { api } from "@/lib/api";
import { isEmail } from "@/lib/utils";

function Card({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-slate-50 dark:bg-slate-950">
      <div className="max-w-md w-full mx-auto flex flex-col items-center card p-10">
        <div className="mb-8"><Logo size="md" variant="black" /></div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white text-center">{title}</h1>
        <p className="text-zinc-500 dark:text-zinc-400 mt-2 mb-8 text-center">{subtitle}</p>
        {children}
        <Link to="/login" className="mt-4 inline-block py-2 text-sm text-indigo-600 dark:text-indigo-400 font-semibold hover:underline">Back to sign in</Link>
      </div>
    </div>
  );
}

const Alert = ({ kind, children }: { kind: "error" | "ok"; children: React.ReactNode }) => (
  <div
    role={kind === "error" ? "alert" : "status"}
    className={`p-3 text-sm font-semibold rounded-xl border ${kind === "error" ? "text-red-600 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800" : "text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800"}`}
  >
    {children}
  </div>
);

// Step 1: ask for a link. The answer never says whether the email has an account.
export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!isEmail(email)) return setError("Please enter a valid email address.");
    setError("");
    setBusy(true);
    try {
      setSent((await api.forgotPassword(email)).message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send the link. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="Forgot your password?" subtitle="Enter your email and we'll send you a link to choose a new one.">
      {sent ? (
        <Alert kind="ok">{sent} Check your inbox (and spam folder). The link works for one hour.</Alert>
      ) : (
        <form onSubmit={submit} noValidate className="w-full space-y-5">
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Email Address</label>
            <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" className="block w-full input px-4 py-3 text-zinc-900 dark:text-white" />
          </div>
          {error && <Alert kind="error">{error}</Alert>}
          <button type="submit" disabled={busy} className="flex w-full justify-center items-center gap-2 btn-primary py-3.5 text-sm font-bold disabled:opacity-70">
            {busy ? "Sending…" : "Send reset link"}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      )}
    </Card>
  );
}

// Step 2: the link from the email lands here with ?token=…
export function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== confirm) return setError("The two passwords don't match.");
    setError("");
    setBusy(true);
    try {
      setDone((await api.resetPassword(token, password)).message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't change the password. Try again.");
    } finally {
      setBusy(false);
    }
  };

  if (!token) {
    return (
      <Card title="Link not complete" subtitle="This reset link is missing part of its address.">
        <Alert kind="error">Open the link straight from the email, or <Link to="/forgot-password" className="underline">ask for a new one</Link>.</Alert>
      </Card>
    );
  }

  return (
    <Card title="Choose a new password" subtitle="At least 8 characters. You'll be signed out on every device.">
      {done ? (
        <div className="w-full space-y-4">
          <Alert kind="ok">{done}</Alert>
          <Link to="/login" className="flex w-full justify-center items-center gap-2 btn-primary py-3.5 text-sm font-bold">Sign in <ArrowRight className="w-4 h-4" /></Link>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="w-full space-y-5">
          <div className="space-y-1.5">
            <label htmlFor="new-password" className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">New password</label>
            <div className="relative">
              <input id="new-password" type={show ? "text" : "password"} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="block w-full input px-4 py-3 pr-12 text-zinc-900 dark:text-white" />
              <button type="button" onClick={() => setShow(!show)} aria-label={show ? "Hide password" : "Show password"} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-zinc-400 hover:text-indigo-600">
                {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="confirm-password" className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Confirm new password</label>
            <input id="confirm-password" type={show ? "text" : "password"} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="block w-full input px-4 py-3 text-zinc-900 dark:text-white" />
          </div>
          {error && (
            <Alert kind="error">
              {error} {/expired|already used/.test(error) && <Link to="/forgot-password" className="underline">Ask for a new link</Link>}
            </Alert>
          )}
          <button type="submit" disabled={busy} className="flex w-full justify-center items-center gap-2 btn-primary py-3.5 text-sm font-bold disabled:opacity-70">
            {busy ? "Saving…" : "Change password"}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      )}
    </Card>
  );
}
