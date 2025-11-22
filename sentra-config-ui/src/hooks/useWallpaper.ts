import { useEffect, useState } from 'react';
import { DEFAULT_WALLPAPERS, BING_WALLPAPER } from '../constants/wallpaper';
import type { ToastMessage } from '../components/Toast';

export function useWallpaper(addToast: (type: ToastMessage['type'], title: string, message?: string) => void) {
  const [wallpapers, setWallpapers] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('sentra_custom_wallpapers');
      if (saved) {
        const custom = JSON.parse(saved);
        return [...DEFAULT_WALLPAPERS, ...custom];
      }
    } catch {}
    return DEFAULT_WALLPAPERS;
  });

  const [currentWallpaper, setCurrentWallpaper] = useState<string>(() => {
    return localStorage.getItem('sentra_current_wallpaper') || DEFAULT_WALLPAPERS[0];
  });

  const [brightness, setBrightness] = useState(() => {
    const saved = localStorage.getItem('sentra_brightness');
    return saved ? Number(saved) : 100;
  });

  const [wallpaperFit, setWallpaperFit] = useState<'cover' | 'contain'>(() => {
    const saved = localStorage.getItem('sentra_wallpaper_fit');
    return (saved as 'cover' | 'contain') || 'cover';
  });

  const [wallpaperInterval, setWallpaperInterval] = useState<number>(0);

  // rotation
  useEffect(() => {
    if (wallpaperInterval > 0) {
      const timer = setInterval(() => {
        const currentIndex = wallpapers.indexOf(currentWallpaper);
        const nextIndex = (currentIndex + 1) % wallpapers.length;
        setCurrentWallpaper(wallpapers[nextIndex]);
      }, wallpaperInterval * 1000);
      return () => clearInterval(timer);
    }
  }, [wallpaperInterval, wallpapers, currentWallpaper]);

  useEffect(() => {
    localStorage.setItem('sentra_current_wallpaper', currentWallpaper);
  }, [currentWallpaper]);

  useEffect(() => {
    localStorage.setItem('sentra_brightness', String(brightness));
  }, [brightness]);

  useEffect(() => {
    localStorage.setItem('sentra_wallpaper_fit', wallpaperFit);
  }, [wallpaperFit]);

  const handleWallpaperSelect = (wp: string) => setCurrentWallpaper(wp);

  const handleUploadWallpaper = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        if (file.size > 5 * 1024 * 1024) {
          addToast('error', '图片过大', '请上传小于 5MB 的图片');
          return;
        }
        const reader = new FileReader();
        reader.onload = (ev) => {
          const result = ev.target?.result as string;
          if (result) {
            const newWallpapers = [...wallpapers, result];
            setWallpapers(newWallpapers);
            setCurrentWallpaper(result);
            const customOnly = newWallpapers.slice(DEFAULT_WALLPAPERS.length);
            try {
              localStorage.setItem('sentra_custom_wallpapers', JSON.stringify(customOnly));
              addToast('success', '壁纸已添加');
            } catch (e) {
              addToast('error', '存储空间不足', '无法保存更多壁纸，请删除一些旧壁纸');
            }
          }
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  const deleteCurrentWallpaper = () => {
    if (DEFAULT_WALLPAPERS.includes(currentWallpaper) || currentWallpaper === BING_WALLPAPER) {
      addToast('info', '无法删除', '系统默认壁纸无法删除');
      return false;
    }
    const newWallpapers = wallpapers.filter(w => w !== currentWallpaper);
    setWallpapers(newWallpapers);
    setCurrentWallpaper(newWallpapers[newWallpapers.length - 1] || DEFAULT_WALLPAPERS[0]);
    const customOnly = newWallpapers.slice(DEFAULT_WALLPAPERS.length);
    localStorage.setItem('sentra_custom_wallpapers', JSON.stringify(customOnly));
    addToast('success', '壁纸已删除');
    return true;
  };

  return {
    wallpapers,
    currentWallpaper,
    setCurrentWallpaper,
    brightness,
    setBrightness,
    wallpaperFit,
    setWallpaperFit,
    wallpaperInterval,
    setWallpaperInterval,
    handleWallpaperSelect,
    handleUploadWallpaper,
    deleteCurrentWallpaper,
  } as const;
}
