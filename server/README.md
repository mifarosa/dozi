# Dozi bildirim sunucusu

Dozi kapalıyken de ilaç hatırlatması gönderen küçük bir Node servisi. Evdeki sürekli açık bir
cihazda (Raspberry Pi, NAS, eski bir bilgisayar) çalışır.

```
Telefon (Dozi) ──abonelik──▶ Firestore ◀──okur── bu servis ──Web Push──▶ Apple/Google push servisi ──▶ telefon
```

- Her 30 saniyede bir, Firestore'daki ilaçlarına ve alış kayıtlarına bakar.
- Saati gelmiş ve **bugünkü dozu henüz alınmamış** ilaç için bildirim gönderir. Doz saatten önce
  alınmış olsa bile sayılır; uygulamadaki hatırlatma kuralının aynısıdır (`js/reminders.js` ortak kullanılır).
- Dışarıdan bağlantı **kabul etmez**; yalnızca dışarı bağlanır. Alan adı, HTTPS ya da router ayarı gerekmez.
- Cihaz kapalıyken ya da servis durmuşken hatırlatma gelmez. Servis tekrar açılınca yalnızca son
  30 dakikadaki hatırlatmaları gönderir, sabahkileri akşam tekrar yağdırmaz.

## 1. Bir kez, kendi bilgisayarında

**a) Anahtar çifti üret.** Sunucunun bildirimleri "senden geldi" diye imzalamasını sağlar.

```sh
cd server
npm install
npm run vapid
```

- **Public key** → uygulamadaki `js/push-config.js` içine yaz, depoya gönder (siteye yayınlanır).
- **Private key** → yalnızca sunucudaki `.env` dosyasına. Kimseyle paylaşma, depoya koyma.

**b) Firestore kurallarını güncelle.** Firebase console → Firestore Database → **Rules** sekmesine
depodaki `firestore.rules` dosyasının içeriğini yapıştırıp **Publish** et. (Telefonların kendi kaydını
yazabilmesi için `pushSubs` kuralı eklendi. Kurallar depoyla otomatik uygulanmaz.)

**c) Servis hesabı anahtarı indir.** Sunucu Firestore'u bununla okur.

*Önerilen (en az yetki):* Google Cloud Console → IAM → Service Accounts → **Create service account**,
rol olarak yalnızca **Cloud Datastore User** ver, sonra Keys → **Add key → JSON**.

*Hızlı yol:* Firebase console → Project settings → Service accounts → **Generate new private key**.
Bu anahtar projene geniş erişim verir; ilk yolu tercih et.

İndirdiğin JSON dosyası **projenin tam erişim anahtarıdır**. Depoya koyma, mesajla gönderme.

## 2. Evdeki cihazda

Raspberry Pi OS / Debian / Ubuntu için. Node **20.6 ya da üstü** gerekir (22 önerilir):

```sh
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs git
node --version        # v20.6+ olmalı
```

Kodu al ve kur:

```sh
sudo git clone https://github.com/mifarosa/dozi /opt/dozi
sudo chown -R $USER /opt/dozi
cd /opt/dozi/server
npm install --omit=dev
cp .env.example .env
nano .env             # VAPID anahtarlarını ve e-postanı yaz
```

Servis hesabı JSON dosyasını cihaza kopyala (`/opt/dozi/server/serviceAccount.json`) ve koru:

```sh
chmod 600 /opt/dozi/server/serviceAccount.json
```

**Elle dene:**

```sh
npm start
```

`connected to Firestore: … user(s), … device(s)` satırını görmelisin. Durdurmak için `Ctrl+C`.
(`Missing settings…` ya da `…does not exist` görürsen `.env` dosyasını kontrol et.)

**Sürekli çalıştır (systemd):**

```sh
sudo cp dozi-notifier.service /etc/systemd/system/
sudo nano /etc/systemd/system/dozi-notifier.service   # User= ve yolları kendine göre düzelt
sudo systemctl daemon-reload
sudo systemctl enable --now dozi-notifier
journalctl -u dozi-notifier -f                         # günlüğü izle
```

*Docker kullanırsan:* `serviceAccount.json` ve `.env` dosyalarını `server/` içine koyup, depo kökünden
`docker compose -f server/docker-compose.yml up -d --build`.

**Güncelleme:** `cd /opt/dozi && git pull && cd server && npm install --omit=dev && sudo systemctl restart dozi-notifier`.
Sunucu uygulamanın `js/` klasöründeki mantığı kullandığı için ikisini birlikte güncel tut.

## 3. Telefonlarda

1. **iPhone (iOS 16.4+):** Dozi'yi Safari'de aç → Paylaş → **Ana Ekrana Ekle**. Bildirim yalnızca ana ekrandaki
   simgeden açılan Dozi'de çalışır, Safari sekmesinde çalışmaz.
   **Android:** Chrome'da aç (ana ekrana eklemen şart değil, eklersen daha güvenilir).
2. Google ile giriş yap.
3. Üstteki **Bildirimleri aç** düğmesine bas, izni ver.
4. **Test** düğmesine bas. Birkaç saniye içinde "Bildirimler çalışıyor ✓" gelmeli.

Sunucu günlüğünde `test push to …: sent` satırını görürsün.

## Gelmiyorsa

| Belirti | Bak |
| --- | --- |
| Test hiç gelmiyor | `journalctl -u dozi-notifier -f`. `connected to Firestore` yoksa servis hesabı ya da `.env` yanlış. Test satırı `not delivered` diyorsa cihazın aboneliği bozulmuş: Dozi'de **Kapat**, sonra yeniden **Bildirimleri aç**. |
| Çubukta "ana ekrana ekle" yazıyor | iPhone'da Safari sekmesinden açmışsın; ana ekran simgesinden aç. |
| "Bildirim izni kapalı" | iPhone: Ayarlar → Bildirimler → Dozi. Android: Ayarlar → Uygulamalar → Chrome/Dozi → Bildirimler. |
| Saatinde değil, geç geliyor | Telefonun Odak / Rahatsız Etme modu ya da pil tasarrufu bildirimleri erteler. Cihazın saatinin doğru olduğundan emin ol (`timedatectl`). |
| Bir ilaç için gelmedi | Hatırlatma saati girilmiş mi, o gün dozu zaten kaydettin mi, kutuda hap kaldı mı? Bu üçü bildirimi engeller. |
| Tek tek yinelenen bildirim | Normal değil. Dozi açıkken uygulama kendi hatırlatmasını göndermez; sunucu açıkken yalnızca sunucudan gelir. |

## Güvenlik ve gizlilik

- Bildirim içeriği (ilaç adı, doz) sunucudan telefona **uçtan uca şifreli** gider, ama Apple/Google push
  servisleri üzerinden geçer; onlar mesajın içini okuyamaz, yalnızca bir bildirim gönderildiğini görür.
- VAPID private anahtarı sızarsa biri senin abonelerine bildirim gönderebilir. Yeni bir çift üret
  (`npm run vapid`), public anahtarı `js/push-config.js`'e yaz, `.env`'i güncelle, sonra telefonlarda
  bildirimleri kapatıp yeniden aç.
- Servis hesabı anahtarı sızarsa Google Cloud Console'dan o anahtarı sil ve yenisini üret.

## Testler

```sh
npm test            # depo kökünden: uygulama ve sunucu mantığı (kök paket)
```
