import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Moon, Sun, Menu, X, Network, ShieldAlert, WifiOff, Lock,
  Smartphone, Download, Code2, Zap, Cloud, Database, Map,
  Radio, Globe, Layers, Bluetooth, BrainCircuit, ChevronRight, Activity
} from "lucide-react";
import { useTheme } from "../../../App";
import { AuthModal } from "./AuthModal";

type RoleType = "user" | "lgu" | "admin" | null;

// --- CANVAS COMPONENTS (Retained for visual effect) ---
const HeroCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let frame = 0;

    const isMobile = window.innerWidth < 768;
    const NODE_COUNT = isMobile ? 14 : 28;
    const LINK_DIST = isMobile ? 100 : 160;

    const resize = () => {
      canvas.width = canvas.parentElement?.offsetWidth || window.innerWidth;
      canvas.height = canvas.parentElement?.offsetHeight || window.innerHeight;
    };

    window.addEventListener("resize", resize);
    resize();

    const nodes = Array.from({ length: NODE_COUNT }).map((_, i) => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
      r: Math.random() * 2.5 + 1.5,
      pulse: Math.random() * Math.PI * 2,
      pulseSpeed: 0.02 + Math.random() * 0.015,
      type: i < 2 ? "lgu" : i < 5 ? "sos" : "node",
    }));

    const drawMesh = () => {
      if (canvas.width === 0) resize();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      frame++;

      nodes.forEach((n) => {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0 || n.x > canvas.width) n.vx *= -1;
        if (n.y < 0 || n.y > canvas.height) n.vy *= -1;
        n.pulse += n.pulseSpeed;
      });

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < LINK_DIST) {
            const alpha = (1 - dist / LINK_DIST) * 0.35;
            const pulse = (Math.sin(frame * 0.018 + i * 0.5) + 1) * 0.5;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = `rgba(6,182,212,${alpha * (0.5 + pulse * 0.5)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      nodes.forEach((n) => {
        const glow = (Math.sin(n.pulse) + 1) * 0.5;
        let color, glowColor;
        if (n.type === "lgu") {
          color = "#F59E0B"; glowColor = "rgba(245,158,11,";
        } else if (n.type === "sos") {
          color = "#EF4444"; glowColor = "rgba(239,68,68,";
        } else {
          color = "#06B6D4"; glowColor = "rgba(6,182,212,";
        }

        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r + glow * 1.5, 0, Math.PI * 2);
        ctx.fillStyle = glowColor + (0.08 + glow * 0.1) + ")";
        ctx.fill();

        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      });

      animationFrameId = requestAnimationFrame(drawMesh);
    };

    drawMesh();
    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 z-0 h-full w-full pointer-events-none opacity-60 dark:opacity-100" />;
};

const MiniMeshCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    const labels = ["Brgy. Hall", "House A", "House B", "Rescue", "Store", "Clinic", "School"];
    const MINI_N = 12;

    const miniNodes = Array.from({ length: MINI_N }).map((_, i) => ({
      x: 30 + Math.random() * (canvas.width - 60),
      y: 30 + Math.random() * 240,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      r: i < 2 ? 6 : 4,
      pulse: Math.random() * Math.PI * 2,
      pulseSpeed: 0.025 + Math.random() * 0.01,
      label: i < labels.length ? labels[i] : null,
      type: i === 0 ? "lgu" : i < 3 ? "sos" : "node",
    }));

    const resizeMini = () => {
      canvas.width = canvas.parentElement?.offsetWidth || 320;
      canvas.height = 300;
    };
    resizeMini();
    window.addEventListener("resize", resizeMini);

    const drawMini = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      miniNodes.forEach((n) => {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 20 || n.x > canvas.width - 20) n.vx *= -1;
        if (n.y < 20 || n.y > canvas.height - 20) n.vy *= -1;
        n.pulse += n.pulseSpeed;
      });

      for (let i = 0; i < miniNodes.length; i++) {
        for (let j = i + 1; j < miniNodes.length; j++) {
          const a = miniNodes[i], b = miniNodes[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < 100) {
            const alpha = (1 - d / 100) * 0.5;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = `rgba(6,182,212,${alpha})`;
            ctx.lineWidth = 0.7;
            ctx.stroke();
          }
        }
      }

      miniNodes.forEach((n) => {
        const g = (Math.sin(n.pulse) + 1) * 0.5;
        const col = n.type === "lgu" ? "#F59E0B" : n.type === "sos" ? "#EF4444" : "#06B6D4";

        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r + g * 2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(6,182,212,0.07)`;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = col;
        ctx.fill();

        if (n.label) {
          ctx.fillStyle = "rgba(148,163,184,0.9)";
          ctx.font = "10px Inter, sans-serif";
          ctx.fillText(n.label, n.x + n.r + 5, n.y + 4);
        }
      });

      animationFrameId = requestAnimationFrame(drawMini);
    };

    drawMini();
    return () => {
      window.removeEventListener("resize", resizeMini);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return <canvas ref={canvasRef} className="w-full h-[300px] block rounded-xl bg-slate-100 dark:bg-slate-900/40 p-2 shadow-inner" />;
};

