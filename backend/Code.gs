// =============================================
// GudangApp — Google Apps Script Backend v4.4
// Multi-Gudang: Shell & Office
// + Sistem Login & Role (Super Admin, Supervisor, Petugas, Finance)
// v4.1: return rusak kini mengurangi stok; update stok dipusatkan di updateStok()
// v4.2: aksi editProduk (ubah nama/satuan/stok/min berdasarkan kode)
// v4.3: aksi getAll (semua data Shell & Office dalam satu permintaan)
// v4.4: role Super Admin + Kelola User (getUsers, saveUser, hapusUser) khusus Super Admin;
//       role dicek ulang ke sheet Users di setiap permintaan
// =============================================

// Ganti string ini dengan teks rahasia bebas milik Anda sendiri
// (dipakai untuk menandatangani token login — jangan dibagikan ke siapa pun)
const SECRET = 'GANTI_DENGAN_SECRET_ANDA'; // isi teks rahasia sendiri sebelum deploy

function doGet(e) {
  const params = e.parameter || {};
  const callback = params.callback || null;
  const result = handleAction(params);
  return buildResponse(result, callback);
}

function doPost(e) {
  const params = e.parameter || {};
  if (e.postData) {
    try { Object.assign(params, JSON.parse(e.postData.contents)); } catch(err) {}
  }
  const callback = params.callback || null;
  const result = handleAction(params);
  return buildResponse(result, callback);
}

function buildResponse(result, callback) {
  if (callback) {
    return ContentService
      .createTextOutput(callback + '(' + JSON.stringify(result) + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function handleAction(params) {
  const action = params.action;
  const gudang = params.gudang || 'Shell';
  try {
    // ---- Aksi yang tidak butuh login ----
    if (action === 'login') return login(params.username, params.password);
    if (action === 'ping')  return { status: 'ok' };

    // ---- Semua aksi lain wajib login ----
    const user = requireAuth(params);
    if (!user) {
      return { error: 'unauthorized', message: 'Sesi tidak valid atau sudah habis, silakan login ulang.' };
    }

    // ---- Kelola user: khusus Super Admin ----
    const userActions = ['getUsers', 'saveUser', 'hapusUser'];
    if (userActions.indexOf(action) !== -1) {
      if (user.role !== 'superadmin') {
        return { error: 'forbidden', message: 'Kelola user hanya untuk Super Admin.' };
      }
      if (action === 'getUsers')  return getUsers();
      if (action === 'saveUser')  return saveUser(JSON.parse(params.data), user);
      if (action === 'hapusUser') return hapusUser(params.username, user);
    }

    // ---- Role "finance" hanya boleh membaca data ----
    const writeActions = ['saveProduk', 'editProduk', 'hapusProduk', 'addTransaksi', 'addReturn'];
    if (writeActions.indexOf(action) !== -1 && user.role === 'finance') {
      return { error: 'forbidden', message: 'Akun Finance hanya memiliki akses lihat (read-only).' };
    }

    if (action === 'getAll')           return getAll();
    if (action === 'getProduk')        return getProduk(gudang);
    if (action === 'saveProduk')       return saveProduk(JSON.parse(params.data), gudang);
    if (action === 'editProduk')       return editProduk(JSON.parse(params.data), gudang);
    if (action === 'hapusProduk')      return hapusProduk(params.kode, gudang);
    if (action === 'getTransaksi')     return getTransaksi(gudang);
    if (action === 'addTransaksi')     return addTransaksi(JSON.parse(params.data), gudang);
    if (action === 'getReturn')        return getReturn(gudang);
    if (action === 'addReturn')        return addReturn(JSON.parse(params.data), gudang);
    return { error: 'Action tidak dikenal: ' + action };
  } catch(err) {
    return { error: err.toString() };
  }
}

// ================= AUTH / LOGIN =================

function toHex(bytes) {
  return bytes.map(function(b) {
    const v = (b < 0 ? b + 256 : b);
    return ('0' + v.toString(16)).slice(-2);
  }).join('');
}

function hashPassword(password) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password + SECRET);
  return toHex(digest);
}

function generateToken(user) {
  const payload = {
    u: user.username,
    r: user.role,
    n: user.nama,
    e: Date.now() + 8 * 3600 * 1000 // berlaku 8 jam
  };
  const payloadB64 = Utilities.base64EncodeWebSafe(Utilities.newBlob(JSON.stringify(payload)).getBytes());
  const sig = toHex(Utilities.computeHmacSha256Signature(payloadB64, SECRET));
  return payloadB64 + '.' + sig;
}

function verifyToken(token) {
  if (!token) return null;
  const parts = String(token).split('.');
  if (parts.length !== 2) return null;
  const payloadB64 = parts[0];
  const sig = parts[1];
  const expectedSig = toHex(Utilities.computeHmacSha256Signature(payloadB64, SECRET));
  if (sig !== expectedSig) return null;
  try {
    const json = Utilities.newBlob(Utilities.base64DecodeWebSafe(payloadB64)).getDataAsString();
    const payload = JSON.parse(json);
    if (Date.now() > payload.e) return null; // token kadaluarsa
    return { username: payload.u, role: payload.r, nama: payload.n };
  } catch(e) {
    return null;
  }
}

// Daftar role yang sah. Role lama 'admin' dianggap 'superadmin'.
const ROLES = ['superadmin', 'supervisor', 'petugas', 'finance'];
function normalizeRole(r) {
  r = String(r || '').toLowerCase().trim();
  return r === 'admin' ? 'superadmin' : r;
}

// Token harus valid DAN user masih ada di sheet Users.
// Role diambil dari sheet, jadi perubahan role/hapus user langsung berlaku.
function requireAuth(params) {
  const t = verifyToken(params.token);
  if (!t) return null;
  const data = getSheet('Users').getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).toLowerCase() === String(t.username).toLowerCase()) {
      return { username: String(data[i][0]), role: normalizeRole(data[i][2]), nama: String(data[i][3]) };
    }
  }
  return null;
}

