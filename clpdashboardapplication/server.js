// server.js, a bunch of APIs that each do something different
// By: Grant Harsch
// Date: 11/20/2025 -> 12/01/2025

// Bunch of setup for json server that gets data from db.json from the router
const jsonServer = require('json-server');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const csv = require('csv-parser');

const server = jsonServer.create();
const router = jsonServer.router(path.join(__dirname, 'db.json'));
const middlewares = jsonServer.defaults();

server.use(middlewares);
server.use(jsonServer.bodyParser);

// Setup multer for file uploads
const upload = multer({ dest: 'uploads/' });

// Helpers
const sanitizeStudentId = (id) => {
  // Extract only digits from the ID
  const digitsOnly = String(id).replace(/\D/g, '');
  // Pad with leading zeros to make it 9 digits total (000xxxxxx format)
  return digitsOnly.padStart(9, '0');
};

const getNextId = (collectionName) => {
  const items = router.db.get(collectionName).value() || [];
  return items.reduce((maxId, item) => {
    const id = item && typeof item.id === 'number' ? item.id : 0;
    return id > maxId ? id : maxId;
  }, 0) + 1;
};

const normalizeClassAttendance = (db, cls) => {
  if (!cls.attendance) {
    const attendanceMap = new Map();
    (cls.sessions || []).forEach((session) => {
      (session.attendees || []).forEach((name) => {
        const studentName = String(name).trim();
        if (!studentName) return;
        const existing = attendanceMap.get(studentName) || { studentId: null, studentName, count: 0 };
        existing.count += 1;
        attendanceMap.set(studentName, existing);
      });
    });
    cls.attendance = Array.from(attendanceMap.values());
  }
  return cls;
};

const findProfessor = (db, professorId) => {
  let prof = db.get('professors').find({ id: Number(professorId) }).value();
  if (!prof) {
    prof = db.get('professors').find({ userId: Number(professorId) }).value();
  }
  return prof;
};

const findStudentById = (db, studentId) => {
  const sanitizedId = sanitizeStudentId(studentId);
  return db.get('students').find((s) => sanitizeStudentId(s.id) === sanitizedId).value();
};

// Login endpoint
// user and pass expected and success role and token are returned
server.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = router.db.get('users').find({ username, password }).value();
  if (user) {
    res.json({ success: true, role: user.role, userId: user.id, token: 'fake-jwt' });
  } else {
    res.status(401).json({ success: false, message: 'Invalid credentials' });
  }
});

// Signup request endpoint
server.post('/api/signup', (req, res) => {
  const { username, password, fullName } = req.body;
  if (!username || !password || !fullName) {
    return res.status(400).json({ success: false, message: 'Username, password, and full name are required.' });
  }

  const existingUser = router.db.get('users').find({ username }).value();
  const existingRequest = router.db.get('signupRequests').find({ username }).value();
  if (existingUser || existingRequest) {
    return res.status(409).json({ success: false, message: 'A user or signup request with that username already exists.' });
  }

  const request = {
    id: getNextId('signupRequests'),
    username,
    password,
    fullName,
    status: 'pending',
    submittedAt: new Date().toISOString()
  };

  router.db.get('signupRequests').push(request).write();
  res.status(201).json({ success: true, request, message: 'Signup request submitted. Admin will assign your role.' });
});

server.get('/api/signupRequests', (req, res) => {
  const requests = router.db.get('signupRequests').value() || [];
  res.json(requests);
});

server.post('/api/assignRole', (req, res) => {
  const { requestId, role } = req.body;
  const validRoles = ['student', 'professor', 'admin'];
  if (!requestId || !role || !validRoles.includes(role)) {
    return res.status(400).json({ success: false, message: 'Valid requestId and role are required.' });
  }

  const signupRequest = router.db.get('signupRequests').find({ id: requestId }).value();
  if (!signupRequest) {
    return res.status(404).json({ success: false, message: 'Signup request not found.' });
  }

  const existingUser = router.db.get('users').find({ username: signupRequest.username }).value();
  if (existingUser) {
    return res.status(409).json({ success: false, message: 'A user with that username already exists.' });
  }

  const userId = getNextId('users');
  const newUser = {
    id: userId,
    username: signupRequest.username,
    password: signupRequest.password,
    role
  };

  router.db.get('users').push(newUser).write();
  router.db.get('signupRequests').remove({ id: requestId }).write();

  if (role === 'professor') {
    const professorId = getNextId('professors');
    router.db.get('professors').push({
      id: professorId,
      name: signupRequest.fullName,
      userId,
      classes: []
    }).write();
  }

  res.json({ success: true, user: newUser, message: `Assigned role ${role} to ${signupRequest.username}` });
});

