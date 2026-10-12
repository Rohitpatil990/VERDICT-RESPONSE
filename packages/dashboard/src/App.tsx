import React, { useState, useEffect } from 'react';
import { ApiClient, RegionId } from './api.js';
import { Sidebar, NavItem } from './components/Sidebar.js';
import { TopBar } from './components/TopBar.js';
import { OverviewView } from './components/OverviewView.js';
import { IncidentsView } from './components/IncidentsView.js';
import { ReplicationView } from './components/ReplicationView.js';
import { ConflictsView } from './components/ConflictsView.js';
import { SystemHealthView } from './components/SystemHealthView.js';
import { SourceTraceDrawer } from './components/SourceTraceDrawer.js';
import { FieldReportModal } from './components/FieldReportModal.js';
import { AboutModal } from './components/AboutModal.js';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<NavItem>('overview');
  const [currentRegion, setCurrentRegion] = useState<RegionId>('mumbai');
  const [regionStatus, setRegionStatus] = useState<any>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [regionError, setRegionError] = useState<string | null>(null);

  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [traceData, setTraceData] = useState<any>(null);

  const [showReportModal, setShowReportModal] = useState(false);
  const [reportCoords, setReportCoords] = useState<{ lat: number; lng: number; name?: string } | undefined>(undefined);
  const [showAboutModal, setShowAboutModal] = useState(false);

  // Fetch real regional state from active node
  const fetchData = async () => {
    try {
      const [status, mapData] = await Promise.all([
        ApiClient.getStatus(currentRegion),
        ApiClient.getMap(currentRegion)
      ]);
      setRegionStatus(status);
      setRecords(mapData.records || []);
      setRegionError(null);
    } catch (err: any) {
      setRegionError(`Region ${currentRegion.toUpperCase()} Unreachable (HTTP connection failed)`);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 2500);
    return () => clearInterval(interval);
  }, [currentRegion]);

  // Load SourceTrace when a record is selected
  useEffect(() => {
    if (!selectedRecordId) {
      setTraceData(null);
      return;
    }
    ApiClient.getTrace(currentRegion, selectedRecordId)
      .then(setTraceData)
      .catch(() => setTraceData(null));
  }, [selectedRecordId, currentRegion]);

  const handleOpenReport = (coords?: { lat: number; lng: number; name?: string }) => {
    setReportCoords(coords);
    setShowReportModal(true);
  };

  // Calculate live badge counts
  const conflictCount = records.filter(r => 
    r.indicators?.conflict?.status === 'Conflicting' || 
    r.indicators?.conflict?.status?.includes('review') ||
    (r.allOps && r.allOps.length > 1)
  ).length;

  const unresolvedCount = records.filter(r => 
    r.severity === 'CRITICAL' || r.severity === 'HIGH'
  ).length;

  return (
    <div className="flex h-screen w-screen bg-[#F8FAFC] text-[#172033] overflow-hidden font-sans select-none antialiased">
      {/* 1. Left Navigation Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        conflictCount={conflictCount}
        unresolvedCount={unresolvedCount}
      />

      {/* 2. Main Content Container */}
      <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
        {/* Top Navigation Bar */}
        <TopBar
          currentRegion={currentRegion}
          onSelectRegion={setCurrentRegion}
          regionStatus={regionStatus}
          isError={!!regionError}
          onOpenReport={() => handleOpenReport()}
          onOpenAbout={() => setShowAboutModal(true)}
        />

        {/* Global Connection Warning If Node Unreachable */}
        {regionError && (
          <div className="bg-red-50 border-b border-red-200 px-4 py-2 text-xs text-red-700 font-medium flex items-center justify-between shrink-0">
            <span>⚠ {regionError}</span>
            <button 
              onClick={fetchData} 
              className="text-red-700 underline font-semibold hover:text-red-900 ml-3"
            >
              Retry Connection
            </button>
          </div>
        )}

        {/* Dynamic Primary Workflow View */}
        <main className="flex-1 overflow-hidden relative">
          {currentTab === 'overview' && (
            <OverviewView
              currentRegion={currentRegion}
              records={records}
              regionStatus={regionStatus}
              isError={!!regionError}
              selectedRecordId={selectedRecordId}
              onSelectRecord={setSelectedRecordId}
              onOpenReport={handleOpenReport}
              onNavigateTab={setCurrentTab}
            />
          )}

          {currentTab === 'incidents' && (
            <IncidentsView
              currentRegion={currentRegion}
              records={records}
              selectedRecordId={selectedRecordId}
              onSelectRecord={setSelectedRecordId}
              onOpenReport={() => handleOpenReport()}
            />
          )}

          {currentTab === 'replication' && (
            <ReplicationView
              currentRegion={currentRegion}
              regionStatus={regionStatus}
              onRefresh={fetchData}
            />
          )}

          {currentTab === 'conflicts' && (
            <ConflictsView
              currentRegion={currentRegion}
              records={records}
              onResolved={fetchData}
            />
          )}

          {currentTab === 'health' && (
            <SystemHealthView
              currentRegion={currentRegion}
              regionStatus={regionStatus}
              records={records}
              onRefresh={fetchData}
            />
          )}
        </main>
      </div>

      {/* SourceTrace Evidence Drawer */}
      {selectedRecordId && (
        <SourceTraceDrawer
          traceData={traceData}
          currentRegion={currentRegion}
          onClose={() => setSelectedRecordId(null)}
          onRefresh={fetchData}
        />
      )}

      {/* Field Report Creation Modal */}
      {showReportModal && (
        <FieldReportModal
          currentRegion={currentRegion}
          defaultCoords={reportCoords}
          onClose={() => setShowReportModal(false)}
          onSuccess={fetchData}
        />
      )}

      {/* Architecture & Traceability Modal */}
      {showAboutModal && (
        <AboutModal onClose={() => setShowAboutModal(false)} />
      )}
    </div>
  );
};
