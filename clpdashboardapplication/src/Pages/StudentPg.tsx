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

interface Class {
  id: number;
  title: string;
  code: string;
  section: number;
  semester: string;
  professorName: string;
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
    const [loadingClasses, setLoadingClasses] = useState(true);

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

    // Connect to MSR reader
    const connectReader = async () => {
        if (!selectedClassId) {
            setStatus('Please select a class first');
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
                        setStatus('Card scanned successfully');
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
                        <select 
                            value={selectedClassId || ''} 
                            onChange={(e) => setSelectedClassId(e.target.value ? parseInt(e.target.value) : null)}
                        >
                            <option value="">-- Choose a class --</option>
                            {classes.map(cls => (
                                <option key={cls.id} value={cls.id}>
                                    {cls.professorName}-{cls.code}-{cls.section}
                                </option>
                            ))}
                        </select>
                    </>
                )}
                {selectedClass && <p>Selected: <strong>{selectedClass.title}</strong></p>}
            </div>

            {/* Card Scanning */}
            <div>
                <h2>Card Scanner</h2>
                <p>Status: {status}</p>
                {!isConnected ? (
                    <button onClick={connectReader} disabled={!selectedClassId}>Connect MSR Reader</button>
                ) : (
                    <button onClick={disconnectReader}>Disconnect</button>
                )}
                {studentName && <p>Welcome, {studentName}!</p>}
            </div>
        </div>
    )
}

export default StudentPg