'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Edit3,
  Check,
  X,
  ChevronDown,
  ChevronRight,
  Lock,
  Unlock,
  Sparkles,
  AlertCircle,
  Save,
  RotateCcw
} from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card } from './ui/card';
import { getAuthHeaders } from '@/lib/auth';

interface PromptChunk {
  id: string;
  type: 'system' | 'context' | 'goal' | 'instruction' | 'constraint';
  content: string;
  editable: boolean;
  required: boolean;
  order: number;
}

interface PromptEditorProps {
  sessionId: string;
  chunks: PromptChunk[];
  onChunksChange: (chunks: PromptChunk[]) => void;
  onApprove: () => void;
  onReject: () => void;
  status: 'awaiting_approval' | 'executing' | 'idle';
}

const CHUNK_TYPE_CONFIG: Record<PromptChunk['type'], {
  label: string;
  color: string;
  icon: typeof Sparkles;
}> = {
  system: { label: 'System', color: 'bg-purple-500/20 text-purple-400', icon: Lock },
  context: { label: 'Context', color: 'bg-blue-500/20 text-blue-400', icon: Sparkles },
  goal: { label: 'Goal', color: 'bg-green-500/20 text-green-400', icon: Sparkles },
  instruction: { label: 'Instructions', color: 'bg-yellow-500/20 text-yellow-400', icon: Edit3 },
  constraint: { label: 'Constraints', color: 'bg-red-500/20 text-red-400', icon: AlertCircle }
};

function ChunkEditor({
  chunk,
  onUpdate,
  onReset
}: {
  chunk: PromptChunk;
  onUpdate: (content: string) => void;
  onReset: () => void;
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(chunk.content);
  const [originalContent] = useState(chunk.content);

  const config = CHUNK_TYPE_CONFIG[chunk.type];
  const Icon = config.icon;
  const hasChanges = editContent !== originalContent;

  const handleSave = () => {
    onUpdate(editContent);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditContent(chunk.content);
    setIsEditing(false);
  };

  const handleReset = () => {
    setEditContent(originalContent);
    onUpdate(originalContent);
    onReset();
  };

  return (
    <Card className="overflow-hidden border border-white/5">
      {/* Header */}
      <div
        className="flex items-center justify-between p-3 bg-emblem-surface/50 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-emblem-muted" />
          ) : (
            <ChevronRight className="w-4 h-4 text-emblem-muted" />
          )}
          <Badge className={config.color}>
            <Icon className="w-3 h-3 mr-1" />
            {config.label}
          </Badge>
          {hasChanges && (
            <Badge variant="outline" className="text-yellow-400 border-yellow-400/30">
              Modified
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          {chunk.required && (
            <Badge variant="secondary" className="text-xs">Required</Badge>
          )}
          {chunk.editable ? (
            <Unlock className="w-4 h-4 text-emblem-muted" />
          ) : (
            <Lock className="w-4 h-4 text-emblem-muted" />
          )}
        </div>
      </div>

      {/* Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-white/5"
          >
            <div className="p-4">
              {isEditing && chunk.editable ? (
                <div className="space-y-3">
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full h-48 p-3 bg-emblem-bg border border-white/10 rounded-lg text-sm text-emblem-text font-mono resize-y focus:outline-none focus:ring-2 focus:ring-emblem-primary/50"
                    placeholder="Enter prompt content..."
                  />
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-emblem-muted">
                      {editContent.length} characters
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleCancel}
                      >
                        <X className="w-4 h-4 mr-1" />
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSave}
                      >
                        <Save className="w-4 h-4 mr-1" />
                        Save
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <pre className="whitespace-pre-wrap text-sm text-emblem-text font-mono bg-emblem-bg/50 p-3 rounded-lg max-h-48 overflow-y-auto">
                    {chunk.content}
                  </pre>
                  {chunk.editable && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setIsEditing(true)}
                      >
                        <Edit3 className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                      {hasChanges && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={handleReset}
                        >
                          <RotateCcw className="w-4 h-4 mr-1" />
                          Reset
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

export default function PromptEditor({
  sessionId,
  chunks,
  onChunksChange,
  onApprove,
  onReject,
  status
}: PromptEditorProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateChunk = useCallback(async (chunkId: string, content: string) => {
    try {
      setSaving(true);
      setError(null);

      const encodedSessionId = encodeURIComponent(sessionId);
      const response = await fetch(`/api/idle-mode/prompts/${encodedSessionId}/${chunkId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ content })
      });

      if (!response.ok) {
        throw new Error('Failed to update prompt chunk');
      }

      // Update local state
      const updatedChunks = chunks.map(c =>
        c.id === chunkId ? { ...c, content } : c
      );
      onChunksChange(updatedChunks);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update');
      console.error('Failed to update chunk:', err);
    } finally {
      setSaving(false);
    }
  }, [sessionId, chunks, onChunksChange]);

  const handleApprove = async () => {
    try {
      setSaving(true);
      setError(null);

      const encodedSessionId = encodeURIComponent(sessionId);
      const response = await fetch(`/api/idle-mode/prompts/${encodedSessionId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() }
      });

      if (!response.ok) {
        throw new Error('Failed to approve prompt');
      }

      onApprove();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve');
      console.error('Failed to approve:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async () => {
    try {
      setSaving(true);
      setError(null);

      const encodedSessionId = encodeURIComponent(sessionId);
      const response = await fetch(`/api/idle-mode/prompts/${encodedSessionId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() }
      });

      if (!response.ok) {
        throw new Error('Failed to reject prompt');
      }

      onReject();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject');
      console.error('Failed to reject:', err);
    } finally {
      setSaving(false);
    }
  };

  const sortedChunks = [...chunks].sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-emblem-text">
            Review & Edit Prompt
          </h3>
          <p className="text-sm text-emblem-muted">
            Review the prompts below before starting the autonomous session
          </p>
        </div>
        {saving && (
          <Badge variant="outline" className="text-yellow-400">
            Saving...
          </Badge>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-400" />
          <span className="text-sm text-red-400">{error}</span>
        </div>
      )}

      {/* Chunk Editors */}
      <div className="space-y-3">
        {sortedChunks.map((chunk) => (
          <ChunkEditor
            key={chunk.id}
            chunk={chunk}
            onUpdate={(content) => updateChunk(chunk.id, content)}
            onReset={() => {}}
          />
        ))}
      </div>

      {/* Preview Combined Prompt */}
      <Card className="p-4 border border-white/5">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-emblem-text">Combined Prompt Preview</h4>
          <Badge variant="secondary">
            {sortedChunks.reduce((acc, c) => acc + c.content.length, 0)} characters
          </Badge>
        </div>
        <pre className="whitespace-pre-wrap text-xs text-emblem-muted font-mono bg-emblem-bg/50 p-3 rounded-lg max-h-32 overflow-y-auto">
          {sortedChunks.map(c => c.content).join('\n\n---\n\n')}
        </pre>
      </Card>

      {/* Action Buttons */}
      {status === 'awaiting_approval' && (
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            variant="outline"
            onClick={handleReject}
            disabled={saving}
          >
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          <Button
            onClick={handleApprove}
            disabled={saving}
            className="bg-emblem-primary hover:bg-emblem-primary/80"
          >
            <Check className="w-4 h-4 mr-2" />
            Approve & Start
          </Button>
        </div>
      )}

      {status === 'executing' && (
        <div className="flex items-center justify-center p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
          <Sparkles className="w-4 h-4 text-green-400 mr-2 animate-pulse" />
          <span className="text-sm text-green-400">Session executing...</span>
        </div>
      )}
    </div>
  );
}
