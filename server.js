// server.js - Modified for Cloud Hosting (using import/export and dynamic port)
import express from 'express';
import cors from 'cors';
// Note: 'ws' is not needed since this server uses REST polling, not WebSockets.

const app = express();
// Use the port provided by the hosting environment (like Render),
// or default to 3000 for local testing.
const PORT = process.env.PORT || 3000;

// --- In-Memory State ---
// Stores the latest reported GPS and RSSI data for each device ID
// Key: DEVICE_ID, Value: { latitude, longitude, rssi, timestamp }
const deviceData = {};

// Stores the latest command issued to a device
// Key: DEVICE_ID, Value: { buzzer: true/false, timestamp }
const commands = {};

// --- Middleware Setup ---
// Allow ALL origins for easy hosting configuration
app.use(cors()); 
// Parse incoming JSON data
app.use(express.json()); 

// Helper function to validate basic GPS data
function isValidGpsData(data) {
    return (
        typeof data.latitude === 'number' &&
        typeof data.longitude === 'number' &&
        typeof data.rssi !== 'undefined'
    );
}

// --- API Endpoints ---

// 1. ESP32 POST Endpoint (Tracker sends data)
// Endpoint: POST /api/data/{device_id}
app.post('/api/data/:deviceId', (req, res) => {
    const deviceId = req.params.deviceId;
    const data = req.body;

    if (!isValidGpsData(data)) {
        console.error(`[ERROR] Invalid data received for ${deviceId}:`, data);
        return res.status(400).send({ message: 'Invalid GPS data structure.' });
    }

    // Update in-memory storage
    deviceData[deviceId] = {
        ...data,
        timestamp: Date.now() // Record server time
    };

    console.log(`[POST DATA] Device ${deviceId} updated. Lat: ${data.latitude}`);
    res.status(200).send({ message: 'Data accepted.' });
});


// 2. DASHBOARD GET Endpoint (Frontend polls for data)
// Endpoint: GET /api/data/{device_id}
app.get('/api/data/:deviceId', (req, res) => {
    const deviceId = req.params.deviceId;
    const latestData = deviceData[deviceId];

    if (!latestData) {
        // Return a 200 with a known format if no data, instead of 404,
        // to simplify frontend error handling.
        return res.status(200).send({ message: 'No data found for device.', latitude: null, longitude: null });
    }

    // Return the latest data
    res.status(200).json(latestData);
});


// 3. DASHBOARD POST Command (Frontend sends buzzer command)
// Endpoint: POST /api/command/{device_id}
app.post('/api/command/:deviceId', (req, res) => {
    const deviceId = req.params.deviceId;

    // Command structure for the buzzer
    commands[deviceId] = {
        buzzer: true, // Set command active
        timestamp: Date.now()
    };
    
    console.log(`[POST COMMAND] Buzzer command sent to ${deviceId}.`);
    res.status(200).send({ message: 'Command queued.' });
});


// 4. ESP32 GET Command (Tracker polls for command status)
// Endpoint: GET /api/command/{device_id}
app.get('/api/command/:deviceId', (req, res) => {
    const deviceId = req.params.deviceId;
    const command = commands[deviceId] || { buzzer: false };

    // Send the current command state to the device
    res.status(200).json(command);

    // CRITICAL: Immediately reset the command after the device reads it.
    if (command.buzzer) {
        commands[deviceId] = { buzzer: false, timestamp: Date.now() };
        console.log(`[GET COMMAND] Command state reset for ${deviceId}.`);
    }
});


// Start the server
app.listen(PORT, () => {
    console.log(`REST API Server running on port ${PORT}`);
});

// Initialize with a default placeholder state for testing
const DEFAULT_DEVICE_ID = 'VX0dFVvmu1QSpQdvj1p74iyfx9n1';
deviceData[DEFAULT_DEVICE_ID] = {
    latitude: 14.5995, 
    longitude: 120.9842, 
    rssi: -90, 
    timestamp: Date.now() 
};
console.log(`[INIT] Default device (${DEFAULT_DEVICE_ID}) data initialized.`);