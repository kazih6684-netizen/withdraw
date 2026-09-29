import React, { useState, useEffect, useRef } from 'react';
import { toPng } from 'html-to-image';
import { 
  auth, 
  db, 
  onAuthStateChanged, 
  signOut,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  collection,
  query,
  orderBy,
  addDoc,
  serverTimestamp,
  updateDoc,
  deleteDoc,
  handleFirestoreError,
  OperationType
} from './lib/firebase';
import { UserProfile, TeamMember, RequestData } from './types';
import { TRANSLATIONS } from './constants';
import { MemberDesignBadge } from './components/MemberDesignBadge';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bell, 
  Plus, 
  LogOut, 
  ShieldCheck, 
  User as UserIcon, 
  History as HistoryIcon,
  CheckCircle2,
  XCircle,
  ChevronRight,
  TrendingUp,
  Users,
  Search,
  Trash2,
  Edit2,
  Delete,
  Calendar,
  Send,
  Smartphone,
  Banknote,
  Lock,
  Sparkles,
  Shield,
  Clock,
  Check,
  Download,
  Printer,
  FileText,
  RotateCcw,
  Upload,
  Zap,
  AlertTriangle
} from 'lucide-react';

// --- Image Compression Helper ---
function compressAndConvertToBase64(file: File, maxWidth = 400, maxHeight = 400): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/png', 0.9));
        } else {
          resolve(event.target?.result as string);
        }
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
}

// --- Helper for Local Storage User Submitted Requests Tracking ---
function getMySubmittedRequestIds(): string[] {
  try {
    const raw = localStorage.getItem('unity_my_requests');
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveMySubmittedRequestId(id: string) {
  try {
    const current = getMySubmittedRequestIds();
    if (!current.includes(id)) {
      current.push(id);
      localStorage.setItem('unity_my_requests', JSON.stringify(current));
    }
  } catch (e) {
    console.error(e);
  }
}

// --- Shared Components ---

const GlassCard = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => (
  <div className={`bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl shadow-xl ${className}`}>
    {children}
  </div>
);

const Badge = ({ status }: { status: string }) => {
  const styles = {
    pending: "bg-amber-500/15 text-amber-300 border-amber-500/30 shadow-[0_0_8px_rgba(245,158,11,0.15)]",
    accepted: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30 shadow-[0_0_8px_rgba(16,185,129,0.15)]",
    confirmed: "bg-blue-500/15 text-blue-300 border-blue-500/30 shadow-[0_0_8px_rgba(59,130,246,0.15)]",
    approved: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30 shadow-[0_0_8px_rgba(16,185,129,0.15)]",
    rejected: "bg-rose-500/15 text-rose-300 border-rose-500/30 shadow-[0_0_8px_rgba(244,63,94,0.15)]",
    expired: "bg-zinc-600/20 text-zinc-400 border-zinc-500/30"
  };
  const dots = {
    pending: "bg-amber-400 animate-pulse",
    accepted: "bg-emerald-400",
    confirmed: "bg-blue-400",
    approved: "bg-emerald-400",
    rejected: "bg-rose-400",
    expired: "bg-zinc-400"
  };
  const labels: Record<string, string> = {
    pending: "পেন্ডিং",
    accepted: "একসেপ্টেড",
    confirmed: "কনফার্মড",
    approved: "অনুমোদিত",
    rejected: "রিজেক্টেড",
    expired: "মেয়াদ উত্তীর্ণ"
  };

  const key = status as keyof typeof styles;
  const currentStyle = styles[key] || "bg-gray-500/20 text-gray-400 border-gray-500/30";
  const currentDot = dots[key] || "bg-gray-400";
  const currentLabel = labels[status] || status;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${currentStyle}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${currentDot}`} />
      {currentLabel}
    </span>
  );
};

// --- Timestamp & 6-Hour Countdown Helper ---

function getTimestampMs(ts: any): number {
  if (!ts) return Date.now();
  if (typeof ts === 'number') return ts;
  if (ts.toDate && typeof ts.toDate === 'function') return ts.toDate().getTime();
  if (ts.seconds) return ts.seconds * 1000;
  if (ts instanceof Date) return ts.getTime();
  const parsed = new Date(ts).getTime();
  return isNaN(parsed) ? Date.now() : parsed;
}

function CountdownTimer({ 
  createdAt, 
  expiresAt,
  onExpire, 
  variant = 'badge',
  className = '',
  enable20MinRule = true
}: { 
  createdAt: any; 
  expiresAt?: any;
  onExpire?: () => void; 
  variant?: 'badge' | 'box' | 'compact' | 'admin';
  className?: string;
  enable20MinRule?: boolean;
}) {
  const [now, setNow] = useState<number>(Date.now());

  useEffect(() => {
    const update = () => setNow(Date.now());
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  const createdMs = getTimestampMs(createdAt);
  const target = expiresAt ? getTimestampMs(expiresAt) : (createdMs + 6 * 3600 * 1000);
  const timeLeft = Math.max(0, target - now);
  const elapsed = Math.max(0, now - createdMs);

  const TWENTY_MIN_MS = 20 * 60 * 1000;
  const isBefore20Min = enable20MinRule && (elapsed < TWENTY_MIN_MS);
  const isExpired = timeLeft <= 0;

  useEffect(() => {
    if (isExpired && onExpire) {
      onExpire();
    }
  }, [isExpired, onExpire]);

  const hours = Math.floor(timeLeft / (1000 * 60 * 60));
  const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
  const formattedTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const lockRemaining = Math.max(0, TWENTY_MIN_MS - elapsed);
  const lockM = Math.floor(lockRemaining / 60000);
  const lockS = Math.floor((lockRemaining % 60000) / 1000);
  const formattedLockWait = `${String(lockM).padStart(2, '0')}:${String(lockS).padStart(2, '0')}`;

  if (variant === 'admin') {
    if (isExpired) {
      return (
        <span className={`inline-flex items-center gap-1 font-mono text-[10px] font-bold px-2 py-0.5 rounded-lg border bg-zinc-800 text-zinc-400 border-zinc-700/60 ${className}`}>
          মেয়াদ শেষ
        </span>
      );
    }

    if (isBefore20Min) {
      return (
        <span className={`inline-flex items-center gap-1 font-mono text-[11px] font-bold px-2 py-0.5 rounded-lg bg-rose-950/70 text-rose-300 border border-rose-500/50 shadow-sm ${className}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping shrink-0" />
          <Clock size={11} className="text-rose-400 shrink-0" />
          <span>{formattedTime}</span>
          <span className="text-[9px] text-rose-400/90 font-sans font-medium">({formattedLockWait} লক)</span>
        </span>
      );
    }

    // 20 minutes passed -> GREEN!
    return (
      <span className={`inline-flex items-center gap-1 font-mono text-[11px] font-bold px-2 py-0.5 rounded-lg bg-emerald-950/70 text-emerald-300 border border-emerald-500/50 shadow-sm ${className}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
        <Clock size={11} className="text-emerald-400 shrink-0" />
        <span>{formattedTime}</span>
        <span className="text-[9px] text-emerald-400/90 font-sans font-medium">(সক্রিয়)</span>
      </span>
    );
  }

  if (variant === 'box') {
    if (isExpired) {
      return (
        <div className={`w-full bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 border-2 border-zinc-700 rounded-2xl p-3.5 flex items-center justify-between shadow-sm ${className}`}>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-zinc-700/50 text-zinc-400 flex items-center justify-center shrink-0">
              <Clock size={20} />
            </div>
            <div className="text-left">
              <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400">মেয়াদ শেষ (EXPIRED)</p>
              <p className="text-[11px] text-zinc-500">৬ ঘণ্টার মেয়াদ অতিক্রান্ত হয়েছে</p>
            </div>
          </div>
          <div className="font-mono text-base font-black px-3 py-1.5 rounded-xl border tracking-widest bg-zinc-950 text-zinc-500 border-zinc-800">
            00:00:00
          </div>
        </div>
      );
    }

    if (isBefore20Min) {
      return (
        <div className={`w-full bg-gradient-to-r from-rose-950/80 via-red-950/70 to-rose-950/80 border-2 border-rose-500/80 rounded-2xl p-3.5 flex items-center justify-between shadow-[0_0_25px_rgba(244,63,94,0.3)] ${className}`}>
          <div className="flex items-center gap-2.5 min-w-0 pr-2">
            <div className="w-9 h-9 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/40 flex items-center justify-center shrink-0 shadow-[0_0_10px_rgba(244,63,94,0.3)]">
              <Clock size={20} className="text-rose-400 animate-spin" />
            </div>
            <div className="text-left min-w-0">
              <p className="text-[10px] font-black uppercase tracking-wider text-rose-300 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping shrink-0" />
                🔴 ২০ মিনিট লক (পেমেন্ট গ্রহণ নিষেধ)
              </p>
              <p className="text-[11px] font-bold text-white/95 truncate">
                পেমেন্ট পাঠাতে আর <strong className="text-rose-300 underline font-black">{formattedLockWait}</strong> মিনিট অপেক্ষা করুন
              </p>
            </div>
          </div>
          <div className="font-mono text-base font-black px-3 py-1.5 rounded-xl border-2 tracking-widest bg-rose-950 text-rose-300 border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.4)] shrink-0">
            {formattedTime}
          </div>
        </div>
      );
    }

    // 20 minutes passed -> GREEN!
    return (
      <div className={`w-full bg-gradient-to-r from-emerald-950/80 via-teal-950/70 to-emerald-950/80 border-2 border-emerald-500/80 rounded-2xl p-3.5 flex items-center justify-between shadow-[0_0_25px_rgba(16,185,129,0.3)] ${className}`}>
        <div className="flex items-center gap-2.5 min-w-0 pr-2">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center shrink-0 shadow-[0_0_10px_rgba(16,185,129,0.3)]">
            <Clock size={20} className="text-emerald-400 animate-pulse" />
          </div>
          <div className="text-left min-w-0">
            <p className="text-[10px] font-black uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
              🟢 ২০ মিনিট অতিক্রান্ত (পেমেন্ট উন্মুক্ত)
            </p>
            <p className="text-[11px] font-bold text-white/95 truncate">
              নির্ধারিত সময়ের মধ্যে পেমেন্ট সম্পন্ন করতে পারবেন
            </p>
          </div>
        </div>
        <div className="font-mono text-base font-black px-3 py-1.5 rounded-xl border-2 tracking-widest bg-emerald-950 text-emerald-300 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.4)] shrink-0">
          {formattedTime}
        </div>
      </div>
    );
  }

  if (variant === 'compact') {
    if (isExpired) {
      return (
        <span className={`inline-flex items-center gap-1 font-mono text-[11px] font-black px-2 py-0.5 rounded-lg border bg-zinc-800 text-zinc-400 border-zinc-700 ${className}`}>
          Expired
        </span>
      );
    }
    if (isBefore20Min) {
      return (
        <span className={`inline-flex items-center gap-1 font-mono text-[11px] font-black px-2.5 py-0.5 rounded-lg border-2 bg-rose-500/20 text-rose-300 border-rose-500/60 shadow-[0_0_8px_rgba(244,63,94,0.3)] ${className}`}>
          <Clock size={11} className="text-rose-400 animate-spin" />
          🔴 {formattedTime} (লক)
        </span>
      );
    }
    return (
      <span className={`inline-flex items-center gap-1 font-mono text-[11px] font-black px-2.5 py-0.5 rounded-lg border-2 bg-emerald-500/20 text-emerald-300 border-emerald-500/60 shadow-[0_0_8px_rgba(16,185,129,0.3)] ${className}`}>
        <Clock size={11} className="text-emerald-400 animate-pulse" />
        🟢 {formattedTime} (সক্রিয়)
      </span>
    );
  }

  // variant === 'badge'
  if (isExpired) {
    return (
      <div className={`inline-flex items-center gap-1.5 font-mono text-xs font-black px-2.5 py-1 rounded-xl border bg-zinc-800 text-zinc-400 border-zinc-700 ${className}`}>
        মেয়াদ শেষ
      </div>
    );
  }

  if (isBefore20Min) {
    return (
      <div className={`inline-flex items-center gap-1.5 font-mono text-xs font-black px-3 py-1 rounded-xl border-2 bg-gradient-to-r from-rose-950 to-red-950 text-rose-300 border-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.35)] ${className}`}>
        <Clock size={13} className="text-rose-400 animate-spin" />
        <span>🔴 {formattedTime} (২০ মি. লক)</span>
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-1.5 font-mono text-xs font-black px-3 py-1 rounded-xl border-2 bg-gradient-to-r from-emerald-950 to-teal-950 text-emerald-300 border-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.35)] ${className}`}>
      <Clock size={13} className="text-emerald-400" />
      <span>🟢 {formattedTime} (পেমেন্ট সক্রিয়)</span>
    </div>
  );
}

// --- Main App Component ---

