# Dozi
İlaç takip PWA'sı: kutudaki blister ve hap sayısını gir, kaldığın yerden başla, kalan hapları blister gözleriyle görsel olarak takip et.

## Özellikler
- Kutu → blister → hap yapısı (ör. 2 blister × 14 hap)
- Kaldığın yerden başlama: hangi blister, hangi hap, yarım/çeyrek kalmış hap
- Çeyrek, yarım, tam, 1,5 ve 2 hap dozları; günde kaç kez alındığı
- Blister gözleriyle görsel takip, kalan hap ve tahmini bitiş günü
- "Aldım" butonu, tek seferlik ¼ / ½ / 1 seçenekleri ve geri alma
- Hatırlatma saatleri (ilaç başına en fazla 6): saat geçtiği halde doz alınmadıysa bildirim ve ana ekranda uyarı
- Unutulan doz: geçmiş bir güne ilaç ekleme (ilaç ekranından, takvimde seçili günden ya da `+` ile)
- Kutu bitince yeni kutuya geçme: kutu dün (ya da daha önce) bittiyse uygulama "bugün içtin mi?" diye sorar, evet derse yeni kutuyu açıp bugünkü dozu da kaydeder. Eski kutuların alışları geçmişte kalır
- Saat çizelgesi: her satır bir gün, noktalar o gün kaçta ne aldığını gösterir (takvimde ay, ilaç ekranında son 14 gün ve hatırlatma saatleri)
- Takvim: ay görünümü; altında yalnızca bir hafta (Pazartesi'den itibaren) listelenir, oklarla önceki haftalara gidilir. Bir güne dokununca o gün ayrı bir "Seçili gün" kartında saatleriyle görünür; kayıt silinebilir, o güne doz eklenebilir
- Ek kayıtlar: sağ üstteki + tuşu "Düzenli ilaç" ya da "Günlük kayıt" seçtirir; vitamin, takviye, bitki çayı gibi şeyler hazır ve son kullanılan önerilerle, istenirse geçmiş bir güne kaydedilir
- Dil: Türkçe ve İngilizce. "Sistem" telefonun diline uyar (Türkçe telefon Türkçe, diğerleri İngilizce). Sunucu bildirimleri de cihazın diliyle gelir
- Rafa kaldırma: kullanmak istemediğin bir ilaç (ör. yeni paketini almışsın ama şimdi başlamayacaksın) "Rafa kaldır" ile rafa konur. Rafta olan ilaç için hatırlatma, saat başı tekrar, yeni kutu sorusu ve bitiş tarihi olmaz; listede soluk görünür. "Rafdan al" ya da bir doz kaydetmek onu geri getirir. "Daha sonra" ise soruyu yalnızca bugün için erteler
- Kutunun biteceği gün: takvimde o günün köşesinde bir bayrak görünür, altında her ilacın bitiş tarihi ve kaç gün kaldığı listelenir. Bugünkü doz alındıysa tahmin yarından başlar. Takvim, son bitiş gününün olduğu aya kadar ileri gidebilir
- Ayarlar sekmesi: tema (sistem / açık / koyu), vurgu rengi, dil, sunucu bildirimlerini açma-kapatma ve test bildirimi, verileri JSON olarak indirme. Tercihler cihazda saklanır
- İsteğe bağlı Firebase yedeği: Google ile giriş yapınca veriler Firestore'a yedeklenir, cihazlar arası senkronize olur
- Veriler cihazda (localStorage) saklanır; çevrimdışı çalışır, ana ekrana eklenebilir

## Çalıştırma
Derleme adımı yok; herhangi bir statik sunucu yeterli:

```sh
npx http-server -p 8080 .
```

## Hatırlatma ve bildirimler
İki katman var:

- **Cihaz içi:** Dozi açıkken ya da tarayıcı arka planda canlı tutarken, saati gelen ilaç için bildirim gösterir. Telefon uygulamayı kapatırsa gecikebilir. Ek kurulum gerekmez.
- **Sunucu (isteğe bağlı):** Dozi kapalıyken de, tam saatinde bildirim gelir. Evdeki sürekli açık bir cihazda çalışan küçük bir servis gerekir: [`server/README.md`](server/README.md). Sunucu bildirimi açıkken cihaz içi hatırlatmalar susar, çift bildirim gelmez.

İki katmanda da bugünkü doz alındıysa hatırlatma gelmez.

**Saat başı tekrar (yalnızca sunucu bildirimi):** Hatırlatma saatinde doz alınmadıysa, alınana kadar her saat başı "Hâlâ alınmadı" bildirimi gelir. Bir sonraki hatırlatma saatinde ya da 22:00'de durur; hatırlatmanın kendisi her zaman gider. Ayarlar'daki anahtarla cihaz başına kapatılır. Cihaz içi hatırlatmalar tekrar etmez.

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
| `js/push.js`, `js/pushUi.js`, `js/push-config.js` | Sunucu bildirimleri: cihazı abone etme, ayarlardaki bildirim bölümü |
| `js/lang.js`, `js/i18n.js`, `js/i18n/tr.js`, `js/i18n/en.js`, `js/langUi.js` | Çeviri: seçili dil, `t('anahtar')` ile metinler, `index.html`'deki `data-i18n` öğeleri. Yeni dil eklemek için `js/i18n/` altına bir dosya ve `lang.js`'e bir satır yeter; test iki dilin aynı anahtarlara sahip olduğunu denetler |
| `js/prefs.js`, `js/settingsUi.js`, `js/views/settings.js` | Ayarlar: tema ve renk tercihleri (`data-theme` / `data-accent`), veri indirme, ekran |
| `server/` | Evdeki cihazda çalışan bildirim servisi (kendi `README.md`'si var) |
| `js/store.js`, `js/reminders.js`, `js/history.js`, `js/dates.js`, `js/html.js` | Saf mantık ve yardımcılar (testlenir) |
| `js/boxes.js`, `js/timeline.js`, `js/week.js` | Kutu geçişi ve unutulan doz mantığı; çizelge verisi; ekrandaki hafta (testlenir) |
| `js/views/timeChart.js` | Saat çizelgesi çizimi (şekil + renk, erişilebilir satırlar) |

## Test
```sh
npm test
```
Saf mantık modülleri için bağımlılıksız Node testleri (`tests/`).
