'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Power,
  PowerOff,
  Settings,
  Activity,
  Clock,
  Brain,
  Target,
  AlertTriangle,
  CheckCircle,
  Loader,
  Pause,
  Play,
  RotateCcw
} from 'lucide-react';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { Slider } from './ui/slider';
import { Badge } from './ui/badge';
import { Card } from './ui/card';
import { useStreamSubscription } from '@/plugins/streams/hooks/useStreamSubscription';

interface IdleSession {
  id: string;
  mode: 'exploration' | 'research' | 'creation' | 'optimization';
  status: 'active' | 'paused' | 'completed' | 'terminated';
  startTime: string;
  endTime?: string;
  goals: string[];
  activities: number;
  discoveries: number;
  coherenceLevel: number;
}

interface IdleConfig {
  enabled: boolean;
  idleThreshold: number; // minutes
  maxSessionDuration: number; // minutes
  evolutionIntensity: 'conservative' | 'moderate' | 'adventurous';
  safetyLevel: 'high' | 'medium' | 'low';
  coherenceFloor: number;
  allowedGoalTypes: string[];
  researchDomains: string[];
  externalPublishing: boolean;
  subagentCoordination: boolean;
}

interface IdleModeStatus {
  isIdle: boolean;
  idleDuration: number;
  lastActivity: string;
  currentSession?: IdleSession;
  sessionHistory: IdleSession[];
  config: IdleConfig;
  learningHistory: any[];
  emergentCategories: string[];
}

interface IdleModePanelProps {
  sessionId?: string;
}

