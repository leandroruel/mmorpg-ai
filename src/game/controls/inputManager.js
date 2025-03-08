import * as THREE from 'three';
import { calculateApproachPosition } from '../utils/helpers';
import { VISUAL_EFFECTS } from '../core/config';

/**
 * Classe para gerenciar os controles de entrada do jogo
 */
export class InputManager {
  constructor(renderer, entityManager, player) {
    this.renderer = renderer;
    this.entityManager = entityManager;
    this.player = player;
    
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.isMoving = false;
    this.isAttacking = false;
    this.attackTarget = null;
    this.destinationMarker = null;
    
    // Adicionar estado de configurações
    this.config = {
      autoAttack: false
    };
    
    // Variáveis para auto ataque
    this.autoAttackTarget = null;
    this.autoAttackInterval = null;
    
    // Vincular métodos ao this para evitar problemas com eventos
    this.handleLeftClick = this.handleLeftClick.bind(this);
    this.handleRightClick = this.handleRightClick.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
  }
  
  /**
   * Inicializa os controles de entrada
   */
  initialize() {
    if (!this.renderer || !this.renderer.renderer) {
      console.error('Renderer não inicializado corretamente');
      return;
    }
    
    this.renderer.renderer.domElement.addEventListener('click', this.handleLeftClick);
    this.renderer.renderer.domElement.addEventListener('contextmenu', this.handleRightClick);
    
    // Adicionar listener para tecla de atalho de configurações
    document.addEventListener('keydown', this.handleKeyDown);
    
    console.log('Input manager inicializado');
  }
  
  /**
   * Remove os listeners de eventos
   */
  dispose() {
    if (this.renderer && this.renderer.renderer) {
      this.renderer.renderer.domElement.removeEventListener('click', this.handleLeftClick);
      this.renderer.renderer.domElement.removeEventListener('contextmenu', this.handleRightClick);
    }
    
    // Remover listener para tecla de atalho
    document.removeEventListener('keydown', this.handleKeyDown);
    
    // Limpar intervalo de auto ataque
    this.stopAutoAttack();
  }
  
  /**
   * Atualiza o jogador controlado pelo usuário
   * @param {Object} player - Novo jogador
   */
  setPlayer(player) {
    this.player = player;
  }
  
  /**
   * Configura o estado de movimento do jogador
   * @param {boolean} isMoving - Estado de movimento
   */
  setMoving(isMoving) {
    this.isMoving = isMoving;
  }
  
  /**
   * Define o estado de ataque
   * @param {boolean} isAttacking - Se o jogador está atacando
   * @param {string|null} target - ID do alvo do ataque
   * @param {boolean} shouldStopAutoAttack - Se deve interromper o auto ataque existente (padrão: true)
   */
  setAttacking(isAttacking, target = null, shouldStopAutoAttack = true) {
    this.isAttacking = isAttacking;
    this.attackTarget = target;
    
    // Se não está mais atacando e deve parar o auto ataque, parar
    if (!isAttacking && shouldStopAutoAttack && this.autoAttackInterval) {
      this.stopAutoAttack();
    }
  }
  
  /**
   * Converte coordenadas do clique do mouse para coordenadas normalizadas
   * @param {MouseEvent} event - Evento do mouse
   */
  updateMouseCoordinates(event) {
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  }
  
  /**
   * Manipula o clique esquerdo do mouse (ataque direto)
   * @param {MouseEvent} event - Evento do mouse
   */
  handleLeftClick(event) {
    // Verificar se o jogador está disponível
    if (!this.player || !this.player.model) return;
    
    this.updateMouseCoordinates(event);
    this.raycaster.setFromCamera(this.mouse, this.renderer.camera);
    
    // Verificar interseção com monstros
    const monsters = this.entityManager.getMonsterModels();
    const intersects = this.raycaster.intersectObjects(monsters);
    
    if (intersects.length > 0) {
      const clickedMonster = intersects[0].object;
      const monsterId = this.entityManager.getEntityIdByModel(clickedMonster);
      
      if (monsterId) {
        console.log(`Atacando monstro ${monsterId}`);
        this.entityManager.attackMonster(monsterId);
      }
    }
  }
  
