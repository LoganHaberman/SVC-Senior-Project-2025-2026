console.log("Starting backend server...");
console.log("THIS IS THE CORRECT FILE"); //debug
const express = require("express");
const mysql = require("mysql");
const cors = require("cors");

//SAML
const passport = require("passport");
const SamlStrategy = require("passport-saml").Strategy;
const session = require("express-session");

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
//SAML session setup
app.use(session({
  secret: "change_this_secret",
  resave: false,
  saveUninitialized: true
}));

//SAML passport setup
app.use(passport.initialize());
app.use(passport.session());

//SAML user serialization
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));


db.getConnection(err => {
  if (err) {
    console.log("MySQL Connection Error:", err);
  } else {
    console.log("MySQL Connected!");
  }
});

//SAML strategy setup (TEMP values for testing, replace with actual IdP details)
const samlStrategy = new SamlStrategy(
  {
    entryPoint: "https://login.microsoftonline.com/57cc97f0-039b-48f4-80a1-f40341889c0b/saml2", // Correct url now, gotten from Azure Metadata
    issuer: "https://10.25.1.252/saml/metadata",
    callbackUrl: "https://10.25.1.252/saml/acs",
    cert: "MIIC8DCCAdigAwIBAgIQJtWrJd2L6K5GMvuM3CH6fzANBgkqhkiG9w0BAQsFADA0MTIwMAYDVQQDEylNaWNyb3NvZnQgQXp1cmUgRmVkZXJhdGVkIFNTTyBDZXJ0aWZpY2F0ZTAeFw0yNjA0MjMxMzMwMzNaFw0yOTA0MjMxMzMwMzNaMDQxMjAwBgNVBAMTKU1pY3Jvc29mdCBBenVyZSBGZWRlcmF0ZWQgU1NPIENlcnRpZmljYXRlMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA4TN5SvT6wGD4MhdKRkaKVZQUpDE/1OIDWO1QHo+sVZ3NJjOgT/5V2ZSJahkfCuQKT6Vs3njC2fCzs8NUDXgqvHxZuSvKHDDd8ensgGSzccrNOqyRAYoEyWv8szTXRnWbJury79fNEhwTC+mUHdgIuTvysezbCZK/51Bz1TpEBQ3tnj8hJyf+vHSvjQKgZARIbfwwE6T05/ogO9v1QM81h/exLh6T34sk/pOq0Btjbl9KRDE5WigM/d+pLwBq3CD91RXdThFppxycZDJdUVM7MrhBYXyez2RlfgANgD22D8Wu7gDwBo4Q7qxCRKE81aO7Jb8+7cwSpGHMWkV3K8AecQIDAQABMA0GCSqGSIb3DQEBCwUAA4IBAQBT82ABZymid0rm9mOpyhaiopy6JPARAhStrpYtRr3ZmW8fou4TThadamgWJa1HBXi5ymyzVyTTwqVuThgou8pXRWYAPOSJvv3gTUhs89/rP/Rx69ghK1T+DF+Ft/jiOfSf3GwoUWJQmq7rU2TDVtoPtcHyFSXfF4u4cA8djkAADUqOIMe3COZM9RF4BSPNOxEpGiblw2z2o4yTv4WuZUKDMl8LcHLMSV//MsbbOTV+StOKuQ7yB6O9Fx9q9ig0KaCt+GiCMNaXYvXp+try8l2AhnQ8fT/kB7QQg2FS3E7zwvk1u3dZ5/IB9r/7B1kOMTWoeBuK11qxsejnjnygtovX",
  },
  (profile, done) => {
    return done(null, profile);
  }
);
passport.use(samlStrategy);


//Login
app.get("/api/login", (req,res) => {
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
app.get("/api/professors", (req, res) => {
  db.query("SELECT * FROM Professors", (err, result) => {
    if (err) return res.json({ error: err });
    res.json(result);
  });
});

app.get("/api/professorClasses", (req, res) => {
  const professorId = req.query.professorId;
  db.query("SELECT * FROM Classes WHERE classID IN (SELECT classID FROM Sessions WHERE professorId = ?)", [professorId], (err, result) => {
    if (err) return res.json({ error: err });
    res.json(result);
  });
});

app.get("/api/sessions", (req, res) => {
  const classId = req.query.classId;
  db.query("SELECT * FROM Sessions WHERE classID = ?", [classId], (err, result) => {
    if (err) return res.json({ error: err });
    res.json(result);
  });
});

app.get("/api/attendees", (req, res) => { 
  const sessionID = req.query.sessionID;
  db.query("SELECT * FROM Students WHERE studentID IN (SELECT studentID FROM Attendance WHERE sessionID = ?)", [sessionID], (err, result) => {
    if (err) return res.json({ error: err });
    res.json(result);
  });
});

app.get("/api/students", (req, res) => {
  db.query("SELECT studentID FROM Students WHERE studentName = ?", [req.query.studentName], (err, result) => {
    if (err) return res.json({ error: err });
    res.json(result);
  });
});

app.post("/api/addStudents", (req, res) => {
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

app.post('/api/admin/roster', (req, res) => {
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

app.delete("/api/removeStudent", (req, res) => {
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
app.get("/api/users", (req, res) => {
  db.query("SELECT * FROM Users", (err, result) => {
    if (err) return res.json({ error: err });
    res.json(result);
  });
});


// Insert user
app.post("/api/users", (req, res) => {
  const { name, email } = req.body;
  db.query("INSERT INTO users (name, email) VALUES (?, ?)", [name, email], (err, result) => {
    if (err) return res.json({ error: err });
    res.json({ message: "User added successfully" });
  });
});

// Step 1: Start login (redirect to IdP)
app.get("/saml/login",
  passport.authenticate("saml", { failureRedirect: "/" })
);

// Step 2: ACS (Azure sends response here)
app.post("/saml/acs",
  passport.authenticate("saml", { failureRedirect: "/" }),
  (req, res) => {
    console.log("SAML user:", req.user);

    // You can change this later to redirect to frontend
    res.json({
      message: "SAML login successful",
      user: req.user
    });
  }
);

// Step 3: Metadata (VERY IMPORTANT)
app.get("/saml/metadata", (req, res) => {
  try {
    const metadata = samlStrategy.generateServiceProviderMetadata(null);
    res.type("application/xml");
    res.send(metadata);
  } catch (err) {
    console.error("Metadata generation error:", err);
    res.status(500).json({ error: "Failed to generate SAML metadata" });
  }
});

app.listen(5000, () => {
  console.log("Server running on port 5000");
});