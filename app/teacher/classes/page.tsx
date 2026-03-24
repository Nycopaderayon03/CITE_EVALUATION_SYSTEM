'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { DashboardSkeleton } from '@/components/loading/Skeletons';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useFetch } from '@/hooks';
import { BookOpen, Search, Users, ExternalLink } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function TeacherClasses() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const { data: coursesData, loading: coursesLoading } = useFetch<any>('/courses?history=true');
  const { data: evalData, loading: evalLoading } = useFetch<any>('/evaluations?role=evaluatee&history=true');

  const { user } = useAuth();
  const teacherId = user?.id;
  
  const baseCourses = coursesData?.courses || [];
  const implicitCourses = (evalData?.evaluations || []).reduce((acc: any[], evaluation: any) => {
    if (evaluation.course_id && !acc.find((c: any) => c.id === evaluation.course_id)) {
      acc.push({
        id: evaluation.course_id,
        name: evaluation.course_name || evaluation.course?.name,
        code: evaluation.course_code || evaluation.course?.code,
        semester: evaluation.period?.semester || evaluation.semester,
        course_program: evaluation.period?.course_program,
        year_level: evaluation.period?.year_level,
        is_archived: evaluation.is_archived,
      });
    }
    return acc;
  }, []);

  const mergedCourses = [...baseCourses];
  implicitCourses.forEach((ic: any) => {
    const existing = mergedCourses.find(mc => mc.id === ic.id);
    if (!existing) {
      mergedCourses.push(ic);
    } else if (Number(ic.is_archived || 0) === 0 && Number(existing.is_archived || 0) === 1) {
      // If an active evaluation exists for an ironically archived course, forcefully unarchive it in the local view for consistency
      existing.is_archived = 0;
    }
  });

  const teacherCourses = mergedCourses.filter((c:any) => 
    (showHistory ? Number(c.is_archived || 0) === 1 : Number(c.is_archived || 0) === 0)
  );

  const filteredCourses = teacherCourses.filter((c: any) =>
    (c.code || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (coursesLoading || evalLoading) return <DashboardSkeleton />;

  // Group courses by semester for better organization
  const coursesBySemester = filteredCourses.reduce((acc: any, course: any) => {
    let sem = 'Unassigned';
    if (course.semester) {
      const num = Number(course.semester);
      if (num === 1) sem = '1st Semester';
      else if (num === 2) sem = '2nd Semester';
      else if (num === 3) sem = 'Summer';
      else sem = String(course.semester);
    }
    if (!acc[sem]) acc[sem] = [];
    acc[sem].push(course);
    return acc;
  }, {});



  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">📚 {showHistory ? 'Class History' : 'My Classes'}</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            {showHistory ? 'View your archived classes from past academic periods' : 'View all your assigned classes, manage subjects, and track student performance'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant={showHistory ? 'outline' : 'primary'} 
            size="lg" 
            onClick={() => setShowHistory(!showHistory)} 
            className="gap-2 shadow-md px-6 py-3"
          >
            <BookOpen className="w-5 h-5" />
            {showHistory ? 'Back to Current Classes' : 'View Class History'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Search Bar */}
        <div className="lg:col-span-3">
          <Card className="h-full">
            <CardContent className="pt-6 h-full flex flex-col justify-center">
              <div className="relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search by subject code or name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Stats */}
        <div className="lg:col-span-1">
          <Card className="h-full">
            <CardContent className="pt-6 h-full flex flex-col justify-center">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">Total Classes</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">{teacherCourses.length}</p>
                </div>
                <div className="bg-blue-100 p-3 rounded-full dark:bg-blue-900/30">
                  <BookOpen className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Courses List */}
      <div className="space-y-8">
        {Object.keys(coursesBySemester).length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-gray-600 dark:text-gray-400">No classes found matching your search</p>
            </CardContent>
          </Card>
        ) : (
          Object.entries(coursesBySemester).map(([semester, courses]: [string, any]) => (
            <div key={semester} className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 border-b pb-2">
                {semester}
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {courses.map((course: any) => (
                  <Card key={course.id} className="hover:shadow-md transition duration-200">
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="font-mono text-xs">
                              {course.code}
                            </Badge>
                            {course.section && (
                              <Badge variant="secondary" className="text-xs">
                                Section {course.section}
                              </Badge>
                            )}
                          </div>
                          <CardTitle className="text-lg line-clamp-1" title={course.name}>
                            {course.name}
                          </CardTitle>
                          <CardDescription className="mt-1 flex items-center gap-2 text-xs">
                            {course.course_program && (
                              <span className="bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
                                {course.course_program}
                              </span>
                            )}
                            {course.year_level && (
                              <span>Year {course.year_level}</span>
                            )}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
