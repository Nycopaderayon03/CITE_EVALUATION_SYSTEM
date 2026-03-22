'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import { Eye, EyeOff, Moon, Sun } from 'lucide-react';
import ReCAPTCHA from 'react-google-recaptcha';
import { getRoleDashboardPath } from '@/utils/helpers';

export default function LoginPage() {
  const router = useRouter();
  const { login, setUserFromApi, setToken } = useAuth();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Captcha State
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLoginWithEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccessMessage('');
    
    try {
      if (!email || !password) {
        throw new Error('Please enter both email and password');
      }

      if (process.env.NODE_ENV !== 'development' && !captchaToken) {
        throw new Error('Please verify that you are not a robot by completing the CAPTCHA.');
      }

      // Call backend API for email/password authentication
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'email-login',
          email: email,
          password: password,
          captchaToken: captchaToken,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      // Store token and update auth context with API user
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('auth_token', data.token);
      }

      if (typeof setToken === 'function') setToken(data.token);
      if (typeof setUserFromApi === 'function') setUserFromApi(data.user);

      setSuccessMessage(`Welcome back, ${data.user.name}!`);

      setTimeout(() => {
        router.push(getRoleDashboardPath(data.user.role));
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };
  

  if (!mounted) return null;
  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-gray-950' : 'bg-white'} transition-colors duration-300 flex flex-col lg:flex-row`}>
      {/* Dark Mode Toggle */}
      <button
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        className="fixed top-6 right-6 z-50 p-3 rounded-full bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-110"
        aria-label="Toggle dark mode"
      >
        {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </button>

      {/* Left Panel - Institution Information */}
      <div
        className={`hidden lg:flex lg:w-1/2 flex-col justify-center px-16 py-12 relative`}
        style={{
          backgroundImage: "url('/icons/COMPUTER.jpg')",
          backgroundSize: 'cover',
          backgroundPosition: 'right center',
        }}
      >
        <div className="absolute inset-0 bg-purple-900/28 backdrop-blur-sm pointer-events-none"></div>
        <div className="relative z-10 space-y-10">
          {/* Institution Logos */}
          <div>
            <div className="flex items-center gap-6 pl-8 justify-start">
              <div className="w-28 h-28 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center overflow-hidden shadow-lg">
                <img src="/icons/JMCLOGO-removebg-preview.png" alt="JMC Logo" className="w-11/12 h-11/12 object-contain" />
              </div>
              <div className="w-28 h-28 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center overflow-hidden shadow-lg">
                <img src="/icons/LOGO2-removebg-preview.png" alt="CITE Logo" className="w-11/12 h-11/12 object-contain" />
              </div>
            </div>
          </div>

          {/* Institution Name */}
          <div className="space-y-3">
            <h1 className="text-4xl font-bold text-white leading-tight">College of Information Technology Education</h1>
            <p className="text-blue-100 text-lg font-medium">Evaluation & Assessment System</p>
            <div className="w-12 h-1 bg-white/40 rounded-full" />
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className={`w-full lg:w-1/2 flex flex-col justify-center items-center px-4 py-12 lg:px-12`}>
        <div className="w-full max-w-md">
          {/* Mobile Header */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center justify-center gap-4 mb-4">
              <div className="w-20 h-20 rounded-2xl overflow-hidden shadow-lg flex items-center justify-center bg-white/10">
                <img src="/icons/JMCLOGO-removebg-preview.png" alt="JMC Logo" className="w-11/12 h-11/12 object-contain" />
              </div>
              <div className="w-20 h-20 rounded-2xl overflow-hidden shadow-lg flex items-center justify-center bg-white/10">
                <img src="/icons/LOGO2-removebg-preview.png" alt="CITE Logo" className="w-11/12 h-11/12 object-contain" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">CITE</h1>
            <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">College of Information Technology Education</p>
          </div>

          {/* Login Card */}
          <Card className="shadow-2xl border-0 dark:bg-gray-800 dark:border dark:border-gray-700">
            {/* Card Header */}
            <CardHeader className="text-center border-b border-gray-200 dark:border-gray-700 pb-6">
              <CardTitle className="text-2xl font-bold text-gray-900">Institutional Login — College of Information Technology Education</CardTitle>
              <CardDescription className="text-gray-600 mt-2">Secure access to the official evaluation system</CardDescription>
            </CardHeader>

            {/* Card Content */}
            <CardContent className="space-y-6 pt-8">
              {/* Success Message */}
              {successMessage && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg animate-slideDown">
                  <p className="text-green-800 font-medium flex items-center gap-2">
                    <span className="text-lg">✓</span>
                    {successMessage}
                  </p>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <Alert variant="error" title="Access Denied">
                  {error}
                </Alert>
              )}

              <form onSubmit={handleLoginWithEmail} className="space-y-6">
                {/* Email Input */}
              <div>
                <div className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Institutional Email
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@jmc.edu.ph"
                  disabled={isLoading}
                  className="w-full px-4 py-2.5 rounded-lg border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:border-blue-500 focus:outline-none dark:focus:border-blue-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>

              {/* Password Input */}
              <div>
                <div className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Password
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    disabled={isLoading}
                    className="w-full px-4 py-2.5 rounded-lg border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:border-blue-500 focus:outline-none dark:focus:border-blue-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Remember Me & Forgot Password */}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-blue-600" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">Remember me</span>
                </label>
                <button
                  type="button"
                  onClick={() => setError('Please contact the admin to recover your password.')}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium transition-colors"
                >
                  Forgot password? Contact Admin
                </button>
              </div>

              {/* Google reCAPTCHA */}
              <div className="flex justify-center items-center w-full py-2">
                {process.env.NODE_ENV !== 'development' && (
                  <ReCAPTCHA
                  sitekey="6Ld6eJMsAAAAABdiQZuwfYyWptTppshpF3ufaA7b"
                  type="audio"
                  onChange={(token) => setCaptchaToken(token)}
                  theme={theme === 'dark' ? 'dark' : 'light'}
                  />
                )}
              </div>

              {/* Login Button */}
              <button
                onClick={handleLoginWithEmail}
                disabled={isLoading}
                className="w-full py-3 px-4 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-100"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Signing in...</span>
                  </div>
                ) : (
                  'Sign In'
                )}
              </button>
              
              </form>

              {/* Support links removed per design */}
            </CardContent>
          </Card>

          {/* Sign Up Section */}
          <div className="mt-8 p-6 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <p className="text-gray-700 dark:text-gray-300 text-center font-semibold mb-4">
              New to the system?
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => router.push('/signup?role=student')}
                className="py-2.5 px-3 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-medium text-sm shadow-md hover:shadow-lg transition-all duration-200"
              >
                Student Signup
              </button>
              <button
                onClick={() => router.push('/signup?role=teacher')}
                className="py-2.5 px-3 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-medium text-sm shadow-md hover:shadow-lg transition-all duration-200"
              >
                Teacher Signup
              </button>
            </div>
          </div>

          {/* Footer Section */}
          <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700 text-center text-xs text-gray-600 dark:text-gray-400 space-y-3">
            <p className="pt-2">
              © 2026 College of Information Technology Education. All rights reserved.
            </p>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-slideDown {
          animation: slideDown 0.4s ease-out;
        }
      `}</style>
    </div>
  );
}
