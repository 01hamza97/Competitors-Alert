'use client';

import React, { useState, useEffect } from 'react';
import {
  Play,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Terminal,
  Database,
  Cloud,
  FileCode,
  HardDrive,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';

export default function ScraperControlHub() {
  const [loading, setLoading] = useState(true);
  const [stores, setStores] = useState([]);
  const [competitors, setCompetitors] = useState([]);
  const [activeTab, setActiveTab] = useState('stores'); // 'stores' | 'competitors'
  const [recentLogs, setRecentLogs] = useState([]);
  const [stats, setStats] = useState({ totalRuns: 0, successfulRuns: 0, failedRuns: 0, runningRuns: 0 });
  const [triggeringStoreId, setTriggeringStoreId] = useState(null);
  const [selectedLog, setSelectedLog] = useState(null);
  const [storeOptions, setStoreOptions] = useState({});

  const fetchData = async () => {
    try {
      const res = await fetch('/api/scraper');
      const data = await res.json();
      if (data.success) {
        setStores(data.stores || []);
        setCompetitors(data.competitors || []);
        setRecentLogs(data.recentLogs || []);
        setStats(data.stats || { totalRuns: 0, successfulRuns: 0, failedRuns: 0, runningRuns: 0 });

        // Initialize mode options with Unlimited (0) as default
        const opts = {};
        [...(data.stores || []), ...(data.competitors || [])].forEach((s) => {
          opts[s.id] = {
            mode: 'auto',
            maxPages: 0,
          };
        });
        setStoreOptions((prev) => ({ ...opts, ...prev }));
      }
    } catch (err) {
      console.error('Failed to load scraper stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Poll every 6 seconds to update live statuses
    const interval = setInterval(fetchData, 6000);
    return () => clearInterval(interval);
  }, []);

  const handleTriggerScrape = async (store) => {
    setTriggeringStoreId(store.id);
    const opts = storeOptions[store.id] || { mode: 'auto', maxPages: 0 };

    try {
      const res = await fetch('/api/scraper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeId: store.id,
          targetUrl: store.newInventoryUrl,
          dealerName: store.name,
          mode: opts.mode,
          maxPages: parseInt(opts.maxPages, 10),
          forceRefresh: Boolean(opts.forceRefresh),
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(`Scraper launched for ${store.name}! Mode: ${opts.mode}`);
        fetchData();
      } else {
        toast.error(`Failed to launch scraper: ${data.error}`);
      }
    } catch (err) {
      toast.error(`Execution error: ${err.message}`);
    } finally {
      setTriggeringStoreId(null);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'running':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
            <RefreshCw size={12} className="animate-spin" /> Running
          </span>
        );
      case 'complete':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 size={12} /> Completed
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertCircle size={12} /> Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
            <Clock size={12} /> Idle
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-blue-50 text-blue-600">
            <Database size={20} />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Runs</p>
            <p className="text-xl font-bold text-slate-900">{stats.totalRuns}</p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-600">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Successful</p>
            <p className="text-xl font-bold text-emerald-600">{stats.successfulRuns}</p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-amber-50 text-amber-600">
            <RefreshCw size={20} className={stats.runningRuns > 0 ? 'animate-spin' : ''} />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">In Progress</p>
            <p className="text-xl font-bold text-amber-600">{stats.runningRuns}</p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-purple-50 text-purple-600">
            <HardDrive size={20} />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Storage Engine</p>
            <p className="text-sm font-bold text-purple-700 flex items-center gap-1.5 mt-0.5">
              <span>Local System Fallback</span>
            </p>
          </div>
        </div>
      </div>

      {/* Dealership Target Scraper Controls */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Zap size={18} className="text-amber-500" /> Dealership Scraper Operations
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Launch targeted inventory crawlers directly from the browser. Supports zero-AI static mode or AI-HTML snapshot mode.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
              <button
                onClick={() => setActiveTab('stores')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                  activeTab === 'stores'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                🏢 Client Stores ({stores.length})
              </button>
              <button
                onClick={() => setActiveTab('competitors')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                  activeTab === 'competitors'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                🎯 Competitors ({competitors.length})
              </button>
            </div>
            <button
              onClick={fetchData}
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw size={15} />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">{activeTab === 'stores' ? 'Dealership / Store' : 'Competitor Dealership'}</th>
                <th className="py-3 px-4">Platform & URL</th>
                <th className="py-3 px-4">Last Status</th>
                <th className="py-3 px-4">Listings Found</th>
                <th className="py-3 px-4">Crawl Config</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {(activeTab === 'stores' ? stores : competitors).length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 text-xs">
                    No active {activeTab === 'stores' ? 'stores' : 'competitors'} found in database.
                  </td>
                </tr>
              ) : (
                (activeTab === 'stores' ? stores : competitors).map((store) => {
                  const opts = storeOptions[store.id] || { mode: 'auto', maxPages: 0 };
                  const isRunning = store.scrapeStatus?.lastStatus === 'running' || triggeringStoreId === store.id;

                  return (
                    <tr key={store.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        <div className="flex items-center gap-1.5">
                          {store.isCompetitor && <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 font-medium border border-purple-200">Competitor</span>}
                          <span>{store.name}</span>
                        </div>
                        <div className="text-[11px] font-normal text-slate-400 font-mono mt-0.5">{store.dealershipKey || store.id}</div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 uppercase tracking-wide mr-2">
                          {store.scraperPlatform || 'custom'}
                        </span>
                        {store.newInventoryUrl ? (
                          <a
                            href={store.newInventoryUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1 truncate max-w-xs align-middle"
                          >
                            <span className="truncate">{store.newInventoryUrl}</span>
                            <ExternalLink size={11} className="shrink-0" />
                          </a>
                        ) : (
                          <span className="text-xs text-slate-400 italic">No URL configured</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        {getStatusBadge(store.scrapeStatus?.lastStatus)}
                        {store.scrapeStatus?.lastRunAt && (
                          <div className="text-[10px] text-slate-400 mt-1">
                            {new Date(store.scrapeStatus.lastRunAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-bold text-slate-900">{store.scrapeStatus?.totalListings || 0}</span>
                        <span className="text-xs text-slate-400 ml-1">vehicles</span>
                        {store.scrapeStatus?.newListings > 0 && (
                          <div className="text-[10px] text-emerald-600 font-medium">
                            {store.scrapeStatus.newListings} New
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <select
                            value={opts.mode}
                            disabled={isRunning}
                            onChange={(e) =>
                              setStoreOptions({
                                ...storeOptions,
                                [store.id]: { ...opts, mode: e.target.value },
                              })
                            }
                            className="text-xs border border-slate-200 rounded-md px-2 py-1 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="auto">Auto (Smart)</option>
                            <option value="static">Static (0 AI Cost)</option>
                            <option value="ai-html">AI-HTML (N8N)</option>
                          </select>

                          <select
                            value={opts.maxPages}
                            disabled={isRunning}
                            onChange={(e) =>
                              setStoreOptions({
                                ...storeOptions,
                                [store.id]: { ...opts, maxPages: e.target.value },
                              })
                            }
                            className="text-xs border border-slate-200 rounded-md px-2 py-1 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                          >
                            <option value="0">♾️ Unlimited (All Pages)</option>
                            <option value="1">1 Page (Quick Test)</option>
                            <option value="2">2 Pages</option>
                            <option value="3">3 Pages</option>
                            <option value="5">5 Pages</option>
                            <option value="10">10 Pages</option>
                            <option value="25">25 Pages</option>
                            <option value="50">50 Pages</option>
                          </select>

                          <label className="flex items-center gap-1 text-[11px] text-slate-500 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={Boolean(opts.forceRefresh)}
                              disabled={isRunning}
                              onChange={(e) =>
                                setStoreOptions({
                                  ...storeOptions,
                                  [store.id]: { ...opts, forceRefresh: e.target.checked },
                                })
                              }
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                            />
                            Bypass Cache
                          </label>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => handleTriggerScrape(store)}
                          disabled={isRunning || !store.newInventoryUrl}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-all ${
                            isRunning
                              ? 'bg-amber-100 text-amber-700 cursor-not-allowed'
                              : !store.newInventoryUrl
                              ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                              : 'bg-slate-900 hover:bg-slate-800 text-white active:scale-95'
                          }`}
                        >
                          {isRunning ? (
                            <>
                              <RefreshCw size={12} className="animate-spin" /> Crawling…
                            </>
                          ) : (
                            <>
                              <Play size={12} /> Start Scraper
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Execution Run Logs Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Terminal size={18} className="text-slate-700" /> Scraper Execution Activity
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Live audit trail of crawler runs, captured listings, manifests, and execution outputs.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Run ID & Timestamp</th>
                <th className="py-3 px-4">Store Target</th>
                <th className="py-3 px-4">Mode</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Vehicles Found</th>
                <th className="py-3 px-4">Storage Artifacts</th>
                <th className="py-3 px-4 text-right">Console Output</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {recentLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 text-xs">
                    No scrape runs recorded yet. Click "Start Scraper" above to begin.
                  </td>
                </tr>
              ) : (
                recentLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-mono text-xs font-semibold text-slate-800">{log.runId}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {new Date(log.createdAt).toLocaleString()}
                      </div>
                    </td>

                    <td className="py-3 px-4 font-medium text-slate-900">
                      {log.dealerName || log.storeId}
                    </td>

                    <td className="py-3 px-4">
                      <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 uppercase">
                        {log.mode || 'auto'}
                      </span>
                    </td>

                    <td className="py-3 px-4">{getStatusBadge(log.status)}</td>

                    <td className="py-3 px-4">
                      <span className="font-bold text-slate-900">{log.totalListingsFound || 0}</span>
                      <span className="text-xs text-slate-400 ml-1">total</span>
                      {log.newListingsCount > 0 && (
                        <span className="text-xs font-semibold text-emerald-600 ml-1.5">
                          ({log.newListingsCount} New)
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-xs">
                      <div className="flex items-center gap-1.5 text-slate-600">
                        {log.storageType === 'r2' ? (
                          <Cloud size={13} className="text-blue-500" />
                        ) : (
                          <HardDrive size={13} className="text-slate-400" />
                        )}
                        <span className="font-mono text-[11px]">{log.storageType === 'r2' ? 'Cloudflare R2' : 'Local Disk'}</span>
                      </div>
                      {log.localManifestPath && (
                        <div className="text-[10px] text-slate-400 font-mono truncate max-w-xs mt-0.5" title={log.localManifestPath}>
                          {log.localManifestPath.split('/').slice(-3).join('/')}
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                      >
                        <Terminal size={12} /> View Logs
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Live Log Console Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 text-slate-100 border border-slate-800 rounded-xl max-w-4xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-2">
                <Terminal size={16} className="text-emerald-400" />
                <span className="font-mono text-xs font-bold text-slate-200">
                  Console Output: {selectedLog.runId}
                </span>
                <span className="ml-2">{getStatusBadge(selectedLog.status)}</span>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded hover:bg-slate-800 transition-colors"
              >
                ✕ Close
              </button>
            </div>

            <div className="p-4 overflow-y-auto font-mono text-xs text-slate-300 bg-slate-900 flex-1 space-y-1 whitespace-pre-wrap select-text leading-relaxed">
              {selectedLog.logOutput || 'No output recorded for this run.'}
            </div>

            <div className="px-5 py-3 border-t border-slate-800 bg-slate-950 text-xs text-slate-400 flex items-center justify-between">
              <div>
                Started: {new Date(selectedLog.createdAt).toLocaleString()}
                {selectedLog.completedAt && ` • Finished: ${new Date(selectedLog.completedAt).toLocaleTimeString()}`}
              </div>
              <div>
                Vehicles Captured:{' '}
                <span className="font-bold text-white">{selectedLog.totalListingsFound || 0}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
