const WebSocket = require('ws');

const port = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port });

const tileCount = 20;
const players = new Map();
let food = { x: 10, y: 10 };

function generateId() {
  return Math.random().toString(36).slice(2);
}

function generateFood() {
  food = {
    x: Math.floor(Math.random() * tileCount),
    y: Math.floor(Math.random() * tileCount),
  };
}

function updateGame() {
  players.forEach((player, id) => {
    if (player.gameOver) return;
    const head = { x: player.snake[0].x + player.dx, y: player.snake[0].y + player.dy };

    // Wall collision
    if (head.x < 0 || head.x >= tileCount || head.y < 0 || head.y >= tileCount) {
      player.gameOver = true;
      return;
    }

    // Self collision
    for (let i = 1; i < player.snake.length; i++) {
      if (head.x === player.snake[i].x && head.y === player.snake[i].y) {
        player.gameOver = true;
        return;
      }
    }

    // Other player collision
    for (const [otherId, otherPlayer] of players.entries()) {
      if (otherId !== id) {
        for (const segment of otherPlayer.snake) {
          if (head.x === segment.x && head.y === segment.y) {
            player.gameOver = true;
            return;
          }
        }
      }
    }

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
      id, score: p.score, snake: p.snake, gameOver: p.gameOver,
    })),
  };

  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: "gameState", data: gameState }));
    }
  });
}

wss.on('connection', (ws) => {
  const playerId = generateId();
  players.set(playerId, {
    snake: [{ x: 5, y: 5 }],
    dx: 1,
    dy: 0,
    score: 0,
    gameOver: false
  });

  ws.send(JSON.stringify({ type: 'playerId', data: playerId }));

  ws.on('message', (message) => {
    const msg = JSON.parse(message);
    const player = players.get(playerId);
    if (!player || player.gameOver) return;
    if (msg.type === 'input') {
      const key = msg.data.key;
      if (key === 'ArrowUp' && player.dy === 0) { player.dx = 0; player.dy = -1; }
      else if (key === 'ArrowDown' && player.dy === 0) { player.dx = 0; player.dy = 1; }
      else if (key === 'ArrowLeft' && player.dx === 0) { player.dx = -1; player.dy = 0; }
      else if (key === 'ArrowRight' && player.dx === 0) { player.dx = 1; player.dy = 0; }
    }
  });

  ws.on('close', () => {
    players.delete(playerId);
  });
});

setInterval(updateGame, 100);

console.log(`Server running on port ${port}`);
