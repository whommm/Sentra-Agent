import React from 'react';
import type { AppFolder } from '../types/ui';
import { IoClose } from 'react-icons/io5';

interface IOSAppFolderProps {
    folder: AppFolder;
    isOpen: boolean;
    onOpen: () => void;
    onClose: () => void;
    onAppClick: (appId: string, onClick: () => void) => void;
}

export const IOSAppFolder: React.FC<IOSAppFolderProps> = ({
    folder,
    isOpen,
    onOpen,
    onClose,
    onAppClick
}) => {
    return (
        <>
            {/* Folder Icon - Use the icon from buildDesktopFolders */}
            {!isOpen && (
                <div
                    onClick={onOpen}
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        cursor: 'pointer',
                        userSelect: 'none',
                    }}
                >
                    {/* Folder thumbnail */}
                    <div style={{ marginBottom: 8 }}>
                        {folder.icon}
                    </div>

                    {/* Folder name */}
                    <div
                        style={{
                            fontSize: 12,
                            color: 'white',
                            textAlign: 'center',
                            textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
                            fontWeight: 500,
                            maxWidth: 80,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {folder.name}
                    </div>
                </div>
            )}

            {/* Folder Expanded View - iOS Style */}
            {isOpen && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(0, 0, 0, 0.75)',
                        backdropFilter: 'blur(30px)',
                        WebkitBackdropFilter: 'blur(30px)',
                        zIndex: 9999,
                        display: 'flex',
                        flexDirection: 'column',
                        animation: 'iosFadeIn 0.3s ease-out',
                    }}
                >
                    {/* Header */}
                    <div
                        style={{
                            padding: '20px 20px 10px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            background: 'linear-gradient(180deg, rgba(0,0,0,0.3) 0%, transparent 100%)',
                        }}
                    >
                        <div
                            style={{
                                fontSize: 22,
                                fontWeight: 600,
                                color: 'white',
                                letterSpacing: '-0.5px',
                            }}
                        >
                            {folder.name}
                        </div>
                        <button
                            onClick={onClose}
                            style={{
                                background: 'rgba(255, 255, 255, 0.2)',
                                border: 'none',
                                borderRadius: '50%',
                                width: 36,
                                height: 36,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                color: 'white',
                                transition: 'all 0.2s',
                            }}
                        >
                            <IoClose size={24} />
                        </button>
                    </div>

                    {/* Apps Grid */}
                    <div
                        style={{
                            flex: 1,
                            overflowY: 'auto',
                            padding: '20px',
                            display: 'grid',
                            gridTemplateColumns: 'repeat(4, 1fr)',
                            gap: '20px 12px',
                            alignContent: 'start',
                        }}
                    >
                        {folder.apps.map((app) => (
                            <div
                                key={app.id}
                                onClick={() => {
                                    onAppClick(app.id, app.onClick);
                                    onClose();
                                }}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    cursor: 'pointer',
                                    transition: 'transform 0.15s',
                                }}
                                onTouchStart={(e) => {
                                    e.currentTarget.style.transform = 'scale(0.95)';
                                }}
                                onTouchEnd={(e) => {
                                    e.currentTarget.style.transform = 'scale(1)';
                                }}
                            >
                                <div style={{ width: 60, height: 60, marginBottom: 8 }}>
                                    {app.icon}
                                </div>
                                <div
                                    style={{
                                        fontSize: 12,
                                        color: 'white',
                                        textAlign: 'center',
                                        textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
                                        fontWeight: 500,
                                        lineHeight: 1.2,
                                        maxWidth: 80,
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        display: '-webkit-box',
                                        WebkitLineClamp: 2,
                                        WebkitBoxOrient: 'vertical',
                                    }}
                                >
                                    {app.name}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Bottom Safe Area */}
                    <div style={{ height: 'env(safe-area-inset-bottom, 20px)' }} />
                </div>
            )}

            <style>{`
        @keyframes iosFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
        </>
    );
};
