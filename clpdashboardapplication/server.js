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
const normalizeStudentId = (rawId) => {
  const digits = String(rawId ?? '').replace(/\D/g, '');
  if (!digits) return null;
  const withoutLeadingZeros = digits.replace(/^0+/, '');
  if (!withoutLeadingZeros) return null;
  // Keep IDs in a consistent 6-digit form for matching.
  return withoutLeadingZeros.length > 6
    ? withoutLeadingZeros.slice(-6)
    : withoutLeadingZeros;
};

const normalizeSemester = (rawSemester) => {
  const value = String(rawSemester ?? '').trim();
  const match = value.match(/^(\d{4})\s*,\s*(fall|spring)$/i);
  if (!match) return null;
  const year = match[1];
  const termRaw = match[2].toLowerCase();
  const term = termRaw === 'fall' ? 'Fall' : 'Spring';
  return `${year}, ${term}`;
};

const ensureClassAttendance = (cls) => {
  if (!Array.isArray(cls.students)) {
    cls.students = [];
  }
  if (!Array.isArray(cls.attendance)) {
    cls.attendance = [];
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

const parseRosterCsvFile = (filePath) =>
  new Promise((resolve, reject) => {
    const students = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        const normalizedRow = {};
        Object.entries(row).forEach(([key, value]) => {
          const normalizedKey = String(key)
            .replace(/^\uFEFF/, '')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '');
          normalizedRow[normalizedKey] = value;
        });

        let idValue =
          normalizedRow.studentid ??
          normalizedRow.id ??
          normalizedRow.sid ??
          row.id ??
          row['Student ID'] ??
          row['studentID'] ??
          row['studentId'];
        let nameValue =
          normalizedRow.studentname ??
          normalizedRow.name ??
          row.name ??
          row['Student Name'] ??
          row['Name'] ??
          row.studentName;

        // Support headerless CSVs like: "Grant,000123456"
        if (!idValue || !nameValue) {
          const values = Object.values(row);
          if (values.length >= 2) {
            const first = String(values[0] ?? '').trim();
            const second = String(values[1] ?? '').trim();
            if (first && second) {
              const firstLooksLikeId = /^\d+$/.test(first);
              const secondLooksLikeId = /^\d+$/.test(second);

              if (firstLooksLikeId && !secondLooksLikeId) {
                idValue = first;
                nameValue = second;
              } else {
                nameValue = first;
                idValue = second;
              }
            }
          }
        }

        if (idValue && nameValue) {
          const normalizedId = normalizeStudentId(idValue);
          const normalizedName = String(nameValue).trim();
          if (!normalizedId || !normalizedName) return;
          students.push({ id: normalizedId, name: normalizedName });
        }
      })
      .on('end', () => {
        const rosterById = new Map();
        students.forEach((student) => {
          const rosterId = String(student.id).trim();
          const rosterName = String(student.name).trim();
          if (!rosterId || !rosterName) return;
          if (!rosterById.has(rosterId)) {
            rosterById.set(rosterId, { id: rosterId, name: rosterName });
          }
        });
        resolve(Array.from(rosterById.values()));
      })
      .on('error', (err) => reject(err));
  });

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

