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
  attendance?: { studentId: number | string; studentName: string; count: number }[];
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
 * Description: Student dashboard page.
 * This page presents the student with the ability to register a student as being present in a CLP session.
 * They must pick the class and CLP session they are recording and then scan the attendees card or enter it manually.
 * Scanning is merrily for ease of use and is not needed. To enter student IDs manually type it in the text box
 * and press enter. 
 */

function StudentPg() {
    const API_BASE = 'http://localhost:3001/api'

    const [cardData, setCardData] = useState<string>('');
    const [status, setStatus] = useState<string>('Ready');
    const [classes, setClasses] = useState<Class[]>([]);
    const [selectedClassId, setSelectedClassId] = useState<string>('');
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

    // Handle card input from HID scanner
    const handleCardInput = async () => {
        const data = cardData;
        const parsedId = parseStudentId(data);
        if (parsedId) {
            setCardData(parsedId);
            
            // Get the selected class's roster
            const selectedClass = classes.find(c => c.uniqueId === selectedClassId);
            if (!selectedClass || !selectedClass.attendance) {
                setStatus('No roster loaded for this class');
                return;
            }
            
            // Find student in the class roster using student ID
            const student = selectedClass.attendance.find(s => String(s.studentId) === parsedId);
            if (student) {
                await saveAttendance(parsedId);
            } else {
                setStatus(`Student ID ${parsedId} not in roster`);
            }   
            setTimeout(() => setCardData(''), 1000);
        } else {
            setCardData('');
        }
    };

    // Parse ID from card data (either Track 1 or direct ID)
    const parseStudentId = (data: string): string | null => {
        const digits = data.replace(/\D/g, '');
        if (!digits) {
            console.warn('No digits found in card data');
            return null;   
        }
        
        // Sanitize to 000xxxxxx format
        const sanitizedId = digits.padStart(9, '0');
        return sanitizedId;
    };
    // Save student attendance for the selected class
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