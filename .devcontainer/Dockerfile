# Official Node 22 image: always the latest 22.x on rebuild (scripts/dev.sh rebuild),
# so dependency engine requirements are met. Includes git and the "node" user (uid 1000).
FROM node:22-bookworm

# The dev container user needs sudo (used by devcontainer.json).
RUN apt-get update \
    && apt-get install -y --no-install-recommends sudo \
    && echo "node ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/node \
    && chmod 0440 /etc/sudoers.d/node \
    && rm -rf /var/lib/apt/lists/*

# Create the node_modules mount point with the right owner up front.
RUN mkdir -p /workspaces/lemmio/node_modules \
    && chown -R node:node /workspaces/lemmio

USER node
