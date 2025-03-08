import * as THREE from 'three';

/**
 * Cria um elemento DOM com estilo
 * @param {string} type - Tipo de elemento HTML
 * @param {Object} styles - Estilos CSS em formato camelCase
 * @param {Object} attributes - Atributos para o elemento
 * @param {string|null} textContent - Conteúdo de texto opcional
 * @param {HTMLElement|null} parent - Elemento pai para anexar
 * @returns {HTMLElement} O elemento criado
 */
export const createElement = (type, styles = {}, attributes = {}, textContent = null, parent = null) => {
  const element = document.createElement(type);
  
  // Aplicar estilos
  Object.entries(styles).forEach(([prop, value]) => {
    element.style[prop] = value;
  });
  
  // Aplicar atributos
  Object.entries(attributes).forEach(([attr, value]) => {
    element.setAttribute(attr, value);
  });
  
  // Definir texto
  if (textContent !== null) {
    element.textContent = textContent;
  }
  
  // Anexar ao pai se fornecido
  if (parent) {
    parent.appendChild(element);
  }
  
  return element;
};

/**
 * Cria uma textura de texto para ser usada como sprite
 * @param {string} text - Texto para renderizar
 * @param {string} font - Fonte no formato CSS
 * @param {string} fillStyle - Cor de preenchimento
 * @param {number} width - Largura do canvas
 * @param {number} height - Altura do canvas
 * @returns {THREE.CanvasTexture} A textura criada
 */
export const createTextTexture = (text, font = '24px Arial', fillStyle = 'white', width = 256, height = 64) => {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  canvas.width = width;
  canvas.height = height;
  
  context.font = font;
  context.fillStyle = fillStyle;
  context.textAlign = 'center';
  context.fillText(text, canvas.width / 2, canvas.height / 2);
  
  return new THREE.CanvasTexture(canvas);
};

/**
 * Calcula o ângulo de rotação baseado na direção do movimento
 * @param {THREE.Vector3} direction - Vetor de direção do movimento
 * @returns {number} Ângulo em radianos
 */
export const calculateRotationAngle = (direction) => {
  return Math.atan2(direction.x, direction.z);
};

/**
 * Verifica se a distância entre dois pontos é menor ou igual à distância limite
 * @param {THREE.Vector3} point1 - Primeiro ponto
 * @param {THREE.Vector3} point2 - Segundo ponto
 * @param {number} threshold - Distância limite
 * @returns {boolean} Verdadeiro se a distância for menor ou igual ao limite
 */
export const isWithinDistance = (point1, point2, threshold) => {
  return point1.distanceTo(point2) <= threshold;
};

/**
 * Calcula a posição de aproximação para um alvo
 * @param {THREE.Vector3} origin - Posição de origem
 * @param {THREE.Vector3} target - Posição alvo
 * @param {number} offset - Distância para manter do alvo
 * @returns {THREE.Vector3} Posição de aproximação
 */
export const calculateApproachPosition = (origin, target, offset = 1.0) => {
  const direction = new THREE.Vector3().subVectors(target, origin).normalize();
  return target.clone().sub(direction.multiplyScalar(offset));
}; 