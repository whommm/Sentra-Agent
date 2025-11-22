import { useEffect, useState } from 'react';

export function useDockFavorites() {
  const [dockFavorites, setDockFavorites] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('sentra_dock_favorites');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem('sentra_dock_favorites', JSON.stringify(dockFavorites));
    }, 500);
    return () => clearTimeout(timer);
  }, [dockFavorites]);

  return { dockFavorites, setDockFavorites } as const;
}
