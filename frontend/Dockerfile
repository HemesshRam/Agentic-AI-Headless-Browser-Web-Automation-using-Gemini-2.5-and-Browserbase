FROM node:20-bullseye-slim

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy frontend source code
COPY . .

# Expose Vite dev server port
EXPOSE 5173

# Start the Vite dev server and expose it to the network
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