  /**
   * Manipula o clique direito do mouse (movimento ou ataque com aproximação)
   * @param {MouseEvent} event - Evento do mouse
   */
  handleRightClick(event) {
    event.preventDefault();
    
    // Verificar se o jogador está disponível
    if (!this.player || !this.player.model) return;
    
    this.updateMouseCoordinates(event);
    this.raycaster.setFromCamera(this.mouse, this.renderer.camera);
    
    // Parar qualquer auto ataque atual
    this.stopAutoAttack();
    
    // Resetar explicitamente o alvo do auto ataque quando começa uma nova ação
    this.autoAttackTarget = null;
    
    // Verificar interseção com monstros
    const monsters = this.entityManager.getMonsterModels();
    const monsterIntersects = this.raycaster.intersectObjects(monsters);
    
    if (monsterIntersects.length > 0) {
      // Clicou em um monstro - mover até ele e atacar
      const clickedMonster = monsterIntersects[0].object;
      const monsterId = this.entityManager.getEntityIdByModel(clickedMonster);
      
      if (monsterId) {
        console.log(`Movendo até o monstro ${monsterId} para atacá-lo...`);
        
        // Obter posições
        const monsterPosition = clickedMonster.position;
        const playerPosition = this.player.model.position;
        
        // Calcular posição para se aproximar
        const targetPosition = calculateApproachPosition(
          playerPosition,
          monsterPosition,
          this.player.attackRange * 0.9 // Ligeiramente mais perto para garantir
        );
        
        // Criar marcador
        this.showDestinationMarker(targetPosition, VISUAL_EFFECTS.attackMarkerColor);
        
        // Se o auto ataque estiver ativado, armazenar o alvo antes de se mover
        const autoAttackEnabled = this.config.autoAttack;
        
        // Armazenar o ID do monstro de forma segura
        const targetMonsterId = monsterId;
        
        // Importante: definir o ID do alvo ANTES de iniciar o movimento
        if (autoAttackEnabled) {
          console.log(`Armazenando alvo para auto ataque: ${targetMonsterId}`);
          this.autoAttackTarget = targetMonsterId;
        }
        
        // Iniciar movimento até o monstro
        this.player.moveToPosition(targetPosition, () => {
          // Callback quando chegar ao destino
          this.player.attackEntity(targetMonsterId);
          
          // Adicionar um pequeno atraso para que o ataque inicial seja processado
          // antes de iniciar o auto ataque
          if (autoAttackEnabled) {
            console.log(`Preparando para iniciar auto ataque contra ${targetMonsterId}`);
            
            // Verificar se o ID do alvo ainda é válido
            if (this.autoAttackTarget !== targetMonsterId) {
              console.log(`Restaurando alvo do auto ataque para ${targetMonsterId}`);
              this.autoAttackTarget = targetMonsterId;
            }
            
            setTimeout(() => {
              // Verificar novamente se o alvo ainda é válido
              if (this.autoAttackTarget === targetMonsterId) {
                this.startAutoAttack(targetMonsterId);
              } else {
                console.log(`O alvo mudou durante o movimento, não iniciando auto ataque`);
              }
            }, 500);
          }
        });
        
        // Configurar estado
        this.setMoving(true);
        this.setAttacking(true, monsterId);
        
        return;
      }
    }
    
    // Não clicou em um monstro - mover normalmente
    this.setAttacking(false, null);
    
    // Calcular interseção com o plano do chão
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const targetPoint = new THREE.Vector3();
    
    if (this.raycaster.ray.intersectPlane(groundPlane, targetPoint)) {
      // Criar marcador
      this.showDestinationMarker(targetPoint, VISUAL_EFFECTS.moveMarkerColor);
      
      // Mover para a posição
      this.player.moveToPosition(targetPoint);
      
      // Configurar estado
      this.setMoving(true);
      
      console.log(`Movendo para: x=${targetPoint.x.toFixed(2)}, z=${targetPoint.z.toFixed(2)}`);
    }
  }
  
  /**
   * Mostra um marcador de destino no chão
   * @param {THREE.Vector3} position - Posição do marcador
   * @param {number} color - Cor do marcador
   */
  showDestinationMarker(position, color) {
    // Remover marcador anterior se existir
    if (this.destinationMarker) {
      this.renderer.scene.remove(this.destinationMarker);
    }
    
    // Criar novo marcador
    this.destinationMarker = this.renderer.createGroundMarker(position, color);
    
    // Animar desaparecimento do marcador
    const fadeOutMarker = () => {
      if (this.destinationMarker && this.destinationMarker.material) {
        this.destinationMarker.material.opacity -= 0.02;
        
        if (this.destinationMarker.material.opacity > 0) {
          setTimeout(fadeOutMarker, 50);
        } else {
          this.renderer.scene.remove(this.destinationMarker);
          this.destinationMarker = null;
        }
      }
    };
    
    setTimeout(fadeOutMarker, 100);
  }
  
