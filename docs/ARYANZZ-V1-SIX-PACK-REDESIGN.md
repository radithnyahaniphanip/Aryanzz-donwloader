# ARYANZZ V1 — Paket Home, Device Studio & Peta (12 November 2026)

Status: Implementasi modular pada branch pengembangan. Release publik tetap **V1**; setiap deploy memperbarui build ID internal saja.

## Paket 1 — Perbaikan tampilan per section
- Beranda mempertahankan brand header, hero, workspace, alat, navigasi bawah, dan halaman profil/owner yang sudah ada.
- **Tempel tautan** menampilkan seluruh katalog 200 platform, pencarian platform dan opsi “Semua 200” untuk tautan video, gambar, dan audio. Saat “Semua 200” dipilih, sistem menentukan sumber dari URL yang ditempel. Mesin **Cari Judul** tetap terpisah dan bukan bagian dari Tempel Tautan.
- **Cari judul** tetap menampilkan hanya provider dengan dukungan pencarian video/gambar yang diketahui. Label “Smart Search” dihapus, tetapi fungsi Cari Judul dipertahankan.
- Indikator titik dekoratif di header disembunyikan tanpa menonaktifkan pemeriksaan keamanan. Metadata bantuan tetap terbaca.

## Paket 2 — Naskah antarmuka final
Hero: **Semua berawal dari satu tautan**.
Subjudul: “Satu tautan untuk menemukan, mengelola, dan mengolah media publik. Semua dimulai di sini.”
Workspace (tautan): “Tempel tautan, mulai berkarya”.
Workspace (judul): “Cari media dari judul”.
Device heading: “Perangkat & lokasi”.
Lokasi CTA: “Pindai lokasi” → “Tampilkan lokasi tersimpan” → “Hapus lokasi”.
Keterangan keamanan: browser hanya membuka peta setelah pengguna memilih menampilkan lokasi; koordinat dikirim ke OpenStreetMap sebagai penyedia peta pihak ketiga.

## Paket 3 — Struktur beranda dan animasi
- Komponen: \`#homeBrandHeader\`, \`#v89Welcome\`, \`.v674-download[data-mode]\`, \`#linkModePanel\`, \`#titleModePanel\`.
- State UI: \`data-mode="link|title"\` disetel oleh \`public/v674.js\`.
- Brand letters dibuat satu kali oleh \`workspace-home.js\`; tiap huruf berlabel aksesibilitas.
- Logo float ringan (transform), teks reveal satu kali, tanpa library animasi; user motion-off dan \`prefers-reduced-motion\` dihormati.
- CSS tambahan hanya \`public/v1-experience.css\` yang dimuat setelah \`brand-system.css\`; stylesheet lama dan modul downloader tidak dihapus.

## Paket 4 — Device Studio
- Kartu CSS ponsel, keadaan sesi lokal, spesifikasi yang tersedia dari Browser APIs.
- Sistem operasi, model (jika diberikan), browser, jenis perangkat, dimensi CSS layar, scale devicePixelRatio, logical CPU cores, deviceMemory (perkiraan), koneksi (perkiraan), bahasa/zona waktu, baterai (jika \`getBattery\` tersedia).
- Nilai yang tidak tersedia tertulis “Tidak dibagikan browser”. Tidak ada klaim pembacaan serial number, IMEI, model pasti, alamat IP pasti, atau semua perangkat milik akun.
- Riwayat adalah daftar lokal pada browser yang sama (\`aryanzz.device.sessions.v26\`), bukan database multi-perangkat.

## Paket 5 — Pindai lokasi + peta di dalam situs
- Klik **Pindai lokasi** → \`navigator.geolocation.getCurrentPosition\` (HTTPS + izin pengguna) → validasi koordinat → tampilkan iframe OSM \`export/embed.html\` pada \`#deviceMapPanel\`.
- Koordinat, akurasi perkiraan dan waktu tampil di bawah peta; hasil disimpan di localStorage browser saat izin eksplisit diberikan.
- Pada kunjungan ulang, koordinat yang tersimpan **tidak otomatis dikirim ke OpenStreetMap**. Pengguna perlu menekan “Tampilkan lokasi tersimpan”.
- “Hapus lokasi” menghapus localStorage dan menghapus \`src\` iframe. Peta gagal dimuat tetap tidak memengaruhi fungsi profil.
- Hanya lokasi perangkat milik pengguna yang telah setuju, bukan pelacakan orang lain.

## Paket 6 — Pengujian, keamanan & rollback
- \`npm run test:release\` menjalankan \`tests/v1-experience-smoke.mjs\` dan seluruh pengujian fitur lama.
- Pastikan sintaks semua JS, laman rumah/profil, PWA cache \`/v1-experience.css\`, lokasi consent, serta mode pencarian/tautan.
- CI PR wajib hijau sebelum merge; deployment worker Cloudflare dijalankan dari \`main\` dan diverifikasi lewat health/release/asset smoke.
- Jika ada regresi, gunakan checkpoint tag dari workflow deployment; jangan mengganti public release V1 atau memulihkan membership yang sudah dipensiunkan.

## Perbaikan regresi katalog, animasi dan kartu alat
- Full katalog 200 platform beserta pencarian nama dan pagination tersedia lagi pada mode Tempel Tautan; opsi default adalah **Semua 200**.
- Hero dan logo animasi diaktifkan dengan override CSS khusus tanpa mengaktifkan animasi scroll global. Ketuk lambang A pada hero untuk memutar ulang animasi (dengan menghormati pengaturan reduce-motion).
- Di layar HP, kartu alat menjadi satu kolom penuh, nama dan deskripsi hanya pindah baris antar kata, badge kategori tidak dipotong di tengah kata.
