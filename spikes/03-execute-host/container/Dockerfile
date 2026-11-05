FROM node:22-alpine
RUN apk add --no-cache git \
 && mkdir -p /app /work /out && chmod 1777 /work
COPY runner.mjs stub-agent.mjs /app/
WORKDIR /work
ENV HOME=/work GIT_AUTHOR_NAME=stub-agent GIT_AUTHOR_EMAIL=stub@example.invalid GIT_COMMITTER_NAME=stub-agent GIT_COMMITTER_EMAIL=stub@example.invalid
ENTRYPOINT ["node", "/app/runner.mjs"]
