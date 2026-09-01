# Değişiklik günlüğü

## [2.3.0] — 2026-09-01

### Özet

YouTube GVS PO Token / SABR koruması için yeni istemci motoru, Adobe uyumlu H.264/ProRes dönüşüm hattı ve VDS lisans mimarisi.

### Eklenenler

- **YouTube istemci motoru:** `web_creator`, `web_embedded`, `android_vr` ile GVS PO Token / SABR kısıtlamasını aşma.
- **Deno / EJS JS runtime:** YouTube player çözümlemesi için yerel Deno ve `ejs:github` uzak bileşenleri.
- **H.264 / ProRes dönüşüm hattı:** Premiere / After Effects için GPU hızlandırmalı (NVENC/AMF/QSV) H.264 + AAC; ProRes 422 HQ.
- **VDS lisans mimarisi:** HWID ile 2 cihaz hakkı, `50000` portundaki lisans sunucusu.

### İyileştirilenler

- **4K 60fps:** H.264 Level 5.2; orijinal ses dili (dublaj değil).
- **1080p:** Ses-only düşme düzeltmesi; dönüşüm her zaman H.264’e zorlanır.
- **Pano:** Yapıştır butonu ana süreçten panoyu okur.

[2.3.0]: https://github.com/earslaner2001/Arslaner-Download-Express/releases/tag/v2.3.0

## [2.2.0] — 2026-08-18

### Özet

Pro plan altyapısı, kurgu programı uyumlu H.264 çıktı ve gerçek 4K indirme.

### Eklenenler

- **Pro / Free lisans:** Titlebar rozeti, lisans modalı, anahtar etkinleştirme.
- **Lisans sunucusu:** `activate` / `deactivate` ile cihaz bağlama; token yerelde saklanır.
- **Pro hesaptan çıkış:** Cihaz hakkını serbest bırakır.
- **Pro formatlar:** 4K MP4 H.264, Apple ProRes 422 HQ, kayıpsız WAV (Free’de kilitli).

### İyileştirilenler

- **Editor-Ready MP4:** Video H.264 (`libx264`, `yuv420p`), ses AAC — Premiere / After Effects siyah ekran sorunu.
- **4K indirme:** YouTube 4K VP9/AV1 kaynağı alınır, ardından H.264 4K’ya dönüştürülür (yalnızca avc1 aramak 1080p’ye düşüyordu).
- **UTF-8 log:** `--encoding utf-8` ve `toString('utf-8')`.

### Not

- Pro anahtarı lisans sunucusundan üretilir; uygulama mock `MP-PRO-` kabul etmez.
- 4K yalnızca kaynak videoda 2160p varsa mümkündür.

[2.2.0]: https://github.com/earslaner2001/Arslaner-Download-Express/releases/tag/v2.2.0

## [2.1.1] — 2026-08-18

### Eklenenler

- Özel pencere çerçevesi (küçült / büyüt / kapat, sürükle, çift tık).

[2.1.1]: https://github.com/earslaner2001/Arslaner-Download-Express/releases/tag/v2.1.1

## [2.0.5] — 2026-06-08

### Eklenenler — UX İyileştirmeleri

- **Aşama göstergesi:** İndirme adımı dinamik olarak güncellenir.
  - `Analiz ediliyor…` → `Video verisi alınıyor…` → `Video ve ses birleştiriliyor…` → `İndirme tamamlandı!`
- **Anlık metrikler:** İlerleme çubuğunun altında hız (`4.2 MiB/s`), toplam boyut (`15.2 / 45.0 MiB`) ve kalan süre (`ETA 00:12`) gösterilir.
- **Özel progress bar:** Hareketli şerit animasyonu, `width` transition ile akıcı ilerleme.
- **Buton kilitleme / spinner:** İndir butonuna basılınca `disabled` + dönen ikon + "İndiriliyor…" metni; tamamlanınca serbest bırakılır.
- **Hot reload:** `dev.bat` ile geliştirici modunda dosya değişince uygulama otomatik yeniden başlar (`electron-reload`).

[2.0.5]: https://github.com/earslaner2001/Arslaner-Download-Express/releases/tag/v2.0.5

## [2.0.4] — 2026-05-20

### Eklenenler

