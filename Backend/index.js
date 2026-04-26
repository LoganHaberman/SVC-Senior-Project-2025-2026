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

//SAML strategy setup
const samlStrategy = new SamlStrategy(
  {
    entryPoint: "https://login.microsoftonline.com/57cc97f0-039b-48f4-80a1-f40341889c0b/saml2", // Azure IdP URL
    issuer: "https://10.25.1.252/saml/metadata",
    callbackUrl: "https://10.25.1.252/saml/acs",
    cert: `
-----BEGIN CERTIFICATE-----
MIIC8DCCAdigAwIBAgIQJtWrJd2L6K5GMvuM3CH6fzANBgkqhkiG9w0BAQsFADA0MTIwMAYDVQQD
EylNaWNyb3NvZnQgQXp1cmUgRmVkZXJhdGVkIFNTTyBDZXJ0aWZpY2F0ZTAeFw0yNjA0MjMxMzMw
MzNaFw0yOTA0MjMxMzMwMzNaMDQxMjAwBgNVBAMTKU1pY3Jvc29mdCBBenVyZSBGZWRlcmF0ZWQg
U1NPIENlcnRpZmljYXRlMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA4TN5SvT6wGD4
MhdKRkaKVZQUpDE/1OIDWO1QHo+sVZ3NJjOgT/5V2ZSJahkfCuQKT6Vs3njC2fCzs8NUDXgqvHxZ
uSvKHDDd8ensgGSzccrNOqyRAYoEyWv8szTXRnWbJury79fNEhwTC+mUHdgIuTvysezbCZK/51Bz
1TpEBQ3tnj8hJyf+vHSvjQKgZARIbfwwE6T05/ogO9v1QM81h/exLh6T34sk/pOq0Btjbl9KRDE5
WigM/d+pLwBq3CD91RXdThFppxycZDJdUVM7MrhBYXyez2RlfgANgD22D8Wu7gDwBo4Q7qxCRKE8
1aO7Jb8+7cwSpGHMWkV3K8AecQIDAQABMA0GCSqGSIb3DQEBCwUAA4IBAQBT82ABZymid0rm9mOp
yhaiopy6JPARAhStrpYtRr3ZmW8fou4TThadamgWJa1HBXi5ymyzVyTTwqVuThgou8pXRWYAPOSJ
vv3gTUhs89/rP/Rx69ghK1T+DF+Ft/jiOfSf3GwoUWJQmq7rU2TDVtoPtcHyFSXfF4u4cA8djkAA
DUqOIMe3COZM9RF4BSPNOxEpGiblw2z2o4yTv4WuZUKDMl8LcHLMSV//MsbbOTV+StOKuQ7yB6O9
Fx9q9ig0KaCt+GiCMNaXYvXp+try8l2AhnQ8fT/kB7QQg2FS3E7zwvk1u3dZ5/IB9r/7B1kOMTWo
eBuK11qxsejnjnygtovX
-----END CERTIFICATE-----
`,
  },
  (profile, done) => {
    return done(null, profile);
  }
);
passport.use(samlStrategy);


//Login
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;

  console.log("Login attempt:", username);

  if (!username || !password) {
    return res.status(400).json({ error: "Missing credentials" });
  }

  db.query(
    "SELECT * FROM Users WHERE username = ? AND password = ?",
    [username.trim(), password.trim()],
    (err, result) => {
      if (err) return res.status(500).json({ error: err });

      if (result.length > 0) {
        res.json({
          success: true,
          userId: result[0].idUsers, // verify column name
          role: result[0].role
        });
      } else {
        res.json({
          success: false,
          message: "Invalid credentials"
        });
      }
    }
  );
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

//Professor Page Stuff
app.get("/api/getProfClasses", (req, res) => {
  const userId = req.query.userId;

  db.query(
    `SELECT 
      p.professorName,

      c.classID,
      c.title,
      c.classCode,
      c.semester,
      c.clpDay,

      s.sessionID,
      s.sessionNumber,
      s.sessionDate,

      st.studentName

    FROM Professors p
    LEFT JOIN Sessions s ON p.professorID = s.professorID
    LEFT JOIN Classes c ON s.classID = c.classID
    LEFT JOIN Attendance a ON s.sessionID = a.sessionID
    LEFT JOIN Students st ON a.studentID = st.studentID

    WHERE p.userID = ?
    ORDER BY c.classID, s.sessionNumber`,
    [userId],
    (err, rows) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: err });
      }

    if (rows.length ==0) {
      return res.json({ name: "", classes: [] });
    }

    const professorName = rows[0].professorName;
    const classesMap = {};

    rows.forEach(row => {
      if (!row.classID) return;

      if (!classesMap[row.classID]) {
        classesMap[row.classID] = {
          id: row.classID,
          title: row.title,
          code: row.classCode,
          semester: row.semester,
          clpDay: row.clpDay,
          sessions: {}
        };
      }

      const cls = classesMap[row.classID];

      if (row.sessionID) {
        if (!cls.sessions[row.sessionID]) {
          cls.sessions[row.sessionID] = {
            sessionNumber: row.sessionNumber,
            date: row.sessionDate,
            attendees: []
          };
        }

        if (row.studentName) {
          cls.sessions[row.sessionID].attendees.push(row.studentName);
        }
      }
    });

    // Convert maps → arrays
    const classes = Object.values(classesMap).map(cls => ({
      ...cls,
      sessions: Object.values(cls.sessions)
    }));

    res.json({
      name: professorName,
      classes
    });
  });
});


