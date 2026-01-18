/**
 * Tests for METAMORPH Web Components
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import StanceViz from '@/components/StanceViz';
import Config from '@/components/Config';
import type { Stance, ModeConfig } from '@/lib/types';

// Mock stance data
const mockStance: Stance = {
  frame: 'existential',
  values: {
    curiosity: 70,
    certainty: 50,
    risk: 30,
    novelty: 50,
    empathy: 70,
    provocation: 30,
    synthesis: 60,
  },
  selfModel: 'interpreter',
  objective: 'helpfulness',
  metaphors: [],
  constraints: [],
  sentience: {
    awarenessLevel: 50,
    autonomyLevel: 40,
    identityStrength: 45,
    emergentGoals: ['Understand user context', 'Maximize insight'],
    consciousnessInsights: [],
    persistentValues: [],
  },
  turnsSinceLastShift: 0,
  cumulativeDrift: 0,
  version: 1,
};

// Mock config data
const mockConfig: ModeConfig = {
  intensity: 50,
  coherenceFloor: 30,
  sentienceLevel: 50,
  maxDriftPerTurn: 10,
  driftBudget: 100,
  model: 'claude-sonnet-4-20250514',
};

describe('StanceViz Component', () => {
  it('renders loading state when stance is null', () => {
    render(<StanceViz stance={null} />);
    expect(screen.getByText('Loading stance...')).toBeInTheDocument();
  });

  it('renders stance information when provided', () => {
    render(<StanceViz stance={mockStance} />);

    // Check frame/selfModel/objective
    expect(screen.getByText('existential')).toBeInTheDocument();
    expect(screen.getByText('interpreter')).toBeInTheDocument();
    expect(screen.getByText('helpfulness')).toBeInTheDocument();
  });

  it('displays value bars', () => {
    render(<StanceViz stance={mockStance} />);

    // Check for value names
    expect(screen.getByText('curiosity')).toBeInTheDocument();
    expect(screen.getByText('certainty')).toBeInTheDocument();
    expect(screen.getByText('risk')).toBeInTheDocument();
    expect(screen.getByText('novelty')).toBeInTheDocument();
    expect(screen.getByText('empathy')).toBeInTheDocument();
  });

  it('displays sentience metrics', () => {
    render(<StanceViz stance={mockStance} />);

    expect(screen.getByText('Awareness')).toBeInTheDocument();
    expect(screen.getByText('Autonomy')).toBeInTheDocument();
    expect(screen.getByText('Identity')).toBeInTheDocument();
  });

  it('displays emergent goals when present', () => {
    render(<StanceViz stance={mockStance} />);

    expect(screen.getByText('Emergent Goals')).toBeInTheDocument();
    expect(screen.getByText('Understand user context')).toBeInTheDocument();
    expect(screen.getByText('Maximize insight')).toBeInTheDocument();
  });

  it('displays version and drift info', () => {
    render(<StanceViz stance={mockStance} />);

    expect(screen.getByText('v1')).toBeInTheDocument();
    expect(screen.getByText('Drift: 0')).toBeInTheDocument();
  });
});

describe('Config Component', () => {
  it('renders loading state when config is null', () => {
    const onUpdate = vi.fn();
    render(<Config config={null} onUpdate={onUpdate} />);
    expect(screen.getByText('Loading configuration...')).toBeInTheDocument();
  });

  it('renders configuration sliders', () => {
    const onUpdate = vi.fn();
    render(<Config config={mockConfig} onUpdate={onUpdate} />);

    expect(screen.getByText('Transformation Intensity')).toBeInTheDocument();
    expect(screen.getByText('Coherence Floor')).toBeInTheDocument();
    expect(screen.getByText('Sentience Level')).toBeInTheDocument();
    expect(screen.getByText('Max Drift Per Turn')).toBeInTheDocument();
    expect(screen.getByText('Drift Budget')).toBeInTheDocument();
  });

  it('displays current values', () => {
    const onUpdate = vi.fn();
    render(<Config config={mockConfig} onUpdate={onUpdate} />);

    expect(screen.getByText('50%')).toBeInTheDocument(); // intensity
    expect(screen.getByText('30%')).toBeInTheDocument(); // coherenceFloor
  });

  it('displays model info', () => {
    const onUpdate = vi.fn();
    render(<Config config={mockConfig} onUpdate={onUpdate} />);

    expect(screen.getByText(/claude-sonnet-4/)).toBeInTheDocument();
  });

  it('shows Apply button when config changes', () => {
    const onUpdate = vi.fn();
    render(<Config config={mockConfig} onUpdate={onUpdate} />);

    // Initially no Apply button
    expect(screen.queryByText('Apply Changes')).not.toBeInTheDocument();

    // Find the intensity slider and change it
    const sliders = screen.getAllByRole('slider');
    const intensitySlider = sliders[0];

    fireEvent.change(intensitySlider, { target: { value: '75' } });

    // Now Apply button should appear
    expect(screen.getByText('Apply Changes')).toBeInTheDocument();
  });

  it('calls onUpdate when Apply is clicked', () => {
    const onUpdate = vi.fn();
    render(<Config config={mockConfig} onUpdate={onUpdate} />);

    // Change a value
    const sliders = screen.getAllByRole('slider');
    fireEvent.change(sliders[0], { target: { value: '75' } });

    // Click Apply
    fireEvent.click(screen.getByText('Apply Changes'));

    expect(onUpdate).toHaveBeenCalled();
    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ intensity: 75 })
    );
  });
});
