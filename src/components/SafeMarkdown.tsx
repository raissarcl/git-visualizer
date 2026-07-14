import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'

interface SafeMarkdownProps {
  children: string
}

/** Markdown com GFM + sanitização (uso em descrição/notas). */
export function SafeMarkdown({ children }: SafeMarkdownProps) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
      {children}
    </ReactMarkdown>
  )
}
