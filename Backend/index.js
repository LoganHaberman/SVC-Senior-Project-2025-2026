console.log("Starting backend server...");

const express = require("express");
const mysql = require("mysql");
const cors = require("cors");
const session = require("express-session");
const passport = require("passport");
const { Strategy: SamlStrategy } = require("passport-saml");

const app = express();

app.use(cors({
  origin: "https://cis2.stvincent.edu",
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: "clp-saml-secret-changeme",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: true,
    sameSite: "none",
    maxAge: 86400000
  }
}));

app.use(passport.initialize());
app.use(passport.session());

const db = mysql.createPool({
  connectionLimit: 20,
  host: "testmysqlclpdatabase.czaq8g0u0iks.us-east-2.rds.amazonaws.com",
  user: "LearnCO",
  password: "Rajah424!",
  database: "Test_access",
});

db.getConnection(err => {
  if (err) console.error("MySQL Connection Error:", err);
  else console.log("MySQL Connected!");
});

// ─── SAML SETUP ───────────────────────────────────────────────

const AZURE_CERT = `MIIC8DCCAdigAwIBAgIQJtWrJd2L6K5GMvuM3CH6fzANBgkqhkiG9w0BAQsFADA0MTIwMAYDVQQD
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
eBuK11qxsejnjnygtovX`;

passport.use(new SamlStrategy({
  entryPoint: `https://login.microsoftonline.com/57cc97f0-039b-48f4-80a1-f40341889c0b/saml2`,
  issuer: "https://cis2.stvincent.edu/CLP/saml/metadata",
  callbackUrl: "https://cis2.stvincent.edu/CLP/saml/acs",
  cert: AZURE_CERT,
  identifierFormat: null,
},
(profile, done) => {
  const email =
    profile.nameID ||
    profile["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"] ||
    profile["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/upn"];

  console.log("SAML profile received:", profile);
  console.log("Email extracted:", email);

  if (!email) return done(new Error("No email returned from Azure"));

  db.query(
    "SELECT * FROM Users WHERE email = ?",
    [email.toLowerCase().trim()],
    (err, results) => {
      if (err) return done(err);
      if (results.length === 0) {
        console.log("SSO user not found in DB:", email);
        return done(null, false);
      }
      console.log("SSO user found:", results[0].username, results[0].role);
      return done(null, results[0]);
    }
  );
}));

passport.serializeUser((user, done) => done(null, user.idUsers));
passport.deserializeUser((id, done) => {
  db.query("SELECT * FROM Users WHERE idUsers = ?", [id], (err, results) => {
    if (err) return done(err);
    done(null, results[0]);
  });
});

// ─── SAML ROUTES ──────────────────────────────────────────────

// Metadata — Azure needs this
app.get("/saml/metadata", (req, res) => {
  res.type("application/xml");
  res.send(`<?xml version="1.0"?>
<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata"
  entityID="https://cis2.stvincent.edu/CLP/saml/metadata">
  <SPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <AssertionConsumerService
      Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
      Location="https://cis2.stvincent.edu/CLP/saml/acs"
      index="1"/>
  </SPSSODescriptor>
</EntityDescriptor>`);
});

// Start SSO — redirects browser to Microsoft
app.get("/saml/login",
  passport.authenticate("saml", {
    failureRedirect: "https://cis2.stvincent.edu/CLP/?error=saml_start_failed"
  })
);

// ACS — Microsoft posts back here after login
app.post("/saml/acs",
  passport.authenticate("saml", {
    failureRedirect: "https://cis2.stvincent.edu/CLP/?error=auth_failed"
  }),
  (req, res) => {
    const user = req.user;
    if (!user) return res.redirect("https://cis2.stvincent.edu/CLP/?error=user_not_found");

    const role = user.role;
    const userId = user.idUsers;

    if (role === "admin")     return res.redirect(`https://cis2.stvincent.edu/CLP/admindash?sso=1&role=${role}&userId=${userId}`);
    if (role === "professor") return res.redirect(`https://cis2.stvincent.edu/CLP/professordash?sso=1&role=${role}&userId=${userId}`);
    if (role === "student")   return res.redirect(`https://cis2.stvincent.edu/CLP/facilitatordash?sso=1&role=${role}&userId=${userId}`);

    res.redirect("https://cis2.stvincent.edu/CLP/?error=unknown_role");
  }
);

    const role = user.role;
    console.log("SSO login success:", user.username, role);

    if (role === "admin")     return res.redirect("https://cis2.stvincent.edu/CLP/admindash");
    if (role === "professor") return res.redirect("https://cis2.stvincent.edu/CLP/professordash");
    if (role === "student")   return res.redirect("https://cis2.stvincent.edu/CLP/facilitatordash");

    res.redirect("https://cis2.stvincent.edu/CLP/?error=unknown_role");
  }
);

