// Não há mais imports do Firebase aqui, eles são carregados no index.html

const canvas = document.getElementById('antennaCanvas');
const ctx = canvas.getContext('2d');
const trackedSatellitesDisplay = document.getElementById('trackedSatellites');
const telemetryDisplay = document.getElementById('telemetryDisplay');
const satelliteSignalDisplays = document.getElementById('satelliteSignalDisplays');
const satelliteSelectModal = document.getElementById('satelliteSelectModal');
const satelliteListForSelection = document.getElementById('satelliteListForSelection');
const closeModalBtn = document.getElementById('closeModalBtn');

// As variáveis globais do Firebase (appId, firebaseConfig, initialAuthToken, firebaseApp, firestoreDb, firebaseAuth, currentUserId)
// são agora definidas no script do index.html e acessíveis globalmente.

// Canvas Settings
let earthRadius;
let centerX, centerY;
let earthRotationAngle = 0; // For slow Earth rotation

// Global alarm state (now synchronized via Firebase)
let audioContext = null;
let alarmOscillator = null;
let alarmGain = null;
window.isAlarmActive = false; // Made global to be accessible by Firebase listener

// Global phase offset for sine waves in signal display
let wavePhaseOffset = 0;
const waveSpeed = 5; // Speed of horizontal wave movement

// Antennas: latitude, longitude, azimuth, elevation, on, auto mode, tracking satellite, tracked satellite ID
// Coordinates are approximate for simulation purposes.
// Azimuth: 0=North, 90=East, 180=South, 270=West
// Elevation: 0=Horizontal, 90=Zenith (pointing straight up)
const antennas = [
    {
        id: 1,
        name: "Antena 1 (Califórnia)",
        lat: 34.20, // Latitude
        lon: -116.89, // Longitude (West is negative)
        azimuth: 0,
        elevation: 45,
        isOn: false,
        isAuto: false,
        isTrackingSatellite: false,
        isCommunicating: false, // NEW: Communication mode
        trackedSatelliteId: null, // ID of the satellite being tracked
        targetAzimuth: 0, // For random auto mode
        targetElevation: 0, // For random auto mode
        manualAzimuthInput: document.getElementById('azimuth1'),
        manualElevationInput: document.getElementById('elevation1'),
        azimuthValueSpan: document.getElementById('azimuthValue1'),
        elevationValueSpan: document.getElementById('elevationValue1'),
        toggleButton: document.getElementById('toggle1'),
        autoButton: document.getElementById('auto1'),
        trackSatButton: document.getElementById('trackSatBtn1'),
        commButton: document.getElementById('commBtn1'), // NEW: Communication button
        alarmButton: document.getElementById('alarmBtn1'),
        card: document.getElementById('antenna1-card')
    },
    {
        id: 2,
        name: "Antena 2 (Espanha)",
        lat: 40.43,
        lon: -4.25,
        azimuth: 120,
        elevation: 60,
        isOn: false,
        isAuto: false,
        isTrackingSatellite: false,
        isCommunicating: false, // NEW: Communication mode
        trackedSatelliteId: null,
        targetAzimuth: 0,
        targetElevation: 0,
        manualAzimuthInput: document.getElementById('azimuth2'),
        manualElevationInput: document.getElementById('elevation2'),
        azimuthValueSpan: document.getElementById('azimuthValue2'),
        elevationValueSpan: document.getElementById('elevationValue2'),
        toggleButton: document.getElementById('toggle2'),
        autoButton: document.getElementById('auto2'),
        trackSatButton: document.getElementById('trackSatBtn2'),
        commButton: document.getElementById('commBtn2'), // NEW: Communication button
        alarmButton: document.getElementById('alarmBtn2'),
        card: document.getElementById('antenna2-card')
    },
    {
        id: 3,
        name: "Antena 3 (Austrália)",
        lat: -35.40, // South is negative
        lon: 148.98,
        azimuth: 240,
        elevation: 30,
        isOn: false,
        isAuto: false,
        isTrackingSatellite: false,
        isCommunicating: false, // NEW: Communication mode
        trackedSatelliteId: null,
        targetAzimuth: 0,
        targetElevation: 0,
        manualAzimuthInput: document.getElementById('azimuth3'),
        manualElevationInput: document.getElementById('elevation3'),
        azimuthValueSpan: document.getElementById('azimuthValue3'),
        elevationValueSpan: document.getElementById('elevationValue3'),
        toggleButton: document.getElementById('toggle3'),
        autoButton: document.getElementById('auto3'),
        trackSatButton: document.getElementById('trackSatBtn3'),
        commButton: document.getElementById('commBtn3'), // NEW: Communication button
        alarmButton: document.getElementById('alarmBtn3'),
        card: document.getElementById('antenna3-card')
    }
];