// Get professor by id (includes classes)
// When a professor's page is loaded this API is used to get classes pertaining to that prof
server.get('/api/professors/:id/classes', (req, res) => {
  const id = Number(req.params.id);
  const db = router.db;
  const prof = findProfessor(db, id);
  if (!prof) return res.status(404).json({ message: 'Professor not found' });

  prof.classes = (prof.classes || []).map((cls) => normalizeClassAttendance(db, cls));
  res.json(prof);
});

server.post('/api/professors/list', (req, res) => {
  const db = router.db;
  const profs = db.get('professors').value() || [];
  res.json(profs.map((prof) => ({ id: prof.id, name: prof.name })));
});

server.get('/api/professors/list', (req, res) => {
  const db = router.db;
  const profs = db.get('professors').value() || [];
  res.json(profs.map((prof) => ({ id: prof.id, name: prof.name })));
});

server.get('/api/getProfClasses', (req, res) => {
  const db = router.db;
  const professorId = Number(req.query.userId || req.query.professorId);
  const prof = findProfessor(db, professorId);
  if (!prof) return res.status(404).json({ message: 'Professor not found' });

  prof.classes = (prof.classes || []).map((cls) => normalizeClassAttendance(db, cls));
  res.json(prof);
});

server.get('/api/allStudents', (req, res) => {
  const students = router.db.get('students').value() || [];
  res.json(students.map((s) => ({ studentID: s.id, name: s.name })));
});

server.post('/api/attendance', (req, res) => {
  const { studentId, classId, profId } = req.body;
  if (!studentId || !classId || !profId) {
    return res.status(400).json({ success: false, message: 'studentId, classId, and profId are required.' });
  }

  const db = router.db;
  const prof = findProfessor(db, profId);
  if (!prof) return res.status(404).json({ success: false, message: 'Professor not found.' });

  const classRef = db.get('professors').find({ id: prof.id }).get('classes').find({ id: Number(classId) });
  const cls = classRef.value();
  if (!cls) return res.status(404).json({ success: false, message: 'Class not found.' });

  const student = findStudentById(db, studentId);
  const studentName = student?.name || String(studentId);
  const sanitizedStudentId = student ? sanitizeStudentId(student.id) : sanitizeStudentId(studentId);

  const attendance = cls.attendance || [];
  const existing = attendance.find((item) => String(item.studentId) === sanitizedStudentId || item.studentName === studentName);
  if (existing) {
    existing.count = (existing.count || 0) + 1;
    // Update studentId in case it was null before (migrate old data)
    existing.studentId = sanitizedStudentId;
  } else {
    attendance.push({ studentId: sanitizedStudentId, studentName, count: 1 });
  }

  classRef.assign({ attendance }).write();
  res.json({ success: true, studentName, attendance });
});

server.post('/api/admin/classAttendance', (req, res) => {
  const { profId, classId, studentId, studentName, count } = req.body;
  if (!profId || !classId || !studentName || typeof count !== 'number') {
    return res.status(400).json({ success: false, message: 'profId, classId, studentName, and count are required.' });
  }

  const db = router.db;
  const prof = findProfessor(db, profId);
  if (!prof) return res.status(404).json({ success: false, message: 'Professor not found.' });

  const classRef = db.get('professors').find({ id: prof.id }).get('classes').find({ id: Number(classId) });
  const cls = classRef.value();
  if (!cls) return res.status(404).json({ success: false, message: 'Class not found.' });

  const sanitizedStudentId = studentId ? sanitizeStudentId(studentId) : studentId;
  let attendance = cls.attendance || [];
  const existing = attendance.find((item) => String(item.studentId) === sanitizedStudentId || item.studentName === studentName);

  if (existing) {
    if (count <= 0) {
      attendance = attendance.filter((item) => !(String(item.studentId) === sanitizedStudentId || item.studentName === studentName));
    } else {
      existing.count = count;
      // Update studentId in case it was null before (migrate old data)
      if (sanitizedStudentId) {
        existing.studentId = sanitizedStudentId;
      }
    }
  } else if (count > 0) {
    attendance.push({ studentId: sanitizedStudentId || studentName, studentName, count });
  }

  classRef.assign({ attendance }).write();
  res.json({ success: true, attendance });
});