// Called by frontend to check if user is SSO-logged-in
app.get("/api/me", (req, res) => {
  if (req.isAuthenticated && req.isAuthenticated() && req.user) {
    return res.json({
      userId: req.user.idUsers,
      role: req.user.role,
      username: req.user.username
    });
  }
  res.status(401).json({ error: "Not authenticated" });
});

// ─── ALL EXISTING API ROUTES (unchanged) ──────────────────────

app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Missing credentials" });
  }
  db.query(
    "SELECT * FROM Users WHERE username = ? AND password = ?",
    [username.trim(), password.trim()],
    (err, result) => {
      if (err) return res.status(500).json({ error: err });
      if (result.length > 0) {
        res.json({ success: true, userId: result[0].idUsers, role: result[0].role });
      } else {
        res.json({ success: false, message: "Invalid credentials" });
      }
    }
  );
});

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
  const studentId = req.body.studentId;
  const sessionId = req.body.sessionId;
  db.query("INSERT INTO Attendance (studentID, sessionID) VALUES (?, ?)", [studentId, sessionId], (err, result) => {
    if (err) return res.status(500).json({ error: err });
    res.json({ message: "Student added to session successfully" });
  });
});

app.post("/api/admin/roster", (req, res) => {
  const { students } = req.body;
  if (!students || !Array.isArray(students)) {
    return res.status(400).json({ message: "Invalid student data" });
  }
  const insertStudentQuery = `INSERT INTO Students (studentID, studentName) VALUES (?, ?) ON DUPLICATE KEY UPDATE studentName = VALUES(studentName)`;
  const insertRelationQuery = `INSERT IGNORE INTO StudentClasses (studentID, classID) VALUES (?, ?)`;
  let completed = 0;
  let hasError = false;
  students.forEach((s) => {
    db.query(insertStudentQuery, [s.studentID, s.studentName], (err) => {
      if (err && !hasError) { hasError = true; return res.status(500).json({ message: "Error inserting student", error: err }); }
      db.query(insertRelationQuery, [s.studentID, s.classID], (err2) => {
        if (err2 && !hasError) { hasError = true; return res.status(500).json({ message: "Error linking student to class", error: err2 }); }
        completed++;
        if (completed === students.length && !hasError) res.json({ success: true, message: "Roster uploaded successfully" });
      });
    });
  });
});

app.delete("/api/removeStudent", (req, res) => {
  const { studentId, sessionId } = req.body;
  db.query("DELETE FROM Attendance WHERE studentID = ? AND sessionID = ?", [studentId, sessionId], (err, result) => {
    if (err) return res.status(500).json({ error: err });
    res.json({ message: "Student removed successfully" });
  });
});

app.get("/api/admin/professors", (req, res) => {
  db.query("SELECT p.professorID, p.professorName, u.username, u.idUsers as userId FROM Professors p JOIN Users u ON p.userID = u.idUsers WHERE u.role = 'professor'", (err, result) => {
    if (err) return res.status(500).json({ error: err });
    res.json(result);
  });
});

app.post("/api/admin/addProfessor", (req, res) => {
  const { username, password, name } = req.body;
  if (!username || !password || !name) return res.status(400).json({ error: "Missing required fields" });
  db.query("INSERT INTO Users (username, password, role) VALUES (?, ?, 'professor')", [username.trim(), password.trim()], (err, userResult) => {
    if (err) return res.status(500).json({ error: err });
    db.query("INSERT INTO Professors (professorName, userID) VALUES (?, ?)", [name.trim(), userResult.insertId], (err2) => {
      if (err2) return res.status(500).json({ error: err2 });
      res.json({ success: true, message: "Professor added successfully" });
    });
  });
});

