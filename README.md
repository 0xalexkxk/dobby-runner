# 🐶 Dobby Runner

An exciting endless runner game where you control a donut collecting XP and shooting tea cups while avoiding kitchen obstacles!

## 🎮 Game Features

- **Progressive Difficulty**: 4 levels with increasing speed and new donut skins
- **Multiple Obstacles**: Forks, knives, hot pans, coffee pots, sticky jam, and flying spoons
- **Collectibles**: XP icons and shootable tea cups for bonus points
- **Online Leaderboard**: Compete with players worldwide
- **Anti-Cheat System**: Server-side validation ensures fair play

## 🎯 Controls

- **Jump**: ↑ arrow key or mouse click
- **Shoot**: SPACE or left mouse button

## 🚀 Setup Instructions

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/donut-runner.git
cd donut-runner
```

2. Install server dependencies:
```bash
cd server
npm install
```

3. Start the server:
```bash
npm start
```
For development with auto-reload:
```bash
npm run dev
```

4. Open the game:
- For local development: Open `client/index.html` in your browser
- The server runs on `http://localhost:3000`

### Production Deployment

1. Set environment variables:
```bash
export NODE_ENV=production
export SECRET_KEY=your-secret-key-here
export PORT=3000
```

2. The server will automatically serve the client files in production mode.

## 🛡️ Anti-Cheat Features

The game includes multiple layers of cheat protection:

- **Client-side event tracking**: All game actions are logged
- **Server-side validation**: Score calculations are verified
- **Time-based checks**: Ensures realistic gameplay duration
- **Pattern detection**: Identifies superhuman play patterns
- **Rate limiting**: Prevents spam submissions
- **Data encryption**: Secure communication between client and server

## 📊 Scoring System

- **XP Collection**: +1 point per XP icon
- **Tea Cup Hit**: +5 points per successful shot
- **Level Progression**:
  - Level 1: 0-99 points (Base speed)
  - Level 2: 100-199 points (1.15x speed)
  - Level 3: 200-299 points (1.32x speed)
  - Level 4: 300+ points (1.52x speed)

## 🎨 Game Elements

### Obstacles
- **Forks & Knives**: Jump over them
- **Hot Pans**: Jump or shoot to extinguish flames
- **Coffee Pots**: Too tall to jump, must shoot
- **Sticky Jam**: Slows you down for 1 second
- **Flying Spoons**: Move vertically, require timing

### Backgrounds
- Kitchen
- Café
- Sweet Shop

## 🔧 Development

### Project Structure
```
donut-runner/
├── client/
│   ├── index.html
│   └── game.js
├── server/
│   ├── package.json
│   └── server.js
├── .gitignore
└── README.md
```

### API Endpoints

- `POST /api/submit-score`: Submit a game score
- `GET /api/leaderboard`: Retrieve top scores
- `GET /api/admin/suspicious`: Admin endpoint for reviewing suspicious scores

## 📝 License

This project is licensed under the MIT License.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 🐛 Known Issues

- Sound effects are not yet implemented
- Mobile touch controls could be improved
- Additional visual effects planned for future updates
