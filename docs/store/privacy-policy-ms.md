# Dasar Privasi — AI Translate

**Kemas kini terakhir: 2026-07-03**

Ini ialah terjemahan rujukan Bahasa Melayu bagi dasar privasi sambungan pelayar AI Translate. Versi Bahasa Inggeris (`PRIVACY-POLICY.md`) adalah versi rasmi; sekiranya terdapat percanggahan, versi Bahasa Inggeris diguna pakai.

## Apa yang dilakukan oleh sambungan ini

AI Translate membolehkan anda memilih teks pada mana-mana laman web untuk mendapatkan terjemahan AI, serta panel "Terangkan" pilihan (definisi, contoh ayat, nota tatabahasa) untuk frasa yang dipilih. Kedua-dua ciri ini dimulakan oleh pengguna — tiada apa yang diterjemah, diterangkan atau dihantar ke mana-mana sehingga anda memilih teks dan klik ikon terjemah, item menu klik-kanan "Terjemah teks yang dipilih", atau butang Terangkan.

## Data apa yang diproses, dan ke mana ia pergi

Satu-satunya data yang diproses oleh sambungan ini ialah:

- **Teks yang anda pilih** pada halaman, ditambah petikan ringkas sekeliling (sehingga ~1,200 aksara perenggan yang sama) yang digunakan untuk menjadikan terjemahan/penerangan lebih tepat mengikut konteks.
- **Bahasa sasaran anda**, dan untuk Terangkan, anggaran ringkas tempatan bagi bahasa sumber (satu heuristik pantas berdasarkan skrip/aksara yang digunakan — ini tidak pernah meninggalkan pelayar anda).

Data ini dihantar ke satu destinasi sahaja: **enjin terjemahan yang sedang anda gunakan**, dan hanya pada saat anda meminta terjemahan atau penerangan — tidak pernah secara automatik, tidak pernah di latar belakang, dan tidak pernah untuk teks yang belum anda pilih.

### Enjin 1 — Percubaan percuma (lalai, tiada persediaan)

- Teks dan konteks yang anda pilih dihantar melalui HTTPS ke get laluan terjemahan pembangun (`gpt.yapweijun1996.com`), yang menghantarnya kepada model bahasa AI untuk menghasilkan keputusan.
- Get laluan ini menguatkuasakan had penggunaan harian bagi setiap pemasangan. Ia menjejaki **bilangan penggunaan sahaja** (untuk menguatkuasakan had harian) — ia **tidak** menyimpan kandungan permintaan anda atau terjemahan/penerangan yang dikembalikan. Setelah permintaan anda dijawab, teks itu sendiri tidak disimpan.
- Apabila had harian dicapai, sambungan tidak gagal secara senyap — ia menunjukkan pilihan untuk menambah kunci API anda sendiri (di bawah) atau cuba lagi keesokan harinya.

### Enjin 2 — Dalam peranti (persendirian, tiada rangkaian)

- Menggunakan API Penterjemah dan Pengesan Bahasa terbina dalam Chrome. Teks anda diproses sepenuhnya pada peranti anda sendiri — **ia tidak pernah dihantar melalui rangkaian kepada sesiapa**, termasuk pembangun.
- Ini ialah satu-satunya enjin yang dakwaan "data anda tidak pernah meninggalkan peranti anda" boleh dipakai.
- Terjemahan dalam peranti tidak dapat menyokong ciri Terangkan (had teknikal API dalam peranti Chrome), jadi Terangkan dilumpuhkan apabila ini sahaja enjin yang tersedia untuk anda.

### Enjin 3 — Guna kunci API anda sendiri (Gemini, OpenAI, atau DeepSeek)

- Jika anda menambah kunci API anda sendiri untuk Gemini, OpenAI, atau DeepSeek dalam Tetapan, teks dan konteks yang anda pilih dihantar **terus dari pelayar anda ke API pembekal itu sendiri** (`generativelanguage.googleapis.com`, `api.openai.com`, atau `api.deepseek.com` masing-masing), menggunakan kunci anda sendiri.
- Pembangun sambungan ini tidak pernah melihat trafik ini — ia terus dari pelayar anda ke pembekal yang anda pilih. Data anda tertakluk kepada dasar privasi dan amalan pengekalan data pembekal itu sendiri, bukan pembangun. Semak dasar pembekal secara langsung jika ini penting bagi anda.
- Setelah anda menambah kunci untuk sesuatu pembekal, get laluan percubaan percuma tidak lagi digunakan sama sekali.

## Apa yang disimpan, dan di mana

| Data | Di mana | Dihantar ke mana-mana? |
|---|---|---|
| Kunci API anda, jika ditambah | `chrome.storage.local` (pelayar anda sahaja) | Hanya sebagai pengepala pengesahan kepada API pembekal tertentu itu — tidak pernah kepada pembangun, tidak pernah ke mana-mana lagi |
| Pilihan enjin anda, bahasa sasaran | `chrome.storage.local` (tempatan sahaja) | Tidak |
| Cache terjemahan/penerangan terkini (untuk mengelak permintaan berulang bagi teks yang sama) | IndexedDB (pelayar anda sahaja) | Tidak — cache ini tidak pernah meninggalkan peranti anda |

Tiada apa yang disimpan oleh sambungan ini disegerakkan ke mana-mana pelayan pembangun, dan tiada apa dikongsi atau dijual kepada pihak ketiga.

## Apa yang TIDAK dilakukan oleh sambungan ini

- Tiada analitik, telemetri, atau penjejakan penggunaan dalam apa jua bentuk.
- Tiada pengiklanan, dan data tidak pernah dijual atau dikongsi dengan pengiklan.
- Tiada pembacaan pasif kandungan halaman — skrip kandungan hanya diaktifkan oleh pemilihan yang anda buat dan butang yang anda klik.
- Tiada akaun atau log masuk diperlukan untuk menggunakan enjin percubaan percuma atau dalam peranti.

## Mengapa sambungan ini boleh membaca data pada semua laman web

Chrome memaparkan amaran semasa pemasangan bahawa sambungan ini boleh "membaca dan mengubah semua data anda pada semua laman web." Ini kerana sambungan perlu mengesan pemilihan teks pada **mana-mana** halaman yang anda baca, supaya ikon terjemah boleh muncul tidak kira laman mana yang anda lawati — ia tidak dapat mengetahui terlebih dahulu laman mana yang anda ingin terjemah. Pada hakikatnya, skrip kandungan hanya membaca teks yang anda pilih secara eksplisit; ia tidak mengimbas, merekod, atau menghantar apa-apa lagi pada halaman itu.

## Privasi kanak-kanak

Sambungan ini tidak ditujukan kepada kanak-kanak di bawah 13 tahun dan tidak mengumpul data mereka secara sengaja (ia tidak mengumpul data peribadi sesiapa pun, tidak kira umur, melangkaui apa yang diterangkan di atas).

## Perubahan kepada dasar ini

Sekiranya dasar ini berubah dengan cara yang menjejaskan data apa yang diproses atau ke mana ia pergi, tarikh "Kemas kini terakhir" di atas akan berubah dan, bagi perubahan ketara, nota akan ditambah pada penyenaraian Chrome Web Store sambungan ini.

## Hubungi kami

Sebarang pertanyaan tentang dasar ini atau cara sambungan mengendalikan data: yapweijun1996@gmail.com
