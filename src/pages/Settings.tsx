import type { ReactNode } from "react";
import React, { useEffect, useRef, useState } from "react";
import { User, Lock, Palette, Keyboard, Eye, EyeOff, Sun, Moon, Monitor, Camera, Trash2, Bell } from "lucide-react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { api } from "@/lib/api";
import { Avatar } from "@/components/ui/Avatar";

type Tab = "profile" | "password" | "notifications" | "appearance" | "shortcuts";

const TABS: Array<{ id: Tab; label: string; icon: typeof User }> = [
  { id: "profile", label: "Profile", icon: User },
  { id: "password", label: "Password", icon: Lock },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "shortcuts", label: "Shortcuts", icon: Keyboard }
];

export function Settings() {
  const [activeTab, setActiveTab] = useState<Tab>("profile");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { currentUser, refreshCurrentUser } = useAuth();
  const { theme, setTheme } = useTheme();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [title, setTitle] = useState("");
  const [bio, setBio] = useState("");
  const [phone, setPhone] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [isSavingEmailPref, setIsSavingEmailPref] = useState(false);
  // Shown at once when clicked; put back if saving fails
  const [emailPref, setEmailPref] = useState<boolean | null>(null);

  const resetProfile = () => {
    if (!currentUser) return;
    setFullName(currentUser.name);
    setEmail(currentUser.email);
    setTitle(currentUser.title ?? "");
    setBio(currentUser.bio ?? "");
    setPhone(currentUser.phone ?? "");
  };
  // Keyed on the saved values, not the object: a background refresh of the same user mustn't wipe what you're typing
  useEffect(resetProfile, [currentUser?.id, currentUser?.name, currentUser?.email, currentUser?.title, currentUser?.bio, currentUser?.phone]);

  if (!currentUser) return null;

  const dirty =
    fullName !== currentUser.name ||
    email !== currentUser.email ||
    title !== (currentUser.title ?? "") ||
    bio !== (currentUser.bio ?? "") ||
    phone !== (currentUser.phone ?? "");
  const hasPhoto = !!currentUser.avatar;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image size must be less than 2MB");
      return;
    }
    setIsUploading(true);
    try {
      await api.uploadAvatar(file);
      toast.success("Profile photo uploaded successfully");
      await refreshCurrentUser();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to upload avatar");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = ""; // allow choosing the same file again
    }
  };

  const handleRemovePhoto = async () => {
    try {
      await api.updateMe({ avatarUrl: null });
      await refreshCurrentUser();
      toast.success("Profile photo removed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove photo");
    }
  };

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    try {
      await api.updateMe({ fullName, email, title, bio, phone });
      await refreshCurrentUser();
      toast.success("Profile updated successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update profile");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handlePasswordSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      toast.error("Enter your current password");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New password and confirm password must match");
      return;
    }
    setIsSavingPassword(true);
    try {
      await api.updatePassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password updated successfully");
      void refreshCurrentUser();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update password");
    } finally {
      setIsSavingPassword(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Settings</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium">Your profile, password and how the app looks.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        <aside className="w-full md:w-56 shrink-0">
          <nav aria-label="Settings sections" className="flex md:flex-col gap-1 overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                aria-current={activeTab === tab.id ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors whitespace-nowrap",
                  activeTab === tab.id
                    ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300"
                    : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
                )}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </aside>

        <div className="flex-1 min-w-0 space-y-6">
          {activeTab === "profile" && (
            <>
              <section className="card p-6 flex flex-col sm:flex-row items-center gap-5" aria-label="Photo">
                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/png,image/jpeg,image/gif,image/webp" className="hidden" />
                <Avatar name={currentUser.name} src={currentUser.avatar} className="w-20 h-20 rounded-full border-4 border-white dark:border-slate-800 shadow-md object-cover" />
                <div className="flex-1 min-w-0 text-center sm:text-left">
                  <p className="text-lg font-bold text-slate-900 dark:text-white truncate">{currentUser.name}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{currentUser.role} · {currentUser.email}</p>
                  <p className="text-xs text-slate-400 mt-1">PNG, JPG, GIF or WebP, up to 2 MB. Your role is set by a manager.</p>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="btn-secondary px-4 py-2 text-sm font-bold flex items-center gap-2 disabled:opacity-50">
                    <Camera className="w-4 h-4" />
                    {isUploading ? "Uploading…" : "Change photo"}
                  </button>
                  {hasPhoto && (
                    <button type="button" onClick={handleRemovePhoto} aria-label="Remove photo" className="px-3 py-2 rounded-xl text-sm font-bold border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </section>

              <form onSubmit={handleProfileSave} noValidate className="card p-6 space-y-5" aria-label="About you">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">About you</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <Field label="Full Name">
                    <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="input" autoComplete="name" />
                  </Field>
                  <Field label="Email Address">
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" autoComplete="email" />
                  </Field>
                  <Field label="Job Title">
                    <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="input" placeholder="Delivery lead" />
                  </Field>
                  <Field label="Phone">
                    <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="input" autoComplete="tel" placeholder="+91 98765 43210" />
                  </Field>
                </div>
                <Field label="Bio">
                  <textarea rows={3} value={bio} onChange={(e) => setBio(e.target.value)} className="input resize-none" placeholder="What you work on" />
                </Field>
                <div className="flex flex-wrap items-center justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                  {dirty && <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 mr-auto pt-3">Unsaved changes</span>}
                  <button type="button" onClick={resetProfile} disabled={!dirty} className="btn-secondary px-4 py-2 text-sm font-bold mt-3 disabled:opacity-50">Discard</button>
                  <button type="submit" disabled={isSavingProfile} className="btn-primary px-5 py-2 text-sm font-bold mt-3 disabled:opacity-70">
                    {isSavingProfile ? "Saving…" : "Save Changes"}
                  </button>
                </div>
              </form>
            </>
          )}

          {activeTab === "password" && (
            <form onSubmit={handlePasswordSave} noValidate className="card p-6 space-y-5" aria-label="Change password">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Change password</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">At least 8 characters. Mixing letters, numbers and symbols makes it stronger.</p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-2" data-password-changed>
                  {currentUser?.passwordChangedAt
                    ? <>Password last changed <span className="font-semibold text-slate-700 dark:text-slate-200" title={new Date(currentUser.passwordChangedAt).toLocaleString()}>{formatDistanceToNow(new Date(currentUser.passwordChangedAt), { addSuffix: true })}</span></>
                    : "No password change recorded yet."}
                </p>
              </div>
              <div className="space-y-1.5">
                <PasswordField label="Current Password" value={currentPassword} onChange={setCurrentPassword} autoComplete="current-password" />
                <p className="text-right text-sm">
                  <Link to="/forgot-password" className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">Forgot password?</Link>
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <PasswordField label="New Password" value={newPassword} onChange={setNewPassword} autoComplete="new-password" />
                  <StrengthBar password={newPassword} />
                </div>
                <PasswordField label="Confirm New Password" value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" />
              </div>
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-sm font-semibold text-red-600">The two new passwords don't match yet.</p>
              )}
              <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
                <button type="submit" disabled={isSavingPassword} className="btn-primary px-5 py-2 text-sm font-bold mt-3 disabled:opacity-70">
                  {isSavingPassword ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </form>
          )}

          {activeTab === "notifications" && (
            <section className="card p-6 space-y-5" aria-label="Notifications">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Email notifications</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">In-app notifications always stay on. Account emails (password resets, approval) are always sent.</p>
              </div>
              <label className="flex items-start justify-between gap-6 p-4 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer">
                <span>
                  <span className="block font-semibold text-slate-900 dark:text-white">Email me about my work</span>
                  <span className="block text-sm text-slate-500 dark:text-slate-400 mt-0.5">When a task is assigned to me, is due tomorrow or overdue, when someone @mentions me, and (for managers) when someone signs up.</span>
                </span>
                <input
                  type="checkbox"
                  role="switch"
                  aria-label="Email me about my work"
                  checked={emailPref ?? currentUser.emailNotifications !== false}
                  disabled={isSavingEmailPref}
                  onChange={async (e) => {
                    const on = e.target.checked;
                    setEmailPref(on);
                    setIsSavingEmailPref(true);
                    try {
                      await api.updateMe({ emailNotifications: on });
                      await refreshCurrentUser();
                      setEmailPref(null);
                      toast.success(on ? "Notification emails are on" : "Notification emails are off");
                    } catch (error) {
                      setEmailPref(!on);
                      toast.error(error instanceof Error ? error.message : "Couldn't save the setting");
                    } finally {
                      setIsSavingEmailPref(false);
                    }
                  }}
                  className="mt-1 w-5 h-5 accent-indigo-600 shrink-0"
                />
              </label>
            </section>
          )}

          {activeTab === "appearance" && (
            <section className="card p-6 space-y-5" aria-label="Appearance">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Appearance</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Saved on this device.</p>
              </div>
              <div role="radiogroup" aria-label="Theme" className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {([
                  { id: "light", label: "Light", icon: Sun },
                  { id: "dark", label: "Dark", icon: Moon },
                  { id: "system", label: "Match device", icon: Monitor }
                ] as const).map((opt) => (
                  <button
                    key={opt.id}
                    role="radio"
                    aria-checked={theme === opt.id}
                    onClick={() => setTheme(opt.id)}
                    className={cn(
                      "flex flex-col items-center gap-2 p-5 rounded-2xl border text-sm font-bold transition-colors",
                      theme === opt.id
                        ? "border-indigo-500 ring-2 ring-indigo-500/30 text-indigo-700 dark:text-indigo-300"
                        : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300"
                    )}
                  >
                    <opt.icon className="w-6 h-6" />
                    {opt.label}
                  </button>
                ))}
              </div>
            </section>
          )}

          {activeTab === "shortcuts" && (
            <section className="card p-6 space-y-4" aria-label="Shortcuts">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Keyboard shortcuts</h2>
              <dl className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                {[
                  [["Ctrl", "K"], "Search tasks, projects and people (Cmd K on Mac)"],
                  [["Esc"], "Close a dialog or the search box"],
                  [["Space"], "Pick up or drop a card on the project board"],
                  [["←", "→", "↑", "↓"], "Move a picked-up card between columns or up and down"],
                  [["Enter"], "Add a label while typing one; open the selected search result"]
                ].map(([keys, what]) => (
                  <div key={what as string} className="flex items-center justify-between gap-4 py-3">
                    <dt className="text-slate-600 dark:text-slate-300">{what as string}</dt>
                    <dd className="flex gap-1 shrink-0">
                      {(keys as string[]).map((k) => (
                        <kbd key={k} className="min-w-[28px] text-center text-xs font-bold px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200">{k}</kbd>
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{label}</label>
      {children}
    </div>
  );
}

// Rough guide only: length plus variety of character kinds
function StrengthBar({ password }: { password: string }) {
  if (!password) return null;
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(password)).length;
  const score = password.length < 8 ? 1 : Math.min(4, kinds + (password.length >= 12 ? 1 : 0));
  const [label, color] = [["Too short", "bg-red-500"], ["Too short", "bg-red-500"], ["Fair", "bg-amber-500"], ["Good", "bg-emerald-500"], ["Strong", "bg-emerald-600"]][score];
  return (
    <div aria-live="polite">
      <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${score * 25}%` }} />
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Strength: {label}</p>
    </div>
  );
}

function PasswordField({ label, value, onChange, autoComplete }: { label: string; value: string; onChange: (value: string) => void; autoComplete: string }) {
  const [show, setShow] = useState(false);
  return (
    <Field label={label}>
      <div className="relative">
        <input type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} className="input pr-12" autoComplete={autoComplete} />
        <button
          type="button"
          onClick={() => setShow(!show)}
          aria-label={show ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </Field>
  );
}
