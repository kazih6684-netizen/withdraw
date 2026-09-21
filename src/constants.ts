/**
 * Bengali translations for the app
 */
export const TRANSLATIONS = {
  TITLE: "Unity Earning",
  SUBTITLE: "Smart Request System",
  ENTER: "প্রবেশ করুন",
  ADMIN_LOGIN: "অ্যাডমিন লগইন",
  TEAM_LEADER: "টিম লিডার",
  TEAM_TRAINER: "টিম ট্রেইনার",
  NAME: "নাম",
  NUMBER: "নাম্বার",
  AMOUNT: "টাকার পরিমাণ",
  NOTE: "নোট",
  SUBMIT: "সাবমিট করুন",
  PENDING: "পেন্ডিং",
  ACCEPTED: "একসেপ্টেড",
  CONFIRMED: "কনফার্মড",
  REJECTED: "রিজেক্টেড",
  HISTORY: "ইতিহাস",
  DASHBOARD: "ড্যাশবোর্ড",
  ADD_MEMBER: "সদস্য যোগ করুন",
  LOGOUT: "লগআউট",
  NOTIFICATIONS: "নোটিফিকেশন",
  DELETE: "মুছে ফেলুন",
  SEARCH: "অনুসন্ধান করুন",
  FILTER_ALL: "সব",
  PASSWORD: "পাসওয়ার্ড",
  ADMIN_CODE: "এডমিন কোড",
  SUCCESS_SUBMIT: "অনুরোধটি সফলভাবে পাঠানো হয়েছে",
  CONFIRM_APPROVE: "আপনি কি নিশ্চিত যে আপনি এটি অ্যাপ্রুভ করবেন?",
  CONFIRM_REJECT: "আপনি কি নিশ্চিত যে আপনি এটি রিজেক্ট করবেন?",
  CONFIRM_DELETE: "আপনি কি নিশ্চিত যে আপনি এটি মুছে ফেলবেন?",
  REMOVE: "রিমুভ করুন",
  WITHDRAW_REQUEST: "Withdraw Request",
  SEAT_BOOKING: "Seat Booking",
  RESERVE_SEAT: "RESERVE SEAT",
  MY_HISTORY: "My History",
  BOOKING: "Booking",
  BOOKING_RECEIVED: "বুকিং আবেদন প্রাপ্ত হয়েছে",
  BOOKING_PENDING_MSG: "আপনার সিট বুকিং পেন্ডিংয়ে রয়েছে, দ্রুত এডমিন কে জানান, এডমিন এ্যাপ্রুভ করলে বুকিং কনফার্ম হবে।",
  VIEW_INVOICE: "রিসিপ্ট দেখুন (VIEW INVOICE)",
  MY_HISTORY_BTN: "মাই হিস্টরি দেখুন (MY HISTORY)",
};

/**
 * Unique visual theme styles for non-photo member badges
 */
export interface BadgeTheme {
  bgGradient: string;
  borderColor: string;
  textColor: string;
  glowColor: string;
  badgeAccent: string;
}

export const MEMBER_BADGE_THEMES: BadgeTheme[] = [
  {
    bgGradient: "from-indigo-600 via-purple-600 to-pink-500",
    borderColor: "border-indigo-400/50",
    textColor: "text-white",
    glowColor: "shadow-[0_0_15px_rgba(99,102,241,0.4)]",
    badgeAccent: "bg-indigo-400 text-black",
  },
  {
    bgGradient: "from-cyan-500 via-teal-600 to-emerald-500",
    borderColor: "border-cyan-400/50",
    textColor: "text-white",
    glowColor: "shadow-[0_0_15px_rgba(6,182,212,0.4)]",
    badgeAccent: "bg-cyan-400 text-black",
  },
  {
    bgGradient: "from-amber-500 via-rose-600 to-orange-500",
    borderColor: "border-amber-400/50",
    textColor: "text-white",
    glowColor: "shadow-[0_0_15px_rgba(245,158,11,0.4)]",
    badgeAccent: "bg-amber-400 text-black",
  },
  {
    bgGradient: "from-blue-600 via-indigo-700 to-cyan-500",
    borderColor: "border-blue-400/50",
    textColor: "text-white",
    glowColor: "shadow-[0_0_15px_rgba(59,130,246,0.4)]",
    badgeAccent: "bg-blue-400 text-black",
  },
  {
    bgGradient: "from-fuchsia-600 via-purple-600 to-rose-500",
    borderColor: "border-fuchsia-400/50",
    textColor: "text-white",
    glowColor: "shadow-[0_0_15px_rgba(217,70,239,0.4)]",
    badgeAccent: "bg-fuchsia-400 text-black",
  },
  {
    bgGradient: "from-emerald-500 via-teal-600 to-lime-400",
    borderColor: "border-emerald-400/50",
    textColor: "text-white",
    glowColor: "shadow-[0_0_15px_rgba(16,185,129,0.4)]",
    badgeAccent: "bg-emerald-400 text-black",
  },
  {
    bgGradient: "from-violet-700 via-purple-800 to-indigo-900",
    borderColor: "border-amber-400/60",
    textColor: "text-amber-200",
    glowColor: "shadow-[0_0_15px_rgba(168,85,247,0.4)]",
    badgeAccent: "bg-amber-400 text-black",
  },
  {
    bgGradient: "from-orange-500 via-red-600 to-amber-500",
    borderColor: "border-orange-400/50",
    textColor: "text-white",
    glowColor: "shadow-[0_0_15px_rgba(249,115,22,0.4)]",
    badgeAccent: "bg-orange-400 text-black",
  },
];

/**
 * Deterministically pick a unique theme based on member name
 */
export function getMemberBadgeTheme(name: string): BadgeTheme {
  const hash = Math.abs(name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0));
  return MEMBER_BADGE_THEMES[hash % MEMBER_BADGE_THEMES.length];
}

/**
 * Extract 1-2 letter initials or English/Bengali display character from member name
 */
export function getMemberInitials(name: string): string {
  if (!name) return "UE";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}
