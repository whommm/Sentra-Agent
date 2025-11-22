import React, { useState, useRef, useEffect } from 'react';
import { useDevice } from '../hooks/useDevice';
import { IoLockClosed } from 'react-icons/io5';

interface SafeZoneProps {
    children: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
    onSafeClick?: () => void;
}

export const SafeZone: React.FC<SafeZoneProps> = ({ children, className, style, onSafeClick }) => {
    const { isMobile } = useDevice();
    const [isLocked, setIsLocked] = useState(isMobile);
    const [showLockHint, setShowLockHint] = useState(false);
    const timerRef = useRef<number | null>(null);
    const lockTimerRef = useRef<number | null>(null);

    useEffect(() => {
        if (!isMobile) {
            setIsLocked(false);
        }
    }, [isMobile]);

    const handleTouchStart = () => {
        if (!isMobile || !isLocked) return;

        timerRef.current = window.setTimeout(() => {
            setIsLocked(false);
            if (navigator.vibrate) navigator.vibrate(50);
        }, 800); // 800ms long press to unlock
    };

    const handleTouchEnd = () => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    };

    const handleClick = (e: React.MouseEvent) => {
        if (isLocked) {
            e.preventDefault();
            e.stopPropagation();
            setShowLockHint(true);

            if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
            lockTimerRef.current = window.setTimeout(() => setShowLockHint(false), 2000);

            if (onSafeClick) onSafeClick();
        }
    };

    const handleDoubleClick = () => {
        if (isLocked) {
            setIsLocked(false);
            setShowLockHint(false);
        }
    };

    const handleBlur = () => {
        if (isMobile) {
            setIsLocked(true);
        }
    };

    return (
        <div
            className={className}
            style={{ position: 'relative', ...style }}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onBlur={handleBlur}
        >
            <div style={{
                pointerEvents: isLocked ? 'none' : 'auto',
                opacity: isLocked ? 0.8 : 1,
                height: '100%',
                width: '100%'
            }}>
                {children}
            </div>

            {isLocked && (
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    zIndex: 10,
                    cursor: 'not-allowed'
                }} />
            )}

            {isLocked && showLockHint && (
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    color: '#ff3b30',
                    fontSize: 14,
                    pointerEvents: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    background: 'rgba(0,0,0,0.8)',
                    padding: '8px 12px',
                    borderRadius: 8,
                    zIndex: 20,
                    whiteSpace: 'nowrap'
                }}>
                    <IoLockClosed size={16} />
                    <span>双击或长按解锁</span>
                </div>
            )}
        </div>
    );
};