app.post("/api/admin/deleteProfessor", (req, res) => {
  const userIdRaw = (req.body && req.body.userId !== undefined) ? req.body.userId : req.query.userId;
  const userId = Number(userIdRaw);
  if (userIdRaw === null || userIdRaw === undefined || Number.isNaN(userId)) return res.status(400).json({ error: "Missing userId" });
  db.query("SELECT professorID FROM Professors WHERE userID = ?", [userId], (err, profResult) => {
    if (err) return res.status(500).json({ error: err });
    if (profResult.length === 0) return res.status(404).json({ error: "Professor not found" });
    const professorID = profResult[0].professorID;
    db.query("SELECT COUNT(*) as classCount FROM Classes WHERE professorID = ?", [professorID], (err, classResult) => {
      if (err) return res.status(500).json({ error: err });
      if (classResult[0].classCount > 0) return res.status(400).json({ error: "Cannot delete professor with existing classes." });
      db.query("DELETE FROM Professors WHERE userID = ?", [userId], (err) => {
        if (err) return res.status(500).json({ error: err });
        db.query("DELETE FROM Users WHERE idUsers = ?", [userId], (err2) => {
          if (err2) return res.status(500).json({ error: err2 });
          res.json({ success: true, message: "Professor deleted successfully" });
        });
      });
    });
  });
});

app.get("/api/professor/facilitators", (req, res) => {
  db.query("SELECT u.username, u.idUsers as userId FROM Users u WHERE u.role = 'student'", (err, result) => {
    if (err) return res.status(500).json({ error: err });
    res.json(result);
  });
});

app.post("/api/professor/addFacilitator", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: "Missing required fields" });
  db.query("INSERT INTO Users (username, password, role) VALUES (?, ?, 'student')", [username.trim(), password.trim()], (err, userResult) => {
    if (err) return res.status(500).json({ error: err });
    res.json({ success: true, userId: userResult.insertId });
  });
});

app.post("/api/professor/deleteFacilitator", (req, res) => {
  const userIdRaw = (req.body && req.body.userId !== undefined) ? req.body.userId : req.query.userId;
  const userId = Number(userIdRaw);
  if (userIdRaw === null || userIdRaw === undefined || Number.isNaN(userId)) return res.status(400).json({ error: "Missing userId" });
  db.query("DELETE FROM Users WHERE idUsers = ?", [userId], (err) => {
    if (err) return res.status(500).json({ error: err });
    res.json({ success: true, message: "Facilitator deleted successfully" });
  });
});

app.get("/api/getProfClasses", (req, res) => {
  const professorID = req.query.professorID;
  if (!professorID) return res.status(400).json({ message: "Missing professorID" });
  db.query("SELECT professorID, professorName FROM Professors WHERE professorID = ?", [professorID], (err, profResult) => {
    if (err) return res.status(500).json({ error: err });
    if (profResult.length === 0) return res.status(404).json({ message: "Professor not found" });
    const professor = profResult[0];
    db.query("SELECT classID, title, classCode, semester FROM Classes WHERE professorID = ?", [professor.professorID], (err, classResults) => {
      if (err) return res.status(500).json({ error: err });
      if (classResults.length === 0) return res.json({ name: professor.professorName, classes: [] });
      const classIds = classResults.map(c => c.classID);
      db.query("SELECT sessionID, sessionNumber, sessionDate, classID FROM Sessions WHERE classID IN (?)", [classIds], (err, sessionResults) => {
        if (err) return res.status(500).json({ error: err });
        db.query(`SELECT sc.classID, sc.studentID, st.studentName, COUNT(DISTINCT a.sessionID) AS count FROM StudentClasses sc JOIN Students st ON st.studentID = sc.studentID LEFT JOIN Sessions s ON s.classID = sc.classID LEFT JOIN Attendance a ON a.studentID = sc.studentID AND a.sessionID = s.sessionID WHERE sc.classID IN (?) GROUP BY sc.classID, sc.studentID, st.studentName`, [classIds], (err, attendanceResults) => {
          if (err) return res.status(500).json({ error: err });
          const classes = classResults.map(c => {
            const sessions = sessionResults.filter(s => s.classID === c.classID).map(s => ({ sessionNumber: s.sessionNumber, date: s.sessionDate, attendees: [] }));
            const attendance = attendanceResults.filter(a => a.classID === c.classID).map(a => ({ studentId: a.studentID, studentName: a.studentName, count: a.count }));
            return { id: c.classID, title: c.title, code: c.classCode, semester: c.semester, sessions, attendance };
          });
          res.json({ name: professor.professorName, classes });
        });
      });
    });
  });
});

