import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { io } from 'socket.io-client';

// Registrar o tempo de início para fins de depuração
window.gameStartTime = Date.now();

// Classe principal do jogo
class MMORPGGame {
  constructor() {
    console.log('Iniciando jogo MMORPG...');
    console.time('inicialização');
    
    // Inicializar variáveis de carregamento
    this.assetsToLoad = 2; // Número de assets a carregar (character + monster)
    this.assetsLoaded = 0;
    this.loadingElement = document.getElementById('loading');
    this.loadingProgressElement = document.getElementById('loading-progress');
    this.loadingTextElement = document.getElementById('loading-text');
    this.hudElement = document.getElementById('hud');
    this.controlsInfoElement = document.getElementById('controls-info');
    
    // Configuração inicial da barra de progresso
    this.updateLoadingProgress(0.05); // 5% inicial
    
    // Pré-carregar recursos críticos antes de iniciar a conexão
    this.preloadCriticalResources()
      .then(() => {
        // Depois de carregar recursos críticos, conectar ao Socket.io
        this.connectToServer();
      })
      .catch(error => {
        console.error('Erro ao pré-carregar recursos:', error);
        this.showErrorMessage('Erro ao carregar recursos necessários. Por favor, recarregue a página.');
      });
  }

  // Pré-carregar recursos críticos
  preloadCriticalResources() {
    return new Promise((resolve) => {
      // Aqui poderíamos carregar texturas e recursos essenciais
      // Por enquanto, simulamos com um pequeno delay
      setTimeout(() => {
        this.updateLoadingProgress(0.05); // +5% após pré-carregamento
        resolve();
      }, 200);
    });
  }

  // Conectar ao servidor Socket.io
  connectToServer() {
    // Conectar ao servidor Socket.io com opções para trabalhar com o proxy
    this.socket = io('/', {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      timeout: 10000,
      forceNew: true // Força uma nova conexão para evitar problemas
    });
    
    // Adicionar tratamento de erros de conexão
    this.socket.on('connect_error', (error) => {
      console.error('Erro de conexão com o servidor:', error);
      this.showErrorMessage('Erro de conexão com o servidor. Verifique se o servidor está rodando e recarregue a página.');
    });
    
    // Inicialização do progresso de carregamento
    this.updateLoadingProgress(0.1); // +10% após iniciar conexão
    
    this.players = {};
    this.monsters = {};
    this.playerModels = {};
    this.monsterModels = {};
    this.selfId = null;
    this.characterModels = {};
    this.isMoving = false;
    this.movementDirection = new THREE.Vector3();
    this.targetPosition = new THREE.Vector3();
    this.moveSpeed = 0.05;

    // Iniciar o resto do jogo
    this.init();
    console.timeEnd('inicialização');
  }

  // Atualizar progresso de carregamento
  updateLoadingProgress(increment) {
    const currentWidth = parseFloat(this.loadingProgressElement.style.width || '0');
    const newWidth = Math.min(currentWidth + increment * 100, 100);
    this.loadingProgressElement.style.width = `${newWidth}%`;
    
    // Atualizar texto de carregamento
    if (this.loadingTextElement) {
      if (newWidth < 20) {
        this.loadingTextElement.textContent = 'Conectando ao servidor...';
      } else if (newWidth < 50) {
        this.loadingTextElement.textContent = 'Carregando modelos...';
      } else if (newWidth < 80) {
        this.loadingTextElement.textContent = 'Preparando mundo do jogo...';
      } else if (newWidth < 100) {
        this.loadingTextElement.textContent = 'Quase pronto...';
      } else {
        this.loadingTextElement.textContent = 'Pronto!';
      }
    }
    
    // Se completou o carregamento
    if (newWidth >= 100) {
      setTimeout(() => {
        this.loadingElement.style.display = 'none';
        this.hudElement.style.display = 'block';
        this.controlsInfoElement.style.display = 'block';
      }, 500);
    }
  }
  
