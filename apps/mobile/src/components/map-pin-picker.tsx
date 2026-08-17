import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

export type MapCoords = { latitude: number; longitude: number };

/** Same point, allowing for float noise on the round trip through the WebView. */
function samePoint(a: MapCoords, b: MapCoords): boolean {
  return Math.abs(a.latitude - b.latitude) < 1e-9 && Math.abs(a.longitude - b.longitude) < 1e-9;
}

function buildMapHtml(lat: number, lng: number): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>html, body, #map { height: 100%; margin: 0; padding: 0; }</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  var map = L.map('map', { zoomControl: true }).setView([${lat}, ${lng}], 16);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);
  var marker = L.marker([${lat}, ${lng}], { draggable: true }).addTo(map);

  function sendPosition(latlng) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ latitude: latlng.lat, longitude: latlng.lng }));
  }

  marker.on('dragend', function (e) { sendPosition(e.target.getLatLng()); });
  map.on('click', function (e) {
    marker.setLatLng(e.latlng);
    sendPosition(e.latlng);
  });

  // Called from the app when the pin moves for a reason the map knows nothing
  // about — currently, geocoding a typed address. Deliberately silent: it does
  // not postMessage back, so moving the pin this way cannot loop.
  window.moveMarker = function (lat, lng) {
    var target = L.latLng(lat, lng);
    marker.setLatLng(target);
    map.setView(target, map.getZoom());
  };
</script>
</body>
</html>`;
}

/**
 * A draggable pin on an OpenStreetMap tile layer.
 *
 * The position is controlled: pass the coordinates in, and moving them moves
 * the marker. That matters because typing an address geocodes it, and until
 * the marker followed, the form could say one place while the pin sat in
 * another — which is how a playground in Eskilstuna ended up filed eighteen
 * metres from a gym in Norsborg.
 */
export function MapPinPicker({
  latitude,
  longitude,
  onChange,
}: {
  latitude: number;
  longitude: number;
  onChange: (coords: MapCoords) => void;
}) {
  // The HTML is built once, from wherever the pin started. Rebuilding it on
  // every move would reload the whole map and fight the user's drag; later
  // moves are pushed in through window.moveMarker instead.
  // Lazy state rather than a ref. Both capture the opening position once and
  // never change, but a ref read during render is unsound in a way state is
  // not: React makes no promise about ref contents mid-render, and the
  // compiler is right to refuse it.
  const [seed] = useState({ latitude, longitude });
  const html = useMemo(() => buildMapHtml(seed.latitude, seed.longitude), [seed]);

  const webview = useRef<WebView>(null);
  const loaded = useRef(false);
  const pending = useRef<MapCoords | null>(null);
  // The last position the map itself reported. Pushing that straight back would
  // recentre the view under the finger that had just finished dragging.
  const fromMap = useRef<MapCoords | null>(null);

  const moveMarker = (coords: MapCoords) => {
    webview.current?.injectJavaScript(
      `window.moveMarker && window.moveMarker(${coords.latitude}, ${coords.longitude}); true;`
    );
  };

  useEffect(() => {
    const target = { latitude, longitude };
    if (fromMap.current && samePoint(fromMap.current, target)) return;
    // Geocoding can resolve before Leaflet has finished loading; hold the
    // position and apply it once the page is up.
    if (!loaded.current) {
      pending.current = target;
      return;
    }
    moveMarker(target);
  }, [latitude, longitude]);

  return (
    <View style={styles.container}>
      <WebView
        ref={webview}
        originWhitelist={['*']}
        source={{ html }}
        style={styles.webview}
        onLoadEnd={() => {
          loaded.current = true;
          if (pending.current) {
            moveMarker(pending.current);
            pending.current = null;
          }
        }}
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (typeof data.latitude === 'number' && typeof data.longitude === 'number') {
              fromMap.current = { latitude: data.latitude, longitude: data.longitude };
              onChange(fromMap.current);
            }
          } catch {
            // ignore malformed messages from the page
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 220,
    borderRadius: 12,
    overflow: 'hidden',
  },
  webview: {
    flex: 1,
  },
});
