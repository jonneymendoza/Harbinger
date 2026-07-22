FROM mcr.microsoft.com/playwright:v1.50.0-jammy

WORKDIR /usr/src/backend
RUN apt-get update && apt-get install -y \
    curl gnupg2 \
    && curl -sL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && npm install -g pnpm \
    && rm -rf /var/lib/apt/lists/*

RUN npx playwright install --with-deps chromium

EXPOSE 5000
CMD ["node", "dist/src/app.js"]
