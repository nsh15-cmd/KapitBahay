// C:\Users\Renz Jericho Buday\KapitBahay\src\features\reports\components\ReportForm.tsx
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle, ChevronRight, Heart, HeartHandshake, LifeBuoy, Navigation, ShieldAlert, Wifi, WifiOff, Camera, MapPin, User, FileText, X, EyeOff } from "lucide-react";
import { saveCachedLocation, getCachedLocation } from "../../../lib/indexedDb";
import type { LocalReport, ReportCategory } from "../../../lib/indexedDb";
import { getDittoInstance } from "../../../lib/ditto";
import { useOnlineStatus } from "../../../lib/useOnlineStatus";
import { useAuth } from "../../../App";
import { requestMeshHardwarePermissions } from "../../../lib/hardwarePermissions";
import { syncEventEmitter } from "../../../lib/syncEngine";
import { useReportsStore } from "../../../store/useReportsStore";

const categoryOptions: Array<{
  value: ReportCategory;
  label: string;
  icon: typeof AlertTriangle;
  classes: string;
  description: string;
}> = [
    {
      value: "hazard",
      label: "Hazards",
      icon: AlertTriangle,
      classes: "border-red-500 bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400",
      description: "Floods, fire, or blocked roads.",
    },
    {
      value: "resource",
      label: "Needs",
      icon: HeartHandshake,
      classes: "border-emerald-500 bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400",
      description: "Water, food, or medicine.",
    },
    {
      value: "rescue",
      label: "Rescue",
      icon: LifeBuoy,
      classes: "border-amber-500 bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400",
      description: "Trapped people or medical crisis.",
    },
    {
      value: "infrastructure",
      label: "Damage",
      icon: Heart,
      classes: "border-slate-500 bg-slate-50 text-slate-600 dark:bg-slate-400/10 dark:text-slate-300",
      description: "Power lines, bridges, or road systems.",
    },
    {
      value: "status",
      label: "Status",
      icon: ShieldAlert,
      classes: "border-sky-500 bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400",
      description: "Safety updates or shelter capacities.",
    },
  ];

const DEFAULT_LOCATION = { lat: 14.7140, lng: 120.9388 };

