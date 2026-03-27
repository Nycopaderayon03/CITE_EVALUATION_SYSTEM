import React from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface DashboardCardProps {
  title: string;
  value: React.ReactNode;
  footer?: string;
  icon?: React.ReactNode;
  trend?: number;
  color?: 'blue' | 'green' | 'red' | 'yellow' | 'purple' | 'indigo' | 'orange' | 'emerald' | 'rose' | 'amber';
  onClick?: () => void;
}

export function DashboardCard({
  title,
  value,
  footer,
  icon,
  trend,
  color = 'blue',
  onClick,
}: DashboardCardProps) {
  const colorMap = {
    blue: {
      border: 'border-l-blue-500',
      icon: 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    },
    green: {
      border: 'border-l-green-500',
      icon: 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400',
    },
    emerald: {
      border: 'border-l-emerald-500',
      icon: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
    },
    red: {
      border: 'border-l-red-500',
      icon: 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400',
    },
    rose: {
      border: 'border-l-rose-500',
      icon: 'bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400',
    },
    yellow: {
      border: 'border-l-yellow-500',
      icon: 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400',
    },
    amber: {
      border: 'border-l-amber-500',
      icon: 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
    },
    purple: {
      border: 'border-l-purple-500',
      icon: 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
    },
    indigo: {
      border: 'border-l-indigo-500',
      icon: 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400',
    },
    orange: {
      border: 'border-l-orange-500',
      icon: 'bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
    },
  };

  const theme = colorMap[color] || colorMap.blue;

  return (
    <Card 
      onClick={onClick} 
      className={`relative overflow-hidden border-l-4 ${theme.border} ${onClick ? 'cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300' : ''}`}
    >
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-semibold tracking-wider uppercase text-gray-500 dark:text-gray-400 mb-1">{title}</p>
            <div className="text-3xl font-black text-gray-900 dark:text-white mb-1">
              {value}
            </div>
            {footer && <p className="text-xs text-gray-400 dark:text-gray-500 font-medium">{footer}</p>}
          </div>
          {icon && (
            <div className={`p-4 rounded-2xl shadow-sm ${theme.icon} transform transition-transform group-hover:scale-110`}>
              {icon}
            </div>
          )}
        </div>
        
        {trend !== undefined && (
          <div className="mt-4 flex items-center gap-2">
            <div className={`flex items-center gap-1 text-sm font-bold ${trend > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {trend > 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              {Math.abs(trend)}%
            </div>
            <span className="text-xs text-gray-400 dark:text-gray-500 font-medium">vs last period</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
