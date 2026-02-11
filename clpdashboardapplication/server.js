// server.js, a bunch of APIs that each do something different
// By: Grant Harsch
// Date: 11/20/2025 -> 12/01/2025

// Bunch of setup for json server that gets data from db.json from the router
const jsonServer = require('json-server');
const path = require('path');

const server = jsonServer.create();
const router = jsonServer.router(path.join(__dirname, 'db.json')); // path to db.json in project root
const middlewares = jsonServer.defaults();

server.use(middlewares);
server.use(jsonServer.bodyParser);

// Login endpoint
// user and pass expected and success role and token are returned
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

// Get professor by id (includes classes)
// When a professor's page is loaded this API is used to get classes pertaining to that prof
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

// Delete a professor's class from a professor's classes list
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

// Using port 3001 to run the server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`JSON Server with custom routes running on http://localhost:${PORT}`);
});