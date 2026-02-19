import React, { useState, useEffect } from 'react'
import Papa from 'papaparse'

interface CLPSession {
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
  professorName: string;
  sessions: CLPSession[];
}

interface Professor {
  id: number;
  name: string;
  userId: number;
  classes: Class[];
}

function StudentPg() {
    const [studentName, setStudentName] = useState<string>('');
    const [cardData, setCardData] = useState<string>('');
    const [status, setStatus] = useState<string>('Ready');
    const [classes, setClasses] = useState<Class[]>([]);
    const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
    const [selectedSessionNumber, setSelectedSessionNumber] = useState<number | null>(null);
    const [loadingClasses, setLoadingClasses] = useState(true);
    const [currentSession, setCurrentSession] = useState<CLPSession | null>(null);
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [students, setStudents] = useState<{id: string, name: string}[]>([]);

    // Fetch classes from backend
    useEffect(() => {
        const fetchClasses = async () => {
            try {
                const response = await fetch('http://localhost:3001/api/professors');
                const professors: Professor[] = await response.json();
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
            } catch (error) {
                setStatus('Failed to load classes: ' + (error as Error).message);
            } finally {
                setLoadingClasses(false);
            }
        };
        fetchClasses();
    }, []);

    // Load students CSV
    useEffect(() => {
        const loadStudents = async () => {
            try {
                const response = await fetch('/students.csv');
                const csvText = await response.text();
                Papa.parse(csvText, {
                    header: true,
                    complete: (results) => {
                        console.log('Loaded students:', results.data);
                        setStudents(results.data as {id: string, name: string}[]);
                    },
                    error: (error: any) => {
                        console.error('CSV parse error:', error);
                        setStatus('Failed to load students: ' + error.message);
                    }
                });
            } catch (error) {
                console.error('Fetch CSV error:', error);
                setStatus('Failed to load students: ' + (error as Error).message);
            }
        };
        loadStudents();
    }, []);

    // Reset session selection when class changes
    useEffect(() => {
        setSelectedSessionNumber(null);
    }, [selectedClassId]);

    // Fetch latest CLP session when class is selected
    useEffect(() => {
        const fetchLatestSession = async () => {
            if (!selectedClassId || !selectedSessionNumber) {
                setCurrentSession(null);
                return;
            }
            try {
                const selectedClass = classes.find(c => c.id === selectedClassId);
                if (selectedClass && selectedClass.sessions.length > 0) {
                    // Get the selected session by session number
                    const session = selectedClass.sessions.find(s => s.sessionNumber === selectedSessionNumber);
                    if (session) {
                        setCurrentSession(session);
                        setStatus(`Connected to Session ${session.sessionNumber} (${session.date})`);
                    } else {
                        setStatus('Session not found');
                    }
                }
            } catch (error) {
                setStatus('Failed to load session: ' + (error as Error).message);
            }
        };
        fetchLatestSession();
    }, [selectedClassId, selectedSessionNumber, classes]);

    // Handle card input from HID scanner
    const handleCardInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const data = e.target.value;
        console.log('Raw data:', data);
        const parsedId = parseStudentId(data);
        console.log('Parsed ID:', parsedId);
        if (parsedId) {
            setCardData(parsedId); // Show the cleaned ID
            const student = students.find(s => s.id === parsedId);
            if (student) {
                setStudentName(student.name);
                await saveAttendance(student.name);
            } else {
                setStatus('Student ID not found in database');
            }   
            // Clear after a short delay to show the cleaned ID
            setTimeout(() => setCardData(''), 1000);
        } else {
            setCardData(''); // Clear immediately if invalid
        }
        return;
    };

    // Parse ID from card data (either Track 1 or direct ID)
    const parseStudentId = (data: string): string | null => {
        // Remove any non-digits
        data = data.replace(/\D/g, '');
        data = data.substring(0, 9); // Ensure max length of 9 digits
        // Check if it matches the format: 000xxxxxx (9 digits starting with 000)
        if (/^000\d{6}$/.test(data)) {
            return data;
        }
        return null;
    };

    // Save student attendance to CLP session
    const saveAttendance = async (name: string) => {
        if (!currentSession || !selectedClassId) {
            setStatus('No active CLP session for this class');
            return;
        }
        try {
            const selectedClass = classes.find(c => c.id === selectedClassId);
            if (!selectedClass) {
                setStatus('Class not found');
                return;
            }
            
            // Find which professor owns this class
            const response = await fetch('http://localhost:3001/api/professors');
            const professors: Professor[] = await response.json();
            let profId: number | null = null;
            
            for (const prof of professors) {
                if (prof.classes.some(c => c.id === selectedClass.id)) {
                    profId = prof.id;
                    break;
                }
            }
            
            if (!profId) {
                setStatus('Professor not found for this class');
                return;
            }
            
            const attendRes = await fetch(
                `http://localhost:3001/api/professors/${profId}/classes/${selectedClass.id}/sessions/${currentSession.sessionNumber}/attend`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ studentName: name })
                }
            );
            if (!attendRes.ok) {
                throw new Error('Failed to save attendance');
            }
            setStatus(`${name} marked present!`);
            // Clear student name display after a second
            setTimeout(() => setStudentName(''), 2000);
        } catch (error) {
            setStatus('Error saving attendance: ' + (error as Error).message);
        }
    };

    const selectedClass = classes.find(c => c.id === selectedClassId);

    return (
        <div>
            <h1>Student CLP Dashboard</h1>
            
            {/* Class Selection */}
            <div>
                <h2>Select Your Class</h2>
                {loadingClasses ? (
                    <p>Loading classes...</p>
                ) : (
                    <>
                        <div style={{ marginBottom: 15 }}>
                            <input
                                type="text"
                                placeholder="Search by professor name or class code"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{
                                    width: '100%',
                                    maxWidth: '500px',
                                    padding: 10,
                                    fontSize: 14,
                                    borderRadius: 4,
                                    border: '1px solid #ccc'
                                }}
                            />
                        </div>
                        <div>
                            {classes.filter(cls => {
                                const searchLower = searchTerm.toLowerCase();
                                return (
                                    cls.professorName.toLowerCase().includes(searchLower) ||
                                    cls.code.toLowerCase().includes(searchLower) ||
                                    cls.title.toLowerCase().includes(searchLower) ||
                                    `section ${cls.section}`.toLowerCase().includes(searchLower)
                                );
                            }).length === 0 ? (
                                <p>No classes match your search.</p>
                            ) : (
                                <ul style={{ listStyle: 'none', padding: 0, maxWidth: 600 }}>
                                    {classes
                                        .filter(cls => {
                                            const searchLower = searchTerm.toLowerCase();
                                            return (
                                                cls.professorName.toLowerCase().includes(searchLower) ||
                                                cls.code.toLowerCase().includes(searchLower) ||
                                                cls.title.toLowerCase().includes(searchLower) ||
                                                `section ${cls.section}`.toLowerCase().includes(searchLower)
                                            );
                                        })
                                        .map(cls => (
                                        <li key={cls.id} style={{ padding: 0, marginBottom: 6 }}>
                                            <button
                                                onClick={() => { setSelectedClassId(cls.id); setSelectedSessionNumber(null); }}
                                                style={{
                                                    width: '100%',
                                                    padding: 10,
                                                    backgroundColor: selectedClassId === cls.id ? '#007bff' : '#f9f9f9',
                                                    color: selectedClassId === cls.id ? 'white' : 'black',
                                                    borderRadius: 6,
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    textAlign: 'left',
                                                    userSelect: 'none',
                                                    WebkitUserSelect: 'none',
                                                    MozUserSelect: 'none',
                                                    msUserSelect: 'none',
                                                    outline: 'none',
                                                    WebkitTapHighlightColor: 'transparent'
                                                }}
                                                aria-pressed={selectedClassId === cls.id}
                                            >
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontWeight: 600 }}>{cls.professorName} — {cls.code} (Section {cls.section})</div>
                                                    <div style={{ fontSize: 13, color: '#555' }}>{cls.title} — {cls.semester}</div>
                                                </div>
                                                <div style={{ marginLeft: 12, opacity: selectedClassId === cls.id ? 1 : 0.6 }}>
                                                    {selectedClassId === cls.id ? 'Selected' : 'Choose'}
                                                </div>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </>
                )}
                {/* Selected label removed — selection is shown on the class button itself */}
            </div>

            {/* Session Selection */}
            {selectedClass && (
                <div>
                    <h2>Select Session Date</h2>
                    <select 
                        value={selectedSessionNumber || ''} 
                        onChange={(e) => setSelectedSessionNumber(e.target.value ? parseInt(e.target.value) : null)}
                    >
                        <option value="">-- Choose a session --</option>
                        {selectedClass.sessions.map(session => (
                            <option key={session.sessionNumber} value={session.sessionNumber}>
                                Session {session.sessionNumber} - {session.date}
                            </option>
                        ))}
                    </select>
                    
                </div>
            )}

            {/* Card Scanning */}
            <div>
                <h2>Card Scanner</h2>
                {currentSession ? (
                    <>
                        <p>Status: {status}</p>
                        <input
                            type="text"
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    handleCardInput(e as unknown as React.ChangeEvent<HTMLInputElement>);
                                }
                            }}
                            placeholder="Swipe card here"
                            autoFocus
                            style={{ width: '300px', padding: '10px' }}
                        />
                    </>
                ) : (
                    <p>Please select a class and session to enable card scanning.</p>
                )}
            </div>
        </div>
    )
}

export default StudentPg