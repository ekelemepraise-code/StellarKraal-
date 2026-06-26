import React from 'react';
import { render, screen } from '@testing-library/react';
import HealthGauge from '../components/HealthGauge';

jest.mock('../lib/design-tokens', () => ({
  healthColor: (bps: number) => (bps >= 10_000 ? '#16a34a' : '#dc2626'),
  colors: { text: { secondary: 'text-brown-600' } },
}));

describe('HealthGauge (#574 – ARIA)', () => {
  it('SVG has role=img', () => {
    render(<HealthGauge value={13333} />);
    expect(screen.getByRole('img')).toBeTruthy();
  });

  it('aria-label contains formatted health factor value', () => {
    render(<HealthGauge value={13333} />);
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe('Health factor: 1.33');
  });

  it('aria-label updates when value prop changes', () => {
    const { rerender } = render(<HealthGauge value={10000} />);
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe('Health factor: 1.00');
    rerender(<HealthGauge value={8000} />);
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe('Health factor: 0.80');
  });

  it('shows Healthy label for value >= 10_000', () => {
    render(<HealthGauge value={15000} />);
    expect(screen.getByText('Healthy')).toBeTruthy();
  });

  it('shows At Risk label for value < 10_000', () => {
    render(<HealthGauge value={8000} />);
    expect(screen.getByText('At Risk')).toBeTruthy();
  });
});
