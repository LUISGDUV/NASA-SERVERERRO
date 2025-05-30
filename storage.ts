import { 
  satellites, missions, groundStations, telemetryData, activities,
  type Satellite, type Mission, type GroundStation, type TelemetryData, type Activity,
  type InsertSatellite, type InsertMission, type InsertGroundStation, 
  type InsertTelemetryData, type InsertActivity
} from "@shared/schema";

export interface IStorage {
  // Satellites
  getSatellites(): Promise<Satellite[]>;
  getSatellite(id: number): Promise<Satellite | undefined>;
  createSatellite(satellite: InsertSatellite): Promise<Satellite>;
  updateSatellite(id: number, satellite: Partial<InsertSatellite>): Promise<Satellite | undefined>;
  
  // Missions
  getCurrentMission(): Promise<Mission | undefined>;
  createMission(mission: InsertMission): Promise<Mission>;
  updateMission(id: number, mission: Partial<InsertMission>): Promise<Mission | undefined>;
  
  // Ground Stations
  getGroundStations(): Promise<GroundStation[]>;
  createGroundStation(station: InsertGroundStation): Promise<GroundStation>;
  
  // Telemetry
  getLatestTelemetry(): Promise<TelemetryData | undefined>;
  createTelemetryData(data: InsertTelemetryData): Promise<TelemetryData>;
  
  // Activities
  getRecentActivities(limit?: number): Promise<Activity[]>;
  createActivity(activity: InsertActivity): Promise<Activity>;
}

export class MemStorage implements IStorage {
  private satellites: Map<number, Satellite> = new Map();
  private missions: Map<number, Mission> = new Map();
  private groundStations: Map<number, GroundStation> = new Map();
  private telemetryData: Map<number, TelemetryData> = new Map();
  private activities: Map<number, Activity> = new Map();
  
  private currentId = {
    satellites: 1,
    missions: 1,
    groundStations: 1,
    telemetryData: 1,
    activities: 1,
  };

  constructor() {
    this.initializeData();
  }

  private initializeData() {
    // Initialize satellites
    const satelliteData: InsertSatellite[] = [
      {
        name: "SAT-2847",
        type: "LEO",
        altitude: 408,
        latitude: 45.5,
        longitude: -122.6,
        signalStrength: 98.7,
        status: "active"
      },
      {
        name: "SAT-1903", 
        type: "GEO",
        altitude: 35786,
        latitude: 0,
        longitude: -75.0,
        signalStrength: 94.2,
        status: "active"
      },
      {
        name: "SAT-4201",
        type: "MEO", 
        altitude: 20200,
        latitude: 30.2,
        longitude: 45.8,
        signalStrength: 87.1,
        status: "active"
      }
    ];

    satelliteData.forEach(sat => {
      const id = this.currentId.satellites++;
      this.satellites.set(id, { 
        ...sat, 
        id, 
        lastContact: new Date() 
      });
    });

    // Initialize mission
    const missionId = this.currentId.missions++;
    this.missions.set(missionId, {
      id: missionId,
      name: "Global Satellite Network",
      status: "active",
      startTime: new Date(Date.now() - 47 * 3600000 - 23 * 60000 - 15 * 1000),
      activeSatellites: 47,
      inTransit: 3,
      maintenance: 2
    });

    // Initialize ground stations
    const stationData: InsertGroundStation[] = [
      {
        name: "Houston, TX",
        location: "United States",
        status: "online",
        latitude: 29.7604,
        longitude: -95.3698
      },
      {
        name: "Kourou, French Guiana", 
        location: "French Guiana",
        status: "online",
        latitude: 5.1662,
        longitude: -52.6880
      },
      {
        name: "Baikonur, Kazakhstan",
        location: "Kazakhstan", 
        status: "standby",
        latitude: 45.9650,
        longitude: 63.3050
      }
    ];

    stationData.forEach(station => {
      const id = this.currentId.groundStations++;
      this.groundStations.set(id, { ...station, id });
    });

    // Initialize telemetry
    const telemetryId = this.currentId.telemetryData++;
    this.telemetryData.set(telemetryId, {
      id: telemetryId,
      uplinkStrength: 92.4,
      downlinkRate: 2.4,
      networkLatency: 47,
      powerStatus: "optimal",
      thermalStatus: "normal", 
      antennaStatus: "caution",
      positioningStatus: "locked",
      timestamp: new Date()
    });

    // Initialize activities
    const activityData: InsertActivity[] = [
      {
        message: "SAT-2847 orbit adjustment completed",
        type: "success"
      },
      {
        message: "Data download from SAT-1903",
        type: "info"
      },
      {
        message: "Connection established SAT-4201",
        type: "success"
      }
    ];

    activityData.forEach((activity, index) => {
      const id = this.currentId.activities++;
      this.activities.set(id, { 
        ...activity, 
        id,
        timestamp: new Date(Date.now() - (index + 1) * 60000)
      });
    });
  }

