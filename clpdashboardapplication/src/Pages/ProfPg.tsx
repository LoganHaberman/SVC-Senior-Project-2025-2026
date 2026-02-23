import React, { useEffect, useState, FormEvent } from 'react'

// The classes are all typed accordingly
type CLPSession = {
    sessionNumber: number;
    date: string;
    attendees: string[];
}

type Class = {
    id: number
    title: string
    code?: string
    semester?: string
    section?: number
    sessions?: CLPSession[]
}

/**
 * By: Grant Harsch
 * Date: 11/20/2025 -> 11/30/2025
 * Very barebones version of the professor dashboard page.
 */
function ProfPg() {
    const API_BASE = 'http://localhost:3001/api'
    
    // Get the professor id from localStorage (set during login)
    const profId = parseInt(localStorage.getItem('userId') || '3', 10)

    // Variables get typed here
    const [profName, setProfName] = useState<string>('')
    const [classes, setClasses] = useState<Class[]>([])
    const [title, setClassTitle] = useState('')
    const [code, setClassCode] = useState('')
    const [semester, setClassSemester] = useState('')
    const [clpDay, setClpDay] = useState('')
    const [selectedClass, setSelectedClass] = useState<Class | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [showAddForm, setShowAddForm] = useState(false)

    // Tries getting data from mock server. 
    // If data is not retrieved show error message
    useEffect(() => {
        async function load() {
            setLoading(true)
            try {
                const res = await fetch(`${API_BASE}/professors/${profId}`) // Just using 3 for the id for this test
                if (!res.ok) throw new Error('Failed to load professor')
                const data = await res.json()
                setProfName(data.name || '')
                setClasses(data.classes || [])
            } catch (err: any) {
                setError(err.message || 'Error')
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [])

    // This code runs when the user clicks the add button
    // Then the newly made class gets added to the class list on the mock database
    const handleAddButton = async (e: FormEvent) => {
        e.preventDefault()
        setError(null)
        const payload = { 
            title: title.trim(), 
            code: code.trim(), 
            semester: semester.trim(),
            clpDay: clpDay,
            sessions: clpDay ? [{
                sessionNumber: 1,
                date: getNextDateForDay(clpDay),
                attendees: []
            }] : []
        }
        if (!payload.title) {
            setError('Class title is required')
            return
        }
        if (!payload.clpDay) {
            setError('CLP day is required')
            return
        }

        try {
            const res = await fetch(`${API_BASE}/professors/${profId}/classes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })
            if (!res.ok) throw new Error('Failed to add class')
            const newClass = await res.json()
            setClasses((c) => [...c, newClass])
            setClassTitle('')
            setClassCode('')
            setClassSemester('')
            setClpDay('')
            setShowAddForm(false)
        } catch (err: any) {
            setError(err.message || 'Error adding class')
        }
    }

    // This code runs the delete button when clicked
    // Simply routes to the API endpoint and deletes whatever is there
    const handleDeleteButton = async (classId: number) => {
        setError(null)
        
        try {
            const res = await fetch(`${API_BASE}/professors/${profId}/classes/${classId}`, {
                method: 'DELETE',
            })

            if (!res.ok) {
                console.error("DELETE failed:", res.status, await res.text())
                throw new Error('Failed to delete class')
            }
            setClasses((c) => c.filter((Class) => Class.id !== classId))
        } catch (err: any) {
            setError(err.message || 'Error deleting class')
        }
    }

    const handleCancelAdd = () => {
        setShowAddForm(false)
        setClassTitle('')
        setClassCode('')
        setClassSemester('')
        setClpDay('')
        setError(null)
    }

    // Calculate the next occurrence of the chosen day
    const getNextDateForDay = (dayName: string): string => {
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const dayIndex = days.indexOf(dayName.toLowerCase());
        if (dayIndex === -1) return '';
        
        const today = new Date();
        const currentDay = today.getDay(); // 0 = Sunday
        let daysToAdd = dayIndex - currentDay;
        if (daysToAdd <= 0) {
            daysToAdd += 7;
        }
        const nextDate = new Date(today);
        nextDate.setDate(today.getDate() + daysToAdd);
        return nextDate.toISOString().split('T')[0]; // YYYY-MM-DD
    }

    // What is being seen by the user
    return (
        <div>
            <h1>CLP Dashboard</h1>
            {loading ? (
                <p>Loading...</p>
            ) : (
                <>
                    <h2>{profName || 'Professor'}</h2>

                    <section style={{ display: 'flex', gap: 24 }}>
                        <h3>Classes</h3>
                        <div style={{ flex: 1 }}>
                            {classes.length === 0 ? (
                                <p>No classes yet.</p>
                            ) : (
                                <ul style={{ listStyle: 'none', padding: 0 }}>
                                    {classes.map((c) => (
                                        <li key={c.id} style={{ padding: '6px 8px', cursor: 'pointer', borderBottom: '1px solid #eee' }} onClick={() => setSelectedClass(c)} tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedClass(c) }}>
                                            <strong>{c.title}</strong> {c.code ? `(${c.code})` : ''} {c.semester ? `— ${c.semester}` : ''}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        {showAddForm ? (
                            <form onSubmit={handleAddButton} style={{ marginTop: 12 }}>
                                <div>
                                    <label>
                                        Title: <input value={title} onChange={(e) => setClassTitle(e.target.value)} />
                                    </label>
                                </div>
                                <div>
                                    <label>
                                        Code: <input value={code} onChange={(e) => setClassCode(e.target.value)} />
                                    </label>
                                </div>
                                <div>
                                    <label>
                                        Semester: <input value={semester} onChange={(e) => setClassSemester(e.target.value)} placeholder="e.g. Fall 2025" />
                                    </label>
                                </div>
                                <div>
                                    <label>
                                        CLP Day: 
                                        <select value={clpDay} onChange={(e) => setClpDay(e.target.value)}>
                                            <option value="">Select day</option>
                                            <option value="Monday">Monday</option>
                                            <option value="Tuesday">Tuesday</option>
                                            <option value="Wednesday">Wednesday</option>
                                            <option value="Thursday">Thursday</option>
                                            <option value="Friday">Friday</option>
                                            <option value="Saturday">Saturday</option>
                                            <option value="Sunday">Sunday</option>
                                        </select>
                                    </label>
                                </div>
                                <div style={{ marginTop: 8 }}>
                                    <button type="submit">Add class</button>
                                    <button type="button" onClick={handleCancelAdd} style={{ marginLeft: 8 }}>Cancel</button>
                                </div>
                            </form>
                        ) : (
                            <button onClick={() => setShowAddForm(true)} style={{ marginTop: 12 }}>Add Class</button>
                        )}

                        {error && <p style={{ color: 'red' }}>{error}</p>}
                    
                        <aside aria-live="polite" style={{ width: 360, borderLeft: '1px solid #ddd', paddingLeft: 16 }}>
                            {selectedClass ? (
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <h4 style={{ margin: 0 }}>{selectedClass.title}</h4>
                                        <button onClick={() => setSelectedClass(null)} aria-label="Close panel">Close</button>
                                    </div>
                                    <p>{selectedClass.code ? `Code: ${selectedClass.code}` : ''}</p>
                                    <p>{selectedClass.semester ? `Semester: ${selectedClass.semester}` : ''}</p>
                                    <div style={{ marginTop: 12 }}>
                                        <h5>CLP Sessions</h5>
                                        {selectedClass.sessions && selectedClass.sessions.length > 0 ? (
                                            <div>
                                                {selectedClass.sessions.map(session => (
                                                    <div key={session.sessionNumber} style={{ marginBottom: 16, padding: 8, border: '1px solid #eee', borderRadius: 4 }}>
                                                        <h6>Session {session.sessionNumber} - {session.date}</h6>
                                                        <p><strong>Attendees:</strong></p>
                                                        {session.attendees && session.attendees.length > 0 ? (
                                                            <ul style={{ paddingLeft: 20 }}>
                                                                {session.attendees.map((attendee, index) => (
                                                                    <li key={index}>{attendee}</li>
                                                                ))}
                                                            </ul>
                                                        ) : (
                                                            <p>No attendees yet.</p>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p>No CLP sessions for this class.</p>
                                        )}
                                    </div>
                                    <button onClick={() => handleDeleteButton(selectedClass.id)} style={{ marginTop: 12, color: 'white', backgroundColor: 'red', border: 'none', padding: '8px 12px', cursor: 'pointer' }}>Delete Class</button>
                                </div>
                            ) : (
                                <div>
                                    <h4 style={{ marginTop: 0 }}>Select a class</h4>
                                    <p>Click a class to view placeholder data here.</p>
                                </div>
                            )}
                        </aside>

                    </section>
                </>
            )}
        </div>
    )
}
export default ProfPg