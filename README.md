# pi-web-search

A [pi](https://github.com/badlogic/pi) extension that adds a `web_search` tool powered by [Parallel AI](https://www.parallel.ai/). Lets the LLM search the web for up-to-date information like recent news, documentation, product releases, or current events.

## Setup

1. Get an API key from [platform.parallel.ai](https://platform.parallel.ai/home) — you get **$80 of free credits** (~16,000 web searches)
2. Set the `PARALLEL_API_KEY` environment variable:
   ```bash
   export PARALLEL_API_KEY=your-api-key
   ```
3. Copy this extension to your pi extensions directory:
   ```bash
   cp -r . ~/.pi/agent/extensions/web-search
   cd ~/.pi/agent/extensions/web-search
   npm install
   ```
4. Reload pi with `/reload` or restart it

## Usage

Once loaded, the LLM has access to a `web_search` tool and will use it automatically when it needs current information. You can also ask it directly:

> Search the web for the latest Node.js release

The tool accepts:

- **`objective`** — what you're looking for and why
- **`search_queries`** — 1–5 search queries for comprehensive results
- **`max_results`** — maximum number of results (1–20, default 10)

## License

MIT