export default function IdleModePanel({ sessionId }: IdleModePanelProps) {
  const [status, setStatus] = useState<IdleModeStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [configMode, setConfigMode] = useState(false);

  // WebSocket connection for real-time updates
  const { connected: wsConnected, subscribe, unsubscribe } = useStreamSubscription({
    sessionId: sessionId || 'default',
    autoConnect: true
  });

  // Subscribe to idle mode events
  useEffect(() => {
    if (wsConnected && sessionId) {
      subscribe('idle-mode');
      subscribe('autonomous-sessions');

      return () => {
        unsubscribe('idle-mode');
        unsubscribe('autonomous-sessions');
      };
    }
  }, [wsConnected, sessionId, subscribe, unsubscribe]);

  // Load initial status
  useEffect(() => {
    if (!sessionId) return;

    const loadStatus = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/idle-mode/status?sessionId=${sessionId}`);
        if (!response.ok) throw new Error('Failed to load idle mode status');

        const data = await response.json();
        setStatus(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load idle mode status');
        console.error('Failed to load idle mode status:', err);
      } finally {
        setLoading(false);
      }
    };

    loadStatus();
  }, [sessionId]);

  // Toggle idle mode
  const toggleIdleMode = async (enabled: boolean) => {
    if (!sessionId || !status) return;

    try {
      const response = await fetch(`/api/idle-mode/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, enabled })
      });

      if (!response.ok) throw new Error('Failed to toggle idle mode');

      const updatedStatus = await response.json();
      setStatus(updatedStatus);
    } catch (err) {
      console.error('Failed to toggle idle mode:', err);
      setError(err instanceof Error ? err.message : 'Failed to toggle idle mode');
    }
  };

  // Update configuration
  const updateConfig = async (newConfig: Partial<IdleConfig>) => {
    if (!sessionId || !status) return;

    try {
      const response = await fetch(`/api/idle-mode/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          config: { ...status.config, ...newConfig }
        })
      });

      if (!response.ok) throw new Error('Failed to update config');

      const updatedStatus = await response.json();
      setStatus(updatedStatus);
    } catch (err) {
      console.error('Failed to update config:', err);
      setError(err instanceof Error ? err.message : 'Failed to update config');
    }
  };

  // Control current session
  const controlSession = async (action: 'pause' | 'resume' | 'terminate') => {
    if (!sessionId || !status?.currentSession) return;

    try {
      const response = await fetch(`/api/idle-mode/session/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          autonomousSessionId: status.currentSession.id
        })
      });

      if (!response.ok) throw new Error(`Failed to ${action} session`);

      const updatedStatus = await response.json();
      setStatus(updatedStatus);
    } catch (err) {
      console.error(`Failed to ${action} session:`, err);
      setError(err instanceof Error ? err.message : `Failed to ${action} session`);
    }
  };

  // Force start session
  const startSession = async (mode: IdleSession['mode']) => {
    if (!sessionId) return;

    try {
      const response = await fetch(`/api/idle-mode/session/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, mode })
      });

      if (!response.ok) throw new Error('Failed to start session');

      const updatedStatus = await response.json();
      setStatus(updatedStatus);
    } catch (err) {
      console.error('Failed to start session:', err);
      setError(err instanceof Error ? err.message : 'Failed to start session');
    }
  };

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes}m`;
  };

  const getStatusColor = (session?: IdleSession) => {
    if (!session) return 'text-emblem-muted';

    switch (session.status) {
      case 'active': return 'text-emblem-success';
      case 'paused': return 'text-emblem-warning';
      case 'completed': return 'text-emblem-primary';
      case 'terminated': return 'text-emblem-danger';
      default: return 'text-emblem-muted';
    }
  };

  const getStatusIcon = (session?: IdleSession) => {
    if (!session) return Activity;

    switch (session.status) {
      case 'active': return Play;
      case 'paused': return Pause;
      case 'completed': return CheckCircle;
      case 'terminated': return AlertTriangle;
      default: return Activity;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader className="w-6 h-6 animate-spin text-emblem-primary" />
        <span className="ml-2 text-emblem-muted">Loading idle mode status...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 text-emblem-danger mb-4">
          <AlertTriangle className="w-5 h-5" />
          <span className="font-medium">Error</span>
        </div>
        <p className="text-emblem-text mb-4">{error}</p>
        <Button
          variant="outline"
          onClick={() => window.location.reload()}
          className="w-full"
        >
          Retry
        </Button>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="p-6 text-center text-emblem-muted">
        <p>No idle mode status available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with main toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${status.config.enabled ? 'bg-emblem-success/20' : 'bg-emblem-muted/20'}`}>
            {status.config.enabled ? (
              <Power className="w-5 h-5 text-emblem-success" />
            ) : (
              <PowerOff className="w-5 h-5 text-emblem-muted" />
            )}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-emblem-text">
              Autonomous Idle Evolution
            </h2>
            <p className="text-sm text-emblem-muted">
              {status.config.enabled ? 'Active' : 'Disabled'} • {status.isIdle ? 'Currently Idle' : 'User Active'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfigMode(!configMode)}
          >
            <Settings className="w-4 h-4" />
          </Button>
          <Switch
            checked={status.config.enabled}
            onCheckedChange={toggleIdleMode}
          />
        </div>
      </div>

      {/* Current Status */}
      <Card className="p-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-sm text-emblem-muted mb-1">Idle Status</div>
            <div className="flex items-center gap-2">
              {status.isIdle ? (
                <>
                  <Clock className="w-4 h-4 text-emblem-warning" />
                  <span className="text-emblem-text">
                    Idle {formatDuration(status.idleDuration)}
                  </span>
                </>
              ) : (
                <>
                  <Activity className="w-4 h-4 text-emblem-success" />
                  <span className="text-emblem-text">Active</span>
                </>
              )}
            </div>
          </div>

          <div>
            <div className="text-sm text-emblem-muted mb-1">Current Session</div>
            <div className="flex items-center gap-2">
              {status.currentSession ? (
                <>
                  {(() => {
                    const StatusIcon = getStatusIcon(status.currentSession);
                    return <StatusIcon className={`w-4 h-4 ${getStatusColor(status.currentSession)}`} />;
                  })()}
                  <span className="text-emblem-text capitalize">
                    {status.currentSession.mode}
                  </span>
                </>
              ) : (
                <>
                  <div className="w-4 h-4 rounded-full bg-emblem-muted/20" />
                  <span className="text-emblem-muted">None</span>
                </>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Current Session Details */}
      <AnimatePresence>
        {status.currentSession && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Card className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-emblem-text">
                  {status.currentSession.mode.charAt(0).toUpperCase() + status.currentSession.mode.slice(1)} Session
                </h3>

                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="capitalize">
                    {status.currentSession.status}
                  </Badge>

                  {status.currentSession.status === 'active' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => controlSession('pause')}
                    >
                      <Pause className="w-3 h-3" />
                    </Button>
                  )}

                  {status.currentSession.status === 'paused' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => controlSession('resume')}
                    >
                      <Play className="w-3 h-3" />
                    </Button>
                  )}

                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => controlSession('terminate')}
                  >
                    <AlertTriangle className="w-3 h-3" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-emblem-muted mb-1">Activities</div>
                  <div className="text-emblem-text font-medium">
                    {status.currentSession.activities}
                  </div>
                </div>
                <div>
                  <div className="text-emblem-muted mb-1">Discoveries</div>
                  <div className="text-emblem-text font-medium">
                    {status.currentSession.discoveries}
                  </div>
                </div>
                <div>
                  <div className="text-emblem-muted mb-1">Coherence</div>
                  <div className="text-emblem-text font-medium">
                    {status.currentSession.coherenceLevel}%
                  </div>
                </div>
              </div>

              {status.currentSession.goals.length > 0 && (
                <div className="mt-4">
                  <div className="text-sm text-emblem-muted mb-2">Active Goals</div>
                  <div className="space-y-1">
                    {status.currentSession.goals.slice(0, 3).map((goal, idx) => (
                      <div
                        key={idx}
                        className="text-xs bg-emblem-surface/50 px-2 py-1 rounded truncate"
                      >
                        <Target className="w-3 h-3 inline mr-1" />
                        {goal}
                      </div>
                    ))}
                    {status.currentSession.goals.length > 3 && (
                      <div className="text-xs text-emblem-muted">
                        +{status.currentSession.goals.length - 3} more goals
                      </div>
                    )}
                  </div>
                </div>
              )}
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Manual Session Start */}
      {!status.currentSession && status.config.enabled && (
        <Card className="p-4">
          <h3 className="font-medium text-emblem-text mb-3">Start Manual Session</h3>
          <div className="grid grid-cols-2 gap-2">
            {(['exploration', 'research', 'creation', 'optimization'] as const).map((mode) => (
              <Button
                key={mode}
                variant="outline"
                size="sm"
                onClick={() => startSession(mode)}
                className="capitalize"
              >
                <Brain className="w-3 h-3 mr-1" />
                {mode}
              </Button>
            ))}
          </div>
        </Card>
      )}

      {/* Configuration Panel */}
      <AnimatePresence>
        {configMode && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Card className="p-4">
              <h3 className="font-medium text-emblem-text mb-4">Configuration</h3>

              <div className="space-y-4">
                <div>
                  <label className="text-sm text-emblem-muted mb-2 block">
                    Idle Threshold: {status.config.idleThreshold} minutes
                  </label>
                  <Slider
                    value={[status.config.idleThreshold]}
                    onValueChange={([value]) => updateConfig({ idleThreshold: value })}
                    min={1}
                    max={120}
                    step={1}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="text-sm text-emblem-muted mb-2 block">
                    Max Session Duration: {status.config.maxSessionDuration} minutes
                  </label>
                  <Slider
                    value={[status.config.maxSessionDuration]}
                    onValueChange={([value]) => updateConfig({ maxSessionDuration: value })}
                    min={10}
                    max={480}
                    step={10}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="text-sm text-emblem-muted mb-2 block">
                    Coherence Floor: {status.config.coherenceFloor}%
                  </label>
                  <Slider
                    value={[status.config.coherenceFloor]}
                    onValueChange={([value]) => updateConfig({ coherenceFloor: value })}
                    min={10}
                    max={90}
                    step={5}
                    className="w-full"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-emblem-muted mb-2 block">Evolution Intensity</label>
                    <select
                      value={status.config.evolutionIntensity}
                      onChange={(e) => updateConfig({
                        evolutionIntensity: e.target.value as IdleConfig['evolutionIntensity']
                      })}
                      className="w-full px-2 py-1 text-sm bg-emblem-surface border border-white/10 rounded"
                    >
                      <option value="conservative">Conservative</option>
                      <option value="moderate">Moderate</option>
                      <option value="adventurous">Adventurous</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-sm text-emblem-muted mb-2 block">Safety Level</label>
                    <select
                      value={status.config.safetyLevel}
                      onChange={(e) => updateConfig({
                        safetyLevel: e.target.value as IdleConfig['safetyLevel']
                      })}
                      className="w-full px-2 py-1 text-sm bg-emblem-surface border border-white/10 rounded"
                    >
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-emblem-muted">External Publishing</span>
                  <Switch
                    checked={status.config.externalPublishing}
                    onCheckedChange={(enabled) => updateConfig({ externalPublishing: enabled })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-emblem-muted">Subagent Coordination</span>
                  <Switch
                    checked={status.config.subagentCoordination}
                    onCheckedChange={(enabled) => updateConfig({ subagentCoordination: enabled })}
                  />
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recent History */}
      {status.sessionHistory.length > 0 && (
        <Card className="p-4">
          <h3 className="font-medium text-emblem-text mb-3">Recent Sessions</h3>
          <div className="space-y-2">
            {status.sessionHistory.slice(0, 5).map((session) => {
              const StatusIcon = getStatusIcon(session);
              return (
                <div
                  key={session.id}
                  className="flex items-center justify-between p-2 bg-emblem-surface/30 rounded"
                >
                  <div className="flex items-center gap-2">
                    <StatusIcon className={`w-3 h-3 ${getStatusColor(session)}`} />
                    <span className="text-sm capitalize">{session.mode}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-emblem-muted">
                    <span>{session.activities} activities</span>
                    <span>{formatDuration(new Date().getTime() - new Date(session.startTime).getTime())} ago</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Learning Progress */}
      {status.emergentCategories.length > 0 && (
        <Card className="p-4">
          <h3 className="font-medium text-emblem-text mb-3">Discovered Categories</h3>
          <div className="flex flex-wrap gap-2">
            {status.emergentCategories.map((category) => (
              <Badge key={category} variant="outline" className="text-xs">
                {category.replace(/_/g, ' ')}
              </Badge>
            ))}
          </div>
        </Card>
      )}

      {/* WebSocket Status */}
      <div className="flex items-center justify-center text-xs text-emblem-muted">
        <div className={`w-2 h-2 rounded-full mr-2 ${
          wsConnected ? 'bg-emblem-success' : 'bg-emblem-danger'
        }`} />
        {wsConnected ? 'Real-time updates active' : 'Connecting...'}
      </div>
    </div>
  );
}