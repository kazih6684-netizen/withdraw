import React from 'react';
import { getMemberBadgeTheme, getMemberInitials } from '../constants';
import { Shield, Sparkles, Zap, UserCheck } from 'lucide-react';

interface MemberDesignBadgeProps {
  name: string;
  role?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const MemberDesignBadge: React.FC<MemberDesignBadgeProps> = ({
  name,
  role = 'leader',
  size = 'md',
  className = '',
}) => {
  const theme = getMemberBadgeTheme(name || 'Member');
  const initials = getMemberInitials(name || 'Member');
  const isLeader = role === 'leader';

  const sizeClasses = {
    sm: 'w-10 h-10 text-xs rounded-xl border',
    md: 'w-12 h-12 text-sm rounded-2xl border-2',
    lg: 'w-14 h-14 text-base rounded-2xl border-2',
  };

  const iconSizes = {
    sm: 10,
    md: 12,
    lg: 14,
  };

  return (
    <div
      className={`relative flex items-center justify-center font-black tracking-wider shrink-0 bg-gradient-to-br ${theme.bgGradient} ${theme.borderColor} ${theme.glowColor} ${theme.textColor} ${sizeClasses[size]} ${className} shadow-lg overflow-hidden group select-none`}
    >
      {/* Glossy Diagonal Pattern Overlay */}
      <div className="absolute inset-0 bg-gradient-to-tr from-black/20 via-transparent to-white/20 pointer-events-none" />
      <div className="absolute -top-3 -right-3 w-8 h-8 bg-white/15 rounded-full blur-sm pointer-events-none" />

      {/* Initials Text */}
      <span className="relative z-10 drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)] font-mono">
        {initials}
      </span>

      {/* Role Micro Badge Badge Accent */}
      <div
        className={`absolute -bottom-0.5 -right-0.5 p-1 rounded-tl-lg rounded-br-md shadow-md z-20 flex items-center justify-center ${
          isLeader ? 'bg-amber-400 text-black' : 'bg-cyan-400 text-black'
        }`}
        title={isLeader ? 'Team Leader' : 'Team Trainer'}
      >
        {isLeader ? (
          <Shield size={iconSizes[size]} className="fill-current" />
        ) : (
          <Zap size={iconSizes[size]} className="fill-current" />
        )}
      </div>
    </div>
  );
};
