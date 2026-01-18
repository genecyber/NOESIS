/**
 * Research Tools
 *
 * General-purpose research tools adapted from hustle-v5 patterns:
 * - web_search: Search the web for information
 * - web_scrape: Extract content from a webpage
 *
 * These tools use fetch for basic web access.
 * For production use, consider integrating with Firecrawl or similar APIs.
 */

import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

function createSuccessResponse(data: unknown, message?: string) {
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(
          {
            success: true,
            message: message || 'Operation successful',
            data,
          },
          null,
          2
        ),
      },
    ],
  };
}

function createErrorResponse(error: unknown) {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify({ success: false, error: errorMessage }, null, 2),
      },
    ],
    isError: true,
  };
}

// =============================================================================
// TOOL 1: web_search
// =============================================================================

const webSearchSchema = {
  query: z.string().describe('The search query'),
  limit: z.number().int().min(1).max(10).optional().describe('Maximum results to return. Default: 5'),
};

type WebSearchArgs = {
  query: string;
  limit?: number;
};

export const webSearchTool = tool(
  'web_search',
  'Search the web for information. Returns search results with titles, URLs, and snippets. Note: This is a placeholder - in production, integrate with a search API like Firecrawl, Brave Search, or similar.',
  webSearchSchema,
  async (args: WebSearchArgs) => {
    try {
      const { query, limit = 5 } = args;

      // In production, this would call a search API
      // For now, return a message indicating the capability
      return createSuccessResponse({
        query,
        limit,
        results: [],
        note: 'Web search requires API integration. Configure FIRECRAWL_API_KEY or similar to enable.',
        suggestion: 'Consider using the Claude built-in web search capability if available.',
      }, 'Web search placeholder - configure API for production use');
    } catch (error) {
      return createErrorResponse(error);
    }
  }
);

// =============================================================================
// TOOL 2: web_scrape
// =============================================================================

const webScrapeSchema = {
  url: z.string().url().describe('The URL to scrape'),
  selector: z.string().optional().describe('CSS selector to extract specific content'),
  maxLength: z.number().int().min(100).max(50000).optional().describe('Maximum content length. Default: 10000'),
};

type WebScrapeArgs = {
  url: string;
  selector?: string;
  maxLength?: number;
};

export const webScrapeTool = tool(
  'web_scrape',
  'Extract content from a webpage. Fetches the URL and returns the text content. Note: Basic fetch implementation - for production use with JavaScript-heavy sites, integrate with Firecrawl or Puppeteer.',
  webScrapeSchema,
  async (args: WebScrapeArgs) => {
    try {
      const { url, maxLength = 10000 } = args;

      // Basic fetch implementation
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; MetamorphBot/1.0)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
        throw new Error(`Unsupported content type: ${contentType}`);
      }

      const html = await response.text();

      // Basic HTML to text conversion
      const text = htmlToText(html);
      const truncatedText = text.slice(0, maxLength);

      // Extract title
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : null;

      // Extract meta description
      const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
      const description = descMatch ? descMatch[1].trim() : null;

      return createSuccessResponse({
        url,
        title,
        description,
        content: truncatedText,
        contentLength: text.length,
        truncated: text.length > maxLength,
      }, `Scraped ${url}`);
    } catch (error) {
      return createErrorResponse(error);
    }
  }
);

/**
 * Basic HTML to text conversion
 */
function htmlToText(html: string): string {
  // Remove script and style elements
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

  // Remove HTML comments
  text = text.replace(/<!--[\s\S]*?-->/g, '');

  // Convert common block elements to newlines
  text = text.replace(/<\/(p|div|section|article|header|footer|h[1-6]|li|tr)>/gi, '\n');
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<hr\s*\/?>/gi, '\n---\n');

  // Remove remaining HTML tags
  text = text.replace(/<[^>]+>/g, ' ');

  // Decode common HTML entities
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");

  // Normalize whitespace
  text = text.replace(/\s+/g, ' ');
  text = text.replace(/\n\s+/g, '\n');
  text = text.replace(/\n{3,}/g, '\n\n');

  return text.trim();
}

// =============================================================================
// EXPORTS
// =============================================================================

export const researchTools = [
  webSearchTool,
  webScrapeTool,
];

export const RESEARCH_TOOL_NAMES = [
  'web_search',
  'web_scrape',
] as const;

export type ResearchToolName = (typeof RESEARCH_TOOL_NAMES)[number];
