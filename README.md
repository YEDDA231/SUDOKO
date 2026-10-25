# Sudoku

A browser Sudoku game with notes, undo, hints, and three difficulties. There is no build step. GitHub Pages can host these files as they are.

## Play on your computer

Open `index.html`, or start a tiny server from this folder:

```powershell
python -m http.server 8080
```

Then visit http://localhost:8080

## Publish it as a live site

The pages use relative links (`style.css`, `script.js`), so they work at `https://YOUR_NAME.github.io/YOUR_REPO/`.

1. Create a new **public** repository on GitHub. Free GitHub Pages needs a public repo.
2. In this folder, run:

```powershell
git init
git add .
git commit -m "Publish the Sudoku game"
git branch -M main
git remote add origin https://github.com/YOUR_NAME/YOUR_REPO.git
git push -u origin main
```

3. On GitHub, open **Settings → Pages**.
4. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
5. Set **Branch** to `main` and the folder to **/ (root)**, then save.
6. Give it a minute. The site address appears at the top of that Pages screen.

The empty `.nojekyll` file tells GitHub to serve the folder as a plain website, so the HTML, CSS, and script are not rewritten.

## How to play

- Click a cell, or move with the arrow keys.
- Enter a digit with the pad or the number keys. A wrong digit costs a life and is not written in.
- **N** toggles notes. Notes pencil a digit in without spending a life.
- **U** undoes the last entry, note, hint, or mistake.
- **H** fills the selected empty cell. Each puzzle has three hints.
- **P** pauses the timer and covers the grid.
- Your best time for each difficulty is saved in this browser.
"# SUDOKO" 
