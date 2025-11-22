import { useEffect, useState } from 'react';

export function useUsageCounts() {
  const [usageCounts, setUsageCounts] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('sentra_usage_counts');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      try { localStorage.setItem('sentra_usage_counts', JSON.stringify(usageCounts)); } catch {}
    }, 500);
    return () => clearTimeout(timer);
  }, [usageCounts]);

  const recordUsage = (key: string) => {
    setUsageCounts(prev => ({ ...prev, [key]: (prev[key] || 0) + 1 }));
  };

  return { usageCounts, recordUsage } as const;
}
