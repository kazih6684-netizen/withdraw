import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  CheckCircle2,
  Download,
  MoreVertical,
  Share,
  ShieldCheck,
  Smartphone,
  Sparkles,
  X,
  Zap,
} from 'lucide-react';
import { BrowserInstallPlatform, useOnlineStatus } from '../hooks/usePWAInstall';

interface PWAInstallState {
  isInstallable: boolean;
  isInstalled: boolean;
  isIOS: boolean;
  browserPlatform: BrowserInstallPlatform;
  install: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
  markAsInstalled: () => void;
}

export const PWAInstallModal: React.FC<{
  isOpen: boolean;
  onSkip: () => void;
  appLogoUrl?: string;
  pwa: PWAInstallState;
}> = ({ isOpen, onSkip, appLogoUrl, pwa }) => {
  const [installing, setInstalling] = useState(false);
  const [showManualGuide, setShowManualGuide] = useState(false);
  const [dismissNotice, setDismissNotice] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setInstalling(false);
      setShowManualGuide(false);
      setDismissNotice(false);
    }
  }, [isOpen]);

  if (!isOpen || pwa.isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    if (installing) return;
    setInstalling(true);
    setDismissNotice(false);

    const outcome = await pwa.install();
    setInstalling(false);

    if (outcome === 'accepted') {
      onSkip();
    } else if (outcome === 'dismissed') {
      setDismissNotice(true);
    } else {
      // Browser doesn't expose native beforeinstallprompt (e.g. iOS Safari, Firefox, or menu-only browsers)
      setShowManualGuide(true);
    }
  };

  const renderManualSteps = () => {
    if (pwa.browserPlatform === 'ios') {
      return (
        <div className="bg-[#121624] border border-indigo-500/30 rounded-2xl p-3.5 space-y-2.5 text-left">
          <div className="flex items-center gap-2 text-xs font-extrabold text-indigo-300">
            <Share size={15} className="text-indigo-400 shrink-0" />
            <span>iPhone / iPad (Safari) ইনস্টলেশন গাইড:</span>
          </div>
          <ol className="space-y-2 text-xs text-white/85 leading-relaxed">
            <li className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-300 font-black text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                ১
              </span>
              <span>
                নিচে থাকা ব্রাউজারের{' '}
                <strong className="text-white inline-flex items-center gap-1">
                  Share <Share size={12} className="text-cyan-400" />
                </strong>{' '}
                বাটনে ট্যাপ করুন।
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-300 font-black text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                ২
              </span>
              <span>
                নিচে স্ক্রল করে{' '}
                <strong className="text-emerald-300">"Add to Home Screen"</strong> অপশনে
                ট্যাপ করুন এবং উপরে <strong>Add</strong> দিন।
              </span>
            </li>
          </ol>
        </div>
      );
    }

    return (
      <div className="bg-[#121624] border border-indigo-500/30 rounded-2xl p-3.5 space-y-2.5 text-left">
        <div className="flex items-center gap-2 text-xs font-extrabold text-indigo-300">
          <MoreVertical size={15} className="text-indigo-400 shrink-0" />
          <span>ব্রাউজার থেকে অ্যাপ ইনস্টল গাইড:</span>
        </div>
        <ol className="space-y-2 text-xs text-white/85 leading-relaxed">
          <li className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-300 font-black text-[10px] flex items-center justify-center shrink-0 mt-0.5">
              ১
            </span>
            <span>
              আপনার ব্রাউজারের উপরে ডানদিকে{' '}
              <strong className="text-white inline-flex items-center gap-0.5">
                মেনু ( <MoreVertical size={12} className="text-cyan-400" /> )
              </strong>{' '}
              বাটনে ক্লিক করুন।
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-300 font-black text-[10px] flex items-center justify-center shrink-0 mt-0.5">
              ২
            </span>
            <span>
              তালিকা থেকে{' '}
              <strong className="text-emerald-300">
                "Install app" / "Add to Home screen"
              </strong>{' '}
              অপশনে ট্যাপ করলেই সফটওয়্যারটি ফোনে অ্যাপ হিসেবে সেভ হয়ে যাবে।
            </span>
          </li>
        </ol>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onSkip}
        className="fixed inset-0 bg-black/80 backdrop-blur-md"
      />

      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 14 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0, y: 14 }}
        transition={{ type: 'spring', stiffness: 320, damping: 24 }}
        className="relative w-full max-w-sm bg-[#0d101b] border border-indigo-500/35 rounded-3xl p-5 sm:p-6 shadow-[0_0_45px_rgba(99,102,241,0.28)] z-10 my-auto overflow-hidden"
      >
        {/* Top Gradient Accent Bar */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-400" />

        {/* Subtle Top-Right Close Button */}
        <button
          type="button"
          onClick={onSkip}
          className="absolute top-4 right-4 p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-colors"
          aria-label="স্কিপ করুন"
        >
          <X size={18} />
        </button>

        {/* App Identity Header */}
        <div className="flex flex-col items-center text-center pt-1">
          <div className="relative">
            <div className="w-18 h-18 rounded-2xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-600 p-0.5 shadow-[0_0_25px_rgba(99,102,241,0.4)]">
              <img
                src={appLogoUrl || '/pwa-192x192.png'}
                alt="Unity Earning App"
                className="w-full h-full object-cover rounded-[14px] bg-[#0d101b]"
              />
            </div>
            <div className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-full bg-emerald-500 border-2 border-[#0d101b] flex items-center justify-center shadow-lg">
              <Download size={13} className="text-white" />
            </div>
          </div>

          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-[10px] font-black uppercase tracking-wider mt-4">
            <Sparkles size={11} className="text-indigo-400" />
            Official Mobile App
          </div>

          <h3 className="text-lg font-black text-white mt-2 leading-snug">
            Unity Earning অ্যাপ ইনস্টল করুন
          </h3>
          <p className="text-xs text-white/65 mt-1 leading-relaxed">
            ফোনের হোম স্ক্রিন থেকে সরাসরি ও দ্রুত ব্যবহারের জন্য অ্যাপটি আপনার ডিভাইসে ইনস্টল করে নিন।
          </p>
        </div>

        {/* Body: Standard Benefits OR Manual Browser Guide */}
        <div className="mt-4 space-y-3">
          {!showManualGuide ? (
            <>
              <div className="bg-[#121624] border border-white/10 rounded-2xl p-3.5 space-y-2.5 text-left">
                <div className="flex items-center gap-2.5 text-xs text-white/85">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
                    <Smartphone size={14} />
                  </div>
                  <span className="font-semibold">
                    ফোনে আসল অ্যাপের মতো ফুল-স্ক্রিন ও স্মুথ ব্যবহার
                  </span>
                </div>
                <div className="flex items-center gap-2.5 text-xs text-white/85">
                  <div className="w-7 h-7 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shrink-0">
                    <Zap size={14} />
                  </div>
                  <span className="font-semibold">
                    এক ক্লিকেই হোম স্ক্রিন থেকে দ্রুত লগইন ও রিকোয়েস্ট
                  </span>
                </div>
                <div className="flex items-center gap-2.5 text-xs text-white/85">
                  <div className="w-7 h-7 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 flex items-center justify-center shrink-0">
                    <ShieldCheck size={14} />
                  </div>
                  <span className="font-semibold">
                    যেকোনো ব্রাউজার (Chrome/Safari/Edge) থেকে সাপোর্টেড
                  </span>
                </div>
              </div>

              {dismissNotice && (
                <div className="bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] font-semibold px-3 py-2 rounded-xl text-center">
                  ইনস্টলেশন বাতিল করা হয়েছে। আপনি চাইলে নিচ থেকে আবার ইনস্টল বা স্কিপ করতে পারেন।
                </div>
              )}

              {/* Primary Install CTA */}
              <button
                type="button"
                onClick={handleInstallClick}
                disabled={installing}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-indigo-600 via-purple-600 to-emerald-500 hover:opacity-95 text-white font-black text-sm rounded-2xl shadow-lg shadow-indigo-500/25 transition-all flex items-center justify-center gap-2 active:scale-98 disabled:opacity-60"
              >
                {installing ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>ইনস্টল হচ্ছে...</span>
                  </>
                ) : (
                  <>
                    <Download size={18} />
                    <span>ইনস্টল করুন (Install App)</span>
                  </>
                )}
              </button>

              {/* Bottom Skip Button */}
              <button
                type="button"
                onClick={onSkip}
                className="w-full py-2.5 px-4 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white font-bold text-xs rounded-xl border border-white/10 transition-all active:scale-98"
              >
                এখন না, স্কিপ করুন (Skip)
              </button>
            </>
          ) : (
            <>
              {renderManualSteps()}

              {/* Confirm Installed Button for Manual Flow */}
              <button
                type="button"
                onClick={() => {
                  pwa.markAsInstalled();
                  onSkip();
                }}
                className="w-full py-3 px-4 bg-gradient-to-r from-emerald-600 to-teal-500 hover:opacity-95 text-white font-black text-xs rounded-2xl shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 active:scale-98"
              >
                <CheckCircle2 size={16} />
                <span>ইনস্টল সম্পন্ন হয়েছে (Done)</span>
              </button>

              {/* Bottom Skip Button */}
              <button
                type="button"
                onClick={onSkip}
                className="w-full py-2.5 px-4 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white font-bold text-xs rounded-xl border border-white/10 transition-all active:scale-98"
              >
                পরে ইনস্টল করব, স্কিপ করুন (Skip)
              </button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export const PWAInstallButton: React.FC<{
  isInstalled: boolean;
  onClick: () => void;
}> = ({ isInstalled, onClick }) => {
  if (isInstalled) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="px-3 py-2 bg-gradient-to-r from-indigo-500/20 to-emerald-500/20 hover:from-indigo-500/35 hover:to-emerald-500/35 border border-indigo-500/40 rounded-xl text-xs font-extrabold text-indigo-200 hover:text-white transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
      title="অ্যাপ ইনস্টল করুন"
    >
      <Download size={15} className="text-emerald-400 shrink-0" />
      <span className="hidden sm:inline">ইনস্টল</span>
    </button>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-[60] flex items-center gap-2 rounded-xl bg-amber-500/95 backdrop-blur-md px-3.5 py-2 text-xs font-bold text-black shadow-xl border border-amber-300/40">
      <span className="h-2 w-2 rounded-full bg-black animate-pulse" />
      <span>অফলাইন মোড — সংযোগ বিচ্ছিন্ন</span>
    </div>
  );
};
