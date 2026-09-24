/* Leg kinematics of the Unitree Go2 (dimensions from the MuJoCo Menagerie model).
   Frame: MuJoCo body frame, x forward, y left, z up. Each leg: abduction about x, thigh and calf about y.
   legIK takes a foot position relative to the hip joint and returns [abduction, thigh, calf] in radians. */

export const L1 = 0.213;            // thigh length
export const L2 = 0.213;            // calf length
export const OFFSET = 0.0955;       // lateral offset from the hip joint to the leg plane
export const HIPS = { FL: [0.1934, 0.0465], FR: [0.1934, -0.0465], RL: [-0.1934, 0.0465], RR: [-0.1934, -0.0465] };
export const SIDE = { FL: 1, FR: -1, RL: 1, RR: -1 };
export const LIMITS = {
  abduction: [-1.0472, 1.0472],
  FL: [-1.5708, 3.4907], FR: [-1.5708, 3.4907],   // front thighs
  RL: [-0.5236, 4.5379], RR: [-0.5236, 4.5379],   // back thighs
  knee: [-2.7227, -0.83776],
};
const clamp = (v, [a, b]) => Math.min(b, Math.max(a, v));

export function legIK(leg, x, y, z) {
  const d = OFFSET * SIDE[leg];
  // 1. abduction: turn the leg plane so the foot sits at the lateral offset d
  const L = Math.sqrt(Math.max(y * y + z * z - d * d, 1e-9));
  const abduction = Math.atan2(z, y) - Math.atan2(-L, d);
  // 2. inside the leg plane it is a two-link arm: u points backward, v points down
  const u = -x, v = L;
  const cosK = Math.max(-1, Math.min(1, (u * u + v * v - L1 * L1 - L2 * L2) / (2 * L1 * L2)));
  const knee = -Math.acos(cosK);                   // Go2 knees bend backward, so the calf angle is negative
  const thigh = Math.atan2(u, v) - Math.atan2(L2 * Math.sin(knee), L1 + L2 * Math.cos(knee));
  const wrapped = Math.atan2(Math.sin(abduction), Math.cos(abduction));
  return [clamp(wrapped, LIMITS.abduction), clamp(thigh, LIMITS[leg]), clamp(knee, LIMITS.knee)];
}

export function legFK(leg, [abduction, thigh, knee]) {
  const d = OFFSET * SIDE[leg];
  const xp = -L1 * Math.sin(thigh) - L2 * Math.sin(thigh + knee);
  const zp = -L1 * Math.cos(thigh) - L2 * Math.cos(thigh + knee);
  return [xp, d * Math.cos(abduction) - zp * Math.sin(abduction), d * Math.sin(abduction) + zp * Math.cos(abduction)];
}
