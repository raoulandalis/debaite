# DebAIte

DebAIte is a local debate game. Pick two characters, assign each a model, and give them a topic. They argue through six speeches. A judge model then scores the match. The verdict is an AI evaluation of that debate.

## Run a debate

1. Install [Ollama](https://ollama.com) and leave it running.

2. Pull the roster. The names must match exactly, including the size suffix. Speakers are `mistral:7b`, `qwen2.5:7b`, and `llama3.1:8b`. The judge is always `gemma2:9b`. One debate needs the judge plus any two speaker models. Pull all four to play every matchup.

```bash
ollama pull mistral:7b
ollama pull qwen2.5:7b
ollama pull llama3.1:8b
ollama pull gemma2:9b
```

All four need about 20 GB of free disk. The app loads one model at a time and needs several gigabytes of free memory while a speech or the verdict is generating. 16 GB of RAM is a comfortable setup.

3. Install dependencies, copy the env file, and start the app.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Ollama must be reachable from the Next.js server at `OLLAMA_BASE_URL`. The default is `http://127.0.0.1:11434`. Change that variable only if the server cannot see that host. Publishing the frontend does not publish a home Ollama server.

Reloading the page discards the current debate.

## Develop

```bash
npm test
npm run lint
npm run build
OLLAMA_INTEGRATION=1 npm run test:ollama
```

The live test uses `OLLAMA_MODEL` from `.env.example`. The sample name there is `llama3.2` (`ollama pull llama3.2`). That name is for the live test. Debate models are the four tags above. The app does not pull models.
