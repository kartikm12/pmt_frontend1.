import type { ReactNode } from "react";
import React, { useEffect, useState, useRef } from "react";
import { User, Lock, Save, Pencil, Trash2, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { SingleSelectDropdown } from "@/components/ui/SingleSelectDropdown";
import { Avatar } from "@/components/ui/Avatar";

type Tab = "profile" | "security";

export function Settings() {
  const [activeTab, setActiveTab] = useState<Tab>("profile");
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image size must be less than 2MB");
      return;
    }

    try {
      await api.uploadAvatar(file);
      toast.success("Profile photo uploaded successfully");
      await refreshCurrentUser();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to upload avatar");
    }
  };

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { currentUser, refreshCurrentUser } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [title, setTitle] = useState("");
  const [bio, setBio] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    setFullName(currentUser.name);
    setEmail(currentUser.email);
    setTitle(currentUser.title ?? "");
    setBio(currentUser.bio ?? "");
    setPhone(currentUser.phone ?? "");
    setRole(currentUser.role ?? "");
    setAvatarUrl(currentUser.avatar ?? "");
  }, [currentUser]);

  if (!currentUser) return null;

  const handleProfileSave = async () => {
    setIsSavingProfile(true);
    try {
      await api.updateMe({
        fullName,
        email,
        title,
        bio,
        phone,
        avatarUrl: avatarUrl === "" ? null : undefined
      });
      await refreshCurrentUser();
      toast.success("Profile updated successfully");
    } catch (error: any) {
      const message = error.message || "Failed to update profile";
      if (message === "Validation failed" && error.issues) {
        console.error("Validation issues:", error.issues);
        toast.error(`Validation failed: ${JSON.stringify(error.issues.fieldErrors)}`);
      } else {
        toast.error(message);
      }
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handlePasswordSave = async () => {
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
      await api.updatePassword({
        currentPassword,
        newPassword
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password updated successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update password");
    } finally {
      setIsSavingPassword(false);
    }
  };

  const tabs = [
    { id: "profile", label: "Profile", icon: User },
    { id: "security", label: "Security", icon: Lock }
  ];

  return (
    <div className="space-y-10 animate-in fade-in duration-500 max-w-5xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Settings</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium">Manage your account settings and preferences.</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-12">
        <aside className="w-full md:w-64 shrink-0">
          <nav className="flex flex-col gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as Tab)}
                className={cn(
                  "flex items-center gap-3 px-5 py-3 rounded-xl text-sm font-bold transition-all",
                  activeTab === tab.id
                    ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm translate-x-1"
                    : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
                )}
              >
                <tab.icon className={cn("w-5 h-5", activeTab === tab.id ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400 dark:text-slate-500")} />
                {tab.label}
              </button>
            ))}
          </nav>
        </aside>

        <div className="flex-1">
          {activeTab === "profile" && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
              <section className="card overflow-hidden">
                <div className="p-10 border-b border-slate-200 dark:border-slate-800">
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Profile Information</h2>
                  <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium">Update your photo and personal details.</p>
                </div>

                <div className="p-10 space-y-10">
                  <div className="flex flex-col items-center justify-center text-center gap-4">
                    <div className="relative group">
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileChange} 
                        accept="image/*" 
                        className="hidden" 
                      />
                      <Avatar name={currentUser.name} src={avatarUrl} className="w-32 h-32 rounded-full border-4 border-white dark:border-slate-800 shadow-xl object-cover transition-transform duration-500" />
                      <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                        <button 
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="p-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full transition-colors active:scale-90" 
                          title="Upload new photo"
                        >
                          <Pencil className="w-5 h-5 text-white" />
                        </button>
                        <button 
                          type="button" 
                          onClick={() => {
                            setAvatarUrl("");
                            toast.success("Avatar removed (click Save to persist)");
                          }} 
                          className="p-2 bg-red-500/80 hover:bg-red-500 rounded-full transition-colors shadow-lg active:scale-90" 
                          title="Remove photo"
                        >
                          <Trash2 className="w-5 h-5 text-white" />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <Field label="Full Name">
                      <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="input" />
                    </Field>
                    <Field label="Email Address">
                      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" />
                    </Field>
                    <Field label="Role">
                      <SingleSelectDropdown
                        options={[
                          { id: "Manager", name: "Manager" },
                          { id: "Project Manager", name: "Project Manager" },
                          { id: "Admin", name: "Admin" },
                          { id: "Developer", name: "Developer" },
                          { id: "Designer", name: "Designer" },
                          { id: "Tester", name: "Tester" },
                          { id: "Support Engineer", name: "Support Engineer" },
                          { id: "Business Analyst", name: "Business Analyst" },
                          { id: "Team Member", name: "Team Member" },
                        ]}
                        selectedId={role}
                        onChange={setRole}
                        disabled
                      />
                    </Field>
                    <Field label="Job Title">
                      <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="input" />
                    </Field>
                    <Field label="Phone">
                      <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} className="input" />
                    </Field>
                  </div>

                  <Field label="Bio">
                    <textarea rows={4} value={bio} onChange={(e) => setBio(e.target.value)} className="input resize-none" placeholder="Tell us a little bit about yourself..." />
                  </Field>

                  <div className="flex justify-center pt-4">
                    <button onClick={handleProfileSave} disabled={isSavingProfile} className="btn-primary flex items-center gap-2 disabled:opacity-70">
                      <Save className="w-5 h-5" />
                      Save Changes
                    </button>
                  </div>
                </div>
              </section>
            </div>
          )}

          {activeTab === "security" && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
              <section className="card overflow-hidden">
                <div className="p-10 border-b border-slate-200 dark:border-slate-800">
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Security Settings</h2>
                  <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium">Manage your password and account security.</p>
                </div>
                <div className="p-10 space-y-10">
                  <div className="space-y-6">
                    <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Change Password</h4>
                    <div className="space-y-6">
                      <PasswordField
                        label="Current Password"
                        value={currentPassword}
                        onChange={setCurrentPassword}
                        show={showCurrentPassword}
                        onToggle={() => setShowCurrentPassword(!showCurrentPassword)}
                      />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <PasswordField
                          label="New Password"
                          value={newPassword}
                          onChange={setNewPassword}
                          show={showNewPassword}
                          onToggle={() => setShowNewPassword(!showNewPassword)}
                        />
                        <PasswordField
                          label="Confirm New Password"
                          value={confirmPassword}
                          onChange={setConfirmPassword}
                          show={showConfirmPassword}
                          onToggle={() => setShowConfirmPassword(!showConfirmPassword)}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-center pt-4">
                    <button onClick={handlePasswordSave} disabled={isSavingPassword} className="btn-primary flex items-center gap-2 disabled:opacity-70">
                      <Save className="w-5 h-5" />
                      Save Changes
                    </button>
                  </div>
                </div>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">{label}</label>
      {children}
    </div>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  show,
  onToggle
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  show: boolean;
  onToggle: () => void;
}) {
  return (
    <Field label={label}>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="input pr-12"
          placeholder="Enter password"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </Field>
  );
}
