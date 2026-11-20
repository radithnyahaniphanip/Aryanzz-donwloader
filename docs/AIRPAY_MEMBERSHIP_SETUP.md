# ARYANZZ Membership — AirPay QRIS

## Paket dan harga

| Paket | Bulanan | Tahunan | Fasilitas utama |
| --- | ---: | ---: | --- |
| Starter | Rp10.000 | Rp40.000 | Badge member, status dan riwayat membership |
| Pro | Rp66.000 | Rp127.000 | Starter + Media Studio Pro dan Smart Queue |
| Ultra | Rp200.000 | Rp370.000 | Pro + Video Editor Studio |
| Max | Rp600.000 | Rp1.600.000 | Ultra + Emote Studio |

Periode bulanan dihitung 30 hari dan tahunan 365 hari. Paket yang lebih tinggi mewarisi fasilitas tier di bawahnya. Pembelian tier lebih rendah ditolak selama tier yang lebih tinggi masih aktif.

## Konfigurasi Cloudflare Worker

1. Buka Cloudflare Dashboard → Workers & Pages → `aryanzz-donwloader`.
2. Buka **Settings → Variables and Secrets**.
3. Tambahkan Secret bernama `AIRPAY_API_KEY`.
4. Untuk pengujian awal gunakan key sandbox (`ak_test_...`). Setelah uji berhasil, ganti dengan key live (`ak_live_...`).
5. Pastikan binding D1 `AUTH_DB` dan secret `AUTH_SESSION_SECRET` yang dipakai identitas publik ARYANZZ tetap aktif.
6. Deploy Worker dari branch rilis yang sudah disetujui.

Jangan masukkan API key ke `public/index.html`, `public/membership-ui.js`, atau repository. Jangan mengirim API key melalui chat.

## Alur identitas dan membership

- Membership terhubung ke ID ARYANZZ yang dibuat oleh layanan identitas publik.
- Worker membaca cookie HttpOnly `aryanzz_device_lock`, lalu memetakan hash token ke `auth_device_lock_accounts` pada `AUTH_DB`. ID tidak dipercaya dari input browser.
- Status membership dan pesanan disimpan di Durable Object `MembershipStore`, menggunakan ID ARYANZZ sebagai pemilik data.
- Jika pengguna menghapus cookie situs atau berpindah perangkat, perangkat tersebut dapat memperoleh ID baru. Pemindahan membership lintas perangkat membutuhkan sistem akun terverifikasi; jangan menjanjikannya pada mode ID perangkat.

## Alur pembayaran AirPay

1. Browser menunggu identitas ARYANZZ siap.
2. Browser membuat pesanan melalui `POST /api/membership/orders`.
3. Worker membuat invoice QRIS melalui `POST https://airpaygateway.site/api/qris/create`, memakai header `X-API-Key` dan mengirim `external_id`, `callback_url`, serta `return_url`.
4. AirPay mengembalikan `transaction_id`, `qr_url`, `pay_url`, `base_amount`, `fee_amount`, dan `total_amount`.
5. Browser menampilkan QRIS atau tautan pembayaran. Pengguna membayar dengan aplikasi yang mendukung QRIS.
6. AirPay mengirim webhook ke `POST /api/membership/webhook` dengan header `X-AirPay-Signature`. Worker memeriksa HMAC-SHA256 dari raw body menggunakan API key AirPay, lalu mencocokkan ID invoice dan nominal.
7. Sebagai jalur cadangan, Worker memeriksa `GET https://airpaygateway.site/api/qris/status?transaction_id=...`. Browser juga dapat meminta pemeriksaan status internal melalui `GET /api/membership/orders/status?orderId=...`.
8. Hanya status `Success` yang lolos pemeriksaan referensi dan nominal yang mengaktifkan membership. Parameter redirect `status=paid` tidak pernah dianggap bukti pembayaran.

Durable Object alarm memeriksa invoice pending secara berkala sebagai cadangan ketika tab checkout ditutup atau webhook terlambat.

## Metode pembayaran dan pencairan saldo

AirPay membuat invoice QRIS dinamis. Pembeli memindai QR melalui aplikasi yang mendukung QRIS, misalnya DANA, GoPay, OVO, LinkAja, atau mobile banking yang mendukung QRIS. Ketersediaan akhir tetap mengikuti aplikasi dan kanal QRIS yang diaktifkan.

Implementasi ini tidak meminta nomor rekening atau nomor HP pembeli, dan tidak melakukan push-payment/transfer langsung ke rekening atau e-wallet pembeli. Pembayaran QRIS masuk ke saldo merchant AirPay. Pencairan saldo merchant ke rekening/e-wallet pemilik dilakukan terpisah melalui fitur Saldo & Payout AirPay.

## Pemeriksaan sebelum live

- [ ] `AIRPAY_API_KEY` sandbox sudah dipasang sebagai Secret Worker.
- [ ] `AUTH_DB` dan `AUTH_SESSION_SECRET` tersedia; identitas ID ARYANZZ tersinkron.
- [ ] Endpoint katalog menampilkan empat paket dan harga yang benar.
- [ ] Invoice QRIS berhasil dibuat dan QR/link dapat dibuka.
- [ ] Uji sandbox mengembalikan status `Success`.
- [ ] Webhook dengan signature valid mengaktifkan paket tepat satu kali.
- [ ] Status `Pending`, `Expired`, nominal salah, ID salah, dan signature salah tidak mengaktifkan membership.
- [ ] Pembelian tier lebih rendah ditolak ketika tier lebih tinggi masih aktif.
- [ ] Ganti sandbox ke live setelah seluruh pengujian lulus.
- [ ] Uji satu transaksi live bernilai rendah sebelum checkout dibuka untuk semua pengguna.