export default function ReportForm({ onClose }: { onClose?: () => void }) {
  const { user } = useAuth();
  const { createReport } = useReportsStore();
  const isOnline = useOnlineStatus();

  const [category, setCategory] = useState<ReportCategory>("hazard");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const [isAnonymous, setIsAnonymous] = useState(false);

  const [locationText, setLocationText] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [cachedLocation, setCachedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [latitudeInput, setLatitudeInput] = useState("");
  const [longitudeInput, setLongitudeInput] = useState("");

  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const defaultCachedName = useMemo(() => {
    return user?.displayName?.trim() || user?.email?.split("@")[0]?.trim() || "Anonymous Resident";
  }, [user]);

  useEffect(() => {
    const loadCachedLocation = async () => {
      const cached = await getCachedLocation();
      if (cached) {
        setCoords({ lat: cached.lat, lng: cached.lng });
        setCachedLocation({ lat: cached.lat, lng: cached.lng });
        setLatitudeInput(cached.lat.toFixed(6));
        setLongitudeInput(cached.lng.toFixed(6));
        setLocationText(cached.address ?? "Last known nearby location");
        setStatusText("Last known GPS location restored from device cache.");
      }
    };
    loadCachedLocation();
  }, []);

  useEffect(() => {
    const lat = parseFloat(latitudeInput);
    const lng = parseFloat(longitudeInput);
    if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
      setCoords({ lat, lng });
    }
  }, [latitudeInput, longitudeInput]);

  const selectedCategory = useMemo(
    () => categoryOptions.find((option) => option.value === category),
    [category]
  );

  const canSubmit = Boolean(locationText.trim() || coords) && Boolean(title.trim());

  const handleGetLocation = () => {
    setIsLocating(true);
    setStatusText("Requesting GPS position...");

    if (!("geolocation" in navigator)) {
      setStatusText("Geolocation is unavailable in this browser.");
      setIsLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextCoords = { lat: position.coords.latitude, lng: position.coords.longitude };
        setCoords(nextCoords);
        setCachedLocation(nextCoords);
        setLatitudeInput(position.coords.latitude.toFixed(6));
        setLongitudeInput(position.coords.longitude.toFixed(6));
        setLocationText("GPS coordinates attached");
        setStatusText("GPS lock acquired.");
        setIsLocating(false);
      },
      (error) => {
        console.warn("Unable to fetch GPS position:", error);
        setStatusText("GPS request failed. Use a reference location or manual coordinates.");
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
    );
  };

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800; // Cap width for offline storage
        const scaleSize = MAX_WIDTH / img.width;

        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;

        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Compress as JPEG at 70% quality to keep the base64 string lightweight
        setImagePreview(canvas.toDataURL('image/jpeg', 0.7));
      };
      if (typeof e.target?.result === 'string') {
        img.src = e.target.result;
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canSubmit) {
      setStatusText("Please provide an incident title and location information before submitting.");
      return;
    }

    setIsSyncing(true);
    setStatusText("Encrypting and saving locally...");

    const reportUuid = crypto.randomUUID();
    const reportLocation = coords ?? cachedLocation ?? DEFAULT_LOCATION;
    const reportTitle = title.trim() || selectedCategory?.label || "Situation Report";
    const reportDescription = description.trim();
    const finalReporterName = isAnonymous ? "Anonymous Resident" : defaultCachedName;

    // Use base64 universally to remove cloud dependencies from the UI flow
    const finalImageUrl: string | undefined = imagePreview ?? undefined;

    const newReport: LocalReport = {
      id: reportUuid,
      _id: reportUuid,
      category,
      type: category,
      title: reportTitle,
      description: reportDescription || undefined,
      reporterName: finalReporterName,
      location: reportLocation,
      locationText: locationText.trim() || "Location reference attached",
      address: locationText.trim() || undefined,
      imageDataUrl: finalImageUrl,
      timestamp: Date.now(),
      status: "pending", // Always default to pending, let the background engine sync it later
      lifecycleStatus: "pending",
      synced: false,
      origin: "local",
    };

    // 1. Store Locally (Absolute source of truth)
    await createReport(newReport);

    // 2. Ask for the BLE and location permissions needed for nearby pairing
    const permissionResult = await requestMeshHardwarePermissions();
    if (!permissionResult.ok) {
      console.warn("Nearby pairing permission request was not fully granted:", permissionResult.reason);
    }

    syncEventEmitter.dispatchEvent(new CustomEvent("report-created", {
      detail: {
        title: reportTitle,
        offline: !isOnline,
        permissionsOk: permissionResult.ok,
      },
    }));

    // 3. Update Location Cache
    if (coords) {
      await saveCachedLocation({
        textReference: locationText.trim() || "Manual Reference Input",
        lat: coords.lat,
        lng: coords.lng,
        address: locationText.trim() || "Cached location",
        savedAt: Date.now(),
      });
    }

    // 4. Push into Automated Ditto P2P Mesh
    try {
      const ditto = await getDittoInstance();
      // Drop heavy base64 strings before pushing to mesh to prevent P2P bandwidth collapse
      const meshPayload = { ...newReport, imageDataUrl: undefined };
      await ditto.store.execute(`INSERT INTO users_reports DOCUMENTS (:meshPayload)`, { meshPayload });
    } catch (dittoError) {
      console.warn("Ditto mesh unavailable, continuing with local queue:", dittoError);
    }

    setIsSyncing(false);
    setStatusText(null);
    onClose?.();
  };

  if (submitted) {
    return (
      <div className="mx-auto max-w-xl p-8 sm:p-12 text-center animate-in zoom-in-95 duration-300 relative">
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 rounded-full bg-slate-100 p-2 text-slate-500 transition-colors hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
            aria-label="Close form"
          >
            <X className="h-5 w-5" />
          </button>
        )}
        <div className={`mx-auto flex h-24 w-24 items-center justify-center rounded-full ${isOnline ? 'bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400' : 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'}`}>
          {isOnline ? <CheckCircle className="h-12 w-12" /> : <WifiOff className="h-12 w-12" />}
        </div>
        <h1 className="mt-6 text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
          {isOnline ? "Report Live" : "Queued Offline"}
        </h1>
        <p className="mt-3 text-base text-slate-500 dark:text-slate-400 leading-relaxed max-w-sm mx-auto">
          {isOnline
            ? "Your report was saved locally and is being pushed to the cloud in the background."
            : "Saved locally. It will relay automatically in the background to nearby users, or sync to the cloud when internet returns."}
        </p>
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => {
              setSubmitted(false);
              setCategory("hazard");
              setTitle("");
              setDescription("");
              setImagePreview(null);
            }}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-slate-900 px-8 py-3.5 text-sm font-semibold text-white shadow-md transition hover:bg-slate-800 hover:-translate-y-0.5 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
          >
            Submit Another
            <ChevronRight className="h-4 w-4" />
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3.5 text-sm font-semibold text-slate-600 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            >
              Back to Feed
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl bg-white dark:bg-slate-900 relative">
      <div className={`sticky top-0 z-30 flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-white backdrop-blur-md ${isOnline ? "bg-teal-600/90" : "bg-amber-500/90"}`}>
        {isOnline ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
        {isOnline ? "Live Sync Active" : "Offline Mode: Reports will be queued"}
      </div>

      <div className="p-5 sm:p-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">Report Incident</h1>
            <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">Please provide clear details to assist responders and the community.</p>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-full bg-slate-100 p-2.5 text-slate-500 transition-all hover:bg-slate-200 hover:text-slate-900 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white"
              aria-label="Close modal"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="space-y-3">
            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Category Selection</label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
              {categoryOptions.map((option) => {
                const Icon = option.icon;
                const active = category === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setCategory(option.value)}
                    className={`flex items-start gap-3 rounded-2xl border-2 p-4 text-left transition-all duration-200 ${active
                      ? `${option.classes} border-current shadow-sm scale-[1.01]`
                      : "border-slate-100 bg-white text-slate-500 hover:border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400 dark:hover:bg-slate-900"
                      }`}
                  >
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${active ? 'bg-white/20 dark:bg-black/10' : 'bg-slate-50 dark:bg-slate-900'}`}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="space-y-0.5">
                      <span className={`text-xs font-bold tracking-wide uppercase block ${active ? 'text-current' : 'text-slate-900 dark:text-white'}`}>{option.label}</span>
                      <span className="text-[11px] leading-tight block opacity-80">{option.description}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 border-t border-slate-100 pt-6 dark:border-slate-800">
            <label className="block space-y-2">
              <span className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300">
                <FileText className="h-4 w-4 opacity-50" />
                Incident Title <span className="text-red-500">*</span>
              </span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Blocked Main Road"
                required
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:bg-slate-900"
              />
            </label>

            {/* STRICT IMMUTABLE REPORTER IDENTITY */}
            <div className="block space-y-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300">
                  <User className="h-4 w-4 opacity-50" />
                  Reporter Identity
                </span>
                <label className="flex items-center gap-2 cursor-pointer group select-none">
                  <input
                    type="checkbox"
                    checked={isAnonymous}
                    onChange={(e) => setIsAnonymous(e.target.checked)}
                    className="sr-only"
                  />
                  <div className={`flex h-5 w-8 items-center rounded-full p-0.5 transition-colors ${isAnonymous ? 'bg-teal-500' : 'bg-slate-200 dark:bg-slate-700'}`}>
                    <div className={`h-4 w-4 rounded-full bg-white transition-transform ${isAnonymous ? 'translate-x-3' : 'translate-x-0 shadow-sm'}`} />
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 group-hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300 flex items-center gap-1">
                    {isAnonymous && <EyeOff className="h-3.5 w-3.5 text-teal-500" />} Hide Name
                  </span>
                </label>
              </div>
              <input
                value={isAnonymous ? "Anonymous Resident" : defaultCachedName}
                readOnly
                className="w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-3.5 text-slate-500 outline-none font-medium select-none cursor-not-allowed dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400"
              />
            </div>
          </div>

          <label className="block space-y-2">
            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Description</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Provide specific details about the situation..."
              className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-955 dark:text-white dark:focus:bg-slate-900"
            />
          </label>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950/50">
            <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                  <MapPin className="h-4 w-4 text-teal-500" />
                  Location Information <span className="text-red-500">*</span>
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Attach GPS or provide a specific landmark reference.</p>
              </div>
              <button
                type="button"
                onClick={handleGetLocation}
                disabled={isLocating}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-slate-800 hover:shadow disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
              >
                <Navigation className={`h-4 w-4 ${isLocating ? 'animate-pulse' : ''}`} />
                {isLocating ? "Acquiring Lock..." : "Auto-Detect GPS"}
              </button>
            </div>

            <div className="space-y-4">
              <input
                value={locationText}
                onChange={(e) => setLocationText(e.target.value)}
                placeholder="Street, barangay, or landmark reference"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  value={latitudeInput}
                  onChange={(e) => setLatitudeInput(e.target.value)}
                  placeholder="Latitude"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-mono text-slate-600 outline-none transition focus:border-teal-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400"
                />
                <input
                  value={longitudeInput}
                  onChange={(e) => setLongitudeInput(e.target.value)}
                  placeholder="Longitude"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-mono text-slate-600 outline-none transition focus:border-teal-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400"
                />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300">
                <Camera className="h-4 w-4 opacity-50" /> Photo Attachment
              </label>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Optional</span>
            </div>

            <div className="relative group cursor-pointer">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              {!imagePreview ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 py-8 transition group-hover:border-teal-400 group-hover:bg-teal-50/50 dark:border-slate-700 dark:bg-slate-950/50 dark:group-hover:border-teal-500 dark:group-hover:bg-teal-900/10">
                  <Camera className="mb-2 h-8 w-8 text-slate-400 transition group-hover:text-teal-500" />
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Tap to upload or take a photo</p>
                </div>
              ) : (
                <div className="relative">
                  <img src={imagePreview} alt="Preview" className="h-56 w-full rounded-2xl object-cover border border-slate-200 dark:border-slate-700" />
                  <div className="absolute inset-0 rounded-2xl bg-black/40 opacity-0 transition-opacity group-hover:opacity-100 flex items-center justify-center">
                    <span className="rounded-full bg-white/90 px-4 py-2 text-sm font-bold text-slate-900 backdrop-blur-sm">Change Image</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div aria-live="polite" className="h-6">
            {statusText && (
              <p className="text-center text-xs font-medium text-teal-600 dark:text-teal-400 animate-in fade-in slide-in-from-bottom-1">
                {statusText}
              </p>
            )}
          </div>

          <div className="pt-2 pb-6">
            <button
              type="submit"
              disabled={isSyncing || !canSubmit}
              className={`group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-full py-4 text-sm font-black uppercase tracking-widest text-white shadow-lg transition-all active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 ${isOnline
                ? "bg-teal-600 shadow-teal-600/30 hover:bg-teal-500"
                : "bg-amber-500 shadow-amber-500/30 hover:bg-amber-400 text-slate-900"
                }`}
            >
              {isSyncing ? (
                <span className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></div>
                  Processing...
                </span>
              ) : isOnline ? (
                "Submit Report"
              ) : (
                "Queue Offline"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}