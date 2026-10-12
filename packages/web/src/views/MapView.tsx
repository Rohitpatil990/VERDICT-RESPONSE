import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import L from 'leaflet';
import { api, Region } from '../api/client.js';
import { MapPin, Navigation, Eye, AlertTriangle, ShieldCheck, Layers, Plus } from 'lucide-react';
import gazetteerData from '../../../../assets/seed_gazetteer.json';

interface MapViewProps {
  viewingRegion: Region;
  onSelectEntity: (id: string) => void;
  selectedEntityId: string | null;
}

export const MapView: React.FC<MapViewProps> = ({
  viewingRegion,
  onSelectEntity,
  selectedEntityId
}) => {
  const { t } = useTranslation();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const fogLayersRef = useRef<L.LayerGroup | null>(null);
  const linkLinesRef = useRef<L.LayerGroup | null>(null);

  const [entities, setEntities] = useState<any[]>([]);
  const [fogData, setFogData] = useState<any[]>([]);
  const [simLocation, setSimLocation] = useState<string>('loc-kurla-r7');
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [newReportText, setNewReportText] = useState('');
  const [newReportStatus, setNewReportStatus] = useState('BLOCKED');
  const [nearbyOpen, setNearbyOpen] = useState(false);
  const [nearbyList, setNearbyList] = useState<any[]>([]);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [19.0760, 72.8777], // Mumbai disaster center
      zoom: 12,
      zoomControl: false
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // OpenStreetMap dark styled tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '© OpenStreetMap contributors | VERDICT Simulation',
      className: 'dark-tiles'
    }).addTo(map);

    fogLayersRef.current = L.layerGroup().addTo(map);
    linkLinesRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Fetch map entities and fog data
  const loadMapData = async () => {
    try {
      const [mapRes, fogRes] = await Promise.all([
        api.getMap(viewingRegion),
        api.getFog(viewingRegion)
      ]);
      setEntities(mapRes.entities || []);
      setFogData(fogRes.fog || []);
    } catch (err) {
      console.error('Failed loading map data:', err);
    }
  };

  useEffect(() => {
    loadMapData();
    const interval = setInterval(loadMapData, 2000);
    return () => clearInterval(interval);
  }, [viewingRegion]);

  // Update Markers on map
  useEffect(() => {
    if (!mapRef.current) return;

    // Clear old markers
    for (const marker of markersRef.current.values()) {
      marker.remove();
    }
    markersRef.current.clear();

    for (const ent of entities) {
      const rep = ent.attributes?.reports?.[0];
      const lat = rep?.location?.lat || 19.076;
      const lng = rep?.location?.lng || 72.877;

      const isConflict = ent.conflict?.status === 'AWAITING_REVIEW';
      const isRoad = ent.type === 'road';
      const isIncident = ent.type === 'incident';
      const isBlocked = ent.status === 'BLOCKED';

      const color = isConflict
        ? '#F87171' // Rose
        : isBlocked
        ? '#F87171'
        : ent.status === 'OPEN' || ent.status === 'Resolved'
        ? '#4FD1B5' // Teal
        : '#F6C26B'; // Amber

      const iconHtml = `
        <div style="
          background-color: ${color};
          width: 28px;
          height: 28px;
          border-radius: ${isRoad ? '6px' : '50%'};
          border: 2px solid ${isConflict ? '#FFF' : '#111A2E'};
          display: flex;
          align-items: center;
          justify-content: center;
          color: #0B1220;
          font-weight: bold;
          font-size: 11px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.5);
          ${isConflict ? 'outline: 2px solid #F87171; outline-offset: 2px;' : ''}
        ">
          ${isRoad ? 'R' : isIncident ? '!' : 'S'}
        </div>
      `;

      const customIcon = L.divIcon({
        html: iconHtml,
        className: 'verdict-marker',
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });

      const marker = L.marker([lat, lng], { icon: customIcon }).addTo(mapRef.current);
      marker.on('click', () => {
        onSelectEntity(ent.entityId);
      });

      markersRef.current.set(ent.entityId, marker);
    }
  }, [entities, onSelectEntity]);

  // Render Fog Layers with Hatch Pattern
  useEffect(() => {
    if (!mapRef.current || !fogLayersRef.current) return;
    fogLayersRef.current.clearLayers();

    const regionCoords: Record<string, [number, number]> = {
      mumbai: [19.0760, 72.8777],
      delhi: [28.6139, 77.2090],
      bengaluru: [12.9716, 77.5946]
    };

    for (const fog of fogData) {
      const coords = regionCoords[fog.region];
      if (coords && fog.unreachable) {
        // Draw fog circle with hatch pattern representation
        const fogCircle = L.circle(coords, {
          radius: 55000,
          color: '#94A3B8',
          weight: 2,
          dashArray: '6, 6',
          fillColor: '#475569',
          fillOpacity: Math.min(0.85, fog.fogIntensity || 0.5)
        }).addTo(fogLayersRef.current);

        fogCircle.bindTooltip(
          `<div class="p-2 bg-slate-900 border border-slate-700 text-xs text-slate-200">
            <strong>${fog.legendText}</strong><br/>
            <span class="text-[11px] text-slate-400">No updates accepted from here during partition.</span>
          </div>`,
          { sticky: true }
        );
      }
    }
  }, [fogData]);

  // Load nearby entities
  const handleNearby = async () => {
    try {
      const selectedGaz = gazetteerData.gazetteer.find(g => g.id === simLocation);
      const lat = selectedGaz ? selectedGaz.lat : 19.076;
      const lng = selectedGaz ? selectedGaz.lng : 72.877;
      const res = await fetch(`http://127.0.0.1:4001/api/v1/nearby?lat=${lat}&lng=${lng}`);
      const list = await res.json();
      setNearbyList(list.slice(0, 10));
      setNearbyOpen(true);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSimLocationChange = (locId: string) => {
    setSimLocation(locId);
    const loc = gazetteerData.gazetteer.find(g => g.id === locId);
    if (loc && mapRef.current) {
      mapRef.current.flyTo([loc.lat, loc.lng], 13, { duration: 1 });
    }
  };

  const handleSubmitNewReport = async () => {
    try {
      const selectedGaz = gazetteerData.gazetteer.find(g => g.id === simLocation);
      await api.submitReport(
        {
          entityId: `access-corridor-north`,
          incidentType: 'route_condition',
          description: newReportText || 'Field report from mobile unit',
          status: newReportStatus,
          location: {
            lat: selectedGaz?.lat || 19.0688,
            lng: selectedGaz?.lng || 72.8800,
            source: 'SIMULATED'
          },
          authorId: `agent-${viewingRegion}`,
          authorRole: viewingRegion === 'delhi' ? 'OFFICIAL' : 'FIELD_OFFICER',
          authority: 'mumbai'
        },
        viewingRegion
      );
      setReportModalOpen(false);
      setNewReportText('');
      loadMapData();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="relative w-full h-full flex overflow-hidden">
      {/* Map Canvas */}
      <div ref={mapContainerRef} className="flex-1 w-full h-full" />

      {/* Top Controls Overlay */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
        {/* Simulated Location Selector */}
        <div className="bg-surface/90 backdrop-blur border border-border px-3 py-1.5 rounded flex items-center gap-2 shadow-lg text-xs">
          <Navigation className="w-4 h-4 text-tealVerdict" />
          <span className="text-slate-400">Location:</span>
          <select
            value={simLocation}
            onChange={e => handleSimLocationChange(e.target.value)}
            className="bg-transparent text-slate-100 font-medium focus:outline-none cursor-pointer"
          >
            {gazetteerData.gazetteer.map(g => (
              <option key={g.id} value={g.id} className="bg-slate-900 text-slate-100">
                {g.name} ({g.region.toUpperCase()})
              </option>
            ))}
          </select>
        </div>

        {/* Nearby Action */}
        <button
          onClick={handleNearby}
          className="bg-surface/90 backdrop-blur border border-border hover:border-tealVerdict px-3 py-1.5 rounded flex items-center gap-1.5 shadow-lg text-xs font-semibold text-slate-200 transition"
        >
          <MapPin className="w-3.5 h-3.5 text-tealVerdict" />
          Nearby
        </button>

        {/* Report Here Action */}
        <button
          onClick={() => setReportModalOpen(true)}
          className="bg-tealVerdict text-slate-900 px-3 py-1.5 rounded flex items-center gap-1.5 shadow-lg text-xs font-bold hover:bg-teal-400 transition"
        >
          <Plus className="w-3.5 h-3.5 stroke-[3]" />
          Report Here
        </button>
      </div>

      {/* Fog Status Chip (if any unreachable region) */}
      {fogData.some(f => f.unreachable) && (
        <div className="absolute top-4 right-4 z-10 bg-slate-900/90 border border-slate-700 px-3 py-2 rounded shadow-xl text-xs max-w-sm">
          <div className="flex items-center gap-2 text-slate-300 font-semibold mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-400 animate-pulse" />
            {fogData.find(f => f.unreachable)?.legendText}
          </div>
          <p className="text-[11px] text-slate-400 leading-snug">
            Fog = no recent updates from this region. It does not mean nothing is happening there.
          </p>
        </div>
      )}

      {/* Nearby Drawer */}
      {nearbyOpen && (
        <div className="absolute top-16 left-4 z-10 w-80 bg-surface border border-border rounded shadow-2xl p-4 max-h-[70vh] flex flex-col">
          <div className="flex items-center justify-between border-b border-border pb-2 mb-3">
            <span className="text-xs font-bold uppercase text-slate-300">
              Nearby Entities (True Haversine)
            </span>
            <button
              onClick={() => setNearbyOpen(false)}
              className="text-xs text-slate-400 hover:text-slate-100"
            >
              ✕
            </button>
          </div>
          <div className="overflow-y-auto space-y-2 flex-1">
            {nearbyList.map(item => (
              <div
                key={item.entityId}
                onClick={() => {
                  onSelectEntity(item.entityId);
                  setNearbyOpen(false);
                }}
                className="p-2 rounded bg-background hover:border-tealVerdict border border-border cursor-pointer transition text-xs space-y-0.5"
              >
                <div className="flex justify-between font-medium text-slate-200">
                  <span>{item.attributes?.reports?.[0]?.name || item.entityId}</span>
                  <span className="font-mono text-tealVerdict">{item.distanceKm} km</span>
                </div>
                <div className="text-[11px] text-slate-400">
                  Status: <span className="font-semibold text-slate-300">{item.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* New Report Modal */}
      {reportModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-lg p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-slate-100">
              Submit Observation Report ({viewingRegion.toUpperCase()})
            </h3>
            <p className="text-xs text-slate-400">
              Signed with local Ed25519 key. Replicated via outbox to connected peers.
            </p>

            <div className="space-y-1">
              <label className="text-xs text-slate-300">Target Entity</label>
              <div className="text-xs font-mono bg-background p-2 rounded border border-border text-slate-200">
                access-corridor-north (Primary Supply Route)
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-300">Claimed Road Status</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setNewReportStatus('OPEN')}
                  className={`flex-1 py-1.5 rounded text-xs font-semibold border ${
                    newReportStatus === 'OPEN'
                      ? 'bg-tealVerdict/20 text-tealVerdict border-tealVerdict'
                      : 'bg-background text-slate-400 border-border'
                  }`}
                >
                  OPEN
                </button>
                <button
                  type="button"
                  onClick={() => setNewReportStatus('BLOCKED')}
                  className={`flex-1 py-1.5 rounded text-xs font-semibold border ${
                    newReportStatus === 'BLOCKED'
                      ? 'bg-roseVerdict/20 text-roseVerdict border-roseVerdict'
                      : 'bg-background text-slate-400 border-border'
                  }`}
                >
                  BLOCKED
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-300">Observation Notes</label>
              <textarea
                value={newReportText}
                onChange={e => setNewReportText(e.target.value)}
                placeholder="Field observations, flood water depth, obstacle status..."
                rows={3}
                className="w-full bg-background border border-border rounded p-2 text-xs text-slate-100 focus:outline-none focus:border-tealVerdict"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setReportModalOpen(false)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitNewReport}
                className="px-4 py-1.5 bg-tealVerdict text-slate-900 rounded text-xs font-bold hover:bg-teal-400 transition"
              >
                Sign & Submit Op
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
