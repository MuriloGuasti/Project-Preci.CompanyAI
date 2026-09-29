import React from 'react';
import { FileExplorer } from '../components/documents/FileExplorer';
import { UploadModal } from '../components/documents/UploadModal';
import { CreateFolderModal } from '../components/documents/CreateFolderModal';

export const DocumentsPage: React.FC = () => {
  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden">
      <FileExplorer />
      <UploadModal />
      <CreateFolderModal />
    </div>
  );
};
