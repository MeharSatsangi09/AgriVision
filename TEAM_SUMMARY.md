# AgriVision — Team Summary

*Status as of 2026-09-25 (late).*

## 1. What AgriVision is

AgriVision is a web app that helps small and marginal farmers in India work out what is wrong with a crop. A farmer photographs an affected leaf and gets back a diagnosis, plain-language advice in their own language, and a place on a shared map. Many farmers have no easy access to an agronomist, so the app tries to fill that gap.

Extension officers and policymakers are the second audience. The same reports, grouped by region, show where a disease is spreading. The longer-term idea is a shared, interoperable crop-health data layer that different states could use, and the public `/data` page is a first concrete piece of it.

## 2. What's built and working

### The journey of one photo

1. The farmer opens `/diagnose`, adds a leaf photo (upload or camera) and a location (GPS or a tap on a map; anything outside India is rejected). The photo is shrunk in the browser before upload.
2. The backend runs three things at once: Gemini diagnoses the photo, our own classifier reads it, and satellite and soil lookups run for that location. The weather forecast is fetched first because the advice uses it.
3. A referee step compares Gemini and our classifier. The advice is written, and the report is saved.
4. A separate check looks for outbreaks across recent reports.
5. The report appears on the map and on its own result page within seconds. The very first upload after a quiet period can take up to about a minute.

### Features, in plain terms

- **Diagnosis from a photo.** Google's Gemini vision model names the disease, rates the severity (low, medium or high) and says how confident it is. If it isn't sure, it says so and asks for a clearer photo instead of guessing. Gemini picks from a fixed list of diseases, so names are consistent.
- **A second opinion from our own model.** We trained our own image classifier on the public PlantVillage dataset (about 97% accurate on its own test images, 38 disease types). It runs alongside Gemini, and the result page shows both readings side by side.
- **A referee between the two.** When Gemini and our classifier disagree, a "reconciliation agent" weighs both and gives one final answer with a short reason. If neither is trustworthy, it asks for a better photo. If the AI step fails, a fixed set of rules gives an answer, so a report is never lost.
- **Advice a farmer can act on.** It covers what to do now, treatment and prevention, in simple language. It also adds one low-cost, chemical-free practice tied to the diagnosis (for example a neem-based spray, or a crop rotation that breaks the disease cycle). It reads the local weather forecast, so it can say "don't spray today, rain is coming". This was confirmed on a real report.
- **Satellite and soil context.** A report can show how green the surrounding vegetation is, from satellite data (NASA MODIS), and the local soil pH and organic carbon (ISRIC SoilGrids). Both come with a plain-language reading, and they are shown as two separate signals.
- **Ask a follow-up question.** On any report the farmer can ask one question ("is it safe to eat?", "is there a cheaper option?", "how long until it improves?"). The answer is based on that report's diagnosis, advice and location, and it politely declines unrelated questions. There is a microphone button, so the question can be spoken in the app's current language. The answer is translated if the interface isn't in English.
- **Outbreak alerts.** When 3 or more reports of the same disease appear within 50 km and 7 days, the system flags an outbreak. It is shown as a red ring on the map and on the Alerts page. Alerts expire on their own when the cluster gets old or shrinks. For each visitor an alert counts as "new" once. Opening the map, the Alerts page or an affected report marks it seen, and it turns red again only if the outbreak grows.
- **Outbreak map.** All reports appear as markers on a Google map, with filters and a list you can click through.
- **Nine languages.** The whole interface and each report can be read in English, Hindi, Marathi, Tamil, Telugu, Bengali, Gujarati, Kannada and Punjabi. Report text is translated when someone asks for it and then saved, so it isn't translated twice.
- **Data for researchers.** The public `/data` page and its JSON endpoint (`/api/regional-data`) roll reports up by state: report counts, active outbreaks and top diseases. It is in English only, since it is aimed at researchers and policymakers.

### New since the last update

