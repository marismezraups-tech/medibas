# Kā dabūt aplikāciju savā telefonā

Telefons atļauj GPS tikai aplikācijām ar drošu **https://** adresi. Tāpēc aplikācijai vajag mājvietu internetā. Ir divi ceļi:

| | **A. Render.com (ieteicams)** | **B. No sava datora** |
|---|---|---|
| Cena | Bez maksas | Bez maksas |
| Darbojas | Vienmēr, no jebkuras vietas | Tikai kamēr dators ir ieslēgts |
| Adrese | Pastāvīga, piem. `medibas-xxxx.onrender.com` | Mainās katru reizi |
| Laiks | ~10 min | ~3 min |
| Piemērots | Īstām medībām ar komandu | Ātrai izmēģināšanai |

---

## A. Publicēšana Render.com (pastāvīgi, bez maksas)

### 1. Ielādē kodu GitHub
1. Atver **github.com** un izveido kontu, ja tāda nav.
2. Augšā labajā pusē nospied **+** → **New repository**.
3. Nosaukums: `medibas`. Var izvēlēties **Private**. Nospied **Create repository**.
4. Jaunajā lapā nospied saiti **uploading an existing file**.
5. Izarhivē `medibas.zip` savā datorā. Atver mapi `medibas` un **visu tās saturu** (`server.js`, `package.json`, `render.yaml`, mapi `public` utt.) ievelc pārlūka logā.
6. Nospied **Commit changes**.

> Svarīgi: `server.js` jābūt repozitorija saknē, nevis apakšmapē `medibas/`.

### 2. Publicē Render
1. Atver **render.com** → **Get Started** → pieslēdzies ar GitHub kontu.
2. Nospied **New +** → **Blueprint**.
3. Izvēlies repozitoriju `medibas` → **Connect**. Render pats nolasa `render.yaml` failu.
4. Nospied **Apply** / **Deploy Blueprint** un pagaidi 1–3 minūtes.
5. Atver servisu `medibas`. Augšā būs adrese, piem. **https://medibas-ab12.onrender.com**. Šī ir tava aplikācijas adrese.

Ja Blueprint neparādās: **New +** → **Web Service** → izvēlies repozitoriju → *Runtime:* Node, *Build Command:* `echo ok`, *Start Command:* `node server.js`, *Instance Type:* **Free**.

### Bezmaksas plāna īpatnības
- Ja 15 minūtes neviens aplikāciju neizmanto, serveris "aizmieg". Pirmā atvēršana pēc tam aizņem **līdz ~1 minūtei**. Pa to laiku aplikācija strādā lokāli un pati pieslēdzas, kad serveris pamostas.
- Medību laikā serveris neaizmieg, jo telefoni regulāri sūta atrašanās vietas.
- Pēc aizmigšanas servera atmiņa tiek notīrīta, bet medību dati glabājas visos telefonos. Pirmais telefons, kas pieslēdzas, **automātiski augšupielādē** torņus, atzīmes, zonu un čatu atpakaļ.
- Ja vēlies, lai serveris nekad neaizmigtu, Render "Starter" plāns maksā ~7 $/mēn.

---

## B. Ātrā izmēģināšana no sava datora

1. Uzinstalē **Node.js** (LTS): https://nodejs.org
2. Uzinstalē **cloudflared**:
   - Windows: atver *Command Prompt* un ieraksti `winget install --id Cloudflare.cloudflared`
   - macOS: `brew install cloudflared`
3. Izarhivē `medibas.zip` un palaid:
   - Windows: dubultklikšķis uz **start-windows.bat**
   - macOS / Linux: terminālī `./start-mac-linux.sh`
4. Logā parādīsies adrese, kas beidzas ar **.trycloudflare.com**. Atver to telefonā.

---

## Uzstādīšana telefonā (pēc A vai B)

Atver aplikācijas adresi telefonā. To var izdarīt vienā no veidiem:
- atvērt adresi datorā un sadaļā **Vairāk → Atvērt citā telefonā** noskenēt QR kodu ar telefona kameru;
- nosūtīt adresi sev WhatsApp vai e-pastā.

### Android (Chrome)
1. Atver adresi **Chrome** pārlūkā.
2. Izvēlne **⋮** → **Instalēt aplikāciju** (vai **Pievienot sākuma ekrānam**).
3. Kad prasa atļauju **atrašanās vietai**, izvēlies **Atļaut**. **Paziņojumus** arī atļauj.

