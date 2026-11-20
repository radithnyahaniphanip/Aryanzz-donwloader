# ARYANZZ Membership — AirPay QRIS setup

## Paket dan harga

| Paket | Bulanan | Tahunan |
| --- | ---: | ---: |
| Starter | Rp10.000 | Rp40.000 |
| Pro | Rp66.000 | Rp127.000 |
| Ultra | Rp200.000 | Rp370.000 |
| Max | Rp600.000 | Rp1.600.000 |

Periode bulanan dihitung 30 hari dan tahunan 365 hari.

## Konfigurasi Cloudflare Worker

1. Buka Cloudflare Dashboard.
2. Pilih Worker \`aryanzz-donwloader\`.
3. Buka **Settings → Variables and Secrets**.
4. Tambahkan Secret bernama \`AIRPAY_API_KEY\`.
5. Masukkan API key AirPay. Gunakan key sandbox untuk pengujian awal (\`ak_test_...\`) dan ganti ke key live (\`ak_live_...\`) setelah transaksi uji berhasil.
6. Deploy Worker dari branch rilis yang sudah disetujui.

Jangan masukkan API key ke \`public/index.html\`, \`public/membership-ui.js\`, atau repository.

## Alur pembayaran

1. Browser meminta sesi membership ke \`GET /api/membership/me\`. Sesi memakai cookie acak HttpOnly.
2. Browser membuat pesanan melalui \`POST /api/membership/orders\`.
3. Worker membuat invoice ke \`POST https://airpaygateway.site/api/qris/create\` dengan header \`X-API-Key\`.
4. Browser menampilkan QRIS dan/atau tautan pembayaran AirPay.
5. Worker memeriksa status melalui \`GET https://airpaygateway.site/api/qris/status?transaction_id=...\`.
6. Setelah AirPay mengembalikan status \`Success\` dan referensi/nominal cocok, Durable Object menyimpan transaksi lunas dan mengaktifkan membership.
7. Durable Object alarm memeriksa invoice pending secara berkala, sehingga aktivasi tidak hanya bergantung pada tab checkout yang masih terbuka.

Endpoint status internal ARYANZZ:
- \`GET /api/membership/orders/status?orderId=...\`

Webhook opsional:
- \`POST /api/membership/webhook\`
- Signature diperiksa menggunakan HMAC-SHA256 atas raw request body dan API key AirPay.

## Metode pembayaran

AirPay yang terhubung pada implementasi ini membuat invoice QRIS dinamis. Pengguna membayar dengan memindai QR menggunakan aplikasi yang mendukung QRIS, misalnya DANA, GoPay, LinkAja, OVO, atau mobile banking.

Implementasi ini **tidak** meminta nomor rekening/nomor HP pembeli dan **tidak** melakukan push-payment atau transfer langsung ke rekening/e-wallet pembeli. Pencairan saldo merchant adalah proses payout terpisah dari pembayaran pelanggan.

## Penyimpanan

Membership dan pesanan disimpan di Durable Object \`MembershipStore\`; tidak memerlukan binding D1 tambahan. Worker memakai satu instance Durable Object global untuk sesi dan pesanan membership pada rilis awal.

## Pemeriksaan sebelum live

- [ ] \`AIRPAY_API_KEY\` sandbox sudah dipasang.
- [ ] Uji pembuatan invoice dan QR URL berhasil.
- [ ] Uji pembayaran sandbox menghasilkan status \`Success\`.
- [ ] Membership aktif dengan tier dan tanggal kedaluwarsa yang benar.
- [ ] Status invoice pending/expired tidak mengaktifkan membership.
- [ ] Ganti secret sandbox ke live hanya setelah seluruh tes lulus.
- [ ] Uji satu transaksi live bernilai rendah sebelum membuka checkout ke semua pengguna.
