import React, { useState, useEffect } from 'react'
import axios from 'axios';

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
    const [professors, setProfessors] = useState<any[]>([]);
    const [selectedProfId, setSelectedProfId] = useState<number | null>(null);

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

    const handleCardInput = async () => {
        const selectedClass = classes.find(c => c.uniqueId === selectedClassId);
        if (!selectedClass) {
            setStatus('Please select a class first');
            return;
        }

        const data = cardData;
        const parsedId = parseStudentId(data);
        if (parsedId) {
            setCardData(parsedId);

            const inRoster = (selectedClass.students || []).some(
                (student) => normalizeStudentId(String(student.id)) === parsedId
            );
            if (!inRoster) {
                setStatus('Student is not on this class roster');
                setTimeout(() => setStatus('Ready'), 2000);
                return;
            }

            await saveAttendance(parsedId);
            setTimeout(() => setCardData(''), 1000);
        } else {
            setCardData('');
        }
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

            const res = await axios.post(`${API_BASE}/attendance`, {
                studentId,
                classId: selectedClass.id,
                profId: selectedProfId
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
