'use client';

import React, { useState, useEffect } from 'react';

export default function SafeHTMLDisplay({ html, className = '', onHashtagClick = null }) {
  const [cleanHtml, setCleanHtml] = useState('');
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);

    // Only import and use DOMPurify on the client side
    const initSanitize = async () => {
      if (!html) return;

      try {
        const DOMPurify = (await import('dompurify')).default;

        const sanitized = DOMPurify.sanitize(html, {
          ALLOWED_TAGS: [
            'b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li',
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'code',
            'pre', 'span', 'div'
          ],
          ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'style']
        });

        setCleanHtml(sanitized);
      } catch (err) {
        console.error('Sanitization failed:', err);
        // Fallback to plain text if sanitization fails
        setCleanHtml(html.replace(/<[^>]*>?/gm, ''));
      }
    };

    initSanitize();
  }, [html]);

  if (!html) return null;

  // On the server or before hydration, render a placeholder or the content without risky attributes
  // For absolute safety during SSR, we can render nothing or a safe version.
  if (!isMounted) {
    return (
      <div
        className={`safe-html-content loading ${className}`}
        style={{ opacity: 0.5 }}
      >
        {/* Strip tags for the initial SSR render to be safe */}
        {html.replace(/<[^>]*>?/gm, '')}
      </div>
    );
  }

  return (
    <div
      className={`safe-html-content ${className}`}
      dangerouslySetInnerHTML={{ __html: cleanHtml }}
      onClick={(e) => {
        // Event delegation for hashtag clicks
        const target = e.target;
        if (onHashtagClick && target.tagName === 'SPAN' && target.classList.contains('hashtag-link')) {
          e.preventDefault();
          e.stopPropagation();
          const tag = target.innerText.replace('#', '');
          onHashtagClick(tag);
        }
      }}
    />
  );
}
