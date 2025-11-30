// json-server-custom.js
const jsonServer = require('json-server');
const path = require('path');

const server = jsonServer.create();
const router = jsonServer.router(path.join(__dirname, 'db.json')); // path to db.json in project root
const middlewares = jsonServer.defaults();

server.use(middlewares);
server.use(jsonServer.bodyParser);

// Custom login endpoint
server.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const db = router.db; // lowdb instance
  const user = db.get('users').find({ username, password }).value();

  if (user) {
    // Return minimal info: role and a fake token
    res.json({ success: true, role: user.role, token: 'fake-jwt-token' });
  } else {
    res.status(401).json({ success: false, message: 'Invalid credentials' });
  }
});

// Mount the json-server router under /api for other endpoints
server.use('/api', router);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`JSON Server with custom routes running on http://localhost:${PORT}`);
});