export default function LandingPage() {
  const [activeModal, setActiveModal] = useState<RoleType>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  const openModal = (role: RoleType) => {
    setActiveModal(role);
    setMobileMenuOpen(false);
  };
  const closeModal = () => setActiveModal(null);
  const handleNavigate = (path: string) => navigate(path);

  return (
    <div className="min-h-screen bg-white dark:bg-[#030914] selection:bg-teal-500/30 overflow-x-hidden font-sans transition-colors duration-500 text-slate-900 dark:text-slate-100">

      {/* 24/7 Status Ticker */}
      <div className="bg-gradient-to-r from-teal-600 via-cyan-600 to-teal-600 text-white font-mono text-[10px] sm:text-xs py-1.5 px-4 text-center tracking-widest flex items-center justify-center gap-2 overflow-hidden whitespace-nowrap shadow-md relative z-50">
        <span className="h-2 w-2 rounded-full bg-white animate-pulse flex-shrink-0 shadow-[0_0_8px_rgba(255,255,255,0.8)]"></span>
        <span className="truncate font-bold">MESH NETWORK ACTIVE · 247 NODES ONLINE · DISASTER READINESS MODE</span>
      </div>

      {/* Main Responsive Navigation Header */}
      <nav className="sticky top-0 z-40 w-full bg-white/80 dark:bg-[#050E1F]/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800/60 px-4 py-3 sm:px-6 md:px-8 transition-colors duration-300 shadow-sm dark:shadow-none">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <a href="#" className="flex items-center gap-2 text-xl font-black tracking-tight group">
            <div className="h-3 w-3 rounded-full bg-gradient-to-br from-teal-400 to-cyan-500 shadow-[0_0_12px_rgba(6,182,212,0.6)] group-hover:animate-pulse"></div>
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-300">KapitBahay</span>
          </a>

          {/* Desktop Link Items */}
          <ul className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-600 dark:text-slate-300">
            <li><a href="#how" className="hover:text-teal-500 dark:hover:text-teal-400 transition-colors">How It Works</a></li>
            <li><a href="#roles" className="hover:text-teal-500 dark:hover:text-teal-400 transition-colors">User Levels</a></li>
            <li><a href="#tech" className="hover:text-teal-500 dark:hover:text-teal-400 transition-colors">Tech Stack</a></li>
            <div className="w-px h-5 bg-slate-300 dark:bg-slate-700 mx-2"></div>
            <li>
              <button className="relative overflow-hidden bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold px-5 py-2.5 rounded-xl transition-all hover:-translate-y-0.5 hover:shadow-xl active:scale-95 group" onClick={() => openModal("user")}>
                <span className="relative z-10">Launch Portal</span>
                <div className="absolute inset-0 bg-gradient-to-r from-teal-500 to-cyan-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <span className="relative z-10 group-hover:text-white transition-colors duration-300">Launch Portal</span>
              </button>
            </li>
            <li>
              <button type="button" onClick={toggleTheme} className="flex items-center justify-center p-2.5 bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all border border-slate-200 dark:border-slate-700/50 hover:shadow-md">
                {theme === "dark" ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-slate-700" />}
              </button>
            </li>
          </ul>

          {/* Mobile Action Controls Group */}
          <div className="flex items-center gap-2 md:hidden">
            <button type="button" onClick={toggleTheme} className="p-2 bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-white rounded-lg border border-slate-200 dark:border-slate-700/50">
              {theme === "dark" ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4" />}
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/40 rounded-lg"
              aria-label="Toggle Menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Flyout Menu Panel */}
        {mobileMenuOpen && (
          <div className="absolute top-full left-0 w-full bg-white dark:bg-[#050E1F] border-b border-slate-200 dark:border-slate-800 p-5 flex flex-col gap-4 shadow-2xl transition-all md:hidden animate-in fade-in slide-in-from-top-4 duration-200">
            <a href="#how" onClick={() => setMobileMenuOpen(false)} className="text-lg font-bold py-2 border-b border-slate-100 dark:border-slate-800/60 hover:text-teal-500">How It Works</a>
            <a href="#roles" onClick={() => setMobileMenuOpen(false)} className="text-lg font-bold py-2 border-b border-slate-100 dark:border-slate-800/60 hover:text-teal-500">User Levels</a>
            <a href="#tech" onClick={() => setMobileMenuOpen(false)} className="text-lg font-bold py-2 border-b border-slate-100 dark:border-slate-800/60 hover:text-teal-500">Tech Stack</a>
            <button className="w-full bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-black tracking-wide py-3.5 rounded-xl mt-4 shadow-lg text-center active:scale-95" onClick={() => openModal("user")}>
              Launch Portal
            </button>
          </div>
        )}
      </nav>

      {/* Hero Section Container */}
      <section className="relative min-h-[calc(100vh-100px)] md:min-h-0 md:py-32 xl:py-40 bg-slate-50 dark:bg-[#050E1F] text-slate-900 dark:text-slate-100 px-4 sm:px-6 md:px-8 flex items-center overflow-hidden transition-colors duration-500">
        {/* Abstract Glow Background */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-teal-500/20 dark:bg-teal-500/10 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-cyan-500/20 dark:bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none"></div>

        <HeroCanvas />

        <div className="relative z-10 max-w-7xl mx-auto w-full">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 bg-white/60 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200 dark:border-slate-700/60 px-4 py-1.5 rounded-full text-xs sm:text-sm text-teal-600 dark:text-teal-400 font-bold mb-8 shadow-sm">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-teal-500"></span>
              </span>
              Zero-Internet Web PWA · Local P2P Mesh
            </div>

            <h1 className="text-5xl sm:text-6xl md:text-7xl font-black tracking-tighter text-slate-900 dark:text-white leading-[1.05] mb-6 drop-shadow-sm">
              When signals die,
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-500 to-cyan-500 drop-shadow-sm">communities</span> survive.
            </h1>

            <p className="text-base sm:text-lg md:text-xl text-slate-600 dark:text-slate-400 leading-relaxed mb-10 max-w-2xl font-medium">
              <strong>KapitBahay</strong> is a Progressive Web App designed for resilience.
              No cell signal. No Wi-Fi required. Access the offline lifeline directly from your browser
              to communicate locally when the grid goes dark.
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 mb-14">
              <button className="bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-black text-lg px-8 py-4 rounded-2xl transition-all shadow-[0_8px_30px_rgba(6,182,212,0.3)] hover:shadow-[0_8px_40px_rgba(6,182,212,0.4)] hover:-translate-y-1 text-center active:scale-95 flex items-center justify-center gap-2" onClick={() => openModal("user")}>
                <Globe className="w-5 h-5" /> Launch Web App
              </button>
              <button
                onClick={() => alert("Android APK URL coming soon!")}
                className="bg-white dark:bg-slate-800/80 text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-700 font-bold px-8 py-4 rounded-2xl transition-all border border-slate-200 dark:border-slate-700 shadow-md hover:shadow-lg hover:-translate-y-1 text-center flex items-center justify-center gap-2"
              >
                <Smartphone className="w-5 h-5 text-slate-500 dark:text-slate-400" /> Android Native <span className="text-[10px] bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-400 px-2 py-0.5 rounded-md uppercase tracking-widest ml-1 font-black">Soon</span>
              </button>
            </div>

            {/* Fluid Hero Stats Display */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-8 border-t border-slate-200 dark:border-slate-800/60">
              <div className="flex flex-col gap-1">
                <span className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white">~20</span>
                <span className="text-xs text-slate-500 uppercase tracking-widest font-bold">Typhoons / Year</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-3xl sm:text-4xl font-black text-teal-500 dark:text-teal-400">0</span>
                <span className="text-xs text-slate-500 uppercase tracking-widest font-bold">Bars Needed</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-3xl sm:text-4xl font-black text-cyan-500 dark:text-cyan-400">P2P</span>
                <span className="text-xs text-slate-500 uppercase tracking-widest font-bold">Local Mesh Sync</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-3xl sm:text-4xl font-black text-amber-500">AES-256</span>
                <span className="text-xs text-slate-500 uppercase tracking-widest font-bold">Encrypted Data</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* "How it Works" Steps Section */}
      <section className="py-20 sm:py-32 px-4 sm:px-6 md:px-8 bg-white dark:bg-[#030914] transition-colors duration-500 relative" id="how">
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center max-w-3xl mx-auto mb-20">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 dark:bg-teal-500/10 border border-teal-100 dark:border-teal-500/20 text-xs font-bold uppercase tracking-[0.2em] text-teal-600 dark:text-teal-400 mb-4">
              <Activity className="w-4 h-4" /> How It Works
            </div>
            <h2 className="text-4xl sm:text-5xl font-black tracking-tight text-slate-900 dark:text-white mb-6">The local web mesh<br />you never set up.</h2>
            <p className="text-slate-600 dark:text-slate-400 text-lg leading-relaxed">
              Devices running the PWA discover each other locally. Data hops across the barangay
              without relying on external infrastructure.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { num: "01", title: "Log Offline", icon: Database, desc: "A resident drops a pin for a flooded road or flags a household needing rescue stored safely in their local browser storage." },
              { num: "02", title: "Local Handshake", icon: Network, desc: "Nearby smart devices connect securely via local WebRTC protocols to automatically sync, swap data, and resolve conflict values." },
              { num: "03", title: "Propagate", icon: Radio, desc: "As community residents physically move, critical payload details cascade across the entire barangay boundaries, bypassing downed cell towers." },
              { num: "04", title: "Cloud Integration", icon: Cloud, desc: "Once any single device touches an internet stream, it triggers an automated bridge to Firebase, populating updates out to the central grid." },
            ].map((step, idx) => (
              <div key={idx} className="group relative flex flex-col p-8 bg-slate-50 hover:bg-white dark:bg-slate-900/40 dark:hover:bg-slate-800/80 rounded-3xl border border-slate-200 dark:border-slate-800/60 hover:border-teal-500/30 dark:hover:border-teal-500/30 transition-all duration-300 hover:shadow-2xl hover:shadow-teal-500/5 hover:-translate-y-2">
                <div className="flex justify-between items-start mb-6">
                  <div className="h-12 w-12 rounded-2xl bg-white dark:bg-slate-950 shadow-sm border border-slate-100 dark:border-slate-800 flex items-center justify-center text-teal-500 group-hover:scale-110 transition-transform duration-300">
                    <step.icon className="w-6 h-6" />
                  </div>
                  <div className="text-4xl font-black text-slate-200 dark:text-slate-800 font-mono tracking-tighter">{step.num}</div>
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">{step.title}</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* User Levels Selection Framework */}
      <section className="py-20 sm:py-32 px-4 sm:px-6 md:px-8 bg-slate-50 dark:bg-[#071022] transition-colors duration-500" id="roles">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-3xl mb-16">
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-teal-600 dark:text-teal-400 mb-4">Three-Tier Framework</div>
            <h2 className="text-4xl sm:text-5xl font-black tracking-tight text-slate-900 dark:text-white mb-6">Streamlined action.<br />Clear command.</h2>
            <p className="text-slate-600 dark:text-slate-400 text-lg leading-relaxed">
              Citizens crowdsource localized incident metadata while administrators verify platform configurations and logistics.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
            {/* Card 1: Citizen */}
            <button onClick={() => openModal("user")} className="group text-left p-8 sm:p-10 rounded-[2.5rem] bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/70 hover:border-teal-500/50 dark:hover:border-teal-500/50 transition-all duration-300 flex flex-col justify-between shadow-sm hover:shadow-2xl hover:-translate-y-1">
              <div>
                <div className="mb-6 p-4 bg-teal-50 dark:bg-teal-950/40 w-fit rounded-2xl group-hover:scale-110 group-hover:bg-teal-500 transition-all duration-300">
                  <Network className="text-teal-500 group-hover:text-white h-8 w-8 transition-colors" />
                </div>
                <div className="inline-block px-3 py-1 text-[10px] font-black uppercase tracking-widest bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-400 rounded-lg mb-4">Community</div>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-4">Resident Node</h3>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-8 font-medium">The ground-level mesh node. Report hazards, track local safety maps, and actively share connections with nearby users inside the barangay.</p>
              </div>
              <span className="text-sm font-bold text-teal-600 dark:text-teal-400 group-hover:text-teal-700 dark:group-hover:text-teal-300 flex items-center gap-2">Join the network <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" /></span>
            </button>

            {/* Card 2: LGU Command */}
            <button onClick={() => openModal("lgu")} className="group text-left p-8 sm:p-10 rounded-[2.5rem] bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/70 hover:border-amber-500/50 dark:hover:border-amber-500/50 transition-all duration-300 flex flex-col justify-between shadow-sm hover:shadow-2xl hover:-translate-y-1">
              <div>
                <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-950/40 w-fit rounded-2xl group-hover:scale-110 group-hover:bg-amber-500 transition-all duration-300">
                  <ShieldAlert className="text-amber-500 group-hover:text-white h-8 w-8 transition-colors" />
                </div>
                <div className="inline-block px-3 py-1 text-[10px] font-black uppercase tracking-widest bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400 rounded-lg mb-4">Government</div>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-4">LGU Command</h3>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-8 font-medium">Local Government Units evaluate aggregated feeds, triage logistics, manage relief maps, and verify reports incoming from offline sync bridges.</p>
              </div>
              <span className="text-sm font-bold text-amber-600 dark:text-amber-500 group-hover:text-amber-700 dark:group-hover:text-amber-400 flex items-center gap-2">Access dashboard <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" /></span>
            </button>

            {/* Card 3: Admin */}
            <button onClick={() => openModal("admin")} className="group text-left p-8 sm:p-10 rounded-[2.5rem] bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/70 hover:border-rose-500/50 dark:hover:border-rose-500/50 transition-all duration-300 flex flex-col justify-between shadow-sm hover:shadow-2xl hover:-translate-y-1">
              <div>
                <div className="mb-6 p-4 bg-rose-50 dark:bg-rose-950/40 w-fit rounded-2xl group-hover:scale-110 group-hover:bg-rose-500 transition-all duration-300">
                  <Lock className="text-rose-500 group-hover:text-white h-8 w-8 transition-colors" />
                </div>
                <div className="inline-block px-3 py-1 text-[10px] font-black uppercase tracking-widest bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-400 rounded-lg mb-4">System</div>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-4">System Admin</h3>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-8 font-medium">Platform technical operators who configure global setups, approve onboarding parameters for municipal authorities, and verify database stability.</p>
              </div>
              <span className="text-sm font-bold text-rose-600 dark:text-rose-500 group-hover:text-rose-700 dark:group-hover:text-rose-400 flex items-center gap-2">Admin login <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" /></span>
            </button>
          </div>
        </div>
      </section>

      {/* COMPREHENSIVE TECH STACK SECTION */}
      <section className="py-20 sm:py-32 px-4 sm:px-6 md:px-8 bg-white dark:bg-[#030914] transition-colors duration-500" id="tech">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-3xl mb-16 text-center mx-auto">
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-teal-600 dark:text-teal-400 mb-4">Core Infrastructure</div>
            <h2 className="text-4xl sm:text-5xl font-black tracking-tight text-slate-900 dark:text-white mb-6">Built from web-resilient<br />foundations.</h2>
            <p className="text-slate-600 dark:text-slate-400 text-lg leading-relaxed">
              KapitBahay leverages the entire modern web platform API surface so community data stays available and routes intelligently even when ISP lines are severed.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6 mb-16">
            {[
              { title: "React + TS", icon: Code2, desc: "Responsive UI components paired with strict type parameters for safe feature expansion and stable builds.", color: "text-blue-500" },
              { title: "Vite + Tailwind", icon: Zap, desc: "Lightning fast builds paired with modular styling variables for native light and dark layout rendering.", color: "text-amber-400" },
              { title: "Firebase Suite", icon: Cloud, desc: "Real-time cloud infrastructure pipeline for Auth and Firestore aggregating synced reports.", color: "text-orange-500" },
              { title: "IndexedDB", icon: Database, desc: "Local native client data vaults capable of queuing disaster files and loading immediately offline.", color: "text-slate-500" },
              { title: "MapLibre GL", icon: Map, desc: "Hardware accelerated vector tiles mapping canvas loading offline layers directly out of caches.", color: "text-indigo-500" },
              { title: "Ditto Mesh", icon: Radio, desc: "Decentralized P2P mesh framework managing localized data broadcast parameters over LAN.", color: "text-rose-500" },
              { title: "PWA Architecture", icon: Globe, desc: "Service Worker cache configurations making the web platform installable directly on home screens.", color: "text-teal-500" },
              { title: "WebRTC", icon: Network, desc: "Ad-hoc connection layers resolving automated synchronization passes between browser instances.", color: "text-cyan-500" },
              { title: "Capacitor", icon: Smartphone, desc: "Cross-platform native runtime bridging our PWA code directly into an installable Android APK.", color: "text-sky-500" },
              { title: "Bluetooth LE", icon: Bluetooth, desc: "Native background BLE drivers allowing locked phones to continuously scan and share mesh data.", color: "text-blue-600" },
              { title: "Zustand", icon: Layers, desc: "Lightweight, scalable reactive state management handling complex UI/Mesh data bridging.", color: "text-amber-600" },
              { title: "Gemini AI", icon: BrainCircuit, desc: "Intelligent incident triage matrix automatically parsing text reports to assign LGU dispatch priorities.", color: "text-emerald-500" },
            ].map((tech, idx) => (
              <div key={idx} className="group p-6 bg-slate-50 dark:bg-slate-900/30 rounded-3xl border border-slate-200 dark:border-slate-800 hover:border-teal-500/30 dark:hover:border-teal-500/30 transition-all duration-300 hover:shadow-xl hover:shadow-teal-500/5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2.5 bg-white dark:bg-slate-950 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 group-hover:scale-110 transition-transform">
                    <tech.icon className={`w-5 h-5 ${tech.color}`} />
                  </div>
                  <strong className="block text-slate-900 dark:text-white font-bold">{tech.title}</strong>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-medium">{tech.desc}</p>
              </div>
            ))}
          </div>

          {/* NATIVE ANDROID INTEGRATION CALLOUT */}
          <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-800 dark:to-[#0A1628] rounded-[2.5rem] p-8 sm:p-12 flex flex-col lg:flex-row items-center justify-between gap-8 shadow-2xl border border-slate-700">
            {/* Decorative background element */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl pointer-events-none"></div>

            <div className="text-center lg:text-left relative z-10 max-w-2xl">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-teal-500/20 border border-teal-500/30 text-[10px] font-black uppercase tracking-widest text-teal-400 mb-4">
                Hardware Access
              </div>
              <h3 className="text-3xl sm:text-4xl font-black text-white mb-4 flex items-center justify-center lg:justify-start gap-3">
                <Smartphone className="w-8 h-8 text-teal-400" /> Native Android APK
              </h3>
              <p className="text-slate-300 text-base sm:text-lg leading-relaxed">
                By wrapping the KapitBahay PWA inside <strong>Capacitor</strong>, we unlock background Bluetooth Low Energy (BLE) services. Download the native app to keep the peer-to-peer mesh alive—even when your phone screen is locked in your pocket.
              </p>
            </div>

            <button
              onClick={() => alert("APK Download URL will be live soon!")}
              className="shrink-0 relative group flex items-center justify-center gap-3 bg-white text-slate-900 font-black px-8 py-5 rounded-2xl transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] active:scale-95 w-full lg:w-auto overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-teal-100 to-cyan-100 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <Download className="w-5 h-5 relative z-10" />
              <span className="relative z-10">Download APK</span>
              <span className="relative z-10 text-[10px] bg-slate-900 text-white px-2.5 py-1 rounded-md uppercase tracking-widest ml-1 font-bold">Soon</span>
            </button>
          </div>

        </div>
      </section>

      {/* PWA Architecture Callout Section */}
      <section className="py-20 sm:py-32 px-4 sm:px-6 md:px-8 bg-slate-50 dark:bg-[#050E1F] text-slate-900 dark:text-slate-100 overflow-hidden transition-colors duration-500 border-t border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20 items-center">
          <div className="lg:col-span-6 max-w-2xl">
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-teal-600 dark:text-teal-400 mb-4">Browser Resilience</div>
            <h2 className="text-4xl sm:text-5xl font-black tracking-tight text-slate-900 dark:text-white mb-6">Installable anywhere.</h2>
            <p className="text-slate-600 dark:text-slate-400 text-lg leading-relaxed mb-6 font-medium">
              KapitBahay runs directly from your device browser cache variables. Even with zero cell tower coverage, you can open the platform, update maps, and push updates across local client environments seamlessly.
            </p>
            <p className="text-slate-600 dark:text-slate-400 text-lg leading-relaxed font-medium">
              Just tap <strong className="text-slate-900 dark:text-white">"Add to Home Screen"</strong> in your mobile browser to install the full offline experience instantly without an app store.
            </p>
          </div>
          <div className="lg:col-span-6 w-full max-w-lg mx-auto lg:max-w-none">
            <div className="relative">
              {/* Decorative background glow for the canvas */}
              <div className="absolute inset-0 bg-gradient-to-tr from-teal-500/20 to-cyan-500/20 blur-3xl rounded-full"></div>
              <MiniMeshCanvas />
            </div>
          </div>
        </div>
      </section>

      <AuthModal isOpen={activeModal !== null} activeRole={activeModal} onClose={closeModal} onNavigate={handleNavigate} />
    </div>
  );
}