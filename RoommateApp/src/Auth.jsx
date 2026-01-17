import React, { useState } from 'react';
import { supabaseClient } from './config/supabaseClient';
import './Auth.css';

export default function Auth() {
  const [mode, setMode] = useState('signin'); // 'signin', 'signup', 'reset'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const clearMessage = () => setMessage({ type: '', text: '' });

  const handleSignUp = async () => {
    if (!email.trim() || !password || !firstName.trim() || !lastName.trim()) {
      setMessage({ type: 'error', text: 'Please fill in all fields' });
      return;
    }

    if (password.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters' });
      return;
    }

    setLoading(true);
    clearMessage();

    try {
      const { data, error } = await supabaseClient.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            first_name: firstName.trim(),
            last_name: lastName.trim(),
          },
        },
      });

      if (error) throw error;

      if (data.user) {
        setMessage({
          type: 'success',
          text: 'Account created! Please check your email to verify your account.',
        });
        setEmail('');
        setPassword('');
        setFirstName('');
        setLastName('');
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.message || 'Failed to create account',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async () => {
    if (!email.trim() || !password) {
      setMessage({ type: 'error', text: 'Please enter email and password' });
      return;
    }

    setLoading(true);
    clearMessage();

    try {
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) throw error;

      if (data.user) {
        setMessage({
          type: 'success',
          text: 'Successfully signed in!',
        });
        console.log('User signed in:', data.user);
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.message || 'Failed to sign in',
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!email.trim()) {
      setMessage({ type: 'error', text: 'Please enter your email address' });
      return;
    }

    setLoading(true);
    clearMessage();

    try {
      const { error } = await supabaseClient.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;

      setMessage({
        type: 'success',
        text: 'Password reset email sent! Check your inbox.',
      });
      setEmail('');
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.message || 'Failed to send reset email',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e, action) => {
    if (e.key === 'Enter') {
      action();
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-wrapper">
        <div className="auth-card">
          {/* Logo/Title */}
          <div className="auth-logo-section">
            <div className="auth-logo">
              <span className="auth-logo-text">R+</span>
            </div>
            <h1 className="auth-title">Roommate+</h1>
            <p className="auth-subtitle">Manage your household together</p>
          </div>

          {/* Tab Navigation */}
          <div className="auth-tabs">
            <button
              onClick={() => {
                setMode('signin');
                clearMessage();
              }}
              className={`auth-tab ${mode === 'signin' ? 'active' : ''}`}
            >
              Sign In
            </button>
            <button
              onClick={() => {
                setMode('signup');
                clearMessage();
              }}
              className={`auth-tab ${mode === 'signup' ? 'active' : ''}`}
            >
              Sign Up
            </button>
          </div>

          {/* Message Display */}
          {message.text && (
            <div className={`auth-message ${message.type}`}>
              {message.text}
            </div>
          )}

          {/* Sign In Form */}
          {mode === 'signin' && (
            <div className="auth-form">
              <div className="auth-form-group">
                <label className="auth-label">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyPress={(e) => handleKeyPress(e, handleSignIn)}
                  className="auth-input"
                  placeholder="you@example.com"
                />
              </div>

              <div className="auth-form-group">
                <label className="auth-label">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyPress={(e) => handleKeyPress(e, handleSignIn)}
                  className="auth-input"
                  placeholder="••••••••"
                />
              </div>

              <button
                type="button"
                onClick={() => {
                  setMode('reset');
                  clearMessage();
                }}
                className="auth-link-button"
              >
                Forgot password?
              </button>

              <button
                type="button"
                onClick={handleSignIn}
                disabled={loading}
                className="auth-button primary"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </div>
          )}

          {/* Sign Up Form */}
          {mode === 'signup' && (
            <div className="auth-form">
              <div className="auth-grid-2">
                <div className="auth-form-group">
                  <label className="auth-label">First Name</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="auth-input"
                    placeholder="John"
                  />
                </div>
                <div className="auth-form-group">
                  <label className="auth-label">Last Name</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="auth-input"
                    placeholder="Doe"
                  />
                </div>
              </div>

              <div className="auth-form-group">
                <label className="auth-label">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="auth-input"
                  placeholder="you@example.com"
                />
              </div>

              <div className="auth-form-group">
                <label className="auth-label">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyPress={(e) => handleKeyPress(e, handleSignUp)}
                  className="auth-input"
                  placeholder="••••••••"
                />
                <p className="auth-hint">Minimum 6 characters</p>
              </div>

              <button
                type="button"
                onClick={handleSignUp}
                disabled={loading}
                className="auth-button primary"
              >
                {loading ? 'Creating account...' : 'Create Account'}
              </button>
            </div>
          )}

          {/* Password Reset Form */}
          {mode === 'reset' && (
            <div className="auth-form">
              <p className="auth-reset-info">
                Enter your email address and we'll send you a link to reset your password.
              </p>

              <div className="auth-form-group">
                <label className="auth-label">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyPress={(e) => handleKeyPress(e, handlePasswordReset)}
                  className="auth-input"
                  placeholder="you@example.com"
                />
              </div>

              <button
                type="button"
                onClick={handlePasswordReset}
                disabled={loading}
                className="auth-button primary"
              >
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  clearMessage();
                }}
                className="auth-button secondary"
              >
                Back to Sign In
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="auth-footer">
          By continuing, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
}