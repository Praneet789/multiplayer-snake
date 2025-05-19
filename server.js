const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 8080;

// Serve static files (frontend)
app.use(express.static(path.join(__dirname, 'public')));

// --- Your snake game logic here (copy your existing WebSocket/game code) ---

const tileCount = 20;
const players = new Map();
let food = { x: 10, y: 10 };

function generateId() {
  return Math.random().toString(36).slice(2);
}

function generateFood() {
  food.x = Math.floor(Math.random() * tileCount);
  food.y = Math.floor(Math.random() * tileCount);
}

function updateGame() {
  players.forEach((player, id) => {
    if (player.gameOver) return;
    const head = { x: player.snake[0].x + player.dx, y: player.snake[0].y + player.dy };
    if (head.x < 0 || head.x >= tileCount || head.y < 0 || head.y >= tileCount) {
      player.gameOver = true;
      return;
    }
    for (let i = 1; i < player.snake.length; i++) {
      if (head.x === player.snake[i].x && head.y === player.snake[i].y) {
        player.gameOver = true;
        return;
      }
    }
    players.forEach((other, otherId) => {
      if (otherId !== id) {
        other.snake.forEach(segment => {
          if (segment.x === head.x && segment.y === head.y) {
            player.gameOver = true;
          }
        });
      }
    });

    player.snake.unshift(head);
    if (head.x === food.x && head.y === food.y) {
      player.score += 10;
      generateFood();
    } else {
      player.snake.pop();
    }
  });

  const gameState = {
    food,
    players: Array.from(players.entries()).map(([id, p]) => ({
      id,
      snake: p.snake,
      score: p.score,
      gameOver: p.gameOver,
      headImg: p.headImg,
      bodyImg: p.bodyImg
    }))
  };

  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'gameState', data: gameState }));
    }
  });
}

setInterval(updateGame, 100);

wss.on('connection', (ws) => {
  const id = generateId();
  const spawnPoints = [
    { x: 5, y: 5 },
    { x: 15, y: 5 },
    { x: 5, y: 15 },
    { x: 15, y: 15 }
  ];
  const index = players.size % 4;
  const headImg = `head${index}.png`;
  const bodyImg = `body${index}.png`;

  players.set(id, {
    snake: [spawnPoints[index]],
    dx: 0,
    dy: 0,
    score: 0,
    gameOver: false,
    headImg,
    bodyImg
  });

  ws.send(JSON.stringify({ type: 'playerId', data: id }));

  ws.on('message', (msg) => {
    const message = JSON.parse(msg);
    const player = players.get(id);
    if (!player || player.gameOver) return;
    const { key } = message.data;

    if (key === 'ArrowUp' && player.dy === 0) { player.dx = 0; player.dy = -1; }
    else if (key === 'ArrowDown' && player.dy === 0) { player.dx = 0; player.dy = 1; }
    else if (key === 'ArrowLeft' && player.dx === 0) { player.dx = -1; player.dy = 0; }
    else if (key === 'ArrowRight' && player.dx === 0) { player.dx = 1; player.dy = 0; }
  });

  ws.on('close', () => {
    players.delete(id);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
