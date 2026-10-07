# Dozi
İlaç takip PWA'sı: kutudaki blister ve hap sayısını gir, kaldığın yerden başla, kalan hapları blister gözleriyle görsel olarak takip et.

## Özellikler
- Kutu → blister → hap yapısı (ör. 2 blister × 14 hap)
- Kaldığın yerden başlama: hangi blister, hangi hap, yarım/çeyrek kalmış hap
- Çeyrek, yarım, tam, 1,5 ve 2 hap dozları; günde kaç kez alındığı
- Blister gözleriyle görsel takip, kalan hap ve tahmini bitiş günü
- "Aldım" butonu, tek seferlik ¼ / ½ / 1 seçenekleri ve geri alma
- Hatırlatma saatleri (ilaç başına en fazla 6): saat geçtiği halde doz alınmadıysa bildirim ve ana ekranda uyarı
- Takvim: ay görünümü, günlere göre ilaç ve içecek kayıtları, saatleriyle liste, kayıt silme
- Ek kayıtlar: sağ üstteki + tuşu "Düzenli ilaç" ya da "Günlük kayıt" seçtirir; vitamin, takviye, bitki çayı gibi şeyler hazır ve son kullanılan önerilerle, istenirse geçmiş bir güne kaydedilir
- İsteğe bağlı Firebase yedeği: Google ile giriş yapınca veriler Firestore'a yedeklenir, cihazlar arası senkronize olur
- Veriler cihazda (localStorage) saklanır; çevrimdışı çalışır, ana ekrana eklenebilir

## Çalıştırma
Derleme adımı yok; herhangi bir statik sunucu yeterli:

```sh
npx http-server -p 8080 .
```

## Hatırlatma notları
Dozi sunucusuz bir PWA olduğu için bildirimler uygulama açıkken ya da tarayıcı arka planda canlı tutarken gelir. Telefon uygulamayı tamamen kapatırsa bildirim gecikebilir.

## Yayınlama
`.github/workflows/pages.yml`, `main` dalına push edilince siteyi GitHub Pages'e yayınlar. İlk seferde repo ayarlarında Settings → Pages → Source olarak "GitHub Actions" seçilmelidir.

## Firebase yedeği kurulumu
Firebase ayarı boşken uygulama yalnızca cihazda çalışır; giriş çubuğu görünmez.

1. [Firebase console](https://console.firebase.google.com)'da proje oluştur, bir **Web uygulaması** ekle.
2. **Authentication → Sign-in method** bölümünde **Google**'ı aç.
3. **Authentication → Settings → Authorized domains** listesine yayın alan adını ekle (`dozi.mifarosa.com`, ve varsa `<kullanıcı>.github.io`).
4. **Firestore Database** oluştur, sonra **Rules** sekmesine `firestore.rules` dosyasının içeriğini yapıştırıp yayınla. Kurallar herkesin yalnızca kendi `users/{uid}` belgesine erişmesini sağlar.
5. Web uygulaması ayarlarındaki `apiKey`, `authDomain`, `projectId`, `appId` değerlerini `js/firebase-config.js` dosyasına yaz. Bu değerler gizli değildir; erişimi kurallar korur.

Senkronizasyon: her değişiklik hesabındaki tek bir belgeye yazılır ve en yeni sürüm kazanır. İlk girişte hem cihazda hem hesapta ilaç varsa ikisi birleştirilir. Çevrimdışıyken yapılan değişiklikler bağlantı gelince gönderilir.

## Proje yapısı
Derleme yok; `js/` altındaki dosyalar tarayıcıda ES modülü olarak çalışır.

| Dosya | Görevi |
| --- | --- |
| `js/app.js` | Giriş noktası: ekranı çizer, üst düzey düğmeleri bağlar |
| `js/state.js` | Tek durum nesnesi; `commit()` kaydedip haber verir, `refresh()` yalnızca yeniden çizer |
| `js/actions.js` | `#app` içindeki tıklamaları `data-*` özniteliklerine göre yönlendirir |
| `js/views/` | Ekranlar (liste, ilaç detayı, takvim, blister çizimi); durumu okuyup HTML döndürür, DOM'a dokunmaz |
| `js/ui/` | Diyaloglar: ilaç formu, "ne içtin" formu, `+` seçim penceresi |
| `js/reminderLoop.js`, `js/notifications.js` | Hatırlatma zamanlayıcısı ve bildirimler |
| `js/cloudSync.js`, `js/cloud.js`, `js/sync.js` | Bulut yedeği: arayüz çubuğu, Firebase sarmalayıcı, birleştirme kararları |
| `js/store.js`, `js/reminders.js`, `js/history.js`, `js/dates.js`, `js/html.js` | Saf mantık ve yardımcılar (testlenir) |

## Test
```sh
npm test
```
Saf mantık modülleri için bağımlılıksız Node testleri (`tests/`).
