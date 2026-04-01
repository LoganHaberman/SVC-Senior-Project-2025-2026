import React, { useState, useEffect, useRef } from 'react'
import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'

interface Session {
  sessionNumber: number;
  date: string;
  attendees: string[];
}

interface Class {
  id: number;
  title: string;
  code: string;
  section?: number;
  semester: string;
  profId: number;
  uniqueId: string;
  sessions: Session[];
  professorName?: string;
}

interface Professor {
  id: number;
  name: string;
  userId: number;
  classes: Class[];
}

function AdminPg() {
    const API_BASE = 'http://localhost:3001/api';
    const [classes, setClasses] = useState<Class[]>([]);
    const [selectedClassId, setSelectedClassId] = useState<string>('');
    const [selectedSessionNumber, setSelectedSessionNumber] = useState<number | null>(null);
    const [newStudentName, setNewStudentName] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [rosterFile, setRosterFile] = useState<File | null>(null);
    const [rosterUploading, setRosterUploading] = useState(false);
    const [rosterSuccess, setRosterSuccess] = useState<string | null>(null);
    const [showRosterForm, setShowRosterForm] = useState(false);
    const [activeTab, setActiveTab] = useState<'manage' | 'reports'>('manage');
    const reportRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const profRes = await fetch(`${API_BASE}/professors`);
                const professors: Professor[] = await profRes.json();
                const allClasses: Class[] = [];
                
                professors.forEach(prof => {
                    prof.classes.forEach(cls => {
                        allClasses.push({
                            ...cls,
                            professorName: prof.name,
                            profId: prof.id,
                            uniqueId: `${prof.id}-${cls.id}`
                        });
                    });
                });
                setClasses(allClasses);
            } catch (err) {
                setError('Failed to load data');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const selectedClass = classes.find(c => c.uniqueId === selectedClassId);
    const selectedSession = selectedClass && selectedSessionNumber 
        ? selectedClass.sessions.find(s => s.sessionNumber === selectedSessionNumber)
        : null;

    const handleAddStudent = async () => {
        if (!newStudentName.trim() || !selectedClass || !selectedSessionNumber) {
            setError('Please enter a student name and select a session');
            return;
        }
        if (selectedSession?.attendees.includes(newStudentName.trim())) {
            setError('Student already in attendance');
            return;
        }
        
        try {
            const res = await fetch(
                `${API_BASE}/professors/${selectedClass.profId}/classes/${selectedClass.id}/sessions/${selectedSessionNumber}/attend`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ studentName: newStudentName.trim() })
                }
            );
            if (!res.ok) throw new Error('Failed to add student');
            
            const updatedClasses = classes.map(cls => {
                if (cls.uniqueId === selectedClass.uniqueId) {
                    return {
                        ...cls,
                        sessions: cls.sessions.map(sess => 
                            sess.sessionNumber === selectedSessionNumber
                                ? { ...sess, attendees: [...sess.attendees, newStudentName.trim()] }
                                : sess
                        )
                    };
                }
                return cls;
            });
            setClasses(updatedClasses);
            setNewStudentName('');
            setError(null);
        } catch (err) {
            setError('Failed to add student');
        }
    };

    const handleRosterUpload = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!rosterFile) {
            setError('Please select a file');
            return;
        }

        setRosterUploading(true);
        setError(null);
        setRosterSuccess(null);

        const formData = new FormData();
        formData.append('rosterFile', rosterFile);

        try {
            const res = await fetch(`${API_BASE}/admin/roster`, {
                method: 'POST',
                body: formData
            });

            const data = await res.json();
            if (!res.ok) {
                setError(data.message || 'Failed to upload roster');
                return;
            }

            setRosterSuccess(`${data.message}`);
            setRosterFile(null);
            setShowRosterForm(false);
            
            // Clear success message after 3 seconds
            setTimeout(() => setRosterSuccess(null), 3000);
        } catch (err) {
            setError('Failed to upload roster');
        } finally {
            setRosterUploading(false);
        }
    };

    const handleRemoveStudent = async (studentName: string) => {
        if (!selectedClass || !selectedSessionNumber) return;
        
        try {
            const res = await fetch(
                `${API_BASE}/professors/${selectedClass.profId}/classes/${selectedClass.id}/sessions/${selectedSessionNumber}/attend/${encodeURIComponent(studentName)}`,
                { method: 'DELETE' }
            );
            if (!res.ok) throw new Error('Failed to remove student');
            
            const updatedClasses = classes.map(cls => {
                if (cls.uniqueId === selectedClass.uniqueId) {
                    return {
                        ...cls,
                        sessions: cls.sessions.map(sess => 
                            sess.sessionNumber === selectedSessionNumber
                                ? { ...sess, attendees: sess.attendees.filter(name => name !== studentName) }
                                : sess
                        )
                    };
                }
                return cls;
            });
            setClasses(updatedClasses);
            setError(null);
        } catch (err) {
            setError('Failed to remove student');
        }
    };

    // Generate report data grouped by semester and course
    const generateReportData = () => {
        const reportBySeasonAndCourse: { [key: string]: any[] } = {};
        
        classes.forEach(cls => {
            const semesterKey = cls.semester;
            if (!reportBySeasonAndCourse[semesterKey]) {
                reportBySeasonAndCourse[semesterKey] = [];
            }

            // Get all unique students who attended at least one session
            const studentAttendanceMap = new Map<string, number>();
            cls.sessions.forEach(session => {
                session.attendees.forEach(studentName => {
                    studentAttendanceMap.set(
                        studentName,
                        (studentAttendanceMap.get(studentName) || 0) + 1
                    );
                });
            });

            // Calculate statistics
            const totalAttendees = studentAttendanceMap.size;
            let totalAttendance = 0;
            let attendeesCountGte5 = 0;
            let attendeesCountLt5 = 0;

            studentAttendanceMap.forEach(count => {
                totalAttendance += count;
                if (count >= 5) {
                    attendeesCountGte5++;
                } else {
                    attendeesCountLt5++;
                }
            });

            const avgAttendance = totalAttendees > 0 ? (totalAttendance / totalAttendees).toFixed(2) : '0.00';

            reportBySeasonAndCourse[semesterKey].push({
                code: cls.code,
                title: cls.title,
                professor: cls.professorName,
                totalStudents: totalAttendees,
                totalAttendance: totalAttendance,
                avgAttendance: avgAttendance,
                attendeesGte5: attendeesCountGte5,
                gpaGte5: 'NA',
                attendeesLt5: attendeesCountLt5,
                gpaLt5: 'NA',
                gpaDifference: 'NA'
            });
        });

        return reportBySeasonAndCourse;
    };

    const reportData = generateReportData();

    const generatePDF = async () => {
        if (!reportRef.current) return;

        try {
            const canvas = await html2canvas(reportRef.current, {
                scale: 2,
                useCORS: true,
                logging: false
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });

            const imgWidth = 210; // A4 width in mm
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            let heightLeft = imgHeight;
            let position = 0;

            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= 297; // A4 height in mm

            while (heightLeft > 0) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
                heightLeft -= 297;
            }

            pdf.save('CLP_Report.pdf');
        } catch (err) {
            setError('Failed to generate PDF');
            console.error(err);
        }
    };

    return (
        <div style={{ padding: 20, fontFamily: 'Arial, sans-serif' }}>
            <h1>Admin CLP Dashboard</h1>
            
            {/* Tab Navigation */}
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
                    Manage Roster & Sessions
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

            {/* Manage Roster & Sessions Tab */}
            {activeTab === 'manage' && (
            <div>
            
            {/* Roster Upload Section */}
            <div style={{ marginBottom: 20 }}>
                <button 
                    onClick={() => setShowRosterForm(!showRosterForm)}
                    style={{
                        padding: '10px 20px',
                        backgroundColor: 'gray',
                        color: 'white',
                        border: 'none',
                        borderRadius: 4,
                        cursor: 'pointer',
                        fontSize: 14,
                        fontWeight: 'bold'
                    }}
                >
                    {showRosterForm ? 'Hide Roster Upload' : 'Upload New Roster'}
                </button>
                
                {showRosterForm && (
                    <div style={{
                        marginTop: 15,
                        padding: 20,
                        backgroundColor: '#f0f8ff',
                        borderRadius: 4,
                        border: '1px solid gray'
                    }}>
                        <h3 style={{ marginTop: 0 }}>Upload Student Roster</h3>
                        <p style={{ color: '#555', marginBottom: 15 }}>
                            Upload a CSV file with columns: <strong>id</strong> and <strong>name</strong>
                        </p>
                        
                        <form onSubmit={handleRosterUpload}>
                            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                                <input
                                    type="file"
                                    accept=".csv"
                                    onChange={(e) => setRosterFile(e.target.files?.[0] || null)}
                                    disabled={rosterUploading}
                                    style={{
                                        padding: 8,
                                        border: '1px solid #ccc',
                                        borderRadius: 4,
                                        flex: 1,
                                        minWidth: 200
                                    }}
                                />
                                <button
                                    type="submit"
                                    disabled={!rosterFile || rosterUploading}
                                    style={{
                                        padding: '8px 20px',
                                        backgroundColor: rosterFile && !rosterUploading ? '#28a745' : '#ccc',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: 4,
                                        cursor: rosterFile && !rosterUploading ? 'pointer' : 'not-allowed',
                                        fontWeight: 'bold'
                                    }}
                                >
                                    {rosterUploading ? 'Uploading...' : 'Upload'}
                                </button>
                            </div>
                        </form>
                    </div>
                )}
            </div>

            {rosterSuccess && (
                <p style={{ color: '#28a745', backgroundColor: '#d4edda', padding: 12, borderRadius: 4, marginBottom: 15 }}>
                    ✓ {rosterSuccess}
                </p>
            )}
            {error && <p style={{ color: '#dc3545', backgroundColor: '#f8d7da', padding: 12, borderRadius: 4, marginBottom: 15 }}>{error}</p>}
            
            {loading ? (
                <p>Loading...</p>
            ) : (
                <div style={{ display: 'flex', gap: 20 }}>
                    <div style={{ flex: 1, maxWidth: 300 }}>
                        <h2>Classes</h2>
                        <ul style={{ listStyle: 'none', padding: 0 }}>
                            {classes.map(cls => (
                                <li 
                                    key={cls.uniqueId}
                                    onClick={() => { setSelectedClassId(cls.uniqueId); setSelectedSessionNumber(null); }}
                                    style={{
                                        padding: 10,
                                        marginBottom: 6,
                                        backgroundColor: selectedClassId === cls.uniqueId ? '#007bff' : '#f0f0f0',
                                        color: selectedClassId === cls.uniqueId ? 'white' : 'black',
                                        cursor: 'pointer',
                                        borderRadius: 4
                                    }}
                                >
                                    {cls.professorName} - {cls.code}
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div style={{ flex: 2 }}>
                        {selectedClass ? (
                            <>
                                <h2>{selectedClass.title}</h2>
                                <p><strong>Professor:</strong> {selectedClass.professorName}</p>
                                <p><strong>Code:</strong> {selectedClass.code} | <strong>Semester:</strong> {selectedClass.semester}</p>

                                <h3>CLP Sessions</h3>
                                {selectedClass.sessions && selectedClass.sessions.length > 0 ? (
                                    <>
                                        <ul style={{ listStyle: 'none', padding: 0 }}>
                                            {selectedClass.sessions.map(session => (
                                                <li 
                                                    key={session.sessionNumber} 
                                                    style={{
                                                        padding: 12,
                                                        marginBottom: 10,
                                                        backgroundColor: selectedSessionNumber === session.sessionNumber ? '#d1ecf1' : '#f9f9f9',
                                                        borderLeft: '4px solid #007bff',
                                                        borderRadius: 4
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <div>
                                                            <p style={{ margin: 0 }}><strong>Session {session.sessionNumber}</strong> - {session.date}</p>
                                                            <p style={{ margin: 4, fontSize: 13, color: '#666' }}>Attendees: {session.attendees.length}</p>
                                                        </div>
                                                        <button
                                                            onClick={() => setSelectedSessionNumber(session.sessionNumber)}
                                                            style={{
                                                                padding: '6px 12px',
                                                                backgroundColor: '#007bff',
                                                                color: 'white',
                                                                border: 'none',
                                                                borderRadius: 4,
                                                                cursor: 'pointer'
                                                            }}
                                                        >
                                                            Edit
                                                        </button>
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>

                                        {selectedSession && (
                                            <div style={{ marginTop: 20, padding: 15, backgroundColor: '#e8f4f8', borderRadius: 4 }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                                                    <h4 style={{ margin: 0 }}>Session {selectedSession.sessionNumber} - {selectedSession.date}</h4>
                                                    <button 
                                                        onClick={() => setSelectedSessionNumber(null)}
                                                        style={{
                                                            padding: '6px 12px',
                                                            backgroundColor: '#6c757d',
                                                            color: 'white',
                                                            border: 'none',
                                                            borderRadius: 4,
                                                            cursor: 'pointer'
                                                        }}
                                                    >
                                                        Done
                                                    </button>
                                                </div>
                                                <p><strong>Attendees ({selectedSession.attendees.length}):</strong></p>
                                                {selectedSession.attendees.length > 0 ? (
                                                    <ul style={{ listStyle: 'none', padding: 0 }}>
                                                        {selectedSession.attendees.map((name, idx) => (
                                                            <li 
                                                                key={idx}
                                                                style={{
                                                                    padding: 8,
                                                                    marginBottom: 5,
                                                                    backgroundColor: 'white',
                                                                    borderRadius: 4,
                                                                    display: 'flex',
                                                                    justifyContent: 'space-between'
                                                                }}
                                                            >
                                                                {name}
                                                                <button 
                                                                    onClick={() => handleRemoveStudent(name)}
                                                                    style={{
                                                                        padding: '4px 8px',
                                                                        backgroundColor: '#dc3545',
                                                                        color: 'white',
                                                                        border: 'none',
                                                                        borderRadius: 4,
                                                                        cursor: 'pointer'
                                                                    }}
                                                                >
                                                                    Remove
                                                                </button>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                ) : (
                                                    <p>No students attended this session.</p>
                                                )}
                                                
                                                <div style={{ marginTop: 15, paddingTop: 15, borderTop: '1px solid #ccc' }}>
                                                    <h5 style={{ marginBottom: 10 }}>Add Student</h5>
                                                    <div style={{ display: 'flex', gap: 8 }}>
                                                        <input
                                                            type="text"
                                                            placeholder="Student name"
                                                            value={newStudentName}
                                                            onChange={(e) => setNewStudentName(e.target.value)}
                                                            onKeyPress={(e) => e.key === 'Enter' && handleAddStudent()}
                                                            style={{ flex: 1, padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
                                                        />
                                                        <button 
                                                            onClick={handleAddStudent}
                                                            style={{
                                                                padding: '8px 16px',
                                                                backgroundColor: '#28a745',
                                                                color: 'white',
                                                                border: 'none',
                                                                borderRadius: 4,
                                                                cursor: 'pointer'
                                                            }}
                                                        >
                                                            Add
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <p>No CLP sessions for this class.</p>
                                )}
                            </>
                        ) : (
                            <p>Select a class to view details</p>
                        )}
                    </div>
                </div>
            )}
            </div>
            )}

            {/* Reports Tab */}
            {activeTab === 'reports' && (
            <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <h2 style={{ margin: 0 }}>Collaborative Learning Program Reports</h2>
                    <button 
                        onClick={generatePDF}
                        style={{
                            padding: '10px 20px',
                            backgroundColor: '#28a745',
                            color: 'white',
                            border: 'none',
                            borderRadius: 4,
                            cursor: 'pointer',
                            fontSize: 14,
                            fontWeight: 'bold'
                        }}
                    >
                        Download PDF
                    </button>
                </div>

                <div ref={reportRef}>

                {Object.keys(reportData).length > 0 ? (
                    <div>
                        {Object.keys(reportData).sort().map(semester => (
                            <div key={semester} style={{ marginBottom: 40 }} className="semester-section">
                                <h2 style={{ borderBottom: '2px solid #333', paddingBottom: 10, marginBottom: 20 }}>
                                    {semester} Semester
                                </h2>

                                {reportData[semester].map((course, idx) => (
                                    <div key={idx} style={{ marginBottom: 30 }}>
                                        <h3 style={{ margin: '15px 0 10px 0' }}>
                                            {course.code} – {course.title}
                                        </h3>
                                        <p style={{ margin: '5px 0', color: '#555' }}>
                                            <strong>Professor:</strong> {course.professor}
                                        </p>

                                        <div style={{ overflowX: 'auto', marginTop: 15 }}>
                                            <table style={{
                                                width: '100%',
                                                borderCollapse: 'collapse',
                                                border: '1px solid #333',
                                                backgroundColor: 'white'
                                            }}>
                                                <tbody>
                                                    <tr style={{ borderBottom: '1px solid #333', backgroundColor: '#f5f5f5' }}>
                                                        <td style={{ padding: 10, fontWeight: 'bold', width: '50%' }}>Number of students in spreadsheet:</td>
                                                        <td style={{ padding: 10, textAlign: 'center' }}>{course.totalStudents}</td>
                                                    </tr>
                                                    <tr style={{ borderBottom: '1px solid #333' }}>
                                                        <td style={{ padding: 10, fontWeight: 'bold', width: '50%' }}>Total Attendance:</td>
                                                        <td style={{ padding: 10, textAlign: 'center' }}>{course.totalAttendance}</td>
                                                    </tr>
                                                    <tr style={{ borderBottom: '1px solid #333', backgroundColor: '#f5f5f5' }}>
                                                        <td style={{ padding: 10, fontWeight: 'bold', width: '50%' }}>Average Number of Attendance:</td>
                                                        <td style={{ padding: 10, textAlign: 'center' }}>{course.avgAttendance}</td>
                                                    </tr>
                                                    <tr style={{ borderBottom: '1px solid #333' }}>
                                                        <td style={{ padding: 10, fontWeight: 'bold', width: '50%' }}>Total number of students attending 5 or more sessions:</td>
                                                        <td style={{ padding: 10, textAlign: 'center' }}>{course.attendeesGte5}</td>
                                                    </tr>
                                                    <tr style={{ borderBottom: '1px solid #333', backgroundColor: '#f5f5f5' }}>
                                                        <td style={{ padding: 10, fontWeight: 'bold', width: '50%' }}>Average GPA for students attending 5 or more sessions:</td>
                                                        <td style={{ padding: 10, textAlign: 'center' }}>{course.gpaGte5}</td>
                                                    </tr>
                                                    <tr style={{ borderBottom: '1px solid #333' }}>
                                                        <td style={{ padding: 10, fontWeight: 'bold', width: '50%' }}>Total number of students attending fewer than 5 sessions:</td>
                                                        <td style={{ padding: 10, textAlign: 'center' }}>{course.attendeesLt5}</td>
                                                    </tr>
                                                    <tr style={{ borderBottom: '1px solid #333', backgroundColor: '#f5f5f5' }}>
                                                        <td style={{ padding: 10, fontWeight: 'bold', width: '50%' }}>Average GPA for students attending fewer than 5 sessions:</td>
                                                        <td style={{ padding: 10, textAlign: 'center' }}>{course.gpaLt5}</td>
                                                    </tr>
                                                    <tr style={{ backgroundColor: '#f5f5f5' }}>
                                                        <td style={{ padding: 10, fontWeight: 'bold', width: '50%' }}>Difference in GPA:</td>
                                                        <td style={{ padding: 10, textAlign: 'center' }}>{course.gpaDifference}</td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                ) : (
                    <p style={{ textAlign: 'center', color: '#999', padding: 20 }}>No report data available</p>
                )}
                </div>
            </div>
            )}
        </div>
    )
}

export default AdminPg