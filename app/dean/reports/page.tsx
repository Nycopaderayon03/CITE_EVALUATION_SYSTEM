
'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Download, FileText, Trash2, Calendar, Search, BarChart2, Eye } from 'lucide-react';
import { useFetch } from '@/hooks';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// generate an organized PDF file with a template header
const generatePDFReport = (title: string, filename: string, data: any[], headers?: string[]) => {
  try {
    const doc = new jsPDF();
    const reportDate = new Date().toLocaleString();
    
    // Add Header
    doc.setFontSize(16);
    doc.setTextColor(0);
    doc.text('COLLEGE EVALUATION SYSTEM', 14, 20);
    
    doc.setFontSize(14);
    doc.setTextColor(50);
    doc.text(title, 14, 30);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated On: ${reportDate}`, 14, 38);
    
    let currentY = 45;

    if (headers && headers.length > 0) {
      // Single table mode
      const head = [headers.map(h => h.toUpperCase().replace(/_/g, ' '))];
      const body = data.map(d => headers.map(h => {
        let val = typeof d === 'object' && d !== null ? d[h] : '';
        return String(val ?? '');
      }));
      
      autoTable(doc, {
        head: head,
        body: body,
        startY: currentY,
        styles: { fontSize: 9 },
        headStyles: { fillColor: [41, 128, 185] },
      });
    } else {
      // Multiple sections mode
      data.forEach(sec => {
        // Section title
        doc.setFontSize(11);
        doc.setTextColor(0);
        doc.text(sec.title.toUpperCase(), 14, currentY);
        currentY += 4;
        
        const head = [sec.headers.map((h:string) => h.toUpperCase().replace(/_/g, ' '))];
        const body = sec.data.map((d:any) => sec.headers.map((h:string) => {
          let val = d;
          h.split('.').forEach((k:string) => { val = val?.[k] }); 
          return String(val ?? '');
        }));
        
        autoTable(doc, {
          head: head,
          body: body,
          startY: currentY,
          styles: { fontSize: 9 },
          headStyles: { fillColor: [100, 100, 100] },
        });
        
        currentY = (doc as any).lastAutoTable.finalY + 12;
      });
    }

    if (!filename.toLowerCase().endsWith('.pdf')) filename += '.pdf';
    doc.save(filename);
  } catch (e) {
    console.error('PDF error', e);
  }
};

const ReportsComponent = () => {
  const [generating, setGenerating] = useState<string | null>(null);
  const { data: analyticsData, loading: analyticsLoading } = useFetch<any>('/analytics');
  const { data: evalData, loading: evalLoading } = useFetch<any>('/evaluations');
  // persist report history in localStorage so we don't rely on hardcoded samples
  const [reportHistory, setReportHistory] = useState<{
    id: string;
    name: string;
    date: Date;
    type: string;
  }[]>(() => {
    try {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('reportHistory');
        if (stored) {
          return JSON.parse(stored).map((r: any) => ({
            ...r,
            date: new Date(r.date),
          }));
        }
      }
    } catch {
      // ignore parse errors
    }
    return [];
  });



  const [previewReportId, setPreviewReportId] = useState<string | null>(null);
  const [previewContent, setPreviewContent] = useState<string>('');
  const [previewHeaders, setPreviewHeaders] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<any[]>([]);

  const getDepartmentSections = () => {
    const dept = analyticsData?.analytics?.performanceTrend || [];
    const topInst = analyticsData?.analytics?.topInstructors || [];
    const statRows = [
      { metric: 'Total Evaluations', value: analyticsData?.analytics?.totalEvaluations || 0 },
      { metric: 'Submitted Evaluations', value: analyticsData?.analytics?.submittedEvaluations || 0 },
      { metric: 'Completion Rate', value: (analyticsData?.analytics?.evaluationRate || 0) + '%' }
    ];
    
    // Dynamic actionable insight based directly on completion rate
    const evalRate = analyticsData?.analytics?.evaluationRate || 0;
    const improvementTarget = evalRate < 60 ? 'Increase student participation.' : 'Maintain strong engagement.';

    return [
      { title: 'Performance Trends Over Time', headers: ['period', 'score'], data: dept },
      { title: 'Top Performing Instructors', headers: ['rank', 'instructor.name', 'overallScore'], data: topInst },
      { title: 'Improvement Areas', headers: ['area', 'action'], data: [{ area: 'Evaluation Completion', action: improvementTarget }] },
      { title: 'Completion Statistics', headers: ['metric', 'value'], data: statRows },
    ];
  };

  const handleDepartmentReport = async () => {
    setGenerating('department');
    generatePDFReport(
      'Department Performance Report',
      `department-report-${new Date().toISOString().split('T')[0]}.pdf`,
      getDepartmentSections()
    );
    addToHistory('Department Report ' + new Date().toLocaleDateString(), 'department');
    setGenerating(null);
  };

  const previewDepartmentReport = () => {
    previewReport('Department Report Preview', [], getDepartmentSections());
  };

  const getInstructorSections = () => {
    const instr = analyticsData?.analytics?.topInstructors || [];
    const rows = instr.map((r: any) => ({
      rank: r.rank,
      name: r.instructor?.name,
      overallScore: r.overallScore,
    }));
    
    const avgScore = analyticsData?.analytics?.averageScore || 0;

    return [
      { title: 'Individual Ratings & Rankings', headers: ['rank', 'name', 'overallScore'], data: rows },
      { title: 'Strength Areas', headers: ['metric', 'value'], data: [
        { metric: 'Highest Achieving Rating', value: rows.length > 0 ? rows[0].overallScore : 'N/A' },
        { metric: 'Global System Average', value: avgScore.toFixed(2) }
      ]},
      { title: 'Areas for Improvement', headers: ['metric', 'value'], data: [
        { metric: 'Lowest Measured Rating', value: rows.length > 0 ? rows[rows.length - 1].overallScore : 'N/A' }
      ]}
    ];
  };

  const handleInstructorReport = async () => {
    setGenerating('instructor');
    generatePDFReport(
      'Instructor Ranking Report',
      `instructor-report-${new Date().toISOString().split('T')[0]}.pdf`,
      getInstructorSections()
    );
    addToHistory('Instructor Report ' + new Date().toLocaleDateString(), 'instructor');
    setGenerating(null);
  };

  const previewInstructorReport = () => {
    previewReport('Instructor Report Preview', [], getInstructorSections());
  };

  const getCourseSections = () => {
    const courseData = evalData?.evaluations || [];
    const grouped: Record<string, any> = {};
    
    courseData.forEach((c: any) => {
      const id = c.course_id;
      if (!grouped[id]) {
        grouped[id] = { course_id: id, course_name: c.course_name || `Course #${id}`, responses_count: 0 };
      }
      const r = Array.isArray(c.responses) ? c.responses.length : (c.responses || 0);
      grouped[id].responses_count += (r > 0 ? 1 : (c.status === 'submitted' || c.status === 'completed' ? 1 : 0));
    });

    const formattedCourseData = Object.values(grouped);
    const totalResponses = formattedCourseData.reduce((acc: number, c: any) => acc + c.responses_count, 0);
    const uniqueCourses = formattedCourseData.length;
    
    let engagementLevel = 'N/A';
    if (uniqueCourses > 0) {
        const ratio = totalResponses / uniqueCourses;
        engagementLevel = ratio > 15 ? 'Excellent' : ratio > 5 ? 'Good' : 'Needs Focus';
    }

    return [
      { title: 'Class Feedback Summary', headers: ['course_id', 'course_name', 'responses_count'], data: formattedCourseData },
      { title: 'System Enrollment Data', headers: ['metric', 'value'], data: [
        { metric: 'Total Active Courses Evaluated', value: uniqueCourses },
        { metric: 'Total Distributed Feedback', value: totalResponses }
      ]},
      { title: 'Engagement Metrics', headers: ['metric', 'status'], data: [
        { metric: 'Real-time Student Engagement', status: engagementLevel }
      ]}
    ];
  };

  const handleCourseReport = async () => {
    setGenerating('course');
    generatePDFReport(
      'Course Evaluation Summary Report',
      `course-report-${new Date().toISOString().split('T')[0]}.pdf`,
      getCourseSections()
    );
    addToHistory('Course Report ' + new Date().toLocaleDateString(), 'course');
    setGenerating(null);
  };

  const previewCourseReport = () => {
    previewReport('Course Report Preview', [], getCourseSections());
  };


  const addToHistory = (name: string, type: string) => {
    const next = [
      { id: String(Date.now()), name, date: new Date(), type },
      ...reportHistory.slice(0, 9),
    ];
    setReportHistory(next);
  };

  const previewReport = (title: string, headers: string[], rows: any[]) => {
    let csv = '';
    if (headers && headers.length > 0) {
      csv = [
        headers.join(','),
        ...rows.map((r) => headers.map((h) => `"${String((r as any)[h] ?? '')}"`).join(',')),
      ].join('\n');
    } else {
      csv = rows.map(sec => {
        const secTitle = `--- ${sec.title.toUpperCase()} ---`;
        const csvColumns = sec.headers.join(',');
        const csvRows = sec.data.map((d:any) => sec.headers.map((h:string) => {
          let val = d;
          h.split('.').forEach(k => { val = val?.[k] });
          return `"${String(val ?? '')}"`;
        }).join(',')).join('\n');
        return `${secTitle}\n${csvColumns}\n${csvRows}\n`;
      }).join('\n');
    }
    setPreviewReportId(title);
    setPreviewContent(csv);
    setPreviewHeaders(headers || []);
    setPreviewRows(rows);
  };

  const closePreview = () => {
    setPreviewReportId(null);
    setPreviewContent('');
  };

  // whenever history changes persist it
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('reportHistory', JSON.stringify(reportHistory));
    }
  }, [reportHistory]);

  const deleteReport = (id: string) => {
    setReportHistory(reportHistory.filter(r => r.id !== id));
  };

  // computed metrics
  const totalEvals = evalData?.evaluations?.length || 0;
  const completedEvals = evalData?.evaluations?.filter((e: any) =>
    e.status === 'submitted' ||
    e.status === 'completed' ||
    (Array.isArray(e.responses) ? e.responses.length > 0 : e.responses > 0)
  ).length;
  const completionRateCalc = totalEvals
    ? Math.round((completedEvals / totalEvals) * 100)
    : analyticsData?.analytics?.completionRate || 0;
  const avgScoreCalc =
    typeof analyticsData?.analytics?.averageScore === 'number'
      ? analyticsData.analytics.averageScore
      : 0;


  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Reports & Analytics</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Generate comprehensive evaluation reports and analytics
        </p>
      </div>

      <div className="space-y-8">
          {/* Report Types */}
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Generate Reports</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="hover:shadow-lg transition-shadow duration-150">
            <CardHeader>
              <CardTitle>🏢 Department Report</CardTitle>
              <CardDescription>Overall department performance summary</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                • Performance trends over time<br />
                • Top performing instructors<br />
                • Improvement areas<br />
                • Completion statistics
              </p>
              <div className="flex flex-col md:flex-row gap-2">
                <Button
                  variant="outline"
                  className="flex-1 gap-2"
                  onClick={previewDepartmentReport}
                  disabled={!analyticsData?.analytics?.performanceTrend?.length}
                >
                  <Eye className="w-4 h-4" />
                  Preview Report
                </Button>
                <Button
                  variant="primary"
                  className="flex-1 gap-2"
                  onClick={handleDepartmentReport}
                  disabled={generating === 'department'}
                >
                  <Download className="w-4 h-4" />
                  {generating === 'department' ? 'Generating...' : 'Download Department Report'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow duration-150">
            <CardHeader>
              <CardTitle>👩‍🏫 Instructor Report</CardTitle>
              <CardDescription>Individual teacher evaluation summary</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                • Individual ratings & rankings<br />
                • Strength areas<br />
                • Areas for improvement<br />
                • Year-over-year comparison
              </p>
              <div className="flex flex-col md:flex-row gap-2">
                <Button
                  variant="outline"
                  className="flex-1 gap-2"
                  onClick={previewInstructorReport}
                  disabled={!analyticsData?.analytics?.topInstructors?.length}
                >
                  <Eye className="w-4 h-4" />
                  Preview Report
                </Button>
                <Button
                  variant="primary"
                  className="flex-1 gap-2"
                  onClick={handleInstructorReport}
                  disabled={generating === 'instructor'}
                >
                  <Download className="w-4 h-4" />
                  {generating === 'instructor' ? 'Generating...' : 'Download Instructor Report'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow duration-150">
            <CardHeader>
              <CardTitle>📚 Course Report</CardTitle>
              <CardDescription>Course-level evaluation analysis</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                • Class feedback summary<br />
                • Enrollment data<br />
                • Engagement metrics<br />
                • Course-specific insights
              </p>
              <div className="flex flex-col md:flex-row gap-2">
                <Button
                  variant="outline"
                  className="flex-1 gap-2"
                  onClick={previewCourseReport}
                  disabled={!evalData?.evaluations?.length}
                >
                  <Eye className="w-4 h-4" />
                  Preview Report
                </Button>
                <Button
                  variant="primary"
                  className="flex-1 gap-2"
                  onClick={handleCourseReport}
                  disabled={generating === 'course'}
                >
                  <Download className="w-4 h-4" />
                  {generating === 'course' ? 'Generating...' : 'Generate Course Report'}
                </Button>
              </div>
            </CardContent>
          </Card>


        </div>
      </div>

      {/* Report History */}
      <Card>
        <CardHeader className="border-b">
          <CardTitle>Report History</CardTitle>
          <CardDescription>Recently generated reports</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-2">
            {reportHistory.map((report) => (
              <div key={report.id} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition">
                <div className="flex items-center gap-3 flex-1">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white text-sm">{report.name}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {report.date.toLocaleDateString()} {report.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {report.type}
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => deleteReport(report.id)}
                    className="gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      </div>

      <Modal
        isOpen={!!previewReportId}
        onClose={closePreview}
        title={previewReportId || 'Report Preview'}
        size="lg"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            This is a preview of the report content. Click "Download" to save the generated PDF.
          </p>
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 overflow-auto max-h-72">
            <pre className="whitespace-pre-wrap text-xs text-gray-800 dark:text-gray-200">{previewContent || 'No preview data available.'}</pre>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={closePreview}
              className="gap-2"
            >
              Close
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                if (!previewReportId) return;
                generatePDFReport(
                  previewReportId || 'Generated Report',
                  `${previewReportId.toLowerCase().replace(/\s+/g, '-')}.pdf`,
                  previewRows,
                  previewHeaders.length > 0 ? previewHeaders : undefined
                );
              }}
              className="gap-2"
            >
              <Download className="w-4 h-4" />
              Download
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ReportsComponent;
