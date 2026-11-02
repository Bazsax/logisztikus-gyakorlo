# Logisztikus gyakorló

Gyakorló webalkalmazás a **logisztikus (programkövetelmény: 10415006) állami vizsgához**. Statikus oldal, build és függőségek nélkül – Vercelen azonnal fut.

## Funkciók

- **Elméleti feladatok** – egyszeres és többszörös választás, igaz–hamis, csoportosítás, párosítás, sorrendbe rendezés, kifejtős (definíciós) kérdések. A kérdésbank a Redmenta-feladatlapok javítókulcsai alapján készült.
- **Gyakorlati feladatok** – a projektfeladat 8 típusa paraméteres generátorral (minden indításkor új számok), a táblázatok közvetlenül kitölthetők:
  1. Elosztási szükséglettervezés (DRP) · 2. Beszállítói értékelés súlyozott pontrendszerrel · 3. Gazdaságos rendelési tételnagyság (EOQ) · 4. Anyagszükséglet-tervezés (MRP) · 5. Johnson-szabály · 6. Forgási idő és sebesség kronologikus átlaggal · 7. Termelési jellemzők · 8. Körjárat sor-/oszlopminimum módszerrel
  - Extra típusok a korábbi vizsgafeladatsorokból: rendelésütemezés (késés, tartalékidő), ABC-analízis, OEE, készletszintek és összköltség (EOQ), három beszállító %-os értékelése, FIFO/LIFO/átlagár, minőségügyi mutatók (hibaráta, minőségi kategória és együttható). Az MRP többszintű (részegység + közös alkatrész) változatban is előfordul.
  - „A mintavizsga (Gamer szék) adatai” opció a tanfolyami mintafeladatot adja vissza, a hivatalos pontozás szerint.
- **Vegyes** mód és **vizsgaszimuláció** (írásbeli 60 perc / 30%, projektfeladat 120 perc / 70%, részenként min. 50%, érdemjegy).
- **Tipp** (3 fokozat), **Megoldás**, **Magyarázat**, **Kitöltés** – feladatonként és egyszerre az összesre.
- **Levezetés** a számolásos feladatoknál: lenyitható lépésekben, képletekkel, a saját számaiddal és tipikus hibákra figyelmeztetéssel.
- **AI-gombok**: segítő prompt másolása; megoldó prompt, amelyre az AI betölthető JSON-fájlt ad vissza (összevethető a beépített megoldással); kifejtős válaszok AI-értékelése visszatölthető pontszámmal.
- Statisztika, hibás kérdések újragyakorlása, világos/sötét téma, mobilbarát felület, offline működés (PWA), mentés/visszatöltés fájlba.

## Futtatás helyben

```bash
python3 -m http.server 8000
# majd: http://localhost:8000
```

## Telepítés Vercelre

Vercelben: *Add New → Project → Import* a `logisztikus-gyakorlo` repót, Framework preset: **Other**, build parancs nélkül. Minden push után automatikusan frissül.

## Kérdések bővítése

A kérdések forrása a `data/bank/*.json`. Szerkesztés után:

```bash
python3 tools/merge_bank.py   # ellenőrzi és összefűzi → data/theory.json
```

Formátum (példák):

```json
{"id":"besz-13","topic":"Beszerzési logisztika","type":"single","prompt":"…","options":["…","…"],"answer":0,"explanation":"…","source":"redmenta"}
{"id":"…","type":"multi","options":[…],"answer":[0,2]}
{"id":"…","type":"truefalse","statements":[["állítás",true],["állítás",false]]}
{"id":"…","type":"group","groups":["A","B"],"items":[["elem",0],["elem",1]]}
{"id":"…","type":"match","pairs":[["fogalom","leírás"]]}
{"id":"…","type":"order","items":["1. lépés","2. lépés"]}
{"id":"…","type":"essay","model":"mintaválasz","keyPoints":["kulcselem 1","kulcselem 2"]}
```

`source`: `redmenta` = a Redmenta javítókulcsa igazolja, `vizsga` = korábbi vizsgafeladatsor megoldókulcsa, `claude` = saját megoldás (az alkalmazás jelöli).
