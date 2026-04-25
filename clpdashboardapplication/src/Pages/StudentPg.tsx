import React, { useState, useEffect } from 'react'
import axios from 'axios';

// This is what will be presented on this page.
// Each of these items are retrieved from the mock database via API calls in server.js
interface Class {
  id: number;
  title: string;
  code: string;
  section: number;
  semester: string;
  professorName: string;
  uniqueId: string;
}

interface Professor {
  id: number;
  name: string;
}

interface Student {
  studentID: number;
  name: string;
}

interface Session {
  sessionID: number;
  sessionNumber: number;
  date: string;
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
    const [students, setStudents] = useState<Student[]>([]);
    const [professors, setProfessors] = useState<any[]>([]);
    const [selectedProfId, setSelectedProfId] = useState<number | null>(null);

    const [sessions, setSessions] = useState<Session[]>([]);
    const [selectedSessionNumber, setSelectedSessionNumber] = useState<number | null>(null);


    //Load professors
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

    //load classes
    useEffect(() => {
        if (!selectedProfId) return setClasses([])

        axios.get(`${API_BASE}/getProfClasses`, {
            params: { userId: selectedProfId }
        })
        .then(res => {
            const formatted = res.data.classes.map((c: any) => ({
                id: c.id,
                title: c.title,
                code: c.code,
                section: c.section || 1,
                semester: c.semester,
                professorName: res.data.name,
                uniqueId: `${selectedProfId}-${c.id}`
            }))

            setClasses(formatted)
            setSelectedClassId('')
            setSessions([])
        })
        .catch(() => setStatus('Error loading classes'))
    }, [selectedProfId])

    // Load students from database API
    useEffect(() => {
        axios.get(`${API_BASE}/allStudents`)
            .then(res => setStudents(res.data))
            .catch(() => setStatus('Error loading students'))
    }, [])

    //Load sessions
    useEffect(() => {
        const cls = classes.find(c => c.uniqueId == selectedClassId)
        if (!cls) return

        axios.get(`${API_BASE}/classes/${cls.id}/sessions`)
            .then(res => setSessions(res.data))
            .catch(() => setStatus('Error loading sessions'))
    }, [selectedClassId])

    // Handle card input from HID scanner
    const handleCardInput = async () => {
        const data = cardData;
        const parsedId = parseStudentId(data);
        if (parsedId) {
            const setParsedId = String(parsedId);
            setCardData(setParsedId);
            const student = students.find(s => s.studentID === parsedId);
            if (student) {
                console.log('Student found:', student);
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
        if (!digits) {
            console.warn('No digits found in card data');
            return null;   
        }
        
        const id = Number(digits);

        if (isNaN(id)) {
            console.warn('Parsed ID is not a valid number:', id);
            return null;        
        }

        return id;
    };

    // Save student attendance for the selected class
    const saveAttendance = async (studentId: number) => {
        const cls = classes.find(c => c.uniqueId === selectedClassId)
        if (!cls || !selectedSessionNumber) {
            setStatus('Select class + session first')
            return
        }

        try {
            await axios.post(`${API_BASE}/attendance`, {
            studentId,
            classId: cls.id,
            sessionNumber: selectedSessionNumber,
            professorID: selectedProfId
        })

        setStatus('Attendance saved')
        } catch {
        setStatus('Error saving attendance')
        }
    }

    const createSession = async () => {
        if (!selectedClassId || !selectedProfId) {
            setStatus("Select a class first");
            return;
        }

        try {
            const cls = classes.find(c => c.uniqueId === selectedClassId);
            if (!cls) return;

            const res = await axios.post(
            `${API_BASE}/classes/${cls.id}/sessions`,
            {
                professorID: selectedProfId,
                classID: cls.id
            }
            );

            setStatus(`Session ${res.data.sessionNumber} created`);

            // refresh sessions immediately
            const sessionRes = await axios.get(
                `${API_BASE}/classes/${cls.id}/sessions`
            );

            setSessions(sessionRes.data);

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
                        onChange={e => setSelectedSessionNumber(Number(e.target.value))}
                    >
                        <option value="">-- Choose a session --</option>
                        {sessions.map(s => (
                            <option key={s.sessionID} value={s.sessionNumber}>
                                {s.date} — Session {s.sessionNumber}
                            </option>
                        ))}
                    </select>
                    <button
                        onClick={createSession}
                        disabled={!selectedClassId}
                        style={{
                            marginTop: 10,
                            padding: "8px 12px",
                            backgroundColor: "#28a745",
                            color: "white",
                            border: "none",
                            borderRadius: 4,
                            cursor: "pointer"
                        }}
                    >
                        + Create New Session
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
                    disabled={!selectedClassId}
                />
            </div>
        </div>
    )
}

export default StudentPg