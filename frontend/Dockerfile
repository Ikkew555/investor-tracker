# Use an official Node.js runtime as a parent image
FROM node:20-alpine AS builder

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json (or yarn.lock)
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm install

# Declare build-time variables passed from docker-compose
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_API_BASE_URL
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

# Copy the rest of the application code
COPY . .

# Build the application
RUN npm run build

# Stage 2: Serve the application using a lightweight server
FROM node:20-alpine

WORKDIR /app

# Copy built assets from the builder stage
COPY --from=builder /app/dist ./dist
COPY package.json package-lock.json* ./

# Install only production dependencies if 'vite preview' needs them
# 'vite preview' itself is a dev dependency, so we install all deps.
# If you had a different way to serve static files (e.g., nginx, or a custom server.js with only prod deps)
# you might optimize this to 'npm ci --omit=dev'
RUN npm install

# Expose the port the app runs on
EXPOSE 4173

# The command to run the application
# 'vite preview' by default binds to 0.0.0.0 which is good for Docker.
# It will serve the contents of the 'dist' directory.
# The --host flag ensures it's accessible from outside the container.
CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0"] 