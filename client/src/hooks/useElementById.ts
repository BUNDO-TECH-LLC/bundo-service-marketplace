import { useLayoutEffect, useState } from 'react';

/** Resolves a DOM node after mount (for portals into static markup). */
export function useElementById(id: string | null): HTMLElement | null {
  const [node, setNode] = useState<HTMLElement | null>(null);

  useLayoutEffect(() => {
    if (!id) {
      setNode(null);
      return;
    }
    setNode(document.getElementById(id));
  }, [id]);

  return node;
}
