import React, { useEffect, useState, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { JAIPUR_CENTER, JAIPUR_BOUNDS, JAIPUR_ZOOM } from '../utils/jaipurLocations';

// ── Fix Leaflet default icons ──────────────────────────────────────────
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// ── Custom Map Icons ───────────────────────────────────────────────────
const createPinIcon = (bg, emoji, size = 40) => L.divIcon({
  className: '',
  html: `
    <div style="position:relative;width:${size}px;height:${size + 10}px;">
      <div style="
        width:${size}px;height:${size}px;background:${bg};
        border-radius:50% 50% 50% 0;transform:rotate(-45deg);
        display:flex;align-items:center;justify-content:center;
        border:3px solid white;box-shadow:0 4px 14px rgba(0,0,0,0.35);
      ">
        <span style="transform:rotate(45deg);font-size:${size * 0.42}px;line-height:1;">${emoji}</span>
      </div>
      <div style="
        position:absolute;bottom:0;left:50%;transform:translateX(-50%);
        width:8px;height:8px;background:${bg};border-radius:50%;
        box-shadow:0 2px 6px rgba(0,0,0,0.3);
      "></div>
    </div>`,
  iconSize: [size, size + 10],
  iconAnchor: [size / 2, size + 10],
  popupAnchor: [0, -(size + 10)],
});

const createCarIcon = () => L.divIcon({
  className: '',
  html: `
    <div style="
      width:46px;height:46px;background:linear-gradient(135deg,#f5a623,#e8950f);
      border-radius:50%;display:flex;align-items:center;justify-content:center;
      border:3px solid white;
      box-shadow:0 0 0 4px rgba(245,166,35,0.3),0 4px 16px rgba(245,166,35,0.5);
      animation:carPulse 2s ease-in-out infinite;
    ">
      <span style="font-size:22px;">🚕</span>
    </div>
    <style>
      @keyframes carPulse {
        0%,100%{box-shadow:0 0 0 4px rgba(245,166,35,0.3),0 4px 16px rgba(245,166,35,0.5)}
        50%{box-shadow:0 0 0 10px rgba(245,166,35,0.1),0 4px 20px rgba(245,166,35,0.7)}
      }
    </style>`,
  iconSize: [46, 46],
  iconAnchor: [23, 23],
  popupAnchor: [0, -28],
});

export const pickupIcon      = createPinIcon('#1a1a2e', '🟢', 42);
export const destinationIcon = createPinIcon('#e94560', '🏁', 42);
export const driverIcon      = createCarIcon();

// ── Fit map bounds around all markers ─────────────────────────────────
function FitMapBounds({ positions }) {
  const map = useMap();
  const prevKey = useRef('');

  useEffect(() => {
    if (!positions || positions.length < 2) return;
    const key = positions.map(p => `${p[0].toFixed(4)},${p[1].toFixed(4)}`).join('|');
    if (key === prevKey.current) return;
    prevKey.current = key;

    try {
      const bounds = L.latLngBounds(positions);
      map.fitBounds(bounds, { padding: [70, 70], maxZoom: 16, animate: true, duration: 1.5 });
    } catch {}
  }, [positions, map]);

  return null;
}

// ── Fly to single point ────────────────────────────────────────────────
function FlyTo({ position }) {
  const map = useMap();
  const prevPos = useRef('');
  useEffect(() => {
    if (!position) return;
    const key = position.join(',');
    if (key === prevPos.current) return;
    prevPos.current = key;
    map.flyTo(position, 15, { animate: true, duration: 1.4 });
  }, [position, map]);
  return null;
}

// ── OSRM routing with multiple server fallbacks ────────────────────────
const OSRM_SERVERS = [
  'https://router.project-osrm.org',
  'https://routing.openstreetmap.de/routed-car',
];

async function fetchRoadRoute(fromLat, fromLng, toLat, toLng) {
  for (const server of OSRM_SERVERS) {
    try {
      const url =
        `${server}/route/v1/driving/` +
        `${fromLng},${fromLat};${toLng},${toLat}` +
        `?overview=full&geometries=geojson&steps=true&annotations=false`;

      const res  = await fetch(url, { signal: AbortSignal.timeout(8000) });
      const json = await res.json();

      if (json.code === 'Ok' && json.routes?.length) {
        const route = json.routes[0];
        const coords = route.geometry.coordinates; // [lng,lat] → flip

        // Extract clean turn-by-turn steps
        const steps = (route.legs[0]?.steps || [])
          .filter(s => s.maneuver?.type !== 'depart' || steps?.length === 0)
          .map(s => ({
            instruction: formatInstruction(s),
            distance: s.distance < 1000
              ? `${Math.round(s.distance)} m`
              : `${(s.distance / 1000).toFixed(1)} km`,
            type: s.maneuver?.type,
            modifier: s.maneuver?.modifier,
          }))
          .filter(s => s.instruction);

        return {
          path:     coords.map(([lng, lat]) => [lat, lng]),
          distance: (route.distance / 1000).toFixed(1),
          duration: Math.round(route.duration / 60),
          steps,
        };
      }
    } catch { /* try next server */ }
  }
  return null;
}

function formatInstruction(step) {
  const type = step.maneuver?.type;
  const mod  = step.maneuver?.modifier;
  const name = step.name || step.ref || '';
  const road = name ? ` onto ${name}` : '';

  const map = {
    'depart':          `🚦 Start${road}`,
    'arrive':          `🏁 Arrive at destination`,
    'turn':            mod === 'left' ? `↰ Turn left${road}`
                     : mod === 'right' ? `↱ Turn right${road}`
                     : mod === 'slight left' ? `↖ Slight left${road}`
                     : mod === 'slight right' ? `↗ Slight right${road}`
                     : mod === 'sharp left' ? `⬅ Sharp left${road}`
                     : mod === 'sharp right' ? `➡ Sharp right${road}`
                     : `↕ Turn${road}`,
    'new name':        `➡ Continue${road}`,
    'continue':        `⬆ Continue${road}`,
    'merge':           `↗ Merge${road}`,
    'on ramp':         `↗ Take ramp${road}`,
    'off ramp':        `↘ Take exit${road}`,
    'fork':            mod?.includes('left') ? `↖ Keep left${road}` : `↗ Keep right${road}`,
    'end of road':     mod?.includes('left') ? `↰ Turn left at end${road}` : `↱ Turn right at end${road}`,
    'roundabout':      `🔄 Enter roundabout`,
    'rotary':          `🔄 Enter rotary`,
    'roundabout turn': `🔄 At roundabout, take exit`,
    'use lane':        `🛣️ Use lane${road}`,
  };

  return map[type] || (type ? `⬆ ${type}${road}` : null);
}

// ── Animated route draw ────────────────────────────────────────────────
function AnimatedRoute({ path, color, weight, opacity }) {
  const [visiblePath, setVisiblePath] = useState([]);
  const prevPath = useRef('');

  useEffect(() => {
    if (!path?.length) { setVisiblePath([]); return; }
    const key = `${path[0]}-${path[path.length - 1]}-${path.length}`;
    if (key === prevPath.current) return;
    prevPath.current = key;

    setVisiblePath([]);
    let i = 0;
    // Draw route progressively — faster for longer routes
    const step = Math.max(1, Math.floor(path.length / 120));
    const interval = setInterval(() => {
      i += step;
      if (i >= path.length) {
        setVisiblePath(path);
        clearInterval(interval);
      } else {
        setVisiblePath(path.slice(0, i));
      }
    }, 12);
    return () => clearInterval(interval);
  }, [path]);

  if (visiblePath.length < 2) return null;
  return (
    <>
      {/* Shadow/outline */}
      <Polyline positions={visiblePath} color="#000" weight={weight + 4} opacity={0.12} />
      {/* Main route */}
      <Polyline positions={visiblePath} color={color}  weight={weight}     opacity={opacity} />
      {/* Glow */}
      <Polyline positions={visiblePath} color={color}  weight={weight - 2} opacity={0.4}
        pathOptions={{ dashArray: '1,10', lineCap: 'round' }} />
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════
// Main Map Component
// ══════════════════════════════════════════════════════════════════════
export default function JaipurMap({
  pickup, destination, driverLocation,
  height = '100%', flyTo, onRouteReady,
}) {
  const [route, setRoute]         = useState(null);
  const [loading, setLoading]     = useState(false);
  const [showSteps, setShowSteps] = useState(false);
  const routeKey = useRef('');

  const loadRoute = useCallback(async () => {
    if (!pickup || !destination) { setRoute(null); return; }

    const key = `${pickup.lat.toFixed(5)},${pickup.lng.toFixed(5)}-${destination.lat.toFixed(5)},${destination.lng.toFixed(5)}`;
    if (key === routeKey.current) return;
    routeKey.current = key;

    setLoading(true);
    setRoute(null);
    const result = await fetchRoadRoute(pickup.lat, pickup.lng, destination.lat, destination.lng);
    setRoute(result);
    if (result && onRouteReady) onRouteReady(result);
    setLoading(false);
  }, [pickup, destination, onRouteReady]);

  useEffect(() => { loadRoute(); }, [loadRoute]);

  // Positions for FitBounds
  const boundPositions = [
    pickup       && [pickup.lat,       pickup.lng],
    destination  && [destination.lat,  destination.lng],
    driverLocation && [driverLocation.lat, driverLocation.lng],
  ].filter(Boolean);

  return (
    <div style={{ position: 'relative', height, width: '100%' }}>

      {/* ── Turn-by-Turn Panel ── */}
      {route?.steps?.length > 0 && (
        <div style={{
          position: 'absolute', top: 12, right: 12, zIndex: 1100,
          width: showSteps ? 280 : 'auto',
          background: 'rgba(13,13,26,0.95)', backdropFilter: 'blur(10px)',
          border: '1px solid #2d3748', borderRadius: 14,
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          overflow: 'hidden', maxHeight: showSteps ? 380 : 'auto',
          transition: 'all 0.3s ease',
        }}>
          {/* Header */}
          <div
            onClick={() => setShowSteps(s => !s)}
            style={{
              padding: '10px 14px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 8,
              borderBottom: showSteps ? '1px solid #2d3748' : 'none',
            }}
          >
            <span style={{ fontSize: 16 }}>🗺️</span>
            <div style={{ flex: 1, lineHeight: 1.3 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>
                {route.distance} km • ~{route.duration} min
              </div>
              {!showSteps && (
                <div style={{ fontSize: 11, color: '#a0aec0' }}>
                  {route.steps.length} turns • tap for directions
                </div>
              )}
            </div>
            <span style={{ fontSize: 12, color: '#e94560', fontWeight: 600 }}>
              {showSteps ? '▲ Hide' : '▼ Directions'}
            </span>
          </div>

          {/* Steps */}
          {showSteps && (
            <div style={{ overflowY: 'auto', maxHeight: 310, padding: '6px 0' }}>
              {route.steps.map((step, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '8px 14px',
                  borderBottom: i < route.steps.length - 1 ? '1px solid rgba(45,55,72,0.5)' : 'none',
                  background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: '50%',
                    background: i === route.steps.length - 1 ? '#e94560' : '#0f3460',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0, marginTop: 1,
                  }}>{i + 1}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: '#e2e8f0', lineHeight: 1.4 }}>
                      {step.instruction}
                    </div>
                    <div style={{ fontSize: 11, color: '#718096', marginTop: 2 }}>
                      {step.distance}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Loading indicator ── */}
      {loading && (
        <div style={{
          position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(13,13,26,0.92)', border: '1px solid #e94560',
          borderRadius: 20, padding: '7px 18px', zIndex: 1100,
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 12, color: '#fff', fontFamily: 'Poppins, sans-serif',
          boxShadow: '0 4px 16px rgba(233,69,96,0.3)',
        }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%', background: '#e94560',
            animation: 'routePulse 0.8s ease-in-out infinite',
          }} />
          Mapping road route...
        </div>
      )}

      {/* ── Map ── */}
      <MapContainer
        center={JAIPUR_CENTER}
        zoom={JAIPUR_ZOOM}
        maxBounds={JAIPUR_BOUNDS}
        maxBoundsViscosity={0.9}
        minZoom={11}
        maxZoom={19}
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
      >
        {/* Crisp map tiles */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />

        {/* Animated road route */}
        {route?.path?.length > 1 && (
          <AnimatedRoute
            path={route.path}
            color="#e94560"
            weight={6}
            opacity={0.92}
          />
        )}

        {/* Pickup */}
        {pickup && (
          <Marker position={[pickup.lat, pickup.lng]} icon={pickupIcon}>
            <Popup>
              <div style={{ fontFamily: 'Poppins,sans-serif', minWidth: 160 }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>📍 Pickup Point</div>
                <div style={{ fontSize: 13, color: '#555' }}>{pickup.address}</div>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Destination */}
        {destination && (
          <Marker position={[destination.lat, destination.lng]} icon={destinationIcon}>
            <Popup>
              <div style={{ fontFamily: 'Poppins,sans-serif', minWidth: 160 }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>🏁 Destination</div>
                <div style={{ fontSize: 13, color: '#555' }}>{destination.address}</div>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Driver */}
        {driverLocation && (
          <Marker position={[driverLocation.lat, driverLocation.lng]} icon={driverIcon}>
            <Popup>
              <div style={{ fontFamily: 'Poppins,sans-serif' }}>
                <div style={{ fontWeight: 700 }}>🚕 Your Driver</div>
                <div style={{ fontSize: 12, color: '#666' }}>On the way!</div>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Auto-fit bounds when both points exist */}
        {boundPositions.length >= 2 && <FitMapBounds positions={boundPositions} />}

        {/* Fly to single point */}
        {flyTo && boundPositions.length < 2 && <FlyTo position={flyTo} />}
      </MapContainer>

      <style>{`
        @keyframes routePulse {
          0%,100% { opacity:1; transform:scale(1); }
          50%      { opacity:0.4; transform:scale(1.4); }
        }
      `}</style>
    </div>
  );
}
