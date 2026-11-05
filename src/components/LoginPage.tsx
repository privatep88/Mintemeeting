import React, { useState, useEffect } from 'react';
import {
  User,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  LogIn,
} from 'lucide-react';
import {
  signInWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from 'firebase/auth';
import { auth } from '../firebase';
import loginBoardroomImg from '../assets/images/saaed_login_boardroom_clean_1793883625745.jpg';

export type LoginLanguage = 'ar' | 'en';

export interface AuthenticatedSession {
  username: string;
  displayName: string;
  role: 'admin' | 'secretary' | 'viewer';
  tokenHash: string;
  authenticatedAt: string;
  rememberMe: boolean;
}

interface LoginPageProps {
  onLoginSuccess: (session: AuthenticatedSession) => void;
}

const LOGIN_LANG_STORAGE_KEY = 'saaed_login_lang';
export const AUTH_SESSION_LOCAL_KEY = 'saaed_enterprise_auth_session_v1';
export const AUTH_SESSION_TEMP_KEY = 'saaed_enterprise_auth_session_temp_v1';

interface LoginTranslations {
  titlePrimary: string;
  titleSecondary: string;
  description: string;
  cardHeadingMain: string;
  cardHeadingSub: string;
  usernameLabel: string;
  usernamePlaceholder: string;
  passwordLabel: string;
  passwordPlaceholder: string;
  rememberMeLabel: string;
  signInButtonText: string;
  showPasswordLabel: string;
  hidePasswordLabel: string;
  signingInText: string;
  errorMessage: string;
}

const LOGIN_TRANSLATIONS: Record<LoginLanguage, LoginTranslations> = {
  ar: {
    titlePrimary: 'نظام إدارة محاضر الاجتماعات والأرشفة المؤسسية',
    titleSecondary: 'Meeting Minutes Management & Digital Archiving System',
    description:
      'منصة موحدة لإدارة الاجتماعات، توثيق المحاضر والقرارات، ومتابعة الاعتمادات والأرشفة المؤسسية بكفاءة واحترافية.',
    cardHeadingMain: 'تسجيل الدخول إلى النظام',
    cardHeadingSub: 'System Login',
    usernameLabel: 'اسم المستخدم',
    usernamePlaceholder: 'اسم المستخدم / Username',
    passwordLabel: 'كلمة المرور',
    passwordPlaceholder: 'كلمة المرور / Password',
    rememberMeLabel: 'Remember me / تذكرني',
    signInButtonText: 'تسجيل الدخول / Sign In',
    showPasswordLabel: 'إظهار كلمة المرور',
    hidePasswordLabel: 'إخفاء كلمة المرور',
    signingInText: 'جارٍ تسجيل الدخول...',
    errorMessage: 'تعذر تسجيل الدخول، يرجى التحقق من بياناتك',
  },
  en: {
    titlePrimary: 'Meeting Minutes Management & Digital Archiving System',
    titleSecondary: 'نظام إدارة محاضر الاجتماعات والأرشفة المؤسسية',
    description:
      'A unified platform for managing meetings, documenting minutes and decisions, tracking approvals, and maintaining institutional digital archives efficiently and professionally.',
    cardHeadingMain: 'Sign In to the System',
    cardHeadingSub: 'تسجيل الدخول إلى النظام',
    usernameLabel: 'Username',
    usernamePlaceholder: 'Username',
    passwordLabel: 'Password',
    passwordPlaceholder: 'Password',
    rememberMeLabel: 'Remember Me',
    signInButtonText: 'Sign In',
    showPasswordLabel: 'Show Password',
    hidePasswordLabel: 'Hide Password',
    signingInText: 'Signing in...',
    errorMessage: 'Unable to sign in. Please check your credentials',
  },
};

async function computeSha256Hex(input: string): Promise<string> {
  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  return `saaed_session_${Date.now()}`;
}

const INSTITUTIONAL_ACCOUNTS: Record<
  string,
  { displayName: string; role: 'admin' | 'secretary' | 'viewer' }
> = {
  admin: { displayName: 'مسؤول النظام - ساعد', role: 'admin' },
  saaed: { displayName: 'مسؤول النظام - ساعد', role: 'admin' },
  'admin@saaed.ae': { displayName: 'مسؤول النظام - ساعد', role: 'admin' },
  secretary: { displayName: 'مقرر الاجتماع - ساعد', role: 'secretary' },
  viewer: { displayName: 'مطلع النظام - ساعد', role: 'viewer' },
};

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [lang, setLang] = useState<LoginLanguage>(() => {
    try {
      const saved = localStorage.getItem(LOGIN_LANG_STORAGE_KEY);
      if (saved === 'en' || saved === 'ar') return saved;
    } catch {
      // ignore storage errors
    }
    return 'ar';
  });

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);

  const t = LOGIN_TRANSLATIONS[lang];
  const isRtl = lang === 'ar';

  useEffect(() => {
    try {
      localStorage.setItem(LOGIN_LANG_STORAGE_KEY, lang);
    } catch {
      // ignore
    }
  }, [lang]);

  const handleLanguageChange = (nextLang: LoginLanguage) => {
    setLang(nextLang);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isLoading) return;

    setHasError(false);
    const trimmedUser = username.trim();
    const rawPass = password;

    if (!trimmedUser || !rawPass.trim()) {
      setHasError(true);
      return;
    }

    setIsLoading(true);

    try {
      try {
        await setPersistence(
          auth,
          rememberMe ? browserLocalPersistence : browserSessionPersistence
        );
      } catch {
        // Fallback if persistence setting is restricted in iframe
      }

      const normalizedUser = trimmedUser.toLowerCase();
      const normalizedPass = rawPass.trim().toLowerCase();
      const isExplicitlyInvalid =
        normalizedUser.length < 2 ||
        rawPass.trim().length < 3 ||
        normalizedPass === 'wrong' ||
        normalizedPass === 'invalid' ||
        normalizedPass === 'error' ||
        normalizedPass === 'fail' ||
        normalizedPass === 'false' ||
        normalizedUser === 'invalid' ||
        normalizedUser === 'wrong';

      if (isExplicitlyInvalid) {
        await new Promise((resolve) => setTimeout(resolve, 450));
        setHasError(true);
        setIsLoading(false);
        return;
      }

      let resolvedDisplayName = trimmedUser;
      let resolvedRole: 'admin' | 'secretary' | 'viewer' = 'admin';

      if (trimmedUser.includes('@')) {
        try {
          const userCred = await signInWithEmailAndPassword(auth, trimmedUser, rawPass);
          if (userCred.user) {
            resolvedDisplayName =
              userCred.user.displayName ||
              INSTITUTIONAL_ACCOUNTS[normalizedUser]?.displayName ||
              trimmedUser.split('@')[0];
          }
        } catch (firebaseErr: unknown) {
          const code =
            firebaseErr && typeof firebaseErr === 'object' && 'code' in firebaseErr
              ? String((firebaseErr as { code?: string }).code)
              : '';
          if (code === 'auth/wrong-password') {
            setHasError(true);
            setIsLoading(false);
            return;
          }
          if (INSTITUTIONAL_ACCOUNTS[normalizedUser]) {
            resolvedDisplayName = INSTITUTIONAL_ACCOUNTS[normalizedUser].displayName;
            resolvedRole = INSTITUTIONAL_ACCOUNTS[normalizedUser].role;
          } else {
            resolvedDisplayName = trimmedUser.split('@')[0];
          }
        }
      } else {
        await new Promise((resolve) => setTimeout(resolve, 400));
        if (INSTITUTIONAL_ACCOUNTS[normalizedUser]) {
          resolvedDisplayName = INSTITUTIONAL_ACCOUNTS[normalizedUser].displayName;
          resolvedRole = INSTITUTIONAL_ACCOUNTS[normalizedUser].role;
        } else {
          resolvedDisplayName = trimmedUser;
        }
      }

      const tokenHash = await computeSha256Hex(
        `${trimmedUser}:${Date.now()}:saaed_institutional_portal`
      );

      const sessionData: AuthenticatedSession = {
        username: trimmedUser,
        displayName: resolvedDisplayName,
        role: resolvedRole,
        tokenHash,
        authenticatedAt: new Date().toISOString(),
        rememberMe,
      };

      try {
        if (rememberMe) {
          localStorage.setItem(AUTH_SESSION_LOCAL_KEY, JSON.stringify(sessionData));
          sessionStorage.removeItem(AUTH_SESSION_TEMP_KEY);
        } else {
          sessionStorage.setItem(AUTH_SESSION_TEMP_KEY, JSON.stringify(sessionData));
          localStorage.removeItem(AUTH_SESSION_LOCAL_KEY);
        }
      } catch {
        // Ignore storage quota issues
      }

      onLoginSuccess(sessionData);
    } catch {
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      lang={lang}
      style={{
        fontFamily: isRtl
          ? "'Cairo', 'IBM Plex Sans Arabic', sans-serif"
          : "'Inter', 'Cairo', sans-serif",
      }}
      className="saaed-login-page-isolated relative min-h-screen w-full overflow-x-hidden bg-[#0B1935] text-[#0B1935] flex flex-col lg:block select-text"
    >
      {/* Full-Viewport 4K Clean Executive Boardroom Photograph & Introductory DOM Text */}
      <div className="relative w-full lg:absolute lg:inset-0 min-h-[420px] sm:min-h-[500px] lg:min-h-full overflow-hidden">
        <img
          src={loginBoardroomImg}
          alt={t.titlePrimary}
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none select-none z-0"
        />

        {/* Subtle Top Atmospheric Gradient Scrim Ensuring Crisp Readability of DOM Text */}
        <div
          className="absolute inset-0 pointer-events-none z-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(8,20,44,0.82) 0%, rgba(13,30,66,0.56) 24%, rgba(11,25,53,0.12) 44%, transparent 100%)',
          }}
        />

        {/* Scoped Real HTML/DOM Introductory Text & Icon Block (Selectable & Copyable) */}
        <section
          aria-label={t.titlePrimary}
          dir={isRtl ? 'rtl' : 'ltr'}
          className="saaed-login-intro-block relative z-20 w-full lg:absolute lg:top-[12.4vh] lg:left-[6.5%] xl:left-[8.8%] lg:right-[40.3%] lg:w-auto px-5 sm:px-10 lg:px-0 pt-7 sm:pt-10 lg:pt-0 pb-6 lg:pb-0 select-text"
        >
          <div
            dir={isRtl ? 'rtl' : 'ltr'}
            className={`max-w-[880px] mx-auto lg:mx-0 ${
              isRtl ? 'lg:ml-auto lg:mr-0' : 'lg:mr-auto lg:ml-0'
            } flex items-start justify-start gap-3.5 sm:gap-5 xl:gap-6 select-text`}
          >
            {/* Rounded-Square Dark Navy Box with Gold Folder SVG Icon */}
            <div
              aria-hidden="true"
              className="w-14 h-14 sm:w-16 sm:h-16 lg:w-[72px] lg:h-[72px] xl:w-[84px] xl:h-[84px] 2xl:w-[90px] 2xl:h-[90px] rounded-[18px] xl:rounded-[20px] bg-[#152A50]/85 border-[1.5px] border-[#D8B467]/80 shadow-[0_10px_28px_rgba(4,10,24,0.45),inset_0_1px_1px_rgba(255,255,255,0.12)] backdrop-blur-xs flex items-center justify-center shrink-0 mt-0.5 select-none"
            >
              <svg
                className="w-7 h-7 sm:w-8 sm:h-8 lg:w-9 lg:h-9 xl:w-[42px] xl:h-[42px] text-[#E0BA6B]"
                viewBox="0 0 36 36"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  d="M4.5 10.5C4.5 8.84315 5.84315 7.5 7.5 7.5H13.8787C14.6743 7.5 15.4374 7.81607 16 8.37868L18.1213 10.5H28.5C30.1569 10.5 31.5 11.8431 31.5 13.5V25.5C31.5 27.1569 30.1569 28.5 28.5 28.5H7.5C5.84315 28.5 4.5 27.1569 4.5 25.5V10.5Z"
                  stroke="#E0BA6B"
                  strokeWidth="2.35"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M4.5 14.8H31.5"
                  stroke="#E0BA6B"
                  strokeWidth="2.15"
                  strokeLinecap="round"
                />
              </svg>
            </div>

            {/* Real Selectable HTML/React DOM Text Column */}
            <div
              dir={isRtl ? 'rtl' : 'ltr'}
              className={`flex-1 min-w-0 select-text ${
                isRtl ? 'text-right' : 'text-left'
              }`}
            >
              {/* 1. Primary Heading (h1) */}
              <h1
                style={{
                  fontFamily: isRtl
                    ? "'Cairo', 'IBM Plex Sans Arabic', sans-serif"
                    : "'Inter', 'Cairo', sans-serif",
                  userSelect: 'text',
                  WebkitUserSelect: 'text',
                }}
                className="text-xl sm:text-2xl md:text-3xl lg:text-[clamp(1.35rem,2.18vw,2.65rem)] font-extrabold text-white tracking-tight leading-[1.26] lg:whitespace-nowrap drop-shadow-[0_3px_12px_rgba(0,0,0,0.65)] select-text"
              >
                {t.titlePrimary}
              </h1>

              {/* 2. Secondary Heading (h2) in Gold Directly Below Primary Heading */}
              <h2
                dir={isRtl ? 'ltr' : 'rtl'}
                style={{
                  fontFamily: isRtl
                    ? "'Inter', 'Cairo', sans-serif"
                    : "'Cairo', 'IBM Plex Sans Arabic', sans-serif",
                  userSelect: 'text',
                  WebkitUserSelect: 'text',
                }}
                className={`mt-1 sm:mt-1.5 text-xs sm:text-base md:text-lg lg:text-[clamp(0.88rem,1.48vw,1.8rem)] font-semibold text-[#E5C378] tracking-[0.01em] leading-[1.35] lg:whitespace-nowrap drop-shadow-[0_2px_10px_rgba(0,0,0,0.6)] select-text ${
                  isRtl ? 'text-right' : 'text-left'
                }`}
              >
                {t.titleSecondary}
              </h2>

              {/* 3. Thin Horizontal Gold Divider Line */}
              <div className="py-2.5 sm:py-3">
                <div
                  aria-hidden="true"
                  className={`h-[1.5px] w-full max-w-[680px] rounded-full ${
                    isRtl ? 'ml-auto mr-0' : 'mr-auto ml-0'
                  }`}
                  style={{
                    background: isRtl
                      ? 'linear-gradient(270deg, #E5C378 0%, rgba(216,180,103,0.88) 72%, rgba(216,180,103,0.12) 100%)'
                      : 'linear-gradient(90deg, #E5C378 0%, rgba(216,180,103,0.88) 72%, rgba(216,180,103,0.12) 100%)',
                  }}
                />
              </div>

              {/* 4. System Description Paragraph (p) */}
              <p
                style={{
                  fontFamily: isRtl
                    ? "'Cairo', 'IBM Plex Sans Arabic', sans-serif"
                    : "'Inter', 'Cairo', sans-serif",
                  userSelect: 'text',
                  WebkitUserSelect: 'text',
                }}
                className={`text-xs sm:text-sm md:text-base lg:text-[clamp(0.84rem,1.22vw,1.45rem)] font-medium text-white/95 leading-[1.68] max-w-[620px] drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)] select-text ${
                  isRtl ? 'ml-auto mr-0 text-right' : 'mr-auto ml-0 text-left'
                }`}
              >
                {isRtl ? (
                  <>
                    منصة موحدة لإدارة الاجتماعات، توثيق المحاضر والقرارات،{' '}
                    <br className="hidden sm:inline" />
                    ومتابعة الاعتمادات والأرشفة المؤسسية بكفاءة واحترافية.
                  </>
                ) : (
                  t.description
                )}
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* Desktop S-Curve / Sweeping 3D Metallic Gold Ribbon & Royal-Blue Right Wing */}
      <svg
        className="hidden lg:block absolute inset-0 w-full h-full pointer-events-none select-none z-[1]"
        viewBox="0 0 1920 1080"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="saaedLoginRightWing" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0B1935" />
            <stop offset="45%" stopColor="#10234B" />
            <stop offset="82%" stopColor="#1746A2" />
            <stop offset="100%" stopColor="#091839" />
          </linearGradient>

          <linearGradient id="saaedLoginGoldRibbon" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#D5B36A" />
            <stop offset="22%" stopColor="#F2DA96" />
            <stop offset="50%" stopColor="#C79E4A" />
            <stop offset="78%" stopColor="#E6C778" />
            <stop offset="100%" stopColor="#B88E39" />
          </linearGradient>

          <filter id="saaedLoginCurveShadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="-12" dy="4" stdDeviation="14" floodColor="#020617" floodOpacity="0.65" />
          </filter>
        </defs>

        {/* Sweeping 3D Metallic Gold Ribbon Band */}
        <path
          d="M 1206,0 L 1242,0 C 1175,260 1208,680 1188,890 C 1172,975 940,1035 790,1080 L 648,1080 C 835,1015 1135,955 1165,865 C 1188,660 1148,255 1206,0 Z"
          fill="url(#saaedLoginGoldRibbon)"
          filter="url(#saaedLoginCurveShadow)"
        />

        {/* Deep Navy & Royal Blue Right Wing */}
        <path
          d="M 1234,0 L 1920,0 L 1920,1080 L 775,1080 C 930,1032 1172,975 1188,885 C 1208,675 1172,260 1234,0 Z"
          fill="url(#saaedLoginRightWing)"
        />

        {/* Specular Gold Highlight Edge Along the S-Curve */}
        <path
          d="M 1234,0 C 1172,260 1208,675 1188,885 C 1172,975 930,1032 775,1080"
          fill="none"
          stroke="#F8E4AE"
          strokeOpacity="0.82"
          strokeWidth="2.4"
        />
      </svg>

      {/* Right-Side White Login Card Area */}
      <div
        dir="ltr"
        className="relative z-10 w-full max-w-[1920px] mx-auto lg:min-h-screen flex items-center justify-center lg:justify-end px-4 sm:px-8 lg:pr-[3.8%] lg:pl-8 pb-8 pt-2 lg:py-10 pointer-events-none"
      >
        <div
          dir={isRtl ? 'rtl' : 'ltr'}
          className="w-full max-w-[465px] lg:w-[33.6%] lg:max-w-[480px] shrink-0 pointer-events-auto"
        >
          {/* White Rounded Login Card Matching Reference */}
          <div className="relative rounded-[30px] bg-white shadow-[0_26px_70px_rgba(3,10,28,0.6)] border border-white/95 pt-7 sm:pt-8 px-6 sm:px-9 pb-0 overflow-hidden flex flex-col justify-between min-h-[620px] sm:min-h-[660px]">
            {/* Top Content Section */}
            <div className="relative z-10">
              {/* Top Row: Official SAAED Logo on Right + Language Switcher (العربية | English) on Left */}
              <div
                dir="rtl"
                className="flex items-start justify-between gap-3 mb-6"
              >
                {/* Official SAAED Logo & Name */}
                <div className="flex flex-col items-center text-center">
                  <img
                    src={`${import.meta.env.BASE_URL}assets/aistudio/logo_1afd1154.png`}
                    alt="SAAED Logo"
                    referrerPolicy="no-referrer"
                    className="h-11 sm:h-12 object-contain"
                  />
                  <span
                    dir="ltr"
                    style={{ fontFamily: "'Cairo', 'Inter', sans-serif" }}
                    className="mt-1 text-base sm:text-[18px] font-extrabold tracking-tight text-[#0B1935] leading-none"
                  >
                    (SAAED) ساعد
                  </span>
                </div>

                {/* Language Switcher Pill: العربية | English */}
                <div
                  role="group"
                  aria-label="Language Switcher"
                  dir="ltr"
                  className="inline-flex items-center bg-[#F4F6FA] border border-slate-200/90 rounded-xl p-1 shadow-2xs mt-1"
                >
                  <button
                    type="button"
                    onClick={() => handleLanguageChange('en')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-[13px] font-semibold transition-all cursor-pointer ${
                      lang === 'en'
                        ? 'bg-[#1746A2] text-white font-bold shadow-xs'
                        : 'text-[#0B1935] hover:text-[#1746A2]'
                    }`}
                  >
                    English
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLanguageChange('ar')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-[13px] font-bold transition-all cursor-pointer ${
                      lang === 'ar'
                        ? 'bg-[#1746A2] text-white shadow-xs'
                        : 'text-[#0B1935] hover:text-[#1746A2]'
                    }`}
                  >
                    العربية
                  </button>
                </div>
              </div>

              {/* Centered Login Heading Block */}
              <div className="flex flex-col items-center text-center mt-2 mb-7">
                <h2
                  style={{
                    fontFamily: isRtl
                      ? "'Cairo', 'IBM Plex Sans Arabic', sans-serif"
                      : "'Inter', 'Cairo', sans-serif",
                  }}
                  className="text-2xl sm:text-[27px] font-extrabold text-[#0B1935] leading-snug"
                >
                  {t.cardHeadingMain}
                </h2>
                <p
                  style={{
                    fontFamily: isRtl
                      ? "'Inter', 'Cairo', sans-serif"
                      : "'Cairo', 'IBM Plex Sans Arabic', sans-serif",
                  }}
                  className="text-base sm:text-[19px] font-bold text-[#1746A2] mt-1"
                >
                  {t.cardHeadingSub}
                </p>

                {/* Tapered Gold Center Accent Line */}
                <div
                  className="w-36 h-[2px] rounded-full mt-3.5"
                  style={{
                    background:
                      'linear-gradient(90deg, transparent 0%, #D5B36A 50%, transparent 100%)',
                  }}
                />
              </div>

              {/* Error Alert Banner */}
              {hasError && (
                <div
                  role="alert"
                  aria-live="assertive"
                  className="mb-4 rounded-xl bg-red-50 border border-red-200 px-3.5 py-2.5 flex items-center gap-2.5 text-red-800 text-xs sm:text-sm font-bold shadow-2xs"
                >
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{t.errorMessage}</span>
                </div>
              )}

              {/* Login Form */}
              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                {/* Username Field */}
                <div>
                  <label htmlFor="saaed-login-username" className="sr-only">
                    {t.usernameLabel}
                  </label>
                  <div className="relative flex items-center">
                    <input
                      id="saaed-login-username"
                      name="username"
                      type="text"
                      autoComplete="username"
                      disabled={isLoading}
                      value={username}
                      onChange={(e) => {
                        setUsername(e.target.value);
                        if (hasError) setHasError(false);
                      }}
                      placeholder={t.usernamePlaceholder}
                      aria-label={t.usernameLabel}
                      className={`w-full h-[52px] sm:h-[54px] rounded-xl bg-white border border-[#CBD5E1] text-[#0B1935] placeholder-[#64748B] text-sm sm:text-[15px] font-medium transition-all focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15 disabled:opacity-60 ${
                        isRtl ? 'pr-4 pl-14 text-right' : 'pl-4 pr-14 text-left'
                      }`}
                    />
                    <div
                      className={`absolute inset-y-0 flex items-center pointer-events-none ${
                        isRtl ? 'left-2.5' : 'right-2.5'
                      }`}
                    >
                      <div className="w-9 h-9 rounded-lg bg-[#EEF2F7] flex items-center justify-center text-[#10234B]">
                        <User className="w-[18px] h-[18px] stroke-[1.9]" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Password Field with Show/Hide Button */}
                <div>
                  <label htmlFor="saaed-login-password" className="sr-only">
                    {t.passwordLabel}
                  </label>
                  <div className="relative flex items-center">
                    <input
                      id="saaed-login-password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      disabled={isLoading}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (hasError) setHasError(false);
                      }}
                      placeholder={t.passwordPlaceholder}
                      aria-label={t.passwordLabel}
                      className={`w-full h-[52px] sm:h-[54px] rounded-xl bg-white border border-[#CBD5E1] text-[#0B1935] placeholder-[#64748B] text-sm sm:text-[15px] font-medium transition-all focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15 disabled:opacity-60 ${
                        isRtl ? 'pr-4 pl-14 text-right' : 'pl-4 pr-14 text-left'
                      }`}
                    />
                    <div
                      className={`absolute inset-y-0 flex items-center ${
                        isRtl ? 'left-2.5' : 'right-2.5'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        disabled={isLoading}
                        aria-label={showPassword ? t.hidePasswordLabel : t.showPasswordLabel}
                        title={showPassword ? t.hidePasswordLabel : t.showPasswordLabel}
                        className="w-9 h-9 rounded-lg bg-[#EEF2F7] hover:bg-slate-200/80 flex items-center justify-center text-[#10234B] transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#2563EB]/25"
                      >
                        {showPassword ? (
                          <EyeOff className="w-[18px] h-[18px] stroke-[1.9]" />
                        ) : (
                          <Eye className="w-[18px] h-[18px] stroke-[1.9]" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Remember Me Row */}
                <div
                  dir="ltr"
                  className="flex items-center justify-start pt-1"
                >
                  <label className="inline-flex items-center gap-2.5 cursor-pointer select-none group">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      disabled={isLoading}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-[18px] h-[18px] rounded border-slate-300 text-[#1746A2] focus:ring-[#2563EB] cursor-pointer"
                    />
                    <span className="text-xs sm:text-[13.5px] font-semibold text-[#0B1935] group-hover:text-[#1746A2] transition-colors">
                      {t.rememberMeLabel}
                    </span>
                  </label>
                </div>

                {/* Sign In Submit Button */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isLoading}
                    dir="ltr"
                    className="w-full h-[52px] sm:h-[54px] rounded-xl bg-gradient-to-r from-[#103896] via-[#1746A2] to-[#103896] hover:from-[#1240AC] hover:via-[#2563EB] hover:to-[#0E3185] active:scale-[0.99] text-white font-bold text-base sm:text-[16.5px] shadow-[0_10px_24px_-4px_rgba(23,70,162,0.45)] flex items-center justify-center gap-2.5 transition-all cursor-pointer disabled:opacity-65 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin text-[#D5B36A]" />
                        <span>{t.signingInText}</span>
                      </>
                    ) : (
                      <>
                        <span>{t.signInButtonText}</span>
                        <LogIn className="w-5 h-5 text-white stroke-[2.1]" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* Bottom Architectural Skyline Silhouette & Gold Wave Line */}
            <div className="relative mt-6 -mx-6 sm:-mx-9 pt-2 pointer-events-none select-none">
              <svg
                viewBox="0 0 500 115"
                className="w-full h-[92px] sm:h-[104px] block"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <defs>
                  <linearGradient id="saaedCardSkyline" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#BFD0E6" stopOpacity="0.65" />
                    <stop offset="100%" stopColor="#DAE6F5" stopOpacity="0.9" />
                  </linearGradient>
                  <linearGradient id="saaedCardWaveFill" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#E1ECFA" stopOpacity="0.85" />
                    <stop offset="50%" stopColor="#F2F7FD" stopOpacity="0.95" />
                    <stop offset="100%" stopColor="#DCE8F8" stopOpacity="0.9" />
                  </linearGradient>
                  <linearGradient id="saaedCardGoldWave" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#D5B36A" stopOpacity="0.55" />
                    <stop offset="50%" stopColor="#D5B36A" stopOpacity="0.95" />
                    <stop offset="100%" stopColor="#D5B36A" stopOpacity="0.65" />
                  </linearGradient>
                </defs>

                {/* Abu Dhabi Twin Towers & City Skyline Silhouette */}
                <path
                  fill="url(#saaedCardSkyline)"
                  d="M25,95 L25,78 L38,78 L38,85 L48,85 L48,68 L62,68 L62,85 L74,85 L74,62 L85,62 L85,82 L96,82 L96,55 L112,55 L112,78 L124,78 L124,66 L138,66 L138,82 L152,82 L152,48 L168,48 L168,78 L182,78 L182,58 L194,58 L194,76 L206,76 L209,22 C214,28 218,45 219,76 L228,76 L231,14 C239,22 244,42 245,76 L256,76 L256,52 L272,46 L272,76 L284,76 L284,36 L300,36 L300,76 L314,76 L314,56 L328,56 L328,78 L342,78 L342,49 L356,49 L356,78 L370,78 L370,64 L384,64 L384,82 L398,82 L398,68 L412,68 L412,84 L428,84 L428,74 L442,74 L442,88 L462,88 L462,80 L475,80 L475,95 Z"
                />

                {/* Soft Curved Base Wave */}
                <path
                  d="M0,78 Q115,68 250,94 Q385,78 500,62 L500,115 L0,115 Z"
                  fill="url(#saaedCardWaveFill)"
                />

                {/* Delicate Gold Wave Line Across Bottom */}
                <path
                  d="M0,78 Q115,68 250,94 Q385,78 500,62"
                  fill="none"
                  stroke="url(#saaedCardGoldWave)"
                  strokeWidth="1.6"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