function login(username, password) {
  if (!username || !password) {
    return { success: false, error: 'Username dan password wajib diisi' };
  }
  const sheet = getSheet('Users');
  const data = sheet.getDataRange().getValues();
  const hash = hashPassword(password);
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).toLowerCase() === String(username).toLowerCase()) {
      if (String(data[i][1]) === hash) {
        const user = { username: data[i][0], role: normalizeRole(data[i][2]), nama: data[i][3] };
        return {
          success: true,
          token: generateToken(user),
          role: user.role,
          nama: user.nama,
          username: user.username
        };
      }
      return { success: false, error: 'Password salah' };
    }
  }
  return { success: false, error: 'Username tidak ditemukan' };
}

// Jalankan fungsi ini SEKALI SAJA secara manual dari editor Apps Script
// (pilih "setupUsers" di dropdown function lalu klik Run) untuk membuat
// akun awal. Aman dijalankan berkali-kali — tidak akan menimpa data yang sudah ada.
function setupUsers() {
  const sheet = getSheet('Users');
  const data = sheet.getDataRange().getValues();
  if (data.length > 1) {
    Logger.log('Sheet Users sudah berisi data, tidak ditimpa.');
    return;
  }
  const seed = [
    ['admin',      hashPassword('admin123'),   'superadmin', 'Solehudin Thaib'],
    ['supervisor', hashPassword('super123'),   'supervisor', 'Supervisor Gudang'],
    ['petugas',    hashPassword('petugas123'), 'petugas',    'Petugas Gudang'],
    ['finance',    hashPassword('finance123'), 'finance',    'Divisi Finance'],
  ];
  seed.forEach(function(r) { sheet.appendRow(r); });
  Logger.log('4 akun berhasil dibuat di sheet Users.');
}

// Jalankan SEKALI dari editor untuk mengganti akun "dosen" lama menjadi "finance".
// Aman dijalankan berkali-kali (tidak berefek jika baris "dosen" sudah tidak ada).
function migrasiDosenKeFinance() {
  const sheet = getSheet('Users');
  const data = sheet.getDataRange().getValues();
  let found = false;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).toLowerCase() === 'dosen' || String(data[i][2]).toLowerCase() === 'dosen') {
      sheet.getRange(i + 1, 1, 1, 4).setValues([[
        'finance', hashPassword('finance123'), 'finance', 'Divisi Finance'
      ]]);
      found = true;
      break;
    }
  }
  Logger.log(found ? 'Akun dosen berhasil diubah menjadi finance.' : 'Tidak ditemukan akun dengan role dosen.');
}

