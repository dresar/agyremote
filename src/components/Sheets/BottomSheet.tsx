import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  isOpen,
  onClose,
  title,
  children
}) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end md:justify-center md:items-center">
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/70 backdrop-blur-xs transition-opacity duration-150 motion-reduced:transition-none"
      />
      <div className="relative z-10 w-full max-w-md md:max-w-lg lg:max-w-xl mx-auto bg-[#16171d] border-t border-x md:border border-[#272832] rounded-t-xl md:rounded-2xl shadow-2xl max-h-[88vh] md:max-h-[85vh] flex flex-col transition-all duration-200 motion-reduced:transition-opacity motion-reduced:duration-150 overflow-hidden">
        <div className="w-10 h-1 bg-[#373946] rounded-full mx-auto mt-2.5 mb-2 shrink-0 cursor-grab md:hidden" />
        {title && (
          <div className="flex items-center justify-between px-4 py-2 border-b border-[#20222a] shrink-0">
            <h2 className="text-sm font-semibold text-zinc-100 tracking-tight font-sans">
              {title}
            </h2>
            <button
              onClick={onClose}
              className="p-1 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-[#20222a] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <div className="p-4 overflow-y-auto overscroll-contain safe-bottom">
          {children}
        </div>
      </div>
    </div>
  );
};
