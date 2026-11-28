import React, { useState, useEffect, useMemo } from "react";
import { useAssigneeProjects, useEscapeToClose } from "./assetUi";
import { createPortal } from "react-dom";
import {
  X,
  Plus,
  Upload,
  Image as ImageIcon,
  Trash2,
  Tag,
  Info,
  Calendar,
  UserCheck,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import type { Asset, AssetCategory, AssetCondition, Project, User } from "@/lib/api-types";
import { SingleSelectDropdown } from "@/components/ui/SingleSelectDropdown";

// Warranty is a length, not two dates: the end is the purchase date (or today) plus the months
const WARRANTY_OPTIONS = [
  { id: "", name: "No warranty" },
  { id: "3", name: "3 months" },
  { id: "6", name: "6 months" },
  { id: "12", name: "1 year" },
  { id: "24", name: "2 years" },
  { id: "36", name: "3 years" },
  { id: "60", name: "5 years" }
];
function warrantyEndText(purchaseDate: string, months: number) {
  const [y, m, d] = (purchaseDate || new Date().toLocaleDateString("en-CA")).split("-").map(Number);
  const end = new Date(Date.UTC(y, m - 1 + months, d));
  return end.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

interface AddAssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  onCreated?: (newAsset: Asset) => void;
  categories: AssetCategory[];
  users: User[];
  projects: Project[];
}

export function AddAssetModal({
  isOpen,
  onClose,
  onSuccess,
  onCreated,
  categories,
  users,
  projects
}: AddAssetModalProps) {
  useEscapeToClose(isOpen, onClose);
  // Section 1: Identification
  const [categoryId, setCategoryId] = useState("");
  const [assetName, setAssetName] = useState("");

  // Section 2: Item Details
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [specifications, setSpecifications] = useState("");
  const [condition, setCondition] = useState<AssetCondition>("GOOD");
  const [location, setLocation] = useState("");
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);

  // Section 3: Purchase & Warranty
  const [purchaseDate, setPurchaseDate] = useState("");
  const [vendorName, setVendorName] = useState("");
  const [warrantyMonths, setWarrantyMonths] = useState("");

  // Section 4: Assign To
  const [assignmentType, setAssignmentType] = useState<"STOCK" | "ASSIGN">("STOCK");
  const [employeeId, setEmployeeId] = useState("");
  const [projectId, setProjectId] = useState("");
  const assigneeProjects = useAssigneeProjects(projects, employeeId, projectId, setProjectId);
  const [assignmentCondition, setAssignmentCondition] = useState<AssetCondition>("GOOD");
  const [assignmentNotes, setAssignmentNotes] = useState("");

  // Validation & UI states
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");

  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === "Admin";

  // Compute reporting hierarchy: employees who report directly or indirectly to current user
  const hierarchyIds = useMemo(() => {
    if (!currentUser) return new Set<string>();
    const result = new Set<string>();
    const queue = [currentUser.id];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      for (const u of users) {
        if (u.reportsToId === cur && !result.has(u.id)) {
          result.add(u.id);
          queue.push(u.id);
        }
      }
    }
    return result;
  }, [currentUser, users]);

  // Filter eligible assignees: Admin can assign to anyone; Manager can assign to hierarchy + self
  const eligibleUsers = useMemo(() => {
    return users.filter((u) => {
      if (u.status === "Suspended") return false;
      if (isAdmin) return true;
      return hierarchyIds.has(u.id) || u.id === currentUser?.id;
    });
  }, [users, isAdmin, hierarchyIds, currentUser]);

  const userOptions = useMemo(() => {
    return eligibleUsers.map((u) => {
      let suffix = "";
      if (u.id === currentUser?.id) {
        suffix = " (You)";
      } else if (!isAdmin && hierarchyIds.has(u.id)) {
        suffix = " — Reports to you";
      }
      return {
        id: u.id,
        name: `${u.name} (${u.role})${suffix}`
      };
    });
  }, [eligibleUsers, currentUser, isAdmin, hierarchyIds]);

  // Auto-generated Tag Preview
  const selectedCategory = useMemo(() => {
    return categories.find((c) => c.id === categoryId);
  }, [categories, categoryId]);

  const tagPreview = useMemo(() => {
    if (!selectedCategory) return "ENT-???-0001";
    return `ENT-${selectedCategory.code}-Auto`;
  }, [selectedCategory]);

  // Sync assignment condition when main condition changes
  useEffect(() => {
    setAssignmentCondition(condition);
  }, [condition]);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      photoPreviews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [photoPreviews]);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      if (categories.length > 0 && !categoryId) {
        setCategoryId(categories[0].id);
      }
      setAssetName("");
      setBrand("");
      setModel("");
      setSerialNumber("");
      setSpecifications("");
      setCondition("GOOD");
      setLocation("");
      setPhotoFiles([]);
      setPhotoPreviews([]);
      setPurchaseDate("");
      setVendorName("");
      setWarrantyMonths("");
      setAssignmentType("STOCK");
      setEmployeeId("");
      setProjectId("");
      setAssignmentCondition("GOOD");
      setAssignmentNotes("");
      setTouched({});
      setServerError("");
    }
  }, [isOpen, categories]);

  if (!isOpen) return null;

  // Validation rules
  const errors = {
    categoryId: !categoryId ? "Category is required" : "",
    assetName: !assetName.trim() ? "Asset name is required" : "",
    employeeId: assignmentType === "ASSIGN" && !employeeId ? "Please select an employee" : ""
  };

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    const files = Array.from(e.target.files) as File[];

    const validFiles = files.filter((file) => {
      const isImg = ["image/png", "image/jpeg", "image/webp"].includes(file.type);
      if (!isImg) {
        toast.error(`'${file.name}' is not a valid image (PNG, JPEG, WebP only). Invoices not permitted.`);
        return false;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`'${file.name}' exceeds maximum 10MB file size limit.`);
        return false;
      }
      return true;
    });

    if (validFiles.length) {
      const newPreviews = validFiles.map((file) => URL.createObjectURL(file));
      setPhotoFiles((prev) => [...prev, ...validFiles]);
      setPhotoPreviews((prev) => [...prev, ...newPreviews]);
    }
    e.target.value = "";
  };

  const removePhoto = (index: number) => {
    URL.revokeObjectURL(photoPreviews[index]);
    setPhotoFiles((prev) => prev.filter((_, i) => i !== index));
    setPhotoPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({
      categoryId: true,
      assetName: true,
      employeeId: true
    });

    if (
      errors.categoryId ||
      errors.assetName ||
      errors.employeeId
    ) {
      toast.error("Please correct the errors in the form before submitting");
      return;
    }

    setIsSubmitting(true);
    setServerError("");

    try {
      const payload = {
        categoryId,
        name: assetName.trim(),
        brand: brand.trim() || undefined,
        model: model.trim() || undefined,
        serialNumber: serialNumber.trim() || undefined,
        specifications: specifications.trim() || undefined,
        condition,
        location: location.trim() || undefined,
        purchaseDate: purchaseDate || undefined,
        vendorName: vendorName.trim() || undefined,
        warrantyMonths: warrantyMonths ? Number(warrantyMonths) : undefined,
        assignmentType,
        employeeId: assignmentType === "ASSIGN" ? employeeId : undefined,
        projectId: assignmentType === "ASSIGN" && projectId ? projectId : undefined,
        assignmentCondition: assignmentType === "ASSIGN" ? assignmentCondition : undefined,
        notes: assignmentType === "ASSIGN" && assignmentNotes.trim() ? assignmentNotes.trim() : undefined
      };

      const newAsset = await api.createAsset(payload);

      // Upload photographs if attached
      if (photoFiles.length > 0) {
        for (const file of photoFiles) {
          try {
            await api.uploadAssetPhoto(newAsset.id, file);
          } catch (uploadErr) {
            console.error("Failed to upload photo:", uploadErr);
          }
        }
      }

      toast.success(`Asset created successfully with Tag: ${newAsset.assetTag}`);
      onSuccess?.();
      onCreated?.(newAsset);
      onClose();
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : "Failed to register asset";
      setServerError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-6 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between sticky top-0 bg-white dark:bg-slate-900 z-10">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Add asset</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Register a company asset into the centralized inventory
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body with 4 exact sections */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-6 space-y-8 custom-scrollbar">
          {serverError && (
            <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{serverError}</span>
            </div>
          )}

          {/* Section 1: Identification */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <Tag className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                Section 1: Identification
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                  Asset Tag <span className="text-slate-400 font-normal">(Auto-Generated)</span>
                </label>
                <div className="h-10 px-3.5 flex items-center bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-sm font-bold text-indigo-600 dark:text-indigo-400 cursor-not-allowed">
                  {tagPreview}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                  Category <span className="text-rose-500">*</span>
                </label>
                <SingleSelectDropdown
                  options={categories.map((c) => ({ id: c.id, name: c.name }))}
                  selectedId={categoryId}
                  onChange={(id) => {
                    setCategoryId(id);
                    setTouched((prev) => ({ ...prev, categoryId: true }));
                  }}
                  placeholder="Select Category..."
                />
                {touched.categoryId && errors.categoryId && (
                  <p className="text-xs text-rose-500 mt-1">{errors.categoryId}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                  Asset Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. MacBook Pro 16 M3 Max"
                  value={assetName}
                  onChange={(e) => setAssetName(e.target.value)}
                  onBlur={() => handleBlur("assetName")}
                  className="w-full h-10 px-3.5 input text-sm focus:outline-none transition-all dark:text-slate-100 rounded-lg"
                />
                {touched.assetName && errors.assetName && (
                  <p className="text-xs text-rose-500 mt-1">{errors.assetName}</p>
                )}
              </div>
            </div>
          </div>

          {/* Section 2: Item Details */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <Info className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                Section 2: Item Details
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                  Brand
                </label>
                <input
                  type="text"
                  placeholder="e.g. Apple, Dell, Lenovo"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  className="w-full h-10 px-3.5 input text-sm focus:outline-none transition-all dark:text-slate-100 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                  Model
                </label>
                <input
                  type="text"
                  placeholder="e.g. Latitude 5440"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full h-10 px-3.5 input text-sm focus:outline-none transition-all dark:text-slate-100 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                  Serial Number <span className="text-slate-400 font-normal">(Unique)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. C02G60PZMD6T"
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value)}
                  className="w-full h-10 px-3.5 input text-sm focus:outline-none transition-all dark:text-slate-100 rounded-lg font-mono uppercase"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                  Condition <span className="text-rose-500">*</span>
                </label>
                <SingleSelectDropdown
                  options={[
                    { id: "NEW", name: "New" },
                    { id: "GOOD", name: "Good" },
                    { id: "FAIR", name: "Fair" },
                    { id: "DAMAGED", name: "Damaged" }
                  ]}
                  selectedId={condition}
                  onChange={(id) => setCondition(id as AssetCondition)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                  Location
                </label>
                <input
                  type="text"
                  placeholder="e.g. Hyderabad Office - 3rd Floor"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full h-10 px-3.5 input text-sm focus:outline-none transition-all dark:text-slate-100 rounded-lg"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                Technical Specifications
              </label>
              <textarea
                rows={2}
                placeholder="e.g. 32GB RAM, 1TB NVMe SSD, M3 Max 14-core CPU, English Keyboard"
                value={specifications}
                onChange={(e) => setSpecifications(e.target.value)}
                className="w-full p-3 input text-sm focus:outline-none transition-all dark:text-slate-100 rounded-lg custom-scrollbar resize-none"
              />
            </div>

            {/* Photo Uploads */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                Asset Photographs <span className="text-slate-400 font-normal">(Images only, no invoices)</span>
              </label>
              <div className="flex flex-wrap gap-3 items-center">
                {photoPreviews.map((src, idx) => (
                  <div key={idx} className="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 group">
                    <img src={src} alt={`Upload ${idx}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removePhoto(idx)}
                      className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity"
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                ))}
                <label className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-500 flex flex-col items-center justify-center cursor-pointer text-slate-400 hover:text-indigo-600 transition-colors">
                  <Upload className="w-5 h-5 mb-1" />
                  <span className="text-[10px] font-medium">Add photo</span>
                  <input
                    type="file"
                    multiple
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={handlePhotoSelect}
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Section 3: Purchase & Warranty */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <Calendar className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                Section 3: Purchase & Warranty
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                  Purchase date
                </label>
                <input
                  type="date"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  className="w-full h-10 px-3.5 input text-sm focus:outline-none transition-all dark:text-slate-100 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                  Warranty period
                </label>
                <SingleSelectDropdown
                  ariaLabel="Warranty period"
                  options={WARRANTY_OPTIONS}
                  selectedId={warrantyMonths}
                  onChange={setWarrantyMonths}
                  searchable={false}
                  placeholder="No warranty"
                />
                {warrantyMonths && (
                  <p data-warranty-ends className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Ends {warrantyEndText(purchaseDate, Number(warrantyMonths))}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                  Vendor name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Dell Direct, Amazon"
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  className="w-full h-10 px-3.5 input text-sm focus:outline-none transition-all dark:text-slate-100 rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Assign To */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <UserCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                Section 4: Assign To
              </h3>
            </div>

            {/* Radio Selection */}
            <div className="flex items-center gap-6 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
              <label className="flex items-center gap-2.5 cursor-pointer text-sm font-semibold text-slate-700 dark:text-slate-200">
                <input
                  type="radio"
                  name="assignmentType"
                  value="STOCK"
                  checked={assignmentType === "STOCK"}
                  onChange={() => setAssignmentType("STOCK")}
                  className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                />
                <span>Keep in stock</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer text-sm font-semibold text-slate-700 dark:text-slate-200">
                <input
                  type="radio"
                  name="assignmentType"
                  value="ASSIGN"
                  checked={assignmentType === "ASSIGN"}
                  onChange={() => setAssignmentType("ASSIGN")}
                  className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                />
                <span>Assign to someone</span>
              </label>
            </div>

            {assignmentType === "ASSIGN" && (
              <div className="space-y-4 pt-2 animate-in fade-in duration-200">
                {!isAdmin && hierarchyIds.size === 0 && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-800 dark:text-amber-300">
                    <p className="font-semibold flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                      Reporting Hierarchy
                    </p>
                    <p className="mt-1 leading-relaxed">
                      As a Manager, you can only assign assets to employees in your reporting hierarchy. Currently, no employees have you set as their Reporting Manager on the <strong>Team</strong> page. An Admin can configure this in Team settings.
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 flex items-center justify-between">
                      <span>Assign To <span className="text-rose-500">*</span></span>
                      {!isAdmin && hierarchyIds.size > 0 && (
                        <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-normal">
                          {hierarchyIds.size} report{hierarchyIds.size > 1 ? "s" : ""} to you
                        </span>
                      )}
                    </label>
                    <SingleSelectDropdown
                      options={userOptions}
                      selectedId={employeeId}
                      onChange={(id) => {
                        setEmployeeId(id);
                        setTouched((prev) => ({ ...prev, employeeId: true }));
                      }}
                      placeholder={userOptions.length === 0 ? "No eligible employees found..." : "Pick the assignee..."}
                    />
                    {touched.employeeId && errors.employeeId && (
                      <p className="text-xs text-rose-500 mt-1">{errors.employeeId}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                      Project <span className="text-slate-400 font-normal">(optional)</span>
                    </label>
                    <SingleSelectDropdown
                      options={[
                        { id: "", name: "No project" },
                        ...assigneeProjects.map((p) => ({ id: p.id, name: p.name }))
                      ]}
                      selectedId={projectId}
                      onChange={setProjectId}
                      placeholder={employeeId ? (assigneeProjects.length ? "Pick one of their projects..." : "They aren't on any project") : "Pick the assignee first"}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                      Condition when assigned
                    </label>
                    <SingleSelectDropdown
                      options={[
                        { id: "NEW", name: "New" },
                        { id: "GOOD", name: "Good" },
                        { id: "FAIR", name: "Fair" },
                        { id: "DAMAGED", name: "Damaged" }
                      ]}
                      selectedId={assignmentCondition}
                      onChange={(id) => setAssignmentCondition(id as AssetCondition)}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                      Assignment Notes <span className="text-slate-400 font-normal">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Issued for Client Onsite Work"
                      value={assignmentNotes}
                      onChange={(e) => setAssignmentNotes(e.target.value)}
                      className="w-full h-10 px-3.5 input text-sm focus:outline-none transition-all dark:text-slate-100 rounded-lg"
                    />
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 text-xs text-indigo-700 dark:text-indigo-300">
                  The employee will receive an in-app and email notification to confirm receipt of this asset.
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 sticky bottom-0 bg-white dark:bg-slate-900 pb-1">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="btn-secondary h-11 px-6 text-sm font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary h-11 px-8 text-sm font-semibold flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save asset</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

