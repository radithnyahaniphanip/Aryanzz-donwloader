# ARYANZZ Membership — AirPay setup

## Paket dan harga

| Paket | Bulanan | Tahunan |
|---|---:|---:|
| Basic | Rp10.000 | Rp40.000 |
| Pro | Rp66.000 | Rp127.000 |
| Ultra | Rp200.000 | Rp370.000 |
| Max | Rp600.000 | Rp1.600.000 |

Harga paket disimpan di src/airpay-membership.js dan harus diubah melalui commit/review, bukan dari input harga di browser. Durasi bulanan adalah 30 hari dan tahunan 365 hari.

## Alur pembayaran

1. Pengguna masuk ke akun ARYANZZ dan memilih paket.
2. Worker membuat order pending di Cloudflare D1.
3. Worker mengirim POST /api/qris/create ke https://airpaygateway.site dengan header X-API-Key dan external_id unik dari order ARYANZZ.
4. AirPay mengembalikan QRIS, pay_url, total bayar, biaya, dan masa berlaku.
5. Pengguna membayar dengan aplikasi e-wallet atau mobile banking yang mendukung QRIS.
6. ARYANZZ mengaktifkan Membership hanya setelah menerima webhook AirPay yang tanda tangannya valid, atau setelah status endpoint AirPay mengonfirmasi Success.
7. Browser memeriksa status melalui GET /api/membership/orders/status?orderId=... setiap beberapa detik selama halaman pembayaran terbuka. Query status=paid dari redirect tidak pernah dianggap sebagai bukti pembayaran.

Dokumentasi AirPay menjelaskan header X-API-Key, endpoint create/status, callback_url, serta tanda tangan HMAC-SHA256 pada X-AirPay-Signature. Halaman utama AirPay yang terindeks juga memuat FAQ lama yang menyebut webhook belum tersedia. Karena ada perbedaan informasi publik tersebut, integrasi ARYANZZ memakai pemeriksaan status server sebagai fallback dan tidak bergantung hanya pada webhook.

## Konfigurasi rahasia

Gunakan API key baru setelah melakukan rotasi key yang pernah terlihat di screenshot/chat. Jangan pernah menaruh key di HTML, JavaScript browser, file konfigurasi publik, issue, atau commit.

Pilihan konfigurasi:
- Cloudflare Dashboard → Workers & Pages → aryanzz-donwloader → Settings → Variables and Secrets → tambahkan secret AIRPAY_API_KEY.
- Atau tambahkan GitHub Actions repository secret bernama AIRPAY_API_KEY; workflow akan menyinkronkannya ke Cloudflare Worker pada deployment berikutnya.

Gunakan ak_test_... untuk pengujian jika AirPay menyediakan mode sandbox pada akun merchant. Gunakan ak_live_... hanya setelah semua uji berhasil dan pemilik akun mengizinkan transaksi produksi.

Pastikan Worker juga memiliki binding D1:
- Variable: AUTH_DB
- Database: aryanzz-auth-db

Workflow deployment menjalankan migration 0009_airpay_membership.sql saat D1 tersedia.

## Endpoint ARYANZZ

- GET /api/membership/catalog — daftar paket dan harga.
- GET /api/membership/payment-config — kesiapan database dan API key.
- POST /api/membership/orders — membuat invoice QRIS untuk akun yang login.
- GET /api/membership/orders/status?orderId=... — memeriksa status AirPay dan mengaktifkan Membership jika lunas.
- POST /api/membership/webhook — menerima callback AirPay dan memverifikasi HMAC-SHA256.
- GET /api/membership/me — status Membership dan riwayat pesanan akun.
- GET /api/membership/admin/orders — daftar order untuk administrator.

## Keamanan yang diterapkan

- API key AirPay hanya dipakai dari Cloudflare Worker.
- Harga dan planId divalidasi ulang oleh server; browser tidak dapat menentukan nominal sendiri.
- external_id unik per pesanan.
- Callback harus memiliki HMAC-SHA256 valid menggunakan API key AirPay.
- Status redirect dari browser tidak pernah mengaktifkan Membership.
- Aktivasi mengecek order, provider, ID transaksi, nominal, dan status pembayaran.
- ID transaksi provider unik di database; webhook yang diulang tidak memberi masa Membership tambahan.
- Masa Membership baru diperpanjang setelah pembayaran terverifikasi.
- Pembelian paket baru saat Membership masih aktif akan menambahkan durasi dari tanggal kedaluwarsa yang sedang berjalan.

## Batas metode pembayaran

Dokumentasi AirPay yang tersedia menjelaskan QRIS dinamis. Artinya pelanggan membayar dengan memindai QRIS melalui aplikasi e-wallet atau m-banking yang mendukung QRIS. API yang terdokumentasi tidak menunjukkan endpoint untuk membuat Virtual Account bank terpisah atau mengalihkan pelanggan langsung ke saldo DANA/GoPay/LinkAja. Karena itu ARYANZZ tidak meminta nomor rekening dan nama pemilik rekening pelanggan untuk checkout QRIS. Pengaturan rekening pencairan merchant dilakukan terpisah di dashboard AirPay.

## Sebelum produksi

1. Rotasi API key yang terpapar dan simpan key baru sebagai Worker Secret.
2. Jalankan uji dengan key sandbox/test jika tersedia.
3. Pastikan payment-config menunjukkan checkoutEnabled: true.
4. Buat invoice nominal rendah dan bayar dari aplikasi QRIS.
5. Pastikan status menjadi paid hanya setelah status API/webhook terverifikasi.
6. Uji webhook palsu, nominal salah, order ID tidak cocok, dan replay callback.
7. Baru aktifkan key live setelah uji selesai.