- **Phone login.** Uploading a photo and viewing the Alerts page need a phone-number login (an SMS code). The map, data page and report pages stay open. A phone number is never stored on a report.
- **My Reports and Profile.** A user icon in the header opens a menu: Profile (name and place, private to the owner, shown in the language you picked), My Reports (only your own uploads) and Log out.
- **Community reports.** The Reports box on the diagnose page shows the three newest reports, and `/reports` lists all of them with a disease search. Uploaders appear under generated names that cannot be linked to a person.
- **Weather.** A header pill opens a card with today's hourly forecast and the next 7 days (Open-Meteo). The whole site takes on the current weather: rain lands on the cards and drips off them, the sun leaves a soft reflection on card corners, and there is fog, snow and thunder. A preview row in the card lets you show any weather on demand; it is meant to be removed after the demo.
- **Languages.** The diagnose page, the state list and disease names are translated in all 9 languages. Names and places on the profile are converted to your language by an AI model, which depends on the shared Gemini quota.

### Look and feel (polish phase)

Smooth scrolling, animated cards, a full-screen landing sequence (four scenes with a moving AgriVision wordmark), a magnifying navigation dock, a custom language menu, phone-number login for uploads and alerts, a frosted-glass upload card, click-to-expand Reports and Active outbreaks tiles that update live, and a green theme throughout. The live data currently holds three reports: a real Late Blight upload from a teammate, a real Black Spot upload made through the phone login, and an earlier Black Spot report that shows the full feature set (our classifier, the referee, advice, regenerative tip and satellite data).

### Build history by phase

| Phase | What it delivered | Status |
|---|---|---|
| 1 | Upload, diagnosis, advice, saved report, map marker, deployed | Done |
| 2 | Outbreak agent, map alerts, translations | Done |
| 2.5 | Our own trained classifier, live beside Gemini | Done |
| 2.6 | Confidence guard for the classifier | Done |
| 2.7 | Reconciliation agent and follow-up agent | Done |
| 3 | Animation and UI polish | In progress (demo rehearsal and pitch deck still to do) |
| 3.5 | Interoperability page, satellite data, voice input, weather-aware advice, regenerative tip, soil data | Done |
| 3.6 | Phone login, My Reports, profile, community feed, language sweep, weather | Done |
| 4 | Buffer, final deploy check, submission | Not started |

## 3. What's live

| Part | Where |
|---|---|
| Website (Vercel) | https://agrivision-silk-psi.vercel.app |
| Main pages | `/` (landing), `/diagnose`, `/map`, `/reports`, `/alerts` (login), `/my-reports` (login), `/profile` (login), `/login`, `/report/<id>`, `/data` |
| Regional data (JSON) | https://agrivision-silk-psi.vercel.app/api/regional-data |
| Backend (Firebase project `agrivision-768d1`, region asia-south1) | Cloud Functions. They are not opened directly. The website calls them when a photo is uploaded, when a report is translated, when a question is asked or spoken, and on an hourly outbreak check. |
| Code | https://github.com/MeharSatsangi09/AgriVision |

Backend functions currently deployed: `processUpload` (the photo pipeline), `scheduledTrendCheck` (hourly outbreak check), `translateReport`, `translateUi`, `askFollowUpQuestion`, `transcribeSpeech` and `translateProfile`.

**How updates go live:** the website redeploys by itself when someone pushes to `main`. The backend does not. Run `firebase deploy --only functions` from the repo after changing anything in `/functions`.

## 4. Known limitations and open issues

