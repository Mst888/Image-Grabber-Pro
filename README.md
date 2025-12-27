# Photo-Grab 📸

Photo-Grab: Web sayfalarındaki yüksek çözünürlüklü görselleri hızla seçip toplu halde indirebileceğiniz, akıllı adlandırma ve ZIP paketleme desteği sunan profesyonel tarayıcı uzantısı — içerik üreticileri, araştırmacılar ve görsel koleksiyoncular için ideal.

![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg) ![Version: 1.7.1](https://img.shields.io/badge/Version-1.7.1-blue)

---

## Neden Photo-Grab?
Hızlı seçim araçları, filtreler ve toplu indirme iş akışıyla yüzlerce görseli birkaç tıklamada arşivleyin. Same Size Mode, ZIP bundling ve dinamik isimlendirme gerçek zamanlı üretkenlik sağlar.

---

## Hızlı Özellikler
- Area Selection: Sayfa üzerinde dikdörtgenle çoklu seçim (mavi kontur + indeks rozetleri)  
- Same Size Mode & Smart Filters: Aynı boyut/çözünürlükteki görselleri yakalayın  
- ZIP bundling + Akıllı İsimlendirme: `{site}`, `{title}`, `{index}` değişkenleri  
- Kompakt Popup (300x500) + Floating Toolbar  
- Temalar: Onyx Gray, Green, Classic Blue

---

## Ekran Görüntüleri — Özelliğe Göre Düzenlendi
(Her görselin altında kısa açıklama var — ziyaretçiler ne gördüğünü hemen anlar.)

### 1) Area Selection — Alanla Seçme ve Görsel Geri Bildirim
<img alt="Area selection with badges" src="https://github.com/user-attachments/assets/e9e421f4-110f-4b49-96be-e3d2fa2a4546" />
*Sayfa üzerinde dikdörtgen ile çoklu görsel seçme; mavi kontur ve indeks rozetleri.*

<img alt="Selection badges and overlay" src="https://github.com/user-attachments/assets/d3f288ec-9b25-4a26-b499-880216014cb1" />
*Seçilen görsellerin indekslenmesi ve anlık seçim özeti.*

---

### 2) Popup UI & Floating Toolbar — Hızlı Erişim
<img alt="Compact popup UI" src="https://github.com/user-attachments/assets/298bd574-fff3-4c1f-828c-a926170a702d" />
*Kompakt popup (300x500) — filtreler, isimlendirme ve indirme seçenekleri.*

<img alt="Floating toolbar on page" src="https://github.com/user-attachments/assets/248fb72f-a54e-4928-a654-b2d0ab791865" />
*Kayan araç çubuğu — popup açmadan hızlı seçim ve işlemler.*

<img alt="Popup themes and list" src="https://github.com/user-attachments/assets/f14c2416-d366-4b63-9c7a-87a455e60e3c" />
*Popup içi liste görünümü ve tema önizlemesi.*

---

### 3) Same Size Mode & Smart Filters
<img alt="Same size mode and filters" src="https://github.com/user-attachments/assets/d3f288ec-9b25-4a26-b499-880216014cb1" />
*Bir görsel seçin; aynı boyuttaki tüm görseller otomatik seçilir.*

---

### 4) Toplu İndirme, ZIP Bundling & Akıllı İsimlendirme
<img alt="ZIP bundling and download flow" src="https://github.com/user-attachments/assets/a69935cf-dfe0-4671-bd6f-848fa8d653cf" />
*Seçimi `.zip` içinde paketleyip indirme akışı.*

<img alt="Naming templates and subfolders" src="https://github.com/user-attachments/assets/9c086134-86b1-432e-9dda-1e6736a417c6" />
*Dinamik isimlendirme şablonları ve alt klasör desteği.*

---

### 5) Tema & Ayarlar — Görünümü Kişiselleştirme
<img alt="Theme example 1" src="https://github.com/user-attachments/assets/85b26c08-03de-4520-bc71-0cc83e42ed0b" />
<img alt="Theme example 2" src="https://github.com/user-attachments/assets/68550f78-f1a2-476b-a96c-97e04f42e68f" />
<img alt="Theme example 3" src="https://github.com/user-attachments/assets/81e4a89d-601b-4b78-ac85-a415c3d90517" />
*Tema seçenekleri ve ayarlar ekranı örnekleri.*

---

### 6) Mobil / Responsive Önizleme
<img alt="Mobile preview 1" src="https://github.com/user-attachments/assets/bf741b1b-f774-43ee-84f3-bb3a39b33aa8" />
<img alt="Mobile preview 2" src="https://github.com/user-attachments/assets/24fc9f24-b24f-4234-a047-bb9cca9beccb" />
<img alt="Mobile preview 3" src="https://github.com/user-attachments/assets/5573876b-c0fc-43a3-a8da-492bbe7c17ed" />
*Mobil önizlemeler — masaüstü deneyimi esas olmakla birlikte bazı responsive görünüm örnekleri.*

---

## Kurulum — Adım Adım (Kullanıcı + Geliştirici)
Manifest dosyalarına ve raw hallerine doğrudan bağlantılar:
- manifest (repo): https://github.com/Mst888/Photo-Grab/blob/b4b99e8f22b4f8bcaf4828e6ae435761810784f1/manifest.json  
- manifest.chrome (repo): https://github.com/Mst888/Photo-Grab/blob/b4b99e8f22b4f8bcaf4828e6ae435761810784f1/manifest.chrome.json  
- Raw manifest: https://raw.githubusercontent.com/Mst888/Photo-Grab/b4b99e8f22b4f8bcaf4828e6ae435761810784f1/manifest.json  
- Raw manifest.chrome: https://raw.githubusercontent.com/Mst888/Photo-Grab/b4b99e8f22b4f8bcaf4828e6ae435761810784f1/manifest.chrome.json

Seçenek A — Hazır paket (kullanıcılar için)
1. Releases veya `web-ext-artifacts/` içindeki `.zip` dosyasını indirin.  
2. Chrome: chrome://extensions → Geliştirici modu açık → "Load unpacked" ile zip içeriğini çıkardığınız klasörü seçin.  
3. Firefox: about:debugging → "Temporary Add-on" ile `manifest.json` veya XPI dosyasını seçin.

Seçenek B — Kaynak koddan geliştirme
```bash
git clone https://github.com/Mst888/Photo-Grab.git
cd Photo-Grab
npm install
npm run build
# Çıktıyı yükleyin: web-ext-artifacts/ içindeki build klasörünü kullanın
```
- Chrome: chrome://extensions → Load unpacked → build klasörünü seçin.  
- Firefox: `npx web-ext run --source-dir=./src` ile hızlı test.

Seçenek C — Manuel manifest testi
1. Raw manifest dosyasını indirin (linkler yukarı).  
2. Yeni bir klasör oluşturun, manifest ve varsa gerekli dosyaları (popup, icons, content scripts) koyun.  
3. chrome://extensions → Load unpacked ile klasörü yükleyin.

Not: Sadece manifest tek başına çalışmaz — popup dosyaları, content script'ler ve ikonlar ilgili klasörde olmalıdır.

---

## Hızlı Kullanım — 3 Adım (görsellerle)
1. Sayfada dikdörtgen ile seçim yapın (bakınız: Area Selection görselleri).  
2. Popup'ta filtreleri ve isimlendirmeyi ayarlayın (bakınız: Popup & Naming görselleri).  
3. "Download" ile ZIP oluşturun ve indirin.

---

## Güvenlik & İzinler
- Gereken izinler: activeTab / host izinleri (manifest içinde görülebilir).  
- Gizlilik: Uzantı kişisel veri toplamaz; yalnızca seçilen görsellerin URL ve görüntü verisini indirme amaçlı kullanır. Manifest ve izin ayrıntıları için manifest dosyalarını inceleyin.

---

## Daha İyi Demo (Öneri)
README’ye 10–20s’lik bir GIF veya kısa video eklerseniz dönüşüm çok artar. İstersen hangi adımı (Area Selection → ZIP download gibi) kaydedeceğini söyleyeyim; senin için GIF önerisi ve kırpma talimatı hazırlarım.

---

## Katkı & Destek
- Hata/istek için Issues açın.  
- README’ye eklemek istediğiniz demo GIF/mağaza linkleri varsa gönderin — ben yerleştiririm.

---

## Lisans & Bilgiler
- Lisans: MIT  
- Author: Mst888  
- Version: 1.7.1

