# AirPay: kasus 403, sandbox, dan keamanan ARYANZZ

Dokumentasi yang digunakan: https://airpaygateway.site/docs

## Perbedaan respons

- **401**: API Key kosong atau salah. Buat key baru melalui dashboard dan atur nilai baru sebagai Cloudflare Worker Secret `AIRPAY_API_KEY`. Jangan memasukkan key ke Git atau browser.
- **403**: Dokumentasi AirPay menyebut **akun merchant dibanned/diblokir**. Kunci yang terpasang saja tidak menyatakan merchant diperbolehkan membuat QRIS. Periksa status dashboard AirPay dan hubungi dukungan resmi melalui situs AirPay. Mengganti key dengan kunci sandbox **tidak** mengaktifkan transaksi live atau menghapus blokir.
- **503**: Gangguan layanan AirPay, coba lagi setelah layanan pulih.
- **422**: Nominal/parameter tagihan tidak sesuai persyaratan gateway.

Pada `/api/membership/payment-config`, `apiKeyReady` hanya berarti Secret terisi, sementara `gatewayAuthorization: not-verified` berarti belum ada tagihan yang diterima gateway untuk memverifikasi izin merchant. Jangan mengartikan ini sebagai merchant sudah aktif.

## Kunci sandbox

Kunci `ak_test_...` digunakan hanya untuk transaksi **simulasi** tanpa uang berpindah. **Jangan pernah memasang kunci sandbox sebagai `AIRPAY_API_KEY` pada Worker produksi**. Kode ARYANZZ akan memblokir pembuatan tagihan sandbox di website produksi agar pembayaran yang disimulasikan tidak membuka Membership berbayar.

Jika membutuhkan pengujian sandbox terisolasi, gunakan Worker **staging terpisah**, state dan Durable Object terpisah dari produksi, dengan:
1. Secret `AIRPAY_API_KEY` berisi key sandbox **baru** langsung di Cloudflare Worker staging.
2. Variabel `ARYANZZ_PAYMENT_MODE=sandbox` untuk mengizinkan request sandbox pada Worker staging saja.
3. `ARYANZZ_PUBLIC_ORIGIN` berupa URL staging milikmu, bukan `https://aryanzz-donwloader.aryanz.workers.dev` atau `https://aryanzz-backup.aryanz.workers.dev`.
4. Tidak berbagi basis pengguna, status Membership, atau endpoint webhook dari Worker produksi.
5. Uji pembuatan invoice dan simulasi pembayaran melalui antarmuka sandbox AirPay, tanpa transaksi bank sungguhan.

Saat selesai, matikan staging atau hapus Secret sandbox di sana. Ganti key yang pernah muncul dalam chat atau screenshot; jangan posting key lagi di issue, log, repositori, atau chat.

## Alur pembayaran live

Pilih paket -> Worker membuat invoice via `POST /api/qris/create` -> QRIS resmi ditampilkan sesuai `qr_url` -> hitung mundur 10 menit pada checkout ARYANZZ -> status dicek server via `GET /api/qris/status`, sementara webhook bertanda tangan menjadi notifikasi tambahan -> hanya status **Success** yang terverifikasi server akan mengaktifkan Membership.

AirPay sendiri menyatakan invoice berlaku 15 menit. ARYANZZ sengaja menampilkan waktu checkout lokal 10 menit, lalu menyembunyikan QR tanpa menghentikan rekonsiliasi transaksi yang mungkin selesai belakangan. Jangan mengaktifkan Membership hanya berdasarkan redirect query, tangkapan layar, atau notifikasi dari browser.

Untuk menerima QRIS live kembali setelah respons 403, langkah yang diperlukan adalah **pemulihan izin akun merchant dari pihak AirPay**, bukan patch tombol frontend.
