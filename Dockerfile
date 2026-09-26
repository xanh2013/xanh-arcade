FROM node:24-bookworm-slim
ENV NODE_ENV=production PORT=8000
WORKDIR /app
# This application uses only built-in Node modules and browser modules.
COPY --chown=node:node . .
USER node
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "--max-old-space-size=384", "--max-semi-space-size=16", "--expose-gc", "server.mjs"]