  /**
   * Manipula eventos de tecla para atalhos
   * @param {KeyboardEvent} event - Evento de teclado
   */
  handleKeyDown(event) {
    // Tecla 'O' para abrir configurações
    if (event.key === 'o' || event.key === 'O') {
      this.toggleConfigMenu();
    }
  }
  
  /**
   * Mostra/oculta o menu de configurações
   */
  toggleConfigMenu() {
    // Verificar se o menu já existe
    let configMenu = document.getElementById('game-config-menu');
    
    if (configMenu) {
      // Se já existe, remover
      document.body.removeChild(configMenu);
      return;
    }
    
    // Criar menu de configurações usando o utilitário createElement ou APIs DOM padrão
    configMenu = document.createElement('div');
    configMenu.id = 'game-config-menu';
    configMenu.style.position = 'absolute';
    configMenu.style.top = '100px';
    configMenu.style.right = '20px';
    configMenu.style.width = '250px';
    configMenu.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    configMenu.style.padding = '15px';
    configMenu.style.borderRadius = '5px';
    configMenu.style.color = 'white';
    configMenu.style.zIndex = '1000';
    configMenu.style.fontFamily = 'Arial, sans-serif';
    
    // Título
    const title = document.createElement('h3');
    title.textContent = 'Configurações';
    title.style.margin = '0 0 15px 0';
    title.style.textAlign = 'center';
    configMenu.appendChild(title);
    
    // Opção de auto ataque
    const autoAttackContainer = document.createElement('div');
    autoAttackContainer.style.display = 'flex';
    autoAttackContainer.style.alignItems = 'center';
    autoAttackContainer.style.marginBottom = '10px';
    
    const autoAttackCheckbox = document.createElement('input');
    autoAttackCheckbox.type = 'checkbox';
    autoAttackCheckbox.id = 'auto-attack-checkbox';
    autoAttackCheckbox.checked = this.config.autoAttack;
    autoAttackCheckbox.style.marginRight = '10px';
    
    const autoAttackLabel = document.createElement('label');
    autoAttackLabel.htmlFor = 'auto-attack-checkbox';
    autoAttackLabel.textContent = 'Auto Ataque';
    
    autoAttackContainer.appendChild(autoAttackCheckbox);
    autoAttackContainer.appendChild(autoAttackLabel);
    configMenu.appendChild(autoAttackContainer);
    
    // Descrição
    const description = document.createElement('p');
    description.textContent = 'Com o Auto Ataque ativado, você atacará monstros continuamente com apenas um clique direito.';
    description.style.fontSize = '12px';
    description.style.color = '#aaa';
    description.style.marginTop = '5px';
    configMenu.appendChild(description);
    
    // Botão de fechar
    const closeButton = document.createElement('button');
    closeButton.textContent = 'Fechar';
    closeButton.style.padding = '5px 10px';
    closeButton.style.backgroundColor = '#4CAF50';
    closeButton.style.color = 'white';
    closeButton.style.border = 'none';
    closeButton.style.borderRadius = '3px';
    closeButton.style.cursor = 'pointer';
    closeButton.style.marginTop = '15px';
    closeButton.style.width = '100%';
    configMenu.appendChild(closeButton);
    
    // Adicionar evento de alteração
    autoAttackCheckbox.addEventListener('change', (e) => {
      this.config.autoAttack = e.target.checked;
      console.log(`Auto ataque ${this.config.autoAttack ? 'ativado' : 'desativado'}`);
      
      // Feedback visual
      const statusText = document.createElement('span');
      statusText.textContent = this.config.autoAttack ? ' ✓ Ativado' : ' ✗ Desativado';
      statusText.style.color = this.config.autoAttack ? '#4CAF50' : '#f44336';
      statusText.style.fontSize = '12px';
      statusText.style.marginLeft = '10px';
      
      // Remover status anterior se existir
      const oldStatus = autoAttackContainer.querySelector('.status-text');
      if (oldStatus) {
        autoAttackContainer.removeChild(oldStatus);
      }
      
      // Adicionar classe para identificação
      statusText.className = 'status-text';
      autoAttackContainer.appendChild(statusText);
      
      // Se desativado, parar o auto ataque atual
      if (!this.config.autoAttack) {
        this.stopAutoAttack();
      }
    });
    
    // Adicionar evento de fechar
    closeButton.addEventListener('click', () => {
      document.body.removeChild(configMenu);
    });
    
    // Adicionar o menu ao DOM
    document.body.appendChild(configMenu);
  }
  
