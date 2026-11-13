# Jebkuram Docker hostingam (Fly.io, Railway, savs serveris)
FROM node:22-alpine
WORKDIR /app
COPY package.json server.js ./
COPY public ./public
ENV PORT=8080 DATA_FILE=/data/data.json
RUN mkdir -p /data
VOLUME /data
EXPOSE 8080
CMD ["node", "server.js"]