### iPhone (Safari)
1. Atver adresi **Safari** pārlūkā. Citos pārlūkos iPhone to nevar instalēt.
2. Nospied **Kopīgot** (kvadrāts ar bultu) → **Pievienot sākuma ekrānam** → **Pievienot**.
3. Atver aplikāciju no sākuma ekrāna un atļauj **atrašanās vietu**.
4. Ja vajag kompasu: **Vairāk → Izmantot kompasu** → atļauj.

Ja kādreiz nejauši aizliedz atrašanās vietu:
- **Android:** Iestatījumi → Aplikācijas → Chrome → Atļaujas → Atrašanās vieta.
- **iPhone:** Iestatījumi → Privātums → Atrašanās vietas pakalpojumi → Safari vietnes → "Lietošanas laikā".

---

## Pirmās medības

1. **Vairāk:** ieraksti savu vārdu, izvēlies lomu un krāsu → **Saglabāt profilu**.
2. **Komanda:** ieraksti medību nosaukumu → **Izveidot medības**.
3. Nospied **📤 Dalīties** (sūta saiti, piem., WhatsApp) vai **▦ QR**, ko pārējie noskenē ar kameru.
4. **Karte:** ar **＋ → 🪜 Tornis** izvieto torņus un uzstādi šaušanas sektorus. Fonu un LVM kartes izvēlas ar pogu **🗺**.
5. **Komanda → ▶ Sākt medības**. Visi saņem paziņojumu čatā.
6. Medību laikā ieslēdz **Vairāk → Neļaut ekrānam izslēgties**. Fonā pārlūka aplikācija atrašanās vietu nesūta.

**SOS:** pogu jātur 2 sekundes. Visi komandas telefoni vibrē un rāda, kur tu esi.

---

## Papildu iestatījumi (pēc izvēles)

### 🔔 Paziņojumi ar aizvērtu aplikāciju
**Vairāk → Paziņojumi → Ieslēgt paziņojumus** un atļauj. Android darbojas Chrome; iPhone — tikai, ja aplikācija pievienota sākuma ekrānam (iOS 16.4+).

### 💾 Lai dati nepazustu (Supabase, bez maksas)
Bezmaksas Render serveris aizmigstot aizmirst datus (tos atjauno telefoni, bet ne kustības trekus un push abonementus). Pastāvīgai glabāšanai:
1. **supabase.com** → izveido kontu → **New project** (reģions: Frankfurt / Central EU).
2. Projektā atver **SQL Editor** un izpildi:
   ```sql
   create table if not exists medibas_rooms (
     code text primary key,
     data jsonb not null,
     updated_at timestamptz default now()
   );
   alter table medibas_rooms enable row level security;
   ```
3. **Project Settings → API**: nokopē **Project URL** un **service_role** atslēgu (slepena — nevienam nesūti).
4. **Render** → serviss *medibas* → **Environment** → **Add Environment Variable**:
   - `SUPABASE_URL` = Project URL
   - `SUPABASE_KEY` = service_role atslēga
   → **Save Changes** (serveris pārstartēsies).
5. Pārbaude: atver `https://medibas.onrender.com/api/ping` — jābūt `"storage":"supabase"`.

### 📡 GPS trackeri suņiem
Der jebkura ierīce vai lietotne ar **OsmAnd** protokolu, piem., bezmaksas **Traccar Client** uz veca Android telefona suņa vestē:
1. Aplikācijā: **Komanda → GPS trackeri → ＋ Pievienot** → ievadi ierīces ID (piem., `reksis1`), vārdu, veidu.
2. Traccar Client: **Device identifier** = tas pats ID, **Server URL** = `https://medibas.onrender.com/api/tracker`, **Frequency** = 10 s, ieslēdz **Service status**.
3. Suns parādās kartē kā dalībnieks; uz viņu strādā arī sektoru brīdinājumi.

Specializētie suņu kaklasiksnu trackeri (Garmin u.c.) savus datus parasti nedod ārējiem serveriem; lētie GPS trackeri bieži atbalsta OsmAnd/HTTP — pārbaudi trackera instrukcijā.

### 📱 Īsta aplikācija (atrašanās vieta arī ar izslēgtu ekrānu)
Sk. `native/README.md` — vajag datoru ar Android Studio (iPhone — Mac ar Xcode).
