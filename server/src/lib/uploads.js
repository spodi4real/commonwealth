import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Receipts live at <repo>/receipts/ — gitignored. Path returned to the
// client is relative to this dir (just the filename) so it survives moves.
export const RECEIPTS_DIR = path.resolve(__dirname, '..', '..', '..', 'receipts');
fs.mkdirSync(RECEIPTS_DIR, { recursive: true });

function safeBaseName(s) {
  return String(s || 'receipt')
    .normalize('NFKD')
    .replace(/[^\w\s.-]/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase()
    .slice(0, 60) || 'receipt';
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, RECEIPTS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase().slice(0, 8);
    // Filename: <tx_id>-<sanitised name>-<timestamp><ext>. The timestamp
    // prevents collisions if the user re-uploads.
    const base = safeBaseName(req.body?.label ?? req.params?.id ?? 'receipt');
    const ts = Date.now();
    cb(null, `${req.params?.id ?? 'tx'}-${base}-${ts}${ext}`);
  },
});

export const receiptUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB — generous for a phone photo
  fileFilter: (req, file, cb) => {
    // Accept images and PDFs. Reject everything else to keep the folder sane.
    const ok = /^image\/(jpe?g|png|webp|heic|heif|gif)$/i.test(file.mimetype)
            || file.mimetype === 'application/pdf';
    cb(ok ? null : new Error('only image or PDF receipts'), ok);
  },
});

export function deleteReceipt(filename) {
  if (!filename) return;
  const full = path.join(RECEIPTS_DIR, path.basename(filename));
  try { fs.unlinkSync(full); } catch { /* ignore */ }
}
