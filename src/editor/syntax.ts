type LanguageId = "markdown" | "plain";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function detectLanguage(filePath: string | null): LanguageId {
  if (!filePath) {
    return "plain";
  }
  const lowered = filePath.toLowerCase();
  if (lowered.endsWith(".md") || lowered.endsWith(".markdown")) {
    return "markdown";
  }
  return "plain";
}

function highlightInlineMarkdown(line: string): string {
  const pattern = /(`[^`\n]*`)|(\*\*[^*\n]+\*\*)|(\*[^*\n]+\*)|(\[[^\]\n]+\]\([^)]+\))/g;
  let result = "";
  let last = 0;

  for (const match of line.matchAll(pattern)) {
    const token = match[0];
    const index = match.index ?? 0;

    result += escapeHtml(line.slice(last, index));

    if (token.startsWith("`")) {
      result += `<span class="tok-md-inline-code">${escapeHtml(token)}</span>`;
    } else if (token.startsWith("**")) {
      result += `<span class="tok-md-strong">${escapeHtml(token)}</span>`;
    } else if (token.startsWith("*")) {
      result += `<span class="tok-md-em">${escapeHtml(token)}</span>`;
    } else if (token.startsWith("[")) {
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        result += `<span class="tok-md-link-text">[${escapeHtml(linkMatch[1])}]</span><span class="tok-md-link-url">(${escapeHtml(linkMatch[2])})</span>`;
      } else {
        result += `<span class="tok-md-link-text">${escapeHtml(token)}</span>`;
      }
    }

    last = index + token.length;
  }

  result += escapeHtml(line.slice(last));
  return result;
}

function highlightMarkdown(text: string): string {
  const lines = text.split("\n");
  let inFence = false;

  return lines
    .map((line) => {
      if (/^\s*```/.test(line)) {
        inFence = !inFence;
        return `<span class="tok-md-fence">${escapeHtml(line)}</span>`;
      }

      if (inFence) {
        return `<span class="tok-md-code-block">${escapeHtml(line)}</span>`;
      }

      if (/^\s{0,3}#{1,6}\s/.test(line)) {
        return `<span class="tok-md-heading">${highlightInlineMarkdown(line)}</span>`;
      }

      if (/^\s*>\s?/.test(line)) {
        return `<span class="tok-md-quote">${highlightInlineMarkdown(line)}</span>`;
      }

      const listMatch = line.match(/^(\s*(?:[-*+]|\d+\.)\s+)(.*)$/);
      if (listMatch) {
        return `<span class="tok-md-list-marker">${escapeHtml(listMatch[1])}</span>${highlightInlineMarkdown(listMatch[2])}`;
      }

      if (/^\s*([-*_])(?:\s*\1){2,}\s*$/.test(line)) {
        return `<span class="tok-md-hr">${escapeHtml(line)}</span>`;
      }

      return highlightInlineMarkdown(line);
    })
    .join("\n");
}

export function highlightText(text: string, filePath: string | null): string {
  const language = detectLanguage(filePath);
  if (language === "markdown") {
    return highlightMarkdown(text);
  }
  return escapeHtml(text);
}
