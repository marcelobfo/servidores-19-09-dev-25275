import { useEffect, useRef } from "react";

interface SafeHTMLProps {
  html: string;
  className?: string;
}

export const SafeHTML = ({ html, className = "" }: SafeHTMLProps) => {
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (contentRef.current && html) {
      // Decode HTML entities if they exist
      const decodeHtml = (str: string) => {
        const txt = document.createElement('textarea');
        txt.innerHTML = str;
        return txt.value;
      };
      
      // Set innerHTML with decoded content
      contentRef.current.innerHTML = decodeHtml(html);
    }
  }, [html]);

  return (
    <div 
      ref={contentRef}
      className={`
        prose dark:prose-invert max-w-none
        prose-p:text-foreground prose-p:leading-relaxed
        prose-headings:text-foreground
        prose-strong:text-foreground
        prose-ul:text-foreground
        prose-ol:text-foreground
        prose-li:text-foreground
        prose-a:text-primary
        [&_*]:text-foreground
        [&_.ql-align-justify]:text-justify
        [&_.ql-align-center]:text-center
        [&_.ql-align-right]:text-right
        ${className}
      `}
    />
  );
};
