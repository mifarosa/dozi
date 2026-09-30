# Dozi
İlaç takip PWA'sı: kutudaki blister ve hap sayısını gir, kaldığın yerden başla, kalan hapları blister gözleriyle görsel olarak takip et.

## Özellikler
- Kutu → blister → hap yapısı (ör. 2 blister × 14 hap)
- Kaldığın yerden başlama: hangi blister, hangi hap, yarım/çeyrek kalmış hap
- Çeyrek, yarım, tam, 1,5 ve 2 hap dozları; günde kaç kez alındığı
- Blister gözleriyle görsel takip, kalan hap ve tahmini bitiş günü
- "Aldım" butonu, tek seferlik ¼ / ½ / 1 seçenekleri ve geri alma
- Veriler cihazda (localStorage) saklanır; çevrimdışı çalışır, ana ekrana eklenebilir

## Çalıştırma
Derleme adımı yok; herhangi bir statik sunucu yeterli:

```sh
npx http-server -p 8080 .
```