app.post("/api/addClass", (req, res) => {
  const userId = req.body.profId;
  const { title, code, semester } = req.body;
  if (!title) return res.status(400).json({ error: "Title is required" });
  db.query("SELECT professorID FROM Professors WHERE userID = ?", [userId], (err, profResult) => {
    if (err) return res.status(500).json({ error: err });
    if (profResult.length === 0) return res.status(404).json({ error: "Professor not found" });
    db.query("INSERT INTO Classes (title, classCode, semester, professorID) VALUES (?, ?, ?, ?)", [title, code || null, semester || null, profResult[0].professorID], (err, classResult) => {
      if (err) return res.status(500).json({ error: err });
      res.json({ id: classResult.insertId, title, code, semester, professorID: profResult[0].professorID, sessions: [] });
    });
  });
});

app.post("/api/professors/:profId/classes/:classId/roster", (req, res) => {
  const classId = parseInt(req.params.classId, 10);
  const { students } = req.body;
  if (!classId || !students || !Array.isArray(students)) return res.status(400).json({ success: false, message: "Invalid input" });
  const newIds = students.map(s => String(s.studentID));
  db.query("INSERT INTO Students (studentID, studentName) VALUES ? ON DUPLICATE KEY UPDATE studentName = VALUES(studentName)", [students.map(s => [s.studentID, s.studentName])], (err) => {
    if (err) return res.status(500).json({ success: false, message: "Error inserting students" });
    db.query("SELECT studentID FROM StudentClasses WHERE classID = ?", [classId], (err, currentRows) => {
      if (err) return res.status(500).json({ success: false, message: "Error fetching roster" });
      const currentIds = currentRows.map(r => String(r.studentID));
      const toAdd = newIds.filter(id => !currentIds.includes(id));
      const toRemove = currentIds.filter(id => !newIds.includes(id));
      const insertRelations = (cb) => {
        if (toAdd.length === 0) return cb();
        db.query("INSERT IGNORE INTO StudentClasses (studentID, classID) VALUES ?", [toAdd.map(id => [id, classId])], cb);
      };
      const deleteRelations = (cb) => {
        if (toRemove.length === 0) return cb();
        db.query(`DELETE FROM StudentClasses WHERE classID = ? AND studentID IN (${toRemove.map(() => "?").join(",")})`, [classId, ...toRemove], cb);
      };
      insertRelations((err) => {
        if (err) return res.status(500).json({ success: false, message: "Error adding students" });
        deleteRelations((err) => {
          if (err) return res.status(500).json({ success: false, message: "Error removing students" });
          res.json({ success: true, added: toAdd.length, removed: toRemove.length });
        });
      });
    });
  });
});

app.delete("/api/classes/:classId", (req, res) => {
  db.query("DELETE FROM Classes WHERE classID = ?", [req.params.classId], (err) => {
    if (err) return res.status(500).json({ success: false, message: "Delete failed" });
    res.json({ success: true });
  });
});

app.delete("/api/deleteClass", (req, res) => {
  db.query("DELETE FROM Classes WHERE classID = ?", [req.body.classId], (err, result) => {
    if (err) return res.status(500).json({ error: err });
    if (result.affectedRows === 0) return res.status(404).json({ error: "Class not found" });
    res.json({ message: "Class deleted successfully" });
  });
});

