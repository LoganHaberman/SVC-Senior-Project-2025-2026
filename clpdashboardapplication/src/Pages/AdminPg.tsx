import React, { useState, useEffect, useRef } from 'react'
import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'
import axios from 'axios'

interface AttendanceRecord {
  studentId: number | string
  studentName: string
  count: number
}

interface ClassRecord {
  id: number
  title: string
  classCode?: string
  semester: string
  profId: number
  professorName: string
  uniqueId: string
  students: { id: string; name: string }[]
  attendance: AttendanceRecord[]
}

interface Professor {
  id: number
  name: string
}

function AdminPg() {
  const API_BASE = '/api'
  const [classes, setClasses] = useState<ClassRecord[]>([])
  const [selectedClassId, setSelectedClassId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'manage' | 'reports'>('manage')
  const [showSemesterComparisons, setShowSemesterComparisons] = useState(false)
  const [semesterComparisonSearch, setSemesterComparisonSearch] = useState('')
  const [showClassReports, setShowClassReports] = useState(true)
  const [classReportSearch, setClassReportSearch] = useState('')
  const reportRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fetchAdminData = async () => {
      try {
        setLoading(true)
        const profRes = await axios.get(`${API_BASE}/professors/list`)
        const professors: Professor[] = profRes.data || []

        const classLists = await Promise.all(
          professors.map(async (prof) => {
            const res = await axios.get(`${API_BASE}/getProfClasses`, { params: { userId: prof.id } })
            const data = res.data || {}
            return (data.classes || []).map((cls: any) => ({
              id: cls.id,
              title: cls.title,
              classCode: cls.code,
              semester: cls.semester,
              profId: prof.id,
              professorName: prof.name,
              uniqueId: `${prof.id}-${cls.id}`,
              students: cls.students || [],
              attendance: cls.attendance || []
            }))
          })
        )

        setClasses(classLists.flat())
      } catch (err) {
        console.error(err)
        setError('Failed to load admin data')
      } finally {
        setLoading(false)
      }
    }

    fetchAdminData()
  }, [])

  const selectedClass = classes.find((cls) => cls.uniqueId === selectedClassId)

  const updateAttendanceRecord = async (
    studentId: number | string | undefined,
    studentName: string,
    count: number
  ) => {
    if (!selectedClass) return

    try {
      const res = await axios.post(`${API_BASE}/admin/classAttendance`, {
        profId: selectedClass.profId,
        classId: selectedClass.id,
        studentId: studentId || undefined,
        studentName,
        count
      })

      if (res.data?.attendance) {
        setClasses((prev) =>
          prev.map((cls) =>
            cls.uniqueId === selectedClass.uniqueId
              ? { ...cls, attendance: res.data.attendance }
              : cls
          )
        )
      }
      setError(null)
    } catch (err) {
      console.error(err)
      setError('Failed to update attendance record')
    }
  }

  const reportData = classes.reduce((acc: { [semester: string]: any[] }, cls) => {
    const semesterKey = cls.semester || 'Unknown'
    const roster = cls.students || []
    const attendanceById = new Map<string, number>(
      (cls.attendance || []).map((record) => [String(record.studentId), Number(record.count) || 0])
    )

    const totalStudents = roster.length || cls.attendance.length
    const totalAttendance = (cls.attendance || []).reduce((sum, record) => sum + (Number(record.count) || 0), 0)
    const avgAttendance = totalStudents ? totalAttendance / totalStudents : 0

    const attendanceCounts = (roster.length ? roster : cls.attendance.map((record) => ({ id: String(record.studentId) })))
      .map((student) => attendanceById.get(String((student as any).id)) || 0)
    const studentsFivePlus = attendanceCounts.filter((count) => count >= 5).length
    const studentsUnderFive = Math.max(totalStudents - studentsFivePlus, 0)

    const item = {
      code: cls.classCode || cls.title,
      title: cls.title,
      professor: cls.professorName,
      totalStudents,
      totalAttendance,
      avgAttendance,
      studentsFivePlus,
      studentsUnderFive,
      gpaFivePlus: 'N/A',
      gpaUnderFive: 'N/A',
      gpaDiff: 'N/A'
    }

    if (!acc[semesterKey]) acc[semesterKey] = []
    acc[semesterKey].push(item)
    return acc
  }, {})

  const allReportRows = Object.values(reportData).flat()
  const totalCourses = allReportRows.length
  const totalRosteredStudents = allReportRows.reduce((sum: number, row: any) => sum + row.totalStudents, 0)
  const totalAttendanceAcrossAll = allReportRows.reduce((sum: number, row: any) => sum + row.totalAttendance, 0)
  const overallAverageAttendance = totalCourses
    ? allReportRows.reduce((sum: number, row: any) => sum + row.avgAttendance, 0) / totalCourses
    : 0
  const semesterSummaries = Object.entries(reportData).map(([semester, classReports]) => {
    const courseCount = classReports.length
    const rosteredStudents = classReports.reduce((sum: number, report: any) => sum + report.totalStudents, 0)
    const totalAttendance = classReports.reduce((sum: number, report: any) => sum + report.totalAttendance, 0)
    const avgAttendanceAcrossCourses = courseCount
      ? classReports.reduce((sum: number, report: any) => sum + report.avgAttendance, 0) / courseCount
      : 0
    const totalStudentsFivePlus = classReports.reduce((sum: number, report: any) => sum + report.studentsFivePlus, 0)
    const totalStudentsUnderFive = classReports.reduce((sum: number, report: any) => sum + report.studentsUnderFive, 0)
    return {
      semester,
      courseCount,
      rosteredStudents,
      totalAttendance,
      avgAttendanceAcrossCourses,
      totalStudentsFivePlus,
      totalStudentsUnderFive
    }
  })
  const semesterComparisons = semesterSummaries
    .slice()
    .sort((a, b) => a.semester.localeCompare(b.semester))
    .reduce((pairs: any[], current, idx, arr) => {
      if (idx === 0) return pairs
      const previous = arr[idx - 1]
      pairs.push({
        from: previous,
        to: current,
        deltaTotalAttendance: current.totalAttendance - previous.totalAttendance,
        deltaAvgAttendance: current.avgAttendanceAcrossCourses - previous.avgAttendanceAcrossCourses,
        deltaStudentsFivePlus: current.totalStudentsFivePlus - previous.totalStudentsFivePlus
      })
      return pairs
    }, [])
  const filteredSemesterComparisons = semesterComparisons.filter((comparison: any) => {
    const q = semesterComparisonSearch.trim().toLowerCase()
    if (!q) return true
    return (
      String(comparison.from.semester).toLowerCase().includes(q) ||
      String(comparison.to.semester).toLowerCase().includes(q)
    )
  })

  const generatePDF = async () => {
    if (!reportRef.current) return

    try {
      const canvas = await html2canvas(reportRef.current, { scale: 2, useCORS: true, logging: false })
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const imgWidth = 210
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      let heightLeft = imgHeight
      let position = 0

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
      heightLeft -= 297

      while (heightLeft > 0) {
        position = heightLeft - imgHeight
        pdf.addPage()
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
        heightLeft -= 297
      }

      pdf.save('CLP_Report.pdf')
    } catch (err) {
      console.error(err)
      setError('Failed to generate PDF')
    }
  }

  return (
    <div style={{ fontFamily: 'Arial, sans-serif' }}>
      <div style={{ width: '100%', marginBottom: 20 }}>
        <div style={{ backgroundColor: '#0b5d3b', color: 'white', padding: '12px 20px', fontWeight: 700 }}>
          <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Collaborative Learning Program</span>
            <span style={{ fontWeight: 600, opacity: 0.95 }}>Admin Dashboard</span>
          </div>
        </div>
        <div style={{ backgroundColor: '#c9a227', height: 8 }} />
      </div>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 20px 20px 20px' }}>
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, borderBottom: '2px solid #007bff' }}>
        <button
          onClick={() => setActiveTab('manage')}
          style={{
            padding: '10px 20px',
            backgroundColor: activeTab === 'manage' ? '#007bff' : '#e9ecef',
            color: activeTab === 'manage' ? 'white' : '#333',
            border: 'none',
            borderRadius: '4px 4px 0 0',
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 'bold'
          }}
        >
          Manage Attendance
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          style={{
            padding: '10px 20px',
            backgroundColor: activeTab === 'reports' ? '#007bff' : '#e9ecef',
            color: activeTab === 'reports' ? 'white' : '#333',
            border: 'none',
            borderRadius: '4px 4px 0 0',
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 'bold'
          }}
        >
          Reports
        </button>
      </div>

      {activeTab === 'manage' && (
        <div>
          {error && <p style={{ color: '#dc3545', backgroundColor: '#f8d7da', padding: 12, borderRadius: 4, marginBottom: 15 }}>{error}</p>}

          {loading ? (
            <p>Loading...</p>
          ) : (
            <div style={{ display: 'flex', gap: 20, justifyContent: 'center', alignItems: 'flex-start' }}>
              <div style={{ flex: 1, maxWidth: 320 }}>
                <h2>Classes</h2>
                <ul style={{ listStyle: 'none', padding: 0 }}>
                  {classes.map((cls) => (
                    <li
                      key={cls.uniqueId}
                      onClick={() => setSelectedClassId(cls.uniqueId)}
                      style={{
                        padding: 10,
                        marginBottom: 6,
                        backgroundColor: selectedClassId === cls.uniqueId ? '#007bff' : '#f0f0f0',
                        color: selectedClassId === cls.uniqueId ? 'white' : 'black',
                        cursor: 'pointer',
                        borderRadius: 4
                      }}
                    >
                      {cls.professorName} - {cls.classCode || cls.title}
                    </li>
                  ))}
                </ul>
              </div>

              <div style={{ flex: 2 }}>
                {selectedClass ? (
                  <>
                    <h2>{selectedClass.title}</h2>
                    <p><strong>Professor:</strong> {selectedClass.professorName}</p>
                    <p><strong>Code:</strong> {selectedClass.classCode || 'N/A'} | <strong>Semester:</strong> {selectedClass.semester}</p>

                    <h3>Attendance Records</h3>
                    {selectedClass.attendance.length > 0 ? (
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr>
                            <th style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid #ddd' }}>Student</th>
                            <th style={{ textAlign: 'right', padding: 10, borderBottom: '1px solid #ddd' }}>Count</th>
                            <th style={{ padding: 10, borderBottom: '1px solid #ddd' }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedClass.attendance.map((record) => (
                            <tr key={`${record.studentId}-${record.studentName}`}>
                              <td style={{ padding: 10, borderBottom: '1px solid #f0f0f0' }}>{record.studentName}</td>
                              <td style={{ padding: 10, textAlign: 'right', borderBottom: '1px solid #f0f0f0' }}>{record.count}</td>
                              <td style={{ padding: 10, borderBottom: '1px solid #f0f0f0' }}>
                                <button
                                  onClick={async () => {
                                    const input = prompt('Enter new attendance count', String(record.count))
                                    if (input === null) return
                                    const trimmedInput = input.trim()
                                    if (trimmedInput === '') return
                                    const updatedCount = Number(trimmedInput)
                                    if (isNaN(updatedCount) || updatedCount < 0) return
                                    // Edit should not delete; use the Remove button for that.
                                    if (updatedCount === 0) return
                                    if (updatedCount === record.count) return
                                    await updateAttendanceRecord(record.studentId, record.studentName, updatedCount)
                                  }}
                                  style={{ marginRight: 8, padding: '6px 10px', backgroundColor: '#17a2b8', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={async () => {
                                    const confirmed = window.confirm('Are you sure you want to delete this student from this class?')
                                    if (!confirmed) return
                                    await updateAttendanceRecord(record.studentId, record.studentName, 0)
                                  }}
                                  style={{ padding: '6px 10px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                                >
                                  Remove
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <p>No attendance records for this class yet.</p>
                    )}

                  </>
                ) : (
                  <p>Select a class to edit attendance records.</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'reports' && (
        <div ref={reportRef} style={{ padding: 20, backgroundColor: '#ffffff', borderRadius: 8 }}>
          <h2>CLP Administrative Report</h2>
          <p style={{ color: '#555', marginTop: 0 }}>
            Course-level attendance analytics aligned with CLP report format. GPA fields are marked N/A until grade data is integrated.
          </p>
          <div style={{ marginBottom: 18, padding: 14, border: '1px solid #d9e2ec', borderRadius: 8, backgroundColor: '#f8fbff' }}>
            <h3 style={{ marginTop: 0, marginBottom: 8 }}>Executive Summary</h3>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ minWidth: 170, padding: 10, borderRadius: 6, backgroundColor: '#fff', border: '1px solid #e4e7eb' }}>
                <div style={{ fontSize: 12, color: '#666' }}>Total Courses</div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{totalCourses}</div>
              </div>
              <div style={{ minWidth: 170, padding: 10, borderRadius: 6, backgroundColor: '#fff', border: '1px solid #e4e7eb' }}>
                <div style={{ fontSize: 12, color: '#666' }}>Total Rostered Students</div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{totalRosteredStudents}</div>
              </div>
              <div style={{ minWidth: 170, padding: 10, borderRadius: 6, backgroundColor: '#fff', border: '1px solid #e4e7eb' }}>
                <div style={{ fontSize: 12, color: '#666' }}>Total Attendance</div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{totalAttendanceAcrossAll}</div>
              </div>
              <div style={{ minWidth: 170, padding: 10, borderRadius: 6, backgroundColor: '#fff', border: '1px solid #e4e7eb' }}>
                <div style={{ fontSize: 12, color: '#666' }}>Average Attendance</div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{overallAverageAttendance.toFixed(2)}</div>
              </div>
            </div>
            <p style={{ marginTop: 10, marginBottom: 0, color: '#666', fontSize: 13 }}>
              GPA impact analysis, withdrawals handling, and grade comparisons are currently unavailable in system data and are shown as N/A placeholders.
            </p>
          </div>
          <div style={{ marginBottom: 18, padding: 14, border: '1px solid #d9e2ec', borderRadius: 8, backgroundColor: '#fffdf8' }}>
            <button
              onClick={() => setShowSemesterComparisons((prev) => !prev)}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '10px 12px',
                border: '1px solid #e4e7eb',
                borderRadius: 6,
                backgroundColor: '#fff',
                cursor: 'pointer',
                fontWeight: 700
              }}
            >
              Semester Comparisons {showSemesterComparisons ? '▲' : '▼'}
            </button>
            {showSemesterComparisons && (
              <div style={{ marginTop: 10 }}>
                <input
                  type="text"
                  value={semesterComparisonSearch}
                  onChange={(e) => setSemesterComparisonSearch(e.target.value)}
                  placeholder="Search semester comparisons..."
                  style={{ width: '100%', maxWidth: 360, padding: 8, borderRadius: 4, border: '1px solid #ccc', marginBottom: 10 }}
                />
                {semesterComparisons.length === 0 ? (
                  <p style={{ margin: 0, color: '#666' }}>
                    Need at least two semesters with data to show term-over-term comparisons.
                  </p>
                ) : filteredSemesterComparisons.length === 0 ? (
                  <p style={{ margin: 0, color: '#666' }}>No semester comparisons match that search.</p>
                ) : (
                  <div style={{ display: 'grid', gap: 10 }}>
                    {filteredSemesterComparisons.map((comparison: any, idx: number) => (
                      <div key={`${comparison.from.semester}-${comparison.to.semester}-${idx}`} style={{ border: '1px solid #ececec', borderRadius: 6, padding: 10, backgroundColor: '#fff' }}>
                        <div style={{ fontWeight: 700, marginBottom: 4 }}>
                          {comparison.from.semester} to {comparison.to.semester}
                        </div>
                        <div style={{ fontSize: 13, color: '#555' }}>
                          Total Attendance: {comparison.from.totalAttendance} to {comparison.to.totalAttendance}
                          {' '}({comparison.deltaTotalAttendance >= 0 ? '+' : ''}{comparison.deltaTotalAttendance})
                        </div>
                        <div style={{ fontSize: 13, color: '#555' }}>
                          Avg Attendance (Per Course): {comparison.from.avgAttendanceAcrossCourses.toFixed(2)} to {comparison.to.avgAttendanceAcrossCourses.toFixed(2)}
                          {' '}({comparison.deltaAvgAttendance >= 0 ? '+' : ''}{comparison.deltaAvgAttendance.toFixed(2)})
                        </div>
                        <div style={{ fontSize: 13, color: '#555' }}>
                          Students Attending &gt;=5: {comparison.from.totalStudentsFivePlus} to {comparison.to.totalStudentsFivePlus}
                          {' '}({comparison.deltaStudentsFivePlus >= 0 ? '+' : ''}{comparison.deltaStudentsFivePlus})
                        </div>
                        <div style={{ fontSize: 13, color: '#777', marginTop: 4 }}>
                          GPA change analysis: N/A (grade data not currently captured).
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          {classes.length === 0 ? (
            <p>No classes available to report.</p>
          ) : (
            <div style={{ marginBottom: 12 }}>
              <button
                onClick={() => setShowClassReports((prev) => !prev)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '10px 12px',
                  border: '1px solid #e4e7eb',
                  borderRadius: 6,
                  backgroundColor: '#fff',
                  cursor: 'pointer',
                  fontWeight: 700
                }}
              >
                Class Reports {showClassReports ? '▲' : '▼'}
              </button>
              {showClassReports && (
                <div style={{ marginTop: 10 }}>
                  <input
                    type="text"
                    value={classReportSearch}
                    onChange={(e) => setClassReportSearch(e.target.value)}
                    placeholder="Search classes by course code, title, professor, or semester..."
                    style={{ width: '100%', maxWidth: 520, padding: 8, borderRadius: 4, border: '1px solid #ccc', marginBottom: 12 }}
                  />
                  {Object.entries(reportData).map(([semester, classReports]) => {
                    const q = classReportSearch.trim().toLowerCase()
                    const filteredClassReports = classReports.filter((report: any) => {
                      if (!q) return true
                      return (
                        String(semester).toLowerCase().includes(q) ||
                        String(report.code || '').toLowerCase().includes(q) ||
                        String(report.title || '').toLowerCase().includes(q) ||
                        String(report.professor || '').toLowerCase().includes(q)
                      )
                    })
                    if (filteredClassReports.length === 0) return null
                    return (
                      <div key={semester} style={{ marginBottom: 24 }}>
                        <h3>{semester}</h3>
                        <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
                          <div style={{ padding: 10, backgroundColor: '#f8f9fa', borderRadius: 6, minWidth: 150 }}>
                            <div style={{ fontSize: 12, color: '#666' }}>Courses</div>
                            <div style={{ fontSize: 20, fontWeight: 700 }}>{filteredClassReports.length}</div>
                          </div>
                          <div style={{ padding: 10, backgroundColor: '#f8f9fa', borderRadius: 6, minWidth: 150 }}>
                            <div style={{ fontSize: 12, color: '#666' }}>Total Attendance</div>
                            <div style={{ fontSize: 20, fontWeight: 700 }}>
                              {filteredClassReports.reduce((sum: number, report: any) => sum + report.totalAttendance, 0)}
                            </div>
                          </div>
                          <div style={{ padding: 10, backgroundColor: '#f8f9fa', borderRadius: 6, minWidth: 150 }}>
                            <div style={{ fontSize: 12, color: '#666' }}>Avg Attendance (All Courses)</div>
                            <div style={{ fontSize: 20, fontWeight: 700 }}>
                              {(
                                filteredClassReports.reduce((sum: number, report: any) => sum + report.avgAttendance, 0) /
                                Math.max(filteredClassReports.length, 1)
                              ).toFixed(2)}
                            </div>
                          </div>
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr>
                              <th style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid #ddd' }}>Course</th>
                              <th style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid #ddd' }}>Professor</th>
                              <th style={{ textAlign: 'right', padding: 10, borderBottom: '1px solid #ddd' }}>Students in Roster</th>
                              <th style={{ textAlign: 'right', padding: 10, borderBottom: '1px solid #ddd' }}>Total Attendance</th>
                              <th style={{ textAlign: 'right', padding: 10, borderBottom: '1px solid #ddd' }}>Average Attendance</th>
                              <th style={{ textAlign: 'right', padding: 10, borderBottom: '1px solid #ddd' }}>Students &gt;= 5</th>
                              <th style={{ textAlign: 'right', padding: 10, borderBottom: '1px solid #ddd' }}>Students &lt; 5</th>
                              <th style={{ textAlign: 'right', padding: 10, borderBottom: '1px solid #ddd' }}>GPA &gt;= 5</th>
                              <th style={{ textAlign: 'right', padding: 10, borderBottom: '1px solid #ddd' }}>GPA &lt; 5</th>
                              <th style={{ textAlign: 'right', padding: 10, borderBottom: '1px solid #ddd' }}>GPA Diff</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredClassReports.map((report: any, index: number) => (
                              <tr key={index}>
                                <td style={{ padding: 10, borderBottom: '1px solid #f0f0f0' }}>{report.title} ({report.code})</td>
                                <td style={{ padding: 10, borderBottom: '1px solid #f0f0f0' }}>{report.professor}</td>
                                <td style={{ padding: 10, textAlign: 'right', borderBottom: '1px solid #f0f0f0' }}>{report.totalStudents}</td>
                                <td style={{ padding: 10, textAlign: 'right', borderBottom: '1px solid #f0f0f0' }}>{report.totalAttendance}</td>
                                <td style={{ padding: 10, textAlign: 'right', borderBottom: '1px solid #f0f0f0' }}>{report.avgAttendance.toFixed(2)}</td>
                                <td style={{ padding: 10, textAlign: 'right', borderBottom: '1px solid #f0f0f0' }}>{report.studentsFivePlus}</td>
                                <td style={{ padding: 10, textAlign: 'right', borderBottom: '1px solid #f0f0f0' }}>{report.studentsUnderFive}</td>
                                <td style={{ padding: 10, textAlign: 'right', borderBottom: '1px solid #f0f0f0' }}>{report.gpaFivePlus}</td>
                                <td style={{ padding: 10, textAlign: 'right', borderBottom: '1px solid #f0f0f0' }}>{report.gpaUnderFive}</td>
                                <td style={{ padding: 10, textAlign: 'right', borderBottom: '1px solid #f0f0f0' }}>{report.gpaDiff}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <div style={{ marginTop: 12, padding: 10, border: '1px solid #eee', borderRadius: 6, backgroundColor: '#fafafa' }}>
                          <strong>Semester Summary (Total Average): </strong>
                          Avg Attendance: {(
                            filteredClassReports.reduce((sum: number, report: any) => sum + report.avgAttendance, 0) /
                            Math.max(filteredClassReports.length, 1)
                          ).toFixed(2)}
                          {' | '}GPA &gt;=5: N/A
                          {' | '}GPA &lt;5: N/A
                          {' | '}GPA Diff: N/A
                        </div>
                        <div style={{ marginTop: 12 }}>
                          <h4 style={{ marginBottom: 8 }}>Course Detail Breakdown</h4>
                          <div style={{ display: 'grid', gap: 8 }}>
                            {filteredClassReports.map((report: any, idx: number) => (
                              <div key={`${report.code}-${idx}`} style={{ border: '1px solid #ececec', borderRadius: 6, padding: 10 }}>
                                <div style={{ fontWeight: 700 }}>{report.code} - {report.title}</div>
                                <div style={{ fontSize: 13, color: '#555', marginTop: 4 }}>
                                  Number of students in spreadsheet: {report.totalStudents}
                                  {' | '}Total Attendance: {report.totalAttendance}
                                  {' | '}Average Number of Attendance: {report.avgAttendance.toFixed(2)}
                                </div>
                                <div style={{ fontSize: 13, color: '#555', marginTop: 4 }}>
                                  Students attending 5 or more sessions: {report.studentsFivePlus}
                                  {' | '}Average GPA (5+): {report.gpaFivePlus}
                                </div>
                                <div style={{ fontSize: 13, color: '#555', marginTop: 4 }}>
                                  Students attending fewer than 5 sessions: {report.studentsUnderFive}
                                  {' | '}Average GPA (&lt;5): {report.gpaUnderFive}
                                  {' | '}Difference in GPA: {report.gpaDiff}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  {Object.entries(reportData).every(([semester, classReports]) => {
                    const q = classReportSearch.trim().toLowerCase()
                    if (!q) return false
                    return !classReports.some((report: any) => (
                      String(semester).toLowerCase().includes(q) ||
                      String(report.code || '').toLowerCase().includes(q) ||
                      String(report.title || '').toLowerCase().includes(q) ||
                      String(report.professor || '').toLowerCase().includes(q)
                    ))
                  }) && (
                    <p style={{ margin: 0, color: '#666' }}>No class reports match that search.</p>
                  )}
                </div>
              )}
            </div>
          )}
          <button
            onClick={generatePDF}
            style={{ marginTop: 16, padding: '10px 18px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
          >
            Download PDF Report
          </button>
        </div>
      )}
    </div>
    </div>
  )
}

export default AdminPg
