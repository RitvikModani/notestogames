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

1. **Paste your notes.** It understands the formats students actually use:
   - `Term: definition`
   - `Term - definition`
   - `Q: question` / `A: answer`
   - Markdown-style `**Term**` lines and bulleted glossaries
   - Plain paragraphs (it finds "X is …" definitions and key terms automatically)
2. **It builds study material** — term/definition pairs and fill-in-the-blank
   sentences — all locally in your browser (no AI service, no API keys, no cost).
3. **You play & learn** with five games, earning points and building a daily streak.

## 🕹️ The games

| Game | What you do |
| --- | --- |
| 🃏 **Flashcards** | Flip cards and mark what you know. |
| ⚡ **Quiz Blitz** | Auto-generated multiple-choice questions with smart distractors. |
| 🧩 **Memory Match** | Pair each term with its definition against the clock. |
| ✏️ **Fill the Blank** | Type the missing key word from your notes. |
| 🔤 **Word Guess** | Hangman-style term guessing, using the definition as a clue. |

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
This repo includes a workflow that deploys automatically at **no cost**:

1. Push to the `main` branch.
2. In your repo, go to **Settings → Pages** and set **Source: GitHub Actions**.
3. Your site goes live at `https://<your-username>.github.io/notestogames/`.

## 🗂️ Project structure

```
index.html               # app shell
assets/css/style.css     # "Tech Innovation" theme (electric blue / neon cyan)
assets/js/
  app.js                 # routing + views (home, import, deck, game)
  parser.js              # turns raw notes into study cards
  storage.js             # localStorage decks, points & streaks
  ui.js                  # DOM helpers, confetti, toasts
  games/                 # flashcards · quiz · match · blank · hangman
.github/workflows/       # free GitHub Pages deploy
```

## 🔒 Privacy

100% client-side. Your notes are parsed in your browser and stored only on your
device. Nothing is uploaded anywhere.

---

Made for students. Free forever.
