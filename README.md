# Dozi
İlaç takip PWA'sı: kutudaki blister ve hap sayısını gir, kaldığın yerden başla, kalan hapları blister gözleriyle görsel olarak takip et.

## Özellikler
- Kutu → blister → hap yapısı (ör. 2 blister × 14 hap)
- Kaldığın yerden başlama: hangi blister, hangi hap, yarım/çeyrek kalmış hap
- Çeyrek, yarım, tam, 1,5 ve 2 hap dozları; günde kaç kez alındığı
- Blister gözleriyle görsel takip, kalan hap ve tahmini bitiş günü
- "Aldım" butonu, tek seferlik ¼ / ½ / 1 seçenekleri ve geri alma
- Hatırlatma saatleri (ilaç başına en fazla 3): saat geçtiği halde doz alınmadıysa bildirim ve ana ekranda uyarı
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