export default function App() {
  const [view, setView] = useState<'landing' | 'user' | 'admin'>('landing');
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [notifications, setNotifications] = useState<RequestData[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isAdminSession, setIsAdminSession] = useState(false);
  const [userPinConfig, setUserPinConfig] = useState<string>('1234');
  const [appLogoUrl, setAppLogoUrl] = useState<string>('');

  useEffect(() => {
    // Fetch user PIN config & logo live
    const unsubscribeConfig = onSnapshot(doc(db, 'settings', 'config'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.userPin) setUserPinConfig(data.userPin);
        if (data.logoUrl !== undefined) setAppLogoUrl(data.logoUrl);
      } else {
        setDoc(doc(db, 'settings', 'config'), { userPin: '1234', logoUrl: '' }, { merge: true }).catch(console.error);
      }
    }, (err) => {
      console.error("Failed to fetch settings", err);
    });
    
    // Check for existing admin session in localStorage
    const savedAdmin = localStorage.getItem('unity_admin_session');
    if (savedAdmin === 'true') {
      setIsAdminSession(true);
      setView('admin');
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const profile = userDoc.data() as UserProfile;
            setCurrentUser(profile);
            if (profile.role === 'admin') {
              setIsAdminSession(true);
              setView('admin');
            } else if (view !== 'admin') {
              setView('user');
            }
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
        }
      }
      setAuthLoading(false);
    });

    return () => {
      unsubscribe();
      unsubscribeConfig();
    };
  }, []);

  // Admin Notification Listener
  useEffect(() => {
    if (isAdminSession) {
      const q = query(collection(db, 'requests'), orderBy('createdAt', 'desc'));
      const unsubscribe = onSnapshot(q, 
        (snapshot) => {
          const reqs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RequestData));
          setNotifications(reqs);
        },
        (error) => handleFirestoreError(error, OperationType.GET, 'requests')
      );
      return () => unsubscribe();
    }
  }, [isAdminSession]);

  const handleAdminAuthSuccess = () => {
    setIsAdminSession(true);
    localStorage.setItem('unity_admin_session', 'true');
    setView('admin');
  };

  const handleEnterAsGuest = () => {
    setView('user');
  };

  const handleLogout = async () => {
    await signOut(auth);
    setIsAdminSession(false);
    localStorage.removeItem('unity_admin_session');
    setView('landing');
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-white selection:bg-indigo-500/30 font-sans overflow-x-hidden">
      {/* Background Atmosphere */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/10 blur-[150px] rounded-full" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-cyan-500/10 blur-[150px] rounded-full" />
      </div>

      <div className="relative z-10 max-w-md mx-auto min-h-screen flex flex-col pt-6 px-4 pb-20">
        <AnimatePresence mode="wait">
          {view === 'landing' && (
            <LandingPage key="landing" onEnter={handleEnterAsGuest} onAdminLogin={handleAdminAuthSuccess} userPinConfig={userPinConfig} appLogoUrl={appLogoUrl} />
          )}
          {view === 'user' && (
            <UserDashboard 
              key="user" 
              user={currentUser} 
              onLogout={handleLogout} 
              onAdminClick={() => setView('admin')} 
              isAdminSession={isAdminSession}
              appLogoUrl={appLogoUrl}
            />
          )}
          {view === 'admin' && (
            <AdminDashboard 
              key="admin" 
              user={currentUser || { name: 'Admin', uid: 'admin', role: 'admin', email: '', createdAt: null }} 
              onLogout={handleLogout} 
              notifications={notifications}
              showNotifications={showNotifications}
              setShowNotifications={setShowNotifications}
              onUserView={() => setView('user')}
              appLogoUrl={appLogoUrl}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// --- Landing Page ---

function LandingPage({ onEnter, onAdminLogin, userPinConfig, appLogoUrl }: { onEnter: () => void, onAdminLogin: () => void, userPinConfig: string, appLogoUrl?: string, key?: string }) {
  const [loginMode, setLoginMode] = useState<'none' | 'user' | 'admin'>('none');
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  const handleKeypadPress = (key: string) => {
    if (key === 'del') {
      setPin(prev => prev.slice(0, -1));
      setError(false);
    } else if (pin.length < 12) {
      const newPin = pin + key;
      setPin(newPin);
      setError(false);

      if (loginMode === 'admin') {
        if (newPin === '212650') {
          onAdminLogin();
        } else if (newPin.length >= 6) {
          setError(true);
          setTimeout(() => setError(false), 2000);
        }
      } else if (loginMode === 'user') {
        if (newPin === userPinConfig) {
          onEnter();
        } else if (newPin.length >= userPinConfig.length) {
          setError(true);
          setTimeout(() => setError(false), 2000);
        }
      }
    }
  };

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (loginMode === 'admin') {
      if (pin === '212650') {
        onAdminLogin();
      } else {
        setError(true);
        setTimeout(() => setError(false), 2000);
      }
    } else if (loginMode === 'user') {
      if (pin === userPinConfig) {
        onEnter();
      } else {
        setError(true);
        setTimeout(() => setError(false), 2000);
      }
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex-1 flex flex-col items-center justify-center gap-10 py-6"
    >
      <div className="text-center space-y-4">
        <motion.div 
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          className="w-24 h-24 bg-gradient-to-br from-indigo-500 via-purple-600 to-cyan-500 rounded-3xl mx-auto flex items-center justify-center shadow-2xl shadow-indigo-500/20 border border-white/10 overflow-hidden relative"
        >
          {appLogoUrl ? (
            <img src={appLogoUrl} alt="Unity Earning Logo" className="w-full h-full object-cover" />
          ) : (
            <TrendingUp size={44} className="text-white" />
          )}
        </motion.div>
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white mb-1">
            {TRANSLATIONS.TITLE}
          </h1>
          <p className="text-white/50 font-semibold tracking-widest uppercase text-xs">
            {TRANSLATIONS.SUBTITLE}
          </p>
        </div>
      </div>

      <div className="w-full space-y-4 max-w-sm">
        {loginMode === 'none' ? (
          <>
            <button 
              onClick={() => { setLoginMode('user'); setPin(''); }}
              className="w-full py-4 bg-white text-black hover:bg-white/90 transition-all rounded-2xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 group"
            >
              <UserIcon size={20} />
              {TRANSLATIONS.ENTER} User
            </button>
            <button 
              onClick={() => { setLoginMode('admin'); setPin(''); }}
              className="w-full py-4 bg-[#18181b] hover:bg-[#27272a] border border-white/10 transition-all rounded-2xl font-semibold text-white flex items-center justify-center gap-2"
            >
              <ShieldCheck size={20} className="text-indigo-400" />
              {TRANSLATIONS.ADMIN_LOGIN}
            </button>
          </>
        ) : (
          <form onSubmit={handleAuth} className="space-y-4 bg-[#18181b] p-6 rounded-3xl border border-white/10 shadow-xl">
            <h2 className="text-center text-lg font-extrabold mb-1">
              {loginMode === 'admin' ? 'Admin Login' : 'User Login'}
            </h2>
            <div className="relative">
              <input 
                type="password"
                readOnly
                placeholder="Enter PIN"
                value={pin}
                className={`w-full bg-[#09090b] border ${error ? 'border-rose-500' : 'border-white/10'} rounded-2xl py-3.5 px-6 text-center text-xl tracking-[0.3em] font-mono focus:outline-none transition-colors cursor-default`}
              />
              {error && <p className="text-rose-500 text-xs text-center mt-2 font-semibold">Incorrect PIN</p>}
            </div>
            
            <div className="grid grid-cols-3 gap-2 mt-3">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                <button 
                  key={num} 
                  type="button" 
                  onClick={() => handleKeypadPress(num.toString())} 
                  className="py-3.5 bg-[#27272a] rounded-xl font-bold text-xl hover:bg-[#3f3f46] transition-colors active:scale-95 text-white/90"
                >
                  {num}
                </button>
              ))}
              <button 
                type="button" 
                onClick={() => setLoginMode('none')} 
                className="py-3.5 bg-[#27272a] rounded-xl font-semibold text-xs hover:bg-[#3f3f46] transition-colors active:scale-95 text-white/50"
              >
                BACK
              </button>
              <button 
                type="button" 
                onClick={() => handleKeypadPress('0')} 
                className="py-3.5 bg-[#27272a] rounded-xl font-bold text-xl hover:bg-[#3f3f46] transition-colors active:scale-95 text-white/90"
              >
                0
              </button>
              <button 
                type="button" 
                onClick={() => handleKeypadPress('del')} 
                className="py-3.5 bg-[#27272a] rounded-xl font-bold text-lg hover:bg-[#3f3f46] transition-colors active:scale-95 flex items-center justify-center text-rose-400"
              >
                <Delete size={22} />
              </button>
            </div>
            
            <button 
              type="submit"
              disabled={!pin}
              className="w-full mt-3 py-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 transition-colors rounded-xl font-bold text-white shadow-lg shadow-indigo-600/20 active:scale-95 flex justify-center items-center gap-2"
            >
              <CheckCircle2 size={20} /> Login
            </button>
          </form>
        )}
      </div>
    </motion.div>
  );
}

// --- User Dashboard ---

function UserDashboard({ user, onLogout, onAdminClick, isAdminSession, appLogoUrl }: { 
  user: UserProfile | null, 
  onLogout: () => void, 
  onAdminClick: () => void,
  isAdminSession: boolean,
  appLogoUrl?: string,
  key?: string
}) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [pinTargetMember, setPinTargetMember] = useState<TeamMember | null>(null);
  const [memberPinInput, setMemberPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const [activeMember, setActiveMember] = useState<TeamMember | null>(null);
  const [showOptionModal, setShowOptionModal] = useState(false);
  
  const [activeModal, setActiveModal] = useState<'none' | 'withdraw' | 'seat_booking' | 'sure_shot' | 'sure_shot_invoice' | 'history' | 'post_booking' | 'invoice'>('none');
  const [latestBooking, setLatestBooking] = useState<RequestData | null>(null);
  const [latestSureShot, setLatestSureShot] = useState<RequestData | null>(null);
  const [history, setHistory] = useState<RequestData[]>([]);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'leader' | 'trainer'>('leader');

  // Auto-purge sure_shot pre-bookings older than 6 hours
  useEffect(() => {
    const purgeExpired = async () => {
      const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
      const now = Date.now();
      for (const req of history) {
        if (req.type === 'sure_shot') {
          const createdMs = getTimestampMs(req.createdAt);
          if (now - createdMs >= SIX_HOURS_MS) {
            try {
              await deleteDoc(doc(db, 'requests', req.id));
            } catch (err) {
              console.error('Failed to auto-purge expired sure shot:', err);
            }
          }
        }
      }
    };
    purgeExpired();
    const interval = setInterval(purgeExpired, 15000);
    return () => clearInterval(interval);
  }, [history]);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'teamMembers'), 
      (snapshot) => {
        setMembers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TeamMember)));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'teamMembers')
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'requests'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      q, 
      (snapshot) => {
        const allReqs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RequestData));
        setHistory(allReqs);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'requests')
    );
    return () => unsubscribe();
  }, []);

  const handleMemberClick = (member: TeamMember) => {
    setPinTargetMember(member);
    setMemberPinInput('');
    setPinError(false);
  };

  const handleVerifyMemberPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinTargetMember) return;
    
    const expectedPin = pinTargetMember.pin || '1234';
    if (memberPinInput === expectedPin) {
      setActiveMember(pinTargetMember);
      setPinTargetMember(null);
      setShowOptionModal(true);
    } else {
      setPinError(true);
      setTimeout(() => setPinError(false), 2000);
    }
  };

  const handleKeypadPress = (val: string) => {
    if (!pinTargetMember) return;
    if (val === 'del') {
      setMemberPinInput(prev => prev.slice(0, -1));
      setPinError(false);
    } else if (memberPinInput.length < 8) {
      const newPin = memberPinInput + val;
      setMemberPinInput(newPin);
      setPinError(false);

      const expectedPin = pinTargetMember.pin || '1234';
      if (newPin === expectedPin) {
        setActiveMember(pinTargetMember);
        setPinTargetMember(null);
        setShowOptionModal(true);
      } else if (newPin.length >= expectedPin.length) {
        setPinError(true);
        setTimeout(() => setPinError(false), 2000);
      }
    }
  };

  const filteredMembers = members.filter(m => 
    m.role === activeTab && 
    (m.name.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex-1 flex flex-col gap-6"
    >
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          {appLogoUrl && (
            <img src={appLogoUrl} alt="Logo" className="w-8 h-8 rounded-xl object-cover border border-white/10" />
          )}
          <h2 className="text-2xl font-extrabold tracking-tight text-white">{TRANSLATIONS.TITLE}</h2>
        </div>
        <div className="flex gap-2">
          {isAdminSession && (
            <button onClick={onAdminClick} className="p-2.5 bg-[#18181b] hover:bg-[#27272a] border border-white/10 text-indigo-400 rounded-xl transition-colors">
              <ShieldCheck size={20} />
            </button>
          )}
          <button onClick={onLogout} className="p-2.5 bg-[#18181b] hover:bg-[#27272a] border border-white/10 rounded-xl transition-colors text-white/70">
            <LogOut size={20} />
          </button>
        </div>
      </header>

      {/* Role Selection Tabs */}
      <div className="flex bg-[#18181b] p-1.5 rounded-2xl border border-white/5">
        <button 
          onClick={() => setActiveTab('leader')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${activeTab === 'leader' ? 'bg-white text-black shadow-md' : 'text-white/60 hover:text-white'}`}
        >
          {TRANSLATIONS.TEAM_LEADER}
        </button>
        <button 
          onClick={() => setActiveTab('trainer')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${activeTab === 'trainer' ? 'bg-white text-black shadow-md' : 'text-white/60 hover:text-white'}`}
        >
          {TRANSLATIONS.TEAM_TRAINER}
        </button>
      </div>

      <div className="flex-1 space-y-5">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" size={18} />
          <input 
            type="text" 
            placeholder={TRANSLATIONS.SEARCH}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#18181b] border border-white/10 rounded-2xl py-3.5 pl-12 pr-4 text-sm focus:outline-none focus:border-indigo-500/50 transition-colors"
          />
        </div>

        <div className="grid gap-3">
          {filteredMembers.map(member => {
            return (
              <motion.button
                key={member.id}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => handleMemberClick(member)}
                className="bg-[#18181b] hover:bg-[#27272a] p-3.5 rounded-2xl border border-white/5 text-left flex items-center justify-between group transition-colors shadow-sm"
              >
                <div className="flex items-center gap-3.5">
                  <MemberDesignBadge name={member.name} role={member.role} size="lg" />
                  <div>
                    <h3 className="font-extrabold text-base text-white/95">{member.name}</h3>
                    <p className="text-[11px] text-indigo-400/90 font-mono font-medium">PIN Access Required</p>
                  </div>
                </div>
                <ChevronRight className="text-white/20 group-hover:text-white/50 transition-colors" size={20} />
              </motion.button>
            );
          })}
          {filteredMembers.length === 0 && (
            <div className="text-center py-12 text-white/20">
              <Users size={48} className="mx-auto mb-2 opacity-20" />
              <p>No members found</p>
            </div>
          )}
        </div>
      </div>

      {/* PIN Keypad Prompt for Selected Member */}
      <AnimatePresence>
        {pinTargetMember && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setPinTargetMember(null)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-sm bg-[#18181b] p-6 rounded-3xl border border-white/10 shadow-2xl z-10">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2 text-indigo-400">
                  <Lock size={18} />
                  <span className="text-xs font-bold uppercase tracking-wider">Account Access</span>
                </div>
                <button onClick={() => setPinTargetMember(null)} className="text-white/40 hover:text-white"><XCircle size={20} /></button>
              </div>
              
              <div className="flex items-center gap-3 mb-4 bg-[#09090b] p-2.5 rounded-2xl border border-white/5">
                <MemberDesignBadge name={pinTargetMember.name} role={pinTargetMember.role} size="md" />
                <div>
                  <h3 className="text-sm font-bold text-white">{pinTargetMember.name}</h3>
                  <p className="text-[10px] text-white/50">Enter PIN to access Withdraw or Seat Booking</p>
                </div>
              </div>

              <form onSubmit={handleVerifyMemberPin} className="space-y-3">
                <input 
                  type="password"
                  readOnly
                  placeholder="PIN"
                  value={memberPinInput}
                  className={`w-full bg-[#09090b] border ${pinError ? 'border-rose-500' : 'border-white/10'} rounded-2xl py-3 px-4 text-center text-xl tracking-[0.3em] font-mono focus:outline-none`}
                />
                {pinError && <p className="text-rose-500 text-xs text-center font-semibold">Incorrect Member PIN</p>}

                <div className="grid grid-cols-3 gap-2 pt-2">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                    <button 
                      key={num} 
                      type="button" 
                      onClick={() => handleKeypadPress(num.toString())} 
                      className="py-3 bg-[#27272a] rounded-xl font-bold text-lg hover:bg-[#3f3f46] transition-colors text-white"
                    >
                      {num}
                    </button>
                  ))}
                  <button type="button" onClick={() => setPinTargetMember(null)} className="py-3 bg-[#27272a] rounded-xl text-xs font-semibold text-white/40">CANCEL</button>
                  <button type="button" onClick={() => handleKeypadPress('0')} className="py-3 bg-[#27272a] rounded-xl font-bold text-lg text-white">0</button>
                  <button type="button" onClick={() => handleKeypadPress('del')} className="py-3 bg-[#27272a] rounded-xl text-rose-400 flex items-center justify-center"><Delete size={20} /></button>
                </div>

                <button 
                  type="submit" 
                  disabled={!memberPinInput}
                  className="w-full mt-2 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl font-bold transition-all shadow-lg shadow-indigo-600/20"
                >
                  Verify & Continue
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Option Selection Modal (Withdraw Request vs Seat Book vs Sure Shot) */}
      <AnimatePresence>
        {showOptionModal && activeMember && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowOptionModal(false)} className="absolute inset-0 bg-black/80 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-sm bg-[#121316] rounded-3xl p-5 sm:p-6 border border-white/10 shadow-2xl space-y-4 sm:space-y-5 z-10 box-border overflow-hidden">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-3 min-w-0">
                  <MemberDesignBadge name={activeMember.name} role={activeMember.role} size="md" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">Select Action</p>
                    <h3 className="text-lg font-extrabold text-white truncate">{activeMember.name}</h3>
                  </div>
                </div>
                <button onClick={() => setShowOptionModal(false)} className="text-white/40 hover:text-white shrink-0 ml-2"><XCircle size={22} /></button>
              </div>

              <div className="flex flex-col gap-3 w-full min-w-0">
                <button
                  onClick={() => {
                    setShowOptionModal(false);
                    setActiveModal('withdraw');
                  }}
                  className="w-full max-w-full box-border p-3.5 sm:p-4 bg-gradient-to-r from-indigo-900/40 to-purple-900/40 border border-indigo-500/30 hover:border-indigo-500/60 rounded-2xl text-left flex items-center justify-between group transition-all min-w-0 overflow-hidden"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30 shrink-0">
                      <Banknote size={20} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-bold text-white group-hover:text-indigo-300 transition-colors text-sm sm:text-base truncate">Withdraw Request</h4>
                      <p className="text-xs text-white/50 truncate">Send a withdrawal request</p>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-white/30 group-hover:text-white shrink-0 ml-2" />
                </button>

                <button
                  onClick={() => {
                    setShowOptionModal(false);
                    setActiveModal('seat_booking');
                  }}
                  className="w-full max-w-full box-border p-3.5 sm:p-4 bg-gradient-to-r from-cyan-900/40 to-blue-900/40 border border-cyan-500/30 hover:border-cyan-500/60 rounded-2xl text-left flex items-center justify-between group transition-all min-w-0 overflow-hidden"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30 shrink-0">
                      <Sparkles size={20} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-bold text-white group-hover:text-cyan-300 transition-colors text-sm sm:text-base truncate">Seat Book</h4>
                      <p className="text-xs text-white/50 truncate">Fill up seat booking form</p>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-white/30 group-hover:text-white shrink-0 ml-2" />
                </button>

                <button
                  onClick={() => {
                    setShowOptionModal(false);
                    setActiveModal('sure_shot');
                  }}
                  className="w-full max-w-full box-border p-3.5 sm:p-4 bg-gradient-to-r from-amber-900/40 to-orange-900/40 border border-amber-500/30 hover:border-amber-500/60 rounded-2xl text-left flex items-center justify-between group transition-all min-w-0 overflow-hidden"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30 shrink-0">
                      <Zap size={20} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-bold text-white group-hover:text-amber-300 transition-colors text-sm sm:text-base truncate">Sure Shot Pre-Booking</h4>
                      <p className="text-xs text-white/50 truncate">শিউরশট প্রি-বুকিং করুন (৬ ঘণ্টা মেয়াদ)</p>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-white/30 group-hover:text-white shrink-0 ml-2" />
                </button>

                <button
                  onClick={() => {
                    setShowOptionModal(false);
                    setActiveModal('history');
                  }}
                  className="w-full max-w-full box-border p-3.5 sm:p-4 bg-gradient-to-r from-emerald-900/40 to-teal-900/40 border border-emerald-500/30 hover:border-emerald-500/60 rounded-2xl text-left flex items-center justify-between group transition-all min-w-0 overflow-hidden"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30 shrink-0">
                      <HistoryIcon size={20} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-bold text-white group-hover:text-emerald-300 transition-colors text-sm sm:text-base truncate">My History</h4>
                      <p className="text-xs text-white/50 truncate">View account history</p>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-white/30 group-hover:text-white shrink-0 ml-2" />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Main Request Forms & History Modals */}
      <AnimatePresence>
        {activeModal === 'sure_shot' && activeMember && (
          <SureShotPreBookingModal 
            member={activeMember}
            sender={user}
            history={history}
            onClose={() => setActiveModal('none')}
            onSuccessSubmitted={(req) => {
              setLatestSureShot(req);
              setActiveModal('sure_shot_invoice');
            }}
            onOpenHistory={() => setActiveModal('history')}
          />
        )}
        {activeModal === 'sure_shot_invoice' && latestSureShot && (
          <SureShotInvoiceModal 
            booking={latestSureShot}
            onClose={() => setActiveModal('none')}
            onOpenHistory={() => setActiveModal('history')}
          />
        )}
        {activeModal === 'seat_booking' && activeMember && (
          <SeatBookingModal 
            member={activeMember}
            sender={user}
            onClose={() => setActiveModal('none')}
            onSuccessSubmitted={(req) => {
              setLatestBooking(req);
              setActiveModal('post_booking');
            }}
            onOpenHistory={() => setActiveModal('history')}
          />
        )}
        {activeModal === 'post_booking' && latestBooking && (
          <PostBookingSuccessModal 
            booking={latestBooking}
            onClose={() => setActiveModal('none')}
            onViewInvoice={() => setActiveModal('invoice')}
            onViewHistory={() => setActiveModal('history')}
          />
        )}
        {activeModal === 'invoice' && latestBooking && (
          <InvoiceReceiptModal 
            booking={latestBooking}
            onClose={() => setActiveModal('none')}
          />
        )}
        {activeModal === 'withdraw' && activeMember && (
          <WithdrawModal 
            member={activeMember}
            sender={user}
            onClose={() => setActiveModal('none')}
            onOpenHistory={() => setActiveModal('history')}
          />
        )}
        {activeModal === 'history' && (
          <HistoryModal 
            user={user}
            activeMember={activeMember}
            history={history} 
            onClose={() => setActiveModal('none')}
            onOpenBooking={() => {
              if (activeMember) {
                setActiveModal('seat_booking');
              } else {
                setActiveModal('none');
              }
            }}
            onSelectInvoice={(req) => {
              setLatestBooking(req);
              setActiveModal('invoice');
            }}
            onSelectSureShotInvoice={(req) => {
              setLatestSureShot(req);
              setActiveModal('sure_shot_invoice');
            }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// --- Sure Shot Pre-Booking Modal ---

function SureShotPreBookingModal({
  member,
  sender,
  history,
  onClose,
  onSuccessSubmitted,
  onOpenHistory
}: {
  member: TeamMember;
  sender: UserProfile | null;
  history: RequestData[];
  onClose: () => void;
  onSuccessSubmitted: (req: RequestData) => void;
  onOpenHistory: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [showConfirmPopup, setShowConfirmPopup] = useState(false);

  // Count existing sure shot requests for this member to calculate sequence
  const existingMemberSureShots = history.filter(r => 
    r.type === 'sure_shot' && 
    ((r.recipientName && r.recipientName.trim().toLowerCase() === member.name.trim().toLowerCase()) ||
     (r.submittedByUid && r.submittedByUid === member.id))
  );
  const sequenceNumber = existingMemberSureShots.length + 1;

  const handleFinalSubmit = async () => {
    setLoading(true);

    const generatedRef = `SSB-${Math.floor(100000 + Math.random() * 900000)}`;
    const now = new Date();
    const expiresAtDate = new Date(now.getTime() + 6 * 60 * 60 * 1000);

    try {
      const docRef = await addDoc(collection(db, 'requests'), {
        refId: generatedRef,
        type: 'sure_shot',
        senderId: sender?.uid || 'guest',
        senderName: sender?.name || member.name,
        senderNumber: member.number || '',
        senderRole: sender?.role || 'user',
        recipientName: member.name,
        recipientNumber: member.number || '',
        amount: 0,
        bookingSequence: sequenceNumber,
        status: 'pending',
        createdAt: serverTimestamp(),
        expiresAt: expiresAtDate,
        submittedByUid: member.id,
        note: `Sure Shot Pre-Booking #${sequenceNumber}`
      });

      saveMySubmittedRequestId(docRef.id);

      const createdReq: RequestData = {
        id: docRef.id,
        refId: generatedRef,
        type: 'sure_shot',
        senderId: sender?.uid || 'guest',
        senderName: sender?.name || member.name,
        senderNumber: member.number || '',
        senderRole: sender?.role || 'user',
        recipientName: member.name,
        recipientNumber: member.number || '',
        amount: 0,
        bookingSequence: sequenceNumber,
        status: 'pending',
        createdAt: now,
        expiresAt: expiresAtDate,
        submittedByUid: member.id,
        note: `Sure Shot Pre-Booking #${sequenceNumber}`
      };

      setShowConfirmPopup(false);
      onSuccessSubmitted(createdReq);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'requests');
    } finally {
      setLoading(false);
    }
  };

  const isLeader = member.role === 'leader';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/85 backdrop-blur-md" 
      />
      <motion.div 
        initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
        className="relative w-full max-w-sm bg-[#0d0f17] border-2 border-amber-500/40 rounded-3xl p-5 shadow-[0_0_35px_rgba(245,158,11,0.2)] my-auto z-10 flex flex-col gap-4 overflow-hidden"
      >
        {/* Amber-Orange Top Glow bar */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-400" />

        {/* Member Header Card */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10 pt-1">
          <div className="flex items-center gap-3">
            <MemberDesignBadge name={member.name} role={member.role} size="md" />
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] uppercase font-black text-amber-400 tracking-wider">
                  {isLeader ? 'টিম লিডার' : 'টিম ট্রেইনার'}
                </span>
                <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  বুকিং #{sequenceNumber}
                </span>
              </div>
              <h3 className="text-base font-extrabold text-white">{member.name}</h3>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-white/40 hover:text-white rounded-lg transition-colors">
            <XCircle size={20} />
          </button>
        </div>

        {/* Red Highlighted Warning Box */}
        <div className="bg-gradient-to-r from-rose-950/90 via-red-950/80 to-rose-950/90 border-2 border-rose-500 rounded-2xl p-4 text-center space-y-2 shadow-[0_0_25px_rgba(244,63,94,0.3)]">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/25 text-rose-300 border border-rose-500/50 text-[10px] font-black uppercase tracking-wider animate-pulse">
            <AlertTriangle size={13} className="text-rose-400" />
            ⚠️ জরুরি সতর্কবার্তা ও নিয়মাবলী
          </div>
          <h2 className="text-sm font-black text-white">
            শিউরশট প্রি-বুকিং করার <span className="text-rose-400 underline decoration-2">কমপক্ষে ২০ মিনিট পর</span> পেমেন্ট করাতে হবে
          </h2>
          <div className="bg-rose-900/60 border border-rose-500/40 rounded-xl p-2 text-xs font-black text-rose-200">
            এর আগে পেমেন্ট করালে শিউরশট হবে না!
          </div>
          <p className="text-[11px] font-semibold text-rose-200/90 leading-relaxed">
            প্রি-বুকিংয়ের মেয়াদ থাকবে মোট ৬ ঘণ্টা। ৬ ঘণ্টা পর অটোমেটিক্যালি এটি ডিসেবল/বাতিল হয়ে যাবে।
          </p>
        </div>

        {/* Confirmation Guideline Box */}
        <div className="bg-[#121622] border border-amber-500/30 rounded-2xl p-3.5 text-center space-y-1.5">
          <p className="text-xs font-bold text-amber-200 leading-snug">
            নিচে থাকা <strong className="text-white underline font-extrabold">কনফার্ম প্রি-বুকিং বাটনে</strong> ক্লিক করলে সিট বুকিং নিশ্চিতকরণ পপআপ আসবে।
          </p>
          <div className="flex items-center justify-center gap-1.5 text-[10px] font-bold text-amber-400">
            <Clock size={12} />
            <span>নিশ্চিত করার সাথে সাথে ৬ ঘণ্টার কাউন্টডাউন টাইমার চালু হবে</span>
          </div>
        </div>

        {/* Action Button */}
        <div className="space-y-3 pt-1">
          <button 
            type="button"
            onClick={() => setShowConfirmPopup(true)}
            className="w-full py-3.5 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:opacity-95 text-black font-black text-xs tracking-wider uppercase rounded-xl shadow-lg shadow-orange-500/25 transition-all flex items-center justify-center gap-2 active:scale-98"
          >
            <CheckCircle2 size={16} />
            কনফার্ম প্রি-বুকিং (Confirm Pre-Booking)
          </button>
        </div>

        {/* View History Button */}
        <button
          type="button"
          onClick={onOpenHistory}
          className="w-full py-2.5 bg-[#141724] hover:bg-[#1c2133] text-white/70 hover:text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 border border-white/5"
        >
          <HistoryIcon size={14} /> My History (পূর্বের বুকিং ইতিহাস দেখুন)
        </button>

        {/* Secondary Confirmation Popup Modal */}
        <AnimatePresence>
          {showConfirmPopup && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }}
                onClick={() => !loading && setShowConfirmPopup(false)}
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              />
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="relative w-full max-w-xs bg-[#111420] border-2 border-amber-500/60 rounded-3xl p-5 shadow-[0_0_35px_rgba(245,158,11,0.35)] z-10 text-center space-y-4"
              >
                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center mx-auto shadow-lg shadow-amber-500/25">
                  <CheckCircle2 size={24} />
                </div>

                <div className="space-y-1.5">
                  <h3 className="text-base font-black text-white">সিট বুকিং নিশ্চিতকরণ</h3>
                  <p className="text-xs text-amber-200 font-bold leading-relaxed">
                    সিট বুকিং নিশ্চিত করতে কনফার্ম বাটনে আবার ক্লিক করতে হবে।
                  </p>
                  <div className="pt-1">
                    <span className="text-[11px] font-bold text-white/80 bg-white/5 px-2.5 py-1 rounded-lg border border-white/10 inline-block">
                      {member.name} • বুকিং #{sequenceNumber}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => setShowConfirmPopup(false)}
                    className="py-2.5 bg-[#1a1f30] hover:bg-[#232a40] text-white/70 hover:text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                  >
                    বাতিল (Cancel)
                  </button>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleFinalSubmit}
                    className="py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:opacity-95 text-black font-black text-xs rounded-xl shadow-lg shadow-orange-500/25 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                        প্রসেসিং...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={14} /> কনফার্ম করুন
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

// --- Sure Shot Digital Receipt / Invoice Modal ---

function SureShotInvoiceModal({ 
  booking, onClose, onOpenHistory 
}: { 
  booking: RequestData, 
  onClose: () => void,
  onOpenHistory?: () => void
}) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const issueDate = booking.createdAt?.toDate 
    ? booking.createdAt.toDate().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const refId = booking.refId || `SSB-${Math.floor(100000 + Math.random() * 900000)}`;

  const handleDownload = async () => {
    if (!receiptRef.current) return;
    setDownloading(true);
    try {
      const dataUrl = await toPng(receiptRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: '#0a0d18',
      });
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `Sure_Shot_Invoice_${refId}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to capture invoice:', err);
      window.print();
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 overflow-y-auto">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 bg-black/85 backdrop-blur-md" />
      
      <div className="relative w-full max-w-sm z-10 my-auto flex flex-col gap-3">
        {/* Printable/Downloadable Container */}
        <motion.div 
          ref={receiptRef}
          initial={{ scale: 0.9, opacity: 0 }} 
          animate={{ scale: 1, opacity: 1 }} 
          exit={{ scale: 0.9, opacity: 0 }}
          className="w-full bg-[#0a0d18] rounded-3xl p-5 border border-amber-500/40 shadow-2xl flex flex-col gap-3 relative overflow-hidden"
        >
          {/* Top Gold Gradient Glow Bar */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-400" />

          {/* Header Bar */}
          <div className="flex items-center justify-between pb-3 border-b border-white/10 pt-1">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-black flex items-center justify-center shadow-md shadow-orange-500/20 shrink-0 font-black">
                <Zap size={20} className="text-black" />
              </div>
              <div>
                <h2 className="text-base font-black text-white tracking-wider">UNITY EARNING</h2>
                <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Sure Shot Pre-Booking</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-black px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                #{booking.bookingSequence || 1}
              </span>
              <Badge status={booking.status || 'pending'} />
            </div>
          </div>

          {/* Clean 6-Hour Countdown Timer */}
          <div className="bg-[#121622] rounded-2xl p-3 border border-white/10 flex items-center justify-between">
            <span className="text-xs font-bold text-white/70 flex items-center gap-1.5">
              <Clock size={15} className="text-amber-400" />
              সময়সীমা (Time Left):
            </span>
            <CountdownTimer 
              createdAt={booking.createdAt} 
              expiresAt={booking.expiresAt} 
              variant="compact" 
            />
          </div>

          {/* Invoice Details */}
          <div className="bg-[#121622] rounded-2xl p-3.5 border border-white/10 space-y-2.5 text-xs">
            <div className="flex justify-between items-center pb-2 border-b border-white/5">
              <span className="text-white/40 text-[11px] uppercase font-bold tracking-wider">Booking ID</span>
              <span className="font-mono font-bold text-amber-300 text-xs">{refId}</span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-white/5">
              <span className="text-white/40 text-[11px] uppercase font-bold tracking-wider">Team Member</span>
              <span className="font-bold text-white text-xs">{booking.recipientName || 'N/A'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-white/40 text-[11px] uppercase font-bold tracking-wider">Issue Time</span>
              <span className="font-semibold text-white/80 text-[11px]">{issueDate}</span>
            </div>
          </div>

          {/* Concise Footer Note */}
          <p className="text-[10px] text-center text-amber-300/80 font-medium pt-0.5">
            * প্রি-বুকিংয়ের ২০ মিনিট পর পেমেন্ট গ্রহণ করা হবে • মেয়াদ ৬ ঘণ্টা
          </p>
        </motion.div>

        {/* Success Alert */}
        {downloadSuccess && (
          <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold py-2 px-3 rounded-xl text-center flex items-center justify-center gap-2">
            <CheckCircle2 size={16} /> ইনভয়েস সফলভাবে ডাউনলোড হয়েছে!
          </motion.div>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2.5">
          <button
            onClick={onClose}
            className="py-3 bg-[#121826] hover:bg-[#1a2336] border border-white/10 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 active:scale-98"
          >
            <XCircle size={16} className="text-white/60" /> CLOSE (বন্ধ করুন)
          </button>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="py-3 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:opacity-95 text-black font-black text-xs rounded-xl shadow-lg shadow-orange-500/25 transition-all flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50"
          >
            {downloading ? (
              <>
                <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                প্রসেসিং...
              </>
            ) : (
              <>
                <Download size={16} /> ডাউনলোড (DOWNLOAD)
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Post Seat Booking Confirmation Screen (Screenshot 1 Exact Layout) ---

function PostBookingSuccessModal({ 
  booking, onClose, onViewInvoice, onViewHistory 
}: { 
  booking: RequestData, 
  onClose: () => void,
  onViewInvoice: () => void,
  onViewHistory: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/85 backdrop-blur-md" />
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }} 
        animate={{ scale: 1, opacity: 1 }} 
        exit={{ scale: 0.9, opacity: 0 }}
        className="relative w-full max-w-sm bg-[#090d16] rounded-3xl p-6 border-2 border-amber-500/40 shadow-[0_0_30px_rgba(245,158,11,0.15)] flex flex-col items-center text-center gap-5 z-10"
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors">
          <XCircle size={22} />
        </button>

        {/* Amber Clock Header Icon */}
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mt-2 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
          <Clock size={36} />
        </div>

        {/* Title */}
        <h2 className="text-xl font-extrabold text-white tracking-tight">
          {TRANSLATIONS.BOOKING_RECEIVED}
        </h2>

        {/* Dark Box with Pending Message */}
        <div className="w-full bg-[#131926] border border-amber-500/20 rounded-2xl p-4 text-xs font-semibold leading-relaxed text-amber-200/90 shadow-inner">
          {TRANSLATIONS.BOOKING_PENDING_MSG}
        </div>

        {/* Buttons */}
        <div className="w-full space-y-3 pt-1">
          <button
            onClick={onViewInvoice}
            className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold text-xs tracking-wider rounded-xl shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 active:scale-98"
          >
            <FileText size={16} />
            {TRANSLATIONS.VIEW_INVOICE}
          </button>

          <button
            onClick={onViewHistory}
            className="w-full py-3.5 bg-[#171d2c] hover:bg-[#20283d] border border-white/10 text-white/90 font-extrabold text-xs tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 active:scale-98"
          >
            <HistoryIcon size={16} />
            {TRANSLATIONS.MY_HISTORY_BTN}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// --- Seat Booking Digital Receipt / Invoice Modal (Screenshot 2 Exact Layout) ---

function InvoiceReceiptModal({ 
  booking, onClose 
}: { 
  booking: RequestData, 
  onClose: () => void 
}) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const issueDate = booking.createdAt?.toDate 
    ? booking.createdAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const refId = booking.refId || `#UE-${Math.floor(10000 + Math.random() * 90000)}`;

  const handleDownload = async () => {
    if (!receiptRef.current) return;
    setDownloading(true);
    try {
      const dataUrl = await toPng(receiptRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: '#090d18',
      });
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `Seat_Booking_Receipt_${refId.replace('#', '')}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to capture receipt:', err);
      window.print();
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 overflow-y-auto">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/85 backdrop-blur-md" />
      
      <div className="relative w-full max-w-sm z-10 my-auto flex flex-col gap-3">
        {/* Capture Container for html2canvas */}
        <motion.div 
          ref={receiptRef}
          initial={{ scale: 0.9, opacity: 0 }} 
          animate={{ scale: 1, opacity: 1 }} 
          exit={{ scale: 0.9, opacity: 0 }}
          className="w-full bg-[#090d18] rounded-3xl p-5 border-2 border-cyan-500/40 shadow-[0_0_35px_rgba(6,182,212,0.2)] flex flex-col gap-3.5 relative overflow-hidden"
        >
          {/* Glow Accent Top */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-400" />

          {/* Receipt Header Bar */}
          <div className="flex items-center justify-between pb-3 border-b border-white/10 pt-1">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cyan-500 via-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-cyan-500/20 shrink-0">
                <Shield size={22} />
              </div>
              <div>
                <h2 className="text-base font-black text-white tracking-wider">UNITY EARNING</h2>
                <p className="text-[9px] font-extrabold text-cyan-400 tracking-widest uppercase">— SEAT BOOKING RECEIPT —</p>
              </div>
            </div>
            <Badge status={booking.status || 'pending'} />
          </div>

          {/* Invoice Grid Details */}
          <div className="grid grid-cols-2 gap-2.5">
            {/* REF ID */}
            <div className="bg-[#121826] border border-white/10 rounded-2xl p-3">
              <p className="text-[9px] font-bold uppercase text-white/40 tracking-wider">REF ID</p>
              <p className="text-xs font-black text-cyan-300 font-mono mt-0.5">{refId}</p>
            </div>

            {/* ISSUE DATE */}
            <div className="bg-[#121826] border border-white/10 rounded-2xl p-3 flex justify-between items-center">
              <div>
                <p className="text-[9px] font-bold uppercase text-white/40 tracking-wider">ISSUE DATE</p>
                <p className="text-xs font-bold text-white mt-0.5">{issueDate}</p>
              </div>
              <Calendar size={16} className="text-cyan-400/50" />
            </div>
          </div>

          {/* CANDIDATE */}
          <div className="bg-[#121826] border border-white/10 rounded-2xl p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/30">
              <UserIcon size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-bold uppercase text-white/40 tracking-wider">CANDIDATE (আবেদনকারী)</p>
              <p className="text-sm font-black text-white truncate">{booking.senderName || 'N/A'}</p>
            </div>
          </div>

          {/* COUNSELOR */}
          <div className="bg-[#121826] border border-white/10 rounded-2xl p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0 border border-cyan-500/30">
              <Send size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-bold uppercase text-white/40 tracking-wider">COUNSELOR / LEADER (কাউন্সেলর)</p>
              <p className="text-sm font-black text-white truncate">{booking.recipientName || 'N/A'}</p>
            </div>
          </div>

          {/* FEE & PAYMENT TRX */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="bg-[#121826] border border-white/10 rounded-2xl p-3">
              <p className="text-[9px] font-bold uppercase text-white/40 tracking-wider">FEE (ফি)</p>
              <p className="text-lg font-black text-emerald-400 font-mono mt-0.5">৳{booking.amount}</p>
            </div>

            <div className="bg-[#121826] border border-white/10 rounded-2xl p-3">
              <div className="flex justify-between items-center">
                <p className="text-[9px] font-bold uppercase text-white/40 tracking-wider">{booking.paymentMethod || 'BKASH'}</p>
                <span className="text-[8px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">VERIFIED</span>
              </div>
              <p className="text-xs font-extrabold text-white font-mono truncate mt-0.5">
                TRX: <span className="text-cyan-300">{booking.trxDigit || 'N/A'}</span>
              </p>
            </div>
          </div>

          {/* PHONE / WHATSAPP */}
          <div className="bg-[#121826] border border-white/10 rounded-2xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/30">
                <Smartphone size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-bold uppercase text-white/40 tracking-wider">WHATSAPP / PHONE</p>
                <p className="text-xs font-black text-white font-mono truncate">{booking.whatsappNumber || booking.senderNumber || 'N/A'}</p>
              </div>
            </div>
            <span className="text-[8px] font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/20 shrink-0">SAFE</span>
          </div>

          {/* Bottom Receipt Stamp */}
          <div className="border-t border-dashed border-white/15 pt-3 pb-1 flex items-center justify-between text-[10px] text-white/50">
            <div className="flex items-center gap-1.5 text-cyan-400 font-bold">
              <CheckCircle2 size={14} /> OFFICIAL DIGITAL RECEIPT
            </div>
            <span className="font-mono text-[9px] text-white/40">UNITY EARNING PLATFORM</span>
          </div>
        </motion.div>

        {/* Success Toast */}
        {downloadSuccess && (
          <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold py-2 px-3 rounded-xl text-center flex items-center justify-center gap-2">
            <CheckCircle2 size={16} /> রসিদ সফলভাবে ডাউনলোড হয়েছে! (Downloaded!)
          </motion.div>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2.5">
          <button
            onClick={onClose}
            className="py-3.5 bg-[#121826] hover:bg-[#1a2336] border border-white/10 text-white font-bold text-xs rounded-2xl transition-all flex items-center justify-center gap-1.5 active:scale-98"
          >
            <XCircle size={18} className="text-white/60" /> CLOSE (বন্ধ করুন)
          </button>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="py-3.5 bg-gradient-to-r from-blue-600 via-cyan-500 to-teal-400 hover:opacity-95 text-white font-black text-xs rounded-2xl shadow-xl shadow-cyan-500/30 transition-all flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50"
          >
            {downloading ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                প্রসেসিং...
              </>
            ) : (
              <>
                <Download size={18} /> ডাউনলোড (DOWNLOAD)
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Seat Booking Form Modal ---

function SeatBookingModal({ 
  member, sender, onClose, onSuccessSubmitted, onOpenHistory 
}: { 
  member: TeamMember, 
  sender: UserProfile | null, 
  onClose: () => void,
  onSuccessSubmitted: (req: RequestData) => void,
  onOpenHistory: () => void
}) {
  const [fullName, setFullName] = useState(sender?.name || '');
  const [amount, setAmount] = useState('');
  const [trxDigit, setTrxDigit] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'BKASH' | 'NAGAD' | 'ROCKET' | 'CASH'>('BKASH');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !whatsappNumber || !amount) return;
    setLoading(true);
    const generatedRef = `#UE-${Math.floor(10000 + Math.random() * 90000)}`;

    try {
      const docRef = await addDoc(collection(db, 'requests'), {
        refId: generatedRef,
        type: 'seat_booking',
        senderId: sender?.uid || 'guest',
        senderName: fullName,
        senderNumber: whatsappNumber,
        senderRole: sender?.role || 'user',
        recipientName: member.name,
        recipientNumber: member.number || '',
        amount: Number(amount),
        trxDigit: trxDigit || '',
        whatsappNumber: whatsappNumber,
        paymentMethod: paymentMethod,
        note: `Seat Booking via ${paymentMethod}`,
        status: 'pending',
        createdAt: serverTimestamp()
      });

      // Save request ID to local storage so user history shows it!
      saveMySubmittedRequestId(docRef.id);

      const createdReq: RequestData = {
        id: docRef.id,
        refId: generatedRef,
        type: 'seat_booking',
        senderId: sender?.uid || 'guest',
        senderName: fullName,
        senderNumber: whatsappNumber,
        senderRole: sender?.role || 'user',
        recipientName: member.name,
        amount: Number(amount),
        trxDigit: trxDigit || '',
        whatsappNumber: whatsappNumber,
        paymentMethod: paymentMethod,
        status: 'pending',
        createdAt: new Date()
      };

      onSuccessSubmitted(createdReq);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'requests');
    } finally {
      setLoading(false);
    }
  };

  const isLeader = member.role === 'leader';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/80 backdrop-blur-md" 
      />
      <motion.div 
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        className="relative w-full max-w-sm bg-[#0a0d14] border border-[#1e293b] rounded-3xl p-5 shadow-2xl my-auto z-10 flex flex-col gap-4 overflow-hidden"
      >
        {/* Top Glow bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-cyan-400 to-blue-500" />

        {/* Form Header */}
        <div className="text-center space-y-1 pt-2">
          <div className="w-10 h-10 rounded-2xl bg-[#111827] border border-cyan-500/30 text-cyan-400 flex items-center justify-center mx-auto shadow-[0_0_15px_rgba(6,182,212,0.15)]">
            <Shield size={22} />
          </div>
          <h2 className="text-xs font-black tracking-widest text-cyan-400 uppercase">
            UNITY EARNING ENROLLMENT
          </h2>
          <h1 className="text-xl font-black text-white tracking-wide">
            SEAT BOOKING
          </h1>
          <p className="text-[11px] font-semibold text-white/50">
            ( সিট বুকিং ফর্ম )
          </p>
        </div>

        {/* Selected Member Header Card */}
        <div className="bg-[#111827] border border-white/10 rounded-2xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MemberDesignBadge name={member.name} role={member.role} size="md" />
            <div>
              <p className={`text-[9px] uppercase font-bold tracking-wider ${isLeader ? 'text-indigo-400' : 'text-emerald-400'}`}>
                {isLeader ? 'TEAM LEADER' : 'TEAM TRAINER'}
              </p>
              <h3 className="text-sm font-extrabold text-white">{member.name}</h3>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg text-white/40 hover:text-white transition-colors">
            <XCircle size={18} />
          </button>
        </div>

        {/* Form Fields */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Full Name */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-white/60 flex items-center gap-1.5 pl-1">
              <UserIcon size={12} className="text-cyan-400" /> YOUR FULL NAME
            </label>
            <input 
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Enter full name"
              className="w-full bg-[#111827] border border-white/10 rounded-xl py-3 px-4 text-xs font-semibold text-white focus:outline-none focus:border-cyan-500/60 transition-all shadow-inner"
            />
          </div>

          {/* Amount & Trx Digit Row */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-white/60 flex items-center gap-1.5 pl-1">
                <Banknote size={12} className="text-cyan-400" /> Amount
              </label>
              <input 
                type="number"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-[#111827] border border-white/10 rounded-xl py-3 px-3 text-xs font-semibold text-white focus:outline-none focus:border-cyan-500/60 transition-all shadow-inner font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-white/60 flex items-center gap-1.5 pl-1">
                <Send size={12} className="text-cyan-400" /> Trx Digit
              </label>
              <input 
                type="text"
                value={trxDigit}
                onChange={(e) => setTrxDigit(e.target.value)}
                placeholder="Trx ID"
                className="w-full bg-[#111827] border border-white/10 rounded-xl py-3 px-3 text-xs font-semibold text-white focus:outline-none focus:border-cyan-500/60 transition-all shadow-inner font-mono"
              />
            </div>
          </div>

          {/* WhatsApp Number */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-white/60 flex items-center gap-1.5 pl-1">
              <Smartphone size={12} className="text-cyan-400" /> WhatsApp Number
            </label>
            <input 
              type="tel"
              required
              value={whatsappNumber}
              onChange={(e) => setWhatsappNumber(e.target.value)}
              placeholder="017xxxxxxxx"
              className="w-full bg-[#111827] border border-white/10 rounded-xl py-3 px-4 text-xs font-semibold text-white focus:outline-none focus:border-cyan-500/60 transition-all shadow-inner font-mono"
            />
          </div>

          {/* Payment Method Selectors */}
          <div className="space-y-1.5 pt-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-white/50 pl-1">Payment Method</label>
            <div className="grid grid-cols-4 gap-1.5">
              {(['BKASH', 'NAGAD', 'ROCKET', 'CASH'] as const).map(method => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setPaymentMethod(method)}
                  className={`py-2 rounded-xl text-[10px] font-black transition-all border ${
                    paymentMethod === method 
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.3)]' 
                      : 'bg-[#111827] text-white/50 border-white/5 hover:bg-white/5'
                  }`}
                >
                  {method}
                </button>
              ))}
            </div>
          </div>

          {/* Reserve Seat Action Button */}
          <button 
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-gradient-to-r from-blue-600 via-cyan-500 to-teal-400 hover:opacity-95 disabled:opacity-50 text-white rounded-xl font-extrabold text-sm tracking-widest uppercase shadow-lg shadow-cyan-500/25 transition-all mt-4 active:scale-98 flex items-center justify-center gap-2"
          >
            {loading ? 'Processing...' : TRANSLATIONS.RESERVE_SEAT}
          </button>
        </form>

        {/* Bottom Tab Options inside Modal */}
        <div className="flex bg-[#111827] p-1 rounded-2xl border border-white/5 mt-1">
          <button 
            type="button"
            className="flex-1 py-2 rounded-xl text-xs font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 flex items-center justify-center gap-1.5 shadow-sm"
          >
            <Sparkles size={14} /> Booking
          </button>
          <button 
            type="button"
            onClick={onOpenHistory}
            className="flex-1 py-2 rounded-xl text-xs font-bold text-white/50 hover:text-white flex items-center justify-center gap-1.5 transition-colors"
          >
            <HistoryIcon size={14} /> My History
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// --- Redesigned Withdraw Form Modal ---

function WithdrawModal({ 
  member, sender, onClose, onOpenHistory 
}: { 
  member: TeamMember, 
  sender: UserProfile | null, 
  onClose: () => void,
  onOpenHistory: () => void
}) {
  const [senderName, setSenderName] = useState(sender?.name || '');
  const [senderNumber, setSenderNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'BKASH' | 'NAGAD' | 'ROCKET' | 'CASH'>('BKASH');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!senderName || !senderNumber || !amount) return;
    setLoading(true);
    try {
      const docRef = await addDoc(collection(db, 'requests'), {
        type: 'withdraw',
        senderId: sender?.uid || 'guest',
        senderName: senderName,
        senderNumber: senderNumber,
        senderRole: sender?.role || 'user',
        recipientName: member.name,
        recipientNumber: member.number || '',
        amount: Number(amount),
        paymentMethod: paymentMethod,
        note: note,
        status: 'pending',
        createdAt: serverTimestamp()
      });

      // Save to local storage for user history isolation
      saveMySubmittedRequestId(docRef.id);

      setSubmitted(true);
      setTimeout(onClose, 2000);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'requests');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
        <GlassCard className="p-10 text-center space-y-4 max-w-xs mx-auto">
          <CheckCircle2 size={56} className="text-emerald-400 mx-auto animate-bounce" />
          <h2 className="text-xl font-bold text-white">{TRANSLATIONS.SUCCESS_SUBMIT}</h2>
          <p className="text-xs text-white/60">Withdrawal request successfully sent to Admin.</p>
        </GlassCard>
      </div>
    );
  }

  const isLeader = member.role === 'leader';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/80 backdrop-blur-md" 
      />
      <motion.div 
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        className="relative w-full max-w-sm bg-[#0e1017] rounded-3xl p-5 border border-indigo-500/30 shadow-2xl my-auto z-10 flex flex-col gap-4 overflow-hidden"
      >
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-3">
            <MemberDesignBadge name={member.name} role={member.role} size="md" />
            <div>
              <p className="text-[9px] font-extrabold uppercase tracking-widest text-indigo-400">WITHDRAWAL REQUEST</p>
              <h3 className="text-base font-extrabold text-white">{member.name}</h3>
            </div>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white"><XCircle size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-white/60 pl-1">{TRANSLATIONS.NAME} *</label>
            <input 
              type="text" 
              required
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              placeholder="Your Full Name"
              className="w-full bg-[#181a24] border border-white/10 rounded-xl py-3 px-4 text-xs font-semibold text-white focus:outline-none focus:border-indigo-500/60"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-white/60 pl-1">{TRANSLATIONS.NUMBER} *</label>
              <input 
                type="tel" 
                required
                value={senderNumber}
                onChange={(e) => setSenderNumber(e.target.value)}
                placeholder="Phone / bKash"
                className="w-full bg-[#181a24] border border-white/10 rounded-xl py-3 px-3 text-xs font-semibold text-white focus:outline-none focus:border-indigo-500/60 font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-white/60 pl-1">{TRANSLATIONS.AMOUNT} *</label>
              <input 
                type="number" 
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-[#181a24] border border-white/10 rounded-xl py-3 px-3 text-xs font-semibold text-white focus:outline-none focus:border-indigo-500/60 font-mono"
              />
            </div>
          </div>

          {/* Payment Method */}
          <div className="space-y-1.5 pt-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-white/50 pl-1">Payment Method</label>
            <div className="grid grid-cols-4 gap-1.5">
              {(['BKASH', 'NAGAD', 'ROCKET', 'CASH'] as const).map(method => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setPaymentMethod(method)}
                  className={`py-2 rounded-xl text-[10px] font-black transition-all border ${
                    paymentMethod === method 
                      ? 'bg-indigo-500/20 text-indigo-300 border-indigo-400 shadow-[0_0_10px_rgba(99,102,241,0.3)]' 
                      : 'bg-[#181a24] text-white/50 border-white/5 hover:bg-white/5'
                  }`}
                >
                  {method}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-white/60 pl-1">{TRANSLATIONS.NOTE}</label>
            <textarea 
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Withdraw details / reference..."
              rows={2}
              className="w-full bg-[#181a24] border border-white/10 rounded-xl py-2.5 px-4 text-xs font-semibold text-white focus:outline-none focus:border-indigo-500/60 resize-none"
            />
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:opacity-95 disabled:opacity-50 text-white rounded-xl font-extrabold text-xs uppercase tracking-wider shadow-lg shadow-indigo-600/20 transition-all mt-2 active:scale-98"
          >
            {loading ? 'Submitting...' : 'Submit Withdraw Request'}
          </button>
        </form>

        {/* Bottom Tab Options */}
        <div className="flex bg-[#181a24] p-1 rounded-2xl border border-white/5 mt-1">
          <button 
            type="button"
            className="flex-1 py-2 rounded-xl text-xs font-bold bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 flex items-center justify-center gap-1.5 shadow-sm"
          >
            <Banknote size={14} /> Withdraw
          </button>
          <button 
            type="button"
            onClick={onOpenHistory}
            className="flex-1 py-2 rounded-xl text-xs font-bold text-white/50 hover:text-white flex items-center justify-center gap-1.5 transition-colors"
          >
            <HistoryIcon size={14} /> My History
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// --- Isolated User History Modal ---

function HistoryModal({ 
  user, activeMember, history, onClose, onOpenBooking, onSelectInvoice, onSelectSureShotInvoice
}: { 
  user: UserProfile | null,
  activeMember?: TeamMember | null,
  history: RequestData[], 
  onClose: () => void,
  onOpenBooking?: () => void,
  onSelectInvoice?: (req: RequestData) => void,
  onSelectSureShotInvoice?: (req: RequestData) => void
}) {
  const [subTab, setSubTab] = useState<'seat_booking' | 'sure_shot' | 'withdraw'>('seat_booking');

  // Strict user isolation: show requests created for this specific active member account or on this device
  const mySubmittedIds = getMySubmittedRequestIds();
  const userFiltered = history.filter(req => {
    if (activeMember) {
      const targetName = activeMember.name.trim().toLowerCase();
      const matchRecipient = req.recipientName && req.recipientName.trim().toLowerCase() === targetName;
      const matchLeader = req.counselorLeader && req.counselorLeader.trim().toLowerCase() === targetName;
      const matchMemberUid = req.submittedByUid === activeMember.id;
      return matchRecipient || matchLeader || matchMemberUid;
    }
    return mySubmittedIds.includes(req.id) || (user && req.senderId === user.uid);
  });

  const seatBookings = userFiltered.filter(h => h.type === 'seat_booking');
  const sureShotBookings = userFiltered.filter(h => h.type === 'sure_shot');
  const withdraws = userFiltered.filter(h => h.type === 'withdraw' || (!h.type && h.amount > 0));
  
  const filteredHistory = subTab === 'seat_booking' 
    ? seatBookings 
    : subTab === 'sure_shot' 
      ? sureShotBookings 
      : withdraws;

  const getPaymentBrandStyle = (method?: string) => {
    const m = (method || '').toUpperCase();
    if (m === 'BKASH') return 'bg-pink-500/15 text-pink-300 border-pink-500/30';
    if (m === 'NAGAD') return 'bg-orange-500/15 text-orange-300 border-orange-500/30';
    if (m === 'ROCKET') return 'bg-purple-500/15 text-purple-300 border-purple-500/30';
    return 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/85 backdrop-blur-md" 
      />
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        className="relative w-full max-w-sm h-[85vh] bg-[#0c0f17] rounded-3xl p-5 border border-white/10 shadow-2xl flex flex-col z-10 my-auto overflow-hidden"
      >
        {/* Top Glow Accent Bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-amber-500 to-purple-500" />

        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10 pt-1">
          <div>
            <h2 className="text-base font-black text-white flex items-center gap-2">
              <HistoryIcon className="text-cyan-400" size={20} />
              অনুরোধের ইতিহাস
            </h2>
            <p className="text-[10px] text-white/50 font-medium">My Request History & Statements</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 text-white/50 hover:text-white rounded-xl transition-colors">
            <XCircle size={22} />
          </button>
        </div>

        {/* Section Segment Tabs: 3 Tabs (Seat, Sure Shot, Withdraw) */}
        <div className="grid grid-cols-3 bg-[#121622] p-1 rounded-2xl border border-white/10 my-3 gap-1">
          <button 
            onClick={() => setSubTab('seat_booking')}
            className={`py-2 rounded-xl text-[11px] font-black transition-all flex items-center justify-center gap-1 ${
              subTab === 'seat_booking' 
                ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm' 
                : 'text-white/40 hover:text-white'
            }`}
          >
            <Sparkles size={12} />
            Seat ({seatBookings.length})
          </button>
          <button 
            onClick={() => setSubTab('sure_shot')}
            className={`py-2 rounded-xl text-[11px] font-black transition-all flex items-center justify-center gap-1 ${
              subTab === 'sure_shot' 
                ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-300 border border-amber-500/40 shadow-sm' 
                : 'text-white/40 hover:text-white'
            }`}
          >
            <Zap size={12} />
            Sure Shot ({sureShotBookings.length})
          </button>
          <button 
            onClick={() => setSubTab('withdraw')}
            className={`py-2 rounded-xl text-[11px] font-black transition-all flex items-center justify-center gap-1 ${
              subTab === 'withdraw' 
                ? 'bg-gradient-to-r from-indigo-500/20 to-purple-500/20 text-indigo-300 border border-indigo-500/40 shadow-sm' 
                : 'text-white/40 hover:text-white'
            }`}
          >
            <Banknote size={12} />
            Withdraw ({withdraws.length})
          </button>
        </div>

        {/* History Item List */}
        <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 custom-scrollbar">
          {filteredHistory.map(req => {
            const formattedDate = req.createdAt?.toDate 
              ? req.createdAt.toDate().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
              : 'Just now';

            // Custom Card for Sure Shot Pre-Booking
            if (req.type === 'sure_shot') {
              return (
                <div key={req.id} className="bg-[#121622] p-4 rounded-2xl border border-amber-500/20 space-y-3 shadow-md hover:border-amber-500/40 transition-all">
                  {/* Top Badge Row */}
                  <div className="flex items-center justify-between pb-2 border-b border-white/5 flex-wrap gap-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] font-black uppercase text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded-md border border-amber-500/30 flex items-center gap-1">
                        <Zap size={10} /> Sure Shot Pre-Booking
                      </span>
                      <span className="text-[9px] font-black px-2 py-0.5 rounded-md bg-white/10 text-white border border-white/10">
                        বুকিং #{req.bookingSequence || 1}
                      </span>
                    </div>
                    <Badge status={req.status || 'pending'} />
                  </div>

                  {/* 6-Hour Live Reverse Countdown Timer */}
                  <div className="flex items-center justify-between bg-[#0a0d14] p-2.5 rounded-xl border border-amber-500/20">
                    <span className="text-[10px] uppercase font-bold text-amber-300/80">পেমেন্ট বাকি সময়:</span>
                    <CountdownTimer createdAt={req.createdAt} expiresAt={req.expiresAt} variant="compact" />
                  </div>

                  {/* Main Info Box */}
                  <div className="flex justify-between items-start gap-2">
                    <div className="space-y-1 min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">
                        TRAINER / LEADER (কাউন্সেলর / ট্রেইনার)
                      </p>
                      <h3 className="font-extrabold text-white text-sm truncate">{req.recipientName || 'N/A'}</h3>
                      
                      {req.senderName && (
                        <p className="text-xs text-white/70">
                          Candidate: <strong className="text-amber-300">{req.senderName}</strong>
                        </p>
                      )}
                      <p className="text-[10px] text-white/40 font-mono flex items-center gap-1">
                        <Clock size={11} className="text-white/30" /> {formattedDate}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">BOOKING ID</p>
                      <p className="font-mono font-black text-xs text-amber-400">{req.refId}</p>
                    </div>
                  </div>

                  {/* Invoice View Button */}
                  {onSelectSureShotInvoice && (
                    <button
                      onClick={() => onSelectSureShotInvoice(req)}
                      className="w-full py-2.5 bg-gradient-to-r from-amber-500/15 via-orange-500/15 to-amber-500/15 hover:from-amber-500/25 hover:to-orange-500/25 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 active:scale-98 shadow-sm"
                    >
                      <FileText size={15} /> View & Download Invoice (ইনভয়েস দেখুন ও ডাউনলোড)
                    </button>
                  )}
                </div>
              );
            }

            return (
              <div key={req.id} className="bg-[#121622] p-4 rounded-2xl border border-white/10 space-y-3 shadow-md hover:border-white/20 transition-all">
                {/* Top Badge Row */}
                <div className="flex items-center justify-between pb-2 border-b border-white/5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-black uppercase text-white/50 bg-white/5 px-2 py-0.5 rounded-md border border-white/5">
                      {req.type === 'seat_booking' ? 'Seat Book' : 'Withdrawal'}
                    </span>
                    {req.paymentMethod && (
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-md border ${getPaymentBrandStyle(req.paymentMethod)}`}>
                        {req.paymentMethod}
                      </span>
                    )}
                  </div>
                  <Badge status={req.status || 'pending'} />
                </div>

                {/* Main Info Box */}
                <div className="flex justify-between items-start gap-2">
                  <div className="space-y-1 min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">
                      COUNSELOR / LEADER (কাউন্সেলর)
                    </p>
                    <h3 className="font-extrabold text-white text-sm truncate">{req.recipientName || 'N/A'}</h3>
                    
                    {req.senderName && (
                      <p className="text-xs text-white/70">
                        Candidate: <strong className="text-cyan-300">{req.senderName}</strong>
                      </p>
                    )}
                    <p className="text-[10px] text-white/40 font-mono flex items-center gap-1">
                      <Clock size={11} className="text-white/30" /> {formattedDate}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">FEE / AMOUNT</p>
                    <p className="font-mono font-black text-base text-emerald-400">৳{req.amount}</p>
                  </div>
                </div>

                {/* Trx & Contact Details Box */}
                {(req.trxDigit || req.whatsappNumber || req.senderNumber) && (
                  <div className="bg-[#0a0d14] p-2.5 rounded-xl text-xs text-white/80 font-mono border border-white/5 grid grid-cols-1 gap-1">
                    {req.trxDigit && (
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-white/50">Trx ID / Digit:</span>
                        <strong className="text-cyan-300 tracking-wider">{req.trxDigit}</strong>
                      </div>
                    )}
                    {(req.whatsappNumber || req.senderNumber) && (
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-white/50">WhatsApp / Phone:</span>
                        <strong className="text-emerald-300">{req.whatsappNumber || req.senderNumber}</strong>
                      </div>
                    )}
                  </div>
                )}

                {req.note && (
                  <p className="text-xs text-white/70 italic bg-[#0a0d14] p-2.5 rounded-xl border border-white/5">
                    "{req.note}"
                  </p>
                )}

                {/* Receipt Trigger Button */}
                {req.type === 'seat_booking' && onSelectInvoice && (
                  <button
                    onClick={() => onSelectInvoice(req)}
                    className="w-full py-2.5 bg-gradient-to-r from-cyan-500/15 to-blue-500/15 hover:from-cyan-500/25 hover:to-blue-500/25 text-cyan-300 border border-cyan-500/30 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 active:scale-98 shadow-sm"
                  >
                    <FileText size={15} /> View & Download Invoice Receipt (ইনভয়েস দেখুন)
                  </button>
                )}
              </div>
            );
          })}

          {filteredHistory.length === 0 && (
            <div className="text-center py-16 text-white/30 text-xs space-y-2">
              <HistoryIcon size={40} className="mx-auto text-white/20" />
              <p className="font-bold text-white/40">কোন রেকর্ড পাওয়া যায়নি (No Records Found)</p>
              <p className="text-[11px] text-white/30">
                Your {subTab === 'seat_booking' ? 'seat booking' : subTab === 'sure_shot' ? 'sure shot pre-booking' : 'withdraw'} requests will appear here
              </p>
            </div>
          )}
        </div>

        {/* Bottom Close Button */}
        <div className="pt-3 border-t border-white/10 mt-auto">
          <button 
            type="button"
            onClick={onClose}
            className="w-full py-3 bg-[#121622] hover:bg-[#1a1f30] text-white font-extrabold text-xs rounded-2xl border border-white/10 transition-colors flex items-center justify-center gap-2"
          >
            <XCircle size={16} className="text-white/50" /> CLOSE (বন্ধ করুন)
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// --- Admin Dashboard ---

function AdminDashboard({ 
  user, onLogout, notifications, showNotifications, setShowNotifications, onUserView, appLogoUrl 
}: { 
  user: UserProfile, 
  onLogout: () => void, 
  notifications: RequestData[],
  showNotifications: boolean,
  setShowNotifications: (s: boolean) => void,
  onUserView: () => void,
  appLogoUrl?: string,
  key?: string
}) {
  const [activeTab, setActiveTab] = useState<'seat_booking' | 'sure_shot' | 'withdraw' | 'members' | 'settings'>('seat_booking');
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [showAddMember, setShowAddMember] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [memberTab, setMemberTab] = useState<'leader' | 'trainer'>('leader');

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'teamMembers'), 
      (snapshot) => {
        setMembers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TeamMember)));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'teamMembers')
    );
    return () => unsubscribe();
  }, []);

  const pendingCount = notifications.filter(n => n.status === 'pending').length;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col gap-5">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center overflow-hidden">
            {appLogoUrl ? (
              <img src={appLogoUrl} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              <ShieldCheck size={20} />
            )}
          </div>
          <h2 className="text-xl font-extrabold text-white">Admin Panel</h2>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2.5 bg-[#18181b] hover:bg-[#27272a] border border-white/10 rounded-xl relative transition-colors text-white/80"
          >
            <Bell size={20} />
            {pendingCount > 0 && (
              <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(244,63,94,0.6)]" />
            )}
          </button>
          <button onClick={onUserView} className="p-2.5 bg-[#18181b] hover:bg-[#27272a] border border-white/10 rounded-xl transition-colors text-emerald-400">
            <UserIcon size={20} />
          </button>
          <button onClick={onLogout} className="p-2.5 bg-[#18181b] hover:bg-[#27272a] border border-white/10 rounded-xl transition-colors text-white/80">
            <LogOut size={20} />
          </button>
        </div>
      </header>

      {/* Admin Sub-Navigation: 5 Tabs */}
      <div className="grid grid-cols-5 bg-[#18181b] p-1 rounded-2xl border border-white/5 text-[10px] sm:text-[11px] font-bold">
        <button 
          onClick={() => setActiveTab('seat_booking')}
          className={`py-2 rounded-xl transition-all ${activeTab === 'seat_booking' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-white/60 hover:text-white'}`}
        >
          Seat Book
        </button>
        <button 
          onClick={() => setActiveTab('sure_shot')}
          className={`py-2 rounded-xl transition-all ${activeTab === 'sure_shot' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'text-white/60 hover:text-white'}`}
        >
          Sure Shot
        </button>
        <button 
          onClick={() => setActiveTab('withdraw')}
          className={`py-2 rounded-xl transition-all ${activeTab === 'withdraw' ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'text-white/60 hover:text-white'}`}
        >
          Withdraw
        </button>
        <button 
          onClick={() => setActiveTab('members')}
          className={`py-2 rounded-xl transition-all ${activeTab === 'members' ? 'bg-white/10 text-white shadow-sm' : 'text-white/60 hover:text-white'}`}
        >
          Members
        </button>
        <button 
          onClick={() => setActiveTab('settings')}
          className={`py-2 rounded-xl transition-all ${activeTab === 'settings' ? 'bg-white/10 text-white shadow-sm' : 'text-white/60 hover:text-white'}`}
        >
          Settings
        </button>
      </div>

      <div className="flex-1">
        {activeTab === 'seat_booking' && <AdminRequestsView requestType="seat_booking" />}
        {activeTab === 'sure_shot' && <AdminSureShotView />}
        {activeTab === 'withdraw' && <AdminRequestsView requestType="withdraw" />}

        {activeTab === 'members' && (
          <div className="space-y-5">
            <motion.button 
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => setShowAddMember(true)}
              className="w-full py-4 bg-[#18181b] border border-white/10 hover:border-white/20 hover:bg-[#27272a] rounded-2xl text-white/80 hover:text-white transition-all flex items-center justify-center gap-2 font-semibold shadow-sm"
            >
              <Plus size={20} />
              {TRANSLATIONS.ADD_MEMBER}
            </motion.button>

            <div className="flex bg-[#18181b] p-1 rounded-xl border border-white/5">
              <button 
                onClick={() => setMemberTab('leader')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${memberTab === 'leader' ? 'bg-white/10 text-white shadow-sm' : 'text-white/40 hover:text-white/70'}`}
              >
                {TRANSLATIONS.TEAM_LEADER}
              </button>
              <button 
                onClick={() => setMemberTab('trainer')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${memberTab === 'trainer' ? 'bg-white/10 text-white shadow-sm' : 'text-white/40 hover:text-white/70'}`}
              >
                {TRANSLATIONS.TEAM_TRAINER}
              </button>
            </div>
            
            <div className="space-y-3">
              {members.filter(m => m.role === memberTab).map(member => (
                <div key={member.id} className="bg-[#18181b] p-3.5 rounded-2xl border border-white/5 flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <MemberDesignBadge name={member.name} role={member.role} size="md" />
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-sm text-white/90 truncate">{member.name}</h3>
                      <p className="text-[10px] text-indigo-400 font-mono">PIN: {member.pin || '1234'}</p>
                    </div>
                  </div>
                  <div className="flex gap-1.5 shrink-0 ml-2">
                    <button 
                      type="button"
                      onClick={() => setEditingMember(member)}
                      className="p-2 flex items-center justify-center rounded-xl bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition-all"
                      title="Edit Member & PIN"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      type="button"
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (!window.confirm("Delete this member?")) return;
                        try {
                          await deleteDoc(doc(db, 'teamMembers', member.id));
                        } catch (err) {
                          console.error(err);
                        }
                      }}
                      className="p-2 flex items-center justify-center rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-all"
                      title="Delete Member"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
              {members.filter(m => m.role === memberTab).length === 0 && (
                <div className="text-center py-12 bg-[#18181b] rounded-2xl border border-dashed border-white/10 text-white/30">
                  <Users size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="text-xs font-medium">No {memberTab}s added yet</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'settings' && <AdminSettingsView requests={notifications} initialLogoUrl={appLogoUrl} />}
      </div>

      <AnimatePresence>
        {showAddMember && (
          <AddMemberModal 
            role={memberTab}
            onClose={() => setShowAddMember(false)} 
          />
        )}
        {editingMember && (
          <EditMemberModal 
            member={editingMember}
            onClose={() => setEditingMember(null)} 
          />
        )}
        {showNotifications && (
          <NotificationCenter 
            notifications={notifications} 
            onClose={() => setShowNotifications(false)} 
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// --- Admin Sure Shot Pre-Booking Management View ---

function AdminSureShotView() {
  const [requests, setRequests] = useState<RequestData[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'pending' | 'confirmed' | 'rejected'>('pending');
  const [loadingId, setLoadingId] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'requests'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      q, 
      (snapshot) => {
        const all = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RequestData));
        setRequests(all.filter(r => r.type === 'sure_shot'));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'requests')
    );
    return () => unsubscribe();
  }, []);

  // Auto-delete requests older than 6 hours
  useEffect(() => {
    const autoPurge = async () => {
      const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
      const now = Date.now();
      for (const req of requests) {
        const createdMs = getTimestampMs(req.createdAt);
        if (now - createdMs >= SIX_HOURS_MS) {
          try {
            await deleteDoc(doc(db, 'requests', req.id));
          } catch (e) {
            console.error('Failed to purge expired sure shot:', e);
          }
        }
      }
    };
    autoPurge();
    const interval = setInterval(autoPurge, 15000);
    return () => clearInterval(interval);
  }, [requests]);

  const handleUpdateStatus = async (id: string, newStatus: 'confirmed' | 'rejected') => {
    if (loadingId) return;
    setLoadingId(id);
    try {
      await updateDoc(doc(db, 'requests', id), {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
    } catch (err: any) {
      console.error(err);
      alert('Error updating status: ' + err.message);
    } finally {
      setLoadingId(null);
    }
  };

  const handleDeleteRequest = async (id: string) => {
    if (!window.confirm(TRANSLATIONS.CONFIRM_DELETE)) return;
    try {
      await deleteDoc(doc(db, 'requests', id));
    } catch (err) {
      console.error(err);
    }
  };

  // Filter by Date if selected
  const dateFiltered = selectedDate 
    ? requests.filter(req => {
        if (!req.createdAt?.toDate) return false;
        const reqDate = req.createdAt.toDate().toISOString().split('T')[0];
        return reqDate === selectedDate;
      })
    : requests;

  // Filter by Status (pending / confirmed / rejected)
  const finalFiltered = dateFiltered.filter(r => r.status === statusFilter);

  return (
    <div className="space-y-4">
      {/* Date Picker Bar */}
      <div className="bg-[#18181b] p-3 rounded-2xl border border-white/5 space-y-2">
        <div className="flex items-center justify-between text-xs font-bold text-white/70">
          <span className="flex items-center gap-1.5 text-amber-400">
            <Calendar size={16} /> Filter by Date (তারিখ অনুযায়ী ফিল্টার)
          </span>
          {selectedDate && (
            <button 
              onClick={() => setSelectedDate('')}
              className="text-[10px] text-white/40 hover:text-white underline shrink-0"
            >
              All Dates
            </button>
          )}
        </div>
        <input 
          type="date" 
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="w-full bg-[#09090b] border border-white/10 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:border-amber-500/50"
        />
      </div>

      {/* Status Filters: Pending, Confirmed, Rejected */}
      <div className="flex bg-[#18181b] p-1 rounded-2xl border border-white/5 text-[11px] font-bold">
        {(['pending', 'confirmed', 'rejected'] as const).map(st => (
          <button 
            key={st}
            onClick={() => setStatusFilter(st)}
            className={`flex-1 py-2 rounded-xl capitalize transition-all ${
              statusFilter === st 
                ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-300 border border-amber-500/40 shadow-sm font-black' 
                : 'text-white/40 hover:text-white'
            }`}
          >
            {st === 'pending' ? 'পেন্ডিং (Pending)' : st === 'confirmed' ? 'কনফার্ম (Confirmed)' : 'রিজেক্ট (Rejected)'} ({dateFiltered.filter(r => r.status === st).length})
          </button>
        ))}
      </div>

      {/* Requests List */}
      <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1 custom-scrollbar">
        {finalFiltered.map(req => (
          <div key={req.id} className="bg-[#18181b] p-3 rounded-2xl border border-white/10 hover:border-amber-500/30 transition-all space-y-2.5 shadow-sm">
            {/* Top Row: Member & Booking Info + Timer */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/25">
                  <Zap size={16} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h4 className="font-bold text-white text-xs truncate">{req.recipientName}</h4>
                    <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      #{req.bookingSequence || 1}
                    </span>
                    <Badge status={req.status} />
                  </div>
                  <p className="text-[10px] text-white/40 font-mono">
                    {req.refId} • {req.createdAt?.toDate ? req.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                  </p>
                </div>
              </div>

              {/* Live Timer with Red (Lock) & Green (Active) indicator */}
              <div className="shrink-0">
                <CountdownTimer createdAt={req.createdAt} expiresAt={req.expiresAt} variant="admin" />
              </div>
            </div>

            {/* Actions Row */}
            <div className="flex items-center justify-end gap-1.5 pt-1.5 border-t border-white/5">
              {req.status === 'pending' && (
                <>
                  <button
                    onClick={() => handleUpdateStatus(req.id, 'confirmed')}
                    disabled={loadingId === req.id}
                    className="px-3 py-1.5 bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 shadow-sm"
                  >
                    <CheckCircle2 size={13} /> Confirm
                  </button>
                  <button
                    onClick={() => handleUpdateStatus(req.id, 'rejected')}
                    disabled={loadingId === req.id}
                    className="px-2.5 py-1.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1"
                  >
                    <XCircle size={13} /> Reject
                  </button>
                </>
              )}
              {req.status === 'confirmed' && (
                <button
                  onClick={() => handleUpdateStatus(req.id, 'rejected')}
                  disabled={loadingId === req.id}
                  className="px-2.5 py-1.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1"
                >
                  <XCircle size={13} /> Reject
                </button>
              )}
              <button
                onClick={() => handleDeleteRequest(req.id)}
                className="p-1.5 text-white/30 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors ml-auto"
                title="Delete"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}

        {finalFiltered.length === 0 && (
          <div className="text-center py-16 text-white/20 text-xs space-y-1">
            <Zap size={32} className="mx-auto mb-1 opacity-20" />
            <p>কোন শিউরশট প্রি-বুকিং পাওয়া যায়নি (No Sure Shot Bookings Found)</p>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Admin Requests Management with Date Filter & Stage Workflow ---

function AdminRequestsView({ requestType }: { requestType: 'seat_booking' | 'withdraw' }) {
  const [requests, setRequests] = useState<RequestData[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'pending' | 'accepted' | 'confirmed' | 'rejected'>('pending');
  const [loadingId, setLoadingId] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'requests'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      q, 
      (snapshot) => {
        const all = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RequestData));
        setRequests(all.filter(r => (r.type || 'withdraw') === requestType));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'requests')
    );
    return () => unsubscribe();
  }, [requestType]);

  const handleUpdateStatus = async (id: string, newStatus: 'accepted' | 'confirmed' | 'rejected') => {
    if (loadingId) return;
    setLoadingId(id);
    try {
      await updateDoc(doc(db, 'requests', id), {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
    } catch (err: any) {
      console.error(err);
      alert('Error updating status: ' + err.message);
    } finally {
      setLoadingId(null);
    }
  };

  const handleDeleteRequest = async (id: string) => {
    if (!window.confirm(TRANSLATIONS.CONFIRM_DELETE)) return;
    try {
      await deleteDoc(doc(db, 'requests', id));
    } catch (err) {
      console.error(err);
    }
  };

  const handleClearCategoryRequests = async () => {
    const sectionName = requestType === 'seat_booking' ? 'Seat Booking (সিট বুকিং)' : 'Withdraw (উইথড্র)';
    if (!window.confirm(`আপনি কি নিশ্চিত যে ${sectionName}-এর সকল রিকোয়েস্ট স্থায়ীভাবে মুছে ফেলতে চান? (Clear all ${sectionName} requests?)`)) return;
    
    try {
      for (const req of requests) {
        await deleteDoc(doc(db, 'requests', req.id));
      }
      alert(`${sectionName}-এর সমস্ত রিকোয়েস্ট সফলভাবে ক্লিয়ার করা হয়েছে!`);
    } catch (err) {
      console.error('Error clearing requests:', err);
      alert('ক্লিয়ার করতে সমস্যা হয়েছে।');
    }
  };

  // Filter by Date if selected
  const dateFiltered = selectedDate 
    ? requests.filter(req => {
        if (!req.createdAt?.toDate) return false;
        const reqDate = req.createdAt.toDate().toISOString().split('T')[0];
        return reqDate === selectedDate;
      })
    : requests;

  // Filter by Status
  const finalFiltered = dateFiltered.filter(r => r.status === statusFilter);

  return (
    <div className="space-y-4">
      {/* Date Picker Bar */}
      <div className="bg-[#18181b] p-3 rounded-2xl border border-white/5 space-y-2">
        <div className="flex items-center justify-between text-xs font-bold text-white/70">
          <span className="flex items-center gap-1.5 text-indigo-400">
            <Calendar size={16} /> Filter by Date (তারিখ অনুযায়ী ফিল্টার)
          </span>
          {selectedDate && (
            <button 
              onClick={() => setSelectedDate('')}
              className="text-[10px] text-white/40 hover:text-white underline shrink-0"
            >
              All Dates
            </button>
          )}
        </div>
        <input 
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="w-full bg-[#09090b] border border-white/10 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:border-indigo-500/50"
        />
      </div>

      {/* Status Filter Badges (All option removed as requested) */}
      <div className="flex bg-[#18181b] p-1 rounded-2xl border border-white/5 text-[11px] font-bold">
        {(['pending', 'accepted', 'confirmed', 'rejected'] as const).map(st => (
          <button 
            key={st}
            onClick={() => setStatusFilter(st)}
            className={`flex-1 py-2 rounded-xl capitalize transition-all ${
              statusFilter === st 
                ? 'bg-gradient-to-r from-cyan-500/20 to-indigo-500/20 text-white border border-cyan-500/30 shadow-sm font-black' 
                : 'text-white/40 hover:text-white'
            }`}
          >
            {st === 'pending' ? 'Pending' : st === 'accepted' ? 'Accepted' : st === 'confirmed' ? 'Confirmed' : 'Rejected'} ({dateFiltered.filter(r => r.status === st).length})
          </button>
        ))}
      </div>

      {/* Requests List */}
      <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1 custom-scrollbar">
        {finalFiltered.map(req => (
          <div key={req.id} className="bg-[#18181b] p-4 rounded-2xl border border-white/5 space-y-3 shadow-sm">
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[9px] uppercase font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/20">
                    {req.type === 'seat_booking' ? 'Seat Booking' : 'Withdraw'}
                  </span>
                  {req.paymentMethod && (
                    <span className="text-[9px] font-bold text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded-full">
                      {req.paymentMethod}
                    </span>
                  )}
                </div>
                <h4 className="font-bold text-white text-sm">{req.recipientName}</h4>
                <p className="text-xs text-white/50">From: <strong>{req.senderName}</strong> ({req.senderNumber})</p>
                <p className="text-[10px] text-white/40">
                  {req.createdAt?.toDate ? req.createdAt.toDate().toLocaleString() : 'Just now'}
                </p>
              </div>
              <div className="text-right">
                <p className="font-mono font-bold text-base text-white">৳{req.amount}</p>
                <div className="mt-1">
                  <Badge status={req.status} />
                </div>
              </div>
            </div>

            {/* Trx Digit & WhatsApp info */}
            {req.trxDigit && (
              <div className="bg-[#09090b] p-2.5 rounded-xl text-xs text-white/70 font-mono border border-white/5 flex flex-wrap gap-3 justify-between">
                <span>Trx Digit: <strong className="text-cyan-300">{req.trxDigit}</strong></span>
                {req.whatsappNumber && <span>WhatsApp: <strong>{req.whatsappNumber}</strong></span>}
              </div>
            )}

            {/* Workflow Action Buttons */}
            <div className="flex gap-2 pt-1 border-t border-white/5">
              {req.status === 'pending' && (
                <button
                  onClick={() => handleUpdateStatus(req.id, 'accepted')}
                  disabled={loadingId === req.id}
                  className="flex-1 py-2 bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1"
                >
                  <Check size={14} /> Accept Request
                </button>
              )}
              {req.status === 'accepted' && (
                <button
                  onClick={() => handleUpdateStatus(req.id, 'confirmed')}
                  disabled={loadingId === req.id}
                  className="flex-1 py-2 bg-rose-600/20 text-rose-400 border border-rose-500/30 hover:bg-rose-600 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1"
                >
                  <CheckCircle2 size={14} /> Confirm Request
                </button>
              )}
              {req.status !== 'rejected' && (
                <button
                  onClick={() => handleUpdateStatus(req.id, 'rejected')}
                  disabled={loadingId === req.id}
                  className="py-2 px-3 bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1"
                  title="Reject Request"
                >
                  Reject
                </button>
              )}
              <button
                onClick={() => handleDeleteRequest(req.id)}
                className="p-2 text-rose-400 hover:bg-rose-500/20 rounded-xl transition-colors"
                title="Delete Request"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}

        {finalFiltered.length === 0 && (
          <div className="text-center py-16 text-white/20 text-xs">
            No {requestType === 'seat_booking' ? 'Seat Booking' : 'Withdraw'} requests found
          </div>
        )}
      </div>
    </div>
  );
}

// --- Admin Settings & History Clear View ---

function AdminSettingsView({ requests, initialLogoUrl }: { requests?: RequestData[], initialLogoUrl?: string }) {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [clearing, setClearing] = useState(false);

  const [currentLogoUrl, setCurrentLogoUrl] = useState<string>(initialLogoUrl || '');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoSuccess, setLogoSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const snap = await getDoc(doc(db, 'settings', 'config'));
        if (snap.exists()) {
          const data = snap.data();
          if (data.userPin) setPin(data.userPin);
          if (data.logoUrl !== undefined) setCurrentLogoUrl(data.logoUrl);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchConfig();
  }, []);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('দয়া করে একটি সঠিক ইমেজ ফাইল নির্বাচন করুন। (Please select an image file)');
      return;
    }

    setUploadingLogo(true);
    try {
      const base64Image = await compressAndConvertToBase64(file, 400, 400);
      await setDoc(doc(db, 'settings', 'config'), { logoUrl: base64Image }, { merge: true });
      setCurrentLogoUrl(base64Image);
      setLogoSuccess(true);
      setTimeout(() => setLogoSuccess(false), 3000);
    } catch (err) {
      console.error('Error uploading logo:', err);
      alert('লোগো আপডেট করতে সমস্যা হয়েছে।');
    } finally {
      setUploadingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveLogo = async () => {
    if (!window.confirm("ডিফল্ট লোগোতে ফিরে যেতে চান? (Reset to default logo?)")) return;
    setUploadingLogo(true);
    try {
      await setDoc(doc(db, 'settings', 'config'), { logoUrl: '' }, { merge: true });
      setCurrentLogoUrl('');
      setLogoSuccess(true);
      setTimeout(() => setLogoSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) return;
    setLoading(true);
    try {
      await setDoc(doc(db, 'settings', 'config'), { userPin: pin }, { merge: true });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (err) {
      console.error(err);
      alert('Failed to update PIN');
    } finally {
      setLoading(false);
    }
  };

  const handleClearAllHistory = async () => {
    if (!window.confirm("Are you sure you want to clear ALL requests history for all users? This cannot be undone.")) return;
    setClearing(true);
    try {
      if (requests && requests.length > 0) {
        for (const req of requests) {
          await deleteDoc(doc(db, 'requests', req.id));
        }
      }
      alert("All request history cleared successfully!");
    } catch (err) {
      console.error(err);
      alert("Failed to clear history");
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="space-y-6 mt-2">
      {/* App Logo Customization Section */}
      <div className="bg-[#18181b] p-6 rounded-3xl border border-white/5 shadow-sm space-y-4">
        <div>
          <h3 className="font-extrabold text-[17px] text-white flex items-center gap-2">
            <Sparkles size={18} className="text-cyan-400" />
            অ্যাপ লোগো সেটিংস (App Logo Update)
          </h3>
          <p className="text-xs text-white/50 leading-snug mt-1">
            গ্যালারি থেকে লোগো আপলোড করুন। যে লোগো আপলোড করবেন তা লগইন পেজ সহ পুরো অ্যাপের উপরে সবাই দেখতে পাবে।
          </p>
        </div>

        <div className="flex items-center gap-4 bg-[#09090b] p-4 rounded-2xl border border-white/10">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-600 to-cyan-500 flex items-center justify-center shrink-0 border border-white/10 overflow-hidden relative shadow-lg">
            {currentLogoUrl ? (
              <img src={currentLogoUrl} alt="App Logo" className="w-full h-full object-cover" />
            ) : (
              <TrendingUp size={36} className="text-white" />
            )}
          </div>

          <div className="flex-1 space-y-2">
            <p className="text-xs font-extrabold text-white">
              {currentLogoUrl ? 'কাস্টম লোগো সক্রিয় (Custom Logo Active)' : 'ডিফল্ট লোগো সক্রিয় (Default Logo)'}
            </p>

            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleLogoUpload} 
              accept="image/*" 
              className="hidden" 
            />

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingLogo}
                className="px-3.5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-90 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-md active:scale-95 disabled:opacity-50"
              >
                {uploadingLogo ? (
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Upload size={15} />
                )}
                গ্যালারি থেকে আপলোড
              </button>

              {currentLogoUrl && (
                <button
                  type="button"
                  onClick={handleRemoveLogo}
                  disabled={uploadingLogo}
                  className="px-3 py-2 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-bold transition-all flex items-center gap-1 active:scale-95"
                >
                  <RotateCcw size={14} /> রিসেট
                </button>
              )}
            </div>
          </div>
        </div>

        {logoSuccess && (
          <div className="bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-bold p-2.5 rounded-xl flex items-center gap-2">
            <CheckCircle2 size={16} /> লোগো সফলভাবে আপডেট করা হয়েছে! (Logo updated live!)
          </div>
        )}
      </div>

      {/* Global User Login PIN */}
      <div className="bg-[#18181b] p-6 rounded-3xl border border-white/5 shadow-sm space-y-4">
        <div>
          <h3 className="font-bold text-[17px] mb-1">Global User Login PIN</h3>
          <p className="text-xs text-white/50 leading-snug">Set the PIN that users will enter on the landing page to access the app.</p>
        </div>
        <form onSubmit={handleSave} className="space-y-4">
          <input 
            type="text" 
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="e.g. 1234"
            className="w-full bg-[#09090b] border border-white/10 rounded-2xl py-3.5 px-5 text-xl tracking-widest font-mono focus:outline-none focus:border-indigo-500/50 transition-colors"
          />
          <button 
            type="submit"
            disabled={loading || !pin.trim()}
            className="w-full py-3.5 bg-white text-black hover:bg-white/90 disabled:opacity-50 transition-colors rounded-2xl font-bold flex items-center justify-center gap-2 shadow-sm text-sm"
          >
            {loading ? 'Saving...' : success ? <><CheckCircle2 size={18} /> Saved</> : 'Save PIN'}
          </button>
        </form>
      </div>

      {/* Clear All History Option */}
      <div className="bg-[#18181b] p-6 rounded-3xl border border-rose-500/20 shadow-sm space-y-4">
        <div>
          <h3 className="font-bold text-[17px] text-rose-400 mb-1">Clear All Requests History (হিস্টরি ক্লিয়ার করুন)</h3>
          <p className="text-xs text-white/50 leading-snug">Delete all seat booking and withdrawal records from the database.</p>
        </div>
        <button
          onClick={handleClearAllHistory}
          disabled={clearing}
          className="w-full py-3.5 bg-rose-600/20 text-rose-400 hover:bg-rose-600 hover:text-white border border-rose-500/30 disabled:opacity-50 transition-colors rounded-2xl font-extrabold text-xs flex items-center justify-center gap-2"
        >
          <Trash2 size={18} />
          {clearing ? 'Clearing History...' : 'CLEAR ALL HISTORY (সবার হিস্টরি ক্লিয়ার করুন)'}
        </button>
      </div>
    </div>
  );
}

// --- Add & Edit Member Modals with Gender & Avatar Selection ---

function AddMemberModal({ role, onClose }: { role: 'leader' | 'trainer', onClose: () => void }) {
  const [name, setName] = useState('');
  const [pin, setPin] = useState('1234');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      await addDoc(collection(db, 'teamMembers'), {
        name: name.trim(),
        role,
        pin: pin.trim() || '1234',
        createdAt: serverTimestamp()
      });
      onClose();
    } catch (error) { 
      handleFirestoreError(error, OperationType.CREATE, 'teamMembers');
    } finally { 
      setLoading(false); 
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-md" 
      />
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
        className="relative w-full max-w-sm bg-[#09090b] rounded-3xl p-6 border border-white/10 shadow-2xl z-10 overflow-y-auto custom-scrollbar"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">{TRANSLATIONS.ADD_MEMBER} ({TRANSLATIONS[role === 'leader' ? 'TEAM_LEADER' : 'TEAM_TRAINER']})</h2>
          <button onClick={onClose} className="p-1 hover:bg-white/5 rounded-xl"><XCircle size={20} className="text-white/40" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 pl-1">{TRANSLATIONS.NAME}</label>
            <input 
              placeholder="Full Name"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#18181b] border border-white/10 rounded-2xl py-3.5 px-4 text-xs font-semibold focus:outline-none focus:border-indigo-500/50 text-white"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 pl-1">Account PIN (Default: 1234)</label>
            <input 
              placeholder="e.g. 1234"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="w-full bg-[#18181b] border border-white/10 rounded-2xl py-3.5 px-4 text-xs font-mono font-semibold focus:outline-none focus:border-indigo-500/50 text-white"
            />
          </div>

          <button 
            type="submit"
            disabled={loading || !name.trim()}
            className="w-full py-3.5 bg-white text-black hover:bg-white/90 disabled:opacity-50 transition-colors rounded-2xl font-bold shadow-lg mt-2 text-xs"
          >
            {loading ? 'Saving...' : TRANSLATIONS.SUBMIT}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

function EditMemberModal({ member, onClose }: { member: TeamMember, onClose: () => void }) {
  const [name, setName] = useState(member.name);
  const [pin, setPin] = useState(member.pin || '1234');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'teamMembers', member.id), {
        name: name.trim(),
        pin: pin.trim() || '1234',
        updatedAt: serverTimestamp()
      });
      onClose();
    } catch (error) { 
      handleFirestoreError(error, OperationType.UPDATE, `teamMembers/${member.id}`);
    } finally { 
      setLoading(false); 
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-md" 
      />
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
        className="relative w-full max-w-sm bg-[#09090b] rounded-3xl p-6 border border-white/10 shadow-2xl z-10 overflow-y-auto custom-scrollbar"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Edit Member Profile</h2>
          <button onClick={onClose} className="p-1 hover:bg-white/5 rounded-xl"><XCircle size={20} className="text-white/40" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-white/40 pl-1">{TRANSLATIONS.NAME}</label>
            <input 
              placeholder="Full Name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#18181b] border border-white/10 rounded-2xl py-3.5 px-4 text-xs font-semibold focus:outline-none focus:border-indigo-500/50 text-white"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-white/40 pl-1">Account Access PIN</label>
            <input 
              placeholder="Account PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="w-full bg-[#18181b] border border-white/10 rounded-2xl py-3.5 px-4 text-xs font-mono font-semibold focus:outline-none focus:border-indigo-500/50 text-white"
            />
          </div>

          <button 
            type="submit"
            disabled={loading || !name.trim()}
            className="w-full py-3.5 bg-white text-black hover:bg-white/90 disabled:opacity-50 transition-colors rounded-2xl font-bold shadow-lg mt-2 text-xs"
          >
            {loading ? 'Updating...' : 'Update Member'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

// --- Admin Notification Center ---

function NotificationCenter({ notifications, onClose }: { notifications: RequestData[], onClose: () => void }) {
  const pendingRequests = notifications.filter(n => n.status === 'pending');

  const handleQuickApprove = async (id: string) => {
    try {
      await updateDoc(doc(db, 'requests', id), {
        status: 'accepted',
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} className="absolute top-0 right-0 bottom-0 w-full max-w-sm bg-[#09090b] shadow-2xl border-l border-white/10 flex flex-col z-10">
        <div className="p-5 border-b border-white/5 flex items-center justify-between">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Bell className="text-indigo-400" size={20} />
            {TRANSLATIONS.NOTIFICATIONS}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-white/5 rounded-xl"><XCircle size={22} className="text-white/40" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {pendingRequests.map(req => (
            <div key={req.id} className="rounded-2xl border bg-[#18181b] border-white/5 p-4 space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[9px] font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/20 uppercase">
                    {req.type === 'seat_booking' ? 'Seat Booking' : 'Withdraw'}
                  </span>
                  <h3 className="font-bold text-white text-sm mt-1">{req.recipientName}</h3>
                  <p className="text-xs text-white/50">From: {req.senderName} ({req.senderNumber})</p>
                </div>
                <p className="font-mono font-bold text-base text-white">৳{req.amount || '0'}</p>
              </div>

              <button 
                onClick={() => handleQuickApprove(req.id)}
                className="w-full py-2 bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1"
              >
                <Check size={14} /> Accept Request
              </button>
            </div>
          ))}

          {pendingRequests.length === 0 && (
            <div className="text-center py-32 text-white/20 text-xs">
              <CheckCircle2 size={40} className="mx-auto mb-2 opacity-20" />
              <p>No pending notifications</p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