// Get professor by id (includes classes)
// When a professor's page is loaded this API is used to get classes pertaining to that prof
server.get('/api/professors/:id/classes', (req, res) => {
  const id = Number(req.params.id);
  const db = router.db;
  const prof = findProfessor(db, id);
  if (!prof) return res.status(404).json({ message: 'Professor not found' });

  prof.classes = (prof.classes || []).map((cls) => ensureClassAttendance(cls));
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

  prof.classes = (prof.classes || []).map((cls) => ensureClassAttendance(cls));
  res.json(prof);
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

  const rosterStudents = Array.isArray(cls.students) ? cls.students : [];
  const scannedId = normalizeStudentId(studentId);
  if (!scannedId) {
    return res.status(400).json({ success: false, message: 'Invalid student ID. Expected digits only.' });
  }
  const rosterEntry = rosterStudents.find((student) => String(student.id) === scannedId);

  // Enforce roster-based attendance: only students in uploaded class roster can scan in.
  if (!rosterEntry) {
    return res.status(403).json({ success: false, message: 'Student is not on this class roster.' });
  }

  const attendance = Array.isArray(cls.attendance) ? cls.attendance : [];
  let existing = attendance.find((item) => {
    const itemId = item?.studentId != null ? String(item.studentId) : null;
    return itemId === scannedId;
  });

  if (!existing) {
    existing = {
      studentId: rosterEntry.id,
      studentName: rosterEntry.name,
      count: 0
    };
    attendance.push(existing);
  }

  existing.studentName = rosterEntry.name;
  existing.count = (existing.count || 0) + 1;

  classRef.assign({ attendance }).write();
  res.json({ success: true, studentName: rosterEntry.name, attendance });
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

  let attendance = cls.attendance || [];
  const studentKey = studentId ? String(studentId) : studentName;
  const existing = attendance.find((item) => String(item.studentId) === studentKey || item.studentName === studentName);

  if (existing) {
    if (count <= 0) {
      attendance = attendance.filter((item) => !(String(item.studentId) === studentKey || item.studentName === studentName));
    } else {
      existing.count = count;
    }
  } else if (count > 0) {
    attendance.push({ studentId: studentId ? studentId : studentName, studentName, count });
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

  const { title, code, semester } = req.body;
  if (!title) {
    return res.status(400).json({ success: false, message: 'Title is required.' });
  }
  const normalizedSemester = normalizeSemester(semester);
  if (!normalizedSemester) {
    return res.status(400).json({
      success: false,
      message: 'Semester is required in format: YYYY, Fall or YYYY, Spring.'
    });
  }
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Roster CSV is required for class creation.' });
  }

  const existing = prof.classes || [];
  const maxId = existing.reduce((m, c) => (c.id && c.id > m ? c.id : m), 0);
  const newClassBase = {
    id: maxId + 1,
    title: title.trim(),
    code: code ? String(code).trim() : undefined,
    semester: normalizedSemester
  };

  parseRosterCsvFile(req.file.path)
    .then((rosterStudents) => {
      fs.unlink(req.file.path, (unlinkErr) => {
        if (unlinkErr) console.error('Error deleting temp file:', unlinkErr);
      });
      if (rosterStudents.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Roster CSV has no valid rows. Expected student id and name columns.'
        });
      }

      const attendanceEntries = rosterStudents.map((student) => ({
        studentId: student.id,
        studentName: student.name,
        count: 0
      }));

      const classRecord = {
        ...newClassBase,
        students: rosterStudents,
        attendance: attendanceEntries
      };

      profRef.get('classes').push(classRecord).write();

      res.status(201).json({
        success: true,
        class: classRecord,
        message: `Class created and roster uploaded with ${rosterStudents.length} students.`
      });
    })
    .catch((err) => {
      fs.unlink(req.file.path, (unlinkErr) => {
        if (unlinkErr) console.error('Error deleting temp file:', unlinkErr);
      });
      res.status(400).json({ success: false, message: 'Error parsing roster file', error: err.message });
    });
});

server.post('/api/professors/:id/classes/:classId/roster', upload.single('rosterFile'), (req, res) => {
  const profId = Number(req.params.id);
  const classId = Number(req.params.classId);
  const db = router.db;
  const profRef = db.get('professors').find({ id: profId });
  const prof = profRef.value();
  if (!prof) return res.status(404).json({ success: false, message: 'Professor not found.' });
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Roster CSV is required.' });
  }

  const classRef = profRef.get('classes').find({ id: classId });
  const existingClass = classRef.value();
  if (!existingClass) return res.status(404).json({ success: false, message: 'Class not found.' });

  parseRosterCsvFile(req.file.path)
    .then((rosterStudents) => {
      fs.unlink(req.file.path, (unlinkErr) => {
        if (unlinkErr) console.error('Error deleting temp file:', unlinkErr);
      });
      if (rosterStudents.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Roster CSV has no valid rows. Expected student id and name columns.'
        });
      }

      const existingAttendance = Array.isArray(existingClass.attendance) ? existingClass.attendance : [];
      const existingCountById = new Map(
        existingAttendance.map((record) => [String(record.studentId), Number(record.count) || 0])
      );
      const attendance = rosterStudents.map((student) => ({
        studentId: student.id,
        studentName: student.name,
        count: existingCountById.get(String(student.id)) || 0
      }));

      classRef.assign({ students: rosterStudents, attendance }).write();
      const updatedClass = classRef.value();
      res.json({
        success: true,
        class: updatedClass,
        message: `Roster reuploaded with ${rosterStudents.length} students.`
      });
    })
    .catch((err) => {
      fs.unlink(req.file.path, (unlinkErr) => {
        if (unlinkErr) console.error('Error deleting temp file:', unlinkErr);
      });
      res.status(400).json({ success: false, message: 'Error parsing roster file', error: err.message });
    });
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

server.use('/api', router);

// Using port 3001 to run the server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});