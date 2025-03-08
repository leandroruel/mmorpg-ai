const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Servir arquivos estáticos da pasta public
app.use(express.static(path.join(__dirname, '../../public')));

// Armazenar dados dos jogadores
const players = {};
const monsters = {};

// Inicializar alguns monstros básicos
function initMonsters() {
  monsters['monster1'] = {
    id: 'monster1',
    type: 'poring',
    position: { x: 5, y: 0, z: 5 },
    hp: 100,
    maxHp: 100
  };
  
  monsters['monster2'] = {
    id: 'monster2',
    type: 'poring',
    position: { x: -5, y: 0, z: -5 },
    hp: 100,
    maxHp: 100
  };
}

initMonsters();

// Socket.io para comunicação em tempo real
io.on('connection', (socket) => {
  console.log('Novo jogador conectado:', socket.id);

  // Quando um jogador se conecta e envia seu nome
  socket.on('login', (playerName) => {
    console.log(`Jogador ${playerName} entrou no jogo`);
    
    // Criar novo jogador
    players[socket.id] = {
      id: socket.id,
      name: playerName,
      position: { x: 0, y: 0, z: 0 },
      rotation: 0,
      hp: 100,
      maxHp: 100
    };
    
    // Enviar dados iniciais para o jogador
    socket.emit('gameState', { 
      players, 
      monsters,
      selfId: socket.id 
    });
    
    // Notificar outros jogadores sobre novo jogador
    socket.broadcast.emit('playerJoined', players[socket.id]);
  });
  
  // Quando um jogador se move
  socket.on('playerMove', (position) => {
    if (players[socket.id]) {
      players[socket.id].position = position;
      socket.broadcast.emit('playerMoved', {
        id: socket.id,
        position
      });
    }
  });
  
  // Quando um jogador ataca
  socket.on('playerAttack', (data) => {
    // Garantir que temos os dados no formato correto
    const targetId = typeof data === 'object' ? data.targetId : data;
    const attackerId = typeof data === 'object' ? data.attackerId : socket.id;
    
    console.log(`[SERVIDOR] Jogador ${attackerId} atacou monstro ${targetId}`);
    
    if (monsters[targetId]) {
      // Lógica simples de dano
      const damage = Math.floor(Math.random() * 10) + 5;
      monsters[targetId].hp -= damage;
      
      // Verificar se o monstro morreu
      if (monsters[targetId].hp <= 0) {
        console.log(`[SERVIDOR] Monstro ${targetId} morreu`);
        monsters[targetId].hp = 0; // Garantir que não fique negativo
        io.emit('monsterDied', targetId);
        
        // Respawn do monstro após 5 segundos
        setTimeout(() => {
          monsters[targetId].hp = monsters[targetId].maxHp;
          io.emit('monsterRespawn', monsters[targetId]);
        }, 5000);
      } else {
        // Enviar evento para todos os clientes imediatamente
        console.log(`[SERVIDOR] Emitindo monsterDamaged: ${targetId}, HP=${monsters[targetId].hp}, damage=${damage}, attackerId=${attackerId}`);
        io.emit('monsterDamaged', {
          id: targetId,
          hp: monsters[targetId].hp,
          damage,
          attackerId
        });
      }
      
      // Responder ao jogador que o ataque foi bem sucedido
      socket.emit('attackResult', {
        success: true,
        targetId,
        damage
      });
    } else {
      // Monstro não encontrado
      console.log(`[SERVIDOR] Monstro ${targetId} não encontrado para ataque`);
      socket.emit('attackResult', {
        success: false,
        targetId,
        error: 'Monster not found'
      });
    }
  });
  
  // Quando um jogador desconecta
  socket.on('disconnect', () => {
    console.log('Jogador desconectado:', socket.id);
    if (players[socket.id]) {
      io.emit('playerLeft', socket.id);
      delete players[socket.id];
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