  /**
   * Inicia o auto ataque contra um alvo
   * @param {string} targetId - ID do alvo
   */
  startAutoAttack(targetId) {
    if (!this.config.autoAttack || !this.player) return;
    
    console.log(`Iniciando auto ataque contra o monstro ${targetId}`);
    
    // Armazenar o ID do alvo em uma variável local para evitar problemas de escopo
    const storedTargetId = targetId;
    this.autoAttackTarget = storedTargetId;
    
    // Limpar intervalo existente
    this.stopAutoAttack();
    
    // Armazenar uma referência direta ao modelo do monstro
    const monsterModels = this.entityManager.getMonsterModels();
    let targetModel = null;
    
    // Tentar encontrar o modelo correspondente ao ID
    for (const model of monsterModels) {
      const id = this.entityManager.getEntityIdByModel(model);
      console.log(`Comparando ID: ${id} com alvo: ${storedTargetId}`);
      if (id === storedTargetId) {
        targetModel = model;
        break;
      }
    }
    
    if (!targetModel) {
      console.log(`Não conseguiu encontrar modelo para o monstro com ID ${storedTargetId}`);
      // Temos o ID, mas não conseguimos encontrar o modelo, vamos usar só o ID
      // e verificar se o ataque funciona mesmo assim
    } else {
      console.log(`Modelo do monstro encontrado, posição:`, targetModel.position);
      
      // Verificar se o monstro está morto
      if (targetModel.userData && targetModel.userData.isDead) {
        console.log(`Não iniciando auto ataque: monstro ${storedTargetId} está morto`);
        this.autoAttackTarget = null;
        return;
      }
    }
    
    console.log(`Configurando intervalo de auto ataque para o monstro ${storedTargetId}`);
    
    // Atacar imediatamente uma vez para garantir que comece rápido
    setTimeout(() => {
      if (this.autoAttackTarget === storedTargetId) {
        console.log(`Iniciando ataque inicial do auto ataque contra ${storedTargetId}`);
        // Vamos usar setAttacking para não interferir no auto ataque
        this.setAttacking(true, storedTargetId, false);
        this.player.attackEntity(storedTargetId);
      }
    }, 100);
    
    // Verificar se o monstro ainda existe e atacar periodicamente
    this.autoAttackInterval = setInterval(() => {
      // Usar o ID armazenado na closure para garantir que não mude
      const currentTargetId = this.autoAttackTarget;
      
      // Verificar se o ID do alvo ainda é válido
      if (!currentTargetId) {
        console.log(`Auto ataque cancelado: ID do alvo perdido`);
        this.stopAutoAttack();
        return;
      }
      
      // Verificar se o monstro ainda existe e não está morto
      const monsterModel = this.entityManager.getMonsterModels().find(model => 
        this.entityManager.getEntityIdByModel(model) === currentTargetId
      );
      
      if (monsterModel && monsterModel.userData && monsterModel.userData.isDead) {
        console.log(`Auto ataque cancelado: monstro ${currentTargetId} está morto`);
        this.stopAutoAttack();
        this.autoAttackTarget = null;
        return;
      }
      
      console.log(`Tentando auto ataque no monstro ${currentTargetId}`);
      
      // Garantir que estamos usando o ID correto
      const result = this.player.attackEntity(currentTargetId);
      
      // Se o ataque explicitamente falhar, podemos parar o auto ataque
      if (result === false) {
        console.log(`Auto ataque falhou - parando auto ataque`);
        this.stopAutoAttack();
      }
    }, 1500); // Usar um valor fixo de 1,5 segundos para garantir que funcione
  }
  
  /**
   * Para o auto ataque atual
   */
  stopAutoAttack() {
    if (this.autoAttackInterval) {
      console.log('Parando auto ataque existente');
      clearInterval(this.autoAttackInterval);
      this.autoAttackInterval = null;
    }
    
    // Importante: não apagar o ID do alvo aqui para evitar problemas
    // Vamos apenas limpá-lo quando explicitamente necessário
    // this.autoAttackTarget = null;
  }
} 