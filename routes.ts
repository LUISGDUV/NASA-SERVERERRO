import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import type { RealTimeData } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // WebSocket server for real-time updates
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  // API Routes
  app.get("/api/satellites", async (req, res) => {
    try {
      const satellites = await storage.getSatellites();
      res.json(satellites);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch satellites" });
    }
  });

  app.get("/api/mission", async (req, res) => {
    try {
      const mission = await storage.getCurrentMission();
      if (!mission) {
        return res.status(404).json({ error: "No active mission found" });
      }
      res.json(mission);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch mission data" });
    }
  });

  app.get("/api/ground-stations", async (req, res) => {
    try {
      const stations = await storage.getGroundStations();
      res.json(stations);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch ground stations" });
    }
  });

  app.get("/api/telemetry", async (req, res) => {
    try {
      const telemetry = await storage.getLatestTelemetry();
      if (!telemetry) {
        return res.status(404).json({ error: "No telemetry data found" });
      }
      res.json(telemetry);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch telemetry data" });
    }
  });

  app.get("/api/activities", async (req, res) => {
    try {
      const activities = await storage.getRecentActivities(10);
      res.json(activities);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch activities" });
    }
  });

  app.post("/api/satellites/:id/command", async (req, res) => {
    try {
      const { id } = req.params;
      const { command } = req.body;
      
      const satellite = await storage.getSatellite(parseInt(id));
      if (!satellite) {
        return res.status(404).json({ error: "Satellite not found" });
      }

      // Log the command as an activity
      await storage.createActivity({
        message: `Command sent to ${satellite.name}: ${command}`,
        type: "info"
      });

      res.json({ success: true, message: `Command "${command}" sent to ${satellite.name}` });
    } catch (error) {
      res.status(500).json({ error: "Failed to send command" });
    }
  });

  // Global emergency state
  let globalEmergencyMode = false;
  let globalRestoringMode = false;
  const connectedClients = new Set<WebSocket>();

  // Function to broadcast emergency state to all clients
  function broadcastEmergencyState(emergencyMode: boolean) {
    globalEmergencyMode = emergencyMode;
    const message = JSON.stringify({
      type: 'emergency_state',
      emergencyMode: emergencyMode,
      forceAlarm: true // Force alarm to play on all devices
    });

    connectedClients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  // Function to broadcast restoration state to all clients
  function broadcastRestorationState(isRestoring: boolean) {
    globalRestoringMode = isRestoring;
    const message = JSON.stringify({
      type: 'restoration_state',
      isRestoring: isRestoring
    });

    connectedClients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  // WebSocket connection handling
  wss.on('connection', (ws) => {
    console.log('Client connected to WebSocket');
    connectedClients.add(ws);

    // Send current emergency state to new client
    if (globalEmergencyMode) {
      ws.send(JSON.stringify({
        type: 'emergency_state',
        emergencyMode: true
      }));
    }

    // Send current restoration state to new client
    if (globalRestoringMode) {
      ws.send(JSON.stringify({
        type: 'restoration_state',
        isRestoring: true
      }));
    }

    // Send initial data
    sendRealTimeData(ws);

    // Handle incoming messages
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        if (data.type === 'trigger_emergency') {
          console.log('Emergency triggered by client');
          broadcastEmergencyState(true);
        } else if (data.type === 'trigger_restoration') {
          console.log('Restoration triggered by client');
          // Immediately start restoration on all devices
          broadcastRestorationState(true);
          
          // After 10 seconds, complete the restoration and stop emergency
          setTimeout(() => {
            console.log('Restoration completed');
            // First stop restoration screen
            broadcastRestorationState(false);
            // Then stop emergency mode and alarms
            broadcastEmergencyState(false);
          }, 10000);
        } else if (data.type === 'cancel_restoration') {
          console.log('Restoration cancelled by client');
          // Cancel restoration on all devices
          broadcastRestorationState(false);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    });

    // Send updates every 3 seconds
    const interval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        sendRealTimeData(ws);
      }
    }, 3000);

    ws.on('close', () => {
      console.log('Client disconnected from WebSocket');
      connectedClients.delete(ws);
      clearInterval(interval);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      connectedClients.delete(ws);
      clearInterval(interval);
    });
  });

  async function sendRealTimeData(ws: WebSocket) {
    try {
      // Update telemetry with realistic fluctuations
      const currentTelemetry = await storage.getLatestTelemetry();
      if (currentTelemetry) {
        const updatedTelemetry = {
          uplinkStrength: Math.max(88, Math.min(98, currentTelemetry.uplinkStrength + (Math.random() - 0.5) * 1.5)),
          downlinkRate: Math.max(2.0, Math.min(3.0, currentTelemetry.downlinkRate + (Math.random() - 0.5) * 0.2)),
          networkLatency: Math.max(30, Math.min(80, currentTelemetry.networkLatency + Math.floor((Math.random() - 0.5) * 10))),
          powerStatus: currentTelemetry.powerStatus,
          thermalStatus: currentTelemetry.thermalStatus,
          antennaStatus: currentTelemetry.antennaStatus,
          positioningStatus: currentTelemetry.positioningStatus
        };
        
        await storage.createTelemetryData(updatedTelemetry);
      }

      // Update satellite signal strengths
      const satellites = await storage.getSatellites();
      for (const satellite of satellites) {
        const newSignalStrength = Math.max(85, Math.min(99, satellite.signalStrength + (Math.random() - 0.5) * 2));
        await storage.updateSatellite(satellite.id, { signalStrength: newSignalStrength });
      }

      // Get fresh data for WebSocket transmission
      const realTimeData: RealTimeData = {
        satellites: await storage.getSatellites(),
        mission: await storage.getCurrentMission() || {} as any,
        groundStations: await storage.getGroundStations(),
        telemetry: await storage.getLatestTelemetry() || {} as any,
        activities: await storage.getRecentActivities(5)
      };

      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(realTimeData));
      }
    } catch (error) {
      console.error('Error sending real-time data:', error);
    }
  }

  return httpServer;
}
