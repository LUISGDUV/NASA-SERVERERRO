import { useEffect, useState, useRef } from 'react';
import type { RealTimeData } from '@shared/schema';

export function useWebSocket() {
  const [data, setData] = useState<RealTimeData | null>(null);
  const [connected, setConnected] = useState(false);
  const [emergencyMode, setEmergencyMode] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const ws = useRef<WebSocket | null>(null);
  const alarmRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null); // Ref for AudioContext
  const oscillatorRef = useRef<OscillatorNode | null>(null); // Ref for OscillatorNode
  const gainNodeRef = useRef<GainNode | null>(null); // Ref for GainNode

  useEffect(() => {
    // Initialize Web Audio API for stronger alarm
    try {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (error) {
      console.error('Web Audio API not supported:', error);
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    const connect = () => {
      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        console.log('WebSocket connected');
        setConnected(true);
      };

      ws.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          // Handle emergency state messages
          if (message.type === 'emergency_state') {
            if (message.emergencyMode) {
              // Emergency triggered - force alarm on ALL devices
              setEmergencyMode(true);
              setConnected(false);
              startAlarm(); // Always start alarm when emergency is broadcasted
            } else if (!message.emergencyMode && emergencyMode) {
              // Emergency restored by another client
              setEmergencyMode(false);
              stopAlarm();
            }
            return;
          }

          // Handle restoration state messages
          if (message.type === 'restoration_state') {
            if (message.isRestoring && !isRestoring) {
              // Restoration triggered by another client
              setIsRestoring(true);
              // Keep alarm playing during restoration process
            } else if (!message.isRestoring && isRestoring) {
              // Restoration completed or cancelled
              setIsRestoring(false);
              if (!emergencyMode) {
                // If not in emergency, just hide restoration screen
                return;
              }
              // If in emergency and restoration completed, exit emergency
              setEmergencyMode(false);
              stopAlarm();
              // Reconnect after restoration
              setConnected(true);
            }
            return;
          }
          
          // Handle regular real-time data
          const realTimeData: RealTimeData = message;
          if (!emergencyMode) {
            setData(realTimeData);
          }
        } catch (error) {
          console.error('Error parsing WebSocket data:', error);
        }
      };

      ws.current.onclose = () => {
        console.log('WebSocket disconnected');
        setConnected(false);
        if (!emergencyMode) {
          setTimeout(connect, 3000);
        }
      };

      ws.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnected(false);
      };
    };

    connect();

    return () => {
      if (ws.current) {
        ws.current.close();
      }
      stopAlarm();
    };
  }, [emergencyMode]);

  const startAlarm = () => {
    if (!audioContextRef.current) {
      console.warn('Web Audio API not initialized.');
      return;
    }

    try {
      // Create oscillator
      oscillatorRef.current = audioContextRef.current.createOscillator();
      oscillatorRef.current.type = 'square'; // Square wave for more piercing sound
      
      // Create gain node (volume control)
      gainNodeRef.current = audioContextRef.current.createGain();
      gainNodeRef.current.gain.setValueAtTime(0.8, audioContextRef.current.currentTime); // High volume

      // Connect oscillator to gain node, and gain node to audio context destination
      oscillatorRef.current.connect(gainNodeRef.current);
      gainNodeRef.current.connect(audioContextRef.current.destination);

      // Create siren effect - alternating between high and low frequencies
      let isHighFreq = true;
      const now = audioContextRef.current.currentTime;
      oscillatorRef.current.frequency.setValueAtTime(800, now); // Start high

      // Create alternating siren pattern
      const sirenInterval = setInterval(() => {
        if (oscillatorRef.current && audioContextRef.current) {
          const currentTime = audioContextRef.current.currentTime;
          if (isHighFreq) {
            oscillatorRef.current.frequency.setValueAtTime(400, currentTime); // Low frequency
          } else {
            oscillatorRef.current.frequency.setValueAtTime(800, currentTime); // High frequency
          }
          isHighFreq = !isHighFreq;
        }
      }, 500); // Change frequency every 500ms

      // Store interval reference to clear it later
      (oscillatorRef.current as any).sirenInterval = sirenInterval;

      oscillatorRef.current.start();
    } catch (error) {
      console.error('Error playing alarm:', error);
    }
  };

  const stopAlarm = () => {
    try {
      if (oscillatorRef.current) {
        // Clear siren interval if it exists
        if ((oscillatorRef.current as any).sirenInterval) {
          clearInterval((oscillatorRef.current as any).sirenInterval);
        }
        
        oscillatorRef.current.stop();
        oscillatorRef.current.disconnect();
        oscillatorRef.current = null;
      }

      if (gainNodeRef.current) {
        gainNodeRef.current.disconnect();
        gainNodeRef.current = null;
      }
    } catch (error) {
      console.error('Error stopping alarm:', error);
    }
  };

  const triggerEmergencyShutdown = () => {
    // Immediately trigger emergency locally
    setEmergencyMode(true);
    setConnected(false);
    startAlarm();

    // Send emergency command to server to broadcast to ALL other clients
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({
        type: 'trigger_emergency'
      }));
    }
  };

  const restoreConnection = () => {
    // Start restoration locally
    setIsRestoring(true);
    
    // Send restoration trigger to server to coordinate all clients
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({
        type: 'trigger_restoration'
      }));
    }
    // Keep alarm playing until server confirms restoration is complete
  };

  const cancelRestoration = () => {
    // Cancel restoration locally
    setIsRestoring(false);
    
    // Send cancellation to server to stop restoration for all clients
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({
        type: 'cancel_restoration'
      }));
    }
  };

  return { data, connected, emergencyMode, isRestoring, triggerEmergencyShutdown, restoreConnection, cancelRestoration };
}