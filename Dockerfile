FROM node:18-bullseye

# Installa ffmpeg
RUN apt-get update && \
    apt-get install -y ffmpeg && \
    rm -rf /var/lib/apt/lists/*

# Crea la cartella app
WORKDIR /app

# Copia package.json e package-lock se c'è
COPY package*.json ./

# Installa le dipendenze
RUN npm install --omit=dev

# Copia il resto del codice
COPY . .

# Espone la porta (Railway userà PORT)
EXPOSE 3000

# Comando di start
CMD ["npm", "start"]

