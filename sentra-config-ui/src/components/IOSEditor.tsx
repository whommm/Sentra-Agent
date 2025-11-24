import React from 'react';
import { IoChevronBack, IoClose } from 'react-icons/io5';
import { EnvEditor } from './EnvEditor';
import { EnvVariable } from '../types/config';

interface IOSEditorProps {
    appName: string;
    vars: EnvVariable[];
    onUpdate: (index: number, field: 'key' | 'value' | 'comment', val: string) => void;
    onAdd: () => void;
    onDelete: (index: number) => void;
    onSave: () => void;
    onMinimize: () => void;
    onClose: () => void;
    saving: boolean;
    isExample: boolean;
    backLabel?: string;
}

export const IOSEditor: React.FC<IOSEditorProps> = ({
    appName,
    vars,
    onUpdate,
    onAdd,
    onDelete,
    onSave,
    onMinimize,
    onClose,
    saving,
    isExample,
    backLabel = '主页'
}) => {
    return (
        <div className="ios-app-window">
            <div className="ios-app-header">
                <div className="ios-back-btn" onClick={onMinimize}>
                    <IoChevronBack /> {backLabel}
                </div>
                <div>{appName}</div>
                <div
                    style={{ color: '#ff3b30', cursor: 'pointer', fontWeight: 'bold', fontSize: '18px', display: 'flex', alignItems: 'center' }}
                    onClick={onClose}
                >
                    <IoClose size={24} />
                </div>
            </div>
            <div style={{ flex: 1, overflow: 'hidden', background: '#1c1c1e' }}>
                <EnvEditor
                    appName={appName}
                    vars={vars}
                    onUpdate={onUpdate}
                    onAdd={onAdd}
                    onDelete={onDelete}
                    onSave={onSave}
                    saving={saving}
                    isExample={isExample}
                    theme="dark"
                    isMobile={true}
                />
            </div>
        </div>
    );
};
