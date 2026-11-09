import React, { useState } from 'react';
import { Bot } from 'lucide-react';

interface GoogleAvatarProps {
  picture?: string;
  id?: string;
  email?: string;
  sizeClassName?: string;
  iconSizeClassName?: string;
}

const GOOGLE_COLORS = [
  'bg-[#1a73e8]',
  'bg-[#ea4335]',
  'bg-[#fbbc04]',
  'bg-[#34a853]',
  'bg-[#9334e6]',
  'bg-[#0288d1]',
  'bg-[#e91e63]'
];

export const GoogleAvatar: React.FC<GoogleAvatarProps> = ({
  picture,
  id = 'worker',
  email = '',
  sizeClassName = 'w-8 h-8 rounded-full',
  iconSizeClassName = 'w-4 h-4'
}) => {
  const [imgError, setImgError] = useState(false);

  const initial = (email || id || 'A').charAt(0).toUpperCase();

  const colorIndex = Math.abs(
    (id + email).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  ) % GOOGLE_COLORS.length;

  const bgColor = GOOGLE_COLORS[colorIndex];

  if (picture && !imgError) {
    return (
      <div className={`${sizeClassName} overflow-hidden shrink-0 border border-blue-500/40 shadow-sm bg-[#1e2029]`}>
        <img
          src={picture}
          alt={id}
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      </div>
    );
  }

  if (email) {
    return (
      <div
        className={`${sizeClassName} ${bgColor} flex items-center justify-center shrink-0 text-white font-bold font-sans text-xs shadow-sm ring-1 ring-white/10 select-none`}
        title={email}
      >
        <span>{initial}</span>
      </div>
    );
  }

  return (
    <div className={`${sizeClassName} bg-[#1d1f2d] text-blue-400 border border-[#2b2e42] flex items-center justify-center shrink-0`}>
      <Bot className={iconSizeClassName} />
    </div>
  );
};
