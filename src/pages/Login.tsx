import React, { useEffect, useState } from "react";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { motion } from "motion/react";
import { Logo } from "@/components/ui/Logo";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { isEmail } from "@/lib/utils";

export function Login() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login, register } = useAuth();

  useEffect(() => {
    const notice = sessionStorage.getItem("auth_notice");
    if (notice) {
      toast.error(notice);
      sessionStorage.removeItem("auth_notice");
    }
  }, []);

  const [formError, setFormError] = useState("");
  const [pendingNotice, setPendingNotice] = useState("");

  // The form uses noValidate, so every rule the browser used to enforce (with its own popup) lives here
  const validationError = () => {
    if (mode === "register" && fullName.trim().length < 2) return "Please enter your full name.";
    if (!isEmail(email)) return "Please enter a valid email address.";
    if (mode === "register" && password.length < 8) return "Password must be at least 8 characters.";
    if (!password) return "Please enter your password.";
    return "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const problem = validationError();
    setFormError(problem);
    if (problem) return;
    setIsSubmitting(true);

    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        const result = await register(fullName, email, password);
        if (result.pending) {
          // Account saved but not usable yet: back to sign-in with a clear note
          setPendingNotice(result.message ?? "Your account is waiting for a manager's approval.");
          setMode("login");
          setPassword("");
        } else {
          toast.success("Account created successfully.");
        }
      }
    } catch (error: any) {
      setFormError(error.message || "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center font-sans overflow-hidden selection:bg-sky-100 relative p-8 transition-colors bg-slate-50 dark:bg-slate-950">
      <div className="max-w-md w-full mx-auto flex flex-col items-center card p-10 relative z-10">
        <div className="mb-8">
          <Logo size="md" variant="black" />
        </div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-10 text-center"
        >
          <h2 className="text-3xl font-bold text-zinc-900 dark:text-white tracking-tight">
            {mode === "login" ? "Welcome back" : "Create your workspace account"}
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400 mt-2 font-medium">
            {mode === "login" && "Sign in with your Login Credentials."}
          </p>
        </motion.div>

        <form className="space-y-5 w-full" onSubmit={handleSubmit} noValidate>
          {mode === "register" && (
            <div className="space-y-1.5">
              <label htmlFor="fullName" className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                Full Name
              </label>
              <input
                id="fullName"
                name="fullName"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="block w-full input px-4 py-3 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none transition-all"
                placeholder="Alex Manager"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              Email Address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="block w-full input px-4 py-3 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none transition-all"
              placeholder="name@company.com"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              Password
            </label>
            <div className="relative group">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                required
                minLength={mode === "register" ? 8 : undefined}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full input px-4 py-3 pr-12 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none transition-all"
                placeholder="Minimum 8 characters"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors focus:outline-none"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {pendingNotice && !formError && (
            <div role="status" className="p-3 text-sm font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800">
              Thanks for signing up. {pendingNotice}
            </div>
          )}
          {formError && (
            <div role="alert" className="p-3 text-sm font-semibold text-red-600 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800">
              {formError}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex w-full justify-center items-center gap-2 btn-primary py-3.5 px-4 text-sm font-bold disabled:opacity-70"
          >
            {isSubmitting ? "Please wait..." : mode === "login" ? "Sign in to Dashboard" : "Create Account"}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode(mode === "login" ? "register" : "login");
            setFormError("");
          }}
          className="mt-6 text-sm text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
        >
          {mode === "login" ? "Need an account? Register" : "Already have an account? Sign in"}
        </button>
      </div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-[0.2em] font-bold text-zinc-400 w-full text-center">
        &copy; 2026 Entro Labs IT Solutions • All rights reserved
      </div>
    </div>
  );
}
