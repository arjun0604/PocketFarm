import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Bell, LogOut, User, ChevronLeft } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { format } from 'date-fns';
import axios from 'axios';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { ThemeToggle } from '@/components/ThemeToggle';

interface Notification {
  id: number;
  message: string;
  timestamp: string;
  read: boolean;
}

interface HeaderProps {
  title: string;
  showBackButton?: boolean;
  onBackClick?: () => void;
  notifications?: Notification[];
}

const Header: React.FC<HeaderProps> = ({ 
  title, 
  showBackButton = false, 
  onBackClick,
  notifications = [] 
}) => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const [isNotificationDialogOpen, setIsNotificationDialogOpen] = useState(false);
  const unreadNotifications = notifications.filter(n => !n.read).length;
  const queryClient = useQueryClient();

  const handleNotificationDialogOpen = async () => {
    if (user && unreadNotifications > 0) {
      try {
        await axios.post(`http://127.0.0.1:5000/mark_notifications_read/${user.id}`);
        // Invalidate and refetch notifications instead of reloading the page
        queryClient.invalidateQueries({ queryKey: ['userNotifications', user.id] });
      } catch (error) {
        console.error('Error marking notifications as read:', error);
        toast.error('Failed to mark notifications as read');
      }
    }
    setIsNotificationDialogOpen(true);
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      console.error('Error logging out:', error);
      toast.error('Failed to log out. Please try again.');
    }
  };

  return (
    <header className="bg-background border-b border-border sticky top-0 z-10">
      <div className="container mx-auto px-4 py-3">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            {showBackButton && (
              <Button variant="ghost" size="icon" onClick={onBackClick} className="mr-1">
                <ChevronLeft className="h-5 w-5" />
              </Button>
            )}
            <h1 className="text-lg font-medium">{title}</h1>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <div className="relative">
              <Button 
                variant="ghost" 
                size="icon" 
                className="relative"
                onClick={handleNotificationDialogOpen}
              >
                <Bell className="h-5 w-5" />
                {unreadNotifications > 0 && (
                  <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs rounded-full h-4 w-4 flex items-center justify-center">
                    {unreadNotifications}
                  </span>
                )}
              </Button>
            </div>
            <Link to="/profile">
              <Button variant="ghost" size="icon" className="text-primary">
                <User className="h-5 w-5" />
              </Button>
            </Link>
            <Button variant="ghost" size="icon" className="text-muted-foreground" onClick={handleLogout}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={isNotificationDialogOpen} onOpenChange={setIsNotificationDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Notifications</DialogTitle>
            <DialogDescription>View your recent notifications and updates.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {notifications.length > 0 ? (
              <>
                <div>
                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        if (user) {
                          try {
                            await axios.post(`http://127.0.0.1:5000/clear_notifications/${user.id}`);
                            queryClient.invalidateQueries({ queryKey: ['userNotifications', user.id] });
                            toast.success('All notifications cleared');
                          } catch (error) {
                            console.error('Error clearing notifications:', error);
                            toast.error('Failed to clear notifications');
                          }
                        }
                      }}
                    >
                      Clear All
                    </Button>
                  </div>
                  {notifications.map((notification) => (
                    <div 
                      key={notification.id}
                      className={`p-3 rounded-lg ${
                        notification.read ? 'bg-muted/50' : 'bg-blue-50 dark:bg-blue-900/20'
                      }`}
                    >
                      <p className="text-sm">{notification.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(notification.timestamp), 'MMM dd, yyyy HH:mm')}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-center text-gray-500">No notifications</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </header>
  );
};

export default Header; 