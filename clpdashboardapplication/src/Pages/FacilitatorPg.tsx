import React, { useState, useEffect } from 'react'
import axios from 'axios';
import { Session } from 'react-router-dom';

interface Class {
  id: number;
  title: string;
  code: string;
  section: number;
  semester: string;
  professorName: string;
  uniqueId: string;
  students?: { id: string; name: string }[];
  attendance?: { studentId: number | string; studentName: string; count: number }[];
}

interface Professor {
  id: number;
  name: string;
}

interface Student {
  studentID: number;
  name: string;
}

interface Sessiondata {
  sessionID: number;
  sessionNumber: number;
  date: string;
}

function FacilitatorPg() {
    const API_BASE = '/api'
    const normalizeStudentId = (raw: string): string | null => {
        const digits = String(raw ?? '').replace(/\D/g, '')
        if (!digits) return null
        const withoutLeadingZeros = digits.replace(/^0+/, '')
        if (!withoutLeadingZeros) return null
        return withoutLeadingZeros.length > 6
            ? withoutLeadingZeros.slice(-6)
            : withoutLeadingZeros
    }

    const [cardData, setCardData] = useState<string>('');
    const [status, setStatus] = useState<string>('Ready');
    const [classes, setClasses] = useState<Class[]>([]);
    const [selectedClassId, setSelectedClassId] = useState<string>('');
    const [students, setStudents] = useState<{ id: string; name: string }[]>([]);
    const [professors, setProfessors] = useState<any[]>([]);
    const [selectedProfId, setSelectedProfId] = useState<number | null>(null);
    const [classRosterSet, setClassRosterSet] = useState(new Set());

    const [sessions, setSessions] = useState<Sessiondata[]>([]);
    const [selectedSessionNumber, setSelectedSessionNumber] = useState<number | null>(null);

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
        if (!selectedProfId) {
            setClasses([]);
            setSelectedClassId('');
            return;
        }

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
                students: c.students || [],
                attendance: c.attendance || []
            }));

            setClasses(formatted);
            setSelectedClassId('');
        } catch {
            setStatus('Error loading classes');
        }
    };

    loadClasses();
    }, [selectedProfId]);

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

    const handleCardInput = async () => {
        const selectedClass = classes.find(c => c.uniqueId === selectedClassId);
        if (!selectedClass) {
            setStatus('Please select a class first');
            return;
        }

        const parsedId = parseStudentId(cardData);
        if (!parsedId) {
            setCardData('');
            return;
        }

        setCardData(parsedId);

        const normalizedId = normalizeStudentId(parsedId);
        console.log('Class roster set:', classRosterSet);
        console.log('Normalized student ID:', normalizedId);

        const inRoster = classRosterSet.has(normalizedId);

        if (!inRoster) {
            setStatus('Student is not on this class roster');
            setTimeout(() => setStatus('Ready'), 2000);
            return;
        }

        await saveAttendance(parsedId);
        setTimeout(() => setCardData(''), 1000);
    };

    const parseStudentId = (data: string): string | null => {
        const normalized = normalizeStudentId(data)
        if (!normalized) {
            console.warn('No valid student id found in card data');
            return null
        }
        return normalized
    };

    const saveAttendance = async (studentId: string) => {
        try {
            const selectedClass = classes.find(c => c.uniqueId === selectedClassId);

            if (!selectedClass || !selectedProfId) {
                setStatus('Class not found');
                return;
            }

            const studentInt = parseInt(studentId, 10);

            const res = await axios.post(`${API_BASE}/attendance`, {
                studentId: studentInt,
                classId: selectedClass.id,
                professorID: selectedProfId,
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

    useEffect(() => {
        const fetchRoster = async () => {
            if (!selectedClassId) return;

            try {
                const cls = classes.find(c => c.uniqueId === selectedClassId);
                if (!cls) return;


                const res = await axios.get(
                    `${API_BASE}/class-roster/${cls.id}`
                );

                // assuming res.data = [{ studentID: "123" }, ...]
                const rosterSet = new Set(
                    res.data.map((s: { studentID: string | number }) =>
                        normalizeStudentId(String(s.studentID))
                    )
                );

                setClassRosterSet(rosterSet);

            } catch (err) {
                console.error("Failed to load roster", err);
                setClassRosterSet(new Set());
            }
        };

        fetchRoster();
    }, [selectedClassId]);

    const selectedClass = classes.find(c => c.uniqueId === selectedClassId);

    return (
        <div style={{ fontFamily: 'Arial, sans-serif' }}>
            <div style={{ width: '100%', marginBottom: 20 }}>
                <div style={{ backgroundColor: '#0b5d3b', color: 'white', padding: '12px 20px', fontWeight: 700 }}>
                    <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Collaborative Learning Program</span>
                        <span style={{ fontWeight: 600, opacity: 0.95 }}>Facilitator Dashboard</span>
                    </div>
                </div>
                <div style={{ backgroundColor: '#c9a227', height: 8 }} />
            </div>
            <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 20px 20px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ marginBottom: 20, width: '100%', maxWidth: 500 }}>
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

            <div style={{ marginBottom: 20, width: '100%', maxWidth: 500 }}>
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

            <div style={{ width: '100%', maxWidth: 500 }}>
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
        </div>
    )
}

export default FacilitatorPg
