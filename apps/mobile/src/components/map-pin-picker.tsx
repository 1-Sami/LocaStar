import { useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

export type MapCoords = { latitude: number; longitude: number };

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
</script>
</body>
</html>`;
}

export function MapPinPicker({
  initialLatitude,
  initialLongitude,
  onChange,
}: {
  initialLatitude: number;
  initialLongitude: number;
  onChange: (coords: MapCoords) => void;
}) {
  // Build the HTML once from the initial coords only — re-rendering it on
  // every pin move would reload the whole map and fight the user's drag.
  const initial = useRef({ initialLatitude, initialLongitude });
  const html = useMemo(
    () => buildMapHtml(initial.current.initialLatitude, initial.current.initialLongitude),
    []
  );

  return (
    <View style={styles.container}>
      <WebView
        originWhitelist={['*']}
        source={{ html }}
        style={styles.webview}
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (typeof data.latitude === 'number' && typeof data.longitude === 'number') {
              onChange({ latitude: data.latitude, longitude: data.longitude });
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
