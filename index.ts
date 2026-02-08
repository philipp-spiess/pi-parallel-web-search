/**
 * Web Search Extension - Search the web using Parallel AI
 *
 * Provides a `web_search` tool that lets the LLM search the web for current information.
 * Requires PARALLEL_API_KEY environment variable.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import {
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_LINES,
  formatSize,
  truncateHead,
} from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import { Type } from "@sinclair/typebox";
import Parallel from "parallel-web";

const WebSearchParams = Type.Object({
  objective: Type.String({
    description:
      "The search objective - describe what information you're looking for and why",
  }),
  search_queries: Type.Array(Type.String(), {
    description:
      "List of search queries to run (1-5 queries for comprehensive results)",
    minItems: 1,
    maxItems: 5,
  }),
  max_results: Type.Optional(
    Type.Number({
      description: "Maximum number of results to return (default: 10)",
      minimum: 1,
      maximum: 20,
    })
  ),
});

interface WebSearchDetails {
  objective: string;
  queryCount: number;
  resultCount: number;
  queries: string[];
}

export default function (pi: ExtensionAPI) {
  const apiKey = process.env.PARALLEL_API_KEY;

  if (!apiKey) {
    pi.on("session_start", async (_event, ctx) => {
      if (ctx.hasUI) {
        ctx.ui.notify(
          "web_search: PARALLEL_API_KEY not set — tool disabled",
          "warning"
        );
      }
    });
    return;
  }

  const client = new Parallel({ apiKey });

  pi.registerTool({
    name: "web_search",
    label: "Web Search",
    description: `Search the web for current information. Use this when you need up-to-date information that may not be in your training data, such as recent news, documentation, product releases, or current events. Output is truncated to ${DEFAULT_MAX_LINES} lines or ${formatSize(DEFAULT_MAX_BYTES)}.`,
    parameters: WebSearchParams,

    async execute(_toolCallId, params, signal, onUpdate) {
      const {
        objective,
        search_queries,
        max_results = 10,
      } = params;

      onUpdate?.({
        content: [
          {
            type: "text",
            text: `Searching: ${search_queries.join(", ")}`,
          },
        ],
      });

      let search;
      try {
        search = await client.beta.search({
          objective,
          search_queries,
          max_results,
          max_chars_per_result: 10000,
        });
      } catch (err: any) {
        return {
          content: [
            { type: "text", text: `Search failed: ${err.message}` },
          ],
          isError: true,
          details: {
            objective,
            queryCount: search_queries.length,
            resultCount: 0,
            queries: search_queries,
          } as WebSearchDetails,
        };
      }

      if (signal?.aborted) {
        return {
          content: [{ type: "text", text: "Search cancelled" }],
          details: {
            objective,
            queryCount: search_queries.length,
            resultCount: 0,
            queries: search_queries,
          } as WebSearchDetails,
        };
      }

      const results = search.results ?? [];

      if (results.length === 0) {
        return {
          content: [{ type: "text", text: "No results found." }],
          details: {
            objective,
            queryCount: search_queries.length,
            resultCount: 0,
            queries: search_queries,
          } as WebSearchDetails,
        };
      }

      // Format results
      const formatted = results
        .map((r: any, i: number) => {
          const parts = [`## Result ${i + 1}`];
          if (r.title) parts.push(`**Title:** ${r.title}`);
          if (r.url) parts.push(`**URL:** ${r.url}`);
          if (r.content) parts.push(`\n${r.content}`);
          else if (r.text) parts.push(`\n${r.text}`);
          else if (r.snippet) parts.push(`\n${r.snippet}`);
          return parts.join("\n");
        })
        .join("\n\n---\n\n");

      // Truncate if needed
      const truncation = truncateHead(formatted, {
        maxLines: DEFAULT_MAX_LINES,
        maxBytes: DEFAULT_MAX_BYTES,
      });

      let resultText = truncation.content;

      if (truncation.truncated) {
        resultText += `\n\n[Output truncated: showing ${truncation.outputLines} of ${truncation.totalLines} lines`;
        resultText += ` (${formatSize(truncation.outputBytes)} of ${formatSize(truncation.totalBytes)}).]`;
      }

      return {
        content: [{ type: "text", text: resultText }],
        details: {
          objective,
          queryCount: search_queries.length,
          resultCount: results.length,
          queries: search_queries,
        } as WebSearchDetails,
      };
    },

    renderCall(args, theme) {
      let text = theme.fg("toolTitle", theme.bold("web_search "));
      const queries =
        args.search_queries?.map((q: string) => `"${q}"`).join(", ") ?? "";
      text += theme.fg("accent", queries);
      return new Text(text, 0, 0);
    },

    renderResult(result, { expanded, isPartial }, theme) {
      const details = result.details as WebSearchDetails | undefined;

      if (isPartial) {
        return new Text(theme.fg("warning", "Searching the web..."), 0, 0);
      }

      if (result.isError) {
        const errText =
          result.content[0]?.type === "text" ? result.content[0].text : "Error";
        return new Text(theme.fg("error", errText), 0, 0);
      }

      if (!details || details.resultCount === 0) {
        return new Text(theme.fg("dim", "No results found"), 0, 0);
      }

      let text = theme.fg(
        "success",
        `${details.resultCount} results for ${details.queryCount} ${details.queryCount === 1 ? "query" : "queries"}`
      );

      if (expanded) {
        const content = result.content[0];
        if (content?.type === "text") {
          const lines = content.text.split("\n").slice(0, 40);
          for (const line of lines) {
            text += `\n${theme.fg("dim", line)}`;
          }
          if (content.text.split("\n").length > 40) {
            text += `\n${theme.fg("muted", "...")}`;
          }
        }
      }

      return new Text(text, 0, 0);
    },
  });
}