- **Our classifier can be confidently wrong.** It only knows 38 PlantVillage disease types, from lab-style single-leaf photos. On real field photos it did much worse: on 19 photos outside that dataset it was confidently wrong on 5. The app shows Gemini's answer as the main one, and marks the classifier as uncertain when it is unsure or disagrees. In the pitch, say "97% on PlantVillage's test split, expect lower on real field photos". This is open item #3 in `refinement.md`.
- **Regions on `/data` are approximate.** A report is assigned to the nearest state centre, not by real borders, so near a boundary it can land in the neighbouring state. The page says so. It caught two of our test points (Nagpur and Belagavi) when we first built demo data. It only affects the regional rollup, not diagnosis or map pins.
- **Gemini free-tier limit.** About 5 requests a minute and 20 a day per model, roughly 5 uploads a day; name conversion on the profile shares it. This limits testing and demos. The options are a paid tier or moving to Vertex AI.
- **Translations are AI-written** and have not been reviewed by native speakers.
- **Phone login (new).** Uploading a photo and viewing the Alerts page need a phone-number login (SMS code). The map, the data page and report pages stay open, and reports are public. Locations are rounded to about 1 km for privacy, and the phone number is never stored in a report. Before the demo, check that a real login works from the live site; real Indian numbers also need India enabled in Firebase's SMS region settings (test numbers work without it).
- **Slow start.** The first upload after a quiet period can take 45–60 seconds. The upload function keeps one instance warm to help.
- **Cleanup owed.** Two leftover local git worktree folders (`review-wt`, `hackthon-review`) still need deleting by hand.

## 5. Architecture at a glance

- **Frontend:** a Next.js (React) app with Tailwind styling and Motion animations, hosted on Vercel. It reads reports live from Firebase and draws them on Google Maps.
- **Backend:** Firebase. Photos go to Cloud Storage, which triggers a Cloud Function. Reports are saved in Firestore and stream to the website in real time. Backend code is TypeScript.
- **Agents:** the backend is built from five AI agents made with Google's Agent Development Kit (ADK) and Gemini.

| Agent | Job |
|---|---|
| Diagnosis | Reads the photo: disease, severity, confidence |
| Advisory | Writes advice from the diagnosis, location and weather, plus the regenerative tip |
| Trend/Alert | Decides whether a cluster of reports is an outbreak |
| Reconciliation | Weighs Gemini against our classifier and gives the final answer |
| Follow-up | Answers one grounded question about a report |

  Diagnosis and advice run in sequence. Everything else runs in parallel or on demand.
- **Our own model:** a MobileNetV2 image classifier trained on PlantVillage, loaded from Cloud Storage. It runs in the backend beside Gemini and never holds up a report.
- **Other services:** Google Translation (languages), Google Cloud Speech-to-Text (voice), Google Earth Engine (satellite vegetation index), ISRIC SoilGrids (soil) and OpenWeatherMap (weather). If any of these fail, the report is still saved without that item.
- **What a saved report holds:** photo link, rounded location, time, diagnosis, advice and tip, our classifier's reading, the referee's verdict, satellite and soil readings, an alert flag, and cached translations.

## 6. Working on it

- **Repo layout:** `/frontend` (the website), `/functions` (the backend and agents), `/training` (the notebook that trained the classifier), plus Firebase rules files at the root.
- **Run the website locally:** in `/frontend`, run `npm install` then `npm run dev`. It needs its Firebase and Google Maps values in `frontend/.env.local`.
- **Backend secrets** (the Gemini key and the OpenWeatherMap key) live in `functions/.env`. That file is not committed, so ask a teammate for the values. Never commit it.
- **Commit email:** commits must use the GitHub "noreply" address. Vercel blocks deploys from any other author email.
- **Firebase on Windows:** use `firebase.cmd` and `npx.cmd`, since PowerShell blocks the default scripts.

## 7. Demo script and what's left

**Demo (1–2 minutes):** open the site, upload a diseased-leaf photo, show the diagnosis with the referee's final answer, read the advice (and the rain-aware timing), open the map with its two reports, switch the language, and ask the follow-up question by voice. An outbreak alert needs 3 reports of the same disease within 50 km in 7 days, so upload or add some first if you want to show one.

**Still to do:** rehearse and time the demo, prepare the pitch deck (present things we designed but haven't built, such as large-scale model training on Vertex AI, as a roadmap), resolve the Gemini quota, re-run the pending off-topic test, and do a final check of the live site in a clean browser window before submitting.