// Jalankan SEKALI dari editor (opsional) untuk mengubah tulisan role 'admin'
// menjadi 'superadmin' di sheet Users. Tanpa ini pun aplikasi tetap
// menganggap 'admin' sebagai Super Admin.
function migrasiAdminKeSuperAdmin() {
  const sheet = getSheet('Users');
  const data = sheet.getDataRange().getValues();
  let n = 0;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][2]).toLowerCase().trim() === 'admin') {
      sheet.getRange(i + 1, 3).setValue('superadmin'); n++;
    }
  }
  Logger.log(n + ' akun diubah menjadi superadmin.');
}

// ================= KELOLA USER (khusus Super Admin) =================
function getUsers() {
  const data = getSheet('Users').getDataRange().getValues();
  return {
    success: true,
    data: data.slice(1).filter(r => r[0] !== '').map(r => ({
      username: String(r[0]), role: normalizeRole(r[2]), nama: String(r[3])
    })) // PasswordHash tidak pernah dikirim ke browser
  };
}

function hitungSuperAdmin(data) {
  let n = 0;
  for (let i = 1; i < data.length; i++) if (normalizeRole(data[i][2]) === 'superadmin') n++;
  return n;
}

// u: { username, nama, role, password, isNew }
function saveUser(u, pelaku) {
  const username = String(u.username || '').trim().toLowerCase();
  const nama = String(u.nama || '').trim();
  const role = normalizeRole(u.role);
  const password = String(u.password || '');
  if (!/^[a-z0-9._-]{3,30}$/.test(username))
    return { success: false, error: 'Username 3–30 karakter: huruf kecil, angka, titik, minus, atau garis bawah' };
  if (!nama) return { success: false, error: 'Nama wajib diisi' };
  if (ROLES.indexOf(role) === -1) return { success: false, error: 'Role tidak dikenal' };
  if (password && password.length < 6) return { success: false, error: 'Password minimal 6 karakter' };

  const sheet = getSheet('Users');
  const data = sheet.getDataRange().getValues();
  let row = -1;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).toLowerCase() === username) { row = i; break; }
  }

  if (u.isNew) {
    if (row !== -1) return { success: false, error: 'Username "' + username + '" sudah dipakai' };
    if (!password) return { success: false, error: 'Password wajib diisi untuk user baru' };
    sheet.appendRow([username, hashPassword(password), role, nama]);
    return { success: true };
  }

  if (row === -1) return { success: false, error: 'User tidak ditemukan' };
  const roleLama = normalizeRole(data[row][2]);
  if (roleLama === 'superadmin' && role !== 'superadmin') {
    if (username === String(pelaku.username).toLowerCase())
      return { success: false, error: 'Anda tidak bisa menurunkan role akun Anda sendiri' };
    if (hitungSuperAdmin(data) <= 1)
      return { success: false, error: 'Harus ada minimal satu Super Admin' };
  }
  sheet.getRange(row + 1, 3, 1, 2).setValues([[role, nama]]);
  if (password) sheet.getRange(row + 1, 2).setValue(hashPassword(password));
  return { success: true };
}

function hapusUser(username, pelaku) {
  username = String(username || '').toLowerCase();
  if (username === String(pelaku.username).toLowerCase())
    return { success: false, error: 'Anda tidak bisa menghapus akun Anda sendiri' };
  const sheet = getSheet('Users');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).toLowerCase() === username) {
      if (normalizeRole(data[i][2]) === 'superadmin' && hitungSuperAdmin(data) <= 1)
        return { success: false, error: 'Harus ada minimal satu Super Admin' };
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { success: false, error: 'User tidak ditemukan' };
}

// ---- HELPER: get or create sheet ----
function getSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    // Add headers based on sheet type
    if (name.includes('Produk')) {
      sheet.appendRow(['Kode','Nama','Satuan','Stok','MinStok']);
    } else if (name.includes('Transaksi')) {
      sheet.appendRow(['ID','Tanggal','Jam','Jenis','Nama','Kode','Qty','Satuan','Referensi','Pihak']);
    } else if (name.includes('Return')) {
      sheet.appendRow(['ID','Tanggal','Jam','Nama','Kode','Qty','Satuan','Supplier','Faktur','Keterangan']);
    } else if (name === 'Users') {
      sheet.appendRow(['Username','PasswordHash','Role','Nama']);
    }
  }
  return sheet;
}