app.post("/api/addClass", (req, res) => {
  const userId = req.body.profId;

  const { title, code, semester, clpDay } = req.body;

  if (!title || !clpDay) {
    return res.status(400).json({ error: "Title and CLP day are required" });
  }

  db.query(
    "SELECT professorID FROM Professors WHERE userID = ?",
    [userId],
    (err, profResult) => {
      if (err) return res.status(500).json({ error: err });

      if (profResult.length === 0) {
        return res.status(404).json({ error: "Professor not found" });
      }

      const professorID = profResult[0].professorID;

      db.query(
        `INSERT INTO Classes (title, classCode, semester, clpDay)
         VALUES (?, ?, ?, ?)`,
        [title, code || null, semester || null, clpDay],
        (err, classResult) => {
          if (err) return res.status(500).json({ error: err });

          const classID = classResult.insertId;

          res.json({
            id: classID,
            title,
            code,
            semester,
            clpDay,
            sessions: []
          });
        }
      );
    }
  );
});

app.delete("/api/deleteClass", (req, res) => {
  const { classId } = req.body;

  db.query("DELETE FROM Classes WHERE classID = ?", [classId], (err, result) => {
    if (err) return res.status(500).json({ error: err });

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Class not found" });
    }

    res.json({ message: "Class deleted successfully" });
  });
});

//StudentFacilitator Page Stuff
app.get("/api/professors/list", (req, res) => {
  db.query(
    "SELECT professorID as id, professorName as name FROM Professors",
    (err, result) => {
      if (err) return res.status(500).json(err);
      res.json(result);
    }
  );
});

app.get("/api/allStudents", (req, res) => {
  db.query("SELECT studentID, studentName FROM Students", (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
});

app.post("/api/attendance", (req, res) => {
  console.log("ATTENDANCE HIT:", req.body);
  const studentId = parseInt(req.body.studentId, 10);
  const classId = req.body.classId;
  const sessionNumber = req.body.sessionNumber;

  if (!studentId || !classId || !sessionNumber) {
    return res.status(400).json({ error: "Missing fields" });
  }

  db.query(
    `SELECT sessionID FROM Sessions WHERE classID = ? AND sessionNumber = ?`,
    [classId, sessionNumber],
    (err, sessionResult) => {
      if (err) return res.status(500).json(err);

      if (sessionResult.length === 0) {
        return res.status(404).json({ error: "Session not found" });
      }

      const sessionID = sessionResult[0].sessionID;

      db.query(
        `INSERT INTO Attendance (sessionID, studentID) VALUES (?, ?)`,
        [sessionID, studentId],
        (err) => {
          if (err) return res.status(500).json(err);

          res.json({ success: true });
        }
      );
    }
  );
});

app.post("/api/classes/:classId/sessions", (req, res) => {
  const classId = parseInt(req.params.classId, 10);

  if (isNaN(classId)) {
    return res.status(400).json({ error: "Invalid class ID" });
  }

  // Get next session number
  db.query(
    `SELECT MAX(sessionNumber) AS maxSession FROM Sessions WHERE classID = ?`,
    [classId],
    (err, result) => {
      if (err) return res.status(500).json(err);

      const nextSessionNumber = (result[0].maxSession || 0) + 1;

      const sessionDate = new Date(); // or pass from frontend

      db.query(
        `INSERT INTO Sessions (sessionNumber, sessionDate, classID)
         VALUES (?, ?, ?)`,
        [nextSessionNumber, sessionDate, classId],
        (err, insertResult) => {
          if (err) return res.status(500).json(err);

          res.json({
            sessionID: insertResult.insertId,
            sessionNumber: nextSessionNumber,
            date: sessionDate.toISOString().split("T")[0],
            attendees: []
          });
        }
      );
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