const express = require("express");
const session = require("express-session");
const multer = require("multer");
const bcrypt = require("bcryptjs");
const Database = require("better-sqlite3");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, "data");
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, "library.db"));
db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL
);
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  order_no TEXT,
  order_date TEXT,
  category_id INTEGER NOT NULL,
  description TEXT,
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(category_id) REFERENCES categories(id)
);
`);

const defaultCategories = [
  "Administrative","Guidelines","Road","Drain","Plantation","Playground",
  "Compound Wall","Flood Protection","Health","Convergence","SECURE",
  "NMMS","Finance / FTO","Technical Specification","MIS / Portal",
  "Meeting","Training","Circular / Memo","Others"
];
const insertCat = db.prepare("INSERT OR IGNORE INTO categories(name) VALUES(?)");
for (const c of defaultCategories) insertCat.run(c);

if (!db.prepare("SELECT id FROM admins LIMIT 1").get()) {
  const username = process.env.ADMIN_USER || "admin";
  const password = process.env.ADMIN_PASSWORD || "ChangeMe123!";
  const hash = bcrypt.hashSync(password, 12);
  db.prepare("INSERT INTO admins(username,password_hash) VALUES(?,?)").run(username, hash);
  console.log(`Initial admin created: ${username}`);
  if (!process.env.ADMIN_PASSWORD) console.log("IMPORTANT: change ADMIN_PASSWORD before public deployment.");
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || "CHANGE_THIS_LONG_RANDOM_SECRET",
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 8*60*60*1000 }
}));
app.use(express.static(path.join(__dirname, "public")));

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, UPLOAD_DIR),
  filename: (_, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, crypto.randomUUID() + ext);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_, file, cb) => cb(null, file.mimetype === "application/pdf")
});

function adminOnly(req,res,next) {
  if (!req.session.adminId) return res.status(401).json({error:"Admin login required"});
  next();
}

app.get("/api/categories", (req,res) => {
  res.json(db.prepare("SELECT id,name FROM categories ORDER BY name").all());
});

app.get("/api/orders", (req,res) => {
  const { q="", category="" } = req.query;
  let sql = `SELECT o.id,o.title,o.order_no,o.order_date,o.description,o.original_name,
                    o.created_at,c.name category
             FROM orders o JOIN categories c ON c.id=o.category_id WHERE 1=1`;
  const args = [];
  if (q) {
    sql += ` AND (o.title LIKE ? OR o.order_no LIKE ? OR o.description LIKE ? OR o.original_name LIKE ?)`;
    const x = `%${q}%`; args.push(x,x,x,x);
  }
  if (category) { sql += ` AND o.category_id=?`; args.push(Number(category)); }
  sql += " ORDER BY COALESCE(o.order_date,o.created_at) DESC, o.id DESC";
  res.json(db.prepare(sql).all(...args));
});

app.get("/api/stats", (req,res) => {
  const total = db.prepare("SELECT COUNT(*) n FROM orders").get().n;
  const cats = db.prepare(`
    SELECT c.id,c.name,COUNT(o.id) count
    FROM categories c LEFT JOIN orders o ON o.category_id=c.id
    GROUP BY c.id ORDER BY c.name
  `).all();
  res.json({total,categories:cats});
});

app.get("/api/session", (req,res) => res.json({admin:!!req.session.adminId}));

app.post("/api/login", (req,res) => {
  const {username,password} = req.body;
  const a = db.prepare("SELECT * FROM admins WHERE username=?").get(username);
  if (!a || !bcrypt.compareSync(password || "", a.password_hash))
    return res.status(401).json({error:"Invalid username or password"});
  req.session.adminId = a.id;
  res.json({ok:true});
});

app.post("/api/logout", (req,res) => req.session.destroy(()=>res.json({ok:true})));

app.post("/api/categories", adminOnly, (req,res) => {
  const name = String(req.body.name||"").trim();
  if (!name) return res.status(400).json({error:"Category name required"});
  try {
    const r = db.prepare("INSERT INTO categories(name) VALUES(?)").run(name);
    res.json({id:r.lastInsertRowid,name});
  } catch(e) { res.status(409).json({error:"Category already exists"}); }
});

app.post("/api/orders", adminOnly, upload.single("pdf"), (req,res) => {
  if (!req.file) return res.status(400).json({error:"PDF file required"});
  const {title,order_no,order_date,category_id,description} = req.body;
  if (!title || !category_id) {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({error:"Title and category are required"});
  }
  const cat = db.prepare("SELECT id FROM categories WHERE id=?").get(category_id);
  if (!cat) {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({error:"Invalid category"});
  }
  const r = db.prepare(`
    INSERT INTO orders(title,order_no,order_date,category_id,description,filename,original_name)
    VALUES(?,?,?,?,?,?,?)
  `).run(title.trim(),order_no||"",order_date||"",category_id,description||"",req.file.filename,req.file.originalname);
  res.json({ok:true,id:r.lastInsertRowid});
});

app.delete("/api/orders/:id", adminOnly, (req,res) => {
  const o = db.prepare("SELECT filename FROM orders WHERE id=?").get(req.params.id);
  if (!o) return res.status(404).json({error:"Not found"});
  const f = path.join(UPLOAD_DIR,o.filename);
  if (fs.existsSync(f)) fs.unlinkSync(f);
  db.prepare("DELETE FROM orders WHERE id=?").run(req.params.id);
  res.json({ok:true});
});

app.get("/api/file/:id", (req,res) => {
  const o = db.prepare("SELECT * FROM orders WHERE id=?").get(req.params.id);
  if (!o) return res.status(404).send("Not found");
  const f = path.join(UPLOAD_DIR,o.filename);
  if (!fs.existsSync(f)) return res.status(404).send("File missing");
  res.setHeader("Content-Type","application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${o.original_name.replace(/"/g,"")}"`);
  res.sendFile(f);
});

app.get("/api/download/:id", (req,res) => {
  const o = db.prepare("SELECT * FROM orders WHERE id=?").get(req.params.id);
  if (!o) return res.status(404).send("Not found");
  const f = path.join(UPLOAD_DIR,o.filename);
  if (!fs.existsSync(f)) return res.status(404).send("File missing");
  res.download(f,o.original_name);
});

app.listen(PORT,()=>console.log(`VB-G RAM G Order Library running on http://localhost:${PORT}`));
