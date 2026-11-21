# Mengaktifkan pembayaran AirPay ARYANZZ

ARYANZZ membuat invoice QRIS melalui server Cloudflare Worker. API Key tidak boleh ditaruh di JavaScript browser, HTML, repository, atau dikirim melalui chat.

## Status yang harus tersedia

Endpoint publik `/api/membership/payment-config` perlu mengembalikan:

- `apiKeyReady: true`
- `identityReady: true`
- `checkoutEnabled: true`

`AUTH_DB` dan `AUTH_SESSION_SECRET` diperlukan untuk sinkronisasi akun/Membership lintas perangkat, tetapi bukan syarat untuk checkout yang terikat ke perangkat jika sesi perangkat sudah tersedia.

## Opsi A — GitHub Actions Secret

1. Buka repository ARYANZZ di GitHub.
2. Masuk ke **Settings → Secrets and variables → Actions**.
3. Pilih **New repository secret**.
4. Isi nama persis `AIRPAY_API_KEY`.
5. Tempel API Key AirPay milik pemilik akun, lalu simpan.
6. Setelah perubahan ARYANZZ digabung ke `main`, workflow deployment akan menyalin secret itu ke Cloudflare Worker melalui `wrangler secret put`.

Jangan menaruh nilai API Key pada file source atau commit Git.

## Opsi B — Cloudflare Worker Secret

1. Buka Cloudflare Dashboard → **Workers & Pages**.
2. Pilih Worker `aryanzz-donwloader`.
3. Buka **Settings → Variables and Secrets**.
4. Tambahkan variable bertipe **Secret** dengan nama `AIRPAY_API_KEY`.
5. Masukkan API Key AirPay, simpan, lalu deploy versi Worker.

Jika Worker cadangan juga digunakan, tambahkan secret yang sama pada Worker `aryanzz-backup`.

## Verifikasi

Buka:

`https://aryanzz-donwloader.aryanz.workers.dev/api/membership/payment-config`

Jangan membagikan respons yang mengandung informasi rahasia. Respons ini hanya menampilkan status kesiapan, bukan nilai API Key.

Setelah `apiKeyReady` dan `identityReady` bernilai true, buka kembali halaman Membership. Tombol **Lanjut checkout** akan membuka formulir checkout dan tombol invoice akan mengirim permintaan ke endpoint server `/api/membership/orders`. QRIS hanya ditampilkan setelah AirPay mengembalikan invoice yang valid.

## Pengujian pembayaran

Gunakan API Key sandbox terlebih dahulu bila tersedia. Jangan melakukan pembayaran produksi untuk menguji alur. Pastikan webhook `/api/membership/webhook` dan pemeriksaan status server merespons sebelum mengaktifkan pembayaran untuk pengguna.
