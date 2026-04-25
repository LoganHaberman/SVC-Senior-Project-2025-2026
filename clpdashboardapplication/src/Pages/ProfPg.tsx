import React, { useEffect, useState, FormEvent } from 'react'
import axios from 'axios'
import Papa from 'papaparse'
import { data } from 'react-router-dom';

type AttendanceRecord = {
    studentId: number | string;
    studentName: string;
    count: number;
}

type Class = {
    id: number
    title: string
    code?: string
    semester?: string
    section?: number
    clpDay?: string
    attendance?: AttendanceRecord[]
}

function ProfPg() {
    const API_BASE = '/api'
    const profId = parseInt(localStorage.getItem('userId') || '3', 10)

    const [profName, setProfName] = useState<string>('')
    const [classes, setClasses] = useState<Class[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [showForm, setShowForm] = useState(false)
    const [selectedClassId, setSelectedClassId] = useState<number | null>(null)
    const [rosterFile, setRosterFile] = useState<File | null>(null)
    const [formData, setFormData] = useState({ title: '', code: '', semester: '', clpDay: '' })

    useEffect(() => {
        async function load() {
            setLoading(true)
            try {
                const res = await axios.get(`${API_BASE}/getProfClasses`, {
                    params: { userId: profId }
                })
                if (!res.data) throw new Error('Failed to load professor')
                const data = await res.data
                setProfName(data.name || '')
                setClasses(data.classes || [])
            } catch (err: any) {
                setError(err.message || 'Error loading data')
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [])

    const getNextDate = (weekdayName: string) => {
        const days: Record<string, number> = {
            Monday: 1,
            Tuesday: 2,
            Wednesday: 3,
            Thursday: 4,
            Friday: 5,
        };

        const targetDay = days[weekdayName];
        if (targetDay === undefined) return null;

        const today = new Date();
        const currentDay = today.getDay();

        let daysUntil = (targetDay - currentDay + 7) % 7;
        if (daysUntil === 0) daysUntil = 7; // always NEXT occurrence

        const result = new Date(today);
        result.setDate(today.getDate() + daysUntil);

        return result.toLocaleDateString('en-CA'); // YYYY-MM-DD (local)
    };

    const handleAddClass = async (e: FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!formData.title.trim() || !formData.clpDay) {
            setError('Title and CLP day are required');
            return;
        }

        if (!rosterFile) {
            setError('Roster CSV is required for class creation');
            return;
        }

        try {
            //Start by making class
            const resA = await axios.post(`${API_BASE}/addClass`, {
                profId: profId,
                title: formData.title.trim(),
                code: formData.code.trim() || null,
                semester: formData.semester.trim() || null,
                clpDay: formData.clpDay
            });

            if (!resA.data || !resA.data.success) {
                throw new Error(resA.data?.message || 'Failed to add class');
            }

            const classId = resA.data.class.id;

            //Parse CSV
            const students = await new Promise<any[]>((resolve, reject) => {
                Papa.parse(rosterFile, {
                    header: true,
                    skipEmptyLines: true,
                    complete: (results) => {
                        try {
                            const cleanName = (name: string) =>
                                name.replace(/^(Mr\.|Ms\.|Mrs\.)\s*/i, '').trim();

                            const parsed = results.data
                                .map((row: any) => ({
                                    studentID: Number(row['Student ID']),
                                    studentName: cleanName(
                                        row['Student Name'] || row['Name'] || ''
                                    ),
                                    classID: classId
                                }))
                                .filter((s: any) => s.studentID && s.studentName);

                            resolve(parsed);
                        } catch (err) {
                            reject(err);
                        }
                    },
                    error: reject
                });
            });

            console.log('Parsed students:', students);

            //Sends roster to backend
            console.log('Sending roster to backend:', students);
            await axios.post(`${API_BASE}/admin/roster`, {
                students
            });

            //Updates UI
            setClasses(c => [...c, resA.data.class]);
            setFormData({ title: '', code: '', semester: '', clpDay: '' });
            setRosterFile(null);
            setShowForm(false);

        } catch (err: any) {
            console.error(err);
            setError(err.response?.data?.message || err.message || 'Error adding class');
        }
    };

    const handleDeleteClass = async (classId: number) => {
        if (!window.confirm('Delete this class?')) return;

        setError(null);

        try {
            const res = await axios.delete(`${API_BASE}/classes/${classId}`);

            if (!res.data?.success) {
                throw new Error(res.data?.message || 'Failed to delete class');
            }

            setClasses(c => c.filter(cls => cls.id !== classId));
            setSelectedClassId(null);

        } catch (err: any) {
            setError(err.response?.data?.message || err.message || 'Error deleting class');
        }
    };

    const selectedClass = classes.find(c => c.id === selectedClassId)

    return (
        <div style={{ padding: 20, fontFamily: 'Arial, sans-serif' }}>
            <h1>CLP Dashboard</h1>
            {loading ? <p>Loading...</p> : (
                <>
                    <h2>{profName || 'Professor'}</h2>
                    
                    <div style={{ display: 'flex', gap: 20 }}>
                        <div style={{ flex: 1, maxWidth: 350 }}>
                            <h3>Classes</h3>
                            {classes.length === 0 ? (
                                <p>No classes yet.</p>
                            ) : (
                                <ul style={{ listStyle: 'none', padding: 0 }}>
                                    {classes.map(cls => (
                                        <li 
                                            key={cls.id} 
                                            onClick={() => setSelectedClassId(cls.id)}
                                            style={{
                                                padding: 10,
                                                marginBottom: 8,
                                                border: '1px solid #ddd',
                                                borderRadius: 4,
                                                cursor: 'pointer',
                                                backgroundColor: selectedClassId === cls.id ? '#e7f3ff' : '#fff',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center'
                                            }}
                                        >
                                            <div>
                                                <strong>{cls.title}</strong> {cls.code && `(${cls.code})`}
                                                <br />
                                                <small style={{ color: '#666' }}>{cls.clpDay}</small>
                                            </div>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleDeleteClass(cls.id); }}
                                                style={{ padding: '4px 8px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}
                                            >
                                                Delete
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}

                            {showForm ? (
                                <form onSubmit={handleAddClass} style={{ marginTop: 15, padding: 12, border: '1px solid #ccc', borderRadius: 4 }}>
                                    <div style={{ marginBottom: 10 }}>
                                        <label>Title:</label>
                                        <input type="text" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} style={{ width: '100%', padding: 6 }} />
                                    </div>
                                    <div style={{ marginBottom: 10 }}>
                                        <label>Code:</label>
                                        <input type="text" value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value })} style={{ width: '100%', padding: 6 }} />
                                    </div>
                                    <div style={{ marginBottom: 10 }}>
                                        <label>Semester:</label>
                                        <input type="text" value={formData.semester} onChange={(e) => setFormData({ ...formData, semester: e.target.value })} style={{ width: '100%', padding: 6 }} />
                                    </div>
                                    <div style={{ marginBottom: 10 }}>
                                        <label>CLP Day:</label>
                                        <select value={formData.clpDay} onChange={(e) => setFormData({ ...formData, clpDay: e.target.value })} style={{ width: '100%', padding: 6 }}>
                                            <option value="">Select day</option>
                                            <option value="Monday">Monday</option>
                                            <option value="Tuesday">Tuesday</option>
                                            <option value="Wednesday">Wednesday</option>
                                            <option value="Thursday">Thursday</option>
                                            <option value="Friday">Friday</option>
                                        </select>
                                    </div>
                                    <div style={{ marginBottom: 10 }}>
                                        <label>Roster CSV (required):</label>
                                        <input
                                            type="file"
                                            accept=".csv"
                                            onChange={(e) => setRosterFile(e.target.files?.[0] || null)}
                                            style={{ width: '100%', padding: 6 }}
                                        />
                                        <small style={{ color: '#666' }}>Roster upload is required to create the class and populate student attendance records.</small>
                                    </div>
                                    <button type="submit" style={{ padding: '8px 16px', marginRight: 8, backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Add</button>
                                    <button type="button" onClick={() => setShowForm(false)} style={{ padding: '8px 16px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
                                </form>
                            ) : (
                                <button onClick={() => setShowForm(true)} style={{ marginTop: 12, padding: '8px 16px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', width: '100%' }}>Add Class</button>
                            )}

                            {error && <p style={{ color: '#dc3545', marginTop: 12 }}>{error}</p>}
                        </div>

                        <div style={{ flex: 2 }}>
                            {selectedClass ? (
                                <>
                                    <h3>{selectedClass.title}</h3>
                                    <p><strong>Code:</strong> {selectedClass.code} | <strong>Semester:</strong> {selectedClass.semester}</p>
                                    
                                    <h4>Attendance Summary</h4>
                                    {selectedClass.attendance && selectedClass.attendance.length > 0 ? (
                                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                            <thead>
                                                <tr>
                                                    <th style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid #ddd' }}>Student</th>
                                                    <th style={{ textAlign: 'right', padding: 10, borderBottom: '1px solid #ddd' }}>Sessions attended</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {selectedClass.attendance.map((record) => (
                                                    <tr key={`${record.studentId}-${record.studentName}`}>
                                                        <td style={{ padding: 10, borderBottom: '1px solid #f0f0f0' }}>{record.studentName}</td>
                                                        <td style={{ padding: 10, textAlign: 'right', borderBottom: '1px solid #f0f0f0' }}>{record.count}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    ) : (
                                        <p>No attendance records for this class yet.</p>
                                    )}
                                </>
                            ) : (
                                <p>Select a class to view sessions</p>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}

export default ProfPg