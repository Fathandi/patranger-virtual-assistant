# wa-automation-free (Virtual Assistant WhatsApp + AI)

Virtual assistant yang terhubung ke **WhatsApp** (via transport `WhatsAppWeb` atau `Baileys`), lalu:
- menerima pesan masuk,
- melakukan **routing** dan manajemen konteks,
- menjalankan **analisis & generate reply** pakai AI (Pollinations),
- mengamankan akses dengan **OTP flow** (register/verify/resend) via email (SMTP),
- menyimpan data (user/session/messages/analysis) ke **MySQL**.

> Catatan: ada dua adapter transport WhatsApp yang bisa dipilih lewat environment `USE_BAILEYS`.

---

## Fitur Utama

- **Transport WhatsApp**: `WhatsAppWebAdapter` atau `BaileysAdapter`
- **OTP-based access**:
  - Register user: generate OTP + kirim email via SMTP
  - Verify OTP: buat session user
  - Resend OTP: cooldown resend
  - Guard access: hanya allowed WA IDs / admin yang bisa mengakses
- **AI reply**:
  - `AnalyzeMessage` (menghasilkan analisis/intent/sentimen berbasis AI)
  - `GenerateReply` (membuat balasan)
- **Persistence** (MySQL): tabel `contacts`, `user_verification`, `user_sessions`, `messages`, `message_analysis`
- **Context**:
  - `ContextStoreGateway` untuk menyimpan konteks percakapan

---

## Tech Stack

- Node.js + **TypeScript**
- WhatsApp:
  - `whatsapp-web.js` (WhatsApp Web)
  - `@whiskeysockets/baileys` (opsional)
- DB: **MySQL** (`mysql2/promise`)
- Email: **SMTP** (`nodemailer`)
- AI: **Pollinations** (`axios`)
- Logging: `pino`

---

## Prasyarat

1. Node.js 18+
2. MySQL (jika `DB_REQUIRED=true`)
3. Akun email SMTP (jika OTP/email digunakan)
4. API key Pollinations
5. Akses ke WhatsApp (butuh pairing / session tersimpan di folder `WA_SESSION_DIR`)

---

## Environment Variables

Buat file `.env` di root repo. Kunci environment yang dibutuhkan mengikuti `src/config/index.ts`.

Minimal (akan dipakai saat boot):

### Database
- `DB_REQUIRED` (default: `false`)
- `DB_INIT_RETRIES` (default: `5`)
- `DB_INIT_RETRY_DELAY_MS` (default: `2000`)
- `MYSQL_HOST` (default: `127.0.0.1`)
- `MYSQL_PORT` (default: `3306`)
- `MYSQL_USER` (default: `root` jika `DB_REQUIRED=false`)
- `MYSQL_PASSWORD` (default: kosong jika `DB_REQUIRED=false`)
- `MYSQL_DATABASE` (default: `wa_automation` jika `DB_REQUIRED=false`)
- `MYSQL_POOL_SIZE` (default: `5`)

### AI (Pollinations)
- `POLLINATIONS_ENDPOINT` (wajib)
- `POLLINATIONS_MODEL` (wajib)
- `POLLINATIONS_API_KEY` (wajib)
- `AI_TIMEOUT_MS` (wajib)

### Rate / Throttle
- `BOT_THROTTLE_MS` (wajib)

### WhatsApp
- `USE_BAILEYS` (default: `false`)
- `WA_SESSION_DIR` (wajib) — folder penyimpanan session/auth
- `ALLOWED_WA_IDS` (wajib, format comma-separated, contoh: `62812xxxx,62813xxxx`)
- `ADMIN_WA_IDS` (opsional, jika dipakai di logic akses)

### SMTP Email (Nodemailer)
- `SMTP_HOST` (wajib)
- `SMTP_PORT` (wajib)
- `SMTP_USER` (wajib)
- `SMTP_PASS` (wajib)
- `SMTP_SECURE` (default: `false`)
- `SMTP_FROM` (wajib) — alamat sender

### OTP
- `OTP_LENGTH` (wajib)
- `OTP_EXPIRE_MINUTES` (wajib)
- `OTP_MAX_ATTEMPTS` (wajib)
- `OTP_HASH_SECRET` (wajib)
- `OTP_BLOCK_MINUTES` (default: `15`)
- `OTP_RESEND_COOLDOWN_MINUTES` (default: `1`)

### Logging
- `LOG_LEVEL` (default: `info`)

---

## Instalasi

```bash
npm install
```

---

## Menjalankan

### Mode Development

```bash
npm run dev
```

### Production

```bash
npm run build
npm start
```

---

## Setup WhatsApp Transport

Project mendukung 2 pilihan transport:

- Jika `USE_BAILEYS=true`:
  - aplikasi menggunakan `BaileysAdapter`
- Jika `USE_BAILEYS=false`:
  - aplikasi menggunakan `WhatsAppWebAdapter`

Session/auth disimpan di folder `WA_SESSION_DIR`.

Referensi tambahan:
- [Baileys.md](./Baileys.md)

---

## Cara Kerja (High Level)

1. Bootstrapping (`src/index.ts`)
2. Load config dari `.env`
3. Inisialisasi DB (MySQL) — jika tersedia, repository pakai MySQL; jika tidak, repository null
4. Inisialisasi AI adapter (Pollinations)
5. Inisialisasi SMTP adapter
6. Pilih transport WhatsApp (WhatsApp Web / Baileys)
7. Wire use-cases:
   - RegisterUser, VerifyOTP, ResendOTP, GuardAccess
   - RouteMessage, AnalyzeMessage, GenerateReply
8. Controller menerima event pesan dan melakukan flow sesuai kebutuhan

---

## Notes & Troubleshooting

- **WhatsApp disconnect / re-auth diperlukan**
  - Pastikan `WA_SESSION_DIR` benar dan foldernya persistent
  - Jika ada perubahan environment yang memengaruhi transport, pairing mungkin perlu dilakukan ulang

- **MySQL tidak terhubung**
  - Cek `DB_REQUIRED` dan variabel `MYSQL_*`
  - DatabaseConnection melakukan retry sesuai `DB_INIT_RETRIES`

- **Email OTP tidak terkirim**
  - Cek variabel SMTP: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `SMTP_SECURE`

- **AI reply gagal**
  - Cek `POLLINATIONS_API_KEY`, `POLLINATIONS_ENDPOINT`, `POLLINATIONS_MODEL`, dan `AI_TIMEOUT_MS`

---

## Dokumen AI (Pollinations)

Referensi:
- [Pollinations.md](./Pollinations.md)

---

## Script yang tersedia

- `npm run dev` — watch + jalankan dari `src/index.ts`
- `npm run build` — compile TypeScript
- `npm start` — run `dist/index.js`
- `npm run lint` — eslint

---

## License

MIT

