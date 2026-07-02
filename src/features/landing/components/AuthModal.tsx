// C:\Users\Renz Jericho Buday\KapitBahay\src\features\landing\components\AuthModal.tsx
import React, { useState, useEffect } from "react";
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword
} from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { auth, db } from "../../../lib/firebase";
import { MapPin, Navigation, Shield, User, Building2, ChevronRight, AlertCircle, Mail, Lock, X } from "lucide-react";

type RoleType = "user" | "lgu" | "admin" | null;
type TabType = "signup" | "login";

interface ModalProps {
    isOpen: boolean;
    activeRole: RoleType;
    onClose: () => void;
    onNavigate: (path: string) => void;
}

export const AuthModal: React.FC<ModalProps> = ({
    isOpen,
    activeRole,
    onClose,
    onNavigate,
}) => {
    const [activeTab, setActiveTab] = useState<TabType>("signup");
    const [signupSubRole, setSignupSubRole] = useState<"user" | "lgu">("user");

    // Input states fields
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [phone, setPhone] = useState("");

    // Location Coordinate states
    const [latitude, setLatitude] = useState<number | null>(null);
    const [longitude, setLongitude] = useState<number | null>(null);
    const [locationStatus, setLocationStatus] = useState("");

    // LGU explicit attributes
    const [orgName, setOrgName] = useState("");
    const [contactPerson, setContactPerson] = useState("");
    const [jurisdiction, setJurisdiction] = useState("");

    const [isLoading, setIsLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");


    useEffect(() => {
        setErrorMsg("");
        // ... (Keep existing state resets) ...
        setEmail("");
        setPassword("");
        setFirstName("");
        setLastName("");
        setPhone("");
        setOrgName("");
        setContactPerson("");
        setJurisdiction("");
        setLatitude(null);
        setLongitude(null);
        setLocationStatus("");

        if (activeRole === "admin") {
            setActiveTab("login");
        } else {
            setActiveTab("signup");
            setSignupSubRole(activeRole === "lgu" ? "lgu" : "user");
        }
    }, [activeRole, isOpen]);

    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        if (isOpen) window.addEventListener("keydown", handleEsc);
        return () => window.removeEventListener("keydown", handleEsc);
    }, [isOpen, onClose]);

    const handleGetCurrentLocation = () => {
        // ... (Keep existing geolocation logic) ...
        if (!navigator.geolocation) {
            setLocationStatus("Geolocation is not supported by your browser.");
            return;
        }
        setLocationStatus("Acquiring GPS lock...");
        navigator.geolocation.getCurrentPosition(
            (position) => {
                setLatitude(position.coords.latitude);
                setLongitude(position.coords.longitude);
                setLocationStatus("Coordinates secured successfully!");
            },
            (error) => {
                console.error(error);
                setLocationStatus("Unable to automatically verify location bounds.");
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    };

    const routeByExplicitRole = (role: string) => {
        if (role === "admin") onNavigate("/admin");
        else if (role === "lgu") onNavigate("/dashboard");
        else onNavigate("/report");
        onClose();
    };

    const handleSignupSubmit = async (e: React.FormEvent) => {
        // ... (Keep existing signup submit logic) ...
        e.preventDefault();
        setIsLoading(true);
        setErrorMsg("");

        // --- PRE-AUTHENTICATION RE-VALIDATION ENGINE ---
        if (signupSubRole === "user") {
            if (!firstName.trim() || !lastName.trim() || !phone.trim()) {
                setErrorMsg("Please populate all profile baseline identity field records.");
                setIsLoading(false);
                return;
            }
            if (!latitude || !longitude) {
                setErrorMsg("Geolocation position metrics must be secured to establish network routing maps.");
                setIsLoading(false);
                return;
            }
        } else {
            if (!orgName.trim() || !contactPerson.trim() || !jurisdiction) {
                setErrorMsg("Please provide all specific LGU organizational data parameters.");
                setIsLoading(false);
                return;
            }
        }

        try {
            let uid = null;

            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            uid = userCredential.user.uid;

            const userData = signupSubRole === "user" ? {
                role: "user",
                firstName,
                lastName,
                phone,
                location: { lat: latitude, lng: longitude },
                email,
                createdAt: new Date().toISOString(),
                authProvider: "email"
            } : {
                role: "lgu",
                orgName,
                contactPerson,
                jurisdiction,
                location: latitude && longitude ? { lat: latitude, lng: longitude } : null,
                email,
                createdAt: new Date().toISOString(),
                verified: false,
                authProvider: "email"
            };

            if (uid) {
                await setDoc(doc(db, "users", uid), userData);
                routeByExplicitRole(signupSubRole);
            } else {
                setErrorMsg("Security session initialization failed.");
            }
        } catch (err: any) {
            setErrorMsg(err.message || "Failed to commit credential profiles.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleLoginSubmit = async (e: React.FormEvent) => {
        // ... (Keep existing login submit logic) ...
        e.preventDefault();
        setIsLoading(true);
        setErrorMsg("");

        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const docRef = doc(db, "users", userCredential.user.uid);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                routeByExplicitRole(docSnap.data().role);
            } else {
                setErrorMsg("Account profile indices could not be matched inside our infrastructure records.");
            }
        } catch (err: any) {
            setErrorMsg(err.message || "Invalid account email or password configuration.");
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        // ... (Keep existing JSX return exactly as is) ...
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/40 dark:bg-[#050E1F]/80 backdrop-blur-md transition-opacity">
            <div className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-white dark:bg-[#0D1B35] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-3xl p-6 sm:p-8 shadow-2xl animate-in fade-in zoom-in-95 duration-200">

                {/* Header Block */}
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-black tracking-tight flex items-center gap-2">
                        {activeRole === "admin" ? (
                            <><Shield className="w-6 h-6 text-rose-500" /> System Access</>
                        ) : activeTab === "signup" ? (
                            "Join the Node"
                        ) : (
                            "Welcome Back"
                        )}
                    </h2>
                    <button type="button" className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors" onClick={onClose}>
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Global Access Tab Switcher */}
                {activeRole !== "admin" && (
                    <div className="flex gap-2 mb-6 bg-slate-100 dark:bg-slate-900/50 p-1 rounded-xl">
                        <button
                            type="button"
                            className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all duration-200 ${activeTab === "signup" ? "bg-white dark:bg-slate-800 text-teal-600 dark:text-teal-400 shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"}`}
                            onClick={() => setActiveTab("signup")}
                        >
                            Sign Up
                        </button>
                        <button
                            type="button"
                            className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all duration-200 ${activeTab === "login" ? "bg-white dark:bg-slate-800 text-teal-600 dark:text-teal-400 shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"}`}
                            onClick={() => setActiveTab("login")}
                        >
                            Log In
                        </button>
                    </div>
                )}

                {errorMsg && (
                    <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20 p-3.5 rounded-xl mb-6 text-xs font-semibold flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span className="leading-snug">{errorMsg}</span>
                    </div>
                )}

                {activeTab === "signup" && activeRole !== "admin" ? (
                    <div className="space-y-5">
                        {/* COMPONENT FILTER: Resident vs LGU Selection Sub-tabs */}
                        <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-[#0A1628] p-1.5 rounded-xl border border-slate-200 dark:border-slate-800/60">
                            <button
                                type="button"
                                onClick={() => setSignupSubRole("user")}
                                className={`py-2.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${signupSubRole === "user" ? "bg-teal-500 text-white shadow-md" : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white"}`}
                            >
                                <User className="w-4 h-4" /> Resident
                            </button>
                            <button
                                type="button"
                                onClick={() => setSignupSubRole("lgu")}
                                className={`py-2.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${signupSubRole === "lgu" ? "bg-amber-500 text-slate-900 shadow-md" : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white"}`}
                            >
                                <Building2 className="w-4 h-4" /> LGU Command
                            </button>
                        </div>

                        <form onSubmit={handleSignupSubmit} className="space-y-4">
                            <div className="flex items-center my-4 text-slate-400 text-xs font-bold uppercase tracking-wider">
                                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800"></div>
                                <span className="px-3">or register manually</span>
                                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800"></div>
                            </div>

                            {signupSubRole === "user" ? (
                                <>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">First Name</label>
                                            <input type="text" required value={firstName} onChange={(e) => setFirstName(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0A1628] text-slate-900 dark:text-white text-sm outline-none transition-all focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Last Name</label>
                                            <input type="text" required value={lastName} onChange={(e) => setLastName(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0A1628] text-slate-900 dark:text-white text-sm outline-none transition-all focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500" />
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Mobile Phone</label>
                                        <input type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0A1628] text-slate-900 dark:text-white text-sm outline-none transition-all focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500" placeholder="+63 912 345 6789" />
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Command Operations Title</label>
                                        <input type="text" required value={orgName} onChange={(e) => setOrgName(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0A1628] text-slate-900 dark:text-white text-sm outline-none transition-all focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500" placeholder="e.g. Malabon DRRMO" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Chief Officer Name</label>
                                        <input type="text" required value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0A1628] text-slate-900 dark:text-white text-sm outline-none transition-all focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Jurisdiction Level</label>
                                        <select required value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0A1628] text-slate-900 dark:text-white text-sm outline-none transition-all focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500">
                                            <option value="" disabled>Select boundary scope...</option>
                                            <option value="Barangay">Barangay Level</option>
                                            <option value="City">City / Municipality</option>
                                            <option value="Province">Provincial Hub</option>
                                        </select>
                                    </div>
                                </>
                            )}

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Email Address</label>
                                <div className="relative">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0A1628] text-slate-900 dark:text-white text-sm outline-none transition-all focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500" placeholder="name@example.com" />
                                </div>
                            </div>

                            {/* MESH NODE LOCATION COORDINATES PICKER */}
                            <div className="p-4 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 rounded-xl space-y-3 shadow-inner mt-2">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                                    <MapPin className="w-3.5 h-3.5 text-teal-500" /> Home Node Location <span className="text-red-500">*</span>
                                </label>
                                <button
                                    type="button"
                                    onClick={handleGetCurrentLocation}
                                    className="w-full py-2.5 bg-white dark:bg-[#050E1F] hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 shadow-sm"
                                >
                                    <Navigation className="w-4 h-4" /> Drop GPS Pin
                                </button>
                                {locationStatus && (
                                    <p className="text-[10px] text-center text-teal-600 dark:text-teal-400 font-mono font-bold mt-2">{locationStatus}</p>
                                )}
                                {latitude && longitude && (
                                    <div className="grid grid-cols-2 gap-2 pt-2 mt-2 font-mono text-[10px] text-center text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-700/50">
                                        <div className="bg-white dark:bg-slate-800 py-1.5 rounded-md shadow-sm border border-slate-100 dark:border-slate-700">Lat: <span className="text-teal-600 dark:text-teal-400 font-bold">{latitude.toFixed(5)}</span></div>
                                        <div className="bg-white dark:bg-slate-800 py-1.5 rounded-md shadow-sm border border-slate-100 dark:border-slate-700">Lng: <span className="text-teal-600 dark:text-teal-400 font-bold">{longitude.toFixed(5)}</span></div>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Password</label>
                                <div className="relative">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0A1628] text-slate-900 dark:text-white text-sm outline-none transition-all focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500" placeholder="Minimum 8 characters" />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading}
                                className={`w-full py-3.5 mt-4 rounded-xl text-sm font-black tracking-widest text-white transition-all uppercase shadow-lg hover:-translate-y-0.5 active:scale-95 flex items-center justify-center gap-2 ${signupSubRole === "user" ? "bg-gradient-to-r from-teal-500 to-cyan-500 hover:shadow-teal-500/30" : "bg-gradient-to-r from-amber-500 to-orange-500 hover:shadow-amber-500/30"}`}
                            >
                                {isLoading ? (
                                    <span className="animate-pulse">Provisioning Node...</span>
                                ) : (
                                    <>Create {signupSubRole === "user" ? "Resident" : "LGU"} Node <ChevronRight className="w-4 h-4" /></>
                                )}
                            </button>
                        </form>
                    </div>
                ) : (
                    /* UNIFIED SIGN IN GATEWAY */
                    <form onSubmit={handleLoginSubmit} className="space-y-5">
                        <div className="flex items-center my-4 text-slate-400 text-xs font-bold uppercase tracking-wider">
                            <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800"></div>
                            <span className="px-3">Or use credentials</span>
                            <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800"></div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Registered Email</label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0A1628] text-slate-900 dark:text-white text-sm outline-none transition-all focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500" placeholder="identity@kapitbahay.gov.ph" />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Password</label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0A1628] text-slate-900 dark:text-white text-sm outline-none transition-all focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500" placeholder="••••••••" />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className={`w-full py-3.5 mt-2 rounded-xl text-sm font-black text-white tracking-widest uppercase transition-all shadow-lg hover:-translate-y-0.5 active:scale-95 flex items-center justify-center gap-2 ${activeRole === "admin" ? "bg-gradient-to-r from-rose-500 to-red-600 hover:shadow-rose-500/30" : "bg-gradient-to-r from-teal-500 to-cyan-500 hover:shadow-teal-500/30"}`}
                        >
                            {isLoading ? "Validating Terminal..." : <>Establish Session <ChevronRight className="w-4 h-4" /></>}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};