server.post('/api/professors/:id/classes', upload.single('rosterFile'), (req, res) => {
  const id = Number(req.params.id);
  const db = router.db;
  const profRef = db.get('professors').find({ id });
  const prof = profRef.value();
  if (!prof) return res.status(404).json({ message: 'Professor not found' });

  const { title, code, semester, clpDay } = req.body;
  if (!title || !clpDay) {
    return res.status(400).json({ success: false, message: 'Title and CLP day are required.' });
  }

  const existing = prof.classes || [];
  const maxId = existing.reduce((m, c) => (c.id && c.id > m ? c.id : m), 0);
  const newClass = {
    id: maxId + 1,
    title: title.trim(),
    code: code ? String(code).trim() : undefined,
    semester: semester ? String(semester).trim() : undefined,
    clpDay: clpDay.trim(),
    sessions: [],
    attendance: []
  };

  profRef.get('classes').push(newClass).write();

  if (req.file) {
    const students = [];
    const fileStream = fs.createReadStream(req.file.path);

    fileStream
      .pipe(csv())
      .on('data', (row) => {
        const idValue = row.id || row['Student ID'] || row['studentID'] || row['studentId'];
        const nameValue = row.name || row['Student Name'] || row['Name'] || row.studentName;
        if (idValue && nameValue) {
          const sanitizedId = sanitizeStudentId(idValue);
          students.push({ id: sanitizedId, name: String(nameValue).trim() });
        }
      })
      .on('end', () => {
        fs.unlink(req.file.path, (unlinkErr) => {
          if (unlinkErr) console.error('Error deleting temp file:', unlinkErr);
        });

        const dbStudents = router.db.get('students');
        const existingStudents = dbStudents.value() || [];
        const mergedStudents = [...existingStudents];

        students.forEach((student) => {
          const found = existingStudents.find((existing) => String(existing.id) === String(student.id));
          if (!found) {
            mergedStudents.push(student);
          }
        });

        router.db.set('students', mergedStudents).write();

        const attendanceEntries = students.map((student) => ({
          studentId: student.id,
          studentName: student.name,
          count: 0
        }));

        db.get('professors').find({ id }).get('classes').find({ id: newClass.id }).assign({ attendance: attendanceEntries }).write();

        res.status(201).json({ success: true, class: newClass, message: `Class created and roster uploaded with ${students.length} students.` });
      })
      .on('error', (err) => {
        fs.unlink(req.file.path, (unlinkErr) => {
          if (unlinkErr) console.error('Error deleting temp file:', unlinkErr);
        });
        res.status(400).json({ success: false, message: 'Error parsing roster file', error: err.message });
      });

    return;
  }

  res.status(201).json({ success: true, class: newClass, message: 'Class created successfully.' });
});

// Delete a professor's class from a professor's classes list
server.delete('/api/professors/:id/classes/:classId', (req, res) => {
  const id = Number(req.params.id);
  const classId = Number(req.params.classId);
  const db = router.db;
  const prof = db.get('professors').find({ id }).value();
  if (!prof) return res.status(404).json({ message: 'Professor not found' });
  
  const found = prof.classes.find(c => c.id === classId);
  if (!found) return res.status(404).json({ message: 'Class not found' });

  db.get('professors').find({ id }).get('classes').remove({ id: classId }).write();
  res.json({ success: true, id: classId });
});

server.post('/api/professors/:profId/classes/:classId/sessions/:sessionNumber/attend', (req, res) => {
  const profId = Number(req.params.profId);
  const classId = Number(req.params.classId);
  const sessionNumber = Number(req.params.sessionNumber);
  const { studentName } = req.body;
  const db = router.db;
  
  const prof = db.get('professors').find({ id: profId }).value();
  if (!prof) return res.status(404).json({ message: 'Professor not found' });
  
  const cls = prof.classes.find(c => c.id === classId);
  if (!cls) return res.status(404).json({ message: 'Class not found' });
  
  const session = cls.sessions.find(s => s.sessionNumber === sessionNumber);
  if (!session) return res.status(404).json({ message: 'Session not found' });
  
  if (!studentName) return res.status(400).json({ message: 'Student name required' });

  if (!session.attendees.includes(studentName)) {
    db.get('professors').find({ id: profId }).get('classes').find({ id: classId })
      .get('sessions').find({ sessionNumber }).get('attendees').push(studentName).write();
  }
  
  res.json({ success: true, studentName });
});

