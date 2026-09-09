import React, { useState, useEffect } from 'react';
import { 
  auth, 
  db, 
  onAuthStateChanged, 
  signInWithPopup, 
  googleProvider,
  signOut,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  collection,
  query,
  where,
  orderBy,
  addDoc,
  serverTimestamp,
  updateDoc,
  deleteDoc,
  browserPopupRedirectResolver,
  handleFirestoreError,
  OperationType
} from './lib/firebase';
import { UserProfile, TeamMember, RequestData } from './types';
import { TRANSLATIONS } from './constants';
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
  Clock,
  ChevronRight,
  TrendingUp,
  Users,
  Search,
  Filter,
  Trash2,
  Edit2,
  Delete
} from 'lucide-react';

// --- Shared Components ---

const GlassCard = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => (
  <div className={`bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl shadow-xl ${className}`}>
    {children}
  </div>
);

const Badge = ({ status }: { status: string }) => {
  const colors = {
    pending: "bg-amber-500/20 text-amber-500 border-amber-500/30",
    approved: "bg-emerald-500/20 text-emerald-500 border-emerald-500/30",
    rejected: "bg-rose-500/20 text-rose-500 border-rose-500/30"
  };
  const labels = {
    pending: TRANSLATIONS.PENDING,
    approved: TRANSLATIONS.APPROVED,
    rejected: TRANSLATIONS.REJECTED
  };
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${colors[status as keyof typeof colors]}`}>
      {labels[status as keyof typeof labels]}
    </span>
  );
};

// --- Main App Component ---

export default function App() {
  const [view, setView] = useState<'landing' | 'user' | 'admin'>('landing');
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [notifications, setNotifications] = useState<RequestData[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isAdminSession, setIsAdminSession] = useState(false);
  const [userPinConfig, setUserPinConfig] = useState<string>('1234'); // Default fallback

  useEffect(() => {
    // Fetch user PIN config live
    const unsubscribeConfig = onSnapshot(doc(db, 'settings', 'config'), (snap) => {
      if (snap.exists() && snap.data().userPin) {
        setUserPinConfig(snap.data().userPin);
      } else {
        // Initialize if not exists
        setDoc(doc(db, 'settings', 'config'), { userPin: '1234' }, { merge: true }).catch(console.error);
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
      <div className="min-h-screen bg-[#0a0502] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-white selection:bg-indigo-500/30 font-sans overflow-x-hidden">
      {/* Background Atmosphere */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/10 blur-[150px] rounded-full" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-500/10 blur-[150px] rounded-full" />
      </div>

      <div className="relative z-10 max-w-md mx-auto min-h-screen flex flex-col pt-6 px-4 pb-20">
        <AnimatePresence mode="wait">
          {view === 'landing' && (
            <LandingPage key="landing" onEnter={handleEnterAsGuest} onAdminLogin={handleAdminAuthSuccess} userPinConfig={userPinConfig} />
          )}
          {view === 'user' && (
            <UserDashboard 
              key="user" 
              user={currentUser} 
              onLogout={handleLogout} 
              onAdminClick={() => setView('admin')} 
              isAdminSession={isAdminSession}
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
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// --- View Components ---

function LandingPage({ onEnter, onAdminLogin, userPinConfig }: { onEnter: () => void, onAdminLogin: () => void, userPinConfig: string, key?: string }) {
  const [loginMode, setLoginMode] = useState<'none' | 'user' | 'admin'>('none');
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  const handleKeypadPress = (key: string) => {
    if (key === 'del') {
      setPin(prev => prev.slice(0, -1));
    } else {
      setPin(prev => prev + key);
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
      className="flex-1 flex flex-col items-center justify-center gap-14"
    >
      <div className="text-center space-y-5">
        <motion.div 
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-2xl mx-auto flex items-center justify-center shadow-2xl shadow-indigo-500/20"
        >
          <TrendingUp size={40} className="text-white" />
        </motion.div>
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-white mb-2">
            {TRANSLATIONS.TITLE}
          </h1>
          <p className="text-white/50 font-medium tracking-wider uppercase text-xs">
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
          <form onSubmit={handleAuth} className="space-y-4 bg-[#18181b] p-6 rounded-3xl border border-white/5 shadow-xl">
            <h2 className="text-center text-lg font-bold mb-2">
              {loginMode === 'admin' ? 'Admin Login' : 'User Login'}
            </h2>
            <div className="relative">
              <input 
                type="password"
                readOnly
                placeholder="Enter PIN"
                value={pin}
                className={`w-full bg-[#09090b] border ${error ? 'border-rose-500' : 'border-white/10'} rounded-2xl py-4 px-6 text-center text-xl tracking-[0.2em] font-mono focus:outline-none transition-colors cursor-default`}
              />
              {error && <p className="text-rose-500 text-xs text-center mt-3 font-semibold">Incorrect PIN</p>}
            </div>
            
            <div className="grid grid-cols-3 gap-2 mt-4">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                <button 
                  key={num} 
                  type="button" 
                  onClick={() => handleKeypadPress(num.toString())} 
                  className="py-4 bg-[#27272a] rounded-xl font-bold text-2xl hover:bg-[#3f3f46] transition-colors active:scale-95 text-white/90"
                >
                  {num}
                </button>
              ))}
              <button 
                type="button" 
                onClick={() => setLoginMode('none')} 
                className="py-4 bg-[#27272a] rounded-xl font-semibold text-sm hover:bg-[#3f3f46] transition-colors active:scale-95 text-white/50"
              >
                BACK
              </button>
              <button 
                type="button" 
                onClick={() => handleKeypadPress('0')} 
                className="py-4 bg-[#27272a] rounded-xl font-bold text-2xl hover:bg-[#3f3f46] transition-colors active:scale-95 text-white/90"
              >
                0
              </button>
              <button 
                type="button" 
                onClick={() => handleKeypadPress('del')} 
                className="py-4 bg-[#27272a] rounded-xl font-bold text-xl hover:bg-[#3f3f46] transition-colors active:scale-95 flex items-center justify-center text-rose-400"
              >
                <Delete size={24} />
              </button>
            </div>
            
            <button 
              type="submit"
              disabled={!pin}
              className="w-full mt-4 py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 transition-colors rounded-xl font-bold text-white shadow-lg shadow-indigo-600/20 active:scale-95 flex justify-center items-center gap-2"
            >
              <CheckCircle2 size={24} /> Login
            </button>
          </form>
        )}
      </div>
    </motion.div>
  );
}

