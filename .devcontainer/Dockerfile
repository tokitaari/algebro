# Node 22, matching .nvmrc and CI. Includes git, sudo and the "node" user.
FROM mcr.microsoft.com/devcontainers/javascript-node:1-22-bookworm

# Create the node_modules mount point with the right owner up front, so the
# named volume inherits the permissions on first start.
RUN mkdir -p /workspaces/algebro/node_modules \
    && chown -R node:node /workspaces/algebro

USER node
