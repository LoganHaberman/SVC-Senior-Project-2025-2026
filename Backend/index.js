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


const db = mysql.createConnection({
  host: "testmysqlclpdatabase.czaq8g0u0iks.us-east-2.rds.amazonaws.com",
  user: "LearnCO",
  password: "Rajah424!",
  database: "Test_access",
});

db.connect(err => {
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


// Get all users
app.get("/users", (req, res) => {
  db.query("SELECT * FROM users", (err, result) => {
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