app.get("/api/professors/list", (req, res) => {
  db.query("SELECT professorID as id, professorName as name FROM Professors", (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
});

app.get("/api/allStudents", (req, res) => {
  db.query("SELECT studentID, studentName FROM Students", (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
});

app.post("/api/attendance", (req, res) => {
  const studentId = parseInt(req.body.studentId, 10);
  const classId = parseInt(req.body.classId, 10);
  const sessionNumber = parseInt(req.body.sessionNumber, 10);
  const professorID = parseInt(req.body.professorID, 10);
  if (!studentId || !classId || !sessionNumber || !professorID) return res.status(400).json({ error: "Missing fields" });
  db.query("SELECT sessionID FROM Sessions WHERE classID = ? AND sessionNumber = ?", [classId, sessionNumber], (err, sessionResult) => {
    if (err) return res.status(500).json(err);
    const createAttendance = (sessionID) => {
      db.query("INSERT INTO Attendance (sessionID, studentID) VALUES (?, ?)", [sessionID, studentId], (err2) => {
        if (err2) {
          if (err2.code === 'ER_DUP_ENTRY') return res.json({ success: true, duplicate: true, message: "Student already marked present" });
          return res.status(500).json(err2);
        }
        return res.json({ success: true });
      });
    };
    if (sessionResult.length > 0) return createAttendance(sessionResult[0].sessionID);
    const sessionDate = new Date().toISOString().slice(0, 10);
    db.query("INSERT INTO Sessions (sessionNumber, sessionDate, classID, professorID) VALUES (?, ?, ?, ?)", [sessionNumber, sessionDate, classId, professorID], (err3, insertResult) => {
      if (err3) return res.status(500).json(err3);
      return createAttendance(insertResult.insertId);
    });
  });
});

app.post("/api/classes/:classId/sessions", (req, res) => {
  const classId = parseInt(req.params.classId, 10);
  if (isNaN(classId)) return res.status(400).json({ error: "Invalid class ID" });
  db.query("SELECT MAX(sessionNumber) AS maxSession FROM Sessions WHERE classID = ?", [classId], (err, result) => {
    if (err) return res.status(500).json(err);
    const nextSessionNumber = (result[0].maxSession || 0) + 1;
    const sessionDate = new Date();
    db.query("INSERT INTO Sessions (sessionNumber, sessionDate, classID) VALUES (?, ?, ?)", [nextSessionNumber, sessionDate, classId], (err, insertResult) => {
      if (err) return res.status(500).json(err);
      res.json({ sessionID: insertResult.insertId, sessionNumber: nextSessionNumber, date: sessionDate.toISOString().split("T")[0], attendees: [] });
    });
  });
});

app.get("/api/classes/:classId/sessions", (req, res) => {
  const classId = parseInt(req.params.classId, 10);
  const professorID = req.query.professorID;
  db.query("SELECT * FROM Sessions WHERE classID = ? ORDER BY sessionNumber", [classId], (err, sessions) => {
    if (err) return res.status(500).json(err);
    if (sessions.length === 0) {
      const now = new Date();
      db.query("INSERT INTO Sessions (sessionNumber, sessionDate, classID, professorID) VALUES (1, ?, ?, ?)", [now, classId, professorID], (err2, insertResult) => {
        if (err2) return res.status(500).json(err2);
        return res.json([{ sessionID: insertResult.insertId, sessionNumber: 1, date: now.toISOString().split("T")[0] }]);
      });
    } else {
      res.json(sessions.map(s => ({ sessionID: s.sessionID, sessionNumber: s.sessionNumber, date: new Date(s.sessionDate).toISOString().split("T")[0] })));
    }
  });
});

app.get("/api/class-roster/:classID", (req, res) => {
  db.query("SELECT studentID FROM StudentClasses WHERE classID = ?", [req.params.classID], (err, results) => {
    if (err) return res.status(500).json({ error: err.message, code: err.code });
    res.json(results);
  });
});

app.get("/api/users", (req, res) => {
  db.query("SELECT * FROM Users", (err, result) => {
    if (err) return res.json({ error: err });
    res.json(result);
  });
});

app.post("/api/users", (req, res) => {
  const { name, email } = req.body;
  db.query("INSERT INTO users (name, email) VALUES (?, ?)", [name, email], (err, result) => {
    if (err) return res.json({ error: err });
    res.json({ message: "User added successfully" });
  });
});

app.listen(5000, () => console.log("Server running on port 5000"));