server.delete('/api/professors/:profId/classes/:classId/sessions/:sessionNumber/attend/:studentName', (req, res) => {
  const profId = Number(req.params.profId);
  const classId = Number(req.params.classId);
  const sessionNumber = Number(req.params.sessionNumber);
  const studentName = decodeURIComponent(req.params.studentName);
  const db = router.db;
  
  const prof = db.get('professors').find({ id: profId }).value();
  if (!prof) return res.status(404).json({ message: 'Professor not found' });
  
  const cls = prof.classes.find(c => c.id === classId);
  if (!cls) return res.status(404).json({ message: 'Class not found' });
  
  const session = cls.sessions.find(s => s.sessionNumber === sessionNumber);
  if (!session) return res.status(404).json({ message: 'Session not found' });

  const updatedAttendees = session.attendees.filter(name => name !== studentName);

  db.get('professors')
    .find({ id: profId })
    .get('classes')
    .find({ id: classId })
    .get('sessions')
    .find({ sessionNumber })
    .assign({ attendees: updatedAttendees })
    .write();
  
  res.json({ success: true, studentName });
});

// Add students to an existing class roster (without overwriting)
server.post('/api/professors/:profId/classes/:classId/roster', upload.single('rosterFile'), (req, res) => {
  const profId = Number(req.params.profId);
  const classId = Number(req.params.classId);
  
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file provided' });
  }

  const db = router.db;
  const prof = db.get('professors').find({ id: profId }).value();
  if (!prof) {
    fs.unlink(req.file.path, (err) => { if (err) console.error('Error deleting temp file:', err); });
    return res.status(404).json({ success: false, message: 'Professor not found' });
  }

  const cls = prof.classes.find(c => c.id === classId);
  if (!cls) {
    fs.unlink(req.file.path, (err) => { if (err) console.error('Error deleting temp file:', err); });
    return res.status(404).json({ success: false, message: 'Class not found' });
  }

  const newStudents = [];
  const fileStream = fs.createReadStream(req.file.path);

  fileStream
    .pipe(csv())
    .on('data', (row) => {
      const idValue = row.id || row['Student ID'] || row['studentID'] || row['studentId'];
      const nameValue = row.name || row['Student Name'] || row['Name'] || row.studentName;
      if (idValue && nameValue) {
        const sanitizedId = sanitizeStudentId(idValue);
        newStudents.push({ id: sanitizedId, name: String(nameValue).trim() });
      }
    })
    .on('end', () => {
      fs.unlink(req.file.path, (unlinkErr) => {
        if (unlinkErr) console.error('Error deleting temp file:', unlinkErr);
      });

      // Merge new students into global student list
      const dbStudents = db.get('students');
      const existingStudents = dbStudents.value() || [];
      const mergedStudents = [...existingStudents];

      newStudents.forEach((student) => {
        const found = existingStudents.find((existing) => String(existing.id) === String(student.id));
        if (!found) {
          mergedStudents.push(student);
        }
      });

      db.set('students', mergedStudents).write();

      // Add new students to class attendance without overwriting existing entries
      const currentAttendance = cls.attendance || [];
      let addedCount = 0;

      newStudents.forEach((student) => {
        const found = currentAttendance.find((item) => String(item.studentId) === String(student.id));
        if (!found) {
          currentAttendance.push({
            studentId: student.id,
            studentName: student.name,
            count: 0
          });
          addedCount++;
        }
      });

      db.get('professors').find({ id: profId }).get('classes').find({ id: classId }).assign({ attendance: currentAttendance }).write();

      res.status(200).json({ 
        success: true, 
        message: `Roster updated. Added ${addedCount} new students to class. ${newStudents.length - addedCount} students were already in the roster.`,
        addedCount,
        skippedCount: newStudents.length - addedCount,
        attendance: currentAttendance
      });
    })
    .on('error', (err) => {
      fs.unlink(req.file.path, (unlinkErr) => {
        if (unlinkErr) console.error('Error deleting temp file:', unlinkErr);
      });
      res.status(400).json({ success: false, message: 'Error parsing roster file', error: err.message });
    });
});

// Get all students from database
server.get('/api/students', (req, res) => {
  const db = router.db;
  const students = db.get('students').value() || [];
  res.json(students);
});

server.use('/api', router);

// Using port 3001 to run the server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});