// Satellite Data
const satellites = [
    {
        id: 'SAT-LUISGDUV', name: 'SAT-LUISGDUV',
        orbitRadiusFactor: 0.7, orbitSpeed: 0.005, orbitAngle: 0,
        battery: 100, solarPower: 50, temperature: 25, altitude: 500, speed: 7.5, // Telemetry
        x: 0, y: 0, // Canvas Position
        isLocked: false, // NEW: If satellite is locked in communication mode
        initialOrbitAngle: 0 // Store initial angle for reset
    },
    {
        id: 'SAT-EXPLORER', name: 'SAT-EXPLORER',
        orbitRadiusFactor: 0.8, orbitSpeed: 0.003, orbitAngle: Math.PI / 2,
        battery: 90, solarPower: 40, temperature: 20, altitude: 700, speed: 7.0,
        x: 0, y: 0,
        isLocked: false,
        initialOrbitAngle: Math.PI / 2
    },
    {
        id: 'SAT-COMMS', name: 'SAT-COMMS',
        orbitRadiusFactor: 0.6, orbitSpeed: 0.007, orbitAngle: Math.PI,
        battery: 80, solarPower: 60, temperature: 30, altitude: 400, speed: 8.0,
        x: 0, y: 0,
        isLocked: false,
        initialOrbitAngle: Math.PI
    },
    {
        id: 'SAT-WEATHER', name: 'SAT-WEATHER',
        orbitRadiusFactor: 0.65, orbitSpeed: 0.004, orbitAngle: Math.PI * 1.5,
        battery: 95, solarPower: 55, temperature: 22, altitude: 600, speed: 7.2,
        x: 0, y: 0,
        isLocked: false,
        initialOrbitAngle: Math.PI * 1.5
    }
];

let currentAntennaForModal = null; // To store which antenna triggered the modal

// --- Utility Functions ---

// Converts degrees to radians
function toRadians(degrees) {
    return degrees * Math.PI / 180;
}

// Converts radians to degrees
function toDegrees(radians) {
    return radians * 180 / Math.PI;
}

// Calculates approximate distance between antenna and satellite on canvas (simplified)
function calculateDistance(antenna, satellite) {
    const dx = satellite.x - antenna.canvasX;
    const dy = satellite.y - antenna.canvasY;
    return Math.sqrt(dx * dx + dy * dy);
}

// Calculates signal strength based on distance (inverse relationship)
function calculateSignalStrength(distance) {
    const maxDistance = Math.min(canvas.width, canvas.height) * 0.7; // Effective max distance for signal
    const minDistance = 50; // Arbitrary min distance for max signal

    if (distance < minDistance) return 100; // Max signal if very close

    // Linear decay from max to min distance
    let strength = 100 - ((distance - minDistance) / (maxDistance - minDistance)) * 100;
    return Math.max(0, Math.min(100, strength)); // Limit between 0 and 100
}

// --- Drawing Functions ---

