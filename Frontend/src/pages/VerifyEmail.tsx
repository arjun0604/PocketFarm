import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

const VerifyEmail: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState<string>('Verifying your email...');

  useEffect(() => {
    const verifyEmail = async () => {
      try {
        const token = searchParams.get('token');
        const userId = searchParams.get('user_id');

        if (!token || !userId) {
          setStatus('error');
          setMessage('Invalid verification link. The link may be malformed or expired.');
          return;
        }

        // Call the API to verify the email
        const response = await fetch(`http://127.0.0.1:5000/verify-email?token=${token}&user_id=${userId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          }
        });

        const data = await response.json();

        if (response.ok) {
          setStatus('success');
          setMessage('Your email has been verified successfully!');
        } else {
          setStatus('error');
          setMessage(data.error || 'Failed to verify your email. The link may have expired.');
        }
      } catch (error) {
        console.error('Verification error:', error);
        setStatus('error');
        setMessage('An error occurred during verification. Please try again later.');
      }
    };

    verifyEmail();
  }, [searchParams]);

  const handleGoToLogin = () => {
    navigate('/');
  };

  return (
    <div className="w-full max-w-md mx-auto mt-20">
      <Card className="border-border">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center text-primary">
            Email Verification
          </CardTitle>
          <CardDescription className="text-center">
            {status === 'loading' ? 'Please wait while we verify your email' : (
              status === 'success' ? 'You can now log in to your account' : 'There was a problem with verification'
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 text-center">
          <div className="flex justify-center">
            {status === 'loading' && <Loader2 className="h-16 w-16 text-primary animate-spin" />}
            {status === 'success' && <CheckCircle className="h-16 w-16 text-green-500" />}
            {status === 'error' && <XCircle className="h-16 w-16 text-destructive" />}
          </div>
          
          <p className="text-lg">{message}</p>
          
          {(status === 'success' || status === 'error') && (
            <Button 
              className="w-full"
              onClick={handleGoToLogin}
            >
              Go to Login
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default VerifyEmail; 