function UserDashboard({ user, onLogout, onAdminClick, isAdminSession }: { 
  user: UserProfile | null, 
  onLogout: () => void, 
  onAdminClick: () => void,
  isAdminSession: boolean,
  key?: string
}) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [history, setHistory] = useState<RequestData[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'leader' | 'trainer'>('leader');

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
        setHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RequestData)));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'requests')
    );
    return () => unsubscribe();
  }, []);

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
        <h2 className="text-2xl font-extrabold tracking-tight text-white">{TRANSLATIONS.TITLE}</h2>
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
          {filteredMembers.map(member => (
            <motion.button
              key={member.id}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => setSelectedMember(member)}
              className="bg-[#18181b] hover:bg-[#27272a] p-4 rounded-2xl border border-white/5 text-left flex items-center justify-between group transition-colors shadow-sm"
            >
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center border shadow-sm ${
                  member.role === 'leader' 
                    ? 'bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border-indigo-500/30 text-indigo-400'
                    : 'bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border-emerald-500/30 text-emerald-400'
                }`}>
                  <UserIcon size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-white/90">{member.name}</h3>
                </div>
              </div>
              <ChevronRight className="text-white/20 group-hover:text-white/50 transition-colors" size={20} />
            </motion.button>
          ))}
          {filteredMembers.length === 0 && (
            <div className="text-center py-12 text-white/20">
              <Users size={48} className="mx-auto mb-2 opacity-20" />
              <p>No members found</p>
            </div>
          )}
        </div>
      </div>

      <button 
        onClick={() => setShowHistory(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-white text-black hover:bg-white/90 transition-colors rounded-full shadow-lg flex items-center justify-center border border-black/10"
      >
        <HistoryIcon size={24} />
      </button>

      {/* Request Modal */}
      <AnimatePresence>
        {selectedMember && (
          <RequestModal 
            member={selectedMember} 
            sender={user}
            onClose={() => setSelectedMember(null)} 
          />
        )}
        {showHistory && (
          <HistoryModal 
            history={history} 
            onClose={() => setShowHistory(false)} 
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function AdminDashboard({ 
  user, onLogout, notifications, showNotifications, setShowNotifications, onUserView 
}: { 
  user: UserProfile, 
  onLogout: () => void, 
  notifications: RequestData[],
  showNotifications: boolean,
  setShowNotifications: (s: boolean) => void,
  onUserView: () => void,
  key?: string
}) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'members' | 'history' | 'settings'>('members');
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

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl">
            <ShieldCheck size={20} />
          </div>
          <h2 className="text-xl font-extrabold text-white">Admin</h2>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2.5 bg-[#18181b] hover:bg-[#27272a] border border-white/10 rounded-xl relative transition-colors text-white/80"
          >
            <Bell size={20} />
            {notifications.filter(n => n.status === 'pending').length > 0 && (
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

      <div className="flex bg-[#18181b] p-1.5 rounded-2xl border border-white/5">
        <button 
          onClick={() => setActiveTab('members')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${activeTab === 'members' ? 'bg-white text-black shadow-md' : 'text-white/60 hover:text-white'}`}
        >
          {TRANSLATIONS.DASHBOARD}
        </button>
        <button 
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${activeTab === 'history' ? 'bg-white text-black shadow-md' : 'text-white/60 hover:text-white'}`}
        >
          {TRANSLATIONS.HISTORY}
        </button>
        <button 
          onClick={() => setActiveTab('settings')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${activeTab === 'settings' ? 'bg-white text-black shadow-md' : 'text-white/60 hover:text-white'}`}
        >
          Settings
        </button>
      </div>

      <div className="flex-1">
        {activeTab === 'members' && (
          <div className="space-y-6">
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
            
            <div className="space-y-4">
              <div className="grid gap-3">
                {members.filter(m => m.role === memberTab).map(member => (
                  <div key={member.id} className="bg-[#18181b] p-4 rounded-2xl border border-white/5 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                      <div className="w-10 h-10 bg-[#27272a] rounded-full flex items-center justify-center text-white/70 shrink-0 border border-white/5">
                        <UserIcon size={18} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-[15px] text-white/90 truncate">{member.name}</h3>
                      </div>
                    </div>
                    <div className="flex gap-1.5 shrink-0 ml-3">
                      <button 
                        type="button"
                        onClick={() => {
                          console.log('Initiating edit for:', member.name);
                          setEditingMember(member);
                        }}
                        className="p-2.5 flex items-center justify-center rounded-xl bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition-all active:scale-95 border border-transparent hover:border-white/10"
                        title="Edit Member"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        type="button"
                        onClick={async (e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          
                          if (loadingId) return;
                          
                          const memberId = member.id;
                          
                          console.log('List: Initiating delete for ID:', memberId);
                          setLoadingId(memberId);
                          
                          try {
                            const memberDocRef = doc(db, 'teamMembers', memberId);
                            await deleteDoc(memberDocRef);
                            console.log('List: Successfully deleted document:', memberId);
                          } catch (err: any) {
                            console.error('List: DELETE FAILED:', err);
                            alert('ডিলিট করতে সমস্যা হয়েছে। দয়া করে আবার চেষ্টা করুন।');
                          } finally {
                            setLoadingId(null);
                          }
                        }}
                        disabled={loadingId !== null}
                        className={`p-2.5 flex items-center justify-center rounded-xl transition-all shadow-sm active:scale-95 border ${
                          loadingId === member.id 
                            ? 'bg-rose-500/10 border-rose-500/20 text-rose-500/50 cursor-wait' 
                            : 'bg-rose-500/10 border-rose-500/20 text-rose-500 hover:bg-rose-500 hover:text-white cursor-pointer'
                        }`}
                        title="Delete Member"
                      >
                        {loadingId === member.id ? (
                          <div className="w-4 h-4 border-2 border-rose-500 border-t-transparent animate-spin rounded-full" />
                        ) : (
                          <Trash2 size={16} />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
                {members.filter(m => m.role === memberTab).length === 0 && (
                  <div className="text-center py-16 bg-[#18181b] rounded-2xl border border-dashed border-white/10 text-white/30">
                     <Users size={32} className="mx-auto mb-3 opacity-30" />
                     <p className="text-sm font-medium">No {memberTab}s yet</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'history' && <AdminHistoryView />}
        {activeTab === 'settings' && <AdminSettingsView />}
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

// --- Sub-Components (Modals & Views) ---

function AdminSettingsView() {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const snap = await getDoc(doc(db, 'settings', 'config'));
        if (snap.exists() && snap.data().userPin) {
          setPin(snap.data().userPin);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchConfig();
  }, []);

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

  return (
    <div className="space-y-6 mt-4">
      <div className="bg-[#18181b] p-6 rounded-3xl border border-white/5 shadow-sm space-y-5">
        <div>
          <h3 className="font-bold text-[17px] mb-1">User Login PIN</h3>
          <p className="text-sm text-white/50 leading-snug">Set the PIN that users will use to access the dashboard.</p>
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
            className="w-full py-4 bg-white text-black hover:bg-white/90 disabled:opacity-50 transition-colors rounded-2xl font-bold flex items-center justify-center gap-2 shadow-sm text-sm"
          >
            {loading ? 'Saving...' : success ? <><CheckCircle2 size={18} /> Saved</> : 'Save PIN'}
          </button>
        </form>
      </div>
    </div>
  );
}

function RequestModal({ member, sender, onClose }: { member: TeamMember, sender: UserProfile | null, onClose: () => void }) {
  const [senderName, setSenderName] = useState(sender?.name || '');
  const [senderNumber, setSenderNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!senderName || !senderNumber) return;
    setLoading(true);
    try {
      await addDoc(collection(db, 'requests'), {
        senderId: sender?.uid || 'guest',
        senderName: senderName,
        senderNumber: senderNumber,
        senderRole: sender?.role || 'user',
        recipientName: member.name,
        recipientNumber: member.number || '',
        amount: amount ? Number(amount) : 0,
        note: note,
        status: 'pending',
        createdAt: serverTimestamp()
      });
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
        <GlassCard className="p-12 text-center space-y-4">
          <CheckCircle2 size={64} className="text-emerald-500 mx-auto" />
          <h2 className="text-2xl font-bold">{TRANSLATIONS.SUCCESS_SUBMIT}</h2>
        </GlassCard>
      </div>
    );
  }

  const isLeader = member.role === 'leader';
  const themeColorText = isLeader ? 'text-indigo-400' : 'text-emerald-400';
  const themeColorRing = isLeader ? 'focus:border-indigo-500/50 focus:ring-indigo-500/20' : 'focus:border-emerald-500/50 focus:ring-emerald-500/20';
  const themeGradient = isLeader ? 'from-indigo-500 to-purple-600 shadow-indigo-500/30' : 'from-emerald-500 to-teal-600 shadow-emerald-500/30';
  const themeGradientBg = isLeader ? 'from-[#18181b] to-[#09090b]' : 'from-[#18181b] to-[#09090b]';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm" 
      />
      <motion.div 
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        className={`relative w-full max-w-sm bg-gradient-to-b ${themeGradientBg} rounded-t-[2rem] sm:rounded-[2rem] p-6 sm:p-8 border border-white/10 shadow-2xl my-auto`}
      >
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg bg-gradient-to-br text-white ${themeGradient}`}>
              <UserIcon size={24} />
            </div>
            <div>
              <p className={`text-[10px] uppercase font-bold tracking-widest mb-0.5 ${themeColorText}`}>
                {isLeader ? 'Team Leader' : 'Team Trainer'}
              </p>
              <h2 className="text-xl font-bold tracking-tight text-white">{member.name}</h2>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-[#18181b] rounded-xl transition-colors self-start"><XCircle size={22} className="text-white/40" /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className={`text-[11px] font-bold uppercase tracking-wider pl-1 ${themeColorText}`}>{TRANSLATIONS.NAME} *</label>
            <input 
              type="text" 
              required
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              placeholder="Your Name"
              className={`w-full bg-[#09090b] border border-white/10 rounded-2xl py-3.5 px-5 text-sm focus:outline-none focus:ring-4 transition-all shadow-inner ${themeColorRing}`}
            />
          </div>
          <div className="space-y-1.5">
            <label className={`text-[11px] font-bold uppercase tracking-wider pl-1 ${themeColorText}`}>{TRANSLATIONS.NUMBER} *</label>
            <input 
              type="tel" 
              required
              value={senderNumber}
              onChange={(e) => setSenderNumber(e.target.value)}
              placeholder="Your Number"
              className={`w-full bg-[#09090b] border border-white/10 rounded-2xl py-3.5 px-5 text-sm focus:outline-none focus:ring-4 transition-all shadow-inner ${themeColorRing}`}
            />
          </div>
          <div className="space-y-1.5">
            <label className={`text-[11px] font-bold uppercase tracking-wider pl-1 ${themeColorText}`}>{TRANSLATIONS.AMOUNT} (Optional)</label>
            <input 
              type="number" 
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className={`w-full bg-[#09090b] border border-white/10 rounded-2xl py-3.5 px-5 text-sm focus:outline-none focus:ring-4 transition-all shadow-inner ${themeColorRing}`}
            />
          </div>
          <div className="space-y-1.5">
            <label className={`text-[11px] font-bold uppercase tracking-wider pl-1 ${themeColorText}`}>{TRANSLATIONS.NOTE} (Optional)</label>
            <textarea 
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Any details..."
              rows={2}
              className={`w-full bg-[#09090b] border border-white/10 rounded-2xl py-3.5 px-5 text-sm focus:outline-none focus:ring-4 transition-all resize-none shadow-inner ${themeColorRing}`}
            />
          </div>
          <button 
            type="submit"
            disabled={loading}
            className={`w-full py-4 text-white disabled:opacity-50 transition-all rounded-2xl font-bold text-[15px] shadow-lg mt-6 bg-gradient-to-r hover:opacity-90 ${themeGradient}`}
          >
            {loading ? 'Sending...' : TRANSLATIONS.SUBMIT}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

function HistoryModal({ history, onClose }: { history: RequestData[], onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm" 
      />
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
        className="relative w-full max-w-sm h-[80vh] bg-[#151619] rounded-3xl p-6 border border-white/10 shadow-2xl flex flex-col"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <HistoryIcon className="text-indigo-400" />
            {TRANSLATIONS.HISTORY}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-xl"><XCircle size={24} className="text-white/40" /></button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
          {history.map(req => (
            <div key={req.id} className="bg-white/5 p-4 rounded-2xl border border-white/5 space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-indigo-400">{req.recipientName}</h3>
                  <p className="text-[10px] text-white/40 uppercase tracking-tighter">
                    {req.createdAt?.toDate ? req.createdAt.toDate().toLocaleDateString() : 'Just now'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono font-bold">৳{req.amount}</p>
                  <Badge status={req.status} />
                </div>
              </div>
              {req.note && <p className="text-xs text-white/60 bg-white/5 p-2 rounded-lg italic">"{req.note}"</p>}
            </div>
          ))}
          {history.length === 0 && <div className="text-center py-20 text-white/20">No data found</div>}
        </div>
      </motion.div>
    </div>
  );
}

function AddMemberModal({ role, onClose }: { role: 'leader' | 'trainer', onClose: () => void }) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      await addDoc(collection(db, 'teamMembers'), {
        name: name.trim(),
        role,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-md" 
      />
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
        className="relative w-full max-w-sm bg-[#09090b] rounded-3xl p-8 border border-white/10 shadow-2xl"
      >
        <h2 className="text-xl font-bold mb-6 italic">{TRANSLATIONS.ADD_MEMBER} ({TRANSLATIONS[role === 'leader' ? 'TEAM_LEADER' : 'TEAM_TRAINER']})</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 pl-1">{TRANSLATIONS.NAME}</label>
            <input 
              placeholder="Full Name"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#18181b] border border-white/10 rounded-2xl py-4 px-6 focus:outline-none focus:border-indigo-500/50 transition-colors shadow-inner"
            />
          </div>
          <button 
            type="submit"
            disabled={loading || !name.trim()}
            className="w-full py-4 bg-white text-black hover:bg-white/90 disabled:opacity-50 transition-colors rounded-2xl font-bold shadow-lg mt-4"
          >
            {loading ? '...' : TRANSLATIONS.SUBMIT}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

function EditMemberModal({ member, onClose }: { member: TeamMember, onClose: () => void }) {
  const [name, setName] = useState(member.name);
  const [loading, setLoading] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    console.log('Modal: Delete initiated for', member.name, 'ID:', member.id);
    
    if (loading) {
      console.log('Modal: Already loading, skipping');
      return;
    }

    setLoading(true);
    try {
      console.log('Modal: Deleting doc...');
      const docRef = doc(db, 'teamMembers', member.id);
      await deleteDoc(docRef);
      console.log('Modal: Delete success');
      alert('সফলভাবে ডিলিট করা হয়েছে');
      onClose();
    } catch (error: any) { 
      console.error('Modal: Delete error:', error);
      alert('ডিলিট করতে সমস্যা হয়েছে। দয়া করে আবার চেষ্টা করুন।');
      handleFirestoreError(error, OperationType.DELETE, `teamMembers/${member.id}`);
    } finally { 
      setLoading(false); 
      console.log('Modal: Loading state reset');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      const docRef = doc(db, 'teamMembers', member.id);
      await updateDoc(docRef, {
        name: name.trim(),
        updatedAt: serverTimestamp()
      });
      alert('সফলভাবে আপডেট করা হয়েছে');
      onClose();
    } catch (error) { 
      handleFirestoreError(error, OperationType.UPDATE, `teamMembers/${member.id}`);
    } finally { 
      setLoading(false); 
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-md" 
      />
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
        className="relative w-full max-w-sm bg-[#09090b] rounded-3xl p-8 border border-white/10 shadow-2xl"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold italic">মেম্বার এডিট করুন</h2>
          <div className="flex items-center gap-2">
            <button 
              type="button"
              onClick={handleDelete}
              disabled={loading}
              className="px-4 py-2 bg-rose-500/10 text-rose-500 border border-rose-500/20 hover:bg-rose-500 hover:text-white rounded-xl transition-all shadow-sm active:scale-95 flex items-center gap-2 font-bold text-xs disabled:opacity-50"
              title="Delete Member"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-current border-t-transparent animate-spin rounded-full" />
              ) : (
                <>
                  <Trash2 size={16} />
                  <span>ডিলিট</span>
                </>
              )}
            </button>
            <button 
              type="button"
              onClick={onClose} 
              className="p-2 hover:bg-white/5 rounded-xl border border-white/10"
            >
              <XCircle size={20} className="text-white/40" />
            </button>
          </div>
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
              className="w-full bg-[#18181b] border border-white/10 rounded-2xl py-4 px-6 focus:outline-none focus:border-indigo-500/50 transition-colors shadow-inner"
            />
          </div>
          <button 
            type="submit"
            disabled={loading || !name.trim()}
            className="w-full py-4 bg-white text-black hover:bg-white/90 disabled:opacity-50 transition-colors rounded-2xl font-bold shadow-lg mt-4"
          >
            {loading ? 'আপডেট হচ্ছে...' : 'আপডেট করুন'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

function NotificationCenter({ notifications, onClose }: { notifications: RequestData[], onClose: () => void }) {
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleAction = async (id: string, status: 'approved' | 'rejected') => {
    if (loadingId) {
      console.warn('handleAction: Already loading:', loadingId);
      return;
    }
    
    console.log(`handleAction: Initiating ${status} for ${id}`);
    setLoadingId(id);
    
    try {
      const requestRef = doc(db, 'requests', id);
      console.log('handleAction: Sending update to Firestore...');
      
      await updateDoc(requestRef, {
        status: status,
        updatedAt: serverTimestamp()
      });
      
      console.log('handleAction: Update confirmed by Firestore');
      alert(status === 'approved' ? 'সফলভাবে অ্যাপ্রুভ হয়েছে' : 'রিজেক্ট করা হয়েছে');
    } catch (error: any) {
      console.error('handleAction: ERROR:', error);
      alert('সফল হয়নি: ' + (error.message || 'Error updating status'));
      handleFirestoreError(error, OperationType.UPDATE, `requests/${id}`);
    } finally {
      setLoadingId(null);
      console.log('handleAction: Finished cleanup');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
      />
      <motion.div 
        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        className="absolute top-0 right-0 bottom-0 w-full max-w-sm bg-[#09090b] shadow-2xl border-l border-white/10 flex flex-col"
      >
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Bell className="text-indigo-400" />
            {TRANSLATIONS.NOTIFICATIONS}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-xl"><XCircle size={24} className="text-white/40" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          {notifications.filter(n => n.status === 'pending').map(req => (
            <div key={req.id} className="rounded-2xl border transition-all overflow-hidden bg-[#18181b] border-white/5 shadow-sm">
               <div className="p-5 space-y-4">
                 <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase font-bold text-indigo-400 tracking-widest bg-indigo-500/10 px-2 py-0.5 rounded-full inline-block mb-1 border border-indigo-500/20">New Request</p>
                      <h3 className="font-bold text-lg leading-tight">{req.recipientName}</h3>
                      <p className="text-xs text-white/50">From: {req.senderName} ({req.senderNumber})</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono font-bold text-xl text-white">৳{req.amount || '0'}</p>
                    </div>
                 </div>
                 {req.note && <p className="text-sm text-white/50 italic bg-white/5 p-4 rounded-xl border border-white/5">"{req.note}"</p>}
               </div>
               
                <div className="flex border-t border-white/5 overflow-hidden">
                  <button 
                   type="button"
                   onClick={() => handleAction(req.id, 'approved')}
                   disabled={loadingId !== null}
                   className={`flex-1 py-4 font-bold transition-all border-r border-white/5 flex items-center justify-center gap-2 hover:bg-emerald-500/20 hover:text-emerald-400 active:scale-95 disabled:opacity-50 cursor-pointer ${
                     loadingId === req.id ? 'bg-emerald-500/10 text-emerald-500/50' : 'bg-[#18181b] text-white/70 hover:text-white'
                   }`}
                  >
                    {loadingId === req.id ? (
                      <div className="w-5 h-5 border-2 border-emerald-400 border-t-transparent animate-spin rounded-full" />
                    ) : (TRANSLATIONS.APPROVED || 'Approve')}
                  </button>
                  <button 
                   type="button"
                   onClick={() => handleAction(req.id, 'rejected')}
                   disabled={loadingId !== null}
                   className={`flex-1 py-4 font-bold transition-all flex items-center justify-center gap-2 hover:bg-rose-500/20 hover:text-rose-400 active:scale-95 disabled:opacity-50 cursor-pointer ${
                     loadingId === req.id ? 'bg-rose-500/10 text-rose-500/50' : 'bg-[#18181b] text-white/70 hover:text-white'
                   }`}
                  >
                    {loadingId === req.id ? (
                      <div className="w-5 h-5 border-2 border-rose-400 border-t-transparent animate-spin rounded-full" />
                    ) : (TRANSLATIONS.REJECTED || 'Reject')}
                  </button>
                </div>
            </div>
          ))}
          
          {notifications.filter(n => n.status === 'pending').length === 0 && (
            <div className="text-center py-40 text-white/20">
              <CheckCircle2 size={48} className="mx-auto mb-4 opacity-20" />
              <p className="font-medium text-sm">Everything clear!</p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function AdminHistoryView() {
  const [history, setHistory] = useState<RequestData[]>([]);
  const [filter, setFilter] = useState<'all' | 'approved' | 'rejected'>('all');
  const [isClearing, setIsClearing] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'requests'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      q, 
      (snapshot) => {
        setHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RequestData)));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'requests')
    );
    return () => unsubscribe();
  }, []);

  const handleClearHistory = async () => {
    if (history.length === 0) return;

    setIsClearing(true);
    try {
      // For safety and to avoid massive batches, we delete documents from the local history state
      const deletePromises = history.map(item => deleteDoc(doc(db, 'requests', item.id)));
      await Promise.all(deletePromises);
      alert('সফলভাবে সমস্ত ডাটা ক্লিয়ার করা হয়েছে');
    } catch (error) {
      console.error('Clear history error:', error);
      alert('ডাটা ক্লিয়ার করতে সমস্যা হয়েছে। দয়া করে আবার চেষ্টা করুন।');
    } finally {
      setIsClearing(false);
    }
  };

  const filteredHistory = filter === 'all' ? history : history.filter(h => h.status === filter);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-1 gap-2 p-1 bg-white/5 rounded-2xl">
          {(['all', 'approved', 'rejected'] as const).map(f => (
            <button 
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-1 py-2 rounded-xl text-[10px] font-bold capitalize transition-all ${filter === f ? 'bg-white/10 shadow-sm text-white' : 'text-white/40'}`}
            >
              {f === 'all' ? TRANSLATIONS.FILTER_ALL : (f === 'approved' ? TRANSLATIONS.APPROVED : TRANSLATIONS.REJECTED)}
            </button>
          ))}
        </div>
        <button 
          onClick={handleClearHistory}
          disabled={isClearing || history.length === 0}
          className="p-2.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-30 text-white rounded-2xl transition-all shadow-lg active:scale-90 flex items-center justify-center shrink-0"
          title="Clear All History"
        >
          {isClearing ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent animate-spin rounded-full" />
          ) : (
            <Trash2 size={20} />
          )}
        </button>
      </div>

      <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
        {filteredHistory.map(req => (
          <div key={req.id} className="bg-white/5 p-4 rounded-2xl border border-white/5 flex items-center justify-between">
            <div>
              <h4 className="font-bold">{req.recipientName}</h4>
              <p className="text-[10px] text-white/40">From: {req.senderName} • {req.createdAt?.toDate?.().toLocaleDateString()}</p>
            </div>
            <div className="text-right">
              <p className="font-mono font-bold">৳{req.amount}</p>
              <Badge status={req.status} />
            </div>
          </div>
        ))}
        {filteredHistory.length === 0 && (
          <div className="text-center py-20 text-white/10">No data found</div>
        )}
      </div>
    </div>
  );
}
