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


## Uji tombol "Kirim tes" AirPay (HTTP 401)

Di dashboard AirPay, tombol **Kirim tes** mengirim event `webhook.test` yang
ditandatangani dengan **API key sandbox**, meskipun Worker produksi memakai
`AIRPAY_API_KEY` **live**. Perbedaan kunci membuat signature HMAC tidak cocok
dan endpoint lama mengembalikan HTTP 401. Kesalahan ini **tidak otomatis berarti
akun AirPay diblokir** atau pembayaran live gagal.

1. Buat/rotasi API key sandbox khusus pengujian melalui dashboard AirPay.
   Jangan gunakan ulang key sandbox yang pernah dikirim dalam chat atau screenshot.
2. Di Cloudflare → Workers & Pages → `aryanzz-donwloader` →
   **Settings → Variables and Secrets**, tambahkan Secret
   `AIRPAY_WEBHOOK_TEST_KEY` dengan nilai key sandbox yang digunakan AirPay
   untuk webhook tes (harus berawalan `ak_test_`).
3. **Pertahankan** `AIRPAY_API_KEY` sebagai key LIVE untuk transaksi sungguhan.
   Jangan menggantinya dengan sandbox di Worker produksi.
4. Pastikan URL webhook di AirPay adalah
   `https://aryanzz-donwloader.aryanz.workers.dev/api/membership/webhook`.
5. Deploy perubahan Worker, lalu klik **Kirim tes**. Hasil yang diharapkan:
   HTTP 200 dengan `event: webhook.test`. Event ini hanya diakui; tidak
   mencari pesanan, mengubah saldo, atau mengaktifkan Membership.

Jika masih HTTP 401, periksa apakah sandbox key yang dipakai **sama persis**
dengan kunci penanda tangan tes AirPay dan apakah deployment memakai versi
Worker baru. Jangan pernah menonaktifkan validasi signature untuk memaksakan
HTTP 200.

**Batas pengujian:** Keberhasilan `webhook.test` tidak membuktikan bahwa
invoice LIVE dapat dibuat. Validasi invoice secara terpisah melalui gateway,
kemudian cocokkan status transaksi `Success` melalui server.
