import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Eye, EyeOff, CheckCircle, XCircle } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

const AuthForm: React.FC = () => {
  const { login, signup, googleSignIn, isLoading, loginError } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('login');
  const [showPassword, setShowPassword] = useState(false);
  
  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  // Register form state
  const [name, setName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [phone, setPhone] = useState('');

  // Validation state
  const [emailError, setEmailError] = useState('');
  const [passwordErrors, setPasswordErrors] = useState<{
    length: boolean;
    uppercase: boolean;
    digit: boolean;
    symbol: boolean;
    noSpaces: boolean;
  }>({
    length: false,
    uppercase: false,
    digit: false,
    symbol: false,
    noSpaces: false
  });
  
  const validateEmail = (email: string): boolean => {
    const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(String(email).toLowerCase());
  };
  
  const validatePassword = (password: string): boolean => {
    const errors = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      digit: /[0-9]/.test(password),
      symbol: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
      noSpaces: !/\s/.test(password)
    };
    
    setPasswordErrors(errors);
    
    // Password is valid if all checks pass
    return Object.values(errors).every(value => value === true);
  };
  
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>, isLogin: boolean) => {
    const email = e.target.value;
    if (isLogin) {
      setLoginEmail(email);
    } else {
      setRegisterEmail(email);
    }
    
    if (email && !validateEmail(email)) {
      setEmailError('Please enter a valid email address');
    } else {
      setEmailError('');
    }
  };
  
  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const password = e.target.value;
    setRegisterPassword(password);
    
    // Only validate if on register tab and password has some content
    if (activeTab === 'register' && password) {
      validatePassword(password);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateEmail(loginEmail)) {
      setEmailError('Please enter a valid email address');
      return;
    }
    
    try {
      await login(loginEmail, loginPassword);
      toast.success('Login successful!');
      navigate('/dashboard');
    } catch (error) {
      console.error(error);
      
      // If the error is about email verification
      if (error instanceof Error && error.message.includes('Email not verified')) {
        // Extract user data from the error
        const errorData = JSON.parse(error.message.slice(error.message.indexOf('{')));
        
        // Navigate to the verification page
        navigate('/need-verification', { 
          state: { 
            email: errorData.email,
            userId: errorData.user_id
          } 
        });
        return;
      }
      
      toast.error(loginError || 'Login failed. Please check your credentials.');
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      // Show toast notification that we're starting the Google Sign-In process
      toast.info('Starting Google Sign-In process...');
      
      await googleSignIn();
      toast.success('Google sign-in successful!');
      navigate('/dashboard');
    } catch (error) {
      console.error(error);
      // Show more specific error message based on the error
      if (error instanceof Error) {
        if (error.message.includes('not loaded')) {
          toast.error('Google Sign-In API not loaded yet. Please try again in a moment.');
        } else if (error.message.includes('client_secret')) {
          toast.error('Server configuration error. Please contact support.');
        } else {
          toast.error(`Google sign-in failed: ${error.message}`);
        }
      } else {
        toast.error('Google sign-in failed. Please try again.');
      }
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError('');
    
    if (!validateEmail(registerEmail)) {
      setEmailError('Please enter a valid email address');
      return;
    }
    
    if (!validatePassword(registerPassword)) {
      toast.error('Please use a stronger password that meets all the requirements');
      return;
    }

    try {
      // Get user's location if allowed
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            try {
              const location = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude
              };
              
              // Call signup function with location
              const result = await signup(name, registerEmail, registerPassword, phone || '', location);
              
              // Show success message
              toast.success(result.message || 'Account created! Please check your email to verify your account.');
              
              // Redirect to verification page
              navigate('/need-verification', { state: { email: registerEmail } });
            } catch (error: any) {
              console.error('Registration error:', error);
              toast.error(error.message || 'Registration failed. Please try again.');
            }
          },
          (locationError) => {
            // Handle location error - continue with signup but without location
            console.warn('Location error:', locationError);
            handleSignupWithoutLocation();
          },
          { timeout: 10000, enableHighAccuracy: true }
        );
      } else {
        // Geolocation not supported
        handleSignupWithoutLocation();
      }
    } catch (error: any) {
      console.error('Registration error:', error);
      toast.error(error.message || 'Registration failed. Please try again.');
    }
  };
  
  const handleSignupWithoutLocation = async () => {
    try {
      // Use default location coordinates
      const location = { 
        latitude: 9.9312, // Kochi coordinates 
        longitude: 76.2673 
      };
      
      // Call signup function without location
      const result = await signup(name, registerEmail, registerPassword, phone || '', location);
      
      // Show success message
      toast.success(result.message || 'Account created! Please check your email to verify your account.');
      
      // Redirect to verification page
      navigate('/need-verification', { state: { email: registerEmail } });
    } catch (error: any) {
      console.error('Registration error:', error);
      toast.error(error.message || 'Registration failed. Please try again.');
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <Card className="border-pocketfarm-secondary/30">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center text-pocketfarm-primary">
            Welcome to PocketFarm
          </CardTitle>
          <CardDescription className="text-center">
            Your personal pocket-sized farm assistant
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login" value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="register">Register</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input 
                    id="login-email" 
                    type="email" 
                    placeholder="your@email.com" 
                    value={loginEmail}
                    onChange={(e) => handleEmailChange(e, true)}
                    required
                    className={emailError && activeTab === 'login' ? "border-red-500" : ""}
                  />
                  {emailError && activeTab === 'login' && (
                    <p className="text-red-500 text-xs mt-1">{emailError}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <div className="relative">
                    <Input 
                      id="login-password" 
                      type={showPassword ? 'text' : 'password'} 
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? 'Logging in...' : 'Login'}
                </Button>
                
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <Separator className="w-full" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">
                      Or continue with
                    </span>
                  </div>
                </div>
                
                <Button 
                  type="button" 
                  variant="outline"
                  className="w-full"
                  onClick={handleGoogleSignIn}
                  disabled={isLoading}
                >
                  <img 
                    src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" 
                    alt="Google" 
                    className="h-5 w-5 mr-2"
                  />
                  Sign in with Google
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="register">
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input 
                    id="name" 
                    placeholder="John Doe" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-email">Email</Label>
                  <Input 
                    id="register-email" 
                    type="email" 
                    placeholder="your@email.com" 
                    value={registerEmail}
                    onChange={(e) => handleEmailChange(e, false)}
                    required
                    className={emailError && activeTab === 'register' ? "border-red-500" : ""}
                  />
                  {emailError && activeTab === 'register' && (
                    <p className="text-red-500 text-xs mt-1">{emailError}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input 
                    id="phone" 
                    type="tel" 
                    placeholder="+1 (555) 123-4567" 
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-password">Password</Label>
                  <div className="relative">
                    <Input 
                      id="register-password" 
                      type={showPassword ? 'text' : 'password'} 
                      value={registerPassword}
                      onChange={(e) => handlePasswordChange(e)}
                      required
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  
                  {/* Password requirements */}
                  {activeTab === 'register' && registerPassword && (
                    <div className="mt-2 p-3 bg-muted rounded-md border text-sm">
                      <h4 className="font-medium mb-2">Password must contain:</h4>
                      <ul className="space-y-1">
                        <li className="flex items-center">
                          {passwordErrors.length ? (
                            <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500 mr-2" />
                          )}
                          At least 8 characters
                        </li>
                        <li className="flex items-center">
                          {passwordErrors.uppercase ? (
                            <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500 mr-2" />
                          )}
                          At least one uppercase letter
                        </li>
                        <li className="flex items-center">
                          {passwordErrors.digit ? (
                            <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500 mr-2" />
                          )}
                          At least one number
                        </li>
                        <li className="flex items-center">
                          {passwordErrors.symbol ? (
                            <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500 mr-2" />
                          )}
                          At least one special character
                        </li>
                        <li className="flex items-center">
                          {passwordErrors.noSpaces ? (
                            <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500 mr-2" />
                          )}
                          No spaces
                        </li>
                      </ul>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Location access is required to provide personalized crop suggestions based on your region.
                  </p>
                </div>
                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? 'Creating account...' : 'Create Account'}
                </Button>
                
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <Separator className="w-full" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">
                      Or continue with
                    </span>
                  </div>
                </div>
                
                <Button 
                  type="button" 
                  variant="outline"
                  className="w-full"
                  onClick={handleGoogleSignIn}
                  disabled={isLoading}
                >
                  <img 
                    src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" 
                    alt="Google" 
                    className="h-5 w-5 mr-2"
                  />
                  Sign up with Google
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
        <CardFooter>
          <p className="text-sm text-center w-full text-muted-foreground">
            By continuing, you agree to PocketFarm's Terms and Privacy Policy
          </p>
        </CardFooter>
      </Card>
    </div>
  );
};

export default AuthForm;