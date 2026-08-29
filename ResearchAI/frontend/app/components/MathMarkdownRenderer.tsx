"use client";

import React, { useMemo } from "react";
import katex from "katex";
import { Sparkles, CodeXml } from "lucide-react";

interface MathMarkdownRendererProps {
  content: string;
  className?: string;
}

// Render individual inline text with LaTeX \(...\) and $...$ and **bold**
function renderInlineWithMath(text: string) {
  if (!text) return null;

  // Regex to match inline LaTeX \(...\) or $...$
  // and **bold** or `code`
  const regex = /(\\\([\s\S]*?\\\))|(\$[^$\n]+\$)|(\*\*[\s\S]*?\*\*)|(`[^`\n]+`)/g;
  const parts = text.split(regex).filter(Boolean);

  return parts.map((part, i) => {
    // 1. Explicit inline LaTeX \( ... \)
    if (part.startsWith("\\(") && part.endsWith("\\)")) {
      const math = part.slice(2, -2).trim();
      try {
        const html = katex.renderToString(math, { displayMode: false, throwOnError: false });
        return <span key={i} className="inline-math px-1" dangerouslySetInnerHTML={{ __html: html }} />;
      } catch {
        return <code key={i} className="font-mono text-cyan-400">{math}</code>;
      }
    }

    // 2. Single dollar inline LaTeX $ ... $
    if (part.startsWith("$") && part.endsWith("$") && part.length > 2) {
      const math = part.slice(1, -1).trim();
      try {
        const html = katex.renderToString(math, { displayMode: false, throwOnError: false });
        return <span key={i} className="inline-math px-1" dangerouslySetInnerHTML={{ __html: html }} />;
      } catch {
        return <code key={i} className="font-mono text-cyan-400">{math}</code>;
      }
    }

    // 3. Bold text **...**
    if (part.startsWith("**") && part.endsWith("**") && part.length >= 4) {
      const inner = part.slice(2, -2);
      return <strong key={i} className="font-bold text-white dark:text-white text-slate-900">{inner}</strong>;
    }

    // 4. Inline code `...`
    if (part.startsWith("`") && part.endsWith("`") && part.length >= 2) {
      const code = part.slice(1, -1);
      return (
        <code key={i} className="px-1.5 py-0.5 rounded bg-slate-800/80 text-violet-300 dark:text-violet-300 text-slate-800 font-mono text-[11.5px] border border-slate-700/50">
          {code}
        </code>
      );
    }

    // Plain text
    return <span key={i}>{part}</span>;
  });
}

export default function MathMarkdownRenderer({ content, className = "" }: MathMarkdownRendererProps) {
  // Parse content into blocks (math blocks, headers, lists, paragraphs)
  const blocks = useMemo(() => {
    if (!content) return [];

    // Normalize block math notations:
    // Convert \[ ... \] or $$ ... $$ into isolated blocks
    let raw = content.replace(/\r\n/g, "\n");
    
    // Split text into lines/chunks while preserving block equations
    const result: Array<{ type: "block-math" | "heading" | "subheading" | "list-item" | "letter-heading" | "paragraph"; text: string; level?: number }> = [];

    // Extract display math blocks \[ ... \] or $$ ... $$
    const blockMathRegex = /(\\\[[\s\S]*?\\\])|(\$\$[\s\S]*?\$\$)/g;
    const tokens = raw.split(blockMathRegex).filter(Boolean);

    for (const token of tokens) {
      const trimmed = token.trim();
      if (!trimmed) continue;

      // Check if this token is a Block Math equation \[ ... \]
      if (trimmed.startsWith("\\[") && trimmed.endsWith("\\]")) {
        const math = trimmed.slice(2, -2).trim();
        result.push({ type: "block-math", text: math });
        continue;
      }

      // Check if this token is a Block Math equation $$ ... $$
      if (trimmed.startsWith("$$") && trimmed.endsWith("$$") && trimmed.length >= 4) {
        const math = trimmed.slice(2, -2).trim();
        result.push({ type: "block-math", text: math });
        continue;
      }

      // Otherwise parse line by line
      const lines = token.split("\n");
      let i = 0;
      while (i < lines.length) {
        const line = lines[i];
        const lineTrimmed = line.trim();

        if (!lineTrimmed) {
          i++;
          continue;
        }

        // Multi-line standalone block math delimiter like `\[` alone on a line
        if (lineTrimmed === "\\[") {
          let mathLines = [];
          i++;
          while (i < lines.length && lines[i].trim() !== "\\]") {
            mathLines.push(lines[i]);
            i++;
          }
          i++; // skip \]
          result.push({ type: "block-math", text: mathLines.join("\n").trim() });
          continue;
        }

        // H3 (### Heading)
        if (lineTrimmed.startsWith("### ")) {
          result.push({ type: "subheading", text: lineTrimmed.replace(/^###\s+/, "") });
          i++;
          continue;
        }

        // H2 (## Heading)
        if (lineTrimmed.startsWith("## ")) {
          result.push({ type: "heading", text: lineTrimmed.replace(/^##\s+/, "") });
          i++;
          continue;
        }

        // Letter/Number heading like "a. Gradient Descent Update" or "1. Model Formulation"
        if (/^[a-z0-9]\.\s+[A-Z]/i.test(lineTrimmed) && !lineTrimmed.startsWith("http")) {
          result.push({ type: "letter-heading", text: lineTrimmed });
          i++;
          continue;
        }

        // Bullet lists
        if (lineTrimmed.startsWith("- ") || lineTrimmed.startsWith("* ")) {
          result.push({ type: "list-item", text: lineTrimmed.replace(/^[-*]\s+/, "") });
          i++;
          continue;
        }

        // Standard paragraph
        result.push({ type: "paragraph", text: lineTrimmed });
        i++;
      }
    }

    return result;
  }, [content]);

  return (
    <div className={`space-y-3 text-sm leading-relaxed ${className}`}>
      {blocks.map((block, idx) => {
        // Render 3D/Display LaTeX Math Block
        if (block.type === "block-math") {
          try {
            const html = katex.renderToString(block.text, {
              displayMode: true,
              throwOnError: false,
            });
            return (
              <div 
                key={idx} 
                className="my-3 py-3 px-4 rounded-2xl bg-slate-950/70 dark:bg-slate-950/80 border border-violet-500/30 overflow-x-auto text-center shadow-inner"
              >
                <div dangerouslySetInnerHTML={{ __html: html }} className="text-violet-200 dark:text-violet-200 text-slate-900 inline-block" />
              </div>
            );
          } catch (err) {
            return (
              <div key={idx} className="my-2 p-3 rounded-xl bg-slate-950 font-mono text-cyan-300 text-xs overflow-x-auto">
                {block.text}
              </div>
            );
          }
        }

        // Heading (H2)
        if (block.type === "heading") {
          return (
            <h3 key={idx} className="text-base font-black text-violet-400 dark:text-violet-300 pt-3 pb-1 border-b border-violet-500/20">
              {renderInlineWithMath(block.text)}
            </h3>
          );
        }

        // Subheading (H3 / Key Takeaways)
        if (block.type === "subheading") {
          return (
            <h4 key={idx} className="text-sm font-extrabold text-cyan-400 dark:text-cyan-300 pt-2 pb-0.5 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-violet-400" />
              <span>{renderInlineWithMath(block.text)}</span>
            </h4>
          );
        }

        // Letter/Section Heading ("a. Gradient Descent Update")
        if (block.type === "letter-heading") {
          return (
            <h4 key={idx} className="text-sm font-black text-cyan-400 dark:text-cyan-300 pt-3 pb-0.5 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              <span>{renderInlineWithMath(block.text)}</span>
            </h4>
          );
        }

        // Bullet List Item
        if (block.type === "list-item") {
          return (
            <div key={idx} className="flex items-start gap-2.5 pl-1.5 py-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-2 shrink-0" />
              <div className="flex-1 text-slate-200 dark:text-slate-200 text-slate-800">
                {renderInlineWithMath(block.text)}
              </div>
            </div>
          );
        }

        // Paragraph
        return (
          <p key={idx} className="text-slate-200 dark:text-slate-200 text-slate-800">
            {renderInlineWithMath(block.text)}
          </p>
        );
      })}
    </div>
  );
}
