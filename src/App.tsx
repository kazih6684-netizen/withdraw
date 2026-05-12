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
  Trash2
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

  useEffect(() => {
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

    return () => unsubscribe();
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
    <div className="min-h-screen bg-[#0a0502] text-white selection:bg-indigo-500/30 font-sans overflow-x-hidden">
      {/* Background Atmosphere */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-rose-600/10 blur-[120px] rounded-full" />
      </div>

      <div className="relative z-10 max-w-md mx-auto min-h-screen flex flex-col pt-4 px-4 pb-20">
        <AnimatePresence mode="wait">
          {view === 'landing' && (
            <LandingPage key="landing" onEnter={handleEnterAsGuest} onAdminLogin={handleAdminAuthSuccess} />
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

function LandingPage({ onEnter, onAdminLogin }: { onEnter: () => void, onAdminLogin: () => void, key?: string }) {
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  const handleAdminAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === '212650') {
      onAdminLogin();
    } else {
      setError(true);
      setTimeout(() => setError(false), 2000);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex-1 flex flex-col items-center justify-center gap-12"
    >
      <div className="text-center space-y-4">
        <motion.div 
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          className="w-24 h-24 bg-indigo-600 rounded-3xl mx-auto flex items-center justify-center shadow-2xl shadow-indigo-500/50"
        >
          <TrendingUp size={48} className="text-white" />
        </motion.div>
        <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent italic">
          {TRANSLATIONS.TITLE}
        </h1>
        <p className="text-indigo-200/60 font-medium tracking-widest uppercase text-xs">
          {TRANSLATIONS.SUBTITLE}
        </p>
      </div>

      <div className="w-full space-y-4">
        {!showPasswordInput ? (
          <>
            <button 
              onClick={onEnter}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 transition-all rounded-2xl font-bold text-lg shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 group"
            >
              {TRANSLATIONS.ENTER}
              <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
            </button>
            <button 
              onClick={() => setShowPasswordInput(true)}
              className="w-full py-4 bg-white/5 hover:bg-white/10 border border-white/10 transition-all rounded-2xl font-medium text-white/80 flex items-center justify-center gap-2"
            >
              <ShieldCheck size={20} />
              {TRANSLATIONS.ADMIN_LOGIN}
            </button>
          </>
        ) : (
          <form onSubmit={handleAdminAuth} className="space-y-4">
            <div className="relative">
              <input 
                type="password"
                autoFocus
                placeholder={TRANSLATIONS.PASSWORD}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`w-full bg-white/5 border ${error ? 'border-rose-500' : 'border-white/10'} rounded-2xl py-4 px-6 text-center text-xl tracking-widest focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-colors`}
              />
              {error && <p className="text-rose-500 text-xs text-center mt-2 font-bold animate-bounce">Wrong Password!</p>}
            </div>
            <div className="flex gap-2">
              <button 
                type="button" 
                onClick={() => setShowPasswordInput(false)}
                className="flex-1 py-3 bg-white/5 rounded-2xl font-bold text-white/40"
              >
                Back
              </button>
              <button 
                type="submit"
                className="flex-[2] py-3 bg-indigo-600 hover:bg-indigo-500 rounded-2xl font-bold shadow-lg shadow-indigo-600/20"
              >
                Login
              </button>
            </div>
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
    (m.name.toLowerCase().includes(search.toLowerCase()) || (m.number && m.number.includes(search)))
  );

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex-1 flex flex-col gap-6"
    >
      <header className="flex items-center justify-between">
        <h2 className="text-xl font-bold italic">{TRANSLATIONS.TITLE}</h2>
        <div className="flex gap-2">
          {isAdminSession && (
            <button onClick={onAdminClick} className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl">
              <ShieldCheck size={20} />
            </button>
          )}
          <button onClick={onLogout} className="p-2 bg-white/5 hover:bg-white/10 rounded-xl transition-colors">
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <div className="flex bg-white/5 p-1 rounded-2xl border border-white/5">
        <button 
          onClick={() => setActiveTab('leader')}
          className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${activeTab === 'leader' ? 'bg-indigo-600 shadow-lg' : 'text-white/60'}`}
        >
          {TRANSLATIONS.TEAM_LEADER}
        </button>
        <button 
          onClick={() => setActiveTab('trainer')}
          className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${activeTab === 'trainer' ? 'bg-indigo-600 shadow-lg' : 'text-white/60'}`}
        >
          {TRANSLATIONS.TEAM_TRAINER}
        </button>
      </div>

      <div className="flex-1 space-y-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" size={18} />
          <input 
            type="text" 
            placeholder={TRANSLATIONS.SEARCH}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
          />
        </div>

        <div className="grid gap-3">
          {filteredMembers.map(member => (
            <motion.button
              key={member.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setSelectedMember(member)}
              className="bg-white/5 hover:bg-white/10 p-4 rounded-2xl border border-white/5 text-left flex items-center justify-between group transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-500/20 rounded-full flex items-center justify-center text-indigo-400">
                  <UserIcon size={24} />
                </div>
                <div>
                  <h3 className="font-bold">{member.name}</h3>
                </div>
              </div>
              <ChevronRight className="text-white/20 group-hover:text-indigo-400" size={20} />
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
        className="fixed bottom-6 right-6 w-14 h-14 bg-indigo-600 rounded-2xl shadow-xl shadow-indigo-600/30 flex items-center justify-center"
      >
        <HistoryIcon size={28} />
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
  const [activeTab, setActiveTab] = useState<'members' | 'history'>('members');
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [showAddMember, setShowAddMember] = useState(false);
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
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-600 rounded-xl">
            <ShieldCheck size={20} />
          </div>
          <h2 className="text-lg font-bold">Admin Panel</h2>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 bg-white/5 hover:bg-white/10 rounded-xl relative"
          >
            <Bell size={20} />
            {notifications.filter(n => n.status === 'pending').length > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
            )}
          </button>
          <button onClick={onUserView} className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
            <UserIcon size={20} />
          </button>
          <button onClick={onLogout} className="p-2 bg-white/5 hover:bg-white/10 rounded-xl">
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <div className="flex bg-white/5 p-1 rounded-2xl border border-white/5">
        <button 
          onClick={() => setActiveTab('members')}
          className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${activeTab === 'members' ? 'bg-indigo-600' : 'text-white/60'}`}
        >
          {TRANSLATIONS.DASHBOARD}
        </button>
        <button 
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${activeTab === 'history' ? 'bg-indigo-600' : 'text-white/60'}`}
        >
          {TRANSLATIONS.HISTORY}
        </button>
      </div>

      <div className="flex-1">
        {activeTab === 'members' && (
          <div className="space-y-6">
            <motion.button 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowAddMember(true)}
              className="w-full py-5 bg-emerald-500/10 border-2 border-dashed border-emerald-500/30 hover:border-emerald-500 hover:bg-emerald-500/5 rounded-3xl text-emerald-500 hover:text-emerald-400 transition-all flex items-center justify-center gap-2 font-bold"
            >
              <Plus size={24} />
              {TRANSLATIONS.ADD_MEMBER}
            </motion.button>

            <div className="flex bg-white/5 p-1 rounded-2xl border border-white/5">
              <button 
                onClick={() => setMemberTab('leader')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${memberTab === 'leader' ? 'bg-white/10 shadow-sm text-white' : 'text-white/40'}`}
              >
                {TRANSLATIONS.TEAM_LEADER}
              </button>
              <button 
                onClick={() => setMemberTab('trainer')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${memberTab === 'trainer' ? 'bg-white/10 shadow-sm text-white' : 'text-white/40'}`}
              >
                {TRANSLATIONS.TEAM_TRAINER}
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="grid gap-3">
                {members.filter(m => m.role === memberTab).map(member => (
                  <div key={member.id} className="bg-white/5 p-5 rounded-3xl border border-white/10 flex items-center justify-between group">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-white/40">
                        <UserIcon size={24} />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg leading-tight">{member.name}</h3>
                        {member.number && <p className="text-xs text-white/40 mt-0.5">{member.number}</p>}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={async (e) => {
                          e.stopPropagation();
                          const confirmDelete = window.confirm(TRANSLATIONS.CONFIRM_DELETE || 'Are you sure you want to delete this member?');
                          if (confirmDelete) {
                            try {
                              const docRef = doc(db, 'teamMembers', member.id);
                              await deleteDoc(docRef);
                              console.log('Successfully deleted member:', member.id);
                            } catch (error: any) {
                              console.error('Delete error details:', error);
                              alert('Delete failed: ' + (error.message || 'Unknown error'));
                              handleFirestoreError(error, OperationType.DELETE, `teamMembers/${member.id}`);
                            }
                          }
                        }}
                        className="w-12 h-12 flex items-center justify-center bg-rose-500/10 text-rose-500 rounded-2xl hover:bg-rose-500 hover:text-white transition-all active:scale-95 shadow-sm relative z-30"
                        title="Delete Member"
                      >
                        <Trash2 size={24} />
                      </button>
                    </div>
                  </div>
                ))}
                {members.filter(m => m.role === memberTab).length === 0 && (
                  <div className="text-center py-20 bg-white/5 rounded-3xl border border-dashed border-white/5 text-white/20">
                     <Users size={48} className="mx-auto mb-2 opacity-10" />
                     <p>No {memberTab}s yet</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'history' && <AdminHistoryView />}
      </div>

      <AnimatePresence>
        {showAddMember && (
          <AddMemberModal 
            role={memberTab}
            onClose={() => setShowAddMember(false)} 
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

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm" 
      />
      <motion.div 
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        className="relative w-full max-w-sm bg-[#151619] rounded-t-3xl sm:rounded-3xl p-6 sm:p-8 border border-white/10 shadow-2xl my-auto"
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-500 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-500/20">
              <UserIcon size={24} />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold tracking-widest text-indigo-400">Requesting</p>
              <h2 className="text-xl font-bold tracking-tight">{member.name}</h2>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-xl"><XCircle size={24} className="text-white/40" /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 pl-1">{TRANSLATIONS.NAME} *</label>
            <input 
              type="text" 
              required
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              placeholder="Your Name"
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-5 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 pl-1">{TRANSLATIONS.NUMBER} *</label>
            <input 
              type="tel" 
              required
              value={senderNumber}
              onChange={(e) => setSenderNumber(e.target.value)}
              placeholder="Your Number"
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-5 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 pl-1">{TRANSLATIONS.AMOUNT} (Optional)</label>
            <input 
              type="number" 
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-5 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 pl-1">{TRANSLATIONS.NOTE} (Optional)</label>
            <textarea 
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="..."
              rows={2}
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none"
            />
          </div>
          <button 
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 transition-all rounded-2xl font-bold text-lg shadow-xl shadow-indigo-600/20 mt-2"
          >
            {loading ? '...' : TRANSLATIONS.SUBMIT}
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
  const [number, setNumber] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      await addDoc(collection(db, 'teamMembers'), {
        name: name.trim(),
        role,
        addedAt: serverTimestamp()
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
        className="relative w-full max-w-sm bg-[#1a1b1e] rounded-3xl p-8 border border-white/10 shadow-2xl"
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
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <button 
            type="submit"
            disabled={loading || !name.trim()}
            className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 transition-all rounded-2xl font-bold shadow-xl shadow-emerald-600/20 mt-2"
          >
            {loading ? '...' : TRANSLATIONS.SUBMIT}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

function NotificationCenter({ notifications, onClose }: { notifications: RequestData[], onClose: () => void }) {
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleAction = async (id: string, status: 'approved' | 'rejected') => {
    if (loadingId) return;
    setLoadingId(id);
    console.log(`Starting ${status} for request ${id}`);
    try {
      const requestRef = doc(db, 'requests', id);
      await updateDoc(requestRef, {
        status: status,
        updatedAt: serverTimestamp()
      });
      console.log(`Firestore update success for ${id}: ${status}`);
    } catch (error: any) {
      console.error('Action execution error:', error);
      alert('Failed to update status: ' + (error.message || 'Connection error'));
      handleFirestoreError(error, OperationType.UPDATE, `requests/${id}`);
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm" 
      />
      <motion.div 
        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        className="absolute top-0 right-0 bottom-0 w-full max-w-sm bg-[#151619] shadow-2xl border-l border-white/10 flex flex-col"
      >
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Bell className="text-rose-500" />
            {TRANSLATIONS.NOTIFICATIONS}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-xl"><XCircle size={24} className="text-white/40" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          {notifications.filter(n => n.status === 'pending').map(req => (
            <div key={req.id} className="rounded-3xl border transition-all overflow-hidden bg-white/5 border-white/10 shadow-xl shadow-black/20">
               <div className="p-5 space-y-4">
                 <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase font-bold text-indigo-400 tracking-widest bg-indigo-500/10 px-2 py-0.5 rounded-full inline-block mb-1">New Request</p>
                      <h3 className="font-bold text-lg leading-tight">{req.recipientName}</h3>
                      <p className="text-xs text-white/40">From: {req.senderName} ({req.senderNumber})</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono font-bold text-xl text-emerald-400">৳{req.amount}</p>
                    </div>
                 </div>
                 {req.note && <p className="text-sm text-white/50 italic bg-white/5 p-4 rounded-2xl border border-white/5">"{req.note}"</p>}
               </div>
               
               <div className="flex border-t border-white/5">
                 <button 
                  onClick={() => handleAction(req.id, 'approved')}
                  disabled={loadingId === req.id}
                  className="flex-1 py-4 font-bold transition-all border-r border-white/5 flex items-center justify-center gap-2 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 disabled:opacity-50"
                 >
                   Approve
                 </button>
                 <button 
                  onClick={() => handleAction(req.id, 'rejected')}
                  disabled={loadingId === req.id}
                  className="flex-1 py-4 font-bold transition-all flex items-center justify-center gap-2 bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 disabled:opacity-50"
                 >
                   Reject
                 </button>
               </div>
            </div>
          ))}
          
          {notifications.filter(n => n.status === 'pending').length === 0 && (
            <div className="text-center py-40 text-white/10">
              <CheckCircle2 size={64} className="mx-auto mb-4 opacity-10" />
              <p>Everything clear!</p>
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

  const filteredHistory = filter === 'all' ? history : history.filter(h => h.status === filter);

  return (
    <div className="space-y-4">
      <div className="flex gap-2 p-1 bg-white/5 rounded-2xl">
        {(['all', 'approved', 'rejected'] as const).map(f => (
          <button 
            key={f}
            onClick={() => setFilter(f)}
            className={`flex-1 py-2 rounded-xl text-xs font-bold capitalize transition-all ${filter === f ? 'bg-white/10 shadow-sm' : 'text-white/40'}`}
          >
            {f === 'all' ? TRANSLATIONS.FILTER_ALL : (f === 'approved' ? TRANSLATIONS.APPROVED : TRANSLATIONS.REJECTED)}
          </button>
        ))}
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
      </div>
    </div>
  );
}
