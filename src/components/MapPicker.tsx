import { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import { Search, Navigation, MapPin, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';

interface MapPickerProps {
    onLocationSelect: (lat: number, lng: number, address?: string) => void;
    onPlotAreaSelect?: (area: number, length: number, width: number) => void;
    initialLat?: number;
    initialLng?: number;
}

export const MapPicker = ({ onLocationSelect, onPlotAreaSelect, initialLat = 17.3850, initialLng = 78.4867 }: MapPickerProps) => {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<L.Map | null>(null);
    const markerRef = useRef<L.Marker | null>(null);
    const accuracyCircleRef = useRef<L.Circle | null>(null);
    const polygonRef = useRef<L.Polygon | null>(null);

    // UI State
    const [drawingMode, setDrawingMode] = useState(false);
    const [points, setPoints] = useState<L.LatLng[]>([]);
    const [isMounted, setIsMounted] = useState(false);
    const [isLocating, setIsLocating] = useState(false);

    // Search State
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [liveAddress, setLiveAddress] = useState<string>('');
    const [isFetchingAddress, setIsFetchingAddress] = useState(false);

    const safeLat = typeof initialLat === 'number' ? initialLat : 17.3850;
    const safeLng = typeof initialLng === 'number' ? initialLng : 78.4867;

    // 1. Static Setup & CSS Injection
    useEffect(() => {
        setIsMounted(true);
        if (!document.getElementById('leaflet-css')) {
            const link = document.createElement('link');
            link.id = 'leaflet-css';
            link.rel = 'stylesheet';
            link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
            document.head.appendChild(link);
        }

        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
            iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
            iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
            shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        });

        return () => {
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
        };
    }, []);

    // 2. Map Initialization
    useEffect(() => {
        if (!isMounted || !mapContainerRef.current || mapRef.current) return;

        const timer = setTimeout(() => {
            if (!mapContainerRef.current) return;

            try {
                // Initialize map with a default view
                const map = L.map(mapContainerRef.current, {
                    zoomControl: false
                }).setView([safeLat, safeLng], 13);

                // Use Google Hybrid tiles for best visual recognition - FIXED URL
                L.tileLayer('https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
                    maxZoom: 20,
                    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
                    attribution: '© Google'
                }).addTo(map);

                markerRef.current = L.marker([safeLat, safeLng]).addTo(map);
                mapRef.current = map;

                // Move zoom control to topright to avoid overlapping with action buttons
                L.control.zoom({ position: 'topright' }).addTo(map);

                // Auto-locate IMMEDIATELY
                handleCurrentLocation();

                setTimeout(() => map.invalidateSize(), 200);
                onLocationSelect(safeLat, safeLng, ''); // Initial call
                fetchReverseGeocode(safeLat, safeLng);
            } catch (err) {
                console.error("Leaflet initialization error:", err);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [isMounted]);

    // 3. Geolocation Handler
    const handleCurrentLocation = () => {
        if (!mapRef.current || !navigator.geolocation) return;

        setIsLocating(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const { latitude, longitude, accuracy } = pos.coords;
                if (mapRef.current) {
                    // Update Marker
                    if (markerRef.current) {
                        markerRef.current.setLatLng([latitude, longitude]);
                    } else {
                        markerRef.current = L.marker([latitude, longitude]).addTo(mapRef.current);
                    }

                    // Accuracy Circle
                    if (accuracyCircleRef.current) accuracyCircleRef.current.remove();
                    accuracyCircleRef.current = L.circle([latitude, longitude], {
                        radius: accuracy,
                        color: '#0ea5e9',
                        fillColor: '#0ea5e9',
                        fillOpacity: 0.1,
                        weight: 1
                    }).addTo(mapRef.current);

                    // If accuracy is good, zoom in more, otherwise stay out
                    const zoomLevel = accuracy < 100 ? 18 : 16;
                    mapRef.current.flyTo([latitude, longitude], zoomLevel, { duration: 1.5 });

                    onLocationSelect(latitude, longitude);
                    fetchReverseGeocode(latitude, longitude);
                }
                setIsLocating(false);
                if (accuracy > 100) {
                    toast.info("Using approximate location. For better accuracy, please tap your exact spot on the map.");
                }
            },
            (err) => {
                console.warn("Geolocation failed:", err.message);
                setIsLocating(false);
                toast.error("Could not get your exact location. Please use the search or tap on the map.");
                if (mapRef.current) mapRef.current.setView([safeLat, safeLng], 13);
            },
            {
                enableHighAccuracy: true,
                timeout: 15000, // Increased timeout for better signal acquisition
                maximumAge: 0
            }
        );
    };

    // 4. Search Handler (Universal + Multi-API Fallback)
    const handleSearch = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!searchQuery.trim()) return;

        setIsSearching(true);
        try {
            // Normalize Query (Helpful for specific landmarks with special chars)
            const normalizedQuery = searchQuery.trim().replace(/'/g, "");

            // A. Check for Plus Codes
            const plusCodeRegex = /[23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{2,3}/i;
            const hasPlusCode = plusCodeRegex.test(searchQuery);

            if (hasPlusCode) {
                const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.length > 0) {
                        const lat = parseFloat(data[0].lat);
                        const lon = parseFloat(data[0].lon);
                        if (mapRef.current) {
                            mapRef.current.flyTo([lat, lon], 18, { duration: 1.2 });
                            if (markerRef.current) markerRef.current.setLatLng([lat, lon]);
                            onLocationSelect(lat, lon, data[0].display_name);
                            setLiveAddress(data[0].display_name);
                        }
                        setIsSearching(false);
                        setSearchResults([]);
                        return;
                    }
                }
            }

            // B. Primary Search with Photon (Fast & Fuzzy)
            const mapCenter = mapRef.current?.getCenter();
            const latBias = mapCenter ? `&lat=${mapCenter.lat}&lon=${mapCenter.lng}` : '';

            // Try both original and normalized to maximize hit rate
            const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(searchQuery)}&limit=10${latBias}`);

            if (res.ok) {
                const data = await res.json();
                let results = data.features.map((f: any) => {
                    const p = f.properties;
                    const main = p.housenumber ? `${p.housenumber} ${p.street || p.name}` : (p.name || p.street);
                    return {
                        display_name: [
                            main,
                            p.district,
                            p.city,
                            p.state
                        ].filter(Boolean).join(', '),
                        lat: f.geometry.coordinates[1],
                        lon: f.geometry.coordinates[0]
                    };
                });

                // C. Fallback to Nominatim if Photon found nothing (Some POIs are better indexed in Nominatim)
                if (results.length === 0) {
                    const fallbackRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(normalizedQuery)}&limit=5&viewbox=${mapRef.current?.getBounds().toBBoxString() || ''}`);
                    if (fallbackRes.ok) {
                        const fallbackData = await fallbackRes.json();
                        results = fallbackData.map((d: any) => ({
                            display_name: d.display_name,
                            lat: d.lat,
                            lon: d.lon
                        }));
                    }
                }

                setSearchResults(results);
                if (results.length === 0) {
                    toast.error("Location not found. Try searching for the area or city, or use a Plus Code from Google Maps.");
                }
            }
        } catch (err) {
            console.error("Search failed:", err);
            toast.error("Search failed. Please try clicking manually on the map.");
        } finally {
            setIsSearching(false);
        }
    };

    const fetchReverseGeocode = async (lat: number, lng: number) => {
        setIsFetchingAddress(true);
        try {
            // Live preview still uses Nominatim for best address details
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`);
            if (res.ok) {
                const data = await res.json();
                const addrStr = data.display_name || `Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`;
                setLiveAddress(addrStr);
                onLocationSelect(lat, lng, data.display_name);
            }
        } catch (err) {
            console.error("Reverse geocode failed:", err);
        } finally {
            setIsFetchingAddress(false);
        }
    };

    const selectResult = (result: any) => {
        const lat = typeof result.lat === 'string' ? parseFloat(result.lat) : result.lat;
        const lon = typeof result.lon === 'string' ? parseFloat(result.lon) : result.lon;
        if (mapRef.current) {
            mapRef.current.flyTo([lat, lon], 18, { duration: 1.2 });
            if (markerRef.current) {
                markerRef.current.setLatLng([lat, lon]);
            }
            onLocationSelect(lat, lon, result.display_name);
            setLiveAddress(result.display_name);

            // Clean up accuracy circle if present
            if (accuracyCircleRef.current) {
                accuracyCircleRef.current.remove();
                accuracyCircleRef.current = null;
            }
        }
        setSearchResults([]);
        setSearchQuery(result.display_name);
    };

    const drawingMarkersRef = useRef<L.CircleMarker[]>([]);

    // 5. Click Handler (Location & Drawing)
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;

        const cleanupMarkers = () => {
            drawingMarkersRef.current.forEach(m => m.remove());
            drawingMarkersRef.current = [];
        };

        const onMapClick = (e: L.LeafletMouseEvent) => {
            if (drawingMode) {
                setPoints(prev => {
                    const newPoints = [...prev, e.latlng];

                    // Add a small interactive marker for this point
                    const marker = L.circleMarker(e.latlng, {
                        radius: 5,
                        fillColor: '#0ea5e9',
                        color: '#fff',
                        weight: 2,
                        fillOpacity: 1
                    }).addTo(map);
                    drawingMarkersRef.current.push(marker);

                    // Update visual polygon preview
                    if (newPoints.length >= 2) {
                        if (polygonRef.current) polygonRef.current.remove();
                        polygonRef.current = L.polygon(newPoints, {
                            color: '#0ea5e9',
                            fillOpacity: 0.3,
                            weight: 3,
                            dashArray: '5, 5'
                        }).addTo(map);
                    }
                    return newPoints;
                });
            } else {
                const { lat, lng } = e.latlng;
                if (markerRef.current) {
                    markerRef.current.setLatLng(e.latlng);
                } else {
                    markerRef.current = L.marker(e.latlng).addTo(map);
                }

                // Clean up accuracy circle on manual click
                if (accuracyCircleRef.current) {
                    accuracyCircleRef.current.remove();
                    accuracyCircleRef.current = null;
                }

                onLocationSelect(lat, lng);
                fetchReverseGeocode(lat, lng);
            }
        };

        map.on('click', onMapClick);
        return () => {
            map.off('click', onMapClick);
            if (!drawingMode) cleanupMarkers();
        };
    }, [drawingMode, onLocationSelect, onPlotAreaSelect]);

    if (!isMounted) return <div className="h-full w-full bg-slate-100 animate-pulse rounded-xl shadow-inner" />;

    return (
        <div className="relative w-full h-full flex flex-col bg-slate-50">
            {/* Search Overlay */}
            <div className="absolute top-4 left-4 right-4 z-[1001] max-w-xl mx-auto md:ml-4 md:mr-0">
                <div className="relative">
                    <div className="flex gap-2">
                        <div className="relative flex-1 group">
                            <Search className="absolute left-4 top-3 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleSearch();
                                    }
                                }}
                                placeholder="Search address, landmark or Plus Code..."
                                className="w-full pl-11 pr-12 py-3 bg-white/95 backdrop-blur-xl border border-slate-200 rounded-2xl shadow-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => { setSearchQuery(''); setSearchResults([]); }}
                                    className="absolute right-3 top-2.5 p-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={() => handleSearch()}
                            disabled={isSearching}
                            className="px-6 py-3 bg-primary text-white rounded-2xl shadow-xl hover:bg-primary/90 active:scale-95 transition-all text-sm font-bold flex items-center justify-center gap-2 min-w-[100px]"
                        >
                            {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Search className="w-4 h-4" /> Search</>}
                        </button>
                    </div>

                    {searchResults.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-3 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-100 overflow-hidden max-h-[350px] overflow-y-auto animate-in fade-in slide-in-from-top-2 z-[2000]">
                            {searchResults.map((result, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => selectResult(result)}
                                    className="w-full text-left px-5 py-4 hover:bg-primary/5 transition-colors border-b border-slate-50 last:border-0 flex items-start gap-4 group"
                                >
                                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
                                        <MapPin className="w-4 h-4 text-slate-400 group-hover:text-primary transition-colors" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-bold text-slate-800 line-clamp-1">{result.display_name.split(',')[0]}</div>
                                        <div className="text-[10px] text-slate-500 line-clamp-2 mt-0.5 leading-relaxed">{result.display_name}</div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Map Area */}
            <div ref={mapContainerRef} className="flex-1 w-full z-0 cursor-crosshair" />

            {/* Live Address Preview Map Label - Improved layout and visibility */}
            <div className="absolute bottom-4 left-4 right-20 z-[1001] pointer-events-none md:max-w-md">
                <div className="bg-slate-900/95 backdrop-blur-md px-4 py-3 rounded-2xl shadow-2xl border border-white/10 flex items-start gap-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <div className="w-8 h-8 rounded-xl bg-primary/20 flex items-center justify-center shrink-0 mt-0.5 border border-primary/30">
                        {isFetchingAddress ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : <MapPin className="w-4 h-4 text-primary" />}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="text-[10px] uppercase font-black text-primary tracking-widest mb-1 opacity-80">Pinned Location</div>
                        <div className="text-xs font-bold text-white leading-relaxed line-clamp-2">
                            {isFetchingAddress ? 'Detecting address details...' : (liveAddress || 'Tap any spot on the map to define your hatchery')}
                        </div>
                    </div>
                </div>
            </div>

            {/* Controls */}
            <div className="absolute bottom-4 right-4 z-[1000] flex flex-col gap-3">
                <button
                    type="button"
                    onClick={handleCurrentLocation}
                    disabled={isLocating}
                    className="w-12 h-12 bg-white text-slate-900 rounded-xl shadow-2xl border border-slate-100 flex items-center justify-center hover:bg-slate-50 hover:text-primary active:scale-90 transition-all group overflow-hidden"
                    title="Center to Current Location"
                >
                    <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    {isLocating ? (
                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    ) : (
                        <Navigation className="w-5 h-5 transition-transform group-hover:-translate-y-1 group-hover:translate-x-1" />
                    )}
                </button>

                <button
                    type="button"
                    onClick={() => {
                        if (drawingMode && points.length >= 3) {
                            // Finish Polygon
                            if (polygonRef.current) {
                                polygonRef.current.setStyle({ dashArray: '' }); // Make solid

                                const area = calculatePolygonArea(points);
                                if (onPlotAreaSelect) {
                                    const bounds = polygonRef.current.getBounds();
                                    const sw = bounds.getSouthWest();
                                    const ne = bounds.getNorthEast();
                                    const width = sw.distanceTo(L.latLng(sw.lat, ne.lng));
                                    const height = sw.distanceTo(L.latLng(ne.lat, sw.lng));
                                    onPlotAreaSelect(area, width, height);

                                    // Move marker to center of plot and refresh address
                                    const center = bounds.getCenter();
                                    if (markerRef.current) {
                                        markerRef.current.setLatLng(center);
                                    } else {
                                        markerRef.current = L.marker(center).addTo(mapRef.current!);
                                    }
                                    fetchReverseGeocode(center.lat, center.lng);
                                }
                            }
                            setDrawingMode(false);
                            setPoints([]);
                            drawingMarkersRef.current.forEach(m => m.remove());
                            drawingMarkersRef.current = [];
                            toast.success("Plot area defined!");
                        } else {
                            if (drawingMode) {
                                setPoints([]);
                                if (polygonRef.current) { polygonRef.current.remove(); polygonRef.current = null; }
                                drawingMarkersRef.current.forEach(m => m.remove());
                                drawingMarkersRef.current = [];
                            }
                            setDrawingMode(!drawingMode);
                        }
                    }}
                    className={`h-12 px-5 rounded-xl shadow-2xl font-black text-[10px] uppercase tracking-widest transform transition-all active:scale-95 border flex items-center gap-2 ${drawingMode
                        ? (points.length >= 3 ? 'bg-green-600 border-green-700 text-white' : 'bg-red-500 text-white border-red-600')
                        : 'bg-slate-900 text-white border-slate-800 hover:bg-slate-800'
                        }`}
                >
                    {drawingMode ? (
                        points.length >= 3 ? (
                            <><Navigation className="w-4 h-4" /> Finish Area</>
                        ) : (
                            <><X className="w-4 h-4" /> Cancel</>
                        )
                    ) : (
                        <><div className="w-2 h-2 rounded-full bg-primary animate-pulse" /> Draw Area</>
                    )}
                </button>
            </div>

            {/* Drawing Tooltip */}
            {drawingMode && (
                <div className="absolute top-24 left-1/2 -translate-x-1/2 z-[1001] pointer-events-none">
                    <div className="bg-white/95 backdrop-blur-md text-slate-900 px-6 py-3 rounded-full text-xs font-black shadow-2xl border border-primary/20 flex items-center gap-4 transition-all animate-bounce whitespace-nowrap">
                        <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-[10px]">
                            {points.length + 1}
                        </div>
                        {points.length === 0 ? 'Click first corner of plot' : (points.length < 3 ? 'Add more points to define shape' : 'Click more points or "Finish Area"')}
                    </div>
                </div>
            )}

            {/* Initial Geolocation Loader Overlay */}
            {isLocating && isMounted && (
                <div className="absolute inset-0 z-[2000] bg-white/40 backdrop-blur-[2px] flex items-center justify-center animate-in fade-in duration-300">
                    <div className="bg-white px-8 py-6 rounded-[2.5rem] shadow-2xl border border-slate-100 flex flex-col items-center gap-4">
                        <div className="relative">
                            <div className="w-12 h-12 rounded-full border-4 border-primary/10 border-t-primary animate-spin" />
                            <Navigation className="absolute inset-0 m-auto w-5 h-5 text-primary animate-pulse" />
                        </div>
                        <span className="text-sm font-black text-slate-700 uppercase tracking-tight">Detecting Location...</span>
                    </div>
                </div>
            )}
        </div>
    );
};
// Helper: Shoelace formula for area in square meters
const calculatePolygonArea = (coords: L.LatLng[]) => {
    let area = 0;
    const radius = 6378137; // Earth's radius in meters

    for (let i = 0; i < coords.length; i++) {
        const p1 = coords[i];
        const p2 = coords[(i + 1) % coords.length];

        // Convert to radians (approximate planar area for small scale)
        const lat1 = p1.lat * (Math.PI / 180);
        const lon1 = p1.lng * (Math.PI / 180);
        const lat2 = p2.lat * (Math.PI / 180);
        const lon2 = p2.lng * (Math.PI / 180);

        area += (lon2 - lon1) * (2 + Math.sin(lat1) + Math.sin(lat2));
    }

    area = Math.abs(area * radius * radius / 2);
    // Rough estimate: multiply by cos(average latitude) for better precision at scale
    return area;
};
