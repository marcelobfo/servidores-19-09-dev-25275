import { useEffect, useRef } from "react";

interface SafeHTMLProps {
  html: string;
  className?: string;
}

export const SafeHTML = ({ html, className = "" }: SafeHTMLProps) => {
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (contentRef.current && html) {
      // Set innerHTML safely - only use with trusted content from your database
      contentRef.current.innerHTML = html;
    }
  }, [html]);

  return (
    <div 
      ref={contentRef}
      className={`prose prose-sm max-w-none dark:prose-invert ${className}`}
    />
  );
};
