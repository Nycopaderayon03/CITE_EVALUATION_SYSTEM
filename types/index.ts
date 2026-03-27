// User Types
export type UserRole = 'student' | 'teacher' | 'dean';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  department?: string;
  employeeId?: string;
  studentId?: string;
  course?: string;
  year_level?: number;
  section?: string;

}

// Course Types
export interface Course {
  id: string;
  code: string;
  name: string;
  instructorId: string;
  instructor?: Teacher;
  credits: number;
  section: string;
  semester: string;
  academicYear: string;
}

export interface CourseWithSections extends Course {
  students: Student[];
  enrollmentCount: number;
}

// Teacher Type
export interface Teacher extends User {
  specialization: string;
  courses: Course[];
  performanceRating?: number;
}

// Student Type
export interface Student extends User {
  program: string;
  yearLevel: number;
  enrolledCourses: Course[];
}

// Evaluation Types
export interface EvaluationCriteria {
  id: string;
  name: string;
  description: string;
  weight: number;
  maxScore: number;
}

export interface EvaluationForm {
  id: string;
  name: string;
  description: string;
  type: 'student-to-teacher' | 'peer-review';
  criteria: EvaluationCriteria[];
  createdAt: Date;
  publishedAt?: Date;
  isPublished: boolean;
  chedCompliant: boolean;
}

export interface EvaluationResponse {
  id: string;
  formId: string;
  form?: EvaluationForm;
  evaluatorId: string;
  evaluator?: User;
  evaluateeId: string;
  evaluatee?: User;
  courseId: string;
  course?: Course;
  responses: {
    criteriaId: string;
    rating: number;
    comment?: string;
  }[];
  overallComment?: string;
  submittedAt?: Date;
  isAnonymous: boolean;
  isLocked: boolean;
}

export interface EvaluationScore {
  criteriaId: string;
  criteriaName: string;
  score: number;
  maxScore: number;
  percentage: number;
  weight: number;
  weightedScore: number;
}

export interface TeacherEvaluationResult {
  teacherId: string;
  teacher?: Teacher;
  courseId?: string;
  overallScore: number;
  scores: EvaluationScore[];
  evaluationCount: number;
  averageScore: number;
  strengths: string[];
  areasForImprovement: string[];
  sentiment?: 'positive' | 'neutral' | 'negative';
}

// Academic Period Types
export interface AcademicPeriod {
  id: string;
  academicYear: string;
  semester: number; // 1 or 2
  startDate: Date;
  endDate: Date;
  isActive: boolean;
}

export interface EvaluationPeriod {
  id: string;
  academicPeriodId: string;
  academicPeriod?: AcademicPeriod;
  name: string;
  description: string;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  formId: string;
  form?: EvaluationForm;
  status: 'setup' | 'active' | 'closed' | 'archived';
  completionPercentage: number;
}

// Dashboard Types
export interface DashboardStats {
  totalStudents: number;
  totalTeachers: number;
  totalCourses: number;
  completionRate: number;
  pendingEvaluations: number;
  systemAlerts: number;
}

export interface TeacherStats {
  assignedSubjects: number;
  teachingLoad: number;
  evaluationAverage: number;
  peerEvaluationStatus: number;
  completionRate: number;
}

// Notification Types
export interface Notification {
  id: string;
  userId: string;
  type: 'pending-evaluation' | 'deadline-warning' | 'result-available' | 'system-alert';
  title: string;
  message: string;
  createdAt: Date;
  readAt?: Date;
  actionUrl?: string;
}

// Report Types
export interface TeacherReport {
  teacherId: string;
  teacher?: Teacher;
  academicYear: string;
  semester: number;
  overallRating: number;
  courseReports: CourseReport[];
  strengths: string[];
  areasForImprovement: string[];
  recommendations: string[];
  generatedAt: Date;
}

export interface CourseReport {
  courseId: string;
  course?: Course;
  averageScore: number;
  studentCount: number;
  criteriaScores: {
    criteriaName: string;
    averageScore: number;
    weight: number;
  }[];
  commonFeedback: string[];
}

export interface DepartmentReport {
  departmentName: string;
  academicYear: string;
  semester: number;
  totalTeachers: number;
  averageTeacherRating: number;
  topPerformers: TeacherEvaluationResult[];
  needsImprovement: TeacherEvaluationResult[];
  departmentTrend: DepartmentTrend[];
  generatedAt: Date;
}

export interface DepartmentTrend {
  period: string;
  averageScore: number;
  completionRate: number;
}

// Audit Types
export interface AuditLog {
  id: string;
  userId: string;
  user?: User;
  action: string;
  actionType: 'login' | 'create' | 'update' | 'delete' | 'download' | 'submit';
  resourceType: string;
  resourceId: string;
  details?: Record<string, unknown>;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
}

// Form Step Types
export interface FormStep {
  id: number;
  title: string;
  description: string;
  component: React.ReactNode;
}

// Filter Types
export interface EvaluationFilter {
  semester?: string;
  academicYear?: string;
  instructorId?: string;
  courseId?: string;
  status?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

// Analytics Types
export interface PerformanceTrend {
  period: string;
  score: number;
  completionRate: number;
}

export interface CriteriaBreakdown {
  criteriaName: string;
  score: number;
  percentage: number;
}

export interface InstructorRanking {
  rank: number;
  instructorId: string;
  instructor?: Teacher;
  overallScore: number;
  department?: string;
  yearsOfService?: number;
}
