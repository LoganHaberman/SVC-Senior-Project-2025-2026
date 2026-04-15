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