  // Mostrar mensagem de erro
  showErrorMessage(message) {
    const errorDiv = document.createElement('div');
    errorDiv.style.position = 'absolute';
    errorDiv.style.top = '50%';
    errorDiv.style.left = '50%';
    errorDiv.style.transform = 'translate(-50%, -50%)';
    errorDiv.style.backgroundColor = 'rgba(255, 0, 0, 0.8)';
    errorDiv.style.color = 'white';
    errorDiv.style.padding = '20px';
    errorDiv.style.borderRadius = '5px';
    errorDiv.style.fontSize = '16px';
    errorDiv.style.textAlign = 'center';
    errorDiv.style.zIndex = '2000';
    errorDiv.textContent = message;
    
    const reloadButton = document.createElement('button');
    reloadButton.textContent = 'Recarregar';
    reloadButton.style.marginTop = '10px';
    reloadButton.style.padding = '5px 10px';
    reloadButton.style.backgroundColor = 'white';
    reloadButton.style.color = 'black';
    reloadButton.style.border = 'none';
    reloadButton.style.borderRadius = '3px';
    reloadButton.style.cursor = 'pointer';
    reloadButton.addEventListener('click', () => {
      window.location.reload();
    });
    
    errorDiv.appendChild(document.createElement('br'));
    errorDiv.appendChild(reloadButton);
    
    document.body.appendChild(errorDiv);
  }

  // Inicializar o jogo
  init() {
    this.createScene();
    this.loadModels();
    this.createControls();
    this.createGround();
    this.setupSocketEvents();
    this.animate();
    this.setupInputEvents();
    
    // Atualizamos a ordem para que setupSocketEvents seja chamado antes de showLoginScreen
    // Isso garante que os eventos socket estejam configurados antes do login
  }

