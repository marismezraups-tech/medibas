# Medības — komandas medību aplikācija telefonam

Progresīvā tīmekļa aplikācija (PWA), kas pēc funkcijām līdzinās Huntloc: komandas dalībnieki reāllaikā kartē, torņi ar šaušanas sektoriem, novērojumi un nomedītie dzīvnieki, čats, SOS, vējš un saule. Telefonā to instalē no pārlūka uz sākuma ekrāna, un tā strādā kā parasta aplikācija, arī bez sakariem.

## Funkcijas

| Sadaļa | Ko dara |
|---|---|
| **Karte** | OpenTopoMap, OSM, Esri satelīts un **LVM GEO** fona kartes: ortofoto (2019–2022 un 8. cikls 2022–2024), LĢIA topokarte 1:50 000, reljefa modelis, vēsturiskā topokarte 1:75 000. **LVM GEO pārklājumi:** kadastra karte, adreses un ceļi, koku augstums, reljefa slīpums, administratīvās robežas. Rāda tavu atrašanās vietu ar precizitātes apli un virziena bultiņu (GPS vai kompass). Ir sekošanas režīms, mērogs un attāluma/virziena mērīšana. Apskatītās kartes daļas glabājas ierīcē bezsaistes lietošanai. |
| **Komanda reāllaikā** | Visi dalībnieki kartē ar krāsu, iniciāļiem, lomu (mednieks, dzinējs, vadītājs, suns, novērotājs) un virzienu. Ja dalībnieks ilgāk par 2 min nav sūtījis atrašanās vietu, tas kļūst bālāks. Sarakstā redzams attālums un virziens līdz katram. |
| **Torņi / stāvvietas** | Nosaukums, piešķirtais mednieks un šaušanas sektors (virziens, leņķis, attālums), ko kartē zīmē kā ķīli. Virzienu var uzņemt ar telefona kompasu. Ir poga "Ieņemt šo torni". |
| **Atzīmes** | Novērojums, nomedīts dzīvnieks (suga, dzimums, vecums, svars, mednieks), šāviens, asinis/pēdas, suns, auto/pulcēšanās vieta, barotava, meža kamera, bīstama vieta. |
| **Navigācija** | "Vadīt uz" jebkuru atzīmi vai dalībnieku, ar attālumu un azimutu, kas atjaunojas tiešsaistē. |
| **Čats** | Ziņas komandai ar 10 ātrajām pogām ("Sākam dzīt", "Dzīvnieks iet uz jums", "Šāviens", "Medības beigušās" u.c.). Ziņai var pievienot atrašanās vietu. Vibrē un rāda paziņojumus. |
| **SOS** | Poga jātur 2 sekundes. Visiem komandas dalībniekiem parādās sarkana josla, telefons vibrē, un SOS sūtītāju var atrast ar navigāciju. |
| **Medību zona** | Zonas robežu zīmē uz kartes, un to redz visi dalībnieki. |
| **Medību statuss** | Plānotas, notiek vai beigušās. Statusa maiņu automātiski paziņo čatā. |
| **Vējš un laiks** | Dati no Open-Meteo: vēja virziens, ātrums, brāzmas un prognoze 6 stundām. Pēc izvēles var rādīt smaržas konusu (kurp vējš nes tavu smaržu). |
| **Saule un mēness** | Rīta un vakara krēsla, saullēkts, saulriets un mēness fāze. Tiek aprēķināti ierīcē. |
| **Žurnāls** | Nomedīto dzīvnieku un novērojumu vēsture no visām medībām ar statistiku pa sugām. Eksports uz CSV (Excel) un GPX. |
| **Baterijas taupīšana** | Ja 2 min nekusties, GPS atpūšas un ieslēdzas tikai uz brīdi ik 60 s; kustoties — atpakaļ precīzā režīmā. 🌙 **Torņa režīms**: melns ekrāns ar blāvi sarkanu tekstu (komanda, attālumi, ziņas, saulriets, vējš, ātrās pogas, SOS) — karte un kompass tad netiek darbināti. Komanda redz katra dalībnieka baterijas līmeni (Android). |
| **Drošība sektoros** | Kad medības notiek: ja kāds (arī suns ar trackeri) ieiet tava torņa šaušanas sektorā — dzeltens brīdinājums un spēcīga vibrācija; ja **tu** ieej kāda cita sektorā — brīdina tevi. |
| **Pazudušie** | Vadītājs saņem brīdinājumu, ja dalībnieks medību laikā 10 min nav sūtījis atrašanās vietu (ar pēdējo zināmo baterijas līmeni). |
| **Push paziņojumi** | SOS, trauksmes ziņas, medību sākums/beigas un torņa piešķiršana pienāk kā telefona paziņojums arī ar aizvērtu aplikāciju (Web Push, bez ārējiem servisiem). |
| **Dzinēju līnijas** | ＋ → ➡️ Dzinēja līnija: iezīmē ceļu ar bultu virzienā, kurā dzen; garums un virziens tiek paziņoti čatā. |
| **Foto** | Novērojumiem, nomedītiem dzīvniekiem u.c. var pievienot foto (automātiski samazināts līdz ~100 KB). |
| **Medību plāns** | 📅 Sākuma laiks ar atpakaļskaitīšanu, pulcēšanās vieta, torņu sadale — dalībnieki saņem paziņojumu par piešķirto torni. |
| **Medību atkārtošana** | Žurnāls → ⏪: visu dalībnieku, suņu un dzinēju kustība kartē ar laika slīdni un ātrumu ×15/×60/×300 (serveris glabā trekus 7 dienas). |
| **Karte bez interneta** | 🗺 → Lejupielādēt: medību zona (vai redzamais apgabals) ar izvēlēto fonu un pārklājumiem līdz 18. tuvinājumam. |
| **Parole un izslēgšana** | Medībām var iestatīt paroli; vadītājs (izveidotājs) var izslēgt dalībnieku. |
| **GPS trackeri** | Suņu u.c. trackeri ar OsmAnd/Traccar protokolu tiek rādīti kartē kā dalībnieki (sk. SAKT-SEIT.md). |
| **Pastāvīgi dati** | Pēc izvēles — Supabase datubāze (bez maksas), lai medību dati un treki nepazustu, kad bezmaksas serveris aizmieg. |
| **Īsta aplikācija** | Mape `native/` — Capacitor čaula Android/iOS ar fona atrašanās vietu (jābūvē ar Android Studio / Xcode). |
| **Maršruta ieraksts** | Treks ar attālumu un ilgumu; eksportē GPX. |
| **Citas iespējas** | Neļaut ekrānam izslēgties, atrašanās vietas sūtīšanas biežums (3–60 s), atrašanās vietas kopīgošanas izslēgšana. |

