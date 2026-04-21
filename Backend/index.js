console.log("Starting backend server...");
const express = require("express");
const mysql = require("mysql");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const db = mysql.createPool({
  connectionLimit: 20,
  host: "testmysqlclpdatabase.czaq8g0u0iks.us-east-2.rds.amazonaws.com",
  user: "LearnCO",
  password: "Rajah424!",
  database: "Test_access",
});



db.getConnection(err => {
  if (err) {
    console.log("MySQL Connection Error:", err);
  } else {
    console.log("MySQL Connected!");
  }
});

//Login
app.get("/login", (req,res) => {
  const username = req.query.username;
  const password = req.query.password;
  console.log("Login attempt with username:", username);
    db.query("SELECT * FROM Users WHERE username = ? AND password = ?", [username.trim(), password.trim()], (err, result) => {
        if (err) return res.json({error: err});
        if (result.length > 0) {
            res.json({message: "Login successful", user: result[0]});
        } else {
            res.json({error: "Invalid credentials"});
        }
    });
});

//Admin Page Stuff
app.get("/professors", (req, res) => {
  db.query("SELECT * FROM Professors", (err, result) => {
    if (err) return res.json({ error: err });
    res.json(result);
  });
});

app.get("/professorClasses", (req, res) => {
  const professorId = req.query.professorId;
  db.query("SELECT * FROM Classes WHERE classID IN (SELECT classID FROM Sessions WHERE professorId = ?)", [professorId], (err, result) => {
    if (err) return res.json({ error: err });
    res.json(result);
  });
});

app.get("/sessions", (req, res) => {
  const classId = req.query.classId;
  db.query("SELECT * FROM Sessions WHERE classID = ?", [classId], (err, result) => {
    if (err) return res.json({ error: err });
    res.json(result);
  });
});

app.get("/attendees", (req, res) => { 
  const sessionID = req.query.sessionID;
  db.query("SELECT * FROM Students WHERE studentID IN (SELECT studentID FROM Attendance WHERE sessionID = ?)", [sessionID], (err, result) => {
    if (err) return res.json({ error: err });
    res.json(result);
  });
});

app.get("/students", (req, res) => {
  db.query("SELECT studentID FROM Students WHERE studentName = ?", [req.query.studentName], (err, result) => {
    if (err) return res.json({ error: err });
    res.json(result);
  });
});

app.post("/addStudents", (req, res) => {
  console.log("BODY:", req.body);
  const studentId = req.body.studentId;
  const sessionId = req.body.sessionId;
  db.query("INSERT INTO Attendance (studentID, sessionID) VALUES (?, ?)", [studentId, sessionId], (err, result) => {
    if (err) {
      console.error("DB ERROR:", err);
      return res.status(500).json({ error: err });
    }
    res.json({ message: "Student added to session successfully" })  ;
  });
});

app.post('/admin/roster', (req, res) => {
  console.log("BODY:", req.body);
  const students = req.body.students;

  students.forEach(({ studentID, studentName }) => {
    db.query(
      "INSERT INTO Students (studentID, studentName) VALUES (?, ?) ON DUPLICATE KEY UPDATE studentName = VALUES(studentName)",
      [studentID, studentName]
    );
  });

  res.json({ message: "Roster uploaded successfully" });
});

app.delete("/removeStudent", (req, res) => {
  const { studentId, sessionId } = req.body;

  db.query(
    "DELETE FROM Attendance WHERE studentID = ? AND sessionID = ?",
    [studentId, sessionId],
    (err, result) => {
      if (err) {
        console.error("DB ERROR:", err);
        return res.status(500).json({ error: err });
      }

      res.json({ message: "Student removed successfully" });
    }
  );
});

// Get all users
app.get("/users", (req, res) => {
  db.query("SELECT * FROM Users", (err, result) => {
    if (err) return res.json({ error: err });
    res.json(result);
  });
});


// Insert user
app.post("/Users", (req, res) => {
  const { name, email } = req.body;
  db.query("INSERT INTO users (name, email) VALUES (?, ?)", [name, email], (err, result) => {
    if (err) return res.json({ error: err });
    res.json({ message: "User added successfully" });
  });
});

app.listen(5000, () => {
  console.log("Server running on port 5000");
});