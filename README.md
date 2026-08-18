<p align="center">
  <img src="icon.png" width="88" alt="MediaPull">
</p>

<h1 align="center">MediaPull</h1>

<p align="center">
  <strong>Open-source media downloader tailored for video editors<br>(no more black screen in Premiere / After Effects)</strong>
</p>

<p align="center">
  YouTube ve Twitter / X bağlantısını yapıştır.<br>
  MediaPull, kurgu programlarının okuyabildiği <strong>H.264 + AAC MP4</strong> üretir.
</p>

<p align="center">
  <a href="https://github.com/earslaner2001/Arslaner-Download-Express/releases/latest">
    <img src="https://img.shields.io/badge/Download%20Installer-Windows%20NSIS-ff0000?style=for-the-badge" alt="Download Installer">
  </a>
</p>

<p align="center">
  <a href="https://github.com/earslaner2001/Arslaner-Download-Express/releases/latest"><img src="https://img.shields.io/badge/Sürüm-2.1.1-ff0000?style=flat-square" alt="Version 2.1.1"></a>
  <img src="https://img.shields.io/badge/Editor--Ready-H.264%20NLE%20Compatible-00c853?style=flat-square" alt="Editor-Ready (H.264 NLE Compatible)">
  <img src="https://img.shields.io/badge/Premiere%20%2F%20AE-yuv420p%20AAC-7c4dff?style=flat-square" alt="Premiere / AE compatible">
  <a href="LICENSE"><img src="https://img.shields.io/badge/Lisans-MIT-0078d4?style=flat-square" alt="MIT License"></a>
  <img src="https://img.shields.io/badge/Platform-Windows-0078D6?style=flat-square&logo=windows&logoColor=white" alt="Windows">
  <img src="https://img.shields.io/badge/Electron-28.3.3-47848F?style=flat-square&logo=electron&logoColor=white" alt="Electron">
</p>

<p align="center">
  <img src="docs/app-preview.svg" alt="MediaPull önizleme" width="820">
</p>

> Demo GIF eklemek için `docs/demo.gif` dosyasını bu klasöre koyup aşağıdaki satırın yorumunu kaldırın.
>
> `![MediaPull demo](docs/demo.gif)`

---

## Neden MediaPull?

Birçok indirici AV1 / VP9’u MP4 içine gömer. Adobe Premiere Pro ve After Effects bu dosyayı açınca **ses gelir, görüntü siyah kalır**.

MediaPull bunu varsayılan olarak çözer:

- Video codec: **H.264 (`avc1`)**
- Piksel formatı: **yuv420p**
- Ses codec: **AAC 192k**
- Konteyner: **MP4** (`--merge-output-format mp4`)

Timeline’a sürükle, oyna. Siyah ekran yok.

---

## Özellikler

- **Editor-Ready MP4** — Premiere / After Effects / DaVinci / Vegas için H.264 NLE çıktısı
- **YouTube** — 1080p H.264, MP3 ses çıkarma, otomatik dosya adı
- **Twitter / X** — Tweet veya video bağlantısından NLE uyumlu MP4
- **Özel pencere çerçevesi** — Windows title bar yerine MediaPull çerçevesi
- **İndirme kontrolü** — Duraklat / devam / durdur, canlı süreç logu
- **Sıfır hesap** — Kayıt yok, abonelik yok
- **Otomatik araçlar** — İlk açılışta `yt-dlp` ve `ffmpeg` hazırlanır
- **Kayıt yeri** — `İndirilenler\MediaPullDownloads`

---

## Kurulum (30 saniye)

1. **[Download Installer](https://github.com/earslaner2001/Arslaner-Download-Express/releases/latest)** — Windows NSIS paketi
2. Kurulumu tamamla
3. Linki yapıştır, indir, Premiere / AE’ye at

Kaldırma: Windows **Programlar ve Özellikler**.

---

## Lansman kancası (Product Hunt / Show HN)

**Başlık**

> MediaPull — Open-source media downloader tailored for video editors (no more black screen in Premiere/AE)

**Kısa açıklama**

> Paste a YouTube or X link. MediaPull downloads H.264 yuv420p AAC MP4 that actually plays on an NLE timeline — not AV1-in-MP4 with audio-only black frames.

**Show HN örneği**

> Show HN: MediaPull – desktop downloader that outputs Premiere/AE-ready H.264 instead of AV1 MP4s

---

## Geliştirici

```bash
npm install
npm start
```

Kurulum paketi:

```bash
build-setup.bat
```

Çıktı: `dist/`

Geliştirici modu (`npm run dev`) dosya değişiminde uygulamayı yeniler.

---

## Belgeler

| Belge | Açıklama |
|-------|----------|
| [CHANGELOG.md](CHANGELOG.md) | Sürüm notları |
| [LICENSE](LICENSE) | MIT lisans metni |
| [COPYRIGHT.md](COPYRIGHT.md) | Telif hakkı bildirimi |
| [SECURITY.md](SECURITY.md) | Güvenlik politikası |
| [Site](https://media-pull.vercel.app/) | Ürün sayfası |

---

## Yasal uyarı

İndirilen içeriklerin kullanım hakları içerik sahiplerine aittir. Yerel mevzuata ve platform kullanım şartlarına uygun kullanın. MediaPull bir indirme yardımcısıdır; telif ihlalini teşvik etmez.

---

<p align="center">
  <strong>Copyright © 2026 MediaPull.</strong><br>
  Open source. Editor-ready. Siyah ekran yok.
</p>
