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
  const [newStudentName, setNewStudentName] = useState('')
  const [newStudentId, setNewStudentId] = useState('')
  const [newStudentCount, setNewStudentCount] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [signupRequests, setSignupRequests] = useState<any[]>([])
  const [requestMessage, setRequestMessage] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'manage' | 'reports'>('manage')
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
              attendance: cls.attendance || []
            }))
          })
        )

        setClasses(classLists.flat())
        const signupRes = await axios.get(`${API_BASE}/signupRequests`)
        setSignupRequests(signupRes.data || [])
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

  const handleAssignRole = async (requestId: number, role: 'student' | 'professor' | 'admin') => {
    try {
      const res = await axios.post(`${API_BASE}/assignRole`, { requestId, role })
      if (res.data?.success) {
        setSignupRequests((prev) => prev.filter((req) => req.id !== requestId))
        setRequestMessage(res.data.message)
      }
    } catch (err) {
      console.error(err)
      setError('Failed to assign role.')
    }
  }

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

  const handleSaveNewRecord = async () => {
    if (!selectedClass) {
      setError('Select a class first')
      return
    }
    if (!newStudentName.trim()) {
      setError('Enter a student name')
      return
    }

    await updateAttendanceRecord(newStudentId ? Number(newStudentId) : undefined, newStudentName.trim(), newStudentCount)
    setNewStudentName('')
    setNewStudentId('')
    setNewStudentCount(1)
  }

  const reportData = classes.reduce((acc: { [semester: string]: any[] }, cls) => {
    const semesterKey = cls.semester || 'Unknown'
    const totalStudents = cls.attendance.length
    const totalAttendance = cls.attendance.reduce((sum, record) => sum + record.count, 0)
    const avgAttendance = totalStudents ? (totalAttendance / totalStudents).toFixed(2) : '0.00'

    const item = {
      code: cls.classCode || cls.title,
      title: cls.title,
      professor: cls.professorName,
      totalStudents,
      totalAttendance,
      avgAttendance
    }

    if (!acc[semesterKey]) acc[semesterKey] = []
    acc[semesterKey].push(item)
    return acc
  }, {})

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
    <div style={{ padding: 20, fontFamily: 'Arial, sans-serif' }}>
      <h1>Admin CLP Dashboard</h1>

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
          <div style={{ marginBottom: 20, padding: 20, backgroundColor: '#fff8e1', border: '1px solid #ffe082', borderRadius: 6 }}>
            <h3 style={{ marginTop: 0 }}>Pending Signup Requests</h3>
            {requestMessage && (
              <div style={{ marginBottom: 12, color: '#155724', backgroundColor: '#d4edda', padding: 12, borderRadius: 4 }}>
                {requestMessage}
              </div>
            )}
            {signupRequests.length === 0 ? (
              <p style={{ margin: 0 }}>No pending signups at the moment.</p>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {signupRequests.map((request) => (
                  <div key={request.id} style={{ padding: 14, backgroundColor: 'white', border: '1px solid #ddd', borderRadius: 6 }}>
                    <p style={{ margin: '0 0 8px 0' }}><strong>{request.fullName}</strong> wants access.</p>
                    <p style={{ margin: '0 0 10px 0', color: '#555' }}>Username: <strong>{request.username}</strong></p>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button onClick={() => handleAssignRole(request.id, 'student')} style={{ padding: '8px 14px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
                        Assign Student
                      </button>
                      <button onClick={() => handleAssignRole(request.id, 'professor')} style={{ padding: '8px 14px', backgroundColor: '#6f42c1', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
                        Assign Professor
                      </button>
                      <button onClick={() => handleAssignRole(request.id, 'admin')} style={{ padding: '8px 14px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
                        Assign Admin
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && <p style={{ color: '#dc3545', backgroundColor: '#f8d7da', padding: 12, borderRadius: 4, marginBottom: 15 }}>{error}</p>}

          {loading ? (
            <p>Loading...</p>
          ) : (
            <div style={{ display: 'flex', gap: 20 }}>
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
                            <th style={{ padding: 10, borderBottom: '1px solid #ddd' }}>Actions</th>
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
                                    const updatedCount = Number(prompt('Enter new attendance count', String(record.count)) || record.count)
                                    if (isNaN(updatedCount) || updatedCount < 0) return
                                    await updateAttendanceRecord(record.studentId, record.studentName, updatedCount)
                                  }}
                                  style={{ marginRight: 8, padding: '6px 10px', backgroundColor: '#17a2b8', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={async () => await updateAttendanceRecord(record.studentId, record.studentName, 0)}
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

                    <div style={{ marginTop: 24, padding: 16, backgroundColor: '#f8f9fa', borderRadius: 6 }}>
                      <h4>Add or update an attendance record</h4>
                      <div style={{ display: 'grid', gap: 10, maxWidth: 520 }}>
                        <input
                          type="text"
                          value={newStudentName}
                          onChange={(e) => setNewStudentName(e.target.value)}
                          placeholder="Student name"
                          style={{ padding: 10, width: '100%', borderRadius: 4, border: '1px solid #ccc' }}
                        />
                        <input
                          type="text"
                          value={newStudentId}
                          onChange={(e) => setNewStudentId(e.target.value)}
                          placeholder="Student ID (optional)"
                          style={{ padding: 10, width: '100%', borderRadius: 4, border: '1px solid #ccc' }}
                        />
                        <input
                          type="number"
                          value={newStudentCount}
                          min={0}
                          onChange={(e) => setNewStudentCount(Number(e.target.value))}
                          style={{ padding: 10, width: '100%', borderRadius: 4, border: '1px solid #ccc' }}
                          placeholder="Attendance count"
                        />
                        <button
                          onClick={handleSaveNewRecord}
                          style={{ padding: '10px 14px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', width: 'fit-content' }}
                        >
                          Save Record
                        </button>
                      </div>
                    </div>
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
          <h2>Attendance Reports</h2>
          {classes.length === 0 ? (
            <p>No classes available to report.</p>
          ) : (
            Object.entries(reportData).map(([semester, classReports]) => (
              <div key={semester} style={{ marginBottom: 24 }}>
                <h3>{semester}</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid #ddd' }}>Course</th>
                      <th style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid #ddd' }}>Professor</th>
                      <th style={{ textAlign: 'right', padding: 10, borderBottom: '1px solid #ddd' }}>Students</th>
                      <th style={{ textAlign: 'right', padding: 10, borderBottom: '1px solid #ddd' }}>Total Attendance</th>
                      <th style={{ textAlign: 'right', padding: 10, borderBottom: '1px solid #ddd' }}>Avg Attendance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classReports.map((report, index) => (
                      <tr key={index}>
                        <td style={{ padding: 10, borderBottom: '1px solid #f0f0f0' }}>{report.title} ({report.code})</td>
                        <td style={{ padding: 10, borderBottom: '1px solid #f0f0f0' }}>{report.professor}</td>
                        <td style={{ padding: 10, textAlign: 'right', borderBottom: '1px solid #f0f0f0' }}>{report.totalStudents}</td>
                        <td style={{ padding: 10, textAlign: 'right', borderBottom: '1px solid #f0f0f0' }}>{report.totalAttendance}</td>
                        <td style={{ padding: 10, textAlign: 'right', borderBottom: '1px solid #f0f0f0' }}>{report.avgAttendance}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))
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
  )
}

export default AdminPg
