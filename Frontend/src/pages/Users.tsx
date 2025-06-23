import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronLeft } from 'lucide-react';
import axios from 'axios';
import Header from '@/components/Header';

interface User {
  id: number;
  name: string;
  email: string;
  location: string;
}

const Users: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await axios.get('http://127.0.0.1:5000/users');
        setUsers(response.data);
      } catch (error) {
        console.error('Error fetching users:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (isAuthenticated) {
      fetchUsers();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header 
        title="Users" 
        showBackButton 
        onBackClick={() => navigate('/garden')}
      />
      
      <main className="container mx-auto px-4 py-8">
        {isLoading ? (
          <div className="text-center py-12">
            <p>Loading users...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {users.map((user) => (
              <Card key={user.id} className="border-pocketfarm-secondary/30">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold text-pocketfarm-primary">
                    {user.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600">{user.email}</p>
                    <p className="text-sm text-gray-500">Location: {user.location}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Users; 