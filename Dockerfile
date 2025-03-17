FROM node:22-alpine
WORKDIR /
VOLUME [ "/repos" ]
COPY package.json .
COPY pnpm-lock.yaml .
RUN pnpm install
COPY . .
RUN pnpm build
CMD ["pnpm", "start"]