#!/usr/bin/env python3
"""
🌱 Smart Garden Manager - IoT Sensor Simulator
Sendet simulierte Sensordaten an AWS IoT Core

Installation:
    pip install AWSIoTPythonSDK

Verwendung:
    python sensor_simulator.py
"""

import json
import time
import random
import datetime
import os
import sys

try:
    from AWSIoTPythonSDK.MQTTLib import AWSIoTMQTTClient
except ImportError:
    print("❌ AWSIoTPythonSDK nicht installiert!")
    print("📦 Installation: pip install AWSIoTPythonSDK")
    sys.exit(1)


# ============================================
# KONFIGURATION - HIER ANPASSEN!
# ============================================

# !!! WICHTIG: Diese Werte müssen nach dem Deployment angepasst werden !!!
ENDPOINT = "YOUR_IOT_ENDPOINT.iot.region.amazonaws.com"
TOPIC = "sensor/data"
INTERVAL = 5  # Sekunden
SENSOR_ID = "sensor-001"

# Pfade zu den Zertifikaten (müssen heruntergeladen werden)
CERT_PATH = "./certs/device-certificate.pem.crt"
PRIVATE_KEY_PATH = "./certs/device-private-key.pem.key"
ROOT_CA_PATH = "./certs/root-CA.crt"

# ============================================
# SENSOR KLASSE
# ============================================

class SmartGardenSensor:
    """
    Simulierter Smart Garden Sensor
    Generiert realistische Umgebungsdaten mit natürlichen Schwankungen
    """
    
    def __init__(self, sensor_id='sensor-001', location='indoor'):
        self.sensor_id = sensor_id
        self.location = location
        self.reading_count = 0
        
        # Basiswerte je nach Standort
        if location == 'outdoor':
            self.base_temp = 22.0
            self.temp_range = 10.0
            self.base_humidity = 60.0
            self.humidity_range = 25.0
            self.base_moisture = 50.0
            self.moisture_range = 30.0
        elif location == 'greenhouse':
            self.base_temp = 25.0
            self.temp_range = 5.0
            self.base_humidity = 70.0
            self.humidity_range = 15.0
            self.base_moisture = 65.0
            self.moisture_range = 15.0
        else:  # indoor
            self.base_temp = 21.0
            self.temp_range = 3.0
            self.base_humidity = 50.0
            self.humidity_range = 10.0
            self.base_moisture = 45.0
            self.moisture_range = 20.0
        
        # Trends für langsame Änderungen
        self.moisture_trend = 0
        self.temperature_trend = 0
        
        print(f"✅ Sensor initialisiert: {sensor_id}")
        print(f"📍 Standort: {location}")
        print(f"🌡️  Basistemperatur: {self.base_temp}°C")
        print(f"💧 Basislufteuchtigkeit: {self.base_humidity}%")
        print(f"🌿 Basis-Bodenfeuchte: {self.base_moisture}%")
        print("=" * 50)
    
    def generate_reading(self):
        """
        Generiert einen neuen Sensorwert mit realistischen Schwankungen
        
        Returns:
            dict: Sensorwerte und Metadaten
        """
        self.reading_count += 1
        
        # Tageszeit-Effekt (6-18 Uhr wärmer)
        hour = datetime.datetime.now().hour
        time_factor = 0
        if 6 <= hour <= 18:
            time_factor = (hour - 6) / 12  # 0.0 bis 1.0
        
        # Natürliche Schwankungen
        noise = random.uniform(-0.5, 0.5)
        
        # Temperatur berechnen
        temperature = (self.base_temp + 
                      time_factor * 5.0 + 
                      noise * 2.0 +
                      random.gauss(0, 0.3))
        temperature = max(15, min(40, temperature))
        
        # Luftfeuchtigkeit (invers zur Temperatur)
        humidity = (self.base_humidity - 
                   time_factor * 15.0 + 
                   noise * 5.0 +
                   random.gauss(0, 1.0))
        humidity = max(20, min(90, humidity))
        
        # Bodenfeuchte (mit Trend)
        # Simuliere Bewässerungszyklus
        if self.reading_count % 100 == 0:
            self.moisture_trend += random.uniform(5, 15)
        
        # Natürliche Abnahme
        self.moisture_trend -= random.uniform(0.1, 0.5)
        self.moisture_trend = max(-20, min(20, self.moisture_trend))
        
        moisture = (self.base_moisture + 
                   self.moisture_trend +
                   random.gauss(0, 2.0))
        
        # Zufällige Wetterereignisse
        if random.random() < 0.01:  # 1% Chance für Regen
            moisture += random.uniform(10, 20)
            print("🌧️  Regenereignis simuliert!")
        
        if random.random() < 0.005:  # 0.5% Chance für Hitzewelle
            temperature += random.uniform(3, 5)
            print("🌞 Hitzewelle simuliert!")
        
        # Werte begrenzen
        moisture = max(10, min(90, moisture))
        
        # Aktuelle Zeit
        timestamp = datetime.datetime.utcnow().isoformat() + 'Z'
        
        # Messwert zusammenstellen
        reading = {
            'sensor_id': self.sensor_id,
            'timestamp': timestamp,
            'temperature': round(temperature, 1),
            'humidity': round(humidity, 1),
            'soil_moisture': round(moisture, 1),
            'location': self.location,
            'reading_id': f"{self.sensor_id}-{self.reading_count}"
        }
        
        return reading


