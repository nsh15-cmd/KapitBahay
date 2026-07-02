import { useEffect, useState, useMemo } from "react";
import { doc, getDoc, setDoc, collection, onSnapshot } from "firebase/firestore";
import { HeartHandshake, AlertTriangle, Building2, Megaphone, Camera, X, Tent, CheckCircle, Navigation, MapPin, LifeBuoy, Home, Clock, Activity } from "lucide-react";
import { useDashboardStore } from "../../../store/useDashboardStore";
import { useAuth, useTheme } from "../../../App";
import { db } from "../../../lib/firebase";
import { getDistanceInKm, JURISDICTION_RADII } from "../../../lib/geoUtils";
import { getEvacuationAreas, getAnnouncements, saveAnnouncementLocally } from "../../../lib/indexedDb";
import type { EvacuationArea, Announcement, AnnouncementPriority } from "../../../lib/indexedDb";
import { getDittoInstance } from "../../../lib/ditto";
import { broadcastReportViaBluetooth } from "../../../lib/bluetoothSharing";
import { useOnlineStatus } from "../../../lib/useOnlineStatus";

export default function LguDashboard() {
  const { reports, filter, setFilter, updateReportStatus, startLiveStream } = useDashboardStore();
  const { user } = useAuth();
  const { theme } = useTheme();
  const isOnline = useOnlineStatus();

  const [isLguVerified, setIsLguVerified] = useState<boolean | null>(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);

  const [lguLocation, setLguLocation] = useState<{ lat: number, lng: number } | null>(null);
  const [lguJurisdiction, setLguJurisdiction] = useState<string>("City");

  // Real Data States
  const [activeEvacuations, setActiveEvacuations] = useState<EvacuationArea[]>([]);
  const [rawAnnouncements, setRawAnnouncements] = useState<Announcement[]>([]);

  // Geocoded Addresses Map (evacId -> string)
  const [addresses, setAddresses] = useState<Record<string, string>>({});

  // Incident Table Tabs
  const [activeTab, setActiveTab] = useState<string>("all");

  // Announcement Modal State
  const [isAnnouncementModalOpen, setIsAnnouncementModalOpen] = useState(false);
  const [announceTitle, setAnnounceTitle] = useState("");
  const [announceDesc, setAnnounceDesc] = useState("");
  const [announcePriority, setAnnouncePriority] = useState<AnnouncementPriority>("normal");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const verifyLguStatus = async () => {
      if (!user) return;
      try {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists())  {
          const data = docSnap.data();
          setIsLguVerified(data.verified === true);
          if (data.location) setLguLocation(data.location);
          if (data.jurisdiction) setLguJurisdiction(data.jurisdiction);
        } else {
          setIsLguVerified(false);
        }
      } catch (err) {
        setIsLguVerified(false);
      } finally {
        setIsCheckingStatus(false);
      }
    };

    verifyLguStatus();
    const unsubscribeStream = startLiveStream();

    // Initial Offline Load
    getEvacuationAreas().then(areas => setActiveEvacuations(areas.filter(a => a.active)));
    getAnnouncements().then(anns => setRawAnnouncements(anns));

    // Setup Firebase Listeners if Online
    let unsubEvac: (() => void) | null = null;
    let unsubAnnounce: (() => void) | null = null;

    if (isOnline) {
      unsubEvac = onSnapshot(collection(db, "evacuationAreas"), (snapshot) => {
        const fetchedEvacs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EvacuationArea));
        setActiveEvacuations(fetchedEvacs.filter(a => a.active));
      });

      unsubAnnounce = onSnapshot(collection(db, "announcements"), (snapshot) => {
        const fetchedAnns = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Announcement));
        setRawAnnouncements(fetchedAnns);
      });
    }

    return () => {
      if (unsubscribeStream) unsubscribeStream();
      if (unsubEvac) unsubEvac();
      if (unsubAnnounce) unsubAnnounce();
    };
  }, [user, startLiveStream, isOnline]);

  // Reverse Geocoding Effect (Converts Lat/Lng to real addresses)
  useEffect(() => {
    if (!isOnline) return;

    activeEvacuations.forEach(async (evac) => {
      if (!addresses[evac.id]) {
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${evac.location.lat}&lon=${evac.location.lng}`);
          const data = await res.json();
          if (data && data.display_name) {
            const shortAddress = data.display_name.split(', ').slice(0, 3).join(', ');
            setAddresses(prev => ({ ...prev, [evac.id]: shortAddress || data.display_name }));
          }
        } catch (error) {
          console.error("Geocoding error for evac area:", error);
        }
      }
    });
  }, [activeEvacuations, isOnline, addresses]);

  const activeAnnouncements = useMemo(() => {
    const now = Date.now();
    const priorityWeight = { emergency: 3, urgent: 2, normal: 1 };

    return rawAnnouncements
      .filter(a => a.status === 'active' && a.startDate <= now && a.endDate > now)
      .sort((a, b) => {
        const weightDiff = priorityWeight[b.priority] - priorityWeight[a.priority];
        if (weightDiff !== 0) return weightDiff;
        return b.createdAt - a.createdAt;
      });
  }, [rawAnnouncements]);

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setImagePreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const uploadToCloudinary = async (base64Image: string): Promise<string | null> => {
    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
    if (!cloudName || !uploadPreset) return base64Image;
    try {
      const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file: base64Image, upload_preset: uploadPreset }),
      });
      if (!response.ok) throw new Error("Cloudinary error");
      const data = await response.json();
      return data.secure_url;
    } catch (err) {
      return base64Image;
    }
  };

  const handlePublishAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!announceTitle.trim() || !announceDesc.trim() || !startDate || !endDate) return;

    const sTimestamp = new Date(startDate).getTime();
    const eTimestamp = new Date(endDate).getTime();

    if (eTimestamp <= sTimestamp) {
      alert("End date must be after start date.");
      return;
    }

    setIsSyncing(true);
    const annId = crypto.randomUUID();

    let finalImageUrl: string | undefined = imagePreview ?? undefined;
    if (isOnline && imagePreview) {
      const uploadedUrl = await uploadToCloudinary(imagePreview);
      if (uploadedUrl) finalImageUrl = uploadedUrl;
    }

    const newAnnouncement: Announcement = {
      id: annId,
      title: announceTitle.trim(),
      description: announceDesc.trim(),
      priority: announcePriority,
      startDate: sTimestamp,
      endDate: eTimestamp,
      createdAt: Date.now(),
      status: 'active',
      imageDataUrl: finalImageUrl,
    };

    await saveAnnouncementLocally(newAnnouncement);
    setRawAnnouncements(prev => [newAnnouncement, ...prev]);

    if (isOnline) {
      try {
        await setDoc(doc(db, "announcements", annId), newAnnouncement);
      } catch (error) {
        console.error("Failed to push announcement to Firebase:", error);
      }
    }

    try {
      const ditto = await getDittoInstance();
      await ditto.store.execute(`INSERT INTO users_announcements DOCUMENTS (:newAnnouncement)`, { newAnnouncement });
    } catch (err) { }

    if (!isOnline) {
      const meshPayload = { ...newAnnouncement, imageDataUrl: undefined };
      await broadcastReportViaBluetooth(meshPayload);
    }

    setIsSyncing(false);
    setAnnounceTitle("");
    setAnnounceDesc("");
    setImagePreview(null);
    setStartDate("");
    setEndDate("");
    setAnnouncePriority("normal");
    setIsAnnouncementModalOpen(false);
    alert(isOnline ? "Announcement broadcasted live!" : "Announcement queued for offline mesh propagation.");
  };

  if (isCheckingStatus) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#050E1F] flex flex-col items-center justify-center text-slate-900 dark:text-white font-mono">
        <div className="w-8 h-8 border-4 border-[#06B6D4] border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-xs tracking-widest text-slate-500 dark:text-slate-400">RESOLVING COMMAND AUTHORITY...</p>
      </div>
    );
  }

  if (isLguVerified === false) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#050E1F] text-slate-900 dark:text-white flex items-center justify-center p-4 transition-colors">
        <div className="w-full max-w-md p-6 bg-white dark:bg-[#0D1B35] border border-amber-200 dark:border-amber-500/30 rounded-2xl text-center shadow-2xl space-y-4">
          <div className="w-16 h-16 bg-amber-100 dark:bg-amber-500/10 text-amber-500 dark:text-amber-400 rounded-full flex items-center justify-center mx-auto shadow-[0_0_15px_rgba(245,158,11,0.15)]">
            <Building2 className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black tracking-tight">Access Pending</h2>
          <p className="text-sm text-slate-500 dark:text-[#94A3B8]">Awaiting NDRRMC Validation for Command Center Access.</p>
        </div>
      </div>
    );
  }

  const geofencedReports = reports.filter((r) => {
    if (!lguLocation) return true;
    const maxRadiusKm = JURISDICTION_RADII[lguJurisdiction] || 25;
    const distance = getDistanceInKm(lguLocation.lat, lguLocation.lng, r.location.lat, r.location.lng);
    return distance <= maxRadiusKm;
  });

  // Calculate stats for ALL categories
  const activeHazards = geofencedReports.filter((r) => r.type === "hazard" && r.status !== "resolved").length;
  const activeRescues = geofencedReports.filter((r) => r.type === "rescue" && r.status !== "resolved").length;
  const activeInfrastructure = geofencedReports.filter((r) => r.type === "infrastructure" && r.status !== "resolved").length;
  const activeResources = geofencedReports.filter((r) => r.type === "resource" && r.status !== "resolved").length;
  const resolvedToday = geofencedReports.filter((r) => r.status === "resolved").length;

  const actionableReports = geofencedReports.filter(r => r.status !== "resolved" && r.type !== "status");

  // Filter for the tabulated view based on selected tab
  const displayedReports = actionableReports.filter(r => activeTab === "all" || r.type === activeTab);

  // Helper to colorize the queue badges properly
  const getQueueBadgeColor = (type: string) => {
    switch (type) {
      case "hazard": return "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400";
      case "rescue": return "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400";
      case "infrastructure": return "bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-400";
      case "resource": return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400";
      default: return "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-400";
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#050E1F] text-slate-900 dark:text-white p-4 sm:p-6 lg:p-8 font-sans transition-colors">

      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:justify-between sm:items-end mb-8 gap-4 border-b border-slate-200 dark:border-[#1E293B] pb-5">
        <div>
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
            Strategic Operations <span className="text-[#06B6D4]">Hub</span>
          </h1>
          <p className="text-slate-500 dark:text-[#94A3B8] text-sm font-medium mt-1">
            {lguJurisdiction} Command Node • Live Telemetry
          </p>
        </div>
      </header>

      {/* Expanded 6-Column Stat Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 lg:gap-4 mb-8">
        <div className="bg-white dark:bg-[#0D1B35] border border-red-200 dark:border-red-500/30 p-4 rounded-2xl flex flex-col justify-between shadow-sm">
          <div className="flex justify-between items-start mb-3">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-red-500/70">Critical</span>
          </div>
          <div>
            <p className="text-2xl font-black text-slate-900 dark:text-white">{activeHazards}</p>
            <p className="text-[10px] text-slate-500 dark:text-[#94A3B8] mt-0.5 font-medium">Active Hazards</p>
          </div>
        </div>

        <div className="bg-white dark:bg-[#0D1B35] border border-amber-200 dark:border-amber-500/30 p-4 rounded-2xl flex flex-col justify-between shadow-sm">
          <div className="flex justify-between items-start mb-3">
            <LifeBuoy className="w-5 h-5 text-amber-500" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500/70">SOS</span>
          </div>
          <div>
            <p className="text-2xl font-black text-slate-900 dark:text-white">{activeRescues}</p>
            <p className="text-[10px] text-slate-500 dark:text-[#94A3B8] mt-0.5 font-medium">Rescue Requests</p>
          </div>
        </div>

        <div className="bg-white dark:bg-[#0D1B35] border border-slate-200 dark:border-slate-500/30 p-4 rounded-2xl flex flex-col justify-between shadow-sm">
          <div className="flex justify-between items-start mb-3">
            <Home className="w-5 h-5 text-slate-500" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500/70">Damage</span>
          </div>
          <div>
            <p className="text-2xl font-black text-slate-900 dark:text-white">{activeInfrastructure}</p>
            <p className="text-[10px] text-slate-500 dark:text-[#94A3B8] mt-0.5 font-medium">Infrastructure</p>
          </div>
        </div>

        <div className="bg-white dark:bg-[#0D1B35] border border-emerald-200 dark:border-emerald-500/30 p-4 rounded-2xl flex flex-col justify-between shadow-sm">
          <div className="flex justify-between items-start mb-3">
            <HeartHandshake className="w-5 h-5 text-emerald-500" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500/70">Logistics</span>
          </div>
          <div>
            <p className="text-2xl font-black text-slate-900 dark:text-white">{activeResources}</p>
            <p className="text-[10px] text-slate-500 dark:text-[#94A3B8] mt-0.5 font-medium">Resource Needs</p>
          </div>
        </div>

        <div className="bg-white dark:bg-[#0D1B35] border border-teal-200 dark:border-teal-500/30 p-4 rounded-2xl flex flex-col justify-between shadow-sm">
          <div className="flex justify-between items-start mb-3">
            <CheckCircle className="w-5 h-5 text-teal-500" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-teal-500/70">Cleared</span>
          </div>
          <div>
            <p className="text-2xl font-black text-slate-900 dark:text-white">{resolvedToday}</p>
            <p className="text-[10px] text-slate-500 dark:text-[#94A3B8] mt-0.5 font-medium">Resolved Cases</p>
          </div>
        </div>

        <div className="bg-white dark:bg-[#0D1B35] border border-indigo-200 dark:border-indigo-500/30 p-4 rounded-2xl flex flex-col justify-between shadow-sm">
          <div className="flex justify-between items-start mb-3">
            <Tent className="w-5 h-5 text-indigo-500" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-500/70">Shelter</span>
          </div>
          <div>
            <p className="text-2xl font-black text-slate-900 dark:text-white">{activeEvacuations.length}</p>
            <p className="text-[10px] text-slate-500 dark:text-[#94A3B8] mt-0.5 font-medium">Active Safe Zones</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">

        {/* Left Column: Evacuation Zones with Addressing */}
        <div className="xl:col-span-7 flex flex-col gap-6">
          <div className="bg-white dark:bg-[#0D1B35] border border-slate-200 dark:border-[#1E293B] rounded-2xl p-6 shadow-sm min-h-[600px]">
            <h2 className="text-lg font-bold flex items-center gap-2 mb-6">
              <Tent className="w-5 h-5 text-indigo-500" /> Established Evacuation Zones
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {activeEvacuations.length === 0 ? (
                <div className="col-span-full">
                  <p className="text-sm text-slate-500 italic py-6 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-center">No active evacuation centers declared.</p>
                </div>
              ) : (
                activeEvacuations.map(evac => (
                  <div key={evac.id} className="p-5 rounded-2xl border border-indigo-100 dark:border-indigo-900/30 bg-indigo-50/50 dark:bg-indigo-900/10 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start mb-3">
                        <h3 className="font-bold text-slate-900 dark:text-white line-clamp-1">{evac.name}</h3>
                        <span className="text-[9px] uppercase font-black tracking-wider text-indigo-600 bg-indigo-100 dark:bg-indigo-900/40 dark:text-indigo-400 px-2 py-1 rounded">Official</span>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-300 mb-4 line-clamp-2">{evac.description}</p>
                    </div>

                    <div className="mt-auto space-y-3 border-t border-indigo-200/50 dark:border-indigo-800/50 pt-3">
                      <div className="flex items-start gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 bg-white/60 dark:bg-[#050E1F]/40 p-2.5 rounded-lg border border-slate-200/50 dark:border-slate-800/50">
                        <MapPin className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                        <span className="leading-tight">
                          {addresses[evac.id]
                            ? addresses[evac.id]
                            : `Lat: ${evac.location.lat.toFixed(4)}, Lng: ${evac.location.lng.toFixed(4)} ${!isOnline ? '(Offline Mode)' : ''}`}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-800/50 px-2.5 py-1.5 rounded-lg w-max">
                        <Navigation className="w-3 h-3" />
                        {lguLocation ? `${getDistanceInKm(lguLocation.lat, lguLocation.lng, evac.location.lat, evac.location.lng).toFixed(1)} km from HQ` : "GPS Locked"}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Authority Comm */}
        <div className="xl:col-span-5 flex flex-col gap-6">
          <div className="bg-white dark:bg-[#0D1B35] border border-slate-200 dark:border-[#1E293B] rounded-2xl shadow-sm overflow-hidden flex flex-col h-[600px]">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-[#0A1628]">
              <div className="flex justify-between items-center mb-1">
                <h2 className="text-base font-bold flex items-center gap-2">
                  <Megaphone className="w-4 h-4 text-sky-500" /> Active Advisories
                </h2>
                <button
                  onClick={() => setIsAnnouncementModalOpen(true)}
                  className="bg-sky-500 hover:bg-sky-400 text-white font-bold text-[10px] uppercase tracking-wider py-1.5 px-3 rounded-lg transition-colors shadow-sm"
                >
                  + New
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {activeAnnouncements.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                  <Megaphone className="w-8 h-8 mb-2 opacity-20" />
                  <p className="text-xs italic text-center">No active announcements.</p>
                </div>
              ) : (
                activeAnnouncements.map(ann => (
                  <div key={ann.id} className={`p-4 rounded-xl border ${ann.priority === 'emergency' ? 'border-red-500/50 bg-red-50/50 dark:bg-red-950/20' : ann.priority === 'urgent' ? 'border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20' : 'border-sky-200 dark:border-sky-900/30 bg-sky-50/30 dark:bg-sky-950/10'}`}>
                    <div className="flex justify-between items-start mb-2">
                      <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${ann.priority === 'emergency' ? 'bg-red-500 text-white' : ann.priority === 'urgent' ? 'bg-amber-500 text-white' : 'bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-400'}`}>
                        {ann.priority}
                      </span>
                    </div>
                    <h4 className="font-bold text-slate-900 dark:text-white text-sm mb-1 leading-tight">{ann.title}</h4>
                    <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-3 mb-3">{ann.description}</p>
                    <div className="text-[9px] font-mono text-slate-400 dark:text-slate-500 uppercase">
                      Expires: {new Date(ann.endDate).toLocaleDateString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* NEW: Tabulated Incident Management Board spanning the bottom */}
        <div className="xl:col-span-12 flex flex-col gap-6">
          <div className="bg-white dark:bg-[#0D1B35] border border-slate-200 dark:border-[#1E293B] rounded-2xl p-6 shadow-sm min-h-[400px]">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Activity className="w-5 h-5 text-teal-500" /> Incident Management Board
              </h2>

              {/* Dynamic Filter Tabs */}
              <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0 no-scrollbar">
                {['all', 'hazard', 'rescue', 'infrastructure', 'resource'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-2 rounded-lg text-xs font-bold capitalize whitespace-nowrap transition-colors ${activeTab === tab ? 'bg-slate-800 text-white dark:bg-teal-500 dark:text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'}`}
                  >
                    {tab === 'all' ? 'All Incidents' : tab}
                  </button>
                ))}
              </div>
            </div>

            {/* Tabulated Data View */}
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-slate-50 dark:bg-[#0A1628] border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <th className="p-4 font-bold">Type</th>
                    <th className="p-4 font-bold">Time</th>
                    <th className="p-4 font-bold">Incident Details</th>
                    <th className="p-4 font-bold">Location</th>
                    <th className="p-4 font-bold text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedReports.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-sm text-slate-500 italic">No reports found for this category.</td>
                    </tr>
                  ) : (
                    displayedReports.map(report => (
                      <tr key={report.id} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="p-4 align-top">
                          <div className="flex flex-col gap-2 items-start">
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md ${getQueueBadgeColor(report.type)}`}>
                              {report.type}
                            </span>
                            {report.status === "on_the_way" && (
                              <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-900/30 whitespace-nowrap">
                                Responding
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-4 align-top text-xs text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap">
                          {new Date(report.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className="p-4 align-top">
                          <p className="text-sm font-bold text-slate-900 dark:text-white line-clamp-1 mb-1">{report.title}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 max-w-sm">{report.description || "No description provided."}</p>
                        </td>
                        <td className="p-4 align-top text-xs font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          {report.location.lat.toFixed(4)}, {report.location.lng.toFixed(4)}
                        </td>
                        <td className="p-4 align-top flex justify-end gap-2">
                          {report.status !== "on_the_way" && (
                            <button onClick={() => updateReportStatus(report.id, "on_the_way")} className="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border border-blue-200 dark:border-blue-800 whitespace-nowrap">
                              Dispatch
                            </button>
                          )}
                          <button onClick={() => updateReportStatus(report.id, "resolved")} className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border border-emerald-500/20 whitespace-nowrap">
                            Resolve
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* ANNOUNCEMENT MODAL */}
      {isAnnouncementModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-[#050E1F]/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white dark:bg-[#0D1B35] rounded-3xl p-6 sm:p-8 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsAnnouncementModalOpen(false)}
              className="absolute right-6 top-6 text-slate-400 hover:text-slate-600 dark:hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="mb-6">
              <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-sky-500" /> Issue Public Advisory
              </h2>
            </div>

            <form onSubmit={handlePublishAnnouncement} className="space-y-4">

              <div className="grid grid-cols-2 gap-4">
                <label className="block space-y-1.5 col-span-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Priority Level</span>
                  <select
                    value={announcePriority}
                    onChange={(e) => setAnnouncePriority(e.target.value as AnnouncementPriority)}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-[#0A1628] border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-sky-500 font-bold"
                  >
                    <option value="normal">Normal Advisory</option>
                    <option value="urgent">Urgent</option>
                    <option value="emergency">EMERGENCY (Critical)</option>
                  </select>
                </label>
              </div>

              <label className="block space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Headline</span>
                <input
                  type="text"
                  required
                  value={announceTitle}
                  onChange={e => setAnnounceTitle(e.target.value)}
                  placeholder="e.g. Relief Goods Distribution Schedule"
                  className="w-full px-4 py-3 text-sm bg-slate-50 dark:bg-[#0A1628] border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white outline-none focus:border-sky-500"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Full Details</span>
                <textarea
                  required
                  rows={4}
                  value={announceDesc}
                  onChange={e => setAnnounceDesc(e.target.value)}
                  placeholder="Provide clear instructions or updates..."
                  className="w-full px-4 py-3 text-sm bg-slate-50 dark:bg-[#0A1628] border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white outline-none focus:border-sky-500 resize-none"
                />
              </label>

              <div className="grid grid-cols-2 gap-4">
                <label className="block space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Start Date</span>
                  <input type="datetime-local" required value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-[#0A1628] border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white outline-none" />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">End Date</span>
                  <input type="datetime-local" required value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-[#0A1628] border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white outline-none" />
                </label>
              </div>

              <div className="space-y-1.5 pt-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Image Attachment (Optional)</span>
                <div className="relative group cursor-pointer">
                  <input type="file" accept="image/*" onChange={handleImageChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                  {!imagePreview ? (
                    <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 py-4 transition group-hover:border-sky-400 dark:border-slate-700 dark:bg-[#0A1628]">
                      <Camera className="mb-1 h-5 w-5 text-slate-400 transition group-hover:text-sky-500" />
                      <p className="text-[10px] font-medium text-slate-600 dark:text-slate-400">Upload flyer or photo</p>
                    </div>
                  ) : (
                    <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
                      <img src={imagePreview} alt="Preview" className="h-32 w-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100 flex items-center justify-center">
                        <span className="rounded-full bg-white/90 px-3 py-1 text-[10px] font-bold text-slate-900">Change Image</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={isSyncing}
                className={`w-full mt-4 text-white font-black text-xs uppercase tracking-widest py-3.5 rounded-xl shadow-lg transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 ${announcePriority === 'emergency' ? 'bg-red-600 hover:bg-red-500' : announcePriority === 'urgent' ? 'bg-amber-500 hover:bg-amber-400' : 'bg-sky-600 hover:bg-sky-500'}`}
              >
                {isSyncing ? (
                  <><div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></div> Publishing...</>
                ) : (
                  "Broadcast to Network"
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}