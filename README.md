# backupserver
Backup-Server auf Basis von Node-JS, der in Verbindung mit der Contao-Erweiterung [bohnmedia/contaobackup](https://github.com/bohnmedia/contaobackup) funktioniert.

Damit der Server funktioniert, muss die Datei servers.txt im Root-Verzeichnis erstellt werden. In diese wird pro Zeile ein Server samt Backup-Key eingetragen.

```
https://www.server1.de/ abcdefghijklmnopqrstuvwxyz123456
https://www.server2.de/ abcdefghijklmnopqrstuvwxyz123456
https://www.server3.de/ abcdefghijklmnopqrstuvwxyz123456
```

Zwischen Server und Backup-Key können beliebig viele Leerzeichen bzw. Tabs eingefügt werden.

Zudem kann am Anfang der index.js definiert werden, wie oft Backups ausgeführt werden sollen.

```javascript
const options = {
    backupsPerServer: {
        hour: 3,
        day: 7,
        week: 4,
        month: 3,
        year: 1
    }
}
```

Folgende Werte stehen zur Verfügung.

* minute
* hour
* day
* week
* month
* year

Da das Script je Aufruf nur ein Mal durch läuft, muss es regelmäßig per Cronjob aufgerufen werden.
