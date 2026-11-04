import React, { useState } from 'react';
import { User, Lock, Eye, EyeOff, ChevronRight } from 'lucide-react';
import boardroomHeroImg from '../assets/images/boardroom_hero_clean_1793549075422.jpg';
import archiveShelvesBgImg from '../assets/images/archive_shelves_navy_bg_1793549075577.jpg';

interface LoginViewProps {
  onLoginSuccess: (username: string) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const trimmedUser = username.trim();
    // Preserve smooth authentication into the system while linking the entered username
    onLoginSuccess(trimmedUser || 'مسؤول النظام - ساعد');
  };

  return (
    <div
      dir="ltr"
      className="min-h-screen w-full flex flex-col lg:flex-row bg-[#051225] text-white overflow-x-hidden select-text"
    >
      {/* Left Visual Section: Luxury Executive Boardroom + Selectable HTML Titles */}
      <section className="relative w-full lg:w-[63.5%] min-h-[480px] sm:min-h-[560px] lg:min-h-screen flex flex-col justify-start overflow-hidden bg-gradient-to-b from-[#06152d] via-[#0b2347] to-[#1a2536]">
        {/* High-Resolution 4K Clean Boardroom Photograph */}
        <img
          src={boardroomHeroImg}
          alt="Luxury Executive Boardroom - نظام إدارة محاضر الاجتماعات والأرشفة"
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none select-none"
        />

        {/* Deep Navy Top Atmospheric Scrim for High-Contrast Typography */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-b from-[#051329]/95 via-[#071b38]/75 via-[38%] to-transparent pointer-events-none"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-r from-[#041022]/30 via-transparent to-[#041022]/40 pointer-events-none"
        />

        {/* Overlay Titles — 100% Real Selectable & Copyable HTML Typography */}
        <div className="relative z-10 w-full max-w-3xl mx-auto px-6 sm:px-10 pt-10 sm:pt-12 lg:pt-14 text-center select-text">
          <h1
            dir="rtl"
            className="font-display text-3xl sm:text-4xl xl:text-[46px] font-bold leading-[1.28] tracking-normal"
          >
            <span className="block text-white drop-shadow-[0_4px_18px_rgba(0,0,0,0.75)]">
              نظام إدارة محاضر الاجتماعات
            </span>
            <span className="block mt-1.5 bg-gradient-to-b from-[#f9e2a2] via-[#e4bc6e] to-[#c7923e] bg-clip-text text-transparent drop-shadow-[0_4px_16px_rgba(0,0,0,0.65)]">
              والأرشفة
            </span>
          </h1>

          {/* Decorative Golden Horizontal Line with Center Diamond */}
          <div
            aria-hidden="true"
            className="my-5 sm:my-6 flex items-center justify-center max-w-[440px] mx-auto"
          >
            <span className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-[#d4af37]/85 to-[#f1d38a]" />
            <span className="mx-3 w-2 h-2 rotate-45 bg-[#f1d38a] shadow-[0_0_10px_rgba(241,211,138,0.9)] shrink-0" />
            <span className="h-[1px] flex-1 bg-gradient-to-l from-transparent via-[#d4af37]/85 to-[#f1d38a]" />
          </div>

          {/* English System Title */}
          <h2
            dir="ltr"
            className="font-en-serif text-xl sm:text-2xl xl:text-[31px] font-normal leading-[1.32] tracking-wide drop-shadow-[0_3px_12px_rgba(0,0,0,0.85)]"
          >
            <span className="block text-white">Meeting Minutes &amp; Archiving</span>
            <span className="block text-[#edd298] mt-0.5">Management System</span>
          </h2>

          {/* Arabic Subtitle Quote */}
          <p
            dir="rtl"
            className="mt-4 sm:mt-5 text-sm sm:text-base xl:text-[19px] font-medium text-white/95 tracking-normal drop-shadow-[0_2px_10px_rgba(0,0,0,0.85)]"
          >
            اجتماعات منظّمة، قرارات موثّقة، وأرشفة ذكية
          </p>
        </div>
      </section>

      {/* Golden Divider Line Between Left & Right Sections */}
      <div
        aria-hidden="true"
        className="hidden lg:block w-[2px] shrink-0 bg-gradient-to-b from-[#a87e33] via-[#f1d48b] to-[#a87e33] shadow-[0_0_14px_rgba(212,175,55,0.45)] z-20"
      />
      <div
        aria-hidden="true"
        className="block lg:hidden h-[2px] w-full shrink-0 bg-gradient-to-r from-[#a87e33] via-[#f1d48b] to-[#a87e33]"
      />

      {/* Right Login Section: Deep Navy Archive Binders Backdrop + Golden Framed Login Card */}
      <section className="relative w-full lg:w-[36.5%] lg:min-h-screen flex items-center justify-center px-5 sm:px-8 xl:px-12 py-12 lg:py-8 bg-[#061427] overflow-hidden">
        {/* Archive Binders Background Image with Deep Navy Color Grading */}
        <img
          src={archiveShelvesBgImg}
          alt=""
          aria-hidden="true"
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover object-center opacity-35 pointer-events-none select-none"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-b from-[#071832]/80 via-[#061428]/85 to-[#040e1e]/92 pointer-events-none"
        />

        {/* Thin Gold-Bordered Login Card */}
        <div className="relative z-10 w-full max-w-[420px] rounded-[18px] border border-[#d6b161]/80 bg-[#091931]/90 backdrop-blur-md px-7 sm:px-9 py-9 sm:py-11 shadow-[0_24px_64px_rgba(0,0,0,0.78),0_0_28px_rgba(212,175,55,0.08)]">
          {/* Top Golden Document & Archiving Icon */}
          <div className="flex justify-center">
            <svg
              viewBox="0 0 84 84"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="w-[74px] h-[74px] drop-shadow-[0_0_12px_rgba(235,199,112,0.4)]"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="goldIconGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#fae4a7" />
                  <stop offset="50%" stopColor="#dfba69" />
                  <stop offset="100%" stopColor="#b88938" />
                </linearGradient>
              </defs>
              {/* Back Stacked Sheet */}
              <path
                d="M23 44V18C23 15.7909 24.7909 14 27 14H48"
                stroke="url(#goldIconGrad)"
                strokeWidth="2.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Main Document Sheet with Folded Top-Right Corner */}
              <path
                d="M28 45V21C28 19.3431 29.3431 18 31 18H50L59 27V45"
                stroke="url(#goldIconGrad)"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Folded Corner Flap */}
              <path
                d="M50 18V27H59"
                stroke="url(#goldIconGrad)"
                strokeWidth="2.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Document Horizontal Text Lines */}
              <line
                x1="34"
                y1="26"
                x2="45"
                y2="26"
                stroke="url(#goldIconGrad)"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
              <line
                x1="34"
                y1="32"
                x2="52"
                y2="32"
                stroke="url(#goldIconGrad)"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
              <line
                x1="34"
                y1="38"
                x2="52"
                y2="38"
                stroke="url(#goldIconGrad)"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
              <line
                x1="34"
                y1="44"
                x2="49"
                y2="44"
                stroke="url(#goldIconGrad)"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
              {/* Archive Box Upper Rim / Side Flaps */}
              <path
                d="M19 50L23 44H28M65 50L59 44"
                stroke="url(#goldIconGrad)"
                strokeWidth="2.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Archive Box Front Body */}
              <rect
                x="19"
                y="50"
                width="46"
                height="20"
                rx="3.5"
                stroke="url(#goldIconGrad)"
                strokeWidth="2.5"
              />
              {/* Archive Box Handle Slot */}
              <path
                d="M35 58H49"
                stroke="url(#goldIconGrad)"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
              <path
                d="M38 61H46"
                stroke="url(#goldIconGrad)"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </div>

          {/* Bilingual Welcome Heading */}
          <div className="mt-3.5 text-center select-text">
            <h3
              dir="rtl"
              className="font-display text-2xl sm:text-[31px] font-bold bg-gradient-to-b from-[#fae3a4] via-[#e4bc6e] to-[#c79340] bg-clip-text text-transparent leading-tight"
            >
              مرحبًا بعودتك
            </h3>
            <p
              dir="ltr"
              className="mt-1 font-en-serif text-base sm:text-[18px] text-[#e7ca8b] tracking-wide"
            >
              Welcome Back
            </p>
          </div>

          {errorMsg && (
            <div
              dir="rtl"
              className="mt-4 px-3.5 py-2 rounded-lg bg-red-950/80 border border-red-500/50 text-red-200 text-xs text-center"
            >
              {errorMsg}
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="mt-7 space-y-5">
            {/* Username Field */}
            <div>
              <label htmlFor="login-username" className="block text-left mb-2 cursor-pointer select-text">
                <span
                  dir="rtl"
                  className="block text-sm sm:text-[15px] font-semibold text-white leading-snug"
                >
                  اسم المستخدم
                </span>
                <span
                  dir="ltr"
                  className="block font-en-serif text-xs sm:text-[13px] text-[#b0c2de] leading-tight mt-0.5"
                >
                  Username
                </span>
              </label>

              <div className="relative flex items-center w-full h-[50px] rounded-[10px] bg-[#132544]/90 border border-[#5676a1]/80 focus-within:border-[#e5c168] focus-within:ring-1 focus-within:ring-[#e5c168]/50 transition-colors px-3.5">
                <User className="w-[19px] h-[19px] text-[#cddbf0] shrink-0" strokeWidth={1.75} />
                <input
                  id="login-username"
                  type="text"
                  dir="auto"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full h-full px-3 bg-transparent text-white text-sm focus:outline-none placeholder:text-[#8ea6c8]/60"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="login-password" className="block text-left mb-2 cursor-pointer select-text">
                <span
                  dir="rtl"
                  className="block text-sm sm:text-[15px] font-semibold text-white leading-snug"
                >
                  كلمة المرور
                </span>
                <span
                  dir="ltr"
                  className="block font-en-serif text-xs sm:text-[13px] text-[#b0c2de] leading-tight mt-0.5"
                >
                  Password
                </span>
              </label>

              <div className="relative flex items-center w-full h-[50px] rounded-[10px] bg-[#132544]/90 border border-[#5676a1]/80 focus-within:border-[#e5c168] focus-within:ring-1 focus-within:ring-[#e5c168]/50 transition-colors px-3.5">
                <Lock className="w-[19px] h-[19px] text-[#cddbf0] shrink-0" strokeWidth={1.75} />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  dir="ltr"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="•••••••"
                  className="w-full h-full px-3 bg-transparent text-white text-sm tracking-[0.25em] focus:outline-none placeholder:text-[#c7d6eb]/85 placeholder:tracking-[0.35em]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'إخفاء كلمة المرور - Hide Password' : 'إظهار كلمة المرور - Show Password'}
                  title={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                  className="p-1 text-[#cddbf0] hover:text-[#f5d78e] transition-colors shrink-0 focus:outline-none"
                >
                  {showPassword ? (
                    <EyeOff className="w-[19px] h-[19px]" strokeWidth={1.75} />
                  ) : (
                    <Eye className="w-[19px] h-[19px]" strokeWidth={1.75} />
                  )}
                </button>
              </div>
            </div>

            {/* Sign In Button */}
            <div className="pt-2">
              <button
                type="submit"
                className="group relative w-full py-2.5 px-5 rounded-[10px] border border-[#dfc072]/90 bg-gradient-to-b from-[#1659e0] via-[#0a3eb0] to-[#052375] hover:from-[#1f64ec] hover:via-[#0e47c4] hover:to-[#072c8c] active:scale-[0.995] transition-all shadow-[0_8px_24px_rgba(6,38,117,0.65),inset_0_1px_1px_rgba(255,255,255,0.3)] flex items-center justify-center cursor-pointer"
              >
                {/* Subtle Top-Left Golden Specular Flare matching the reference */}
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute -top-[1px] left-12 w-16 h-[2px] bg-gradient-to-r from-transparent via-[#fff3cc] to-transparent opacity-90"
                />

                <div className="text-center select-text">
                  <span
                    dir="rtl"
                    className="block font-display text-base sm:text-[17px] font-bold text-white leading-snug"
                  >
                    تسجيل الدخول
                  </span>
                  <span
                    dir="ltr"
                    className="block font-en-serif text-xs sm:text-[13.5px] text-white/95 leading-tight mt-0.5"
                  >
                    Sign In
                  </span>
                </div>

                <ChevronRight
                  className="w-5 h-5 text-white/95 absolute right-4 top-1/2 -translate-y-1/2 group-hover:translate-x-0.5 transition-transform"
                  strokeWidth={2.2}
                />
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
};