// ---------- SEMUA DATA (dipakai saat aplikasi dibuka / sinkronisasi) ----------
function getAll() {
  const hasil = { success: true };
  ['Shell', 'Office'].forEach(function(g) {
    hasil[g] = {
      produk:     getProduk(g).data,
      transaksi:  getTransaksi(g).data,
      returnData: getReturn(g).data
    };
  });
  return hasil;
}

// ---------- PRODUK ----------
function getProduk(gudang) {
  const sheet = getSheet('Produk_' + gudang);
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return { data: [] };
  return {
    data: data.slice(1).map(r => ({
      kode: String(r[0]), nama: String(r[1]), satuan: String(r[2]),
      stok: Number(r[3]), min: Number(r[4])
    }))
  };
}

function saveProduk(produk, gudang) {
  const g = produk.gudang || gudang;
  const sheet = getSheet('Produk_' + g);
  const data = sheet.getDataRange().getValues();
  let found = false;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(produk.kode) ||
        String(data[i][1]).toLowerCase() === String(produk.nama).toLowerCase()) {
      // Jika dari upload (isUpload=true): jumlahkan stok, update nama & satuan
      // Jika dari form manual (isUpload=false): timpa seluruh data
      if (produk.isUpload) {
        const stokLama = Number(data[i][3]);
        const stokBaru = stokLama + Number(produk.stok);
        const minBaru = produk.min > 0 ? Number(produk.min) : Number(data[i][4]);
        sheet.getRange(i+1,1,1,5).setValues([[
          produk.kode || data[i][0],
          produk.nama,
          produk.satuan || data[i][2],
          stokBaru,
          minBaru
        ]]);
      } else {
        sheet.getRange(i+1,1,1,5).setValues([[produk.kode,produk.nama,produk.satuan,produk.stok,produk.min]]);
      }
      found = true; break;
    }
  }
  if (!found) sheet.appendRow([produk.kode,produk.nama,produk.satuan,produk.stok,produk.min]);
  return { success: true };
}

// Edit produk berdasarkan Kode (Kode tidak bisa diubah).
// Jika nama berubah, kolom Nama di Transaksi & Return dengan Kode yang sama ikut diperbarui.
function editProduk(p, gudang) {
  const g = p.gudang || gudang;
  const kode = String(p.kode || '');
  const nama = String(p.nama || '').trim();
  if (!kode) return { success: false, error: 'Kode produk kosong' };
  if (!nama) return { success: false, error: 'Nama barang tidak boleh kosong' };

  const sheet = getSheet('Produk_' + g);
  const data = sheet.getDataRange().getValues();
  let row = -1;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === kode) { row = i; continue; }
    if (String(data[i][1]).toLowerCase() === nama.toLowerCase()) {
      return { success: false, error: 'Nama "' + nama + '" sudah dipakai produk lain (' + data[i][0] + ')' };
    }
  }
  if (row === -1) return { success: false, error: 'Produk dengan kode ' + kode + ' tidak ditemukan' };

  const namaLama = String(data[row][1]);
  sheet.getRange(row + 1, 2, 1, 4).setValues([[
    nama,
    p.satuan || data[row][2],
    p.stok !== undefined && p.stok !== '' ? Number(p.stok) : data[row][3],
    p.min  !== undefined && p.min  !== '' ? Number(p.min)  : data[row][4]
  ]]);

  let riwayat = 0;
  if (namaLama !== nama) {
    riwayat += gantiNamaRiwayat('Transaksi_' + g, 5, 4, kode, nama); // Kode kolom F, Nama kolom E
    riwayat += gantiNamaRiwayat('Return_' + g, 4, 3, kode, nama);    // Kode kolom E, Nama kolom D
  }
  return { success: true, riwayatDiperbarui: riwayat };
}

