import type { ReactNode } from "react";

type CodeSnippetProps = {
  children: ReactNode;
};

export function CodeSnippet({ children }: CodeSnippetProps) {
  return <code className="code-snippet">{children}</code>;
}
