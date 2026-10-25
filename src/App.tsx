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
import { UserProfile, TeamMember, RequestData, FakeInvoice1Data, FakeInvoice2Data } from './types';
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
  AlertTriangle,
  ArrowLeft,
  Award,
  Info,
  CreditCard
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

      <div className={`relative z-10 mx-auto w-full flex flex-col ${
        view === 'landing' 
          ? 'max-w-md min-h-[100dvh] justify-center items-center py-3 px-3.5 sm:px-4' 
          : 'max-w-xl md:max-w-3xl min-h-screen pt-4 px-3.5 sm:px-6 pb-20 justify-start items-stretch'
      }`}>
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
  const [loginMode, setLoginMode] = useState<'user' | 'admin'>('user');
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const expectedLength = loginMode === 'admin' ? 6 : (userPinConfig?.length || 4);

  const triggerSuccess = (callback: () => void) => {
    setIsSuccess(true);
    setError(false);
    setTimeout(() => {
      callback();
    }, 800);
  };

  const triggerError = () => {
    setError(true);
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate([40, 60, 40]);
      } catch (e) {
        // ignore
      }
    }
    setTimeout(() => {
      setPin('');
      setError(false);
    }, 1200);
  };

  const handleKeypadPress = (key: string) => {
    if (isSuccess) return;

    if (key === 'del') {
      setPin(prev => prev.slice(0, -1));
      setError(false);
    } else if (key === 'clear') {
      setPin('');
      setError(false);
    } else if (pin.length < expectedLength) {
      const newPin = pin + key;
      setPin(newPin);
      setError(false);

      if (loginMode === 'admin') {
        if (newPin === '212650') {
          triggerSuccess(onAdminLogin);
        } else if (newPin.length >= 6) {
          triggerError();
        }
      } else if (loginMode === 'user') {
        if (newPin === userPinConfig) {
          triggerSuccess(onEnter);
        } else if (newPin.length >= expectedLength) {
          triggerError();
        }
      }
    }
  };

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSuccess) return;

    if (loginMode === 'admin') {
      if (pin === '212650') {
        triggerSuccess(onAdminLogin);
      } else {
        triggerError();
      }
    } else if (loginMode === 'user') {
      if (pin === userPinConfig) {
        triggerSuccess(onEnter);
      } else {
        triggerError();
      }
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isSuccess) return;
      if (e.key >= '0' && e.key <= '9') {
        handleKeypadPress(e.key);
      } else if (e.key === 'Backspace') {
        handleKeypadPress('del');
      } else if (e.key === 'Escape') {
        setPin('');
        setError(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pin, loginMode, isSuccess, userPinConfig, expectedLength]);

  const switchMode = (mode: 'user' | 'admin') => {
    if (isSuccess) return;
    setLoginMode(mode);
    setPin('');
    setError(false);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="w-full flex flex-col items-center justify-center select-none py-1 sm:py-2 relative gap-3 sm:gap-4 max-w-[400px] mx-auto"
    >
      {/* Ambient background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-gradient-to-tr from-indigo-600/15 via-purple-600/15 to-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Brand Header */}
      <div className="text-center shrink-0 space-y-1.5 relative z-10 pt-0.5">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="w-16 h-16 sm:w-18 sm:h-18 bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-600 rounded-2xl mx-auto flex items-center justify-center shadow-[0_0_25px_rgba(99,102,241,0.35)] border-2 border-white/20 overflow-hidden p-1"
        >
          {appLogoUrl ? (
            <img src={appLogoUrl} alt="Unity Earning" className="w-full h-full object-cover rounded-xl" />
          ) : (
            <div className="w-full h-full rounded-xl bg-black/30 flex items-center justify-center">
              <TrendingUp size={30} className="text-white" />
            </div>
          )}
        </motion.div>
        <div className="space-y-0.5">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white leading-tight drop-shadow-md">
            UNITY EARNING
          </h1>
          <p className="text-xs sm:text-sm font-black tracking-[0.2em] uppercase text-indigo-300/90 drop-shadow-sm">
            SECURE ACCESS PORTAL
          </p>
        </div>
      </div>

      {/* Main Glassmorphic Login Card */}
      <div className="relative w-full bg-[#12131a]/95 backdrop-blur-2xl rounded-3xl border border-white/10 p-4 sm:p-5 shadow-2xl z-10 overflow-hidden flex flex-col gap-3.5 sm:gap-4">
        
        {/* Success Celebration Overlay (100% English) */}
        <AnimatePresence>
          {isSuccess && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-30 bg-[#0c0d12]/95 backdrop-blur-md rounded-3xl flex flex-col items-center justify-center p-5 text-center overflow-hidden"
            >
              {/* Expanding Pulse Wave Rings */}
              <motion.div
                initial={{ scale: 0.5, opacity: 0.8 }}
                animate={{ scale: 2.3, opacity: 0 }}
                transition={{ duration: 1.1, repeat: Infinity, ease: "easeOut" }}
                className="absolute w-22 h-22 rounded-full border-2 border-emerald-500/40 pointer-events-none"
              />
              <motion.div
                initial={{ scale: 0.3, opacity: 1 }}
                animate={{ scale: 1.8, opacity: 0 }}
                transition={{ duration: 1.1, delay: 0.25, repeat: Infinity, ease: "easeOut" }}
                className="absolute w-22 h-22 rounded-full bg-emerald-500/20 pointer-events-none"
              />

              {/* Bouncing Checkmark Badge */}
              <motion.div
                initial={{ scale: 0, rotate: -40 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 320, damping: 18 }}
                className="w-18 h-18 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 p-0.5 shadow-[0_0_30px_rgba(16,185,129,0.55)] mb-3.5 flex items-center justify-center relative"
              >
                <div className="w-full h-full bg-[#0a1510] rounded-full flex items-center justify-center">
                  <CheckCircle2 size={38} className="text-emerald-400 drop-shadow-[0_0_12px_rgba(52,211,153,0.9)]" />
                </div>
              </motion.div>

              <motion.h3
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="text-lg font-black text-white tracking-wide uppercase"
              >
                Verification Successful!
              </motion.h3>

              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.22 }}
                className="text-xs text-emerald-400 font-medium mt-1 mb-4"
              >
                {loginMode === 'admin' ? 'Entering Admin Portal...' : 'Entering User Dashboard...'}
              </motion.p>

              {/* Progress Shimmer */}
              <div className="w-44 h-1.5 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 0.75, ease: "easeInOut" }}
                  className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 rounded-full shadow-[0_0_10px_rgba(52,211,153,0.8)]"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Top Segmented Mode Switcher */}
        <div className="flex p-1 bg-black/60 border border-white/10 rounded-2xl relative shrink-0">
          <button
            type="button"
            onClick={() => switchMode('user')}
            className={`flex-1 py-2 sm:py-2.5 px-3 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2 relative z-10 ${
              loginMode === 'user' ? 'text-white' : 'text-white/50 hover:text-white/80'
            }`}
          >
            {loginMode === 'user' && (
              <motion.div
                layoutId="loginTabIndicator"
                className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-indigo-500 rounded-xl -z-10 shadow-md shadow-indigo-500/30"
                transition={{ type: "spring", bounce: 0.15, duration: 0.35 }}
              />
            )}
            <UserIcon size={15} />
            <span>User Portal</span>
          </button>
          
          <button
            type="button"
            onClick={() => switchMode('admin')}
            className={`flex-1 py-2 sm:py-2.5 px-3 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2 relative z-10 ${
              loginMode === 'admin' ? 'text-white' : 'text-white/50 hover:text-white/80'
            }`}
          >
            {loginMode === 'admin' && (
              <motion.div
                layoutId="loginTabIndicator"
                className="absolute inset-0 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl -z-10 shadow-md shadow-purple-500/30"
                transition={{ type: "spring", bounce: 0.15, duration: 0.35 }}
              />
            )}
            <ShieldCheck size={15} />
            <span>Admin Access</span>
          </button>
        </div>

        {/* PIN Entry Form */}
        <form onSubmit={handleAuth} className="flex flex-col gap-3">
          <div className="text-center shrink-0">
            <h2 className="text-sm sm:text-base font-black text-white uppercase tracking-wider">
              {loginMode === 'admin' ? 'Admin Access PIN' : 'User Access PIN'}
            </h2>
            <p className="text-xs text-white/50 mt-0.5 font-medium">
              {loginMode === 'admin' ? 'Enter 6-digit master passcode' : `Enter ${expectedLength}-digit PIN code`}
            </p>
          </div>

          {/* Animated PIN Dots / Capsules */}
          <motion.div 
            animate={error ? { x: [-8, 8, -6, 6, -3, 3, 0] } : {}}
            transition={{ duration: 0.4 }}
            className="flex justify-center items-center gap-2.5 sm:gap-3 py-1 shrink-0"
          >
            {Array.from({ length: expectedLength }).map((_, idx) => {
              const isFilled = idx < pin.length;
              const isCurrent = idx === pin.length;
              return (
                <div
                  key={idx}
                  className={`w-11 h-12 sm:w-12 sm:h-13 rounded-2xl flex items-center justify-center transition-all duration-200 border-2 ${
                    isSuccess
                      ? 'border-emerald-500 bg-emerald-500/15 shadow-[0_0_15px_rgba(16,185,129,0.35)]'
                      : error
                      ? 'border-rose-500/80 bg-rose-500/15 shadow-[0_0_15px_rgba(244,63,94,0.3)]'
                      : isFilled
                      ? 'border-indigo-500 bg-indigo-500/15 shadow-[0_0_14px_rgba(99,102,241,0.3)]'
                      : isCurrent
                      ? 'border-indigo-400 bg-white/[0.04] ring-2 ring-indigo-500/40 shadow-[0_0_10px_rgba(99,102,241,0.2)]'
                      : 'border-white/10 bg-black/40'
                  }`}
                >
                  {isFilled && (
                    <motion.div
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 500, damping: 25 }}
                      className={`w-3.5 h-3.5 rounded-full ${
                        isSuccess
                          ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,1)]'
                          : error
                          ? 'bg-rose-400 shadow-[0_0_10px_rgba(251,113,133,1)]'
                          : 'bg-indigo-400 shadow-[0_0_10px_rgba(129,140,248,0.9)]'
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </motion.div>

          {/* Status Message */}
          <div className="h-4 flex items-center justify-center shrink-0">
            {error ? (
              <motion.p 
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-rose-400 text-xs text-center font-bold"
              >
                Incorrect PIN! Please try again
              </motion.p>
            ) : isSuccess ? (
              <motion.p 
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-emerald-400 text-xs text-center font-bold"
              >
                Correct PIN! Logging in...
              </motion.p>
            ) : (
              <p className="text-white/40 text-xs text-center font-medium">
                Enter code via keypad or keyboard
              </p>
            )}
          </div>

          {/* Bold, Chunky Tactile Keypad */}
          <div className="grid grid-cols-3 gap-2 sm:gap-2.5 shrink-0 my-0.5">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
              <button 
                key={num} 
                type="button" 
                disabled={isSuccess}
                onClick={() => handleKeypadPress(num.toString())} 
                className="h-12 sm:h-13 bg-[#1c1f2e] hover:bg-[#272b3f] active:bg-indigo-600 active:scale-95 disabled:opacity-50 border border-white/15 hover:border-white/30 rounded-2xl font-black text-2xl text-white transition-all flex items-center justify-center shadow-md select-none"
              >
                {num}
              </button>
            ))}
            
            <button 
              type="button" 
              disabled={isSuccess || pin.length === 0}
              onClick={() => handleKeypadPress('clear')} 
              className="h-12 sm:h-13 bg-[#171926] hover:bg-[#232738] active:scale-95 disabled:opacity-30 border border-white/10 rounded-2xl font-black text-xs tracking-wider text-white/60 hover:text-white transition-all flex items-center justify-center select-none uppercase"
            >
              CLEAR
            </button>
            
            <button 
              type="button" 
              disabled={isSuccess}
              onClick={() => handleKeypadPress('0')} 
              className="h-12 sm:h-13 bg-[#1c1f2e] hover:bg-[#272b3f] active:bg-indigo-600 active:scale-95 disabled:opacity-50 border border-white/15 hover:border-white/30 rounded-2xl font-black text-2xl text-white transition-all flex items-center justify-center shadow-md select-none"
            >
              0
            </button>
            
            <button 
              type="button" 
              disabled={isSuccess || pin.length === 0}
              onClick={() => handleKeypadPress('del')} 
              className="h-12 sm:h-13 bg-[#171926] hover:bg-[#232738] active:scale-95 disabled:opacity-30 border border-white/10 rounded-2xl font-bold text-rose-400 hover:text-rose-300 transition-all flex items-center justify-center select-none"
            >
              <Delete size={20} />
            </button>
          </div>

          {/* Action / Enter Button */}
          <button 
            type="submit"
            disabled={!pin || isSuccess}
            className={`w-full h-12 sm:h-13 rounded-2xl font-black text-xs sm:text-sm uppercase tracking-wider text-white shadow-lg transition-all active:scale-98 flex justify-center items-center gap-2 select-none shrink-0 ${
              loginMode === 'admin'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-purple-600/30'
                : 'bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 shadow-indigo-600/30'
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            <CheckCircle2 size={18} />
            <span>{loginMode === 'admin' ? 'ADMIN LOGIN' : 'LOGIN TO PORTAL'}</span>
          </button>
        </form>
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
  const [memberPinSuccess, setMemberPinSuccess] = useState(false);
  const [activeMember, setActiveMember] = useState<TeamMember | null>(null);
  const [showOptionModal, setShowOptionModal] = useState(false);
  
  const [activeModal, setActiveModal] = useState<
    'none' | 'withdraw' | 'seat_booking' | 'sure_shot' | 'sure_shot_invoice' | 'history' | 'post_booking' | 'invoice' | 'fake_disclaimer' | 'fake_form_1' | 'fake_form_2' | 'fake_invoice_1' | 'fake_invoice_2'
  >('none');
  const [fakeInvoice1Data, setFakeInvoice1Data] = useState<FakeInvoice1Data | null>(null);
  const [fakeInvoice2Data, setFakeInvoice2Data] = useState<FakeInvoice2Data | null>(null);
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
    setMemberPinSuccess(false);
  };

  const handleVerifyMemberPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinTargetMember || memberPinSuccess) return;
    
    const expectedPin = pinTargetMember.pin || '1234';
    if (memberPinInput === expectedPin) {
      setMemberPinSuccess(true);
      setTimeout(() => {
        setActiveMember(pinTargetMember);
        setPinTargetMember(null);
        setMemberPinSuccess(false);
        setShowOptionModal(true);
      }, 700);
    } else {
      setPinError(true);
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate([40, 60, 40]); } catch (e) {}
      }
      setTimeout(() => {
        setMemberPinInput('');
        setPinError(false);
      }, 1200);
    }
  };

  const handleKeypadPress = (val: string) => {
    if (!pinTargetMember || memberPinSuccess) return;
    if (val === 'del') {
      setMemberPinInput(prev => prev.slice(0, -1));
      setPinError(false);
    } else if (val === 'clear') {
      setMemberPinInput('');
      setPinError(false);
    } else if (memberPinInput.length < 8) {
      const newPin = memberPinInput + val;
      setMemberPinInput(newPin);
      setPinError(false);

      const expectedPin = pinTargetMember.pin || '1234';
      if (newPin === expectedPin) {
        setMemberPinSuccess(true);
        setTimeout(() => {
          setActiveMember(pinTargetMember);
          setPinTargetMember(null);
          setMemberPinSuccess(false);
          setShowOptionModal(true);
        }, 700);
      } else if (newPin.length >= expectedPin.length) {
        setPinError(true);
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          try { navigator.vibrate([40, 60, 40]); } catch (e) {}
        }
        setTimeout(() => {
          setMemberPinInput('');
          setPinError(false);
        }, 1200);
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
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !memberPinSuccess && setPinTargetMember(null)} className="absolute inset-0 bg-black/80 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-sm bg-[#12131a]/95 backdrop-blur-2xl p-5 sm:p-6 rounded-3xl border border-white/10 shadow-2xl z-10 overflow-hidden">
              
              {/* Member Pin Success Celebration Overlay */}
              <AnimatePresence>
                {memberPinSuccess && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-30 bg-[#0c0d12]/95 backdrop-blur-md rounded-3xl flex flex-col items-center justify-center p-6 text-center overflow-hidden"
                  >
                    <motion.div
                      initial={{ scale: 0.5, opacity: 0.8 }}
                      animate={{ scale: 2.2, opacity: 0 }}
                      transition={{ duration: 1.1, repeat: Infinity, ease: "easeOut" }}
                      className="absolute w-24 h-24 rounded-full border-2 border-emerald-500/40 pointer-events-none"
                    />
                    <motion.div
                      initial={{ scale: 0, rotate: -40 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: "spring", stiffness: 320, damping: 18 }}
                      className="w-16 h-16 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 p-0.5 shadow-[0_0_30px_rgba(16,185,129,0.5)] mb-3 flex items-center justify-center"
                    >
                      <div className="w-full h-full bg-[#0a1510] rounded-full flex items-center justify-center">
                        <CheckCircle2 size={36} className="text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.9)]" />
                      </div>
                    </motion.div>
                    <h3 className="text-lg font-black text-white">পিন যাচাই সফল হয়েছে!</h3>
                    <p className="text-xs text-emerald-400 font-medium mt-1 mb-4">মেন্যু অপশন লোড হচ্ছে...</p>
                    <div className="w-40 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: "0%" }}
                        animate={{ width: "100%" }}
                        transition={{ duration: 0.65, ease: "easeInOut" }}
                        className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2 text-indigo-400">
                  <Lock size={16} />
                  <span className="text-xs font-bold uppercase tracking-wider">অ্যাকাউন্ট ভেরিফিকেশন</span>
                </div>
                <button 
                  onClick={() => !memberPinSuccess && setPinTargetMember(null)} 
                  className="text-white/40 hover:text-white transition-colors"
                >
                  <XCircle size={20} />
                </button>
              </div>
              
              <div className="flex items-center gap-3 mb-4 bg-black/40 p-2.5 rounded-2xl border border-white/5">
                <MemberDesignBadge name={pinTargetMember.name} role={pinTargetMember.role} size="md" />
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-white truncate">{pinTargetMember.name}</h3>
                  <p className="text-[10px] text-white/50">অ্যাক্সেস করতে মেম্বার পিন কোড দিন</p>
                </div>
              </div>

              <form onSubmit={handleVerifyMemberPin} className="space-y-4">
                {/* Animated PIN Dots / Capsules */}
                <motion.div 
                  animate={pinError ? { x: [-8, 8, -6, 6, -3, 3, 0] } : {}}
                  transition={{ duration: 0.4 }}
                  className="flex justify-center items-center gap-2.5 py-1"
                >
                  {Array.from({ length: (pinTargetMember.pin || '1234').length }).map((_, idx) => {
                    const isFilled = idx < memberPinInput.length;
                    const isCurrent = idx === memberPinInput.length;
                    return (
                      <div
                        key={idx}
                        className={`w-11 h-13 rounded-2xl flex items-center justify-center transition-all duration-200 border ${
                          memberPinSuccess
                            ? 'border-emerald-500 bg-emerald-500/15 shadow-[0_0_15px_rgba(16,185,129,0.35)]'
                            : pinError
                            ? 'border-rose-500/80 bg-rose-500/15 shadow-[0_0_15px_rgba(244,63,94,0.3)]'
                            : isFilled
                            ? 'border-indigo-500/70 bg-indigo-500/10 shadow-[0_0_12px_rgba(99,102,241,0.25)]'
                            : isCurrent
                            ? 'border-indigo-400 bg-white/[0.04] ring-2 ring-indigo-500/30'
                            : 'border-white/10 bg-black/40'
                        }`}
                      >
                        {isFilled && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring", stiffness: 500, damping: 25 }}
                            className={`w-3.5 h-3.5 rounded-full ${
                              memberPinSuccess
                                ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,1)]'
                                : pinError
                                ? 'bg-rose-400 shadow-[0_0_10px_rgba(251,113,133,1)]'
                                : 'bg-indigo-400 shadow-[0_0_10px_rgba(129,140,248,0.9)]'
                            }`}
                          />
                        )}
                      </div>
                    );
                  })}
                </motion.div>

                {/* Status text */}
                <div className="h-4 flex items-center justify-center">
                  {pinError ? (
                    <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-rose-400 text-xs text-center font-bold">
                      ভুল পিন কোড! পুনরায় চেষ্টা করুন
                    </motion.p>
                  ) : memberPinSuccess ? (
                    <p className="text-emerald-400 text-xs text-center font-bold">সঠিক পিন কোড!</p>
                  ) : (
                    <p className="text-white/30 text-[11px] text-center">{(pinTargetMember.pin || '1234').length} ডিজিটের পিন কোড দিন</p>
                  )}
                </div>

                {/* Keypad */}
                <div className="grid grid-cols-3 gap-2 pt-1">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                    <button 
                      key={num} 
                      type="button" 
                      disabled={memberPinSuccess}
                      onClick={() => handleKeypadPress(num.toString())} 
                      className="h-12 bg-[#1c1f2e] hover:bg-[#272b3f] active:bg-indigo-600 active:scale-95 disabled:opacity-50 border-2 border-white/15 hover:border-white/30 rounded-2xl font-black text-2xl text-white transition-all flex items-center justify-center select-none shadow-md"
                    >
                      {num}
                    </button>
                  ))}
                  <button 
                    type="button" 
                    disabled={memberPinSuccess}
                    onClick={() => setPinTargetMember(null)} 
                    className="h-12 bg-[#171926] hover:bg-[#232738] active:scale-95 border-2 border-white/10 rounded-2xl text-xs font-black tracking-wider text-white/60 hover:text-white transition-all select-none uppercase"
                  >
                    CANCEL
                  </button>
                  <button 
                    type="button" 
                    disabled={memberPinSuccess}
                    onClick={() => handleKeypadPress('0')} 
                    className="h-12 bg-[#1c1f2e] hover:bg-[#272b3f] active:bg-indigo-600 active:scale-95 disabled:opacity-50 border-2 border-white/15 hover:border-white/30 rounded-2xl font-black text-2xl text-white transition-all flex items-center justify-center select-none shadow-md"
                  >
                    0
                  </button>
                  <button 
                    type="button" 
                    disabled={memberPinSuccess || memberPinInput.length === 0}
                    onClick={() => handleKeypadPress('del')} 
                    className="h-12 bg-[#171926] hover:bg-[#232738] active:scale-95 disabled:opacity-30 border-2 border-white/10 rounded-2xl text-rose-400 hover:text-rose-300 flex items-center justify-center transition-all select-none"
                  >
                    <Delete size={22} />
                  </button>
                </div>

                <button 
                  type="submit" 
                  disabled={!memberPinInput || memberPinSuccess}
                  className="w-full mt-1 py-3 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 disabled:opacity-40 text-white rounded-2xl font-bold transition-all shadow-lg shadow-indigo-600/20 active:scale-98 flex items-center justify-center gap-2 select-none"
                >
                  <CheckCircle2 size={18} />
                  <span>যাচাই করে এগিয়ে যান</span>
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

                <button
                  onClick={() => {
                    setShowOptionModal(false);
                    setActiveModal('fake_disclaimer');
                  }}
                  className="w-full max-w-full box-border p-3.5 sm:p-4 bg-gradient-to-r from-purple-900/40 via-fuchsia-900/30 to-pink-900/40 border border-purple-500/30 hover:border-purple-500/60 rounded-2xl text-left flex items-center justify-between group transition-all min-w-0 overflow-hidden shadow-lg shadow-purple-950/30"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center border border-purple-500/30 shrink-0">
                      <FileText size={20} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-white group-hover:text-purple-300 transition-colors text-sm sm:text-base truncate">Fake Seat Book</h4>
                        <span className="text-[9px] bg-purple-500/30 text-purple-200 border border-purple-500/40 px-1.5 py-0.5 rounded font-extrabold tracking-wide uppercase shrink-0">DEMO</span>
                      </div>
                      <p className="text-xs text-white/50 truncate">Demo seat booking & instant invoice download</p>
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

        {/* Fake Booking Modals */}
        {activeModal === 'fake_disclaimer' && (
          <FakeBookingDisclaimerModal 
            onClose={() => setActiveModal('none')}
            onSelectInvoice1={() => setActiveModal('fake_form_1')}
            onSelectInvoice2={() => setActiveModal('fake_form_2')}
          />
        )}
        {activeModal === 'fake_form_1' && (
          <FakeInvoice1FormModal 
            defaultCounselor={activeMember?.name || user?.name || 'Unity Counselor'}
            onClose={() => setActiveModal('none')}
            onBack={() => setActiveModal('fake_disclaimer')}
            onSubmit={(data) => {
              setFakeInvoice1Data(data);
              setActiveModal('fake_invoice_1');
            }}
          />
        )}
        {activeModal === 'fake_form_2' && (
          <FakeInvoice2FormModal 
            defaultCounselor={activeMember?.name || user?.name || 'Unity Counselor'}
            onClose={() => setActiveModal('none')}
            onBack={() => setActiveModal('fake_disclaimer')}
            onSubmit={(data) => {
              setFakeInvoice2Data(data);
              setActiveModal('fake_invoice_2');
            }}
          />
        )}
        {activeModal === 'fake_invoice_1' && fakeInvoice1Data && (
          <FakeInvoice1Modal 
            data={fakeInvoice1Data}
            onClose={() => setActiveModal('none')}
            onBackToOptions={() => setActiveModal('fake_disclaimer')}
          />
        )}
        {activeModal === 'fake_invoice_2' && fakeInvoice2Data && (
          <FakeInvoice2Modal 
            data={fakeInvoice2Data}
            onClose={() => setActiveModal('none')}
            onBackToOptions={() => setActiveModal('fake_disclaimer')}
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
  const [step, setStep] = useState<'conditions' | 'form'>('conditions');
  const [candidateName, setCandidateName] = useState('');
  const [candidateNumber, setCandidateNumber] = useState('');
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);

  // Count existing sure shot requests for this member to calculate sequence
  const existingMemberSureShots = history.filter(r => 
    r.type === 'sure_shot' && 
    ((r.recipientName && r.recipientName.trim().toLowerCase() === member.name.trim().toLowerCase()) ||
     (r.submittedByUid && r.submittedByUid === member.id))
  );
  const sequenceNumber = existingMemberSureShots.length + 1;

  const handleProceedToForm = () => {
    setFormError('');
    setStep('form');
  };

  const handleFinalSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setFormError('');

    const trimmedName = candidateName.trim();
    const trimmedNumber = candidateNumber.trim();

    if (!trimmedName) {
      setFormError('অনুগ্রহ করে যার সিওর শট হবে তার নাম লিখুন');
      return;
    }
    if (!trimmedNumber) {
      setFormError('অনুগ্রহ করে যার সিওর শট হবে তার নাম্বার দিন');
      return;
    }
    const cleanPhone = trimmedNumber.replace(/\D/g, '');
    if (cleanPhone.length < 11) {
      setFormError('অনুগ্রহ করে সঠিক ১১ ডিজিটের মোবাইল নাম্বার দিন');
      return;
    }

    setLoading(true);

    const generatedRef = `SSB-${Math.floor(100000 + Math.random() * 900000)}`;
    const now = new Date();
    const expiresAtDate = new Date(now.getTime() + 6 * 60 * 60 * 1000);

    try {
      const docRef = await addDoc(collection(db, 'requests'), {
        refId: generatedRef,
        type: 'sure_shot',
        senderId: sender?.uid || 'guest',
        senderName: trimmedName,
        whatsappNumber: trimmedNumber,
        senderNumber: trimmedNumber,
        senderRole: sender?.role || 'user',
        recipientName: member.name,
        recipientNumber: member.number || '',
        amount: 0,
        bookingSequence: sequenceNumber,
        status: 'pending',
        createdAt: serverTimestamp(),
        expiresAt: expiresAtDate,
        submittedByUid: member.id,
        note: `Sure Shot for ${trimmedName} (${trimmedNumber})`
      });

      saveMySubmittedRequestId(docRef.id);

      const createdReq: RequestData = {
        id: docRef.id,
        refId: generatedRef,
        type: 'sure_shot',
        senderId: sender?.uid || 'guest',
        senderName: trimmedName,
        whatsappNumber: trimmedNumber,
        senderNumber: trimmedNumber,
        senderRole: sender?.role || 'user',
        recipientName: member.name,
        recipientNumber: member.number || '',
        amount: 0,
        bookingSequence: sequenceNumber,
        status: 'pending',
        createdAt: now,
        expiresAt: expiresAtDate,
        submittedByUid: member.id,
        note: `Sure Shot for ${trimmedName} (${trimmedNumber})`
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={() => !loading && onClose()}
        className="fixed inset-0 bg-black/85 backdrop-blur-md" 
      />
      <motion.div 
        initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
        className="relative w-full max-w-sm bg-[#0d0f17] border-2 border-amber-500/40 rounded-3xl p-5 shadow-[0_0_35px_rgba(245,158,11,0.2)] my-auto z-10 flex flex-col gap-4 overflow-hidden"
      >
        {/* Amber-Orange Top Glow bar */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-400" />

        {/* STEP 1: Conditions & Rules */}
        {step === 'conditions' && (
          <>
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
                নিচে থাকা <strong className="text-white underline font-extrabold">কনফার্ম প্রি-বুকিং বাটনে</strong> ক্লিক করে যার সিওর শট হবে তার তথ্য ফর্মটি পূরণ করুন।
              </p>
              <div className="flex items-center justify-center gap-1.5 text-[10px] font-bold text-amber-400">
                <Clock size={12} />
                <span>ফর্ম সাবমিটের সাথে সাথে ৬ ঘণ্টার কাউন্টডাউন টাইমার চালু হবে</span>
              </div>
            </div>

            {/* Action Button */}
            <div className="space-y-3 pt-1">
              <button 
                type="button"
                onClick={handleProceedToForm}
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
          </>
        )}

        {/* STEP 2: Candidate Information Form */}
        {step === 'form' && (
          <div className="space-y-3.5">
            {/* Form Header */}
            <div className="flex items-center justify-between pb-2.5 border-b border-white/10 pt-1">
              <button 
                type="button"
                onClick={() => setStep('conditions')}
                className="p-1.5 text-white/50 hover:text-white rounded-lg transition-colors flex items-center gap-1 text-xs"
                title="শর্তাবলী দেখুন"
              >
                <ArrowLeft size={16} />
                <span>শর্তাবলী</span>
              </button>
              <div className="text-center">
                <h3 className="text-sm font-extrabold text-white">প্রার্থীর তথ্য ফর্ম</h3>
                <p className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">Sure Shot Candidate</p>
              </div>
              <button onClick={onClose} className="p-1.5 text-white/40 hover:text-white rounded-lg transition-colors">
                <XCircle size={20} />
              </button>
            </div>

            {/* Assigned Member Info Strip */}
            <div className="bg-[#121622] px-3 py-2 rounded-xl border border-white/5 flex items-center justify-between text-xs text-white/70">
              <span className="truncate">লিডার/ট্রেইনার: <strong className="text-white">{member.name}</strong></span>
              <span className="text-[10px] font-black px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0 ml-2">
                বুকিং #{sequenceNumber}
              </span>
            </div>

            {/* Candidate Form - Only Name and Number */}
            <form onSubmit={handleFinalSubmit} className="space-y-3.5">
              {/* Field 1: Candidate Name */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-white flex items-center gap-1.5">
                  <UserIcon size={14} className="text-amber-400" />
                  <span>যার সিওর শট হবে তার নাম <span className="text-rose-400">*</span></span>
                </label>
                <input
                  type="text"
                  required
                  value={candidateName}
                  onChange={(e) => setCandidateName(e.target.value)}
                  placeholder="যেমন: মো: তানভীর আহমেদ / Tanvir Ahmed"
                  className="w-full bg-[#121622] border border-white/10 focus:border-amber-500 rounded-xl py-3 px-3 text-xs sm:text-sm text-white placeholder:text-white/30 focus:outline-none transition-colors"
                />
              </div>

              {/* Field 2: Candidate Number */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Smartphone size={14} className="text-emerald-400" />
                  <span>যার সিওর শট হবে তার নাম্বার <span className="text-rose-400">*</span></span>
                </label>
                <input
                  type="tel"
                  required
                  value={candidateNumber}
                  onChange={(e) => setCandidateNumber(e.target.value)}
                  placeholder="যেমন: 017XXXXXXXX"
                  className="w-full bg-[#121622] border border-white/10 focus:border-amber-500 rounded-xl py-3 px-3 text-xs sm:text-sm text-white placeholder:text-white/30 focus:outline-none transition-colors font-mono"
                />
              </div>

              {/* Error Message */}
              {formError && (
                <div className="bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-bold py-2 px-3 rounded-xl flex items-center gap-1.5">
                  <AlertTriangle size={14} className="shrink-0 text-rose-400" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Short Note */}
              <p className="text-[10px] text-center text-amber-200/80 font-medium">
                * তথ্য সাবমিট করার সাথে সাথে ইনভয়েস পাবেন এবং ৬ ঘণ্টার কাউন্টডাউন শুরু হবে
              </p>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setStep('conditions')}
                  className="py-3 bg-[#1a1f30] hover:bg-[#232a40] text-white/70 hover:text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                >
                  বাতিল (Back)
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="py-3 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:opacity-95 text-black font-black text-xs rounded-xl shadow-lg shadow-orange-500/25 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 active:scale-98"
                >
                  {loading ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                      প্রসেসিং...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={15} /> কনফার্ম প্রি-বুকিং
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}
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
        backgroundColor: '#ffffff',
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
          className="w-full bg-white rounded-3xl p-5 sm:p-6 border-2 border-slate-200/90 shadow-2xl flex flex-col gap-3 relative overflow-hidden text-left text-slate-900"
        >
          {/* Top Corporate Gradient Bar */}
          <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-blue-600 via-sky-500 to-emerald-500" />

          {/* Header Bar */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 pt-1">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shrink-0 font-black">
                <Zap size={20} className="text-white" />
              </div>
              <div>
                <h2 className="text-base font-black text-slate-900 tracking-wider">UNITY EARNING</h2>
                <p className="text-[10px] font-extrabold text-blue-700 uppercase tracking-wider">Sure Shot Pre-Booking</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-black px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200">
                #{booking.bookingSequence || 1}
              </span>
              <Badge status={booking.status || 'pending'} />
            </div>
          </div>

          {/* Clean 6-Hour Countdown Timer */}
          <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200 flex items-center justify-between shadow-sm">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Clock size={15} className="text-blue-600" />
              সময়সীমা (Time Left):
            </span>
            <CountdownTimer 
              createdAt={booking.createdAt} 
              expiresAt={booking.expiresAt} 
              variant="compact" 
            />
          </div>

          {/* Invoice Details */}
          <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200 space-y-2.5 text-xs shadow-sm">
            <div className="flex justify-between items-center pb-2 border-b border-slate-200">
              <span className="text-slate-500 text-[11px] uppercase font-bold tracking-wider">Booking ID</span>
              <span className="font-mono font-black text-blue-700 text-xs">{refId}</span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-slate-200">
              <span className="text-slate-500 text-[11px] uppercase font-bold tracking-wider">প্রার্থীর নাম (Candidate)</span>
              <span className="font-black text-slate-900 text-xs">{booking.senderName || 'N/A'}</span>
            </div>
            {(booking.whatsappNumber || booking.senderNumber) && (
              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <span className="text-slate-500 text-[11px] uppercase font-bold tracking-wider">প্রার্থীর নাম্বার (Number)</span>
                <span className="font-mono font-bold text-slate-900 text-xs">{booking.whatsappNumber || booking.senderNumber}</span>
              </div>
            )}
            <div className="flex justify-between items-center pb-2 border-b border-slate-200">
              <span className="text-slate-500 text-[11px] uppercase font-bold tracking-wider">লিডার/ট্রেইনার (Assigned)</span>
              <span className="font-bold text-slate-900 text-xs">{booking.recipientName || 'N/A'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 text-[11px] uppercase font-bold tracking-wider">Issue Time</span>
              <span className="font-semibold text-slate-700 text-[11px]">{issueDate}</span>
            </div>
          </div>

          {/* Concise Footer Note */}
          <p className="text-[10px] text-center text-slate-500 font-medium pt-0.5">
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
        backgroundColor: '#ffffff',
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
          className="w-full bg-white rounded-3xl p-5 sm:p-6 border-2 border-slate-200/90 shadow-2xl flex flex-col gap-3.5 relative overflow-hidden text-left text-slate-900"
        >
          {/* Multi-Color Accent Stripe Top */}
          <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-blue-600 via-sky-500 to-emerald-500" />

          {/* Receipt Header Bar */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 pt-1">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 via-sky-500 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0">
                <Shield size={22} />
              </div>
              <div>
                <h2 className="text-base font-black text-slate-900 tracking-wider">UNITY EARNING</h2>
                <p className="text-[9px] font-extrabold text-blue-700 tracking-widest uppercase">— SEAT BOOKING RECEIPT —</p>
              </div>
            </div>
            <Badge status={booking.status || 'pending'} />
          </div>

          {/* Invoice Grid Details */}
          <div className="grid grid-cols-2 gap-2.5">
            {/* REF ID */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 shadow-sm">
              <p className="text-[9px] font-bold uppercase text-slate-500 tracking-wider">REF ID</p>
              <p className="text-xs font-black text-blue-700 font-mono mt-0.5">{refId}</p>
            </div>

            {/* ISSUE DATE */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 flex justify-between items-center shadow-sm">
              <div>
                <p className="text-[9px] font-bold uppercase text-slate-500 tracking-wider">ISSUE DATE</p>
                <p className="text-xs font-bold text-slate-900 mt-0.5">{issueDate}</p>
              </div>
              <Calendar size={16} className="text-blue-600/70" />
            </div>
          </div>

          {/* CANDIDATE */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 flex items-center gap-3 shadow-sm">
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 border border-blue-200">
              <UserIcon size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-bold uppercase text-slate-500 tracking-wider">CANDIDATE (আবেদনকারী)</p>
              <p className="text-sm font-black text-slate-900 truncate">{booking.senderName || 'N/A'}</p>
            </div>
          </div>

          {/* COUNSELOR */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 flex items-center gap-3 shadow-sm">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-200">
              <Send size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-bold uppercase text-slate-500 tracking-wider">COUNSELOR / LEADER (কাউন্সেলর)</p>
              <p className="text-sm font-black text-slate-900 truncate">{booking.recipientName || 'N/A'}</p>
            </div>
          </div>

          {/* FEE & PAYMENT TRX */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="bg-emerald-50/70 border-2 border-emerald-300 rounded-2xl p-3 shadow-sm">
              <p className="text-[9px] font-bold uppercase text-emerald-800 tracking-wider">FEE (ফি)</p>
              <p className="text-xl font-black text-emerald-600 font-mono mt-0.5">৳{booking.amount}</p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 shadow-sm">
              <div className="flex justify-between items-center">
                <p className="text-[9px] font-bold uppercase text-slate-600 tracking-wider">{booking.paymentMethod || 'BKASH'}</p>
                <span className="text-[8px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-300">VERIFIED</span>
              </div>
              <p className="text-xs font-extrabold text-slate-900 font-mono truncate mt-0.5">
                TRX: <span className="text-blue-700">{booking.trxDigit || 'N/A'}</span>
              </p>
            </div>
          </div>

          {/* PHONE / WHATSAPP */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 border border-blue-200">
                <Smartphone size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-bold uppercase text-slate-500 tracking-wider">WHATSAPP / PHONE</p>
                <p className="text-xs font-black text-slate-900 font-mono truncate">{booking.whatsappNumber || booking.senderNumber || 'N/A'}</p>
              </div>
            </div>
            <span className="text-[8px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full border border-blue-200 shrink-0">SAFE</span>
          </div>

          {/* Bottom Receipt Stamp */}
          <div className="border-t border-dashed border-slate-200 pt-3 pb-1 flex items-center justify-between text-[10px] text-slate-500">
            <div className="flex items-center gap-1.5 text-blue-700 font-bold">
              <CheckCircle2 size={14} /> OFFICIAL DIGITAL RECEIPT
            </div>
            <span className="font-mono text-[9px] text-slate-400">UNITY EARNING PLATFORM</span>
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

// ============================================================================
// --- FAKE / DEMO SEAT BOOKING MODALS (ZERO FIRESTORE / IN-MEMORY ONLY) ---
// ============================================================================

// Helper: SVG Barcode for ultra-crisp screenshot rendering
function BarcodeSVG({ value, dark = true }: { value: string; dark?: boolean }) {
  const bars = [3, 1, 2, 1, 4, 1, 2, 3, 1, 2, 4, 1, 1, 3, 2, 1, 3, 1, 2, 4, 1, 2, 3, 1, 2, 1, 4, 2, 1, 3, 1, 2, 3, 1, 4, 1, 2, 3, 1, 2];
  return (
    <div className="flex flex-col items-center">
      <div className={`flex items-center gap-[2px] h-6 px-2 ${dark ? 'bg-slate-100 rounded' : 'bg-white/5 rounded'} py-0.5`}>
        {bars.map((w, i) => (
          <div
            key={i}
            className={`h-full ${i % 2 === 0 ? (dark ? 'bg-slate-900' : 'bg-white/80') : 'bg-transparent'}`}
            style={{ width: `${w}px` }}
          />
        ))}
      </div>
      <span className={`text-[8px] font-mono tracking-widest ${dark ? 'text-slate-600' : 'text-white/50'} mt-0.5`}>{value}</span>
    </div>
  );
}

// Helper: SVG QR Code for crisp offline capture
function QRCodeSVG({ color = '#0f172a', bgColor = '#ffffff', size = 68 }: { color?: string; bgColor?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0 drop-shadow-sm">
      <rect width="64" height="64" rx="8" fill={bgColor} stroke={color} strokeOpacity="0.25" strokeWidth="1.2" />
      {/* Top Left Finder Pattern */}
      <rect x="7" y="7" width="16" height="16" rx="2" stroke={color} strokeWidth="2" fill="none" />
      <rect x="11" y="11" width="8" height="8" rx="1" fill={color} />
      {/* Top Right Finder Pattern */}
      <rect x="41" y="7" width="16" height="16" rx="2" stroke={color} strokeWidth="2" fill="none" />
      <rect x="45" y="11" width="8" height="8" rx="1" fill={color} />
      {/* Bottom Left Finder Pattern */}
      <rect x="7" y="41" width="16" height="16" rx="2" stroke={color} strokeWidth="2" fill="none" />
      <rect x="11" y="45" width="8" height="8" rx="1" fill={color} />
      {/* Data dots matrix */}
      <rect x="27" y="9" width="3" height="3" fill={color} fillOpacity="0.85" />
      <rect x="33" y="9" width="3" height="3" fill={color} fillOpacity="0.85" />
      <rect x="27" y="15" width="3" height="3" fill={color} fillOpacity="0.85" />
      <rect x="33" y="18" width="3" height="3" fill={color} fillOpacity="0.85" />
      <rect x="9" y="27" width="3" height="3" fill={color} fillOpacity="0.85" />
      <rect x="15" y="31" width="3" height="3" fill={color} fillOpacity="0.85" />
      <rect x="21" y="27" width="3" height="3" fill={color} fillOpacity="0.85" />
      <rect x="27" y="27" width="4" height="4" rx="1" fill={color} />
      <rect x="35" y="27" width="3" height="3" fill={color} fillOpacity="0.85" />
      <rect x="43" y="27" width="3" height="3" fill={color} fillOpacity="0.85" />
      <rect x="51" y="27" width="3" height="3" fill={color} fillOpacity="0.85" />
      <rect x="27" y="35" width="3" height="3" fill={color} fillOpacity="0.85" />
      <rect x="33" y="35" width="4" height="4" rx="1" fill={color} />
      <rect x="41" y="35" width="3" height="3" fill={color} fillOpacity="0.85" />
      <rect x="49" y="35" width="3" height="3" fill={color} fillOpacity="0.85" />
      <rect x="27" y="43" width="3" height="3" fill={color} fillOpacity="0.85" />
      <rect x="33" y="47" width="3" height="3" fill={color} fillOpacity="0.85" />
      <rect x="41" y="43" width="3" height="3" fill={color} fillOpacity="0.85" />
      <rect x="47" y="47" width="3" height="3" fill={color} fillOpacity="0.85" />
      <rect x="43" y="51" width="4" height="4" rx="1" fill={color} />
      <rect x="51" y="43" width="3" height="3" fill={color} fillOpacity="0.85" />
    </svg>
  );
}

// Helper: Circular Official Seal Graphic (White, Blue, Green & Slate)
function OfficialSealSVG({ text = "OFFICIAL REGISTRAR SEAL", color = "#0284c7" }: { text?: string; color?: string }) {
  return (
    <svg width="60" height="60" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0 opacity-95">
      <circle cx="40" cy="40" r="37" stroke={color} strokeWidth="1.8" strokeDasharray="3 2" />
      <circle cx="40" cy="40" r="32" stroke={color} strokeWidth="1" strokeOpacity="0.7" />
      <circle cx="40" cy="40" r="23" stroke="#059669" strokeWidth="1.2" />
      <polygon points="40,27 43,35 51,35 44,40 47,48 40,43 33,48 36,40 29,35 37,35" fill="#059669" fillOpacity="0.85" />
    </svg>
  );
}

// Helper: Official Security Verified Crest (White, Black, Blue & Green - NO "VIP SEAL" text)
function OfficialVerifiedSealSVG({ onWhite = true }: { onWhite?: boolean }) {
  return (
    <div className="relative w-13 h-13 rounded-full bg-gradient-to-br from-emerald-500 via-blue-500 to-indigo-600 p-[1.5px] shadow-md shadow-emerald-500/20 flex items-center justify-center shrink-0">
      <div className={`w-full h-full rounded-full ${onWhite ? 'bg-white border border-emerald-500/30' : 'bg-[#060c18] border border-emerald-400/30'} flex flex-col items-center justify-center p-1`}>
        <ShieldCheck size={20} className="text-emerald-600" />
        <span className={`text-[6.5px] tracking-widest uppercase font-black ${onWhite ? 'text-slate-800' : 'text-cyan-300'} leading-none mt-0.5`}>VERIFIED</span>
      </div>
    </div>
  );
}

// 1. Fake Booking Disclaimer & Selection Notice Modal (White, Black, Blue, Green Palette)
function FakeBookingDisclaimerModal({
  onClose,
  onSelectInvoice1,
  onSelectInvoice2
}: {
  onClose: () => void;
  onSelectInvoice1: () => void;
  onSelectInvoice2: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 overflow-y-auto">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/85 backdrop-blur-md" />
      
      <motion.div 
        initial={{ scale: 0.92, opacity: 0 }} 
        animate={{ scale: 1, opacity: 1 }} 
        exit={{ scale: 0.92, opacity: 0 }}
        className="relative w-full max-w-md bg-[#070b14] rounded-3xl p-5 sm:p-6 border-2 border-cyan-500/40 shadow-[0_0_35px_rgba(6,182,212,0.2)] flex flex-col gap-4 z-10 my-auto text-left"
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors">
          <XCircle size={22} />
        </button>

        {/* Header in English as requested */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 via-cyan-500 to-emerald-500 text-white flex items-center justify-center shadow-lg shadow-cyan-600/30 shrink-0">
            <Sparkles size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-black text-white">Fake Seat Book</h3>
              <span className="text-[9px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 px-1.5 py-0.5 rounded font-extrabold uppercase">DEMO</span>
            </div>
            <p className="text-xs text-white/60">ডেমো সিট বুকিং ও তাৎক্ষণিক ইনভয়েস তৈরি</p>
          </div>
        </div>

        {/* Disclaimer & Rules Box (Full Bengali Rules - Crisp White, Black, Blue & Green) */}
        <div className="bg-[#0b1220] border border-cyan-500/30 rounded-2xl p-4 space-y-2.5 text-xs text-white shadow-inner">
          <div className="flex items-center gap-2 text-cyan-300 font-extrabold text-xs">
            <ShieldCheck size={16} className="text-cyan-400 shrink-0" />
            <span>জরুরি সতর্কতা ও নির্দেশিকা (Rules & Disclaimer):</span>
          </div>

          <p className="leading-relaxed text-white/95 font-medium">
            এই সিট বুকিংটি সম্পূর্ণ <strong className="text-cyan-300 font-black">ফেইক / ডেমো</strong>। কোনো লিডকে কনভিন্স করার জন্য চাইলে ফেইক সিট বুক করে তাকে আকর্ষণীয় ইনভয়েসের স্ক্রিনশট দিতে পারেন।
          </p>

          <div className="pt-2 border-t border-white/10 space-y-2 text-[11px] text-white/80">
            <div className="flex items-start gap-2 text-emerald-300">
              <CheckCircle2 size={15} className="text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong className="text-white">১০০% নিরাপদ ও গোপনীয়:</strong> এই স্ক্রিনশট বা বুকিং কোনো রেকর্ডে স্থায়ীভাবে যুক্ত হবে না এবং অ্যাডমিনের কাছে কোনো প্রকার রিকোয়েস্ট বা নোটিফিকেশন যাবে না।
              </span>
            </div>

            <div className="flex items-start gap-2 text-cyan-200">
              <Info size={15} className="text-cyan-400 shrink-0 mt-0.5" />
              <span>
                <strong className="text-white">টাকার পরিমাণের নিয়ম:</strong> ফর্মটিতে টাকার পরিমাণ লিখলে ইনভয়েসের মধ্যে টাকার পরিমাণ শো করবে। আর যদি টাকার পরিমাণ না লেখেন, তাহলে ইনভয়েসের মধ্যে কোনো প্রকার টাকার পরিমাণ শো করবে না (অফিসিয়াল ফ্রি সিট কনফার্মেশন হিসেবে দেখাবে)।
              </span>
            </div>
          </div>
        </div>

        {/* Selection Options Header in Bengali */}
        <p className="text-xs font-bold text-white/90 pt-1">
          পছন্দ অনুযায়ী নিচের যেকোনো একটি ইনভয়েস ডিজাইন বেছে নিন:
        </p>

        {/* Two Options (Invoice 1 & Invoice 2) in Bengali */}
        <div className="space-y-2.5">
          {/* Option 1: Seat Booking Invoice 1 (Blue / Cyan Theme) */}
          <button
            onClick={onSelectInvoice1}
            className="w-full p-4 bg-gradient-to-r from-blue-950/50 via-[#0a1426] to-cyan-950/50 hover:from-blue-900/60 hover:to-cyan-900/60 border border-cyan-500/40 hover:border-cyan-400 rounded-2xl text-left flex items-center justify-between group transition-all shadow-md shadow-cyan-950/40 active:scale-98"
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-300 flex items-center justify-center border border-cyan-500/30 shrink-0">
                <FileText size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-extrabold text-white text-sm group-hover:text-cyan-300 transition-colors">সিট বুকিং ইনভয়েস ওয়ান</h4>
                  <span className="text-[9px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 px-1.5 py-0.5 rounded font-bold">টাকা ঐচ্ছিক</span>
                </div>
                <p className="text-[11px] text-white/60 truncate mt-0.5">টাকা দেওয়া যাবে বা টাকা ছাড়াও করা যাবে। অফিসিয়াল ক্যাশ মেমো ও ডিজিটাল রিসিট ডিজাইন।</p>
              </div>
            </div>
            <ChevronRight size={18} className="text-white/40 group-hover:text-white shrink-0 ml-2" />
          </button>

          {/* Option 2: Seat Booking Invoice 2 (Emerald Green / Blue Theme - No Yellow!) */}
          <button
            onClick={onSelectInvoice2}
            className="w-full p-4 bg-gradient-to-r from-emerald-950/50 via-[#06161c] to-teal-950/50 hover:from-emerald-900/60 hover:to-teal-900/60 border border-emerald-500/40 hover:border-emerald-400 rounded-2xl text-left flex items-center justify-between group transition-all shadow-md shadow-emerald-950/40 active:scale-98"
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center border border-emerald-500/30 shrink-0">
                <Award size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-extrabold text-white text-sm group-hover:text-emerald-300 transition-colors">সিট বুকিং ইনভয়েস টু</h4>
                  <span className="text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded font-bold">টাকা ছাড়া - এক্সক্লুসিভ</span>
                </div>
                <p className="text-[11px] text-white/60 truncate mt-0.5">কোনো টাকার পরিমাণ ও মিটিং কোড থাকবে না। নাম, নাম্বার, বুকিং আইডি ও বুকিং নং সমৃদ্ধ প্রিমিয়াম কার্ড।</p>
              </div>
            </div>
            <ChevronRight size={18} className="text-white/40 group-hover:text-white shrink-0 ml-2" />
          </button>
        </div>

        {/* Close Button in Bengali */}
        <button
          onClick={onClose}
          className="w-full py-3 bg-[#131926] hover:bg-[#1a2336] border border-white/10 text-white/80 hover:text-white rounded-xl text-xs font-bold transition-all text-center mt-1"
        >
          বন্ধ করুন (Close)
        </button>
      </motion.div>
    </div>
  );
}

// 2. Fake Invoice 1 Form Modal (Optional Amount - Rules & Labels in Bengali)
function FakeInvoice1FormModal({
  defaultCounselor,
  onClose,
  onBack,
  onSubmit
}: {
  defaultCounselor: string;
  onClose: () => void;
  onBack: () => void;
  onSubmit: (data: FakeInvoice1Data) => void;
}) {
  const [candidateName, setCandidateName] = useState('');
  const [candidateNumber, setCandidateNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('BKASH');
  const [senderNumber, setSenderNumber] = useState('');
  const [trxId, setTrxId] = useState(`TRX${Math.floor(100000 + Math.random() * 900000)}`);
  const [meetingCode, setMeetingCode] = useState('');
  const [bookingNo, setBookingNo] = useState(`BK-${Math.floor(1000 + Math.random() * 9000)}`);
  const [refId, setRefId] = useState(`#SB-${Math.floor(10000 + Math.random() * 90000)}`);
  const [counselorName, setCounselorName] = useState(defaultCounselor || 'Unity Official Leader');
  const [formError, setFormError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!candidateName.trim() || !candidateNumber.trim()) {
      setFormError('অনুগ্রহ করে প্রার্থীর নাম এবং মোবাইল নাম্বার লিখুন।');
      return;
    }
    const now = new Date();
    const dateFormatted = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    onSubmit({
      candidateName: candidateName.trim(),
      candidateNumber: candidateNumber.trim(),
      counselorName: counselorName.trim() || defaultCounselor || 'Unity Leader',
      bookingNo,
      refId,
      paymentMethod,
      senderNumber: senderNumber.trim() || candidateNumber.trim(),
      trxId: trxId.trim() || `TRX${Math.floor(100000 + Math.random() * 900000)}`,
      amount: amount.trim(),
      meetingCode: meetingCode.trim(),
      date: dateFormatted
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 overflow-y-auto">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/85 backdrop-blur-md" />
      
      <motion.div 
        initial={{ scale: 0.92, opacity: 0 }} 
        animate={{ scale: 1, opacity: 1 }} 
        exit={{ scale: 0.92, opacity: 0 }}
        className="relative w-full max-w-md bg-[#070b14] rounded-3xl p-5 sm:p-6 border-2 border-cyan-500/40 shadow-[0_0_35px_rgba(6,182,212,0.2)] flex flex-col gap-4 z-10 my-auto text-left"
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors">
          <XCircle size={22} />
        </button>

        {/* Top Header in Bengali */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center shrink-0">
            <FileText size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-black text-white">সিট বুকিং ইনভয়েস ওয়ান - ফর্ম</h3>
              <span className="text-[9px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 px-1.5 py-0.5 rounded font-bold">ডেমো</span>
            </div>
            <p className="text-xs text-white/50">তথ্য দিয়ে তাৎক্ষণিক ডিজিটাল ইনভয়েস রিসিট তৈরি করুন</p>
          </div>
        </div>

        {/* Amount Policy Notice in Bengali */}
        <div className="bg-[#0b1424] border border-cyan-500/30 rounded-xl p-3 text-[11px] text-cyan-100 flex items-start gap-2">
          <Info size={16} className="text-cyan-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong>টাকার পরিমাণ ঐচ্ছিক:</strong> টাকার পরিমাণ লিখলে ইনভয়েসে টাকা প্রদর্শিত হবে। আর ফাঁকা রাখলে কোনো প্রকার টাকা দেখাবে না (অফিসিয়াল ফ্রি সিট কনফার্মেশন হিসেবে দেখাবে)।
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Candidate Name */}
          <div>
            <label className="block text-xs font-bold text-white/85 mb-1">
              প্রার্থীর পুরো নাম (Candidate Name) <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={candidateName}
              onChange={(e) => setCandidateName(e.target.value)}
              placeholder="যেমন: আব্দুল্লাহ আল মামুন"
              className="w-full bg-[#0e1424] border border-white/10 focus:border-cyan-500 rounded-xl py-2.5 px-3 text-xs sm:text-sm text-white placeholder:text-white/30 focus:outline-none transition-colors"
            />
          </div>

          {/* Candidate Phone */}
          <div>
            <label className="block text-xs font-bold text-white/85 mb-1">
              মোবাইল / হোয়াটসঅ্যাপ নম্বর (Phone / WhatsApp) <span className="text-rose-400">*</span>
            </label>
            <input
              type="tel"
              required
              value={candidateNumber}
              onChange={(e) => setCandidateNumber(e.target.value)}
              placeholder="017XXXXXXXX"
              className="w-full bg-[#0e1424] border border-white/10 focus:border-cyan-500 rounded-xl py-2.5 px-3 text-xs sm:text-sm text-white placeholder:text-white/30 focus:outline-none font-mono transition-colors"
            />
          </div>

          {/* Amount (OPTIONAL) */}
          <div className="bg-[#0e1424] border border-cyan-500/20 rounded-xl p-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-cyan-300">
                টাকার পরিমাণ (ঐচ্ছিক - খালি রাখলে ফি দেখাবে না)
              </label>
              <span className="text-[10px] text-white/40">ঐচ্ছিক</span>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-xs font-bold text-emerald-400 font-mono">৳</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="যেমন: ১৫০০ (টাকা ছাড়া রাখতে খালি রাখুন)"
                className="w-full bg-[#070b14] border border-white/10 focus:border-emerald-500 rounded-lg py-2 pl-7 pr-3 text-xs sm:text-sm text-emerald-300 placeholder:text-white/30 focus:outline-none font-mono transition-colors"
              />
            </div>
          </div>

          {/* Payment Method & TrxID */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-bold text-white/70 mb-1">পেমেন্ট মাধ্যম</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full bg-[#0e1424] border border-white/10 focus:border-cyan-500 rounded-xl py-2 px-2 text-xs text-white focus:outline-none"
              >
                <option value="BKASH">bKash (বিকাশ)</option>
                <option value="NAGAD">Nagad (নগদ)</option>
                <option value="ROCKET">Rocket (রকেট)</option>
                <option value="UPAY">Upay (উপায়)</option>
                <option value="BANK">Bank Transfer (ব্যাংক)</option>
                <option value="OFFICIAL">Official Free Seat</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-white/70 mb-1">ট্রানজেকশন আইডি (TrxID)</label>
              <input
                type="text"
                value={trxId}
                onChange={(e) => setTrxId(e.target.value)}
                placeholder="TRX..."
                className="w-full bg-[#0e1424] border border-white/10 focus:border-cyan-500 rounded-xl py-2 px-2.5 text-xs text-white font-mono placeholder:text-white/30 focus:outline-none"
              />
            </div>
          </div>

          {/* Counselor Name & Meeting Code */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-bold text-white/70 mb-1">কাউন্সেলর / লিডার</label>
              <input
                type="text"
                value={counselorName}
                onChange={(e) => setCounselorName(e.target.value)}
                placeholder="লিডারের নাম"
                className="w-full bg-[#0e1424] border border-white/10 focus:border-cyan-500 rounded-xl py-2 px-2.5 text-xs text-white placeholder:text-white/30 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-white/70 mb-1">মিটিং কোড (ঐচ্ছিক)</label>
              <input
                type="text"
                value={meetingCode}
                onChange={(e) => setMeetingCode(e.target.value)}
                placeholder="যেমন: MEET-405"
                className="w-full bg-[#0e1424] border border-white/10 focus:border-cyan-500 rounded-xl py-2 px-2.5 text-xs text-white font-mono placeholder:text-white/30 focus:outline-none"
              />
            </div>
          </div>

          {formError && (
            <div className="bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-bold py-2 px-3 rounded-xl flex items-center gap-1.5">
              <AlertTriangle size={14} className="shrink-0 text-rose-400" />
              <span>{formError}</span>
            </div>
          )}

          {/* Action Buttons in Bengali */}
          <div className="grid grid-cols-2 gap-2 pt-2">
            <button
              type="button"
              onClick={onBack}
              className="py-3 bg-[#131926] hover:bg-[#1a2336] text-white/70 hover:text-white rounded-xl text-xs font-bold transition-all"
            >
              ফিরে যান (Back)
            </button>
            <button
              type="submit"
              className="py-3 bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-500 hover:opacity-95 text-white font-black text-xs rounded-xl shadow-lg shadow-cyan-500/25 transition-all flex items-center justify-center gap-1.5 active:scale-98"
            >
              <FileText size={15} /> ইনভয়েস ১ তৈরি করুন
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// 3. Fake Invoice 2 Form Modal (Emerald Green, Blue, White & Black - No Yellow!)
function FakeInvoice2FormModal({
  defaultCounselor,
  onClose,
  onBack,
  onSubmit
}: {
  defaultCounselor: string;
  onClose: () => void;
  onBack: () => void;
  onSubmit: (data: FakeInvoice2Data) => void;
}) {
  const [candidateName, setCandidateName] = useState('');
  const [candidateNumber, setCandidateNumber] = useState('');
  const [seatBookingId, setSeatBookingId] = useState(`VIP-SB-${Math.floor(10000 + Math.random() * 90000)}`);
  const [bookingNo, setBookingNo] = useState(`BK-${Math.floor(1000 + Math.random() * 9000)}`);
  const [counselorName, setCounselorName] = useState(defaultCounselor || 'Unity Official Leader');
  const [formError, setFormError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!candidateName.trim() || !candidateNumber.trim()) {
      setFormError('অনুগ্রহ করে প্রার্থীর নাম এবং মোবাইল নাম্বার লিখুন।');
      return;
    }
    const now = new Date();
    const dateFormatted = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    onSubmit({
      candidateName: candidateName.trim(),
      candidateNumber: candidateNumber.trim(),
      seatBookingId: seatBookingId.trim(),
      bookingNo: bookingNo.trim(),
      counselorName: counselorName.trim() || defaultCounselor || 'Unity Leader',
      date: dateFormatted
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 overflow-y-auto">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/85 backdrop-blur-md" />
      
      <motion.div 
        initial={{ scale: 0.92, opacity: 0 }} 
        animate={{ scale: 1, opacity: 1 }} 
        exit={{ scale: 0.92, opacity: 0 }}
        className="relative w-full max-w-md bg-[#070b14] rounded-3xl p-5 sm:p-6 border-2 border-emerald-500/40 shadow-[0_0_35px_rgba(16,185,129,0.2)] flex flex-col gap-4 z-10 my-auto text-left"
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors">
          <XCircle size={22} />
        </button>

        {/* Top Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <Award size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-black text-white">সিট বুকিং ইনভয়েস টু - ফর্ম</h3>
              <span className="text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded font-bold">এক্সক্লুসিভ</span>
            </div>
            <p className="text-xs text-white/50">টাকা ও মিটিং নম্বর ছাড়া এক্সক্লুসিভ প্রিমিয়াম সিট কার্ড</p>
          </div>
        </div>

        {/* Notice of Clean Invoice in Bengali */}
        <div className="bg-[#09151e] border border-emerald-500/30 rounded-xl p-3 text-[11px] text-emerald-100 flex items-start gap-2">
          <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong>ইনভয়েস ২-এর নিয়ম:</strong> এই ইনভয়েসের মধ্যে কোনো প্রকার টাকার পরিমাণ এবং কোনো মিটিং কোড থাকবে না। শুধুমাত্র প্রার্থীর নাম, মোবাইল নম্বর, সিট বুকিং আইডি এবং বুকিং নম্বর দিয়ে একটি অফিসিয়াল ও প্রিমিয়াম কার্ড তৈরি হবে।
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Candidate Name */}
          <div>
            <label className="block text-xs font-bold text-white/85 mb-1">
              প্রার্থীর নাম (Candidate Name) <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={candidateName}
              onChange={(e) => setCandidateName(e.target.value)}
              placeholder="যেমন: তানভীর হাসান"
              className="w-full bg-[#0d1422] border border-white/10 focus:border-emerald-500 rounded-xl py-2.5 px-3 text-xs sm:text-sm text-white placeholder:text-white/30 focus:outline-none transition-colors"
            />
          </div>

          {/* Candidate Phone */}
          <div>
            <label className="block text-xs font-bold text-white/85 mb-1">
              মোবাইল / হোয়াটসঅ্যাপ নম্বর (Phone / WhatsApp) <span className="text-rose-400">*</span>
            </label>
            <input
              type="tel"
              required
              value={candidateNumber}
              onChange={(e) => setCandidateNumber(e.target.value)}
              placeholder="018XXXXXXXX"
              className="w-full bg-[#0d1422] border border-white/10 focus:border-emerald-500 rounded-xl py-2.5 px-3 text-xs sm:text-sm text-white placeholder:text-white/30 focus:outline-none font-mono transition-colors"
            />
          </div>

          {/* Seat Booking ID & Booking No */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-bold text-white/70 mb-1">সিট বুকিং আইডি</label>
              <input
                type="text"
                value={seatBookingId}
                onChange={(e) => setSeatBookingId(e.target.value)}
                className="w-full bg-[#0d1422] border border-white/10 focus:border-emerald-500 rounded-xl py-2 px-2.5 text-xs text-emerald-300 font-mono focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-white/70 mb-1">বুকিং নম্বর (Booking No)</label>
              <input
                type="text"
                value={bookingNo}
                onChange={(e) => setBookingNo(e.target.value)}
                className="w-full bg-[#0d1422] border border-white/10 focus:border-emerald-500 rounded-xl py-2 px-2.5 text-xs text-white font-mono focus:outline-none"
              />
            </div>
          </div>

          {/* Counselor Name */}
          <div>
            <label className="block text-[11px] font-bold text-white/70 mb-1">কাউন্সেলর / রেফারেন্স মেম্বার</label>
            <input
              type="text"
              value={counselorName}
              onChange={(e) => setCounselorName(e.target.value)}
              placeholder="কাউন্সেলরের নাম"
              className="w-full bg-[#0d1422] border border-white/10 focus:border-emerald-500 rounded-xl py-2 px-2.5 text-xs text-white focus:outline-none"
            />
          </div>

          {formError && (
            <div className="bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-bold py-2 px-3 rounded-xl flex items-center gap-1.5">
              <AlertTriangle size={14} className="shrink-0 text-rose-400" />
              <span>{formError}</span>
            </div>
          )}

          {/* Action Buttons in Bengali */}
          <div className="grid grid-cols-2 gap-2 pt-2">
            <button
              type="button"
              onClick={onBack}
              className="py-3 bg-[#131926] hover:bg-[#1a2336] text-white/70 hover:text-white rounded-xl text-xs font-bold transition-all"
            >
              ফিরে যান (Back)
            </button>
            <button
              type="submit"
              className="py-3 bg-gradient-to-r from-emerald-600 via-teal-600 to-blue-600 hover:opacity-95 text-white font-black text-xs rounded-xl shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center gap-1.5 active:scale-98"
            >
              <Award size={15} /> ইনভয়েস ২ তৈরি করুন
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// 4. Fake Invoice 1 Modal (White, Black, Blue, Green Corporate Digital Fee & Seat Voucher)
function FakeInvoice1Modal({
  data,
  onClose,
  onBackToOptions
}: {
  data: FakeInvoice1Data;
  onClose: () => void;
  onBackToOptions: () => void;
}) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const hasAmount = data.amount && data.amount.trim() !== '' && Number(data.amount) > 0;

  const handleDownload = async () => {
    if (!receiptRef.current) return;
    setDownloading(true);
    try {
      const dataUrl = await toPng(receiptRef.current, {
        cacheBust: true,
        pixelRatio: 2.5,
        backgroundColor: '#ffffff',
      });
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `Seat_Booking_Invoice1_${data.bookingNo.replace(/[^a-zA-Z0-9]/g, '_')}.png`;
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
      
      <div className="relative w-full max-w-sm z-10 my-auto flex flex-col gap-2.5">
        {/* Visual Capture Receipt Container (Corporate White Background, Black Text, Blue/Green Accents) */}
        <motion.div 
          ref={receiptRef}
          initial={{ scale: 0.95, opacity: 0 }} 
          animate={{ scale: 1, opacity: 1 }} 
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="w-full bg-white rounded-2xl p-3.5 sm:p-4 border-2 border-slate-200/90 shadow-2xl flex flex-col gap-2 relative overflow-hidden text-left text-slate-900"
        >
          {/* Top Multi-Color Corporate Stripe (Blue -> Cyan -> Emerald) */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-600 via-sky-500 to-emerald-500" />

          {/* Official Enterprise Header */}
          <div className="flex items-center justify-between pb-2 border-b border-slate-200 pt-0.5">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 via-sky-500 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0">
                <Shield size={20} />
              </div>
              <div>
                <h2 className="text-sm font-black text-slate-900 tracking-wider flex items-center gap-1">
                  UNITY EARNING
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping inline-block" />
                </h2>
                <p className="text-[8px] font-extrabold text-blue-700 tracking-widest uppercase">
                  OFFICIAL SEAT ALLOCATION RECEIPT
                </p>
              </div>
            </div>
            <div className="text-right flex flex-col items-end">
              <span className="text-[8px] font-black text-emerald-800 bg-emerald-50 border border-emerald-300 px-2 py-0.5 rounded-full uppercase tracking-wider shadow-sm flex items-center gap-1">
                <CheckCircle2 size={10} className="text-emerald-600" /> CONFIRMED
              </span>
              <span className="text-[7.5px] font-mono text-slate-400 mt-0.5">VERIFIED REGISTRATION</span>
            </div>
          </div>

          {/* Barcode & Reference Tag Row */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-2 flex items-center justify-between shadow-sm">
            <div className="space-y-0.5">
              <p className="text-[7.5px] font-black uppercase text-blue-700 tracking-wider">BOOKING SERIAL</p>
              <p className="text-xs font-mono font-black text-slate-900 tracking-wide">{data.bookingNo}</p>
            </div>
            <BarcodeSVG value={data.refId} dark={true} />
          </div>

          {/* Booking ID & Issue Date Grid */}
          <div className="grid grid-cols-2 gap-1.5">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-2">
              <p className="text-[7.5px] font-bold uppercase text-slate-500 tracking-wider">REF / BOOKING ID</p>
              <p className="text-[11px] font-black text-blue-700 font-mono mt-0.5">{data.refId}</p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-2 flex justify-between items-center">
              <div>
                <p className="text-[7.5px] font-bold uppercase text-slate-500 tracking-wider">ISSUE DATE & TIME</p>
                <p className="text-[10px] font-bold text-slate-900 mt-0.5">{data.date}</p>
              </div>
              <Calendar size={14} className="text-blue-600/70 shrink-0" />
            </div>
          </div>

          {/* Candidate Profile Details Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 space-y-1.5 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 border border-blue-200">
                  <UserIcon size={12} />
                </div>
                <div>
                  <p className="text-[7.5px] font-bold uppercase text-slate-500 tracking-wider">CANDIDATE (প্রার্থী)</p>
                  <p className="text-xs font-black text-slate-900 leading-tight">{data.candidateName}</p>
                </div>
              </div>
              <span className="text-[7.5px] font-black uppercase bg-blue-100 text-blue-800 border border-blue-200 px-1.5 py-0.5 rounded-md">
                ADMITTED
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1.5 pt-0.5 text-xs">
              <div className="flex items-center gap-1">
                <Smartphone size={12} className="text-blue-600 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[7.5px] text-slate-500 uppercase font-semibold">WHATSAPP / PHONE</p>
                  <p className="text-[10px] font-mono font-bold text-slate-900 truncate">{data.candidateNumber}</p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <Send size={12} className="text-emerald-600 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[7.5px] text-slate-500 uppercase font-semibold">COUNSELOR</p>
                  <p className="text-[10px] font-bold text-slate-900 truncate">{data.counselorName}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Financial Breakdown Section (Conditional on Amount - Green Highlight on White) */}
          {hasAmount ? (
            <div className="bg-emerald-50/70 border-2 border-emerald-300 rounded-xl p-2 space-y-1 shadow-sm">
              <div className="flex items-center justify-between text-[8px] font-bold uppercase text-slate-600 border-b border-emerald-200 pb-1">
                <span>RESERVATION & ADMISSION FEE</span>
                <span className="text-emerald-700 font-black">STATUS: PAID</span>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[8px] text-slate-600 uppercase font-mono">GATEWAY: <strong className="text-slate-900">{data.paymentMethod}</strong></p>
                  <p className="text-[11px] font-mono text-blue-700 font-bold mt-0.5">TRX: {data.trxId}</p>
                </div>
                <div className="text-right">
                  <p className="text-[7.5px] font-bold uppercase text-emerald-800">TOTAL AMOUNT PAID</p>
                  <p className="text-xl font-black text-emerald-600 font-mono mt-0.5">৳{data.amount}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-emerald-50/70 border border-emerald-300 rounded-xl p-2 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-300">
                  <CheckCircle2 size={16} />
                </div>
                <div>
                  <p className="text-[7.5px] font-black uppercase text-emerald-800 tracking-wider">SEAT ALLOCATION</p>
                  <p className="text-[11px] font-bold text-slate-900 mt-0.5">Special Corporate Confirmed Pass</p>
                </div>
              </div>
              <span className="text-[8px] font-black text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-lg">
                FEE WAIVED
              </span>
            </div>
          )}

          {/* Meeting Code Badge if entered */}
          {data.meetingCode && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-1.5 flex items-center justify-between text-xs font-mono">
              <span className="text-blue-800 font-bold text-[9px]">AUTHORIZED SESSION CODE:</span>
              <span className="font-black text-white bg-blue-600 px-2 py-0.5 rounded text-[10px] shadow-sm">
                {data.meetingCode}
              </span>
            </div>
          )}

          {/* Security & Digital Signature Footer */}
          <div className="border-t border-dashed border-slate-200 pt-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <QRCodeSVG color="#0f172a" bgColor="#ffffff" size={46} />
              <div className="space-y-0.5">
                <p className="text-[7.5px] font-black uppercase text-slate-900 tracking-widest">DIGITAL AUTHENTICITY</p>
                <p className="text-[7.5px] text-slate-500 leading-tight">Scan QR code to verify seat confirmation in system</p>
                <p className="text-[6.5px] text-slate-400 font-mono">SECURE HASH: {data.bookingNo}</p>
              </div>
            </div>

            {/* Official Circular Seal */}
            <div className="flex flex-col items-center shrink-0 pl-1">
              <OfficialSealSVG color="#0284c7" />
              <span className="text-[6.5px] font-bold text-blue-800 tracking-tighter uppercase mt-0.5">OFFICIAL SEAL</span>
            </div>
          </div>

          {/* Anti-Fraud Disclaimer Stamp */}
          <div className="text-center pt-0.5 border-t border-slate-100">
            <p className="text-[7px] text-slate-400 tracking-wider uppercase font-semibold">
              OFFICIAL DIGITAL SEAT RECEIPT • VALIDATED BY REGISTRAR OFFICE • NO MANUAL SIGNATURE NEEDED
            </p>
          </div>
        </motion.div>

        {/* Download Success Banner */}
        {downloadSuccess && (
          <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold py-2 px-3 rounded-xl text-center flex items-center justify-center gap-2">
            <CheckCircle2 size={16} /> ইনভয়েস ১ সফলভাবে ডাউনলোড হয়েছে!
          </motion.div>
        )}

        {/* Action Buttons in Bengali */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onClose}
            className="py-2.5 bg-[#121826] hover:bg-[#1a2336] border border-white/10 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 active:scale-98"
          >
            <XCircle size={15} className="text-white/60" /> বন্ধ করুন (Close)
          </button>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="py-2.5 bg-gradient-to-r from-blue-600 via-sky-500 to-emerald-500 hover:opacity-95 text-white font-black text-xs rounded-xl shadow-xl shadow-blue-500/30 transition-all flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50"
          >
            {downloading ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ডাউনলোড হচ্ছে...
              </>
            ) : (
              <>
                <Download size={15} /> ডাউনলোড রিসিট (PNG)
              </>
            )}
          </button>
        </div>

        {/* Back to Options button */}
        <button
          onClick={onBackToOptions}
          className="w-full py-1.5 bg-transparent hover:bg-white/5 text-white/50 hover:text-white/80 rounded-xl text-[10.5px] font-semibold transition-all text-center"
        >
          আরেকটি ফেক ইনভয়েস তৈরি করুন (Create Another)
        </button>
      </div>
    </div>
  );
}

// 5. Fake Invoice 2 Modal (White, Black, Blue & Green Palette - NO Yellow, NO "VIP SEAL" text)
function FakeInvoice2Modal({
  data,
  onClose,
  onBackToOptions
}: {
  data: FakeInvoice2Data;
  onClose: () => void;
  onBackToOptions: () => void;
}) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const handleDownload = async () => {
    if (!receiptRef.current) return;
    setDownloading(true);
    try {
      const dataUrl = await toPng(receiptRef.current, {
        cacheBust: true,
        pixelRatio: 2.5,
        backgroundColor: '#ffffff',
      });
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `Seat_Booking_Invoice2_${data.bookingNo.replace(/[^a-zA-Z0-9]/g, '_')}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to capture invoice 2:', err);
      window.print();
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 overflow-y-auto">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/85 backdrop-blur-md" />
      
      <div className="relative w-full max-w-sm z-10 my-auto flex flex-col gap-2.5">
        {/* Luxury Executive Pass: Corporate White Background, Black Text, Emerald/Blue Accents (NO Yellow, NO Amount, NO Meeting Number) */}
        <motion.div 
          ref={receiptRef}
          initial={{ scale: 0.95, opacity: 0 }} 
          animate={{ scale: 1, opacity: 1 }} 
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="w-full bg-white rounded-2xl p-3.5 sm:p-4 border-2 border-emerald-500/30 shadow-2xl flex flex-col gap-2 relative overflow-hidden text-left text-slate-900"
        >
          {/* Top Multi-Color Accent Stripe: Royal Blue to Emerald Green */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-600 via-teal-500 to-emerald-500" />

          {/* Inner Emerald Ornate Border */}
          <div className="absolute inset-1 rounded-[18px] border border-emerald-100 pointer-events-none" />

          {/* Official Emblem & Professional Header */}
          <div className="flex flex-col items-center text-center pt-1 pb-1.5 border-b border-slate-200 relative">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 via-teal-500 to-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-500/20 mb-1 p-2">
              <ShieldCheck size={22} className="text-white drop-shadow-sm" />
            </div>
            
            <h2 className="text-sm font-black text-slate-900 tracking-wider uppercase">
              UNITY EARNING PLATFORM
            </h2>
            <p className="text-[9px] font-black text-emerald-700 tracking-widest uppercase mt-0.5">
              OFFICIAL SEAT ALLOCATION PASS
            </p>

            <div className="inline-flex items-center gap-1 bg-emerald-50 border border-emerald-300 px-2.5 py-0.5 rounded-full mt-1 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
              <span className="text-[8px] font-black text-emerald-800 tracking-wider uppercase">
                VERIFIED ADMISSION PASS
              </span>
            </div>
          </div>

          {/* Candidate Name Spotlight Card */}
          <div className="bg-gradient-to-r from-blue-50/80 via-slate-50 to-emerald-50/80 border border-emerald-200/80 rounded-xl p-2.5 text-center shadow-sm relative overflow-hidden">
            <p className="text-[7.5px] font-black uppercase text-emerald-800 tracking-widest">THIS CERTIFIES OFFICIAL SEAT ALLOTMENT TO</p>
            <h3 className="text-lg font-black text-slate-900 mt-0.5 tracking-tight">
              {data.candidateName}
            </h3>
          </div>

          {/* 4 Core Mandated Parameters in Symmetric 2x2 Grid */}
          <div className="grid grid-cols-2 gap-2">
            {/* 1. SEAT BOOKING ID */}
            <div className="bg-slate-50 border border-blue-200 rounded-xl p-2 shadow-sm">
              <div className="flex items-center gap-1">
                <ShieldCheck size={12} className="text-blue-600" />
                <p className="text-[7.5px] font-black uppercase text-blue-700 tracking-wider">SEAT BOOKING ID</p>
              </div>
              <p className="text-[11px] font-black text-blue-900 font-mono mt-0.5 truncate">{data.seatBookingId}</p>
            </div>

            {/* 2. BOOKING NO */}
            <div className="bg-slate-50 border border-emerald-200 rounded-xl p-2 shadow-sm">
              <div className="flex items-center gap-1">
                <FileText size={12} className="text-emerald-600" />
                <p className="text-[7.5px] font-black uppercase text-emerald-700 tracking-wider">BOOKING NO</p>
              </div>
              <p className="text-[11px] font-black text-slate-900 font-mono mt-0.5 truncate">{data.bookingNo}</p>
            </div>

            {/* 3. PHONE / WHATSAPP NUMBER */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-2 shadow-sm">
              <div className="flex items-center gap-1">
                <Smartphone size={12} className="text-blue-600" />
                <p className="text-[7.5px] font-black uppercase text-slate-600 tracking-wider">PHONE / WHATSAPP</p>
              </div>
              <p className="text-[11px] font-bold text-slate-900 font-mono mt-0.5 truncate">{data.candidateNumber}</p>
            </div>

            {/* 4. COUNSELOR / REFERENCE */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-2 shadow-sm">
              <div className="flex items-center gap-1">
                <Send size={12} className="text-teal-600" />
                <p className="text-[7.5px] font-black uppercase text-slate-600 tracking-wider">COUNSELOR</p>
              </div>
              <p className="text-[11px] font-bold text-slate-900 truncate mt-0.5">{data.counselorName}</p>
            </div>
          </div>

          {/* Security & Verification Ribbon */}
          <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-2 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-1.5">
              <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
              <div>
                <p className="text-[7.5px] font-black text-emerald-900 uppercase tracking-wider">REGISTRATION VERIFIED</p>
                <p className="text-[8.5px] text-slate-600 font-mono">{data.date}</p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[8px] font-black text-white bg-emerald-600 px-2 py-0.5 rounded-full uppercase shadow-sm">
                100% VALID SEAT
              </span>
            </div>
          </div>

          {/* Security Seal & QR Code Footer */}
          <div className="pt-1.5 border-t border-dashed border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <QRCodeSVG color="#0f172a" bgColor="#ffffff" size={46} />
              <div className="space-y-0.5">
                <p className="text-[7.5px] font-black uppercase text-emerald-800 tracking-wider">OFFICIAL QR VERIFICATION</p>
                <p className="text-[7.5px] text-slate-500">Exclusive Admission Card</p>
                <p className="text-[6.5px] text-blue-700 font-mono">SEAT: {data.seatBookingId}</p>
              </div>
            </div>

            {/* Official Security Crest */}
            <OfficialVerifiedSealSVG onWhite={true} />
          </div>

          {/* Bottom Security Tag */}
          <div className="text-center pt-0.5 border-t border-slate-100 mt-0.5">
            <p className="text-[7px] text-slate-400 uppercase tracking-widest font-semibold">
              UNITY OFFICIAL SYSTEM • DIGITALLY VERIFIED SEAT CERTIFICATE
            </p>
          </div>
        </motion.div>

        {/* Download Success Banner */}
        {downloadSuccess && (
          <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold py-2 px-3 rounded-xl text-center flex items-center justify-center gap-2">
            <CheckCircle2 size={16} /> ইনভয়েস ২ সফলভাবে ডাউনলোড হয়েছে!
          </motion.div>
        )}

        {/* Action Buttons in Bengali */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onClose}
            className="py-3 bg-[#121826] hover:bg-[#1a2336] border border-white/10 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 active:scale-98"
          >
            <XCircle size={16} className="text-white/60" /> বন্ধ করুন (Close)
          </button>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="py-3 bg-gradient-to-r from-emerald-600 via-teal-500 to-blue-600 hover:opacity-95 text-white font-black text-xs rounded-xl shadow-xl shadow-emerald-500/30 transition-all flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50"
          >
            {downloading ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ডাউনলোড হচ্ছে...
              </>
            ) : (
              <>
                <Download size={16} /> ডাউনলোড ইনভয়েস ২ (PNG)
              </>
            )}
          </button>
        </div>

        {/* Back to Options button */}
        <button
          onClick={onBackToOptions}
          className="w-full py-2 bg-transparent hover:bg-white/5 text-white/50 hover:text-white/80 rounded-xl text-[11px] font-semibold transition-all text-center"
        >
          আরেকটি ফেক ইনভয়েস তৈরি করুন (Create Another)
        </button>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md overflow-hidden p-0 sm:p-4 md:p-6">
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/80 backdrop-blur-md" 
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.98 }} 
        animate={{ opacity: 1, scale: 1 }} 
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.2 }}
        className="relative w-full h-full sm:h-[92vh] sm:max-w-2xl lg:max-w-3xl bg-[#0a0d16] sm:rounded-3xl border-0 sm:border sm:border-white/10 shadow-2xl flex flex-col z-10 overflow-hidden"
      >
        {/* Top Glow Accent Bar */}
        <div className="h-1 w-full bg-gradient-to-r from-cyan-500 via-amber-500 to-purple-500 shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-white/10 bg-[#0c101c]/80 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center text-cyan-400 shrink-0 shadow-inner">
              <HistoryIcon size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
                  অনুরোধের ইতিহাস
                </h2>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                  {userFiltered.length} Records
                </span>
              </div>
              <p className="text-xs text-white/50 font-medium">My Request History & Statements</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 sm:p-2.5 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white rounded-xl transition-all border border-white/5 hover:border-white/10 active:scale-95"
            title="Close"
          >
            <XCircle size={22} />
          </button>
        </div>

        {/* Section Segment Tabs: 3 Tabs (Seat, Sure Shot, Withdraw) */}
        <div className="px-4 sm:px-6 pt-3 pb-2 shrink-0">
          <div className="grid grid-cols-3 bg-[#121624] p-1.5 rounded-2xl border border-white/10 gap-1.5 shadow-inner">
            <button 
              onClick={() => setSubTab('seat_booking')}
              className={`py-2.5 px-2 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-1.5 ${
                subTab === 'seat_booking' 
                  ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm' 
                  : 'text-white/40 hover:text-white/80'
              }`}
            >
              <Sparkles size={14} className="shrink-0" />
              <span>Seat ({seatBookings.length})</span>
            </button>
            <button 
              onClick={() => setSubTab('sure_shot')}
              className={`py-2.5 px-2 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-1.5 ${
                subTab === 'sure_shot' 
                  ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-300 border border-amber-500/40 shadow-sm' 
                  : 'text-white/40 hover:text-white/80'
              }`}
            >
              <Zap size={14} className="shrink-0" />
              <span>Sure Shot ({sureShotBookings.length})</span>
            </button>
            <button 
              onClick={() => setSubTab('withdraw')}
              className={`py-2.5 px-2 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-1.5 ${
                subTab === 'withdraw' 
                  ? 'bg-gradient-to-r from-indigo-500/20 to-purple-500/20 text-indigo-300 border border-indigo-500/40 shadow-sm' 
                  : 'text-white/40 hover:text-white/80'
              }`}
            >
              <Banknote size={14} className="shrink-0" />
              <span>Withdraw ({withdraws.length})</span>
            </button>
          </div>
        </div>

        {/* History Item List */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-2 space-y-4 custom-scrollbar">
          {filteredHistory.map(req => {
            const formattedDate = req.createdAt?.toDate 
              ? req.createdAt.toDate().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
              : 'Just now';

            // Custom Card for Sure Shot Pre-Booking
            if (req.type === 'sure_shot') {
              return (
                <div key={req.id} className="bg-[#121626]/90 p-4 sm:p-5 rounded-2xl border border-amber-500/20 space-y-3.5 shadow-lg hover:border-amber-500/40 transition-all">
                  {/* Top Badge Row */}
                  <div className="flex items-center justify-between pb-2.5 border-b border-white/5 flex-wrap gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-black uppercase text-amber-400 bg-amber-500/15 px-2.5 py-1 rounded-lg border border-amber-500/30 flex items-center gap-1.5">
                        <Zap size={12} /> Sure Shot Pre-Booking
                      </span>
                      <span className="text-[11px] font-black px-2.5 py-1 rounded-lg bg-white/10 text-white border border-white/10">
                        বুকিং #{req.bookingSequence || 1}
                      </span>
                    </div>
                    <Badge status={req.status || 'pending'} />
                  </div>

                  {/* 6-Hour Live Reverse Countdown Timer */}
                  <div className="flex items-center justify-between bg-[#080b13] p-3 rounded-xl border border-amber-500/25 shadow-inner">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                      <Clock size={14} className="text-amber-400" />
                      <span>পেমেন্ট বাকি সময়:</span>
                    </div>
                    <CountdownTimer createdAt={req.createdAt} expiresAt={req.expiresAt} variant="compact" />
                  </div>

                  {/* Main Info Box - Clean, Spacious, No designation clutter */}
                  <div className="flex justify-between items-start gap-4">
                    <div className="space-y-1.5 min-w-0">
                      <h3 className="font-extrabold text-white text-base sm:text-lg truncate">
                        {req.senderName || req.recipientName || 'Sure Shot Applicant'}
                      </h3>
                      
                      {req.studentId && (
                        <p className="text-xs text-amber-300 font-mono">
                          <span className="text-white/40 font-sans font-medium">Student ID:</span> <strong>{req.studentId}</strong>
                        </p>
                      )}

                      {(req.whatsappNumber || req.senderNumber) && (
                        <p className="text-xs text-emerald-400 font-mono flex items-center gap-1">
                          <Smartphone size={12} className="text-emerald-400 shrink-0" />
                          <span>{req.whatsappNumber || req.senderNumber}</span>
                        </p>
                      )}

                      {req.senderName && req.recipientName && req.senderName !== req.recipientName && (
                        <p className="text-xs text-white/60">
                          Assigned: <span className="text-white/90 font-semibold">{req.recipientName}</span>
                        </p>
                      )}
                      
                      <p className="text-xs text-white/40 font-mono flex items-center gap-1.5 pt-0.5">
                        <Clock size={12} className="text-white/30" /> {formattedDate}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">BOOKING ID</p>
                      <p className="font-mono font-black text-sm sm:text-base text-amber-400">{req.refId}</p>
                    </div>
                  </div>

                  {/* Invoice View Button */}
                  {onSelectSureShotInvoice && (
                    <button
                      onClick={() => onSelectSureShotInvoice(req)}
                      className="w-full py-3 bg-gradient-to-r from-amber-500/15 via-orange-500/15 to-amber-500/15 hover:from-amber-500/25 hover:to-orange-500/25 text-amber-300 border border-amber-500/30 rounded-xl text-xs sm:text-sm font-extrabold transition-all flex items-center justify-center gap-2 active:scale-98 shadow-sm"
                    >
                      <FileText size={16} /> View & Download Invoice (ইনভয়েস দেখুন ও ডাউনলোড)
                    </button>
                  )}
                </div>
              );
            }

            // Custom Card for Seat Booking
            if (req.type === 'seat_booking') {
              return (
                <div key={req.id} className="bg-[#121626]/90 p-4 sm:p-5 rounded-2xl border border-cyan-500/20 space-y-3.5 shadow-lg hover:border-cyan-500/40 transition-all">
                  {/* Top Badge Row */}
                  <div className="flex items-center justify-between pb-2.5 border-b border-white/5 flex-wrap gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-black uppercase text-cyan-400 bg-cyan-500/15 px-2.5 py-1 rounded-lg border border-cyan-500/30 flex items-center gap-1.5">
                        <Sparkles size={12} /> Seat Booking
                      </span>
                      {req.paymentMethod && (
                        <span className={`text-[11px] font-black px-2.5 py-1 rounded-lg border ${getPaymentBrandStyle(req.paymentMethod)}`}>
                          {req.paymentMethod}
                        </span>
                      )}
                    </div>
                    <Badge status={req.status || 'pending'} />
                  </div>

                  {/* Main Info Box */}
                  <div className="flex justify-between items-start gap-4">
                    <div className="space-y-1.5 min-w-0">
                      <h3 className="font-extrabold text-white text-base sm:text-lg truncate">
                        {req.senderName || req.recipientName || 'Seat Applicant'}
                      </h3>
                      
                      {req.senderName && req.recipientName && req.senderName !== req.recipientName && (
                        <p className="text-xs text-white/60">
                          Assigned: <span className="text-white/90 font-semibold">{req.recipientName}</span>
                        </p>
                      )}
                      
                      <p className="text-xs text-white/40 font-mono flex items-center gap-1.5 pt-0.5">
                        <Clock size={12} className="text-white/30" /> {formattedDate}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">FEE / AMOUNT</p>
                      <p className="font-mono font-black text-lg sm:text-xl text-emerald-400">৳{req.amount}</p>
                    </div>
                  </div>

                  {/* Trx & Contact Details Box */}
                  {(req.trxDigit || req.whatsappNumber || req.senderNumber) && (
                    <div className="bg-[#080b13] p-3 rounded-xl text-xs text-white/80 font-mono border border-white/5 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {req.trxDigit && (
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-white/50">Trx ID / Digit:</span>
                          <strong className="text-cyan-300 tracking-wider">{req.trxDigit}</strong>
                        </div>
                      )}
                      {(req.whatsappNumber || req.senderNumber) && (
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-white/50">WhatsApp / Phone:</span>
                          <strong className="text-emerald-300">{req.whatsappNumber || req.senderNumber}</strong>
                        </div>
                      )}
                    </div>
                  )}

                  {req.note && (
                    <p className="text-xs text-white/70 italic bg-[#080b13] p-3 rounded-xl border border-white/5">
                      "{req.note}"
                    </p>
                  )}

                  {/* Receipt Trigger Button */}
                  {onSelectInvoice && (
                    <button
                      onClick={() => onSelectInvoice(req)}
                      className="w-full py-3 bg-gradient-to-r from-cyan-500/15 to-blue-500/15 hover:from-cyan-500/25 hover:to-blue-500/25 text-cyan-300 border border-cyan-500/30 rounded-xl text-xs sm:text-sm font-extrabold transition-all flex items-center justify-center gap-2 active:scale-98 shadow-sm"
                    >
                      <FileText size={16} /> View & Download Invoice Receipt (ইনভয়েস দেখুন)
                    </button>
                  )}
                </div>
              );
            }

            // Custom Card for Withdrawal
            return (
              <div key={req.id} className="bg-[#121626]/90 p-4 sm:p-5 rounded-2xl border border-indigo-500/20 space-y-3.5 shadow-lg hover:border-indigo-500/40 transition-all">
                {/* Top Badge Row */}
                <div className="flex items-center justify-between pb-2.5 border-b border-white/5 flex-wrap gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-black uppercase text-indigo-300 bg-indigo-500/15 px-2.5 py-1 rounded-lg border border-indigo-500/30 flex items-center gap-1.5">
                      <Banknote size={12} /> Withdrawal Request
                    </span>
                    {req.paymentMethod && (
                      <span className={`text-[11px] font-black px-2.5 py-1 rounded-lg border ${getPaymentBrandStyle(req.paymentMethod)}`}>
                        {req.paymentMethod}
                      </span>
                    )}
                  </div>
                  <Badge status={req.status || 'pending'} />
                </div>

                {/* Main Info Box */}
                <div className="flex justify-between items-start gap-4">
                  <div className="space-y-1.5 min-w-0">
                    <h3 className="font-extrabold text-white text-base sm:text-lg truncate">
                      {req.senderName || req.recipientName || 'Withdrawal'}
                    </h3>
                    <p className="text-xs text-white/40 font-mono flex items-center gap-1.5 pt-0.5">
                      <Clock size={12} className="text-white/30" /> {formattedDate}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">WITHDRAW AMOUNT</p>
                    <p className="font-mono font-black text-lg sm:text-xl text-emerald-400">৳{req.amount}</p>
                  </div>
                </div>

                {/* Trx & Contact Details Box */}
                {(req.trxDigit || req.whatsappNumber || req.senderNumber) && (
                  <div className="bg-[#080b13] p-3 rounded-xl text-xs text-white/80 font-mono border border-white/5 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {req.trxDigit && (
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-white/50">Trx / Account:</span>
                        <strong className="text-indigo-300 tracking-wider">{req.trxDigit}</strong>
                      </div>
                    )}
                    {(req.whatsappNumber || req.senderNumber) && (
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-white/50">Phone / Number:</span>
                        <strong className="text-emerald-300">{req.whatsappNumber || req.senderNumber}</strong>
                      </div>
                    )}
                  </div>
                )}

                {req.note && (
                  <p className="text-xs text-white/70 italic bg-[#080b13] p-3 rounded-xl border border-white/5">
                    "{req.note}"
                  </p>
                )}
              </div>
            );
          })}

          {filteredHistory.length === 0 && (
            <div className="text-center py-20 text-white/30 text-xs space-y-3">
              <div className="w-16 h-16 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-white/20">
                <HistoryIcon size={36} />
              </div>
              <p className="font-extrabold text-sm text-white/50">কোন রেকর্ড পাওয়া যায়নি (No Records Found)</p>
              <p className="text-xs text-white/30 max-w-xs mx-auto">
                Your {subTab === 'seat_booking' ? 'seat booking' : subTab === 'sure_shot' ? 'sure shot pre-booking' : 'withdrawal'} requests will appear here
              </p>
            </div>
          )}
        </div>

        {/* Bottom Close Button */}
        <div className="p-4 sm:px-6 border-t border-white/10 bg-[#0c101c]/80 backdrop-blur-sm mt-auto shrink-0">
          <button 
            type="button"
            onClick={onClose}
            className="w-full py-3.5 bg-gradient-to-r from-white/10 to-white/5 hover:from-white/15 hover:to-white/10 active:scale-98 text-white font-black text-sm rounded-2xl border border-white/10 hover:border-white/20 transition-all flex items-center justify-center gap-2 shadow-lg"
          >
            <XCircle size={18} className="text-white/60" /> CLOSE (বন্ধ করুন)
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
  const [memberToDelete, setMemberToDelete] = useState<TeamMember | null>(null);
  const [deletingMember, setDeletingMember] = useState(false);

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
                      onClick={(e) => {
                        e.stopPropagation();
                        setMemberToDelete(member);
                      }}
                      className="p-2 flex items-center justify-center rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-all active:scale-95"
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
        {memberToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#18181b] border border-white/10 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl"
            >
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
                <Trash2 size={24} />
              </div>
              <div className="text-center space-y-1">
                <h3 className="text-lg font-bold text-white">মেম্বার মুছে ফেলবেন?</h3>
                <p className="text-xs text-white/60">
                  আপনি কি নিশ্চিত যে <span className="text-white font-semibold">{memberToDelete.name}</span> ({memberToDelete.role === 'leader' ? 'Team Leader' : 'Trainer'}) কে তালিকা থেকে স্থায়ীভাবে ডিলিট করতে চান?
                </p>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  disabled={deletingMember}
                  onClick={() => setMemberToDelete(null)}
                  className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white font-semibold text-xs transition-all"
                >
                  বাতিল (Cancel)
                </button>
                <button
                  type="button"
                  disabled={deletingMember}
                  onClick={async () => {
                    setDeletingMember(true);
                    try {
                      await deleteDoc(doc(db, 'teamMembers', memberToDelete.id));
                      setMemberToDelete(null);
                    } catch (err) {
                      console.error('Delete member error:', err);
                      handleFirestoreError(err, OperationType.DELETE, `teamMembers/${memberToDelete.id}`);
                    } finally {
                      setDeletingMember(false);
                    }
                  }}
                  className="flex-1 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-rose-600/30"
                >
                  {deletingMember ? (
                    <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Trash2 size={14} />
                      ডিলিট করুন
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
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
      <div className="space-y-3.5 max-h-[55vh] overflow-y-auto pr-1 custom-scrollbar">
        {finalFiltered.map(req => {
          const dateObj = req.createdAt?.toDate ? req.createdAt.toDate() : null;
          const formattedDate = dateObj 
            ? dateObj.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) 
            : 'Today';
          const formattedTime = dateObj 
            ? dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) 
            : '';
          const candidateName = req.senderName || req.recipientName || 'Sure Shot Applicant';
          const assignedLeader = req.senderName && req.recipientName && req.senderName !== req.recipientName ? req.recipientName : null;

          return (
            <div key={req.id} className="bg-[#18181f] p-4 rounded-2xl border border-white/10 hover:border-amber-500/40 transition-all space-y-3 shadow-md">
              {/* Top Row: Sequence, ID, Status & Timer */}
              <div className="flex items-center justify-between gap-2 flex-wrap border-b border-white/5 pb-2.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-black uppercase text-amber-400 bg-amber-500/15 px-2.5 py-1 rounded-lg border border-amber-500/30 flex items-center gap-1">
                    <Zap size={11} className="text-amber-400" />
                    <span>#{req.bookingSequence || 1}</span>
                  </span>
                  <span className="text-[10px] font-black font-mono px-2 py-0.5 rounded-lg bg-white/5 text-white/80 border border-white/10">
                    {req.refId}
                  </span>
                  <Badge status={req.status} />
                </div>

                {/* Live Timer */}
                <div className="shrink-0">
                  <CountdownTimer createdAt={req.createdAt} expiresAt={req.expiresAt} variant="admin" />
                </div>
              </div>

              {/* Main Candidate & Booking Info */}
              <div className="space-y-1.5">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400/70">Candidate Name (প্রার্থী)</p>
                  <h4 className="font-black text-white text-base leading-snug break-words">
                    {candidateName}
                  </h4>
                </div>

                {req.studentId && (
                  <div className="flex items-center gap-1.5 text-xs text-amber-300 font-mono">
                    <span className="text-white/40 font-sans font-medium">Student ID:</span>
                    <strong className="bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/25">{req.studentId}</strong>
                  </div>
                )}

                {assignedLeader && (
                  <p className="text-xs text-white/60">
                    Leader / Assigned: <span className="text-white/90 font-semibold">{assignedLeader}</span>
                  </p>
                )}

                {(req.whatsappNumber || req.senderNumber) && (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono">
                    <Smartphone size={13} className="text-emerald-400 shrink-0" />
                    <span>{req.whatsappNumber || req.senderNumber}</span>
                  </div>
                )}

                {/* Full Date & Time with Icons */}
                <div className="flex items-center gap-2 text-xs text-white/50 pt-1 font-mono flex-wrap">
                  <span className="flex items-center gap-1 text-white/70">
                    <Calendar size={13} className="text-amber-400 shrink-0" />
                    <span>{formattedDate}</span>
                  </span>
                  {formattedTime && (
                    <>
                      <span className="text-white/30">•</span>
                      <span className="flex items-center gap-1 text-white/70">
                        <Clock size={13} className="text-cyan-400 shrink-0" />
                        <span>{formattedTime}</span>
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Actions Row */}
              <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-white/5">
                <div className="flex items-center gap-2">
                  {req.status === 'pending' && (
                    <>
                      <button
                        onClick={() => handleUpdateStatus(req.id, 'confirmed')}
                        disabled={loadingId === req.id}
                        className="px-3.5 py-1.5 bg-emerald-600/25 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-600 hover:text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
                      >
                        <CheckCircle2 size={14} /> Confirm
                      </button>
                      <button
                        onClick={() => handleUpdateStatus(req.id, 'rejected')}
                        disabled={loadingId === req.id}
                        className="px-3 py-1.5 bg-rose-500/15 text-rose-300 border border-rose-500/30 hover:bg-rose-500 hover:text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 active:scale-95"
                      >
                        <XCircle size={14} /> Reject
                      </button>
                    </>
                  )}
                  {req.status === 'confirmed' && (
                    <button
                      onClick={() => handleUpdateStatus(req.id, 'rejected')}
                      disabled={loadingId === req.id}
                      className="px-3 py-1.5 bg-rose-500/15 text-rose-300 border border-rose-500/30 hover:bg-rose-500 hover:text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 active:scale-95"
                    >
                      <XCircle size={14} /> Reject
                    </button>
                  )}
                  {req.status === 'rejected' && (
                    <button
                      onClick={() => handleUpdateStatus(req.id, 'confirmed')}
                      disabled={loadingId === req.id}
                      className="px-3 py-1.5 bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600 hover:text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 active:scale-95"
                    >
                      <CheckCircle2 size={14} /> Re-Confirm
                    </button>
                  )}
                </div>

                <button
                  onClick={() => handleDeleteRequest(req.id)}
                  className="p-2 text-white/30 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all"
                  title="Delete Request"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          );
        })}

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
    try {
      await deleteDoc(doc(db, 'requests', id));
    } catch (err) {
      console.error(err);
    }
  };

  const handleClearCategoryRequests = async () => {
    const sectionName = requestType === 'seat_booking' ? 'Seat Booking (সিট বুকিং)' : 'Withdraw (উইথড্র)';
    try {
      for (const req of requests) {
        await deleteDoc(doc(db, 'requests', req.id));
      }
    } catch (err) {
      console.error('Error clearing requests:', err);
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
      <div className="space-y-3.5 max-h-[55vh] overflow-y-auto pr-1 custom-scrollbar">
        {finalFiltered.map(req => {
          const dateObj = req.createdAt?.toDate ? req.createdAt.toDate() : null;
          const formattedDate = dateObj 
            ? dateObj.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) 
            : 'Today';
          const formattedTime = dateObj 
            ? dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) 
            : '';
          const candidateName = req.senderName || req.recipientName || 'Applicant';
          const assignedRecipient = req.senderName && req.recipientName && req.senderName !== req.recipientName ? req.recipientName : null;

          return (
            <div key={req.id} className="bg-[#18181f] p-4 rounded-2xl border border-white/10 hover:border-cyan-500/30 transition-all space-y-3 shadow-md">
              {/* Top Row: Type, Payment Brand & Status */}
              <div className="flex items-center justify-between gap-2 flex-wrap border-b border-white/5 pb-2.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] uppercase font-black text-cyan-400 bg-cyan-500/15 px-2.5 py-1 rounded-lg border border-cyan-500/30">
                    {req.type === 'seat_booking' ? 'Seat Booking' : 'Withdrawal'}
                  </span>
                  {req.paymentMethod && (
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-lg border border-white/10 bg-white/5 text-white/90">
                      {req.paymentMethod}
                    </span>
                  )}
                  {req.refId && (
                    <span className="text-[10px] font-mono text-white/50 bg-black/30 px-2 py-0.5 rounded-md border border-white/5">
                      {req.refId}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-mono font-black text-base text-emerald-400">৳{req.amount}</span>
                  <Badge status={req.status} />
                </div>
              </div>

              {/* Candidate & Contact Details */}
              <div className="space-y-1.5">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-cyan-400/70">Candidate Name (প্রার্থী)</p>
                  <h4 className="font-black text-white text-base leading-snug break-words">
                    {candidateName}
                  </h4>
                </div>

                {assignedRecipient && (
                  <p className="text-xs text-white/60">
                    Assigned: <span className="text-white/90 font-semibold">{assignedRecipient}</span>
                  </p>
                )}

                {(req.senderNumber || req.whatsappNumber) && (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono">
                    <Smartphone size={13} className="text-emerald-400 shrink-0" />
                    <span>{req.senderNumber || req.whatsappNumber}</span>
                  </div>
                )}

                {/* Full Date & Time with Icons */}
                <div className="flex items-center gap-2 text-xs text-white/50 pt-1 font-mono flex-wrap">
                  <span className="flex items-center gap-1 text-white/70">
                    <Calendar size={13} className="text-amber-400 shrink-0" />
                    <span>{formattedDate}</span>
                  </span>
                  {formattedTime && (
                    <>
                      <span className="text-white/30">•</span>
                      <span className="flex items-center gap-1 text-white/70">
                        <Clock size={13} className="text-cyan-400 shrink-0" />
                        <span>{formattedTime}</span>
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Trx Digit & Note */}
              {req.trxDigit && (
                <div className="bg-[#09090b] p-2.5 rounded-xl text-xs text-white/80 font-mono border border-white/5 flex flex-wrap gap-3 justify-between items-center">
                  <span className="text-white/50">Trx ID / Digit:</span>
                  <strong className="text-cyan-300 tracking-wider">{req.trxDigit}</strong>
                </div>
              )}

              {req.note && (
                <p className="text-xs text-white/70 italic bg-[#09090b] p-2.5 rounded-xl border border-white/5">
                  "{req.note}"
                </p>
              )}

              {/* Workflow Action Buttons */}
              <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-white/5">
                <div className="flex items-center gap-2 flex-1 flex-wrap">
                  {req.status === 'pending' && (
                    <button
                      onClick={() => handleUpdateStatus(req.id, 'accepted')}
                      disabled={loadingId === req.id}
                      className="px-3.5 py-1.5 bg-emerald-600/25 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-600 hover:text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
                    >
                      <Check size={14} /> Accept Request
                    </button>
                  )}
                  {req.status === 'accepted' && (
                    <button
                      onClick={() => handleUpdateStatus(req.id, 'confirmed')}
                      disabled={loadingId === req.id}
                      className="px-3.5 py-1.5 bg-rose-600/25 text-rose-300 border border-rose-500/40 hover:bg-rose-600 hover:text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
                    >
                      <CheckCircle2 size={14} /> Confirm Request
                    </button>
                  )}
                  {req.status !== 'rejected' && (
                    <button
                      onClick={() => handleUpdateStatus(req.id, 'rejected')}
                      disabled={loadingId === req.id}
                      className="px-3 py-1.5 bg-red-500/15 text-red-300 border border-red-500/30 hover:bg-red-500 hover:text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 active:scale-95"
                      title="Reject Request"
                    >
                      Reject
                    </button>
                  )}
                  {req.status === 'rejected' && (
                    <button
                      onClick={() => handleUpdateStatus(req.id, 'confirmed')}
                      disabled={loadingId === req.id}
                      className="px-3 py-1.5 bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600 hover:text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 active:scale-95"
                    >
                      <CheckCircle2 size={14} /> Re-Confirm
                    </button>
                  )}
                </div>

                <button
                  onClick={() => handleDeleteRequest(req.id)}
                  className="p-2 text-white/30 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all"
                  title="Delete Request"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          );
        })}

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
    setClearing(true);
    try {
      if (requests && requests.length > 0) {
        for (const req of requests) {
          await deleteDoc(doc(db, 'requests', req.id));
        }
      }
    } catch (err) {
      console.error(err);
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
