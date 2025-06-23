import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Mail, RefreshCw } from 'lucide-react';

const NeedVerification: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isResending, setIsResending] = useState(false);
  
  // Get the email from location state
  const email = location.state?.email || '';
  const userId = location.state?.userId || '';
  
  const handleResendVerification = async () => {
    if (!email) {
      toast.error('Email address is missing. Please go back to login.');
      return;
    }
    
    setIsResending(true);
    
    try {
      const response = await fetch('http://127.0.0.1:5000/resend-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        toast.success('Verification email sent successfully!');
      } else {
        toast.error(data.error || 'Failed to send verification email');
      }
    } catch (error) {
      console.error('Error resending verification:', error);
      toast.error('Failed to send verification email. Please try again later.');
    } finally {
      setIsResending(false);
    }
  };
  
  const handleBackToLogin = () => {
    navigate('/');
  };
  
  return (
    <div className="w-full max-w-md mx-auto mt-20">
      <Card className="border-border">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center text-primary">
            Email Verification Required
          </CardTitle>
          <CardDescription className="text-center">
            Please verify your email address to continue
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex justify-center">
            <Mail className="h-16 w-16 text-primary" />
          </div>
          
          <div className="text-center space-y-4">
            <p className="text-lg">We've sent a verification email to:</p>
            <p className="text-lg font-bold text-primary">{email}</p>
            <p className="text-sm text-muted-foreground">
              Please check your inbox and click the verification link to activate your account.
              If you don't see the email, check your spam folder.
            </p>
          </div>
          
          <div className="space-y-3">
            <Button 
              className="w-full"
              variant="outline"
              onClick={handleResendVerification}
              disabled={isResending}
            >
              {isResending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                'Resend Verification Email'
              )}
            </Button>
            
            <Button 
              className="w-full"
              onClick={handleBackToLogin}
            >
              Back to Login
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default NeedVerification; 