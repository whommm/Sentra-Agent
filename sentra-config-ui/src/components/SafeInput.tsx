import React, { useState, useRef, useEffect } from 'react';
import { useDevice } from '../hooks/useDevice';
import { IoLockClosed } from 'react-icons/io5';

interface SafeInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    onSafeClick?: () => void;
}

export const SafeInput: React.FC<SafeInputProps> = ({ onSafeClick, className, ...props }) => {
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

    const handleClick = (e: React.MouseEvent<HTMLInputElement>) => {
        if (isLocked) {
            e.preventDefault();
            e.stopPropagation();
            setShowLockHint(true);

            if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
            lockTimerRef.current = window.setTimeout(() => setShowLockHint(false), 2000);

            if (onSafeClick) onSafeClick();
        } else {
            props.onClick?.(e);
        }
    };

    const handleDoubleClick = (e: React.MouseEvent<HTMLInputElement>) => {
        if (isLocked) {
            setIsLocked(false);
            setShowLockHint(false);
        }
        props.onDoubleClick?.(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        if (isMobile) {
            setIsLocked(true);
        }
        props.onBlur?.(e);
    };

    return (
        <div style={{ position: 'relative', width: '100%' }}>
            <input
                {...props}
                readOnly={isLocked || props.readOnly}
                onClick={handleClick}
                onDoubleClick={handleDoubleClick}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                onBlur={handleBlur}
                className={className}
                style={{
                    ...props.style,
                    opacity: isLocked ? 0.8 : 1,
                    cursor: isLocked ? 'not-allowed' : 'text'
                }}
            />
            {isLocked && showLockHint && (
                <div style={{
                    position: 'absolute',
                    right: 8,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#ff3b30',
                    fontSize: 12,
                    pointerEvents: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    background: 'rgba(0,0,0,0.7)',
                    padding: '2px 6px',
                    borderRadius: 4,
                    zIndex: 10
                }}>
                    <IoLockClosed size={10} />
                    <span>双击或长按编辑</span>
                </div>
            )}
        </div>
    );
};
