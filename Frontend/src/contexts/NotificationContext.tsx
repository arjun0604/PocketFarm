import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';

interface NotificationContextType {
  notifications: Notification[];
  addNotification: (notification: Notification) => void;
  clearNotifications: () => void;
  markAsRead: (id: number) => void;
}

interface Notification {
  id: number;
  message: string;
  timestamp: string;
  read: boolean;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);
  const { user } = useAuth();

  const addNotification = (notification: Notification) => {
    setNotifications(prev => [...prev, notification]);
  };

  const clearNotifications = () => {
    setNotifications([]);
  };

  const markAsRead = (id: number) => {
    setNotifications(prev =>
      prev.map(notification =>
        notification.id === id
          ? { ...notification, read: true }
          : notification
      )
    );
  };

  useEffect(() => {
    if (user) {
      // Initialize socket connection with proper CORS settings
      const newSocket = io('http://127.0.0.1:5000', {
        withCredentials: true,
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
        autoConnect: true,
        forceNew: true
      });

      // Handle connection events
      newSocket.on('connect', () => {
        console.log('Socket connected');
        // Join user's room
        newSocket.emit('join_room', { room: `user_${user.id}` });
      });

      newSocket.on('disconnect', () => {
        console.log('Socket disconnected');
      });

      newSocket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
      });

      // Handle weather updates
      newSocket.on('weather_update', (data) => {
        if (data.user_id === user.id) {
          addNotification({
            id: Date.now(),
            message: `Weather Update: ${data.weather_data.weather[0].description}`,
            timestamp: new Date().toISOString(),
            read: false
          });
        }
      });

      // Handle weather alerts
      newSocket.on('weather_alert', (alerts) => {
        alerts.forEach((alert: any) => {
          addNotification({
            id: Date.now(),
            message: alert.message,
            timestamp: new Date().toISOString(),
            read: false
          });
        });
      });

      setSocket(newSocket);

      // Cleanup on unmount
      return () => {
        newSocket.close();
      };
    }
  }, [user]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        addNotification,
        clearNotifications,
        markAsRead
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}; 