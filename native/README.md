# Medības kā īsta telefona aplikācija (Android / iOS)

Pārlūka versija atrašanās vietu sūta tikai, kamēr ekrāns ir ieslēgts. Šī mape ietin to pašu aplikāciju
**Capacitor** čaulā ar spraudni `@capacitor-community/background-geolocation`. Tad atrašanās vieta
tiek sūtīta **arī ar izslēgtu ekrānu** (kā Huntloc), un telefona paziņojumu joslā redzams “Medības notiek”.

Aplikācija ielādē saturu no `https://medibas.onrender.com` (sk. `capacitor.config.json` → `server.url`),
tāpēc visi labojumi serverī uzreiz nonāk arī aplikācijā — to nav jāpārbūvē.
Kods `public/app.js` pats pamana, ka darbojas īstajā aplikācijā, un izmanto fona atrašanās vietu.

> ⚠ Šī daļa sagatavota, bet nav uzbūvēta un pārbaudīta — būvēšanai vajag Android Studio (un iOS — Mac ar Xcode).

## Android (APK)

Vajag: Node.js 18+, [Android Studio](https://developer.android.com/studio).

```bash
cd native
npm install
npx cap add android
```

Atver `native/android/app/src/main/AndroidManifest.xml` un pirms `<application` pievieno:

```xml
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-feature android:name="android.hardware.location.gps" />
```

Tad:

```bash
npm run android      # atver Android Studio
```

Android Studio: **Build → Build App Bundle(s) / APK(s) → Build APK(s)**. Gatavo `app-debug.apk`
var nosūtīt komandai (WhatsApp/e-pasts) un instalēt (telefonā jāatļauj “Instalēt no nezināmiem avotiem”).
Publicēšanai Google Play vajag izstrādātāja kontu (vienreizēja maksa).

Pirmajā palaišanā atļauj atrašanās vietu **“Vienmēr”** (Android 10+ to prasa atsevišķi) un izslēdz
baterijas optimizāciju aplikācijai *Medības* (Iestatījumi → Aplikācijas → Medības → Baterija → Neierobežots).

## iPhone

Vajag Mac ar Xcode un Apple Developer kontu.

```bash
cd native && npm install && npx cap add ios && npm run ios
```

Xcode → `Info.plist` pievieno:
- `NSLocationWhenInUseUsageDescription` — “Lai komanda redzētu tevi kartē”
- `NSLocationAlwaysAndWhenInUseUsageDescription` — “Lai atrašanās vieta tiktu kopīgota arī ar izslēgtu ekrānu”
- *Signing & Capabilities* → **Background Modes** → ✓ *Location updates*

Plašāk: https://github.com/capacitor-community/background-geolocation
