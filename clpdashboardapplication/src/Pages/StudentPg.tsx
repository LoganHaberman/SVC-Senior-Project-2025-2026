import React, { useState, useEffect } from 'react'
import axios from 'axios';

// This is what will be presented on this page.
// Each of these items are retrieved from the mock database via API calls in server.js
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
  uniqueId: string;
  sessions: CLPSession[];
}

interface Professor {
  id: number;
  name: string;
  userId: number;
  classes: Class[];
}

interface Student {
  studentID: number;
  name: string;
}

/**
 * By Grant Harsch
 * Desc: Student dashboard page.
 * This page presents the student with the ability to register a student as being present in a CLP session.
 * They must pick the class and CLP session they are recording and then scan the attendees card or enter it manually.
 * Scanning is merrily for ease of use and is not needed. To enter student IDs manually type it in the text box
 * and press enter. 
 */

function StudentPg() {
    const API_BASE = '/api'

    const [cardData, setCardData] = useState<string>('');
    const [status, setStatus] = useState<string>('Ready');
    const [classes, setClasses] = useState<Class[]>([]);
    const [selectedClassId, setSelectedClassId] = useState<string>('');
    const [selectedSessionNumber, setSelectedSessionNumber] = useState<number | null>(null);
    const [students, setStudents] = useState<Student[]>([]);
    const [professors, setProfessors] = useState<any[]>([]);
    const [selectedProfId, setSelectedProfId] = useState<number | null>(null);

    // Fetch classes from backend
    useEffect(() => {
    const loadProfessors = async () => {
        try {
            const res = await axios.get(`${API_BASE}/professors/list`);
            const data = await res.data;
            setProfessors(data);
        } catch {
            setStatus('Error loading professors');
        }
    };

    loadProfessors();
    }, []);

    useEffect(() => {
    const loadClasses = async () => {
        if (!selectedProfId) return;

        try {
            const res = await axios.get(`${API_BASE}/getProfClasses`, {
                params: { userId: selectedProfId }
            });

            const data = res.data;

            const formatted = data.classes.map((c: any) => ({
                id: c.id,
                title: c.title,
                code: c.code,
                section: c.section || 1,
                semester: c.semester,
                professorName: data.name,
                uniqueId: `${selectedProfId}-${c.id}`,
                sessions: c.sessions || []
            }));

            setClasses(formatted);
        } catch {
            setStatus('Error loading classes');
        }
    };

    loadClasses();
    }, [selectedProfId]);

    // Load students from database API
    useEffect(() => {
        const loadStudents = async () => {
            try {
                console.log('Loading students from server...');
                const res = await axios.get(`${API_BASE}/allStudents`);
                console.log('Students from server:', res.data);
                const studentList: Student[] = await res.data;
                console.log('Formatted student list:', studentList);
                setStudents(studentList);
            } catch (error) {
                setStatus('Error loading students');
            }
        };
        loadStudents();
    }, []);

    // Reset session when class changes
    useEffect(() => {
        setSelectedSessionNumber(null);
    }, [selectedClassId]);

    // Handle card input from HID scanner
    const handleCardInput = async () => {
        console.log('Handle card input:', cardData);
        const data = cardData;
        const parsedId = parseStudentId(data);
        console.log('Parsed student ID:', parsedId);
        if (parsedId) {
            const setParsedId = String(parsedId);
            setCardData(setParsedId);
            console.log('Students list for ID matching:', students);
            const student = students.find(s => s.studentID === parsedId);
            if (student) {
                await saveAttendance(Number(student.studentID));
            } else {
                setStatus('Student ID not found');
            }   
            setTimeout(() => setCardData(''), 1000);
        } else {
            setCardData('');
        }
    };

    // Parse ID from card data (either Track 1 or direct ID)
    const parseStudentId = (data: string): number | null => {
        const digits = data.replace(/\D/g, '');
        console.log('Data after removing non-digits:', digits);
        if (!digits) {
            console.warn('No digits found in card data');
            return null;   
        }
        
        console.log('Digits extracted from card data:', digits);
        const id = Number(digits);

        if (isNaN(id)) {
            console.warn('Parsed ID is not a valid number:', id);
            return null;        
        }
        console.log('Parsed ID:', id);

        return id;
    };
    // Save student attendance to CLP session
    const saveAttendance = async (studentId: number) => {
        console.log('Saving attendance for student ID:', studentId);
        try {
            const selectedClass = classes.find(c => c.uniqueId === selectedClassId);

            if (!selectedClass) {
                setStatus('Class not found');
                return;
            }

            console.log('Saving attendance for student ID:', studentId);
            const res = await axios.post(`${API_BASE}/attendance`, {
                studentId,
                classId: selectedClass.id,
                sessionNumber: selectedSessionNumber
            });

            if (res.status !== 200) {
                throw new Error('Failed to save attendance');
            }

            setStatus(`Student marked present!`);
            setTimeout(() => setStatus('Ready'), 2000);

        } catch (error) {
            console.error(error);
            setStatus('Error saving attendance');
        }
    };

    const handleAddSession = async () => {
        if (!selectedClass) {
            setStatus("Select a class first");
            return;
        }

        try {
            const res = await axios.post(
                `${API_BASE}/classes/${selectedClass.id}/sessions`
            );

            const newSession = res.data;

            setClasses(prev =>
                prev.map(cls =>
                    cls.id === selectedClass.id
                        ? {
                            ...cls,
                            sessions: [...cls.sessions, newSession]
                        }
                        : cls
                )
            );

            setStatus(`Session ${newSession.sessionNumber} created`);
        } catch (err) {
            console.error(err);
            setStatus("Error creating session");
        }
    };

    const selectedClass = classes.find(c => c.uniqueId === selectedClassId);

    return (
        <div style={{ padding: 20, fontFamily: 'Arial, sans-serif' }}>
            <h1>Student CLP Dashboard</h1>
            {/* Professor Selection */}
            <div style={{ marginBottom: 20 }}>
                <h2>Select Professor</h2>
                <select 
                    value={selectedProfId || ''} 
                    onChange={(e) => setSelectedProfId(Number(e.target.value))  }
                    style={{ padding: 10, width: 300 }}
                >
                    <option value="">-- Choose a professor --</option>
                    {professors.map(prof => (
                        <option key={prof.id} value={prof.id}>
                            {prof.name}
                        </option>
                    ))}
                </select>
            </div>

            {/* Class Selection */}
            <div style={{ marginBottom: 20 }}>
                <h2>Select Class</h2>
                <select 
                    value={selectedClassId} 
                    onChange={(e) => setSelectedClassId(e.target.value)}
                    style={{ padding: 10, width: 300 }}
                >
                    <option value="">-- Choose a class --</option>
                    {classes.map(cls => (
                        <option key={cls.uniqueId} value={cls.uniqueId}>
                            {cls.code} — Section {cls.section}
                        </option>
                    ))}
                </select>
            </div>

            {/* Session Selection */}
            {selectedClass && (
                <div style={{ marginBottom: 20 }}>
                    <h2>Select Session</h2>
                    <select 
                        value={selectedSessionNumber || ''} 
                        onChange={(e) => setSelectedSessionNumber(e.target.value ? parseInt(e.target.value) : null)}
                        style={{ padding: 10, width: 300 }}
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
            {selectedClass && (
                <div style={{ marginBottom: 20 }}>
                    <button
                        onClick={handleAddSession}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: '#007bff',
                            color: 'white',
                            border: 'none',
                            borderRadius: 4,
                            cursor: 'pointer'
                        }}
                    >
                        Add New Session
                    </button>
                </div>
            )}

            {/* Card Scanning */}
            <div>
                <h2>Scan Card</h2>
                <p>Status: {status}</p>
                <input
                    type="text"
                    value={cardData}
                    onChange={(e) => setCardData(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            handleCardInput();
                        }
                    }}
                    placeholder="Swipe card or enter ID"
                    autoFocus
                    style={{ padding: 10, width: 300 }}
                    disabled={!selectedClassId || !selectedSessionNumber}
                />
            </div>
        </div>
    )
}

export default StudentPg