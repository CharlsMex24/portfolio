// The site's leg IK for the Go2: the home pose matches the MJCF keyframe, and IK then FK returns the target.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { legIK, legFK } from '../../assets/js/go2-kinematics.js';

const near = (a, b, tol = 1e-6) => Math.abs(a - b) < tol;

test('home keyframe (0, 0.9, -1.8) puts the feet 0.265 m under the hips', () => {
  for (const leg of ['FL', 'FR', 'RL', 'RR']) {
    const [x, y, z] = legFK(leg, [0, 0.9, -1.8]);
    assert.ok(near(x, 0) && near(z, -0.26482, 1e-4), `${leg}: ${[x, y, z]}`);
    const [a, t, k] = legIK(leg, x, y, z);
    assert.ok(near(a, 0) && near(t, 0.9) && near(k, -1.8), `${leg}: ${[a, t, k]}`);
  }
});

test('IK then FK returns reachable targets on every leg', () => {
  for (const leg of ['FL', 'FR', 'RL', 'RR']) {
    for (const [x, y, z] of [[0.05, 0.08, -0.25], [-0.06, 0.12, -0.2], [0.1, 0.02, -0.3], [0, 0.0955, -0.1]]) {
      const target = [x, leg[1] === 'R' ? -y : y, z];
      const back = legFK(leg, legIK(leg, ...target));
      assert.ok(back.every((v, i) => near(v, target[i], 1e-6)), `${leg} ${target} -> ${back}`);
    }
  }
});