// Draws the Earth (simplified with continents)
function drawEarth() {
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(earthRotationAngle); // Apply Earth rotation

    // Draw oceans
    ctx.beginPath();
    ctx.arc(0, 0, earthRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#0047AB'; // Dark blue for oceans
    ctx.fill();

    // Draw continents (simplified shapes)
    ctx.fillStyle = '#006400'; // Dark green for land

    // South America (Brazil-like shape)
    ctx.beginPath();
    ctx.moveTo(earthRadius * 0.1, earthRadius * -0.8); // Northwest point
    ctx.lineTo(earthRadius * 0.5, earthRadius * -0.6); // Northeast point
    ctx.lineTo(earthRadius * 0.4, earthRadius * 0.2);  // Southeast point
    ctx.lineTo(earthRadius * 0.0, earthRadius * 0.8);  // Southernmost point
    ctx.lineTo(earthRadius * -0.3, earthRadius * 0.5); // Southwest point
    ctx.lineTo(earthRadius * -0.6, earthRadius * -0.2); // West point
    ctx.closePath();
    ctx.fill();

    // North America (simplified)
    ctx.beginPath();
    ctx.moveTo(earthRadius * -0.7, earthRadius * -0.9);
    ctx.lineTo(earthRadius * -0.2, earthRadius * -0.95);
    ctx.lineTo(earthRadius * -0.1, earthRadius * -0.5);
    ctx.lineTo(earthRadius * -0.4, earthRadius * -0.3);
    ctx.lineTo(earthRadius * -0.8, earthRadius * -0.5);
    ctx.closePath();
    ctx.fill();

    // Africa (simplified)
    ctx.beginPath();
    ctx.moveTo(earthRadius * 0.6, earthRadius * -0.4);
    ctx.lineTo(earthRadius * 0.7, earthRadius * 0.1);
    ctx.lineTo(earthRadius * 0.5, earthRadius * 0.6);
    ctx.lineTo(earthRadius * 0.2, earthRadius * 0.5);
    ctx.lineTo(earthRadius * 0.1, earthRadius * 0.0);
    ctx.closePath();
    ctx.fill();

    // Europe/Asia (simplified large landmass)
    ctx.beginPath();
    ctx.moveTo(earthRadius * -0.1, earthRadius * -0.9);
    ctx.lineTo(earthRadius * 0.8, earthRadius * -0.8);
    ctx.lineTo(earthRadius * 0.9, earthRadius * -0.1);
    ctx.lineTo(earthRadius * 0.5, earthRadius * 0.3);
    ctx.lineTo(earthRadius * 0.0, earthRadius * 0.2);
    ctx.lineTo(earthRadius * -0.3, earthRadius * -0.1);
    ctx.closePath();
    ctx.fill();

    // Australia (simplified)
    ctx.beginPath();
    ctx.arc(earthRadius * 0.7, earthRadius * 0.7, earthRadius * 0.15, 0, Math.PI * 2); // Simple circle for now
    ctx.fill();


    // Add a subtle border to the Earth
    ctx.strokeStyle = '#FFFFFF'; // White border for Earth outline
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, earthRadius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
}

// Converts Lat/Lon to X/Y coordinates on Canvas (simplified equirectangular projection)
function latLonToCanvas(lat, lon) {
    // Adjust longitude by Earth rotation
    const adjustedLon = (lon + toDegrees(earthRotationAngle) + 360) % 360;
    const normalizedLon = adjustedLon > 180 ? adjustedLon - 360 : adjustedLon; // -180 to 180

    // Normalize lat/lon to -1 to 1 and scale to Earth radius
    const x = centerX + earthRadius * (normalizedLon / 180);
    const y = centerY - earthRadius * (lat / 90); // Positive latitude goes up on canvas

    // Ensure the point is within the Earth's circle (optional, but good for visual)
    const dx = x - centerX;
    const dy = y - centerY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > earthRadius) {
        const ratio = earthRadius / dist;
        return { x: centerX + dx * ratio, y: centerY + dy * ratio };
    }
    return { x, y };
}

