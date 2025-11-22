import { useEffect, useState } from 'react';
import { saveModuleConfig, savePluginConfig } from '../services/api';
import { getDisplayName } from '../utils/icons';
import type { DeskWindow, FileItem } from '../types/ui';
import type { EnvVariable } from '../types/config';
import type { ToastMessage } from '../components/Toast';

export type UseDesktopWindowsParams = {
  setSaving: (s: boolean) => void;
  addToast: (type: ToastMessage['type'], title: string, message?: string) => void;
  // When saving finishes, we need to refresh configs
  loadConfigs: (silent?: boolean) => Promise<void> | void;
  onLogout?: () => void;
};

export function useDesktopWindows({ setSaving, addToast, loadConfigs, onLogout }: UseDesktopWindowsParams) {
  const [openWindows, setOpenWindows] = useState<DeskWindow[]>(() => {
    try {
      const saved = localStorage.getItem('sentra_open_windows');
      if (saved) {
        const parsedWindows = JSON.parse(saved);
        if (Array.isArray(parsedWindows) && parsedWindows.length > 0) {
          const width = 600;
          const height = 400;
          const centerPos = {
            x: Math.max(0, (window.innerWidth - width) / 2),
            y: Math.max(40, (window.innerHeight - height) / 2)
          };
          return parsedWindows.map((w: any) => {
            const p = w.pos || { x: 0, y: 0 };
            const invalid =
              p.x == null || p.y == null ||
              p.x < 20 || p.y < 30 ||
              p.x > window.innerWidth - 100 || p.y > window.innerHeight - 100;
            return invalid ? { ...w, pos: centerPos } : w;
          });
        }
      }
    } catch (e) {
      console.error('Failed to load saved windows', e);
    }
    return [];
  });

  const [activeWinId, setActiveWinId] = useState<string | null>(null);

  const [zNext, setZNext] = useState(() => {
    if (openWindows.length > 0) {
      return Math.max(...openWindows.map(w => w.z || 1000), 1000) + 1;
    }
    return 1000;
  });

  // Debounced persistence
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem('sentra_open_windows', JSON.stringify(openWindows));
      } catch (e) {
        console.error('Failed to save windows state', e);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [openWindows]);

  const bringToFront = (id: string) => {
    setOpenWindows(ws => {
      const nextZ = zNext + 1;
      return ws.map(w => (w.id === id ? { ...w, z: nextZ } : w));
    });
    setZNext(z => z + 1);
    setActiveWinId(id);
  };

  /**
   * Allocate a global z-index for other floating layers (e.g., Terminal windows)
   * so they share the same stacking context as desktop windows.
   */
  const allocateZ = () => {
    const next = zNext + 1;
    setZNext(next);
    return next;
  };

  const openWindow = (file: FileItem) => {
    const existing = openWindows.find(w => w.file.name === file.name && w.file.type === file.type);
    if (existing) {
      if (existing.minimized) {
        setOpenWindows(ws => ws.map(w => w.id === existing.id ? { ...w, minimized: false } : w));
      }
      bringToFront(existing.id);
      return;
    }

    const id = `w_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const width = 600;
    const height = 400;
    const x = Math.max(0, (window.innerWidth - width) / 2);
    const y = Math.max(40, (window.innerHeight - height) / 2);

    const win: DeskWindow = {
      id,
      file,
      z: zNext + 1,
      minimized: false,
      editedVars: file.variables ? [...file.variables] : [],
      pos: { x, y }
    };
    setOpenWindows(ws => [...ws, win]);
    setZNext(z => z + 1);
    setActiveWinId(id);
  };

  const handleClose = (id: string) => {
    setOpenWindows(ws => ws.filter(w => w.id !== id));
    if (activeWinId === id) setActiveWinId(null);
  };

  const handleSave = async (id: string) => {
    const win = openWindows.find(w => w.id === id);
    if (!win) return;

    try {
      setSaving(true);
      const validVars = win.editedVars.filter(v => v.key.trim());
      if (win.file.type === 'module') {
        await saveModuleConfig(win.file.name, validVars);
      } else {
        await savePluginConfig(win.file.name, validVars);
      }
      addToast('success', '保存成功', `已更新 ${getDisplayName(win.file.name)} 配置`);
      await loadConfigs(true);

      // Trigger logout after successful save to force re-login
      if (onLogout) {
        setTimeout(() => {
          onLogout();
        }, 1500); // Small delay to let the toast show
      }
    } catch (error) {
      addToast('error', '保存失败', error instanceof Error ? error.message : '未知错误');
    } finally {
      setSaving(false);
    }
  };

  const handleVarChange = (id: string, index: number, field: 'key' | 'value' | 'comment', val: string) => {
    setOpenWindows(ws => ws.map(w => {
      if (w.id !== id) return w;
      const newVars = [...w.editedVars];
      newVars[index] = { ...newVars[index], [field]: val } as EnvVariable;
      return { ...w, editedVars: newVars };
    }));
  };

  const handleAddVar = (id: string) => {
    setOpenWindows(ws => ws.map(w => w.id === id ? { ...w, editedVars: [...w.editedVars, { key: '', value: '', comment: '', isNew: true }] } : w));
  };

  const handleDeleteVar = (id: string, index: number) => {
    const win = openWindows.find(w => w.id === id);
    if (!win) return;

    const targetVar = win.editedVars[index];
    if (!targetVar.isNew) {
      addToast('error', '无法删除', '系统预设变量无法删除');
      return;
    }

    setOpenWindows(ws => ws.map(w => w.id === id ? { ...w, editedVars: w.editedVars.filter((_, i) => i !== index) } : w));
  };

  return {
    openWindows,
    setOpenWindows,
    activeWinId,
    setActiveWinId,
    bringToFront,
    allocateZ,
    openWindow,
    handleClose,
    handleSave,
    handleVarChange,
    handleAddVar,
    handleDeleteVar,
  } as const;
}
