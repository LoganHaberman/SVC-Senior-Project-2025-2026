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
  id: string;
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
                const res = await fetch(`${API_BASE}/students`);
                const studentList: Student[] = await res.json();
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
        const data = cardData;
        const parsedId = parseStudentId(data);
        if (parsedId) {
            setCardData(parsedId);
            const student = students.find(s => s.id === parsedId);
            if (student) {
                await saveAttendance(student.name);
            } else {
                setStatus('Student ID not found');
            }   
            setTimeout(() => setCardData(''), 1000);
        } else {
            setCardData('');
        }
    };

    // Parse ID from card data (either Track 1 or direct ID)
    const parseStudentId = (data: string): string | null => {
        data = data.replace(/\D/g, '');
        data = data.substring(0, 9);
        if (/^000\d{6}$/.test(data)) {
            return data;
        }
        return null;
    };

    // Save student attendance to CLP session
    const saveAttendance = async (name: string) => {
        if (!selectedClassId || !selectedSessionNumber) {
            setStatus('Select class and session first');
            return;
        }
        try {
            const selectedClass = classes.find(c => c.uniqueId === selectedClassId);
            if (!selectedClass) {
                setStatus('Class not found');
                return;
            }
            
            const [profIdStr] = selectedClassId.split('-');
            const profId = parseInt(profIdStr);
            
            const attendRes = await fetch(
                `http://localhost:3001/api/professors/${profId}/classes/${selectedClass.id}/sessions/${selectedSessionNumber}/attend`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ studentName: name })
                }
            );
            if (!attendRes.ok) {
                throw new Error('Failed to save');
            }
            setStatus(`${name} marked present!`);
            setTimeout(() => setStatus('Ready'), 2000);
        } catch (error) {
            setStatus('Error saving attendance');
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