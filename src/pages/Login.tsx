import React, { useEffect, useState } from "react";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { motion } from "motion/react";
import { Logo } from "@/components/ui/Logo";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const success =
        mode === "login"
          ? await login(email, password)
          : await register(fullName, email, password);

      if (success && mode === "register") {
        toast.success("Account created successfully.");
      }
    } catch (error: any) {
      toast.error(error.message || "An unexpected error occurred.");
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

        <form className="space-y-5 w-full" onSubmit={handleSubmit}>
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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full input px-4 py-3 pr-12 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none transition-all"
                placeholder="Minimum 8 characters"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors focus:outline-none"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex w-full justify-center items-center gap-2 btn-primary py-3.5 px-4 text-sm font-bold disabled:opacity-70"
          >
            {mode === "login" ? "Sign in to Dashboard" : "Create Account"}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <button
          type="button"
          onClick={() => setMode(mode === "login" ? "register" : "login")}
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
