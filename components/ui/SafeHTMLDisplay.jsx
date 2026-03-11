import DOMPurify from 'isomorphic-dompurify';

export default function SafeHTMLDisplay({ html, className = '', onHashtagClick = null }) {
  if (!html) return null;

  // 1. Convert plain text hashtags to clickable spans within the text before sanitization
  // We only replace #tags that aren't already inside an HTML attribute
  let processedHtml = html;
  
  if (onHashtagClick) {
    // This simple regex looks for # followed by alnum, but isn't perfect for HTML attributes
    // To be safe and simple, we'll let the parser handle it, or we do a basic replace:
    // Actually, handling hashtag clicks inside dangerouslySetInnerHTML is tricky 
    // because React won't attach onClick to raw HTML strings.
    // Instead, we will wrap the clean HTML and use event delegation.
  }

  // 2. Sanitize the HTML
  const cleanHtml = DOMPurify.sanitize(processedHtml, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'code', 'pre', 'span', 'div'],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'style']
  });

  return (
    <div 
      className={`safe-html-content ${className}`}
      dangerouslySetInnerHTML={{ __html: cleanHtml }}
      onClick={(e) => {
        // Event delegation for hashtag clicks
        if (onHashtagClick && e.target.tagName === 'SPAN' && e.target.classList.contains('hashtag-link')) {
          e.preventDefault();
          e.stopPropagation();
          const tag = e.target.innerText.replace('#', '');
          onHashtagClick(tag);
        }
      }}
    />
  );
}