**Bezsaistē:** visi dati glabājas arī telefonā. Ja zūd sakari, notikumi tiek ielikti rindā un nosūtīti, kad savienojums atjaunojas (pie ziņas redzams ⏳).

**Suņu izsekošana:** Huntloc pārdod GPS kaklasiksnas. Šeit vienkāršākā alternatīva ir lēts telefons suņa vestē ar lomu "Suns" un sūtīšanas biežumu 3 s.

## Palaišana

👉 **Soli pa solim instrukcija telefonam: [SAKT-SEIT.md](SAKT-SEIT.md)** (Render.com bez maksas vai no sava datora ar `start-windows.bat` / `start-mac-linux.sh`). Sagatavots arī `render.yaml` un `Dockerfile`.

Vajag Node.js 18+. Ārēju atkarību nav.

```bash
node server.js          # http://localhost:8080
PORT=3000 node server.js
```

Serveris pasniedz aplikāciju no `public/` un nodrošina sinhronizāciju (Server-Sent Events). Dati glabājas `data.json`.

### Lietošana telefonos

Telefona pārlūks GPS atļauj tikai caur **HTTPS**, tāpēc serverim vajag HTTPS adresi:

- **Ātrai pārbaudei:** `cloudflared tunnel --url http://localhost:8080` vai `ngrok http 8080`. Iegūto https adresi atver telefonā.
- **Pastāvīgai lietošanai:** jebkurš VPS ar Caddy (`caddy reverse-proxy --from medibas.example.lv --to :8080`) vai Render/Fly.io/Railway.
  - Ja izmanto nginx, SSE vajag `proxy_buffering off;`.
- **Bez servera:** mapi `public/` var ielikt jebkurā statiskā HTTPS hostingā (GitHub Pages, Netlify). Tad aplikācija strādās "Lokālajā režīmā", bez komandas sinhronizācijas.

### Instalēšana telefonā

- **Android (Chrome):** izvēlne ⋮ → "Instalēt aplikāciju".
- **iPhone (Safari):** Kopīgot → "Pievienot sākuma ekrānam". Kompasam iOS pieprasīs atļauju, kad to ieslēgsi iestatījumos.

### Medību sākšana

1. Katrs ieraksta savu vārdu un lomu (cilne "Vairāk").
2. Vadītājs atver "Komanda" → "Izveidot medības" un ar pogu "Dalīties" nosūta kodu vai saiti (WhatsApp u.c.).
3. Pārējie atver saiti vai ievada kodu.
4. Vadītājs kartē izvieto torņus (＋ → 🪜) un nospiež "Sākt medības".

## Ierobežojumi

- Fonā pārlūka aplikācija atrašanās vietu nesūta (iOS/Android to aptur). Medību laikā ekrānam jāpaliek ieslēgtam (vai jāizmanto 🌙 torņa režīms). Pilnībā fonā strādā tikai īstā aplikācija no mapes `native/`.
- Medību parole sargā no nejaušiem pievienotājiem, bet tā nav pilnvērtīga lietotāju autentifikācija (nav kontu).
- LVM GEO slāņi nāk no `geoserver.lvmgeo.lv` (tā pati adrese, ko izmanto JOSM Latvijas kartēm). Ja tas neatbild, aplikācija automātiski pārslēdzas uz veco `lvmgeoserver.lvm.lv/geoserver/ows`. Adreses un slāņu nosaukumi ir `app.js` sākumā (`LVM`, `LAYERS`, `OVERLAYS`). Pirms publiskas vai komerciālas lietošanas pārbaudiet LVM GEO lietošanas noteikumus.
- LVM meža kvartālu/nogabalu un medību iecirkņu slāņi publiskajā WMS netika atrasti, tāpēc tie nav iekļauti.

## Struktūra

```
server.js                 sinhronizācijas + statisko failu serveris (bez atkarībām)
public/index.html         aplikācijas karkass
public/app.js             visa loģika
public/style.css          tumšais, ar cimdiem lietojamais dizains
public/sw.js              bezsaiste + kartes flīžu kešs
public/manifest.webmanifest, public/icons/
render.yaml               Render.com Blueprint (bezmaksas publicēšana)
Dockerfile                Fly.io / Railway / savs serveris (dati /data mapē)
start-windows.bat, start-mac-linux.sh   ātrā palaišana no datora ar https saiti
SAKT-SEIT.md              instrukcija, kā dabūt aplikāciju telefonā
```
