import React, { useCallback, useEffect, useState, FormEvent } from 'react'
import axios from 'axios'
import Papa from 'papaparse';
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
    students?: { id: string; name: string }[]
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
    const [reuploadFile, setReuploadFile] = useState<File | null>(null)
    const [reuploading, setReuploading] = useState(false)
    const [formData, setFormData] = useState({ title: '', code: '', semester: '' })
    const isValidSemesterFormat = (value: string) => /^\d{4},\s*(Fall|Spring)$/i.test(value.trim())

    const loadProfessorClasses = useCallback(async () => {
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
    }, [API_BASE, profId])

    useEffect(() => {
        loadProfessorClasses()
    }, [loadProfessorClasses])

    const handleAddClass = async (e: FormEvent) => {
        e.preventDefault();
        setError(null);

        console.log('CHECK 1')

        if (!formData.title.trim()) {
            setError('Title is required');
            return;
        }

        console.log('CHECK 2')

        if (!rosterFile) {
            setError('Roster CSV is required for class creation');
            return;
        }

        console.log('CHECK 3')

        try {
            //Start by making class
            console.log ('Creating class with data:', profId);
            const resA = await axios.post(`${API_BASE}/addClass`, {
                profId: profId,
                title: formData.title.trim(),
                code: formData.code.trim() || null,
                semester: formData.semester.trim() || null,
            });

            console.log('Class creation response:', resA.data);

            if (!resA.data) {
                throw new Error(resA.data?.message || 'Failed to add class');
            }

            console.log('Class created with ID:', resA.data.id);

            const classId = resA.data.id;

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
            setFormData({ title: '', code: '', semester: ''});
            setRosterFile(null);
            setShowForm(false);

            await loadProfessorClasses();

        } catch (err: any) {
            console.error(err);
            setError(err.response?.data?.message || err.message || 'Error adding class');
        }
    };

    const handleDeleteClass = async (classId: number) => {
        if (!window.confirm('Delete this class?')) return
        setError(null)
        
        try {
            const res = await axios.delete(`${API_BASE}/professors/${profId}/classes/${classId}`)
            if (!res.data || !res.data.success) throw new Error('Failed to delete class')
            setClasses(c => c.filter(cls => cls.id !== classId))
            setSelectedClassId(null)
        } catch (err: any) {
            setError(err.response?.data?.message || err.message || 'Error deleting class')
        }
    }

    const handleReuploadRoster = async () => {
        if (!selectedClass) {
            setError('Select a class first');
            return;
        }

        if (!reuploadFile) {
            setError('Choose a roster CSV to reupload');
            return;
        }

        setError(null);
        setReuploading(true);

        try {
            Papa.parse(reuploadFile, {
                header: true,
                skipEmptyLines: true,
                complete: async (results: any) => {
                const parsed = results.data;

                const students = parsed
                    .map((row: any) => {
                        const rawId = row["Student ID"];
                        const rawName = row["Student Name"];

                        if (!rawId || !rawName) return null;

                    return {
                        studentID: String(rawId).trim(),
                        studentName: String(rawName)
                            .replace(/^Mr\.?\s*/i, '') // remove "Mr."
                            .replace(/^Ms\.?\s*/i, '') // remove "Ms."
                            .replace(/^Mrs\.?\s*/i, '') // optional
                            .trim()
                    };
                })
                .filter(Boolean);

            if (students.length === 0) {
                throw new Error("CSV is empty or invalid");
            }

            const res = await axios.post(
                `${API_BASE}/professors/${profId}/classes/${selectedClass.id}/roster`,
                { students }
            );

            if (!res.data?.success) {
                throw new Error(res.data?.message || 'Failed to reupload roster');
            }

            await loadProfessorClasses();
            setReuploadFile(null);
        },
        error: () => {
            setError("Error parsing CSV");
        }
    });

        } catch (err: any) {
            setError(err.response?.data?.message || err.message || 'Error reuploading roster');
        } finally {
            setReuploading(false);
        }
    };

    console.log('Rendering ProfPg with classes:', classes)
    const selectedClass = classes.find(c => c.id === selectedClassId)

    return (
        <div style={{ fontFamily: 'Arial, sans-serif' }}>
            <div style={{ width: '100%', marginBottom: 20 }}>
                <div style={{ backgroundColor: '#0b5d3b', color: 'white', padding: '12px 20px', fontWeight: 700 }}>
                    <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Collaborative Learning Program</span>
                        <span style={{ fontWeight: 600, opacity: 0.95 }}>Professor Dashboard</span>
                    </div>
                </div>
                <div style={{ backgroundColor: '#c9a227', height: 8 }} />
            </div>
            <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 20px 20px 20px' }}>
            {loading ? <p>Loading...</p> : (
                <>
                    <h2>{profName || 'Professor'}</h2>
                    
                    <div style={{ display: 'flex', gap: 20, justifyContent: 'center', alignItems: 'flex-start' }}>
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
                                        <input
                                            type="text"
                                            value={formData.title}
                                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                            style={{ width: '100%', padding: 6, boxSizing: 'border-box' }}
                                        />
                                    </div>
                                    <div style={{ marginBottom: 10 }}>
                                        <label>Code:</label>
                                        <input
                                            type="text"
                                            value={formData.code}
                                            onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                                            style={{ width: '100%', padding: 6, boxSizing: 'border-box' }}
                                        />
                                    </div>
                                    <div style={{ marginBottom: 10 }}>
                                        <label>Semester:</label>
                                        <input
                                            type="text"
                                            value={formData.semester}
                                            onChange={(e) => setFormData({ ...formData, semester: e.target.value })}
                                            placeholder="e.g. 2026, Fall"
                                            style={{ width: '100%', padding: 6, boxSizing: 'border-box' }}
                                        />
                                        <small style={{ color: '#666' }}>Format: YYYY, Fall or YYYY, Spring</small>
                                    </div>
                                    <div style={{ marginBottom: 10 }}>
                                        <label>Roster CSV (required):</label>
                                        <input
                                            type="file"
                                            accept=".csv"
                                            onChange={(e) => setRosterFile(e.target.files?.[0] || null)}
                                            style={{ width: '100%', padding: 6, boxSizing: 'border-box' }}
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
                                    <div style={{ marginBottom: 16, padding: 12, backgroundColor: '#f8f9fa', border: '1px solid #ddd', borderRadius: 4 }}>
                                        <h4 style={{ marginTop: 0 }}>Reupload Class Roster</h4>
                                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                            <input
                                                type="file"
                                                accept=".csv"
                                                onChange={(e) => setReuploadFile(e.target.files?.[0] || null)}
                                                style={{ padding: 6 }}
                                            />
                                            {reuploadFile && (
                                                <button
                                                    onClick={handleReuploadRoster}
                                                    disabled={reuploading}
                                                    style={{
                                                        padding: '8px 12px',
                                                        backgroundColor: reuploading ? '#6c757d' : '#007bff',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: 4,
                                                        cursor: reuploading ? 'not-allowed' : 'pointer'
                                                    }}
                                                >
                                                    {reuploading ? 'Uploading...' : 'Reupload Roster'}
                                                </button>
                                            )}
                                        </div>
                                        <small style={{ color: '#666' }}>
                                            Reuploading replaces this class roster and keeps attendance counts for matching student IDs.
                                        </small>
                                    </div>
                                    
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
                                <p>Select a class to view attendance</p>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
        </div>
    )
}

export default ProfPg