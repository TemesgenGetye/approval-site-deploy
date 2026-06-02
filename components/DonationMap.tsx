"use client";

import { useEffect, useState } from "react";
import { MapPin, Navigation, ExternalLink } from "lucide-react";

interface DonationMapProps {
  address: string;
  title?: string;
}

interface LatLng {
  lat: number;
  lng: number;
}

export default function DonationMap({ address, title }: DonationMapProps) {
  const [coords, setCoords] = useState<LatLng | null>(null);
  const [userPos, setUserPos] = useState<LatLng | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  // Geocode the address via Nominatim (free, no API key needed)
  useEffect(() => {
    let cancelled = false;
    fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`,
      { headers: { "Accept-Language": "en" } }
    )
      .then((r) => r.json())
      .then((data: any[]) => {
        if (cancelled) return;
        if (data?.length > 0) {
          setCoords({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) });
          setStatus("ready");
        } else {
          setStatus("error");
        }
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => { cancelled = true; };
  }, [address]);

  // Get user's current location for directions (best effort)
  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { timeout: 8000, enableHighAccuracy: false }
    );
  }, []);

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center h-48 bg-slate-50 rounded-xl border border-slate-200">
        <p className="text-sm text-slate-400">Loading map...</p>
      </div>
    );
  }

  if (status === "error" || !coords) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-col items-center gap-3">
          <p className="text-sm text-slate-500 flex items-center gap-1.5">
            <MapPin className="h-4 w-4 shrink-0" />
            {address}
          </p>
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs font-medium transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            View on Google Maps
          </a>
        </div>
      </div>
    );
  }

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.lng}`;
  const directionsUrl = userPos
    ? `https://www.google.com/maps/dir/?api=1&origin=${userPos.lat},${userPos.lng}&destination=${coords.lat},${coords.lng}`
    : null;

  const embedUrl =
    `https://www.openstreetmap.org/export/embed.html` +
    `?bbox=${coords.lng - 0.02},${coords.lat - 0.02},${coords.lng + 0.02},${coords.lat + 0.02}` +
    `&layer=mapnik` +
    `&marker=${coords.lat},${coords.lng}`;

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      {/* OSM embed map */}
      <div className="relative w-full" style={{ height: 220 }}>
        <iframe
          title={title || "Location map"}
          width="100%"
          height="100%"
          style={{ border: 0 }}
          loading="lazy"
          src={embedUrl}
        />
      </div>

      {/* Bottom bar: address + action links */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-t border-slate-100 bg-slate-50/50">
        <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
        <span className="text-xs text-slate-600 truncate flex-1">{address}</span>
        <div className="flex items-center gap-1.5 shrink-0">
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors"
          >
            <ExternalLink className="h-3 w-3" />
            View
          </a>
          {directionsUrl && (
            <a
              href={directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-md transition-colors"
            >
              <Navigation className="h-3 w-3" />
              Directions
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
