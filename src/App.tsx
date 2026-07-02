// C:\Users\Renz Jericho Buday\KapitBahay\src\App.tsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import type { User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./lib/firebase";

// Components & Layouts
import LandingPage from "./features/landing/components/LandingPage";
import AdminDashboard from "./features/admin/components/AdminDashboard";
import PublicMap from "./features/map/components/PublicMap";
import AdminLayout from "./components/layout/AdminLayout";
import DashboardLayout from "./components/layout/DashboardLayout";
import CitizenLayout from "./components/layout/CitizenLayout";
import LguApprovals from "./features/admin/components/LguApprovals";
import Reports from "./features/reports/components/Reports";
import TriagePriority from "./features/dashboard/components/TriagePriority";

// Mesh Synchronization Engines
import { startAutomatedSyncEngine } from "./lib/syncEngine";
import { initNativeMeshHardware } from "./lib/bluetoothNative";
import { startCloudSyncDaemon } from "./lib/cloudSync";

interface AuthContextType {
  user: User | null;
  role: "user" | "lgu" | "admin" | null;
  loading: boolean;
}
const AuthContext = createContext<AuthContextType>({ user: null, role: null, loading: true });
export const useAuth = () => useContext(AuthContext);

interface ThemeContextType {
  theme: "light" | "dark";
  toggleTheme: () => void;
}
const ThemeContext = createContext<ThemeContextType>({ theme: "dark", toggleTheme: () => { } });
export const useTheme = () => useContext(ThemeContext);

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<"user" | "lgu" | "admin" | null>(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window !== "undefined") {
      const storedTheme = window.localStorage.getItem("theme");
      return storedTheme === "light" ? "light" : "dark";
    }
    return "dark";
  });

  const toggleTheme = () => setTheme((t) => (t === "light" ? "dark" : "light"));

  // Theme Sync
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    window.localStorage.setItem("theme", theme);
  }, [theme]);

  // ORCHESTRATE ALL HYBRID MESH CHANNELS (LAN / WEBRTC / BLE DETECTORS)
  useEffect(() => {
    const bootMeshServices = async () => {
      // 1. Fire up native background Bluetooth hardware drivers if running inside mobile wrapper shell container
      await initNativeMeshHardware();

      // 2. Run background local Area Network + WebRTC browser/mesh listeners
      await startAutomatedSyncEngine();

      // 3. Start the cloud sync daemon alongside the mesh engine so online uploads continue.
      await startCloudSyncDaemon();
      console.log("🤖 Automated Unified Mesh Layer Online.");
    };

    bootMeshServices().catch(err => console.error("Mesh Core Bootstrapper crashed:", err));
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);
      setUser(currentUser);

      if (currentUser) {
        if (currentUser.email === "admin@kapitbahay.gov.ph") {
          setRole("admin");
          setLoading(false);
          return;
        }

        try {
          const docRef = doc(db, "users", currentUser.uid);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            const data = docSnap.data();
            setRole(data.role as "user" | "lgu" | "admin");
          } else {
            setRole(null);
          }
        } catch (error) {
          console.error("🚨 Firestore role retrieval error:", error);
          setRole(null);
        } finally {
          setLoading(false);
        }
      } else {
        setRole(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Simple clean fallback handler during active authentication state lookups
  if (loading) {
    return (
      <div className="min-h-screen bg-[#050E1F] flex flex-col items-center justify-center text-white font-mono">
        <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-sm tracking-widest text-slate-400">SYNCING OPERATIONAL PERMISSIONS...</p>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, role, loading }}>
      <ThemeContext.Provider value={{ theme, toggleTheme }}>
        <Routes>
          {/* Landing page with route guard: Active sessions skip directly to their layout routes */}
          <Route
            path="/"
            element={
              user && role ? (
                role === "admin" ? <Navigate to="/admin" replace /> :
                  role === "lgu" ? <Navigate to="/dashboard" replace /> :
                    <Navigate to="/map" replace />
              ) : (
                <LandingPage />
              )
            }
          />

          {/* Admin Layout Tree */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRole="admin">
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<AdminDashboard />} />
            <Route path="reports" element={<Reports />} />
            <Route path="lgus" element={<LguApprovals />} />
            <Route path="logs" element={<div className="p-8 text-white">Audit Tracking Logs</div>} />
            <Route path="security" element={<div className="p-8 text-white">Security Controls</div>} />
          </Route>

          {/* LGU Command Portal Layout Tree */}
          <Route
            path="/dashboard"
            element={
              <LguApprovalGate>
                <DashboardLayout />
              </LguApprovalGate>
            }
          >
            <Route index element={<TriagePriority />} />
            <Route path="map" element={<PublicMap />} />
            <Route path="reports" element={<Reports />} />
            <Route path="settings" element={<div className="p-8 text-slate-900 dark:text-white">LGU settings</div>} />
          </Route>

          {/* Citizen Dashboard Layout Tree */}
          <Route
            element={
              <ProtectedRoute allowedRole="user">
                <CitizenLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/report" element={<Reports />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/map" element={<PublicMap />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ThemeContext.Provider>
    </AuthContext.Provider>
  );
}

interface ProtectedRouteProps {
  children?: React.ReactNode;
  allowedRole: "user" | "lgu" | "admin" | "any";
}

function ProtectedRoute({ children, allowedRole }: ProtectedRouteProps) {
  const { user, role } = useAuth();

  if (!user || (allowedRole !== "any" && role !== allowedRole)) {
    return <Navigate to="/" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}

function LguApprovalGate({ children }: { children: React.ReactNode }) {
  const { user, role } = useAuth();
  const [isVerified, setIsVerified] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    const verifyLguAccess = async () => {
      if (!user || role !== "lgu") {
        if (!cancelled) setIsVerified(false);
        return;
      }

      try {
        const docSnap = await getDoc(doc(db, "users", user.uid));
        if (!cancelled) {
          setIsVerified(docSnap.exists() && docSnap.data().verified === true);
        }
      } catch (error) {
        console.error("LGU verification check failed:", error);
        if (!cancelled) setIsVerified(false);
      }
    };

    setIsVerified(null);
    verifyLguAccess();

    return () => {
      cancelled = true;
    };
  }, [user, role]);

  if (!user || role !== "lgu") {
    return <Navigate to="/" replace />;
  }

  if (isVerified === null) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#050E1F] flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-xl dark:border-slate-800 dark:bg-[#0D1B35]">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full border-4 border-teal-500 border-t-transparent animate-spin" />
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">Checking command access</p>
        </div>
      </div>
    );
  }

  if (!isVerified) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#050E1F] flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-amber-200 bg-white p-6 text-center shadow-xl dark:border-amber-500/30 dark:bg-[#0D1B35]">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
            <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a1 1 0 0 0 .86 1.5h18.64a1 1 0 0 0 .86-1.5L13.71 3.86a1 1 0 0 0-1.72 0Z" />
            </svg>
          </div>
          <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">Access Pending</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Your LGU command account is waiting for admin approval. Please wait for validation before using the dashboard.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}