import React, { useState, useEffect } from 'react'

// Type definitions for Web Serial API
interface SerialOptions {
  baudRate?: number;
  dataBits?: number;
  stopBits?: number;
  parity?: 'none' | 'even' | 'odd';
  bufferSize?: number;
  flowControl?: 'none' | 'hardware';
}

interface SerialPort {
  open(options: SerialOptions): Promise<void>;
  close(): Promise<void>;
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
}

interface Serial {
  requestPort(): Promise<SerialPort>;
  getPorts(): Promise<SerialPort[]>;
}

declare global {
  interface Navigator {
    serial: Serial;
  }
}

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
    const [port, setPort] = useState<SerialPort | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [studentName, setStudentName] = useState<string>('');
    const [status, setStatus] = useState<string>('Not connected');
    const [classes, setClasses] = useState<Class[]>([]);
    const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
    const [selectedSessionNumber, setSelectedSessionNumber] = useState<number | null>(null);
    const [loadingClasses, setLoadingClasses] = useState(true);
    const [currentSession, setCurrentSession] = useState<CLPSession | null>(null);
    const [searchTerm, setSearchTerm] = useState<string>('');

    // Feature detection
    useEffect(() => {
        if (!('serial' in navigator)) {
            setStatus('Web Serial API not supported in this browser');
        }
    }, []);

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

    // Fetch latest CLP session when class is selected
    useEffect(() => {
        const fetchLatestSession = async () => {
            if (!selectedClassId || !selectedSessionNumber) return;
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

    // Connect to MSR reader
    const connectReader = async () => {
        if (!selectedClassId || !selectedSessionNumber) {
            setStatus('Please select a class and session first');
            return;
        }
        try {
            const selectedPort = await navigator.serial.requestPort();
            await selectedPort.open({ baudRate: 9600 }); // Common for MSR; check device docs
            setPort(selectedPort);
            setIsConnected(true);
            setStatus('Connected. Swipe card.');
            readData(selectedPort);
        } catch (error) {
            setStatus('Failed to connect: ' + (error as Error).message);
        }
    };

    // Read and parse data
    const readData = async (port: SerialPort) => {
        if (!port.readable) return;
        const reader = port.readable.getReader();

        try {
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                if (value) {
                    const chunk = new TextDecoder().decode(value);
                    const parsedName = parseStudentName(chunk);
                    if (parsedName) {
                        setStudentName(parsedName);
                        saveAttendance(parsedName);
                    } else {
                        setStatus('Invalid card data');
                    }
                }
            }
        } catch (error) {
            setStatus('Read error: ' + (error as Error).message);
        } finally {
            reader.releaseLock();
        }
    };

    // Parse name from Track 1 data
    const parseStudentName = (data: string): string | null => {
        const tracks = data.split('?'); // Split tracks if multiple
        for (const track of tracks) {
            if (track.startsWith('%')) { // Track 1
                const parts = track.split('^');
                if (parts.length >= 3) {
                    const namePart = parts[1]; // e.g., "DOE/JOHN"
                    const nameSplit = namePart.split('/');
                    if (nameSplit.length === 2) {
                        return `${nameSplit[1]} ${nameSplit[0]}`; // "JOHN DOE"
                    }
                }
            }
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

    // Disconnect
    const disconnectReader = async () => {
        if (port) {
            await port.close();
            setPort(null);
            setIsConnected(false);
            setStatus('Disconnected');
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
                {currentSession && <p><strong>CLP Session: {currentSession.sessionNumber}</strong> (Date: {currentSession.date})</p>}
                <p>Status: {status}</p>
                {!isConnected ? (
                    <button onClick={connectReader} disabled={!selectedClassId || !selectedSessionNumber}>Connect MSR Reader</button>
                ) : (
                    <button onClick={disconnectReader}>Disconnect</button>
                )}
                {studentName && <p>Welcome, {studentName}!</p>}
            </div>
        </div>
    )
}

export default StudentPg