// Draws an antenna and its direction
function drawAntenna(antenna) {
    const { x, y } = latLonToCanvas(antenna.lat, antenna.lon);
    antenna.canvasX = x; // Store canvas position for distance calculation
    antenna.canvasY = y;

    // Draws the antenna point
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    // Antenna color: Red if communicating, Green if on, Red if off
    ctx.fillStyle = antenna.isCommunicating ? '#FF0000' : (antenna.isOn ? '#00FF00' : '#FF0000');
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Draws the antenna direction line (simulated in 2D)
    if (antenna.isOn) {
        // Azimuth in 2D is an angle on the Earth's circle
        // 0° (North) on canvas would be up, 90° (East) to the right
        // Adjust so 0° is up (North)
        const angleRad = (antenna.azimuth - 90) * Math.PI / 180; // Adjust 0 to up

        const lineLength = earthRadius * (1 - (antenna.elevation / 90) * 0.5); // Elevation affects line length
        const endX = x + lineLength * Math.cos(angleRad);
        const endY = y + lineLength * Math.sin(angleRad);

        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(endX, endY);
        ctx.strokeStyle = antenna.isCommunicating ? '#FF0000' : '#FFFF00'; // Red line if communicating, yellow otherwise
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draws a small triangle at the end of the line to indicate direction
        const arrowSize = 8;
        ctx.save();
        ctx.translate(endX, endY);
        ctx.rotate(angleRad + Math.PI / 2); // Rotate to point in line direction
        ctx.beginPath();
        ctx.moveTo(0, -arrowSize / 2);
        ctx.lineTo(arrowSize, 0);
        ctx.lineTo(0, arrowSize / 2);
        ctx.closePath();
        ctx.fillStyle = antenna.isCommunicating ? '#FF0000' : '#FFFF00';
        ctx.fill();
        ctx.restore();
    }

    // Add antenna name
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '10px Arial';
    ctx.fillText(antenna.name.split(' ')[0], x + 8, y - 8);
}

// Draws a satellite
function drawSatellite(satellite) {
    const { x, y } = satellite; // Satellite coordinates on canvas are stored directly

    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2); // Slightly larger than antenna point
    // Satellite color: Red if locked in communication, Deep Sky Blue otherwise
    ctx.fillStyle = satellite.isLocked ? '#FF0000' : '#00BFFF';
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Add satellite name
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '10px Arial';
    ctx.fillText(satellite.name, x + 8, y - 8);
}

// Main drawing function
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear canvas
    drawEarth();
    antennas.forEach(drawAntenna);
    satellites.forEach(drawSatellite); // Draw satellites
}

// Function to resize the canvas
function resizeCanvas() {
    const containerWidth = canvas.parentElement.clientWidth;
    // Keep canvas square
    canvas.width = containerWidth;
    canvas.height = containerWidth;

    // Recalculate Earth radius and center
    earthRadius = Math.min(canvas.width, canvas.height) * 0.4; // 40% of the smaller side
    centerX = canvas.width / 2;
    centerY = canvas.height / 2;

    draw(); // Redraw everything after resizing
}

// --- Antenna Control Logic ---

// Toggles antenna On/Off state
function toggleAntenna(antennaId) {
    const antenna = antennas.find(a => a.id === antennaId);
    if (antenna) {
        antenna.isOn = !antenna.isOn;
        if (antenna.isOn) {
            antenna.toggleButton.textContent = 'Desligar';
            antenna.toggleButton.classList.remove('off');
            antenna.toggleButton.classList.add('on');
            antenna.manualAzimuthInput.disabled = false;
            antenna.manualElevationInput.disabled = false;
            antenna.autoButton.disabled = false;
            antenna.trackSatButton.disabled = false;
            antenna.commButton.disabled = true; // Communication disabled initially
        } else {
            antenna.toggleButton.textContent = 'Ligar';
            antenna.toggleButton.classList.remove('on');
            antenna.toggleButton.classList.add('off');
            antenna.isAuto = false;
            antenna.isTrackingSatellite = false;
            antenna.isCommunicating = false; // Turn off communication
            if (antenna.trackedSatelliteId) {
                const sat = satellites.find(s => s.id === antenna.trackedSatelliteId);
                if (sat) sat.isLocked = false; // Unlock satellite
            }
            antenna.trackedSatelliteId = null;
            antenna.autoButton.textContent = 'Automático';
            antenna.autoButton.classList.remove('auto-mode-on');
            antenna.autoButton.classList.add('auto-mode-off');
            antenna.manualAzimuthInput.disabled = true;
            antenna.manualElevationInput.disabled = true;
            antenna.autoButton.disabled = true;
            antenna.trackSatButton.disabled = true;
            antenna.commButton.disabled = true; // Disable communication button
            antenna.commButton.textContent = 'Comunicação';
            antenna.commButton.classList.remove('active-comm');
        }
        draw();
        updateSatelliteTrackingStatus();
        updateTelemetryDisplay();
        updateSatelliteSignalDisplays();
        updateAlarmButtons();
        updateCommButtons(); // Update communication buttons
    }
}

