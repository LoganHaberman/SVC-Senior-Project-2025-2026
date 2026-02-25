import React, { useState, useEffect } from 'react'

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
            const response = await fetch(
                `${API_BASE}/professors/${selectedClass.profId}/classes/${selectedClass.id}/sessions/${selectedSessionNumber}/attend`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ studentName: newStudentName.trim() })
                }
            );
            if (!response.ok) throw new Error('Failed to add student');
            
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

    const handleRemoveStudent = async (studentName: string) => {
        if (!selectedClass || !selectedSessionNumber) return;
        
        try {
            const response = await fetch(
                `${API_BASE}/professors/${selectedClass.profId}/classes/${selectedClass.id}/sessions/${selectedSessionNumber}/attend/${encodeURIComponent(studentName)}`,
                { method: 'DELETE' }
            );
            if (!response.ok) throw new Error('Failed to remove student');
            
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

    return (
        <div style={{ padding: 20, fontFamily: 'Arial, sans-serif' }}>
            <h1>Admin CLP Dashboard</h1>
            {error && <p style={{ color: '#dc3545' }}>{error}</p>}
            
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
    )
}

export default AdminPg