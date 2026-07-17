import React, { useState, useEffect, useRef } from 'react';
import { firebaseApi } from '@/api/firebaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { motion } from 'framer-motion';
import { Upload, FolderPlus, Search, Trash2, Download, Eye, ArrowLeft, File, Folder, Image, FileText, Film, Music, MoreVertical, Edit2, Loader2, X } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Progress } from '@/components/ui/progress';
import VideoPlayer from '@/components/VideoPlayer';
import { useToast } from '@/components/ui/use-toast';

function formatSize(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getFileIcon(type) {
  if (!type) return File;
  if (type.startsWith('image/')) return Image;
  if (type.includes('pdf') || type.includes('document')) return FileText;
  if (type.startsWith('video/')) return Film;
  if (type.startsWith('audio/')) return Music;
  return File;
}

export default function Storage() {
  const [user, setUser] = useState(null);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPath, setCurrentPath] = useState('/');
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadFileName, setUploadFileName] = useState('');
  const [uploadFileSize, setUploadFileSize] = useState(0);
  const [uploadStats, setUploadStats] = useState(null);
  const [previewFile, setPreviewFile] = useState(null);
  const [renameDialog, setRenameDialog] = useState(null);
  const [newName, setNewName] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [folderDialog, setFolderDialog] = useState(false);
  const fileInputRef = useRef(null);
  const uploadAbortRef = useRef(null);
  const { toast } = useToast();

  const handleVideoPositionSave = async (currentTime, duration) => {
    if (!previewFile) return;
    try {
      await firebaseApi.entities.UserFile.update(previewFile.id, { last_position: Math.floor(currentTime), duration_seconds: Math.floor(duration || 0) });
    } catch (e) {}
  };

  useEffect(() => {
    async function load() {
      const u = await firebaseApi.auth.me();
      setUser(u);
      const items = await firebaseApi.entities.UserFile.filter({ user_id: u.id });
      setFiles(items);
      setLoading(false);
    }
    load();
  }, []);

  const currentFiles = files.filter(f => {
    if (search) return f.name.toLowerCase().includes(search.toLowerCase());
    return (f.folderPath || f.folder_path) === currentPath;
  });

  const isFolder = (file) => file.isFolder || file.is_folder;
  const storagePathFor = (file) => file.storagePath || file.storage_path;
  const folders = currentFiles.filter(isFolder);
  const regularFiles = currentFiles.filter(f => !isFolder(f));

  const totalSize = files.filter(f => !isFolder(f)).reduce((sum, f) => sum + (f.size || f.file_size || 0), 0);
  const maxStorage = 1024 * 1024 * 1024 * 1024; // 1 TB
  const usedPct = Math.min(100, (totalSize / maxStorage) * 100);

  const handleUpload = async (e) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    setUploading(true);
    setUploadProgress(0);

    try { for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      setUploadFileName(file.name);
      setUploadFileSize(file.size);
      setUploadProgress(Math.round(((i) / fileList.length) * 100));

      const controller = new AbortController();
      uploadAbortRef.current = controller;
      const { path, bucket } = await firebaseApi.integrations.Core.UploadFile({ file, folder: `Cloud${currentPath}`, signal: controller.signal, onProgress: (stats) => { setUploadProgress(stats.progress); setUploadStats(stats); } });
      const created = await firebaseApi.entities.UserFile.create({
        user_id: user.id,
        name: file.name,
        storagePath: path,
        bucket,
        size: file.size,
        mimeType: file.type,
        folderPath: currentPath,
        isFolder: false,
      });
      setFiles(prev => [...prev, created]);
      setUploadProgress(Math.round(((i + 1) / fileList.length) * 100));
    }
      toast({ title: 'Upload complete!' });
    } catch (caught) {
      toast({ title: caught?.name === 'AbortError' ? 'Upload cancelled' : 'Upload failed', description: caught.message, variant: 'destructive' });
    } finally {
      setUploading(false); setUploadProgress(0); setUploadFileName(''); setUploadFileSize(0); setUploadStats(null); uploadAbortRef.current = null;
      e.target.value = '';
    }
  };

  const createFolder = async () => {
    if (!newFolderName.trim()) return;
    const name = newFolderName.trim();
    const { path } = await firebaseApi.integrations.Core.CreateFolder({ path: `Cloud${currentPath}${name}` });
    const created = await firebaseApi.entities.UserFile.create({
      user_id: user.id,
      name, folderPath: currentPath, isFolder: true, storagePath: path,
    });
    setFiles(prev => [...prev, created]);
    setNewFolderName('');
    setFolderDialog(false);
  };

  const deleteFile = async (file) => {
    const path = storagePathFor(file);
    if (path) {
      if (isFolder(file)) await firebaseApi.integrations.Core.DeleteFolder({ path });
      else await firebaseApi.integrations.Core.DeleteFile({ path });
    }
    await firebaseApi.entities.UserFile.delete(file.id);
    setFiles(prev => prev.filter(f => f.id !== file.id));
  };

  const renameFile = async () => {
    if (!newName.trim() || !renameDialog) return;
    const path = storagePathFor(renameDialog);
    const moved = path && !isFolder(renameDialog) ? await firebaseApi.integrations.Core.RenameFile({ path, name: newName.trim() }) : null;
    const updated = await firebaseApi.entities.UserFile.update(renameDialog.id, { name: newName.trim(), ...(moved?.path ? { storagePath: moved.path } : {}) });
    setFiles(prev => prev.map(f => f.id === renameDialog.id ? updated : f));
    setRenameDialog(null);
    setNewName('');
  };

  const navigateToFolder = (folder) => {
    setCurrentPath(currentPath + folder.name + '/');
    setSearch('');
  };

  const navigateUp = () => {
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    setCurrentPath(parts.length === 0 ? '/' : '/' + parts.join('/') + '/');
  };

  const breadcrumbs = currentPath.split('/').filter(Boolean);
  const openFile = async (file) => {
    try {
      const path = storagePathFor(file);
      const url = path ? (await firebaseApi.integrations.Core.SignFileUrl({ path })).url : file.file_url;
      if (!url) throw new Error('File location is unavailable.');
      setPreviewFile({ ...file, file_url: url });
    } catch (caught) { toast({ title: 'Unable to open file', description: caught.message, variant: 'destructive' }); }
  };
  const downloadFile = async (file) => {
    try {
      const path = storagePathFor(file);
      const url = path ? (await firebaseApi.integrations.Core.DownloadFile({ path })).url : file.file_url;
      if (!url) throw new Error('File location is unavailable.');
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (caught) { toast({ title: 'Unable to download file', description: caught.message, variant: 'destructive' }); }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-[60vh]"><div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Cloud Storage</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setFolderDialog(true)}><FolderPlus className="w-4 h-4 mr-1" />Folder</Button>
          <Button size="sm" onClick={() => fileInputRef.current?.click()}><Upload className="w-4 h-4 mr-1" />Upload</Button>
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleUpload} />
        </div>
      </div>

      {/* Storage dashboard */}
      <div className="glass-card p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Storage Used</span>
          <span className="text-sm text-muted-foreground">{formatSize(totalSize)} / {formatSize(maxStorage)}</span>
        </div>
        <Progress value={usedPct} className="h-2" />
        <div className="flex justify-between mt-2 text-xs text-muted-foreground">
          <span>{files.filter(f => !f.is_folder).length} files</span>
          <span>{formatSize(maxStorage - totalSize)} remaining</span>
        </div>
      </div>

      {/* Upload progress */}
      {uploading && (
        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-primary flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium truncate">{uploadFileName || 'Uploading...'}</p>
                <span className="text-xs text-muted-foreground flex-shrink-0">{uploadFileSize ? formatSize(uploadFileSize) : ''}</span>
              </div>
              <Progress value={uploadProgress} className="h-2 mt-2" />
              <p className="text-xs text-muted-foreground mt-1">{uploadStats?.speed ? `${formatSize(uploadStats.speed)}/s • ${Math.ceil(uploadStats.remainingTime || 0)}s remaining` : `${formatSize(maxStorage - totalSize)} remaining storage`}</p>
            </div>
            <span className="text-sm font-semibold text-primary flex-shrink-0">{uploadProgress}%</span>
            <button aria-label="Cancel upload" onClick={() => uploadAbortRef.current?.abort()} className="p-2 rounded-lg hover:bg-muted"><X className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search files..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
      </div>

      {/* Breadcrumbs */}
      <div className="flex items-center gap-1 text-sm">
        {currentPath !== '/' && (
          <button onClick={navigateUp} className="p-1 rounded hover:bg-muted"><ArrowLeft className="w-4 h-4" /></button>
        )}
        <button onClick={() => setCurrentPath('/')} className="px-2 py-1 rounded hover:bg-muted font-medium">Root</button>
        {breadcrumbs.map((part, i) => (
          <React.Fragment key={i}>
            <span className="text-muted-foreground">/</span>
            <button onClick={() => setCurrentPath('/' + breadcrumbs.slice(0, i + 1).join('/') + '/')} className="px-2 py-1 rounded hover:bg-muted">{part}</button>
          </React.Fragment>
        ))}
      </div>

      {/* Files */}
      {currentFiles.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <Folder className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">This folder is empty</p>
        </div>
      ) : (
        <div className="space-y-2">
          {folders.map((folder, i) => (
            <motion.div key={folder.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}
              className="glass-card p-3 flex items-center gap-3 cursor-pointer hover:shadow-lg transition-all"
              onClick={() => navigateToFolder(folder)}
            >
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Folder className="w-5 h-5 text-blue-500" />
              </div>
              <span className="flex-1 font-medium text-sm">{folder.name}</span>
              <DropdownMenu>
                <DropdownMenuTrigger onClick={e => e.stopPropagation()} className="p-1 rounded hover:bg-muted">
                  <MoreVertical className="w-4 h-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setRenameDialog(folder); setNewName(folder.name); }}>
                    <Edit2 className="w-4 h-4 mr-2" />Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); deleteFile(folder); }} className="text-destructive">
                    <Trash2 className="w-4 h-4 mr-2" />Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </motion.div>
          ))}
          {regularFiles.map((file, i) => {
            const Icon = getFileIcon(file.file_type);
            return (
              <motion.div key={file.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: (folders.length + i) * 0.02 }}
                className="glass-card p-3 flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                  <Icon className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{formatSize(file.size || file.file_size)}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => openFile(file)} className="p-2 rounded-lg hover:bg-muted transition-colors"><Eye className="w-4 h-4" /></button>
                  <button onClick={() => downloadFile(file)} className="p-2 rounded-lg hover:bg-muted transition-colors"><Download className="w-4 h-4" /></button>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="p-2 rounded-lg hover:bg-muted transition-colors"><MoreVertical className="w-4 h-4" /></DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => { setRenameDialog(file); setNewName(file.name); }}><Edit2 className="w-4 h-4 mr-2" />Rename</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => deleteFile(file)} className="text-destructive"><Trash2 className="w-4 h-4 mr-2" />Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Preview dialog */}
      <Dialog open={!!previewFile} onOpenChange={() => setPreviewFile(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{previewFile?.name}</DialogTitle></DialogHeader>
          {previewFile && (
            <div className="mt-2">
              {previewFile.file_type?.startsWith('image/') && (
                <img src={previewFile.file_url} alt={previewFile.name} className="w-full rounded-lg" />
              )}
              {previewFile.file_type?.includes('pdf') && (
                <iframe src={previewFile.file_url} className="w-full h-[70vh] rounded-lg" title={previewFile.name} />
              )}
              {previewFile.file_type?.startsWith('video/') && (
                <VideoPlayer file={previewFile} onPositionSave={handleVideoPositionSave} />
              )}
              {previewFile.file_type?.startsWith('audio/') && (
                <audio controls className="w-full"><source src={previewFile.file_url} type={previewFile.file_type} /></audio>
              )}
              {!['image/', 'video/', 'audio/'].some(t => previewFile.file_type?.startsWith(t)) && !previewFile.file_type?.includes('pdf') && (
                <div className="text-center py-8">
                  <File className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">Preview not available for this file type</p>
                  <a href={previewFile.file_url} target="_blank" rel="noopener noreferrer"><Button className="mt-3"><Download className="w-4 h-4 mr-2" />Download</Button></a>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Rename dialog */}
      <Dialog open={!!renameDialog} onOpenChange={() => setRenameDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rename</DialogTitle></DialogHeader>
          <Input value={newName} onChange={e => setNewName(e.target.value)} />
          <Button onClick={renameFile} disabled={!newName.trim()}>Rename</Button>
        </DialogContent>
      </Dialog>

      {/* New folder dialog */}
      <Dialog open={folderDialog} onOpenChange={setFolderDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Folder</DialogTitle></DialogHeader>
          <Input value={newFolderName} onChange={e => setNewFolderName(e.target.value)} placeholder="Folder name" />
          <Button onClick={createFolder} disabled={!newFolderName.trim()}>Create</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
