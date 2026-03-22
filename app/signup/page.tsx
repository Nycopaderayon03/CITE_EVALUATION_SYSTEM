'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import { Checkbox } from '@/components/ui/Checkbox';
import { ArrowLeft, Mail, User, Lock, Eye, EyeOff } from 'lucide-react';
import ReCAPTCHA from 'react-google-recaptcha';
import { getRoleDashboardPath } from '@/utils/helpers';

function SignUpContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);
  const { setToken, setUserFromApi } = useAuth();

  const roleParam = searchParams.get('role') || 'student';
  const [role, setRole] = useState<'student' | 'teacher'>(roleParam as 'student' | 'teacher');

  // Form State
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    jmcId: '', // 6-digit only
    course: '', // Only for students
    yearLevel: '', // Only for students
    section: '', // Only for students
    password: '',
    confirmPassword: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Captcha State
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const validateForm = () => {
    if (!formData.firstName.trim()) return 'First name is required';
    if (!formData.lastName.trim()) return 'Last name is required';
    if (!formData.email.trim()) return 'Email is required';

    if (!formData.email.endsWith('@jmc.edu.ph')) {
      return 'Please use your official JMC institutional email (@jmc.edu.ph)';
    }


    if (!formData.jmcId.match(/^\d{6}$/)) {
      return 'ID must be exactly 6 digits';
    }

    if (role === 'student' && !['BSIT', 'BSEMC'].includes(formData.course)) {
      return 'Please select a valid course (BSIT or BSEMC)';
    }

    if (role === 'student' && !formData.yearLevel) {
      return 'Please select your year level';
    }

    if (role === 'student' && !formData.section.trim()) {
      return 'Please enter your section';
    }

    if (formData.password.length < 8) {
      return 'Password must be at least 8 characters';
    }

    if (formData.password !== formData.confirmPassword) {
      return 'Passwords do not match';
    }

    if (!agreeTerms) {
      return 'You must agree to the terms and conditions';
    }

    if (!captchaToken) {
      return 'Please verify that you are not a robot by completing the CAPTCHA.';
    }

    return '';
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsLoading(true);

    try {
      // Call backend API for sign-up
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'signup',
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          jmcId: formData.jmcId,
          course: role === 'student' ? formData.course : null,
          yearLevel: role === 'student' ? formData.yearLevel : null,
          section: role === 'student' ? formData.section : null,
          password: formData.password,
          role: role,
          captchaToken: captchaToken,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Sign-up failed');
      }

      // Auto-login if token is provided
      if (data.token && data.user) {
        // Update auth context and session storage
        if (typeof setToken === 'function') setToken(data.token);
        if (typeof setUserFromApi === 'function') setUserFromApi(data.user);

        setSuccessMessage(`Welcome, ${data.user.name}! Your ${role} account has been created. Redirecting to dashboard...`);

        setTimeout(() => {
          // Redirect based on role
          const redirectUrl = role === 'teacher' ? '/teacher/dashboard' : '/student/dashboard';
          router.push(redirectUrl);
        }, 1500);
      } else {
        setSuccessMessage(`Welcome, ${formData.firstName}! Your account as a ${role} has been created. Redirecting to login...`);

        setTimeout(() => {
          router.push('/login');
        }, 2500);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-up failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };


  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-indigo-50 to-purple-100">

      {/* Animated Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute top-40 right-10 w-72 h-72 bg-indigo-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-purple-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 py-12">
        {/* Back Button */}
        <button
          onClick={() => router.push('/login')}
          className="fixed top-6 left-6 p-3 rounded-full bg-white text-gray-900 shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-110"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center mb-8 animate-fadeIn">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-2">
            Create Account
          </h1>
          <p className="text-gray-600 text-lg">
            Sign up as a {role === 'student' ? 'Student' : 'Teacher'}
          </p>
        </div>

        {/* Sign-up Card */}
        <div className="w-full max-w-2xl animate-slideUp">
          <Card className="shadow-2xl border-0">
            <CardHeader className="text-center border-b border-gray-200 pb-6">
              <CardTitle className="text-2xl font-bold text-gray-900 leading-tight">
                Welcome to College of Information Technology Education Evaluation System
              </CardTitle>
              <CardDescription className="text-gray-600 mt-2">
                Create your institutional account
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6 pt-6">
              {/* Success Message */}
              {successMessage && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-green-800 font-medium flex items-center gap-2">
                    <span className="text-lg">✓</span>
                    {successMessage}
                  </p>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <Alert variant="error" title="Cannot Sign Up">
                  {error}
                  {error.includes('domain') && (
                    <p className="text-xs mt-2">
                      Only official JMC institutional emails are accepted
                    </p>
                  )}
                </Alert>
              )}

              <form onSubmit={handleSignUp} className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* First Name */}
                <div>
                  <label htmlFor="firstName" className="text-sm font-semibold text-gray-700 dark:text-gray-300 block mb-2">
                    First Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      id="firstName"
                      type="text"
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-900/50 transition-all"
                      disabled={isLoading}
                    />
                  </div>
                </div>

                {/* Last Name */}
                <div>
                  <label htmlFor="lastName" className="text-sm font-semibold text-gray-700 dark:text-gray-300 block mb-2">
                    Last Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      id="lastName"
                      type="text"
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-900/50 transition-all"
                      disabled={isLoading}
                    />
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label htmlFor="email" className="text-sm font-semibold text-gray-700 dark:text-gray-300 block mb-2">
                    JMC Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="youremail@jmc.edu.ph"
                      className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-900/50 transition-all"
                      disabled={isLoading}
                    />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Must be an official JMC institutional email</p>
                </div>

                {/* ID Number (6 digits) */}
                <div>
                  <label htmlFor="jmcId" className="text-sm font-semibold text-gray-700 dark:text-gray-300 block mb-2">
                    ID Number
                  </label>
                  <input
                    id="jmcId"
                    type="text"
                    value={formData.jmcId}
                    onChange={(e) => setFormData({ ...formData, jmcId: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                    placeholder="123456"
                    maxLength={6}
                    className="w-full px-4 py-2.5 border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-900/50 transition-all"
                    disabled={isLoading}
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">6 digits</p>
                </div>

                {/* Course Selection (only for students) */}
                {role === 'student' && (
                  <div>
                    <label htmlFor="course" className="text-sm font-semibold text-gray-700 dark:text-gray-300 block mb-2">
                      Course
                    </label>
                    <select
                      id="course"
                      value={formData.course}
                      onChange={(e) => setFormData({ ...formData, course: e.target.value })}
                      className="w-full px-4 py-2.5 border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:border-purple-500 focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-900/50 transition-all"
                      disabled={isLoading}
                    >
                      <option value="">Select course</option>
                      <option value="BSIT">BSIT</option>
                      <option value="BSEMC">BSEMC</option>
                    </select>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Only BSIT or BSEMC allowed</p>
                  </div>
                )}

                {/* Year Level (only for students) */}
                {role === 'student' && (
                  <div>
                    <label htmlFor="yearLevel" className="text-sm font-semibold text-gray-700 dark:text-gray-300 block mb-2">
                      Year Level
                    </label>
                    <select
                      id="yearLevel"
                      value={formData.yearLevel}
                      onChange={(e) => setFormData({ ...formData, yearLevel: e.target.value })}
                      className="w-full px-4 py-2.5 border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:border-purple-500 focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-900/50 transition-all"
                      disabled={isLoading}
                    >
                      <option value="">Select year level</option>
                      <option value="1">1st Year</option>
                      <option value="2">2nd Year</option>
                      <option value="3">3rd Year</option>
                      <option value="4">4th Year</option>
                    </select>
                  </div>
                )}

                {/* Section (only for students) */}
                {role === 'student' && (
                  <div className="md:col-span-2">
                    <label htmlFor="section" className="text-sm font-semibold text-gray-700 dark:text-gray-300 block mb-2">
                      Section
                    </label>
                    <select
                      id="section"
                      value={formData.section}
                      onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                      className="w-full px-4 py-2.5 border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:border-purple-500 focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-900/50 transition-all"
                      disabled={isLoading}
                    >
                      <option value="">Select section</option>
                      <option value="A">A</option>
                      <option value="B">B</option>
                      <option value="C">C</option>
                      <option value="D">D</option>
                    </select>
                  </div>
                )}

                {/* Password */}
                <div>
                  <label htmlFor="password" className="text-sm font-semibold text-gray-700 dark:text-gray-300 block mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-12 py-2.5 border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-900/50 transition-all"
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    >
                      {showPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Minimum 8 characters</p>
                </div>

                {/* Confirm Password */}
                <div>
                  <label htmlFor="confirmPassword" className="text-sm font-semibold text-gray-700 dark:text-gray-300 block mb-2">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-12 py-2.5 border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-900/50 transition-all"
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Terms and Conditions */}
                <div className="flex items-start gap-3 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg md:col-span-2 mt-2">
                  <input
                    id="agree-terms"
                    type="checkbox"
                    checked={agreeTerms}
                    onChange={(e) => setAgreeTerms(e.target.checked)}
                    disabled={isLoading}
                    className="mt-1"
                  />
                  <label htmlFor="agree-terms" className="text-sm text-gray-700 dark:text-gray-300">
                    I agree to the <span className="text-purple-600 dark:text-purple-400 font-semibold">Terms and Conditions</span> and <span className="text-purple-600 dark:text-purple-400 font-semibold">Privacy Policy</span>
                  </label>
                </div>

                {/* Google reCAPTCHA */}
                <div className="md:col-span-2 flex justify-center w-full py-2">
                  <ReCAPTCHA
                    sitekey="6Ld6eJMsAAAAABdiQZuwfYyWptTppshpF3ufaA7b"
                    onChange={(token) => setCaptchaToken(token)}
                  />
                </div>

                {/* Sign Up Button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed md:col-span-2 mt-2 text-lg"
                >
                  {isLoading ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>Creating Account...</span>
                    </div>
                  ) : (
                    `Sign Up as ${role === 'student' ? 'Student' : 'Teacher'}`
                  )}
                </button>
              </form>


              {/* Login Link */}
              <div className="text-center text-sm mt-6">
                <span className="text-gray-600 dark:text-gray-400">Already have an account? </span>
                <button
                  onClick={() => router.push('/login')}
                  className="text-purple-600 dark:text-purple-400 font-semibold hover:underline"
                >
                  Login
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Footer */}
          <div className="mt-8 text-center text-xs text-gray-500 dark:text-gray-400 space-y-1">
            <p>© 2026 College of Information Technology</p>
            <p>CITE Department • Secure Academic Platform</p>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes blob {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          33% {
            transform: translate(30px, -50px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.6s ease-in;
        }

        .animate-slideUp {
          animation: slideUp 0.6s ease-out;
        }

        .animate-blob {
          animation: blob 7s infinite;
        }

        .animation-delay-2000 {
          animation-delay: 2s;
        }

        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  );
}
export default function SignUpPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <SignUpContent />
    </Suspense>
  );
}