# ==========================================
# Stage 1: Build & Package DevLog Studio
# ==========================================
FROM node:22-alpine AS builder
WORKDIR /build

# Install dependencies first for better layer caching
COPY package.json package-lock.json ./
RUN npm install

# Copy source code and build production bundle
COPY . .
RUN npm run compile && \
    npx --yes @vscode/vsce package --no-git-tag-version --allow-missing-repository --out /build/devlogstudio.vsix

# ==========================================
# Stage 2: Interactive Web VS Code Runtime (code-server)
# ==========================================
FROM codercom/code-server:latest
USER coder
WORKDIR /home/coder

# Copy compiled extension from builder
COPY --from=builder --chown=coder:coder /build/devlogstudio.vsix /home/coder/

# Pre-install DevLog Studio extension into code-server
RUN code-server --install-extension /home/coder/devlogstudio.vsix

# Prepare default workspace directory
RUN mkdir -p /home/coder/workspace

EXPOSE 8080

CMD ["code-server", "--bind-addr", "0.0.0.0:8080", "--auth", "none", "/home/coder/workspace"]