// Updates antenna azimuth (manual)
function updateAzimuth(antennaId, value) {
    const antenna = antennas.find(a => a.id === antennaId);
    if (antenna && antenna.isOn && !antenna.isAuto && !antenna.isTrackingSatellite && !antenna.isCommunicating) {
        antenna.azimuth = parseInt(value);
        antenna.azimuthValueSpan.textContent = `${antenna.azimuth}°`;
        draw();
    } else if (antenna.isAuto || antenna.isTrackingSatellite || antenna.isCommunicating) {
        antenna.manualAzimuthInput.value = antenna.azimuth;
    }
}

// Updates antenna elevation (manual)
function updateElevation(antennaId, value) {
    const antenna = antennas.find(a => a.id === antennaId);
    if (antenna && antenna.isOn && !antenna.isAuto && !antenna.isTrackingSatellite && !antenna.isCommunicating) {
        antenna.elevation = parseInt(value);
        antenna.elevationValueSpan.textContent = `${antenna.elevation}°`;
        draw();
    } else if (antenna.isAuto || antenna.isTrackingSatellite || antenna.isCommunicating) {
        antenna.manualElevationInput.value = antenna.elevation;
    }
}

// Toggles antenna automatic mode (random target)
function toggleAutomaticMode(antennaId) {
    const antenna = antennas.find(a => a.id === antennaId);
    if (antenna && antenna.isOn) {
        antenna.isAuto = !antenna.isAuto;
        antenna.isTrackingSatellite = false; // Turn off satellite tracking if auto mode is toggled
        antenna.isCommunicating = false; // Turn off communication
        if (antenna.trackedSatelliteId) {
            const sat = satellites.find(s => s.id === antenna.trackedSatelliteId);
            if (sat) sat.isLocked = false; // Unlock satellite
        }
        antenna.trackedSatelliteId = null;

        if (antenna.isAuto) {
            antenna.autoButton.textContent = 'Manual';
            antenna.autoButton.classList.remove('auto-mode-off');
            antenna.autoButton.classList.add('auto-mode-on');
            antenna.manualAzimuthInput.disabled = true;
            antenna.manualElevationInput.disabled = true;
            antenna.trackSatButton.disabled = true;
            antenna.commButton.disabled = true; // Disable communication button
            // Set a random target
            antenna.targetAzimuth = Math.floor(Math.random() * 360);
            antenna.targetElevation = Math.floor(Math.random() * 91);
        } else {
            antenna.autoButton.textContent = 'Automático';
            antenna.autoButton.classList.remove('auto-mode-on');
            antenna.autoButton.classList.add('auto-mode-off');
            antenna.manualAzimuthInput.disabled = false;
            antenna.manualElevationInput.disabled = false;
            antenna.trackSatButton.disabled = false;
            antenna.commButton.disabled = true; // Disable communication button
        }
        draw();
        updateSatelliteTrackingStatus();
        updateTelemetryDisplay();
        updateSatelliteSignalDisplays();
        updateAlarmButtons();
        updateCommButtons(); // Update communication buttons
    } else if (!antenna.isOn) {
        // Antenna must be ON to activate automatic mode.
    }
}

// Sets a specific satellite for an antenna to track
function setSatelliteToTrack(antennaId, satelliteId) {
    const antenna = antennas.find(a => a.id === antennaId);
    const satellite = satellites.find(s => s.id === satelliteId);

    if (antenna && satellite && antenna.isOn) {
        // If already tracking this satellite, turn off tracking
        if (antenna.isTrackingSatellite && antenna.trackedSatelliteId === satellit
