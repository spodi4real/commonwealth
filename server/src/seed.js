import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PRINCIPLES_PATH = path.resolve(__dirname, '..', '..', 'seeds', 'wealth_principles.json');

const DEFAULT_PIN = '0000';

function seedUsers() {
  const count = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  if (count > 0) {
    console.log(`[seed] users already present (${count}) — skipping`);
    return;
  }
  const hash = bcrypt.hashSync(DEFAULT_PIN, 10);
  const insert = db.prepare(
    'INSERT INTO users (name, role, pin_hash, must_change_pin) VALUES (?, ?, ?, 1)'
  );
  insert.run('Owner', 'owner', hash);
  insert.run('Mom', 'mom', hash);
  console.log('[seed] inserted Owner and Mom with PIN 0000 (must change on first login)');
}

function seedPrinciples() {
  const count = db.prepare('SELECT COUNT(*) AS c FROM wealth_principles').get().c;
  if (count > 0) {
    console.log(`[seed] wealth_principles already present (${count}) — skipping`);
    return;
  }
  const raw = fs.readFileSync(PRINCIPLES_PATH, 'utf8');
  const list = JSON.parse(raw);
  const insert = db.prepare('INSERT INTO wealth_principles (text, weight) VALUES (?, 1)');
  const tx = db.transaction((items) => {
    for (const text of items) insert.run(text);
  });
  tx(list);
  console.log(`[seed] inserted ${list.length} wealth principles`);
}

seedUsers();
seedPrinciples();

console.log('[seed] done.');