# ============================================
# MQTT CLIENT
# ============================================

class IoTMQTTClient:
    """
    MQTT-Client für AWS IoT Core
    """
    
    def __init__(self, endpoint, cert_path, private_key_path, root_ca_path):
        self.endpoint = endpoint
        self.cert_path = cert_path
        self.private_key_path = private_key_path
        self.root_ca_path = root_ca_path
        self.client_id = f"sensor-{random.randint(1000, 9999)}"
        
        # Prüfe ob Zertifikate existieren
        for path in [cert_path, private_key_path, root_ca_path]:
            if not os.path.exists(path):
                print(f"❌ Zertifikat nicht gefunden: {path}")
                print("📁 Bitte laden Sie die Zertifikate von AWS IoT Core herunter.")
                sys.exit(1)
        
        # MQTT-Client initialisieren
        self.mqtt_client = AWSIoTMQTTClient(self.client_id)
        self.mqtt_client.configureEndpoint(endpoint, 8883)
        self.mqtt_client.configureCredentials(root_ca_path, private_key_path, cert_path)
        self.mqtt_client.configureOfflinePublishQueueing(-1)
        self.mqtt_client.configureDrainingFrequency(2)
        self.mqtt_client.configureConnectDisconnectTimeout(10)
        self.mqtt_client.configureMQTTOperationTimeout(5)
        
        self.connected = False
    
    def connect(self):
        """Verbindet zum AWS IoT Core Broker"""
        try:
            print("📡 Verbinde zu AWS IoT Core...")
            self.mqtt_client.connect()
            self.connected = True
            print("✅ Verbunden mit AWS IoT Core")
            return True
        except Exception as e:
            print(f"❌ Verbindungsfehler: {e}")
            return False
    
    def disconnect(self):
        """Trennt die Verbindung"""
        if self.connected:
            self.mqtt_client.disconnect()
            self.connected = False
            print("📡 Verbindung getrennt")
    
    def publish(self, topic, payload):
        """Veröffentlicht eine Nachricht"""
        if not self.connected:
            print("⚠️  Nicht verbunden")
            return False
        
        try:
            message = json.dumps(payload)
            self.mqtt_client.publish(topic, message, 0)
            return True
        except Exception as e:
            print(f"❌ Fehler beim Veröffentlichen: {e}")
            return False


# ============================================
# HAUPTPROGRAMM
# ============================================

def main():
    """
    Hauptfunktion: Startet die Sensor-Simulation
    """
    print("=" * 50)
    print("🌱 Smart Garden Manager - IoT Sensor Simulator")
    print("=" * 50)
    
    # Prüfe Konfiguration
    if ENDPOINT == "YOUR_IOT_ENDPOINT.iot.region.amazonaws.com":
        print("⚠️  Bitte konfigurieren Sie zuerst den ENDPOINT!")
        print("📝 Bearbeiten Sie die Konstanten am Anfang der Datei.")
        sys.exit(1)
    
    # MQTT Client erstellen und verbinden
    mqtt_client = IoTMQTTClient(
        ENDPOINT, CERT_PATH, PRIVATE_KEY_PATH, ROOT_CA_PATH
    )
    
    if not mqtt_client.connect():
        print("❌ Keine Verbindung zu AWS IoT Core möglich")
        sys.exit(1)
    
    # Sensor erstellen
    sensor = SmartGardenSensor(SENSOR_ID, 'indoor')
    
    print(f"\n📤 Sende Daten alle {INTERVAL} Sekunden...")
    print(f"📡 Topic: {TOPIC}")
    print("🛑 Drücke STRG+C zum Beenden")
    print("=" * 50)
    
    # Statistik
    total = 0
    success = 0
    
    try:
        while True:
            # Generiere Sensordaten
            reading = sensor.generate_reading()
            total += 1
            
            # Veröffentliche Daten
            if mqtt_client.publish(TOPIC, reading):
                success += 1
                print(f"✅ [{total:3d}] T: {reading['temperature']:3.1f}°C | "
                      f"H: {reading['humidity']:3.1f}% | "
                      f"M: {reading['soil_moisture']:3.1f}%")
            else:
                print(f"❌ [{total:3d}] Fehler beim Senden")
            
            # Warte bis zur nächsten Messung
            time.sleep(INTERVAL)
            
    except KeyboardInterrupt:
        print("\n⏹️  Stoppe Simulation...")
    
    finally:
        # Verbindung trennen
        mqtt_client.disconnect()
        
        # Statistik anzeigen
        print("\n📊 Statistik:")
        print(f"   Gesendet: {total}")
        print(f"   Erfolgreich: {success}")
        print(f"   Fehlgeschlagen: {total - success}")
        if total > 0:
            rate = (success / total) * 100
            print(f"   Erfolgsrate: {rate:.1f}%")
        print("🏁 Simulation beendet")


if __name__ == "__main__":
    main()