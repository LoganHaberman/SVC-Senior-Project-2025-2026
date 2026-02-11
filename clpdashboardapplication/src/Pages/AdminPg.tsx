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
  section: number;
  semester: string;
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
    const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
    const [selectedSessionNumber, setSelectedSessionNumber] = useState<number | null>(null);
    const [newStudentName, setNewStudentName] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Fetch all classes on mount
    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                // Fetch professors and their classes
                const profRes = await fetch(`${API_BASE}/professors`);
                const professors: Professor[] = await profRes.json();
                const allClasses: Class[] = [];
                
                professors.forEach(prof => {
                    prof.classes.forEach(cls => {
                        allClasses.push({
                            ...cls,
                            professorName: prof.name
                        });
                    });
                });
                setClasses(allClasses);
            } catch (err) {
                setError('Failed to load data: ' + (err as Error).message);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const selectedClass = classes.find(c => c.id === selectedClassId);
    const selectedSession = selectedClass && selectedSessionNumber 
        ? selectedClass.sessions.find(s => s.sessionNumber === selectedSessionNumber)
        : null;

    // Get professor for selected class
    const getSelectedProfessorId = (): number | null => {
        if (!selectedClass) return null;
        // This is a simplified approach - in a real app you'd fetch this info
        // For now, we'll need to fetch all professors to find which one owns the class
        return null;
    };

    // Add student to session
    const handleAddStudent = async () => {
        if (!newStudentName.trim() || !selectedClass || !selectedSessionNumber) {
            setError('Please enter a student name and select a session');
            return;
        }
        if (!selectedSession || !selectedSession.attendees.includes(newStudentName)) {
            // Update local state
            const updatedClasses = classes.map(cls => {
                if (cls.id === selectedClass.id) {
                    return {
                        ...cls,
                        sessions: cls.sessions.map(sess => 
                            sess.sessionNumber === selectedSessionNumber && !sess.attendees.includes(newStudentName)
                                ? { ...sess, attendees: [...sess.attendees, newStudentName] }
                                : sess
                        )
                    };
                }
                return cls;
            });
            setClasses(updatedClasses);
            setNewStudentName('');
            setError(null);
        } else {
            setError('Student already in attendance');
        }
    };

    // Remove student from session
    const handleRemoveStudent = async (studentName: string) => {
        if (!selectedClass || !selectedSessionNumber) return;
        
        // Update local state
        const updatedClasses = classes.map(cls => {
            if (cls.id === selectedClass.id) {
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
    };

    return (
        <div style={{ padding: 20 }}>
            <h1>Admin CLP Dashboard</h1>
            {error && <p style={{ color: 'red' }}>{error}</p>}
            
            <div style={{ display: 'flex', gap: 20 }}>
                {/* Classes List */}
                <div style={{ flex: 1 }}>
                    <h2>Classes</h2>
                    {loading ? (
                        <p>Loading...</p>
                    ) : (
                        <ul style={{ listStyle: 'none', padding: 0 }}>
                            {classes.map(cls => (
                                <li 
                                    key={cls.id}
                                    onClick={() => setSelectedClassId(cls.id)}
                                    style={{
                                        padding: 10,
                                        margin: 5,
                                        backgroundColor: selectedClassId === cls.id ? '#007bff' : '#f0f0f0',
                                        color: selectedClassId === cls.id ? 'white' : 'black',
                                        cursor: 'pointer',
                                        borderRadius: 4
                                    }}
                                >
                                    {cls.professorName} - {cls.code} - Section {cls.section}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {/* Class Details and CLP Sessions */}
                <div style={{ flex: 2 }}>
                    {selectedClass ? (
                        <>
                            <h2>{selectedClass.title}</h2>
                            <p><strong>Professor:</strong> {selectedClass.professorName}</p>
                            <p><strong>Code:</strong> {selectedClass.code}</p>
                            <p><strong>Section:</strong> {selectedClass.section}</p>
                            <p><strong>Semester:</strong> {selectedClass.semester}</p>

                            <h3>CLP Sessions</h3>
                            {selectedClass.sessions && selectedClass.sessions.length > 0 ? (
                                <>
                                    {selectedSession && (
                                        <div style={{ 
                                            padding: 15, 
                                            marginBottom: 20, 
                                            backgroundColor: '#e8f4f8',
                                            borderRadius: 4
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                                <h4 style={{ margin: 0 }}>Editing: Session {selectedSession.sessionNumber} - {selectedSession.date}</h4>
                                                <button 
                                                    onClick={() => setSelectedSessionNumber(null)}
                                                    style={{
                                                        padding: '8px 16px',
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
                                            <p><strong>Current Attendees ({selectedSession.attendees.length}):</strong></p>
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
                                                                justifyContent: 'space-between',
                                                                alignItems: 'center'
                                                            }}
                                                        >
                                                            <span>{name}</span>
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
                                                <h5>Add Student to Attendance</h5>
                                                <div style={{ display: 'flex', gap: 10 }}>
                                                    <input
                                                        type="text"
                                                        placeholder="Enter student name"
                                                        value={newStudentName}
                                                        onChange={(e) => setNewStudentName(e.target.value)}
                                                        onKeyPress={(e) => e.key === 'Enter' && handleAddStudent()}
                                                        style={{ 
                                                            flex: 1, 
                                                            padding: 8,
                                                            borderRadius: 4,
                                                            border: '1px solid #ccc'
                                                        }}
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
                                                        Add Student
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <h4>Sessions</h4>
                                    <ul style={{ listStyle: 'none', padding: 0 }}>
                                        {selectedClass.sessions.map(session => (
                                            <li key={session.sessionNumber} style={{ 
                                                padding: 10, 
                                                marginBottom: 10, 
                                                backgroundColor: selectedSessionNumber === session.sessionNumber ? '#d1ecf1' : '#f5f5f5',
                                                borderLeft: '4px solid #007bff',
                                                borderRadius: 4,
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'flex-start'
                                            }}>
                                                <div style={{ flex: 1 }}>
                                                    <p><strong>Session {session.sessionNumber}</strong> - Date: {session.date}</p>
                                                    <p><strong>Attendees ({session.attendees.length}):</strong></p>
                                                    <ul style={{ marginLeft: 20 }}>
                                                        {session.attendees.map((name, idx) => (
                                                            <li key={idx}>{name}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                                <button
                                                    onClick={() => setSelectedSessionNumber(session.sessionNumber)}
                                                    style={{
                                                        padding: '8px 16px',
                                                        backgroundColor: '#007bff',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: 4,
                                                        cursor: 'pointer',
                                                        marginLeft: 10,
                                                        whiteSpace: 'nowrap'
                                                    }}
                                                >
                                                    Edit
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                </>
                            ) : (
                                <p>No CLP sessions recorded for this class.</p>
                            )}
                        </>
                    ) : (
                        <p>Select a class to view details</p>
                    )}
                </div>
            </div>
        </div>
    )
}

export default AdminPg