  async getSatellites(): Promise<Satellite[]> {
    return Array.from(this.satellites.values());
  }

  async getSatellite(id: number): Promise<Satellite | undefined> {
    return this.satellites.get(id);
  }

  async createSatellite(satellite: InsertSatellite): Promise<Satellite> {
    const id = this.currentId.satellites++;
    const newSatellite: Satellite = { 
      ...satellite, 
      id, 
      lastContact: new Date() 
    };
    this.satellites.set(id, newSatellite);
    return newSatellite;
  }

  async updateSatellite(id: number, satellite: Partial<InsertSatellite>): Promise<Satellite | undefined> {
    const existing = this.satellites.get(id);
    if (!existing) return undefined;
    
    const updated: Satellite = { 
      ...existing, 
      ...satellite,
      lastContact: new Date()
    };
    this.satellites.set(id, updated);
    return updated;
  }

  async getCurrentMission(): Promise<Mission | undefined> {
    return Array.from(this.missions.values()).find(m => m.status === "active");
  }

  async createMission(mission: InsertMission): Promise<Mission> {
    const id = this.currentId.missions++;
    const newMission: Mission = { 
      ...mission, 
      id,
      activeSatellites: mission.activeSatellites ?? 0,
      inTransit: mission.inTransit ?? 0,
      maintenance: mission.maintenance ?? 0
    };
    this.missions.set(id, newMission);
    return newMission;
  }

  async updateMission(id: number, mission: Partial<InsertMission>): Promise<Mission | undefined> {
    const existing = this.missions.get(id);
    if (!existing) return undefined;
    
    const updated: Mission = { 
      ...existing, 
      ...mission,
      activeSatellites: mission.activeSatellites ?? existing.activeSatellites,
      inTransit: mission.inTransit ?? existing.inTransit,
      maintenance: mission.maintenance ?? existing.maintenance
    };
    this.missions.set(id, updated);
    return updated;
  }

  async getGroundStations(): Promise<GroundStation[]> {
    return Array.from(this.groundStations.values());
  }

  async createGroundStation(station: InsertGroundStation): Promise<GroundStation> {
    const id = this.currentId.groundStations++;
    const newStation: GroundStation = { ...station, id };
    this.groundStations.set(id, newStation);
    return newStation;
  }

  async getLatestTelemetry(): Promise<TelemetryData | undefined> {
    const allTelemetry = Array.from(this.telemetryData.values());
    return allTelemetry.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];
  }

  async createTelemetryData(data: InsertTelemetryData): Promise<TelemetryData> {
    const id = this.currentId.telemetryData++;
    const newData: TelemetryData = { 
      ...data, 
      id, 
      timestamp: new Date() 
    };
    this.telemetryData.set(id, newData);
    return newData;
  }

  async getRecentActivities(limit: number = 10): Promise<Activity[]> {
    return Array.from(this.activities.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  async createActivity(activity: InsertActivity): Promise<Activity> {
    const id = this.currentId.activities++;
    const newActivity: Activity = { 
      ...activity, 
      id, 
      timestamp: new Date() 
    };
    this.activities.set(id, newActivity);
    return newActivity;
  }
}

export const storage = new MemStorage();
