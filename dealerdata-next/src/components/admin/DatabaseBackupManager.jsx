'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Database,
  Download,
  RotateCcw,
  Trash2,
  Plus,
  Upload,
  RefreshCw,
  HardDrive,
  Calendar,
  Layers,
  AlertTriangle,
  CheckCircle2,
  FileArchive,
  ShieldAlert,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

export default function DatabaseBackupManager() {
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');
  const [selectedBackupForRestore, setSelectedBackupForRestore] = useState(null);
  const [selectedBackupForDelete, setSelectedBackupForDelete] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [actionNotice, setActionNotice] = useState(null);

  // Fetch backups list
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['adminDatabaseBackups'],
    queryFn: async () => {
      const res = await fetch('/api/admin/backups');
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to fetch database backups');
      }
      return res.json();
    },
  });

  const backups = data?.backups || [];
  const dbInfo = data?.database || { database: 'dealerdata-2', host: 'localhost' };
  const totalSizeBytes = data?.totalSizeBytes || 0;

  // Format bytes helper
  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Create Backup mutation
  const createBackupMutation = useMutation({
    mutationFn: async (noteText) => {
      const res = await fetch('/api/admin/backups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: noteText }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to create backup');
      return json;
    },
    onSuccess: (res) => {
      setNote('');
      queryClient.invalidateQueries(['adminDatabaseBackups']);
      setActionNotice({ type: 'success', message: res.message || 'Backup created successfully!' });
      setTimeout(() => setActionNotice(null), 8000);
    },
    onError: (err) => {
      setActionNotice({ type: 'error', message: err.message });
    },
  });

  // Restore Backup mutation
  const restoreBackupMutation = useMutation({
    mutationFn: async (fileName) => {
      const res = await fetch(`/api/admin/backups/${encodeURIComponent(fileName)}/restore`, {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to restore backup');
      return json;
    },
    onSuccess: (res) => {
      setSelectedBackupForRestore(null);
      queryClient.invalidateQueries();
      setActionNotice({
        type: 'success',
        message: res.message || `Successfully restored ${res.fileName}!`,
      });
      setTimeout(() => setActionNotice(null), 10000);
    },
    onError: (err) => {
      setSelectedBackupForRestore(null);
      setActionNotice({ type: 'error', message: err.message });
    },
  });

  // Delete Backup mutation
  const deleteBackupMutation = useMutation({
    mutationFn: async (fileName) => {
      const res = await fetch(`/api/admin/backups/${encodeURIComponent(fileName)}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to delete backup');
      return json;
    },
    onSuccess: (res) => {
      setSelectedBackupForDelete(null);
      queryClient.invalidateQueries(['adminDatabaseBackups']);
      setActionNotice({ type: 'success', message: `Backup ${res.fileName} deleted.` });
      setTimeout(() => setActionNotice(null), 6000);
    },
    onError: (err) => {
      setSelectedBackupForDelete(null);
      setActionNotice({ type: 'error', message: err.message });
    },
  });

  // Handle file upload
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setActionNotice(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/admin/backups/upload', {
        method: 'POST',
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to upload backup');

      queryClient.invalidateQueries(['adminDatabaseBackups']);
      setActionNotice({ type: 'success', message: json.message || 'Backup uploaded successfully!' });
      setTimeout(() => setActionNotice(null), 8000);
    } catch (err) {
      setActionNotice({ type: 'error', message: err.message });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDownload = (fileName) => {
    window.open(`/api/admin/backups/${encodeURIComponent(fileName)}/download`, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Notice */}
      {actionNotice && (
        <div
          className={`p-4 rounded-xl border flex items-start gap-3 transition-all ${
            actionNotice.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          {actionNotice.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          )}
          <div className="flex-1 text-sm font-medium">{actionNotice.message}</div>
          <button
            onClick={() => setActionNotice(null)}
            className="text-xs font-bold text-gray-400 hover:text-gray-700 ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
            <Database size={22} />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Backups</p>
            <p className="text-2xl font-black text-gray-900 mt-0.5">{backups.length}</p>
          </div>
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
            <HardDrive size={22} />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Storage Used</p>
            <p className="text-2xl font-black text-gray-900 mt-0.5">{formatBytes(totalSizeBytes)}</p>
          </div>
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <Calendar size={22} />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Latest Backup</p>
            <p className="text-sm font-bold text-gray-900 mt-1">
              {backups[0] ? format(parseISO(backups[0].createdAt), 'MMM d, h:mm a') : 'None yet'}
            </p>
          </div>
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
            <Layers size={22} />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Active Database</p>
            <p className="text-sm font-bold text-gray-900 mt-0.5 font-mono">{dbInfo.database || 'MySQL'}</p>
            <p className="text-[11px] text-gray-400 font-mono truncate max-w-[140px]">{dbInfo.host}:{dbInfo.port || 3306}</p>
          </div>
        </div>
      </div>

      {/* Action Controls & Backup Creation Toolbar */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-gray-900">Database Snapshot Manager</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Create point-in-time gzipped MySQL backups or restore previous snapshots with 1-click.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="p-2 border border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-xl transition-all"
              title="Refresh backups list"
            >
              <RefreshCw size={16} className={isFetching ? 'animate-spin' : ''} />
            </button>

            <label className={`cursor-pointer inline-flex items-center gap-2 px-3.5 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 transition-all ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
              <Upload size={14} className="text-gray-500" />
              <span>{uploading ? 'Uploading...' : 'Upload .sql / .gz'}</span>
              <input
                type="file"
                accept=".sql,.gz"
                className="hidden"
                onChange={handleFileUpload}
                disabled={uploading}
              />
            </label>
          </div>
        </div>

        {/* Create Backup Input Bar */}
        <div className="pt-3 border-t border-gray-100 flex flex-col sm:flex-row items-center gap-3">
          <input
            type="text"
            placeholder="Optional backup label or note (e.g. Pre-scraper run, Weekly maintenance)..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={createBackupMutation.isPending}
            className="flex-1 text-xs border border-gray-200 rounded-xl px-3.5 py-2.5 bg-gray-50/50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all text-gray-800"
          />

          <button
            onClick={() => createBackupMutation.mutate(note)}
            disabled={createBackupMutation.isPending}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-blue-500/20 disabled:opacity-50"
          >
            {createBackupMutation.isPending ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                <span>Dumping & Compressing Database...</span>
              </>
            ) : (
              <>
                <Plus size={15} />
                <span>Create Backup Now</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Backups Table */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileArchive size={17} className="text-gray-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-gray-700">Available Snapshots</span>
            <span className="text-xs bg-gray-100 font-bold text-gray-600 px-2 py-0.5 rounded-full ml-1">
              {backups.length}
            </span>
          </div>
          <span className="text-[11px] text-gray-400">Restoration overwrites active tables with snapshot state</span>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-gray-400 text-sm">
            <RefreshCw className="animate-spin mx-auto mb-2 text-gray-400" size={20} />
            Loading backup catalog...
          </div>
        ) : backups.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <Database className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-gray-700">No database backups found</p>
            <p className="text-xs text-gray-400 max-w-sm mx-auto">
              Click &quot;Create Backup Now&quot; above or run <code>npm run db:backup</code> in terminal to create your first snapshot.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50/80 border-b border-gray-100 text-gray-500 uppercase tracking-wider text-[11px] font-semibold">
                <tr>
                  <th className="py-3 px-4">Backup File & Note</th>
                  <th className="py-3 px-4">Created Date</th>
                  <th className="py-3 px-4">Size</th>
                  <th className="py-3 px-4">Tables</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {backups.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
                          <Database size={15} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900 font-mono text-[11px] truncate max-w-sm">
                            {b.fileName}
                          </p>
                          {b.note ? (
                            <p className="text-[11px] text-gray-500 italic mt-0.5">{b.note}</p>
                          ) : (
                            <p className="text-[10px] text-gray-400 mt-0.5">Database: {b.database}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-gray-600 font-medium">
                      {format(parseISO(b.createdAt), 'MMM d, yyyy h:mm:ss a')}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-gray-700 font-mono">
                      {b.sizeFormatted}
                    </td>
                    <td className="py-3.5 px-4 text-gray-500 font-medium">
                      {b.tableCount != null ? `${b.tableCount} tables` : '—'}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5 justify-end">
                        {/* Restore Button */}
                        <button
                          onClick={() => setSelectedBackupForRestore(b)}
                          disabled={restoreBackupMutation.isPending}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/80 rounded-lg font-semibold transition-all shadow-xs"
                          title="Restore database from this snapshot"
                        >
                          <RotateCcw size={13} className="text-amber-700" />
                          <span>Restore</span>
                        </button>

                        {/* Download Button */}
                        <button
                          onClick={() => handleDownload(b.fileName)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-lg font-semibold transition-all"
                          title="Download compressed backup file"
                        >
                          <Download size={13} className="text-gray-500" />
                          <span>Download</span>
                        </button>

                        {/* Delete Button */}
                        <button
                          onClick={() => setSelectedBackupForDelete(b)}
                          disabled={deleteBackupMutation.isPending}
                          className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                          title="Delete this backup"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Confirm Restore */}
      {selectedBackupForRestore && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                <ShieldAlert size={22} />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Confirm Database Restore</h3>
                <p className="text-xs text-gray-500">Restore point-in-time snapshot</p>
              </div>
            </div>

            <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-900 space-y-2">
              <p className="font-semibold text-amber-950 flex items-center gap-1.5">
                <AlertTriangle size={14} className="text-amber-600 shrink-0" />
                Warning: Current database state will be replaced!
              </p>
              <p className="leading-relaxed text-amber-900/90">
                You are about to restore the database to:
                <br />
                <strong className="font-mono text-amber-950 font-bold block mt-1 break-all">
                  {selectedBackupForRestore.fileName}
                </strong>
                created on{' '}
                <strong>
                  {format(parseISO(selectedBackupForRestore.createdAt), 'MMMM d, yyyy h:mm:ss a')}
                </strong>
                .
              </p>
            </div>

            <p className="text-xs text-gray-500">
              Any data modified after this snapshot date will be replaced by the backup contents.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setSelectedBackupForRestore(null)}
                disabled={restoreBackupMutation.isPending}
                className="px-4 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => restoreBackupMutation.mutate(selectedBackupForRestore.fileName)}
                disabled={restoreBackupMutation.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-amber-600/20 disabled:opacity-50"
              >
                {restoreBackupMutation.isPending ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Restoring Tables...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw size={14} />
                    <span>Yes, Restore Now</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirm Delete */}
      {selectedBackupForDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                <Trash2 size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Delete Backup</h3>
                <p className="text-xs text-gray-500">Permanently delete snapshot</p>
              </div>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed">
              Are you sure you want to delete{' '}
              <strong className="font-mono text-gray-900 block mt-1 break-all">
                {selectedBackupForDelete.fileName}
              </strong>
              ? This action cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setSelectedBackupForDelete(null)}
                disabled={deleteBackupMutation.isPending}
                className="px-4 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => deleteBackupMutation.mutate(selectedBackupForDelete.fileName)}
                disabled={deleteBackupMutation.isPending}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-rose-600/20 disabled:opacity-50"
              >
                {deleteBackupMutation.isPending ? 'Deleting...' : 'Delete Backup'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
