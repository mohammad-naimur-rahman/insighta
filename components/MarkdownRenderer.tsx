"use client";

import { useMemo } from "react";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  const html = useMemo(() => {
    // Simple markdown to HTML conversion
    // In production, you'd use a library like react-markdown
    let result = content;

    // Escape HTML
    result = result
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // Headers
    result = result.replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold mt-6 mb-2">$1</h3>');
    result = result.replace(/^## (.+)$/gm, '<h2 class="text-xl font-semibold mt-8 mb-3 pb-2 border-b">$1</h2>');
    result = result.replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold mt-8 mb-4">$1</h1>');

    // Bold and italic
    result = result.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    result = result.replace(/\*(.+?)\*/g, '<em>$1</em>');

    // Lists
    result = result.replace(/^- (.+)$/gm, '<li class="ml-4">$1</li>');
    result = result.replace(/(<li.*<\/li>\n?)+/g, '<ul class="list-disc mb-4">$&</ul>');

    // Horizontal rule
    result = result.replace(/^---$/gm, '<hr class="my-6 border-border" />');

    // Paragraphs (lines that aren't already wrapped)
    result = result.replace(/^(?!<[huplo]|<li|<hr)(.+)$/gm, '<p class="mb-4 leading-relaxed">$1</p>');

    // Line breaks
    result = result.replace(/\n\n/g, '');

    return result;
  }, [content]);

  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
