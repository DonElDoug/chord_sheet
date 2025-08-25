# Chord Progression App

Eine minimalistische Web-Anwendung zur Erstellung und Wiedergabe von Akkordfolgen, erstellt mit reinem HTML, CSS und JavaScript.

## Features

- **Tonart & Skala**: Wähle zwischen verschiedenen Tonarten (C, C#, D, etc.) und Skalen (Dur, Moll, Dorisch, Mixolydisch)
- **Akkord-Editor**: Einfaches Hinzufügen von Akkorden in römischer Notation (I, ii, iii, IV, V, vi, vii°)
- **Progression-Management**: Akkorde sortieren (Up/Down), einzeln löschen oder komplett leeren
- **Audio-Playback**: Grundton-Wiedergabe jedes Akkords mit Web Audio API
- **BPM-Steuerung**: Anpassbare Geschwindigkeit (60-200 BPM) mit Echtzeit-Slider
- **Sequencer**: Start/Stop-Funktionalität für automatische Progression-Wiedergabe
- **Persistierung**: Automatisches Speichern in LocalStorage
- **Export/Import**: JSON-basierter Datenaustausch über Dateien
- **Themes**: Umschaltbar zwischen dunklem (Standard) und hellem Design
- **Responsive Design**: Optimiert für Desktop, Tablet und Mobile
- **Barrierefreiheit**: ARIA-Labels, Tastaturbedienung, Fokus-Management

## Schnellstart

### Lokal

1. Lade alle Dateien in einen Ordner
2. Öffne `index.html` per Doppelklick im Browser
3. Wähle Tonart und Skala
4. Füge Akkorde hinzu und spiele die Progression ab

### Online (GitHub Pages)

Die App ist online verfügbar unter:
- **Project Site**: `https://<DEIN_USERNAME>.github.io/<DEIN_REPO_NAME>/`
- **User Site**: `https://<DEIN_USERNAME>.github.io` (nur wenn Repo = `<DEIN_USERNAME>.github.io`)
- **Custom Domain**: `https://<meine-domain.de>` (optional)

## GitHub Pages Deployment

### A. Vorbereitung (immer erforderlich)

- ✅ Verwende ausschließlich relative Pfade in `index.html`: `./styles.css`, `./script.js`, `./assets/icon.svg`
- ✅ Stelle sicher, dass `index.html` im Repository-Root liegt (nicht in Unterordnern)
- ✅ Setze das Repository auf **Public**

### B. Variante 1: Browser-Workflow (empfohlen)

1. Gehe zu https://github.com/new
2. Erstelle neues Repository:
   - Name: `<DEIN_REPO_NAME>` (oder `<DEIN_USERNAME>.github.io` für User Site)
   - Visibility: **Public**
3. Klicke **Add file** → **Upload files**
4. Lade alle Dateien hoch: `index.html`, `styles.css`, `script.js`, `/assets/icon.svg`
5. Commit mit Nachricht "Initial commit"
6. Gehe zu **Settings** → **Pages**
7. Source: **Deploy from a branch**
8. Branch: **main** — Folder: **/ (root)** → **Save**
9. Warte auf den grünen Banner "Your site is live"
10. Öffne die angezeigte URL

### C. Variante 2: Git CLI (für Entwickler)

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<DEIN_USERNAME>/<DEIN_REPO_NAME>.git
git push -u origin main
```

Dann: Settings → Pages (wie oben: Branch: main, Folder: /(root))

### D. Custom Domain (optional)

1. In **Settings** → **Pages** → **Custom domain**: `<meine-domain.de>` eintragen
2. GitHub erzeugt automatisch eine `CNAME`-Datei
3. DNS-Einstellungen: CNAME-Record auf `<DEIN_USERNAME>.github.io` zeigen lassen
4. Nach DNS-Propagation (meist 5-30 Minuten) ist die Seite unter der Domain erreichbar

### E. Häufige Fehler & Lösungen

| Problem | Lösung |
|---------|--------|
| 404 oder leere Seite | Prüfe: `index.html` im Root + Pages-Quelle auf `main`/`/(root)` |
| CSS/JS lädt nicht | Verwende relative Pfade (`./...`), keine absoluten (`/...`) |
| Audio startet nicht | AudioContext erst nach User-Interaktion (Browser-Policy) |
| Änderungen nicht sichtbar | Hard-Reload (Ctrl+Shift+R) oder URL mit `?v=1` |

## Tastatur-Shortcuts

- **Leertaste**: Play/Stop (außerhalb von Eingabefeldern)
- **Escape**: Stop-Wiedergabe
- **Enter**: Akkord hinzufügen (im Akkord-Eingabefeld)
- **Tab**: Navigation durch alle interaktiven Elemente

## Browser-Kompatibilität

- ✅ Chrome 66+
- ✅ Firefox 60+
- ✅ Safari 11.1+
- ✅ Edge 79+

**Hinweis**: Web Audio API erfordert moderne Browser und HTTPS (außer localhost).

## Technische Details

### Dateistruktur
```
/
├── index.html          # Hauptseite mit semantischem HTML
├── styles.css          # CSS mit Variablen für Theme-Support
├── script.js           # Vanilla JavaScript ohne Abhängigkeiten
├── assets/
│   └── icon.svg        # App-Icon
└── README.md           # Diese Dokumentation
```

### State Management
- **LocalStorage**: Automatische Persistierung von Progression und Einstellungen
- **In-Memory**: Playback-Status und Audio-Context
- **JSON-Export**: Vollständiger State-Transfer zwischen Geräten

### Audio-Implementation
- **Web Audio API**: Native Browser-Audio ohne externe Libraries
- **Lazy Loading**: AudioContext erst bei User-Interaktion
- **Oszillator**: Einfache Sinuswellen für Akkord-Grundtöne
- **Envelope**: Attack/Release für natürlichere Klänge

## Erweiterungsmöglichkeiten

### Priorität 1 (einfach umsetzbar)
- **Preset-Progressions**: Häufige Akkordfolgen (ii-V-I, vi-IV-I-V)
- **Metronom-Click**: Hörbarer Beat während der Wiedergabe
- **Akkord-Voicings**: Mehrere Stimmen statt nur Grundton

### Priorität 2 (mittlerer Aufwand)
- **URL-Sharing**: Progression über URL-Parameter teilen
- **Erweiterte Notation**: 7er, 9er, sus-Akkorde
- **Visual Feedback**: Akkord-Visualisierung während Wiedergabe

### Priorität 3 (komplex)
- **PWA-Support**: Offline-Funktionalität
- **MIDI-Export**: Standard-Format für DAWs
- **Chord Suggestions**: KI-basierte Vorschläge

## Lizenz

MIT License - siehe [LICENSE](LICENSE) für Details.

## Entwicklung

### Lokale Entwicklung
```bash
# Einfacher HTTP-Server (Python)
python -m http.server 8000

# Oder (Node.js)
npx serve .

# Dann: http://localhost:8000
```

### Debugging
- Browser DevTools für Fehler und Performance
- Console-Logs für State-Changes
- Network-Tab für Asset-Loading

## Support

Bei Problemen:
1. Prüfe Browser-Console auf Fehlermeldungen
2. Teste in einem anderen Browser
3. Stelle sicher, dass JavaScript aktiviert ist
4. Bei Audio-Problemen: Teste mit User-Interaktion (Button-Klick)

---

**Erstellt mit ❤️ und Vanilla JavaScript**
