// server.js
const jsonServer = require('json-server');
const path = require('path');

const server = jsonServer.create();
const router = jsonServer.router(path.join(__dirname, 'db.json')); // path to db.json in project root
const middlewares = jsonServer.defaults();

server.use(middlewares);
server.use(jsonServer.bodyParser);

// Login endpoint
server.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const db = router.db; // lowdb instance
  const user = db.get('users').find({ username, password }).value();

  if (user) {
    // Role and user id are returned as well as a token that may be used for further authorization or something interesting later
    res.json({ success: true, role: user.role, userId: user.id, token: 'fake-jwt-token' });
  } else {
    res.status(401).json({ success: false, message: 'Invalid credentials' });
  }
});

// Get professor by id (includes classes) - with automatic session generation
server.get('/api/professors/:id', (req, res) => {
  const id = Number(req.params.id);
  const db = router.db;
  const prof = db.get('professors').find({ id }).value();
  if (!prof) return res.status(404).json({ message: 'Professor not found' });

  // Generate next CLP sessions if needed
  const updatedClasses = prof.classes.map(cls => {
    if (cls.clpDay && cls.sessions && cls.sessions.length > 0) {
      const latestSession = cls.sessions.reduce((latest, sess) => 
        new Date(sess.date) > new Date(latest.date) ? sess : latest
      );
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const latestDate = new Date(latestSession.date);
      if (latestDate < today) {
        // Need to generate next session
        const nextDate = getNextDateForDay(cls.clpDay, latestDate);
        const newSessionNumber = latestSession.sessionNumber + 1;
        cls.sessions.push({
          sessionNumber: newSessionNumber,
          date: nextDate,
          attendees: []
        });
        // Update the database
        db.get('professors').find({ id }).get('classes').find({ id: cls.id }).get('sessions').push({
          sessionNumber: newSessionNumber,
          date: nextDate,
          attendees: []
        }).write();
      }
    }
    return cls;
  });

  res.json({ ...prof, classes: updatedClasses });
});

// Helper function to get next date for a given day
function getNextDateForDay(dayName, fromDate = new Date()) {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayIndex = days.indexOf(dayName.toLowerCase());
  if (dayIndex === -1) return null;
  
  const currentDay = fromDate.getDay();
  let daysToAdd = dayIndex - currentDay;
  if (daysToAdd <= 0) {
    daysToAdd += 7;
  }
  const nextDate = new Date(fromDate);
  nextDate.setDate(fromDate.getDate() + daysToAdd);
  return nextDate.toISOString().split('T')[0]; // YYYY-MM-DD
}
server.get('/api/professors/:id/classes', (req, res) => {
  const id = Number(req.params.id);
  const db = router.db;
  const prof = db.get('professors').find({ id }).value();
  if (!prof) return res.status(404).json({ message: 'Professor not found' });
  res.json(prof.classes || []);
});

// Add a class to a professor's classes list
server.post('/api/professors/:id/classes', (req, res) => {
  const id = Number(req.params.id);
  const db = router.db;
  const profRef = db.get('professors').find({ id });
  const prof = profRef.value();
  if (!prof) return res.status(404).json({ message: 'Professor not found' });

  const newClass = req.body || {};
  // Assign a new id for the class
  const existing = prof.classes || [];
  const maxId = existing.reduce((m, c) => (c.id && c.id > m ? c.id : m), 0);
  newClass.id = maxId + 1;

  // Ensure classes array exists, push and write
  profRef.get('classes').push(newClass).write();

  res.status(201).json(newClass);
});

// Delete a class from a professor's classes list
server.delete('/api/professors/:id/classes/:classId', (req, res) => {
  const id = Number(req.params.id);
  const classId = Number(req.params.classId);
  const db = router.db;
  const profRef = db.get('professors').find({ id });
  const prof = profRef.value();
  if (!prof) return res.status(404).json({ message: 'Professor not found' });

  const existing = prof.classes || [];
  const found = existing.find((c) => c.id === classId);
  if (!found) return res.status(404).json({ message: 'Class not found' });

  // Remove the class by id
  profRef.get('classes').remove({ id: classId }).write();

  res.json({ success: true, id: classId });
});

// Add a session to a class
server.post('/api/professors/:profId/classes/:classId/sessions', (req, res) => {
  const profId = Number(req.params.profId);
  const classId = Number(req.params.classId);
  const { sessionNumber, date, attendees } = req.body;
  const db = router.db;

  const profRef = db.get('professors').find({ id: profId });
  const prof = profRef.value();
  if (!prof) return res.status(404).json({ message: 'Professor not found' });

  const classRef = profRef.get('classes').find({ id: classId });
  const cls = classRef.value();
  if (!cls) return res.status(404).json({ message: 'Class not found' });

  // Ensure sessions array exists
  if (!cls.sessions) {
    classRef.set('sessions', []).write();
  }

  // Check if sessionNumber already exists
  const existingSession = classRef.get('sessions').find({ sessionNumber }).value();
  if (existingSession) return res.status(400).json({ message: 'Session number already exists' });

  // Add the session
  classRef.get('sessions').push({ sessionNumber, date, attendees: attendees || [] }).write();

  res.status(201).json({ sessionNumber, date, attendees: attendees || [] });
});

// Add a student to a CLP session's attendance
server.post('/api/professors/:profId/classes/:classId/sessions/:sessionNumber/attend', (req, res) => {
  const profId = Number(req.params.profId);
  const classId = Number(req.params.classId);
  const sessionNumber = Number(req.params.sessionNumber);
  const { studentName } = req.body;
  const db = router.db;
  
  const profRef = db.get('professors').find({ id: profId });
  const prof = profRef.value();
  if (!prof) return res.status(404).json({ message: 'Professor not found' });
  
  const classRef = profRef.get('classes').find({ id: classId });
  const cls = classRef.value();
  if (!cls) return res.status(404).json({ message: 'Class not found' });
  
  const sessionRef = classRef.get('sessions').find({ sessionNumber });
  const session = sessionRef.value();
  if (!session) return res.status(404).json({ message: 'Session not found' });
  
  if (!studentName) return res.status(400).json({ message: 'Student name required' });

  // Prevent duplicate attendance
  if (!session.attendees.includes(studentName)) {
    sessionRef.get('attendees').push(studentName).write();
  }
  
  res.json({ success: true, studentName });
});

// Remove a student from a CLP session's attendance
server.delete('/api/professors/:profId/classes/:classId/sessions/:sessionNumber/attend/:studentName', (req, res) => {
  const profId = Number(req.params.profId);
  const classId = Number(req.params.classId);
  const sessionNumber = Number(req.params.sessionNumber);
  const studentName = decodeURIComponent(req.params.studentName);
  const db = router.db;
  
  const profRef = db.get('professors').find({ id: profId });
  const prof = profRef.value();
  if (!prof) return res.status(404).json({ message: 'Professor not found' });
  
  const classRef = profRef.get('classes').find({ id: classId });
  const cls = classRef.value();
  if (!cls) return res.status(404).json({ message: 'Class not found' });
  
  const sessionRef = classRef.get('sessions').find({ sessionNumber });
  const session = sessionRef.value();
  if (!session) return res.status(404).json({ message: 'Session not found' });

  // Remove the student from attendees
  sessionRef.get('attendees').remove(studentName).write();
  
  res.json({ success: true, studentName });
});

// Mount the json-server router under /api for other endpoints
server.use('/api', router);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`JSON Server with custom routes running on http://localhost:${PORT}`);
});