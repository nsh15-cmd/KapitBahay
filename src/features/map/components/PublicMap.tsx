// C:\Users\Renz Jericho Buday\KapitBahay\src\features\map\components\PublicMap.tsx
import { useEffect, useMemo, useState } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import { AlertTriangle, Network, HeartHandshake, Home, LifeBuoy, MapPin, Navigation, ShieldAlert, Crosshair, Tent, X, Trash2, Footprints } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getCachedLocation, getPendingReports, updateReportStatus } from "../../../lib/indexedDb";
import type { LocalReport } from "../../../lib/indexedDb";
import type { StyleSpecification } from "maplibre-gl";
import type { ViewState } from "@vis.gl/react-maplibre";
import { useTheme, useAuth } from "../../../App";
import { useOnlineStatus } from "../../../lib/useOnlineStatus";
import { collection, doc, onSnapshot, orderBy, query, updateDoc, arrayUnion, where, addDoc, deleteDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { getBoundingBox, getDistanceInKm } from "../../../lib/geoUtils";
import { syncEventEmitter } from "../../../lib/syncEngine";
import MapGL, { Marker, Popup, NavigationControl, Source, Layer } from "react-map-gl/maplibre";
import { useMeshPresence } from "../../../lib/useMeshPresence";

const defaultCenter: Partial<ViewState> = { latitude: 14.7140, longitude: 120.9388, zoom: 14 };

const categoryBadge: Record<LocalReport["category"], { label: string; color: string; bg: string; icon: LucideIcon }> = {
  hazard: { label: "Hazard", color: "text-red-600 dark:text-red-400", bg: "bg-red-500", icon: AlertTriangle },
  resource: { label: "Resources", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500", icon: HeartHandshake },
  rescue: { label: "Rescue", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500", icon: LifeBuoy },
  infrastructure: { label: "Damage", color: "text-slate-600 dark:text-slate-400", bg: "bg-slate-500", icon: Home },
  status: { label: "Status", color: "text-sky-600 dark:text-sky-400", bg: "bg-sky-500", icon: ShieldAlert },
};

const mapSources = (theme: string): StyleSpecification => ({
  version: 8 as const,
  sources: {
    "cartodb-tiles": {
      type: "raster",
      tiles: [
        theme === "dark"
          ? "https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png"
          : "https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; OSM',
    },
  },
  layers: [
    {
      id: "cartodb-basemap",
      type: "raster",
      source: "cartodb-tiles",
      minzoom: 0,
      maxzoom: 19,
    },
  ],
});

const getClusterSize = (zoom: number) => {
  if (zoom >= 16) return 0.0001;
  if (zoom >= 14) return 0.002;
  if (zoom >= 12) return 0.01;
  if (zoom >= 8) return 0.08;
  return 0.25;
};

export default function PublicMap() {
  const [localReports, setLocalReports] = useState<LocalReport[]>([]);
  const [remoteReports, setRemoteReports] = useState<LocalReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<LocalReport | null>(null);

  // Evacuation Areas State
  const [evacuationAreas, setEvacuationAreas] = useState<any[]>([]);
  const [selectedEvacArea, setSelectedEvacArea] = useState<any | null>(null);
  const [isAddingEvac, setIsAddingEvac] = useState(false);
  const [newEvacData, setNewEvacData] = useState({ name: "", description: "" });

  // Routing State
  const [routeGeoJSON, setRouteGeoJSON] = useState<any>(null);
  const [walkStats, setWalkStats] = useState<{ dist: string; time: string } | null>(null);

  const [commentText, setCommentText] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);

  const [viewState, setViewState] = useState<Partial<ViewState>>(defaultCenter);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [cachedLocationLabel] = useState<string | null>(null);

  const { theme } = useTheme();
  const { role, user } = useAuth();
  const isOnline = useOnlineStatus();
  const meshPeers = useMeshPresence();

  // Combine and deduplicate
  const mergedReports = useMemo(() => {
    const seen = new Set<string>();
    const merged: LocalReport[] = [];
    [...remoteReports, ...localReports].forEach((report) => {
      if (!seen.has(report._id)) {
        seen.add(report._id);
        merged.push(report);
      }
    });
    return merged;
  }, [localReports, remoteReports]);

  // UI CLEANUP LOGIC: Hide "Solved" reports from normal users after 1 day (24 hours)
  const visibleReports = useMemo(() => {
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    const now = Date.now();

    return mergedReports.filter(report => {
      const currentStatus = report.lifecycleStatus || report.status;
      if (currentStatus === "resolved") {
        return (now - report.timestamp) < ONE_DAY_MS;
      }
      return true;
    });
  }, [mergedReports]);

  const reportCounts = useMemo(
    () => ({
      total: visibleReports.length,
      pending: visibleReports.filter((report) => {
        const s = report.lifecycleStatus || report.status;
        return s === "pending" || s === "synced";
      }).length,
      active: visibleReports.filter((report) => report.lifecycleStatus === "on_the_way").length,
      resolved: visibleReports.filter((report) => report.lifecycleStatus === "resolved").length,
    }),
    [visibleReports]
  );

  const statusLabelMap: Record<string, string> = {
    pending: "Queued Offline",
    synced: "Awaiting Action",
    on_the_way: "On the way",
    needs_verification: "Needs Verification",
    resolved: "Solved",
    false_report: "False Report",
    failed: "Needs review",
  };

  const handleAddComment = async () => {
    if (!selectedReport || !commentText.trim()) return;

    const authorName = isAnonymous
      ? "Anonymous Citizen"
      : (user?.displayName || (role === "admin" ? "Admin" : role === "lgu" ? "LGU Officer" : "Citizen"));

    const newComment = {
      id: crypto.randomUUID(),
      authorName,
      authorRole: isAnonymous ? "anonymous" : (role ?? "user"),
      message: commentText.trim(),
      timestamp: new Date().toISOString()
    };

    if (navigator.onLine) {
      try {
        const reportRef = doc(db, "reports", selectedReport._id);
        await updateDoc(reportRef, { comments: arrayUnion(newComment) });
        setCommentText("");
      } catch (error) {
        console.error("Error pushing comment to Firebase:", error);
      }
    } else {
      alert("You must be online to post a comment.");
    }
  };

  const handleSetStatus = async (nextStatus: string) => {
    if (!selectedReport) return;

    const patch = { lifecycleStatus: nextStatus as LocalReport["status"], status: nextStatus as LocalReport["status"] };

    setSelectedReport(prev => prev ? { ...prev, ...patch } : null);
    setLocalReports(prev => prev.map((report) => report._id === selectedReport._id ? { ...report, ...patch } : report));
    setRemoteReports(prev => prev.map((report) => report._id === selectedReport._id ? { ...report, ...patch } : report));

    try {
      await updateReportStatus(selectedReport._id, nextStatus as LocalReport["status"], navigator.onLine);
    } catch (err) {
      console.warn("Local DB update skipped/failed", err);
    }

    if (navigator.onLine) {
      try {
        const reportRef = doc(db, "reports", selectedReport._id);
        await updateDoc(reportRef, { lifecycleStatus: nextStatus, status: nextStatus, synced: true });
      } catch (error) {
        console.error("Error updating status in Firebase:", error);
      }
    }
  };

  // Evacuation Area Functions
  const handleSaveEvacArea = async () => {
    if (!newEvacData.name.trim()) return alert("Evacuation Area needs a name");
    try {
      const payload = {
        name: newEvacData.name,
        description: newEvacData.description,
        location: { lat: viewState.latitude, lng: viewState.longitude },
        timestamp: Date.now(),
        active: true
      };
      await addDoc(collection(db, "evacuationAreas"), payload);
      setIsAddingEvac(false);
      setNewEvacData({ name: "", description: "" });
    } catch (err) {
      console.error("Error saving evacuation area:", err);
    }
  };

  const handleDeleteEvacArea = async (id: string) => {
    const confirm = window.confirm("Are you sure you want to remove this Evacuation Area?");
    if (!confirm) return;
    try {
      await deleteDoc(doc(db, "evacuationAreas", id));
      setSelectedEvacArea(null);
    } catch (err) {
      console.error("Error deleting evacuation area:", err);
    }
  };

  // 🚶‍♂️ WALKING ROUTE ENGINE
  useEffect(() => {
    const fetchRoute = async () => {
      const targetLocation = selectedReport?.location || selectedEvacArea?.location;

      // Clear route if popup closes or target is missing
      if (!currentLocation || !targetLocation) {
        setRouteGeoJSON(null);
        setWalkStats(null);
        return;
      }

      // If offline, just rely on straight-line distance, don't attempt fetch
      if (!isOnline) {
        setRouteGeoJSON(null);
        setWalkStats(null);
        return;
      }

      try {
        // Ping Open Source Routing Machine for walking (foot) profile
        const response = await fetch(
          `https://router.project-osrm.org/route/v1/foot/${currentLocation.lng},${currentLocation.lat};${targetLocation.lng},${targetLocation.lat}?overview=full&geometries=geojson`
        );
        const data = await response.json();

        if (data.routes && data.routes.length > 0) {
          const route = data.routes[0];

          setRouteGeoJSON({
            type: "Feature",
            properties: {},
            geometry: route.geometry
          });

          // Convert meters to km, and seconds to minutes
          setWalkStats({
            dist: (route.distance / 1000).toFixed(2),
            time: Math.ceil(route.duration / 60).toString()
          });
        }
      } catch (err) {
        console.warn("Walking route calculation failed (likely network timeout).", err);
        setRouteGeoJSON(null);
        setWalkStats(null);
      }
    };

    fetchRoute();
  }, [selectedReport, selectedEvacArea, currentLocation, isOnline]);

  // Load Initial Data and keep the map in sync with local mesh/BLE arrivals
  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      const cached = await getCachedLocation();
      if (!cancelled) {
        if (cached) {
          setCurrentLocation({ lat: cached.lat, lng: cached.lng });
          setCachedLocationLabel(cached.address ?? "Cached GPS location");
          setViewState({ latitude: cached.lat, longitude: cached.lng, zoom: 11 });
        }

        const data = await getPendingReports();
        if (!cancelled) setLocalReports(data);
      }
    };

    const handleMeshUpdate = () => {
      void loadData();
    };

    void loadData();
    syncEventEmitter.addEventListener("mesh-update", handleMeshUpdate);

    return () => {
      cancelled = true;
      syncEventEmitter.removeEventListener("mesh-update", handleMeshUpdate);
    };
  }, []);

  // Fetch Evac Areas Live
  useEffect(() => {
    if (!isOnline) return;
    const evacQuery = query(collection(db, "evacuationAreas"));
    const unsubEvac = onSnapshot(evacQuery, (snap) => {
      setEvacuationAreas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsubEvac();
  }, [isOnline]);

  // Fetch Reports Live
  useEffect(() => {
    if (!isOnline) {
      setRemoteReports([]);
      return;
    }

    const activeCenter = currentLocation ?? { lat: defaultCenter.latitude ?? 14.7140, lng: defaultCenter.longitude ?? 120.9388 };
    const queryRadiusKm = 10;
    const bounds = getBoundingBox(activeCenter.lat, activeCenter.lng, queryRadiusKm);

    const reportsQuery = query(
      collection(db, "reports"),
      where("location.lat", ">=", bounds.minLat),
      where("location.lat", "<=", bounds.maxLat),
      orderBy("location.lat"),
      orderBy("timestamp", "desc")
    );

    const unsubscribe = onSnapshot(
      reportsQuery,
      (snapshot) => {
        const fetched: LocalReport[] = snapshot.docs
          .map((doc) => ({ _id: doc.id, ...doc.data() } as LocalReport))
          .filter((report) => {
            if (!report.location || typeof report.location.lat !== "number" || typeof report.location.lng !== "number") return false;
            if (report.location.lng < bounds.minLng || report.location.lng > bounds.maxLng) return false;
            return getDistanceInKm(report.location.lat, report.location.lng, activeCenter.lat, activeCenter.lng) <= queryRadiusKm;
          });

        setRemoteReports(fetched);
        setSelectedReport(currentSelected => {
          if (!currentSelected) return null;
          return fetched.find(r => r._id === currentSelected._id) || currentSelected;
        });
      },
      (error) => console.error("Error fetching remote reports for map:", error)
    );

    return () => unsubscribe();
  }, [isOnline, currentLocation]);

  // Request Hardware Location
  useEffect(() => {
    if (!("geolocation" in navigator)) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCurrentLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
        setViewState((current) => ({
          ...current,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          zoom: 15
        }));
      },
      () => { },
      { enableHighAccuracy: true, maximumAge: 30000, timeout: 12000 }
    );
  }, []);

  const clusters = useMemo(() => {
    const currentZoom = viewState.zoom ?? 5;

    if (currentZoom >= 15) {
      return visibleReports.map((report, index) => {
        const offset = index * 0.00003;
        return {
          latitude: report.location.lat + offset,
          longitude: report.location.lng - offset,
          reports: [report]
        };
      });
    }

    const clusterRadius = getClusterSize(currentZoom);
    const grid = new Map<string, { latitude: number; longitude: number; reports: LocalReport[] }>();

    visibleReports.forEach((report) => {
      const latKey = Math.round(report.location.lat / clusterRadius);
      const lngKey = Math.round(report.location.lng / clusterRadius);
      const key = `${latKey}:${lngKey}`;
      const existing = grid.get(key);

      if (!existing) {
        grid.set(key, { latitude: report.location.lat, longitude: report.location.lng, reports: [report] });
      } else {
        existing.reports.push(report);
        existing.latitude = existing.reports.reduce((sum, item) => sum + item.location.lat, 0) / existing.reports.length;
        existing.longitude = existing.reports.reduce((sum, item) => sum + item.location.lng, 0) / existing.reports.length;
      }
    });

    return Array.from(grid.values());
  }, [visibleReports, viewState.zoom]);

  const mapStyle = useMemo(() => mapSources(theme), [theme]);

  const flyToCurrentLocation = () => {
    if (currentLocation) {
      setViewState(prev => ({
        ...prev,
        latitude: currentLocation.lat,
        longitude: currentLocation.lng,
        zoom: 15
      }));
    }
  };

  const centerOnPin = (lat: number, lng: number) => {
    setViewState(prev => ({
      ...prev,
      latitude: lat,
      longitude: lng,
      zoom: Math.max(prev.zoom ?? 15, 16)
    }));
  };

  // Helper function to render distance inside popups
  const renderDistanceLabel = (targetLocation: { lat: number, lng: number }) => {
    if (!currentLocation) return null;

    // If we successfully grabbed the OSRM route payload
    if (walkStats) {
      return (
        <div className="flex items-center justify-center gap-1.5 mt-3 mb-1 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 py-2 rounded-xl text-xs font-bold border border-teal-200 dark:border-teal-800">
          <Footprints className="w-4 h-4" />
          {walkStats.dist} km walk ({walkStats.time} mins)
        </div>
      );
    }

    // Fallback: Offline mode straight-line coordinate distance
    const straightDist = getDistanceInKm(currentLocation.lat, currentLocation.lng, targetLocation.lat, targetLocation.lng).toFixed(2);
    return (
      <div className="flex items-center justify-center gap-1.5 mt-3 mb-1 bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-800">
        <Navigation className="w-4 h-4" />
        {straightDist} km away (straight line)
      </div>
    );
  };

  return (
    <div className="mx-auto flex max-w-screen-2xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">

      {/* 1. HEADER & STATS */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-500">Community Map</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-900 dark:text-white sm:text-4xl">Incident Dashboard</h1>
          <div className="mt-3 flex items-center gap-2">
            <span className="relative flex h-3 w-3 items-center justify-center">
              {isOnline && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>}
              <span className={`relative inline-flex h-2 w-2 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
            </span>
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
              {isOnline ? "Live Sync Active" : "Offline Cache Mode"}
            </span>
          </div>
          {!isOnline && (
            <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${meshPeers > 0 ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
              <Network className="h-3.5 w-3.5" />
              {meshPeers} {meshPeers === 1 ? 'Peer' : 'Peers'} Nearby
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:w-auto">
          {[
            { label: "Total Visible", count: reportCounts.total, color: "text-slate-900 dark:text-white", border: "border-slate-200 dark:border-slate-800" },
            { label: "Awaiting", count: reportCounts.pending, color: "text-amber-600 dark:text-amber-400", border: "border-amber-200/50 dark:border-amber-900/50" },
            { label: "Responding", count: reportCounts.active, color: "text-blue-600 dark:text-blue-400", border: "border-blue-200/50 dark:border-blue-900/50" },
            { label: "Solved (24h)", count: reportCounts.resolved, color: "text-emerald-600 dark:text-emerald-400", border: "border-emerald-200/50 dark:border-emerald-900/50" },
          ].map((stat, i) => (
            <div key={i} className={`flex flex-col items-center justify-center rounded-2xl border bg-white p-3 shadow-sm dark:bg-[#0D1B35] ${stat.border}`}>
              <span className={`text-2xl font-black ${stat.color}`}>{stat.count}</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{stat.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 2. MAIN CONTENT GRID (Map + Sidebar) */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12 lg:h-[75vh] min-h-[600px]">

        {/* MAP COLUMN */}
        <div className="relative flex h-[60vh] flex-col overflow-hidden rounded-[2rem] border border-slate-200 bg-slate-50 shadow-xl dark:border-slate-800 dark:bg-[#07101f] lg:col-span-8 lg:h-full">

          {/* Map Overlay Controls */}
          <div className="absolute left-4 top-4 z-10 flex flex-col gap-2">
            <button
              onClick={flyToCurrentLocation}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-700 shadow-md transition hover:bg-slate-50 hover:text-teal-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-teal-400"
              title="Center on me"
            >
              <Crosshair className="h-5 w-5" />
            </button>

            {/* LGU Evacuation Add Tool */}
            {(role === "admin" || role === "lgu") && (
              <button
                onClick={() => { setIsAddingEvac(!isAddingEvac); setSelectedEvacArea(null); setSelectedReport(null); }}
                className={`flex h-10 w-10 items-center justify-center rounded-full shadow-md transition ${isAddingEvac ? 'bg-indigo-500 text-white hover:bg-indigo-600' : 'bg-white text-indigo-600 hover:bg-indigo-50 dark:bg-slate-900 dark:text-indigo-400'}`}
                title={isAddingEvac ? "Cancel Add Evacuation" : "Add Evacuation Center"}
              >
                {isAddingEvac ? <X className="h-5 w-5" /> : <Tent className="h-5 w-5" />}
              </button>
            )}
          </div>

          {/* Add Evacuation Crosshair Target */}
          {isAddingEvac && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
              <div className="relative flex items-center justify-center">
                <Crosshair className="h-10 w-10 text-indigo-600 animate-pulse drop-shadow-md" />
                <div className="absolute -bottom-8 bg-indigo-600 text-white text-[10px] font-bold px-2 py-1 rounded-full whitespace-nowrap shadow-lg">Target Location</div>
              </div>
            </div>
          )}

          {/* Add Evacuation UI Panel */}
          {isAddingEvac && (
            <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-2xl z-20 w-[90%] max-w-sm border border-slate-200 dark:border-slate-800 animate-in slide-in-from-bottom-5">
              <div className="flex items-center gap-2 mb-3 text-indigo-600 dark:text-indigo-400 font-bold text-sm">
                <Tent className="w-4 h-4" /> Add Evacuation Center
              </div>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Center Name (e.g. Brgy. Hall)"
                  value={newEvacData.name}
                  onChange={(e) => setNewEvacData({ ...newEvacData, name: e.target.value })}
                  className="w-full text-sm p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 dark:text-white outline-none focus:border-indigo-500"
                />
                <input
                  type="text"
                  placeholder="Capacity / Description (Optional)"
                  value={newEvacData.description}
                  onChange={(e) => setNewEvacData({ ...newEvacData, description: e.target.value })}
                  className="w-full text-sm p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 dark:text-white outline-none focus:border-indigo-500"
                />
                <button
                  onClick={handleSaveEvacArea}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-3 rounded-xl shadow-md transition-colors"
                >
                  Drop Pin Here
                </button>
              </div>
            </div>
          )}

          <MapGL
            initialViewState={viewState}
            mapStyle={mapStyle as any}
            onMove={(evt) => setViewState(evt.viewState)}
            style={{ width: "100%", height: "100%" }}
          >
            <NavigationControl position="bottom-right" />

            {/* DYNAMIC WALKING ROUTE LAYER */}
            {routeGeoJSON && (
              <Source id="walking-route" type="geojson" data={routeGeoJSON}>
                <Layer
                  id="walking-route-line"
                  type="line"
                  layout={{
                    "line-join": "round",
                    "line-cap": "round"
                  }}
                  paint={{
                    "line-color": "#14b8a6", // Tailwind Teal 500
                    "line-width": 5,
                    "line-dasharray": [1, 2] // Dotted pattern for walking
                  }}
                />
              </Source>
            )}

            {/* User GPS Pin */}
            {currentLocation && (
              <Marker latitude={currentLocation.lat} longitude={currentLocation.lng} anchor="center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-teal-400 bg-teal-500/20 text-teal-300 shadow-lg backdrop-blur-sm">
                  <MapPin className="h-5 w-5" />
                </div>
              </Marker>
            )}

            {/* Evacuation Area Markers */}
            {evacuationAreas.map((evac) => (
              <Marker key={evac.id} latitude={evac.location.lat} longitude={evac.location.lng} anchor="bottom">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedReport(null);
                    setIsAddingEvac(false);
                    setSelectedEvacArea(evac);
                    centerOnPin(evac.location.lat, evac.location.lng);
                  }}
                  className="group relative flex flex-col items-center justify-center transition-transform hover:scale-110"
                >
                  <div className="bg-indigo-600 text-white p-2 rounded-full border-[3px] border-white dark:border-slate-900 shadow-xl z-10">
                    <Tent className="w-5 h-5" />
                  </div>
                  <div className="absolute top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-[10px] font-bold px-2 py-1 rounded-md shadow-md pointer-events-none whitespace-nowrap z-20">
                    {evac.name}
                  </div>
                </button>
              </Marker>
            ))}

            {/* Report Clusters / Markers */}
            {clusters.map((cluster) => {
              const isGroup = cluster.reports.length > 1;
              const primary = cluster.reports[0];
              const badge = categoryBadge[primary.category] || categoryBadge.status;
              const Icon = badge.icon;
              return (
                <Marker key={`${cluster.latitude}-${cluster.longitude}-${cluster.reports.length}`} latitude={cluster.latitude} longitude={cluster.longitude} anchor="bottom">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedEvacArea(null);
                      setIsAddingEvac(false);
                      if (isGroup) {
                        setViewState((current: Partial<ViewState>) => ({
                          ...current,
                          latitude: cluster.latitude,
                          longitude: cluster.longitude,
                          zoom: Math.min((current.zoom ?? 0) + 2, 16),
                        }));
                        return;
                      }
                      setSelectedReport(primary);
                      centerOnPin(primary.location.lat, primary.location.lng);
                    }}
                    className={`group relative flex h-12 w-12 items-center justify-center rounded-full border-[3px] border-white shadow-xl transition-transform hover:scale-110 dark:border-slate-900 ${isGroup ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900" : `${badge.bg} text-white`}`}
                  >
                    {isGroup ? (
                      <span className="text-sm font-bold">{cluster.reports.length}</span>
                    ) : (
                      <Icon className="h-5 w-5" />
                    )}
                  </button>
                </Marker>
              );
            })}

            {/* EVACUATION AREA POPUP DETAIL VIEW */}
            {selectedEvacArea && (
              <Popup
                latitude={selectedEvacArea.location.lat}
                longitude={selectedEvacArea.location.lng}
                anchor="bottom"
                offset={35}
                onClose={() => {
                  setSelectedEvacArea(null);
                  setRouteGeoJSON(null);
                  setWalkStats(null);
                }}
                closeButton={true}
                maxWidth="300px"
                className="custom-popup"
              >
                <div className="p-4 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 rounded-2xl shadow-2xl">
                  <div className="flex items-center gap-2 mb-2 text-indigo-600 dark:text-indigo-400">
                    <Tent className="w-5 h-5" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Official Evacuation Area</span>
                  </div>
                  <h4 className="text-base font-black leading-tight">{selectedEvacArea.name}</h4>
                  <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                    {selectedEvacArea.description || "No description provided."}
                  </p>

                  {/* WALKING DISTANCE BADGE */}
                  {renderDistanceLabel(selectedEvacArea.location)}

                  {/* Remove Button for LGU */}
                  {(role === "admin" || role === "lgu") && (
                    <button
                      onClick={() => handleDeleteEvacArea(selectedEvacArea.id)}
                      className="mt-2 w-full flex items-center justify-center gap-1.5 py-2 bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 rounded-xl text-xs font-bold hover:bg-red-100 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Remove Location
                    </button>
                  )}
                </div>
              </Popup>
            )}

            {/* INCIDENT REPORT POPUP DETAIL VIEW */}
            {selectedReport && (
              <Popup
                latitude={selectedReport.location.lat}
                longitude={selectedReport.location.lng}
                anchor="bottom"
                offset={30}
                onClose={() => {
                  setSelectedReport(null);
                  setRouteGeoJSON(null);
                  setWalkStats(null);
                }}
                closeButton={true}
                maxWidth="320px"
                className="custom-popup"
              >
                <div className="flex max-h-[60vh] flex-col overflow-y-auto overflow-x-hidden rounded-2xl bg-white p-4 text-slate-900 shadow-2xl dark:bg-slate-950 dark:text-slate-100">
                  <div className="mb-3 flex items-center gap-2 pr-4">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${selectedReport.category === "hazard" ? "bg-red-100 text-red-700" : selectedReport.category === "resource" ? "bg-emerald-100 text-emerald-700" : selectedReport.category === "rescue" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"}`}>
                      {selectedReport.category}
                    </span>
                    <span className="text-[10px] text-slate-500">{new Date(selectedReport.timestamp).toLocaleTimeString()}</span>
                  </div>

                  <h4 className="text-base font-bold leading-tight">{selectedReport.title}</h4>
                  <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">{selectedReport.description || "No description provided."}</p>

                  {/* WALKING DISTANCE BADGE */}
                  {renderDistanceLabel(selectedReport.location)}

                  {selectedReport.imageDataUrl && (
                    <img src={selectedReport.imageDataUrl} alt="Report attachment" className="mt-2 h-32 w-full rounded-xl object-cover border border-slate-100 dark:border-slate-800" />
                  )}

                  <div className="mt-4 space-y-4 border-t border-slate-100 pt-4 dark:border-slate-800">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">Status</span>
                      <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {statusLabelMap[selectedReport.lifecycleStatus || selectedReport.status] || (selectedReport.lifecycleStatus || selectedReport.status)}
                      </span>
                    </div>

                    <div>
                      <h5 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Comments</h5>
                      {(selectedReport.comments ?? []).length > 0 ? (
                        <ul className="max-h-40 space-y-2 overflow-y-auto pr-1">
                          {(selectedReport.comments ?? []).map((comment) => (
                            <li key={comment.id} className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-900">
                              <div className="flex items-center justify-between">
                                <p className="text-[10px] font-bold uppercase text-slate-500">{comment.authorName}</p>
                              </div>
                              <p className="mt-1 text-xs text-slate-700 dark:text-slate-300">{comment.message}</p>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs italic text-slate-400">No comments yet.</p>
                      )}
                    </div>

                    <div className="flex flex-col gap-2">
                      <textarea
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        rows={2}
                        placeholder="Add a comment..."
                        className="w-full resize-none rounded-xl border border-slate-200 bg-white p-2 text-xs text-slate-900 outline-none transition focus:border-teal-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                      />
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-1.5 text-[10px] text-slate-500 cursor-pointer">
                          <input type="checkbox" checked={isAnonymous} onChange={(e) => setIsAnonymous(e.target.checked)} className="rounded border-slate-300 text-teal-500 focus:ring-teal-500" />
                          Hide name
                        </label>
                        <button onClick={handleAddComment} className="rounded-full bg-teal-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-teal-400">Post</button>
                      </div>
                    </div>

                    {/* Authority Controls */}
                    {(role === "admin" || role === "lgu") && (
                      <div className="mt-2 rounded-xl bg-slate-100 p-2 dark:bg-slate-900">
                        <p className="mb-2 text-center text-[9px] font-bold uppercase tracking-widest text-slate-500">Authority Tools</p>
                        <div className="grid grid-cols-2 gap-1.5">
                          <button onClick={() => handleSetStatus("pending")} className="rounded-lg bg-white py-1 text-[10px] font-bold text-slate-700 shadow-sm dark:bg-slate-800 dark:text-slate-300">Pending</button>
                          <button onClick={() => handleSetStatus("on_the_way")} className="rounded-lg bg-blue-50 py-1 text-[10px] font-bold text-blue-700 shadow-sm dark:bg-blue-900/30 dark:text-blue-400">On Way</button>
                          <button onClick={() => handleSetStatus("false_report")} className="rounded-lg bg-red-50 py-1 text-[10px] font-bold text-red-600 shadow-sm dark:bg-red-950/30 dark:text-red-400">False</button>
                          <button onClick={() => handleSetStatus("resolved")} className="rounded-lg bg-emerald-500 py-1 text-[10px] font-bold text-white shadow-sm hover:bg-emerald-400">Solved</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </Popup>
            )}
          </MapGL>
        </div>

        {/* SIDEBAR COLUMN (Feed + Legend) */}
        <div className="flex flex-col gap-6 lg:col-span-4 lg:h-full overflow-hidden">

          {/* Scrollable Feed */}
          <div className="flex flex-1 flex-col overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-[#0D1B35] min-h-[400px]">
            <div className="border-b border-slate-100 p-6 pb-4 dark:border-slate-800/60">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Live Area Feed</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Most recent community reports</p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {visibleReports.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center p-6 text-slate-500">
                  <Navigation className="h-8 w-8 mb-2 opacity-20" />
                  <p className="text-sm">No recent active reports found in your area.</p>
                </div>
              ) : (
                visibleReports.map((report) => {
                  const badge = categoryBadge[report.category] || categoryBadge.status;
                  const Icon = badge.icon;
                  const commentCount = report.comments?.length ?? 0;
                  const reportStatus = report.lifecycleStatus || report.status;

                  return (
                    <button
                      key={report._id}
                      onClick={() => {
                        setSelectedEvacArea(null);
                        setSelectedReport(report);
                        centerOnPin(report.location.lat, report.location.lng);
                      }}
                      className="w-full text-left flex items-start gap-3 rounded-[1.25rem] border border-slate-100 bg-slate-50/50 p-3.5 transition hover:border-teal-500 hover:bg-white hover:shadow-md dark:border-slate-800/60 dark:bg-slate-900/50 dark:hover:border-teal-500 dark:hover:bg-slate-900"
                    >
                      <div className={`${badge.bg} flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0 pt-0.5">
                        <div className="flex items-center justify-between">
                          <p className="truncate text-sm font-bold text-slate-900 dark:text-white">{report.title}</p>
                          <span className="text-[9px] font-bold uppercase text-slate-400 shrink-0 ml-2">
                            {new Date(report.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="mt-1 line-clamp-1 text-xs text-slate-600 dark:text-slate-400">
                          {report.locationText || "Location unspecified"}
                        </p>
                        <div className="mt-2.5 flex items-center gap-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          <span className="flex items-center gap-1.5">
                            <span className={`h-1.5 w-1.5 rounded-full ${reportStatus === 'resolved' ? 'bg-emerald-500' : reportStatus === 'on_the_way' ? 'bg-blue-500' : reportStatus === 'failed' ? 'bg-red-500' : 'bg-amber-500'}`}></span>
                            {statusLabelMap[reportStatus] || reportStatus}
                          </span>
                          {commentCount > 0 && (
                            <span className="flex items-center gap-1 text-teal-600 dark:text-teal-400">
                              💬 {commentCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Compact Legend */}
          <div className="shrink-0 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-800 dark:bg-[#0D1B35]">
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500">Map Legend</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full border border-slate-100 bg-indigo-50 text-indigo-700 px-2.5 py-1 text-[11px] font-bold dark:border-slate-800 dark:bg-indigo-900/30 dark:text-indigo-400`}>
                <Tent className="h-3.5 w-3.5" /> Evacuation Center
              </span>
              {(Object.entries(categoryBadge) as Array<[LocalReport["category"], typeof categoryBadge[LocalReport["category"]]]>).map(([key, badge]) => {
                const Icon = badge.icon;
                return (
                  <span key={key} className={`inline-flex items-center gap-1.5 rounded-full border border-slate-100 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold dark:border-slate-800 dark:bg-slate-900 ${badge.color}`}>
                    <Icon className="h-3.5 w-3.5" />
                    {badge.label}
                  </span>
                );
              })}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}