  // Criar a cena 3D
  createScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb);

    // Configurar câmera ortográfica para visual isométrico
    const aspect = window.innerWidth / window.innerHeight;
    const frustumSize = 20;
    this.camera = new THREE.OrthographicCamera(
      frustumSize * aspect / -2,
      frustumSize * aspect / 2,
      frustumSize / 2,
      frustumSize / -2,
      0.1,
      1000
    );
    
    // Posição isométrica para a câmera
    this.camera.position.set(10, 10, 10);
    this.camera.lookAt(0, 0, 0);

    // Configurar renderizador
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    document.body.appendChild(this.renderer.domElement);

    // Adicionar luz
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 1, 1);
    this.scene.add(directionalLight);

    // Redimensionar ao alterar o tamanho da janela
    window.addEventListener('resize', () => {
      const aspect = window.innerWidth / window.innerHeight;
      this.camera.left = frustumSize * aspect / -2;
      this.camera.right = frustumSize * aspect / 2;
      this.camera.top = frustumSize / 2;
      this.camera.bottom = frustumSize / -2;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  // Configurar eventos de conexão com o servidor
  setupSocketEvents() {
    // Definir um timeout para evitar espera infinita
    this.connectTimeout = setTimeout(() => {
      // Se ainda estamos carregando
      if (parseFloat(this.loadingProgressElement.style.width) < 100) {
        console.warn("Timeout de conexão com o servidor atingido.");
        // Verificar se estamos conectados mas faltando gameState
        if (this.socket.connected) {
          console.log("Conectado ao servidor, mas não recebemos o estado do jogo.");
          // Forçar a continuação
          this.updateLoadingProgress(1.0);
          this.showErrorMessage("O servidor demorou para responder, mas você pode tentar jogar mesmo assim. Tente novamente se o jogo não funcionar corretamente.");
        } else {
          this.showErrorMessage("Não foi possível estabelecer conexão com o servidor dentro do tempo limite. Por favor, verifique sua conexão e tente novamente.");
        }
      }
    }, 15000); // 15 segundos de timeout

    // Evento de conexão bem-sucedida
    this.socket.on('connect', () => {
      console.log('Conectado ao servidor!');
      this.updateLoadingProgress(0.2);
      
      // Simulando carregamento progressivo do mundo para feedback visual
      let worldProgress = 0;
      const worldProgressInterval = setInterval(() => {
        worldProgress += 0.05;
        if (worldProgress <= 0.3) { // Limitar a 30% do progresso total
          this.updateLoadingProgress(0.05); // Incrementos pequenos para feedback visual
          
          // Atualizar a mensagem de carregamento com detalhes
          if (this.loadingTextElement) {
            const details = [
              "Iniciando terreno...",
              "Carregando árvores...",
              "Preparando iluminação...",
              "Configurando física...",
              "Ajustando detalhes do mundo...",
              "Quase lá..."
            ];
            const detailIndex = Math.floor(worldProgress * 20) % details.length;
            this.loadingTextElement.textContent = `Preparando mundo do jogo: ${details[detailIndex]}`;
          }
        } else {
          clearInterval(worldProgressInterval);
        }
      }, 500);
      
      // Uma vez conectado, podemos mostrar a tela de login
      // mas apenas depois que os modelos tiverem carregado
      if (this.assetsLoaded === this.assetsToLoad) {
        this.showLoginScreen();
      } else {
        // Se não, esperamos que os modelos carreguem antes de mostrar o login
        const checkAssetsInterval = setInterval(() => {
          if (this.assetsLoaded === this.assetsToLoad) {
            clearInterval(checkAssetsInterval);
            this.showLoginScreen();
          }
        }, 500);
      }
    });
    
    // Evento para receber o estado inicial do jogo
    this.socket.on('gameState', (data) => {
      console.log('Estado do jogo recebido:', data);
      // Limpar o timeout quando recebemos a resposta
      if (this.connectTimeout) {
        clearTimeout(this.connectTimeout);
        this.connectTimeout = null;
      }
      
      this.players = data.players;
      this.monsters = data.monsters;
      this.selfId = data.selfId;
      
      // Atualizar HUD com informações do jogador
      const playerNameElement = document.getElementById('player-name');
      const playerHpElement = document.getElementById('player-hp');
      const playerMaxHpElement = document.getElementById('player-max-hp');
      
      if (playerNameElement && this.players[this.selfId]) {
        playerNameElement.textContent = this.players[this.selfId].name;
        playerHpElement.textContent = this.players[this.selfId].hp;
        playerMaxHpElement.textContent = this.players[this.selfId].maxHp;
      }
      
      // Criar modelos 3D para jogadores
      Object.keys(this.players).forEach(playerId => {
        this.createPlayerModel(playerId);
      });
      
      // Criar modelos 3D para monstros
      Object.keys(this.monsters).forEach(monsterId => {
        this.createMonsterModel(monsterId);
      });
      
      // Ocultar tela de carregamento
      this.updateLoadingProgress(1.0); // Forçar 100%
    });

    this.socket.on('playerJoined', (player) => {
      console.log('Novo jogador entrou:', player);
      this.players[player.id] = player;
      this.createPlayerModel(player.id);
    });

    this.socket.on('playerLeft', (playerId) => {
      console.log('Jogador saiu:', playerId);
      if (this.playerModels[playerId]) {
        this.scene.remove(this.playerModels[playerId]);
        delete this.playerModels[playerId];
      }
      delete this.players[playerId];
    });

    this.socket.on('playerMoved', (data) => {
      if (this.players[data.id]) {
        this.players[data.id].position = data.position;
        if (this.playerModels[data.id]) {
          const model = this.playerModels[data.id];
          model.position.set(data.position.x, data.position.y, data.position.z);
        }
      }
    });

    this.socket.on('monsterDamaged', (data) => {
      console.log(`Monstro ${data.id} sofreu ${data.damage} de dano. HP: ${data.hp}`);
      this.monsters[data.id].hp = data.hp;
      
      // Efeito visual de dano
      if (this.monsterModels[data.id]) {
        const model = this.monsterModels[data.id];
        model.material.color.set(0xff0000);
        setTimeout(() => {
          model.material.color.set(0xffffff);
        }, 200);
      }
    });

    this.socket.on('monsterDied', (monsterId) => {
      console.log(`Monstro ${monsterId} morreu!`);
      if (this.monsterModels[monsterId]) {
        this.monsterModels[monsterId].visible = false;
      }
    });

    this.socket.on('monsterRespawn', (monster) => {
      console.log(`Monstro ${monster.id} respawnou!`);
      this.monsters[monster.id] = monster;
      if (this.monsterModels[monster.id]) {
        this.monsterModels[monster.id].visible = true;
      }
    });
  }

  // Carregar modelos 3D
  loadModels() {
    this.gltfLoader = new GLTFLoader();
    
    // Função para lidar com erros de carregamento
    const onError = (url) => (error) => {
      console.error(`Erro ao carregar o modelo ${url}:`, error);
      this.assetsLoaded++;
      this.updateLoadingProgress(0.3 * this.assetsLoaded / this.assetsToLoad);
      
      if (this.assetsLoaded === this.assetsToLoad) {
        console.warn('Alguns modelos não puderam ser carregados, mas o jogo continuará com placeholders.');
      }
    };
    
    // Carregar modelo de personagem
    this.gltfLoader.load(
      './models/character.gltf', 
      (gltf) => {
        console.log('Modelo de personagem carregado com sucesso');
        this.characterModels['player'] = gltf.scene;
        this.assetsLoaded++;
        this.updateLoadingProgress(0.3 * this.assetsLoaded / this.assetsToLoad);
      },
      (xhr) => {
        console.log(`Carregando modelo de personagem: ${(xhr.loaded / xhr.total * 100).toFixed(2)}%`);
      },
      onError('./models/character.gltf')
    );
    
    // Carregar modelo de monstro
    this.gltfLoader.load(
      './models/monster.gltf', 
      (gltf) => {
        console.log('Modelo de monstro carregado com sucesso');
        this.characterModels['monster'] = gltf.scene;
        this.assetsLoaded++;
        this.updateLoadingProgress(0.3 * this.assetsLoaded / this.assetsToLoad);
      },
      (xhr) => {
        console.log(`Carregando modelo de monstro: ${(xhr.loaded / xhr.total * 100).toFixed(2)}%`);
      },
      onError('./models/monster.gltf')
    );
  }

  // Criar modelo de jogador
  createPlayerModel(playerId) {
    if (this.playerModels[playerId]) return;
    
    const player = this.players[playerId];
    
    // Criar um cubo como placeholder até termos o modelo carregado
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshLambertMaterial({ color: playerId === this.selfId ? 0x00ff00 : 0x0000ff });
    const playerModel = new THREE.Mesh(geometry, material);
    
    playerModel.position.set(player.position.x, player.position.y, player.position.z);
    this.scene.add(playerModel);
    this.playerModels[playerId] = playerModel;
    
    // Adicionar nome do jogador como sprite de texto
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 256;
    canvas.height = 64;
    context.font = '24px Arial';
    context.fillStyle = 'white';
    context.textAlign = 'center';
    context.fillText(player.name, canvas.width / 2, canvas.height / 2);
    
    const nameTexture = new THREE.CanvasTexture(canvas);
    const nameMaterial = new THREE.SpriteMaterial({ map: nameTexture });
    const nameSprite = new THREE.Sprite(nameMaterial);
    nameSprite.position.set(0, 1.5, 0);
    nameSprite.scale.set(2, 0.5, 1);
    playerModel.add(nameSprite);
  }

  // Criar modelo de monstro
  createMonsterModel(monsterId) {
    if (this.monsterModels[monsterId]) return;
    
    const monster = this.monsters[monsterId];
    
    // Criar um cubo vermelho como placeholder
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshLambertMaterial({ color: 0xff0000 });
    const monsterModel = new THREE.Mesh(geometry, material);
    
    monsterModel.position.set(monster.position.x, monster.position.y, monster.position.z);
    this.scene.add(monsterModel);
    this.monsterModels[monsterId] = monsterModel;
  }

  // Criar controles da câmera
  createControls() {
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.screenSpacePanning = false;
    this.controls.minDistance = 5;
    this.controls.maxDistance = 50;
    this.controls.maxPolarAngle = Math.PI / 2.5;
  }

  // Criar solo/terreno básico
  createGround() {
    const gridHelper = new THREE.GridHelper(20, 20);
    this.scene.add(gridHelper);

    const groundGeometry = new THREE.PlaneGeometry(20, 20, 32, 32);
    const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x33aa33 });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    this.scene.add(ground);
  }

  // Loop de animação
  animate() {
    requestAnimationFrame(this.animate.bind(this));
    
    // Atualizar movimentação do jogador
    this.updatePlayerMovement();
    
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  // Atualizar movimentação do jogador
  updatePlayerMovement() {
    if (this.isMoving && this.selfId && this.playerModels[this.selfId]) {
      const playerModel = this.playerModels[this.selfId];
      
      // Mover para a direção alvo
      const moveVector = new THREE.Vector3();
      moveVector.copy(this.movementDirection).multiplyScalar(this.moveSpeed);
      
      playerModel.position.add(moveVector);
      
      // Atualizar posição no objeto players
      this.players[this.selfId].position = {
        x: playerModel.position.x,
        y: playerModel.position.y,
        z: playerModel.position.z
      };
      
      // Emitir atualização para o servidor
      this.socket.emit('playerMove', this.players[this.selfId].position);
    }
  }

  // Configurar eventos de entrada do usuário
  setupInputEvents() {
    document.addEventListener('keydown', this.handleKeyDown.bind(this));
    document.addEventListener('keyup', this.handleKeyUp.bind(this));
    
    // Clique para atacar monstros
    this.renderer.domElement.addEventListener('click', this.handleClick.bind(this));
  }

  // Lidar com teclas pressionadas
  handleKeyDown(event) {
    if (!this.selfId) return;
    
    this.isMoving = true;
    
    switch(event.key) {
      case 'w':
      case 'ArrowUp':
        this.movementDirection.z = -1;
        break;
      case 's':
      case 'ArrowDown':
        this.movementDirection.z = 1;
        break;
      case 'a':
      case 'ArrowLeft':
        this.movementDirection.x = -1;
        break;
      case 'd':
      case 'ArrowRight':
        this.movementDirection.x = 1;
        break;
    }
    
    // Normalizar vetor para manter a mesma velocidade em todas as direções
    this.movementDirection.normalize();
  }

  // Lidar com teclas liberadas
  handleKeyUp(event) {
    switch(event.key) {
      case 'w':
      case 'ArrowUp':
      case 's':
      case 'ArrowDown':
        this.movementDirection.z = 0;
        break;
      case 'a':
      case 'ArrowLeft':
      case 'd':
      case 'ArrowRight':
        this.movementDirection.x = 0;
        break;
    }
    
    // Se não houver movimento em nenhuma direção, parar
    if (this.movementDirection.length() === 0) {
      this.isMoving = false;
    }
  }

  // Lidar com cliques do mouse
  handleClick(event) {
    if (!this.selfId) return;
    
    // Detectar interseção com monstros
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    
    // Converter coordenadas do mouse para espaço normalizado (-1 a 1)
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    raycaster.setFromCamera(mouse, this.camera);
    
    // Obter todos os modelos de monstros
    const monsterObjects = Object.values(this.monsterModels).filter(m => m.visible);
    
    const intersects = raycaster.intersectObjects(monsterObjects);
    
    if (intersects.length > 0) {
      // Pegar o primeiro monstro clicado
      const clickedMonster = intersects[0].object;
      
      // Encontrar o ID do monstro
      const monsterId = Object.keys(this.monsterModels).find(id => this.monsterModels[id] === clickedMonster);
      
      if (monsterId) {
        console.log(`Atacando monstro ${monsterId}`);
        this.socket.emit('playerAttack', monsterId);
      }
    }
  }

  // Mostrar tela de login
  showLoginScreen() {
    const loginScreen = document.createElement('div');
    loginScreen.style.position = 'absolute';
    loginScreen.style.top = '0';
    loginScreen.style.left = '0';
    loginScreen.style.width = '100%';
    loginScreen.style.height = '100%';
    loginScreen.style.display = 'flex';
    loginScreen.style.flexDirection = 'column';
    loginScreen.style.justifyContent = 'center';
    loginScreen.style.alignItems = 'center';
    loginScreen.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    loginScreen.id = 'login-screen';
    
    const title = document.createElement('h1');
    title.textContent = 'MMORPG Estilo Ragnarok';
    title.style.color = 'white';
    title.style.marginBottom = '20px';
    loginScreen.appendChild(title);
    
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Digite seu nome de usuário';
    input.style.padding = '10px';
    input.style.marginBottom = '10px';
    input.style.width = '300px';
    loginScreen.appendChild(input);
    
    const statusMessage = document.createElement('div');
    statusMessage.style.color = 'white';
    statusMessage.style.marginBottom = '10px';
    statusMessage.style.fontSize = '14px';
    statusMessage.style.height = '20px';
    loginScreen.appendChild(statusMessage);
    
    const button = document.createElement('button');
    button.textContent = 'Entrar no Jogo';
    button.style.padding = '10px 20px';
    button.style.backgroundColor = '#4CAF50';
    button.style.color = 'white';
    button.style.border = 'none';
    button.style.cursor = 'pointer';
    loginScreen.appendChild(button);
    
    // Adicionar informações de depuração (ocultas por padrão)
    const debugInfo = document.createElement('div');
    debugInfo.style.color = '#aaa';
    debugInfo.style.fontSize = '12px';
    debugInfo.style.marginTop = '20px';
    debugInfo.style.display = 'none';
    debugInfo.textContent = 'Pressione F12 para ver mais detalhes no console.';
    
    // Adicionar botão de depuração
    const debugButton = document.createElement('button');
    debugButton.textContent = 'Mostrar Detalhes Técnicos';
    debugButton.style.padding = '5px 10px';
    debugButton.style.backgroundColor = '#555';
    debugButton.style.color = 'white';
    debugButton.style.border = 'none';
    debugButton.style.cursor = 'pointer';
    debugButton.style.marginTop = '15px';
    debugButton.style.fontSize = '12px';
    
    debugButton.addEventListener('click', () => {
      if (debugInfo.style.display === 'none') {
        debugInfo.style.display = 'block';
        debugInfo.innerHTML = `
          Status da Conexão: ${this.socket.connected ? 'Conectado' : 'Desconectado'}<br>
          ID da Conexão: ${this.socket.id || 'N/A'}<br>
          Modelos Carregados: ${this.assetsLoaded}/${this.assetsToLoad}<br>
          URL do Servidor: ${this.socket.io.uri}<br>
          Tempo de Carregamento: ${((Date.now() - window.gameStartTime) / 1000).toFixed(1)}s
        `;
        debugButton.textContent = 'Ocultar Detalhes Técnicos';
      } else {
        debugInfo.style.display = 'none';
        debugButton.textContent = 'Mostrar Detalhes Técnicos';
      }
    });
    
    loginScreen.appendChild(debugButton);
    loginScreen.appendChild(debugInfo);
    
    // Adicionar função de login
    button.addEventListener('click', () => {
      const playerName = input.value.trim();
      if (playerName) {
        button.disabled = true;
        button.style.backgroundColor = '#888';
        button.textContent = 'Entrando...';
        statusMessage.textContent = 'Conectando ao servidor...';
        statusMessage.style.color = 'yellow';
        
        // Timeout para login
        const loginTimeout = setTimeout(() => {
          statusMessage.textContent = 'O servidor está demorando para responder. Tente novamente.';
          statusMessage.style.color = 'orange';
          button.disabled = false;
          button.style.backgroundColor = '#4CAF50';
          button.textContent = 'Tentar Novamente';
        }, 8000);
        
        this.socket.emit('login', playerName);
        
        // Verificar se o gameState foi recebido
        const checkGameState = () => {
          if (this.selfId) {
            clearTimeout(loginTimeout);
            // Se o jogador recebeu um ID, o login foi bem-sucedido
            document.body.removeChild(loginScreen);
          }
        };
        
        // Verificar a cada 1 segundo se o login foi bem-sucedido
        const loginCheckInterval = setInterval(() => {
          checkGameState();
          if (!document.body.contains(loginScreen)) {
            clearInterval(loginCheckInterval);
          }
        }, 1000);
      } else {
        statusMessage.textContent = 'Por favor, digite um nome de usuário.';
        statusMessage.style.color = 'red';
      }
    });
    
    // Também permitir login com Enter
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        button.click();
      }
    });
    
    document.body.appendChild(loginScreen);
  }
}

// Iniciar o jogo quando a página carregar
window.addEventListener('DOMContentLoaded', () => {
  new MMORPGGame();
});
