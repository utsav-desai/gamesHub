# MiniGames Hub

A free, static, lightweight 2-player game hub for your own domain. It uses plain HTML, CSS, vanilla JavaScript, Firebase Realtime Database for live multiplayer state, and Cloudflare Pages for hosting.

Tic Tac Toe, Connect 4, Bingo 1v1, Quiz Duel, Battleship, and Name Place Animal Thing are playable in live 1v1 rooms.

## Folder Structure

```text
/
├── index.html
├── games/
│   ├── tic-tac-toe.html
│   ├── connect4.html
│   ├── bingo.html
│   ├── quiz.html
│   ├── battleship.html
│   └── name-place-animal-thing.html
├── css/
│   └── styles.css
├── js/
│   ├── firebase-config.js
│   ├── room.js
│   ├── tic-tac-toe.js
│   └── utils.js
└── README.md
```

## How The Room System Works

Each game room is stored under `/rooms/{roomCode}` in Firebase Realtime Database. The creator becomes `player1`; the joining player becomes `player2`. The shared room object stores the game type, players, game state, turn, winner, and rematch votes.

Shared couple features live under `/couple`: profiles, reminders, date ideas, mood check-ins, a shared note, and drawing strokes.

The browser stores a unique `playerId` in `localStorage`, so refreshing the page can reconnect the same player to the same room. The room helper in `js/room.js` handles room codes, create/join logic, two-player limits, live subscriptions, and basic presence. `js/game-room.js` handles the common room UI for the newer games, while each game file handles its own rules.

## Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com/).
2. Create a project.
3. In the project, open **Build > Realtime Database**.
4. Click **Create Database**.
5. Pick a region close to your players.
6. Start in test mode while developing.
7. Open **Project settings > General**.
8. Under **Your apps**, create a web app.
9. Copy the Firebase config object.
10. Paste the values into `js/firebase-config.js`.

The file already contains placeholders:

```js
const firebaseConfig = {
  apiKey: "PASTE_HERE",
  authDomain: "PASTE_HERE",
  databaseURL: "PASTE_HERE",
  projectId: "PASTE_HERE",
  storageBucket: "PASTE_HERE",
  messagingSenderId: "PASTE_HERE",
  appId: "PASTE_HERE"
};
```

## Development Firebase Rules

These are simple development rules for quick testing. They allow anyone to read and write rooms, so do not treat them as production security.

```json
{
  "rules": {
    "rooms": {
      "$roomCode": {
        ".read": true,
        ".write": true
      }
    },
    "couple": {
      ".read": true,
      ".write": true
    }
  }
}
```

## Safer Suggested Rules For V1

These rules still do not replace real authentication, but they limit the database to room-shaped data and basic room code keys.

```json
{
  "rules": {
    "rooms": {
      "$roomCode": {
        ".read": "$roomCode.matches(/^[A-Z0-9]{4,6}$/)",
        ".write": "$roomCode.matches(/^[A-Z0-9]{4,6}$/)",
        ".validate": "newData.hasChildren(['gameType', 'status', 'players'])",
        "gameType": {
          ".validate": "newData.val() === 'tic-tac-toe' || newData.val() === 'connect4' || newData.val() === 'bingo' || newData.val() === 'quiz' || newData.val() === 'battleship' || newData.val() === 'name-place-animal-thing'"
        },
        "status": {
          ".validate": "newData.val() === 'waiting' || newData.val() === 'playing' || newData.val() === 'finished'"
        },
        "players": {
          "$playerKey": {
            ".validate": "$playerKey === 'player1' || $playerKey === 'player2'"
          }
        }
      }
    },
    "couple": {
      ".read": true,
      ".write": true
    }
  }
}
```

For stronger production rules, add Firebase Authentication, even anonymous auth, and validate that each write belongs to the matching player id.

## Run Locally

Because this project uses ES modules, open it through a local web server instead of double-clicking the HTML file.

From the project folder:

```bash
python3 -m http.server 8080
```

Then visit:

```text
http://localhost:8080
```

Open two browser windows to test a live room.

## Deploy To Cloudflare Pages

1. Push this folder to a GitHub repository.
2. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/).
3. Open **Workers & Pages**.
4. Click **Create application**.
5. Choose **Pages**.
6. Connect your GitHub account.
7. Select the repository.
8. Use these build settings:
   - Framework preset: `None`
   - Build command: leave empty
   - Build output directory: `/`
9. Click **Save and Deploy**.

Cloudflare will give you a free `*.pages.dev` URL after deployment.

## Update The Live Site

After editing the code locally, push your changes to GitHub. Cloudflare Pages will automatically deploy the latest commit from your production branch.

```bash
git status
git add .
git commit -m "Add more multiplayer games"
git push
```

Then open your Cloudflare Pages project and watch the new deployment finish. Your `pages.dev` URL and custom domain will update when the deployment succeeds.

## Connect A Custom Domain

1. Open your Cloudflare Pages project.
2. Go to **Custom domains**.
3. Click **Set up a custom domain**.
4. Enter your domain or subdomain, such as `games.example.com`.
5. Follow Cloudflare's DNS prompts.
6. Wait for the SSL certificate to become active.

## Add Future Games

1. Create a new file in `games/`.
2. Reuse the shared styles from `css/styles.css`.
3. Use `js/game-room.js` for common room controls, or import lower-level room helpers from `js/room.js`.
4. Store game-specific state inside the room object, like `board`, `scores`, `questions`, or `ships`.
5. Keep game rules in a separate file such as `js/connect4.js`.

## Free Version Limitations

- No login means players are identified only by a local browser id.
- Development rules are open and should not be used for serious public traffic.
- Firebase free tier has usage limits, so very large traffic may need quota monitoring.
- Presence is simple and depends on Firebase disconnect events.
- Room cleanup is basic; old rooms can remain until you delete them or add cleanup logic.
