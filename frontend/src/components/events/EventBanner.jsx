import { useState } from 'react';
import { ImageIcon } from 'lucide-react';
import { categoryTint } from '../../lib/categories';

// Event image from its banner URL; falls back to a category-colored tile if missing or broken.
export default function EventBanner({ src, category, alt = '', className = '', iconSize = 'size-12', children }) {
  const [failed, setFailed] = useState(false);
  const tint = categoryTint(category);
  const showImage = src && !failed;

  return (
    <div className={`relative overflow-hidden ${className}`} style={{ backgroundColor: tint.bg }}>
      {showImage ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center" style={{ color: tint.ink }}>
          <ImageIcon className={iconSize} strokeWidth={1.5} aria-hidden="true" />
        </div>
      )}
      {children}
    </div>
  );
}
