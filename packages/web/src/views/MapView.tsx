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

    // Clean Light tile layer (OpenStreetMap standard light)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | VERDICT Response'
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
      setEntities(mapRes?.entities || []);
      setFogData(fogRes?.fog || []);
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
      const isBlocked = ent.status === 'BLOCKED';

      const bgColor = isConflict
        ? '#B45309' // Warning amber
        : isBlocked
        ? '#B91C1C' // Error red
        : '#15803D'; // Green

      const iconHtml = `
        <div style="
          background-color: ${bgColor};
          width: 26px;
          height: 26px;
          border-radius: ${isRoad ? '6px' : '50%'};
          border: 2px solid #FFFFFF;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #FFFFFF;
          font-weight: 600;
          font-size: 11px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.15);
          cursor: pointer;
          ${isConflict ? 'box-shadow: 0 0 0 2px #FDE68A, 0 2px 4px rgba(0,0,0,0.2);' : ''}
        ">
          ${isRoad ? 'R' : isConflict ? '!' : 'S'}
        </div>
      `;

      const customIcon = L.divIcon({
        html: iconHtml,
        className: 'verdict-marker',
        iconSize: [26, 26],
        iconAnchor: [13, 13]
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
          `<div class="p-2 bg-white border border-slate-200 text-xs text-slate-800 shadow-sm rounded">
            <strong>${fog.legendText}</strong><br/>
            <span class="text-[11px] text-slate-500">No updates accepted from here during partition.</span>
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
      const res = await api.readWithFailover(`/api/v1/nearby?lat=${lat}&lng=${lng}`, viewingRegion);
      const list = Array.isArray(res) ? res : [];
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
    <div className="relative w-full h-full flex overflow-hidden bg-slate-100">
      {/* Map Canvas */}
      <div ref={mapContainerRef} className="flex-1 w-full h-full" />

      {/* Top Controls Overlay */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
        {/* Simulated Location Selector */}
        <div className="bg-surface border border-border px-3 py-1.5 rounded-md flex items-center gap-2 shadow-card text-xs">
          <Navigation className="w-3.5 h-3.5 text-primaryAction" />
          <span className="text-secondaryText text-[11px] font-medium">Location:</span>
          <select
            value={simLocation}
            onChange={e => handleSimLocationChange(e.target.value)}
            className="bg-transparent text-primaryText font-semibold focus:outline-none cursor-pointer"
          >
            {gazetteerData.gazetteer.map(g => (
              <option key={g.id} value={g.id}>
                {g.name} ({g.region.toUpperCase()})
              </option>
            ))}
          </select>
        </div>

        {/* Nearby Action */}
        <button
          onClick={handleNearby}
          className="bg-surface border border-border hover:border-slate-300 px-3 py-1.5 rounded-md flex items-center gap-1.5 shadow-card text-xs font-medium text-primaryText transition"
        >
          <MapPin className="w-3.5 h-3.5 text-secondaryText" />
          Nearby
        </button>

        {/* Report Here Action */}
        <button
          onClick={() => setReportModalOpen(true)}
          className="bg-primaryAction hover:bg-primaryActionHover text-white px-3 py-1.5 rounded-md flex items-center gap-1.5 shadow-card text-xs font-medium transition"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          Submit Report
        </button>
      </div>

      {/* Fog Status Chip (if any unreachable region) */}
      {fogData.some(f => f.unreachable) && (
        <div className="absolute top-4 right-4 z-10 bg-surface border border-border px-3 py-2 rounded-md shadow-card text-xs max-w-sm">
          <div className="flex items-center gap-2 text-primaryText font-semibold mb-0.5">
            <span className="w-2 h-2 rounded-full bg-slate-400" />
            {fogData.find(f => f.unreachable)?.legendText}
          </div>
          <p className="text-[11px] text-secondaryText leading-snug">
            Fog = no recent updates from partitioned region.
          </p>
        </div>
      )}

      {/* Nearby Drawer */}
      {nearbyOpen && (
        <div className="absolute top-16 left-4 z-10 w-80 bg-surface border border-border rounded-md shadow-panel p-4 max-h-[70vh] flex flex-col">
          <div className="flex items-center justify-between border-b border-border pb-2 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-secondaryText">
              Nearby Entities (True Haversine)
            </span>
            <button
              onClick={() => setNearbyOpen(false)}
              className="text-xs text-secondaryText hover:text-primaryText font-bold"
            >
              ✕
            </button>
          </div>
          <div className="overflow-y-auto space-y-1.5 flex-1">
            {nearbyList.map(item => (
              <div
                key={item.entityId}
                onClick={() => {
                  onSelectEntity(item.entityId);
                  setNearbyOpen(false);
                }}
                className="p-2.5 rounded-md hover:bg-slate-50 border border-border cursor-pointer transition text-xs space-y-0.5"
              >
                <div className="flex justify-between font-medium text-primaryText">
                  <span>{item.attributes?.reports?.[0]?.name || item.entityId}</span>
                  <span className="font-mono text-tealVerdict font-semibold">{item.distanceKm} km</span>
                </div>
                <div className="text-[11px] text-secondaryText">
                  Status: <span className="font-semibold text-primaryText">{item.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* New Report Modal */}
      {reportModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-lg p-6 max-w-md w-full shadow-panel space-y-4">
            <div>
              <h3 className="text-sm font-bold text-primaryText">
                Submit Observation Report ({viewingRegion.toUpperCase()})
              </h3>
              <p className="text-xs text-secondaryText mt-0.5">
                Signed with local Ed25519 key. Replicated via durable outbox.
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-secondaryText font-medium">Target Entity</label>
              <div className="text-xs font-mono bg-slate-50 p-2 rounded-md border border-border text-primaryText">
                access-corridor-north (Primary Supply Route)
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-secondaryText font-medium">Observed Status</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setNewReportStatus('OPEN')}
                  className={`flex-1 py-1.5 rounded-md text-xs font-semibold border transition ${
                    newReportStatus === 'OPEN'
                      ? 'bg-green-50 text-success border-green-300'
                      : 'bg-white text-secondaryText border-border hover:bg-slate-50'
                  }`}
                >
                  OPEN
                </button>
                <button
                  type="button"
                  onClick={() => setNewReportStatus('BLOCKED')}
                  className={`flex-1 py-1.5 rounded-md text-xs font-semibold border transition ${
                    newReportStatus === 'BLOCKED'
                      ? 'bg-red-50 text-error border-red-300'
                      : 'bg-white text-secondaryText border-border hover:bg-slate-50'
                  }`}
                >
                  BLOCKED
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-secondaryText font-medium">Field Observation Note</label>
              <input
                type="text"
                placeholder="e.g. Route inspected, passable with light escort"
                value={newReportText}
                onChange={e => setNewReportText(e.target.value)}
                className="w-full text-xs p-2.5 rounded-md bg-white border border-border text-primaryText focus:outline-none focus:border-primaryAction"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setReportModalOpen(false)}
                className="px-3 py-1.5 border border-border rounded-md text-xs font-medium text-secondaryText hover:text-primaryText"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitNewReport}
                className="px-4 py-1.5 bg-primaryAction hover:bg-primaryActionHover text-white rounded-md text-xs font-semibold shadow-subtle"
              >
                Sign & Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
