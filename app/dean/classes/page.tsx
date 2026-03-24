'use client';

import { useState, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DashboardSkeleton } from '@/components/loading/Skeletons';
import { useFetch } from '@/hooks';
import { ChevronDown, ChevronUp, Users } from 'lucide-react';

type CurriculumProgram = 'BSIT' | 'BSEMC';

type ClassGroup = {
  key: string;
  program: string;
  yearLevel: number;
  section: string;
  students: any[];
};

export default function ClassesPage() {
  const [filterProgram, setFilterProgram] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [expandedClass, setExpandedClass] = useState<string | null>(null);

  const { data: usersData, loading: usersLoading } = useFetch<any>('/users');
  const { data: academicPeriodsData, loading: periodsLoading } = useFetch<any>('/academic_periods');
  const { data: curriculumDataRes, loading: currLoading } = useFetch<any>('/curriculum');

  const isLoading = usersLoading || periodsLoading || currLoading;

  const activePeriod = useMemo(() => {
    if (!academicPeriodsData?.periods) return null;
    return academicPeriodsData.periods.find((p: any) => p.is_active) || null;
  }, [academicPeriodsData]);

  const semesterLabel = useMemo(() => {
    if (!activePeriod) return '';
    if (activePeriod.semester === 1) return '1st Semester';
    if (activePeriod.semester === 2) return '2nd Semester';
    if (activePeriod.semester === 3) return 'Summer';
    return '';
  }, [activePeriod]);

  // Group students into classes
  const classes = useMemo(() => {
    if (!usersData?.users) return [];
    const students = usersData.users.filter((u: any) => u.role === 'student' && u.course && u.year_level && u.section);

    const groupMap: Record<string, ClassGroup> = {};
    for (const s of students) {
      const key = `${s.course}-${s.year_level}-${s.section}`;
      if (!groupMap[key]) {
        groupMap[key] = {
          key,
          program: s.course,
          yearLevel: s.year_level,
          section: s.section,
          students: [],
        };
      }
      groupMap[key].students.push(s);
    }

    let result = Object.values(groupMap);

    // Apply filters
    if (filterProgram) {
      result = result.filter(c => c.program === filterProgram);
    }
    if (filterYear) {
      result = result.filter(c => c.yearLevel === Number(filterYear));
    }

    // Sort by program, year, section
    result.sort((a, b) =>
      a.program.localeCompare(b.program) ||
      a.yearLevel - b.yearLevel ||
      a.section.localeCompare(b.section)
    );

    return result;
  }, [usersData, filterProgram, filterYear]);

  // Get subjects for a class based on active semester
  const getSubjectsForClass = (cls: ClassGroup) => {
    if (!semesterLabel || !curriculumDataRes?.curriculum) return [];
    const programData = curriculumDataRes.curriculum[cls.program as CurriculumProgram];
    if (!programData) return [];
    const yearKey = `${cls.yearLevel === 1 ? '1st' : cls.yearLevel === 2 ? '2nd' : cls.yearLevel === 3 ? '3rd' : '4th'} Year`;
    const yearData = programData[yearKey as keyof typeof programData] as any;
    if (!yearData) return [];
    return yearData[semesterLabel] || [];
  };

  const toggleExpand = (key: string) => {
    setExpandedClass(prev => prev === key ? null : key);
  };

  if (isLoading) return <DashboardSkeleton />;

  const totalStudents = classes.reduce((sum, c) => sum + c.students.length, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Classes</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          View classes grouped by program, year level, and section.
          {activePeriod && (
            <span className="block mt-0.5 text-blue-600 dark:text-blue-400 font-medium">
              Active period: {activePeriod.name} ({activePeriod.academic_year} — {semesterLabel})
            </span>
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-6">
          <Card>
        <CardHeader>
          <CardTitle>Filter Classes</CardTitle>
          <CardDescription>{classes.length} class{classes.length !== 1 ? 'es' : ''} with {totalStudents} total students</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Program"
              value={filterProgram}
              onChange={e => setFilterProgram(e.target.value)}
              options={[
                { value: 'BSIT', label: 'BSIT' },
                { value: 'BSEMC', label: 'BSEMC' },
              ]}
              placeholder="All Programs"
            />
            <Select
              label="Year Level"
              value={filterYear}
              onChange={e => setFilterYear(e.target.value)}
              options={[
                { value: '1', label: '1st Year' },
                { value: '2', label: '2nd Year' },
                { value: '3', label: '3rd Year' },
                { value: '4', label: '4th Year' },
              ]}
              placeholder="All Years"
            />
          </div>
        </CardContent>
      </Card>

      {/* Classes List */}
      <div className="space-y-4">
        {classes.length > 0 ? classes.map(cls => {
          const isExpanded = expandedClass === cls.key;
          const subjects = getSubjectsForClass(cls);
          const yearLabel = cls.yearLevel === 1 ? '1st' : cls.yearLevel === 2 ? '2nd' : cls.yearLevel === 3 ? '3rd' : '4th';

          return (
            <Card key={cls.key} className="hover:shadow-lg transition-shadow">
              <CardHeader
                className="cursor-pointer select-none"
                onClick={() => toggleExpand(cls.key)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-lg">
                      {cls.program} {yearLabel} Year — Section {cls.section}
                    </CardTitle>
                    <Badge variant="default">
                      <Users className="w-3 h-3 mr-1" />
                      {cls.students.length} student{cls.students.length !== 1 ? 's' : ''}
                    </Badge>
                    {subjects.length > 0 && (
                      <Badge variant="outline">
                        {subjects.length} subject{subjects.length !== 1 ? 's' : ''}
                      </Badge>
                    )}
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </CardHeader>

              {isExpanded && (
                <CardContent className="space-y-6">
                  {/* Students table */}
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Enrolled Students</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-800">
                          <tr>
                            <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-400">#</th>
                            <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Name</th>
                            <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Email</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                          {cls.students.sort((a: any, b: any) => a.name.localeCompare(b.name)).map((s: any, i: number) => (
                            <tr key={s.id}>
                              <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{i + 1}</td>
                              <td className="px-4 py-2 text-gray-900 dark:text-white">{s.name}</td>
                              <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{s.email}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Subjects for this class */}
                  {subjects.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Subjects ({semesterLabel})
                      </h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 dark:bg-gray-800">
                            <tr>
                              <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Code</th>
                              <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Subject Name</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {subjects.map((s: any) => (
                              <tr key={s.code}>
                                <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">
                                  <Badge variant="outline">{s.code}</Badge>
                                </td>
                                <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{s.name}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          );
        }) : (
          <Card>
            <CardContent className="py-12 text-center text-gray-500 dark:text-gray-400">
              No classes found. Students need to have course, year level, and section set in their profiles.
            </CardContent>
          </Card>
        )}
          </div>
        </div>

        {/* Sidebar Metrics */}
        <div className="lg:col-span-1 space-y-4 flex flex-col">
          <Card className="hover:shadow-lg transition-shadow duration-150">
            <CardContent className="pt-6 text-center">
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">Total Classes</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{classes.length}</p>
            </CardContent>
          </Card>
          <Card className="hover:shadow-lg transition-shadow duration-150">
            <CardContent className="pt-6 text-center">
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">Total Enrolled</p>
              <p className="text-3xl font-bold text-blue-600">{totalStudents}</p>
            </CardContent>
          </Card>
          <Card className="hover:shadow-lg transition-shadow duration-150">
            <CardContent className="pt-6 text-center">
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">Active Programs</p>
              <p className="text-3xl font-bold text-purple-600">
                {[...new Set(classes.map(c => c.program))].length}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