// HELPER: ganti Nama di sheet riwayat untuk baris dengan Kode tertentu
function gantiNamaRiwayat(sheetName, idxKode, idxNama, kode, namaBaru) {
  const sh = getSheet(sheetName);
  const d = sh.getDataRange().getValues();
  if (d.length <= 1) return 0;
  let n = 0;
  const kolomNama = d.slice(1).map(r => {
    if (String(r[idxKode]) === kode) { n++; return [namaBaru]; }
    return [r[idxNama]];
  });
  if (n > 0) sh.getRange(2, idxNama + 1, kolomNama.length, 1).setValues(kolomNama);
  return n;
}

function hapusProduk(kode, gudang) {
  const sheet = getSheet('Produk_' + gudang);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(kode)) { sheet.deleteRow(i+1); break; }
  }
  return { success: true };
}

// ---------- TRANSAKSI ----------
function normalizeDate(val) {
  if (!val) return '';
  if (val instanceof Date) {
    // Format as YYYY-MM-DD using local timezone
    const y = val.getFullYear();
    const m = String(val.getMonth()+1).padStart(2,'0');
    const d = String(val.getDate()).padStart(2,'0');
    return y+'-'+m+'-'+d;
  }
  const s = String(val).trim();
  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0,10);
  // Try parse
  try {
    const dt = new Date(s);
    if (!isNaN(dt.getTime())) {
      const y = dt.getFullYear();
      const m = String(dt.getMonth()+1).padStart(2,'0');
      const d = String(dt.getDate()).padStart(2,'0');
      return y+'-'+m+'-'+d;
    }
  } catch(e) {}
  return s;
}

function getTransaksi(gudang) {
  const sheet = getSheet('Transaksi_' + gudang);
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return { data: [] };
  return {
    data: data.slice(1).map(r => ({
      id: String(r[0]), tanggal: normalizeDate(r[1]), jam: String(r[2]),
      jenis: String(r[3]), nama: String(r[4]), kode: String(r[5]),
      qty: Number(r[6]), satuan: String(r[7]), ref: String(r[8]), pihak: String(r[9])
    }))
  };
}

function addTransaksi(tr, gudang) {
  const g = tr.gudang || gudang;
  const sheet = getSheet('Transaksi_' + g);
  sheet.appendRow([tr.id,normalizeDate(tr.tanggal)||tr.tanggal,tr.jam,tr.jenis,tr.nama,tr.kode,tr.qty,tr.satuan,tr.ref||'',tr.pihak||'']);
  // Update stok: masuk menambah, keluar mengurangi
  const delta = tr.jenis === 'masuk' ? Number(tr.qty) : -Number(tr.qty);
  updateStok(g, tr.kode, tr.nama, delta);
  return { success: true };
}

// ---- HELPER: ubah stok produk berdasarkan kode atau nama ----
function updateStok(gudang, kode, nama, delta) {
  const ps = getSheet('Produk_' + gudang);
  const pd = ps.getDataRange().getValues();
  for (let i = 1; i < pd.length; i++) {
    if ((kode && String(pd[i][0]) === String(kode)) ||
        String(pd[i][1]).toLowerCase() === String(nama).toLowerCase()) {
      ps.getRange(i+1,4).setValue(Number(pd[i][3]) + Number(delta));
      return true;
    }
  }
  return false; // produk tidak ditemukan, stok tidak diubah
}

// ---------- RETURN ----------
function getReturn(gudang) {
  const sheet = getSheet('Return_' + gudang);
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return { data: [] };
  return {
    data: data.slice(1).map(r => ({
      id: String(r[0]), tanggal: String(r[1]), jam: String(r[2]),
      nama: String(r[3]), kode: String(r[4]), qty: Number(r[5]),
      satuan: String(r[6]), supplier: String(r[7]),
      faktur: String(r[8]), keterangan: String(r[9])
    }))
  };
}

function addReturn(ret, gudang) {
  const g = ret.gudang || gudang;
  const sheet = getSheet('Return_' + g);
  sheet.appendRow([ret.id,ret.tanggal,ret.jam,ret.nama,ret.kode||'',
                   ret.qty,ret.satuan,ret.supplier||'',ret.faktur||'',ret.keterangan||'']);
  // Barang rusak dikembalikan ke supplier -> stok berkurang
  updateStok(g, ret.kode, ret.nama, -Number(ret.qty));
  return { success: true };
}

