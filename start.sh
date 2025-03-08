#!/bin/bash

# Instalar dependências se necessário
if [ ! -d "node_modules" ]; then
  echo "Instalando dependências..."
  npm install
fi

# Construir o cliente
echo "Construindo o cliente..."
npm run build

# Iniciar o servidor
echo "Iniciando o servidor..."
npm start

# Abrir o navegador (opcional)
echo "Abrindo o navegador..."
if command -v xdg-open &> /dev/null; then
  xdg-open http://localhost:3000
elif command -v open &> /dev/null; then
  open http://localhost:3000
elif command -v start &> /dev/null; then
  start http://localhost:3000
fi 