- Lansman sitesi (`website/`, [media-pull.vercel.app](https://media-pull.vercel.app/)).
- Sağ alt köşe `(c) 2026 MediaPull · site` linki — tarayıcıda açılır.
- `website/start.bat` (site önizleme).

### Düzeltildi

- `build-setup.bat`: `NODE_OPTIONS=--openssl-legacy-provider` Electron ile çakışması giderildi.

### Değişenler

- Site artık uygulama içinde webview ile açılmıyor; yalnızca harici tarayıcı.

[2.0.4]: https://github.com/earslaner2001/Arslaner-Download-Express/releases/tag/v2.0.4

## [2.0.3] — 2026-05-20

### Düzeltildi

- **YouTube:** Güncel yt-dlp için **JavaScript runtime** eklendi (`--js-runtimes node` + Electron `ELECTRON_RUN_AS_NODE`); `ejs:github` bileşeni ile imza çözümleme.
- **YouTube birleştirme:** `Merger+ffmpeg_i` postprocessor kaldırıldı (Windows’ta `Invalid argument`). Ses için **m4a (AAC)** tercih edilen format dizgileri kullanılıyor — Windows Media Player uyumlu.
- Hata mesajlarında yalnızca `ERROR:` satırları gösterilir (WARNING gürültüsü azaltıldı).

[2.0.3]: https://github.com/earslaner2001/Arslaner-Download-Express/releases/tag/v2.0.3

## [2.0.2] — 2026-05-20

### Düzeltildi

- **Twitter / X:** `Postprocessing: Invalid argument` hatası giderildi. YouTube için eklenen `Merger+ffmpeg_i` ve `-movflags +faststart` Twitter birleştirmesinde bozuluyordu (`+` yt-dlp ayırıcısı).
- Twitter için ayrı format seçimi: önce tek parça MP4, gerekirse `m4a` ses ile birleştirme.
- Tüm indirmelerde `--windows-filenames` (geçersiz dosya adı karakterleri).

[2.0.2]: https://github.com/earslaner2001/Arslaner-Download-Express/releases/tag/v2.0.2

## [2.0.1] — 2026-05-20

### Düzeltildi

- **MP4 ses uyumluluğu:** YouTube ve Twitter / X video indirmelerinde ses, birleştirme sırasında **Opus** yerine **AAC** olarak kodlanır. Windows Media Player ve varsayılan oynatıcılarda “Opus biçimi desteklenmiyor” uyarısı giderildi (kullanıcı geri bildirimi).

### Not

- Bu düzeltme yalnızca **yeni indirilen** dosyalar için geçerlidir; önceki sürümle indirilen MP4’ler yeniden indirilmelidir.

[2.0.1]: https://github.com/earslaner2001/Arslaner-Download-Express/releases/tag/v2.0.1

## [2.0.0] — 2026-05-17

### Özet

**MediaPull** ilk ana sürüm çizgisi. Uygulama adı ve paket kimliği önceki **Arslaner Download Express** döneminden ayrılır; yapılandırma ve kurulum yolları buna göre güncellendi.

### Eklenenler

- Twitter / X: tweet veya video bağlantısından, mümkün olan en yüksek kalitede indirme (`yt-dlp`).
- Arayüz sesleri: buton tıklama ve indirme tamamlanma (`assets`).
- Windows: `build-setup.bat` ile bağımlılık + `electron-builder` kurulum paketi üretimi.
- YouTube: bağlantı doğrulama; dosya adı video başlığından otomatik; format seçiminin `yt-dlp` ile gerçekten uygulanması; Windows’ta güvenli çalıştırma (`spawn`).

### Değişenler

- **Marka:** `MediaPull`, `com.mediapull.app`, kısayol ve yükleyici metinleri.
- **İndirme klasörü:** `Downloads/MediaPullDownloads` (eski `ArslanerDownloads` otomatik taşınmaz).
- Pencere boyutu ve düzen; üst menü çubuğu varsayılan olarak gizli (`autoHideMenuBar`).
- Güvenlik politikası destek tablosu: aktif sürüm **v2.0.x**.

### Kaldırılanlar

- Genel “düz HTTP dosya indir” akışı (ana pencerede kaldırıldı); odak YouTube ve Twitter / X üzerinde.
- YouTube için elle dosya adı zorunluluğu; gereksiz dekoratif emojiler (ana arayüz).

### Kurulum ve kaldırma

- İlk çalıştırmada `yt-dlp` ve `ffmpeg` gerekirse uygulama tarafından hazırlanır.
- Kaldırıcı, `MediaPull` kurulum dizini, `MediaPullDownloads` ve `%APPDATA%\mediapull` temizliğini hedefler (`uninstall.nsh`).

### Bilinen notlar

- Eski sürümlerden kalan dosyalar `ArslanerDownloads` altında kalabilir; isteğe bağlı elle birleştirin.

[2.0.0]: https://github.com/earslaner2001/Arslaner-Download-Express/releases/tag/v2.0.0
