import * as THREE from 'three';
import { createTextTexture, calculateRotationAngle, isWithinDistance } from '../utils/helpers';

/**
 * Classe base para entidades do jogo (jogadores e monstros)
 */
export class Entity {
  constructor(id, data, scene) {
    this.id = id;
    this.data = data;
    this.scene = scene;
    this.model = null;
    this.nameSprite = null;
    this.isMoving = false;
    this.movementDirection = new THREE.Vector3();
    this.targetPosition = new THREE.Vector3();
    this.movementCallback = null;
  }
  
  /**
   * Cria o modelo 3D da entidade
   * @param {THREE.Geometry|THREE.BufferGeometry} geometry - Geometria do modelo
   * @param {THREE.Material} material - Material do modelo
   * @returns {THREE.Mesh} O modelo criado
   */
  createModel(geometry, material) {
    // Criar o modelo
    const model = new THREE.Mesh(geometry, material);
    model.name = `entity-${this.id}`;
    model.userData.entityId = this.id;
    
    // Adicionar ao modelo um atributo data-entity-id para facilitar a seleção
    model.setAttribute = function(name, value) {
      this.userData[name] = value;
    };
    model.setAttribute('data-entity-id', this.id);
    
    // Configurar posição inicial
    if (this.data.position) {
      model.position.set(
        this.data.position.x || 0,
        this.data.position.y || 0,
        this.data.position.z || 0
      );
    }
    
    // Adicionar à cena
    if (this.scene) {
      this.scene.add(model);
    }
    
    this.model = model;
    return model;
  }
  
  /**
   * Cria um sprite com o nome da entidade
   * @param {string} name - Nome a ser exibido
   * @param {number} yOffset - Deslocamento vertical
   */
  createNameTag(name, yOffset = 1.5) {
    if (!this.model) return;
    
    // Criar textura com o nome
    const texture = createTextTexture(name);
    const material = new THREE.SpriteMaterial({ map: texture });
    
    // Criar sprite
    this.nameSprite = new THREE.Sprite(material);
    this.nameSprite.position.set(0, yOffset, 0);
    this.nameSprite.scale.set(2, 0.5, 1);
    
    // Adicionar ao modelo
    this.model.add(this.nameSprite);
    
    return this.nameSprite;
  }
  
  /**
   * Atualiza a posição da entidade
   * @param {Object} position - Nova posição
   */
  updatePosition(position) {
    if (!this.model) return;
    
    // Atualizar modelo
    this.model.position.set(position.x, position.y, position.z);
    
    // Atualizar dados
    this.data.position = { ...position };
  }
  
  /**
   * Move a entidade para uma posição específica
   * @param {THREE.Vector3} targetPosition - Posição de destino
   * @param {Function} callback - Função a ser chamada ao chegar ao destino
   */
  moveToPosition(targetPosition, callback = null) {
    if (!this.model) return;
    
    // Definir alvo
    this.targetPosition.copy(targetPosition);
    
    // Calcular direção
    this.movementDirection.subVectors(this.targetPosition, this.model.position).normalize();
    
    // Configurar estado
    this.isMoving = true;
    this.movementCallback = callback;
  }
  
  /**
   * Para o movimento da entidade
   */
  stopMovement() {
    this.isMoving = false;
    this.movementDirection.set(0, 0, 0);
    this.movementCallback = null;
  }
  
  /**
   * Atualiza o movimento da entidade
   * @param {number} moveSpeed - Velocidade de movimento
   * @param {number} threshold - Distância para considerar chegada ao destino
   * @returns {boolean} Verdadeiro se chegou ao destino
   */
  updateMovement(moveSpeed, threshold = 0.1) {
    if (!this.isMoving || !this.model) return false;
    
    // Calcular distância até o destino
    const distanceToTarget = this.model.position.distanceTo(this.targetPosition);
    
    // Verificar se chegou ao destino
    if (distanceToTarget < threshold) {
      this.isMoving = false;
      
      // Executar callback se existir
      if (this.movementCallback) {
        const callback = this.movementCallback;
        this.movementCallback = null;
        callback();
      }
      
      return true;
    }
    
    // Calcular deslocamento
    const moveVector = new THREE.Vector3();
    moveVector.copy(this.movementDirection).multiplyScalar(moveSpeed);
    
    // Limitar para não ultrapassar o destino
    if (moveVector.length() > distanceToTarget) {
      moveVector.copy(this.movementDirection).multiplyScalar(distanceToTarget);
    }
    
    // Atualizar posição
    this.model.position.add(moveVector);
    
    // Rotacionar para a direção do movimento
    if (this.movementDirection.length() > 0) {
      const angle = calculateRotationAngle(this.movementDirection);
      this.model.rotation.y = angle;
    }
    
    // Atualizar dados
    this.data.position = {
      x: this.model.position.x,
      y: this.model.position.y,
      z: this.model.position.z
    };
    
    return false;
  }
  
  /**
   * Remove a entidade da cena
   */
  destroy() {
    if (this.model) {
      if (this.nameSprite) {
        this.model.remove(this.nameSprite);
        this.nameSprite.material.dispose();
        this.nameSprite.material.map.dispose();
      }
      
      this.scene.remove(this.model);
      
      if (this.model.geometry) {
        this.model.geometry.dispose();
      }
      
      if (this.model.material) {
        this.model.material.dispose();
      }
    }
  }
} 