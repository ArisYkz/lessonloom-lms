import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Renders teacher-written Markdown safely (raw HTML is not allowed). */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose-lesson">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node: _n, ...p }) => <a {...p} target="_blank" rel="noreferrer noopener" />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
