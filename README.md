# 🎮 NotesToGames

**Turn your class notes into fun, interactive study games — instantly, for free.**

Paste any notes (a glossary, a lecture summary, Q&A, or plain paragraphs) and
NotesToGames turns them into playable study games. No sign-up, no servers, no
cost — everything runs in your browser and your notes never leave your device.

![Made with HTML/CSS/JS](https://img.shields.io/badge/stack-vanilla%20JS-0066ff)
![No dependencies](https://img.shields.io/badge/dependencies-none-00b3b3)
![Free to host](https://img.shields.io/badge/hosting-free%20(GitHub%20Pages)-34d399)

---

## ✨ What it does

1. **Bring your material.** Upload a **PDF, Word (.docx) or PowerPoint (.pptx)**,
   or paste notes directly. Files are parsed **in your browser** — nothing is ever
   uploaded, so it's private and free. Word/PowerPoint use the native
   `DecompressionStream` API; PDFs (including exam papers with embedded fonts) are
   read with a bundled build of **[pdf.js](https://mozilla.github.io/pdf.js/)**
   (Apache-2.0), loaded on demand. Scanned/image-only PDFs can't be read as text —
   copy-paste those. A quality check rejects unreadable files instead of making
   garbage games.
   It understands the formats students actually use:
   - `Term: definition` / `Term - definition`
   - `Q: question` / `A: answer` (the answer becomes the concept, the question the clue)
   - bulleted glossaries and plain prose ("X is …" definitions, key terms)
2. **It builds study material** — accurately categorised term/definition pairs,
   fill-in-the-blank clozes, and a large **variety of question types** (match,
   reverse, true/false, cloze, description) — all locally, no AI service or cost.
3. **You play & learn** across **9 different games**, earning XP, leveling up, and
   building a daily streak.

## 🆚 How it's different

Not another flashcard app or live quiz show. NotesToGames turns **your own files**
into genuinely different *arcade* games — no account, no subscription, works
offline, and your documents never leave your device.

## 🕹️ The games

Nine different *kinds of play* — not one quiz in nine costumes:

| Game | Mechanic | What you do |
| --- | --- | --- |
| 🚀 **Term Blaster** | arcade / reflex | Fly a ship and **shoot** the correct answer out of the sky. Lives, combos, rising speed. |
| 🐍 **Recall Snake** | movement | Steer the snake into the lettered tile whose answer matches the clue. |
| ⏱️ **Time Attack** | speed | Answer as many varied questions as you can before the clock runs out; combo multiplier. |
| 🧗 **Concept Climb** | risk / progression | Each correct answer scales you higher and is worth more; slip and you lose a rope. |
| 🕵️ **Fact or Fake** | judgment | Decide fast whether a shown definition is real or a swapped-in decoy. |
| 🔍 **Word Search** | search / spatial | Drag across a letter grid to find the hidden terms — the clues are their definitions. |
| 🧩 **Memory Match** | spatial memory | Pair each term with its definition against the clock. |
| 🔀 **Word Scramble** | word manipulation | The term's letters are jumbled — rebuild it using the clue. |
| 🔤 **Word Guess** | deduction | Hangman-style, guess the term letter by letter from its clue. |

**Question variety:** the quiz-style games draw from a shared engine that mixes
term→definition, definition→term, true/false, cloze, and "pick the description".

**Game feel & polish:** synthesized arcade sound + haptics (mute toggle, no audio
files), an XP/level system, daily streaks, confetti, smooth transitions, and full
keyboard + `prefers-reduced-motion` accessibility.

Your study sets, best scores, points and streak are saved in your browser
(`localStorage`).

## 🚀 Run it

### Locally
Because it uses JavaScript modules, open it through a tiny local server (not
`file://`):

```bash
# from the project folder
python3 -m http.server 8000
# then visit http://localhost:8000
```

### Publish it for free (GitHub Pages)
It's a plain static site, so hosting is free and takes two clicks:

1. In your repo, go to **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **Deploy from a branch**, then
   pick branch **`main`** and folder **`/ (root)`**, and **Save**.
3. Your site goes live at `https://<your-username>.github.io/notestogames/`
   (give it a minute on the first publish).

No build step, no workflow, no cost. The included `.nojekyll` file makes GitHub
serve the files as-is.

## 🗂️ Project structure

```
index.html               # app shell
assets/css/style.css     # "Midnight Studio" theme (elegant dark, warm amber accent)
assets/js/
  app.js                 # routing + views (home, import, deck, game) + file upload
  parser.js              # notes/document text -> accurately categorised study cards
  extract.js             # in-browser PDF / Word / PowerPoint text extraction
  questions.js           # varied question generator (match, T/F, cloze, …)
  storage.js             # localStorage decks, points & streaks
  ui.js                  # DOM helpers, confetti, toasts
  sound.js               # Web Audio arcade sound + haptics
  games/                 # blaster · snake · timeattack · climb · factorfake
                         # · wordsearch · match · scramble · hangman
assets/vendor/           # pdf.js build (pdf.min.mjs + worker), Apache-2.0
.nojekyll                # serve files as-is on GitHub Pages
```

## 🔒 Privacy

100% client-side. Your notes are parsed in your browser and stored only on your
device. Nothing is uploaded anywhere.

---

Made for students. Free forever.
