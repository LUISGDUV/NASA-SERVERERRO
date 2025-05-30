import { pgTable, text, serial, integer, boolean, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const satellites = pgTable("satellites", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(), // LEO, MEO, GEO
  altitude: real("altitude").notNull(), // in km
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  signalStrength: real("signal_strength").notNull(),
  status: text("status").notNull(), // active, maintenance, offline
  lastContact: timestamp("last_contact").notNull(),
});

export const missions = pgTable("missions", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  status: text("status").notNull(), // active, completed, planned
  startTime: timestamp("start_time").notNull(),
  activeSatellites: integer("active_satellites").notNull().default(0),
  inTransit: integer("in_transit").notNull().default(0),
  maintenance: integer("maintenance").notNull().default(0),
});

export const groundStations = pgTable("ground_stations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  location: text("location").notNull(),
  status: text("status").notNull(), // online, offline, standby
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
});

export const telemetryData = pgTable("telemetry_data", {
  id: serial("id").primaryKey(),
  uplinkStrength: real("uplink_strength").notNull(),
  downlinkRate: real("downlink_rate").notNull(),
  networkLatency: integer("network_latency").notNull(),
  powerStatus: text("power_status").notNull(),
  thermalStatus: text("thermal_status").notNull(),
  antennaStatus: text("antenna_status").notNull(),
  positioningStatus: text("positioning_status").notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export const activities = pgTable("activities", {
  id: serial("id").primaryKey(),
  message: text("message").notNull(),
  type: text("type").notNull(), // info, warning, error, success
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export const insertSatelliteSchema = createInsertSchema(satellites).omit({
  id: true,
  lastContact: true,
});

export const insertMissionSchema = createInsertSchema(missions).omit({
  id: true,
});

export const insertGroundStationSchema = createInsertSchema(groundStations).omit({
  id: true,
});

export const insertTelemetrySchema = createInsertSchema(telemetryData).omit({
  id: true,
  timestamp: true,
});

export const insertActivitySchema = createInsertSchema(activities).omit({
  id: true,
  timestamp: true,
});

export type Satellite = typeof satellites.$inferSelect;
export type InsertSatellite = z.infer<typeof insertSatelliteSchema>;
export type Mission = typeof missions.$inferSelect;
export type InsertMission = z.infer<typeof insertMissionSchema>;
export type GroundStation = typeof groundStations.$inferSelect;
export type InsertGroundStation = z.infer<typeof insertGroundStationSchema>;
export type TelemetryData = typeof telemetryData.$inferSelect;
export type InsertTelemetryData = z.infer<typeof insertTelemetrySchema>;
export type Activity = typeof activities.$inferSelect;
export type InsertActivity = z.infer<typeof insertActivitySchema>;

// Real-time data types for WebSocket
export interface RealTimeData {
  satellites: Satellite[];
  mission: Mission;
  groundStations: GroundStation[];
  telemetry: TelemetryData;
  activities: Activity[];
}

export interface SystemHealth {
  power: string;
  thermal: string;
  antenna: string;
  positioning: string;
}
