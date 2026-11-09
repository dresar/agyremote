import React, { useState, useRef, useEffect } from 'react';
import { GoogleAvatar } from '../Common/GoogleAvatar.tsx';
import {
  ArrowLeft,
  MoreVertical,
  Cpu,
  Settings,
  RefreshCw,
  Sparkles,
  Shield,
  Eye,
  EyeOff,
  LogOut
} from 'lucide-react';

interface AppHeaderProps {
  title: string;
  canGoBack?: boolean;
  onBack?: () => void;
  onOpenModelSelector?: () => void;
  onOpenUsage?: () => void;
  onOpenAccount?: () => void;
  onOpenSettings?: () => void;
  onToggleTabBar?: () => void;
  isTabBarVisible?: boolean;
  onRefresh?: () => void;
  isLoading?: boolean;
  onLogout?: () => void;
  userPicture?: string;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  title,
  canGoBack = false,
  onBack,
  onOpenModelSelector,
  onOpenUsage,
  onOpenAccount,
  onOpenSettings,
  onToggleTabBar,
  isTabBarVisible = true,
  onRefresh,
  isLoading = false,
  onLogout,
  userPicture
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  return (
    <header className="sticky top-0 inset-x-0 w-full shrink-0 flex items-center justify-between py-2.5 px-3 bg-[#0c0d0e]/95 backdrop-blur-md border-b border-[#1f212a] z-40 select-none">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {canGoBack && onBack ? (
          <button
            onClick={onBack}
            className="p-1.5 -ml-1 rounded-full text-zinc-300 hover:text-white hover:bg-[#1a1b24] active:bg-[#12131a] transition-all cursor-pointer shrink-0"
            title="Kembali"
          >
            <ArrowLeft className="w-5 h-5 stroke-[2.2]" />
          </button>
        ) : null}

        <div className="flex items-center gap-2 min-w-0">
          <span className="font-semibold text-sm text-zinc-100 truncate tracking-tight">
            {title}
          </span>
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.9)] shrink-0" />
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setIsMenuOpen((prev) => !prev)}
            className="p-1.5 rounded-full text-zinc-400 hover:text-zinc-100 hover:bg-[#181922] transition-colors"
            title="Menu Aksi"
          >
            <MoreVertical className="w-5 h-5 stroke-[2]" />
          </button>

          {isMenuOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-52 rounded-2xl bg-[#161720] border border-[#2b2d3c] shadow-2xl py-1.5 z-50 text-xs animate-in fade-in zoom-in-95 duration-100">
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  onOpenModelSelector?.();
                }}
                className="w-full px-3.5 py-2.5 text-left text-zinc-200 hover:bg-[#202230] flex items-center gap-2.5 transition-colors"
              >
                <Sparkles className="w-4 h-4 text-blue-400" />
                <span>Pilih Model</span>
              </button>

              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  onOpenUsage?.();
                }}
                className="w-full px-3.5 py-2.5 text-left text-zinc-200 hover:bg-[#202230] flex items-center gap-2.5 transition-colors"
              >
                <Cpu className="w-4 h-4 text-emerald-400" />
                <span>Cek Usage</span>
              </button>

              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  onOpenAccount?.();
                }}
                className="w-full px-3.5 py-2.5 text-left text-zinc-200 hover:bg-[#202230] flex items-center gap-2.5 transition-colors"
              >
                <Shield className="w-4 h-4 text-amber-400" />
                <span>Kelola 15 Worker</span>
              </button>

              {onToggleTabBar && (
                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    onToggleTabBar();
                  }}
                  className="w-full px-3.5 py-2.5 text-left text-zinc-200 hover:bg-[#202230] flex items-center gap-2.5 transition-colors"
                >
                  {isTabBarVisible ? (
                    <>
                      <EyeOff className="w-4 h-4 text-zinc-400" />
                      <span>Sembunyikan Menu Bawah</span>
                    </>
                  ) : (
                    <>
                      <Eye className="w-4 h-4 text-blue-400" />
                      <span>Tampilkan Menu Bawah</span>
                    </>
                  )}
                </button>
              )}

              <div className="my-1 border-t border-[#232533]" />

              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  onRefresh?.();
                }}
                className="w-full px-3.5 py-2.5 text-left text-zinc-200 hover:bg-[#202230] flex items-center gap-2.5 transition-colors"
              >
                <RefreshCw className={`w-4 h-4 text-zinc-400 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Segarkan Data</span>
              </button>

              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  onOpenSettings?.();
                }}
                className="w-full px-3.5 py-2.5 text-left text-zinc-200 hover:bg-[#202230] flex items-center gap-2.5 transition-colors"
              >
                <Settings className="w-4 h-4 text-zinc-400" />
                <span>Pengaturan</span>
              </button>

              {onLogout && (
                <>
                  <div className="my-1 border-t border-[#232533]" />
                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      onLogout();
                    }}
                    className="w-full px-3.5 py-2.5 text-left text-red-400 hover:bg-[#202230] flex items-center gap-2.5 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Keluar</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        <button
          onClick={onOpenAccount}
          className="ml-0.5 relative rounded-full p-0.5 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          title="Google Account"
        >
          <GoogleAvatar
            picture={userPicture}
            id="google-user"
            email="google"
            sizeClassName="w-7 h-7 rounded-full"
            iconSizeClassName="w-3.5 h-3.5 text-white"
          />
        </button>
      </div>
    </header>
  );
};
