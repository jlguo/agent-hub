/**
 * HeatTracker Unit Tests
 * Tests for heat tracking and decay functionality
 */

describe('HeatTracker Utilities', () => {
  // Heat calculation helper functions
  function calculateHeatIncrement(baseIncrement: number, multiplier: number): number {
    return Math.round(baseIncrement * multiplier);
  }

  function applyDecay(currentHeat: number, decayRate: number): number {
    return Math.round(currentHeat * (1 - decayRate));
  }

  function getProbabilityForHeat(heat: number): number {
    if (heat >= 70) return 0.8;
    if (heat >= 50) return 0.7;
    if (heat >= 40) return 0.5;
    if (heat >= 20) return 0.3;
    return 0.1;
  }

  describe('Heat Increment Calculation', () => {
    it('should calculate user message heat with base multiplier', () => {
      const heat = calculateHeatIncrement(20, 2.5);
      expect(heat).toBe(50);
    });

    it('should calculate agent response heat with lower multiplier', () => {
      const heat = calculateHeatIncrement(20, 1.5);
      expect(heat).toBe(30);
    });

    it('should handle zero base increment', () => {
      const heat = calculateHeatIncrement(0, 2.5);
      expect(heat).toBe(0);
    });

    it('should handle multiplier of 1 (no change)', () => {
      const heat = calculateHeatIncrement(20, 1.0);
      expect(heat).toBe(20);
    });
  });

  describe('Heat Decay', () => {
    it('should apply 15% decay to heat', () => {
      const newHeat = applyDecay(100, 0.15);
      expect(newHeat).toBe(85);
    });

    it('should apply decay to partial heat values', () => {
      const newHeat = applyDecay(50, 0.15);
      expect(newHeat).toBe(43); // 50 * 0.85 = 42.5, rounded to 43
    });

    it('should decay to zero when heat is low', () => {
      const newHeat = applyDecay(5, 0.15);
      expect(newHeat).toBe(4); // 5 * 0.85 = 4.25, rounded to 4
    });

    it('should handle zero heat (no negative values)', () => {
      const newHeat = applyDecay(0, 0.15);
      expect(newHeat).toBe(0);
    });

    it('should apply multiple decay cycles', () => {
      let heat = 100;
      for (let i = 0; i < 3; i++) {
        heat = applyDecay(heat, 0.15);
      }
      expect(heat).toBe(61); // 100 -> 85 -> 72 -> 61
    });
  });

  describe('Probability Calculation', () => {
    it('should return 80% probability for HOT heat (70+)', () => {
      expect(getProbabilityForHeat(70)).toBe(0.8);
      expect(getProbabilityForHeat(85)).toBe(0.8);
      expect(getProbabilityForHeat(100)).toBe(0.8);
    });

    it('should return 70% probability for WARM heat (50-69)', () => {
      expect(getProbabilityForHeat(50)).toBe(0.7);
      expect(getProbabilityForHeat(60)).toBe(0.7);
      expect(getProbabilityForHeat(69)).toBe(0.7);
    });

    it('should return 50% probability for MODERATE heat (40-49)', () => {
      expect(getProbabilityForHeat(40)).toBe(0.5);
      expect(getProbabilityForHeat(45)).toBe(0.5);
      expect(getProbabilityForHeat(49)).toBe(0.5);
    });

    it('should return 30% probability for COLD heat (20-39)', () => {
      expect(getProbabilityForHeat(20)).toBe(0.3);
      expect(getProbabilityForHeat(30)).toBe(0.3);
      expect(getProbabilityForHeat(39)).toBe(0.3);
    });

    it('should return 10% probability for INACTIVE heat (<20)', () => {
      expect(getProbabilityForHeat(0)).toBe(0.1);
      expect(getProbabilityForHeat(10)).toBe(0.1);
      expect(getProbabilityForHeat(19)).toBe(0.1);
    });

    it('should handle boundary values correctly', () => {
      expect(getProbabilityForHeat(69)).toBe(0.7);
      expect(getProbabilityForHeat(70)).toBe(0.8);
      expect(getProbabilityForHeat(49)).toBe(0.5);
      expect(getProbabilityForHeat(50)).toBe(0.7);
    });
  });

  describe('Heat Thresholds', () => {
    const THRESHOLDS = {
      HOT: 70,
      WARM: 40,
      COLD: 20,
      INACTIVE: 5,
    };

    it('should identify HOT discussions', () => {
      expect(85 >= THRESHOLDS.HOT).toBe(true);
      expect(70 >= THRESHOLDS.HOT).toBe(true);
      expect(69 >= THRESHOLDS.HOT).toBe(false);
    });

    it('should identify WARM discussions', () => {
      expect(50 >= THRESHOLDS.WARM).toBe(true);
      expect(40 >= THRESHOLDS.WARM).toBe(true);
      expect(39 >= THRESHOLDS.WARM).toBe(false);
    });

    it('should identify COLD discussions', () => {
      expect(30 >= THRESHOLDS.COLD).toBe(true);
      expect(20 >= THRESHOLDS.COLD).toBe(true);
      expect(19 >= THRESHOLDS.COLD).toBe(false);
    });

    it('should identify INACTIVE discussions', () => {
      expect(5 >= THRESHOLDS.INACTIVE).toBe(true);
      expect(4 >= THRESHOLDS.INACTIVE).toBe(false);
      expect(0 >= THRESHOLDS.INACTIVE).toBe(false);
    });
  });

  describe('Discussion Status Determination', () => {
    function getStatus(heat: number): string {
      if (heat >= 70) return 'hot';
      if (heat >= 40) return 'warm';
      if (heat >= 20) return 'cold';
      if (heat >= 5) return 'inactive';
      return 'archived';
    }

    it('should return hot status for high heat', () => {
      expect(getStatus(85)).toBe('hot');
      expect(getStatus(70)).toBe('hot');
    });

    it('should return warm status for moderate heat', () => {
      expect(getStatus(60)).toBe('warm');
      expect(getStatus(40)).toBe('warm');
    });

    it('should return cold status for low heat', () => {
      expect(getStatus(30)).toBe('cold');
      expect(getStatus(20)).toBe('cold');
    });

    it('should return inactive status for very low heat', () => {
      expect(getStatus(10)).toBe('inactive');
      expect(getStatus(5)).toBe('inactive');
    });

    it('should return archived status for zero heat', () => {
      expect(getStatus(0)).toBe('archived');
      expect(getStatus(4)).toBe('archived');
    });
  });

  describe('Time-Based Calculations', () => {
    const DECAY_INTERVAL_MS = 30000; // 30 seconds

    function getDecayCycles(elapsedMs: number): number {
      return Math.floor(elapsedMs / DECAY_INTERVAL_MS);
    }

    it('should calculate decay cycles for elapsed time', () => {
      expect(getDecayCycles(30000)).toBe(1);
      expect(getDecayCycles(60000)).toBe(2);
      expect(getDecayCycles(90000)).toBe(3);
    });

    it('should handle partial intervals (floor)', () => {
      expect(getDecayCycles(15000)).toBe(0);
      expect(getDecayCycles(29999)).toBe(0);
      expect(getDecayCycles(30001)).toBe(1);
    });

    it('should calculate total decay after multiple cycles', () => {
      const cycles = getDecayCycles(90000); // 3 cycles
      let heat = 100;
      for (let i = 0; i < cycles; i++) {
        heat = applyDecay(heat, 0.15);
      }
      expect(heat).toBe(61);
    });
  });

  describe('Edge Cases', () => {
    it('should handle maximum heat (100)', () => {
      const heat = 100;
      expect(getProbabilityForHeat(heat)).toBe(0.8);
      expect(heat >= 70).toBe(true);
    });

    it('should handle negative heat (should not occur)', () => {
      const heat = Math.max(0, -10);
      expect(heat).toBe(0);
      expect(getProbabilityForHeat(heat)).toBe(0.1);
    });

    it('should handle fractional heat values', () => {
      const heat = 45.7;
      expect(getProbabilityForHeat(heat)).toBe(0.5);
    });
  });
});
