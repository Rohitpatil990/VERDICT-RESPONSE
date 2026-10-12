import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { 
  MapPin, 
  Navigation, 
  Layers, 
  Info,
  Compass
} from 'lucide-react';
import { useI18n } from '../i18n.js';
import gazetteerData from '../../../../assets/seed_gazetteer.json';

interface MapOperationsProps {
  currentRegion: any;
  records: any[];
  regionStatus: any;
  selectedRecordId: string | null;
  onSelectRecord: (id: string) => void;
  onReportHere: (coords: { lat: number; lng: number; name?: string }) => void;
}

const REGION_COORDINATES: Record<string, [number, number]> = {
  mumbai: [19.0760, 72.8777],
  delhi: [28.6139, 77.2090],
  bengaluru: [12.9716, 77.5946]
};

export const MapOperations: React.FC<MapOperationsProps> = ({
  currentRegion,
  records,
  regionStatus,
  selectedRecordId,
  onSelectRecord,
  onReportHere
}) => {
  const { t } = useI18n();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const linesLayerRef = useRef<L.LayerGroup | null>(null);

  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedLandmark, setSelectedLandmark] = useState<string>('');
  const [tileError, setTileError] = useState(false);
  const [showLegend, setShowLegend] = useState(true);

  // 1. Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const initialCenter: [number, number] = REGION_COORDINATES[currentRegion] || [19.0760, 72.8777];
    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: 12,
      zoomControl: false,
      attributionControl: false
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Clean, crisp standard OSM tiles for enterprise GIS view
    const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap | VERDICT Emergency GIS'
    });

    tileLayer.on('tileerror', () => {
      setTileError(true);
    });

    tileLayer.addTo(map);

    markersLayerRef.current = L.layerGroup().addTo(map);
    linesLayerRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;

    // Geolocation
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        () => {
          setUserLocation({ lat: 19.0688, lng: 72.8795 });
        },
        { timeout: 4000 }
      );
    }

    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObserver.observe(mapContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // 2. Pan when active region changes
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const center = REGION_COORDINATES[currentRegion];
    if (center) {
      mapInstanceRef.current.setView(center, currentRegion === 'mumbai' ? 12 : 11, {
        animate: true
      });
      setTimeout(() => {
        mapInstanceRef.current?.invalidateSize();
      }, 200);
    }
  }, [currentRegion]);

  // 3. Render Regional Hubs, Link Lines, and Incident Pins
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current || !linesLayerRef.current) return;

    markersLayerRef.current.clearLayers();
    linesLayerRef.current.clearLayers();

    // A. Inter-Region Link Polylines
    const links = regionStatus?.linkState || {};
    const drawnPairs = new Set<string>();
    const regions = ['mumbai', 'delhi', 'bengaluru'];

    for (let i = 0; i < regions.length; i++) {
      for (let j = i + 1; j < regions.length; j++) {
        const r1 = regions[i];
        const r2 = regions[j];
        const key = [r1, r2].sort().join('<->');
        if (drawnPairs.has(key)) continue;
        drawnPairs.add(key);

        const linkInfo = links[key];
        const isCut = linkInfo?.status === 'DISCONNECTED';
        const isDegraded = linkInfo?.status === 'DEGRADED';

        const color = isCut ? '#B91C1C' : isDegraded ? '#B45309' : '#2563EB';
        const dashArray = isCut ? '5, 8' : undefined;

        const line = L.polyline([REGION_COORDINATES[r1], REGION_COORDINATES[r2]], {
          color,
          weight: isCut ? 2.5 : 3.5,
          dashArray,
          opacity: 0.85
        });

        line.bindTooltip(`
          <div style="font-size: 11px; font-family: sans-serif; padding: 2px;">
            <strong style="color: ${color}; text-transform: uppercase;">${r1} ↔ ${r2}</strong><br/>
            Status: ${linkInfo?.status || 'CONNECTED'}<br/>
            ${linkInfo?.latencyMs ? `Latency: ${linkInfo.latencyMs}ms` : ''}
          </div>
        `, {
          className: 'bg-white text-xs px-2.5 py-1.5 rounded-md text-slate-900 border border-slate-200 shadow-md'
        });

        linesLayerRef.current.addLayer(line);
      }
    }

    // B. Regional Hub Node Markers
    for (const r of regions) {
      const coord = REGION_COORDINATES[r];
      const isCurrent = r === currentRegion;
      const hubIcon = L.divIcon({
        className: 'custom-hub-icon',
        html: `
          <div style="
            background: ${isCurrent ? '#2563EB' : '#FFFFFF'};
            border: 2px solid ${isCurrent ? '#1D4ED8' : '#2563EB'};
            color: ${isCurrent ? '#FFFFFF' : '#2563EB'};
            width: 32px;
            height: 32px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            font-size: 12px;
            box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06);
          ">
            ${r[0].toUpperCase()}
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      const m = L.marker(coord, { icon: hubIcon });
      m.bindTooltip(`
        <div style="font-size: 11px;">
          <strong>Regional Node: ${r.toUpperCase()}</strong> ${isCurrent ? '(Active View)' : ''}<br/>
          Port: ${r === 'mumbai' ? 4001 : r === 'delhi' ? 4002 : 4003} · DB: data/${r}.db
        </div>
      `, {
        className: 'bg-white text-xs px-2 py-1 rounded text-slate-800 border border-slate-200 shadow-sm'
      });
      markersLayerRef.current.addLayer(m);
    }

    // C. Incident Markers
    for (const item of records) {
      const { entityId, op, indicators } = item;
      const rep = op?.payload;
      const lat = rep?.location?.lat;
      const lng = rep?.location?.lng;

      if (lat == null || lng == null) continue;

      const isConflict = indicators?.conflict?.status === 'Conflicting' || indicators?.conflict?.status?.includes('review');
      const isSynced = indicators?.replication?.syncedCount === 3;
      const isSelected = selectedRecordId === entityId;

      // Clean semantic colors: Red = Conflict, Green = Settled, Amber = Tentative
      const mainColor = isConflict ? '#B91C1C' : isSynced ? '#15803D' : '#B45309';
      const typeLabel = rep?.incidentType || op?.type || 'INCIDENT';

      const icon = L.divIcon({
        className: 'custom-incident-pin',
        html: `
          <div style="
            position: relative;
            width: ${isSelected ? '28px' : '24px'};
            height: ${isSelected ? '28px' : '24px'};
            background: #FFFFFF;
            border: 2.5px solid ${mainColor};
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 6px -1px rgba(0,0,0,0.15);
            cursor: pointer;
            transition: all 0.15s ease;
          ">
            <div style="
              width: 8px;
              height: 8px;
              border-radius: 50%;
              background: ${mainColor};
            "></div>
            ${isConflict ? `
              <div style="
                position: absolute;
                top: -3px;
                right: -3px;
                width: 8px;
                height: 8px;
                background: #B91C1C;
                border: 1px solid #FFFFFF;
                border-radius: 50%;
              "></div>
            ` : ''}
          </div>
        `,
        iconSize: [isSelected ? 28 : 24, isSelected ? 28 : 24],
        iconAnchor: [isSelected ? 14 : 12, isSelected ? 14 : 12]
      });

      const marker = L.marker([lat, lng], { icon });

      marker.on('click', () => {
        onSelectRecord(entityId);
      });

      marker.bindTooltip(`
        <div style="font-size: 11px; line-height: 1.4; color: #172033;">
          <div style="display: flex; align-items: center; gap: 4px; font-weight: bold; color: ${mainColor};">
            <span>●</span>
            <span style="text-transform: uppercase;">${typeLabel}</span>
          </div>
          <div style="color: #64748B; font-family: monospace; font-size: 10px;">${entityId}</div>
          <div style="margin-top: 2px;">Status: <strong>${indicators?.resolution?.status || 'Tentative'}</strong></div>
          <div style="color: #334155;">Replicated: <strong>${indicators?.replication?.syncedCount || 1}/3 regions</strong></div>
          <div style="color: #2563EB; font-size: 10px; margin-top: 3px; font-weight: 500;">Click to inspect SourceTrace →</div>
        </div>
      `, {
        className: 'bg-white text-xs px-2.5 py-1.5 rounded-lg text-slate-800 border border-slate-200 shadow-lg'
      });

      markersLayerRef.current.addLayer(marker);
    }

    // D. User Location Marker
    if (userLocation) {
      const userIcon = L.divIcon({
        className: 'user-pos-pin',
        html: `
          <div style="
            position: relative;
            width: 16px;
            height: 16px;
            background: #2563EB;
            border: 2.5px solid #FFFFFF;
            border-radius: 50%;
            box-shadow: 0 0 10px rgba(37,99,235,0.5);
          "></div>
        `,
        iconSize: [16, 16],
        iconAnchor: [8, 8]
      });
      const userMarker = L.marker([userLocation.lat, userLocation.lng], { icon: userIcon });
      userMarker.bindTooltip('<strong style="color: #2563EB;">Your Location / Field GPS</strong>', {
        className: 'bg-white text-xs px-2 py-1 rounded text-slate-800 border border-slate-200 shadow-sm'
      });
      markersLayerRef.current.addLayer(userMarker);
    }
  }, [records, regionStatus, currentRegion, userLocation, selectedRecordId]);

  const handleLandmarkSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const landmarkId = e.target.value;
    setSelectedLandmark(landmarkId);
    const landmark = gazetteerData.landmarks.find(l => l.id === landmarkId);
    if (landmark && mapInstanceRef.current) {
      mapInstanceRef.current.setView([landmark.lat, landmark.lng], 14, { animate: true });
      setUserLocation({ lat: landmark.lat, lng: landmark.lng });
    }
  };

  const handleCenterOnMe = () => {
    if (userLocation && mapInstanceRef.current) {
      mapInstanceRef.current.setView([userLocation.lat, userLocation.lng], 14, { animate: true });
    }
  };

  const handleResetView = () => {
    const center = REGION_COORDINATES[currentRegion] || [19.0760, 72.8777];
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView(center, currentRegion === 'mumbai' ? 12 : 11, { animate: true });
    }
  };

  return (
    <div className="relative w-full h-full flex flex-col bg-[#F8FAFC] overflow-hidden rounded-lg border border-[#E2E8F0]">
      {/* Top Floating Control Bar */}
      <div className="absolute top-3 left-3 right-3 z-[400] flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* Left: Landmark Selector */}
        <div className="bg-[#FFFFFF] border border-[#E2E8F0] p-1.5 px-3 rounded-lg flex items-center gap-2 pointer-events-auto shadow-sm">
          <MapPin size={14} className="text-[#2563EB] shrink-0" />
          <span className="text-xs font-semibold text-[#475569] hidden sm:inline">Scenario Landmark:</span>
          <select
            value={selectedLandmark}
            onChange={handleLandmarkSelect}
            className="bg-[#F8FAFC] text-xs text-[#172033] border border-[#E2E8F0] rounded px-2.5 py-1 outline-none focus:border-[#2563EB] transition-colors"
          >
            <option value="">-- Jump to Landmark --</option>
            {gazetteerData.landmarks.map(lm => (
              <option key={lm.id} value={lm.id}>
                {lm.name} ({lm.region.toUpperCase()})
              </option>
            ))}
          </select>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            onClick={handleCenterOnMe}
            className="bg-[#FFFFFF] hover:bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-[#334155] px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm transition-colors font-medium"
            title="Center map on current field location"
          >
            <Navigation size={13} className="text-[#2563EB]" />
            <span className="hidden sm:inline">GPS Pin</span>
          </button>

          <button
            onClick={handleResetView}
            className="bg-[#FFFFFF] hover:bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-[#334155] p-1.5 rounded-lg shadow-sm transition-colors"
            title="Reset region viewport"
          >
            <Compass size={14} className="text-[#64748B]" />
          </button>

          <button
            onClick={() => onReportHere(userLocation || { lat: 19.0688, lng: 72.8795, name: 'Kurla Pin' })}
            className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-xs px-3 py-1.5 rounded-lg shadow-sm flex items-center gap-1.5 transition-colors"
          >
            <MapPin size={13} />
            <span>Pin Report Here</span>
          </button>
        </div>
      </div>

      {/* Offline Notice */}
      {tileError && (
        <div className="absolute top-14 left-3 right-3 z-[400] bg-amber-50 border border-amber-200 text-amber-800 text-xs px-3 py-2 rounded-md flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <Info size={14} className="shrink-0" />
            <span>Map tile server offline. Vector markers and regional node links remain active from live SQLite backend.</span>
          </div>
          <button onClick={() => setTileError(false)} className="text-amber-800 font-bold ml-2">✕</button>
        </div>
      )}

      {/* Floating Bottom-Left Legend */}
      {showLegend && (
        <div className="absolute bottom-3 left-3 z-[400] bg-[#FFFFFF] border border-[#E2E8F0] p-3 rounded-lg shadow-md text-xs space-y-2 pointer-events-auto max-w-[260px]">
          <div className="flex items-center justify-between text-[#172033] font-semibold border-b border-[#E2E8F0] pb-1.5">
            <span className="flex items-center gap-1.5 text-xs">
              <Layers size={13} className="text-[#2563EB]" />
              Legend
            </span>
            <button onClick={() => setShowLegend(false)} className="text-[#64748B] hover:text-[#0F172A]">✕</button>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px] text-[#475569]">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#15803D] border border-white shrink-0"></span>
              <span>Settled (3/3)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#B45309] border border-white shrink-0"></span>
              <span>Tentative</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#B91C1C] border border-white shrink-0"></span>
              <span>Contradiction</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#2563EB] border border-white shrink-0"></span>
              <span>Field Pin</span>
            </div>
          </div>

          <div className="border-t border-[#E2E8F0] pt-1.5 text-[10px] text-[#64748B] flex items-center justify-between">
            <span className="flex items-center gap-1">
              <span className="w-3.5 h-0.5 bg-[#2563EB] inline-block"></span> Connected Link
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3.5 h-0.5 bg-[#B91C1C] border-dashed inline-block"></span> Partition Cut
            </span>
          </div>
        </div>
      )}

      {/* Actual Map Canvas */}
      <div 
        ref={mapContainerRef} 
        id="verdict-map-canvas"
        className="w-full h-full min-h-[400px] relative z-0" 
      />
    </div>
  );
};
