(() => {
    const DIFFICULTY_COPY = {
        easy: "More clues on the board. A calm warm-up.",
        medium: "Fewer clues. The everyday puzzle.",
        hard: "A sparse grid. Notes will earn their keep."
    };
    const LEVEL_NAME = { easy: "Easy", medium: "Medium", hard: "Hard" };
    const TARGETS = { easy: 34, medium: 46, hard: 54 };
    const BUDGETS = { easy: 280, medium: 520, hard: 900 };

    let puzzle = blank();
    let solution = blank();
    let fixed = blank(false);
    let notes = blank(0);
    let revealed = blank(false);
    let history = [];
    let selectedCell = -1;
    let mistakes = 0;
    let hintsLeft = 3;
    let seconds = 0;
    let notesMode = false;
    let status = "idle";
    let activeDifficulty = "medium";
    let timerId = null;
    let overlayPrimaryHandler = () => {};
    let overlaySecondaryHandler = () => {};
    let cells = [];

    let difficultyElement;
    let difficultyHelp;
    let newGameButton;
    let timerElement;
    let livesElement;
    let bestElement;
    let bestLabel;
    let notesToggle;
    let notesState;
    let undoButton;
    let hintButton;
    let hintsLeftElement;
    let pauseButton;
    let pauseLabel;
    let pauseHint;
    let checkButton;
    let boardElement;
    let boardFrame;
    let pauseOverlay;
    let resumeButton;
    let numbersElement;
    let messageElement;
    let sheet;
    let overlay;
    let overlayKicker;
    let overlayTitle;
    let overlayText;
    let overlayPrimary;
    let overlaySecondary;

    function blank(fill = 0) {
        return Array.from({ length: 9 }, () => Array(9).fill(fill));
    }

    function shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    function isValid(board, row, col, number) {
        const boxRow = Math.floor(row / 3) * 3;
        const boxCol = Math.floor(col / 3) * 3;

        for (let i = 0; i < 9; i++) {
            if (board[row][i] === number || board[i][col] === number) return false;
            if (board[boxRow + Math.floor(i / 3)][boxCol + (i % 3)] === number) return false;
        }

        return true;
    }

    function seedDiagonal(board) {
        for (let box = 0; box < 3; box++) {
            const digits = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
            let cursor = 0;
            for (let row = 0; row < 3; row++) {
                for (let col = 0; col < 3; col++) {
                    board[box * 3 + row][box * 3 + col] = digits[cursor];
                    cursor += 1;
                }
            }
        }
    }

    function solve(board) {
        function dfs(position) {
            while (position < 81) {
                const row = Math.floor(position / 9);
                const col = position % 9;
                if (board[row][col] === 0) break;
                position += 1;
            }

            if (position === 81) return true;

            const row = Math.floor(position / 9);
            const col = position % 9;

            for (const number of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
                if (!isValid(board, row, col, number)) continue;
                board[row][col] = number;
                if (dfs(position + 1)) return true;
                board[row][col] = 0;
            }

            return false;
        }

        return dfs(0);
    }

    function generateSolved() {
        for (let attempt = 0; attempt < 6; attempt++) {
            const board = blank();
            seedDiagonal(board);
            if (solve(board)) return board;
        }

        throw new Error("Could not build a solved grid");
    }

    function bitCount(mask) {
        let count = 0;
        while (mask) {
            count += 1;
            mask &= mask - 1;
        }
        return count;
    }

    function countSolutions(grid, limit = 2, maxSteps = 250000) {
        const rows = Array(9).fill(0);
        const cols = Array(9).fill(0);
        const boxes = Array(9).fill(0);
        const empties = [];

        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                const value = grid[row][col];
                if (!value) {
                    empties.push(row * 9 + col);
                    continue;
                }

                const bit = 1 << value;
                const box = Math.floor(row / 3) * 3 + Math.floor(col / 3);
                rows[row] |= bit;
                cols[col] |= bit;
                boxes[box] |= bit;
            }
        }

        let count = 0;
        let steps = 0;

        function dfs(k) {
            if (count >= limit) return;
            if (++steps > maxSteps) {
                count = limit;
                return;
            }
            if (k === empties.length) {
                count += 1;
                return;
            }

            let best = k;
            let bestMask = 0;
            let bestCount = 10;

            for (let i = k; i < empties.length; i++) {
                const index = empties[i];
                const row = Math.floor(index / 9);
                const col = index % 9;
                const box = Math.floor(row / 3) * 3 + Math.floor(col / 3);
                const mask = (~(rows[row] | cols[col] | boxes[box])) & 0x3fe;
                const bits = bitCount(mask);

                if (bits < bestCount) {
                    best = i;
                    bestMask = mask;
                    bestCount = bits;
                    if (bits <= 1) break;
                }
            }

            if (bestCount === 0) return;

            const chosen = empties[best];
            empties[best] = empties[k];
            empties[k] = chosen;

            const row = Math.floor(chosen / 9);
            const col = chosen % 9;
            const box = Math.floor(row / 3) * 3 + Math.floor(col / 3);

            for (let number = 1; number <= 9; number++) {
                const bit = 1 << number;
                if ((bestMask & bit) === 0) continue;
                rows[row] |= bit;
                cols[col] |= bit;
                boxes[box] |= bit;
                dfs(k + 1);
                rows[row] ^= bit;
                cols[col] ^= bit;
                boxes[box] ^= bit;
                if (count >= limit) break;
            }

            empties[k] = empties[best];
            empties[best] = chosen;
        }

        dfs(0);
        return count;
    }

    function tryRemove(board, indexes) {
        const saved = indexes.map((index) => {
            const row = Math.floor(index / 9);
            const col = index % 9;
            const value = board[row][col];
            board[row][col] = 0;
            return { row, col, value };
        });

        const unique = countSolutions(board, 2) === 1;

        if (!unique) {
            saved.forEach(({ row, col, value }) => {
                board[row][col] = value;
            });
        }

        return unique;
    }

    function carve(board, target, deadline) {
        const order = shuffle([...Array(81).keys()]);
        let removed = 0;

        for (let i = 0; i < order.length && removed < target; i++) {
            if (performance.now() > deadline) break;

            const a = order[i];
            const b = 80 - a;
            if (a > b) continue;

            const pair = [];
            if (board[Math.floor(a / 9)][a % 9] !== 0) pair.push(a);
            if (a !== b && board[Math.floor(b / 9)][b % 9] !== 0) pair.push(b);
            if (!pair.length) continue;

            if (pair.length === 2 && removed + 2 <= target && tryRemove(board, pair)) {
                removed += 2;
                continue;
            }

            for (const index of pair) {
                if (removed >= target) break;
                if (board[Math.floor(index / 9)][index % 9] === 0) continue;
                if (tryRemove(board, [index])) removed += 1;
            }
        }

        return removed;
    }

    function buildPuzzle(level, budgetMs) {
        const target = TARGETS[level] ?? TARGETS.medium;
        const deadline = performance.now() + (budgetMs ?? BUDGETS[level] ?? BUDGETS.medium);
        const solved = generateSolved();
        const answer = solved.map((row) => row.slice());
        const game = solved.map((row) => row.slice());
        carve(game, target, deadline);
        return { game, answer };
    }

    function entriesMatchAnswer(game, answer) {
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                if (game[row][col] !== 0 && game[row][col] !== answer[row][col]) return false;
                if (!answer[row][col]) return false;
            }
        }
        return true;
    }

    function readStorage(key) {
        try {
            return localStorage.getItem(key);
        } catch {
            return null;
        }
    }

    function writeStorage(key, value) {
        try {
            localStorage.setItem(key, value);
        } catch {
            /* Storage can be blocked in private windows. */
        }
    }

    function readBest(level) {
        const raw = readStorage(`sudoku-best-${level}`);
        if (raw == null || raw === "") return null;
        const value = Number(raw);
        return Number.isFinite(value) ? value : null;
    }

    function formatTime(total) {
        const safe = Math.max(0, total);
        const minutes = Math.floor(safe / 60);
        const secs = safe % 60;
        return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    }

    function setMessage(text) {
        messageElement.textContent = text;
    }

    function cacheDom() {
        difficultyElement = document.getElementById("difficulty");
        difficultyHelp = document.getElementById("difficultyHelp");
        newGameButton = document.getElementById("newGame");
        timerElement = document.getElementById("timer");
        livesElement = document.getElementById("lives");
        bestElement = document.getElementById("best");
        bestLabel = document.getElementById("bestLabel");
        notesToggle = document.getElementById("notesToggle");
        notesState = document.getElementById("notesState");
        undoButton = document.getElementById("undo");
        hintButton = document.getElementById("hint");
        hintsLeftElement = document.getElementById("hintsLeft");
        pauseButton = document.getElementById("pause");
        pauseLabel = document.getElementById("pauseLabel");
        pauseHint = document.getElementById("pauseHint");
        checkButton = document.getElementById("check");
        boardElement = document.getElementById("board");
        boardFrame = document.getElementById("boardFrame");
        pauseOverlay = document.getElementById("pauseOverlay");
        resumeButton = document.getElementById("resume");
        numbersElement = document.getElementById("numbers");
        messageElement = document.getElementById("message");
        sheet = document.getElementById("sheet");
        overlay = document.getElementById("overlay");
        overlayKicker = document.getElementById("overlayKicker");
        overlayTitle = document.getElementById("overlayTitle");
        overlayText = document.getElementById("overlayText");
        overlayPrimary = document.getElementById("overlayPrimary");
        overlaySecondary = document.getElementById("overlaySecondary");
    }

    function buildBoard() {
        const fragment = document.createDocumentFragment();

        for (let index = 0; index < 81; index++) {
            const row = Math.floor(index / 9);
            const col = index % 9;
            const cell = document.createElement("button");
            cell.type = "button";
            cell.className = "cell";
            cell.dataset.index = String(index);
            cell.setAttribute("role", "gridcell");
            cell.tabIndex = -1;

            if ((Math.floor(row / 3) + Math.floor(col / 3)) % 2 === 1) {
                cell.classList.add("shade");
            }

            const value = document.createElement("span");
            value.className = "value";
            const marks = document.createElement("span");
            marks.className = "notes";
            marks.setAttribute("aria-hidden", "true");

            for (let n = 0; n < 9; n++) marks.appendChild(document.createElement("i"));

            cell.append(value, marks);
            cell.addEventListener("click", () => selectCell(index, false));
            cell.addEventListener("animationend", (event) => {
                if (event.animationName === "miss") cell.classList.remove("error");
                if (event.animationName === "pop") cell.classList.remove("pop");
            });
            fragment.appendChild(cell);
        }

        boardElement.appendChild(fragment);
        cells = [...boardElement.children];
    }

    function labelFor(row, col) {
        const value = puzzle[row][col];
        const kind = fixed[row][col] ? "given" : value ? "entered" : "empty";
        return `Row ${row + 1}, column ${col + 1}, ${value || "empty"}, ${kind}`;
    }

    function paintCell(index) {
        const cell = cells[index];
        const row = Math.floor(index / 9);
        const col = index % 9;
        const value = puzzle[row][col];
        const valueEl = cell.querySelector(".value");
        const marks = cell.querySelector(".notes");

        cell.classList.toggle("fixed", fixed[row][col]);
        cell.classList.toggle("filled", value !== 0);
        cell.classList.toggle("user", value !== 0 && !fixed[row][col] && !revealed[row][col]);
        cell.classList.toggle("revealed", Boolean(revealed[row][col]));

        if (value) {
            valueEl.textContent = String(value);
        } else {
            valueEl.textContent = "";
            const mask = notes[row][col];
            for (let n = 1; n <= 9; n++) {
                marks.children[n - 1].textContent = (mask & (1 << n)) ? String(n) : "";
            }
        }

        cell.setAttribute("aria-label", labelFor(row, col));
    }

    function paintAll() {
        for (let index = 0; index < 81; index++) paintCell(index);
        highlight();
        updateChrome();
    }

    function highlight() {
        const selectedValue = selectedCell >= 0
            ? puzzle[Math.floor(selectedCell / 9)][selectedCell % 9]
            : 0;
        const selectedRow = selectedCell >= 0 ? Math.floor(selectedCell / 9) : -1;
        const selectedCol = selectedCell >= 0 ? selectedCell % 9 : -1;

        for (let index = 0; index < 81; index++) {
            const cell = cells[index];
            const row = Math.floor(index / 9);
            const col = index % 9;
            const sameBox = selectedCell >= 0 &&
                Math.floor(row / 3) === Math.floor(selectedRow / 3) &&
                Math.floor(col / 3) === Math.floor(selectedCol / 3);
            const related = selectedCell >= 0 && index !== selectedCell &&
                (row === selectedRow || col === selectedCol || sameBox);
            const same = selectedValue !== 0 && puzzle[row][col] === selectedValue && index !== selectedCell;

            cell.classList.toggle("selected", index === selectedCell);
            cell.classList.toggle("related", related && !same);
            cell.classList.toggle("same", same);
            cell.setAttribute("aria-selected", index === selectedCell ? "true" : "false");
            cell.tabIndex = index === selectedCell ? 0 : -1;
        }
    }

    function countDigit(number) {
        let count = 0;
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                if (puzzle[row][col] === number) count += 1;
            }
        }
        return count;
    }

    function updatePad() {
        const selectedValue = selectedCell >= 0
            ? puzzle[Math.floor(selectedCell / 9)][selectedCell % 9]
            : 0;

        numbersElement.querySelectorAll("[data-number]").forEach((button) => {
            const number = Number(button.dataset.number);

            if (number === 0) {
                button.disabled = status !== "playing";
                button.classList.remove("active");
                return;
            }

            const left = 9 - countDigit(number);
            const sub = button.querySelector(".sub");
            sub.textContent = left > 0 ? String(left) : "";
            button.classList.toggle("done", left <= 0);
            button.classList.toggle("active", selectedValue === number);
            button.disabled = status !== "playing" || left <= 0;
            button.setAttribute("aria-label", left > 0 ? `${number}, ${left} left` : `${number} complete`);
        });
    }

    function updateChrome() {
        timerElement.textContent = formatTime(seconds);
        livesElement.querySelectorAll("span").forEach((dot, index) => {
            dot.classList.toggle("spent", index < mistakes);
        });
        livesElement.setAttribute("aria-label", `${Math.max(0, 3 - mistakes)} lives remaining`);

        const best = readBest(activeDifficulty);
        bestLabel.textContent = "Best";
        bestLabel.title = `Best time on ${activeDifficulty}`;
        bestElement.textContent = best === null ? "—" : formatTime(best);

        hintsLeftElement.textContent = hintsLeft === 1 ? "1 left" : `${hintsLeft} left`;
        hintButton.setAttribute("aria-label", `Hint, ${hintsLeft} left`);
        hintButton.disabled = status !== "playing" || hintsLeft <= 0;
        undoButton.disabled = history.length === 0 || status === "won" || status === "revealed" || status === "busy";
        notesState.textContent = notesMode ? "On" : "Off";
        notesToggle.setAttribute("aria-pressed", notesMode ? "true" : "false");
        notesToggle.disabled = status !== "playing";
        pauseButton.disabled = status !== "playing" && status !== "paused";
        pauseLabel.textContent = status === "paused" ? "Resume" : "Pause";
        pauseHint.textContent = status === "paused" ? "Show grid" : "Hide grid";
        checkButton.disabled = status !== "playing";
        newGameButton.disabled = status === "busy";
        newGameButton.textContent = status === "busy" ? "Dealing…" : "New game";
        difficultyElement.disabled = status === "busy";
        sheet.classList.toggle("notes-on", notesMode);
        document.body.dataset.status = status;
        updatePad();
    }

    function syncDifficultyHelp() {
        difficultyHelp.textContent = DIFFICULTY_COPY[difficultyElement.value] || DIFFICULTY_COPY.medium;
    }

    function findNextEmpty(start) {
        for (let step = 0; step < 81; step++) {
            const index = (start + step + 81) % 81;
            const row = Math.floor(index / 9);
            const col = index % 9;
            if (puzzle[row][col] === 0) return index;
        }
        return -1;
    }

    function selectCell(index, shouldFocus) {
        if (status === "busy" || status === "won" || status === "revealed") return;
        selectedCell = index;
        highlight();
        updatePad();
        if (shouldFocus && cells[index]) cells[index].focus();
    }

    function remember() {
        history.push({
            puzzle: puzzle.map((row) => row.slice()),
            notes: notes.map((row) => row.slice()),
            mistakes,
            hintsLeft,
            selected: selectedCell
        });
        if (history.length > 120) history.shift();
    }

    function popIn(index) {
        const cell = cells[index];
        cell.classList.remove("pop");
        void cell.offsetWidth;
        cell.classList.add("pop");
    }

    function flash(row, col) {
        const cell = cells[row * 9 + col];
        cell.classList.remove("error");
        void cell.offsetWidth;
        cell.classList.add("error");
    }

    function stripAllNotes(number) {
        const mask = ~(1 << number);
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) notes[row][col] &= mask;
        }
    }

    function stripPeerNotes(row, col, number) {
        const mask = ~(1 << number);
        const boxRow = Math.floor(row / 3) * 3;
        const boxCol = Math.floor(col / 3) * 3;

        for (let i = 0; i < 9; i++) {
            notes[row][i] &= mask;
            notes[i][col] &= mask;
            notes[boxRow + Math.floor(i / 3)][boxCol + (i % 3)] &= mask;
        }
    }

    function isSolved() {
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                if (puzzle[row][col] !== solution[row][col]) return false;
            }
        }
        return true;
    }

    function showOverlay({ kicker, title, text, primary, secondary, onPrimary, onSecondary }) {
        overlayKicker.textContent = kicker;
        overlayTitle.textContent = title;
        overlayText.textContent = text;
        overlayPrimary.textContent = primary;
        overlayPrimaryHandler = onPrimary || (() => {});

        if (secondary) {
            overlaySecondary.hidden = false;
            overlaySecondary.textContent = secondary;
            overlaySecondaryHandler = onSecondary || (() => {});
        } else {
            overlaySecondary.hidden = true;
            overlaySecondaryHandler = () => {};
        }

        overlay.hidden = false;
        overlayPrimary.focus();
    }

    function hideOverlay() {
        overlay.hidden = true;
    }

    function startTimer() {
        stopTimer();
        timerId = setInterval(() => {
            seconds += 1;
            timerElement.textContent = formatTime(seconds);
        }, 1000);
    }

    function stopTimer() {
        clearInterval(timerId);
        timerId = null;
    }

    function clearPause() {
        boardFrame.classList.remove("is-paused");
        pauseOverlay.hidden = true;
    }

    function startGame() {
        if (status === "busy") return;

        const level = DIFFICULTY_COPY[difficultyElement.value] ? difficultyElement.value : "medium";
        stopTimer();
        hideOverlay();
        clearPause();
        sheet.classList.remove("celebrate");

        let created;
        try {
            created = buildPuzzle(level);
        } catch {
            status = "idle";
            updateChrome();
            setMessage("Couldn't build a puzzle. Try New game again.");
            return;
        }

        activeDifficulty = level;
        writeStorage("sudoku-level", level);
        puzzle = created.game;
        solution = created.answer;
        fixed = puzzle.map((row) => row.map((value) => value !== 0));
        notes = blank(0);
        revealed = blank(false);
        history = [];
        mistakes = 0;
        hintsLeft = 3;
        seconds = 0;
        notesMode = false;
        selectedCell = findNextEmpty(0);
        status = "playing";
        paintAll();
        setMessage("Select a cell, then enter a digit. A wrong digit costs a life.");
        startTimer();
    }

    function pause() {
        if (status !== "playing") return;
        status = "paused";
        stopTimer();
        boardFrame.classList.add("is-paused");
        pauseOverlay.hidden = false;
        updateChrome();
    }

    function resume() {
        if (status !== "paused") return;
        status = "playing";
        clearPause();
        startTimer();
        updateChrome();
    }

    function togglePause() {
        if (status === "playing") pause();
        else if (status === "paused") resume();
    }

    function toggleNotes() {
        if (status !== "playing") return;
        notesMode = !notesMode;
        updateChrome();
        setMessage(notesMode
            ? "Notes on. Digits pencil in and don't cost a life."
            : "Notes off. Digits fill the cell.");
    }

    function undo() {
        if (status === "busy" || status === "won" || status === "revealed") return;
        const previous = history.pop();
        if (!previous) {
            setMessage("Nothing to undo.");
            return;
        }

        puzzle = previous.puzzle;
        notes = previous.notes;
        mistakes = previous.mistakes;
        hintsLeft = previous.hintsLeft;
        selectedCell = previous.selected;

        if (status === "lost") {
            status = "playing";
            hideOverlay();
            startTimer();
        }

        paintAll();
        setMessage("Undone.");
    }

    function win() {
        status = "won";
        stopTimer();
        const previous = readBest(activeDifficulty);
        let text = `You finished in ${formatTime(seconds)}.`;

        if (previous === null || seconds < previous) {
            writeStorage(`sudoku-best-${activeDifficulty}`, String(seconds));
            text += ` New personal best for ${activeDifficulty}.`;
        } else {
            text += ` Best on ${activeDifficulty} is ${formatTime(previous)}.`;
        }

        sheet.classList.add("celebrate");
        updateChrome();
        showOverlay({
            kicker: "Solved",
            title: "The grid is complete",
            text,
            primary: "Play again",
            onPrimary: startGame
        });
    }

    function lose() {
        status = "lost";
        stopTimer();
        updateChrome();
        showOverlay({
            kicker: "No lives left",
            title: "Out of lives",
            text: "Three wrong digits closes the round. Study the finished grid, or deal a new one.",
            primary: "New game",
            secondary: "Show solution",
            onPrimary: startGame,
            onSecondary: revealSolution
        });
    }

    function revealSolution() {
        hideOverlay();
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                if (puzzle[row][col] === 0) {
                    puzzle[row][col] = solution[row][col];
                    revealed[row][col] = true;
                }
            }
        }
        status = "revealed";
        paintAll();
        setMessage("Solution revealed. Deal a new game whenever you're ready.");
    }

    function giveHint() {
        if (status !== "playing") return;
        if (hintsLeft <= 0) {
            setMessage("No hints left on this puzzle.");
            return;
        }
        if (selectedCell < 0) {
            setMessage("Select an empty cell for a hint.");
            return;
        }

        const row = Math.floor(selectedCell / 9);
        const col = selectedCell % 9;

        if (fixed[row][col] || puzzle[row][col] !== 0) {
            setMessage("Select an empty cell for a hint.");
            return;
        }

        const index = selectedCell;
        remember();
        hintsLeft -= 1;
        const number = solution[row][col];
        puzzle[row][col] = number;
        notes[row][col] = 0;

        if (countDigit(number) >= 9) stripAllNotes(number);
        else stripPeerNotes(row, col, number);

        const next = findNextEmpty(index + 1);
        if (next >= 0) selectedCell = next;
        paintAll();
        popIn(index);

        if (isSolved()) {
            win();
            return;
        }

        setMessage(hintsLeft === 1 ? "Hint added. 1 hint left." : `Hint added. ${hintsLeft} hints left.`);
    }

    function erase(row, col) {
        if (puzzle[row][col] === 0 && notes[row][col] === 0) {
            setMessage("That cell is already empty.");
            return;
        }

        remember();
        puzzle[row][col] = 0;
        notes[row][col] = 0;
        paintCell(row * 9 + col);
        highlight();
        updateChrome();
        setMessage("Cell cleared.");
    }

    function toggleNote(row, col, number) {
        const bit = 1 << number;
        remember();
        notes[row][col] ^= bit;
        paintCell(row * 9 + col);
        highlight();
    }

    function place(row, col, number) {
        if (puzzle[row][col] === number) {
            setMessage("That digit is already in the cell.");
            return;
        }

        if (number !== solution[row][col]) {
            remember();
            mistakes += 1;
            flash(row, col);
            updateChrome();

            if (mistakes >= 3) {
                lose();
                return;
            }

            const left = 3 - mistakes;
            setMessage(left === 1
                ? "That digit doesn't fit. One life left."
                : `That digit doesn't fit. ${left} lives left.`);
            return;
        }

        const index = row * 9 + col;
        remember();
        puzzle[row][col] = number;
        notes[row][col] = 0;

        if (countDigit(number) >= 9) stripAllNotes(number);
        else stripPeerNotes(row, col, number);

        const next = findNextEmpty(index + 1);
        if (next >= 0) selectedCell = next;
        paintAll();
        popIn(index);

        if (isSolved()) {
            win();
            return;
        }

        setMessage(countDigit(number) >= 9 ? `${number} is complete.` : "Placed.");
    }

    function onNumber(number) {
        if (status !== "playing") {
            if (status === "paused") setMessage("The game is paused.");
            return;
        }

        if (selectedCell < 0) {
            const next = findNextEmpty(0);
            if (next < 0) return;
            selectedCell = next;
        }

        const row = Math.floor(selectedCell / 9);
        const col = selectedCell % 9;

        if (fixed[row][col]) {
            setMessage("That clue is locked.");
            highlight();
            return;
        }

        if (number === 0) {
            erase(row, col);
            return;
        }

        if (notesMode && puzzle[row][col] === 0) {
            toggleNote(row, col, number);
            return;
        }

        place(row, col, number);
    }

    function checkProgress() {
        if (status !== "playing") return;
        if (isSolved()) {
            win();
            return;
        }

        let filled = 0;
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                if (puzzle[row][col] !== 0) filled += 1;
            }
        }

        setMessage(`${filled} of 81 digits placed. ${81 - filled} still open.`);
    }

    function moveSelection(delta) {
        if (selectedCell < 0) {
            selectCell(0, true);
            return;
        }

        const row = Math.floor(selectedCell / 9);
        const col = selectedCell % 9;

        if (delta === -1 || delta === 1) {
            const nextCol = col + delta;
            if (nextCol < 0 || nextCol > 8) return;
            selectCell(row * 9 + nextCol, true);
            return;
        }

        const nextRow = row + (delta > 0 ? 1 : -1);
        if (nextRow < 0 || nextRow > 8) return;
        selectCell(nextRow * 9 + col, true);
    }

    function onKey(event) {
        const tag = event.target && event.target.tagName;
        if (tag === "SELECT" || tag === "INPUT" || tag === "TEXTAREA") return;

        if ((event.ctrlKey || event.metaKey) && (event.key === "z" || event.key === "Z")) {
            event.preventDefault();
            undo();
            return;
        }

        if (event.metaKey || event.ctrlKey || event.altKey) return;

        if (event.key === "p" || event.key === "P") {
            event.preventDefault();
            togglePause();
            return;
        }

        if (event.key === "Escape" && status === "paused") {
            resume();
            return;
        }

        if (event.key === "u" || event.key === "U") {
            if (status === "playing" || status === "paused" || status === "lost") {
                event.preventDefault();
                undo();
            }
            return;
        }

        if (status !== "playing" || !overlay.hidden) return;

        if (event.key === "n" || event.key === "N") {
            event.preventDefault();
            toggleNotes();
            return;
        }

        if (event.key === "h" || event.key === "H") {
            event.preventDefault();
            giveHint();
            return;
        }

        if (event.key === "Backspace" || event.key === "Delete" || event.key === "0") {
            event.preventDefault();
            onNumber(0);
            return;
        }

        if (/^[1-9]$/.test(event.key)) {
            event.preventDefault();
            onNumber(Number(event.key));
            return;
        }

        const moves = { ArrowUp: -9, ArrowDown: 9, ArrowLeft: -1, ArrowRight: 1 };
        if (event.key in moves) {
            event.preventDefault();
            moveSelection(moves[event.key]);
        }
    }

    function onDifficultyChange() {
        syncDifficultyHelp();
        if (status === "busy") return;

        const untouched = history.length === 0 && seconds < 2 &&
            (status === "playing" || status === "paused");

        if (untouched) {
            startGame();
            return;
        }

        if (difficultyElement.value !== activeDifficulty) {
            const name = LEVEL_NAME[difficultyElement.value] || "That difficulty";
            setMessage(`${name} starts with the next new game.`);
        }
    }

    function boot() {
        cacheDom();
        buildBoard();

        const savedLevel = readStorage("sudoku-level");
        if (savedLevel && DIFFICULTY_COPY[savedLevel]) difficultyElement.value = savedLevel;
        syncDifficultyHelp();

        newGameButton.addEventListener("click", startGame);
        difficultyElement.addEventListener("change", onDifficultyChange);
        notesToggle.addEventListener("click", toggleNotes);
        undoButton.addEventListener("click", undo);
        hintButton.addEventListener("click", giveHint);
        pauseButton.addEventListener("click", togglePause);
        resumeButton.addEventListener("click", resume);
        checkButton.addEventListener("click", checkProgress);
        numbersElement.addEventListener("click", (event) => {
            const button = event.target.closest("[data-number]");
            if (!button || button.disabled) return;
            onNumber(Number(button.dataset.number));
        });
        overlayPrimary.addEventListener("click", () => overlayPrimaryHandler());
        overlaySecondary.addEventListener("click", () => overlaySecondaryHandler());
        document.addEventListener("keydown", onKey);
        startGame();
    }

    if (typeof document === "undefined") {
        globalThis.__sudokuTest = {
            buildPuzzle,
            countSolutions,
            generateSolved,
            entriesMatchAnswer,
            isValid
        };
        return;
    }

    boot();
})();
