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
    // Role is returned as well as a token that may be used for further authorization or something interesting later
    res.json({ success: true, role: user.role, token: 'fake-jwt-token' });
  } else {
    res.status(401).json({ success: false, message: 'Invalid credentials' });
  }
});

// Get professor by id (includes classes) - router already supports /api/professors/:id
// Additional helper route: get classes for a professor
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

// Mount the json-server router under /api for other endpoints
server.use('/api', router);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`JSON Server with custom routes running on http://localhost:${PORT}`);
});