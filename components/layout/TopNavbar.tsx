import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Dropdown } from '@/components/ui/Dropdown';
import { RoleSwitcher } from './RoleSwitcher';

export function TopNavbar() {
  const { theme, setTheme } = useTheme();
  const { user, logout, isDemoMode } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <header className="fixed top-0 right-0 left-0 md:left-64 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 z-20">
      <div className="flex items-center justify-between px-4 md:px-6 py-3 h-16">
        <div className="flex-1 md:flex-none">
          {/* Breadcrumb placeholder */}
        </div>

        <div className="flex items-center gap-4">
          {/* Demo Mode Badge */}
          {isDemoMode && (
            <div className="px-3 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 text-xs font-semibold rounded-full">
              Demo Mode
            </div>
          )}

          {/* Role Switcher */}
          <RoleSwitcher />

          {/* Theme Toggle */}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            {theme === 'dark' ? (
              <Sun className="w-5 h-5" />
            ) : (
              <Moon className="w-5 h-5" />
            )}
          </button>

          {/* User Menu */}
          {user && (
            <Dropdown
              triggerLabel={user.name}
              items={[
                {
                  label: 'Profile',
                  value: 'profile',
                  onClick: () => {
                    router.push(`/${user.role}/profile`);
                  },
                },
                {
                  label: 'Logout',
                  value: 'logout',
                  onClick: logout,
                  isDanger: true,
                },
              ]}
            />
          )}
        </div>
      </div>
    </header>
  );
}
